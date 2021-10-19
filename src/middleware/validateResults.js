/**
 * Verify merkle proof
 *
 * @param {String} number
 * @param {String} start
 * @param {String} proof
 * @returns {Boolean}
*/
export function verifyMerkleProof(number, start, proof) {
  const index = parseInt(number, 10) - parseInt(start, 10)
  if (!proof) {
    return false
  }

  const proofLength = Buffer.from(proof.replace('0x', '')).length
  if (proofLength % 32 !== 0) {
    return false
  }

  const proofHeight = proofLength / 32
  // Proof of size n means, height of the tree is n+1.
  // In a tree of height n+1, max #leafs possible is 2 ^ n
  return index < 2 ** proofHeight
}
