/**
 * Memory profiling script for the proof-generation-api.
 *
 * Starts the Express server as a child process with --expose-gc and --inspect,
 * then replays real production exit-payload requests from a burnTxHash corpus,
 * firing them concurrently to match production load patterns.
 * Heap memory is sampled between rounds via the Chrome DevTools Protocol.
 *
 * Usage:
 *   pnpm run memory-report
 *
 * Environment variables:
 *   MEMORY_REPORT_LABEL      - label for this run (default: "unlabelled")
 *   MEMORY_REPORT_OUT        - output path (default: reports/memory-<ts>.json)
 *   MEMORY_REPORT_CORPUS     - path to CSV export from Datadog (required)
 *   MEMORY_REPORT_ROUNDS     - number of replay rounds (default: 10)
 *   MEMORY_REPORT_CONCURRENCY - concurrent requests per round (default: 10)
 *
 * Compare two reports:
 *   pnpm run memory-compare reports/memory-before.json reports/memory-after.json
 */

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');

// ROUNDS is the number of memory snapshots. The full corpus is always replayed
// once; snapshots are taken every (corpusSize / ROUNDS) batches.
const ROUNDS = parseInt(process.env['MEMORY_REPORT_ROUNDS'] ?? '10', 10);
const CONCURRENCY = parseInt(process.env['MEMORY_REPORT_CONCURRENCY'] ?? '20', 10);
const CORPUS_PATH = process.env['MEMORY_REPORT_CORPUS'];
// Set MEMORY_REPORT_EXTERNAL=true to skip spawning a local server and connect
// to an already-running one instead (e.g. a Docker container).
const EXTERNAL = process.env['MEMORY_REPORT_EXTERNAL'] === 'true';
const SERVER_PORT = parseInt(process.env['MEMORY_REPORT_SERVER_PORT'] ?? '5099', 10);
const INSPECTOR_PORT = parseInt(process.env['MEMORY_REPORT_INSPECTOR_PORT'] ?? '9099', 10);

// ERC-20 Transfer — the dominant event type in production traffic.
const DEFAULT_EVENT_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// ─── Corpus ──────────────────────────────────────────────────────────────────

function loadCorpus(csvPath: string): string[] {
  const csv = readFileSync(csvPath, 'utf8');
  const hashes = new Set<string>();

  for (const line of csv.split('\n').slice(1)) {
    if (!line.trim()) continue;
    // Last field is the JSON content column, double-quoted with internal quotes doubled.
    const match = line.match(/"(\{.*\})"\s*$/);
    if (!match) continue;
    try {
      const obj = JSON.parse(match[1]!.replace(/""/g, '"')) as { burnTxHash?: string };
      if (obj.burnTxHash) hashes.add(obj.burnTxHash);
    } catch {
      // non-JSON content row, skip
    }
  }

  if (hashes.size === 0) throw new Error(`No burnTxHashes found in ${csvPath}`);
  return [...hashes];
}

// ─── CDP helpers ─────────────────────────────────────────────────────────────

async function cdpEval(expression: string): Promise<unknown> {
  const res = await fetch(`http://127.0.0.1:${INSPECTOR_PORT}/json`);
  const targets = (await res.json()) as Array<{ webSocketDebuggerUrl: string }>;
  const wsUrl = targets[0]?.webSocketDebuggerUrl;
  if (!wsUrl) throw new Error('No inspector target found');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const id = 1;

    ws.onopen = () => {
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression } }));
    };

    ws.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string) as {
        id: number;
        result?: { result?: { value?: string } };
      };
      if (msg.id !== id) return;
      ws.close();
      try {
        resolve(JSON.parse(msg.result?.result?.value ?? 'null'));
      } catch {
        reject(new Error(`Unexpected CDP response: ${event.data as string}`));
      }
    };

    ws.onerror = () => reject(new Error('CDP WebSocket error'));
    setTimeout(() => {
      ws.close();
      reject(new Error('CDP timeout'));
    }, 10_000);
  });
}

interface HeapStats {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
}

async function getServerHeap(): Promise<HeapStats> {
  const mem = (await cdpEval('JSON.stringify(process.memoryUsage())')) as {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  return {
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    rssMB: Math.round(mem.rss / 1024 / 1024),
    externalMB: Math.round(mem.external / 1024 / 1024)
  };
}

// ─── Process / HTTP helpers ───────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not ready */
    }
    await sleep(500);
  }
  throw new Error(`Server not ready at ${url} after ${timeoutMs}ms`);
}

