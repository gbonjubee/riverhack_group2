// Single source of truth for brand-level strings.
// The AI agent does not have a name yet — keep AGENT_NAME as a clearly
// marked placeholder so it's trivial to swap in later.
export const AGENT_NAME = "[ name pending ]";
export const HOUSE_NAME = "atelier";
export const TAGLINE =
  "a slow, considered way to plan a marketing activation";

export const PHASES = [
  { key: "intake", label: "intake", subtitle: "what we're planning" },
  { key: "discovery", label: "discovery", subtitle: "who we're talking to" },
  { key: "reflection", label: "reflection", subtitle: "is the story right" },
  { key: "brief", label: "the brief", subtitle: "what we send onward" },
  { key: "storyline", label: "storyline", subtitle: "the argument, in words" },
] as const;

export type PhaseKey = (typeof PHASES)[number]["key"];
