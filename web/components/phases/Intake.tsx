"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { TextArea } from "@/components/ui/Field";
import type { CampaignConcept } from "@/lib/types";

// Two-step intake — designed for a senior marketer who wants speed and
// plain English, not a five-question interview.
//
// Step 1: the idea (free text, just say what you want to do)
// Step 2: the specifics (audience, where, how, when — all on one screen)
//
// Display labels are plain language; the underlying values are the real
// segment names so the audience query against the CSVs still works.

type Props = {
  onComplete: (concept: CampaignConcept) => void;
};

const STEPS = ["your idea", "your audience"] as const;

const SEGMENTS: { value: string; label: string; hint: string }[] = [
  { value: "Loyal", label: "Loyal regulars", hint: "buy from us regularly" },
  { value: "High-Value", label: "Top spenders", hint: "highest lifetime value" },
  { value: "At-Risk", label: "Lapsed buyers", hint: "used to buy, haven't lately" },
  { value: "New", label: "New arrivals", hint: "joined recently" },
  { value: "Occasional", label: "Occasional", hint: "buy now and then" },
];

const COUNTRIES = ["NL", "DE", "BE", "ES", "FR", "GB"];

const CHANNELS: { value: string; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push notification", label: "Push" },
  { value: "paid social", label: "Paid social" },
];

const TIMINGS = ["this week", "this month", "this quarter"];

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
    setCountries((cs) =>
      cs.includes(g) ? cs.filter((x) => x !== g) : [...cs, g],
    );

  const canAdvance = () => {
    switch (step) {
      case 0:
        return concept.goal.trim().length > 8;
      case 1:
        return (
          concept.audience_hint.length > 0 &&
          countries.length > 0 &&
          concept.channels.length > 0 &&
          concept.timing.length > 0
        );
      default:
        return false;
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else {
      onComplete({
        ...concept,
        constraints: `countries: ${countries.join(", ")}`,
      });
    }
  };

  return (
    <div>
      <header className="mb-5 flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.32em] text-gold">
            {STEPS[step]}
          </div>
          <h2 className="font-serif text-3xl lg:text-4xl mt-1 text-ink leading-tight">
            {step === 0 ? (
              <>
                What do you <span className="italic">want to do</span>?
              </>
            ) : (
              <>
                A few <span className="italic">specifics</span>.
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
                placeholder="A Black Friday SMS to re-engage our lapsed German customers…"
                value={concept.goal}
                onChange={(e) => update("goal", e.target.value)}
              />
              <p className="mt-3 text-sm text-taupe-dark">
                One or two sentences in your own words. Goal, audience, when —
                whatever you already know.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="max-w-3xl space-y-5">
              <Group label="Who do you want to reach?">
                <div className="flex flex-wrap gap-2">
                  {SEGMENTS.map((s) => (
                    <Chip
                      key={s.value}
                      label={s.label}
                      selected={concept.audience_hint === s.value}
                      onToggle={() => update("audience_hint", s.value)}
                    />
                  ))}
                </div>
              </Group>
              <Group label="Which countries?">
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
              <Group label="How will you reach them?">
                <div className="flex flex-wrap gap-2">
                  {CHANNELS.map((c) => (
                    <Chip
                      key={c.value}
                      label={c.label}
                      selected={concept.channels.includes(c.value)}
                      onToggle={() => toggleChannel(c.value)}
                    />
                  ))}
                </div>
              </Group>
              <Group label="When does it go out?">
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
              <p className="mt-2 text-xs text-taupe-dark">
                We&apos;ll handle consent flags, platform routing, and lawful
                basis for you — no need to fill those in.
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
          ← back
        </Button>
        <Button onClick={next} disabled={!canAdvance()} size="lg">
          {step === STEPS.length - 1 ? "find my audience" : "continue"}
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
      <div className="text-sm font-serif italic text-ink mb-2">{label}</div>
      {children}
    </div>
  );
}
