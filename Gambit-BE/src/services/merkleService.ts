import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

export interface Winner {
  address: string;
  amountWei: bigint;
}

/**
 * Build a StandardMerkleTree from a list of winners.
 * Leaf encoding: ["address", "uint256"] = (address, amountWei)
 * Compatible with OpenZeppelin MerkleProof.verify on-chain.
 */
export function buildPuzzleTree(
  winners: Winner[]
): StandardMerkleTree<[string, bigint]> {
  if (winners.length === 0) {
    throw new Error("Cannot build Merkle tree with no winners");
  }

  const entries: [string, bigint][] = winners.map((w) => [
    w.address.toLowerCase(),
    w.amountWei,
  ]);

  return StandardMerkleTree.of(entries, ["address", "uint256"]);
}

/**
 * Re-derive proof by rebuilding the tree from stored winner data.
 * Preferred entry point: always re-builds from DB data so no tree state is
 * kept in memory between restarts.
 */
export function buildProofFromWinners(
  winners: Winner[],
  address: string
): { root: string; proof: string[]; amountWei: bigint } | null {
  if (winners.length === 0) return null;

  const tree = buildPuzzleTree(winners);
  const normalized = address.toLowerCase();

  for (const [i, [addr, amt]] of tree.entries()) {
    if (addr.toLowerCase() === normalized) {
      return {
        root: tree.root,
        proof: tree.getProof(i),
        amountWei: amt,
      };
    }
  }

  return null;
}

/**
 * Convert a puzzle date string (YYYY-MM-DD) to the uint256 day number
 * used by PuzzlePool on-chain (days since Unix epoch).
 */
export function dateToDayNumber(dateStr: string): bigint {
  const ms = new Date(dateStr + "T00:00:00Z").getTime();
  return BigInt(Math.floor(ms / 86400000));
}
