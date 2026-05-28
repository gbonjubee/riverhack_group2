---
name: data-info
description: Reference documentation for the customer activation dataset CSV files in Data/. Use when you need to understand the schema, entity relationships, file layouts, column types, join keys, or data quality notes for the customer activation dataset (CRM, transactions, consent, campaigns).
---

# Customer Activation Dataset Documentation

**Files:** 4 CSVs in `Data/`
**Total records:** ~1,765 rows across all files
**Purpose:** Multi-source customer data model covering CRM, e-commerce transactions, consent/compliance, and campaign activation.

| # | File | Rows | PK |
|---|---|---|---|
| 1 | `Data/1_Customers_CRM.csv` | 300 | `customer_id` |
| 2 | `Data/2_Transactions_Ecomm.csv` | 800 | `transaction_id` |
| 3 | `Data/3_Consent_Compliance.csv` | 265 | `email` |
| 4 | `Data/4_Campaign_Activation.csv` | 400 | `activation_id` |

---

## Entity Relationship Diagram

```mermaid
erDiagram
    CUSTOMERS_CRM {
        string customer_id PK
        string first_name
        string last_name
        string email UK
        string city
        string country
        string registration_date
        string customer_segment
        float  lifetime_value_eur
        int    total_orders
        string last_order_date
        string preferred_channel
        string account_status
    }

    TRANSACTIONS_ECOMM {
        string transaction_id PK
        string device_or_customer_id FK
        string transaction_date
        string product_name
        string product_category
        int    quantity
        float  unit_price_eur
        float  total_amount_eur
        string order_status
        string payment_method
        string acquisition_source
        bool   discount_applied
        float  discount_pct
    }

    CONSENT_COMPLIANCE {
        string email PK_FK
        bool   email_marketing_opt_in
        bool   sms_opt_in
        bool   push_notification_opt_in
        bool   paid_social_opt_in
        bool   profiling_consent
        string consent_date
        string last_consent_review
        string consent_source
        string data_retention_expiry
        string jurisdiction
        bool   right_to_erasure_requested
        bool   consent_withdrawn
    }

    CAMPAIGN_ACTIVATION {
        string activation_id PK
        string customer_id FK
        string campaign_name
        string activation_date
        string channel
        string segment_used
        string data_fields_used
        string outcome
        float  revenue_attributed_eur
        bool   consent_verified_at_send
        string activation_approved_by
        string destination_platform
    }

    CUSTOMERS_CRM ||--o{ TRANSACTIONS_ECOMM : "device_or_customer_id (CRM-xxxxx rows)"
    CUSTOMERS_CRM ||--|| CONSENT_COMPLIANCE : "email"
    CUSTOMERS_CRM ||--o{ CAMPAIGN_ACTIVATION : "customer_id"
```

> **Note on Transactions join:** `device_or_customer_id` holds either a resolved `CRM-xxxxx` ID (known, logged-in customer) or an `ANON-xxxxxx` ID (anonymous/guest session). Only the CRM-prefixed rows can be directly joined to `CUSTOMERS_CRM`.

---

## File 1 — Customers CRM (`1_Customers_CRM.csv`)

**Source:** CRM — master customer records
**Rows:** 300
**Primary key:** `customer_id`
**Join keys:** `email` → Consent file

| Column | Type | Description | Example / Allowed values |
|---|---|---|---|
| `customer_id` | string | Unique customer identifier | `CRM-00001` |
| `first_name` | string | Customer first name | `Uma` |
| `last_name` | string | Customer last name | `Smith` |
| `email` | string | Contact email — used as FK to Consent file | `uma.smith5@hotmail.com` |
| `city` | string | City of residence | `Madrid`, `London` |
| `country` | string | ISO 2-letter country code | `ES`, `GB`, `DE`, `FR`, `BE`, `NL` |
| `registration_date` | string (YYYY-MM-DD) | Date the customer account was created | `2021-06-10` |
| `customer_segment` | string (enum) | CRM lifecycle segment | `New`, `Loyal`, `Occasional`, `At-Risk`, `High-Value` |
| `lifetime_value_eur` | float | Total spend since registration, EUR | `905.59` |
| `total_orders` | int | Count of all orders placed | `34` |
| `last_order_date` | string (YYYY-MM-DD) | Date of most recent completed order | `2023-12-11` |
| `preferred_channel` | string (enum) | Customer's preferred marketing channel | `Email`, `SMS`, `In-App`, `Push Notification`, `Display`, `Paid Social` |
| `account_status` | string (enum) | Current account state | `active`, `inactive`, `suspended` |

