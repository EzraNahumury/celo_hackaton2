"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Feature = {
  key: "play" | "puzzle" | "club";
  piece: string;
  hint: string;
  title: string;
  desc: string;
  stat: string;
  href: string;
  tint: string;
};

const FEATURES: Feature[] = [
  {
    key: "play",
    piece: "♞",
    hint: "01",
    title: "1v1 Match",
    desc: "Lawan pemain lain, stake kecil. Menang: pot minus 3% fee ke dompet kamu.",
    stat: "Stake · 0.50 – 2 cUSD",
    href: "/play",
    tint: "#60a5fa",
  },
  {
    key: "puzzle",
    piece: "♛",
    hint: "02",
    title: "Puzzle Harian",
    desc: "Satu puzzle gratis tiap hari. Top 10 tercepat bagi prize pool komunitas.",
    stat: "Reset · 00:00 UTC",
    href: "/puzzle",
    tint: "#a78bfa",
  },
  {
    key: "club",
    piece: "♚",
    hint: "03",
    title: "Chess Club",
    desc: "Bikin klub 4–8 teman. Buy-in mingguan, round-robin, juara ambil 70%.",
    stat: "Split · 70 / 20 / 10",
    href: "/club",
    tint: "#34d399",
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  const current = FEATURES[idx];
  const prev = FEATURES[(idx - 1 + FEATURES.length) % FEATURES.length];
  const next = FEATURES[(idx + 1) % FEATURES.length];

  const dots = useMemo(() => generateDots(28), []);

  const connect = (toHref?: string) => {
    setBusy(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("gambit:addr", "0x8f2e1ad5aef9c3ea44a4e0c47f8a39bc4d21c4a1");
    }
    setTimeout(() => router.push(toHref ?? "/home"), 500);
  };

  return (
    <main
      className="relative flex flex-1 flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(70% 50% at 10% 0%, rgba(125,100,255,0.35) 0%, transparent 60%)," +
          "radial-gradient(50% 40% at 100% 20%, rgba(56,189,248,0.25) 0%, transparent 60%)," +
          "linear-gradient(180deg, #1b1f55 0%, #141a4a 40%, #0c1240 75%, #060a28 100%)",
      }}
    >
      <DotField dots={dots} />
      <BigBgPiece piece={current.piece} tint={current.tint} />

      <TopBar />

      <div className="relative z-10 px-6 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/60">
          MiniPay · Celo
        </p>
        <h1 className="mt-2 text-[56px] font-extrabold leading-[0.92] tracking-tight text-white">
          Gambit
        </h1>
        <p className="mt-1 text-[28px] font-semibold leading-tight text-white/85">
          Chess Pays<span className="text-[color:var(--color-amber)]">.</span>
        </p>
      </div>

      <FeatureStage prev={prev} current={current} next={next} />

      <div className="relative z-10 mt-auto px-5 pb-[max(env(safe-area-inset-bottom),16px)]">
        <FeatureCard
          feature={current}
          onArrow={() => connect(current.href)}
          busy={busy}
          count={`${idx + 1} / ${FEATURES.length}`}
          onPrev={() => setIdx((i) => (i - 1 + FEATURES.length) % FEATURES.length)}
          onNext={() => setIdx((i) => (i + 1) % FEATURES.length)}
          dotIdx={idx}
          dotCount={FEATURES.length}
        />

        <CommunityStrip />

        <button
          type="button"
          onClick={() => connect()}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition active:scale-[0.99] disabled:opacity-70"
        >
          {busy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Menghubungkan MiniPay…
            </>
          ) : (
            <>Masuk dengan MiniPay</>
          )}
        </button>
      </div>
    </main>
  );
}

