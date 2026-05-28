import { callAgent, DEFAULT_MODELS } from "./anthropic";
import type {
  AudienceProfile,
  CampaignConcept,
  FinalBrief,
  StorylineOutput,
  ValidationResult,
} from "./types";

// Pure-template senior-marketing storyline generator.
// Voice: plain, confident, lightly Dutch — direct, evidence-led, no fluff.
// Produces (markdown, html) from the deterministic upstream artifacts.

const sha = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return "sim_" + (h >>> 0).toString(16).padStart(8, "0");
};

function titleFor(concept: CampaignConcept): string {
  // Extract a short, punchy title by stopping at the first natural
  // grammatical break — "to", "for", "targeting", "with", or punctuation.
  // Falls back to first 5 words if no break is found.
  const g = concept.goal.replace(/\s+/g, " ").trim();
  const breakRe = /\s+(?:to|for|targeting|aimed at|with|in)\s+|[,.;:]/i;
  const m = g.match(breakRe);
  let candidate: string;
  if (m && m.index !== undefined && m.index > 8) {
    candidate = g.slice(0, m.index).trim();
  } else {
    candidate = g.split(/\s+/).slice(0, 5).join(" ");
  }
  // Cap at 36 chars so the hero doesn't wrap awkwardly.
  if (candidate.length > 36) {
    candidate = candidate.slice(0, 34).replace(/\s+\S*$/, "") + "…";
  }
  return candidate.charAt(0).toUpperCase() + candidate.slice(1);
}

function extractSegmentLabel(audience: AudienceProfile): string {
  // Pull the friendly label out of the audience envelope. Tries the new
  // ("Reading X as lapsed buyers") shape first, falls back to the older
  // ("CRM segment 'Y'") shape if the route still emits it.
  for (const f of audience.envelope.findings) {
    let m = f.claim.match(/as ([\w\s-]+?) in your customer file/i);
    if (m) return m[1].trim();
    m = f.claim.match(/segment "([^"]+)"/);
    if (m) return m[1].toLowerCase();
  }
  return "these customers";
}

function tensionFor(_concept: CampaignConcept, audience: AudienceProfile): string {
  const segLabel = extractSegmentLabel(audience);
  return `Your ${segLabel} haven't heard from you at the right moment — and the moment is now.`;
}

function moment(concept: CampaignConcept): string {
  const t = (concept.timing || "").toLowerCase();
  if (t.includes("week")) return "The window is tight — this week.";
  if (t.includes("month")) return "We have a month. Enough room to do this well.";
  if (t.includes("quarter")) return "A full quarter to land it properly.";
  return "Timing is open, but sooner is better than later.";
}

function bullets(items: string[]): string {
  return items.map((s) => `- ${s}`).join("\n");
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Bold the first phrase up to the first period or em-dash — used for the
// bullet leads in the argument/story-beats sections (e.g. "The arrival."
// becomes "<strong>The arrival.</strong>"). Receives already-HTML-escaped
// text so we can wrap with <strong> safely.
function boldFirstPhrase(escaped: string): string {
  // No 's' flag — the bullet text is single-line; `.` matches everything
  // we need without dotall semantics.
  const m = escaped.match(/^([^\n]+?[.—])\s+([^\n]+)$/);
  if (!m) return escaped;
  return `<strong>${m[1]}</strong> ${m[2]}`;
}

function htmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );
}

