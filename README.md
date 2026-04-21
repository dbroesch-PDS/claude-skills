# Claude Code Skills — David Broesch

Custom skills for [Claude Code](https://claude.ai/code) (`~/.claude/skills/`). Each skill is a markdown file that extends Claude's behavior for a specific domain.

## Skills

| Skill | What it does |
|-------|-------------|
| [blockcell](./blockcell/SKILL.md) | Deploy and host static sites on Blockcell for internal sharing at Block |
| [code-quality-analyzer](./code-quality-analyzer/SKILL.md) | Score a codebase on security, efficiency, and readability; produce an actionable report |
| [data-discovery](./data-discovery/SKILL.md) | Deep Snowflake table/schema intelligence for Block/Cash App data scientists |
| [data-visualization](./data-visualization/SKILL.md) | Audit and redesign charts (Chart.js, matplotlib, seaborn, plotly, D3) to professional standards |
| [linear](./linear/SKILL.md) | Query and manage Linear via `sq agent-tools linear` — issues, projects, cycles, roadmaps |
| [linear-pm](./linear-pm/SKILL.md) | Full Linear project management + single-file HTML sprint dashboards for any team or org |
| [skill-creator](./skill-creator/SKILL.md) | Create, improve, and benchmark Claude Code skills |
| [stream-deck-plugin](./stream-deck-plugin/SKILL.md) | Build Stream Deck plugins with the official `@elgato/streamdeck` TypeScript SDK |
| [streamdeck-button-maker](./streamdeck-button-maker/SKILL.md) | Build standalone Stream Deck tools in plain JS using the `@elgato-stream-deck/node` hardware SDK |
| [te-cheatsheet](./te-cheatsheet/SKILL.md) | Generate print-ready PDF cheatsheets in the Teenage Engineering visual style |
| [team-summary](./team-summary/SKILL.md) | Research and summarize Block internal teams using Slack data |
| [technical-writing](./technical-writing/SKILL.md) | Write and format formal technical documents — specs, reports, SOPs, proposals |

## Structure

Each skill is a self-contained directory:

```
<skill-name>/
  SKILL.md          # The skill itself — loaded by Claude Code
  references/       # Optional supporting reference docs
```

## Usage

Skills in `~/.claude/skills/` are automatically available in Claude Code. Invoke with `/skill-name` or Claude will trigger them automatically based on context.
