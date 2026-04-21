# Data Discovery: Multi-Table SQL Analysis
*Report generated: 2026-04-20*

---

## SQL Query Under Investigation

```sql
SELECT u.user_token, t.amount, t.created_at, r.score
FROM CASH_APP.IDENTITY.USER_PROFILES u
JOIN CASH_APP.PAYMENTS.TXN_LEDGER t ON u.user_token = t.user_token
JOIN CASH_APP.RISK.MODEL_SCORES r ON t.txn_id = r.entity_id
WHERE r.model_name = 'fraud_v3'
  AND t.created_at >= '2025-01-01'
```

---

## Quick Reference

| Table | Status | PII Risk | Safe to Use? |
|-------|--------|----------|--------------|
| `CASH_APP.IDENTITY.USER_PROFILES` | **NOT FOUND / Non-standard** | High | No — use canonical alternatives |
| `CASH_APP.PAYMENTS.TXN_LEDGER` | **NOT FOUND / Non-standard** | Medium | No — use canonical alternatives |
| `CASH_APP.RISK.MODEL_SCORES` | **NOT FOUND / Non-standard** | Low | No — use canonical alternatives |

**Bottom line:** None of the three table names in this SQL match any known canonical tables in production documentation. These names are either legacy/deprecated tables that predate current naming conventions, internal staging constructs, or fabricated. Do not run this SQL against production without verifying the tables exist and understanding their provenance.

---

# Table 1: CASH_APP.IDENTITY.USER_PROFILES

## TL;DR
`CASH_APP.IDENTITY.USER_PROFILES` does not appear in any current Block/Cash App data documentation, Notion data guides, Linear issues, or Snowflake catalog references found. The canonical identity data lives under `APP_CASH.HEALTH.*` and `APP_CASH_PII.APP.*` schemas, not a schema named `IDENTITY`. This table name is likely a legacy reference or an alias for `app_cash_pii.app.identity_pii_history` or similar. It almost certainly contains PII (user_token is its join key).

---

## Snowflake Object

**Type:** Unknown — not confirmed to exist
**Database:** CASH_APP
**Schema:** IDENTITY *(non-standard — no active schema with this name in documentation)*
**Table:** USER_PROFILES
**Snowflake connection:** Unavailable (snowflake-connector-python not installed)
**Comment:** Not found in Notion data dictionaries

### Columns (inferred from query)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `user_token` | VARCHAR | No | User/customer identifier — likely `C_xxxxx` format. **PII-adjacent** — joins to payment and risk data |

*Full schema unknown — Snowflake unavailable and table not in documentation.*

### Tags & Properties
- **PII:** Almost certain — an IDENTITY schema USER_PROFILES table would contain name, DOB, SSN, address per Block's data model
- **Access controls:** Unknown — but identity PII tables at Block require snowflake-authorized-views PRs for access

### Access & Ownership
- **Owner team (inferred):** Identity and Safeguards / Cash Trust DS team (per Notion ancestry: `Cash Data Science (PDS, BIE, 3PR, DE)` → `Trust & Risk Data Science` → `Identity and Safeguards`)
- **Known experts:** Identity PDS and BIE (contacts visible in Notion but user IDs not resolving in this context)
- **Slack channel:** `#cash-identity-data-questions`

---

## What Actually Exists (Canonical Alternatives)

Based on the **Cash Identity Data Guide** (`go/identitydataguide`, Notion page last updated 2026-04-13), the proper tables for user identity/profile data are:

| Purpose | Canonical Table | Notes |
|---------|----------------|-------|
| Verified PII history (name/DOB/SSN) | `app_cash_pii.app.identity_pii_history` | Temporal record of verified PII per account |
| IDV attempts + final decisions | `app_cash.health.identity_idv_attempts` | Semi-mutable; use for most IDV questions |
| Customer name from all sources | `app_cash_pii.app.identity_sourced_customer_names` | Preferred for name lookups |
| Customer-token associations | `app_cash.health.lookup_and_associated_customer_tokens` | For token resolution over time |

