//
// Check if String value is a natural number
//
export function isInteger(str) {
  str = str.trim()
  if (!str) {
    return false
  }
  str = str.replace(/^0+/, '') || '0'
  var n = Math.floor(Number(str))
  return n !== Infinity && String(n) === str && n >= 0
}

//
// Verify merkle proof
//
export function verifyMerkleProof(index, proof) {
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

export const sleep = async() =>
  new Promise((resolve, reject) => {
    setTimeout(resolve, 1000)
  })
