import Link from "next/link";
import { Logo } from "@/components/Logo";
import { TAGLINE } from "@/lib/brand";

export default function Home() {
  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <header className="px-8 lg:px-16 pt-6 pb-2 flex items-center justify-between shrink-0">
        <Logo />
        <nav className="hidden md:flex items-center gap-10 text-[11px] uppercase tracking-[0.28em] text-taupe-dark">
          <span className="hover:text-ink cursor-default">the ritual</span>
          <span className="hover:text-ink cursor-default">about</span>
          <span className="hover:text-ink cursor-default">notes</span>
        </nav>
      </header>

      <section className="flex-1 grid lg:grid-cols-[1.2fr_1fr] gap-10 px-8 lg:px-16 py-6 items-center min-h-0">
        <div className="max-w-2xl">
          <span className="block text-[11px] uppercase tracking-[0.32em] text-gold mb-4">
            for marketing teams who prefer to think before they send
          </span>
          <h1 className="font-serif text-[clamp(2.5rem,5.5vw,5rem)] leading-[0.95] text-ink">
            a quieter way <span className="italic">to start a</span> campaign.
          </h1>
          <p className="mt-5 font-serif italic text-xl text-taupe-dark max-w-lg leading-snug">
            {TAGLINE}.
          </p>
          <p className="mt-4 text-sm text-ink-soft max-w-md leading-relaxed">
            Tell us the idea. We&apos;ll find the audience, read the storyline
            back to you, check the legal corners, and hand you a brief
            you&apos;d be willing to sign.
          </p>

          <div className="mt-8 flex items-center gap-5">
            <Link
              href="/ritual"
              className="inline-flex items-center justify-center gap-3 h-12 px-8 rounded-full bg-ink text-bg-soft text-[11px] uppercase tracking-[0.28em] hover:bg-ink-soft transition-all duration-300 hover:shadow-[0_12px_32px_-16px_rgba(26,20,16,0.5)]"
            >
              begin the ritual
              <span aria-hidden>→</span>
            </Link>
            <span className="font-serif italic text-sm text-taupe-dark">
              takes about four minutes
            </span>
          </div>
        </div>

        <div className="hidden lg:block relative h-full max-h-[440px]">
          <div className="h-full bg-bg-warm/60 rounded-sm relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full border border-gold/40" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-52 h-52 rounded-full border border-taupe-line" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[18rem] h-[18rem] rounded-full border border-taupe-line/50" />
            </div>
            <div className="absolute bottom-5 left-5 right-5 text-[10px] uppercase tracking-[0.32em] text-taupe-dark">
              edition № 001 — spring
            </div>
            <div className="absolute top-5 left-5 font-serif italic text-xs text-taupe-dark">
              a study in marketing as a slow craft
            </div>
          </div>
        </div>
      </section>

      <footer className="px-8 lg:px-16 py-3 border-t border-taupe-line/60 flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-taupe-dark shrink-0">
        <span>localhost — for the riverhack demo</span>
        <span>without the rush</span>
      </footer>
    </main>
  );
}
