# Data Discovery: APP_COMPLIANCE Schema (COMPLIANCE)
*Report generated: 2026-04-20*

---

## TL;DR

The `COMPLIANCE` schema you're looking for is almost certainly `APP_COMPLIANCE` in Snowflake — the database owned and operated by the **CAX (Compliance Data Science & Analytics) team** within Block's Cash App Compliance organization. The database has at least two key schemas: `APP_COMPLIANCE.APP_COMPLIANCE.*` (core compliance reference tables) and `APP_COMPLIANCE.CASH.*` (Cash App compliance data — the most actively used schema). Access requires specific Registry roles and is tightly controlled. The right channel to ask is **#compliance-data-access** on Slack, and the formal request path is **go/caxrequest** (Atlassian Jira).

---

## Snowflake Object

**Type:** Database (schema-level discovery — no direct Snowflake connection available)
**Database:** `APP_COMPLIANCE`
**Schemas confirmed:** `APP_COMPLIANCE` (schema), `CASH` (schema)
**Table:** (schema-level query — specific tables vary by use case)
**Created:** Not confirmed (Snowflake unavailable)
**Last modified:** Not confirmed
**Row estimate:** N/A (schema level)
**Comment:** Not available without direct Snowflake access

> Snowflake connector not installed. Run these queries in your Snowflake session to explore the schema:
>
> ```sql
> -- List all schemas in APP_COMPLIANCE
> SELECT schema_name, created, last_altered
> FROM APP_COMPLIANCE.INFORMATION_SCHEMA.SCHEMATA;
>
> -- List all tables you have access to
> SELECT table_schema, table_name, table_type, row_count, created, last_altered, comment
> FROM APP_COMPLIANCE.INFORMATION_SCHEMA.TABLES
> ORDER BY table_schema, table_name;
>
> -- Search for specific tables by name pattern
> SELECT table_catalog, table_schema, table_name, table_type, created, last_altered
> FROM APP_COMPLIANCE.INFORMATION_SCHEMA.TABLES
> WHERE table_name ILIKE '%<YOUR_TABLE_NAME>%';
>
> -- Check what columns exist across the schema
> SELECT table_schema, table_name, column_name, data_type, comment
> FROM APP_COMPLIANCE.INFORMATION_SCHEMA.COLUMNS
> WHERE column_name ILIKE '%enter_name_here%';
> ```
>
> Note: If you get a "permission denied" error, you don't yet have the `APP_COMPLIANCE__SNOWFLAKE__READ_ONLY` role. See the Access section below.

### Known Tables in APP_COMPLIANCE (from Linear / Squarewave migration records)

The following tables are confirmed to exist based on active Squarewave ETL jobs:

| Schema | Table | Squarewave Job | Consumption Score (90d) | DRI/Owner |
|--------|-------|----------------|------------------------|-----------|
| `APP_COMPLIANCE` | `COMPLIANCE_ADMINS` | SW-31 | 37,137 (393K queries, 27 users) | Aditya Nagpal (nagpal) |
| `APP_COMPLIANCE` | `G_STATUS_CODE` | SW-730 | 177.2 (785 queries, 40 users) | Aditya Nagpal (nagpal) |
| `CASH` | `COMPLIANCE_TAG_APPLIED_LATEST` | SW-46177 | 15,634 (204K queries, 26 users) | Shashank Kadaveru / Aditya Nagpal |
| `CASH` | `DENYLIST_PROPAGATION_EXCEPTIONS` | SW-22570 | 601.1 (21.8K queries, 7 users) | Anthony Parise (aparise) |
| `CASH` | `COMPLIANCE_CONTROLS_EVENTS_ALL` | SW-22570 | (same job) | Anthony Parise (aparise) |
| `CASH` | `DENYLIST_ACTIONS` | SW-44455 | 3,951.8 (71.6K queries, 21 users) | Zack Dixon / Anthony Parise |
| `CASH` | `COMPLIANCE_CUSTOMER_ATTRIBUTE_UPSERTED_LATEST` | ETL job | Active | CAX/CCD team |
| `CASH` | `DENYLIST_PROPAGATION_EXCEPTIONS` | SW-22570 | Active | Anthony Parise |
| `CASH` | `CASH_US_UUP_CFF_SS_INTERACTIONS_SPONSOR_R` | SW-19705 | 98.8 (disabled) | Aditya Nagpal |
| `APP_COMPLIANCE` | `OPS_REPORTING_ALERTS` | SW-45377 | 567.5 (58.4K queries, 22 users) | Robert Yu (robertyu) / jbazalgette |
| `APP_COMPLIANCE` | `BLOCK_REPORTING_METRICS` | SW-37441 | 39.9 (4.8K queries, 5 users) | Sal Nunez (snunez) |
| `CASH` | `COMPLIANCE_TAG_APPLIED_LATEST` | SW-46177 | 15,634 | Shashank Kadaveru |

