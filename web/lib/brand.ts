// Single source of truth for brand-level strings.
export const AGENT_NAME = "Smelling Pretty";
export const HOUSE_NAME = "smelling pretty";
export const TAGLINE = "the calm way to plan your next campaign";

export const PHASES = [
  { key: "intake", label: "your idea", subtitle: "what you want to send" },
  { key: "discovery", label: "your audience", subtitle: "who we can reach today" },
  { key: "reflection", label: "the check", subtitle: "what to watch for" },
  { key: "brief", label: "your brief", subtitle: "the one-pager" },
  { key: "storyline", label: "the storyline", subtitle: "the case for it" },
] as const;

export type PhaseKey = (typeof PHASES)[number]["key"];
