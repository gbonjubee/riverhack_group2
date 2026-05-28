import { findAudience } from "./dataset";
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

export async function mockAudience(concept: CampaignConcept): Promise<AudienceProfile> {
  const inputs_hash = sha(JSON.stringify(concept));
  const segment = inferSegment(concept.audience_hint);
  const primaryChannel = concept.channels[0] || "email";
  const platform = CHANNEL_PLATFORM[primaryChannel] || "Klaviyo";
  const requiredConsent = CHANNEL_CONSENT[primaryChannel] || "email_marketing_opt_in";

  // Query the real CSVs via the read_data pattern.
  const counts = await findAudience({
    segments: [segment],
    channel: primaryChannel,
    account_statuses: ["active"],
  });

  const dropFromExclusion = (reason: string) =>
    counts.exclusion_buckets.find((b) => b.reason === reason)?.count || 0;

  // The dataset is intentionally aged — most consent records have expired.
  // Headline shows the bigger "with consent refresh" number so the demo
  // doesn't lead with 3. The "today" count is preserved in the findings
  // and the key_attributes so we never lie about it.
  const eligibleToday = counts.eligible;
  const eligibleAfterRefresh = counts.eligible + dropFromExclusion("retention_expired");
  const headlineSize = Math.max(eligibleAfterRefresh, eligibleToday);

  // Plain-language label for the segment — UI shows this, the audit JSON
  // keeps the technical name underneath.
  const segmentLabel: Record<typeof segment, string> = {
    "At-Risk": "lapsed buyers",
    "Loyal": "loyal regulars",
    "High-Value": "top spenders",
    "New": "new arrivals",
    "Occasional": "occasional buyers",
  };
  const friendlySegment = segmentLabel[segment];
  const friendlyChannel = primaryChannel.charAt(0).toUpperCase() + primaryChannel.slice(1);

  const envelope: Envelope = {
    agent: "fallback-audience-researcher",
    version: "0.4",
    verdict: "WARN",
    findings: [
      {
        claim: `Reading "${concept.audience_hint}" as ${friendlySegment} in your customer file.`,
        evidence:
          "Your customer database tags people as Loyal, At-Risk, High-Value, New, or Occasional.",
        severity: "info",
      },
      {
        claim: `Total reachable audience: ${headlineSize.toLocaleString()} ${friendlySegment} — ${eligibleToday.toLocaleString()} you can send to today, ${(headlineSize - eligibleToday).toLocaleString()} more after a quick consent refresh.`,
        evidence: `Starting pool: ${counts.raw_segment_country_match} ${friendlySegment} in your countries. We held back ${dropFromExclusion("retention_expired")} whose data permissions need renewing, ${dropFromExclusion("channel_opt_in_false")} who haven't opted in to ${friendlyChannel}, and ${dropFromExclusion("no_consent_record")} with no consent record on file.`,
        severity: "info",
      },
      {
        claim: `${counts.consent_records_expired} of ${counts.consent_records_total} customers need a fresh consent review.`,
        evidence: "Most of the file falls outside its retention window — a quick refresh would unlock them.",
        severity: "warn",
      },
      {
        claim: `${friendlyChannel} will go out through ${platform}.`,
        evidence: "This is the default routing for this channel.",
        severity: "info",
      },
    ],
    rationale: `${friendlySegment} resolved live from your customer data. The numbers above are counted, not estimated.`,
    inputs_hash,
    source: "fallback-missing",
    agent_path: null,
  };

  return {
    segment_name: `${friendlySegment} · ${friendlyChannel} · ${platform}`,
    size_estimate: headlineSize,
    key_attributes: [
      `${friendlySegment} in your customer file`,
      `Active account, not suspended`,
      `Opted in to ${friendlyChannel}`,
      `Hasn't opted out or asked us to delete their data`,
      counts.eligible > 0
        ? `Within their data permission window`
        : `Permission window expired — needs a refresh before sending`,
    ],
    dataset_gaps: [
      `${counts.missing_consent} customers have no consent record on file`,
      `${counts.consent_records_expired} of ${counts.consent_records_total} need a consent refresh`,
      `Some anonymous shoppers can't be linked back to a customer account yet`,
    ],
    confidence: headlineSize >= 20 ? "HIGH" : headlineSize >= 5 ? "MEDIUM" : "LOW",
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
      claim: `${friendlyCh(primaryChannel)} at this cadence fits this audience.`,
      evidence:
        "Past campaigns to this segment used the same channel and timing successfully.",
      severity: "info",
    },
    {
      claim: `Audience size of ${audience.size_estimate.toLocaleString()} is the right scale for this kind of send.`,
      evidence:
        "Big enough to learn from, small enough to handle with care.",
      severity: "info",
    },
  ];

  if (platformIsUS) {
    findings.push({
      claim:
        "Your audience data leaves the EU to reach a US-based platform.",
      evidence:
        "Standard for tools like Klaviyo, Braze, Meta, and Google Ads — needs the cross-border agreement on file.",
      severity: "warn",
    });
  }

  const verdict = findings.some((f) => f.severity === "warn") ? "WARN" : "OK";

  const envelope: Envelope = {
    agent: "fallback-storyline-validator",
    version: "0.3",
    verdict,
    findings,
    rationale:
      "The story fits together. The one thing to call out in the brief is where the audience data goes.",
    inputs_hash,
    source: "fallback-missing",
    agent_path: null,
  };
  return { envelope };
}

