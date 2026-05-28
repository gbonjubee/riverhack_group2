import { NextResponse } from "next/server";
import { resolveAgent, readAgentPrompt } from "@/lib/agents";
import { hasApiKey, callAgent, DEFAULT_MODELS } from "@/lib/anthropic";
import { mockLegal } from "@/lib/mocks";
import type {
  AudienceProfile,
  CampaignConcept,
  Envelope,
  ValidationResult,
} from "@/lib/types";

const INLINE_PROMPT = `You are the legal/consent validator in a marketing-brief pipeline.
Your job: read the campaign concept and audience profile, then surface the consent, lawful-basis, and cross-border data-transfer questions a senior marketer needs to know before they send.

Voice rules: plain, direct, lightly Dutch. Translate jargon into outcomes. Say "your audience data leaves the EU" rather than "cross-border SCC required". Be honest, not alarmist.

Return ONLY a JSON object — no markdown fence, no commentary — with this exact shape:

{
  "verdict": "OK" | "WARN" | "BLOCK",
  "findings": [
    { "claim": "1-line plain-English finding", "evidence": "1-line why", "severity": "info" | "warn" | "block" }
  ],
  "rationale": "2-3 sentence summary of the consent/legal posture."
}

Almost always WARN, never block unless there's a hard issue (e.g. no lawful basis at all). 3-5 findings.`;

export async function POST(req: Request) {
  const t0 = Date.now();
  const { concept, audience } = (await req.json()) as {
    concept: CampaignConcept;
    audience: AudienceProfile;
  };

  const resolved = await resolveAgent("legal-validator");
  const useReal = process.env.USE_REAL_AGENTS === "true" && hasApiKey();

  console.log(
    `[legal-validator] dispatch — useReal=${useReal} skillFound=${resolved.found}`,
  );

  const fallback = mockLegal(concept, audience);

  if (useReal) {
    console.log(`[legal-validator] → calling Claude (Haiku 4.5)`);
    const llmStart = Date.now();
    try {
      const system = resolved.found
        ? await readAgentPrompt(resolved.path!)
        : INLINE_PROMPT;
      const userMsg = `Inputs:\n\`\`\`json\n${JSON.stringify({ concept, audience: { segment_name: audience.segment_name, size_estimate: audience.size_estimate, key_attributes: audience.key_attributes, dataset_gaps: audience.dataset_gaps } }, null, 2)}\n\`\`\``;
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
          agent: "legal-validator",
          version: "1.0",
          verdict: parsed.verdict ?? "WARN",
          findings: parsed.findings ?? [],
          rationale: parsed.rationale ?? "",
          inputs_hash: `live_${llmStart}`,
          source: "agent",
          agent_path: resolved.path,
        };
        console.log(`[legal-validator] ✓ Claude in ${llmMs}ms — ${parsed.verdict}`);
        return NextResponse.json({
          envelope,
          _debug: { source: "agent", llm_ms: llmMs, total_ms: Date.now() - t0 },
        });
      }
      console.log(`[legal-validator] ✗ parse failed in ${llmMs}ms → fallback`);
      fallback.envelope.source = "fallback-after-error";
      return NextResponse.json({ ...fallback, _debug: { source: "fallback-after-error", llm_ms: llmMs, total_ms: Date.now() - t0 } });
    } catch (err) {
      const llmMs = Date.now() - llmStart;
      console.log(`[legal-validator] ✗ error in ${llmMs}ms:`, err instanceof Error ? err.message : err);
      fallback.envelope.source = "fallback-after-error";
      return NextResponse.json({ ...fallback, _debug: { source: "fallback-after-error", llm_ms: llmMs, error: err instanceof Error ? err.message : String(err), total_ms: Date.now() - t0 } });
    }
  }

  console.log(`[legal-validator] → template (no dispatch)`);
  return NextResponse.json({ ...fallback, _debug: { source: "fallback-missing", llm_ms: 0, total_ms: Date.now() - t0 } });
}
