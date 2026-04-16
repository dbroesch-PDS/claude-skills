# Claude Skills

A collection of custom Claude Code skills for data science, engineering, and project management workflows.

## Skills

### `linear-pm`

Full Linear project management via `sq agent-tools linear` — create and update issues, manage projects and cycles, plan sprints, triage backlogs, check team workload, build sprint dashboards, and run automated sprint hygiene audits with Slack notifications.

**Requires:** the `linear` skill (`sq agent-tools linear` extension, connected at `go/agent-tools`).

**Covers:**
- Full Linear CRUD via GraphQL: issues, projects, cycles, comments, milestones, status updates
- Sprint dashboard generation and maintenance (Tab 1: Projects, Tab 2: Team & Sprint, Tab 3: Work Distribution)
- Sprint member card audits with a full checklist (cycle UUID lookup, archived issue handling, status verification, pts recompute, all-members table sync)
- Onboarding new teams to the dashboard pattern (discover initiative → projects → teams → cycles → labels → save config)
- Hardened data quirks: cycle UUID vs number, assignee+cycle empty results, archived issues in results, status update UUID requirement
- **Sprint hygiene audits with Slack DMs** (see below)

Triggers on: "update Linear", "what's in my sprint", "build a dashboard", "audit member cards", "triage my backlog", "create an issue", "what's the status of X project", "run the audits", etc.

#### Sprint Hygiene Audits

Four automated audit functions that fetch live Linear data and send Slack notifications:

| Audit | What it checks | Who receives the message |
|---|---|---|
| **Audit 1 — Unlabeled issues** | Sprint issues missing a work-type label (Analysis / Automation / Infrastructure / KTLO) | Each affected team member (DM) |
| **Audit 2 — Unpointed issues** | Open sprint issues with no point estimate | Each affected team member (DM) |
| **Audit 3 — No due date** | Open sprint issues with no due date | Each affected team member (DM) |
| **Audit 4 — Points per person** | Flags anyone with < 10 pts (under-loaded) or > 20 pts (over-loaded) | Manager only (DM) |

Audits 1–3 can be combined into one DM per person when run together. All audits require explicit manager approval before any messages are sent — drafts are always shown first.

#### Config Files

The skill uses two files in your project directory to avoid hardcoding team data:

**`team-config.json`** — the single source of truth for team members and manager identity. Used by both the dashboard generator and all audit functions.

```json
{
  "manager": {
    "name": "Your Name",
    "email": "you@company.com",
    "slack_id": "UXXXXXXXX"
  },
  "members": [
    {
      "name": "Alice Smith",
      "login": "asmith",
      "email": "asmith@company.com",
      "slack_id": "UXXXXXXXX",
      "slack_email": "asmith@company.com",
      "teams": ["TEAM-A"],
      "role": "TL",
      "team_label": "TEAM-A (optional override)"
    }
  ]
}
```

See `linear-pm/team-config.example.json` for a full template.

**`generate_dashboard.py`** — standalone Python script (stdlib only, no pip installs) that fetches Linear data and renders a self-contained HTML dashboard. It auto-loads `team-config.json` from the same directory if present, falling back to hardcoded defaults.

```bash
# Generate HTML only
LINEAR_API_KEY=lin_api_xxx python3 generate_dashboard.py

# Generate + deploy to Blockcell (requires WARP VPN)
LINEAR_API_KEY=lin_api_xxx python3 generate_dashboard.py --deploy

# Use pre-fetched Linear data (skip API key)
python3 generate_dashboard.py --data-file /tmp/linear_data.json
```

---

### `code-quality-analyzer`

Evaluates codebase quality across three dimensions: **security**, **efficiency**, and **human readability**. Produces a scored report with specific, actionable findings for each dimension.

Triggers on: "review my code", "audit the codebase", "is this production-ready", "code review", etc.

---

### `data-visualization`

Audits and redesigns data visualizations (Chart.js, matplotlib, seaborn, plotly, D3) to meet professional quality standards. Guides the choice between Python-rendered charts (matplotlib/plotly) and JS-rendered charts (Chart.js), enforces a consistent color palette, dark-theme styling, proper axis formatting, and graceful empty/error states.

Triggers on: "fix my chart", "this viz looks bad", "add a graph", "make a better chart", etc.

---

### `technical-writing`

Applies professional technical writing standards to formal documents — reports, specs, briefs, proposals, SOPs, memos, white papers, and structured reference docs.

Triggers on: "write a report", "format this spec", "draft a proposal", "make this more formal", etc.

---

### `skill-creator`

Creates new skills, modifies and improves existing skills, and measures skill performance via evals. Use when you want to build a new skill from scratch, optimize an existing one, or benchmark performance.

Triggers on: "create a skill for X", "update this skill", "run evals on my skill", etc.

---

## Installing Skills

Copy any skill folder into `~/.claude/skills/`:

```bash
# Install a single skill
cp -r linear-pm ~/.claude/skills/

# Install all skills at once
for d in */; do cp -r "$d" ~/.claude/skills/; done
```

Claude Code picks up skills automatically on the next session. No restart needed if Claude Code is already running — just start a new conversation.

## Skill Structure

Each skill is a folder containing a `SKILL.md` file:

```
linear-pm/
  SKILL.md                    ← skill definition, instructions, and saved configs
  generate_dashboard.py       ← standalone HTML dashboard generator (Linear → HTML)
  team-config.example.json    ← template for team member / manager config
  evals/                      ← optional: test cases for evaluating skill quality
```

The frontmatter in `SKILL.md` controls when the skill activates:

```yaml
---
name: linear-pm
description: >
  Trigger description — what Claude looks for to auto-invoke this skill
---
```
