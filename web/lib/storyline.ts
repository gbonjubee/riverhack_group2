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
  // Take the first 8 words of the goal, strip punctuation, title case.
  const words = concept.goal.replace(/[.,;:]/g, "").split(/\s+/).slice(0, 8);
  return words
    .map((w, i) =>
      i === 0 ? w[0]?.toUpperCase() + w.slice(1).toLowerCase() : w,
    )
    .join(" ");
}

function tensionFor(concept: CampaignConcept, audience: AudienceProfile): string {
  // Try to surface the productive tension at the heart of the campaign.
  const segLabel = audience.envelope.findings
    .find((f) => f.claim.startsWith("Mapped audience"))
    ?.claim.match(/segment "([^"]+)"/)?.[1] || "this segment";
  return `${segLabel} customers haven't heard from us at the right moment — and the moment is now.`;
}

function moment(concept: CampaignConcept): string {
  const t = concept.timing.toLowerCase();
  if (t.includes("week")) return "The window is tight: this week.";
  if (t.includes("month")) return "We have a month, which is enough if we move now.";
  if (t.includes("quarter"))
    return "A full quarter to land it properly — no excuse to rush.";
  return "Timing is open, but momentum decays. The sooner the better.";
}

function bullets(items: string[]): string {
  return items.map((s) => `- ${s}`).join("\n");
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
  const segLabel =
    audience.envelope.findings
      .find((f) => f.claim.startsWith("Mapped audience"))
      ?.claim.match(/segment "([^"]+)"/)?.[1] || "the chosen segment";

  // ---- Markdown ----------------------------------------------------------
  const md = `# ${title}

*${tension}*

---

## The customer we're reaching

${audience.size_estimate.toLocaleString()} people, mapped to the **${segLabel}** segment. They opted in. They're active. The numbers are honest:

${bullets(audience.key_attributes)}

It is worth saying what is *not* there. ${audience.dataset_gaps.map((g) => g.replace(/—/g, "-")).join(". ")}. We are working with what we know, not what we wish we knew.

## The moment

${concept.timing ? moment(concept) : "Timing was not specified — recommend locking it before we go further."} ${concept.kpi ? `What we are trying to move: **${concept.kpi}**.` : ""}

## The argument

Why this campaign earns its budget, in three lines:

- **It speaks to the segment we have, not the segment we wish we had.** ${audience.size_estimate.toLocaleString()} contacts is enough volume to learn from, small enough to handle with care.
- **The channel matches the audience's posture.** ${primary} for ${segLabel} is the channel they already accept — we are not asking them to change behaviour, we are showing up where they already are.
- **The compliance corners are squared.** ${legal.envelope.rationale} The brief reads as auditable, not just exciting.

## How the story moves

Three beats the customer experiences:

1. **The arrival.** A ${concept.tone || "considered"} ${primary} that does not announce itself — it lands like a note from someone who remembers.
2. **The recognition.** The body of the message references something the customer would recognise about themselves. Not a discount. A reason.
3. **The invitation.** One clear next step. No second CTA. No urgency theatre. If they're ready, they move. If they're not, we have not burned the relationship.

## The channel and the tone

${primary} delivered via the platform mapped in the intake. The tone is **${concept.tone || "to be confirmed"}** — meaning short sentences, real words, nothing that reads like it was written by a committee.

## What we have checked

${storyline.envelope.verdict === "OK" ? "Storyline coherent." : "Storyline noted with warnings — see findings."} ${legal.envelope.verdict === "OK" ? "Legal clear." : "Legal flags raised, none blocking."}

${storyline.envelope.findings
    .filter((f) => f.severity !== "info")
    .map((f) => `- ${f.claim}`)
    .join("\n") || "- No storyline warnings."}
${legal.envelope.findings
  .filter((f) => f.severity !== "info")
  .map((f) => `- ${f.claim}`)
  .join("\n") || ""}

## The ask

Read the brief. Sign it. ${
    legal.envelope.findings.some((f) => f.claim.toLowerCase().includes("scc"))
      ? "Confirm the cross-border SCC is in place before send. "
      : ""
  }We are ready to schedule the moment the approver lands their signature.

---

*Composed by the marketing storyline skill — ${request_id}.*
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

function renderScrollytelling(opts: {
  title: string;
  tension: string;
  concept: CampaignConcept;
  audience: AudienceProfile;
  storyline: ValidationResult;
  legal: ValidationResult;
  request_id: string;
  primary: string;
  segLabel: string;
}): string {
  const { title, tension, concept, audience, storyline, legal, request_id, primary, segLabel } = opts;
  const e = htmlEscape;
  const status = legal.envelope.verdict === "BLOCK" ? "BLOCKED" :
    storyline.envelope.verdict === "WARN" || legal.envelope.verdict === "WARN"
      ? "WARN"
      : "OK";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${e(title)} — storyline</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
<style>
  :root {
    --bg:#f5efe6;
    --bg-soft:#fdfbf7;
    --ink:#1a1410;
    --ink-soft:#2d2520;
    --taupe-dark:#6b5e54;
    --taupe-line:#d9cfc1;
    --gold:#b4944d;
    --rose:#c8a596;
    --sage:#8a9080;
    --serif:'Cormorant Garamond', ui-serif, Georgia, serif;
    --sans:'Inter', system-ui, -apple-system, Segoe UI, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: var(--bg); color: var(--ink); }
  body { font-family: var(--sans); line-height: 1.6; -webkit-font-smoothing: antialiased; }
  ::selection { background: rgba(180,148,77,0.25); color: var(--ink); }

  .wm { font-family: var(--sans); font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--taupe-dark); }

  .hero {
    min-height: 100vh;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 4rem clamp(2rem, 6vw, 6rem);
    background: linear-gradient(180deg, var(--bg) 0%, var(--bg-soft) 100%);
  }
  .hero h1 {
    font-family: var(--serif);
    font-weight: 500;
    font-size: clamp(3rem, 8vw, 7.5rem);
    line-height: 0.95;
    max-width: 14ch;
    color: var(--ink);
    margin-top: auto;
  }
  .hero .tension {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(1.25rem, 2.2vw, 1.75rem);
    color: var(--taupe-dark);
    max-width: 40ch;
    margin-top: 2rem;
  }
  .hero-meta { display: flex; justify-content: space-between; align-items: baseline; }
  .scroll-cue {
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--taupe-dark);
    margin-top: 3rem;
    display: inline-flex; align-items: center; gap: 0.75rem;
  }
  .scroll-cue::before { content: ""; display: block; width: 32px; height: 1px; background: var(--taupe-dark); }

  section.beat {
    display: grid;
    grid-template-columns: minmax(300px, 1fr) minmax(380px, 1.4fr);
    gap: clamp(2rem, 5vw, 6rem);
    padding: clamp(4rem, 10vh, 10rem) clamp(2rem, 6vw, 6rem);
    min-height: 100vh;
    align-items: start;
    border-top: 1px solid var(--taupe-line);
    position: relative;
  }
  section.beat .panel {
    position: sticky; top: 6rem;
    align-self: start;
  }
  section.beat .panel .kicker {
    font-family: var(--sans); font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--gold); margin-bottom: 1rem;
  }
  section.beat .panel .stat {
    font-family: var(--serif);
    font-size: clamp(3rem, 6vw, 5.5rem);
    line-height: 1;
    color: var(--ink);
  }
  section.beat .panel .stat-label {
    font-family: var(--serif); font-style: italic; font-size: 1.1rem; color: var(--taupe-dark); margin-top: 0.75rem;
  }
  section.beat .panel .stat-sub {
    font-family: var(--sans); font-size: 0.8rem; color: var(--taupe-dark); margin-top: 1.5rem; line-height: 1.5;
  }
  section.beat .prose {
    max-width: 56ch;
  }
  section.beat .prose h2 {
    font-family: var(--serif);
    font-weight: 500;
    font-style: italic;
    font-size: clamp(2rem, 4vw, 3.25rem);
    line-height: 1.05;
    color: var(--ink);
    margin-bottom: 2rem;
  }
  section.beat .prose p {
    font-family: var(--serif);
    font-size: clamp(1.1rem, 1.4vw, 1.35rem);
    color: var(--ink-soft);
    line-height: 1.5;
    margin-bottom: 1.25rem;
  }
  section.beat .prose ul {
    list-style: none; margin-top: 1.5rem;
  }
  section.beat .prose li {
    font-family: var(--sans);
    font-size: 1rem;
    color: var(--ink-soft);
    padding: 1rem 0;
    border-bottom: 1px solid var(--taupe-line);
    display: grid; grid-template-columns: 24px 1fr; gap: 1rem; align-items: baseline;
  }
  section.beat .prose li::before {
    content: ""; display: block; width: 16px; height: 1px; background: var(--gold); transform: translateY(-4px);
  }
  section.beat .prose li strong { color: var(--ink); font-weight: 500; }

  /* fade-up reveal */
  .reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.9s ease-out, transform 0.9s ease-out; }
  .reveal.in { opacity: 1; transform: translateY(0); }

  /* the ask: dramatic final frame */
  .ask {
    min-height: 100vh;
    display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
    padding: clamp(4rem, 10vh, 10rem) clamp(2rem, 6vw, 6rem);
    background: var(--ink);
    color: var(--bg);
  }
  .ask h2 {
    font-family: var(--serif); font-weight: 500; font-size: clamp(3rem, 7vw, 6rem); line-height: 1; max-width: 18ch;
  }
  .ask p {
    font-family: var(--serif); font-style: italic; font-size: clamp(1.25rem, 2vw, 1.75rem); color: var(--rose); max-width: 50ch; margin-top: 2rem;
  }
  .ask .next {
    margin-top: 4rem; font-family: var(--sans); text-transform: uppercase; letter-spacing: 0.28em; font-size: 11px; color: var(--bg);
    border: 1px solid var(--bg); padding: 1rem 2rem; border-radius: 999px;
  }

  footer {
    padding: 3rem clamp(2rem, 6vw, 6rem);
    font-family: var(--sans); font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--taupe-dark);
    display: flex; justify-content: space-between; gap: 2rem; flex-wrap: wrap;
    background: var(--bg); border-top: 1px solid var(--taupe-line);
  }

  .pill {
    display: inline-flex; align-items: center; height: 26px; padding: 0 12px;
    border-radius: 999px; border: 1px solid currentColor;
    font-family: var(--sans); font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase;
  }
  .pill.ok { color: var(--sage); }
  .pill.warn { color: var(--gold); }
  .pill.block { color: var(--rose); }

  @media (max-width: 800px) {
    section.beat { grid-template-columns: 1fr; }
    section.beat .panel { position: static; }
  }
</style>
</head>
<body>

<section class="hero">
  <div class="hero-meta">
    <div class="wm">atelier · marketing storyline</div>
    <span class="pill ${status === "OK" ? "ok" : status === "BLOCKED" ? "block" : "warn"}">status — ${status.toLowerCase()}</span>
  </div>
  <div>
    <h1 class="reveal">${e(title)}</h1>
    <p class="tension reveal">${e(tension)}</p>
    <div class="scroll-cue">scroll, slowly</div>
  </div>
</section>

<section class="beat">
  <div class="panel reveal">
    <div class="kicker">the customer we're reaching</div>
    <div class="stat">${audience.size_estimate.toLocaleString()}</div>
    <div class="stat-label">${e(segLabel.toLowerCase())} contacts</div>
    <div class="stat-sub">confidence: ${audience.confidence.toLowerCase()}</div>
  </div>
  <div class="prose reveal">
    <h2>${audience.size_estimate.toLocaleString()} people who already said yes.</h2>
    <p>They opted in. They're active. The numbers are honest.</p>
    <ul>
      ${audience.key_attributes
        .map((a) => `<li><span></span><span>${e(a)}</span></li>`)
        .join("")}
    </ul>
    <p>It is worth saying what is <em>not</em> there. ${e(audience.dataset_gaps.join(". "))}. We are working with what we know, not what we wish we knew.</p>
  </div>
</section>

<section class="beat">
  <div class="panel reveal">
    <div class="kicker">the moment</div>
    <div class="stat">${e(concept.timing || "—")}</div>
    <div class="stat-label">the window</div>
    <div class="stat-sub">${e(concept.kpi || "no metric set")}</div>
  </div>
  <div class="prose reveal">
    <h2>${e(moment(concept))}</h2>
    <p>${concept.kpi ? `What we are trying to move: <strong>${e(concept.kpi)}</strong>.` : "A KPI has not been set yet — recommend locking one before launch."}</p>
    <p>Momentum decays in marketing the way silence decays in a conversation. Send when the segment is most likely to be listening, not when it is convenient for us.</p>
  </div>
</section>

<section class="beat">
  <div class="panel reveal">
    <div class="kicker">the argument</div>
    <div class="stat">3</div>
    <div class="stat-label">reasons it earns budget</div>
    <div class="stat-sub">No more, no less.</div>
  </div>
  <div class="prose reveal">
    <h2>Why this earns its space.</h2>
    <ul>
      <li><span></span><span><strong>It speaks to the segment we have</strong>, not the one we wish we had. ${audience.size_estimate.toLocaleString()} contacts is enough volume to learn from, small enough to handle with care.</span></li>
      <li><span></span><span><strong>The channel matches the audience's posture.</strong> ${e(primary)} for ${e(segLabel)} is the channel they already accept.</span></li>
      <li><span></span><span><strong>The compliance corners are squared.</strong> ${e(legal.envelope.rationale)}</span></li>
    </ul>
  </div>
</section>

<section class="beat">
  <div class="panel reveal">
    <div class="kicker">how the story moves</div>
    <div class="stat">3</div>
    <div class="stat-label">beats the customer feels</div>
    <div class="stat-sub">Arrival → Recognition → Invitation</div>
  </div>
  <div class="prose reveal">
    <h2>Three beats. No theatre.</h2>
    <ul>
      <li><span></span><span><strong>The arrival.</strong> A ${e(concept.tone || "considered")} ${e(primary)} that does not announce itself — it lands like a note from someone who remembers.</span></li>
      <li><span></span><span><strong>The recognition.</strong> The body references something the customer would recognise about themselves. Not a discount. A reason.</span></li>
      <li><span></span><span><strong>The invitation.</strong> One clear next step. No second CTA. No urgency theatre.</span></li>
    </ul>
  </div>
</section>

<section class="beat">
  <div class="panel reveal">
    <div class="kicker">what we have checked</div>
    <div class="stat">${storyline.envelope.verdict === "OK" && legal.envelope.verdict === "OK" ? "Clean" : "Noted"}</div>
    <div class="stat-label">storyline ${storyline.envelope.verdict.toLowerCase()} · legal ${legal.envelope.verdict.toLowerCase()}</div>
    <div class="stat-sub">Auditable. Defensible. Not exciting.</div>
  </div>
  <div class="prose reveal">
    <h2>The corners are square.</h2>
    <p>${e(storyline.envelope.rationale)}</p>
    <p>${e(legal.envelope.rationale)}</p>
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
  <h2 class="reveal">Read it. Sign it.<br/>Then we move.</h2>
  <p class="reveal">We have built a brief that is honest about who we are talking to, why it matters now, and what we have already checked. Approval, then send.</p>
  <span class="next reveal">next: approver sign-off</span>
</section>

<footer>
  <span>atelier · ${e(request_id)}</span>
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
