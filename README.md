# Axon

> **Collective intelligence. Collective wealth.**
> An AI portfolio manager for onchain investment groups — built into MiniPay on Celo.

[![Built on Celo](https://img.shields.io/badge/Built%20on-Celo-FCFF52)](https://celo.org)
[![MiniPay](https://img.shields.io/badge/MiniApp-MiniPay-blue)](https://minipay.to)
[![Track](https://img.shields.io/badge/Track-AI%20Agents-purple)](https://docs.celo.org/build-on-celo/build-with-ai/overview)
[![ERC-8004](https://img.shields.io/badge/Agent-ERC--8004-black)](https://docs.celo.org/build-on-celo/build-with-ai/overview)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

---

## The Problem

Solo DeFi investors get all the sophisticated AI tools. Nuvia Finance automates yield farming. Shrimpy rebalances portfolios. Jenova makes allocation calls. All of them assume one thing: **you're investing alone, with enough capital to diversify.**

That leaves two populations completely unserved.

**Population 1 — Retail users in emerging markets.** The 14M+ MiniPay users across Kenya, Nigeria, Philippines, and Latin America don't have enough capital as individuals to meaningfully diversify across DeFi. They already pool money together — *chama, ajo, stokvel, paluwagan, tandas* — but they manage these pools in WhatsApp groups and Google Sheets. One person holds the pot. Trust degrades. No strategy. No transparency.

**Population 2 — Crypto-native groups.** DAOs, investment clubs, friend groups who want to deploy collective capital into DeFi yield strategies. Today they cobble together Gnosis Safes, manual rebalancing, Discord polls. There is no native tool where a group can set a risk profile and let an AI agent run the portfolio.

Both populations are asking the same question: **why can't my group have an AI portfolio manager?**

## The Solution

**Axon** is the neural layer for onchain group investing. Every group on Axon gets:

A shared vault on Celo Mainnet (ERC-4626 share accounting) that custodies member deposits in CELO, cUSD, USDC, and other whitelisted stablecoins. A dedicated AI agent with its own onchain wallet (ERC-8004) that analyzes the market, proposes allocations, and executes rebalances within strict risk bounds. Three configurable risk profiles — Conservative, Balanced, Aggressive — set by the group admin and enforced at the contract level, so the AI literally cannot exceed them. Automated capital routing to audited Celo protocols (Moola, Ubeswap, Mento, stCELO) — Axon never invents its own yield, it orchestrates battle-tested ones. Hybrid governance where the AI executes small rebalances autonomously and puts large allocation shifts up for member vote. Pay-as-you-go AI inference via x402, so small groups pay only for what the agent actually thinks about. Every decision signed by the agent, logged onchain, visible on agentscan.

Solo investors get Nuvia. **Groups get Axon.**

## How It Works

```
1. Open MiniPay        →  Launch Axon MiniApp
2. Verify humanity     →  Self Agent ID (Proof of Humanity)
3. Create a Group      →  Set name, risk profile, invite link
                          AxonFactory deploys GroupVault + AI agent
4. Invite members      →  One-tap join via MiniPay
5. Deposit capital     →  Members deposit CELO / cUSD / USDC to vault
6. AI agent activates  →  Reads pool state, analyzes market (paid via x402)
                          Allocates across Moola / Ubeswap / Mento / stCELO
                          Stays within the admin's risk profile bounds
7. Weekly rebalance    →  AI proposes adjustments
                          Small shifts auto-execute, big shifts go to vote
8. Track & claim       →  Real-time portfolio dashboard in MiniPay
                          Withdraw shares anytime (subject to lock)
```

Every action is a Celo Mainnet transaction. Every AI decision is signed by the agent's ERC-8004 wallet. Every onchain action is queryable on [agentscan](https://agentscan.info/).

## Risk Profiles

The admin picks one profile at group creation. The profile encodes allocation bounds directly into the vault contract. The AI agent operates inside these bounds — it has no authority to exceed them.

| Profile | Stable Yield (Moola) | CELO / stCELO | LP / Volatile | Max Drawdown Trigger |
|---------|----------------------|---------------|----------------|----------------------|
| Conservative | 75% | 20% | 5% | 5% — auto-derisk |
| Balanced | 50% | 30% | 20% | 15% — auto-derisk |
| Aggressive | 25% | 30% | 45% | 30% — auto-derisk |

When drawdown triggers fire, the AI autonomously derisks the portfolio to the safer end of its bounds. This is an onchain circuit breaker — it cannot be disabled mid-cycle.

## Hybrid AI Governance

Axon's key design choice is that the AI is a **real autonomous agent** — not a propose-only suggestion bot, not a fully unsupervised trader. We split the action space by magnitude:

- **Rebalances under 10% of pool value** — AI auto-executes. Signed by agent wallet, logged onchain.
- **Rebalances 10% or more** — AI proposes, members vote. 2/3 threshold, 48-hour window.
- **New protocol addition** — Always requires member vote, regardless of size.
- **Profile change** — Admin initiates, 2/3 member vote required.
- **Emergency derisk** — AI auto-executes when drawdown trigger fires. No vote needed.

This threshold model keeps Axon squarely inside the **AI Agents** hackathon track (real onchain autonomy) without crossing into unregulated robo-advisor territory. It also generates meaningful onchain activity per group per week — every rebalance, every proposal, every vote is a transaction.

## Why Axon is Not "Just Another DeFi App"

The hackathon rules flag DeFi built by solo builders as high-risk. Axon sidesteps this for three reasons the judges will recognize immediately.

**We're a team, not a solo builder.** Axon is shipped by a multi-person team with distributed responsibility for contracts, AI, frontend, and ops.

**We don't build new DeFi primitives.** Every dollar of yield is generated by audited protocols — Moola, Ubeswap, Mento, stCELO — that have been battle-tested with millions in TVL. Axon is an orchestration and AI layer. The scary part of DeFi (the yield contracts themselves) is something we *consume*, not author.

**We're primarily an AI Agent project.** Yield is the use case that gives the agent somewhere to apply its intelligence. Judged through the AI Agents track lens, the novelty is the group-scoped autonomous agent with ERC-8004 identity, x402 payments, and celo/skills capabilities — not the yield mechanism.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MiniPay (Opera Wallet)                     │
│                   14M+ stablecoin users globally                │
└────────────────────────────┬────────────────────────────────────┘
                             │ MiniPay Hook
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Axon MiniApp (Frontend)                     │
│   Next.js 14 + Viem/Wagmi + TailwindCSS + shadcn/ui + Vercel    │
└──────────┬──────────────────────────┬───────────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────────┐   ┌──────────────────────────────────┐
│   Orchestrator API   │   │   Celo Mainnet Smart Contracts   │
│   Node.js + Hono     │   │   ├─ AxonFactory.sol             │
│   Supabase (meta)    │◄──┼── ├─ GroupVault.sol (per group)  │
│   Telegram Bot       │   │   ├─ AgentRegistry.sol (ERC-8004)│
│                      │   │   ├─ RiskProfile.sol (library)   │
│                      │   │   ├─ Governance.sol              │
│                      │   │   └─ PerformanceBadges.sol       │
└──────────┬───────────┘   └─────────────┬────────────────────┘
           │                             │
           │                             │ routes capital to
           │                             ▼
           │              ┌──────────────────────────────────┐
           │              │     Audited Celo Protocols       │
           │              │   Moola · Ubeswap · Mento ·      │
           │              │   stCELO Liquid Staking          │
           │              └──────────────────────────────────┘
           ▼
┌──────────────────────────────────────────────────────────────┐
│                    AI Agent Engine (per group)               │
│   Claude Sonnet 4.6  →  Market analysis, allocation calls    │
│   Claude Haiku 4.5   →  Fast nudges, weekly digests          │
│   LangGraph          →  Multi-step agent orchestration       │
│   celo/skills        →  Capability framework                 │
│   ERC-8004 wallet    →  Agent identity + signing authority   │
│   x402 (Thirdweb)    →  Per-inference micro-payments         │
│   Self Agent ID      →  Onchain agent identity               │
│   agentscan          →  Observability + audit trail          │
└──────────────────────────────────────────────────────────────┘
```

### Smart Contract Layer

| Contract | Responsibility |
|----------|----------------|
| `AxonFactory.sol` | Deploys a new `GroupVault` and registers its AI agent per group creation |
| `GroupVault.sol` | ERC-4626 share-based custody. Enforces risk-profile allocation bounds at the contract level |
| `AgentRegistry.sol` | ERC-8004 agent registration, scoped permissions, onchain action log |
| `RiskProfile.sol` | Library encoding the 3 profiles as immutable constraint parameters |
| `Governance.sol` | Proposal + vote logic for above-threshold rebalances and profile changes |
| `PerformanceBadges.sol` | Soulbound ERC-5192 tokens for milestones (first profit, 1-year hold, etc.) |

### Protocol Integration Adapters

Axon never holds custody of yield-generating positions in its own code. It uses thin adapter contracts that wrap external protocols:

| Adapter | Wraps | Purpose |
|---------|-------|---------|
| `MoolaAdapter.sol` | Moola Market | Lending cUSD / USDC for stable yield |
| `UbeswapAdapter.sol` | Ubeswap v3 | Concentrated liquidity LP positions |
| `MentoAdapter.sol` | Mento Protocol | Stable swap rails for FX |
| `StCeloAdapter.sol` | stCELO | Liquid staking of CELO |

Each adapter exposes a uniform interface (`deposit`, `withdraw`, `currentValue`) so the AI agent reasons in terms of allocation targets, not protocol-specific APIs. Adding a new adapter requires governance vote.

### AI Agent Engine

Every group gets exactly one AI agent. The agent runs on a weekly cadence plus on-demand triggers. Its capabilities, exposed through the `celo/skills` framework:

| Skill | What It Does | Onchain Artifact |
|-------|--------------|-------------------|
| `MarketAnalyzer` | Fetches Celo protocol yields, TVL, price feeds; synthesizes via Claude | IPFS-pinned report, CID onchain |
| `AllocationProposer` | Computes target allocation within risk bounds, factoring market state | `Governance.propose()` or direct execute |
| `RebalanceExecutor` | Signs and broadcasts rebalance transactions via agent wallet | Batched `GroupVault.rebalance()` call |
| `DrawdownMonitor` | Watches pool value; fires emergency derisk when threshold breached | Auto `GroupVault.emergencyDerisk()` |
| `MemberNudger` | Sends personalized contributions/performance updates via Telegram | Signed off-chain messages |
| `WeeklyReporter` | Human-readable summary of what the agent did and why | Hash onchain, full report on IPFS |

The agent pays for its own Claude API inferences via **x402** micro-payments, drawing from a small agent wallet topped up by protocol fees (0.5% of rebalanced volume). No subscription. No centralized billing. Pure usage-based AI.

## Tech Stack

**Frontend**
Next.js 14 via `celo-composer` starter, Viem + Wagmi for Celo Mainnet RPC, MiniPay Hook for native wallet connection, TailwindCSS + shadcn/ui for mobile-first design, deployed to Vercel.

**Smart Contracts**
Solidity 0.8.24, Hardhat, OpenZeppelin (AccessControl, ReentrancyGuard, ERC-4626, ERC-5192), deployed and verified on Celo Mainnet. Foundry for fuzz testing critical invariants (allocation bounds, drawdown triggers).

**AI Layer**
Anthropic Claude Sonnet 4.6 for market reasoning, Haiku 4.5 for nudges and fast paths, LangGraph for multi-step agent workflows, ERC-8004 for agent identity, x402 via Thirdweb for per-inference payments, celo/skills as the capability framework, Self Agent ID for onchain agent identity, agentscan for observability.

**Backend**
Node.js + Hono as a thin API layer, Supabase for group metadata and realtime UI state, Telegram Bot API for group notifications.

**Protocols Integrated**
MiniPay, Moola Market, Ubeswap v3, Mento Protocol, stCELO. All audited, all production-grade on Celo Mainnet.

**Onboarding**
Self for Proof of Humanity verification — required by Celo Proof of Ship eligibility rules.

## Demo Flow

**Scene 1 — Creation.** Four friends in Nairobi want to invest together. Fatima opens MiniPay. She launches Axon. Self verifies she's human in two seconds. She taps "Create Group" — names it "Nairobi Yield Club" — picks "Balanced" risk profile — shares the invite link to her three friends on WhatsApp. `AxonFactory.createGroup()` deploys the vault and registers the agent. Her friends join in the next ten minutes, each with one tap inside MiniPay.

**Scene 2 — First Deposit.** Each member deposits 200 cUSD. The `GroupVault` mints shares. Total pool: 800 cUSD. The Axon AI agent — now activated — announces itself in the group's auto-provisioned Telegram channel: *"Hi team. I'm your Axon agent. Balanced profile means 50% stable lending, 30% stCELO, 20% LP. I'll run my first allocation in 24 hours after I've read market conditions. You can see my wallet on agentscan."*

**Scene 3 — Allocation.** Next day, the agent fires a Claude Sonnet call (paid via x402 from its own wallet). It reads Moola's cUSD lending APR (4.2%), stCELO's effective yield (5.1%), and a Ubeswap CELO/cUSD LP position (8.7% with impermanent loss risk estimated at 2.1%). It computes the target allocation, which matches the Balanced profile. It signs and broadcasts the rebalance. Five transactions on Celo Mainnet. Gas paid from agent wallet. Weekly report posted.

**Scene 4 — Governance.** Two weeks in, market shifts. The agent sees an opportunity to push 35% into Ubeswap LP — but that's 15% above current allocation, above the 10% auto-execute threshold. It calls `Governance.propose()`. Members get a Telegram push. They review the agent's reasoning (CID linked from the proposal). Three of four vote yes. Proposal passes. Agent executes.

**Scene 5 — Drawdown.** Market crashes. The LP position is down 12% in a week. The `DrawdownMonitor` fires at the 15% mark. The agent autonomously derisks — no vote needed, it's the emergency circuit breaker. Funds move to Moola stable lending. Group sees transparent onchain evidence of the protection. Axon agent posts a post-mortem.

**Scene 6 — Payout.** Six months later, the pool is up 11.2% net of fees. Fatima withdraws her shares. `GroupVault` burns her shares and sends her proportional cUSD back to her MiniPay wallet. She gets a soulbound badge minted: "Axon Founding Member — Nairobi Yield Club."

## Why Axon Wins Celo Proof of Ship

| Criterion (from hackathon docs) | Axon Fulfillment |
|----------------------------------|------------------|
| Deployed on Celo Mainnet with verified contracts | 6 contracts + 4 adapters, all verified |
| Built as a MiniApp with MiniPay hook | Primary and only entry point |
| Real onchain activity | Every rebalance, vote, deposit, and badge is a transaction |
| Open source with public GitHub | MIT license, active repo |
| Proof of Humanity | Self Agent ID mandatory at onboarding |
| AI Agents track fit | ERC-8004 agent wallet, celo/skills capabilities, x402 payments — the agent *is* the product |
| Pay-as-you-go LLM use case | x402 per-inference payments, explicitly called out in hackathon docs |
| B2C onboarding secondary track | Zero-friction MiniPay-native flow, cultural fit with chama/ajo/stokvel behavior |
| Not in the rejected "DeFi solo builder" bucket | Team build, audited protocols only, AI-first positioning |
| Ecosystem stack coverage | MiniPay + Self + ERC-8004 + x402 + celo/skills + agentscan — **6 official integrations** |
| Simple and functional | Three-tap flow: verify → create → deposit. Agent takes it from there |
| Ship-ability | Every component has a direct path to Celo Mainnet within the submission window |

## Roadmap

**v1.0 — Hackathon Submission (April 2026)**
Core flow shipped on Celo Mainnet. Three risk profiles. Four protocol adapters (Moola, Ubeswap, Mento, stCELO). Hybrid governance. x402-paid AI. Self verification. Telegram integration.

**v1.1 — Social Proof Loop (Q3 2026)**
Public leaderboard of top-performing groups (opt-in). Group-to-group benchmarking. Reputation portable via soulbound badges.

**v1.2 — Agent Personas (Q4 2026)**
Admins can customize agent communication style (Coach, Analyst, Strategist). Cosmetic layer, same underlying allocation logic.

**v2.0 — Expanded Protocol Universe (2027)**
New adapters for additional audited Celo protocols as they launch. Governance-gated, always audited.

**v2.1 — Cross-Group Reputation**
Members with strong streak badges unlock access to higher-trust groups. Imported via Self.

**v3.0 — Agent Marketplace**
Third-party developers build specialized agent skills via `celo/skills`. Groups can subscribe to skill packages. Creators earn via x402.

## Getting Started

```bash
# Clone the repo
git clone https://github.com/<your-org>/axon
cd axon

# Install
pnpm install

# Configure environment
cp .env.example .env
# Required:
#   CELO_RPC_URL, CELO_CHAIN_ID
#   ANTHROPIC_API_KEY
#   SUPABASE_URL, SUPABASE_ANON_KEY
#   TELEGRAM_BOT_TOKEN
#   X402_API_KEY
#   SELF_CLIENT_ID
#   DEPLOYER_PRIVATE_KEY (use a dedicated wallet, never personal)

# Deploy contracts to Celo Sepolia
pnpm hardhat run scripts/deploy.ts --network celoSepolia

# Run the MiniApp locally
pnpm dev
# Test inside MiniPay: use a ngrok tunnel + "Custom MiniApp URL"

# Run the contract test suite
pnpm hardhat test
pnpm forge test   # fuzz + invariant tests
```

## Team

Axon is a team project for Celo Proof of Ship Season 2. Contributors handle smart contracts, AI agent engineering, frontend, and operations. Full team roster and Talent App profiles linked in the [Celo Proof of Ship page](https://talent.app/~/earn/celo-proof-of-ship).

## Contributing

Issues and PRs welcome. Design discussions happen in the [Celo Proof of Ship Telegram](https://t.me/proofofship). New protocol adapters are a high-priority contribution area — see `contracts/adapters/IProtocolAdapter.sol` for the interface.

## License

MIT. Build on it, fork it, remix it. The only thing we ask: don't charge users a subscription for what an AI agent can do per-inference via x402.

## Acknowledgments

The Celo Foundation and the Proof of Ship team for running a real onchain builder program. Opera MiniPay for meeting 14M stablecoin users where they already live. Thirdweb for x402 and making per-inference payments viable. Self for onchain humanity verification. Nuvia Finance for proving that solo-user AI yield farming deserves a social, group-native counterpart — this is that counterpart.

---

*Built for Celo Proof of Ship — Season 2, April 2026.*
