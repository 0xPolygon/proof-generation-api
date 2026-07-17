/**
 * Prints the Polygon block receiptsRoot and related block data for one or more
 * burn transactions. Use the output to pin stable values in exit-payload
 * integration tests — see docs/integration-testing-runbook.md § "Adding New Test Cases".
 *
 * Run via npm:
 *   npm run get-receipts-root -- --tx <txHash> [--tx <txHash> ...]
 *   npm run get-receipts-root -- --amoy --tx <txHash>
 */

import { ethers } from 'ethers';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

interface RawBlock {
  receiptsRoot: string;
}

const argv = yargs(hideBin(process.argv))
  .scriptName('get-receipts-root')
  .usage(
    'Usage: npm run get-receipts-root -- --tx <txHash> [--tx <txHash> ...]\n\n' +
      'Prints the Polygon block receiptsRoot and related block data for one or\n' +
      'more burn transactions. Use these values to write stable exit-payload\n' +
      'integration tests that are independent of RPC provider.\n\n' +
      'receiptsRoot can be independently verified on Polygonscan:\n' +
      '  https://polygonscan.com/block/<blockNumber>  →  "Receipts Root" field'
  )
  .option('tx', {
    alias: 't',
    type: 'string' as const,
    array: true,
    demandOption: true,
    describe: 'Transaction hash(es) to look up (repeatable)'
  })
  .option('amoy', {
    alias: 'a',
    type: 'boolean' as const,
    default: false,
    describe: 'Query Amoy testnet (AMOY_RPC) instead of Polygon mainnet (MATIC_RPC)'
  })
  .example(
    'npm run get-receipts-root -- --tx 0x1a7b6aba7e51344474d4fe722a3969e8c7a863c72329210a0dda80d26c4234b4',
    'Look up receiptsRoot for a mainnet burn transaction'
  )
  .example(
    'npm run get-receipts-root -- --amoy --tx 0xabc...',
    'Look up receiptsRoot on the Amoy testnet'
  )
  .example(
    'npm run get-receipts-root -- --tx 0xaaa... --tx 0xbbb...',
    'Look up receiptsRoot for multiple transactions'
  )
  .help()
  .alias('h', 'help')
  .parseSync();

// argv.tx is typed string[] because of type: 'string' — no hex coercion.
const txHashes: string[] = argv.tx;

const rpcEnvVar = argv['amoy'] ? 'AMOY_RPC' : 'MATIC_RPC';
const rpcUrl = process.env[rpcEnvVar];

if (!rpcUrl) {
  console.error(
    `Error: ${rpcEnvVar} is not set or empty.\nRun via: npm run get-receipts-root -- --tx <txHash>`
  );
  process.exit(1);
}

const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

for (const txHash of txHashes) {
  const tx = await provider.getTransaction(txHash);
  if (!tx?.blockNumber) {
    console.error(`  ${txHash}: not found (archive node required for old transactions)`);
    continue;
  }

  const [receipt, rawBlock] = await Promise.all([
    provider.getTransactionReceipt(txHash),
    provider.send('eth_getBlockByNumber', [
      ethers.utils.hexValue(tx.blockNumber),
      false
    ]) as Promise<RawBlock>
  ]);

  console.log(`txHash:       ${txHash}`);
  console.log(`blockNumber:  ${tx.blockNumber}`);
  console.log(`txIndex:      ${receipt.transactionIndex}`);
  console.log(`receiptsRoot: ${rawBlock.receiptsRoot}`);
  console.log(`polygonscan:  https://polygonscan.com/block/${tx.blockNumber}`);
  if (txHashes.length > 1) console.log();
}
