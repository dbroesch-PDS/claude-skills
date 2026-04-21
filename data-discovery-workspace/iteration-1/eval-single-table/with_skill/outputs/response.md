# Data Discovery: CASH_APP.RISK.TXN_FLAGGED_EVENTS
*Report generated: 2026-04-20*

---

## TL;DR

`CASH_APP.RISK.TXN_FLAGGED_EVENTS` is a Snowflake table in the `RISK` schema of the `CASH_APP` database that records transactions flagged by Cash App's risk rules — most likely the output of Risk Arbiter or a related ML scoring pipeline for Cash Card or P2P transactions. No direct documentation exists for this specific table under this name; the closest documented relatives are `APP_CASH.APP.RISK_ML_SCORED_EVENTS` (the canonical unified scored events table owned by Banking/Health ML) and the deprecated `app_cash_beta.app.cct_hard_decline_reviews` audit system. The `CASH_APP.RISK` schema is not the standard production schema for most fraud data (which typically lives in `APP_CASH.APP` or `APP_CASH.APP_CASH_HEALTH`), which may explain why your team can't find documentation. **Snowflake metadata could not be retrieved** (connector not installed), so column-level details, row counts, ownership grants, and usage history are unknown.

---

## Snowflake Object

**Type:** Unknown (base table or view — could not connect to Snowflake)
**Database:** CASH_APP
**Schema:** RISK
**Table:** TXN_FLAGGED_EVENTS
**Created:** Unknown
**Last modified:** Unknown
**Row estimate:** Unknown
**Comment:** Not retrievable without Snowflake connection

> **Note:** Snowflake connection failed — `snowflake-connector-python` is not installed in the current environment. All Snowflake metadata fields (columns, ownership, usage, lineage) are blank. Run `pip install snowflake-connector-python` and re-run `scripts/query_snowflake.py --table CASH_APP.RISK.TXN_FLAGGED_EVENTS` to fill this section.

### Columns
*Not available — Snowflake connection required.*

### Tags & Properties
*Not available — Snowflake connection required.*

### Access & Ownership
*Not available — Snowflake connection required.*

---

## Usage (Last 90 Days)

*Not available — Snowflake connection required.*

**What we can infer from context:** The table name appears in fraud model queries used by your team, suggesting it has active SELECT users in the Risk/Data Science org. The `RISK` schema naming pattern at Block typically indicates either a read-optimized view/derived table produced by a risk pipeline, or a legacy schema predating the current `APP_CASH.APP` convention.

---

## Lineage

*Snowflake OBJECT_DEPENDENCIES not queryable — no lineage data available.*

**Probable upstream sources based on ecosystem context:**
- `APP_CASH.APP.RISK_ML_SCORED_EVENTS` — the canonical table for all Cash Risk ML model evaluations (scores, disqualifiers, rule-would-queue flags). This is the most likely source for any "flagged" transaction events table in the Risk domain.
- `APP_CASH.BANKLIN.TRANSACTION_EVENTS` — raw banking transaction events; often joined into risk pipelines.
- `APP_CASH.APP.CASH_CARD_TRANSACTIONS` — Cash Card transaction-level table; used extensively in banking ML risk pipelines.

**Possible ETL origin:**
- A Squarewave job (squarewave.sqprod.co) — Banking ML and Health ML teams run many Squarewave ETLs that produce derived risk tables.
- A Prefect/Airflow pipeline — the newer `APP_CASH.APP.RISK_ML_SCORED_EVENTS` was built as a replacement for many smaller Squarewave jobs that previously produced sub-domain event tables.

---

## Documentation Found

### Notion

