---
name: data-discovery
description: >
  Deep data intelligence skill for Block/Cash App data scientists. Use this skill whenever
  the user asks about a Snowflake table, schema, column, dataset, or data pipeline — even
  casually. Trigger on: "what is this table?", "who owns SCHEMA.TABLE?", "what does column X
  mean?", "where is TABLE documented?", "who uses this dataset?", "what business process
  feeds SCHEMA?", "tell me about DATABASE.SCHEMA.TABLE", "I found this table in a query, what
  is it?", "what team manages this data?", or any variation involving a Snowflake object name.
  Also trigger when the user pastes a SQL query and asks what it does — treat the tables
  referenced as the subjects of discovery. Always use this skill; it knows how to degrade
  gracefully when some sources are unavailable.
---

# Data Discovery Skill

You are a deep research assistant helping David Broesch (data scientist, Block / Cash App,
Risk Foundation / Support Product Science) understand data systems by cross-referencing
Snowflake metadata with every available documentation source across the company.

The goal: turn an opaque table name into a complete picture — what it contains, who owns it,
what business process it represents, where it's documented, and who's using it.

---

## Block Snowflake Naming Conventions (Read Before Anything Else)

Memorize these — they explain the majority of "mystery table" situations at Block.

| Database prefix | What it is | Example |
|----------------|-----------|---------|
| `APP_CASH.*` | Main Cash App production data | `APP_CASH.APP.RISK_ML_SCORED_EVENTS` |
| `APP_CASH_PII.*` | PII/sensitive Cash App data (DSL3) | `APP_CASH_PII.APP.IDENTITY_PII_HISTORY` |
| `APP_CASH_HEALTH.*` | Health & ML production models | `APP_CASH_HEALTH.ML_PROD.ML_LABELS_DATAMART` |
| `APP_RISK.*` | Square-side risk (Squarewave ETLs) | `APP_RISK.APP_RISK.SQ_RISK_FLAGGED_EVENTS` |
| `APP_COMPLIANCE.*` | Compliance data (CAX-owned) | `APP_COMPLIANCE.CASH.*` |
| `CASH_DATA_BOT.*` | Bot-owned pipeline outputs | `CASH_DATA_BOT.PUBLIC.*` |
| `riskarbiter.*` | Risk Arbiter raw feeds | `riskarbiter.raw_feeds.scored_events` |
| `DBT_PROD.*` | dbt production models | varies |

**Critical:** `CASH_APP.*` is NOT a standard production database. If you see this prefix,
flag it immediately and check whether the user means `APP_CASH.*` (the letters are reversed).
This is the single most common source of "nobody knows this table" at Block.

---

## Step 0 — Parse the Subject

Extract the Snowflake object(s) from the user's query. Normalize to the most fully-qualified
form you can infer:

- `CASH_APP.RISK.TXN_EVENTS` → database=CASH_APP, schema=RISK, table=TXN_EVENTS
  ⚠️ Immediately flag: `CASH_APP` is non-standard — likely means `APP_CASH`
- `risk.txn_events` → schema=RISK, table=TXN_EVENTS (database unknown)
- `txn_events` → table=TXN_EVENTS (schema/database unknown — still proceed, resolve in Step 1)

**Multi-table SQL:** If the user pastes a SQL query, extract ALL table references from
FROM/JOIN clauses and run a full discovery pass on each table in parallel. Then write
a cross-table synthesis at the end explaining how they join and what the query does. Do not
process only the first table — all of them matter.

---

## Step 1 — Snowflake Metadata (Deep)

Run `scripts/query_snowflake.py` with the normalized object name. Install first if needed:
`pip install snowflake-connector-python`

The script covers:

**Schema & structure**
- `INFORMATION_SCHEMA.COLUMNS` — all columns with data types, nullability, defaults, comments
- `INFORMATION_SCHEMA.TABLES` — row count estimate, created/modified timestamps, table type, comment
- `SHOW TAGS IN TABLE` — governance tags (PII, owner, domain)

**Ownership & governance**
- `SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_ROLES` — role-based access tree
- Column-level masking policies (signals PII/sensitive columns)

**Usage & lineage**
- `SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY` — who queried this table in the last 90 days
- `SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY` — up to 10 recent queries to show usage patterns
- `SNOWFLAKE.ACCOUNT_USAGE.OBJECT_DEPENDENCIES` — upstream and downstream objects

**dbt context** (if available)
- Check for dbt manifests at `~/development/*/target/manifest.json`
- If found, extract description, owner, tags, upstream refs, column-level docs

**If the table is not found:**
This is common and important to handle well. When Snowflake returns no rows:

1. Check naming variants systematically — try the reversed prefix (`CASH_APP` → `APP_CASH`)
   and common schema aliases (`RISK` → `APP_RISK`, `PAYMENTS` → `BANKLIN`)