async function fireRequest(hash: string): Promise<{ status: number; durationMs: number }> {
  const url =
    `http://localhost:${SERVER_PORT}/api/v1/matic/exit-payload/${hash}` +
    `?eventSignature=${DEFAULT_EVENT_SIG}`;
  const start = Date.now();
  const res = await fetch(url);
  // Drain the body so the connection is returned cleanly.
  await res.text();
  return { status: res.status, durationMs: Date.now() - start };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface RoundSnapshot extends HeapStats {
  round: number;
  requests: number;
  successCount: number;
  durationMs: number;
}

export interface MemoryReport {
  timestamp: string;
  nodeVersion: string;
  label: string;
  rounds: number;
  concurrency: number;
  corpusSize: number;
  initial: HeapStats;
  snapshots: RoundSnapshot[];
  summary: {
    totalRequests: number;
    heapGrowthMB: number;
    externalGrowthMB: number;
    peakHeapMB: number;
    peakRssMB: number;
    peakExternalMB: number;
  };
}

async function run(): Promise<void> {
  if (!CORPUS_PATH) {
    console.error('MEMORY_REPORT_CORPUS must be set to the path of the Datadog CSV export.');
    process.exit(1);
  }

  const label = process.env['MEMORY_REPORT_LABEL'] ?? 'unlabelled';
  const corpus = loadCorpus(CORPUS_PATH);

  console.log(`\n=== Memory report: ${label} ===`);
  console.log(`Node ${process.version}`);
  console.log(`Corpus: ${corpus.length} unique burnTxHashes`);
  console.log(`${ROUNDS} rounds × ${CONCURRENCY} concurrent requests\n`);

  const serverProc = EXTERNAL
    ? null
    : spawn(
        'node',
        ['--expose-gc', `--inspect=127.0.0.1:${INSPECTOR_PORT}`, 'src/bin/apiServer.ts'],
        {
          env: { ...process.env, PORT: String(SERVER_PORT) },
          cwd: REPO_ROOT,
          stdio: 'pipe'
        }
      );

  serverProc?.on('exit', (code) => {
    if (code !== null && code !== 0) console.error(`Server exited with code ${code}`);
  });

  try {
    process.stdout.write('Waiting for server... ');
    await waitForServer(`http://localhost:${SERVER_PORT}/health-check`);
    console.log(EXTERNAL ? 'connected (external).' : 'ready.');
    await sleep(1000); // inspector init

    const initial = await getServerHeap();
    console.log(
      `Initial  : ${initial.heapUsedMB} MB heap  |  ${initial.externalMB} MB external  |  ${initial.rssMB} MB RSS\n`
    );

    const snapshots: RoundSnapshot[] = [];

    // Split the full corpus into CONCURRENCY-sized batches, then take a memory
    // snapshot at evenly-spaced intervals so we have ROUNDS data points.
    const batches: string[][] = [];
    for (let i = 0; i < corpus.length; i += CONCURRENCY) {
      batches.push(corpus.slice(i, i + CONCURRENCY));
    }
    const snapshotEvery = Math.max(1, Math.floor(batches.length / ROUNDS));

    console.log(
      `${batches.length} batches of ${CONCURRENCY}, snapshot every ${snapshotEvery} batches\n`
    );

    let totalRequests = 0;
    let totalSuccesses = 0;
    let snapshotIndex = 0;

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b]!;
      const started = Date.now();
      const results = await Promise.all(batch.map((h) => fireRequest(h)));
      const durationMs = Date.now() - started;
      totalRequests += results.length;
      totalSuccesses += results.filter((r) => r.status === 200).length;

      const isLastBatch = b === batches.length - 1;
      const isSnapshotBatch = (b + 1) % snapshotEvery === 0 || isLastBatch;

      if (isSnapshotBatch) {
        snapshotIndex++;
        const stats = await getServerHeap();

        const heapDelta = stats.heapUsedMB - initial.heapUsedMB;
        const extDelta = stats.externalMB - initial.externalMB;
        const sign = (n: number) => (n >= 0 ? '+' : '') + n;

        console.log(
          `Snap ${String(snapshotIndex).padStart(2)}  ` +
            `[batch ${b + 1}/${batches.length}, req ${totalRequests}/${corpus.length}]  ` +
            `heap ${stats.heapUsedMB} MB (${sign(heapDelta)})  ` +
            `ext ${stats.externalMB} MB (${sign(extDelta)})  ` +
            `RSS ${stats.rssMB} MB`
        );

        snapshots.push({
          round: snapshotIndex,
          requests: totalRequests,
          successCount: totalSuccesses,
          durationMs,
          ...stats
        });
      }
    }

    const last = snapshots[snapshots.length - 1]!;
    const report: MemoryReport = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      label,
      rounds: ROUNDS,
      concurrency: CONCURRENCY,
      corpusSize: corpus.length,
      initial,
      snapshots,
      summary: {
        totalRequests: ROUNDS * CONCURRENCY,
        heapGrowthMB: last.heapUsedMB - initial.heapUsedMB,
        externalGrowthMB: last.externalMB - initial.externalMB,
        peakHeapMB: Math.max(...snapshots.map((s) => s.heapUsedMB)),
        peakRssMB: Math.max(...snapshots.map((s) => s.rssMB)),
        peakExternalMB: Math.max(...snapshots.map((s) => s.externalMB))
      }
    };

    const reportsDir = join(REPO_ROOT, 'reports');
    mkdirSync(reportsDir, { recursive: true });
    const outFile =
      process.env['MEMORY_REPORT_OUT'] ?? join(reportsDir, `memory-${Date.now()}.json`);
    writeFileSync(outFile, JSON.stringify(report, null, 2));

    console.log(`\nSummary`);
    console.log(`  Heap growth     : ${report.summary.heapGrowthMB} MB`);
    console.log(`  External growth : ${report.summary.externalGrowthMB} MB`);
    console.log(`  Peak heap       : ${report.summary.peakHeapMB} MB`);
    console.log(`  Peak RSS        : ${report.summary.peakRssMB} MB`);
    console.log(`  Report          : ${outFile}\n`);
  } finally {
    serverProc?.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
