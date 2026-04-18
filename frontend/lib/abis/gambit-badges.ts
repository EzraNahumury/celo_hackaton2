export const gambitBadgesAbi = [
  {
    type: "function",
    name: "hasBadge",
    stateMutability: "view",
    inputs: [
      { name: "player", type: "address" },
      { name: "bType", type: "uint8" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "hasFairPlayHold",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "playerBadge",
    stateMutability: "view",
    inputs: [
      { type: "address" },
      { type: "uint8" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "locked",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;
