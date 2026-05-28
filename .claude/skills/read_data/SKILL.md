---
name: read-data
description: Use when reading, analyzing, joining, or transforming the customer activation CSVs in Data/ (CRM, transactions, consent, campaigns). Provides the correct pandas load pattern, date and boolean parsing, join recipes, and common gotchas like ANON-prefixed IDs and consent coverage gaps.
---

# SKILL: Read Data

## Purpose
This skill tells Claude exactly how to load, parse, and work with the four customer-activation CSVs.

Use this skill any time a task involves reading, analysing, joining, or transforming data from these files.

---

## File Locations

```
<workspace>/Data/1_Customers_CRM.csv
<workspace>/Data/2_Transactions_Ecomm.csv
<workspace>/Data/3_Consent_Compliance.csv
<workspace>/Data/4_Campaign_Activation.csv
```

---

## File Layout

Each CSV has:
- **Row 1:** Column headers
- **Row 2 onwards:** Data

| # | File | pandas name suggestion | Rows | PK |
|---|---|---|---|---|
| 1 | `1_Customers_CRM.csv` | `customers` | 300 | `customer_id` |
| 2 | `2_Transactions_Ecomm.csv` | `transactions` | 800 | `transaction_id` |
| 3 | `3_Consent_Compliance.csv` | `consent` | 265 | `email` |
| 4 | `4_Campaign_Activation.csv` | `campaigns` | 400 | `activation_id` |

---

## How to Load with Python / pandas

```python
import pandas as pd
from pathlib import Path

DATA_DIR = Path("Data")  # adjust to absolute path if running outside the workspace

# true_values / false_values converts the TRUE/FALSE string literals to real booleans
BOOL_KW = {"true_values": ["TRUE"], "false_values": ["FALSE"]}

customers    = pd.read_csv(DATA_DIR / "1_Customers_CRM.csv",      **BOOL_KW)
transactions = pd.read_csv(DATA_DIR / "2_Transactions_Ecomm.csv", **BOOL_KW)
consent      = pd.read_csv(DATA_DIR / "3_Consent_Compliance.csv", **BOOL_KW)
campaigns    = pd.read_csv(DATA_DIR / "4_Campaign_Activation.csv", **BOOL_KW)
```

### Parse date columns

Date fields are stored as plain `YYYY-MM-DD` strings — pandas does not auto-parse them.

```python
date_cols = {
    "customers":    ["registration_date", "last_order_date"],
    "transactions": ["transaction_date"],
    "consent":      ["consent_date", "last_consent_review", "data_retention_expiry"],
    "campaigns":    ["activation_date"],
}

for df_name, cols in date_cols.items():
    df = locals()[df_name]
    for col in cols:
        df[col] = pd.to_datetime(df[col], errors="coerce")
```

### Validate shape

```python
assert len(customers)    == 300, f"Expected 300 customers, got {len(customers)}"
assert len(transactions) == 800, f"Expected 800 transactions, got {len(transactions)}"
assert len(consent)      == 265, f"Expected 265 consent rows, got {len(consent)}"
assert len(campaigns)    == 400, f"Expected 400 campaign rows, got {len(campaigns)}"
```

---

## Key Joins

```python
# CRM → Consent  (1:1 on email)
customers_with_consent = customers.merge(consent, on="email", how="left")

# CRM → Campaigns  (1:many on customer_id)
customers_with_campaigns = customers.merge(campaigns, on="customer_id", how="left")

# CRM → Transactions  (1:many — known customers only)
# Filter to CRM-prefixed IDs first; ANON-prefixed cannot be resolved
known_txn = transactions[transactions["device_or_customer_id"].str.startswith("CRM-")]
known_txn = known_txn.rename(columns={"device_or_customer_id": "customer_id"})
customers_with_txn = customers.merge(known_txn, on="customer_id", how="left")
```

---

## Column Quick-Reference

### `customers` (1_Customers_CRM.csv)

| Column | Type | Notes |
|---|---|---|
| `customer_id` | str | PK — format `CRM-XXXXX` |
| `first_name` | str | |
| `last_name` | str | |
| `email` | str | UK — FK to consent file |
| `city` | str | |
| `country` | str | ISO-2: ES, GB, DE, FR, BE, NL |
| `registration_date` | date | Parse with pd.to_datetime |
| `customer_segment` | str (enum) | New, Loyal, Occasional, At-Risk, High-Value |
| `lifetime_value_eur` | float | Total spend EUR |
| `total_orders` | int | |
| `last_order_date` | date | Parse with pd.to_datetime |
| `preferred_channel` | str (enum) | Email, SMS, In-App, Push Notification, Display, Paid Social |
| `account_status` | str (enum) | active, inactive, suspended |

