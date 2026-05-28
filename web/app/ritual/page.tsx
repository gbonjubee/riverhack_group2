"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { RitualRail } from "@/components/RitualRail";
import { Brief } from "@/components/phases/Brief";
import { Discovery } from "@/components/phases/Discovery";
import { Intake } from "@/components/phases/Intake";
import { Reflection } from "@/components/phases/Reflection";
import { Storyline } from "@/components/phases/Storyline";
import type { PhaseKey } from "@/lib/brand";
import type {
  AudienceProfile,
  CampaignConcept,
  FinalBrief,
  ValidationResult,
} from "@/lib/types";

export default function RitualPage() {
  const [phase, setPhase] = useState<PhaseKey>("intake");
  const [concept, setConcept] = useState<CampaignConcept | null>(null);
  const [audience, setAudience] = useState<AudienceProfile | null>(null);
  const [storyline, setStoryline] = useState<ValidationResult | null>(null);
  const [legal, setLegal] = useState<ValidationResult | null>(null);
  const [brief, setBrief] = useState<FinalBrief | null>(null);

  const restart = () => {
    setConcept(null);
    setAudience(null);
    setStoryline(null);
    setLegal(null);
    setBrief(null);
    setPhase("intake");
  };

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-8 lg:px-16 pt-5 pb-4 flex items-center justify-between border-b border-taupe-line/60 shrink-0">
        <Link href="/" className="hover:opacity-70 transition-opacity">
          <Logo />
        </Link>
        <nav className="flex items-center gap-8 text-[11px] uppercase tracking-[0.28em] text-taupe-dark">
          <Link href="/" className="hover:text-ink">
            ← back
          </Link>
        </nav>
      </header>

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <section className="flex-1 px-8 lg:px-12 py-8 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {phase === "intake" && (
                <Intake
                  onComplete={(c) => {
                    setConcept(c);
                    setPhase("discovery");
                  }}
                />
              )}

              {phase === "discovery" && concept && (
                <Discovery
                  concept={concept}
                  onComplete={(a) => {
                    setAudience(a);
                    setPhase("reflection");
                  }}
                />
              )}

              {phase === "reflection" && concept && audience && (
                <Reflection
                  concept={concept}
                  audience={audience}
                  onComplete={(s, l) => {
                    setStoryline(s);
                    setLegal(l);
                    setPhase("brief");
                  }}
                />
              )}

              {phase === "brief" &&
                concept &&
                audience &&
                storyline &&
                legal && (
                  <Brief
                    concept={concept}
                    audience={audience}
                    storyline={storyline}
                    legal={legal}
                    onRestart={restart}
                    onCompose={(b) => {
                      setBrief(b);
                      setPhase("storyline");
                    }}
                  />
                )}

              {phase === "storyline" &&
                concept &&
                audience &&
                storyline &&
                legal &&
                brief && (
                  <Storyline
                    concept={concept}
                    audience={audience}
                    storyline={storyline}
                    legal={legal}
                    brief={brief}
                    onRestart={restart}
                  />
                )}
            </motion.div>
          </AnimatePresence>
        </section>

        <RitualRail current={phase} />
      </div>
    </main>
  );
}
