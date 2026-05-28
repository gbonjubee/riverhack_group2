"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type {
  AudienceProfile,
  CampaignConcept,
  FinalBrief,
  ValidationResult,
} from "@/lib/types";

type Props = {
  concept: CampaignConcept;
  audience: AudienceProfile;
  storyline: ValidationResult;
  legal: ValidationResult;
  onRestart: () => void;
  onCompose: (brief: FinalBrief) => void;
};

export function Brief({
  concept,
  audience,
  storyline,
  legal,
  onRestart,
  onCompose,
}: Props) {
  const [brief, setBrief] = useState<FinalBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    api
      .compose(concept, audience, storyline, legal)
      .then(setBrief)
      .catch((e) => setError(String(e)));
  }, [concept, audience, storyline, legal]);

  const download = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return <p className="text-rose font-serif italic">{error}</p>;
  }

  if (!brief) {
    return (
      <div>
        <header className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.32em] text-gold">
            the brief
          </div>
          <h2 className="font-serif text-3xl lg:text-4xl mt-1 text-ink leading-tight">
            <span className="italic">composing</span>…
          </h2>
        </header>
        <div className="breathe font-serif italic text-taupe-dark">
          the orchestrator is gathering the four envelopes.
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.32em] text-gold">
            the brief
          </div>
          <h2 className="font-serif text-3xl lg:text-4xl mt-1 text-ink leading-tight">
            ready when <span className="italic">you are</span>.
          </h2>
        </div>
        <StatusPill status={brief.status} />
      </header>

      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="max-w-3xl bg-bg-soft border border-taupe-line rounded-md p-6 lg:p-8 max-h-[58vh] overflow-y-auto"
      >
        <div className="text-[10px] uppercase tracking-[0.32em] text-gold mb-2">
          activation brief — № {brief.request_id.slice(-6)}
        </div>
        <Markdown text={brief.markdown} />

        <div className="hairline mt-6 -mx-6 lg:-mx-8" />

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={() => onCompose(brief)}
            size="lg"
          >
            compose the storyline <span aria-hidden>→</span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => download("brief.md", brief.markdown, "text/markdown")}
            size="lg"
          >
            download brief.md
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              download(
                "audit.json",
                JSON.stringify(brief.audit, null, 2),
                "application/json",
              )
            }
            size="lg"
          >
            download audit.json
          </Button>
          <Button variant="quiet" onClick={onRestart} size="lg">
            ↺ start a new ritual
          </Button>
        </div>
      </motion.article>
    </div>
  );
}

function StatusPill({ status }: { status: FinalBrief["status"] }) {
  const color =
    status === "OK"
      ? "border-sage text-sage"
      : status === "BLOCKED"
        ? "border-rose text-rose"
        : "border-gold text-gold";
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.28em] border rounded-full px-3 h-7 inline-flex items-center ${color}`}
    >
      status — {status.toLowerCase()}
    </span>
  );
}

// Tiny markdown renderer — we only need headings, paragraphs, bold, lists,
// and horizontal rules for the brief format. Keeps deps minimal.
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: number) => {
    if (listBuffer.length === 0) return;
    out.push(
      <ul
        key={`l-${key}`}
        className="font-serif text-base text-ink-soft my-4 space-y-2"
      >
        {listBuffer.map((item, i) => (
          <li key={i} className="flex gap-3">
            <span className="text-gold mt-2.5 w-2 h-px bg-gold" aria-hidden />
            <span dangerouslySetInnerHTML={{ __html: bold(item) }} />
          </li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (line.startsWith("# ")) {
      flushList(idx);
      out.push(
        <h1
          key={idx}
          className="font-serif text-4xl text-ink mt-2 mb-6 italic"
        >
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      flushList(idx);
      out.push(
        <h2
          key={idx}
          className="font-serif text-2xl text-ink mt-10 mb-3 italic"
        >
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      flushList(idx);
      out.push(
        <h3
          key={idx}
          className="text-[11px] uppercase tracking-[0.28em] text-taupe-dark mt-6 mb-2"
        >
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith("- ")) {
      listBuffer.push(line.slice(2));
    } else if (line.startsWith("---")) {
      flushList(idx);
      out.push(<div key={idx} className="hairline my-8" />);
    } else if (line.startsWith("*") && line.endsWith("*") && line.length > 2) {
      flushList(idx);
      out.push(
        <p
          key={idx}
          className="text-xs text-taupe-dark italic font-serif my-4"
        >
          {line.slice(1, -1)}
        </p>,
      );
    } else if (line.length === 0) {
      flushList(idx);
    } else {
      flushList(idx);
      out.push(
        <p
          key={idx}
          className="font-serif text-lg text-ink-soft my-3 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: bold(line) }}
        />,
      );
    }
  });
  flushList(lines.length);
  return <>{out}</>;
}

function bold(s: string): string {
  // Minimal: **bold** → <strong>bold</strong>; escape angle brackets.
  const escaped = s.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );
  return escaped.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="text-ink font-medium">$1</strong>',
  );
}
