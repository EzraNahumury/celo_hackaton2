import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PreviewBanner } from "@/components/preview-banner";
import { Web3Provider } from "@/providers/web3-provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gambit — Catur Microearning",
  description: "Main catur, menang CELO. Settle langsung ke MiniPay.",
};

export const viewport: Viewport = {
  themeColor: "#1e6fd9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Some browser wallet extensions (e.g. the one that injects requestProvider.js)
// monkey-patch History.prototype.pushState/replaceState in a way that throws
// `Cannot read properties of null (reading 'dispatchEvent')` on every Next.js
// route change. Restoring the natives from a fresh iframe before React hydrates
// ensures Next.js's app-router captures the untouched implementations.
const RESTORE_HISTORY = `(function(){try{var f=document.createElement('iframe');f.style.display='none';(document.body||document.documentElement).appendChild(f);var p=f.contentWindow.History.prototype;History.prototype.pushState=p.pushState;History.prototype.replaceState=p.replaceState;f.remove();}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: RESTORE_HISTORY }} />
      </head>
      <body className="min-h-dvh flex flex-col overflow-x-hidden" suppressHydrationWarning>
        <Web3Provider>
          <div className="mx-auto w-full max-w-[430px] flex-1 flex flex-col relative">
            <PreviewBanner />
            {children}
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}
