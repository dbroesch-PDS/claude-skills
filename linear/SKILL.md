---
name: linear
description: Use when listing, searching, querying, browsing, creating, updating, assigning, commenting on, or managing Linear issues, projects, milestones, initiatives, documents, status updates, teams, users, cycles, or attachments through the connected `sq agent-tools linear` extension.
references: [sq-agent-tools]
roles: [frontend, cash-ios, backend, baseline, cash-design]
metadata:
  author: square
  version: "2.0"
  status: experimental
---

# Linear

Use the connected `sq agent-tools linear` extension for Linear work.

**STOP** if either check fails:

```bash
sq agent-tools --help
sq agent-tools linear --help
```

If `linear` is missing from `sq agent-tools --help`, tell the user the extension is unavailable in their local extension catalog and stop.

If `sq agent-tools linear --help` fails with a not-connected or not-authorized error, the extension exists but the user has not authenticated it yet. Tell them to connect it at `go/agent-tools` in the G2 Connections page. After browser OAuth completes, `sq agent-tools linear --help` should work.

## Command pattern

```bash
sq agent-tools linear --help
sq agent-tools linear describe
sq agent-tools linear execute-readonly-query --query 'query { ... }'
sq agent-tools linear execute-mutation-query --query 'mutation($id: String!) { ... }' --variables '{"id":"..."}'
sq agent-tools linear batch-create-or-update-issues --json '{"operation":"update", ...}'
```

Use `--json` for nested payloads. For GraphQL calls, keep the query in `--query` and put dynamic values in `--variables`.

## Quick reference

| Task | Best path | Notes |
|------|-----------|-------|
| Read one issue, project, document, team, user, milestone, or attachment | `execute-readonly-query` | Request only the fields you need |
| List or search issues | `execute-readonly-query` | Use `viewer.assignedIssues(...)` or `issues(filter: ...)` |
| Create or update issues | `batch-create-or-update-issues` | Preferred path for issue writes |
| Add a comment, relation, label, subscriber, or archive action on an issue | `execute-mutation-query` | Use GraphQL mutations like `commentCreate`, `issueRelationCreate`, `issueAddLabel`, or `issueArchive` |
| Read projects, initiatives, documents, status updates, teams, cycles, and attachments | `execute-readonly-query` | Generic GraphQL read surface |
| Update projects, milestones, initiatives, documents, status updates, or attachments | `execute-mutation-query` | Use the exact Linear GraphQL mutation with variables |

## Workflow guidance

- Run `sq agent-tools linear --help` first and trust the live command list.
- Run `sq agent-tools linear describe` when you need sample query shapes or mutation names from the extension.
- Use Linear's GraphQL docs for schema and mutation details when you need exact object names or input fields: [Linear GraphQL docs](https://linear.app/developers/graphql.md).
- Prefer narrow GraphQL selection sets instead of broad nested payloads.
- Use `issue(id: "ENG-123")` when you already know the issue identifier.
- Use `viewer.assignedIssues(...)` or `issues(filter: ...)` for lists, then paginate with `first` and `after` when needed.
- Resolve team, state, project, milestone, cycle, label, and user IDs with readonly queries before issuing writes that require IDs.
- Use `batch-create-or-update-issues` for issue title, description, assignee, priority, state, project, milestone, or label changes.
- Use `execute-mutation-query` with `--variables` for comments and non-issue writes. Do not inline long or multi-line bodies directly into the GraphQL string.
- Prefer `url` fields from results when you want a browser link back to Linear.

## Common queries

### My recently updated issues

```bash
sq agent-tools linear execute-readonly-query \
  --query '{ viewer { assignedIssues(orderBy: updatedAt, first: 20) { nodes { id identifier title updatedAt team { key } state { name type } } } } }'
```

### One issue with comments and labels

```bash
sq agent-tools linear execute-readonly-query \
  --query 'query { issue(id: "ENG-123") { id identifier title url description state { id name type } assignee { id name } project { id name } labels { nodes { id name } } comments { nodes { id body user { name } createdAt } } } }'
```

### Team states, cycles, members, and projects

```bash
sq agent-tools linear execute-readonly-query \
  --query 'query($teamId: String!) { team(id: $teamId) { id key name states { nodes { id name type } } cycles { nodes { id number name startsAt endsAt completedAt } } members { nodes { id displayName email } } projects { nodes { id name state url } } } }' \
  --variables '{"teamId":"<team-id>"}'
```

### Projects, initiatives, documents, and project status updates

```bash
sq agent-tools linear execute-readonly-query \
  --query 'query { projects(first: 10) { nodes { id name state targetDate url } } initiatives(first: 10) { nodes { id name status targetDate url } } documents(first: 10) { nodes { id title url updatedAt } } projectUpdates(first: 10) { nodes { id health createdAt project { name } user { name } url } } }'
```

## Common writes

### Create issues

```bash
sq agent-tools linear batch-create-or-update-issues \
  --json '{"operation":"create","new_issues":[{"teamId":"<team-id>","title":"Fix login bug","description":"Steps to reproduce","priority":2}]}'
```

### Update issues

```bash
sq agent-tools linear batch-create-or-update-issues \
  --json '{"operation":"update","ids":["<issue-id>"],"common_update":{"stateId":"<state-id>","assigneeId":"<user-id>","priority":3}}'
```

### Add a comment to an issue

```bash
sq agent-tools linear execute-mutation-query \
  --query 'mutation($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { success comment { id body url } } }' \
  --variables '{"issueId":"<issue-id>","body":"Looks good. Ready for review."}'
```
