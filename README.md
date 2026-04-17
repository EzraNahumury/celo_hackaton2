# Gambit

> **Catur uang jajan untuk satu miliar pengguna onchain berikutnya.**
> MiniApp untuk MiniPay yang mengubah catur jadi microearning berbasis skill — puzzle harian, pertandingan 1v1 stake kecil, dan klub mingguan, semuanya settle pakai cUSD di Celo Mainnet.

[![Built on Celo](https://img.shields.io/badge/Built%20on-Celo-FCFF52)](https://celo.org)
[![MiniPay](https://img.shields.io/badge/MiniApp-MiniPay-blue)](https://minipay.to)
[![Track](https://img.shields.io/badge/Track-Games%20%2B%20B2C-purple)](https://docs.celo.org/developer/build-on-minipay/overview)
[![Stablecoin](https://img.shields.io/badge/Settlement-cUSD-green)](https://docs.celo.org/protocol/stability/doto)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

---

## Masalahnya

Catur punya 600 juta+ pemain di seluruh dunia. Chess.com punya 150 juta+ akun. Tapi tidak ada platform catur yang dibangun untuk populasi yang benar-benar dilayani MiniPay: 7 juta+ wallet stablecoin di Nigeria, Kenya, Ghana, Afrika Selatan, Filipina, Indonesia, dan Amerika Latin.

Chess.com dan Lichess mengasumsikan WiFi cepat, checkout PayPal, dan budget coaching $30/bulan. Produk catur Web3 yang sudah ada pun salah sasaran — Immortal Game raised $15.5M tapi menargetkan kolektor NFT Ethereum; OnChess dan fork open-source lainnya adalah platform "stake winner-takes-all" yang dituning untuk bankroll crypto-native. Tidak ada satu pun yang dibangun untuk wallet Opera MiniPay di Mombasa dengan footprint 2MB, signer legacy-transaction-only, dan user yang tidak pernah dengar istilah ERC-721.

Artinya ada dua populasi yang sama sekali belum terlayani.

**Populasi 1 — Pencari pocket money di emerging markets.** Ojol di Jakarta, mahasiswa di Lagos, pekerja gig di Manila. Mereka punya $0.50 – $5 pendapatan discretionary harian. Mereka mau cara yang fun, berbasis skill, untuk dapat tambahan kecil — bukan judi, bukan farming token, bukan kerjaan tambahan. Catur cocok banget: reward dari latihan, resonansi budaya universal, dan tidak pernah terasa seperti kerjaan.

**Populasi 2 — Social players yang main sama teman, bukan di ladder global.** Di pasar MiniPay, unit catur yang natural bukan ladder global, melainkan klub 4–8 teman main mingguan taruhan kecil. Produk untuk itu sekarang: grup WhatsApp + IOU berbasis kepercayaan.

Keduanya sudah ada di dalam MiniPay. Tidak ada produk catur di sana.

## Solusinya

**Gambit** adalah catur yang direimajinasi jadi microearning berbasis skill di dalam MiniPay. Setiap fitur di-pricing dalam stablecoin dengan angka yang masuk akal di Lagos, Nairobi, Manila, dan Jakarta — bukan San Francisco. Setiap interaksi settle pakai cUSD di Celo Mainnet.

Gambit ship tiga product surface di hari pertama.

**Daily Puzzle.** Satu puzzle catur per hari, gratis ikut, leaderboard global. Prize pool didanai sponsor + fee protokol dari paid games. Top finisher split prize pool. Reset tengah malam UTC. Loop ala Wordle, diterapkan ke catur.

**Micro-Stake 1v1.** Lawan stranger atau teman di stake 0.50 / 1 / 2 cUSD. Pemenang ambil pot minus fee protokol 3%. Time control Blitz (3+2) dan Rapid (10+0). Didesain untuk istirahat lima menit, bukan sesi satu jam.

**Chess Club.** Bikin klub privat 4–8 member. Semua stake weekly buy-in (default 1 cUSD). Round-robin selama seminggu. Juara 70%, runner-up 20%, 10% carry over ke minggu depan sebagai retention hook.

Chess.com melayani puncak piramida global. **Gambit melayani dasar piramida.**

## Cara Kerjanya

```
1. Buka MiniPay          →  Launch Gambit MiniApp
2. Verifikasi humanity   →  Self Proof of Humanity (one-tap)
3. Pilih surface         →  Daily Puzzle · 1v1 · Club
4. Stake / masuk         →  cUSD pindah dari wallet ke MatchEscrow
5. Main                  →  Game jalan off-chain di server Gambit
                             chess.js validasi gerakan
                             Stockfish WASM bertenaga bot & puzzle gen
6. Oracle result         →  Server sign hasil pakai oracle key
                             Submit ke MatchEscrow
7. Settle onchain        →  Pemenang withdraw cUSD
                             Stake yang kalah minus 3% fee
8. Tampilan lokal        →  "Kamu menang ₦820" — UI tampilkan NGN,
                             KES, PHP, IDR, GHS di atas cUSD
```

Setiap stake, payout, distribusi puzzle-pool, dan buy-in klub adalah transaksi Celo Mainnet. Gerakan caturnya off-chain demi kecepatan dan biaya — satu game catur dengan 40+ gerakan kalau semua onchain bakal lebih mahal dari stake dan lebih lama dari gamenya sendiri.

## Prinsip Desain

**Stake yang terasa lokal, bukan global.** Default stake: 0.50, 1, dan 2 cUSD. User di Nairobi melihat "Menang ₦820" / "Win ₦820" — cUSD cuma rail, mental model-nya mata uang lokal. Angkanya memang sengaja kecil: produknya adalah cari uang jajan, bukan judi.

**Skill-first, bukan gambling-first.** Setiap surface berbayar adalah catur berbasis skill. Tidak ada dadu. Tidak ada koin flip. Tidak ada pembungkus roulette. Narasinya "dapat apa yang skill kamu layak dapat," bukan "menang besar". Ini juga penting untuk regulasi di pasar target.

**Ramah async.** Gambit support live blitz buat yang mau, tapi format utama untuk Klub adalah correspondence — satu gerakan per push notification, game selesai dalam hitungan jam. Format ini yang benar-benar cocok untuk user MiniPay yang lagi commute naik matatu/angkot, bukan player berjas dengan 20 menit waktu undivided.

**Semi-custodial untuk integritas, fully onchain untuk uang.** Game state di server Gambit (di-sign oleh oracle key), karena MiniPay sekarang hanya menerima legacy transactions dan belum support message signing secara reliable. Model kepercayaan yang sama yang dipakai online poker — dan sudah bekerja untuk puluhan juta player. Tapi, setiap dollar bergerak onchain.

## Arsitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                      MiniPay (Opera Wallet)                     │
│                7M+ user stablecoin di 53 negara                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ MiniPay Hook (Viem + Wagmi)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Gambit MiniApp (Frontend)                    │
│   Next.js 14 + Viem/Wagmi + TailwindCSS + shadcn/ui + Vercel    │
│   react-chessboard + chess.js untuk board interaktif            │
│   Formatter mata uang lokal (NGN, KES, GHS, PHP, IDR, ZAR)      │
└──────────┬──────────────────────────┬───────────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────────┐   ┌──────────────────────────────────┐
│   Gambit Game Server │   │  Smart Contract Celo Mainnet     │
│   Node.js + Hono     │   │   ├─ GambitHub.sol (registry)    │
│   WebSocket (blitz)  │◄──┼── ├─ MatchEscrow.sol (1v1)       │
│   Move validator     │   │   ├─ PuzzlePool.sol (daily)      │
│   Stockfish WASM     │   │   ├─ ClubVault.sol (weekly)      │
│   Oracle signer      │   │   └─ GambitBadges.sol (ERC-5192) │
│   Puzzle generator   │   │                                  │
│   Anti-cheat engine  │   │                                  │
│   Supabase (meta)    │   │                                  │
└──────────┬───────────┘   └─────────────┬────────────────────┘
           │                             │
           └─────────────────────────────┤
                                         ▼
                     ┌──────────────────────────────────┐
                     │   cUSD · cEUR · USDC di Celo     │
                     │   Mento Protocol stable rails    │
                     └──────────────────────────────────┘
```

### Lapisan Smart Contract

| Contract | Tanggung Jawab |
|----------|----------------|
| `GambitHub.sol` | Registry utama. Track match dan klub aktif; routing fee protokol; pausable buat emergency. |
| `MatchEscrow.sol` | Escrow stake match 1v1. Kedua pemain deposit; oracle-signed result memicu payout; timeout-based dispute resolution. |
| `PuzzlePool.sol` | Prize pool harian. Terima deposit sponsor + share fee protokol; distribusi Merkle end-of-day ke top finisher. |
| `ClubVault.sol` | Turnamen klub mingguan. Collect buy-in, pegang pot, distribusi split 70/20/10 pas settlement. |
| `GambitBadges.sol` | Soulbound ERC-5192 untuk milestone — "First Win," "Puzzle Streak 7," "Club Champion," "1400 Club." |

### Game Engine Off-Chain

Server Gambit adalah sumber kebenaran game state. Ada karena kalau 40 gerakan catur ditaruh onchain per game, biayanya bakal lebih mahal dari stake-nya sendiri. Model integritasnya diadaptasi dari online poker:

| Komponen | Tujuan |
|----------|--------|
| **Move validator** | `chess.js` di server revalidasi setiap gerakan dari client; gerakan ilegal ditolak; state diteruskan ke lawan. |
| **Oracle signer** | Key khusus yang sign hasil akhir game. Signature disubmit ke `MatchEscrow` untuk unlock pot. Support rotasi key. |
| **Stockfish WASM** | Bertenaga single-player practice, generasi puzzle harian, dan bot tier 800/1200/1600. Server-side buat turnamen, client-side buat latihan. |
| **Anti-cheat engine** | Bandingkan distribusi kualitas gerakan vs evaluasi engine. Flag game pas centipawn-loss profile user geser mendekati permainan engine. |
| **Timeout arbitrator** | Kalau player abandon game, lawan bisa call `MatchEscrow.claimForfeit()` setelah time control expired. Contract selesaikan tanpa interaksi server lagi. |

## Monetisasi

Gambit cuma untung kalau user-nya menang. Dua revenue stream, semuanya eksplisit dan kecil.

| Stream | Rate | Yang Bayar |
|--------|------|-----------|
| **Fee match 1v1** | 3% dari pot | Pemenang (di-net dari payout) |
| **Fee treasury klub** | 2% dari buy-in mingguan | Klub (di-net pas settlement) |

Sebagian dari tiap stream otomatis mengalir balik ke `PuzzlePool` untuk memperbesar prize harian — jadi makin banyak network-nya main, makin besar puzzle gratis untuk semua orang. Ini flywheel Gambit.

## Demo Flow

**Scene 1 — Daily Puzzle.** Fatima, mahasiswi di Lagos, buka Gambit jam 7 pagi. Puzzle hari ini: mate dalam tiga. Dia solve dalam 42 detik — tercepat ke-7 global hari itu. Dia masuk slice prize top-100; jatahnya ₦650 auto-credit ke MiniPay-nya tengah malam UTC. Dia tidak stake apa-apa. Dia cuma main puzzle.

**Scene 2 — Stake 1v1.** Jam makan siang, Daniel queue match blitz 1 cUSD. Dapat lawan rating mirip dalam 4 detik. Kedua stake masuk `MatchEscrow`. Main blitz 3+2. Daniel menang on time. Server submit oracle-signed result. Payout 1.94 cUSD (pot 2 cUSD minus fee 3%) masuk MiniPay Daniel. 0.06 cUSD dari fee masuk ke `PuzzlePool` hari itu.

**Scene 3 — Minggu Klub.** Selama seminggu, Mathare Knights main round-robin di dalam Klub. Daniel finish pertama (3W 0L), ambil 70% dari pot 4 cUSD = 2.80 cUSD. Runner-up dapat 0.80 cUSD. Sisa 0.40 cUSD roll ke pot minggu depan. Badge soulbound `ClubChampion` Daniel auto-mint.

**Scene 4 — Withdrawal.** Akhir bulan, Fatima sudah akumulasi 5.20 cUSD dari puzzle + satu kemenangan klub. Dia tidak melakukan apa-apa spesial — sudah ada di MiniPay wallet-nya. Dia pakai untuk top-up kuota data langsung dari wallet yang sama. Catur bayar internetnya.

## Kenapa Gambit Menang Celo Proof of Ship

| Kriteria (dari dokumen hackathon) | Pemenuhan Gambit |
|-----------------------------------|-------------------|
| Deploy di Celo Mainnet dengan verified contract | 5 contract, semuanya verified di CeloScan |
| Dibangun sebagai MiniApp dengan MiniPay hook | Primary dan satu-satunya entry point |
| Real onchain activity | Setiap stake, payout, puzzle-pool, dan settlement klub adalah transaksi Celo |
| Open source dengan GitHub publik | MIT license, repo aktif |
| Proof of Humanity | Self checkmark wajib pas pertama launch |
| **Cocok track Games** | Kategori utama. Catur universal, skill-based, dan punya resonansi budaya di setiap pasar MiniPay |
| Tidak masuk ember "DeFi solo builder" yang ditolak | Games + B2C. Tanpa yield farming, tanpa liquidity provisioning, tanpa token launch |
| Bukan "reward farming" | Payout butuh menang catur sungguhan atau solve puzzle sungguhan — skill gating tiap sen |
| Simple dan functional | Flow empat tap: buka → verifikasi → masuk → main |
| Ship-ability | Game server off-chain + thin onchain escrow adalah pattern terbukti (online poker, Immutable X gaming) — dicapai dalam submission window |
| Integrasi ekosistem | MiniPay + Self + Mento + cUSD — empat integrasi first-party Celo |
| Daily habit | Daily puzzle kasih user alasan buka app tiap hari, naikin frekuensi sesi MiniPay |

## Yang Bedain Gambit

Tiap produk catur Web3 yang ada bersaing di satu dari dua sumbu: tokenomics lebih bagus, atau recording gerakan onchain lebih bagus. Dua-duanya dead end. Gambit bersaing di sumbu ketiga — **distribusi dan cultural fit di emerging markets** — yang tidak dikontest siapa pun.

| Dimensi | Immortal Game | OnChess / Web3-Chess | Chess.com | **Gambit** |
|---------|---------------|----------------------|-----------|------------|
| Target user | Kolektor NFT Ethereum | Staker crypto-native | Subscriber berbayar global | User MiniPay emerging markets |
| Default stake | $5+ / NFT-gated | $10+ | $0 / coaching berbayar | $0.50 – $2 cUSD |
| Onboarding | Install wallet + mint NFT | Install wallet + fund | Sign-up email | One tap di dalam MiniPay |
| Format utama | Real-time blitz | Real-time | Real-time | Real-time + **async correspondence** |
| Mata uang settlement | ETH + $CMT | MATIC / Base ETH | USD fiat | **cUSD (stable)** |
| Model fee | NFT entry + token | % tetap | Subscription | 3% match / 2% klub |
| Distribusi | Web langsung | Web langsung | Web langsung | **Native di dalam MiniPay (7M+ wallet)** |

Blue ocean, bukan red. Semua Web3 chess lain lagi rebutan 50.000 fan catur crypto-native yang sama. Gambit targetin populasi 100x lebih besar yang tidak di-reach siapa pun.

## Tech Stack

**Frontend**
Next.js 14 via starter `celo-composer`, Viem + Wagmi untuk RPC Celo Mainnet (MiniPay butuh legacy transactions, jadi EIP-1559 disabled di client-side), MiniPay Hook untuk koneksi wallet native, `react-chessboard` untuk UI interaktif, `chess.js` untuk validasi gerakan client-side, TailwindCSS + shadcn/ui untuk desain mobile-first, deploy ke Vercel.

**Smart Contracts**
Solidity 0.8.24, Hardhat, OpenZeppelin (AccessControl, ReentrancyGuard, Pausable, ERC-5192), deploy dan verified di Celo Mainnet. Foundry untuk fuzz testing invariant kritis (akuntansi escrow, arbitrasi timeout, distribusi Merkle puzzle pool).

**Game Server**
Node.js + Hono HTTP API, WebSocket untuk live blitz, `chess.js` untuk validasi gerakan server-side, Stockfish WASM untuk generasi puzzle dan bot, Supabase untuk metadata game + realtime UI state. Oracle key disimpan di KMS terdedikasi dengan support rotasi.

**Integrasi Celo**
MiniPay (surface utama), Self (Proof of Humanity), Mento Protocol (settlement cUSD), CeloScan (verifikasi contract).

**Anti-cheat**
Pipeline evaluasi Stockfish. Analisis distribusi centipawn-loss. Deteksi anomali varian waktu gerakan. Queue review manual untuk game yang di-flag di atas threshold stake tertentu.

## Model Risiko & Trust

Platform catur yang settle uang beneran harus earn trust. Kami address di empat front.

**Integritas server.** Server Gambit sign outcome game pakai oracle key terdedikasi yang ter-register di `GambitHub`. Risiko kompromi key dimitigasi dengan rotasi, nonce per-match, dan kemampuan pause escrow baru via `GambitHub.pause()`.

**Anti-cheat.** Pemain yang dibantu Stockfish adalah ancaman eksistensial untuk platform catur uang. Gambit jalankan analisis centipawn-loss post-game di setiap paid match; match di atas threshold confidence di-flag, stake di-hold, review manusia jalan dalam 24 jam. Ban-nya onchain: `GambitBadges` user yang di-flag akan dapat SBT `FairPlayHold` yang di-enforce contract di stake-stake berikutnya.

**Sengketa timeout.** Kalau server tidak responsif atau player disconnect lebih dari 3x time control, salah satu pihak bisa call `MatchEscrow.claimForfeit()` dengan last signed server state. Contract selesaikan tanpa butuh interaksi server lagi.

**Postur regulasi.** Semua surface berbayar adalah catur berbasis skill. Tidak ada RNG, tidak ada mekanik chance, tidak ada house edge lawan user. Ini postur yang sama yang bikin fantasy sports bisa beroperasi di pasar yang sports betting-nya tidak bisa.

## Roadmap

**v0.1 — Submission Hackathon (April 2026)**
Daily Puzzle dengan prize pool ter-sponsor, match micro-stake 1v1, Chess Club (mingguan), verifikasi Self, deploy di Celo Mainnet.

**v0.2 — Turnamen (Juni 2026)**
Bracket regional (East Africa, West Africa, SEA, LatAm). Prize pool tunai mingguan yang di-sponsor partner ekosistem Celo.

**v0.3 — Chess960 & Puzzle Rush**
Ekspansi format. Chess960 kasih variasi untuk returning player; Puzzle Rush jadi daily hook kedua.

**v1.0 — Open Tournament API (Q3 2026)**
Brand dan DAO bisa sponsor turnamen branded via API publik. Treasury bayar, player bertanding, Gambit handle settlement.

**v2.0 — Reputasi Lintas-Game**
ELO dan soulbound badge Gambit jadi identitas portable yang bisa di-gate oleh game Celo lain. Rating catur sebagai primitif reputasi Web3-native.

## Memulai

```bash
# Clone repo
git clone https://github.com/<your-org>/gambit
cd gambit

# Install
pnpm install

# Konfigurasi environment
cp .env.example .env
# Wajib:
#   CELO_RPC_URL, CELO_CHAIN_ID
#   SUPABASE_URL, SUPABASE_ANON_KEY
#   ORACLE_SIGNER_KEY        (di-manage KMS, jangan commit)
#   SELF_CLIENT_ID
#   DEPLOYER_PRIVATE_KEY     (wallet khusus, jangan pakai wallet pribadi)

# Deploy contract ke Celo Sepolia
pnpm hardhat run scripts/deploy.ts --network celoSepolia

# Run MiniApp secara lokal
pnpm dev
# Tes di dalam MiniPay: expose via ngrok + "Custom MiniApp URL"

# Run test suite contract
pnpm hardhat test
pnpm forge test   # fuzz + invariant test buat akuntansi escrow
```

## Struktur Project

```
gambit/
├── apps/
│   ├── miniapp/         # MiniApp Next.js (player-facing)
│   └── server/          # Game server Hono + WebSocket
├── packages/
│   ├── contracts/       # Solidity + Hardhat + Foundry
│   ├── sdk/             # TypeScript SDK (binding viem)
│   └── chess-engine/    # Wrapper chess.js + Stockfish WASM
├── scripts/
│   └── deploy.ts
└── Docs_Hackaton.md
```

## Tim

Gambit adalah project tim untuk Celo Proof of Ship Season 2. Kontributor menangani smart contract, game server, frontend, dan operasional. Daftar tim lengkap dan profil Talent App ada di [halaman Celo Proof of Ship](https://talent.app/~/earn/celo-proof-of-ship).

## Kontribusi

Issue dan PR welcome. Diskusi desain di [Telegram Celo Proof of Ship](https://t.me/proofofship). Kontribusi prioritas tinggi: time control baru, heuristik anti-cheat tambahan, lokalisasi di luar EN/SW/YO/TL/ID, dan tooling integrasi sponsor untuk Daily Puzzle.

## Lisensi

MIT. Bangun di atasnya, fork, remix. Satu permintaan: kalau kamu ship competitor, pastikan lebih bagus untuk user yang kami coba jangkau.

## Ucapan Terima Kasih

Celo Foundation dan tim Proof of Ship atas program builder onchain yang nyata. Opera MiniPay karena menemui 7 juta+ user stablecoin di tempat mereka sudah ada. Tim chess.js dan Stockfish atas infrastruktur catur open-source yang bikin semua ini mungkin. Immortal Game dan OnChess karena explore ruang ini duluan — dan karena lewat contoh mereka menunjukkan, audiens mana yang masih belum punya produk yang dibangun untuk mereka.

---

*Dibangun untuk Celo Proof of Ship — Season 2, April 2026.*
