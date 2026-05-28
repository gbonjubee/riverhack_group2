// Shared envelope and domain types for the marketing-activation pipeline.

export type Verdict = "OK" | "WARN" | "BLOCK";

export type Finding = {
  claim: string;
  evidence: string;
  severity: "info" | "warn" | "block";
};

export type Envelope = {
  agent: string;
  version: string;
  verdict: Verdict;
  findings: Finding[];
  rationale: string;
  // sha-256 of canonical-JSON inputs the specialist received; lets us prove
  // later which inputs each agent actually saw.
  inputs_hash: string;
  // provenance — whether this came from a real agent file or an inline fallback
  source: "agent" | "fallback-missing" | "fallback-after-error" | "mock";
  agent_path?: string | null;
};

export type CampaignConcept = {
  goal: string;
  audience_hint: string;
  channels: string[];
  tone: string;
  timing: string;
  kpi: string;
  constraints: string;
};

export type AudienceProfile = {
  segment_name: string;
  size_estimate: number;
  key_attributes: string[];
  dataset_gaps: string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
  envelope: Envelope;
};

export type ValidationResult = {
  envelope: Envelope;
};

export type BriefStatus = "OK" | "WARN" | "PARTIAL" | "BLOCKED";

export type FinalBrief = {
  status: BriefStatus;
  concept: CampaignConcept;
  audience: AudienceProfile;
  storyline: ValidationResult;
  legal: ValidationResult;
  markdown: string;
  audit: object;
  request_id: string;
};

export type StorylineOutput = {
  title: string;
  tension: string;          // the one-line opening line under the title
  markdown: string;         // the full storyline doc, in chat-friendly markdown
  html: string;             // self-contained scrollytelling HTML
  request_id: string;
  source: "agent" | "fallback-missing" | "fallback-after-error" | "mock";
};
