import type { NextConfig } from "next";

// Next.js 16 blocks cross-origin requests to dev-only assets by default.
// When the app is opened from a phone — either via the LAN IP, an ngrok
// tunnel, or `adb reverse` — RSC/navigation requests come from an origin
// the dev server doesn't recognise, which surfaces as a page that fails
// to load after the first hop. Allowing the common LAN/tunnel patterns
// keeps mobile navigation working without weakening prod security.
const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.local",
    "*.ngrok.io",
    "*.ngrok-free.app",
    "*.trycloudflare.com",
    // LAN ranges — cover the usual home/office Wi-Fi subnets.
    "10.*.*.*",
    "192.168.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.20.*.*",
    "172.21.*.*",
    "172.22.*.*",
    "172.23.*.*",
    "172.24.*.*",
    "172.25.*.*",
    "172.26.*.*",
    "172.27.*.*",
    "172.28.*.*",
    "172.29.*.*",
    "172.30.*.*",
    "172.31.*.*",
  ],
};

export default nextConfig;
