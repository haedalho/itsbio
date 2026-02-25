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
      <input
        className="h-11 w-full rounded-full border bg-white px-5 text-sm"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
    </form>
  );
}
