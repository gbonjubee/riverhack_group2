"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { TextArea, TextField } from "@/components/ui/Field";
import type { CampaignConcept } from "@/lib/types";

type Props = {
  onComplete: (concept: CampaignConcept) => void;
};

const STEPS = ["idea", "audience", "shape", "measure"] as const;

const AUDIENCES = [
  "existing customers",
  "lapsed customers",
  "new prospects",
  "lookalike audience",
];
const CHANNELS = [
  "email",
  "sms",
  "push notification",
  "paid social",
  "paid search",
  "on-site banner",
];
const TONES = [
  "warm & inviting",
  "urgent",
  "playful",
  "refined",
  "educational",
  "understated",
];
const TIMINGS = [
  "this week",
  "this month",
  "this quarter",
  "no rush",
];

const empty: CampaignConcept = {
  goal: "",
  audience_hint: "",
  channels: [],
  tone: "",
  timing: "",
  kpi: "",
  constraints: "",
};

export function Intake({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [concept, setConcept] = useState<CampaignConcept>(empty);

  const update = <K extends keyof CampaignConcept>(
    key: K,
    value: CampaignConcept[K],
  ) => setConcept((c) => ({ ...c, [key]: value }));

  const toggleChannel = (ch: string) => {
    setConcept((c) =>
      c.channels.includes(ch)
        ? { ...c, channels: c.channels.filter((x) => x !== ch) }
        : { ...c, channels: [...c.channels, ch] },
    );
  };

  const canAdvance = () => {
    switch (step) {
      case 0:
        return concept.goal.trim().length > 8;
      case 1:
        return concept.audience_hint.trim().length > 0;
      case 2:
        return (
          concept.channels.length > 0 &&
          concept.tone.length > 0 &&
          concept.timing.length > 0
        );
      case 3:
        return concept.kpi.trim().length > 0;
      default:
        return false;
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onComplete(concept);
  };

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.32em] text-gold">
            intake — {STEPS[step]}
          </div>
          <h2 className="font-serif text-3xl lg:text-4xl mt-1 text-ink leading-tight">
            {step === 0 && (
              <>
                tell us, <span className="italic">unhurried</span>,
                <br />
                what we&apos;re making.
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
            {step === 3 && (
              <>
                how will we <span className="italic">know</span>?
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
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {step === 0 && (
            <div className="max-w-2xl">
              <TextArea
                rows={4}
                placeholder="A spring promotion for our most-loved candle line, leaning into renewal and the changing light…"
                value={concept.goal}
                onChange={(e) => update("goal", e.target.value)}
              />
              <p className="mt-6 font-serif italic text-taupe-dark">
                One or two sentences. The idea, the moment, the reason.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="max-w-2xl">
              <div className="flex flex-wrap gap-3 mb-8">
                {AUDIENCES.map((a) => (
                  <Chip
                    key={a}
                    label={a}
                    selected={concept.audience_hint === a}
                    onToggle={() => update("audience_hint", a)}
                  />
                ))}
              </div>
              <TextField
                placeholder="or describe in your own words…"
                value={
                  AUDIENCES.includes(concept.audience_hint)
                    ? ""
                    : concept.audience_hint
                }
                onChange={(e) => update("audience_hint", e.target.value)}
              />
            </div>
          )}

          {step === 2 && (
            <div className="max-w-3xl space-y-6">
              <Group label="channels">
                <div className="flex flex-wrap gap-3">
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
              <Group label="tone">
                <div className="flex flex-wrap gap-3">
                  {TONES.map((t) => (
                    <Chip
                      key={t}
                      label={t}
                      selected={concept.tone === t}
                      onToggle={() => update("tone", t)}
                    />
                  ))}
                </div>
              </Group>
              <Group label="timing">
                <div className="flex flex-wrap gap-3">
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
            </div>
          )}

          {step === 3 && (
            <div className="max-w-2xl space-y-6">
              <TextArea
                label="success looks like…"
                rows={3}
                placeholder="A measurable lift in repeat purchases over the next six weeks, with quiet word-of-mouth at scale."
                value={concept.kpi}
                onChange={(e) => update("kpi", e.target.value)}
              />
              <TextArea
                label="anything off-limits (optional)"
                rows={3}
                placeholder="No discount language. Don't target customers who unsubscribed in the last 30 days."
                value={concept.constraints}
                onChange={(e) => update("constraints", e.target.value)}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-10 flex items-center justify-between">
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
      <div className="text-[11px] uppercase tracking-[0.24em] text-taupe-dark mb-3">
        {label}
      </div>
      {children}
    </div>
  );
}
