import type {
  AudienceProfile,
  CampaignConcept,
  Envelope,
  FinalBrief,
  ValidationResult,
} from "./types";

// Deterministic mocks grounded in the *actual* CSV schema teammates pushed:
// Data/1_Customers_CRM.csv, 2_Transactions_Ecomm.csv, 3_Consent_Compliance.csv,
// 4_Campaign_Activation.csv. The mock numbers and fields use real segment
// names (At-Risk, Loyal, …), real country codes (NL/DE/BE/ES/FR/GB), and
// real consent flags so the demo references match what teammates expect.

const sha = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return "sim_" + (h >>> 0).toString(16).padStart(8, "0");
};

// Map the wizard's free-text audience hint onto a real CRM segment.
function inferSegment(hint: string): "At-Risk" | "Loyal" | "High-Value" | "New" | "Occasional" {
  const h = hint.toLowerCase();
  if (/lapsed|at.risk|inactive|dormant|win.?back/.test(h)) return "At-Risk";
  if (/loyal|repeat|regular/.test(h)) return "Loyal";
  if (/vip|luxury|high.?value|top|premium/.test(h)) return "High-Value";
  if (/new|prospect|first.?time|acquisition/.test(h)) return "New";
  return "Occasional";
}

// Channel → required consent flag (matches brief-intake skill's table)
const CHANNEL_CONSENT: Record<string, string> = {
  email: "email_marketing_opt_in",
  sms: "sms_opt_in",
  "push notification": "push_notification_opt_in",
  push: "push_notification_opt_in",
  "paid social": "paid_social_opt_in",
  "paid search": "paid_social_opt_in",
  "on-site banner": "push_notification_opt_in",
};

const CHANNEL_PLATFORM: Record<string, string> = {
  email: "Klaviyo",
  sms: "Klaviyo",
  "push notification": "Braze",
  push: "Braze",
  "paid social": "Meta Ads Manager",
  "paid search": "Google Ads",
  "on-site banner": "Braze",
};

export function mockAudience(concept: CampaignConcept): AudienceProfile {
  const inputs_hash = sha(JSON.stringify(concept));
  const segment = inferSegment(concept.audience_hint);

  // Realistic size estimates based on the dataset (300 customers, ~60/segment).
  // Scaled up to feel believable for a real activation while staying coherent
  // with the segment proportions in the CSV.
  const baseSizes: Record<typeof segment, number> = {
    "At-Risk": 14_200,
    "Loyal": 28_800,
    "High-Value": 6_400,
    "New": 19_300,
    "Occasional": 33_700,
  };
  const size_estimate = baseSizes[segment] + (inputs_hash.length % 9) * 1_200;

  const primaryChannel = concept.channels[0] || "email";
  const platform = CHANNEL_PLATFORM[primaryChannel] || "Klaviyo";
  const requiredConsent = CHANNEL_CONSENT[primaryChannel] || "email_marketing_opt_in";

  const envelope: Envelope = {
    agent: "fallback-audience-researcher",
    version: "0.2",
    verdict: "WARN",
    findings: [
      {
        claim: `Mapped audience hint "${concept.audience_hint}" → CRM segment "${segment}".`,
        evidence:
          "Inference from segment vocabulary in Data/1_Customers_CRM.csv (segments: New, Loyal, Occasional, At-Risk, High-Value).",
        severity: "info",
      },
      {
        claim: `Resolved ${segment} customers with ${requiredConsent} = TRUE: ≈ ${size_estimate.toLocaleString()} contacts.`,
        evidence:
          "Joined CRM ↔ Consent on email, filtered to active accounts. ~35 customers have no consent record and were dropped (consent coverage gap).",
        severity: "info",
      },
      {
        claim:
          "ANON-prefixed transactions cannot be linked to this segment without identity resolution.",
        evidence:
          "Transactions file contains ~50% ANON-xxxxxx device IDs; those rows are excluded from segment behavioural attributes.",
        severity: "warn",
      },
      {
        claim: `Destination platform defaulted to ${platform} for ${primaryChannel}.`,
        evidence:
          "Channel → platform mapping matches brief-intake skill's deterministic table.",
        severity: "info",
      },
    ],
    rationale: `${segment} segment resolved from CRM with ${requiredConsent} applied. Size and gaps grounded in the real dataset shape (300 customers, 265 consent records, ANON-prefixed transactions excluded).`,
    inputs_hash,
    source: "fallback-missing",
    agent_path: null,
  };

  return {
    segment_name: `${segment.toLowerCase()}_${platform.toLowerCase()}_v1`,
    size_estimate,
    key_attributes: [
      `customer_segment = "${segment}"`,
      `account_status = "active"`,
      `${requiredConsent} = TRUE`,
      `consent_withdrawn = FALSE AND right_to_erasure_requested = FALSE`,
      `data_retention_expiry > today`,
    ],
    dataset_gaps: [
      "consent coverage: 265 of 300 customers — 35 missing a consent row",
      "189 of 265 consent records have retention expiry before today — most need refresh",
      "128 ANON transactions cannot be joined to known customers",
    ],
    confidence: "MEDIUM",
    envelope,
  };
}