export function generateStoryline(
  concept: CampaignConcept,
  audience: AudienceProfile,
  storyline: ValidationResult,
  legal: ValidationResult,
  brief: FinalBrief,
): StorylineOutput {
  const title = titleFor(concept);
  const tension = tensionFor(concept, audience);
  const request_id = brief.request_id;
  const primary = concept.channels[0] || "email";
  const segLabel = extractSegmentLabel(audience);
  const primaryNice = primary === "sms" ? "SMS" : primary.charAt(0).toUpperCase() + primary.slice(1);

  // ---- Markdown ----------------------------------------------------------
  const md = `# ${title}

*${tension}*

---

## Who we're reaching

${audience.size_estimate.toLocaleString()} of your **${segLabel}**. They opted in. Their accounts are active. The numbers are real:

${bullets(audience.key_attributes)}

What's *not* yet there: ${audience.dataset_gaps.map((g) => g.replace(/—/g, "-")).join(". ")}. Worth knowing, not a blocker.

## The moment

${concept.timing ? moment(concept) : "Timing isn't set yet — lock it before we go further."} ${concept.kpi ? `Success: **${concept.kpi}**.` : ""}

## Why this earns the slot

- **It speaks to people we have**, not the audience we wish we had. ${audience.size_estimate.toLocaleString()} contacts is enough to learn from and small enough to handle carefully.
- **The channel fits the audience.** ${primaryNice} is how ${segLabel} already hear from us — we're showing up where they already are.
- **The compliance is clean.** ${legal.envelope.rationale}

## How the story lands

The customer feels three beats:

1. **The arrival.** A ${concept.tone || "considered"} ${primaryNice} that doesn't shout — it lands like a note from someone who remembers them.
2. **The recognition.** The message references something they'd recognise about themselves. Not a discount. A reason.
3. **The invitation.** One clear next step. No second CTA. No urgency theatre.

## Channel and voice

${primaryNice} via the default platform. Tone is **${concept.tone || "considered"}** — short sentences, real words, nothing that reads like it came from a committee.

## What's been checked for you

${storyline.envelope.verdict === "OK" ? "Story holds together." : "Story is sound, with one thing to call out."} ${legal.envelope.verdict === "OK" ? "Legal is clear." : "Legal noted, nothing blocking."}

${storyline.envelope.findings
    .filter((f) => f.severity !== "info")
    .map((f) => `- ${f.claim}`)
    .join("\n") || "- No story warnings."}
${legal.envelope.findings
  .filter((f) => f.severity !== "info")
  .map((f) => `- ${f.claim}`)
  .join("\n") || ""}

## What we need from you

Read the brief. Sign off. ${
    legal.envelope.findings.some((f) => f.claim.toLowerCase().includes("data transfer") || f.claim.toLowerCase().includes("leaves the eu"))
      ? "Confirm the EU data-transfer agreement is on file before send. "
      : ""
  }We're ready to schedule the moment you approve.

---

*Composed by Smelling Pretty — ${request_id}.*
`;

  // ---- HTML scrollytelling ----------------------------------------------
  const html = renderScrollytelling({
    title,
    tension,
    concept,
    audience,
    storyline,
    legal,
    request_id,
    primary,
    segLabel,
  });

  return {
    title,
    tension,
    markdown: md,
    html,
    request_id,
    source: "fallback-missing",
  };
}

// LLM-driven variant: keeps the HTML template (layout is solved already)
// but asks Claude to write the prose sections in the senior-strategist
// voice from the SKILL.md. Falls back to the template generator on any
// failure so the demo can never crash.
type StorylineSections = {
  title: string;
  tension: string;
  customer_paragraphs: string[];
  moment_paragraphs: string[];
  argument_bullets: string[];
  story_beats: string[];
  channel_paragraph: string;
  checks_paragraphs: string[];
  ask_paragraph: string;
};

