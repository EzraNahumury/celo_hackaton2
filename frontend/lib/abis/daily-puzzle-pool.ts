export const dailyPuzzlePoolAbi = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "day",       type: "uint256" },
      { name: "nonce",     type: "bytes32" },
      { name: "amount",    type: "uint256" },
      { name: "signature", type: "bytes"   },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "poolBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "claimsToday",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ type: "uint256" }],
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
    name: "dailyClaims",
    stateMutability: "view",
    inputs: [
      { name: "day",    type: "uint256" },
      { name: "player", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "usedNonces",
    stateMutability: "view",
    inputs: [{ name: "nonce", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "PrizeClaimed",
    inputs: [
      { indexed: true,  name: "player", type: "address" },
      { indexed: true,  name: "day",    type: "uint256" },
      { indexed: false, name: "nonce",  type: "bytes32" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Funded",
    inputs: [
      { indexed: true,  name: "funder", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
] as const;
