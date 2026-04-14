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
