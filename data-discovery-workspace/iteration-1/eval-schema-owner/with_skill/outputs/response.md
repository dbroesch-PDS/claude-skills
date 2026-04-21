# Data Discovery: APP_COMPLIANCE Schema (Snowflake)
*Report generated: 2026-04-20*

---

## TL;DR

`APP_COMPLIANCE` is a Snowflake database (not just a schema) owned and operated by the **Compliance Program Engineering** organization at Block/Cash App. It contains sensitive compliance-related data including transaction monitoring alerts (Chainalysis, Elliptic), customer compliance attributes, bulk case closure pipelines, and the Notary/Regulator tooling data. Access is controlled via the Registry group `app_compliance--snowflake__read_only` at `registry.sqprod.co`. The right place to request access is **#compliance-data-access** on Slack, or submit a ticket at **go/caxrequest** to the CAX (Compliance Analytics) team.

---

## Snowflake Object

**Type:** Database (multiple schemas within it — `CASH`, `SNOOP`, and others)
**Database:** APP_COMPLIANCE
**Schema:** Multiple — the most documented is `CASH` (transaction monitoring) and `SNOOP` (bulk closure pipeline)
**Connection:** go/snowflake → app.snowflake.com/squareinc/square

**Note:** Snowflake connector was not available in this environment (`snowflake-connector-python` not installed), so direct metadata queries were not run. All findings are from documentation sources.

### Known Tables

| Table | Schema | Description |
|-------|--------|-------------|
| `blockchain_chainalysis_withdrawals` | `CASH` | Realtime Chainalysis transaction monitoring for BTC withdrawals |
| `blockchain_chainalysis_cm_kyt_alerts` | `CASH` | Continuous monitoring Chainalysis KYT alerts (post-confirmation) |
| `blockchain_combined_withdrawals` | `CASH` | Combined risk categories (gambling, etc.) across vendors |
| `COMPLIANCE_CUSTOMER_ATTRIBUTE_UPSERTED_LATEST` | `CASH` | Current-state customer attributes (risk ratings, region, etc.) — ETL-maintained, production only |
| `closure_requests` | `SNOOP` | Bulk Notary case closure pipeline — records appended here are auto-picked up by Snoop |

*(This is not exhaustive — APP_COMPLIANCE has ~115+ tables per internal tooling records)*

### Tags & Properties

- Contains **DSL-3 sensitive data** (transaction monitoring data from third-party vendors like Chainalysis and Elliptic)
- The `app_compliance` namespace is **access-restricted** — Mode dashboards and tools without the appropriate Snowflake role cannot query it directly
- PII signals: transaction tokens, customer tokens, wallet addresses

### Access & Ownership

- **Owner team:** Compliance Program Engineering (parent org) / Compliance Data Engineering (CDE) sub-team for ETL tables
- **Registry access group:** `APP_COMPLIANCE__SNOWFLAKE__READ_ONLY` — request at `registry.sqprod.co`
- **Secondary relevant role:** `SNOOP__SNOWFLAKE__READ_ONLY` (for the SNOOP schema)
- **Pattern:** Block uses `{service}--snowflake__read_only` naming for Registry groups

---

## Usage (Last 90 Days)

*Direct Snowflake access was unavailable — usage stats could not be pulled.*

**What is known from documentation:**
- The `app_compliance.cash.*` tables are actively used by the Bitcoin Data Science team for transaction monitoring analysis
- The `app_compliance.cash.COMPLIANCE_CUSTOMER_ATTRIBUTE_UPSERTED_LATEST` table is queried by teams needing current customer compliance attributes
- Mode dashboards **cannot** access `app_compliance` directly — teams needing Mode visualizations must join against a derived table (e.g., `app_cash.bitcoin.btc_transaction_monitoring`)

---

## Lineage