export async function generateStorylineWithLLM(
  systemPrompt: string,
  concept: CampaignConcept,
  audience: AudienceProfile,
  storyline: ValidationResult,
  legal: ValidationResult,
  brief: FinalBrief,
): Promise<StorylineOutput | null> {
  const inputs = {
    concept,
    audience: {
      segment_name: audience.segment_name,
      size_estimate: audience.size_estimate,
      key_attributes: audience.key_attributes,
      dataset_gaps: audience.dataset_gaps,
      confidence: audience.confidence,
    },
    storyline_validator: {
      verdict: storyline.envelope.verdict,
      findings: storyline.envelope.findings,
      rationale: storyline.envelope.rationale,
    },
    legal_validator: {
      verdict: legal.envelope.verdict,
      findings: legal.envelope.findings,
      rationale: legal.envelope.rationale,
    },
  };

  const userMessage = `Write the storyline for this activation. Inputs:

\`\`\`json
${JSON.stringify(inputs, null, 2)}
\`\`\`

Return ONLY a JSON object — no commentary, no markdown fence — matching this exact shape:

{
  "title": "string, short declarative, derived from the goal",
  "tension": "one-line tension — what the customer feels and why we are speaking up",
  "customer_paragraphs": ["1-2 paragraphs about who we're reaching, using real numbers from inputs"],
  "moment_paragraphs": ["1 paragraph on why now"],
  "argument_bullets": ["3 bullets — each starts with a bold lead phrase, anchored to a finding or number"],
  "story_beats": ["3 beats the customer experiences: arrival, recognition, invitation"],
  "channel_paragraph": "1 paragraph on channel + platform + voice",
  "checks_paragraphs": ["1-2 short paragraphs restating storyline + legal verdicts"],
  "ask_paragraph": "2 sentences max — what we need next"
}

Voice rules from your system prompt apply strictly: plain, confident, lightly Dutch, evidence-led, no urgency theatre.`;

  let raw: string;
  try {
    raw = await callAgent({
      systemPrompt,
      userMessage,
      model: DEFAULT_MODELS.storyline,
      maxTokens: 4000,
    });
  } catch {
    return null;
  }

  // Pull the first {…} JSON block from Claude's response.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let sections: StorylineSections;
  try {
    sections = JSON.parse(match[0]) as StorylineSections;
  } catch {
    return null;
  }

  // Quick shape check
  if (!sections.title || !sections.tension || !Array.isArray(sections.argument_bullets)) {
    return null;
  }

  // Stitch into markdown + HTML using the same templating shell as the
  // deterministic generator. The template only handles layout — all the
  // prose is from the model.
  const md = composeMarkdownFromSections(sections, brief.request_id);
  const html = composeHtmlFromSections(sections, audience, storyline, legal, brief.request_id);

  return {
    title: sections.title,
    tension: sections.tension,
    markdown: md,
    html,
    request_id: brief.request_id,
    source: "agent",
  };
}

function composeMarkdownFromSections(s: StorylineSections, request_id: string): string {
  return `# ${s.title}

*${s.tension}*

---

## The customer we're reaching

${s.customer_paragraphs.join("\n\n")}

## The moment

${s.moment_paragraphs.join("\n\n")}

## The argument

${s.argument_bullets.map((b) => `- ${b}`).join("\n")}

## How the story moves

${s.story_beats.map((b, i) => `${i + 1}. ${b}`).join("\n")}

## The channel and the tone

${s.channel_paragraph}

## What we have checked

${s.checks_paragraphs.join("\n\n")}

## The ask

${s.ask_paragraph}

---

*Composed by the marketing storyline skill — ${request_id}.*
`;
}

function composeHtmlFromSections(
  s: StorylineSections,
  audience: AudienceProfile,
  storyline: ValidationResult,
  legal: ValidationResult,
  request_id: string,
): string {
  const status: "OK" | "WARN" | "BLOCKED" =
    legal.envelope.verdict === "BLOCK"
      ? "BLOCKED"
      : storyline.envelope.verdict === "WARN" || legal.envelope.verdict === "WARN"
        ? "WARN"
        : "OK";

  return renderScrollytelling({
    title: s.title,
    tension: s.tension,
    audience,
    storyline,
    legal,
    request_id,
    // Override the deterministic prose with the LLM-written sections.
    overrides: {
      customer_paragraphs: s.customer_paragraphs,
      moment_paragraphs: s.moment_paragraphs,
      argument_bullets: s.argument_bullets,
      story_beats: s.story_beats,
      channel_paragraph: s.channel_paragraph,
      checks_paragraphs: s.checks_paragraphs,
      ask_paragraph: s.ask_paragraph,
      status,
    },
  });
}

type RenderOverrides = {
  customer_paragraphs?: string[];
  moment_paragraphs?: string[];
  argument_bullets?: string[];
  story_beats?: string[];
  channel_paragraph?: string;
  checks_paragraphs?: string[];
  ask_paragraph?: string;
  status?: "OK" | "WARN" | "BLOCKED";
};

