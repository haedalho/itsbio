import Link from "next/link";
import ProductsMegaMenu from "./ProductsMegaMenu";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/85 backdrop-blur border-b">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center gap-6">
        <div className="font-bold text-2xl">
          <Link href="/" className="hover:text-slate-900">
            Itsbio
          </Link>
        </div>

        <nav className="hidden md:flex gap-6 text-base text-slate-600 items-center">
          <ProductsMegaMenu />
          <Link href="/promotions" className="hover:text-slate-900">Promotions</Link>
          <Link href="/resources" className="hover:text-slate-900">Resources</Link>
          <Link href="/notice" className="hover:text-slate-900">Notice</Link>
          <Link href="/about" className="hover:text-slate-900">About</Link>
          <Link href="/contact" className="hover:text-slate-900">Contact</Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <input
            className="hidden md:block w-80 h-11 rounded-full border px-5 text-sm bg-white"
            placeholder="Search by Product Name, Catalog No..."
          />
          <Link
            href="/quote"
            className="rounded-full bg-orange-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-orange-700 transition"
          >
            Request a Quote
          </Link>
        </div>
      </div>
    </header>
  );
}