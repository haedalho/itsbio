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
  async redirects() {
    const systems = ["somnoflo", "somnosuite", "vetflo"];

    return systems.flatMap((system) => {
      const leaf = `anesthesia-accessories-for-${system}`;
      const canonical = `/products/kent/anesthesia/anesthesia-accessories/${leaf}`;

      return [
        {
          source: `/products/kent/anesthesia/${leaf}`,
          destination: canonical,
          permanent: false,
        },
        {
          source: `/products/kent/${leaf}`,
          destination: canonical,
          permanent: false,
        },
      ];
    });
  },
};

export default nextConfig;
