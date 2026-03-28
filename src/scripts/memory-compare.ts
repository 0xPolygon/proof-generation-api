/**
 * Compare two memory reports produced by memory-report.ts.
 *
 * Usage:
 *   pnpm run memory-compare reports/memory-before.json reports/memory-after.json
 */

import { readFileSync } from 'node:fs';

import type { MemoryReport } from './memory-report.ts';

const [, , beforePath, afterPath] = process.argv;

if (!beforePath || !afterPath) {
  console.error('Usage: pnpm run memory-compare <before.json> <after.json>');
  process.exit(1);
}

const before: MemoryReport = JSON.parse(readFileSync(beforePath, 'utf8'));
const after: MemoryReport = JSON.parse(readFileSync(afterPath, 'utf8'));

function fmt(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n} MB`;
}

// Linear regression slope (MB per snapshot) — positive = growing, negative = shrinking.
function growthSlope(snaps: MemoryReport['snapshots']): number {
  const n = snaps.length;
  if (n < 2) return 0;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += snaps[i]!.heapUsedMB;
    sumXY += i * snaps[i]!.heapUsedMB;
    sumX2 += i * i;
  }
  return Math.round(((n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)) * 10) / 10;
}

console.log('\n=== Memory comparison ===\n');
console.log(`Before : ${before.label}  (${before.timestamp})`);
console.log(`After  : ${after.label}  (${after.timestamp})\n`);

console.log(
  `${'Round'.padEnd(12)} ${'Before heap'.padStart(12)} ${'After heap'.padStart(11)} ${'Delta'.padStart(10)}`
);
console.log('─'.repeat(48));

const len = Math.max(before.snapshots.length, after.snapshots.length);
for (let i = 0; i < len; i++) {
  const b = before.snapshots[i];
  const a = after.snapshots[i];
  const bUsed = b ? `${b.heapUsedMB} MB` : '—';
  const aUsed = a ? `${a.heapUsedMB} MB` : '—';
  const delta = b && a ? fmt(a.heapUsedMB - b.heapUsedMB) : '—';
  console.log(
    `${String(i + 1).padEnd(12)} ${bUsed.padStart(12)} ${aUsed.padStart(11)} ${delta.padStart(10)}`
  );
}

const bSlope = growthSlope(before.snapshots);
const aSlope = growthSlope(after.snapshots);

console.log('─'.repeat(48));
console.log(
  `${'Peak'.padEnd(12)} ${`${before.summary.peakHeapMB} MB`.padStart(12)} ${`${after.summary.peakHeapMB} MB`.padStart(11)} ${fmt(after.summary.peakHeapMB - before.summary.peakHeapMB).padStart(10)}`
);
console.log(
  `${'Growth'.padEnd(12)} ${fmt(before.summary.heapGrowthMB).padStart(12)} ${fmt(after.summary.heapGrowthMB).padStart(11)} ${fmt(after.summary.heapGrowthMB - before.summary.heapGrowthMB).padStart(10)}`
);
console.log(
  `${'Trend'.padEnd(12)} ${`${bSlope > 0 ? '+' : ''}${bSlope} MB/snap`.padStart(12)} ${`${aSlope > 0 ? '+' : ''}${aSlope} MB/snap`.padStart(11)}`
);

console.log('\nConclusion');
if (aSlope < bSlope) {
  const slopeReduction = Math.round((1 - aSlope / Math.max(bSlope, 0.01)) * 100);
  console.log(
    `  Growth trend improved: ${bSlope > 0 ? '+' : ''}${bSlope} → ${aSlope > 0 ? '+' : ''}${aSlope} MB/snap` +
      (bSlope > 0 && aSlope <= 0
        ? ' (leak eliminated — heap no longer grows)'
        : ` (${slopeReduction}% slower growth)`)
  );
} else if (aSlope > bSlope) {
  console.log(`  Growth trend worsened: ${bSlope} → ${aSlope} MB/snap — regression`);
} else {
  console.log('  No change in growth trend');
}
console.log();
