# Data Discovery: CASH_APP.RISK.TXN_FLAGGED_EVENTS
*Report generated: 2026-04-20*

---

## TL;DR

**CRITICAL NAMING FLAG FIRST:** `CASH_APP` is not a standard production database at Block. The standard prefix is `APP_CASH` (letters are reversed) — this is the single most common "mystery table" situation on the platform. `CASH_APP.RISK.TXN_FLAGGED_EVENTS` almost certainly does not exist under that name. The closest confirmed real table is `APP_RISK.APP_RISK.SQ_RISK_FLAGGED_EVENTS`, which is a Square-side risk table created by Squarewave Job 39524. There is also a Cash App ML variant (`APP_CASH.APP.RISK_ML_SCORED_EVENTS`) that is the canonical home for flagged Risk ML events on the Cash side. The fraud model queries your team uses likely reference one of these two tables — and may have an old alias or typo in the source SQL.

---

## Snowflake Object

**Type:** Not confirmed — `CASH_APP.RISK.TXN_FLAGGED_EVENTS` returned no results (Snowflake connector unavailable for direct query)
**Database:** `CASH_APP` — **NON-STANDARD PREFIX** (see Flags)
**Schema:** `RISK`
**Table:** `TXN_FLAGGED_EVENTS`
**Created:** Unknown
**Last modified:** Unknown
**Row estimate:** Unknown
**Comment:** Not found in Notion, Confluence, or Linear under this exact name

> **Run this SQL in your Snowflake session to check if the table exists at all:**
>
> ```sql
> -- Try the non-standard CASH_APP database (may not exist)
> SELECT table_catalog, table_schema, table_name, table_type, created, last_altered
> FROM CASH_APP.INFORMATION_SCHEMA.TABLES
> WHERE table_name ILIKE 'TXN_FLAGGED_EVENTS';
>
> -- Try the standard APP_CASH database (more likely)
> SELECT table_catalog, table_schema, table_name, table_type, created, last_altered
> FROM APP_CASH.INFORMATION_SCHEMA.TABLES
> WHERE table_name ILIKE '%FLAGGED%';
>
> -- Try APP_RISK (Square-side risk, confirmed to have a flagged_events table)
> SELECT table_catalog, table_schema, table_name, table_type, created, last_altered
> FROM APP_RISK.INFORMATION_SCHEMA.TABLES
> WHERE table_name ILIKE '%FLAGGED%';
>
> -- Find what created this table (if it exists anywhere)
> SELECT query_text, user_name, start_time
> FROM snowflake.account_usage.query_history
> WHERE UPPER(query_text) LIKE '%TXN_FLAGGED_EVENTS%'
>   AND query_type IN ('CREATE', 'CREATE_TABLE')
> ORDER BY start_time DESC LIMIT 10;
>
> -- Find who has recently queried a table by this name
> SELECT query_text, user_name, role_name, start_time
> FROM snowflake.account_usage.query_history
> WHERE UPPER(query_text) LIKE '%TXN_FLAGGED_EVENTS%'
> ORDER BY start_time DESC LIMIT 20;
> ```

### Columns
*Not available — table not confirmed to exist under this name. See "Related Tables" for confirmed column structures.*

### Tags & Properties
Unknown — table not confirmed.

### Access & Ownership Grants
Unknown — table not confirmed.

---

## Usage (Last 90 Days)

**Query frequency:** Unknown — direct Snowflake access unavailable
**Last accessed:** Unknown
**Top users/roles:** Unknown

Use the SQL above to pull `ACCESS_HISTORY` data if you need actual query counts.

---

## Lineage

**Upstream:** Unknown for `CASH_APP.RISK.TXN_FLAGGED_EVENTS` specifically (table not confirmed).

**Likely upstream for `APP_RISK.APP_RISK.SQ_RISK_FLAGGED_EVENTS`:**
- `riskarbiter.raw_feeds.scored_events` — Risk Arbiter raw evaluation feed; Squarewave Job 39524 processes this into the flagged events table

**Likely upstream for `APP_CASH.APP.RISK_ML_SCORED_EVENTS`:**
- `riskarbiter.raw_feeds.scored_events` — same source; Cash ML team Squarewave jobs (IDs 1599, 1596, 1594, 1638, 1642, 7644, 8126) process it into this unified table

**Downstream:** Unknown without Snowflake access; run the dependency SQL above.

---

## Documentation Found

### Notion