**Upstream (feeds APP_COMPLIANCE tables):**
- Chainalysis (external vendor) → `app_compliance.cash.blockchain_chainalysis_withdrawals` (realtime)
- Chainalysis continuous monitoring → `app_compliance.cash.blockchain_chainalysis_cm_kyt_alerts`
- Elliptic (external vendor) → `cash_data_bot.public.blockchain_elliptic_wallet_analysis` (note: Elliptic is in a different DB)
- CCD service (compliance-customer-data) → `app_compliance.cash.COMPLIANCE_CUSTOMER_ATTRIBUTE_UPSERTED_LATEST` via ETL
- Manual inserts / Snoop pipeline → `app_compliance.snoop.closure_requests`

**Downstream (APP_COMPLIANCE feeds):**
- `app_cash.bitcoin.btc_transaction_monitoring` — derived table that joins Chainalysis data for Mode/BI use
- Notary/Regulator tooling queries these tables for compliance investigations
- CAX (Compliance Analytics) team dashboards and analyses

---

## Documentation Found

### Notion
- [Compliance Customer Data](https://www.notion.so/6cb9e101b28349669d47dbf5c7ab10b8) — *last edited: 2025-11-18* — Primary service doc for CCD; links to Snowflake tables and runbook. Parent: Compliance Program Engineering.
- [CCD: Customer Attribute Snowflake Table](https://www.notion.so/87affd0d8d374114b5878249443beaa9) — *last edited: 2025-08-04* — Documents `APP_COMPLIANCE.CASH.COMPLIANCE_CUSTOMER_ATTRIBUTE_UPSERTED_LATEST` specifically, with Snowflake links.
- [Compliance Data Science & Analytics (CAX) Team](https://www.notion.so/f0fe45f6e1834b96add55477f3a1bd32) — *last edited: 2026-03-20* — **Key page.** Lists the #compliance-data-access Slack channel and go/caxrequest intake form. The CAX team is the analytics owner.
- [Bitcoin Snowflake Tables](https://www.notion.so/edac7dc37222461c89142afa9b5f0b72) — *last edited: 2026-03-17* — Documents `app_compliance.cash.*` transaction monitoring tables (Chainalysis/Elliptic). Notes that `app_compliance` namespace requires special access.
- [Transaction Monitoring Table Specs](https://www.notion.so/1d8d2635e57442b7812243a039a3f610) — *last edited: 2024-10-25* — Detailed column specs for the Chainalysis tables in `app_compliance.cash`. Includes sample SQL.
- [Notary Bulk Closure](https://www.notion.so/1b354e8e103180bea16ddc1898271b78) — *last edited: 2026-03-03* — Documents `app_compliance.snoop.closure_requests` table schema and pipeline.
- [Compliance Customer Data Runbook](https://www.notion.so/f5412f53ebb548e09f422481d93bdf82) — *last edited: 2026-01-15* — Operational runbook for the CCD service. go link: go/$ccdrunbook.
- [Notary: Snowflake Data](https://www.notion.so/e1e9225f0277444db1c3a94f200e6845) — *last edited: 2026-04-10* — Notes that Compliance Data Engineering (CDE) team owns several downstream Notary-related Snowflake tables.

### Confluence
*Atlassian MCP was not authenticated during this session — Confluence was not searched. Try go/caxrequest or #compliance-data-access for pointers to Confluence docs.*

### Linear Issues
*Linear search returned only Linear product documentation (not Block-internal issues) — the Block Linear instance was not accessible in this session.*

### Slack Activity

**Snowflake script auth failed** (`invalid_auth` error from the search_slack.py script — Slack token likely expired). However, from Notion documentation:

**Key channels identified from documentation:**
| Channel | Purpose |
|---------|---------|
| **#compliance-data-access** | Explicitly listed as the access request channel for Compliance data (found in CAX team page) |
| **#cax-help** | General help channel for Compliance Analytics team |
| **#cash-capacity-planning** | Capacity planning (compliance adjacent) |
| **#compliance-eng-discuss** | Compliance engineering discussion |
| **#compliance-eng-tech-help** | Technical help for compliance engineering |

**Note:** The Slack search script returned `invalid_auth` — the token at `~/development/mcp-credentials.md` may be expired. Re-authenticate if needed.

### Google Drive
*Google Drive search was not attempted in this session. The Notion page for Compliance Customer Data links to a DSL Review Document and a PRD — both Google Docs. The Transaction Monitoring Table Specs page links to a Chainalysis PRD at `docs.google.com/document/d/1IyhSaSPaJID49PmtXxznFVvU1XicvPP0GwnfVOnxz7E`.*

---

## Ownership Assessment

Based on all sources:

**The `APP_COMPLIANCE` Snowflake database has split ownership:**

| Sub-area | Owner Team | Confidence |
|----------|-----------|------------|
| `CASH` schema (Chainalysis/transaction monitoring) | Compliance Data Engineering (CDE) + Bitcoin Data Science | High |
| `CASH.COMPLIANCE_CUSTOMER_ATTRIBUTE_UPSERTED_LATEST` | Compliance Customer Data (CCD) service team | High |
| `SNOOP` schema (bulk closure) | Compliance Program Engineering / Notary team | High |
| Access governance overall | Compliance Program Engineering | High |
| Analytics/data access requests | CAX (Compliance Data Science & Analytics) team | High |

**Primary contact for access requests:**
- **Team:** CAX — Compliance Data Science & Analytics
- **Intake form:** go/caxrequest — `block.atlassian.net/jira/software/c/projects/CAX/forms/form/direct/2/10005`
- **Slack:** #compliance-data-access
- **Confidence:** High — this channel and form are explicitly listed in the CAX team page as the access request mechanism

**For the Registry group specifically:**
- Request membership in `APP_COMPLIANCE__SNOWFLAKE__READ_ONLY` at `registry.sqprod.co`
- The approvers of that Registry group are the people to ask

---

## Flags & Warnings

- **Restricted access namespace:** `app_compliance` is explicitly called out as requiring special Snowflake role access. Several tools (Mode dashboards) cannot access it at all. You need the `APP_COMPLIANCE__SNOWFLAKE__READ_ONLY` role.
- **PII / Sensitive data:** Tables contain DSL-3 data — transaction monitoring data including customer tokens, wallet addresses, and third-party risk signals from Chainalysis and Elliptic. Expect masking policies on sensitive columns.
- **SNOOP schema is write-access controlled:** The `app_compliance.snoop.closure_requests` table requires write access, which is even more restricted — only granted via approved Jira tickets.
- **Mode cannot query this DB directly:** If you need to build Mode dashboards using compliance data, use the derived table `app_cash.bitcoin.btc_transaction_monitoring` instead.
- **Not all tables are documented:** Per internal notes, there are ~115 tables in the `app_compliance`-related domains. Documentation is not exhaustive.
- **Slack token expired:** The Slack search script failed with `invalid_auth`. Refresh the token in `~/development/mcp-credentials.md` to enable Slack searches.
- **Snowflake connector not installed:** `snowflake-connector-python` is not available in this environment. Direct metadata queries (column lists, row counts, access history) were not possible.

---

## Next Steps

1. **Request access via Registry:** Go to `registry.sqprod.co` and search for `APP_COMPLIANCE__SNOWFLAKE__READ_ONLY`. Submit a membership request — the approvers listed on that group are the data owners you're looking for.

2. **Post in #compliance-data-access on Slack:** This channel is explicitly designated for Compliance data access requests (listed in the CAX team page at Notion). Describe which specific tables you need and your use case. The CAX team monitors this channel.

3. **Submit a formal ticket at go/caxrequest:** If you need analytical help or a more formal access path, use the CAX intake form (`block.atlassian.net/jira/software/c/projects/CAX/forms/form/direct/2/10005`). Check the stakeholder mapping spreadsheet linked from the CAX team page to route to the right sub-team (Operations Analytics, Detections Analytics, Product Compliance Analytics, or Regulatory Analytics).
