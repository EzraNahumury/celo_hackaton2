import { BottomNav } from "@/components/bottom-nav";
import { ChevronRight } from "@/components/icons";
import { formatLocal } from "@/lib/format";

export default function ProfilePage() {
  return (
    <>
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),18px)] pb-16 text-white">
        <header className="flex items-center justify-center">
          <p className="text-sm font-bold">Akun</p>
        </header>
        <div className="mt-6 flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-2xl font-extrabold">
            EK
          </span>
          <p className="mt-3 text-lg font-bold">Ezra</p>
          <p className="text-[11px] text-white/75">0x8f2e…c4a1</p>
        </div>
      </div>

      <main className="flex-1 px-5 pb-6">
        <section className="card -mt-10 p-4 relative z-10">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Rating" value="1380" />
            <Stat label="Partai" value="34" />
            <Stat label="Earned" value={formatLocal(12.5, "IDR")} />
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">
            Akun
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            <Row label="Mata uang tampilan" value="IDR · Rupiah" />
            <Row label="Bahasa" value="Indonesia" />
            <Row label="Notifikasi" value="Aktif" />
            <Row label="Smart Contract" value="Celo Mainnet ↗" />
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">
            Tentang
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            <Row label="Fair Play" value="Anti-cheat aktif" />
            <Row label="Support" value="t.me/gambitchess" />
            <Row label="Versi" value="0.1.0" />
          </ul>
        </section>
      </main>
      <BottomNav />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[color:var(--color-surface-soft)] px-3 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-2)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-[color:var(--color-ink-0)]">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="card flex items-center justify-between px-4 py-3.5">
      <span className="text-sm font-medium text-[color:var(--color-ink-0)]">{label}</span>
      <span className="flex items-center gap-1 text-xs text-[color:var(--color-ink-2)]">
        {value}
        <ChevronRight size={14} />
      </span>
    </li>
  );
}
