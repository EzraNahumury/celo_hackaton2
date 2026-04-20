# Gambit Smart Contracts

Chess microearning MiniApp for MiniPay — native CELO settlement on Celo.
Built for **Celo Proof of Ship Season 2** (deadline April 26, 2026).

## Contracts

| Contract | Description |
|---|---|
| `GambitHub` | Central registry, fee routing 50/50, AccessControl, Pausable |
| `MatchEscrow` | 1v1 escrow, oracle ECDSA signing, FairPlayHold, auto-mint badge |
| `PuzzlePool` | Daily prize pool, sponsor deposit, Merkle claim |
| `ClubVault` | Weekly club 4-8 members, 70/20/10 split, carryover |
| `GambitBadges` | Soulbound ERC-5192: FIRST_WIN / PUZZLE_STREAK_7 / CLUB_CHAMPION / RATING_1400 / FAIR_PLAY_HOLD |
| `MockCUSD` *(testnet only)* | Mintable ERC20 mock stablecoin — public faucet 100 cUSD/24h |

## Deployed — Celo Sepolia Testnet (Chain 11142220)

### Game Contracts

| Contract | Address | Celoscan |
|---|---|---|
| GambitHub | `0xA68141b7b36d1161757e1790BcB5199d4EfFF281` | [view](https://sepolia.celoscan.io/address/0xa68141b7b36d1161757e1790bcb5199d4efff281) |
| MatchEscrow | `0xF8CeF418419E8F1588d6EB26095358CFAF635dC5` | [view](https://sepolia.celoscan.io/address/0xf8cef418419e8f1588d6eb26095358cfaf635dc5) |
| PuzzlePool | `0xbE34567ADF30c233103AEbFBB2b940e06DAc7366` | [view](https://sepolia.celoscan.io/address/0xbe34567adf30c233103aebfbb2b940e06dac7366) |
| ClubVault | `0x3665188aB87951Bb42984cFECC14bF5925C21644` | [view](https://sepolia.celoscan.io/address/0x3665188ab87951bb42984cfecc14bf5925c21644) |
| GambitBadges | `0xB31A2CAB3e267528815067cD6F7d6D7957f9FfB9` | [view](https://sepolia.celoscan.io/address/0xb31a2cab3e267528815067cd6f7d6d7957f9ffb9) |

> All 5 game contracts are **verified** on Celoscan.

### Mock Token (Testnet Only)

| Contract | Address | Note |
|---|---|---|
| MockCUSD | `0x1738d9cd003e1e1e8F648dBAE9E85ED116810C2F` | [view](https://sepolia.celoscan.io/address/0x1738d9cd003e1e1e8f648dbae9e85ed116810c2f) — Public faucet, 100 cUSD/24h |

## Roles & Addresses

| Role | Address | Description |
|---|---|---|
| Deployer / Admin | `0x5682c0FF0ba3E6B0d78755c4684aEc5EA05c2a6F` | Holds DEFAULT_ADMIN_ROLE and OPERATOR_ROLE |
| Oracle | `0x03dAC3A27deE42062b1F0D9F69087d4A9A20a3A1` | Signs match results (ECDSA) |
| Treasury | `0x03dAC3A27deE42062b1F0D9F69087d4A9A20a3A1` | Receives 50% of platform fees |

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

### Deploy semua game contracts

```bash
forge script script/Deploy.s.sol \
  --rpc-url celo_sepolia \
  --broadcast \
  --verify \
  -vvvv
```

### Deploy MockCUSD (testnet only)

```bash
forge script script/DeployMockCUSD.s.sol \
  --rpc-url celo_sepolia \
  --broadcast \
  --verify \
  -vvvv
```

## MockCUSD — Faucet

Setelah deploy, siapa saja bisa claim 100 cUSD per 24 jam:

```bash
# Claim via cast
cast send 0x1738d9cd003e1e1e8F648dBAE9E85ED116810C2F "faucet()" \
  --rpc-url https://rpc.ankr.com/celo_sepolia \
  --private-key $PRIVATE_KEY

# Mint manual (owner only)
cast send 0x1738d9cd003e1e1e8F648dBAE9E85ED116810C2F \
  "mint(address,uint256)" <WALLET> <AMOUNT_WEI> \
  --rpc-url https://rpc.ankr.com/celo_sepolia \
  --private-key $PRIVATE_KEY
```

## Interact via Cast

```bash
# Check oracle role holder
cast call 0xA68141b7b36d1161757e1790BcB5199d4EfFF281 \
  "hasRole(bytes32,address)(bool)" \
  $(cast keccak "ORACLE_ROLE") \
  0x03dAC3A27deE42062b1F0D9F69087d4A9A20a3A1 \
  --rpc-url https://rpc.ankr.com/celo_sepolia

# Check match fee bps
cast call 0xA68141b7b36d1161757e1790BcB5199d4EfFF281 \
  "matchFeeBps()(uint256)" \
  --rpc-url https://rpc.ankr.com/celo_sepolia
```

## Status

- [x] 5 game contracts selesai & diaudit
- [x] 87/87 unit tests passing
- [x] Deploy ke Celo Sepolia
- [x] Semua contracts verified di Celoscan
- [x] MockCUSD dengan public faucet (testnet)
- [x] Deploy MockCUSD ke Celo Sepolia
- [ ] Frontend MiniApp (Next.js + MiniPay hook)
- [ ] Daftar di talent.app (Proof of Ship)