function renderScrollytelling(opts: {
  title: string;
  tension: string;
  concept?: CampaignConcept;
  audience: AudienceProfile;
  storyline: ValidationResult;
  legal: ValidationResult;
  request_id: string;
  primary?: string;
  segLabel?: string;
  overrides?: RenderOverrides;
}): string {
  const { title, tension, concept, audience, storyline, legal, request_id, primary, segLabel, overrides } = opts;
  const e = htmlEscape;
  const ov = overrides ?? {};
  const status = ov.status ?? (
    legal.envelope.verdict === "BLOCK" ? "BLOCKED" :
    storyline.envelope.verdict === "WARN" || legal.envelope.verdict === "WARN"
      ? "WARN"
      : "OK"
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${e(title)} — storyline</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root {
    --bg:#f5efe6;
    --bg-soft:#fdfbf7;
    --bg-warm:#ece3d5;
    --ink:#1a1410;
    --ink-soft:#2d2520;
    --taupe-dark:#6b5e54;
    --taupe-line:#d9cfc1;
    --gold:#b4944d;
    --gold-light:#c9ac68;
    --rose:#c8a596;
    --sage:#8a9080;
    --serif:'Cormorant Garamond', ui-serif, Georgia, serif;
    --sans:'Inter', system-ui, -apple-system, Segoe UI, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  html, body { background: var(--bg); color: var(--ink); }
  body { font-family: var(--sans); line-height: 1.65; -webkit-font-smoothing: antialiased; }
  ::selection { background: rgba(180,148,77,0.25); color: var(--ink); }

  .wm { font-family: var(--sans); font-size: 12px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--taupe-dark); font-weight: 500; }

  /* ---------- HERO ---------- */
  .hero {
    min-height: 100vh;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 4rem clamp(2.5rem, 7vw, 7rem);
    background: linear-gradient(180deg, var(--bg) 0%, var(--bg-soft) 100%);
    position: relative;
  }
  .hero::before {
    content: ""; position: absolute; inset: auto auto 0 0; width: 1px; height: 12vh;
    background: linear-gradient(to bottom, transparent, var(--taupe-dark));
    left: clamp(2.5rem, 7vw, 7rem);
  }
  .hero-meta { display: flex; justify-content: space-between; align-items: baseline; }
  .hero-edition { font-family: var(--serif); font-style: italic; font-size: 1.35rem; color: var(--taupe-dark); margin-top: 2.5rem; }
  .hero h1 {
    font-family: var(--serif);
    font-weight: 500;
    font-size: clamp(3.5rem, 8.5vw, 8rem);
    line-height: 0.97;
    letter-spacing: -0.01em;
    max-width: 16ch;
    color: var(--ink);
    margin-top: auto;
  }
  .hero .tension {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(1.5rem, 2.6vw, 2.25rem);
    line-height: 1.35;
    color: var(--taupe-dark);
    max-width: 38ch;
    margin-top: 2rem;
  }
  .scroll-cue {
    font-family: var(--sans);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--taupe-dark);
    margin-top: 3.5rem;
    display: inline-flex; align-items: center; gap: 1rem;
  }
  .scroll-cue::before { content: ""; display: block; width: 48px; height: 1px; background: var(--taupe-dark); }

  /* ---------- BEAT SECTIONS ---------- */
  section.beat {
    display: grid;
    grid-template-columns: minmax(320px, 1fr) minmax(440px, 1.6fr);
    gap: clamp(3rem, 6vw, 7rem);
    padding: clamp(5rem, 12vh, 11rem) clamp(2.5rem, 7vw, 7rem);
    min-height: 100vh;
    align-items: start;
    border-top: 1px solid var(--taupe-line);
    position: relative;
  }
  section.beat:nth-child(odd) { background: var(--bg-soft); }
  section.beat .panel {
    position: sticky; top: 7rem;
    align-self: start;
  }
  section.beat .panel .kicker {
    font-family: var(--sans);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    font-weight: 500;
    color: var(--gold);
    margin-bottom: 1.5rem;
    display: inline-flex; align-items: center; gap: 0.75rem;
  }
  section.beat .panel .kicker::before {
    content: ""; display: inline-block; width: 24px; height: 1px; background: var(--gold);
  }
  section.beat .panel .stat {
    font-family: var(--serif);
    font-weight: 500;
    font-size: clamp(4rem, 8vw, 6.5rem);
    line-height: 0.95;
    letter-spacing: -0.02em;
    color: var(--ink);
  }
  /* secondary stat for sections where a big number would be silly */
  section.beat .panel .stat-sm {
    font-family: var(--serif);
    font-weight: 500;
    font-style: italic;
    font-size: clamp(2rem, 3.4vw, 2.75rem);
    line-height: 1.15;
    color: var(--ink);
  }
  section.beat .panel .stat-sm .and {
    color: var(--gold);
    font-style: normal;
    font-family: var(--sans);
    padding: 0 0.25rem;
  }
  section.beat .panel .stat-label {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(1.25rem, 1.8vw, 1.6rem);
    color: var(--taupe-dark);
    margin-top: 1rem;
    line-height: 1.3;
  }
  section.beat .panel .stat-sub {
    font-family: var(--sans);
    font-size: 0.95rem;
    color: var(--taupe-dark);
    margin-top: 2rem;
    line-height: 1.65;
    padding-top: 1.5rem;
    border-top: 1px solid var(--taupe-line);
    max-width: 28ch;
  }

  section.beat .prose { max-width: 58ch; }
  section.beat .prose h2 {
    font-family: var(--serif);
    font-weight: 500;
    font-style: italic;
    font-size: clamp(2.5rem, 4.5vw, 3.75rem);
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: var(--ink);
    margin-bottom: 2.25rem;
  }
  section.beat .prose p {
    font-family: var(--serif);
    font-size: clamp(1.4rem, 1.8vw, 1.7rem);
    color: var(--ink-soft);
    line-height: 1.5;
    margin-bottom: 1.5rem;
  }
  section.beat .prose p em {
    font-style: italic;
    color: var(--ink);
  }
  section.beat .prose p strong {
    color: var(--ink);
    font-weight: 600;
  }

  /* lists styled as editorial bullets */
  section.beat .prose ul {
    list-style: none;
    margin-top: 2rem;
  }
  section.beat .prose li {
    font-family: var(--serif);
    font-size: clamp(1.25rem, 1.55vw, 1.5rem);
    color: var(--ink-soft);
    line-height: 1.5;
    padding: 1.5rem 0;
    border-bottom: 1px solid var(--taupe-line);
    display: grid; grid-template-columns: 32px 1fr; gap: 1.25rem; align-items: baseline;
  }
  section.beat .prose li:first-child { padding-top: 0; }
  section.beat .prose li:last-child { border-bottom: none; }
  section.beat .prose li::before {
    content: ""; display: block; width: 20px; height: 1px; background: var(--gold);
    transform: translateY(-6px);
  }
  section.beat .prose li strong {
    color: var(--ink);
    font-weight: 600;
    font-style: normal;
  }

  /* fade-up reveal */
  .reveal { opacity: 0; transform: translateY(20px); transition: opacity 1s ease-out, transform 1s ease-out; }
  .reveal.in { opacity: 1; transform: translateY(0); }

  /* ---------- THE ASK ---------- */
  .ask {
    min-height: 90vh;
    display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
    padding: clamp(5rem, 12vh, 11rem) clamp(2.5rem, 7vw, 7rem);
    background: var(--ink);
    color: var(--bg);
    position: relative;
  }
  .ask::before {
    content: ""; position: absolute; top: 0; left: clamp(2.5rem, 7vw, 7rem);
    width: 80px; height: 1px; background: var(--gold);
    margin-top: 4rem;
  }
  .ask .kicker {
    font-family: var(--sans);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--gold-light);
    font-weight: 500;
    margin-bottom: 2.5rem;
  }
  .ask h2 {
    font-family: var(--serif);
    font-weight: 500;
    font-size: clamp(3.5rem, 7.5vw, 6.5rem);
    line-height: 1;
    letter-spacing: -0.01em;
    max-width: 18ch;
  }
  .ask h2 em { font-style: italic; color: var(--rose); }
  .ask p {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(1.5rem, 2.2vw, 2rem);
    line-height: 1.45;
    color: var(--bg-warm);
    max-width: 50ch;
    margin-top: 2.5rem;
  }
  .ask .next {
    margin-top: 4rem;
    font-family: var(--sans);
    text-transform: uppercase;
    letter-spacing: 0.32em;
    font-size: 12px;
    font-weight: 500;
    color: var(--bg);
    border: 1px solid var(--gold-light);
    padding: 1.25rem 2.25rem;
    border-radius: 999px;
  }

  footer {
    padding: 3rem clamp(2.5rem, 7vw, 7rem);
    font-family: var(--sans);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--taupe-dark);
    display: flex; justify-content: space-between; gap: 2rem; flex-wrap: wrap;
    background: var(--bg);
    border-top: 1px solid var(--taupe-line);
  }

  .pill {
    display: inline-flex; align-items: center; height: 30px; padding: 0 16px;
    border-radius: 999px; border: 1px solid currentColor;
    font-family: var(--sans);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.32em;
    text-transform: uppercase;
  }
  .pill.ok { color: var(--sage); }
  .pill.warn { color: var(--gold); }
  .pill.block { color: var(--rose); }

  @media (max-width: 900px) {
    section.beat { grid-template-columns: 1fr; gap: 3rem; padding: 4rem 1.5rem; }
    section.beat .panel { position: static; }
    .hero { padding: 3rem 1.5rem; }
    .ask { padding: 5rem 1.5rem; }
  }
