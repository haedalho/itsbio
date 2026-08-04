import Link from "next/link";

export default function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="ITS BIO home"
      className={`relative inline-flex h-12 w-[142px] items-end ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 142 48"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        <path
          d="M9 24 C28 23, 31 6, 56 6 C84 6, 91 17, 98 38"
          fill="none"
          stroke="#f97316"
          strokeWidth="3.8"
          strokeLinecap="round"
        />
        <circle cx="9" cy="24" r="3.8" fill="#f97316" />
        <circle cx="99" cy="39" r="2.8" fill="#f97316" />
      </svg>
      <span className="relative z-10 pb-0.5 text-[27px] font-black leading-none tracking-[-0.055em] text-[#0752ad]">
        ITSBIO
      </span>
    </Link>
  );
}
