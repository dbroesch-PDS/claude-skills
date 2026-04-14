---
name: linear-pm
description: >
  Full Linear project management via the Linear MCP. Use this skill whenever the user wants to do ANYTHING in Linear: create or update issues, manage projects or cycles, plan sprints, triage a backlog, check team workload, update statuses, set priorities, add labels, search issues, manage roadmaps, or track progress. Also trigger when the user mentions tickets, work items, engineering planning, or anything that sounds like it belongs in a project tracker. This skill also covers building and maintaining single-file HTML sprint dashboards for any Linear team or org. If in doubt, trigger.
---

# Linear Project Management

You have access to Linear via the Linear MCP tools. Use them to do real work — don't just describe what the user could do.

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

## Known MCP Tool Quirks

### Always Use Cycle UUID, Never Cycle Number
**Never pass a cycle number like `"1"` to `cycle` filters.** Cycle numbers are team-local and not globally unique — `cycle: "1"` can match the wrong cycle or return empty results on teams where cycle numbering differs.

**Always use the UUID.** Get it first with:
```
list_cycles(teamId="<team_uuid>", type="current")  → returns id, title, startsAt, endsAt
```
Then use that UUID in all subsequent `list_issues` calls.

### Assignee + Cycle Filter May Return Empty
The `assignee` + `cycle` combination sometimes returns zero results even when issues exist. If this happens, drop the `assignee` filter, fetch all cycle issues, then filter by assignee in Python:

```python
import json
issues = json.loads(open('result.txt').read())
if isinstance(issues, dict): issues = issues.get('issues', [])
mine = [i for i in issues if 'NameToMatch' in str(i.get('assignee', ''))]
```

### Estimate Field is a Dict
`estimate` is `{"value": 2, "name": "2 Points"}`, not an int:
```python
est = issue.get('estimate')
pts = est.get('value', 0) if isinstance(est, dict) else (est or 0)
```

### Archived Issues Come Back in Results
`list_issues` returns archived issues by default (they retain their `cycleId`). Always check `archivedAt` — if set, **exclude the issue entirely** from dashboards and counts.

### Status Updates Require UUID, Not Slug
`get_status_updates` does not accept project slugs. Workflow:
1. `get_project(query="project name")` → get the UUID `id` field
2. `get_status_updates(type="project", project="<uuid>", limit=1)`

### Finding Team IDs
`list_teams` with a name query can time out. Use `list_projects` (filtered by initiative or team) which returns `teamId` in the response. Or call `list_cycles(teamId=...)` once you have a known ID.

### Large Results (>50KB)
Results are saved to file automatically. Parse with:
```bash
cat /path/to/result.txt | python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
issues = json.loads(data[0]['text'])
if isinstance(issues, dict): issues = issues.get('issues', [])
print(len(issues), 'issues')
"
```

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
   - `list_initiatives` → find the relevant initiative and ID
   - `list_projects(initiative="<id>")` → get project IDs and team IDs
   - `list_teams` (paginated) or extract from project results → map team names to IDs

