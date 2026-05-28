import Anthropic from "@anthropic-ai/sdk";

// Thin wrapper around the Anthropic SDK. The hackathon constraint is that
// the app must remain demoable even with no API key — so callers should
// check `hasApiKey()` and fall back to mocks when this returns false.

const apiKey = process.env.ANTHROPIC_API_KEY;

export function hasApiKey(): boolean {
  return Boolean(apiKey && apiKey.length > 10);
}

let _client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (!hasApiKey()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!_client) _client = new Anthropic({ apiKey });
  return _client;
}

export type CallAgentOptions = {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  model?: string;
};

// Default model per agent role — Haiku for fast/cheap rule following,
// stronger models when the output is the user-facing artifact.
export const DEFAULT_MODELS = {
  fast: "claude-haiku-4-5-20251001",
  storyline: "claude-opus-4-7", // senior-strategist prose needs the strongest model
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
