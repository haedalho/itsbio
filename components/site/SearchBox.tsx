"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBox({
  className,
  placeholder = "Search by Product Name, Catalog No...",
  onSubmitted,
}: {
  className?: string;
  placeholder?: string;
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit() {
    const v = q.trim();
    if (!v) return;
    router.push(`/search?q=${encodeURIComponent(v)}`);
    onSubmitted?.();
  }

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-2">
        <input
          className="h-11 min-w-0 flex-1 rounded-full border bg-white px-5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          aria-label="Search by product name or catalog number"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-orange-600 px-5 text-sm font-semibold text-white transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!q.trim()}
        >
          Search
        </button>
      </div>
    </form>
  );
}
