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

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
});

export const metadata: Metadata = {
  title: "ITS BIO",
  description: "ITS BIO website",
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
        <div style={{ ["--header-h" as any]: "76px" }}>
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