</style>
</head>
<body>

<section class="hero">
  <div class="hero-meta">
    <div>
      <div class="wm">Smelling Pretty · the storyline</div>
      <div class="hero-edition">edition № ${e(request_id.slice(-4))}</div>
    </div>
    <span class="pill ${status === "OK" ? "ok" : status === "BLOCKED" ? "block" : "warn"}">status — ${status.toLowerCase()}</span>
  </div>
  <div>
    <h1 class="reveal">${e(title)}</h1>
    <p class="tension reveal">${e(tension)}</p>
    <div class="scroll-cue reveal">scroll, slowly</div>
  </div>
</section>

<section class="beat">
  <div class="panel reveal">
    <div class="kicker">your audience</div>
    <div class="stat">${audience.size_estimate.toLocaleString()}</div>
    <div class="stat-label">${e((segLabel || "your audience").toLowerCase())}, total reachable</div>
    <div class="stat-sub">${(() => {
      // Pull the "X you can send to today" number out of the findings so the
      // panel can show the honest split (today vs after consent refresh).
      const finding = audience.envelope.findings.find((f) =>
        /can send to today/i.test(f.claim),
      );
      const m = finding?.claim.match(/([\d.,]+)\s+you can send to today/i);
      if (m) {
        const today = m[1];
        const remaining = (audience.size_estimate - Number(today.replace(/[.,]/g, ""))).toLocaleString();
        return `${e(today)} ready today · ${e(remaining)} more after consent refresh`;
      }
      return `confidence: ${audience.confidence.toLowerCase()}`;
    })()}</div>
  </div>
  <div class="prose reveal">
    ${ov.customer_paragraphs
      ? ov.customer_paragraphs.map((p) => `<p>${e(p)}</p>`).join("")
      : `<h2>${e(capitalizeFirst(segLabel || "Your audience"))}. Opted in. Active.</h2>
    <p>These are people who already said yes — to you, to this channel, to hearing from your brand. The audience isn't speculative. It's counted.</p>
    <ul>${audience.key_attributes.slice(0, 4).map((a) => `<li><span></span><span>${e(a)}</span></li>`).join("")}</ul>
    <p>Worth knowing what isn't yet here: ${e(audience.dataset_gaps.slice(0, 2).join(". "))}. None of it is a blocker — it's just honest about the file.</p>`}
  </div>