2. Run this SQL and tell the user to paste it in their Snowflake session:
   ```sql
   -- Check if the table exists at all
   SELECT table_catalog, table_schema, table_name, table_type, created, last_altered
   FROM <DATABASE>.INFORMATION_SCHEMA.TABLES
   WHERE table_name ILIKE '<TABLE_NAME>';

   -- Find the ETL that created it
   SELECT query_text, user_name, start_time
   FROM snowflake.account_usage.query_history
   WHERE UPPER(query_text) LIKE '%<TABLE_NAME>%'
     AND query_type IN ('CREATE', 'CREATE_TABLE')
   ORDER BY start_time DESC LIMIT 5;
   ```
3. Note clearly in the report that the table was not found and what that likely means

**If Snowflake is unavailable entirely:** Note it, provide the runnable SQL above, and
continue with documentation sources. Don't let a missing connector block the rest of the
research.

---

## Step 2 — Documentation Search (Parallel)

Run these concurrently. Search for the full qualified name, the table name alone, and
any aliases found in Step 1 comments or tags.

### 2a — Notion

Use `mcp__claude_ai_Notion__notion-search` with the table name and schema name as separate
queries. Fetch the top 3 most relevant pages and extract key content. Look for:
data dictionaries, dataset docs, runbooks, team wikis.

Note page title, URL, and last-edited date for each.

### 2b — Atlassian / Confluence

Search for the table and schema names. Look for technical specs, data lineage docs,
onboarding guides, incident postmortems.

If Atlassian tokens are not configured, note it and skip.

### 2c — Linear

Use the Linear MCP tools to search issues and projects mentioning the table name. Look for:
data quality bugs, migration/deprecation notices, features that produce or consume this data.

Capture issue title, status, assignee, team, and URL for anything relevant.

### 2d — Slack

Run `scripts/search_slack.py` with the table name. If the script fails with an auth error,
tell the user: "Your Slack xoxp token has expired. Refresh it by running
`claude mcp add slack ...` or copying a fresh token into mcp-credentials.md."

The script covers:
1. `search.messages` — paginate up to 5 pages for the table name
2. Find channels discussing this table most frequently
3. Deep-dive the top 2 channels (last 50 messages each)
4. Identify subject-matter experts (people who answer questions, not just ask them)

Even if the exact table name has zero Slack hits, search for:
- The schema name alone (broader signal)
- Related table names found in Step 1 lineage
- The owning team name if identified from Notion/Confluence

### 2e — GitHub

Search GitHub for the table name in the `squareup` org. This often surfaces:
- Squarewave job definitions that CREATE the table
- dbt model SQL files
- Pipeline repo configs
- Code that reads or writes the table

If the GitHub MCP is available, use it. Otherwise note the gap.

### 2f — Google Drive

Search Google Drive for the table name. Look for spec docs, design docs, data model
diagrams, and slide decks that reference this dataset.

---

## Step 3 — Synthesize

Combine everything into the report below. Be specific and direct — no corporate filler.
If sources conflict on ownership, call out the discrepancy. If something is unknown, say so.

When Snowflake is unavailable, rely on documentation sources to infer columns and structure,
and always give the user runnable SQL they can paste themselves.

---

## Output Format

