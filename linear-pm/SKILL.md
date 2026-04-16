---
name: linear-pm
description: >
  Full Linear project management. Use this skill whenever the user wants to do ANYTHING in Linear: create or update issues, manage projects or cycles, plan sprints, triage a backlog, check team workload, update statuses, set priorities, add labels, search issues, manage roadmaps, or track progress. Also trigger when the user mentions tickets, work items, engineering planning, or anything that sounds like it belongs in a project tracker. This skill also covers building and maintaining single-file HTML sprint dashboards for any Linear team or org. If in doubt, trigger.
---

# Linear Project Management

Use the `linear` skill (`sq agent-tools linear`) for all Linear operations. Do real work — don't just describe what the user could do.

**Before issuing any Linear commands**, verify the extension is available:

```bash
sq agent-tools linear --help
```

If it fails, follow the `linear` skill's auth instructions (connect at `go/agent-tools`).

## Core Principles

- **Act, don't narrate.** Call MCP tools directly. Don't tell the user to go click something in Linear unless the action genuinely requires UI.
- **Confirm intent on destructive actions.** Deleting issues, archiving projects, or bulk-reassigning — confirm before proceeding.
- **Surface context.** When the user asks about something ("what's in my backlog?"), fetch the real data and summarize it meaningfully. Don't just dump raw API output.
- **Infer missing context.** If the user says "create an issue" without specifying a team, ask which team — or list available teams to let them pick. Don't error silently.
- **Never summarize status updates.** When displaying project status updates, always post the verbatim text from Linear exactly as written. Do not paraphrase, condense, or rewrite.
- **Always re-fetch before editing.** Never trust stale HTML or cached data when updating dashboards — always pull live data from Linear first.

---

## Linear Data Model (quick reference)

| Concept | What it is |
|---|---|
| **Team** | A group of people with their own workflow states, labels, and cycles |
| **Issue** | A unit of work — has title, description, status, priority, assignee, labels, estimate |
| **Project** | A container grouping issues toward a goal; has milestones and a target date |
| **Cycle** | A time-boxed sprint; issues are scoped in/out each cycle |
| **Workflow State** | The stage of an issue (e.g., Todo → In Progress → Done) — per team, custom names possible |
| **Label** | Tag on an issue (e.g., "bug", "feature", "Analysis", "KTLO") — per team |
| **Priority** | Urgent / High / Medium / Low / No Priority |
| **Milestone** | A checkpoint inside a Project |
| **Initiative** | A high-level goal grouping multiple projects |
| **Roadmap** | A high-level view spanning multiple projects |

---

## Known Linear Data Quirks

### Always Use Cycle UUID, Never Cycle Number
**Never filter by cycle number like `number: 1`.** Cycle numbers are team-local and not globally unique.

**Always use the UUID.** Get it first with a readonly query:
```bash
sq agent-tools linear execute-readonly-query \
  --query 'query($teamId: String!) { team(id: $teamId) { cycles(filter: { isActive: { eq: true } }) { nodes { id number name startsAt endsAt } } } }' \
  --variables '{"teamId":"<team-uuid>"}'
```
Then use the `id` field in all subsequent issue queries.

### Assignee + Cycle Filter May Return Empty
The GraphQL `assignee` + `cycle` combination can return zero results even when issues exist. If this happens, fetch all cycle issues without the assignee filter, then post-filter by assignee name in the results.

### Estimate Field Shape
In GraphQL results `estimate` is an object: `{ value: 2, name: "2 Points" }`. Use `.value` for point counts, not the top-level field.

### Archived Issues Come Back in Results
Issues with `archivedAt` set retain their `cycleId`. Always include `archivedAt` in your selection set and exclude any issue where `archivedAt` is non-null from dashboards and counts.

### Status Updates Require Project UUID
Query by UUID, not slug:
1. `execute-readonly-query` → `project(id: "<uuid>")` or search projects to get the UUID
2. Then fetch `projectUpdates(filter: { project: { id: { eq: "<uuid>" } } })`

### Finding Team IDs
Fetching all teams can be slow. Prefer extracting `team { id key }` from project or issue results when you already have a project in scope. Or use the Saved Team Configurations section below.

### Large Result Sets
Use narrow GraphQL selection sets (`first: 50`, `after` cursor for pagination) rather than fetching everything at once. Request only the fields you need.

---

## Sprint Dashboard Pattern

