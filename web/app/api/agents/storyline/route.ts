import { NextResponse } from "next/server";
import { resolveAgent, readAgentPrompt } from "@/lib/agents";
import { hasApiKey } from "@/lib/anthropic";
import { generateStoryline, generateStorylineWithLLM } from "@/lib/storyline";
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

  const resolved = await resolveAgent("marketing-storyline");
  const useReal = process.env.USE_REAL_AGENTS === "true" && hasApiKey();

  // Deterministic template is the safety floor — never let the demo crash.
  const fallback = generateStoryline(concept, audience, storyline, legal, brief);

  if (resolved.found && useReal) {
    try {
      const system = await readAgentPrompt(resolved.path!);
      const real = await generateStorylineWithLLM(
        system,
        concept,
        audience,
        storyline,
        legal,
        brief,
      );
      if (real) {
        real.source = "agent";
        return NextResponse.json(real);
      }
      fallback.source = "fallback-after-error";
      return NextResponse.json(fallback);
    } catch {
      fallback.source = "fallback-after-error";
      return NextResponse.json(fallback);
    }
  }

  fallback.source = "fallback-missing";
  return NextResponse.json(fallback);
}
