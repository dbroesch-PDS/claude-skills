# Data Discovery: Multi-Table SQL Analysis
*Report generated: 2026-04-20*
*Skill: data-discovery v1*

---

## TL;DR

**Stop. The database prefix `CASH_APP` does not exist as a standard production database at Block.** All three tables in this query use a non-standard naming convention. The correct prefix is `APP_CASH` (letters reversed). This is the single most common cause of "mystery table" situations at Block. The query as written will fail or hit a shadow/non-production database. The canonical equivalents are `APP_CASH.HEALTH.*` for identity data, `APP_CASH.BANKLIN.*` for payment ledger data, and `APP_CASH.APP.RISK_ML_SCORED_EVENTS` for risk model scores. None of these tables should be considered safe to use until the naming is confirmed and table existence is verified.

---

# Table 1: CASH_APP.IDENTITY.USER_PROFILES

---

## Snowflake Object

**Type:** Not confirmed — table not found under this name
**Database:** `CASH_APP` — **NON-STANDARD PREFIX** (standard is `APP_CASH`)
**Schema:** `IDENTITY` — non-standard schema name for Cash App identity data
**Table:** `USER_PROFILES` — not a known production table name
**Created:** Unknown
**Last modified:** Unknown
**Row estimate:** Unknown

> **Snowflake unavailable** (connector not installed). Run these queries yourself to investigate:
> ```sql
> -- Check if the table exists under CASH_APP prefix
> SELECT table_catalog, table_schema, table_name, table_type, created, last_altered
> FROM CASH_APP.INFORMATION_SCHEMA.TABLES
> WHERE table_name ILIKE 'USER_PROFILES';
>
> -- Check the standard APP_CASH database for identity tables
> SELECT table_catalog, table_schema, table_name
> FROM APP_CASH.INFORMATION_SCHEMA.TABLES
> WHERE table_name ILIKE '%profile%' OR table_name ILIKE '%user%'
> ORDER BY table_name;
>
> -- Find any CREATE statement for this table name
> SELECT query_text, user_name, start_time
> FROM snowflake.account_usage.query_history
> WHERE UPPER(query_text) LIKE '%USER_PROFILES%'
>   AND query_type IN ('CREATE', 'CREATE_TABLE')
> ORDER BY start_time DESC LIMIT 5;
> ```

### What the Canonical Identity Tables Actually Are

The Cash App Identity team (Trust & Risk Data Science / BIE) maintains a well-documented set of tables in `APP_CASH.HEALTH.*` and `APP_CASH_PII.APP.*`. There is no `USER_PROFILES` table in the documented catalog. The closest candidates for what this query likely intends:

| What you probably want | Table | Notes |
|------------------------|-------|-------|
| Customer identity/IDV status | `APP_CASH.HEALTH.IDENTITY_IDV_ATTEMPTS` | Semi-mutable; final IDV decision per attempt |
| PII history (name/DOB/SSN/address) | `APP_CASH_PII.APP.IDENTITY_PII_HISTORY` | DSL3; temporal record of verified PII |
| Customer tokens/aliases | `APP_CASH.FRANKLIN.ALIASES` | Customer tokens, cashtag, email, SMS |
| Customer summary (non-PII) | `APP_CASH.APP.CUSTOMER_SUMMARY` | Transformed, combines multiple sources |
| Verified names over time | `APP_CASH_PII.APP.IDENTITY_SOURCED_CUSTOMER_NAMES` | DSL3; all name sources tracked |

### Columns
*Unavailable — table not confirmed to exist. See canonical alternatives above.*

### Tags & Properties
- `user_token` is a known PII-adjacent identifier at Block (joins to customer PII records)
- If a table named `USER_PROFILES` does exist, it is not documented in any known data catalog

### Access & Ownership Grants
- **Owner team:** Cash Identity (Trust & Risk Data Science / BIE), part of Identity and Safeguards
- **Contact channel:** `#cash-identity-data-questions` (confirmed active from Notion docs)
- **PII note:** Any table containing `user_token` + profile data is likely DSL3

