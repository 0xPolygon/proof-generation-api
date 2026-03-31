---
"proof-generation-api": patch
---

All routes now emit a structured debug log on every incoming request.

Each entry includes the full set of parameters needed to replay the request — `burnTxHash`, `eventSignature`, `tokenIndex` for exit-payload routes; `blockNumber` for block-included; `start`/`end`/`number` for merkle-proof; `net_id`/`deposit_cnt` for zkEVM routes — as individual structured fields rather than interpolated strings. This makes them extractable from a Datadog log export CSV for corpus building during incident investigation.
