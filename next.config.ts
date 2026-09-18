import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Networks that intercept TLS need the system cert store for next/font to
    // reach Google Fonts at build time.
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;
