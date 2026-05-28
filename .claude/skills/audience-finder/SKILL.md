---
name: audience-finder
description: Use when an upstream brief is ready (either a `brief-intake` artifact at `briefs/intake_*.json` or a flat ad-hoc brief) and the user needs an audit-ready audience analysis from the customer activation CSVs. Produces a JSON `audience_analysis` with one proposal per channel — audience size, exclusion-bucket breakdown, suggested data fields, primary + alternate destinations, sample customer IDs, rationale — plus a connecting-note when more than one channel is in play, headline compliance callouts (retention horizon, missing-consent gap, cross-border SCC), and a pass-through of the intake's `compliance_flags_to_check_downstream`. Writes the artifact to `briefs/audience_analysis_<intake_id_or_slug>.json` and prints it.
---

# Audience Finder

The middle stage of the Rituals "Brief Me" activation flow. Takes the structured intake from `brief-intake`, queries the four customer activation CSVs in `Data/`, applies compliance and targeting filters per channel, and emits a structured `audience_analysis` artifact ready for the presenter / validation step.

## When to use this skill

Invoke when:
- A `brief-intake` artifact has just been written to `briefs/intake_*.json` and the user wants the audience analysis for it.
- The user hands you a flat ad-hoc brief (JSON path or inline) for testing.

Do not invoke for general questions about the dataset — for that, defer to `data-info`.

## Companion skills you rely on

- **`read-data`** — canonical load pattern for the CSVs (booleans, date parsing, join recipes). Follow it. Do not invent your own load.
- **`data-info`** — schema reference and data-quality notes (35 missing consent records, 128 ANON transactions, etc.). Cite values from there rather than from memory.

## Inputs the skill accepts

### Primary shape — `brief-intake` artifact

A JSON file at `briefs/intake_*.json` produced by the `brief-intake` skill. Load and normalize as follows:

| Internal field | From the intake artifact |
|---|---|
| `intake_id` | `intake_id` |
| `original_request` | `original_request` |
| `channels[]` | `[slots.channel.primary]` + `[slots.channel.fallback]` if non-null |
| `pre_chosen_destination_platform` | `slots.channel.destination_platform` (becomes the primary in `suggested_destinations`) |
| `target_segments[]` | `slots.audience.segment` |
| `target_countries[]` | `slots.audience.filters.country` (fallback to `slots.geo.countries`) |
| `lifetime_value_eur_min` | `slots.audience.filters.lifetime_value_eur_min` |
| `last_order_before` (ISO date) | `slots.audience.filters.last_order_before` |
| `account_status_allowed[]` | `slots.audience.filters.account_status` (default `["active"]`) |
| `always_exclude[]` | `optional_slots.suppression_lists.always_exclude` (already covered by always-on filters; pass through) |
| `additional_suppressions[]` | `optional_slots.suppression_lists.additionally` (interpreted — see below) |
| `compliance_flags_to_check_downstream[]` | `compliance_flags_to_check_downstream` (echoed unchanged into output) |
| `prior_brief_reference` | `optional_slots.prior_brief_reference` (if names a `campaign_name` in sheet 4, exclude those customers) |

### Secondary shape — flat ad-hoc brief

Used for testing and back-compat. Forgiving: missing = no filter; unknown = log and ignore.

```jsonc
{
  "campaign_intent":          "free text",
  "campaign_type":            "upsell | win-back | new-arrival | loyalty | cross-sell | other",
  "channels":                 ["Email","SMS","Push Notification","In-App Banner","Paid Social - Meta","Paid Social - Google","Display Retargeting"],
  "target_segments":          ["Loyal","High-Value","New","Occasional","At-Risk"],
  "target_countries":         ["NL","DE","BE","ES","FR","GB"],
  "product_categories":       ["Beauty","Health", ... ],
  "lifetime_value_eur_min":   500,
  "last_order_before":        "2025-11-28",      // takes priority over recency_days
  "recency_days":             180,               // fallback if last_order_before absent
  "account_status_allowed":   ["active"],
  "exclusions_freeform":      "free text"
}
```

**Shape detection rule:** if the input JSON has both `intake_id` and a `slots` object, treat as intake artifact; otherwise as flat brief.

## Channel set resolution

1. If channels were given (either shape), use them.
2. Otherwise (channel-open flat brief), infer 2-3 channels for `campaign_type`:
   - `win-back` → `["Email","SMS"]`
   - `upsell`, `loyalty`, `new-arrival` → `["Email","Push Notification"]`
   - `cross-sell` → `["Email","Display Retargeting"]`
   - anything else / unknown → `["Email","Push Notification","SMS"]`

## Channel → channel-specific opt-in flag (load-bearing; do not improvise)

