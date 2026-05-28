import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AGENT_NAME, TAGLINE } from "@/lib/brand";

// Hero product imagery — apothecary / candle / body-care aesthetic that
// matches the Rituals brand world. Swap these URLs for real product
// photography before the public demo.
const HERO_TILES: { src: string; alt: string; caption: string }[] = [
  {
    src: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&q=80&auto=format&fit=crop",
    alt: "Amber apothecary bottles",
    caption: "the candles",
  },
  {
    src: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&q=80&auto=format&fit=crop",
    alt: "Lit candle on a wooden surface",
    caption: "the home scents",
  },
  {
    src: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80&auto=format&fit=crop",
    alt: "Beauty and body care products",
    caption: "the body care",
  },
];

export default function Home() {
  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <header className="px-8 lg:px-16 pt-6 pb-2 flex items-center justify-between shrink-0">
        <Logo />
        <nav className="hidden md:flex items-center gap-10 text-[11px] uppercase tracking-[0.28em] text-taupe-dark">
          <span className="hover:text-ink cursor-default">how it works</span>
          <span className="hover:text-ink cursor-default">briefs</span>
          <span className="hover:text-ink cursor-default">help</span>
        </nav>
      </header>

      <section className="flex-1 grid lg:grid-cols-[1.2fr_1fr] gap-10 px-8 lg:px-16 py-4 items-center min-h-0">
        <div className="max-w-2xl">
          <span className="block text-[11px] uppercase tracking-[0.32em] text-gold mb-4">
            internal tool · for marketing
          </span>
          <h1 className="font-serif text-[clamp(2.5rem,5.5vw,5rem)] leading-[0.95] text-ink">
            {AGENT_NAME}.
            <br />
            <span className="italic text-taupe-dark">{TAGLINE}.</span>
          </h1>
          <p className="mt-5 text-base text-ink-soft max-w-lg leading-relaxed">
            Type the idea. <span className="font-serif italic">Smelling Pretty</span> finds the right customers,
            checks the rules, and gives you back a brief and a story you can
            send to your team. Five minutes, not five days.
          </p>

          <div className="mt-7 flex items-center gap-5">
            <Link
              href="/ritual"
              className="inline-flex items-center justify-center gap-3 h-12 px-8 rounded-full bg-ink text-bg-soft text-[11px] uppercase tracking-[0.28em] hover:bg-ink-soft transition-all duration-300 hover:shadow-[0_12px_32px_-16px_rgba(26,20,16,0.5)]"
            >
              start a brief
              <span aria-hidden>→</span>
            </Link>
            <span className="font-serif italic text-sm text-taupe-dark">
              three quick steps
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-6 text-[11px] uppercase tracking-[0.28em] text-taupe-dark">
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-gold rounded-full" aria-hidden />
              real customer data
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-gold rounded-full" aria-hidden />
              consent &amp; legal checked
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-gold rounded-full" aria-hidden />
              ready to share
            </span>
          </div>
        </div>

        <div className="hidden lg:grid grid-cols-3 gap-3 h-full max-h-[460px]">
          {HERO_TILES.map((t, i) => (
            <figure
              key={t.src}
              className={`relative overflow-hidden rounded-sm bg-bg-warm/60 ${
                i === 1 ? "mt-8" : i === 2 ? "mt-4" : ""
              }`}
            >
              {/* Plain img bypasses next/image's remote-pattern config — fine
                  for hackathon scope. Swap to Rituals' own CDN before launch. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.src}
                alt={t.alt}
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-ink/60 to-transparent">
                <figcaption className="text-[10px] uppercase tracking-[0.28em] text-bg-soft">
                  {t.caption}
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </section>

      <footer className="px-8 lg:px-16 py-3 border-t border-taupe-line/60 flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-taupe-dark shrink-0">
        <span>localhost — RiverHack demo</span>
        <span>without the rush</span>
      </footer>
    </main>
  );
}
