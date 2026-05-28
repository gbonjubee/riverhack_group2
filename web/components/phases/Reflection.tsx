"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type {
  AudienceProfile,
  CampaignConcept,
  Envelope,
  ValidationResult,
} from "@/lib/types";

type Props = {
  concept: CampaignConcept;
  audience: AudienceProfile;
  onComplete: (storyline: ValidationResult, legal: ValidationResult) => void;
};

export function Reflection({ concept, audience, onComplete }: Props) {
  const [storyline, setStoryline] = useState<ValidationResult | null>(null);
  const [legal, setLegal] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    Promise.all([
      api.storylineValidate(concept, audience).then(setStoryline),
      api.legalValidate(concept, audience).then(setLegal),
    ]).catch((e) => setError(String(e)));
  }, [concept, audience]);

  const ready = storyline && legal;

  return (
    <div>
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.32em] text-gold">
          reflection
        </div>
        <h2 className="font-serif text-3xl lg:text-4xl mt-1 text-ink leading-tight">
          we read it <span className="italic">back to ourselves</span>.
        </h2>
      </header>

      {error && (
        <p className="text-rose font-serif italic">{error}</p>
      )}

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl">
        <ValidatorTile
          title="storyline"
          subtitle="does the idea, audience, and shape hold together?"
          result={storyline}
        />
        <ValidatorTile
          title="legal"
          subtitle="lawful basis, consent, and pre-send hygiene"
          result={legal}
        />
      </div>

      {ready && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mt-6 flex items-center justify-end"
        >
          <Button onClick={() => onComplete(storyline!, legal!)} size="lg">
            compose the brief <span aria-hidden>→</span>
          </Button>
        </motion.div>
      )}
    </div>
  );
}

function ValidatorTile({
  title,
  subtitle,
  result,
}: {
  title: string;
  subtitle: string;
  result: ValidationResult | null;
}) {
  if (!result) {
    return (
      <article className="border border-taupe-line bg-bg-soft rounded-md p-5 lg:p-6 min-h-[14rem]">
        <div className="text-[10px] uppercase tracking-[0.32em] text-gold">
          {title}
        </div>
        <div className="font-serif italic text-base text-taupe-dark mt-2">
          {subtitle}
        </div>
        <div className="mt-10 flex items-center gap-3 breathe">
          <span className="block w-2 h-2 rounded-full bg-gold" aria-hidden />
          <span className="text-sm text-ink-soft">listening…</span>
        </div>
      </article>
    );
  }
  const env: Envelope = result.envelope;
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55 }}
      className="border border-taupe-line bg-bg-soft rounded-md p-5 lg:p-6 min-h-[14rem]"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-gold">
            {title}
          </div>
          <div className="font-serif italic text-base text-taupe-dark mt-1">
            {subtitle}
          </div>
        </div>
        <VerdictPill verdict={env.verdict} />
      </div>

      <p className="mt-6 font-serif italic text-lg text-ink-soft">
        “{env.rationale}”
      </p>

      <ul className="mt-6 space-y-3">
        {env.findings.map((f, i) => (
          <li key={i} className="flex gap-3">
            <SeverityMark sev={f.severity} />
            <div>
              <div className="text-sm text-ink">{f.claim}</div>
              <div className="text-xs text-taupe-dark mt-0.5 italic font-serif">
                {f.evidence}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 pt-4 border-t border-taupe-line text-[10px] uppercase tracking-[0.28em] text-taupe-dark flex items-center justify-between">
        <span>source: {env.source}</span>
        <span>{env.inputs_hash}</span>
      </div>
    </motion.article>
  );
}

function VerdictPill({ verdict }: { verdict: "OK" | "WARN" | "BLOCK" }) {
  const color =
    verdict === "OK"
      ? "border-sage text-sage"
      : verdict === "WARN"
        ? "border-gold text-gold"
        : "border-rose text-rose";
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.28em] border rounded-full px-3 h-7 inline-flex items-center ${color}`}
    >
      {verdict.toLowerCase()}
    </span>
  );
}

function SeverityMark({ sev }: { sev: "info" | "warn" | "block" }) {
  const color =
    sev === "info"
      ? "bg-taupe-dark"
      : sev === "warn"
        ? "bg-gold"
        : "bg-rose";
  return (
    <span
      className={`block w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${color}`}
      aria-hidden
    />
  );
}
