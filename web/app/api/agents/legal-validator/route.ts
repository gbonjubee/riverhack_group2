import { NextResponse } from "next/server";
import { resolveAgent, readAgentPrompt } from "@/lib/agents";
import { hasApiKey, callAgent } from "@/lib/anthropic";
import { mockLegal } from "@/lib/mocks";
import type {
  AudienceProfile,
  CampaignConcept,
  ValidationResult,
} from "@/lib/types";

export async function POST(req: Request) {
  const { concept, audience } = (await req.json()) as {
    concept: CampaignConcept;
    audience: AudienceProfile;
  };

  const resolved = await resolveAgent("legal-validator");
  const useReal = process.env.USE_REAL_AGENTS === "true" && hasApiKey();

  if (resolved.found && useReal) {
    try {
      const system = await readAgentPrompt(resolved.path!);
      const userMsg = `Inputs:\n${JSON.stringify({ concept, audience }, null, 2)}\n\nReturn ONLY a JSON object matching the ValidationResult schema with an envelope field.`;
      const raw = await callAgent({ systemPrompt: system, userMessage: userMsg });
      const parsed = safeParse<ValidationResult>(raw);
      if (parsed) {
        parsed.envelope.source = "agent";
        parsed.envelope.agent_path = resolved.path;
        return NextResponse.json(parsed);
      }
      const fb = mockLegal(concept, audience);
      fb.envelope.source = "fallback-after-error";
      fb.envelope.agent_path = resolved.path;
      return NextResponse.json(fb);
    } catch {
      const fb = mockLegal(concept, audience);
      fb.envelope.source = "fallback-after-error";
      fb.envelope.agent_path = resolved.path;
      return NextResponse.json(fb);
    }
  }

  return NextResponse.json(mockLegal(concept, audience));
}

function safeParse<T>(raw: string): T | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
