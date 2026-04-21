# Standup Check — In Progress Issues

I don't have direct access to Linear tools in this session without using the linear-pm skill. The Linear MCP integration is configured via claude.ai's remote MCP, which is not available as a native tool in this context.

## What I'd need to answer this

To check your team's In Progress issues and flag anything blocked or stale, I would need to:

1. **Query Linear for your team's active issues** — filtered to `status = "In Progress"`
2. **Check `updatedAt` timestamps** — to surface issues that haven't moved recently (e.g., no updates in 3+ days)
3. **Check for blockers** — look at issue labels, relations (blocked-by links), or comments indicating blockers
4. **Summarize by assignee** — so you can see who owns what and whether anyone's pile is stale

## What you can do right now

**Option 1 — Use the linear-pm skill**
Ask me the same question but allow the `linear-pm` skill to run. It has the full Linear MCP integration and can pull your team's board, filter by status, and flag stale/blocked items.

**Option 2 — Open Linear directly**
- Go to your team's board view in Linear
- Filter to "In Progress" status
- Sort by "Last updated" ascending to surface stale items
- Check the "Blocked" label or blocker relations if your team uses them

**Option 3 — Linear's built-in standup view**
Linear has a "My Issues" view and team cycle views that show recent activity. The "Updated" sort on any board view is the quickest way to spot things that haven't moved.

## Why I can't pull this directly (without the skill)

The Linear MCP requires authentication that's brokered through a configured MCP server connection. In default mode without the skill, I don't have a live API connection to Linear and cannot make queries on your behalf.

---

*Response generated: 2026-04-09 — No Linear data retrieved (no MCP connection in default mode)*
