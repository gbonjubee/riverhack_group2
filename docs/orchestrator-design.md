# Orchestrator workflow

The pipeline is **sequential with one parallel fan-out**. Each stage produces an envelope that the next stage consumes; envelopes are recorded verbatim in `audit.json` for traceability.

## Stages

```
USER ─▶ orchestrator (no domain work — discovery, dispatch, gating)
         │
         ▼
   ┌──────────────────────┐
   │ 1. brainstormer       │  interactive Q&A with the user
   │    mode = fresh|revise │  → campaign_concept
   └──────────┬─────────────┘
              ▼
   ┌──────────────────────┐
   │ 2. audience-researcher │  reads the dataset
   │                       │  → audience_profile
   └──────────┬─────────────┘
              ▼
   ┌──────────────────────────────────┐
   │ 3. parallel validators           │  ← orchestrator fans out
   │    storyline-validator           │
   │    legal-validator               │
   └──────────┬───────────────────────┘
              ▼
       combined verdict?
              │
   BLOCK ─────┴────── iteration < 3 ?  → loop to brainstormer (mode=revise)
                                       │ exhausted? → blocked-brief.md
   OK / WARN
              ▼
   orchestrator composes → brief.md + audit.json
```

## Envelope (every specialist returns this shape)

```json
{
  "agent":       "<name>",
  "version":     "0.1",
  "verdict":     "OK | WARN | BLOCK",
  "findings":    [ { "claim": "...", "evidence": "...", "severity": "info|warn|block" } ],
  "rationale":   "1–3 sentences",
  "inputs_hash": "sha256 of the inputs received — proves what the agent saw",
  "source":      "agent | fallback-missing | fallback-after-error | mock",
  "agent_path":  ".claude/agents/...md or null"
}
```

## Combined verdict rule (stage 3)

| Storyline | Legal | Result |
|---|---|---|
| `OK` | `OK` | `OK` |
| any `WARN`, no `BLOCK` | | `WARN` |
| either `BLOCK` | | `BLOCK` → loop or blocked brief |

## Loop semantics

- Trigger: combined verdict = `BLOCK` AND iteration < `MAX_ITERATIONS` (3).
- Re-runs stages 1 → 2 → 3 (researcher must re-run because the concept may have shifted).
- Brainstormer in `revise` mode asks targeted questions on blocking findings only — not the full intake again.
- Every iteration is appended to `audit.json` under `iterations[]`.

## Final brief status

| Status | Condition |
|---|---|
| `OK` | both validators `OK`, audience confidence `MEDIUM` or `HIGH` |
| `WARN` | any validator `WARN`, or audience confidence `LOW` |
| `PARTIAL` | audience-researcher reports required fields missing |
| `BLOCKED` | validators returned `BLOCK` and the loop is exhausted |

## Discovery + flexibility

The orchestrator is **defensive at every stage** so the demo never crashes when teammates are still building their agents:

1. **Phase −1 discovery** — orchestrator scans `.claude/agents/*.md` and matches roles by primary name OR alias (see `web/lib/agents.ts`).
2. **Per-stage outcomes:**
   - Agent found + clean run → `source: "agent"`
   - Agent found but errors → one retry → fallback → `source: "fallback-after-error"`
   - Agent missing → inline fallback → `source: "fallback-missing"`
3. **Honesty rule:** any fallback envelope ships at most `verdict: WARN`. The orchestrator never silently returns `OK` on a stubbed stage.

## Where this is encoded

- **Discovery:** [`web/lib/agents.ts`](../web/lib/agents.ts)
- **Mocks (inline fallbacks):** [`web/lib/mocks.ts`](../web/lib/mocks.ts)
- **Per-stage routes:** [`web/app/api/agents/*/route.ts`](../web/app/api/agents/)
- **Final compose:** [`web/app/api/orchestrator/compose/route.ts`](../web/app/api/orchestrator/compose/route.ts)
- **Discovery snapshot:** GET [`/api/orchestrator/health`](http://localhost:3000/api/orchestrator/health)