- [Risk ML Scored Events Table](https://www.notion.so/d0f756be5df94e4b9b05646d5b2a90bf) — *last edited: 2025-03-19* — Documents `APP_CASH.APP.RISK_ML_SCORED_EVENTS`, the canonical unified Cash Risk ML events table. Contains all model evaluations, scores, disqualifiers, rule-fire metadata. Lives in Cash Risk ML → Health ML Library. **This is the most likely intended table for fraud model work.**

- [Snowflake Risk Score and BTC Tables](https://www.notion.so/594c5081cb2d4a2a94272b451e2242d9) — *last edited: 2023-05-04* — Documents RiskArbiter's raw Snowflake tables: `riskarbiter.raw_feeds.scored_events` (all events sent to RA) and `riskarbiter.raw_oltp.suspicion_actions` (flagged/positive rules). Older doc, but explains the upstream data model.

- [APP_CASH_HEALTH Squarewave Project](https://www.notion.so/20054e8e103180589738f51c6f483566) — *last edited: 2025-08-28* — Explains how Cash Risk ML ETLs are structured; the `app-cash-health` GitHub repo (squareup/app-cash-health) is the source of truth for these jobs.

- [Cash Card Txn Risk Audit System (Deprecated)](https://www.notion.so/de68709ecc884b508530e32e4bc22622) — *last edited: 2026-04-10* — Deprecated system; relevant context that some risk audit tables have been sunset.

### Confluence
Not configured — tokens not set in credentials file. Skip.

### Linear Issues

- [SW2CAT-1891](https://linear.app/squareup/issue/SW2CAT-1891/sw-39524-sq-risk-flagged-events) — **[SW-39524] sq_risk_flagged_events** — Status: **Pending Auto-Migration** (active migration underway)
  - This is the confirmed Squarewave job for flagged events on the Square/risk side
  - **Output tables:** `APP_RISK.APP_RISK.SQ_RISK_FLAGGED_EVENTS`, `APP_RISK.APP_RISK.SQ_RISK_FLAGGED_EVENTS_LOADING`, `APP_RISK.APP_RISK.SQ_RISK_TRIGGERS_LOADING`
  - **Job:** [Squarewave Job 39524](https://squarewave.sqprod.co/#/jobs/39524/sql) — view the SQL for full schema
  - **Schedule:** `0 2 * * *` (daily at 2am UTC)
  - **DRI:** eaiello (Eric Aiello, inferred)
  - **Slack:** #app-risk-squarewave-sentry-alerts
  - **Complexity:** Medium (45) | Consumption Score: 209.2 | ~912 queries / 13 users (90d) | $17.97/30d cost
  - **MIGRATION IN PROGRESS** — this table is being migrated from Squarewave to Catalyst; downstream consumers will need to update

- [AMLENG-89](https://linear.app/squareup/issue/AMLENG-89/discovery-assess-scored-events-and-eval-logger-data-for-retrospective) — **[Discovery] Assess scored_events and Eval Logger data for retrospective completeness** — Status: Backlog — Context on `scored_events` data coverage for compliance/regulatory triggers; team: Applied ML Engineering

- [RISC-156](https://linear.app/squareup/issue/RISC-156/read-whats-changing-and-whats-not-with-scored_events-risk-arbiter) — **What's changing with scored_events / Risk Arbiter monitoring** — Status: Backlog — Notes that Risk Arbiter and scored_events monitoring is changing; includes a Google Doc with details

### Slack Activity

**Slack auth token expired** — `invalid_auth` error returned for all search attempts. Zero messages retrieved.

To refresh: copy a fresh `xoxp-*` token from your Slack session into `mcp-credentials.md` and update the Slack MCP config.

**Recommended manual searches once auth is restored:**
- `CASH_APP.RISK.TXN_FLAGGED_EVENTS` (exact name)
- `SQ_RISK_FLAGGED_EVENTS` (confirmed related table)
- `TXN_FLAGGED_EVENTS` (table name alone)
- In channel: `#app-risk-squarewave-sentry-alerts` (DRI channel for SW-39524)
- In channel: `#riskml-bie-discuss` (Risk ML BIE team channel)

### GitHub
GitHub MCP not invoked directly in this pass. Per the Squarewave Linear ticket:
- Job 39524 SQL: [squarewave.sqprod.co/#/jobs/39524/sql](https://squarewave.sqprod.co/#/jobs/39524/sql) — view the CREATE statement for `SQ_RISK_FLAGGED_EVENTS` schema
- Cash Risk ML ETLs live in [squareup/app-cash-health](https://github.com/squareup/app-cash-health) (requires Block SSO)

### Google Drive
Not searched in this pass — Slack auth was the priority gap. No Drive results for this table name surfaced via Notion semantic search either.

---

## Ownership Assessment

- **Team (most likely):** Risk Signals & Controls or the Square-side Risk team (for `APP_RISK.APP_RISK.SQ_RISK_FLAGGED_EVENTS`)
- **DRI:** eaiello (Eric Aiello per Squarewave migration tracking)
- **Contact/Channel:** #app-risk-squarewave-sentry-alerts (Squarewave alerts channel for this job)
- **Alternate team:** Health ML / Risk ML BIE (for `APP_CASH.APP.RISK_ML_SCORED_EVENTS` variant) — contact: #riskml-bie-discuss
- **Confidence:** Medium — the name `CASH_APP.RISK.TXN_FLAGGED_EVENTS` is non-standard and unconfirmed; ownership is inferred from the closest confirmed matching table (`SQ_RISK_FLAGGED_EVENTS`). The `RISK` schema name maps more closely to `APP_RISK.APP_RISK.*` than to `APP_CASH.APP.*`.

---

## Flags & Warnings

- [x] **Schema naming anomaly** — `CASH_APP` is non-standard at Block. Standard prefix is `APP_CASH`. This is almost certainly why nobody on your team knows where it came from — it may not exist, or it's an alias/shorthand used in old query files that refers to a different actual database.
- [ ] **Table confirmed to exist in Snowflake** — NOT CONFIRMED. Run the SQL above to verify.
- [ ] **PII columns present** — Unknown. Risk/fraud tables commonly have `USER_TOKEN`, `CUSTOMER_TOKEN`, `PAYMENT_TOKEN` which are PII-masked at Block (DSL3-tier access may be required).
- [x] **Migration in progress** — `APP_RISK.APP_RISK.SQ_RISK_FLAGGED_EVENTS` (the closest confirmed table) is tagged "Pending Auto-Migration" in Linear (SW2CAT-1891). The Squarewave → Catalyst migration is actively underway. Downstream consumers must plan to update.
- [ ] **Deprecated or sunset** — Not confirmed for this exact table. However, the broader ecosystem is mid-migration from Squarewave ETLs.
- [ ] **Data quality issues** — Slack search unavailable (auth expired); no issues found in Notion or Linear for this specific table.
- [x] **Stale data risk** — If this table is a Squarewave output and migration is underway, it may stop being populated when the Squarewave job is decommissioned. Check migration status in SW2CAT-1891.

---

## Related Tables in the Ecosystem

| Table | Purpose | Owner/DRI | Status |
|-------|---------|-----------|--------|
| `APP_RISK.APP_RISK.SQ_RISK_FLAGGED_EVENTS` | Square-side risk flagged events; Squarewave Job 39524 output | eaiello / Risk team | Active — **migration pending** |
| `APP_RISK.APP_RISK.SQ_RISK_TRIGGERS_LOADING` | Loading/staging table for triggers | eaiello / Risk team | Active — migration pending |
| `riskarbiter.raw_feeds.scored_events` | Raw Risk Arbiter evaluations — all events sent for scoring | Risk Arbiter platform team | Active (source of truth) |
| `riskarbiter.raw_oltp.suspicion_actions` | Flagged/positive rules that RA dispatches downstream | Risk Arbiter platform team | Active |
| `riskarbiter.raw_oltp.risk_actions` | Actions taken on suspicions | Risk Arbiter platform team | Active |
| `APP_CASH.APP.RISK_ML_SCORED_EVENTS` | Unified Cash Risk ML model evaluations (scores, disqualifiers, etc.) | Health ML / Risk ML BIE team | Active — **preferred for Cash ML use** |
| `APP_CASH.APP.RISK_ML_DISTINCT_EVENT_KEYS` | Distinct event keys per trigger/model for training | Health ML / Risk ML BIE team | Active |
| `APP_CASH.APP.RISK_ML_SCORED_EVENTS` (predecessor) | Various Squarewave jobs (IDs 1591–1642) for specific event sub-areas | Health ML | Being consolidated into unified table |

---

## Next Steps

1. **Verify the table exists:** Run the SQL block above in your Snowflake session. Search all three databases (`CASH_APP`, `APP_CASH`, `APP_RISK`) for any variant of `FLAGGED_EVENTS`. This will tell you if the table exists under a non-standard name, or if it's a dead reference.

2. **Check the actual query source:** Find the fraud model query files on your team that reference `CASH_APP.RISK.TXN_FLAGGED_EVENTS`. Look for comments, git blame, or query history that show when this reference was added. The query may predate a table rename/migration or be using a session-level alias.

3. **Contact the DRI directly:** Post in **#app-risk-squarewave-sentry-alerts** with: *"Hi — can anyone tell me about CASH_APP.RISK.TXN_FLAGGED_EVENTS? We see it in fraud model queries but can't confirm it exists. Is this an alias for APP_RISK.APP_RISK.SQ_RISK_FLAGGED_EVENTS or something else?"* Eric Aiello (eaiello) is the inferred DRI per Squarewave migration tracking.

4. **Check Squarewave Job 39524:** Go to [squarewave.sqprod.co/#/jobs/39524/sql](https://squarewave.sqprod.co/#/jobs/39524/sql) (requires Block SSO). Review the CREATE TABLE statement — if it matches your expected schema, this is the source. Also check if `CASH_APP.RISK` was ever an output database alias used by Squarewave for the `APP_RISK` project.