</section>

<section class="beat">
  <div class="panel reveal">
    <div class="kicker">the moment</div>
    <div class="stat">${e(concept?.timing || "—")}</div>
    <div class="stat-label">the window</div>
    <div class="stat-sub">${e(concept?.kpi || "no metric set")}</div>
  </div>
  <div class="prose reveal">
    ${ov.moment_paragraphs
      ? ov.moment_paragraphs.map((p) => `<p>${e(p)}</p>`).join("")
      : `<h2>${e(concept ? moment(concept) : "Timing matters.")}</h2>
    <p>${concept?.kpi ? `What we are trying to move: <strong>${e(concept.kpi)}</strong>.` : "A KPI has not been set yet — recommend locking one before launch."}</p>
    <p>Momentum decays in marketing the way silence decays in a conversation. Send when the segment is most likely to be listening, not when it is convenient for us.</p>`}
  </div>
</section>

<section class="beat">
  <div class="panel reveal">
    <div class="kicker">why this earns the slot</div>
    <div class="stat-sm">${e(capitalizeFirst((segLabel || "your audience").toLowerCase()))}</div>
    <div class="stat-label">already opted in, already active</div>
    <div class="stat-sub">Volume to learn from. Small enough to send carefully.</div>
  </div>
  <div class="prose reveal">
    ${ov.argument_bullets
      ? `<ul>${ov.argument_bullets.map((b) => `<li><span></span><span>${boldFirstPhrase(e(b))}</span></li>`).join("")}</ul>`
      : `<h2>The case for it.</h2>
    <ul>
      <li><span></span><span><strong>It speaks to the people you have</strong> — not the audience you wish for. ${audience.size_estimate.toLocaleString()} ${e((segLabel || "contacts").toLowerCase())} is real volume.</span></li>
      <li><span></span><span><strong>The channel fits.</strong> ${e(primary || "This channel")} is how ${e((segLabel || "they").toLowerCase())} already hear from you.</span></li>
      <li><span></span><span><strong>The legal corners are clean.</strong> ${e(legal.envelope.rationale)}</span></li>
    </ul>`}
  </div>
