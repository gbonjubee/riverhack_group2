import { promises as fs } from "node:fs";
import path from "node:path";

// Discovery layer for the orchestrator.
//
// Scans BOTH dispatch locations:
//   - `<repo>/.claude/agents/<name>.md`       (subagent files)
//   - `<repo>/.claude/skills/<name>/SKILL.md` (skill folders)
//
// Aliases let teammates pick different filenames and still resolve to the
// right canonical role. (Underscore aliases included because some teammates
// use `read_data` style — we accept both.)
//
// IMPORTANT: This intentionally reads from the repo's `.claude/`, NOT from
// the user's home `~/.claude/`. The hackathon constraint is repo-local only.

const REPO_ROOT = path.resolve(process.cwd(), ".."); // web/ -> repo root
const AGENTS_DIR = path.join(REPO_ROOT, ".claude", "agents");
const SKILLS_DIR = path.join(REPO_ROOT, ".claude", "skills");

export type AgentRole =
  | "brainstormer"
  | "audience-researcher"
  | "storyline-validator"
  | "legal-validator"
  | "marketing-storyline";

const ALIASES: Record<AgentRole, string[]> = {
  brainstormer: [
    "brainstormer",
    "brief-intake",
    "intake",
    "brainstorm",
    "discovery",
    "concept",
  ],
  "audience-researcher": [
    // primary real implementation by teammate:
    "audience-finder",
    "audience_finder",
    "audience-researcher",
    "audience_researcher",
    "researcher",
    "audience",
    "data-mapper",
    "dataset",
    // supporting docs that count as the role if no real finder exists:
    "data-info",
    "data_info",
    "read-data",
    "read_data",
  ],
  "storyline-validator": [
    "storyline-validator",
    "storyline_validator",
    "storyline",
    "coherence-validator",
    "narrative-validator",
  ],
  "legal-validator": [
    "legal-validator",
    "legal_validator",
    "compliance",
    "compliance-officer",
    "gdpr",
    "legal",
  ],
  "marketing-storyline": [
    "marketing-storyline",
    "marketing_storyline",
    "storyline-composer",
    "narrative-builder",
    "senior-strategist",
    "marketing-storyteller",
  ],
};

export type DispatchType = "agent" | "skill";

export type ResolvedAgent = {
  role: AgentRole;
  found: boolean;
  path: string | null;
  dispatch_type: DispatchType | null;
  matched_via: "primary" | "alias" | null;
  alias_used?: string;
};

type Candidate = { name: string; path: string; type: DispatchType };

async function listAgentFiles(): Promise<Candidate[]> {
  try {
    const files = await fs.readdir(AGENTS_DIR);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({
        name: f.replace(/\.md$/, ""),
        path: path.join(AGENTS_DIR, f),
        type: "agent" as const,
      }));
  } catch {
    return [];
  }
}

async function listSkillFiles(): Promise<Candidate[]> {
  try {
    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    const out: Candidate[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const skillFile = path.join(SKILLS_DIR, e.name, "SKILL.md");
      try {
        await fs.access(skillFile);
        out.push({ name: e.name, path: skillFile, type: "skill" });
      } catch {
        /* no SKILL.md in this folder, skip */
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function listAllDiscovered(): Promise<Candidate[]> {
  const [a, s] = await Promise.all([listAgentFiles(), listSkillFiles()]);
  return [...a, ...s];
}

export async function resolveAgent(role: AgentRole): Promise<ResolvedAgent> {
  const all = await listAllDiscovered();
  const byName = new Map(all.map((c) => [c.name, c] as const));
  const aliases = ALIASES[role];

  for (let i = 0; i < aliases.length; i++) {
    const candidate = aliases[i];
    const hit = byName.get(candidate);
    if (hit) {
      return {
        role,
        found: true,
        path: hit.path,
        dispatch_type: hit.type,
        matched_via: i === 0 ? "primary" : "alias",
        alias_used: i === 0 ? undefined : candidate,
      };
    }
  }
  return { role, found: false, path: null, dispatch_type: null, matched_via: null };
}

export async function readAgentPrompt(filePath: string): Promise<string> {
  return await fs.readFile(filePath, "utf-8");
}
