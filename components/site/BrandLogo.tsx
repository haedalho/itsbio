import Image from "next/image";
import Link from "next/link";

export default function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="ITS BIO home"
      className={`inline-flex h-12 w-[142px] items-center ${className}`}
    >
      <Image
        src="/images/brand/itsbio-logo.svg"
        alt="ITSBIO"
        width={505}
        height={195}
        priority
        unoptimized
        className="block h-auto w-[132px]"
      />
    </Link>
  );
}
