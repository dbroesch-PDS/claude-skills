# Data Discovery: CASH_APP.RISK.TXN_FLAGGED_EVENTS
*Report generated: 2026-04-20*

---

## TL;DR

`CASH_APP.RISK.TXN_FLAGGED_EVENTS` is a Snowflake table (database: `CASH_APP`, schema: `RISK`, table: `TXN_FLAGGED_EVENTS`) that appears to record transactions flagged by Cash App's fraud/risk rules — most likely an output of Risk Arbiter or a downstream risk ML scoring pipeline. **No direct documentation exists for this specific table anywhere in Notion, Slack, GitHub, or Linear.** The closest well-documented relatives are `APP_CASH.APP.RISK_ML_SCORED_EVENTS` (canonical unified scored events table, owned by Banking ML) and the deprecated `app_cash_beta.app.cct_hard_decline_reviews` system. The `CASH_APP.RISK` schema name is non-standard — most production fraud data lives in `APP_CASH.APP` or `APP_CASH_HEALTH.ML_PROD` — which is probably why nobody on your team knows where it came from. Snowflake metadata could not be retrieved directly (no Snowflake connector available), so column-level details, row counts, owner grants, and query history are unknown.

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

> **Note:** Snowflake connection was not available in this session. All column-level metadata, ownership grants, and query history are blank. To fill this section, run:
> ```sql
> SELECT table_catalog, table_schema, table_name, table_type, comment, created, last_altered
> FROM CASH_APP.INFORMATION_SCHEMA.TABLES
> WHERE table_schema = 'RISK' AND table_name = 'TXN_FLAGGED_EVENTS';
> ```

### Columns
*Not available — Snowflake connection required.*

### Tags & Properties
*Not available — Snowflake connection required.*

### Access & Ownership Grants
*Not available — Snowflake connection required.*

---

## Usage (Last 90 Days)

*Not available — Snowflake query history not accessible from this session.*

**Inferred from context:** The table is actively referenced in fraud model queries by your team, suggesting it has regular SELECT users in the Risk/DS org. The `RISK` schema naming at Block typically indicates a read-optimized view or derived table output from a risk pipeline (not raw streaming data).

---

## Lineage

*Snowflake OBJECT_DEPENDENCIES not queryable — no formal lineage data available.*

**Probable upstream sources based on the broader Cash App risk data ecosystem:**

- `APP_CASH.APP.RISK_ML_SCORED_EVENTS` — The canonical unified scored events table for all Cash Risk ML model evaluations (scores, disqualifiers, rule-would-queue flags, upper/lower bounds). This is the most likely source or close relative of any "flagged transactions" table. Owned by Banking ML. Indexed on `datepartition`, `trigger_def_token`, `model_name` for performance.
- `APP_CASH.BANKLIN.TRANSACTION_EVENTS` — Raw banking transaction events; the base event stream for all payment-level risk pipelines.
- `APP_CASH.APP.CASH_CARD_TRANSACTIONS` — Cash Card transaction-level gold table (go/cctdoc); used extensively in banking ML risk models.
- `riskarbiter.raw_feeds.scored_events` — Raw Risk Arbiter scored events (one row per rule per event). The broader ETL ecosystem builds derived tables from this upstream source.

**Possible ETL origin:**
- A Squarewave job (squarewave.sqprod.co) — The `APP_RISK.APP_RISK` schema in Snowflake contains related Squarewave-produced tables including `APP_RISK.APP_RISK.SQ_RISK_FLAGGED_EVENTS` and `APP_RISK.APP_RISK.INTL_RECENT_FLAGGED_EVENTS`, observed in #app-risk-squarewave-fail-alerts. The `CASH_APP.RISK` schema may be a related or parallel schema.
- A Prefect/Airflow pipeline — The newer `APP_CASH.APP.RISK_ML_SCORED_EVENTS` was built in Prefect (github.com/squareup/prefect-ds-cash) as a replacement for many older Squarewave jobs.

---

## Documentation Found

### Notion

No page documents `CASH_APP.RISK.TXN_FLAGGED_EVENTS` by name. The most relevant pages found:

