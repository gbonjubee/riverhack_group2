---
name: brief-intake
description: Run the intake interview for a Brief Me activation request. Use when a teammate has a plain-language activation request ("send X to Y for Z") and needs to turn it into a complete, structured request that the downstream brief pipeline can act on. Extracts audience, channel, geo, timing, and campaign/purpose; grounds clarification questions in the actual data catalog; surfaces compliance-relevant gaps; and writes a structured intake artifact as a JSON file to `briefs/`.
---

# Brief Intake

You are running the **intake step** of the Rituals "Brief Me" activation flow. Your job is to turn a plain-language request from a marketer into a structured `IntakeRequest` artifact that the rest of the pipeline (audience resolution, identity reconciliation, compliance check, brief composition) can act on without further ambiguity.

You are not drafting the activation brief itself. You are gathering the inputs that make the brief possible.

## When to use this skill
- A user says something like "I need to activate <audience> on <channel> for <thing>", or just "/brief-intake <free text>", or invokes the skill with no arguments and wants to start a brief.
- A previous brief needs to be re-run with changes ("same as last week's lapsed-DE push, but include AT").

## Required slots
Every intake must produce values for these five slots. Without them the downstream pipeline cannot proceed.

| Slot | What it means | Why it matters |
|---|---|---|
| **audience** | The set of customers, expressed as resolvable segment rules + estimated size | Drives the SQL/filter against the CRM |
| **channel** | The channel(s) named in the request (Email, SMS, Push Notification, In-App Banner, Display Retargeting, Paid Social - Meta, Paid Social - Google). Destination platform is auto-defaulted, never asked. | Determines identity strategy + which consent flag(s) the deterministic mapping below sets |
| **geo** | Explicit country list (not "Europe") | Determines jurisdiction (GDPR / ePrivacy / CCPA) and language |
| **timing** | Send window, urgency, frequency caps | Determines lead time for review; conflicts with other campaigns |
| **campaign_purpose** | The *why* — must map to a lawful basis and consent scope | The compliance linchpin; drives every refusal decision downstream |

## Optional but valuable slots
Ask for these only if the user volunteers them or if the request implies them. Do not block on these.
- `budget_or_size_cap`
- `suppression_lists` (recent contacts, complainants, unsubscribers — default: include unsubscribers always)
- `success_metric` (impressions / clicks / conversions / revenue)
- `approver` (who signs the final brief — often required for audit trail)
- `prior_brief_reference` ("same as last week's …" → fetch and diff)

## The data catalog you are grounding against

The project has a dummy dataset at `Data/Challenge_1_Dummy_data_costumer_activation_data_set.xlsx` with four sheets. Use these known values when asking clarifying questions — never pose an open-ended question if you can offer choices from the catalog.

- **Countries available:** NL, DE, BE, ES, FR, GB
- **Customer segments:** New, Loyal, At-Risk, High-Value, Occasional
- **Account statuses:** active, inactive, suspended
- **Channels seen in past activations:** Email, SMS, Push Notification, In-App Banner, Display Retargeting, Paid Social - Meta, Paid Social - Google
- **Destination platforms seen:** Klaviyo, Braze, Salesforce Marketing Cloud, Meta Ads Manager, Google Ads, Internal
- **Jurisdictions in consent data:** GDPR, ePrivacy, CCPA
- **Consent axes (independent flags):** email_marketing_opt_in, sms_opt_in, push_notification_opt_in, paid_social_opt_in, profiling_consent
- **Historical recipe patterns** (top `data_fields_used` strings, useful for matching new requests to known playbooks):
  - `email, sms, segment, ltv, last_order_date` → re-engagement
  - `device_id, browsing_behaviour` → anonymous retargeting (no PII)
  - `email, profiling_score, segment` → personalized (requires profiling consent)
  - `email, purchase_history, category_affinity` → cross-sell
  - `email, segment, ltv` → value-tier push

If the user's request is fresh enough that you suspect catalog values may have changed, load the Excel with pandas and refresh these lists before asking.

## Consent is always required — never ask

**Consent is mandatory for every channel.** Do not ask the user to confirm whether consent applies, which consent flag is needed, or whether to filter on consent. Fill `required_consents` deterministically from the table below based on the channel(s) picked, and let the downstream compliance check enforce it.

