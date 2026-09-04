// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/products/abm/staged/[kind]/[key]": ["./data/abm-cell-details/**/*.json.gz"],
  },
  images: {
    qualities: [75, 85, 90],
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
      {
        protocol: "https",
        hostname: "www.thistlescientific.com",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "i0.wp.com",
        pathname: "/www.thistlescientific.com/wp-content/uploads/**",
      },
    ],
  },
  async redirects() {
    const systems = ["somnoflo", "somnosuite", "vetflo"];
    const kentRedirects = systems.flatMap((system) => {
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

    return [
      {
        source: "/products/abm/general-materials/gel-documentation/dna-stains",
        destination: "/products/abm/general-materials/gel-documentation#safeview-dna-stains",
        permanent: false,
      },
      {
        source: "/products/abm/general-materials/gel-documentation/gel-imager",
        destination: "/products/abm/staged/product/E1001",
        permanent: false,
      },
      ...kentRedirects,
    ];
  },
};

export default nextConfig;
