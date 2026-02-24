# Integration Testing Runbook: Proof Generation API

## Overview

This service sits between callers and the Polygon bridge contracts. It generates cryptographic proofs required for users to withdraw assets from the Polygon PoS bridge and zkEVM bridge back to Ethereum. Every endpoint requires on-chain data as input — there is no way to "make up" valid inputs; they must come from real transactions and blocks on the respective chains.

This runbook explains how to find those inputs, verify them, pin them as integration test cases, and wire them into Datadog synthetic monitors.

---

## Prerequisites

| Tool                                                  | Purpose                                                                                         |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Polygonscan](https://polygonscan.com)                | Explore Polygon PoS mainnet transactions, blocks, logs                                          |
| [Etherscan](https://etherscan.io)                     | Verify checkpoint submissions on Ethereum mainnet                                               |
| Production service                                    | `https://proof-generator.polygon.technology` — use to validate discovered inputs before pinning |
| [zkEVM bridge explorer](https://bridge.zkevm-rpc.com) | Find valid deposits for zkEVM endpoints                                                         |
| `curl` or HTTPie                                      | Validate discovered inputs against production                                                   |

### Common Event Signatures

| Token Standard | Event                                                        | Signature                                                            |
| -------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| ERC-20         | `Transfer(address,address,uint256)`                          | `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` |
| ERC-721        | `Transfer(address,address,uint256)`                          | `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` |
| ERC-1155       | `TransferBatch(address,address,address,uint256[],uint256[])` | `0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb` |
| ERC-1155       | `TransferSingle(address,address,address,uint256,uint256)`    | `0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62` |

> **Note:** ERC-20 and ERC-721 share the same `Transfer` event signature. The Polygon bridge routes both through the same exit-payload endpoint.

---

## Concept: What is a "burn transaction"?

The Polygon PoS bridge uses a lock-and-mint / burn-and-unlock pattern:

- **Deposit**: Lock tokens on Ethereum, mint them on Polygon.
- **Withdrawal**: **Burn** tokens on Polygon, then unlock them on Ethereum using a proof.

A "burn transaction" is any transaction on Polygon that destroys bridged tokens by transferring them to `address(0)` or calling the bridge child contract's `withdraw`/`burn` function. The proof-generation service accepts the hash of that burn transaction and returns the cryptographic proof needed to claim funds on Ethereum.

The burn transaction **must be checkpointed** before a proof can be generated. Checkpoints are Ethereum transactions that commit a Merkle root of recent Polygon blocks; they are submitted by Polygon validators every ~30 minutes. Any burn in a block older than the latest checkpoint is eligible.

---

## Endpoint variants: `matic` vs `amoy`

Most endpoints exist in two network variants:

| Network             | URL prefix       | Chain                      | Explorer                     |
| ------------------- | ---------------- | -------------------------- | ---------------------------- |
| Polygon PoS mainnet | `/api/v1/matic/` | Polygon (chain 137)        | https://polygonscan.com      |
| Amoy testnet        | `/api/v1/amoy/`  | Polygon Amoy (chain 80002) | https://amoy.polygonscan.com |

All discovery and validation steps described in this runbook apply to both. To find valid Amoy testnet burn transactions, follow the same steps as mainnet but use **https://amoy.polygonscan.com** and the Amoy child token addresses. Old Amoy blocks (e.g., block 1234) are always checkpointed, just like mainnet.

---

## Endpoint 1: `block-included`

**URL pattern:** `GET /api/v1/matic/block-included/{blockNumber}`

**What it returns:** Confirms that a Polygon block has been included in a checkpoint on Ethereum. Returns the checkpoint (header block) number, start/end block range, proposer, and Merkle root.

### What makes a valid input

Any Polygon block number that:

1. Exists on Polygon mainnet
2. Has been submitted in a checkpoint to Ethereum (i.e., is old enough)

Any block older than ~1 hour is guaranteed to be checkpointed. Block numbers 1–10,000,000 are all checkpointed.

### Step-by-step: finding a valid block number

1. **Open Polygonscan:** https://polygonscan.com
2. The current block number is shown on the homepage (e.g., 68,000,000). Any block number significantly lower than the current tip will be checkpointed.
3. **Pick a stable, old block number** — one that is unlikely to be reorganized or reverted. Anything below block 50,000,000 is a safe anchor.
4. **Validate against production:**

   ```sh
   curl "https://proof-generator.polygon.technology/api/v1/matic/block-included/1234"
   ```

   Expected: HTTP 200, `"message": "success"`, with `headerBlockNumber`, `start`, `end`, `proposer`, `root`, `createdAt` fields.

5. **Capture the full response** and record the `start`, `end`, and `headerBlockNumber` values — you will need them for the `fast-merkle-proof` endpoint.

> **Response format note:** `headerBlockNumber` is a **hex string** (e.g., `"0xea60"` for mainnet block 1234, `"0x9c40"` for amoy block 1234). `start`, `end`, and `createdAt` are returned as `{ "type": "BigNumber", "hex": "0x..." }` objects — do not pin these directly.

### Pinning the test case

```typescript
it('should include block {N}', async () => {
  const res = await request(app).get('/api/v1/matic/block-included/{N}');
  expect(res).property('status', 200);
  expect(res).property('body').property('message', 'success');
  // Pin the header block number (a hex string):
  expect(res).property('body').property('headerBlockNumber', '{hex_value}');
});
```

> **Tip:** Do not pin `createdAt`, `proposer`, `start`, or `end`. `headerBlockNumber` (hex string) is stable and safe to pin.

### Datadog synthetic monitor

- **Type:** API test
- **URL:** `https://proof-generator.polygon.technology/api/v1/matic/block-included/1234`
- **Assertions:** HTTP status = 200, body contains `"message":"success"`, body contains `"headerBlockNumber"`
- **Frequency:** Every 5 minutes

---

## Endpoint 2: `fast-merkle-proof`

**URL pattern:** `GET /api/v1/matic/fast-merkle-proof?start={start}&end={end}&number={number}`

**What it returns:** A Merkle proof that a specific Polygon block (`number`) is included within the block range `[start, end]` that was committed in a checkpoint.

### What makes valid inputs

- `start` and `end` must be the exact start and end block numbers of a **single checkpoint window** on Polygon.
- `number` must be any block within that range: `start ≤ number ≤ end`.
- The easiest way to find valid `start`/`end` values is from the `block-included` response (which returns them directly).

### Step-by-step: finding valid start/end/number

1. **Call `block-included` first** for any known block:

   ```sh
   curl "https://proof-generator.polygon.technology/api/v1/matic/block-included/1234"
   ```

2. **From the response, copy `start` and `end`:**

   ```json
   { "start": "1000", "end": "1511", "blockNumber": "1234", ... }
   ```

3. **Pick any block within [start, end] as `number`**. A block in the middle of the range is ideal: `number = start + floor((end - start) / 2)`.

4. **Validate against production:**

   ```sh
   curl "https://proof-generator.polygon.technology/api/v1/matic/fast-merkle-proof?start=1000&end=1511&number=1256"
   ```

   Expected: HTTP 200, `"proof": "0x..."` (a hex string whose length is a multiple of 64 characters after the `0x` prefix).

5. **Capture the proof value** — this is deterministic for a given `start`/`end`/`number` triple, so it can be pinned exactly.

### Pinning the test case

```typescript
it('should return merkle proof for block {N} in range [{start}, {end}]', async () => {
  const res = await request(app).get(
    '/api/v1/matic/fast-merkle-proof?start={start}&end={end}&number={N}',
  );
  expect(res).property('status', 200);
  expect(res).property('body').property('proof', '{0x...captured_proof_value}');
});
```

### Datadog synthetic monitor

- **Type:** API test
- **URL:** `https://proof-generator.polygon.technology/api/v1/matic/fast-merkle-proof?start={start}&end={end}&number={number}`
- **Assertions:** HTTP status = 200, body contains `"proof"`, `proof` field matches exact value `{pinned_hex}`
- **Frequency:** Every 5 minutes

---

## Endpoint 3: `exit-payload` (single event)

**URL pattern:** `GET /api/v1/matic/exit-payload/{burnTxHash}?eventSignature={sig}&tokenIndex={n}`

**What it returns:** The RLP-encoded exit proof payload for a single event in a specific burn transaction. This payload is submitted directly to the Ethereum bridge contract to claim funds.

### What makes a valid input

1. `burnTxHash` must be a transaction on Polygon mainnet that burned bridged tokens.
2. The transaction must be **checkpointed** (roughly: submitted to Ethereum, > 30–60 minutes old).
3. `eventSignature` must be the topic hash of an event that was actually emitted in that transaction.
4. `tokenIndex` selects which matching event to use if a transaction emitted the same event multiple times (default: 0).

### Finding burn transactions on Polygonscan

**Method A: Search by known burn address**

On Polygon PoS, ERC-20 burns transfer tokens to `0x0000000000000000000000000000000000000000`. On Polygonscan:

1. Go to https://polygonscan.com/token/{childTokenAddress}
2. Click **Token Transfers** tab
3. Filter for transfers **To:** `0x0000000000000000000000000000000000000000`
4. Pick any transaction that is > 2 hours old (to ensure checkpoint inclusion)
5. Click the transaction to get its hash

**Common child token addresses on Polygon PoS:**
| Token | Polygon PoS Child Address |
|---|---|
| WETH | `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` |
| USDC | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |
| MATIC (bridged) | `0x0000000000000000000000000000000000001010` |

**Method B: Search by contract function**

1. Go to a known bridge child contract on Polygonscan
2. Click the **Internal Txns** or **Events** tab
3. Look for `withdraw` or `burn` function calls that are checkpointed

**Method C: Use the production service to probe candidate transactions**

```sh
# Try any candidate tx hash with the ERC-20 Transfer event signature:
curl "https://proof-generator.polygon.technology/api/v1/matic/exit-payload/{txHash}?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
```

Interpret the result:

| Response                                | Meaning                                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| HTTP 200                                | Valid checkpointed burn transaction with that event ✅                                        |
| HTTP 404 `transaction_not_checkpointed` | Transaction exists but is too recent — wait or pick an older tx                               |
| HTTP 404 `incorrect_transaction`        | Transaction hash is wrong or the tx doesn't exist on-chain                                    |
| HTTP 404 `no_block_found`               | Transaction exists but doesn't contain the specified event — try a different `eventSignature` |

### Step-by-step: ERC-20 burn

1. Find a burn tx on Polygonscan using Method A above.
2. Call production service to confirm it works and capture the response:
   ```sh
   curl "https://proof-generator.polygon.technology/api/v1/matic/exit-payload/{txHash}?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
   ```
3. Copy the `result` field from the response — this is the pinned payload.

### Step-by-step: ERC-721 burn

ERC-721 `Transfer` events use the **same signature** as ERC-20 (`0xddf252ad...`). The difference is the token type in the contract, not the event.

1. Go to https://polygonscan.com and search for a known ERC-721 child token contract
2. Look for transactions that call `withdraw` or `withdrawBatch`
3. Validate the same way as ERC-20

### Step-by-step: ERC-1155 burn

1. ERC-1155 uses different event signatures:
   - `TransferSingle`: `0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62`
   - `TransferBatch`: `0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb`
2. Find a burn by looking for transactions to known ERC-1155 bridge contracts that emit these events with `to = 0x0000...0000`
3. Call production service:
   ```sh
   curl "https://proof-generator.polygon.technology/api/v1/matic/exit-payload/{txHash}?eventSignature=0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb"
   ```

### Using `tokenIndex` for multi-event transactions

If a single transaction burns multiple tokens (e.g., a batch withdrawal of ERC-721s), the transaction emits one `Transfer` event per token. Use `tokenIndex` to target a specific one:

```sh
# First token (index 0, same as default)
curl ".../exit-payload/{txHash}?eventSignature=0xddf252ad...&tokenIndex=0"
# Second token (index 1)
curl ".../exit-payload/{txHash}?eventSignature=0xddf252ad...&tokenIndex=1"
```

If `tokenIndex` equals or exceeds the number of matching events, the service returns 404. This is the pattern for the "invalid tokenIndex" test case.

### Pinning the test case

```typescript
it('ERC-20 exit payload test', async function () {
  const res = await request(app).get(
    '/api/v1/matic/exit-payload/{txHash}?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  );
  expect(res).property('status', 200);
  expect(res).property('body').property('result', '{0x...pinned_payload}');
});
```

> **Important — determinism caveat:** ERC-20 and ERC-721 exit payloads are fully deterministic for a given burn tx. However, **ERC-1155 (and some other) payloads may differ slightly between RPC providers**. This is because `maticjs` generates the Merkle proof against the Ethereum RPC's current best block, and different providers can return different best blocks, producing proofs of different lengths. **Always pin the value returned by your locally configured RPC**, not the one returned by production. The value is stable for a given RPC endpoint over time.

### Datadog synthetic monitor

- **Type:** API test
- **URL:** `https://proof-generator.polygon.technology/api/v1/matic/exit-payload/{pinned_tx}?eventSignature={sig}`
- **Assertions:** HTTP status = 200, `result` field is present and non-empty, optionally exact-match the `result` value
- **Frequency:** Every 10 minutes (more expensive call; involves RPC work)
- **Alert condition:** Any failure alerts immediately — these are known-good, stable tx hashes that must always succeed

---

## Endpoint 4: `all-exit-payloads` (multiple events)

**URL pattern:** `GET /api/v1/matic/all-exit-payloads/{burnTxHash}?eventSignature={sig}`

**What it returns:** An array of exit payloads — one for each matching event in the burn transaction. Used for batch withdrawals (e.g., `withdrawBatch` on ERC-721).

### What makes a valid input

Same requirements as `exit-payload`, but ideally the target transaction should contain **more than one** event matching the given signature to meaningfully test the "multiple" behaviour. A single-event transaction still works (returns `result` array of length 1).

### Finding multi-event burn transactions

1. Look for transactions that call `withdrawBatch` on an ERC-721 bridge child contract on Polygon
2. These transactions emit one `Transfer` event per NFT burned
3. On Polygonscan, click a transaction and look at the **Logs** tab — count the number of `Transfer` events (topic: `0xddf252ad...`) where `to = 0x0000...0000`

### Step-by-step

1. Find a `withdrawBatch` transaction on Polygonscan
2. Count the matching Transfer events in the Logs tab
3. Validate:
   ```sh
   curl "https://proof-generator.polygon.technology/api/v1/matic/all-exit-payloads/{txHash}?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
   ```
4. Confirm `result` is an array and `result.length` matches your event count
5. Pin the `status` and `result.length`, and optionally the full `result` array

### Pinning the test case

```typescript
it('ERC-721 batch exit payloads test ({N} tokens)', async function () {
  const res = await request(app).get(
    '/api/v1/matic/all-exit-payloads/{txHash}?eventSignature=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  );
  expect(res).property('status', 200);
  expect(res).property('body').property('result').property('length', { N });
});
```

---

## Endpoint 5: zkEVM `bridge`

**URL pattern:** `GET /api/zkevm/{network}/bridge?net_id={networkID}&deposit_cnt={depositCount}`

**What it returns:** Bridge deposit data from the external zkEVM bridge API.

### Finding valid inputs

The zkEVM bridge uses a deposit counter model. Each deposit gets an incrementing integer index.

- **`net_id=0`** = Ethereum L1 (deposits FROM Ethereum TO zkEVM)
- **`net_id=1`** = Polygon zkEVM L2 (deposits FROM zkEVM TO Ethereum)

**Known-good starting point:** `net_id=1&deposit_cnt=1` is the very first deposit ever made to the zkEVM mainnet bridge. It is always valid and has been ready-to-claim since bridge launch. This is the recommended value for integration tests.

Validate:

```sh
curl "https://proof-generator.polygon.technology/api/zkevm/mainnet/bridge?net_id=1&deposit_cnt=1"
```

### Pinning the test case

The `deposit` object fields are stable and safe to pin: `tx_hash`, `deposit_cnt`, `network_id`, `ready_for_claim`. Do **not** pin `block_num` or `claim_tx_hash` as these might change format in API updates.

```typescript
it('zkEVM bridge deposit lookup', async function () {
  const res = await request(app).get(
    '/api/zkevm/mainnet/bridge?net_id=1&deposit_cnt=1',
  );
  expect(res).property('status', 200);
  expect(res.body).to.have.property('deposit');
  expect(res.body.deposit).to.have.property(
    'tx_hash',
    '0xb07cd0b30019c78c0b60e464c7c38a0a8076a355dbe9177205573e86455f31b6',
  );
  expect(res.body.deposit).to.have.property('deposit_cnt', 1);
  expect(res.body.deposit).to.have.property('ready_for_claim', true);
});
```

---

## Endpoint 6: zkEVM `merkle-proof`

**URL pattern:** `GET /api/zkevm/{network}/merkle-proof?net_id={networkID}&deposit_cnt={depositCount}`

**What it returns:** Merkle proof required to claim a zkEVM bridge deposit on the destination chain.

### Finding valid inputs

Same as the `bridge` endpoint — use the same `net_id` and `deposit_cnt`. The deposit must be **ready to claim** (included in the Merkle tree, bridge state synced). An early-stage deposit may return an error from the external API.

Use `net_id=1&deposit_cnt=1` as the known-good starting point (same as the `bridge` endpoint).

Validate:

```sh
curl "https://proof-generator.polygon.technology/api/zkevm/mainnet/merkle-proof?net_id=1&deposit_cnt=1"
```

> **What to pin:** The response includes `proof.merkle_proof` (array of sibling hashes) and `proof.rollup_merkle_proof`. Do **not** pin `proof.main_exit_root` or `proof.rollup_exit_root` — these represent the **current** state of the bridge Merkle tree and change as new deposits are added. Pin only that the `proof` field is present and that `proof.merkle_proof` is a non-empty array.

Confirm HTTP 200 and a populated `proof` object with a non-empty `merkle_proof` array.

---

## Adding New Test Cases to `api_test.ts`

Once you have found a valid URL via the production service:

1. **Validate the full response body** using `curl` with a pretty-printer:

   ```sh
   curl "https://proof-generator.polygon.technology/api/v1/matic/exit-payload/{txHash}?eventSignature={sig}" | python3 -m json.tool
   ```

2. **Extract the `result` field value to a file** — exit payload hex strings can exceed 5000 characters, which will be silently truncated by terminal output limits if you print them to stdout. **Always write to a file instead:**

   ```sh
   curl "..." | python3 -c "import json,sys; open('/tmp/result.txt','w').write(json.load(sys.stdin)['result'])"
   cat /tmp/result.txt
   ```

   Copying from a `print()` or `echo` output that was scrolled or piped will silently truncate the value, causing the pinned assertion to fail with a cryptic length mismatch.

3. **Pin the LOCAL service's value, not production.** The integration tests run against the locally configured RPCs, which may produce slightly different proof bytes than production for some token types (ERC-1155 in particular). Get the correct value to pin by running the test once, reading the failure diff's "actual" value, and using that as the pinned assertion.

4. **Add the test** in `src/test/api_test.ts` following existing patterns.

5. **Run `npm test`** to confirm the test passes locally before committing.

### Test case template

```typescript
it('{description} — {tokenType} — {brief description}', async function () {
  this.timeout(30000); // RPC calls can take up to 15s

  const res = await request(app).get(
    '/api/v1/matic/exit-payload/{txHash}?eventSignature={sig}',
  );

  expect(res).property('status', 200);
  expect(res).property('body').property('result', '{pinned_result_value}');
});
```

---

## Datadog Synthetic Monitor Setup

### Recommended monitor suite

| Endpoint                   | URL                                                                  | What to assert                                | Poll frequency |
| -------------------------- | -------------------------------------------------------------------- | --------------------------------------------- | -------------- |
| `health-check`             | `/health-check`                                                      | status=200                                    | 1 min          |
| `block-included` (mainnet) | `/api/v1/matic/block-included/1234`                                  | status=200, `headerBlockNumber`=`0xea60`      | 5 min          |
| `block-included` (amoy)    | `/api/v1/amoy/block-included/1234`                                   | status=200, `headerBlockNumber`=`0x9c40`      | 5 min          |
| `fast-merkle-proof`        | `/api/v1/matic/fast-merkle-proof?start=12345&end=12347&number=12346` | status=200, `proof` matches pinned value      | 5 min          |
| `exit-payload (ERC-20)`    | `/api/v1/matic/exit-payload/{tx}?eventSignature=0xddf252...`         | status=200, `result` matches pinned value     | 10 min         |
| `exit-payload (ERC-1155)`  | `/api/v1/matic/exit-payload/{tx}?eventSignature=0x4a39dc...`         | status=200, `result` is non-empty             | 10 min         |
| `all-exit-payloads`        | `/api/v1/matic/all-exit-payloads/{tx}?eventSignature=0xddf252...`    | status=200, `result.length` = N               | 10 min         |
| `zkEVM bridge`             | `/api/zkevm/mainnet/bridge?net_id=1&deposit_cnt=1`                   | status=200, `deposit.tx_hash` matches pinned  | 10 min         |
| `zkEVM merkle-proof`       | `/api/zkevm/mainnet/merkle-proof?net_id=1&deposit_cnt=1`             | status=200, `proof.merkle_proof` is non-empty | 10 min         |

### Alert thresholds

- **health-check:** Alert after 1 failure — any failure means the process is down
- **block-included / fast-merkle-proof:** Alert after 2 consecutive failures to rule out transient RPC timeouts
- **exit-payload / all-exit-payloads:** Alert after 2 consecutive failures — more RPC-intensive and sensitive to node latency

---

## Reference: Currently Known-Good Test Cases

| Endpoint                            | Input                                                                                             | Expected                                   | Notes                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| `block-included` (mainnet)          | block `1234`                                                                                      | 200, headerBlockNumber=`0xea60`            | Very old Polygon mainnet block, always checkpointed           |
| `block-included` (amoy)             | block `1234`                                                                                      | 200, headerBlockNumber=`0x9c40`            | Same block on Amoy testnet, always checkpointed               |
| `fast-merkle-proof`                 | start=12345 end=12347 number=12346                                                                | 200, proof=`0xc622...`                     | Three consecutive blocks within one checkpoint                |
| `exit-payload`                      | `0x1a7b6aba7e51344474d4fe722a3969e8c7a863c72329210a0dda80d26c4234b4` + ERC-20 sig                 | 200, result=`0xf90a24...`                  | ERC-20 burn tx, checkpointed mainnet                          |
| `exit-payload`                      | same tx + tokenIndex=0                                                                            | 200, same result                           | Explicit index 0 is same as default                           |
| `exit-payload (ERC-1155)`           | `0x4d4a9ee49a681a97ade92788f2fdce1d1761978ab491c2a10eb6849101cd63fe` + ERC-1155 TransferBatch sig | 200, result=`0xf90b6b...` (5854 chars)     | ERC-1155 TransferBatch; value pinned from local RPC           |
| `all-exit-payloads`                 | `0xdc3e4c2d41edd8c0a059be22aaa48ee6649f3688456db234b7e382e1cf735b50` + ERC-20 sig                 | 200, result.length=1                       | Single ERC-721 WithdrawnBatch (1 token)                       |
| `exit-payload` (invalid tokenIndex) | `0x1a7b6aba...b4` + ERC-20 sig + tokenIndex=1                                                     | 404                                        | Only 1 matching event; index 1 is out of range                |
| `zkEVM bridge`                      | net_id=1 deposit_cnt=1                                                                            | 200, deposit.tx_hash=`0xb07cd0b3...`       | First-ever zkEVM mainnet deposit; always valid                |
| `zkEVM merkle-proof`                | net_id=1 deposit_cnt=1                                                                            | 200, proof.merkle_proof is non-empty array | Proof path changes as tree grows; do not pin root hash values |

---

## Troubleshooting

| Symptom                                                | Likely cause                               | Fix                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 404 `transaction_not_checkpointed`                     | Transaction is < 30–60 min old             | Wait for next checkpoint cycle and retry                                                                             |
| 404 `incorrect_transaction`                            | Wrong tx hash, or tx doesn't exist         | Verify tx hash on Polygonscan                                                                                        |
| 404 `no_block_found` / `Event Signature log not found` | Wrong `eventSignature` for this tx         | Open tx on Polygonscan → Logs tab → copy Topic 0 from the relevant event                                             |
| Result array length is wrong                           | Transaction has fewer events than expected | Recount Transfer events in Polygonscan Logs tab filtered to `to=0x0000...0000`                                       |
| Response changes between runs                          | Non-deterministic upstream data            | Exit payloads and Merkle proofs are deterministic — if they change, the RPC node may be returning inconsistent state |
