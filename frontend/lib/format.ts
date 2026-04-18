import { formatUnits, parseEther } from "viem";

export type Locale = "id-ID" | "en-NG" | "en-KE" | "en-PH" | "en-GH" | "en-ZA";
export type CurrencyCode = "IDR" | "NGN" | "KES" | "PHP" | "GHS" | "ZAR" | "USD";

// 1 CELO ≈ $0.50 → these rates convert native CELO to local fiat for display.
export const CELO_RATES: Record<CurrencyCode, number> = {
  IDR: 7500,
  NGN: 790,
  KES: 64,
  PHP: 28,
  GHS: 7.6,
  ZAR: 9.2,
  USD: 0.5,
};

export const CURRENCY_LOCALE: Record<CurrencyCode, Locale> = {
  IDR: "id-ID",
  NGN: "en-NG",
  KES: "en-KE",
  PHP: "en-PH",
  GHS: "en-GH",
  ZAR: "en-ZA",
  USD: "en-NG",
};

export function celoToLocal(celo: number, currency: CurrencyCode): number {
  return celo * CELO_RATES[currency];
}

export function formatLocal(celo: number, currency: CurrencyCode = "IDR"): string {
  const v = celoToLocal(celo, currency);
  const locale = CURRENCY_LOCALE[currency];
  const digits = currency === "IDR" || currency === "NGN" || currency === "KES" ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
}

export function formatCelo(celo: number, decimals = 2): string {
  return `${celo.toFixed(decimals)} CELO`;
}

export function formatCeloWei(wei: bigint, decimals = 2): string {
  return `${Number(formatUnits(wei, 18)).toFixed(decimals)} CELO`;
}

export function weiToLocal(wei: bigint, currency: CurrencyCode = "IDR"): string {
  return formatLocal(Number(formatUnits(wei, 18)), currency);
}

export function celoToWei(celo: number): bigint {
  return parseEther(celo.toString());
}

export function truncateAddress(addr: string, head = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}
