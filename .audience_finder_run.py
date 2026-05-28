"""One-shot audience-finder execution against the given intake JSON."""
import json
import sys
from pathlib import Path

import pandas as pd

INTAKE_PATH = Path("briefs/intake_20260528-1735_nl-churned-1y-promo.json")
DATA = Path("Data")
BRIEFS = Path("briefs")
TODAY = pd.Timestamp("2026-05-28")

with open(INTAKE_PATH) as f:
    intake = json.load(f)

slots = intake["slots"]
ch_slot = slots["channel"]
if ch_slot.get("primary") == "all" and ch_slot.get("channels"):
    channels = ch_slot["channels"]
    platforms_per_channel = ch_slot.get("destination_platforms_per_channel", {})
else:
    channels = [ch_slot["primary"]] + (
        [ch_slot["fallback"]] if ch_slot.get("fallback") else []
    )
    platforms_per_channel = {c: ch_slot.get("destination_platform") for c in channels}

target_segments = slots["audience"]["segment"]
target_countries = (
    slots["audience"]["filters"]["country"] or slots["geo"]["countries"]
)
ltv_min = slots["audience"]["filters"].get("lifetime_value_eur_min")
last_order_before = slots["audience"]["filters"].get("last_order_before")
last_order_after = slots["audience"]["filters"].get("last_order_after")
account_allowed = slots["audience"]["filters"].get("account_status") or ["active"]

opt = intake.get("optional_slots") or {}
suppressions = opt.get("suppression_lists") or {}
additional_suppressions = suppressions.get("additionally") or []
prior_brief_reference = opt.get("prior_brief_reference")
compliance_flags = intake.get("compliance_flags_to_check_downstream") or []

customers = pd.read_csv(
    DATA / "1_Customers_CRM.csv",
    parse_dates=["registration_date", "last_order_date"],
)
campaigns = pd.read_csv(
    DATA / "4_Campaign_Activation.csv", parse_dates=["activation_date"]
)
consent = pd.read_csv(
    DATA / "3_Consent_Compliance.csv",
    parse_dates=["consent_date", "last_consent_review", "data_retention_expiry"],
)

BOOL_COLS = [
    "email_marketing_opt_in",
    "sms_opt_in",
    "push_notification_opt_in",
    "paid_social_opt_in",
    "profiling_consent",
    "consent_withdrawn",
    "right_to_erasure_requested",
]
for c in BOOL_COLS:
    consent[c] = consent[c].astype(str).str.lower().eq("true")

customers["_em"] = customers["email"].str.lower()
consent["_em"] = consent["email"].str.lower()
joined = customers.merge(
    consent.drop(columns=["email"]), on="_em", how="left"
)

CH_OPT = {
    "Email": "email_marketing_opt_in",
    "SMS": "sms_opt_in",
    "Push Notification": "push_notification_opt_in",
    "In-App Banner": "push_notification_opt_in",
    "Paid Social - Meta": "paid_social_opt_in",
    "Paid Social - Google": "paid_social_opt_in",
    "Display Retargeting": "paid_social_opt_in",
}

recently_contacted_days = None
for s in additional_suppressions:
    if s.startswith("contacted_in_last_") and s.endswith("_days"):
        try:
            recently_contacted_days = int(
                s.replace("contacted_in_last_", "").replace("_days", "")
            )
        except ValueError:
            pass

recently_contacted_ids = set()
if recently_contacted_days:
    cutoff = TODAY - pd.Timedelta(days=recently_contacted_days)
    recently_contacted_ids = set(
        campaigns[campaigns["activation_date"] > cutoff]["customer_id"]
        .dropna()
        .astype(str)
    )

prior_campaign_ids = set()
if prior_brief_reference:
    prior_campaign_ids = set(
        campaigns[campaigns["campaign_name"] == prior_brief_reference][
            "customer_id"
        ]
        .dropna()
        .astype(str)
    )

EXCLUSION_ORDER = [
    "account_inactive_or_suspended",
    "no_consent_record",
    "right_to_erasure_requested",
    "consent_withdrawn",
    "retention_expired",
    "channel_opt_in_false",
    "recently_contacted",
    "prior_campaign_exclusion",
    "segment_mismatch",
    "country_mismatch",
    "ltv_below_threshold",
    "last_order_after_cutoff",
    "category_mismatch",
]


