import Link from "next/link";

const NAV_ITEMS = [
  { label: "Products", href: "/products/abm" },
  { label: "Services", href: "/products/abm/services" },
  { label: "Promotions", href: "/promotions" },
  { label: "Resources & Support", href: "/notice" },
  { label: "Collaborate With Us", href: "/contact" },
] as const;

export default function AbmHeroBanner({ title = "ABM Products & Services" }: { title?: string; eyebrow?: string }) {
  return (
    <section className="border-b border-orange-700 bg-white" aria-label={title}>
      <nav className="scrollbar-hidden mx-auto flex max-w-[1140px] overflow-x-auto px-4" aria-label="ABM section navigation">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            prefetch={false}
            className="flex h-11 min-w-[170px] flex-1 items-center justify-center border-r border-orange-300 bg-[#f2632f] px-5 text-sm font-semibold text-white transition first:border-l hover:bg-[#d95221]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
