# COMPLIANCE Schema in Snowflake — Ownership & Access

## Summary

The `APP_COMPLIANCE` Snowflake database/schema is owned and operated by the **Compliance Data Engineering (CDE)** team and the broader **Compliance Program Engineering** organization at Block/Cash App. The Snoop platform (which writes transaction monitoring data into `app_compliance`) is also operated by this group.

---

## Who Owns It

### Primary Owner: Compliance Data Engineering (CDE)
The Notary Snowflake Data docs explicitly state:
> "The *Compliance Data Engineering (CDE)* team owns and operates several such Snowflake tables"

This team sits within the broader **Compliance Engineering and Technology (CET)** org, which ladders into Block Business Platform (Rachel Potvin → Arnaud Weber → Jack Dorsey).

### Related Team: Compliance Data Science & Analytics (CAX)
The **CAX team** is the analytics/science arm and has a dedicated Slack channel for data access questions: **#compliance-data-access** (`C08BUDP1FNE`). This is likely your first stop.

### Engineering Team: Compliance Tooling Engineering / Compliance Program Engineering
- The engineering services that write to `app_compliance` (e.g., Snoop, Alert Broker, Regulator) are owned by **Compliance Tooling Engineering** and **Compliance Program Engineering**
- Notion home page: [Compliance Program Engineering](https://www.notion.so/d2d78072f1fd417ab1c04dac39a1f425)
- Notion home page: [Compliance Tooling Engineering](https://www.notion.so/b601cff1421f48028693be04dac16737)

---

## What's in the APP_COMPLIANCE Schema

Based on documentation found, confirmed tables in `app_compliance` include:

| Schema | Table | Description |
|--------|-------|-------------|
| `app_compliance.cash` | `blockchain_chainalysis_withdrawals` | Realtime Chainalysis transaction monitoring (Bitcoin) |
| `app_compliance.cash` | `blockchain_chainalysis_cm_kyt_alerts` | Continuous monitoring Chainalysis KYT alerts |
| `app_compliance.cash` | `blockchain_combined_withdrawals` | Combined risk category data (gambling, etc.) |
| `app_compliance.snoop` | `closure_requests` | Bulk closure pipeline for Notary assignments |
| `app_compliance.cash` | `some_alerts_table` (pattern) | TM alert tables read by Snoop algorithms |

The schema appears to contain:
- **Transaction monitoring data** (Chainalysis, Elliptic, Alterya vendor outputs)
- **Compliance operations pipeline data** (Snoop closure requests, TM alert inputs)
- Likely **SAR/regulatory reporting data** and other compliance workflow data

---

## How to Request Access

### Step 1: Ask in #compliance-data-access
The CAX team (Compliance Data Science & Analytics) runs this channel specifically for data access questions:
- **Slack**: `#compliance-data-access`

### Step 2: Request via Registry
The Snowflake access group to request is:
- **`APP_COMPLIANCE__SNOWFLAKE__READ_ONLY`** — this is the Registry group that grants read access to the `app_compliance` schema
- Registry URL pattern: `https://registry.sqprod.co/groups/app-compliance--snowflake__read_only`

Note: As of late 2025/early 2026, access to `APP_COMPLIANCE__SNOWFLAKE__READ_ONLY` requires approval — it is not auto-approved. The `SNOOP__SNOWFLAKE__READ_ONLY` role is a related access group for the Snoop namespace within compliance.

### Step 3: If Access is Denied / Complex
- **#compliance-eng-tech-help** — general compliance engineering help channel
- **#compliance-tooling-eng-discuss** (`C01MYK117R6`) — open discussion channel for Compliance Tooling Eng
- **#compliance-program-eng-discuss** (`C01FV3W0SH1`) — Compliance Program Engineering open channel
- Submit a ticket at **go/caxrequest** (https://block.atlassian.net/jira/software/c/projects/CAX/forms/form/direct/2/10005)

---

## Docs & References

| Resource | URL |
|----------|-----|
| CAX Team Page | https://www.notion.so/f0fe45f6e1834b96add55477f3a1bd32 |
| Compliance Program Engineering | https://www.notion.so/d2d78072f1fd417ab1c04dac39a1f425 |
| Compliance Tooling Engineering | https://www.notion.so/b601cff1421f48028693be04dac16737 |
| Notary Snowflake Data (CDE tables list) | https://www.notion.so/e1e9225f0277444db1c3a94f200e6845 |
| Bitcoin Snowflake Tables (app_compliance tables) | https://www.notion.so/edac7dc37222461c89142afa9b5f0b72 |
| Transaction Monitoring Table Specs | https://www.notion.so/1d8d2635e57442b7812243a039a3f610 |
| Notary Bulk Closure (app_compliance.snoop) | https://www.notion.so/1b354e8e103180bea16ddc1898271b78 |
| Snoop Runbook | https://wiki.sqprod.co/display/FCT/Snoop+RUNBOOK |
| go/snowflake | https://go.sqprod.co/snowflake |

---

## Confidence Notes

- **High confidence**: CDE team and Compliance Program Engineering own APP_COMPLIANCE. Confirmed by multiple Notion docs.
- **High confidence**: `APP_COMPLIANCE__SNOWFLAKE__READ_ONLY` is the Registry group to request.
- **High confidence**: `#compliance-data-access` is the right Slack channel for data access questions.
- **Medium confidence**: Full table inventory — only a subset of tables is documented publicly; the full schema contents are restricted.
- **Low confidence**: Specific individual DRI for the database — Notion pages had user mentions but identities were omitted. Try #compliance-data-access to find the right person.
