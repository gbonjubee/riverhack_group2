"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type {
  AudienceProfile,
  CampaignConcept,
  FinalBrief,
  StorylineOutput,
  ValidationResult,
} from "@/lib/types";

type Props = {
  concept: CampaignConcept;
  audience: AudienceProfile;
  storyline: ValidationResult;
  legal: ValidationResult;
  brief: FinalBrief;
  onRestart: () => void;
};

export function Storyline({
  concept,
  audience,
  storyline,
  legal,
  brief,
  onRestart,
}: Props) {
  const [out, setOut] = useState<StorylineOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    api
      .storyline(concept, audience, storyline, legal, brief)
      .then(setOut)
      .catch((e) => setError(String(e)));
  }, [concept, audience, storyline, legal, brief]);

  const download = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openScrollytelling = () => {
    if (!out) return;
    const blob = new Blob([out.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    // Note: URL is not revoked here because the new tab needs it. Browser
    // releases it on tab close.
  };

  if (error) {
    return <p className="text-rose font-serif italic">{error}</p>;
  }

  if (!out) {
    return (
      <div>
        <header className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.32em] text-gold">
            storyline
          </div>
          <h2 className="font-serif text-3xl lg:text-4xl mt-1 text-ink leading-tight">
            the strategist is <span className="italic">writing</span>…
          </h2>
        </header>
        <div className="breathe font-serif italic text-taupe-dark">
          building the argument from the brief and the audience.
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-5">
        <div className="text-[11px] uppercase tracking-[0.32em] text-gold">
          storyline
        </div>
        <h2 className="font-serif text-3xl lg:text-4xl mt-1 text-ink leading-tight">
          {out.title.toLowerCase()}.
        </h2>
        <p className="font-serif italic text-lg text-taupe-dark mt-2 max-w-2xl">
          {out.tension}
        </p>
      </header>

      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="max-w-3xl bg-bg-soft border border-taupe-line rounded-md p-6 lg:p-8 max-h-[58vh] overflow-y-auto"
      >
        <div className="text-[10px] uppercase tracking-[0.32em] text-gold mb-2">
          strategic memo — № {out.request_id.slice(-6)}
        </div>
        <StorylineMarkdown text={out.markdown} />

        <div className="hairline mt-6 -mx-6 lg:-mx-8" />

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={openScrollytelling} variant="primary" size="lg">
            view as scrollytelling
            <span aria-hidden>→</span>
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              download("storyline.md", out.markdown, "text/markdown")
            }
            size="lg"
          >
            download storyline.md
          </Button>
          <Button
            variant="ghost"
            onClick={() => download("storyline.html", out.html, "text/html")}
            size="lg"
          >
            download storyline.html
          </Button>
          <Button variant="quiet" onClick={onRestart} size="lg">
            ↺ start a new ritual
          </Button>
        </div>
      </motion.article>
    </div>
  );
}

// Slightly trimmed markdown renderer — same rules as the Brief renderer
// but ignores the front-matter italics/HR pattern.
function StorylineMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuffer: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushList = (key: number) => {
    if (!listBuffer) return;
    const Tag = listBuffer.type;
    out.push(
      <Tag
        key={`l-${key}`}
        className="font-serif text-lg text-ink-soft my-5 space-y-3"
      >
        {listBuffer.items.map((item, i) => (
          <li key={i} className="flex gap-3 leading-relaxed">
            {Tag === "ul" ? (
              <span className="text-gold mt-3 w-2 h-px bg-gold shrink-0" aria-hidden />
            ) : (
              <span className="text-gold font-serif italic mt-0.5">
                {i + 1}.
              </span>
            )}
            <span dangerouslySetInnerHTML={{ __html: inline(item) }} />
          </li>
        ))}
      </Tag>,
    );
    listBuffer = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (line.startsWith("# ")) {
      flushList(idx);
      out.push(
        <h1
          key={idx}
          className="font-serif text-5xl text-ink mt-2 mb-4 italic leading-tight"
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
    } else if (line.startsWith("- ")) {
      if (!listBuffer || listBuffer.type !== "ul")
        listBuffer = { type: "ul", items: [] };
      listBuffer.items.push(line.slice(2));
    } else if (/^\d+\.\s/.test(line)) {
      if (!listBuffer || listBuffer.type !== "ol")
        listBuffer = { type: "ol", items: [] };
      listBuffer.items.push(line.replace(/^\d+\.\s/, ""));
    } else if (line.startsWith("---")) {
      flushList(idx);
      out.push(<div key={idx} className="hairline my-8" />);
    } else if (line.startsWith("*") && line.endsWith("*") && line.length > 2) {
      flushList(idx);
      out.push(
        <p
          key={idx}
          className="font-serif italic text-xl text-taupe-dark my-6"
          dangerouslySetInnerHTML={{ __html: inline(line.slice(1, -1)) }}
        />,
      );
    } else if (line.length === 0) {
      flushList(idx);
    } else {
      flushList(idx);
      out.push(
        <p
          key={idx}
          className="font-serif text-lg text-ink-soft my-4 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: inline(line) }}
        />,
      );
    }
  });
  flushList(lines.length);
  return <>{out}</>;
}

function inline(s: string): string {
  const escaped = s.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );
  return escaped
    .replace(
      /\*\*([^*]+)\*\*/g,
      '<strong class="text-ink font-medium">$1</strong>',
    )
    .replace(/\*([^*]+)\*/g, '<em class="italic text-ink">$1</em>');
}
