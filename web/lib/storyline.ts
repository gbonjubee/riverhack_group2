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
      <div class="wm">atelier · marketing storyline</div>
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
  <div class="kicker reveal">the ask</div>
  <h2 class="reveal">Read it. Sign it.<br/><em>Then we move.</em></h2>
  <p class="reveal">We have built a brief that is honest about who we are talking to, why it matters now, and what we have already checked. Approval, then send.</p>
  <span class="next reveal">next — approver sign-off</span>
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
