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
    const anesthesiaAccessoryCategories = ["somnoflo", "somnosuite", "vetflo"];

    return anesthesiaAccessoryCategories.flatMap((system) => {
      const leaf = `anesthesia-accessories-for-${system}`;
      const destination = `/products/kent/anesthesia/anesthesia-accessories/${leaf}`;

      return [
        {
          source: `/products/kent/anesthesia/${leaf}`,
          destination,
          permanent: false,
        },
        {
          source: `/products/kent/${leaf}`,
          destination,
          permanent: false,
        },
      ];
    });
  },
};

export default nextConfig;
