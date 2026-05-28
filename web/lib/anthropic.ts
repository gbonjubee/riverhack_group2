import { promises as fs } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

// Defensive env loader.
//
// Next.js precedence is `shell env > .env.local`. When the dev server is
// launched from inside an isolated subprocess (e.g. a Claude Code session
// that sets ANTHROPIC_API_KEY="" for sandbox isolation), an empty shell
// value overrides whatever the user puts in .env.local. To stay robust:
//
// 1. Prefer process.env if it has a real-looking value (length > 10).
// 2. Otherwise fall back to reading .env.local from the project root.
//
// This costs one file read at module init and never again. It is safe —
// the file is gitignored and only read locally.

function loadKeyFromEnvLocal(): string {
  try {
    // Node's require is sync; using readFileSync here is fine at startup.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fsSync = require("node:fs") as typeof import("node:fs");
    const p = path.join(process.cwd(), ".env.local");
    const text = fsSync.readFileSync(p, "utf8");
    const m = text.match(/^[ \t]*ANTHROPIC_API_KEY[ \t]*=[ \t]*(.*?)[ \t]*$/m);
    if (!m) return "";
    return m[1].replace(/^["']|["']$/g, "").trim();
  } catch {
    return "";
  }
}

function resolveApiKey(): string {
  const fromEnv = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (fromEnv.length > 10) return fromEnv;
  return loadKeyFromEnvLocal();
}

const apiKey = resolveApiKey();

export function hasApiKey(): boolean {
  return Boolean(apiKey && apiKey.length > 10);
}

export function apiKeyDiagnostic() {
  return {
    has_key: hasApiKey(),
    key_length: apiKey.length,
    key_first_5: apiKey.slice(0, 5),
    came_from:
      (process.env.ANTHROPIC_API_KEY || "").trim().length > 10
        ? "process.env"
        : apiKey.length > 0
          ? ".env.local (fallback)"
          : "<not found>",
  };
}

let _client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (!hasApiKey()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!_client) _client = new Anthropic({ apiKey });
  return _client;
}

// Pin the resolved key so the Anthropic SDK doesn't try to read process.env
// itself (it would also get the empty value).
export const RESOLVED_API_KEY = apiKey;

export type CallAgentOptions = {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  model?: string;
};

export const DEFAULT_MODELS = {
  fast: "claude-haiku-4-5-20251001",
  storyline: "claude-opus-4-7",
} as const;

export async function callAgent({
  systemPrompt,
  userMessage,
  maxTokens = 3000,
  model = DEFAULT_MODELS.fast,
}: CallAgentOptions): Promise<string> {
  const client = getClient();
  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  const block = resp.content[0];
  if (block.type !== "text") return "";
  return block.text;
}

// Re-export so route handlers can keep importing it from this module.
export { fs };
