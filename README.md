# Claude Skills

A collection of custom Claude Code skills.

## Skills

### `code-quality-analyzer`

Evaluates codebase quality across three dimensions: **security**, **efficiency**, and **human readability**. Produces a scored report with specific, actionable findings for each dimension.

Triggers on: "review my code", "audit the codebase", "is this production-ready", "code review", etc.

### `data-visualization`

Audits and redesigns data visualizations (Chart.js, matplotlib, seaborn, plotly, D3) to meet professional quality standards. Guides the choice between Python-rendered charts (matplotlib/plotly) and JS-rendered charts (Chart.js), enforces a consistent color palette, dark-theme styling, proper axis formatting, and graceful empty/error states.

Triggers on: "fix my chart", "this viz looks bad", "add a graph", "make a better chart", etc.

## Installing a Skill

Copy the skill folder into `~/.claude/skills/`:

```bash
cp -r code-quality-analyzer ~/.claude/skills/
cp -r data-visualization ~/.claude/skills/
```

Claude Code picks up skills automatically on the next session.
