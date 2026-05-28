import { NextResponse } from "next/server";
import { resolveAgent, readAgentPrompt } from "@/lib/agents";
import { hasApiKey, callAgent, DEFAULT_MODELS } from "@/lib/anthropic";
import { mockStoryline } from "@/lib/mocks";
import type {
  AudienceProfile,
  CampaignConcept,
  Envelope,
  ValidationResult,
} from "@/lib/types";

const INLINE_PROMPT = `You are the storyline validator in a marketing-brief pipeline.
Your job: read the campaign concept and the audience profile, and judge whether the story holds together — does the channel fit the audience, does the timing make sense, does the tone read as appropriate for the segment?

Voice rules: plain, direct, lightly Dutch. No "leverage", no "synergy", no urgency theatre. Be honest about weaknesses.

Return ONLY a JSON object — no markdown fence, no commentary — with this exact shape:

{
  "verdict": "OK" | "WARN" | "BLOCK",
  "findings": [
    { "claim": "1-line plain-English finding", "evidence": "1-line why", "severity": "info" | "warn" | "block" }
  ],
  "rationale": "2-3 sentence summary of why the story does or doesn't hold."
}

3-5 findings, varied severity. Prefer 'info' for things that work, 'warn' for things to call out, 'block' only for hard contradictions.`;

export async function POST(req: Request) {
  const t0 = Date.now();
  const { concept, audience } = (await req.json()) as {
    concept: CampaignConcept;
    audience: AudienceProfile;
  };

  const resolved = await resolveAgent("storyline-validator");
  const useReal = process.env.USE_REAL_AGENTS === "true" && hasApiKey();

  console.log(
    `[storyline-validator] dispatch — useReal=${useReal} skillFound=${resolved.found}`,
  );

  const fallback = mockStoryline(concept, audience);

  if (useReal) {
    console.log(`[storyline-validator] → calling Claude (Haiku 4.5)`);
    const llmStart = Date.now();
    try {
      // Use the skill prompt if a teammate has shipped one; otherwise the
      // inline prompt above.
      const system = resolved.found
        ? await readAgentPrompt(resolved.path!)
        : INLINE_PROMPT;
      const userMsg = `Inputs:\n\`\`\`json\n${JSON.stringify({ concept, audience: { segment_name: audience.segment_name, size_estimate: audience.size_estimate, key_attributes: audience.key_attributes, dataset_gaps: audience.dataset_gaps, confidence: audience.confidence } }, null, 2)}\n\`\`\``;
      const raw = await callAgent({
        systemPrompt: system,
        userMessage: userMsg,
        model: DEFAULT_MODELS.fast,
        maxTokens: 1500,
      });
      const llmMs = Date.now() - llmStart;
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const envelope: Envelope = {
          agent: "storyline-validator",
          version: "1.0",
          verdict: parsed.verdict ?? "WARN",
          findings: parsed.findings ?? [],
          rationale: parsed.rationale ?? "",
          inputs_hash: `live_${llmStart}`,
          source: "agent",
          agent_path: resolved.path,
        };
        console.log(`[storyline-validator] ✓ Claude in ${llmMs}ms — ${parsed.verdict}`);
        return NextResponse.json({
          envelope,
          _debug: { source: "agent", llm_ms: llmMs, total_ms: Date.now() - t0 },
        });
      }
      console.log(`[storyline-validator] ✗ parse failed in ${llmMs}ms → fallback`);
      fallback.envelope.source = "fallback-after-error";
      return NextResponse.json({ ...fallback, _debug: { source: "fallback-after-error", llm_ms: llmMs, total_ms: Date.now() - t0 } });
    } catch (err) {
      const llmMs = Date.now() - llmStart;
      console.log(`[storyline-validator] ✗ error in ${llmMs}ms:`, err instanceof Error ? err.message : err);
      fallback.envelope.source = "fallback-after-error";
      return NextResponse.json({ ...fallback, _debug: { source: "fallback-after-error", llm_ms: llmMs, error: err instanceof Error ? err.message : String(err), total_ms: Date.now() - t0 } });
    }
  }

  console.log(`[storyline-validator] → template (no dispatch)`);
  return NextResponse.json({ ...fallback, _debug: { source: "fallback-missing", llm_ms: 0, total_ms: Date.now() - t0 } });
}