---

## File 2 — Transactions Ecomm (`2_Transactions_Ecomm.csv`)

**Source:** Product/Ecomm — order & transaction log
**Rows:** 800
**Primary key:** `transaction_id`
**Join keys:** `device_or_customer_id` → `customer_id` in CRM file (CRM-prefixed rows only)

| Column | Type | Description | Example / Allowed values |
|---|---|---|---|
| `transaction_id` | string | Unique transaction identifier | `TXN-000001` |
| `device_or_customer_id` | string | Either a resolved `CRM-xxxxx` ID or an anonymous `ANON-xxxxxx` device ID | `CRM-00048`, `ANON-615524` |
| `transaction_date` | string (YYYY-MM-DD) | Date the transaction occurred | `2023-04-29` |
| `product_name` | string | Name of the product purchased | `Protein Powder`, `Running Jacket` |
| `product_category` | string (enum) | Product category | `Clothing`, `Electronics`, `Food & Drink`, `Beauty`, `Health`, `Sports`, `Books`, `Home & Garden`, `Automotive`, `Toys` |
| `quantity` | int | Number of units purchased | `1`, `3` |
| `unit_price_eur` | float | Price per unit, EUR | `150.52` |
| `total_amount_eur` | float | Total line value (quantity × unit price, pre-discount), EUR | `993.84` |
| `order_status` | string (enum) | Current order state | `completed`, `returned`, `cancelled`, `pending` |
| `payment_method` | string (enum) | Payment instrument used | `Credit Card`, `Debit Card`, `PayPal`, `Apple Pay`, `Google Pay`, `Buy Now Pay Later` |
| `acquisition_source` | string (enum) | Channel that originated the session | `website`, `organic_search`, `paid_social`, `email_campaign`, `mobile_app`, `referral` |
| `discount_applied` | bool | Whether a discount code was applied | `TRUE`, `FALSE` |
| `discount_pct` | float | Discount percentage (0 if none) | `0`, `11.2` |

---

## File 3 — Consent & Compliance (`3_Consent_Compliance.csv`)

**Source:** Compliance — consent & retention rules
**Rows:** 265
**Primary key / join key:** `email` → links to `CUSTOMERS_CRM.email`

| Column | Type | Description | Example / Allowed values |
|---|---|---|---|
| `email` | string | Customer email — PK and FK to CRM file | `uma.smith5@hotmail.com` |
| `email_marketing_opt_in` | bool | Has opted in to marketing emails | `TRUE`, `FALSE` |
| `sms_opt_in` | bool | Has opted in to SMS marketing | `TRUE`, `FALSE` |
| `push_notification_opt_in` | bool | Has opted in to push notifications | `TRUE`, `FALSE` |
| `paid_social_opt_in` | bool | Has opted in to paid social ads | `TRUE`, `FALSE` |
| `profiling_consent` | bool | Has consented to behavioural profiling | `TRUE`, `FALSE` |
| `consent_date` | string (YYYY-MM-DD) | Date original consent was given | `2020-03-03` |
| `last_consent_review` | string (YYYY-MM-DD) | Date consent was last reviewed/renewed | `2021-09-19` |
| `consent_source` | string (enum) | Channel through which consent was captured | `preference_centre`, `website_signup`, `checkout`, `mobile_app`, `import_legacy` |
| `data_retention_expiry` | string (YYYY-MM-DD) | Date after which data must be purged | `2023-03-03` |
| `jurisdiction` | string (enum) | Applicable privacy regulation | `GDPR`, `ePrivacy`, `CCPA` |
| `right_to_erasure_requested` | bool | Customer has submitted a RTBF request | `TRUE`, `FALSE` |
| `consent_withdrawn` | bool | Customer has revoked all consent | `TRUE`, `FALSE` |

