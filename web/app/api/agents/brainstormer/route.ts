import { NextResponse } from "next/server";
import { resolveAgent } from "@/lib/agents";

// The brainstormer intake is currently driven by a hardcoded wizard in
// components/phases/Intake.tsx. This endpoint exists so that when a
// teammate ships a real brainstormer agent at .claude/agents/brainstormer.md
// (or any alias), the UI can swap to dynamic question generation.
//
// For now: GET returns the schema of what the wizard collects, plus the
// status of agent discovery so the demo can show "agent found / missing".

export async function GET() {
  const resolved = await resolveAgent("brainstormer");
  return NextResponse.json({
    role: "brainstormer",
    discovery: resolved,
    schema: {
      goal: "string",
      audience_hint: "string",
      channels: "string[]",
      tone: "string",
      timing: "string",
      kpi: "string",
      constraints: "string",
    },
    note:
      "Intake currently uses an inline hardcoded wizard. Drop a brainstormer.md (or alias) into .claude/agents/ to enable dynamic question generation.",
  });
}