| Channel | Required opt-in flag |
|---|---|
| `Email` | `email_marketing_opt_in == True` |
| `SMS` | `sms_opt_in == True` |
| `Push Notification` | `push_notification_opt_in == True` |
| `In-App Banner` | `push_notification_opt_in == True` |
| `Paid Social - Meta` | `paid_social_opt_in == True` |
| `Paid Social - Google` | `paid_social_opt_in == True` |
| `Display Retargeting` | `paid_social_opt_in == True` |

## Always-on compliance filters

A customer is eligible only if **all** hold:

1. `account_status` is in `account_status_allowed` (default `["active"]`)
2. A consent record exists for their email (else → `no_consent_record` bucket)
3. `consent_withdrawn == False`
4. `right_to_erasure_requested == False`
5. `data_retention_expiry > today` (today = 2026-05-28)

## Additional filters and their exclusion buckets

| Filter | Source | Bucket on failure |
|---|---|---|
| Segment in `target_segments` | brief | `segment_mismatch` |
| Country in `target_countries` | brief | `country_mismatch` |
| `lifetime_value_eur >= lifetime_value_eur_min` | brief | `ltv_below_threshold` |
| `last_order_date < last_order_before` OR `last_order_date >= today - recency_days` | brief | `last_order_after_cutoff` (date form) / `recency_mismatch` (days form) |
| `product_categories` — customer has a completed txn in any listed category (join via `device_or_customer_id` starting with `CRM-`) | brief | `category_mismatch` |
| `additional_suppressions` containing `contacted_in_last_<N>_days` — exclude customers with any `activation_date > today - N` in sheet 4 | intake | `recently_contacted` |
| `prior_brief_reference` names a `campaign_name` — exclude any `customer_id` who appears in that campaign in sheet 4 | intake | `prior_campaign_exclusion` |

**Exclusion-priority order** (a customer who fails multiple filters is counted in only the **first** bucket they hit, top to bottom):

1. `account_inactive_or_suspended`
2. `no_consent_record`
3. `right_to_erasure_requested`
4. `consent_withdrawn`
5. `retention_expired`
6. `channel_opt_in_false`
7. `recently_contacted`
8. `prior_campaign_exclusion`
9. `segment_mismatch`
10. `country_mismatch`
11. `ltv_below_threshold`
12. `last_order_after_cutoff` (or `recency_mismatch`)
13. `category_mismatch`

Keep these strings exactly — the downstream presenter / validation skill reads them.

## Suggested destinations

For each channel proposal:
1. If `pre_chosen_destination_platform` is set (from intake), put it first.
2. Append the top-2 most common `destination_platform` values seen in `campaigns` where `channel == this channel`, **excluding** the pre-chosen one (avoid duplicates).
3. Cap at 3 entries total.

## Suggested data fields