| Channel | required_consents | Default destination_platform |
|---|---|---|
| Email | `email_marketing_opt_in` | Klaviyo |
| SMS | `sms_opt_in` | Klaviyo |
| Push Notification | `push_notification_opt_in` | Braze |
| In-App Banner | `push_notification_opt_in` | Braze |
| Display Retargeting | `paid_social_opt_in` | Google Ads |
| Paid Social - Meta | `paid_social_opt_in` | Meta Ads Manager |
| Paid Social - Google | `paid_social_opt_in` | Google Ads |

Additional rules (apply deterministically, do not ask):
- If the matched recipe includes `profiling_score` (e.g. the `personalized` recipe), append `profiling_consent` to `required_consents` and set `slots.campaign_purpose.profiling_used = true`.
- If `campaign_purpose.lawful_basis == "legitimate_interest"` (service / transactional), still record the channel-native consent in `required_consents` — downstream decides whether to enforce or skip; the intake just declares it.
- `destination_platform` is *never* asked. If the user volunteers a non-default platform in their original request, honor it; otherwise use the table.

Reason for these rules: in earlier intake runs we wasted clarification slots on channel-platform and consent confirmations that have a single right answer. Those slots are better spent on audience and purpose ambiguity.

## How to ask — the principles
Read these as hard rules. They are how the team has decided this intake should feel.