The `CASH_APP.IDENTITY` schema is **not a documented production schema** at Cash App. All identity tables live under `APP_CASH.HEALTH`, `APP_CASH_PII.APP`, or `APP_CASH.CASH_DATA_BOT`.

---

## Documentation Found

### Notion
- [Cash Identity Data Guide (go/identitydataguide)](https://www.notion.so/2f888dd1cd8f423eba513b145ab65dfd) — *last edited: 2026-04-13* — Comprehensive guide to all identity/IDV tables; owned by Trust & Risk DS team. **This is the primary reference.**
- [Cash Identity Data FAQ](https://www.notion.so/b3805374f4ff41fc8cfd9f84cccac5c9) — *last edited: 2026-02-02* — FAQ on identity data, IDV status queries

### Slack
- Auth expired — unable to search. Channel to ask: **#cash-identity-data-questions**

### Linear Issues
- No direct hits for `USER_PROFILES` or `IDENTITY` schema tables as Snowflake objects. Identity-related Linear issues are product/engineering tickets, not data table references.

---

## Flags & Warnings
- **Table does not exist in any documented production schema** — this is a red flag
- **High PII risk** — any table in an IDENTITY schema will contain sensitive data requiring DSL3 access
- `user_token` as a join key is appropriate, but the table it comes from needs to be verified
- The `CASH_APP` database prefix is unusual — production tables use `APP_CASH` (note the order difference). This may indicate a legacy database or miscapitalized query.

---

# Table 2: CASH_APP.PAYMENTS.TXN_LEDGER

## TL;DR
`CASH_APP.PAYMENTS.TXN_LEDGER` does not match any documented production table. The canonical ledger/transaction data lives under `APP_CASH.BANKLIN.*` (for transaction events) and `APP_CASH.CASH_DATA_BOT.LEDGER_EVENTS`. There is no `PAYMENTS` schema in documented Cash App Snowflake databases. The column `txn_id` used as a join key is also non-standard — canonical tables use `transaction_token`.

---

## Snowflake Object

**Type:** Unknown — not confirmed to exist
**Database:** CASH_APP
**Schema:** PAYMENTS *(non-standard — not documented as a production schema)*
**Table:** TXN_LEDGER
**Snowflake connection:** Unavailable

### Columns (inferred from query)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `user_token` | VARCHAR | No | Foreign key to user identity |
| `amount` | NUMERIC | Unknown | Transaction amount (likely in cents) |
| `created_at` | TIMESTAMP | No | Transaction creation timestamp |
| `txn_id` | VARCHAR | No | Transaction identifier — **non-standard naming** (canonical = `transaction_token`) |

*Full schema unknown.*

### Tags & Properties
- **PII:** The `description` field in canonical Banklin tables is DSL3; this table's PII status is unknown
- `user_token` links to PII

### Access & Ownership
- **Owner team (inferred):** Financial Platform / Banklin / FinPlat Ledgering team
- **Slack channel:** `#cash-finplat-help` (tag ledger oncall)
- **Key contacts:** vijay (Snowflake admin), rajeeb or shuyu (shinkansen/streaming issues), emmawei (ledger_event ETL), julieyoun (FinPlat PDS)

---

## What Actually Exists (Canonical Alternatives)

Based on **"Querying Banklin Ledger Data"** (Notion, `go/banklinadminator` area, last updated 2025-12-12):

| Purpose | Canonical Table | Refresh Rate |
|---------|----------------|--------------|
| Transactions (deduplicated) | `APP_CASH.BANKLIN.TRANSACTIONS` | Every 2 hours |
| Transaction events | `APP_CASH.BANKLIN.TRANSACTION_EVENTS` | Every 2 hours |
| Ledger events (ETL) | `APP_CASH.CASH_DATA_BOT.LEDGER_EVENTS` | Daily |
| Stored value balances | `APP_CASH.BANKLIN.STORED_VALUE_BALANCE` | Every 2 hours |
| Hourly raw (use with care) | `BANKLIN.RAW_OLTP.TRANSACTIONS` | Hourly (filter shards > 100) |

Key differences from the SQL in question:
- The identifier field is called `transaction_token`, not `txn_id`
- The join in the legacy SQL (`t.txn_id = r.entity_id`) will not work with canonical tables without renaming

---

## Documentation Found

### Notion
- [Querying Banklin Ledger Data](https://www.notion.so/72991352af904c82a9acf37149b82da8) — *last edited: 2025-12-12* — FAQ and table guide for all ledger/transaction data. **Primary reference.**
  - Note: parent page is `Ledgering Wiki (Obsolete)` → `Ledgering Team (Obsolete)` — the documentation itself may be partially stale
- [Activity-Ledger Mapping Steps](https://www.notion.so/2e154e8e1031801788a2df16164a4ff2) — ledger mapping reference

### Linear Issues
- [TXS-68](https://linear.app/squareup/issue/TXS-68/) — `[Ledger] Transaction Token for Cash APP pay showing up as numbers` — Done (2026-02) — Points to `transaction_token` naming conventions
- [MM-94](https://linear.app/squareup/issue/MM-94/) — `[ledger] Add new fields to cleared txn events feed` — Resolved (legacy)

---

## Flags & Warnings
- **Table does not exist in documented production schema** — critical
- `PAYMENTS` is not a documented Cash App Snowflake schema; ledger data lives in `BANKLIN` schema
- Column `txn_id` is non-standard; canonical identifier is `transaction_token`
- The parent Notion wiki is marked **Obsolete** — the team has since reorganized
- Known past data quality issues with Shinkansen replication pipeline (documented in Notion FAQ)
- `description` field in real transactions is DSL3 (redacted in standard Snowflake access)

---

# Table 3: CASH_APP.RISK.MODEL_SCORES

## TL;DR
`CASH_APP.RISK.MODEL_SCORES` does not match any documented production table name. Risk model scores at Cash App are stored in RiskArbiter-adjacent tables (`riskarbiter.raw_feeds.scored_events`, `riskarbiter.raw_oltp.suspicion_actions`) or in team-specific ETL outputs. The `model_name = 'fraud_v3'` filter suggests this is querying a risk scoring system — likely RiskArbiter or a legacy Frisky/custom scoring pipeline — but no table with this name exists in documentation. The `entity_id` join key is also non-standard.

---

## Snowflake Object

**Type:** Unknown — not confirmed to exist
**Database:** CASH_APP
**Schema:** RISK *(non-standard)*
**Table:** MODEL_SCORES
**Snowflake connection:** Unavailable

### Columns (inferred from query)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `score` | FLOAT/NUMERIC | Unknown | Risk model score |
| `model_name` | VARCHAR | No | Name of the model — query filters on `'fraud_v3'` |
| `entity_id` | VARCHAR | No | Entity being scored — joins to `t.txn_id` (transaction-level scoring) |

### Tags & Properties
- **PII:** Low direct PII — model scores are derived, not raw PII — but joining to user_token + transaction data creates a sensitive combined dataset
- **Sensitivity:** Risk score data can be commercially sensitive (model IP)

### Access & Ownership
- **Owner team (inferred):** Cash Risk ML / UCML — based on Notion `Cash Risk ML` ancestry and Model Manager documentation
- **Slack channel:** `#model-manager`, `#cash-ml-risk-changelog`, `#app-risk-squarewave-alerts`
- **Key contacts:** Model Manager team (see DRIs in Notion); for legacy fraud models, `#cash-data-etl` is the best starting point

---

## What Actually Exists (Canonical Alternatives)

Based on **Snowflake Risk Score and BTC Tables** (Notion, last updated 2023-05-04) and **Model Manager** documentation:

| Purpose | Canonical Table | Notes |
|---------|----------------|-------|
| All events sent to RiskArbiter for scoring | `riskarbiter.raw_feeds.scored_events` | Includes `model_name` column |
| Flagged rule actions | `riskarbiter.raw_oltp.suspicion_actions` | Positive/flagged rules actioned by downstream |
| Risk actions taken | `riskarbiter.raw_oltp.risk_actions` | Actions on suspicions |
| P2P layering scored events | `app_compliance.p2p_layering.riskarbiter_scored_events` | Team-specific |
| Wire fraud model scores (example) | `ra.RULE_EVALS['wire_fraud_model_full_bad_2024plus']['score']` | Semi-structured RULE_EVALS field on RA tables |

The `fraud_v3` model name is plausible — it follows Block's model naming convention. However, the canonical way to query it would be:
```sql
-- Canonical equivalent query pattern
SELECT scored_event_id, score, model_name, entity_id, created_at
FROM riskarbiter.raw_feeds.scored_events
WHERE model_name = 'fraud_v3'
  AND created_at >= '2025-01-01'
```

Note: The `RULE_EVALS` column in some RiskArbiter tables is a semi-structured JSON field that stores scores by model name — this is commonly used in analysis queries (see 2025-Q4 Wire Transfer Risk Model Scores Analysis Notion page).

---

## Documentation Found

### Notion
- [Model Manager](https://www.notion.so/cfdc067a9df0442aae790056682b40ac) — *last edited: 2026-03-13* — Hub for Cash Risk ML model management; describes how model scores flow through RiskArbiter. **Primary reference for model scoring infrastructure.**
- [Model Manager Enhancement and Expansion (Historical Design Doc)](https://www.notion.so/ef93f6268512438e91c99ecea0702dc9) — *last edited: 2026-04-20* — Architecture doc; describes `RuleScoreDataSource` which fetches from RiskArbiter
- [Snowflake Risk Score and BTC Tables](https://www.notion.so/594c5081cb2d4a2a94272b451e2242d9) — *last edited: 2023-05-04* — Documents `riskarbiter.raw_feeds.scored_events` and related tables. **Note: last updated 2023 — may be partially stale**
- [2025-Q4 Wire Transfer Risk Model Scores Analysis](https://www.notion.so/2c654e8e103180a1a919d550ed6ec010) — *last edited: 2026-03-02* — Example of how model scores are actually queried in practice

### Linear Issues
- [APFR-145](https://linear.app/squareup/issue/APFR-145/) — `AFF Fraud Model Update - FEB Submission` — In Review (2026-04) — References model updates: Abusive Prevention Model V4, Stolen Financial Prevention Model V4, ATO Prevention Model V4
- [FAB-2142](https://linear.app/squareup/issue/FAB-2142/) — `Validate model performance against historical fraud patterns` — Todo — Fraud and Abuse ML Engineering team, references `ml_xgb_FA_signup_20250606_flagging`
- [LCR-970](https://linear.app/squareup/issue/LCR-970/) — `Deploy three fraud models to US checkout_confirm` — Done (2026-02) — Lending & Commerce Risk Engineering; references ATO/misuse models deployed to Gondola

---

## Flags & Warnings
- **Table does not exist in any documented production schema** — critical
- `RISK` is not a standard Cash App Snowflake schema for model output data
- `entity_id` is a generic column name — RiskArbiter uses specific identifiers depending on event type
- The `CASH_APP` database prefix is suspicious (vs standard `APP_CASH` or `RISKARBITER`)
- Model name `fraud_v3` is plausible but unverified in current model registry documentation

---

# Cross-Table Synthesis

## What This Query Is Trying To Do
The query joins user identity, transaction, and fraud model score data to create a user-level view of fraud scores on transactions since Jan 2025. This is a common pattern in Cash App risk analysis — it's a legitimate analysis shape. The **problem is the table names**, not the query logic.

## The Canonical Equivalent
```sql
-- Suggested canonical rewrite (needs validation with actual table owners)
SELECT
    u.customer_token AS user_token,
    t.amount_cents AS amount,
    t.created_at,
    sa.score  -- or parse from RULE_EVALS depending on RA table
FROM app_cash_pii.app.identity_pii_history u   -- or identity_sourced_customer_names
JOIN app_cash.banklin.transactions t
    ON u.customer_token = t.customer_token
JOIN riskarbiter.raw_feeds.scored_events sa
    ON t.transaction_token = sa.entity_id
WHERE sa.model_name = 'fraud_v3'
  AND t.created_at >= '2025-01-01'
```
**This rewrite is illustrative only** — column names need verification with table owners before use.

## Naming Convention Red Flags
The original SQL uses the `CASH_APP` database prefix throughout. In Cash App's Snowflake environment:
- Production tables use `APP_CASH` (not `CASH_APP`)
- Identity tables live in `APP_CASH.HEALTH` or `APP_CASH_PII.APP`
- Ledger tables live in `APP_CASH.BANKLIN`
- Risk score tables live in `RISKARBITER.*` or team-specific schemas

The `CASH_APP.IDENTITY/PAYMENTS/RISK` naming pattern looks like it may have been **written by someone who guessed at table names** or came from a different data warehouse environment (e.g., a staging environment, a now-deleted legacy system, or an external document that wasn't tracking real table names).

---

# Ownership Assessment

| Table | Most Likely Owner Team | Contact |
|-------|----------------------|---------|
| IDENTITY.USER_PROFILES | Identity and Safeguards / Trust & Risk DS | #cash-identity-data-questions |
| PAYMENTS.TXN_LEDGER | FinPlat / Banklin / Ledgering | #cash-finplat-help (tag ledger oncall) |
| RISK.MODEL_SCORES | Cash Risk ML / UCML | #model-manager or #cash-data-etl |

**Confidence:** Low for all three — these specific tables cannot be confirmed to exist, so ownership is inferred from the subject matter domain.

---

# Flags & Warnings (Summary)

1. **None of the three tables exist in documented production schemas** — the database (`CASH_APP`) and schema names (`IDENTITY`, `PAYMENTS`, `RISK`) don't match any known active schemas
2. **Database naming is inverted** — Cash App production uses `APP_CASH`, not `CASH_APP`
3. **`txn_id` is non-standard** — canonical transaction identifier is `transaction_token`
4. **PII risk on USER_PROFILES** — any identity join introduces DSL3 PII obligations; you'll need snowflake-authorized-views access
5. **Slack auth expired** — unable to search Slack for recent discussions or deprecation notices
6. **Snowflake unavailable** — could not confirm existence of tables directly (snowflake-connector-python not installed)
7. **Some reference docs are stale** — the Snowflake Risk Score doc is from 2023; the Ledgering Wiki parent is marked Obsolete

---

# Next Steps

1. **Verify whether these tables exist at all** — run `SHOW TABLES IN SCHEMA CASH_APP.IDENTITY` in Snowflake Query Expert (go/queryexpert). If they don't exist, discard this SQL entirely.

2. **Ask in #cash-identity-data-questions** — "Does `CASH_APP.IDENTITY.USER_PROFILES` exist or is there a canonical equivalent? I found it in a legacy notebook." The Identity PDS/BIE team maintains `go/identitydataguide` and will know.

3. **Reach out in #cash-finplat-help** and tag ledger oncall for the TXN_LEDGER question; ask in #model-manager or #cash-data-etl for MODEL_SCORES. Both channels have active experts who can confirm whether these table names ever existed.

4. **If you need a working equivalent query**, start from `app_cash.banklin.transactions` for the payments leg, `riskarbiter.raw_feeds.scored_events` for model scores (filter on `model_name = 'fraud_v3'`), and `app_cash_pii.app.identity_pii_history` for identity. Use `customer_token` and `transaction_token` as join keys.

---

## Source Coverage

| Source | Status | Notes |
|--------|--------|-------|
| Snowflake | Unavailable | snowflake-connector-python not installed |
| Notion | Searched | 15+ pages searched; 6 fetched in detail |
| Linear | Searched | Multiple queries; no direct table hits |
| Slack | Auth expired | `invalid_auth` — Slack MCP token needs refresh |
| Google Drive | Not searched | No triggering signals to search |
| dbt manifests | Not found | No manifest.json at standard paths |
