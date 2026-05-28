import { NextResponse } from "next/server";
import { mockBrief } from "@/lib/mocks";
import type {
  AudienceProfile,
  CampaignConcept,
  ValidationResult,
} from "@/lib/types";

// Final phase. The orchestrator already has the three specialist envelopes
// from previous calls; this route just assembles the brief.md content and
// audit.json from them. No further model calls are needed at this stage —
// the rendering is deterministic.

export async function POST(req: Request) {
  const { concept, audience, storyline, legal } = (await req.json()) as {
    concept: CampaignConcept;
    audience: AudienceProfile;
    storyline: ValidationResult;
    legal: ValidationResult;
  };

  const brief = mockBrief(concept, audience, storyline, legal);
  return NextResponse.json(brief);
}