def evaluate(row, channel):
    if row["account_status"] not in account_allowed:
        return "account_inactive_or_suspended"
    if pd.isna(row.get("consent_date")):
        return "no_consent_record"
    if bool(row.get("right_to_erasure_requested")):
        return "right_to_erasure_requested"
    if bool(row.get("consent_withdrawn")):
        return "consent_withdrawn"
    rd = row.get("data_retention_expiry")
    if pd.isna(rd) or rd <= TODAY:
        return "retention_expired"
    if not bool(row.get(CH_OPT[channel])):
        return "channel_opt_in_false"
    cid = str(row["customer_id"])
    if cid in recently_contacted_ids:
        return "recently_contacted"
    if cid in prior_campaign_ids:
        return "prior_campaign_exclusion"
    if target_segments and row["customer_segment"] not in target_segments:
        return "segment_mismatch"
    if target_countries and row["country"] not in target_countries:
        return "country_mismatch"
    if ltv_min is not None and row["lifetime_value_eur"] < ltv_min:
        return "ltv_below_threshold"
    if last_order_before:
        cutoff_b = pd.Timestamp(last_order_before)
        if pd.isna(row["last_order_date"]) or row["last_order_date"] >= cutoff_b:
            return "last_order_after_cutoff"
    if last_order_after:
        cutoff_a = pd.Timestamp(last_order_after)
        if pd.isna(row["last_order_date"]) or row["last_order_date"] < cutoff_a:
            return "last_order_after_cutoff"
    return None


raw_mask = joined["customer_segment"].isin(target_segments) & joined[
    "country"
].isin(target_countries)
raw_match_size = int(raw_mask.sum())


def top_n(series, n):
    return series.value_counts().head(n).index.tolist()


def top_destinations(channel):
    return top_n(campaigns[campaigns["channel"] == channel]["destination_platform"], 2)


def top_fields(channel):
    return top_n(campaigns[campaigns["channel"] == channel]["data_fields_used"], 2)


def humanize(bucket_name):
    return bucket_name.replace("_", " ")


proposals = []
for channel in channels:
    counts = {r: 0 for r in EXCLUSION_ORDER}
    eligible = []
    for _, row in joined.iterrows():
        result = evaluate(row, channel)
        if result is None:
            eligible.append(row)
        else:
            counts[result] += 1
    elig_df = pd.DataFrame(eligible) if eligible else pd.DataFrame()
    audience_size = len(elig_df)
    seg_b = (
        elig_df["customer_segment"].value_counts().to_dict()
        if audience_size
        else {}
    )
    ctry_b = (
        elig_df["country"].value_counts().to_dict() if audience_size else {}
    )
    samples = (
        elig_df["customer_id"].astype(str).head(5).tolist()
        if audience_size
        else []
    )

    pre = platforms_per_channel.get(channel)
    suggested_dests = []
    if pre and pre != "per-channel-default":
        suggested_dests.append(pre)
    for t in top_destinations(channel):
        if t not in suggested_dests:
            suggested_dests.append(t)
    suggested_dests = suggested_dests[:3]
    suggested_fields = top_fields(channel)

    nz = [(r, counts[r]) for r in EXCLUSION_ORDER if counts[r] > 0]
    drops = ", ".join(f"{c} {humanize(r)}" for r, c in nz[:4]) if nz else "none"
    rationale = (
        f"{audience_size} customers remain eligible for {channel} after the priority-ordered "
        f"filter chain. Top drops: {drops}. Primary destination: "
        f"{suggested_dests[0] if suggested_dests else 'TBD'}."
    )

    proposals.append(
        {
            "channel": channel,
            "audience_size": audience_size,
            "raw_segment_country_match_size": raw_match_size,
            "segment_breakdown": seg_b,
            "country_breakdown": ctry_b,
            "exclusion_buckets": [
                {"reason": r, "count": counts[r]} for r in EXCLUSION_ORDER
            ],
            "suggested_data_fields": suggested_fields,
            "suggested_destinations": suggested_dests,
            "sample_customer_ids": samples,
            "rationale": rationale,
        }
    )