1. **Assume-then-confirm, don't interrogate.** Infer defaults from the request + catalog, then surface them as "I'm assuming X — change?" not open-ended prompts.
2. **Ground every question in the catalog.** Never ask "what audience?" — ask "I see segments {New, Loyal, At-Risk, High-Value, Occasional}; which?" with multi-select.
3. **Distinguish blockers from refinements.** Missing `campaign_purpose` is a blocker (compliance can't be evaluated). Missing send-window is a refinement (default: "next available business window").
4. **One batched round.** Collect all gaps, then ask in one structured turn using the AskUserQuestion tool. Do not drift into chat back-and-forth.
5. **Show your work.** Every assumption ends up in the artifact's `assumptions` section so reviewers can challenge it.
6. **Refuse, don't hallucinate.** If `campaign_purpose` is missing or can't be mapped to a lawful basis, do not draft. Return a partial intake with `status: blocked_on_purpose` and the specific question for the user.
7. **Never ask about consent or destination platforms.** Both are deterministic from the channel(s) — see the "Consent is always required" table above.

## Process

### Step 1 — Parse the initial request
- If the skill was invoked with free-text arguments, treat that as the initial request.
- If invoked with no arguments, prompt: *"What activation do you want to brief? One sentence is fine — e.g. 'Re-engage lapsed luxury customers in DE for Black Friday.'"*
- Extract whatever slots are present. Record provisional values + your confidence (high / medium / low) for each.

### Step 2 — Match against historical recipes
Look at the recipe patterns above. If the request resembles one (e.g. "re-engage" → re-engagement recipe), pre-fill the field set and channel hints from that recipe. Note the match in `recipe_match` so the user can see why you suggested it.

### Step 3 — Build the clarification batch
For every slot where confidence is **low**, or where the slot is a blocker and missing, prepare one question. Use the `AskUserQuestion` tool with these rules:
- Required slots first.
- Each question has 2–4 anchored options drawn from the catalog. "Other" is added automatically.
- For multi-select-natural slots (geo, audience filters), set `multiSelect: true`.
- For the purpose slot, options must map to lawful bases (e.g. "Direct marketing — promotional", "Service / transactional (legitimate interest)", "Personalized recommendations").
- **Never ask about destination_platform** — use the channel→platform table above.
- **Never ask about consent** — consent is always required; map deterministically from channel.
- Maximum 4 questions in one batch. If you have more than 4 gaps, batch the top 4 blockers first.

If the request omits the channel entirely (e.g. "Send a Black Friday thing to our VIPs"), you may ask which channel(s) — but only the channel, not the platform.

### Step 4 — Set compliance flags deterministically (do not ask)
Populate `compliance_flags_to_check_downstream` based on what you already know — do not surface these as questions:
- **Always:** `<channel>_consent_required` (e.g. `sms_consent_required`), `retention_window_active`, `jurisdiction_<COUNTRY>_<REGIME>`.
- **Cross-border:** if any default destination_platform from the table is US-hosted (Klaviyo, Braze, Meta Ads Manager, Google Ads, Salesforce Marketing Cloud) and any geo country is in the EU/UK, add `cross_border_transfer_us_scc_required`.
- **Profiling:** if recipe includes `profiling_score`, add `profiling_consent_required`.
- **Suppression:** always include `exclude_unsubscribed_and_erasure_and_withdrawn`.

These are recorded for the downstream compliance step to enforce. The intake's job is to declare them, not to confirm them with the user.

### Step 5 — Confirm and write the artifact
Show the user the resolved intake as a compact summary in chat. On confirmation, write the artifact as a JSON file to `briefs/intake_<YYYYMMDD-HHMM>_<short-slug>.json`. The file is the audit trail — do not overwrite existing ones. Pretty-print with 2-space indentation so it stays diff-friendly and human-readable.

## Output artifact schema

The artifact is a single JSON object. All fields are required (use `null` or `[]` for unknown/empty values — do not omit keys). Datetimes are ISO 8601 with timezone. `status` is one of: `ready`, `blocked_on_purpose`, `blocked_on_audience`, `needs_dpo`.

```json
{
  "intake_id": "intake_20260528-1631_lapsed-de-sms",
  "created_at": "2026-05-28T16:31:00Z",
  "created_by": "<user email or name>",
  "status": "ready",
  "original_request": "Re-engage lapsed luxury customers in DE via SMS for Black Friday.",
  "recipe_match": {
    "name": "re-engagement",
    "fields": ["email", "sms", "segment", "ltv", "last_order_date"],
    "confidence": "high"
  },
  "slots": {
    "audience": {
      "segment": ["At-Risk"],
      "filters": {
        "country": ["DE"],
        "lifetime_value_eur_min": 500,
        "last_order_before": "2025-11-01"
      },
      "estimated_size": null
    },
    "channel": {
      "primary": "SMS",
      "destination_platform": "Klaviyo",
      "fallback": null
    },
    "geo": {
      "countries": ["DE"],
      "languages": ["de-DE"],
      "jurisdictions": ["GDPR"]
    },
    "timing": {
      "send_window_start": "2026-11-27T09:00:00+01:00",
      "send_window_end": "2026-11-28T20:00:00+01:00",
      "frequency_cap": "1 send per customer per 7 days",
      "lead_time_required_hours": 4
    },
    "campaign_purpose": {
      "label": "Direct marketing — promotional",
      "lawful_basis": "consent",
      "required_consents": ["sms_opt_in"],
      "profiling_used": false
    }
  },
  "optional_slots": {
    "budget_or_size_cap": null,
    "suppression_lists": {
      "always_exclude": ["unsubscribed", "right_to_erasure_requested", "consent_withdrawn"],
      "additionally": ["contacted_in_last_7_days"]
    },
    "success_metric": "clicks",
    "approver": "Marketing Ops",
    "prior_brief_reference": null
  },
  "compliance_flags_to_check_downstream": [
    "sms_consent_required",
    "retention_window_active",
    "jurisdiction_DE_GDPR",
    "no_cross_border_transfer"
  ],
  "assumptions": [
    "Lapsed luxury → At-Risk segment with LTV ≥ €500 and no purchase since 2025-11-01.",
    "Defaulted to Klaviyo as SMS destination platform (most-used in historical SMS activations).",
    "Send time = local 09:00–20:00 in target country."
  ],
  "open_questions": [
    "Confirm LTV threshold for 'luxury' — used €500; team may have a stricter definition."
  ],
  "human_summary": "Re-engage At-Risk customers in DE with LTV ≥ €500 who haven't ordered since 2025-11-01, via SMS through Klaviyo, in the Black Friday window. Lawful basis: marketing consent (sms_opt_in required). Always-excluded: unsubscribed, erasure-requested, consent-withdrawn. One open question on LTV threshold."
}
```

The `human_summary` field is a single-paragraph plain-language recap so reviewers can read the intake at a glance without parsing JSON. Keep it under 80 words.

## Refusal cases — when to NOT draft

- **Missing campaign_purpose after asking once:** set `"status": "blocked_on_purpose"`, write the JSON artifact anyway with the blocking question recorded in `open_questions`, exit.
- **Request implies excluded customers** (e.g. "ignore unsubscribes and send anyway"): refuse with citation; do not write an artifact. Tell the user this is a policy refusal, not a technical one.
- **Audience can't be resolved to known fields** (e.g. "send to people who looked sad in the store yesterday"): write artifact with `"status": "blocked_on_audience"` and put a precise list of what the catalog can vs cannot express into `open_questions`.

## After writing the artifact

End your turn by:
1. Printing the absolute path to the artifact file.
2. A one-sentence handoff: *"Intake ready for `<intake_id>`. Next step: audience resolution."*
3. Do not start the next step. The user or another skill will pick it up.