export function mockStoryline(
  concept: CampaignConcept,
  audience: AudienceProfile,
): ValidationResult {
  const inputs_hash = sha(JSON.stringify({ concept, audience }));
  const primaryChannel = concept.channels[0] || "email";
  const platformIsUS = ["Klaviyo", "Braze", "Meta Ads Manager", "Google Ads"]
    .some((p) => audience.envelope.findings.some((f) => f.claim.includes(p)));

  const findings: Envelope["findings"] = [
    {
      claim: `Tone "${concept.tone}" reads consistently with the ${primaryChannel} channel and a ${concept.timing} cadence.`,
      evidence:
        "Channel/tone/timing combination matches historical playbooks for this segment in 4_Campaign_Activation.csv.",
      severity: "info",
    },
    {
      claim: `Audience size (${audience.size_estimate.toLocaleString()}) is appropriate for the stated goal.`,
      evidence:
        "Within the typical reach band for prior campaigns to this segment.",
      severity: "info",
    },
  ];

  if (platformIsUS) {
    findings.push({
      claim:
        "Audience push to a US-hosted platform requires the cross-border transfer flag to be recorded.",
      evidence:
        "Klaviyo / Braze / Meta / Google are US-hosted; EU customer data needs SCC documentation.",
      severity: "warn",
    });
  }

  const verdict = findings.some((f) => f.severity === "warn") ? "WARN" : "OK";

  const envelope: Envelope = {
    agent: "fallback-storyline-validator",
    version: "0.2",
    verdict,
    findings,
    rationale:
      "Story holds together. The platform residency is the main thing the brief should make explicit.",
    inputs_hash,
    source: "fallback-missing",
    agent_path: null,
  };
  return { envelope };
}

export function mockLegal(
  concept: CampaignConcept,
  audience: AudienceProfile,
): ValidationResult {
  const inputs_hash = sha(JSON.stringify({ concept, audience }));
  const primaryChannel = concept.channels[0] || "email";
  const consent = CHANNEL_CONSENT[primaryChannel] || "email_marketing_opt_in";

  const envelope: Envelope = {
    agent: "fallback-legal-validator",
    version: "0.2",
    verdict: "WARN",
    findings: [
      {
        claim: `Lawful basis: consent (GDPR Art. 6(1)(a)) — ${consent} required.`,
        evidence:
          "Determined from channel and the brief-intake recipe table. Marketing communications under GDPR / ePrivacy.",
        severity: "info",
      },
      {
        claim:
          "Always-exclude list applied: unsubscribed, right_to_erasure_requested, consent_withdrawn.",
        evidence: "Standard suppression per 3_Consent_Compliance.csv flags.",
        severity: "info",
      },
      {
        claim: "Cross-border transfer to US-hosted destination platform.",
        evidence:
          "Klaviyo / Braze / Meta / Google are US-hosted; EU data exports require Standard Contractual Clauses (SCC) sign-off by DPO.",
        severity: "warn",
      },
      {
        claim: "Data retention horizon must be checked before send.",
        evidence:
          "data_retention_expiry per customer; suppress anyone past their expiry date.",
        severity: "info",
      },
    ],
    rationale:
      "No hard blockers. Cross-border SCC is the standard pre-send review item; otherwise hygienic.",
    inputs_hash,
    source: "fallback-missing",
    agent_path: null,
  };
  return { envelope };
}

export function mockBrief(
  concept: CampaignConcept,
  audience: AudienceProfile,
  storyline: ValidationResult,
  legal: ValidationResult,
): FinalBrief {
  const verdicts = [storyline.envelope.verdict, legal.envelope.verdict];
  const status: FinalBrief["status"] = verdicts.includes("BLOCK")
    ? "BLOCKED"
    : verdicts.includes("WARN") || audience.confidence === "LOW"
      ? "WARN"
      : "OK";

  const request_id = sha(
    JSON.stringify({ concept, audience: audience.segment_name }),
  );

  const markdown = `# Activation Brief

**Status:** ${status}
**Request:** ${request_id}

## Concept

${concept.goal}

## Audience

**${audience.segment_name}** — ≈ ${audience.size_estimate.toLocaleString()} contacts, confidence ${audience.confidence}.

Key attributes:
${audience.key_attributes.map((a) => `- ${a}`).join("\n")}

${audience.dataset_gaps.length ? `Gaps in the dataset:\n${audience.dataset_gaps.map((g) => `- ${g}`).join("\n")}` : ""}

## Channels & Tone

- **Channels:** ${concept.channels.join(", ") || "—"}
- **Tone:** ${concept.tone || "—"}
- **Timing:** ${concept.timing || "—"}

## Validation

### Storyline
- **Verdict:** ${storyline.envelope.verdict}
- ${storyline.envelope.rationale}

### Legal
- **Verdict:** ${legal.envelope.verdict}
- ${legal.envelope.rationale}

## Success criteria

${concept.kpi || "Not specified."}

${concept.constraints ? `## Constraints\n\n${concept.constraints}` : ""}

---

*Generated by the marketing ritual. Specialist envelopes are recorded in audit.json.*
`;

  const audit = {
    request_id,
    status,
    concept,
    audience: audience.envelope,
    validators: {
      storyline: storyline.envelope,
      legal: legal.envelope,
    },
    note: "Some envelopes use inline fallbacks because the matching agent/skill was not yet present. See `source` per envelope. Once real agents land, the orchestrator picks them up automatically via .claude/agents/ or .claude/skills/.",
  };

  return {
    status,
    concept,
    audience,
    storyline,
    legal,
    markdown,
    audit,
    request_id,
  };
}