### `transactions` (2_Transactions_Ecomm.csv)

| Column | Type | Notes |
|---|---|---|
| `transaction_id` | str | PK — format `TXN-XXXXXX` |
| `device_or_customer_id` | str | `CRM-xxxxx` or `ANON-xxxxxx` |
| `transaction_date` | date | Parse with pd.to_datetime |
| `product_name` | str | |
| `product_category` | str (enum) | 10 categories incl. Clothing, Electronics, Food & Drink |
| `quantity` | int | |
| `unit_price_eur` | float | |
| `total_amount_eur` | float | |
| `order_status` | str (enum) | completed, returned, cancelled, pending |
| `payment_method` | str (enum) | Credit Card, Debit Card, PayPal, Apple Pay, Google Pay, BNPL |
| `acquisition_source` | str (enum) | website, organic_search, paid_social, email_campaign, mobile_app, referral |
| `discount_applied` | bool | TRUE/FALSE in CSV — use `true_values`/`false_values` on read_csv |
| `discount_pct` | float | 0 when no discount |

### `consent` (3_Consent_Compliance.csv)

| Column | Type | Notes |
|---|---|---|
| `email` | str | PK + FK to customers |
| `email_marketing_opt_in` | bool | TRUE/FALSE strings — convert on load |
| `sms_opt_in` | bool | |
| `push_notification_opt_in` | bool | |
| `paid_social_opt_in` | bool | |
| `profiling_consent` | bool | |
| `consent_date` | date | Parse with pd.to_datetime |
| `last_consent_review` | date | Parse with pd.to_datetime |
| `consent_source` | str (enum) | preference_centre, website_signup, checkout, mobile_app, import_legacy |
| `data_retention_expiry` | date | Parse with pd.to_datetime — purge after this date |
| `jurisdiction` | str (enum) | GDPR, ePrivacy, CCPA |
| `right_to_erasure_requested` | bool | |
| `consent_withdrawn` | bool | |

### `campaigns` (4_Campaign_Activation.csv)

| Column | Type | Notes |
|---|---|---|
| `activation_id` | str | PK — format `ACT-XXXXX` |
| `customer_id` | str | FK to customers |
| `campaign_name` | str | |
| `activation_date` | date | Parse with pd.to_datetime |
| `channel` | str (enum) | Email, SMS, Push Notification, In-App Banner, Display Retargeting, Paid Social - Meta/Google |
| `segment_used` | str (enum) | New, Loyal, Occasional, At-Risk, High-Value |
| `data_fields_used` | str | Comma-separated list, quoted in CSV (e.g. `"email, sms, segment"`) |
| `outcome` | str (enum) | opened, clicked, converted, no_response, bounced, unsubscribed |
| `revenue_attributed_eur` | float | 0 if no revenue attributed |
| `consent_verified_at_send` | bool | TRUE/FALSE strings — convert on load |
| `activation_approved_by` | str (enum) | Marketing Ops, CRM Team, Data Team, Auto-trigger |
| `destination_platform` | str (enum) | Klaviyo, Braze, Salesforce Marketing Cloud, Meta Ads Manager, Google Ads, Internal |

---

## Common Gotchas

1. **Boolean literals are `TRUE`/`FALSE` strings** — pandas reads them as `object` (string) by default, so `df[col] & other` silently does the wrong thing. Pass `true_values=["TRUE"], false_values=["FALSE"]` to `pd.read_csv` (or post-process with `.map`).
2. **Anonymous IDs** — `device_or_customer_id` starting with `ANON-` cannot be joined to CRM. Filter before merging.
3. **Consent coverage** — only 265 of 300 customers have consent records. Use `how="left"` on the CRM side to keep all customers and surface NaN consent rows.
4. **Date strings, not datetimes** — dates are `YYYY-MM-DD` strings. Always apply `pd.to_datetime(col, errors="coerce")` before doing date arithmetic.
5. **`discount_pct` ≠ 0 when `discount_applied` = False** — treat `discount_pct` as 0 whenever `discount_applied` is `False` to avoid misleading calculations.
6. **Quoted list field** — `data_fields_used` in `4_Campaign_Activation.csv` is a quoted comma-separated string (e.g. `"email, sms, segment"`). Split on `", "` if you need to explode it; pandas keeps the quotes implicit.

---

## Install Requirements

```bash
pip install pandas
```