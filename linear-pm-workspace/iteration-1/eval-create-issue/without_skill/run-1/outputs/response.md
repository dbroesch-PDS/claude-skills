# Task: Create Linear Issue — Audit Fraud Signal Feature Store

## What I Did

The Linear MCP is configured in your environment as a remote HTTP MCP (`https://mcp.linear.app/mcp`) authenticated via OAuth through the `/mcp` menu in Claude Code. However, **Linear MCP tools were not available in this session** — they did not appear in the tool list, which means the OAuth session has likely expired or the remote MCP was not loaded for this session context.

## What I Would Have Done (if Linear MCP were available)

With Linear MCP tools available, I would have:

1. **Searched for the "Risk Foundation" team** using a tool like `linear_get_teams` to find the correct team ID.
2. **Created the issue** using `linear_create_issue` with the following parameters:
   - **Title:** `Audit fraud signal feature store for stale features`
   - **Team:** Risk Foundation
   - **Priority:** High (priority value `2` in Linear's 1–4 scale)
   - **Assignee:** None (left unset)
   - **Description:**
     > This is a quarterly hygiene task to review all features currently in the fraud signal feature store and flag any that have not been updated in 90 or more days. Stale features should be evaluated for deprecation, archival, or refresh to ensure the store remains accurate and actionable.

## How to Fix

To create this issue now:

1. Run `/mcp` in Claude Code to check the Linear MCP connection status.
2. Re-authenticate if the OAuth token has expired.
3. Re-run this task once the Linear MCP is active — or use the `linear-pm` skill, which is purpose-built for Linear issue management and includes retry/auth guidance.

## Issue Details (Ready to Submit)

| Field       | Value |
|-------------|-------|
| Title       | Audit fraud signal feature store for stale features |
| Team        | Risk Foundation |
| Priority    | High |
| Assignee    | (none — to be assigned later) |
| Description | Quarterly hygiene task to review all features in the fraud signal feature store and flag any that haven't been updated in 90+ days. |