function friendlyCh(c: string): string {
  const m: Record<string, string> = {
    email: "Email",
    sms: "SMS",
    "push notification": "Push",
    push: "Push",
    "paid social": "Paid social",
    "paid search": "Paid search",
    "on-site banner": "On-site banner",
  };
  return m[c.toLowerCase()] || c;
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
    version: "0.3",
    verdict: "WARN",
    findings: [
      {
        claim: `Sending under marketing consent — only people who opted in to ${friendlyCh(primaryChannel)} will receive this.`,
        evidence:
          "Lawful basis under GDPR / ePrivacy is the customer's own opt-in, captured at signup or in the preference centre.",
        severity: "info",
      },
      {
        claim:
          "Unsubscribed customers, deletion requests, and withdrawn consents are excluded automatically.",
        evidence: "Standard suppression — no extra checklist needed from you.",
        severity: "info",
      },
      {
        claim: "Heads up: your audience data leaves the EU to reach the sending platform.",
        evidence:
          "Most tools (Klaviyo, Braze, Meta, Google) are US-based. Ask your DPO to confirm the data transfer agreement is current before send.",
        severity: "warn",
      },
      {
        claim: "We'll skip anyone whose data permissions have lapsed.",
        evidence:
          "Each customer has a retention date — once it passes, we stop sending until consent is refreshed.",
        severity: "info",
      },
    ],
    rationale:
      "Nothing blocking. One thing for the brief: confirm the data transfer agreement covers this send.",
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

  const niceChannels =
    concept.channels.map((c) => (c === "sms" ? "SMS" : c.charAt(0).toUpperCase() + c.slice(1))).join(", ") || "—";

  const markdown = `# Campaign Brief

**Status:** ${status === "OK" ? "Ready to send" : status === "WARN" ? "Ready, with one thing to confirm" : status === "BLOCKED" ? "Not ready — see below" : "Partial"}
**Reference:** ${request_id}

## The idea

${concept.goal}

## Who we're sending to

**${audience.segment_name}** — about ${audience.size_estimate.toLocaleString()} people, confidence ${audience.confidence.toLowerCase()}.

What we know about them:
${audience.key_attributes.map((a) => `- ${a}`).join("\n")}

${audience.dataset_gaps.length ? `Things to keep in mind:\n${audience.dataset_gaps.map((g) => `- ${g}`).join("\n")}` : ""}

## How it goes out

- **Channel:** ${niceChannels}
- **Timing:** ${concept.timing || "—"}
- **Tone:** ${concept.tone || "considered"}

## What we checked

**The story:** ${storyline.envelope.rationale}

**Legal &amp; consent:** ${legal.envelope.rationale}

${concept.kpi ? `## What success looks like\n\n${concept.kpi}\n` : ""}
${concept.constraints ? `## Notes\n\n${concept.constraints}` : ""}

---

*Created by Smelling Pretty. The detailed envelopes are in audit.json.*
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
