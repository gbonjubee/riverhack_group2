"use client";

import type {
  AudienceProfile,
  CampaignConcept,
  FinalBrief,
  StorylineOutput,
  ValidationResult,
} from "./types";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request to ${url} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

export const api = {
  audienceResearch: (concept: CampaignConcept) =>
    post<AudienceProfile>("/api/agents/audience-researcher", { concept }),
  storylineValidate: (concept: CampaignConcept, audience: AudienceProfile) =>
    post<ValidationResult>("/api/agents/storyline-validator", {
      concept,
      audience,
    }),
  legalValidate: (concept: CampaignConcept, audience: AudienceProfile) =>
    post<ValidationResult>("/api/agents/legal-validator", {
      concept,
      audience,
    }),
  compose: (
    concept: CampaignConcept,
    audience: AudienceProfile,
    storyline: ValidationResult,
    legal: ValidationResult,
  ) =>
    post<FinalBrief>("/api/orchestrator/compose", {
      concept,
      audience,
      storyline,
      legal,
    }),
  storyline: (
    concept: CampaignConcept,
    audience: AudienceProfile,
    storyline: ValidationResult,
    legal: ValidationResult,
    brief: FinalBrief,
  ) =>
    post<StorylineOutput>("/api/agents/storyline", {
      concept,
      audience,
      storyline,
      legal,
      brief,
    }),
};