### Tags & Properties
- `APP_COMPLIANCE__SNOWFLAKE__READ_ONLY` — the Registry role that grants SELECT access to this database
- `SNOOP__SNOWFLAKE__READ_ONLY` — a related read-only role also needed for some queries against compliance schemas
- Contains DSL-2 and potentially DSL-3 data — check `go/$restrictedsnowflake` for the current DSL-3 approved databases list before querying
- PII columns present: likely (customer tokens, compliance tags, denylist data)

### Access & Ownership Grants
- **Owner role:** CAX (Compliance Data Science & Analytics) team, part of Cash App Compliance Engineering (CET)
- **Required Registry role:** `compliance-snowflake` (Registry: registry.sqprod.co/roles/compliance-snowflake) AND `compliance-analytics`
- **Read role name in Snowflake:** `APP_COMPLIANCE__SNOWFLAKE__READ_ONLY`
- **PII-masked columns:** Likely present; full masking policy requires Snowflake access to confirm

---

## Usage (Last 90 Days)

Direct Snowflake access not available — but from Squarewave migration records:

| Table | 90-day Queries | Distinct Users | Cost/mo |
|-------|---------------|----------------|---------|
| `COMPLIANCE_ADMINS` | 393,037 | 27 | $18.10 |
| `COMPLIANCE_TAG_APPLIED_LATEST` | 204,538 | 26 | $28.24 |
| `DENYLIST_ACTIONS` | 71,604 | 21 | $263.80 |
| `OPS_REPORTING_ALERTS` | 58,384 | 22 | $74.78 |
| `DENYLIST_PROPAGATION_EXCEPTIONS` | 21,831 | 7 | $207.98 |

This is a heavily-used database — `COMPLIANCE_TAG_APPLIED_LATEST` alone drives 204K queries from 26 distinct users in 90 days, making it one of the most-consumed tables in the compliance data ecosystem.

### Sample Queries
> Not available without Snowflake access. The CAX team's Query Bank is at: https://www.notion.so/7600c581ca834bbeba7f79525572d220 (under construction as of Feb 2026). The CAX onboarding materials also reference a commonly-used tables sheet at go/selectstar.

---

## Lineage

**Upstream (what feeds APP_COMPLIANCE tables):**
- Squarewave ETL jobs (squarewave.sqprod.co) in the `APP_COMPLIANCE` project — most tables are created by these scheduled jobs
- The `forge-app-compliance` and `forge-app-cax` GitHub repos contain the ETL SQL
- `CASH_DATA_BOT.PUBLIC.COMPLIANCE_CUSTOMER_ATTRIBUTE_UPSERTED` feeds `APP_COMPLIANCE.CASH.COMPLIANCE_CUSTOMER_ATTRIBUTE_UPSERTED_LATEST` (via ETL)
- External systems: Guardrails (denylist data), cash-idv (identity verification), CCD service (compliance tags)

**Downstream (what APP_COMPLIANCE feeds):**
- Compliance Operations dashboards (Tableau/Mode)
- SAR filing workflows
- Transaction monitoring systems
- Compliance investigations tooling

---

