import { NextResponse } from "next/server";
import { resolveAgent } from "@/lib/agents";
import { hasApiKey } from "@/lib/anthropic";
import { generateStoryline } from "@/lib/storyline";
import type {
  AudienceProfile,
  CampaignConcept,
  FinalBrief,
  ValidationResult,
} from "@/lib/types";

export async function POST(req: Request) {
  const { concept, audience, storyline, legal, brief } = (await req.json()) as {
    concept: CampaignConcept;
    audience: AudienceProfile;
    storyline: ValidationResult;
    legal: ValidationResult;
    brief: FinalBrief;
  };

  // Resolve the skill so /health can show it's wired up — the deterministic
  // template generator is the MVP floor either way.
  const resolved = await resolveAgent("marketing-storyline");
  const useReal = process.env.USE_REAL_AGENTS === "true" && hasApiKey();

  const out = generateStoryline(concept, audience, storyline, legal, brief);

  // When real dispatch is enabled and the skill file exists, this is where
  // we'd send SKILL.md + inputs to Claude and parse the response back into
  // markdown + HTML. For now the template generator is canonical.
  out.source =
    resolved.found && useReal ? "fallback-after-error" : "fallback-missing";

  return NextResponse.json(out);
}
