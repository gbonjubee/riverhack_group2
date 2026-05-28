"use client";

import { PHASES, type PhaseKey } from "@/lib/brand";

type Props = {
  current: PhaseKey;
};

export function RitualRail({ current }: Props) {
  const currentIndex = PHASES.findIndex((p) => p.key === current);

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 py-8 pr-8 border-l border-taupe-line/60 pl-8 sticky top-16 self-start">
      <div className="text-[10px] uppercase tracking-[0.32em] text-taupe-dark mb-6">
        the ritual
      </div>
      <ol className="flex flex-col gap-4">
        {PHASES.map((p, i) => {
          const isCurrent = i === currentIndex;
          const isPast = i < currentIndex;
          return (
            <li key={p.key} className="relative">
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center pt-1.5">
                  <span
                    className={`block w-2 h-2 rounded-full transition-all duration-500 ${
                      isCurrent
                        ? "bg-gold glow"
                        : isPast
                          ? "bg-ink"
                          : "bg-taupe-line"
                    }`}
                    aria-hidden
                  />
                  {i < PHASES.length - 1 && (
                    <span
                      className={`block w-px h-6 mt-1.5 transition-colors duration-500 ${
                        isPast ? "bg-ink/30" : "bg-taupe-line"
                      }`}
                      aria-hidden
                    />
                  )}
                </div>
                <div>
                  <div
                    className={`text-sm transition-colors duration-500 ${
                      isCurrent
                        ? "text-ink font-medium"
                        : isPast
                          ? "text-taupe-dark"
                          : "text-taupe"
                    }`}
                  >
                    {p.label}
                  </div>
                  <div className="text-xs font-serif italic text-taupe-dark mt-0.5">
                    {p.subtitle}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
