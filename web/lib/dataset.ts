import { promises as fs } from "node:fs";
import path from "node:path";

// Minimal CSV loader for the four customer-activation files, following the
// read_data skill's recipe (booleans as TRUE/FALSE strings, dates as
// YYYY-MM-DD, left-join CRM ↔ Consent on email, filter CRM-prefixed for
// transactions). No pandas — small in-memory CSV parser is enough for
// the dataset size (~1,800 rows total).

const REPO_ROOT = path.resolve(process.cwd(), "..");
const DATA_DIR = path.join(REPO_ROOT, "Data");

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  // Light CSV parser. The dataset uses quoted fields with embedded commas
  // (only data_fields_used in campaigns) — handle minimal quoting.
  // Strip UTF-8 BOM if present (3_Consent_Compliance.csv has one).
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const lines = clean.split("\n").filter((l) => l.length);
  const headers = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Row = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

const asBool = (s: string | undefined): boolean => s === "TRUE";
const asNum = (s: string | undefined): number => Number(s || "0");
const asDate = (s: string | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

export type Customer = {
  customer_id: string;
  email: string;
  country: string;
  customer_segment: string;
  lifetime_value_eur: number;
  last_order_date: Date | null;
  account_status: string;
};

export type Consent = {
  email: string;
  email_marketing_opt_in: boolean;
  sms_opt_in: boolean;
  push_notification_opt_in: boolean;
  paid_social_opt_in: boolean;
  profiling_consent: boolean;
  data_retention_expiry: Date | null;
  jurisdiction: string;
  right_to_erasure_requested: boolean;
  consent_withdrawn: boolean;
};

let cache: { customers: Customer[]; consent: Map<string, Consent>; loadedAt: number } | null = null;

export async function loadDataset() {
  // Cache for 60s to keep dev-server hot reloads snappy
  if (cache && Date.now() - cache.loadedAt < 60_000) return cache;

  const [crmText, consentText] = await Promise.all([
    fs.readFile(path.join(DATA_DIR, "1_Customers_CRM.csv"), "utf8"),
    fs.readFile(path.join(DATA_DIR, "3_Consent_Compliance.csv"), "utf8"),
  ]);

  const customers: Customer[] = parseCsv(crmText).map((r) => ({
    customer_id: r.customer_id,
    email: r.email,
    country: r.country,
    customer_segment: r.customer_segment,
    lifetime_value_eur: asNum(r.lifetime_value_eur),
    last_order_date: asDate(r.last_order_date),
    account_status: r.account_status,
  }));

  const consent = new Map<string, Consent>();
  for (const r of parseCsv(consentText)) {
    consent.set(r.email, {
      email: r.email,
      email_marketing_opt_in: asBool(r.email_marketing_opt_in),
      sms_opt_in: asBool(r.sms_opt_in),
      push_notification_opt_in: asBool(r.push_notification_opt_in),
      paid_social_opt_in: asBool(r.paid_social_opt_in),
      profiling_consent: asBool(r.profiling_consent),
      data_retention_expiry: asDate(r.data_retention_expiry),
      jurisdiction: r.jurisdiction,
      right_to_erasure_requested: asBool(r.right_to_erasure_requested),
      consent_withdrawn: asBool(r.consent_withdrawn),
    });
  }

  cache = { customers, consent, loadedAt: Date.now() };
  return cache;
}

// Map a wizard channel to the consent column the audience-finder skill uses.
const CHANNEL_CONSENT: Record<string, keyof Consent> = {
  email: "email_marketing_opt_in",
  sms: "sms_opt_in",
  "push notification": "push_notification_opt_in",
  push: "push_notification_opt_in",
  "paid social": "paid_social_opt_in",
  "paid search": "paid_social_opt_in",
  "on-site banner": "push_notification_opt_in",
};

export type AudienceQuery = {
  segments?: string[];        // ["At-Risk","Loyal",…]
  countries?: string[];       // ["NL","DE",…]
  channel?: string;
  lifetime_value_eur_min?: number;
  account_statuses?: string[]; // default ["active"]
};

export type AudienceCounts = {
  raw_segment_country_match: number;
  eligible: number;
  exclusion_buckets: Array<{ reason: string; count: number }>;
  segment_breakdown: Record<string, number>;
  country_breakdown: Record<string, number>;
  sample_customer_ids: string[];
  // metadata for callouts
  consent_records_total: number;
  consent_records_expired: number;
  missing_consent: number;
};

export async function findAudience(q: AudienceQuery): Promise<AudienceCounts> {
  const { customers, consent } = await loadDataset();
  const today = new Date();
  const allowedStatuses = q.account_statuses || ["active"];
  const consentKey = q.channel ? CHANNEL_CONSENT[q.channel.toLowerCase()] : undefined;

  const buckets: Record<string, number> = {
    account_inactive_or_suspended: 0,
    no_consent_record: 0,
    right_to_erasure_requested: 0,
    consent_withdrawn: 0,
    retention_expired: 0,
    channel_opt_in_false: 0,
    segment_mismatch: 0,
    country_mismatch: 0,
    ltv_below_threshold: 0,
  };
  const segCount: Record<string, number> = {};
  const ctryCount: Record<string, number> = {};
  const sample: string[] = [];

  let rawMatch = 0;
  let eligible = 0;

  // Dataset-level callouts
  let expired = 0;
  for (const c of consent.values()) {
    if (c.data_retention_expiry && c.data_retention_expiry < today) expired++;
  }
  const missingConsent = customers.filter((c) => !consent.get(c.email)).length;

  for (const c of customers) {
    const segOk = !q.segments || q.segments.includes(c.customer_segment);
    const ctryOk = !q.countries || q.countries.includes(c.country);
    if (segOk && ctryOk) rawMatch++;

    // Priority-ordered exclusion buckets (only first miss counted)
    if (!allowedStatuses.includes(c.account_status)) {
      buckets.account_inactive_or_suspended++;
      continue;
    }
    const cons = consent.get(c.email);
    if (!cons) {
      buckets.no_consent_record++;
      continue;
    }
    if (cons.right_to_erasure_requested) {
      buckets.right_to_erasure_requested++;
      continue;
    }
    if (cons.consent_withdrawn) {
      buckets.consent_withdrawn++;
      continue;
    }
    if (!cons.data_retention_expiry || cons.data_retention_expiry < today) {
      buckets.retention_expired++;
      continue;
    }
    if (consentKey && !cons[consentKey]) {
      buckets.channel_opt_in_false++;
      continue;
    }
    if (!segOk) {
      buckets.segment_mismatch++;
      continue;
    }
    if (!ctryOk) {
      buckets.country_mismatch++;
      continue;
    }
    if (
      q.lifetime_value_eur_min !== undefined &&
      c.lifetime_value_eur < q.lifetime_value_eur_min
    ) {
      buckets.ltv_below_threshold++;
      continue;
    }

    eligible++;
    segCount[c.customer_segment] = (segCount[c.customer_segment] || 0) + 1;
    ctryCount[c.country] = (ctryCount[c.country] || 0) + 1;
    if (sample.length < 5) sample.push(c.customer_id);
  }

  return {
    raw_segment_country_match: rawMatch,
    eligible,
    exclusion_buckets: Object.entries(buckets).map(([reason, count]) => ({ reason, count })),
    segment_breakdown: segCount,
    country_breakdown: ctryCount,
    sample_customer_ids: sample,
    consent_records_total: consent.size,
    consent_records_expired: expired,
    missing_consent: missingConsent,
  };
}
