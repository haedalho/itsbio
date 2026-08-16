import Link from "next/link";

export default function FloatingQuoteButton() {
  return (
    <Link
      href="/quote"
      aria-label="Request a Quote"
      className="group fixed bottom-6 right-5 z-[55] flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-white shadow-[0_12px_34px_rgba(234,88,12,0.32)] ring-1 ring-orange-700/10 transition hover:-translate-y-1 hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 md:bottom-7 md:right-7"
    >
      <span className="pointer-events-none absolute right-[calc(100%+12px)] hidden whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-lg transition group-hover:block group-focus-visible:block md:block md:translate-x-2 md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100 md:group-focus-visible:translate-x-0 md:group-focus-visible:opacity-100">
        Request a Quote
      </span>
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 5.75h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H10l-5 3v-3H5a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 2-2Z" />
        <path d="M7.5 10h9" />
        <path d="M7.5 14h6" />
      </svg>
    </Link>
  );
}
