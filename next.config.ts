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
        hostname: "www.kentscientific.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "kentscientific.com",
        pathname: "/**",
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
  async redirects() {
    const systems = ["somnoflo", "somnosuite", "vetflo"];

    return systems.flatMap((system) => {
      const leaf = `anesthesia-accessories-for-${system}`;
      const existingCategory = `/products/kent/anesthesia/${leaf}`;

      return [
        {
          source: `/products/kent/anesthesia/anesthesia-accessories/${leaf}`,
          destination: existingCategory,
          permanent: false,
        },
        {
          source: `/products/kent/${leaf}`,
          destination: existingCategory,
          permanent: false,
        },
      ];
    });
  },
};

export default nextConfig;
