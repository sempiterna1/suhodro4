import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.trycloudflare.com"],
  // значок Next.js в углу (только в разработке) ложился на HUD Охотницы
  devIndicators: false,
};

export default nextConfig;
