---
name: team-summary
description: Research and summarize what an internal Block team does using Slack data. Use this skill whenever the user asks "what does the X team do", "tell me about the Y team at Block", "give me a summary of [team name]", "who is on the BAP/BIT/RADS/etc team", or any variation where they want to understand a Block internal team's mission, scope, members, or how it relates to David's org. Even if they just name an acronym and ask what it does — trigger this skill.
---

# Block Team Summary Skill

When the user asks about an internal Block team, research it via Slack and produce a structured summary. The goal is to give David a clear, actionable picture of what the team does, what they own, and how they intersect with his org (Risk Foundation / Support Product Science).

## Setup

Read credentials from `/Users/dbroesch/development/mcp-credentials.md`:
- `SLACK_TOKEN` = the `xoxp-...` token
- `TEAM_ID` = `T01H5TZGHUJ`

## Research Steps

Run these as Python scripts using the Slack Web API directly (urllib + json — no extra packages needed). Handle 429 rate limit errors by sleeping 3–5s and retrying.

### Step 1 — Find Slack channels

Paginate through `conversations.list` (1000/page, `team_id` param required) and collect every channel whose name contains the team keyword. Cast a wide net: if the user says "BAP", match `bap`, `bap-team`, `bap-help`, `bap-oncall`, `bap-announce`, `bap-eng`, etc.

For each matched channel, capture:
- `name`, `id`, `num_members`
- `purpose.value`, `topic.value`

Sort by member count descending. The largest channel is usually the team's main/help channel.

### Step 2 — Read recent messages from the main channel

Pick the top 1–2 channels by member count and call `conversations.history` (limit=20) on each. Read the messages to understand:
- What questions do people bring to this team? (signals who their customers are)
- What systems/tools/products are mentioned?
- What do team members post about?

If `conversations.history` returns `not_in_channel`, skip gracefully — that channel may be restricted.

### Step 3 — Find team members by title

Paginate through `users.list` (500/page, `team_id` param required). For each user, check if the team keyword appears in their `profile.title` or `real_name`. Collect matching users with their `id`, `real_name`, and `profile.title`.

This surfaces who self-identifies as part of this team (team leads, engineers, analysts).

### Step 4 — Spot key relationships

Look at the channel list for patterns that reveal who this team serves:
- A `-help` or `-discuss` channel with many members → they field questions from across the company
- Channels named after specific products → they own those products
- Channels prefixed with another team name → cross-team collaboration

Also check if any of David's direct reports are in these channels (see org context below).

## Output Format

After gathering data, synthesize everything into this structure. Be direct and specific — avoid vague corporate language. If something is genuinely unknown from the data, say so rather than guessing.

---

## [TEAM NAME] — Block Team Summary

**What they do**
2–3 sentences. Lead with their primary mission, then what they actually ship or operate day-to-day.

**Key products / systems owned**
Bullet list of named systems, tools, platforms, or processes they're responsible for.

**Who they serve**
Which internal teams or functions are their main customers? (e.g., "primarily serves Cash App risk and compliance teams")

**Slack channels**
| Channel | Members | Purpose |
|---------|---------|---------|
| #channel-name | N | one-line description |

**Key contacts** (from title search)
- Name — Title
- Name — Title

**How they relate to David's org**
Specifically call out:
- Whether any of David's direct reports or ICs work with / are on this team
- Shared channels, tooling dependencies, or data handoffs
- Whether David's team is a customer of theirs, a peer, or upstream/downstream

---

## David's Org Context

David Broesch leads Risk Foundation / Support Product Science at Block (Cash App). His org includes:
- **RADS** (Risk Analytics & Data Science) — Jakub Jurek, Tim Schwuchow
- **Compliance Analytics & Eng** — Daniel Boeck, Aditya Nagpal
- **3PR** (Third Party Response) — Usha Vellala
- **Support Product BI Engineering** — Hallie Million
- **COA** (Customer Operations Analytics) — Scott Santor, Lucas Brandl
- **Disputes DS** — Josh Madeira
- **Identity DS** — Jasmine Dangjaros
- **Complaints Analytics** — Cressida Stapleton
- **Support Product DS** — Kara Downey, Jeff Cheng, Linde Chen, Alvin Leung
- **Risk DS & Fraud** — Nan Gao, Shaotian Zhang, Kris Lachance, Victor Garcia
- **Payments & Cash Analytics** — Mariana Echeverria, Cassandra Milan
- **Risk Ops & Automation** — Janice Jiang

## Notes

- `conversations.list` and `users.list` both require `team_id=T01H5TZGHUJ` on Block's Enterprise Grid, otherwise they return `missing_argument`
- Rate limits: Tier 2 endpoints (conversations.list, users.list) allow ~20 req/min — sleep 0.3–0.5s between pages and retry on 429
- `users.list` has ~40,000+ users; a full scan takes 80+ pages — scan all pages but only print matches
- If the team name is ambiguous (e.g., "bit" matches many bitcoin channels), filter for channels that are clearly team-operational (small member counts, team-prefixed names) vs. broad help channels