---

## File 4 — Campaign Activation (`4_Campaign_Activation.csv`)

**Source:** Marketing — activation & campaign log
**Rows:** 400
**Primary key:** `activation_id`
**Join keys:** `customer_id` → `CUSTOMERS_CRM.customer_id`

| Column | Type | Description | Example / Allowed values |
|---|---|---|---|
| `activation_id` | string | Unique activation event identifier | `ACT-00001` |
| `customer_id` | string | FK to CRM customer | `CRM-00293` |
| `campaign_name` | string | Name of the campaign | `Re-engagement Q3`, `Birthday Campaign` |
| `activation_date` | string (YYYY-MM-DD) | Date the campaign message was sent | `2023-05-07` |
| `channel` | string (enum) | Delivery channel for the activation | `Email`, `SMS`, `Push Notification`, `In-App Banner`, `Display Retargeting`, `Paid Social - Meta`, `Paid Social - Google` |
| `segment_used` | string (enum) | Audience segment targeted | `New`, `Loyal`, `Occasional`, `At-Risk`, `High-Value` |
| `data_fields_used` | string (comma list, quoted in CSV) | CRM/consent fields passed to the platform | `"email, sms, segment, ltv, last_order_date"` |
| `outcome` | string (enum) | Engagement result | `opened`, `clicked`, `converted`, `no_response`, `bounced`, `unsubscribed` |
| `revenue_attributed_eur` | float | Revenue attributed to this activation, EUR | `164.32`, `0` |
| `consent_verified_at_send` | bool | Whether consent was checked before send | `TRUE`, `FALSE` |
| `activation_approved_by` | string (enum) | Team or system that approved the send | `Marketing Ops`, `CRM Team`, `Data Team`, `Auto-trigger` |
| `destination_platform` | string (enum) | Marketing platform the data was pushed to | `Klaviyo`, `Braze`, `Salesforce Marketing Cloud`, `Meta Ads Manager`, `Google Ads`, `Internal` |

---

## Key Relationships Summary

| Relationship | Left key | Right key | Cardinality | Notes |
|---|---|---|---|---|
| CRM → Transactions | `customer_id` | `device_or_customer_id` | 1 : many | Only CRM-prefixed IDs match; ANON-prefixed are unresolved guests |
| CRM → Consent | `email` | `email` | 1 : 1 | Not all customers have a consent record (265 vs 300) |
| CRM → Campaigns | `customer_id` | `customer_id` | 1 : many | A customer may appear in multiple campaigns |

---

## Data Quality Notes

- **Anonymous transactions:** Roughly half the transaction rows use `ANON-xxxxxx` IDs and cannot be joined to the CRM without identity resolution.
- **Consent coverage gap:** 300 CRM customers but only 265 consent records — ~35 customers lack a consent entry.
- **Date fields stored as strings:** All date columns are `YYYY-MM-DD` strings. Parse with `pd.to_datetime()` (pandas does not auto-parse dates from CSV).
- **Booleans stored as strings:** Bool-typed columns are written as `TRUE` / `FALSE` literals in the CSVs. pandas reads them as strings by default — cast explicitly (e.g. `df[col].map({"TRUE": True, "FALSE": False})`) or use `dtype=` / `true_values` / `false_values` on `pd.read_csv`.
- **Discount pct at 0 ≠ False:** `discount_applied = False` rows may still show a non-zero `discount_pct` — treat as 0 for calculations when `discount_applied` is `False`.