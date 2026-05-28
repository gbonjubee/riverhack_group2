# riverhack_group2

An agentic GenAI prototype that takes a plain-language activation request and produces an auditable "activation brief" (data needed, allowed usage, compliance flags, destinations, and rationale) in minutes.

## Repo layout

```
.claude/agents/       project-local subagents (orchestrator + specialists)
.claude/skills/       project-local skills (alternative dispatch path)
.claude/commands/     project-local slash commands
Data/                 the dummy customer activation dataset
web/                  Next.js web app (the local UI for the agents)
main.py               Python data-exploration scratch
```

## Running the web app locally

The web app is in [`web/`](web). It runs on `http://localhost:3000` and provides a Rituals-inspired UI for the four-phase pipeline (intake → discovery → reflection → brief).

```bash
cd web
npm install         # first time only
npm run dev         # http://localhost:3000
```

Open the landing page, click **begin the ritual**, and walk through the four phases.

### Demo flexibility

The app is built to demo end-to-end **even when no specialist agents exist yet**. At every stage the route handler:

1. Scans `.claude/agents/*.md` for a matching agent file (with alias names accepted — see [`web/lib/agents.ts`](web/lib/agents.ts)).
2. If found AND `USE_REAL_AGENTS=true` AND `ANTHROPIC_API_KEY` is set, dispatches a Claude call using that agent's prompt.
3. Otherwise falls back to a plausible inline mock that uses the user's actual inputs.

Every envelope records its `source`: `"agent" | "fallback-missing" | "fallback-after-error" | "mock"`, so the audit trail is honest about what ran.

To see what's currently wired up, hit [`/api/orchestrator/health`](http://localhost:3000/api/orchestrator/health) — it returns a JSON snapshot of agent discovery and dispatch mode.

### Enabling real Claude dispatch

1. Copy `web/.env.local.example` → `web/.env.local`.
2. Set `ANTHROPIC_API_KEY` to your key.
3. Set `USE_REAL_AGENTS=true`.
4. Drop one or more agent files into `.claude/agents/` matching one of the canonical role names or aliases:
   - `brainstormer.md` (or `intake`, `brainstorm`, `discovery`, `concept`)
   - `audience-researcher.md` (or `researcher`, `audience`, `data-mapper`, `dataset`)
   - `storyline-validator.md` (or `storyline`, `coherence-validator`, `narrative-validator`)
   - `legal-validator.md` (or `compliance`, `compliance-officer`, `gdpr`, `legal`)
5. Restart `npm run dev`.

Each agent file's contents become the system prompt; inputs are sent as the user message; the response is parsed as JSON matching the schema in [`web/lib/types.ts`](web/lib/types.ts). Parse failures fall back to mocks automatically.

## Orchestrator design

See [`docs/orchestrator-design.md`](docs/orchestrator-design.md) for the locked four-stage workflow, envelope contract, and loop semantics on validation BLOCK. (Design is also encoded in code under `web/lib/` and the API routes.)

## Working with the dataset

`Data/Challenge_1_Dummy_data_costumer_activation_data_set.xlsx` — dummy customer activation data. `main.py` is a Python scratch for reading it; `pandas` and `openpyxl` are in `requirements.txt`.
