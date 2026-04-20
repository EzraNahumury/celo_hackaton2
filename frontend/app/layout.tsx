import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ChainBanner } from "@/components/chain-banner";
import { RootErrorBoundary } from "@/components/error-boundary";
import { PreviewBanner } from "@/components/preview-banner";
import { ToastProvider } from "@/components/toast";
import { Web3Provider } from "@/providers/web3-provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gambit Chess",
  description: "Main catur, menang CELO. Settle langsung ke MiniPay.",
};

export const viewport: Viewport = {
  themeColor: "#1e6fd9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Minimal defensive shim. Mobile Safari aborts the whole page ("This page
// couldn't load") if an uncaught error fires during hydration — typically
// from wallet extensions monkey-patching History. We DON'T touch History
// prototype here (iframe-based restoration crashes some mobile WebViews);
// instead we install a capture-phase error swallower that preserves
// navigation when a wallet's pushState listener throws on a null `this`.
const HISTORY_SHIM = `(function(){try{
  var isNoise = function(x){
    var m = x && (x.message || (typeof x === 'string' ? x : ''));
    return !!m && String(m).indexOf('dispatchEvent') !== -1;
  };
  window.addEventListener('error', function(ev){
    if (isNoise(ev.error) || isNoise(ev.message)) {
      ev.preventDefault();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      return false;
    }
  }, true);
  window.addEventListener('unhandledrejection', function(ev){
    if (isNoise(ev.reason)) ev.preventDefault();
  }, true);
}catch(_){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HISTORY_SHIM }} />
      </head>
      <body className="min-h-dvh flex flex-col overflow-x-hidden" suppressHydrationWarning>
        <RootErrorBoundary>
          <Web3Provider>
            <ToastProvider>
              <div className="mx-auto w-full max-w-[430px] flex-1 flex flex-col relative">
                <PreviewBanner />
                <ChainBanner />
                {children}
              </div>
            </ToastProvider>
          </Web3Provider>
        </RootErrorBoundary>
      </body>
    </html>
  );
}
