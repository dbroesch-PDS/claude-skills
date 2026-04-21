# Sprint Planning: Backlog Review & Cycle Scoping

> Note: The Linear MCP tools are not connected in this session. Below is a step-by-step explanation of exactly how this workflow would execute with live tools, followed by a realistic mock of the response you'd see.

---

## How This Would Execute (with Live Linear MCP)

### Step 1 — Identify the team
**Tool call:** `linear_list_teams`

Returns workspace teams. Since David is on the Risk Foundation / Support Product Science team at Block/Cash App, the agent would match that team automatically (or prompt David to confirm if multiple teams exist).

### Step 2 — Find the active/upcoming cycle
**Tool call:** `linear_list_cycles` (filtered to the matched team)

Returns current and upcoming cycles with their start/end dates and status. The agent identifies the next cycle to plan for.

### Step 3 — Fetch the backlog
**Tool call:** `linear_list_issues` with filters:
- `teamId`: Risk Foundation / Support Product Science team
- `state`: "Todo" (or equivalent backlog state — confirmed via `linear_list_workflow_states`)
- `cycleId`: null (unscoped — not yet in any cycle)
- `orderBy`: priority (Urgent → High → Medium → Low → No Priority)

### Step 4 — Present backlog grouped by priority
Agent summarizes the issues in a structured table, flags issues with missing estimates or stale updates.

### Step 5 — Interactive scoping
Agent asks David which issues to pull into the next cycle. For each confirmed issue:
**Tool call:** `linear_update_issue` — sets `cycleId` to the upcoming cycle's ID.

### Step 6 — Summarize the cycle scope
Agent reports final cycle scope: issue count, total story point estimate, assignee breakdown.

---

## Realistic Mock Response

Below is what the actual agent response would look like with live data (realistic for a Risk DS team at Block):

---

### Your Team: Risk Foundation / Support Product Science

**Next Cycle:** Cycle 14 — April 14–25, 2026 (starts in 5 days)
**Current unscoped backlog:** 18 issues

---

### Backlog by Priority

#### Urgent (2 issues)

| # | ID | Title | Estimate | Assignee | Last Updated |
|---|-----|-------|----------|----------|--------------|
| 1 | RDS-204 | Fix false positive spike in dispute model — thresholds drifted post-deploy | 3 pts | David B. | 2 days ago |
| 2 | RDS-198 | Cash App Pay fraud rate anomaly — root cause unclear, stakeholder escalation open | 5 pts | Unassigned | 4 days ago |

#### High Priority (7 issues)

| # | ID | Title | Estimate | Assignee | Last Updated |
|---|-----|-------|----------|----------|--------------|
| 3 | RDS-201 | Build recall/precision dashboard for ACH return model v2 | 5 pts | David B. | 1 week ago |
| 4 | RDS-196 | Automate weekly risk metric report → Slack delivery | 3 pts | Unassigned | 1 week ago |
| 5 | RDS-189 | Investigate P2P send block rate increase in TX cohort | 3 pts | Unassigned | 2 weeks ago |
| 6 | RDS-183 | Refresh feature importance analysis for chargeback model | 2 pts | Mei L. | 2 weeks ago |
| 7 | RDS-177 | Define SLA metrics for support escalation triage pipeline | 2 pts | David B. | 3 weeks ago |
| 8 | RDS-171 | Add monitoring for model serving latency p99 | 2 pts | Unassigned | 3 weeks ago |
| 9 | RDS-165 | Segment dispute resolution time by merchant category | 3 pts | Unassigned | 4 weeks ago ⚠️ stale |

#### Medium Priority (6 issues)

| # | ID | Title | Estimate | Assignee | Last Updated |
|---|-----|-------|----------|----------|--------------|
| 10 | RDS-193 | Exploratory analysis: new account behavior patterns Q1 | — | Unassigned | 1 week ago ⚠️ no estimate |
| 11 | RDS-187 | Document feature engineering pipeline for onboarding | 2 pts | Unassigned | 2 weeks ago |
| 12 | RDS-180 | Evaluate LightGBM vs XGBoost for device risk scoring | 3 pts | Unassigned | 3 weeks ago |
| 13 | RDS-174 | Refactor risk score aggregation query (BigQuery — slow) | 2 pts | Unassigned | 4 weeks ago ⚠️ stale |
| 14 | RDS-168 | Set up dev/prod parity checks for model feature store | 3 pts | Unassigned | 5 weeks ago ⚠️ stale |
| 15 | RDS-155 | Add test coverage for score normalization functions | 1 pt | Unassigned | 6 weeks ago ⚠️ stale |

#### Low Priority (2 issues)

| # | ID | Title | Estimate | Assignee | Last Updated |
|---|-----|-------|----------|----------|--------------|
| 16 | RDS-160 | Audit label consistency for training dataset v3 | 2 pts | Unassigned | 5 weeks ago ⚠️ stale |
| 17 | RDS-145 | Research: causal inference approaches for policy evaluation | — | Unassigned | 8 weeks ago ⚠️ stale, no estimate |

#### No Priority (1 issue)

| # | ID | Title | Estimate | Assignee | Last Updated |
|---|-----|-------|----------|----------|--------------|
| 18 | RDS-132 | Notes from Feb risk model review meeting | — | Unassigned | 10 weeks ago ⚠️ stale, no priority, no estimate |

---

### Flags to Address

- **4 issues with no estimate** (RDS-193, RDS-145, RDS-132, and 1 more) — these should be estimated before pulling into the cycle
- **6 stale issues** (no update in 30+ days) — worth a quick triage pass to confirm they're still valid
- **RDS-198** (Urgent) is unassigned — should be assigned before the cycle starts

---

### My Recommendation for Cycle 14

Based on urgency and your team's typical 2-week velocity (~20–25 pts), here's a suggested scope:

| Issue | Priority | Est | Rationale |
|-------|----------|-----|-----------|
| RDS-204 | Urgent | 3 pts | Active incident, deploy-related |
| RDS-198 | Urgent | 5 pts | Open stakeholder escalation |
| RDS-201 | High | 5 pts | Model v2 needs tracking before rollout |
| RDS-196 | High | 3 pts | High-leverage automation, unblocks team visibility |
| RDS-189 | High | 3 pts | Active business question on TX cohort |
| RDS-183 | High | 2 pts | Chargeback model refresh, Mei can carry |

**Proposed total: 21 pts across 6 issues**

This keeps you in the healthy zone. Want me to pull these into Cycle 14? I can also swap any in/out — just say the word.

Or: would you like to look at the medium-priority items before deciding?

---

## What Would Happen Next (with Live Tools)

Once David confirms which issues to pull in, the agent would call:

```
linear_update_issue(id: "RDS-204", cycleId: "<cycle-14-id>")
linear_update_issue(id: "RDS-198", cycleId: "<cycle-14-id>")
... (for each confirmed issue)
```

Then summarize the final cycle scope and optionally flag any issues that need assignees set before the cycle begins.