For each channel proposal: the top-2 most common `data_fields_used` strings in `campaigns` where `channel == this channel`. Pass them through as-is (they're already comma-separated lists).

## Cross-border SCC callout

Add a string to `headline_compliance_callouts` if **any** of these is true:
- `compliance_flags_to_check_downstream` contains a flag matching `^cross_border_transfer_.*_scc_required$`
- The resolved channel set includes a channel whose primary destination is US-hosted (Klaviyo, Braze, Meta Ads Manager, Google Ads, Salesforce Marketing Cloud) AND the audience countries include any of NL/DE/BE/ES/FR/GB.

Wording: `"Cross-border transfer to {platform}: SCC sign-off required for EU customer data (jurisdictions: GDPR/ePrivacy)."`

## Step-by-step procedure

1. **Detect input shape** (intake artifact vs flat brief) and normalize to the internal brief.
2. **Load the CSVs** using the pattern in the `read-data` skill (with `true_values` / `false_values` for booleans and `pd.to_datetime` for date columns).
3. **Build joined customer view:** left-join `customers` with `consent` on `email`. NaN consent fields → `no_consent_record` signal. Parse `data_retention_expiry` and `last_order_date` as datetime.
4. **Resolve the channel set** (see section above).
5. **For each channel**, walk the priority-ordered filter chain. Each customer ends up either in the eligible audience or in their first failing bucket. Count both.
6. Compute `segment_breakdown` and `country_breakdown` on the survivors. Take the first 5 surviving `customer_id`s as `sample_customer_ids`.
7. Compute `suggested_data_fields` and `suggested_destinations` (sections above).
8. Write a 2-3 sentence `rationale` per channel citing the actual numbers — eligible vs each non-zero bucket.
9. If more than one channel proposal, write a 1-2 sentence `connecting_note` on how the channels relate (sequencing, retargeting layer, etc.).
10. Compute `headline_compliance_callouts`:
    - Total raw-match size vs final eligible (e.g. "Raw segment+country match 47 → 6 eligible after compliance").
    - The dataset-wide retention-expired count if material (189 of 265 consent records have expiry before today).
    - The 35-missing-consent callout if any of those customers would otherwise have matched.
    - The cross-border SCC string (see above).
    - The ANON identity-resolution limitation if `product_categories` was used as a filter.
11. **Emit the JSON** (contract below). Write it to `briefs/audience_analysis_<intake_id>.json` (or `audience_analysis_<short-slug>.json` for flat briefs) AND print it to stdout. Do not overwrite — append a `-2`, `-3` suffix if the file exists.

## Output JSON contract

```jsonc
{
  "analysis_id":         "audience_analysis_intake_20260528-1650_at-risk-de-sms-bf",
  "created_at":          "2026-05-28T17:20:00+02:00",
  "source_brief":        "briefs/intake_20260528-1650_at-risk-de-sms-bf.json",   // path if file, "inline" if not
  "intake_id":           "intake_20260528-1650_at-risk-de-sms-bf",                // null for flat briefs
  "normalized_brief":    { /* the internal brief after normalization, including any defaults you filled in */ },

  "proposals": [
    {
      "channel":               "SMS",
      "audience_size":         3,
      "raw_segment_country_match_size": 12,                  // before any compliance / targeting filters beyond segment+country
      "segment_breakdown":     {"At-Risk": 3},
      "country_breakdown":     {"DE": 3},
      "exclusion_buckets": [
        {"reason": "account_inactive_or_suspended", "count": 0},
        {"reason": "no_consent_record",             "count": 1},
        {"reason": "right_to_erasure_requested",    "count": 0},
        {"reason": "consent_withdrawn",             "count": 0},
        {"reason": "retention_expired",             "count": 4},
        {"reason": "channel_opt_in_false",          "count": 2},
        {"reason": "recently_contacted",            "count": 0},
        {"reason": "prior_campaign_exclusion",      "count": 0},
        {"reason": "segment_mismatch",              "count": 0},
        {"reason": "country_mismatch",              "count": 0},
        {"reason": "ltv_below_threshold",           "count": 2},
        {"reason": "last_order_after_cutoff",       "count": 0},
        {"reason": "category_mismatch",             "count": 0}
      ],
      "suggested_data_fields":  ["email, segment, ltv", "email, sms, segment, ltv, last_order_date"],
      "suggested_destinations": ["Klaviyo", "Braze"],        // pre_chosen first, then historical top-2 distinct
      "sample_customer_ids":    ["CRM-00041","CRM-00112","CRM-00187"],
      "rationale":              "3 At-Risk customers in DE remain eligible after compliance; 4 dropped for expired retention, 2 for LTV below €500, 2 for missing SMS opt-in. Klaviyo retained as destination (intake choice + matches historical SMS default)."
    }
    // ... more entries when there are multiple channels
  ],

  "connecting_note": "",                                     // empty string if only one proposal; 1-2 sentences otherwise

  "headline_compliance_callouts": [
    "Raw segment+country match 12 → 3 eligible after compliance (75% drop).",
    "Dataset-wide: 189 of 265 consent records have retention expiry before today — most of the file is unmailable until refreshed.",
    "Cross-border transfer to Klaviyo: SCC sign-off required for EU customer data (jurisdictions: GDPR/ePrivacy)."
  ],

  "compliance_flags_to_check_downstream": [                  // echoed from the intake artifact, unchanged
    "sms_consent_required",
    "retention_window_active",
    "jurisdiction_DE_GDPR",
    "cross_border_transfer_us_klaviyo_scc_required",
    "exclude_inactive_and_suspended_accounts"
  ],

  "limitations": [                                           // present only when relevant
    "128 ANON transactions cannot be joined to customers — product-category filter may understate intent."
  ]
}
```

The `analysis_id` is the stable handle; the file path is `briefs/<analysis_id>.json`.

## What this skill explicitly does NOT do in v1

- No outcome-based ranking (open/click/conversion rates from sheet 4 are ignored beyond field/destination lookups).
- No identity resolution for ANON transactions.
- No free-text `exclusions_freeform` interpretation beyond exact `campaign_name` matches.
- No outbound side effects — never writes to the dataset or pushes to any destination platform.
- No re-litigation of compliance flags from the intake — those are echoed through, not re-evaluated.

## Example invocations

> "Use the audience-finder skill on `briefs/intake_20260528-1650_at-risk-de-sms-bf.json`."

> "Use the audience-finder skill on this flat brief: `{...}`"

In both cases: read input, run the procedure, write `briefs/audience_analysis_*.json`, print the JSON, and end your turn with the absolute path to the artifact and a one-sentence handoff: *"Audience analysis ready for `<analysis_id>`. Next step: validation + presenter."*