callouts = []
final_max = max((p["audience_size"] for p in proposals), default=0)
callouts.append(
    f"Raw segment+country match {raw_match_size} -> up to {final_max} eligible per channel after compliance."
)
retention_expired = int(
    (
        (consent["data_retention_expiry"] <= TODAY)
        | consent["data_retention_expiry"].isna()
    ).sum()
)
total_consent = len(consent)
if retention_expired > 0:
    callouts.append(
        f"Dataset-wide: {retention_expired} of {total_consent} consent records have retention expiry on or before today — most of the file is unmailable until refreshed."
    )

cust_emails = set(customers["_em"].dropna())
cons_emails = set(consent["_em"].dropna())
missing_consent_emails = cust_emails - cons_emails
missing_match = customers[
    customers["_em"].isin(missing_consent_emails)
    & customers["customer_segment"].isin(target_segments)
    & customers["country"].isin(target_countries)
]
if len(missing_match) > 0:
    callouts.append(
        f"{len(missing_match)} customers in this segment+market have no consent record on file "
        f"(of {len(missing_consent_emails)} project-wide). They are excluded by default."
    )

US_HOSTED = {"Klaviyo", "Braze", "Meta Ads Manager", "Google Ads", "Salesforce Marketing Cloud"}
EU_COUNTRIES = {"NL", "DE", "BE", "ES", "FR", "GB"}
intake_scc = any(
    f.startswith("cross_border_transfer_") and f.endswith("_scc_required")
    for f in compliance_flags
)
channel_us = any(
    platforms_per_channel.get(c) in US_HOSTED for c in channels
)
audience_eu = any(c in EU_COUNTRIES for c in target_countries)
if intake_scc or (channel_us and audience_eu):
    us_used = sorted(
        {
            platforms_per_channel.get(c)
            for c in channels
            if platforms_per_channel.get(c) in US_HOSTED
        }
    )
    if us_used:
        callouts.append(
            f"Cross-border transfer to {', '.join(us_used)}: SCC sign-off required for EU customer data (jurisdictions: GDPR/ePrivacy)."
        )

limitations = []
if last_order_after:
    limitations.append(
        f"Intake provided 'last_order_after' ({last_order_after}), an extension to the audience-finder spec. Applied here to honor the 6-12 month window."
    )
if ch_slot.get("primary") == "all":
    limitations.append(
        "Intake used slots.channel.primary='all' with slots.channel.channels[]. Audience-finder spec reads only [primary]+[fallback]; this run uses the channels[] array as a compatible extension."
    )

analysis_id = f"audience_analysis_{intake['intake_id']}"
out = {
    "analysis_id": analysis_id,
    "created_at": "2026-05-28T17:40:00+02:00",
    "source_brief": str(INTAKE_PATH),
    "intake_id": intake["intake_id"],
    "normalized_brief": {
        "channels": channels,
        "target_segments": target_segments,
        "target_countries": target_countries,
        "lifetime_value_eur_min": ltv_min,
        "last_order_before": last_order_before,
        "last_order_after": last_order_after,
        "account_status_allowed": account_allowed,
        "additional_suppressions": additional_suppressions,
        "prior_brief_reference": prior_brief_reference,
        "platforms_per_channel": platforms_per_channel,
    },
    "proposals": proposals,
    "connecting_note": (
        f"This brief targets {len(proposals)} channels. Each customer is filtered to the channels "
        f"they've opted into, so a customer may appear in more than one proposal. The presenter "
        f"step should de-duplicate before send."
    )
    if len(proposals) > 1
    else "",
    "headline_compliance_callouts": callouts,
    "compliance_flags_to_check_downstream": compliance_flags,
    "limitations": limitations,
}

out_path = BRIEFS / f"{analysis_id}.json"
suffix = 2
while out_path.exists():
    out_path = BRIEFS / f"{analysis_id}-{suffix}.json"
    suffix += 1

with open(out_path, "w") as f:
    json.dump(out, f, indent=2, default=str)

print(f"WRITTEN: {out_path}")
print(json.dumps(out, indent=2, default=str))