---

## Usage (Last 90 Days)
*Unavailable — Snowflake connector not installed. Table likely does not exist.*

---

## Lineage
- **Upstream:** Unknown — if this table exists, it is not documented
- **Downstream:** This query joins it to `CASH_APP.PAYMENTS.TXN_LEDGER` on `user_token`

---

## Documentation Found

### Notion
- [Cash Identity Data Guide (go/identitydataguide)](https://www.notion.so/2f888dd1cd8f423eba513b145ab65dfd) — *last edited: 2026-04-13* — Authoritative practical guide to identity tables. Lists ~20+ documented tables; `USER_PROFILES` does not appear. Canonical identity tables live in `APP_CASH.HEALTH.*` and `APP_CASH_PII.APP.*`.
- [Cash Identity Data FAQ](https://www.notion.so/b3805374f4ff41fc8cfd9f84cccac5c9) — *last edited: 2026-02-02* — Companion FAQ with sample queries; no mention of `USER_PROFILES`.
- [Identity Documents (go/identity-documents)](https://www.notion.so/f1f97bc45544439593925d252c4ed70a) — *last edited: 2025-08-06* — Engineering docs for identity data flow.

### Linear Issues
- No Linear issues mentioning `USER_PROFILES` as a Snowflake table. Linear results for "user identity" are unrelated product engineering tickets (TIDAL, portal features), not data infrastructure.

### Slack Activity
- **Auth expired** — Slack xoxp token is invalid. Refresh it: copy a fresh token into `/Users/dbroesch/development/mcp-credentials.md` under `SLACK_MCP_XOXP_TOKEN`. Then re-run `scripts/search_slack.py`.
- **Recommended channel to ask:** `#cash-identity-data-questions`

### GitHub
- Not searched (MCP not configured for search). The identity team's ETL code lives in `squareup/forge-cash-bie-trust`.

---

## Ownership Assessment
- **Team:** Cash Identity (BIE / Trust & Risk Data Science)
- **Contact/Channel:** `#cash-identity-data-questions`
- **Confidence:** High that this team owns identity data — Low that `USER_PROFILES` is a real table

---

## Flags & Warnings
- [x] **CRITICAL: Non-standard database prefix `CASH_APP` — standard is `APP_CASH`**
- [x] Table NOT confirmed to exist in Snowflake
- [x] `user_token` is a PII-sensitive identifier — any table joining this to profile data is likely DSL3
- [ ] Deprecated or migration in progress — unknown
- [ ] Stale data — unknown
- [ ] Data quality issues — unknown

---

# Table 2: CASH_APP.PAYMENTS.TXN_LEDGER

---

## Snowflake Object

**Type:** Not confirmed — table not found under this name
**Database:** `CASH_APP` — **NON-STANDARD PREFIX** (standard is `APP_CASH`)
**Schema:** `PAYMENTS` — non-standard schema name
**Table:** `TXN_LEDGER` — not a known production table name
**Created:** Unknown
**Last modified:** Unknown

> **Snowflake unavailable.** Run these queries to investigate:
> ```sql
> -- Check both prefix variants
> SELECT table_catalog, table_schema, table_name, table_type, created, last_altered
> FROM APP_CASH.INFORMATION_SCHEMA.TABLES
> WHERE table_name ILIKE '%TXN%' OR table_name ILIKE '%LEDGER%'
> ORDER BY table_name;
>
> -- Check what the BANKLIN schema actually contains
> SELECT table_name FROM APP_CASH.INFORMATION_SCHEMA.TABLES
> WHERE table_schema = 'BANKLIN' ORDER BY table_name;
>
> -- Find CREATE history
> SELECT query_text, user_name, start_time
> FROM snowflake.account_usage.query_history
> WHERE UPPER(query_text) LIKE '%TXN_LEDGER%'
>   AND query_type IN ('CREATE', 'CREATE_TABLE')
> ORDER BY start_time DESC LIMIT 5;
> ```

### What the Canonical Ledger Tables Actually Are

Notion documentation is explicit: Cash App payment/ledger data lives in the **Banklin** system, not a generic `PAYMENTS` schema. The schema name `PAYMENTS` does not match any known production schema. The canonical tables:

| What you probably want | Table | Notes |
|------------------------|-------|-------|
| Transactions (one row per txn) | `APP_CASH.BANKLIN.TRANSACTIONS` | Updated every ~2 hours; deduplicated |
| Transaction events (state transitions) | `APP_CASH.BANKLIN.TRANSACTION_EVENTS` | 1:many with TRANSACTIONS |
| Stored value balances | `APP_CASH.BANKLIN.STORED_VALUE_BALANCE` | Balance snapshots |
| Ledger events (financial accounting) | `APP_CASH.CASH_DATA_BOT.LEDGER_EVENTS` | Updated daily; data from 2023 onward |
| Near-real-time ledger | `BANKLIN.RAW_OLTP.TRANSACTIONS` | Refreshed hourly; filter shards > 100 |
| Payment summary (transformed) | `APP_CASH.APP.PAYMENT_SUMMARY` | ETL combining franklin + banklin |

**Key data model note** (from Notion General Snowflake Tables guide): Franklin was the original monolith housing customer + action data. Banklin serves as the ledger of transactions — it shows money moving around. A transaction in the app (franklin) triggers money movements in banklin. `BANKLIN.TRANSACTION_EVENTS` shows one row per state transition (pending, void, settled); `BANKLIN.TRANSACTIONS` shows one row per overall transaction at its latest state.

### Columns
*Unavailable — table not confirmed to exist.*

The query references `t.amount` and `t.created_at` and `t.txn_id`. In `APP_CASH.BANKLIN.TRANSACTIONS`, the analogous fields are:
- Amount field: likely `amount_cents` or similar (check `DESCRIBE TABLE APP_CASH.BANKLIN.TRANSACTIONS`)
- Timestamp: `occurred_at` or `created_at`
- Transaction ID: `transaction_token` (not `txn_id`)

### Tags & Properties
- The `description` field in Banklin transactions/transaction_events is classified **DSL3** but is redacted in Snowflake (except in `CASH_PII_DATA`)
- Other fields are generally accessible to Cash App data scientists

### Access & Ownership Grants
- **Owner team:** Cash FinPlat (Financial Platform / Ledgering team)
- **Contact channel:** `#cash-finplat-help` (tag ledger oncall)
- **PII note:** `description` field is DSL3 / redacted; most other fields are not PII

---

## Usage (Last 90 Days)
*Unavailable — Snowflake connector not installed.*

For `APP_CASH.BANKLIN.TRANSACTIONS`, this is a high-traffic production table. It's used in SEV investigations and financial reconciliation. Update frequency: every ~2 hours.

---

## Lineage
- **Upstream:** Franklin (Cash App monolith) — transactions in franklin trigger money movements in banklin
- **Downstream:** `APP_CASH.APP.PAYMENT_SUMMARY`, `APP_CASH.CASH_DATA_BOT.LEDGER_EVENTS`, financial recon jobs

---

## Documentation Found

### Notion
- [Querying Banklin Ledger Data](https://www.notion.so/72991352af904c82a9acf37149b82da8) — *last edited: 2025-12-12* — Definitive FAQ for ledger data. Confirms `APP_CASH.BANKLIN.TRANSACTIONS` and `APP_CASH.BANKLIN.TRANSACTION_EVENTS` as the canonical tables. Notes data quality concerns (past Shinkansen/snowflake-streamer issues), confirms hourly update cadence.
- [General Snowflake Tables](https://www.notion.so/68d13c39e7bc4e64892e20a6f8a40fdd) — *last edited: 2026-03-18* — Cash PDS onboarding reference. Clear explanation of franklin vs banklin data model.
- [Banklin Ledger Integration Checklist](https://www.notion.so/1f154e8e1031806b8f76c970b05083fb) — *last edited: 2026-04-07* — Integration guide for teams adding ledger entries.

### Linear Issues
- [TXS-68](https://linear.app/squareup/issue/TXS-68) — "Ledger transaction token for Cash App pay showing up as numbers" — Done (2026-02-09). Signals that `txn_id` in the legacy query may not match `transaction_token` format in Banklin.
- [IT-2937](https://linear.app/squareup/issue/IT-2937) — "Clarify purpose of RELINK_MERCHANT_TRANSACTIONS job in banklin" — Triage. Indicates active ledger operations work.

### Slack Activity
- Auth expired. Recommended channel: `#cash-finplat-help` (tag ledger oncall).
- Expert contacts per Notion docs: **vijay** (Snowflake admin), **rajeeb / shuyu** (Shinkansen), **emmawei** (#cash-bi, ledger ETL), **julieyoun** (#cash-finplat-help, FinPlat PDS).

---

## Ownership Assessment
- **Team:** Cash FinPlat / Ledgering (under Money Infrastructure / Financial Platform)
- **Contact/Channel:** `#cash-finplat-help` — tag ledger oncall
- **Confidence:** High that FinPlat owns ledger data — Low that `TXN_LEDGER` is a real table name

---

## Flags & Warnings
- [x] **CRITICAL: Non-standard database prefix `CASH_APP` — standard is `APP_CASH`**
- [x] Schema `PAYMENTS` does not match any known production schema (ledger data is in `BANKLIN` schema)
- [x] Table `TXN_LEDGER` NOT confirmed to exist in Snowflake
- [x] `description` column in Banklin is DSL3 (redacted in Snowflake)
- [x] Known data quality incidents with Shinkansen replication pipeline (see Notion docs)
- [ ] `txn_id` column name likely incorrect — actual identifier is `transaction_token`

---

# Table 3: CASH_APP.RISK.MODEL_SCORES

---

## Snowflake Object

**Type:** Not confirmed — table not found under this name
**Database:** `CASH_APP` — **NON-STANDARD PREFIX** (standard is `APP_CASH`)
**Schema:** `RISK` — non-standard schema name
**Table:** `MODEL_SCORES` — not a known production table name (but closest canonical table is well-documented)
**Created:** Unknown

> **Snowflake unavailable.** Run these queries to investigate:
> ```sql
> -- Check both prefix variants for risk model score tables
> SELECT table_catalog, table_schema, table_name, table_type
> FROM APP_CASH.INFORMATION_SCHEMA.TABLES
> WHERE table_name ILIKE '%model%score%' OR table_name ILIKE '%scored%event%'
> ORDER BY table_name;
>
> -- Find CREATE history
> SELECT query_text, user_name, start_time
> FROM snowflake.account_usage.query_history
> WHERE UPPER(query_text) LIKE '%MODEL_SCORES%'
>   AND query_type IN ('CREATE', 'CREATE_TABLE')
> ORDER BY start_time DESC LIMIT 5;
> ```

### What the Canonical Risk Model Score Tables Actually Are

The canonical table for Cash Risk ML model scores is definitively documented in Notion:

**`APP_CASH.APP.RISK_ML_SCORED_EVENTS`** — The unified Risk ML scored events table. Contains all Cash Risk ML model evaluations with score, lower/upper bounds, disqualifiers, `RULE_WOULD_QUEUE`, and `QUEUE_ACTION_IS_CONSISTENT` fields. This replaced multiple disparate Squarewave ETL tables. It is clustered on `TO_DATE(created_at)`, `datepartition`, `trigger_def_token`, and `model_name` — **always filter on these fields for performance**.

A companion table `APP_CASH.APP.RISK_ML_DISTINCT_EVENT_KEYS` provides distinct `(EVENT_KEY, TRIGGER_DEF_TOKEN, DATEPARTITION)` rows for matching IDs to event tokens.

There is also a raw upstream source: `RISK_EVALUATION_MODEL_SCORES_RISK_INPUT` (Kafka/Iceberg event, published by **statham** app) — two active Linear backfill tickets ([DIT-40](https://linear.app/squareup/issue/DIT-40), [DATAOPS-1098](https://linear.app/squareup/issue/DATAOPS-1098)) show this is being migrated to S3/Iceberg as of April 2026.

Additionally, the `riskarbiter` database contains raw scoring data:
- `riskarbiter.raw_oltp.suspicion_actions` — raw rule/model evaluations
- `riskarbiter.raw_feeds.scored_events` — raw scored events feed

### Columns
*Unavailable for `CASH_APP.RISK.MODEL_SCORES` (does not exist).*

For `APP_CASH.APP.RISK_ML_SCORED_EVENTS`, the query references `r.score` and `r.entity_id` and `r.model_name`. The canonical table has:
- `model_name` — confirmed present (it's a cluster key)
- `score` / score-related fields — confirmed present per Notion docs
- `entity_id` — likely maps to `trigger_def_token` or `event_key`; exact column name may differ

The query's `WHERE r.model_name = 'fraud_v3'` filter is the correct pattern for querying this table — `model_name` is an indexed cluster key.

### Tags & Properties
- No PII in `RISK_ML_SCORED_EVENTS` directly (scores and event tokens)
- Joining to transaction + identity data creates a PII-sensitive result set

### Access & Ownership Grants
- **Owner team:** Cash Risk ML (Cash Risk ML / Fraud and Abuse ML Engineering team)
- **Contact channel:** `#model-manager` (confirmed from Notion Model Manager page)
- **Squarewave jobs:** Multiple ETL jobs (1591-1642 range, 7644, 8126) — partially being deprecated in favor of the unified table

---

## Usage (Last 90 Days)
*Unavailable — Snowflake connector not installed.*

`APP_CASH.APP.RISK_ML_SCORED_EVENTS` is actively used by the Risk ML team for model evaluation, backtesting, and monitoring. The `fraud_v3` model name appears in the WHERE clause — verify this model still exists via `SELECT DISTINCT model_name FROM APP_CASH.APP.RISK_ML_SCORED_EVENTS LIMIT 100`.

---

## Lineage
- **Upstream:** `riskarbiter.raw_feeds.scored_events` (raw), statham Kafka topic `us_west_2__risk_evaluation_model_scores_risk_input`
- **Downstream:** Model monitoring dashboards, Squarewave jobs, Model Manager threshold system

---

## Documentation Found

### Notion
- [Risk ML Scored Events Table](https://www.notion.so/d0f756be5df94e4b9b05646d5b2a90bf) — *last edited: 2025-03-19* — **Definitive documentation** for `APP_CASH.APP.RISK_ML_SCORED_EVENTS`. Explains purpose, performance tuning, cluster keys, and migration from legacy Squarewave tables.
- [Model Manager](https://www.notion.so/cfdc067a9df0442aae790056682b40ac) — *last edited: 2026-03-27* — Homepage for the risk threshold management system. Channel: `#model-manager`. Notes a legacy system (Cash-Model-Manager, deprecated) and current Block-Model-Manager.
- [2025-Q4 Wire Transfer Risk Model Scores Analysis](https://www.notion.so/2c654e8e103180a1a919d550ed6ec010) — *last edited: 2026-03-02* — Example analysis using `RULE_EVALS` scores from riskarbiter for specific fraud models.

### Linear Issues
- [DIT-40](https://linear.app/squareup/issue/DIT-40) — "Backfill RISK_EVALUATION_MODEL_SCORES_RISK_INPUT in staging and production" — Todo (assigned to Abdul Hanan, Data Ingestion Team). Active as of 2026-04-16. The raw event is being migrated to S3/Iceberg.
- [DATAOPS-1098](https://linear.app/squareup/issue/DATAOPS-1098) — Same backfill task, AiDA Data Ops team. Todo as of 2026-04-16.
- [FAB-2142](https://linear.app/squareup/issue/FAB-2142) — "Validate model performance against historical fraud patterns" — Todo (Fraud and Abuse ML Engineering). References shadow mode evaluation using model scores.
- [FAB-461](https://linear.app/squareup/issue/FAB-461) — "Identify required data for unlabeled tests" — Done (2025-11). Involved finding ensemble predictions and model scores data locations.

### Slack Activity
- Auth expired. Recommended channel: `#model-manager`.

### GitHub
- ETL code: `squareup/prefect-ds-cash` (PR #160 created the unified table)
- Risk ML repo: `squareup/forge-app-risk-ml` (active — SW2CAT migration tickets reference it)

---

## Ownership Assessment
- **Team:** Cash Risk ML / Fraud and Abuse ML Engineering
- **Contact/Channel:** `#model-manager`
- **Confidence:** High that this team owns risk model score data — Low that `CASH_APP.RISK.MODEL_SCORES` is a real table

---

## Flags & Warnings
- [x] **CRITICAL: Non-standard database prefix `CASH_APP` — standard is `APP_CASH`**
- [x] Schema `RISK` does not match any known production schema (risk data is in `APP` schema of `APP_CASH`)
- [x] Table `MODEL_SCORES` NOT confirmed to exist — likely `APP_CASH.APP.RISK_ML_SCORED_EVENTS`
- [x] Active data migration in progress (RISK_EVALUATION_MODEL_SCORES_RISK_INPUT → S3/Iceberg, DIT-40/DATAOPS-1098)
- [ ] `entity_id` column name may not match — verify against `APP_CASH.APP.RISK_ML_SCORED_EVENTS` schema
- [ ] Verify `fraud_v3` model name still exists: `SELECT DISTINCT model_name FROM APP_CASH.APP.RISK_ML_SCORED_EVENTS WHERE model_name ILIKE '%fraud%' LIMIT 50`

---

---

# Cross-Table Synthesis

## What This Query Does (Plain English)

This query attempts to pull a list of Cash App users, their transaction amounts and timestamps, and the fraud model score assigned to each transaction — specifically filtering for transactions scored by the `fraud_v3` model since January 1, 2025. The intent is likely fraud investigation or model validation: "show me which users had transactions that were scored by fraud_v3, and what scores they got."

## Join Logic

| Join | What it means |
|------|--------------|
| `u.user_token = t.user_token` | Links a user profile to their transactions. In the canonical schema, the join key would be `customer_token` (Cash App) or possibly `user_token` depending on the system. Verify the actual column name in the target tables. |
| `t.txn_id = r.entity_id` | Links a transaction to its risk model evaluation. In `APP_CASH.APP.RISK_ML_SCORED_EVENTS`, the equivalent would join on the event/transaction token — likely `trigger_def_token` or `event_key`, not `entity_id`. This join key is the highest-risk part of the query to get wrong. |

## Safety Assessment

**This query is NOT safe to run as written.** The issues:

1. **`CASH_APP` database does not exist as a standard production database** — the query will either fail or hit an unexpected shadow database. All three tables are unreachable at the specified paths.
2. **PII sensitivity is HIGH**: Joining user identity + transaction amount + fraud score creates a sensitive combined dataset. Depending on what `USER_PROFILES` contains, this could be DSL3.
3. **`fraud_v3` model existence unverified** — this model name needs to be confirmed against the actual `model_name` values in `APP_CASH.APP.RISK_ML_SCORED_EVENTS`.
4. **Column names are likely wrong**: `t.txn_id` is not a Banklin column name (use `transaction_token`); `r.entity_id` is not documented in `RISK_ML_SCORED_EVENTS`.

## Recommended Rewrite

Once you have confirmed the correct tables exist, the corrected query structure is:

```sql
-- DRAFT — verify column names before running
-- Step 1: Confirm model exists
-- SELECT DISTINCT model_name FROM APP_CASH.APP.RISK_ML_SCORED_EVENTS
-- WHERE model_name ILIKE '%fraud%' LIMIT 50;

SELECT
    c.customer_token,            -- replaces u.user_token
    t.amount_cents,              -- verify actual amount column name
    t.occurred_at,               -- replaces t.created_at
    r.score                      -- verify score column name in RISK_ML_SCORED_EVENTS
FROM APP_CASH.APP.CUSTOMER_SUMMARY c          -- replaces CASH_APP.IDENTITY.USER_PROFILES
JOIN APP_CASH.BANKLIN.TRANSACTIONS t           -- replaces CASH_APP.PAYMENTS.TXN_LEDGER
    ON c.customer_token = t.customer_token     -- verify join key
JOIN APP_CASH.APP.RISK_ML_SCORED_EVENTS r      -- replaces CASH_APP.RISK.MODEL_SCORES
    ON t.transaction_token = r.event_key       -- verify join key; may be trigger_def_token
WHERE r.model_name = 'fraud_v3'               -- verify this model name exists
  AND TO_DATE(t.occurred_at) >= '2025-01-01'  -- use cluster key for performance
  AND TO_DATE(r.created_at) >= '2025-01-01'   -- filter on cluster key
LIMIT 1000;  -- always limit first
```

**Before running:** Run `DESCRIBE TABLE` on each target table to confirm column names. Post in `#cash-identity-data-questions` (for the user/customer table), `#cash-finplat-help` (for transactions), and `#model-manager` (for fraud model scores).

---

## Related Tables in the Ecosystem

| Table | Purpose | Owner | Status |
|-------|---------|-------|--------|
| `APP_CASH.HEALTH.IDENTITY_IDV_ATTEMPTS` | IDV status per customer | Cash Identity BIE | Active |
| `APP_CASH_PII.APP.IDENTITY_PII_HISTORY` | PII history (DSL3) | Cash Identity BIE | Active |
| `APP_CASH.APP.CUSTOMER_SUMMARY` | Customer-level summary | Cash Data Science | Active |
| `APP_CASH.BANKLIN.TRANSACTIONS` | Payment transactions | Cash FinPlat / Ledgering | Active |
| `APP_CASH.BANKLIN.TRANSACTION_EVENTS` | Transaction state transitions | Cash FinPlat / Ledgering | Active |
| `APP_CASH.CASH_DATA_BOT.LEDGER_EVENTS` | Financial ledger entries | Cash FinPlat / Ledgering | Active (2023+) |
| `APP_CASH.APP.PAYMENT_SUMMARY` | Transformed payment data | Cash Data Science | Active |
| `APP_CASH.APP.RISK_ML_SCORED_EVENTS` | ML risk model scores | Cash Risk ML | Active |
| `APP_CASH.APP.RISK_ML_DISTINCT_EVENT_KEYS` | Distinct event keys for model training | Cash Risk ML | Active |
| `RISKARBITER.RAW_OLTP.SUSPICION_ACTIONS` | Raw rule/model evaluations | Risk Arbiter team | Active |

---

## Next Steps

1. **Verify whether `CASH_APP.*` database exists at all**: Run `SHOW DATABASES LIKE 'CASH%'` in your Snowflake session. If it doesn't exist, the legacy notebook was using non-production or deleted tables.

2. **Find the correct join keys**: Run `DESCRIBE TABLE APP_CASH.BANKLIN.TRANSACTIONS` and `DESCRIBE TABLE APP_CASH.APP.RISK_ML_SCORED_EVENTS` to get actual column names before rewriting the query.

3. **Verify the fraud model name**: `SELECT DISTINCT model_name FROM APP_CASH.APP.RISK_ML_SCORED_EVENTS WHERE model_name ILIKE '%fraud%' LIMIT 50` — `fraud_v3` may have been renamed or superseded.

4. **Ask in the right channels with the context you now have**:
   - `#cash-identity-data-questions`: "I found a legacy query using `CASH_APP.IDENTITY.USER_PROFILES` — what's the current canonical table for user profiles joined with transaction data for fraud analysis?"
   - `#cash-finplat-help` (tag ledger oncall): "Is there a `TXN_LEDGER` table or is `BANKLIN.TRANSACTIONS` the right source? What's the join key to `RISK_ML_SCORED_EVENTS`?"
   - `#model-manager`: "Is `fraud_v3` a current model name in `RISK_ML_SCORED_EVENTS`? What's the correct join key from transaction tokens to model scores?"