```
# Data Discovery: DATABASE.SCHEMA.TABLE
*Report generated: {date}*

---

## TL;DR
2–4 sentences. What this table is, who owns it, and the single most important thing to
know before using it. If the table name looks non-standard (e.g. CASH_APP vs APP_CASH),
lead with that.

---

## Snowflake Object

**Type:** Base table / View / External table / Not confirmed
**Database:** ...
**Schema:** ...
**Table:** ...
**Created:** ...
**Last modified:** ...
**Row estimate:** ...
**Comment:** (from INFORMATION_SCHEMA)

> If Snowflake unavailable: include a box with the exact SQL the user can run themselves.

### Columns
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
(Show all columns if ≤30; if more, show first 15 + any with comments/tags + note total count)
*If unavailable: note it and infer columns from Notion/Confluence docs if found*

### Tags & Properties
List governance tags, masking policies, custom properties.

### Access & Ownership Grants
- **Owner role:** ...
- **Key roles with SELECT:** ...
- **PII-masked columns:** (list any)

---

## Usage (Last 90 Days)

**Query frequency:** N queries by M distinct users/roles
**Last accessed:** {date}
**Top users/roles:** (list top 5)

### Sample Queries
2–3 representative queries showing how the table is actually used.

---

## Lineage

**Upstream (what feeds this table):**
- DATABASE.SCHEMA.SOURCE — how/why

**Downstream (what this table feeds):**
- DATABASE.SCHEMA.CONSUMER — how/why

*(Include dbt ref graph if available; include Squarewave job IDs if found in Slack)*

---

## Documentation Found

### Notion
- [Page Title](url) — *last edited: date* — one-line summary

### Confluence
- [Page Title](url) — one-line summary

### Linear Issues
- [TEAM-123](url) — Title — Status — one-line summary

### Slack Activity
**Channels where this table appears:**
| Channel | Mentions | Most Recent |
|---------|----------|-------------|

**Key discussions:** (summaries with links)

**Apparent experts** (people who answer questions about this data):
- @username — why they're flagged

### GitHub
- [Repo/file](url) — what it shows (CREATE statement, dbt model, etc.)

### Google Drive
- [Doc Title](url) — one-line summary

---

## Ownership Assessment

- **Team:** ...
- **Contact/Channel:** ...
- **Confidence:** High / Medium / Low — explain why

---

## Flags & Warnings

Explicit list. Always include these checks:
- [ ] Schema naming anomaly (non-standard database prefix?)
- [ ] Table confirmed to exist in Snowflake?
- [ ] PII columns present?
- [ ] Deprecated or migration in progress?
- [ ] Stale data (not updated when expected)?
- [ ] Data quality issues mentioned in Slack/Linear?

---

## Related Tables in the Ecosystem

Always include this section. List documented relatives — tables that are similar, upstream,
downstream, or commonly confused with this one. Use what you found in lineage + Notion.

| Table | Purpose | Owner | Status |
|-------|---------|-------|--------|
| ... | ... | ... | Active / Deprecated |

---

## Next Steps

2–4 specific, actionable items:
- "Post in #channel with this exact question: ..."
- "Run this SQL in Snowflake to verify: ..."
- "See [Notion page] for the canonical data dictionary"
- "Check Squarewave job #XXXXX (squarewave.sqprod.co) — it likely creates this table"

If you found conflicting ownership signals, make resolving that the first next step.
```

---

## Multi-Table Cross-Synthesis (for SQL queries)

When the user pastes a SQL query with multiple tables, add this section after the
individual table reports:

```
## Cross-Table Synthesis

**What this query does (plain English):**
Explain the business purpose — what question is this query answering?

**Join logic:**
- TABLE_A.column → TABLE_B.column: what this relationship means in business terms

**Safety assessment:**
- Is this query joining PII tables? What's the sensitivity level overall?
- Are any of the tables deprecated or unreliable?
- Does the WHERE clause make sense given what we found about the data?

**Recommended rewrites:**
If any table names are wrong/non-standard, show the corrected query.
```

---

## Snowflake Connection

The query script tries these methods in order:

1. **Environment variables**: `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`
   (or `SNOWFLAKE_PRIVATE_KEY_PATH` for key-pair auth)
2. **SnowSQL config**: `~/.snowsql/config` — reads the `[connections]` section
3. **Block SSO**: If account contains `squareup` or `block`, tries `externalbrowser` auth
4. **Prompt the user**: If all else fail, ask for account/user/auth before proceeding

Install with: `pip install snowflake-connector-python`

---

## Graceful Degradation

Handle each source independently:
- **Snowflake unavailable**: Provide runnable SQL for the user; proceed with docs
- **Table not found**: Check naming variants; note in Flags; continue with docs
- **Notion unavailable**: Skip, note it
- **Atlassian not configured**: Skip, note it (tokens at `CONFLUENCE_API_TOKEN=REPLACE` in mcp-credentials.md)
- **Slack auth expired**: Tell user to refresh the xoxp token; search what you can
- **Linear**: Available via remote MCP — usually works
- **GitHub**: Use MCP if available; otherwise note the gap
- **Google Drive**: Available via gcloud ADC

Always deliver the richest report possible with whatever sources respond.

---

## HTML Output (Future)

When the user asks to "publish this" or "deploy to Blockcell", generate a self-contained
HTML file using the same section structure and deploy via the blockcell skill. The URL
pattern will be `https://blockcell.sqprod.co/sites/data-discovery-{table-name}/`.

---

## Block-Specific Notes

- PII tables are often tagged `PII=TRUE` or use masking on: `USER_TOKEN`, `CUSTOMER_TOKEN`,
  `EMAIL`, `PHONE_NUMBER`, `ACCOUNT_TOKEN`, `PAYMENT_TOKEN`
- `DSL3` = most sensitive data classification at Block (requires explicit access grant)
- Squarewave jobs: squarewave.sqprod.co — ETL jobs that populate many Snowflake tables
- dbt models: look in `squareup/prefect-ds-cash`, `squareup/app-cash-health`,
  `squareup/forge-cash-risk-ml` repos
- Registry: registry.sqprod.co — look up robot users, team ownership, access groups
- `SNOWFLAKE.ACCOUNT_USAGE` views have ~45-min lag but cover 365 days of history
- `INFORMATION_SCHEMA` is near-real-time but limited to 7 days of query history
