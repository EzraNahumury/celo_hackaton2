export type Locale = "id-ID" | "en-NG" | "en-KE" | "en-PH" | "en-GH" | "en-ZA";

export type CurrencyCode = "IDR" | "NGN" | "KES" | "PHP" | "GHS" | "ZAR" | "USD";

export const CUSD_RATES: Record<CurrencyCode, number> = {
  IDR: 15000,
  NGN: 1580,
  KES: 129,
  PHP: 57,
  GHS: 15.2,
  ZAR: 18.4,
  USD: 1,
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

export function cUsdToLocal(cUsd: number, currency: CurrencyCode): number {
  return cUsd * CUSD_RATES[currency];
}

export function formatLocal(cUsd: number, currency: CurrencyCode = "IDR"): string {
  const v = cUsdToLocal(cUsd, currency);
  const locale = CURRENCY_LOCALE[currency];
  const digits = currency === "IDR" || currency === "NGN" || currency === "KES" ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
}

export function formatCUsd(cUsd: number): string {
  return `${cUsd.toFixed(2)} cUSD`;
}
