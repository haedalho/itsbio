// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "www.abmgood.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "abmgood.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
