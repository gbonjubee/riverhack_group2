import { NextResponse } from "next/server";
import { resolveAgent, listAllDiscovered, type AgentRole } from "@/lib/agents";
import { hasApiKey, apiKeyDiagnostic } from "@/lib/anthropic";

// Discovery + dispatch-readiness snapshot. Hit this URL any time to see why
// (or whether) LLM dispatch is enabled. The diagnostic is explicit about
// every guard, so it's obvious what to fix if a stage isn't dispatching.

const ROLES: AgentRole[] = [
  "brainstormer",
  "audience-researcher",
  "storyline-validator",
  "legal-validator",
  "marketing-storyline",
];

export async function GET() {
  const [roleResults, all] = await Promise.all([
    Promise.all(ROLES.map((r) => resolveAgent(r))),
    listAllDiscovered(),
  ]);

  const apiKey = hasApiKey();
  const keyDiag = apiKeyDiagnostic();
  const useRealFlag = process.env.USE_REAL_AGENTS === "true";
  const dispatchEnabled = apiKey && useRealFlag;

  const guards = {
    "1_anthropic_api_key_resolved": keyDiag.has_key,
    "2_key_came_from": keyDiag.came_from,
    "3_key_length": keyDiag.key_length,
    "4_key_first_5_chars": keyDiag.key_first_5,
    "5_use_real_agents_flag_true": useRealFlag,
    "6_dispatch_enabled_overall": dispatchEnabled,
  };

  // Per-role view of whether the route WOULD dispatch on the next request.
  const roleDispatch = roleResults.map((r) => ({
    role: r.role,
    skill_found: r.found,
    path: r.path,
    matched_via: r.matched_via,
    alias_used: r.alias_used,
    would_dispatch_real_llm: dispatchEnabled && r.found,
    reason_if_not: !dispatchEnabled
      ? `dispatch globally disabled (apiKey=${apiKey}, useRealAgents=${useRealFlag})`
      : !r.found
        ? "no matching agent file found"
        : null,
  }));

  // Plain-English next step
  let nextStep: string;
  if (!keyDiag.has_key) {
    nextStep =
      "No key resolved. Paste your Anthropic key into web/.env.local on the ANTHROPIC_API_KEY= line, save, then RESTART `npm run dev`.";
  } else if (!useRealFlag) {
    nextStep = "Set USE_REAL_AGENTS=true in web/.env.local and restart `npm run dev`.";
  } else if (!roleDispatch.some((r) => r.would_dispatch_real_llm)) {
    nextStep = "Env is OK but no agent file resolves — add one in .claude/agents/ or .claude/skills/.";
  } else {
    nextStep =
      "All guards pass. Next request to a dispatching route will hit Claude. Watch the dev server logs for [storyline]/[storyline-validator]/[legal-validator] lines.";
  }

  return NextResponse.json({
    dispatch_enabled: dispatchEnabled,
    guards,
    use_real_agents_env: process.env.USE_REAL_AGENTS ?? "<unset>",
    roles: roleDispatch,
    all_discovered: all.map((c) => ({
      name: c.name,
      type: c.type,
    })),
    next_step: nextStep,
  });
}
