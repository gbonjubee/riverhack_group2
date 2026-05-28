import { NextResponse } from "next/server";
import { resolveAgent, listAllDiscovered, type AgentRole } from "@/lib/agents";
import { hasApiKey } from "@/lib/anthropic";

// Discovery snapshot — what agent/skill files exist in the repo at runtime,
// which canonical role they fill, and whether the app will dispatch real
// calls or fall back to mocks. Useful during the demo: open
// /api/orchestrator/health to show the audience what's wired up.

const ROLES: AgentRole[] = [
  "brainstormer",
  "audience-researcher",
  "storyline-validator",
  "legal-validator",
];

export async function GET() {
  const [discovery, all] = await Promise.all([
    Promise.all(ROLES.map((r) => resolveAgent(r))),
    listAllDiscovered(),
  ]);

  return NextResponse.json({
    apiKey: hasApiKey(),
    useRealAgents: process.env.USE_REAL_AGENTS === "true",
    roles: discovery,
    all_discovered: all.map((c) => ({
      name: c.name,
      type: c.type,
      path: c.path,
    })),
    note: hasApiKey()
      ? process.env.USE_REAL_AGENTS === "true"
        ? "Real agent dispatch is enabled. Found agents/skills will be called via Claude; missing ones fall back to mocks."
        : "API key is set but USE_REAL_AGENTS != 'true'. Set USE_REAL_AGENTS=true in .env.local to dispatch real calls."
      : "No ANTHROPIC_API_KEY set — all phases use inline mocks. Demo still works end-to-end.",
  });
}
