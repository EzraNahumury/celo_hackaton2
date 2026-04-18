export const matchEscrowAbi = [
  {
    type: "function",
    name: "createMatch",
    stateMutability: "payable",
    inputs: [{ name: "timeControl", type: "uint256" }],
    outputs: [{ name: "matchId", type: "uint256" }],
  },
  {
    type: "function",
    name: "joinMatch",
    stateMutability: "payable",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelMatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "settleMatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "winner", type: "address" },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimForfeit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "lastStateSig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "matchCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "matches",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "playerA", type: "address" },
      { name: "playerB", type: "address" },
      { name: "stake", type: "uint256" },
      { name: "createdAt", type: "uint256" },
      { name: "timeControl", type: "uint256" },
      { name: "state", type: "uint8" },
      { name: "winner", type: "address" },
      { name: "feesForwarded", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "resultSubmitted",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "MatchCreated",
    inputs: [
      { indexed: true, name: "matchId", type: "uint256" },
      { indexed: true, name: "playerA", type: "address" },
      { indexed: false, name: "stake", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "MatchJoined",
    inputs: [
      { indexed: true, name: "matchId", type: "uint256" },
      { indexed: true, name: "playerB", type: "address" },
    ],
  },
  {
    type: "event",
    name: "MatchSettled",
    inputs: [
      { indexed: true, name: "matchId", type: "uint256" },
      { indexed: true, name: "winner", type: "address" },
      { indexed: false, name: "payout", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "MatchCancelled",
    inputs: [{ indexed: true, name: "matchId", type: "uint256" }],
  },
  {
    type: "event",
    name: "ForfeitClaimed",
    inputs: [
      { indexed: true, name: "matchId", type: "uint256" },
      { indexed: true, name: "claimant", type: "address" },
    ],
  },
] as const;
