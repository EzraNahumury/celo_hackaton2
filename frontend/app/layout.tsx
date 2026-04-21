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

// Wraps History.pushState / replaceState to swallow the specific
// `Cannot read properties of null (reading 'dispatchEvent')` TypeError
// that wallet / analytics browser extensions throw when they monkey-
// patch History and then get called with a `this` they don't expect.
//
// Next.js 16's router calls pushState during every client-side
// navigation, so one misbehaving extension surfaces as the built-in
// "This page couldn't load" error on every menu switch. Installing the
// wrapper in <head> before any extension touches History guarantees our
// try/catch runs outside the extension's override and native state is
// still written to the history stack.
//
// The window-level capture-phase listener is kept as a second line of
// defence in case the extension re-wraps pushState after our shim.
const HISTORY_SHIM = `(function(){try{
  var isDispatchNoise = function(x){
    var m = x && (x.message || (typeof x === 'string' ? x : ''));
    return !!m && String(m).indexOf('dispatchEvent') !== -1;
  };
  // Cache the native implementations as early as possible. Even if an
  // extension wrapped History first, calling the cached reference keeps
  // state-writes functional because we bypass the extension wrapper.
  var nativePush = History.prototype.pushState;
  var nativeReplace = History.prototype.replaceState;
  var safeWrap = function(name, native){
    var wrapped = function(){
      try {
        // Force \`this\` to the real window.history. The buggy extension
        // wrapper accesses \`this.dispatchEvent\` on whatever \`this\` was,
        // but the native impl only requires a History instance — it
        // doesn't care where the call originated. Normalising here
        // removes the null-receiver crash entirely.
        return native.apply(window.history, arguments);
      } catch (err) {
        if (err && err instanceof TypeError && isDispatchNoise(err)) return;
        throw err;
      }
    };
    wrapped.__gambitSafe = true;
    try {
      Object.defineProperty(History.prototype, name, {
        value: wrapped,
        writable: true,
        configurable: true,
      });
    } catch(_){
      try { History.prototype[name] = wrapped; } catch(__){}
    }
  };
  var install = function(){
    if (History.prototype.pushState && !History.prototype.pushState.__gambitSafe) {
      safeWrap('pushState', nativePush);
    }
    if (History.prototype.replaceState && !History.prototype.replaceState.__gambitSafe) {
      safeWrap('replaceState', nativeReplace);
    }
  };
  install();
  // Re-install periodically in case an extension monkey-patches History
  // again after page scripts run. 40 ticks × 250ms = 10s covers the
  // typical window where mobile-simulator / wallet extensions initialise.
  var reinstalls = 0;
  var tid = setInterval(function(){
    install();
    reinstalls++;
    if (reinstalls > 40) clearInterval(tid);
  }, 250);
  document.addEventListener('visibilitychange', install, true);

  // Belt-and-braces: swallow the error if it still escapes (e.g. the
  // extension dispatches the broken event asynchronously via setTimeout).
  // Capture phase + stopImmediatePropagation prevents Next.js's dev
  // overlay from picking it up.
  var prevOnError = window.onerror;
  window.onerror = function(msg, src, ln, col, err){
    if (isDispatchNoise(err) || isDispatchNoise(msg)) return true;
    return prevOnError ? prevOnError.apply(this, arguments) : false;
  };
  window.addEventListener('error', function(ev){
    if (isDispatchNoise(ev.error) || isDispatchNoise(ev.message)) {
      ev.preventDefault();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      return false;
    }
  }, true);
  window.addEventListener('unhandledrejection', function(ev){
    if (isDispatchNoise(ev.reason)) ev.preventDefault();
  }, true);

  window.__gambitShim = { installedAt: Date.now(), version: 4 };
  try { console.info('[gambit] History shim v4 installed'); } catch(_){}
}catch(err){
  try { console.error('[gambit] shim error', err); } catch(_){}
}})();`;

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