## Documentation Found

### Notion
- [Compliance Data Science & Analytics (CAX) Team](https://www.notion.so/f0fe45f6e1834b96add55477f3a1bd32) — *last edited: 2026-03-20* — Team home page: mission, team structure (4 analytics teams), help channels, and request process. **This is the canonical starting point.**
- [CAX Onboarding Materials](https://www.notion.so/8a039e32e37943879043c1d7c836d1f1) — *last edited: 2026-02-25* — Detailed guide including Registry roles required for Snowflake access to APP_COMPLIANCE, Slack channels, tips on querying the schema. Key SQL tip: `select * from app_compliance.INFORMATION_SCHEMA.columns where column_name ilike '%enter_name_here%'`
- [CCD: Customer Attribute Snowflake Table](https://www.notion.so/87affd0d8d374114b5878249443beaa9) — *last edited: 2024-09-13* — Documents `APP_COMPLIANCE.CASH.COMPLIANCE_CUSTOMER_ATTRIBUTE_UPSERTED_LATEST` and the raw event table at `CASH_DATA_BOT.PUBLIC.COMPLIANCE_CUSTOMER_ATTRIBUTE_UPSERTED`
- [Compliance Customer Data](https://www.notion.so/6cb9e101b28349669d47dbf5c7ab10b8) — *last edited: 2025-11-18* — Overview of the CCD service that owns customer attributes and compliance tags data in Snowflake
- [CAX Resources](https://www.notion.so/27754e8e103180cda0cec36997195aed) — *last edited: 2026-02-25* — Links to Query Bank, Dashboard Directory, ETL deployment guide, and Snowflake tips

### Confluence
- Not configured (Atlassian tokens not set up) — note that go/caxrequest points to an Atlassian Jira form at `block.atlassian.net/jira/software/c/projects/CAX/forms/form/direct/2/10005`

### Linear Issues (relevant)
- [SW2CAT-374](https://linear.app/squareup/issue/SW2CAT-374) — `app_compliance.app_compliance.compliance_admins` — Migrated — highest-consumption table in APP_COMPLIANCE (393K queries/90d)
- [SW2CAT-599](https://linear.app/squareup/issue/SW2CAT-599) — `app_compliance.cash.compliance_tag_applied_latest` — Auto-Validating — 204K queries/90d, DRI: Shashank Kadaveru / Aditya Nagpal
- [SW2CAT-1373](https://linear.app/squareup/issue/SW2CAT-1373) — `app_compliance.cash.denylist_propagation_exceptions` — Ready for Release — DRI: Anthony Parise
- [SW2CAT-838](https://linear.app/squareup/issue/SW2CAT-838) — `app_compliance.cash.denylist_actions` — Auto-migration — DRI: Zack Dixon / Anthony Parise
- [SW2CAT-1397](https://linear.app/squareup/issue/SW2CAT-1397) — `app_compliance.app_compliance.ops_reporting_alerts` — Auto-Validating — DRI: Robert Yu / jbazalgette
- [SW2CAT-2827](https://linear.app/squareup/issue/SW2CAT-2827) — `app_compliance.app_compliance.block_reporting_metrics` — Auto-Validating — DRI: Sal Nunez

**Key observation from Linear:** All `APP_COMPLIANCE` tables are currently being migrated from Squarewave to Catalyst (dbt). The repos involved are `squareup/forge-app-compliance` and `squareup/forge-app-cax`. Table DRIs are clearly tracked per-table in these Linear issues.

### Slack Activity
**Slack token expired — search returned 0 results (invalid_auth error).**

To refresh your Slack xoxp token: copy a fresh token into `/Users/dbroesch/development/mcp-credentials.md` under `SLACK_MCP_XOXP_TOKEN=xoxp-...`, or run `claude mcp add slack ...` to re-authenticate.

**Channels known to discuss APP_COMPLIANCE (from Notion documentation):**
| Channel | Purpose |
|---------|---------|
| #compliance-data-access | Access requests for compliance Snowflake data — **post here first** |
| #cax-help | Data questions for the CAX team |
| #compliance-data-bots | ETL error messages, PR notifications for compliance Squarewave jobs |
| #app-compliance-etl-help | Help with APP_COMPLIANCE ETL/Squarewave CLI |
| #cash-compliance-data-help | General compliance data help |
| #snowflake | Snowflake outages, general Snowflake questions |

**Apparent experts based on DRI assignments in Linear:**
- **Aditya Nagpal (@nagpal)** — DRI on multiple high-traffic APP_COMPLIANCE tables (COMPLIANCE_ADMINS, G_STATUS_CODE, COMPLIANCE_TAG_APPLIED_LATEST)
- **Anthony Parise (@aparise)** — DRI on denylist tables (DENYLIST_PROPAGATION_EXCEPTIONS, DENYLIST_ACTIONS)
- **Shashank Kadaveru (@skadaveru)** — DRI on COMPLIANCE_TAG_APPLIED_LATEST
- **Robert Yu (@robertyu)** — DRI on OPS_REPORTING_ALERTS

### GitHub
- `squareup/forge-app-compliance` — ETL migration repo for APP_COMPLIANCE Squarewave jobs (referenced in multiple Linear issues)
- `squareup/forge-app-cax` — ETL migration repo for CAX-owned tables
- `squareup/cash-compliance-customer-data` — GitHub repo for the CCD service that produces COMPLIANCE_CUSTOMER_ATTRIBUTE_UPSERTED

### Google Drive
- [CAX commonly-used tables reference sheet](https://docs.google.com/spreadsheets/d/1lVg8BE3CuzNp0xjkNIxXI3mchQswf4I1LcU8FlEU2us/edit#gid=1260620496) — per CAX onboarding docs, this contains field names, data types, and notes on most-used tables
- [Stakeholder mapping](https://docs.google.com/spreadsheets/d/1K1guLOiFn_goNxtlqZnL82Wy8ak9WGraJ4mMBrFcYNI/edit?gid=1621370469#gid=1621370469) — maps functions to the correct CAX analytics sub-team to submit requests to
- [go/selectstar](https://block.selectstar.com/) — Select Star is the recommended tool at Block for finding table source code, upstream/downstream dependencies, and column documentation for APP_COMPLIANCE tables

---

## Ownership Assessment

- **Team:** CAX — Compliance Data Science & Analytics (part of Cash App Compliance Engineering / CET)
- **Contact/Channel:** #compliance-data-access (Slack) for access requests; #cax-help for data questions; formal requests at go/caxrequest (Atlassian Jira form)
- **Formal ticket system:** go/caxrequest → `block.atlassian.net/jira/software/c/projects/CAX/forms/form/direct/2/10005`
- **Confidence:** High — multiple converging signals: Notion team page explicitly names CAX, Registry roles are named `compliance-snowflake` and `compliance-analytics`, Squarewave migration issues confirm the database name `app_compliance` and identify per-table DRIs within the CAX team

---

## Flags & Warnings

- [x] Schema naming anomaly? — **YES**: User asked about "COMPLIANCE schema" — the actual Snowflake database is `APP_COMPLIANCE`, not `COMPLIANCE`. Clarify which specific tables they need, as the database contains at least two schemas: `APP_COMPLIANCE` and `CASH`.
- [ ] Table confirmed to exist in Snowflake? — Cannot confirm without access; database existence is confirmed from multiple sources
- [x] PII columns present? — **Likely YES** — compliance data by nature contains customer tokens, denylist entries, tags, and potentially DSL-3 data. Check `go/$restrictedsnowflake` before querying.
- [ ] Deprecated or migration in progress? — **YES, partially**: All Squarewave ETL jobs for APP_COMPLIANCE are currently being migrated to Catalyst (dbt). Some tables are marked "Migrate Before Freeze" or "Migrate Before Decommission". Table names and locations may change.
- [ ] Stale data? — Not confirmed; most tables run on hourly or daily schedules per Linear records
- [ ] Data quality issues? — Not found in this search, but the Squarewave migration means some jobs are being rewritten — watch for validation issues during migration window

---

## Related Tables in the Ecosystem

| Table | Purpose | Owner | Status |
|-------|---------|-------|--------|
| `APP_COMPLIANCE.APP_COMPLIANCE.COMPLIANCE_ADMINS` | Compliance admin user registry | CAX/nagpal | Active — migrating to Catalyst |
| `APP_COMPLIANCE.CASH.COMPLIANCE_TAG_APPLIED_LATEST` | Latest compliance tags per customer | CAX/skadaveru/nagpal | Active — migrating |
| `APP_COMPLIANCE.CASH.DENYLIST_ACTIONS` | Denylist action events | CAX/aparise | Active — auto-migration |
| `APP_COMPLIANCE.CASH.DENYLIST_PROPAGATION_EXCEPTIONS` | Denylist propagation exception records | CAX/aparise | Active — migrating |
| `APP_COMPLIANCE.APP_COMPLIANCE.OPS_REPORTING_ALERTS` | Operations reporting alert data | CAX/robertyu | Active — migrating |
| `APP_COMPLIANCE.APP_COMPLIANCE.BLOCK_REPORTING_METRICS` | Block-level reporting metrics | CAX/snunez | Active — migrating |
| `CASH_DATA_BOT.PUBLIC.COMPLIANCE_CUSTOMER_ATTRIBUTE_UPSERTED` | Raw event stream for customer attributes | CCD/Compliance Program Eng | Active (event table) |
| `APP_COMPLIANCE.CASH.COMPLIANCE_CUSTOMER_ATTRIBUTE_UPSERTED_LATEST` | Current state of customer attributes | CCD/CAX | Active (prod only) |
| `APP_COMPLIANCE.CASH.COMPLIANCE_CONTROLS_EVENTS_ALL` | All compliance control events | CAX/aparise | Active — migrating |

---

## Next Steps

1. **Post in #compliance-data-access with this message:** "Hi — I'm a data scientist on Risk Foundation/Support Product Science. I need SELECT access to some tables in APP_COMPLIANCE (specifically [list your tables]). Can someone point me to the right Registry role or access request process? I've already checked the CAX team page at go/caxrequest."

2. **Request Registry roles at go/registry** — Based on the CAX onboarding guide, you likely need both `compliance-snowflake` (registry.sqprod.co/roles/compliance-snowflake) and possibly `compliance-analytics` (registry.sqprod.co/roles/compliance-analytics). Note: only employees in the Compliance org can get the compliance-specific roles. If you're in Risk Foundation, you may need a different path — confirm in #compliance-data-access.

3. **Submit a formal access request at go/caxrequest** — This goes to the CAX Jira board. Select the appropriate sub-team based on the stakeholder mapping spreadsheet linked from the CAX team page.

4. **Use Select Star (go/selectstar) to browse tables before requesting access** — Select Star at block.selectstar.com lets you see table metadata, column names, and lineage without needing Snowflake access. Search for `APP_COMPLIANCE` to get a full picture of what's in the schema before you request specific table access.

5. **Check the CAX commonly-used tables sheet** for column-level documentation on the most frequently queried tables: [spreadsheet link](https://docs.google.com/spreadsheets/d/1lVg8BE3CuzNp0xjkNIxXI3mchQswf4I1LcU8FlEU2us/edit#gid=1260620496)

---

## Sources Checked

| Source | Status | Notes |
|--------|--------|-------|
| Snowflake (direct) | Unavailable | Connector not installed; SQL provided above |
| Notion | Searched | 5+ relevant pages found |
| Linear | Searched | 10+ relevant issues found, rich DRI data |
| Slack | Token expired | Refresh xoxp token in mcp-credentials.md |
| GitHub | Not searched | See forge-app-compliance, forge-app-cax repos |
| Google Drive | Not searched | CAX spreadsheet links obtained via Notion |
| Atlassian/Confluence | Not configured | go/caxrequest link obtained via Notion |