2. **Discover the people:**
   - `list_users` → get workspace members; filter to the relevant team(s)
   - Note cross-team contributors (people who appear in multiple teams' cycle issues)

3. **Discover active cycles:**
   - For each team: `list_cycles(teamId="<id>", type="current")` → get the UUID
   - Note cycle name, start, end dates

4. **Discover labels:**
   - `list_issue_labels(teamId="<id>")` → get all labels for the team
   - Ask the user which labels to feature in the Work Distribution tab (Tab 3)

5. **Save the config** to the Saved Team Configurations section at the bottom of this file, then build the dashboard using the standard HTML template.

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

1. **Identify the correct cycle UUID** for the member's team (see Saved Configs below, or `list_cycles(teamId, type="current")`).
2. Call `list_issues(assignee="<name>", cycle="<uuid>", team="<team_id>", includeArchived=true, limit=50)`.
3. **Drop archived issues** — filter out any where `archivedAt` is set.
4. **Separate Canceled issues** — keep in the table, exclude from counts.
5. **Verify every status** against the HTML — statuses change frequently and are almost always stale.
6. **Count delta** between Linear and the HTML badge. Find missing issues before making any edits.
7. **Recompute pts** — done pts and total pts from the filtered live issue list.
8. **Update the member card** — badge, all rows.
9. **Update the all-members table row** to match the new badge exactly.

---

## Common Workflows

### Creating an issue
1. Confirm: team, title, optional (description, priority, assignee, labels, cycle, project)
2. Call `save_issue`
3. Return the issue URL/ID

### Sprint / Cycle planning
1. `list_cycles(teamId, type="current")` → get active cycle
2. List unscoped backlog issues (no cycle filter, status = Todo)
3. Help scope issues in — confirm before bulk operations
4. Summarize scope: count, total pts

### Backlog grooming
1. Fetch backlog (no cycle, status = Todo)
2. Group by priority; flag: no priority, no estimate, stale (>30 days no update)
3. Triage: update priority, estimate, assignee, or close

### Standup / status view for a person
1. `list_issues(assignee="<name>", cycle="<uuid>")` for active cycle
2. Group by status: Done (today/this week), In Progress, Blocked, Todo
3. Surface blockers first

### Searching issues
- Use keyword, label, priority, assignee, team, project, status filters
- Paginate if many results; summarize patterns before listing all

### Gathering project status updates
1. `get_project(query="<name>")` → get UUID
2. `get_status_updates(type="project", project="<uuid>", limit=1)`
3. Post `body` verbatim; append `diffMarkdown` as progress note
4. Flag late if posted after Thursday 5pm PT

---

## Interaction Patterns

**When the user is vague:** Ask one focused clarifying question. Don't front-load multiple questions.

**When listing items:** Concise numbered or table format. Offer to act on any item.

**When something fails:** Surface the error. Most likely causes: wrong team ID, permission issue, slug vs UUID mismatch, cycle number vs UUID mismatch.

**When user asks "what should I do?":** Pull cycle progress, overdue items, high-priority backlog — help them prioritize with data.

---

## MCP Tool Reference

```
mcp__claude_ai_Linear__list_issues         — list issues with filters
mcp__claude_ai_Linear__get_issue           — fetch a single issue by ID or URL
mcp__claude_ai_Linear__save_issue          — create or update an issue
mcp__claude_ai_Linear__list_projects       — list projects (filter by initiative, team, member)
mcp__claude_ai_Linear__get_project         — fetch a project by name/ID/slug
mcp__claude_ai_Linear__save_project        — create or update a project
mcp__claude_ai_Linear__get_status_updates  — fetch project/initiative status updates (UUID required)
mcp__claude_ai_Linear__save_status_update  — post a status update
mcp__claude_ai_Linear__list_cycles         — list cycles for a team
mcp__claude_ai_Linear__list_teams          — list workspace teams
mcp__claude_ai_Linear__list_users          — list workspace members
mcp__claude_ai_Linear__get_initiative      — fetch initiative details
mcp__claude_ai_Linear__list_initiatives    — list initiatives
mcp__claude_ai_Linear__save_comment        — add a comment to an issue
mcp__claude_ai_Linear__list_comments       — list comments on an issue
mcp__claude_ai_Linear__list_milestones     — list milestones for a project
mcp__claude_ai_Linear__list_issue_labels   — list labels for a team
mcp__claude_ai_Linear__list_issue_statuses — list workflow states for a team
```

Check actual available tools at runtime — names may vary slightly. Use `ToolSearch` to fetch a schema when unsure of arguments.

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
- Re-auth Linear MCP if needed via `/mcp` in Claude Code

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

#### People (verified actual Linear team, not just org chart)
| Person | Email | Actual Linear Team(s) |
|---|---|---|
| Victor Garcia | victorg@squareup.com | RADS-DS + RISKDS |
| Nan Gao | — | RADS-DS + RISKDS (cross-team) |
| Jasmine Dangjaros | jdangjaros@squareup.com | RISKDS [TL] |
| Josh Madeira | jmadeira@squareup.com | RISKDS [TL] |
| Shaotian Zhang | shaotian@squareup.com | RISKDS |
| Scott Santor | ssantor@squareup.com | CUSTDS |
| Cassandra Milan | cmilan@squareup.com | CUSTDS |
| Lucas Brandl | lbrandl@squareup.com | CUSTDS |
| Cressida Stapleton | cstapleton@squareup.com | CUSTDS |
| Janice Jiang | jiaojiang@squareup.com | CUSTDS (child of RADS-DS) |
| Jeff Cheng | jeffc@squareup.com | SPDS (not CUSTDS despite org chart) |
| Kara Downey | kdowney@squareup.com | SPDS |
| Mariana Echeverria | mecheverria@squareup.com | SPDS |

#### RADS-Specific Workflow States
- **"Below the Line"** — custom RADS state; de-prioritized cycle issues. Use `canceled` CSS class, include in Issues count, exclude from Done/In Progress/Pts.

---
<!-- Add new team configs below this line -->
