# Gambit Smart Contracts — Context for Claude

## Project
Celo Proof of Ship Season 2 (deadline 26 April 2026).
Chess microearning MiniApp untuk MiniPay. Settlement cUSD di Celo.

## Stack
- Framework: Foundry (bukan Hardhat)
- Solidity: 0.8.24
- Target: Celo Sepolia testnet → Celo Mainnet
- Chain ID: 11142220
- RPC: https://rpc.ankr.com/celo_sepolia

## 5 Contracts (src/)
| File | Fungsi |
|------|--------|
| `GambitHub.sol` | Registry, fee routing 50/50 (PuzzlePool & treasury), AccessControl, Pausable |
| `MatchEscrow.sol` | Escrow 1v1, oracle ECDSA, FairPlayHold check, auto-mint FIRST_WIN badge |
| `PuzzlePool.sol` | Daily prize pool, sponsor deposit, Merkle claim |
| `ClubVault.sol` | Weekly club 4-8 members, split 70/20/10, carryover, startNewWeek() |
| `GambitBadges.sol` | Soulbound ERC-5192: FIRST_WIN/PUZZLE_STREAK_7/CLUB_CHAMPION/RATING_1400/FAIR_PLAY_HOLD |

## Test Status
87/87 tests PASS — `forge test`

## Deploy
```bash
cp .env.example .env   # isi PRIVATE_KEY, ORACLE_ADDRESS, TREASURY_ADDRESS, CELOSCAN_API_KEY
forge script script/Deploy.s.sol --rpc-url celo_sepolia --broadcast --verify -vvvv
```

## Status
- [x] 5 contracts selesai & diaudit
- [x] 87 unit tests passing
- [ ] Deploy ke Celo Sepolia
- [ ] Frontend MiniApp (Next.js + MiniPay hook)
- [ ] Daftar di talent.app (Proof of Ship)

## Catatan Penting
- MatchEscrow & ClubVault perlu OPERATOR_ROLE di hub untuk auto-mint badge — sudah di-handle di Deploy.s.sol
- Min club members = 4 (sesuai README spec)
- Fee: match 3%, club 2%
- Oracle sign: keccak256(matchId, winner, chainId)
