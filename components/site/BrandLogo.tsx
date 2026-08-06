import Image from "next/image";
import Link from "next/link";

export default function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="ITS BIO home"
      className={`inline-flex h-14 w-[116px] items-center ${className}`}
    >
      <Image
        src="/images/brand/itsbio-logo-original-en-v2.png"
        alt="ITSBIO"
        width={136}
        height={85}
        priority
        unoptimized
        className="block h-auto w-[108px] object-contain"
      />
    </Link>
  );
}
