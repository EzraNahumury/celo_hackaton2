export const puzzlePoolAbi = [
  {
    type: "function",
    name: "sponsorDeposit",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "finalizeRound",
    stateMutability: "nonpayable",
    inputs: [{ name: "merkleRoot", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "pendingBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "rounds",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "merkleRoot", type: "bytes32" },
      { name: "totalPrize", type: "uint256" },
      { name: "day", type: "uint256" },
      { name: "distributed", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "todayIndex",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "hasClaimed",
    stateMutability: "view",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "player", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "SponsorDeposit",
    inputs: [
      { indexed: true, name: "sponsor", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "day", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "RoundFinalized",
    inputs: [
      { indexed: true, name: "day", type: "uint256" },
      { indexed: false, name: "merkleRoot", type: "bytes32" },
      { indexed: false, name: "prize", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "PrizeClaimed",
    inputs: [
      { indexed: true, name: "day", type: "uint256" },
      { indexed: true, name: "player", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
] as const;