- [Risk ML Scored Events Table](https://www.notion.so/d0f756be5df94e4b9b05646d5b2a90bf) — *last edited: 2025-03-19* — Documents `APP_CASH.APP.RISK_ML_SCORED_EVENTS`, the unified replacement for disparate risk model scored event tables. Contains model scores, disqualifiers, and rule-would-queue flags. **Most likely canonical relative of TXN_FLAGGED_EVENTS.** Performance tip: filter on `TO_DATE(created_at)`, `datepartition`, `trigger_def_token`, `model_name`.

- [Banking ML](https://www.notion.so/8efa6534092c46a786bcce0d5e1660dd) — *last edited: 2026-04-14* — Home page for the Banking ML team (go/Cash-ML-Banking). Lists team members (modelers: David Puldon (Lead), Kyuwon Choi (Lead), Alex Gude, James LeDoux, Julien Varennes, Lu Liu, Nicholas Buhagiar; engineers: Michael Selevan (Lead), Tom John, Daniel Choi, Amira Dowidar, Hao Lian). Contains the **Banking Tables Ownership Index** and links to all active projects.

- [Banking Tables Ownership Index](https://www.notion.so/eacd278ae5d542c0a4f051012ae3aece) — *last edited: 2025-04-24* — Reference table for identifying owners across commonly used Banking ML tables (PDS, MLM, BIE owners). Does not explicitly list `TXN_FLAGGED_EVENTS` by name, but covers `RISK/ML`-typed tables in the `APP_CASH` ecosystem.

- [Cash Card Txn Risk Audit System (Deprecated)](https://www.notion.so/de68709ecc884b508530e32e4bc22622) — *last edited: 2026-04-10* — Documents the **deprecated** monthly audit review system for hard-decline risk rules. Related table: `app_cash_beta.app.cct_hard_decline_reviews`. Now deprecated; flagged txns from this system were reviewed by BIT in Labelbox.

- [Txn Health Guide](https://www.notion.so/6f966d51715042e8879db8c64fc8535c) — *last edited: 2026-02-09* — Reference guide for transaction-level tables (CCT, Banklin, etc.). In the "Risk Related" section, links to a DataDog dashboard: `square.datadoghq.com/dashboard/5g3-jei-mf2/cash-cash-banking-mle-flagged-risk-evaluation-lookup` — **you can enter a customer token to see which risk rules recently flagged their transactions.** This is the live observability surface for flagged transaction risk rules.

- [Risk ML Labels Data Mart](https://www.notion.so/08a351b89d1142be9be224a4abd3b2d0) — *last edited: 2026-01-12* — Documents `APP_CASH_HEALTH.ML_PROD.ML_LABELS_DATAMART`, the centralized labels store for Health ML teams (Identity, Chargebacks, Banking labels). Managed by Trust & Risk BIE team. Access: registry.sqprod.co/groups/app-cash-health--snowflake__read_only.

- [FEM - Foundational Events Model](https://www.notion.so/1a454e8e1031807c99c2c739bee9d73a) — *last edited: 2026-02-17* — Documents a foundation model built on ~120 customer events sourced from RiskVault. Data flows through `datac_risk_foreign_catalog` in Databricks into `cash_diary` catalog. Related to Risk Labs team. Contact channel: linked in page.

### Confluence
*Atlassian/Confluence MCP not configured (tokens not set in mcp-credentials.md — `CONFLUENCE_API_TOKEN=REPLACE`). Could not search.*

### Linear Issues
*Linear MCP search returned generic docs only; no issues specifically referencing `TXN_FLAGGED_EVENTS` found. The `APP_RISK.APP_RISK.PRE_ATO_DATA_LOADING` Airflow failure seen in Slack suggests a related `APP_RISK` schema exists in Snowflake (note: `APP_RISK`, not `CASH_APP.RISK`).*

### Slack Activity

**Exact match search for `"TXN_FLAGGED_EVENTS"` returned zero results.** This is notable: the table name has never been discussed in Slack by that exact string (or results are not indexed). This strongly suggests the table is either:
1. Recently created and not yet discussed
2. Referenced under a different name/alias in conversations
3. An internal/private schema not commonly cited by name

**Broader RISK-domain channels active in the ecosystem:**

| Channel | Relevance |
|---------|-----------|
| #cash-apt-risk-rule-deployment-notifications | Risk Arbiter rule deployments — most likely source of flagging pipeline |
| #risk-ml-changelog | Risk Arbiter ML deployment changelogs |
| #apt-fraud-sentry-prod-alert | Fraud model production alerts |
| #apt-fraud-alert | Fraud alert channel |
| #ap-fraud-risk-biz-alerts | Fraud risk business alerts |
| #first-line-risk-ds | First-line risk data science |
| #cash-ml-banking-help | Banking ML team help channel (listed on their Notion page) |
| #risk-arbiter-oncall | Risk Arbiter on-call |
| #fraud-ml-oncall | Fraud ML on-call |

**Key discussion found:** In `#app-risk-squarewave-fail-alerts`, a recent Airflow failure references `APP_RISK.APP_RISK.PRE_ATO_DATA_LOADING` — suggesting the `APP_RISK` Snowflake database/schema is an active ATO (Account Takeover) data pipeline. This may be a sibling or predecessor to `CASH_APP.RISK`.

**Apparent experts** (based on ownership signals, not direct table mentions):
- **@dpuldon (David Puldon)** — Banking ML lead modeler; most likely point of contact for any `RISK`-schema derived table in the banking domain
- **@agude (Alex Gude)** — Seen in #risk-ml-changelog deploying Risk Arbiter Banking ML changes (e.g., turning off SXR rules). Active in the scored events / risk rule space.
- **@mselevan (Michael Selevan)** — Banking ML engineering lead

### Google Drive
*Google Drive MCP not searched (no Drive-specific MCP tool available in current session). The Banking ML team maintains several Google Drive resources (Signal Backlog, Team OKRs, onboarding docs for Cards/Deposits/Disputes) — searching these manually may yield results.*

---

## Ownership Assessment

Based on the above, the most likely owner is:

- **Team:** Banking ML / Health ML (Cash Risk ML org)
  - Primary team: Banking ML (go/Cash-ML-Banking)
  - Secondary: Trust & Risk BIE (for labels/audit data)
  - Contact channel: `#cash-ml-banking-help`
- **Probable contacts:**
  - David Puldon (dpuldon) — Banking ML modeler lead
  - Alex Gude (agude) — active in risk rule deployment and scored events
  - Michael Selevan (mselevan) — Banking ML engineering lead
- **Confidence:** Low-Medium — the `CASH_APP.RISK` schema is not in any found documentation, but all circumstantial evidence (risk flagging, transaction events, fraud model usage) points to the Banking ML / Health ML ecosystem. It could also be an older `APP_RISK` schema that predates the current `APP_CASH.APP` convention.

**Important caveat:** There is a discrepancy worth noting. Most actively documented Cash App risk tables use the `APP_CASH` database (not `CASH_APP`). The `CASH_APP` database naming may indicate:
- A legacy or non-standard database
- A read replica or view layer
- A schema under a different Snowflake account/region

Confirm the database name carefully — your fraud model queries may be hitting `APP_CASH.RISK.TXN_FLAGGED_EVENTS` (common pattern) rather than `CASH_APP.RISK.TXN_FLAGGED_EVENTS`.

---

## Flags & Warnings

1. **Zero Slack history** — The exact string `TXN_FLAGGED_EVENTS` has never appeared in Slack search results. This is unusual for an actively-used fraud model input table and warrants investigation. Either the table is very new, it's accessed via an alias, or it's in a restricted schema.

2. **Snowflake metadata unavailable** — Could not confirm the table even exists, its schema, or who owns it. Before using this table in production, verify it exists and check for deprecation tags.

3. **Schema naming anomaly** — `CASH_APP.RISK` doesn't match the standard `APP_CASH.APP` or `APP_CASH_HEALTH.ML_PROD` patterns used by documented risk tables. This could indicate a legacy schema, a different Snowflake account, or a typo/alias in your team's queries. Run `SELECT CURRENT_DATABASE(), CURRENT_SCHEMA()` in your session to verify.

4. **No dbt model found** — No dbt manifest found locally at `~/development/`. If this table is produced by dbt, the model may live in a repo you don't have checked out (e.g., `squareup/prefect-ds-cash` or `squareup/app-cash-health`).

5. **Possible PII** — Any transaction-level flagging table in the risk domain likely contains `customer_token`, `transaction_token`, and potentially amounts. Treat as sensitive until masking policies are confirmed via Snowflake.

6. **The deprecated audit system** — If this table is related to the Cash Card Txn Risk Audit System, note it was **deprecated** as of the Notion page's last edit (2026-04-10). Consuming a deprecated table is a data quality risk.

---

## Next Steps

1. **Ask in `#cash-ml-banking-help` or DM @agude** — Post: "Hey, does anyone know where `CASH_APP.RISK.TXN_FLAGGED_EVENTS` comes from? We're seeing it in some fraud model queries but can't find docs. Is this the same as `APP_CASH.APP.RISK_ML_SCORED_EVENTS` or something different?" Alex Gude has been active in risk rule deployments and scored events work.

2. **Verify the table exists and check its DDL** — Run in Snowflake:
   ```sql
   SELECT table_catalog, table_schema, table_name, table_type, comment, created, last_altered
   FROM CASH_APP.INFORMATION_SCHEMA.TABLES
   WHERE table_schema = 'RISK' AND table_name = 'TXN_FLAGGED_EVENTS';
   ```
   If that returns nothing, try `APP_CASH.INFORMATION_SCHEMA.TABLES` — the database name in your queries may be wrong.

3. **Check the Squarewave ETL that produces it** — If the table exists, run:
   ```sql
   SELECT query_text FROM snowflake.account_usage.query_history
   WHERE UPPER(query_text) LIKE '%TXN_FLAGGED_EVENTS%'
     AND query_type = 'CREATE'
   ORDER BY start_time DESC LIMIT 5;
   ```
   The CREATE statement will reveal the ETL job name and authoring team.

---

## Appendix: Related Tables in the Ecosystem

For context, here are the well-documented relatives your fraud model queries might be able to migrate to:

| Table | Purpose | Owner |
|-------|---------|-------|
| `APP_CASH.APP.RISK_ML_SCORED_EVENTS` | Unified scored events for all Cash Risk ML models | Banking/Health ML |
| `APP_CASH.APP.RISK_ML_DISTINCT_EVENT_KEYS` | Slim table of distinct event keys by trigger def | Banking/Health ML |
| `APP_CASH.APP.CASH_CARD_TRANSACTIONS` | All Cash Card transactions | Finplat Issuing/Banking |
| `APP_CASH.BANKLIN.TRANSACTION_EVENTS` | Raw banking transaction events | Banklin/Franklin |
| `APP_CASH_HEALTH.ML_PROD.ML_LABELS_DATAMART` | Fraud/identity labels for ML training | Trust & Risk BIE |
| `app_cash_beta.app.cct_hard_decline_reviews` | Monthly hard-decline review sets (DEPRECATED) | Banking ML |
