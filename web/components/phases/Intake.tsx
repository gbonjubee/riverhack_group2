"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { TextArea } from "@/components/ui/Field";
import type { CampaignConcept } from "@/lib/types";

// Lean three-step intake — matches the brief-intake skill's
// "assume-then-confirm, batched, max 4 questions" philosophy.
// Required slots (per brief-intake): audience, channel, geo, timing,
// campaign_purpose. The free-text idea covers goal + purpose implicitly;
// tone is defaulted, KPI/constraints are optional.

type Props = {
  onComplete: (concept: CampaignConcept) => void;
};

const STEPS = ["the idea", "the audience", "the shape"] as const;

const SEGMENTS = ["At-Risk", "Loyal", "High-Value", "New", "Occasional"];
const COUNTRIES = ["NL", "DE", "BE", "ES", "FR", "GB"];
const CHANNELS = [
  "email",
  "sms",
  "push notification",
  "paid social",
  "paid search",
];
const TIMINGS = ["this week", "this month", "this quarter", "no rush"];

const empty: CampaignConcept = {
  goal: "",
  audience_hint: "",
  channels: [],
  tone: "considered",
  timing: "",
  kpi: "",
  constraints: "",
};

export function Intake({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [concept, setConcept] = useState<CampaignConcept>(empty);
  const [countries, setCountries] = useState<string[]>([]);

  const update = <K extends keyof CampaignConcept>(
    key: K,
    value: CampaignConcept[K],
  ) => setConcept((c) => ({ ...c, [key]: value }));

  const toggleChannel = (ch: string) =>
    setConcept((c) =>
      c.channels.includes(ch)
        ? { ...c, channels: c.channels.filter((x) => x !== ch) }
        : { ...c, channels: [...c.channels, ch] },
    );

  const toggleCountry = (g: string) =>
    setCountries((cs) => (cs.includes(g) ? cs.filter((x) => x !== g) : [...cs, g]));

  const canAdvance = () => {
    switch (step) {
      case 0:
        return concept.goal.trim().length > 8;
      case 1:
        return concept.audience_hint.length > 0 && countries.length > 0;
      case 2:
        return concept.channels.length > 0 && concept.timing.length > 0;
      default:
        return false;
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else {
      // Bake countries into the constraints field so they reach the brief.
      onComplete({ ...concept, constraints: `countries: ${countries.join(", ")}` });
    }
  };

  return (
    <div>
      <header className="mb-5 flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.32em] text-gold">
            intake — {STEPS[step]}
          </div>
          <h2 className="font-serif text-3xl lg:text-4xl mt-1 text-ink leading-tight">
            {step === 0 && (
              <>
                tell us, <span className="italic">unhurried</span>, what we&apos;re making.
              </>
            )}
            {step === 1 && (
              <>
                who is this <span className="italic">really</span> for?
              </>
            )}
            {step === 2 && (
              <>
                the shape <span className="italic">of it</span>.
              </>
            )}
          </h2>
        </div>
        <div className="text-[11px] uppercase tracking-[0.28em] text-taupe-dark hidden md:block">
          {step + 1} of {STEPS.length}
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {step === 0 && (
            <div className="max-w-2xl">
              <TextArea
                rows={4}
                placeholder="A Black Friday push to re-engage lapsed luxury customers in Germany via SMS…"
                value={concept.goal}
                onChange={(e) => update("goal", e.target.value)}
              />
              <p className="mt-4 font-serif italic text-taupe-dark text-sm">
                One or two sentences. The idea, the moment, the reason.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="max-w-3xl space-y-5">
              <Group label="segment">
                <div className="flex flex-wrap gap-2">
                  {SEGMENTS.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      selected={concept.audience_hint === s}
                      onToggle={() => update("audience_hint", s)}
                    />
                  ))}
                </div>
              </Group>
              <Group label="countries">
                <div className="flex flex-wrap gap-2">
                  {COUNTRIES.map((c) => (
                    <Chip
                      key={c}
                      label={c}
                      selected={countries.includes(c)}
                      onToggle={() => toggleCountry(c)}
                    />
                  ))}
                </div>
              </Group>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-3xl space-y-5">
              <Group label="channel">
                <div className="flex flex-wrap gap-2">
                  {CHANNELS.map((c) => (
                    <Chip
                      key={c}
                      label={c}
                      selected={concept.channels.includes(c)}
                      onToggle={() => toggleChannel(c)}
                    />
                  ))}
                </div>
              </Group>
              <Group label="timing">
                <div className="flex flex-wrap gap-2">
                  {TIMINGS.map((t) => (
                    <Chip
                      key={t}
                      label={t}
                      selected={concept.timing === t}
                      onToggle={() => update("timing", t)}
                    />
                  ))}
                </div>
              </Group>
              <p className="mt-2 font-serif italic text-taupe-dark text-sm">
                Consent flags, destination platforms, and lawful basis are derived deterministically — we don&apos;t ask twice.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="quiet"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          ← previous
        </Button>
        <Button onClick={next} disabled={!canAdvance()} size="lg">
          {step === STEPS.length - 1 ? "begin the discovery" : "continue"}
          <span aria-hidden>→</span>
        </Button>
      </div>
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.24em] text-taupe-dark mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}
