import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import "./globals.css";

import Header from "@/components/site/Header";
import HidePricesClient from "@/components/site/HidePricesClient";
import HomeHeroOverride from "@/components/site/home/HomeHeroOverride";
import NeedAssistance from "@/components/site/NeedAssistance";
import FloatingQuoteButton from "@/components/site/FloatingQuoteButton";
import AbmLinkResolverClient from "@/components/site/AbmLinkResolverClient";
import NavigationLoadingOverlay from "@/components/site/NavigationLoadingOverlay";
import { siteUrl } from "@/lib/site-url";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "ITS BIO | Life Science & Animal Research Solutions",
    template: "%s | ITS BIO",
  },
  description: "ITS BIO supplies life science reagents, cell biology products, animal research systems, laboratory equipment, and responsive quotation support in Korea.",
  keywords: ["ITS BIO", "이츠바이오", "ABM", "Kent Scientific", "life science", "cell biology", "animal research", "laboratory equipment"],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "ITS BIO",
    title: "ITS BIO | Life Science & Animal Research Solutions",
    description: "Scientific products, research systems, sourcing support, and fast quotations from ITS BIO.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "ITS BIO | Life Science & Animal Research Solutions",
    description: "Scientific products, research systems, sourcing support, and fast quotations from ITS BIO.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${pretendard.variable} antialiased text-[17px] leading-relaxed`}>
        <HidePricesClient />
        <AbmLinkResolverClient />
        <Suspense fallback={null}>
          <NavigationLoadingOverlay />
        </Suspense>
        <div style={{ "--header-h": "76px" } as React.CSSProperties}>
          <Header />
          <HomeHeroOverride />
          {children}
          <div className="mt-16 md:mt-24">
            <NeedAssistance />
          </div>
          <FloatingQuoteButton />
        </div>
      </body>
    </html>
  );
}