</section>

<section class="beat">
  <div class="panel reveal">
    <div class="kicker">how it lands</div>
    <div class="stat-sm">arrival<br/><span class="and">→</span> recognition<br/><span class="and">→</span> invitation</div>
    <div class="stat-label">the three beats they feel</div>
    <div class="stat-sub">No theatre. No urgency tricks.</div>
  </div>
  <div class="prose reveal">
    ${ov.story_beats
      ? `<ul>${ov.story_beats.map((b) => `<li><span></span><span>${boldFirstPhrase(e(b))}</span></li>`).join("")}</ul>`
      : `<h2>Three beats.</h2>
    <ul>
      <li><span></span><span><strong>The arrival.</strong> A ${e(concept?.tone || "considered")} ${e(primary || "message")} that doesn't shout — it lands like a note from someone who remembers.</span></li>
      <li><span></span><span><strong>The recognition.</strong> The message references something they'd recognise about themselves. Not a discount. A reason.</span></li>
      <li><span></span><span><strong>The invitation.</strong> One clear next step. No second CTA.</span></li>
    </ul>`}
  </div>
</section>

${ov.channel_paragraph ? `<section class="beat">
  <div class="panel reveal">
    <div class="kicker">the channel</div>
    <div class="stat">${e((primary || concept?.channels?.[0] || "—").toString())}</div>
    <div class="stat-label">how the story travels</div>
    <div class="stat-sub">${e(concept?.tone || "considered")} tone</div>
  </div>
  <div class="prose reveal">
    <p>${e(ov.channel_paragraph)}</p>
  </div>
</section>` : ""}

<section class="beat">
  <div class="panel reveal">
    <div class="kicker">what we have checked</div>
    <div class="stat">${storyline.envelope.verdict === "OK" && legal.envelope.verdict === "OK" ? "Clean" : "Noted"}</div>
    <div class="stat-label">storyline ${storyline.envelope.verdict.toLowerCase()} · legal ${legal.envelope.verdict.toLowerCase()}</div>
    <div class="stat-sub">Auditable. Defensible. Not exciting.</div>
  </div>
  <div class="prose reveal">
    ${ov.checks_paragraphs
      ? ov.checks_paragraphs.map((p) => `<p>${e(p)}</p>`).join("")
      : `<h2>The corners are square.</h2>
    <p>${e(storyline.envelope.rationale)}</p>
    <p>${e(legal.envelope.rationale)}</p>`}
    ${[
      ...storyline.envelope.findings.filter((f) => f.severity !== "info"),
      ...legal.envelope.findings.filter((f) => f.severity !== "info"),
    ].length
      ? `<ul>${[
          ...storyline.envelope.findings.filter((f) => f.severity !== "info"),
          ...legal.envelope.findings.filter((f) => f.severity !== "info"),
        ]
          .map((f) => `<li><span></span><span>${e(f.claim)}</span></li>`)
          .join("")}</ul>`
      : ""}
  </div>
</section>

<section class="ask">
  <div class="kicker reveal">the ask</div>
  <h2 class="reveal">Read it. Sign it.<br/><em>Then we move.</em></h2>
  <p class="reveal">${ov.ask_paragraph ? e(ov.ask_paragraph) : "We have built a brief that is honest about who we are talking to, why it matters now, and what we have already checked. Approval, then send."}</p>
  <span class="next reveal">next — approver sign-off</span>
</section>

<footer>
  <span>Smelling Pretty · ${e(request_id)}</span>
  <span>composed ${new Date().toISOString().slice(0, 10)}</span>
  <span>without the rush</span>
</footer>

<script>
  // Reveal-on-scroll. No framework — IntersectionObserver, ~30 lines.
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.isIntersecting && en.target.classList.add("in")),
    { threshold: 0.12 },
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
</script>

</body>
</html>`;
}
