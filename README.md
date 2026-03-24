# proof-generation-api

Backend service for Polygon bridge exit proof generation. Consumed primarily by the Matic SDK.

Interactive API docs are available at `/api/docs` when the server is running.

## Why this service exists

### The Polygon PoS bridge exit flow

Moving assets from Polygon back to Ethereum is a two-step process:

1. **Burn** — the assets are burned on Polygon.
2. **Exit** — you call `exit()` on the `RootChainManager` contract on Ethereum, which verifies the burn and releases the assets.

The exit step requires a cryptographic proof: specifically, that your burn transaction was included in a Polygon block that Ethereum validators have already **checkpointed** (attested to on-chain). Without a valid checkpoint, the proof cannot be generated — which is why the `block-included` endpoint is a prerequisite gate, not just informational. The intended flow is:

> burn → poll `block-included` until checkpointed → call `exit-payload` → submit to Ethereum

Generating the exit payload involves fetching the transaction receipt, constructing a Merkle proof of its inclusion in the Polygon block, locating the correct checkpoint header, and encoding everything into the exact byte format the contract expects. This requires many sequential RPC calls and non-trivial computation — too heavy to do reliably in a browser or mobile client on demand. This service does that work server-side so the SDK only needs to make a single HTTP request.

### Why you should configure multiple RPC URLs

Proof generation makes many sequential calls to the same RPC endpoint. If any call fails mid-sequence, the entire proof attempt fails and has to restart. Configuring multiple RPC URLs per network enables automatic failover across providers, which is what makes the service reliable in practice rather than fragile. Configure at least two URLs per network in production.

The failover logic pairs the child-chain and parent-chain arrays by index: `MATIC_RPC[n]` is always used together with `ETHEREUM_RPC[n]`, and `AMOY_RPC[n]` with `SEPOLIA_RPC[n]`. When a retry is needed, both arrays advance to index `n+1` together. This means **index `n` in each coupled pair must be endpoints from the same provider** — if a provider is degraded, both its child-chain and parent-chain endpoints will fail, so the retry correctly skips to the next provider entirely. Mismatching providers at the same index (e.g. provider A for Ethereum and provider B for Polygon at index 0) would defeat the failover: a degraded provider A would cause a retry, which then lands on provider B for Polygon but still uses provider A for Ethereum. The two coupled pairs must also have the same number of entries.

### zkEVM endpoints are different

The zkEVM bridge uses a different mechanism — validity proofs rather than fraud proofs and checkpoints. The zkEVM endpoints in this service do not construct Merkle proofs from chain data; they proxy the zkEVM bridge API directly. They exist here as a convenience so the Matic SDK has a single backend to talk to for all bridge operations.

## Prerequisites

- Node.js 24 (see `.nvmrc`; `nvm use` to switch automatically)
- pnpm (managed via corepack)

## Setup

```bash
git clone https://github.com/0xPolygon/proof-generation-api
cd proof-generation-api
pnpm install
```

Copy `.env.example` to `.env` and fill in the RPC endpoints:

```bash
cp .env.example .env
```

Environment variables (all required unless marked optional):

| Variable | Description |
|----------|-------------|
| `ETHEREUM_RPC` | JSON array of Ethereum Mainnet RPC URLs — must be same length as `MATIC_RPC`; index `n` must be the same provider |
| `MATIC_RPC` | JSON array of Polygon Mainnet RPC URLs — must be same length as `ETHEREUM_RPC`; index `n` must be the same provider |
| `SEPOLIA_RPC` | JSON array of Sepolia RPC URLs — must be same length as `AMOY_RPC`; index `n` must be the same provider |
| `AMOY_RPC` | JSON array of Polygon Amoy testnet RPC URLs — must be same length as `SEPOLIA_RPC`; index `n` must be the same provider |
| `ZKEVM_MAINNET_URL` | zkEVM Polygon Mainnet bridge API URL |
| `ZKEVM_TESTNET_URL` | zkEVM Cardona testnet bridge API URL |
| `PORT` | Port to listen on (default: `5000`) |
| `SENTRY_DSN` | Sentry DSN for error reporting (optional) |
| `PRETTY_LOGS` | Set to `true` for human-readable log output in development (optional) |