function TopBar() {
  return (
    <div className="relative z-10 flex items-center justify-between px-6 pt-[max(env(safe-area-inset-top),18px)]">
      <button
        type="button"
        aria-label="Menu"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur-md"
      >
        <MenuIcon />
      </button>
      <button
        type="button"
        aria-label="Profil"
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-gradient-to-br from-[#60a5fa] to-[#a78bfa] text-xs font-extrabold text-white"
      >
        EK
      </button>
    </div>
  );
}

function FeatureStage({
  prev,
  current,
  next,
}: {
  prev: Feature;
  current: Feature;
  next: Feature;
}) {
  return (
    <div className="relative z-10 mt-6 flex h-[260px] items-end justify-center px-2">
      <SideTile piece={prev.piece} side="left" />
      <HeroPiece piece={current.piece} tint={current.tint} hint={current.hint} />
      <SideTile piece={next.piece} side="right" />
    </div>
  );
}

function HeroPiece({ piece, tint, hint }: { piece: string; tint: string; hint: string }) {
  return (
    <div className="relative flex-1 flex items-end justify-center">
      <span
        aria-hidden
        className="absolute inset-0 -bottom-8 m-auto h-56 w-56 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${tint}55 0%, transparent 70%)` }}
      />
      <span
        aria-hidden
        className="absolute -top-2 left-1/2 -translate-x-1/2 text-[140px] font-black leading-none text-white/[0.06] select-none"
      >
        {hint}
      </span>
      <span
        className="relative leading-none drop-shadow-[0_22px_24px_rgba(0,0,0,0.55)]"
        style={{
          fontSize: "180px",
          color: "transparent",
          backgroundImage: `linear-gradient(160deg, #ffffff 0%, #dce9ff 35%, ${tint} 70%, #2540a5 100%)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextStroke: "1px rgba(255,255,255,0.12)",
        }}
      >
        {piece}
      </span>
    </div>
  );
}

function SideTile({ piece, side }: { piece: string; side: "left" | "right" }) {
  return (
    <div
      aria-hidden
      className={`relative hidden h-[110px] w-[70px] flex-shrink-0 select-none items-end justify-center sm:flex ${
        side === "left" ? "-mr-2" : "-ml-2"
      }`}
    >
      <span className="text-[72px] leading-none text-white/20 blur-[0.3px]">{piece}</span>
    </div>
  );
}

function FeatureCard({
  feature,
  onArrow,
  busy,
  count,
  onPrev,
  onNext,
  dotIdx,
  dotCount,
}: {
  feature: Feature;
  onArrow: () => void;
  busy: boolean;
  count: string;
  onPrev: () => void;
  onNext: () => void;
  dotIdx: number;
  dotCount: number;
}) {
  return (
    <article
      key={feature.key}
      className="fade-in-up relative overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.08] p-5 backdrop-blur-xl"
      style={{ boxShadow: "0 20px 50px -20px rgba(0,0,0,0.55)" }}
    >
      <span
        aria-hidden
        className="absolute -right-16 -top-20 h-48 w-48 rounded-full blur-3xl"
        style={{ background: `${feature.tint}33` }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: `${feature.tint}22`, color: feature.tint }}
            >
              Mode {feature.hint}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              {count}
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white">
            {feature.title}
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{feature.desc}</p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-white/55">
            {feature.stat}
          </p>
        </div>
        <button
          type="button"
          onClick={onArrow}
          disabled={busy}
          aria-label={`Mulai ${feature.title}`}
          className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--color-amber)] text-[#2a1a00] shadow-[0_12px_24px_-8px_rgba(245,177,24,0.55)] transition active:scale-95 disabled:opacity-70"
        >
          {busy ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#2a1a00]/30 border-t-[#2a1a00]" />
          ) : (
            <ArrowRightIcon />
          )}
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[color:var(--color-amber)]/20" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Fitur sebelumnya"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:text-white"
          >
            <ChevLeft />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Fitur berikutnya"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:text-white"
          >
            <ChevRight />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: dotCount }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === dotIdx ? "w-5 bg-white" : "w-1.5 bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function CommunityStrip() {
  const avatars = [
    { bg: "from-[#60a5fa] to-[#2563eb]", label: "D" },
    { bg: "from-[#a78bfa] to-[#7c3aed]", label: "M" },
    { bg: "from-[#34d399] to-[#059669]", label: "R" },
    { bg: "from-[#f59e0b] to-[#d97706]", label: "K" },
  ];
  return (
    <div className="mt-4 flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-md">
      <div className="flex -space-x-2">
        {avatars.map((a, i) => (
          <span
            key={i}
            className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${a.bg} text-[10px] font-extrabold text-white ring-2 ring-[#0c1240]`}
          >
            {a.label}
          </span>
        ))}
      </div>
      <p className="flex-1 text-[11px] text-white/75">
        <span className="font-bold text-white">3.120 pemain</span> online sekarang
      </p>
      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        LIVE
      </span>
    </div>
  );
}

function DotField({ dots }: { dots: { top: number; left: number; s: number; o: number }[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            top: `${d.top}%`,
            left: `${d.left}%`,
            width: d.s,
            height: d.s,
            opacity: d.o,
          }}
        />
      ))}
    </div>
  );
}

function BigBgPiece({ piece, tint }: { piece: string; tint: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -right-20 top-16 select-none text-[400px] leading-none transition-colors duration-500"
      style={{ color: `${tint}10`, filter: "blur(1px)" }}
    >
      {piece}
    </span>
  );
}

function generateDots(n: number) {
  const rnd = mulberry32(42);
  return Array.from({ length: n }).map(() => ({
    top: rnd() * 100,
    left: rnd() * 100,
    s: 1 + Math.floor(rnd() * 3),
    o: 0.2 + rnd() * 0.55,
  }));
}

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M4 12h10M4 17h16" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function ChevLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

function ChevRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
