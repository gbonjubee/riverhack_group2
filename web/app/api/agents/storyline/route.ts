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
  const t0 = Date.now();
  const { concept, audience, storyline, legal, brief } = (await req.json()) as {
    concept: CampaignConcept;
    audience: AudienceProfile;
    storyline: ValidationResult;
    legal: ValidationResult;
    brief: FinalBrief;
  };

  const resolved = await resolveAgent("marketing-storyline");
  const useReal = process.env.USE_REAL_AGENTS === "true" && hasApiKey();

  console.log(
    `[storyline] dispatch decision — useReal=${useReal} skillFound=${resolved.found} apiKey=${hasApiKey()} useRealAgents=${process.env.USE_REAL_AGENTS}`,
  );

  // Deterministic template is the safety floor — never let the demo crash.
  const fallback = generateStoryline(concept, audience, storyline, legal, brief);

  if (resolved.found && useReal) {
    console.log(`[storyline] → calling Claude (Opus 4.7) with skill ${resolved.path}`);
    const llmStart = Date.now();
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
      const llmMs = Date.now() - llmStart;
      if (real) {
        console.log(`[storyline] ✓ LLM responded in ${llmMs}ms — using real output`);
        real.source = "agent";
        return NextResponse.json({
          ...real,
          _debug: { source: "agent", llm_ms: llmMs, total_ms: Date.now() - t0 },
        });
      }
      console.log(`[storyline] ✗ LLM responded in ${llmMs}ms but JSON parse failed — falling back to template`);
      fallback.source = "fallback-after-error";
      return NextResponse.json({
        ...fallback,
        _debug: { source: "fallback-after-error", llm_ms: llmMs, parse_failed: true, total_ms: Date.now() - t0 },
      });
    } catch (err) {
      const llmMs = Date.now() - llmStart;
      console.log(`[storyline] ✗ LLM call threw after ${llmMs}ms:`, err instanceof Error ? err.message : err);
      fallback.source = "fallback-after-error";
      return NextResponse.json({
        ...fallback,
        _debug: {
          source: "fallback-after-error",
          llm_ms: llmMs,
          error: err instanceof Error ? err.message : String(err),
          total_ms: Date.now() - t0,
        },
      });
    }
  }

  console.log(
    `[storyline] → using template (no LLM dispatch). Reason: ${!useReal ? "useReal=false (check ANTHROPIC_API_KEY + USE_REAL_AGENTS=true in .env.local)" : "no skill file found"}`,
  );
  fallback.source = "fallback-missing";
  return NextResponse.json({
    ...fallback,
    _debug: {
      source: "fallback-missing",
      llm_ms: 0,
      total_ms: Date.now() - t0,
      reason: !useReal
        ? `useReal=false (apiKey=${hasApiKey()}, useRealAgents=${process.env.USE_REAL_AGENTS})`
        : "no skill file resolved",
    },
  });
}