See "Why you should configure multiple RPC URLs" above for the provider-pairing constraint.

## Running

```bash
pnpm run dev      # development server with live reload (requires .env)
pnpm start        # production server (requires .env)
```

## Testing

Tests make live RPC calls against the configured endpoints. Run the full suite:

```bash
pnpm test
```

Run tests against a deployed instance instead of starting the server locally:

```bash
TEST_BASE_URL=https://proof-generator.polygon.technology pnpm test
```

See [docs/integration-testing-runbook.md](docs/integration-testing-runbook.md) for guidance on adding new test cases.

## Docker

```bash
docker build -t proof-generation-api .
docker run --rm --env-file .env -p 5000:5000 proof-generation-api
```

Run the test suite against the Docker container:

```bash
docker run --rm --env-file .env -p 5000:5000 -d --name proof-gen proof-generation-api
TEST_BASE_URL=http://localhost:5000 pnpm test
docker stop proof-gen
```

## API Endpoints

All v1 endpoints support two networks:

- `matic` — Polygon Mainnet
- `amoy` — Polygon Amoy testnet (replaces Mumbai)

For zkEVM endpoints, `network` is one of: `mainnet`, `cherry`, `testnet`, `cardona`.

Response status codes:

- `200` — Success
- `400` — Invalid parameters (validation error)
- `404` — No result found (e.g. block not yet checkpointed)
- `500` — Internal server error

### Health check

`GET /health-check`

Returns `200` if the server is running.

### Interactive docs

`GET /api/docs`

Scalar-powered interactive API reference, generated from the OpenAPI spec.

`GET /api/openapi.json`

Raw OpenAPI spec.

### Block inclusion in checkpoint

`GET /api/v1/{network}/block-included/{blockNumber}`

Checks whether a Polygon block has been checkpointed to Ethereum by the validators.

**Response:**

```json
{
  "headerBlockNumber": "0x...",
  "blockNumber": "1234",
  "start": "1200",
  "end": "1300",
  "proposer": "0x...",
  "root": "0x...",
  "createdAt": "1234567890",
  "message": "success"
}
```

### Exit payload

`GET /api/v1/{network}/exit-payload/{burnTxHash}?eventSignature={sig}&tokenIndex={index}`

Returns the payload to pass to the `exit()` function on the RootChainManager contract on Ethereum Mainnet.

| Parameter | In | Required | Description |
|-----------|----|----------|-------------|
| `burnTxHash` | path | yes | Burn transaction hash |
| `eventSignature` | query | yes | keccak256 of the Transfer event signature |
| `tokenIndex` | query | no | Index of the token in the burn transaction's token list |

**Response:**

```json
{
  "message": "Payload generation success",
  "result": "0x..."
}
```

### All exit payloads

`GET /api/v1/{network}/all-exit-payloads/{burnTxHash}?eventSignature={sig}`

Returns an array of payloads for all tokens in a burn transaction.

| Parameter | In | Required | Description |
|-----------|----|----------|-------------|
| `burnTxHash` | path | yes | Burn transaction hash |
| `eventSignature` | query | yes | keccak256 of the Transfer event signature |

**Response:**

```json
{
  "message": "Payload generation success",
  "result": ["0x...", "0x..."]
}
```

### Fast merkle proof

`GET /api/v1/{network}/fast-merkle-proof?start={start}&end={end}&number={blockNumber}`

Returns the block proof using a minimal-RPC algorithm. Can be used to construct the final exit payload.

| Parameter | In | Required | Description |
|-----------|----|----------|-------------|
| `start` | query | yes | Start block of the header block range |
| `end` | query | yes | End block of the header block range |
| `number` | query | yes | Block number to prove |

**Response:**

```json
{
  "proof": "0x..."
}
```

### zkEVM bridge deposit

`GET /api/zkevm/{network}/bridge?net_id={networkId}&deposit_cnt={depositCount}`

Fetches bridge deposit data from the zkEVM bridge API.

### zkEVM merkle proof

`GET /api/zkevm/{network}/merkle-proof?net_id={networkId}&deposit_cnt={depositCount}`

Fetches the merkle proof for a zkEVM bridge deposit.
