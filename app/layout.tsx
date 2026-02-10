import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import Header from "@/components/site/Header";
import NeedAssistance from "@/components/site/NeedAssistance";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2", // ✅ 파일 위치에 맞게 조정
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920", // variable weight range (예시)
});

export const metadata: Metadata = {
  title: "ITS BIO",
  description: "ITS BIO website",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${pretendard.variable} antialiased text-[17px] leading-relaxed`}
      >
        <div style={{ ["--header-h" as any]: "56px" }}>
          <Header />
          {children}
          <div className="mt-16 md:mt-24">
            <NeedAssistance />
          </div>
          
        </div>
      </body>
    </html>
  );
}