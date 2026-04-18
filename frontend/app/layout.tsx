import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gambit — Catur Microearning",
  description: "Main catur, menang cUSD. Settle langsung ke MiniPay.",
};

export const viewport: Viewport = {
  themeColor: "#1e6fd9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-dvh flex flex-col overflow-x-hidden">
        <div className="mx-auto w-full max-w-[430px] flex-1 flex flex-col relative">
          {children}
        </div>
      </body>
    </html>
  );
}
