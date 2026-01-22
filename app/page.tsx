export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
          <div className="font-bold text-xl">itsbio</div>

          <nav className="hidden md:flex gap-4 text-sm text-slate-600">
            <a href="#">Products</a>
            <a href="#">Services</a>
            <a href="#">Support</a>
            <a href="#">Promotions</a>
            <a href="#">News</a>
            <a href="#">Company</a>
            <a href="#">Contact</a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <input
              className="hidden md:block w-72 rounded-full border px-4 py-2 text-sm"
              placeholder="Search by Product Name, Catalog No..."
            />
            <button className="rounded-full bg-blue-700 text-white px-4 py-2 text-sm font-semibold">
              <a
                href="/quote"
                className="rounded-full bg-blue-700 text-white px-4 py-2 text-sm font-semibold"
              >
                Request a Quote
              </a>
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-3xl bg-white border p-8 md:p-12">
          <h1 className="text-3xl md:text-5xl font-bold text-slate-900">
            Advanced Solutions for <br /> Life Science Research
          </h1>
          <p className="mt-4 text-slate-600">
            High-quality reagents and innovative tools for your lab needs
          </p>

          <div className="mt-6 flex flex-col md:flex-row gap-3">
            <input
              className="w-full md:w-96 rounded-full border px-4 py-3"
              placeholder="Try: qPCR enzyme, ab-1234..."
            />
            <button className="rounded-full bg-blue-700 text-white px-6 py-3 font-semibold">
              Search
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            ["Featured Products", "View Products"],
            ["Current Promotions", "See Offers"],
            ["Applications & Solutions", "Learn More"],
            ["Technical Support", "Get Help"],
          ].map(([title, cta]) => (
            <div key={title} className="rounded-2xl bg-white border p-5">
              <div className="font-semibold">{title}</div>
              <button className="mt-4 w-full rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold">
                {cta}
              </button>
            </div>
          ))}
        </div>

        {/* News + Resources */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white border p-5">
            <div className="font-semibold">Latest News & Updates</div>
            <ul className="mt-3 text-sm text-slate-600 space-y-2">
              <li>New Product Launch: XYZ Antibody</li>
              <li>Upcoming Webinar on qPCR Techniques</li>
            </ul>
            <button className="mt-4 rounded-xl bg-blue-700 text-white px-4 py-2 text-sm font-semibold">
              Read More
            </button>
          </div>

          <div className="rounded-2xl bg-white border p-5">
            <div className="font-semibold">Resources & Downloads</div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {["Datasheets", "Safety Docs", "Protocols", "Catalogs"].map((x) => (
                <div key={x} className="rounded-xl bg-slate-100 p-3 text-center font-semibold">
                  {x}
                </div>
              ))}
            </div>
            <button className="mt-4 rounded-xl bg-blue-700 text-white px-4 py-2 text-sm font-semibold">
              View Resources
            </button>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-6 rounded-2xl bg-blue-700 text-white p-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="font-semibold">
            Need Assistance? Contact Our Experts for Personalized Support
          </div>
          <button className="rounded-full bg-white/15 px-5 py-2 font-semibold">
            Contact Us
          </button>
        </div>
      </section>
    </main>
  );
  
}
