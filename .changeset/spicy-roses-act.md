---
'proof-generation-api': patch
---

Fix exit proofs failing on-chain for Bor state-sync transactions, and
harden the checkpoint binary search against edge cases and reorg races.

Both fixes come from `@maticnetwork/maticjs@3.9.10`
([matic.js#465](https://github.com/0xPolygon/matic.js/pull/465)),
adopted here by bumping the pin from `3.9.7` to `^3.9.10`.

- Exit proofs derived from a Bor state-sync transaction (which always
  has `cumulativeGasUsed = 0`) now encode the receipt with the canonical
  RLP empty byte string (`0x80`) instead of the literal `0x00`. The
  buggy encoding previously made every such proof return `200 OK` here
  but revert on-chain with `INVALID_RECEIPT_MERKLE_PROOF`. `lst-api`
  has been carrying a client-side `fixExitProofEncoding` workaround
  for this; it can drop the workaround once this rolls.

- The checkpoint binary search no longer returns a slot that does not
  actually contain the burn block. Previously a burn block past every
  existing checkpoint silently produced a proof embedding an unrelated
  header, and the two reads inside the search used different block
  tags, opening a race against an un-finalised checkpoint that could
  reorg out before submission. Both reads now use the same block tag
  and the converged slot is range-verified.
