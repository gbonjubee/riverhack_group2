import { NextResponse } from "next/server";
import { resolveAgent, readAgentPrompt } from "@/lib/agents";
import { hasApiKey, callAgent } from "@/lib/anthropic";
import { mockAudience } from "@/lib/mocks";
import type { CampaignConcept, AudienceProfile } from "@/lib/types";

export async function POST(req: Request) {
  const { concept } = (await req.json()) as { concept: CampaignConcept };

  const resolved = await resolveAgent("audience-researcher");
  const useReal = process.env.USE_REAL_AGENTS === "true" && hasApiKey();

  if (resolved.found && useReal) {
    try {
      const system = await readAgentPrompt(resolved.path!);
      const userMsg = `Campaign concept:\n${JSON.stringify(concept, null, 2)}\n\nReturn ONLY a JSON object matching the AudienceProfile schema with an envelope field.`;
      const raw = await callAgent({ systemPrompt: system, userMessage: userMsg });
      const parsed = safeParse<AudienceProfile>(raw);
      if (parsed) {
        // Tag provenance.
        parsed.envelope.source = "agent";
        parsed.envelope.agent_path = resolved.path;
        return NextResponse.json(parsed);
      }
      // Parsing failed — fall through to mock with explicit reason.
      const fb = mockAudience(concept);
      fb.envelope.source = "fallback-after-error";
      fb.envelope.agent_path = resolved.path;
      return NextResponse.json(fb);
    } catch {
      const fb = mockAudience(concept);
      fb.envelope.source = "fallback-after-error";
      fb.envelope.agent_path = resolved.path;
      return NextResponse.json(fb);
    }
  }

  const fb = mockAudience(concept);
  fb.envelope.source = resolved.found ? "fallback-missing" : "fallback-missing";
  return NextResponse.json(fb);
}

function safeParse<T>(raw: string): T | null {
  // Try to find the first {...} JSON block in the response.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