David maintains single-file HTML sprint dashboards for his teams. The pattern is reusable for any org. When asked to build or update a dashboard for a new team, follow these conventions.

### Dashboard File Location
```
/Users/dbroesch/development/project management/<team-slug>-<quarter>-status.html
```
Example: `rads-q2-2026-status.html`

### Tab Structure
- **Tab 1 — Projects:** One card per initiative project. DRI, health status, latest weekly update verbatim, late-update flag.
- **Tab 2 — Team & Sprint:** Sprint burndown SVG (cross-team), collapsible per-person member cards, all-members summary table.
- **Tab 3 — Work Distribution:** Label breakdown with donut pie charts. Labels are team-specific (e.g., for RADS-DS: Analysis / Automation / Infrastructure / KTLO).

### Setting Up a Dashboard for a New Team
When the user asks to build a dashboard for a team or org not already configured:

1. **Discover the org structure:**
   - `execute-readonly-query` → `initiatives(first: 20)` → find the relevant initiative and ID
   - `execute-readonly-query` → `projects(filter: { initiatives: { id: { eq: "<id>" } } })` → get project IDs and team IDs
   - Extract `team { id key name }` from project results → map team names to IDs

2. **Discover the people:**
   - `execute-readonly-query` → `team(id: "<id>") { members { nodes { id displayName email } } }` per team
   - Note cross-team contributors (people who appear in multiple teams' cycle issues)

3. **Discover active cycles:**
   - For each team: `execute-readonly-query` → `team(id: "<id>") { cycles(filter: { isActive: { eq: true } }) { nodes { id number name startsAt endsAt } } }`
   - Note cycle UUID, name, start, end dates

4. **Discover labels:**
   - `execute-readonly-query` → `team(id: "<id>") { labels { nodes { id name } } }`
   - Ask the user which labels to feature in the Work Distribution tab (Tab 3)

5. **Create a `team-config.json`** in the project directory (see Team Config File section under Audit Functions). This file drives both the dashboard (Tab 2 member whitelist) and all audit functions — no member data should be hardcoded anywhere else.

6. **Save Linear IDs** (team IDs, cycle UUIDs, initiative ID) to the Saved Team Configurations section at the bottom of this file.

---

## Member Card Rules (applies to all teams)

Member cards appear in Tab 2 of the dashboard. These rules apply universally.

### Issue Counting
- **Issues badge:** count of all cycle issues excluding Canceled and Archived
- **Done badge:** issues with a "Done"-type workflow state
- **In Progress badge:** issues with "In Progress", "In Review", or "Blocked" states
- **Pts badge:** shown as `done_pts/total_pts` where total excludes Canceled and Archived issues
- Optional **Todo badge** (`s-red`): add when the team has many pending issues and it's useful context

### Status → CSS Class Mapping
| Linear Status | CSS class | Badge display text |
|---|---|---|
| Done | `done` | Done |
| In Progress | `in-progress` | In Progress |
| In Review | `in-progress` | In Review |
| Blocked | `blocked` | Blocked |
| To-do / Todo | `todo` | To-do |
| Canceled | `canceled` | Canceled |
| Below the Line | `canceled` | Below the Line |

**"Below the Line"** is a custom de-prioritized state used in RADS teams. It is NOT the same as Canceled. Include these issues in the Issues count and table, but exclude from Done/In Progress/Pts.

**Canceled:** include in the table (with `canceled` CSS class) but exclude from all badge counts.

**Archived** (`archivedAt` is set in Linear): exclude entirely — not in table, not in counts.

### Badge Color Classes
| Class | Color | Use for |
|---|---|---|
| `s-blue` | Blue | Issues (total) |
| `s-green` | Green | Done, Pts |
| `s-orange` | Orange | In Progress |
| `s-red` | Red | Todo / Blocked |

### All stat badges are fixed 76px width — do not change this or columns misalign.

### All-Members Table Must Stay in Sync
The bottom of Tab 2 has a summary table with one row per person. **Every time you update a member card, update the corresponding table row to match.** The counts must be identical.

---

## Project Update Rules (Tab 1)

- **Always post verbatim** update text — no summarizing, no paraphrasing.
- Include `diffMarkdown` (milestone % changes) as a styled note below the body.
- Convert Linear markdown to HTML: headers → `<h3>`/`<h4>`, bullets → `<ul><li>`, bold → `<strong>`, links → `<a>`, tables → `<table class="issue-table">`, `---` → `<hr>`.
- **Late flag rule:** Updates posted after Thursday 5:00 PM PT for the relevant week get the `flag-late` CSS class. All timestamps are UTC — convert to PT (PDT = UTC−7, PST = UTC−8).

---

## Audit Checklist: Updating Sprint Member Cards

Run this process for each member when auditing or refreshing the dashboard:

1. **Identify the correct cycle UUID** for the member's team (see Saved Configs below, or query `team(id: "<id>") { cycles(filter: { isActive: { eq: true } }) { nodes { id } } }`).
2. Query all cycle issues for the team:
   ```bash
   sq agent-tools linear execute-readonly-query \
     --query 'query($cycleId: String!) { cycle(id: $cycleId) { issues { nodes { id identifier title archivedAt state { name type } assignee { displayName } estimate { value } } } } }' \
     --variables '{"cycleId":"<cycle-uuid>"}'
   ```
3. **Drop archived issues** — filter out any where `archivedAt` is non-null.
4. **Filter to the member** by `assignee.displayName`.
5. **Separate Canceled issues** — keep in the table, exclude from counts.
6. **Verify every status** against the HTML — statuses change frequently and are almost always stale.
7. **Count delta** between Linear and the HTML badge. Find missing issues before making any edits.
8. **Recompute pts** — done pts and total pts from the filtered live issue list.
9. **Update the member card** — badge, all rows.
10. **Update the all-members table row** to match the new badge exactly.

---

## Common Workflows

### Creating an issue
1. Confirm: team, title, optional (description, priority, assignee, labels, cycle, project)
2. Resolve any needed IDs (team, state, assignee, cycle) with readonly queries first
3. Call `batch-create-or-update-issues` with `operation: "create"`
4. Return the issue URL/ID from the result

### Sprint / Cycle planning
1. Query `team(id: "<id>") { cycles(filter: { isActive: { eq: true } }) { nodes { id name } } }` → get active cycle UUID
2. Query backlog: `issues(filter: { team: { id: { eq: "<id>" } }, state: { type: { eq: "unstarted" } }, cycle: { null: true } })`
3. Help scope issues in — confirm before bulk operations
4. Summarize scope: count, total pts

### Backlog grooming
1. Fetch backlog: `issues(filter: { team: ..., state: { type: { in: ["unstarted"] } }, cycle: { null: true } }, first: 50)`
2. Group by priority; flag: no priority, no estimate, stale (>30 days no update)
3. Triage: `batch-create-or-update-issues` to update priority, estimate, assignee, or state

### Standup / status view for a person
1. Query cycle issues: `cycle(id: "<uuid>") { issues { nodes { identifier title state { name type } assignee { displayName } } } }`
2. Filter to the person, group by status: Done (today/this week), In Progress, Blocked, Todo
3. Surface blockers first

### Searching issues
- Use GraphQL `issues(filter: { ... })` with keyword, label, priority, assignee, team, project, state filters
- Paginate with `first` / `after`; summarize patterns before listing all

### Gathering project status updates
1. `execute-readonly-query` → `projects(filter: { name: { containsIgnoreCase: "<name>" } }) { nodes { id name } }` → get UUID
2. `execute-readonly-query` → `projectUpdates(filter: { project: { id: { eq: "<uuid>" } } }, orderBy: createdAt, first: 1) { nodes { body health createdAt diffMarkdown } }`
3. Post `body` verbatim; append `diffMarkdown` as progress note
4. Flag late if posted after Thursday 5pm PT

---

## Audit Functions

These are reusable sprint hygiene workflows. Run them on demand or when the user asks to audit the team.

---

### ⚠️ APPROVAL GATE — MANDATORY FOR ALL AUDITS

**NEVER send any Slack message without David explicitly saying "send it", "go ahead", or equivalent.**

The full sequence is always:
1. Fetch data from Linear
2. Compute affected issues
3. **Show complete draft messages** for every person
4. **Stop and wait** — do not proceed
5. Only send after David gives explicit approval

This applies even if David has previously said "send" in the conversation, even if he just provided a missing email or Slack ID, and even if he seems to be in a hurry. **Providing missing info is not approval to send.** Always ask: *"Ready to send these?"*

---

### Team Config File

All team member and manager data lives in a local `team-config.json` file — **never hardcode names, emails, or Slack IDs in audit code**. This makes the skill reusable for any team.

**Config file location:** look for `team-config.json` in the project's working directory (e.g. `/Users/dbroesch/development/project management/team-config.json`). If not found, ask the user where it is.

**Schema:**
```json
{
  "manager": {
    "name": "...",
    "email": "...",
    "slack_id": "..."
  },
  "members": [
    {
      "name": "Full Name",
      "login": "linear_display_name",
      "email": "work@company.com",
      "slack_id": "UXXXXXXXX or null",
      "slack_email": "slack_login@company.com",
      "note": "optional — e.g. uses @block.xyz not @squareup.com",
      "teams": ["TEAM-KEY"],
      "role": "TL (optional)"
    }
  ]
}
```

**How to use at runtime:**
1. Load the config: `config = json.load(open("team-config.json"))`
2. Build `LOGIN_MAP = {m["login"]: m["name"] for m in config["members"]}`
3. Build `WHITELIST = {m["name"] for m in config["members"]}`
4. For Slack: use `m["slack_id"]` if non-null; otherwise look up via `m["slack_email"]` using `users.lookupByEmail`
5. Manager (Audit 4 report recipient): `config["manager"]["slack_id"]`

**Setting up for a new team:** copy `team-config.json`, replace all fields, set `manager` to whoever should receive Audit 4 reports.

---

### Slack API

The Slack MCP tools do not reliably load. Use the Slack REST API directly via Python:

```python
import urllib.request, json

TOKEN = "<xoxp token from ~/.claude/settings.json mcpServers.slack.env.SLACK_MCP_XOXP_TOKEN>"

def slack_api(endpoint, payload):
    req = urllib.request.Request(
        f"https://slack.com/api/{endpoint}",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    )
    return json.loads(urllib.request.urlopen(req).read())

def lookup_slack_id(email):
    import urllib.parse
    req = urllib.request.Request(
        "https://slack.com/api/users.lookupByEmail?" + urllib.parse.urlencode({"email": email}),
        headers={"Authorization": f"Bearer {TOKEN}"}
    )
    resp = json.loads(urllib.request.urlopen(req).read())
    return resp["user"]["id"] if resp.get("ok") else None

def send_dm(slack_id, text):
    slack_api("chat.postMessage", {"channel": slack_id, "text": text})
```

---

### Message formatting rules (all audits)

- Use Slack's hyperlink format `<url|display text>` for every issue — **never put raw URLs in the message body**
- Link format: `<url|[IDENTIFIER]> Issue title` — **only the identifier is hyperlinked**, the title follows as plain text
- Bold with `*text*`, italic with `_text_`
- Closing line is always: `Thanks! 🤖 _Sent on behalf of David via the RADS sprint dashboard_ 🤖`

---

### Running multiple audits at once

When the user asks to run more than one audit (e.g. "run all audits"), **combine all findings into one message per person** — do not send separate messages per audit. Each person gets one DM with only the sections relevant to them.

**Combined message template:**

```
Hey [First name]! 👋 Quick sprint hygiene check — you have a few issues that need some attention.

🏷️ *Missing label* — add one of: Analysis · Automation · Infrastructure · KTLO
• <url|[IDENTIFIER]> Issue title
• <url|[IDENTIFIER]> Issue title
_Done (historical):_
• <url|[IDENTIFIER]> Issue title

📊 *Missing point estimate* — suggested scale: 1 · 2 · 3 · 5 · 8
• <url|[IDENTIFIER]> Issue title

📅 *Missing due date*
• <url|[IDENTIFIER]> Issue title

Thanks! 🤖 _Sent on behalf of David via the RADS sprint dashboard_ 🤖
```

- Only include sections that apply to the person — omit any section with zero issues
- Within the label section, split open vs done into subsections only if the person has both

---

### Audit 1 — Unlabeled sprint issues

**Trigger phrases:** "audit unlabeled issues", "find tickets without labels", "notify owners of unlabeled tickets"

Finds all sprint issues assigned to tracked members missing a work-type label. Tracked labels: **Analysis**, **Automation**, **Infrastructure**, **KTLO**.

**Step 1 — Fetch** all active cycle issues for all 4 teams in parallel using saved cycle UUIDs.

**Step 2 — Filter:**
- Drop archived, Canceled, "Below the Line" issues
- Unlabeled = no label in `{Analysis, Automation, Infrastructure, KTLO}`
- Whitelist only — skip anyone not in the tracked member list
- Group by assignee

**Step 3 — Show full drafts. Wait for explicit approval.**

**Step 4 — Look up Slack IDs** from the cached table above; fall back to email lookup for uncached members.

**Step 5 — Send** after approval.

**Step 6 — Report back:** total issues (open vs done), people messaged, failures, unassigned issues.

---

### Audit 2 — Unpointed sprint issues

**Trigger phrases:** "audit unpointed issues", "find tickets without points", "notify owners of unpointed tickets"

Finds open sprint issues with no point estimate assigned.

**Filter:** drop archived, Canceled, "Below the Line", Done issues. Unpointed = `estimate` is null or 0. Whitelist only.

**Parent issue exemption:** if an issue has no estimate but has child issues, fetch its children and sum their estimates. If the children have a total estimate > 0, the parent is **not** flagged — points on children satisfy the requirement. Only flag the parent if both the parent and all its children have no points.

To fetch children, include `children { nodes { id estimate } }` in the issue query. If the Linear API returns children inline, use them directly. If not, query `issue(id: "<id>") { children { nodes { id estimate } } }` for each unpointed issue individually (batch these in parallel to avoid slow sequential lookups).

**Step 3 — Show full drafts. Wait for explicit approval.**

**Step 6 — Report back:** total issues, people messaged, failures.

---

### Audit 3 — Issues without a due date

**Trigger phrases:** "audit issues without due dates", "find tickets with no due date", "notify owners of undated tickets"

Finds open sprint issues with no `dueDate`. Done issues are excluded — due dates only matter for in-flight work.

**Filter:** drop archived, Canceled, "Below the Line", Done issues. Undated = `dueDate` is null. Whitelist only.

**Step 3 — Show full drafts. Wait for explicit approval.**

**Step 6 — Report back:** total issues, people messaged, failures.

---

### Audit 4 — Points in sprint (per person)

**Trigger phrases:** "audit sprint points", "check sprint load", "who is over/under-loaded"

Checks each whitelisted member's total sprint point commitment. Flags anyone outside the healthy range.

**Thresholds:** < 10 pts = under-loaded, > 20 pts = over-loaded. 10–20 pts = healthy (no flag).

**Filter:** count points from non-archived, non-Canceled, non-"Below the Line" issues only. Use `estimate.value` (sum across all issues regardless of state — total committed points, not done points).

**Step 1 — Fetch** all active cycle issues for all 4 teams using saved cycle UUIDs. Include `estimate { value }`, `assignee { displayName }`, `archivedAt`, `state { name type }`.

**Step 2 — Compute per-person totals:**
- Group by assignee, whitelist only
- Sum `estimate.value` (treat null as 0)
- Flag anyone where total < 10 or > 20

**Step 3 — Send report to David (not to individuals).** Use David's Slack ID: `U01H5TZGHUJ` — or DM `dbroesch@squareup.com`.

**Report format** (DM to David):

```
📊 *Sprint Points Audit* — RADS Q2 2026 Sprint 1

🔴 *Over-loaded* (> 20 pts):
• Victor Garcia — 24 pts
• Cassandra Milan — 22 pts

🟡 *Under-loaded* (< 10 pts):
• Kara Downey — 6 pts
• Lucas Brandl — 8 pts

✅ *Healthy* (10–20 pts):
• Name — N pts
• Name — N pts

_[N] members flagged out of [total] tracked._
```

- List flagged members with their point totals
- Healthy members can be listed by first name only in a compact line
- **This is a manager-level report — never send point data to the individuals**
- No approval needed to send to David (it's his own DM), but still show the draft first

---

## Interaction Patterns

**When the user is vague:** Ask one focused clarifying question. Don't front-load multiple questions.

**When listing items:** Concise numbered or table format. Offer to act on any item.

**When something fails:** Surface the error. Most likely causes: wrong team ID, permission issue, slug vs UUID mismatch, cycle number vs UUID mismatch.

**When user asks "what should I do?":** Pull cycle progress, overdue items, high-priority backlog — help them prioritize with data.

---

## sq agent-tools Linear Command Reference

| Task | Command | Notes |
|------|---------|-------|
| List/search issues | `execute-readonly-query` with `issues(filter: {...})` | Use `cycle`, `assignee`, `state`, `team` filters |
| Fetch one issue | `execute-readonly-query` with `issue(id: "ENG-123")` | Use identifier or UUID |
| Create/update issues | `batch-create-or-update-issues` | Preferred for all issue writes |
| Add comment | `execute-mutation-query` with `commentCreate` | Pass body via `--variables` |
| List projects | `execute-readonly-query` with `projects(filter: {...})` | Filter by initiative, team, name |
| Fetch project | `execute-readonly-query` with `project(id: "<uuid>")` | |
| Update project | `execute-mutation-query` with `projectUpdate` | |
| Project status updates | `execute-readonly-query` with `projectUpdates(filter: {...})` | UUID required, not slug |
| Post status update | `execute-mutation-query` with `projectUpdateCreate` | |
| Cycles for a team | `execute-readonly-query` with `team(id) { cycles(...) }` | Use `isActive: { eq: true }` filter |
| Teams | `execute-readonly-query` with `teams { nodes { id key name } }` | |
| Users | `execute-readonly-query` with `users` or `team(id) { members }` | |
| Initiatives | `execute-readonly-query` with `initiatives` | |
| Labels for a team | `execute-readonly-query` with `team(id) { labels { nodes { id name } } }` | |
| Workflow states | `execute-readonly-query` with `team(id) { states { nodes { id name type } } }` | |
| Milestones | `execute-readonly-query` with `project(id) { milestones { nodes { id name } } }` | |

Run `sq agent-tools linear describe` to see sample query shapes from the extension. Refer to Linear's GraphQL docs for exact schema/mutation names.

---

## Tips for Good Linear Hygiene

- Issues should have: clear title (verb + noun), priority, and assignee before entering a cycle
- Cycles should close with Done issues archived and incomplete issues triaged or rolled over
- Projects should have a target date and an owner (DRI)
- Check for existing labels before creating new ones (`list_issue_labels`)
- Cross-team contributors should be tracked explicitly — they appear in multiple teams' cycle queries

---

## David's Context

- **Employer:** Block / Cash App — Risk Foundation / Support Product Science
- **Role:** Data Scientist
- Linear tracks data science work, analysis tasks, and cross-functional initiatives
- Re-auth `sq agent-tools linear` if needed: connect at `go/agent-tools` in the G2 Connections page

---

## Saved Team Configurations

This section stores discovered team IDs, cycle IDs, and people for each org David works with. When a new team is set up, add its config here. When starting a sprint cycle for a known team, look here first before querying Linear.

---

### RADS Org (Risk & Data Science) — Q2 2026, Sprint 1 (Apr 6–20)

**Dashboard file:** `/Users/dbroesch/development/project management/rads-q2-2026-status.html`

**Initiative:** "RADS Q2 2026 initiatives" — `eb75cdf5-ba66-4701-8282-0633fc4c45d2`

**Label taxonomy (RADS-DS Tab 3):** Analysis · Automation · Infrastructure · KTLO

#### Teams
| Sub-team | Linear Key | Team ID |
|---|---|---|
| RADS-DS | `RADS` | `e05affa1-a584-4141-94c8-8ec9ca52248e` |
| Risk DS | `RISKDS` | `80e52023-7780-4dde-9234-64567fc4453e` |
| CustOps-DS | `CUSTDS` | `0f2a0619-8b8c-490e-98da-7fb25874f979` |
| Support Product-DS | `SPDS` | `9a4369f9-7d50-4a51-9018-778c5d842101` |

#### Sprint 1 Cycle IDs
| Team | Cycle UUID |
|---|---|
| RADS-DS | `e59aece4-90df-45fe-82cb-8c92311ad479` |
| RISKDS | `4422c2db-982d-4f1b-9ffc-a84f199f1ef1` |
| CUSTDS | `d2c218f5-dbf7-4300-9876-01ad32b80e8e` |
| SPDS | `22b97d24-9249-4ebf-8895-1c5a67e5588a` |

#### People
**Loaded from:** `/Users/dbroesch/development/project management/team-config.json`

Do not duplicate member data here — read from the config file at runtime. The file contains names, Linear login handles, emails, Slack IDs, and team assignments for all 13 members plus the manager.

#### RADS-Specific Workflow States
- **"Below the Line"** — custom RADS state; de-prioritized cycle issues. Use `canceled` CSS class, include in Issues count, exclude from Done/In Progress/Pts.

---
<!-- Add new team configs below this line -->