- [Risk ML Scored Events Table](https://www.notion.so/d0f756be5df94e4b9b05646d5b2a90bf) — *last edited: 2025-03-19* — Documents `APP_CASH.APP.RISK_ML_SCORED_EVENTS`, the unified replacement for many older fragmented risk scored-event tables (replaced ~14 separate Squarewave ETLs). Contains model scores, disqualifiers, and rule-would-queue flags. Author is in the Cash Risk ML org. **Most likely canonical relative.** Performance tip: filter on `TO_DATE(created_at)`, `datepartition`, `trigger_def_token`, and `model_name`.

- [Banking ML](https://www.notion.so/8efa6534092c46a786bcce0d5e1660dd) — *last edited: 2026-03-24* — Home page for Banking ML team. Covers wire fraud modeling, chargebacks, deposits risk. Parent of the Check Deposit Risk Events and Cash Card Txn Risk documentation. Likely owning team for any transaction-flagging pipeline.

- [Cash Card Txn Risk Audit System (Deprecated)](https://www.notion.so/de68709ecc884b508530e32e4bc22622) — *last edited: 2026-04-10* — Documents the **deprecated** monthly audit system for Cash Card hard-decline risk rules. Related table: `app_cash_beta.app.cct_hard_decline_reviews`. Transactions suspected of third-party fraud that were declined and flagged were reviewed in Labelbox by BIT. This system has been deprecated — if `TXN_FLAGGED_EVENTS` is related, it may be similarly deprecated or a replacement for this.

- [Txn Health Guide](https://www.notion.so/6f966d51715042e8879db8c64fc8535c) — *last edited: 2026-02-09* — Transaction data reference guide covering `APP_CASH.BANKLIN.TRANSACTION_EVENTS` and related tables. Includes a DataDog dashboard link for investigating risk-flagged transactions: `square.datadoghq.com/dashboard/5g3-jei-mf2/cash-cash-banking-mle-flagged-risk-evaluation-lookup`.

- [Risk ML Data Pipeline Registry](https://www.notion.so/f4eba6ec0a2c4791af6ac50bab0abe5c) — Registry of Risk ML ETL pipelines. Most pipelines live in the `CASH_DATA_BOT` database. Pipeline definitions are in [cash-confoundry](https://github.com/squareup/cash-confoundry/blob/main/service/src/main/kotlin/com/squareup/cash/confoundry/pipelines/PipelineDefinitions.kt) and the publisher topology is in [cash-kafkatopics](https://github.com/squareup/cash-kafkatopics). Does not reference `TXN_FLAGGED_EVENTS` explicitly.

- [ATO Snowflake Tables](https://www.notion.so/53c0a725785d4be1b656b044f9fae1d7) — *last edited: 2026-02-04* — Documents ATO-related tables including `app_cash.riskarbiter.login_models`, `app_cash.riskarbiter.logins_evaluations`, and `app_cash.app.asset_rollbacks`. Covers the `APP_RISK` database, not `CASH_APP.RISK`.

- [app_cash.app.check_deposit_risk_events](https://www.notion.so/23454e8e1031805e9c44c45bbe29b7c3) — *last edited: 2025-07-18* — Documents a comparable risk events table in the Banking ML / Check Deposits sub-domain (parses non-PII data from `cash_pii_data.public.check_deposit_risk_events_raw_green`). Squarewave job: squarewave.sqprod.co/#/jobs/16191. Demonstrates the pattern that exists for other domains.

### Confluence / Atlassian
Atlassian Rovo MCP was not searched (tokens not configured). A Confluence search may surface internal runbooks or data dictionaries for this table.

### Linear Issues
Searched Linear for issues referencing `TXN_FLAGGED_EVENTS`, fraud model table ownership, and related risk pipeline work. **No Linear issues found mentioning this table by name.**

### Slack Activity

**Exact match search for `"TXN_FLAGGED_EVENTS"` returned zero results.** This is a significant signal — the table name has either never been discussed in Slack by this exact string, is very new, or is referenced only by alias/shorthand.

**Closely related tables found in Slack:**

| Table / Signal | Channel | Notes |
|---|---|---|
| `APP_RISK.APP_RISK.SQ_RISK_FLAGGED_EVENTS` | #app-risk-squarewave-fail-alerts | Active Squarewave ETL; upstream sensor failures seen Oct 2025. Likely sibling/predecessor. |
| `APP_RISK.APP_RISK.INTL_RECENT_FLAGGED_EVENTS` | #app-risk-squarewave-fail-alerts | Square international rule flags table — same `APP_RISK.APP_RISK` schema. |
| `APP_RISK.APP_RISK.MFA_STATUS_MERCHANT_TXN_LOADING` | #app-risk-squarewave-fail-alerts | Another `APP_RISK` Squarewave table for merchant txn MFA data. |
| `riskarbiter.raw_feeds.scored_events` | #risk-arbiter-help | Canonical raw scored events; frequent discussion of ingestion delays and duplicates. |

**Key observation from Slack:** The `APP_RISK.APP_RISK` schema (not `CASH_APP.RISK`) is an active Snowflake schema used by multiple Squarewave ETL jobs related to transaction and login risk flags. The naming `CASH_APP.RISK.TXN_FLAGGED_EVENTS` may be a variant of this pattern for the Cash App-specific portion of risk flagging (as opposed to Square-side risk).

**Relevant Slack channels for escalation:**

| Channel | Why relevant |
|---|---|
| #app-risk-squarewave-fail-alerts | Monitors ETL jobs that produce risk flagged events tables |
| #risk-arbiter-help | RiskArbiter data questions (scored events, rules, flags) |
| #cash-ml-banking-help | Banking ML team help — most likely table owners |
| #risk-ml-changelog | Risk ML deployment changelogs |

### GitHub
Code search in `squareup` org for `TXN_FLAGGED_EVENTS` returned zero results. This is consistent with the table not having public/indexed code in GitHub (it may be built by a private or restricted-access pipeline repo).

---

## Ownership Assessment

Based on all available evidence:

- **Most likely owning team:** Banking ML / Health ML (under the Cash Risk ML org)
  - The `CASH_APP.RISK` naming and "flagged transactions" semantics closely align with Banking ML's domain (Cash Card transactions, payment fraud, chargebacks, wire fraud).
  - The related `APP_RISK.APP_RISK.SQ_RISK_FLAGGED_EVENTS` table (found in Slack) is managed by Squarewave jobs that reference the `app_risk` robot user.
  - The closest documented canonical table (`APP_CASH.APP.RISK_ML_SCORED_EVENTS`) is explicitly a Banking/Health ML product.

- **Secondary candidate:** Trust & Risk BIE — they own `APP_CASH_HEALTH.ML_PROD.ML_LABELS_DATAMART` and manage labels/audit data for the Risk ML ecosystem.

- **Probable contacts to reach out to:**
  - `#cash-ml-banking-help` Slack channel — Banking ML team help desk
  - The `app_risk` robot user's owning team (check registry.sqprod.co/users/app-risk)
  - Whoever owns Squarewave job #45782 (referenced in `SENSOR__GET___APP_RISK.APP_RISK.SQ_RISK_FLAGGED_EVENTS` fail alerts; `Last Updated By` is shown in the Airflow alert)

- **Confidence:** Low-Medium. No direct documentation found. Circumstantial evidence points strongly to Banking ML / Cash Risk ML ecosystem, but the `CASH_APP.RISK` database naming is non-standard and unconfirmed.

---

## Flags & Warnings

1. **Zero Slack history for the exact table name** — `TXN_FLAGGED_EVENTS` has never appeared in Slack search results. This is unusual for an actively-queried production table. The table may be: (a) very recently created, (b) accessed under a different alias, (c) in a restricted/private schema, or (d) a table that only exists in your team's queries but doesn't actually exist in Snowflake yet.

2. **Schema naming anomaly** — `CASH_APP.RISK` does not match the standard Block/Cash App Snowflake conventions (`APP_CASH.APP`, `APP_CASH_HEALTH.ML_PROD`, `APP_RISK.APP_RISK`, `CASH_DATA_BOT.PUBLIC`). This is a strong indicator that either: (a) the table is legacy/non-standard, (b) there's a typo in your queries (e.g., `APP_CASH` vs `CASH_APP`), or (c) it lives in a lesser-known schema. **Verify the exact database name before using in production.**

3. **Table may not exist** — Snowflake metadata could not be confirmed. Run the INFORMATION_SCHEMA query in Next Steps to verify. Your fraud model may be failing silently or querying a cache/stale version.

4. **No dbt model found** — No dbt manifest was found locally. If this table is a dbt model, the source code lives in a repo you don't have checked out (likely `squareup/app-cash-health`, `squareup/prefect-ds-cash`, or `squareup/forge-cash-risk-ml`).

5. **Potential PII** — Any transaction-level flagging table likely contains `customer_token`, `payment_token`, and financial amounts. Treat as sensitive and confirm data masking/access policies before sharing or using in analytics.

6. **Possible deprecated lineage** — The Cash Card Txn Risk Audit System (the most closely related documented system) was officially deprecated as of April 2026. If `TXN_FLAGGED_EVENTS` is descended from or related to that system, it may also be deprecated or have stale data.

---

## Next Steps

1. **Verify the table exists** — Run this in Snowflake first:
   ```sql
   SELECT table_catalog, table_schema, table_name, table_type, comment, created, last_altered
   FROM CASH_APP.INFORMATION_SCHEMA.TABLES
   WHERE table_schema = 'RISK' AND table_name = 'TXN_FLAGGED_EVENTS';
   ```
   If empty, also try `APP_CASH.INFORMATION_SCHEMA.TABLES` — the `CASH_APP` vs `APP_CASH` distinction may be a typo in your queries.

2. **Find the ETL that creates it** — If the table exists, run:
   ```sql
   SELECT query_text, user_name, start_time
   FROM snowflake.account_usage.query_history
   WHERE UPPER(query_text) LIKE '%TXN_FLAGGED_EVENTS%'
     AND query_type = 'CREATE'
   ORDER BY start_time DESC
   LIMIT 10;
   ```
   The CREATE statement will reveal the ETL job name, Squarewave job ID, and authoring user/team.

3. **Post in #cash-ml-banking-help** — Ask: *"Hey, does anyone know what `CASH_APP.RISK.TXN_FLAGGED_EVENTS` is? We're seeing it in fraud model queries but can't find any docs. Is it the same as `APP_CASH.APP.RISK_ML_SCORED_EVENTS` or something different? Who owns the `CASH_APP.RISK` schema?"*

4. **Check the app_risk robot user's Squarewave jobs** — Go to squarewave.sqprod.co and search for jobs owned by `app_risk` that output to a `RISK` schema or contain `TXN_FLAGGED` in the job/task name. Job #45782 (`app_risk_cash_local_rule_flags_v2_squarewave`) is a strong candidate — it references `SQ_RISK_FLAGGED_EVENTS` which may be related.

5. **Check registry.sqprod.co** — Search for `app_risk` robot user at registry.sqprod.co/users/app-risk to find the owning team and their Slack channel.

---

## Appendix: Related Tables in the Ecosystem

| Table | Purpose | Owner | Status |
|---|---|---|---|
| `APP_CASH.APP.RISK_ML_SCORED_EVENTS` | Unified scored events for all Cash Risk ML models (scores, disqualifiers, rule-would-queue) | Banking / Health ML | Active |
| `APP_CASH.APP.RISK_ML_DISTINCT_EVENT_KEYS` | Distinct event keys per trigger def — for model training feature fetching | Banking / Health ML | Active |
| `APP_RISK.APP_RISK.SQ_RISK_FLAGGED_EVENTS` | Square-side risk flagged events (Squarewave job #45782 sensor) | app_risk / Risk team | Active |
| `APP_RISK.APP_RISK.INTL_RECENT_FLAGGED_EVENTS` | International recent flagged events (Squarewave job #4969229) | app_risk / Risk team | Active |
| `APP_CASH.APP.CASH_CARD_TRANSACTIONS` | All Cash Card transactions | Finplat Issuing / Banking | Active |
| `APP_CASH.BANKLIN.TRANSACTION_EVENTS` | Raw banking transaction events | Banklin / Franklin | Active |
| `APP_CASH_HEALTH.ML_PROD.ML_LABELS_DATAMART` | Fraud/identity labels for ML training | Trust & Risk BIE | Active |
| `app_cash_beta.app.cct_hard_decline_reviews` | Monthly hard-decline risk review sets | Banking ML | DEPRECATED |
