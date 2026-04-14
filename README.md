# Claude Skills

A collection of custom Claude Code skills for data science, engineering, and project management workflows.

## Skills

### `linear-pm`

Full Linear project management via the Linear MCP — create and update issues, manage projects and cycles, plan sprints, triage backlogs, check team workload, and build single-file HTML sprint dashboards for any Linear team or org.

**Covers:**
- Full Linear CRUD: issues, projects, cycles, comments, milestones, status updates
- Sprint dashboard generation and maintenance (Tab 1: Projects, Tab 2: Team & Sprint, Tab 3: Work Distribution)
- Sprint member card audits with a full checklist (cycle UUID lookup, archived issue handling, status verification, pts recompute, all-members table sync)
- Onboarding new teams to the dashboard pattern (discover initiative → projects → teams → cycles → labels → save config)
- Hardened MCP quirks: cycle UUID vs number, assignee+cycle empty results, archived issues in results, status update UUID requirement

Triggers on: "update Linear", "what's in my sprint", "build a dashboard", "audit member cards", "triage my backlog", "create an issue", "what's the status of X project", etc.

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
  SKILL.md      ← skill definition, instructions, and saved configs
  evals/        ← optional: test cases for evaluating skill quality
```

The frontmatter in `SKILL.md` controls when the skill activates:

```yaml
---
name: linear-pm
description: >
  Trigger description — what Claude looks for to auto-invoke this skill
---
```
