# Gambit Smart Contracts

Chess microearning MiniApp for MiniPay — cUSD settlement on Celo.
Built for **Celo Proof of Ship Season 2** (deadline April 26, 2026).

## Contracts

| Contract | Description |
|---|---|
| `GambitHub` | Central registry, fee routing 50/50, AccessControl, Pausable |
| `MatchEscrow` | 1v1 escrow, oracle ECDSA signing, FairPlayHold, auto-mint badge |
| `PuzzlePool` | Daily prize pool, sponsor deposit, Merkle claim |
| `ClubVault` | Weekly club 4-8 members, 70/20/10 split, carryover |
| `GambitBadges` | Soulbound ERC-5192: FIRST_WIN / PUZZLE_STREAK_7 / CLUB_CHAMPION / RATING_1400 / FAIR_PLAY_HOLD |

## Deployed — Celo Sepolia Testnet (Chain 11142220)

| Contract | Address | Celoscan |
|---|---|---|
| GambitHub | `0xd6b0Ce6D872542b623CA5b7dc8ec5635e6dea578` | [view](https://sepolia.celoscan.io/address/0xd6b0ce6d872542b623ca5b7dc8ec5635e6dea578) |
| MatchEscrow | `0x198aB1bBb866E490ae883f04b273dBd2E38d6d09` | [view](https://sepolia.celoscan.io/address/0x198ab1bbb866e490ae883f04b273dbd2e38d6d09) |
| PuzzlePool | `0x1cE4Fd99CA3132fB2524abCB42eced20484C2688` | [view](https://sepolia.celoscan.io/address/0x1ce4fd99ca3132fb2524abcb42eced20484c2688) |
| ClubVault | `0x61857BD62350b5bDF21a33679FC4d8C136BD92ef` | [view](https://sepolia.celoscan.io/address/0x61857bd62350b5bdf21a33679fc4d8c136bd92ef) |
| GambitBadges | `0xb198835a036541e0BFC8d2Fc5Ca45992Ecd25B84` | [view](https://sepolia.celoscan.io/address/0xb198835a036541e0bfc8d2fc5ca45992ecd25b84) |

> All contracts are **verified** on Celoscan.

## Roles & Addresses

| Role | Address | Description |
|---|---|---|
| Deployer / Admin | `0x5682c0FF0ba3E6B0d78755c4684aEc5EA05c2a6F` | Holds DEFAULT_ADMIN_ROLE and OPERATOR_ROLE |
| Oracle | `0x3141011f001FB5f1CdE0183ACDdD9434Fa473F70` | Signs match results (ECDSA) |
| Treasury | `0x3141011f001FB5f1CdE0183ACDdD9434Fa473F70` | Receives 50% of platform fees |

## Fee Structure

- Match fee: **3%** → 50% to PuzzlePool, 50% to Treasury
- Club fee: **2%** → distributed 70/20/10 to club members

## Stack

- **Framework**: Foundry
- **Solidity**: 0.8.24
- **Network**: Celo Sepolia → Celo Mainnet
- **RPC**: `https://rpc.ankr.com/celo_sepolia`

## Setup

```bash
git clone <repo>
cd sc_celo_gambit
forge install
```

## Environment

```bash
cp .env.example .env
```

Fill in `.env`:
```
PRIVATE_KEY=0x...          # Deployer wallet private key
ORACLE_ADDRESS=0x...       # Oracle signer address
TREASURY_ADDRESS=0x...     # Platform fee recipient address
BADGE_BASE_URI=https://gambit.app/badges/
CELOSCAN_API_KEY=...       # Get from https://celoscan.io/myapikey
```

## Build & Test

```bash
forge build
forge test          # 87/87 tests passing
```

## Deploy

```bash
forge script script/Deploy.s.sol \
  --rpc-url celo_sepolia \
  --broadcast \
  --verify \
  -vvvv
```

## Interact via Cast

```bash
# Check registered contract address in GambitHub
cast call 0xd6b0Ce6D872542b623CA5b7dc8ec5635e6dea578 \
  "getContract(string)(address)" "MatchEscrow" \
  --rpc-url https://rpc.ankr.com/celo_sepolia
```
