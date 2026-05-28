import { NextResponse } from "next/server";
import { apiKeyDiagnostic } from "@/lib/anthropic";

// Diagnostic only. Reports which env vars are actually visible to the
// Next.js server runtime + whether our defensive .env.local fallback
// resolved a key. Safe — only returns metadata, never the key value.

export async function GET() {
  const allKeys = Object.keys(process.env).sort();
  const anthropicVars = allKeys.filter((k) =>
    /anthropic|use_real|claude/i.test(k),
  );
  const key = process.env.ANTHROPIC_API_KEY || "";
  return NextResponse.json({
    cwd: process.cwd(),
    node_env: process.env.NODE_ENV,
    resolved_key: apiKeyDiagnostic(),
    process_env_view: {
      anthropic_api_key_typeof: typeof process.env.ANTHROPIC_API_KEY,
      anthropic_api_key_length: key.length,
      anthropic_api_key_first_5: key.slice(0, 5),
      use_real_agents: process.env.USE_REAL_AGENTS || "<unset>",
    },
    total_env_var_count: allKeys.length,
    anthropic_related_vars: anthropicVars.map((k) => ({
      name: k,
      length: (process.env[k] || "").length,
      first_5: (process.env[k] || "").slice(0, 5),
    })),
  });
}
