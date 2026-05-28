"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type { AudienceProfile, CampaignConcept, Envelope } from "@/lib/types";

type Props = {
  concept: CampaignConcept;
  onComplete: (audience: AudienceProfile) => void;
};

export function Discovery({ concept, onComplete }: Props) {
  const [audience, setAudience] = useState<AudienceProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    api
      .audienceResearch(concept)
      .then(setAudience)
      .catch((e) => setError(String(e)));
  }, [concept]);

  return (
    <div>
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.32em] text-gold">
          discovery
        </div>
        <h2 className="font-serif text-3xl lg:text-4xl mt-1 text-ink leading-tight">
          studying the <span className="italic">dataset</span>.
        </h2>
      </header>

      {!audience && !error && (
        <div className="max-w-xl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <Step text="opening the customer activation file" done />
            <Step text="reading consent flags & channel preferences" />
            <Step text="matching segment definition to attributes" pending />
          </motion.div>
          <p className="mt-12 font-serif italic text-taupe-dark breathe">
            a moment, while we look.
          </p>
        </div>
      )}

      {error && (
        <div className="max-w-xl">
          <p className="text-rose font-serif italic">{error}</p>
          <p className="text-taupe-dark mt-4 text-sm">
            (the orchestrator will return a fallback profile next refresh)
          </p>
        </div>
      )}

      {audience && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <AudienceCard audience={audience} />
          <div className="mt-6 flex items-center justify-end">
            <Button onClick={() => onComplete(audience)} size="lg">
              read it back to me <span aria-hidden>→</span>
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Step({
  text,
  done,
  pending,
}: {
  text: string;
  done?: boolean;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <span
        className={`block w-2 h-2 rounded-full ${
          done ? "bg-ink" : pending ? "bg-taupe-line breathe" : "bg-gold glow"
        }`}
        aria-hidden
      />
      <span
        className={`text-sm ${done ? "text-taupe-dark" : pending ? "text-taupe" : "text-ink"}`}
      >
        {text}
      </span>
    </div>
  );
}

function AudienceCard({ audience }: { audience: AudienceProfile }) {
  const env: Envelope = audience.envelope;
  return (
    <article className="border border-taupe-line bg-bg-soft rounded-md p-6 lg:p-8">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-gold">
            segment
          </div>
          <h3 className="font-serif text-3xl mt-1 italic">
            {audience.segment_name}
          </h3>
        </div>
        <ConfidencePill confidence={audience.confidence} />
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-taupe-dark mb-3">
            size estimate
          </div>
          <div className="font-serif text-4xl text-ink">
            {audience.size_estimate.toLocaleString()}
          </div>
          <div className="text-xs text-taupe-dark mt-1">contacts</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-taupe-dark mb-3">
            key attributes
          </div>
          <ul className="space-y-2 font-serif text-base text-ink-soft">
            {audience.key_attributes.map((a) => (
              <li key={a} className="flex gap-3">
                <span className="text-gold mt-2 w-2 h-px bg-gold" aria-hidden />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {audience.dataset_gaps.length > 0 && (
        <div className="mt-6 pt-5 border-t border-taupe-line">
          <div className="text-[10px] uppercase tracking-[0.32em] text-taupe-dark mb-3">
            gaps in the data
          </div>
          <ul className="space-y-2 text-sm text-ink-soft italic font-serif">
            {audience.dataset_gaps.map((g) => (
              <li key={g}>— {g}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-taupe-line text-[10px] uppercase tracking-[0.28em] text-taupe-dark flex items-center justify-between">
        <span>source: {env.source}</span>
        <span>inputs: {env.inputs_hash}</span>
      </div>
    </article>
  );
}

function ConfidencePill({ confidence }: { confidence: "LOW" | "MEDIUM" | "HIGH" }) {
  const color =
    confidence === "HIGH"
      ? "border-sage text-sage"
      : confidence === "MEDIUM"
        ? "border-gold text-gold"
        : "border-rose text-rose";
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.28em] border rounded-full px-3 h-7 inline-flex items-center ${color}`}
    >
      confidence — {confidence.toLowerCase()}
    </span>
  );
}
