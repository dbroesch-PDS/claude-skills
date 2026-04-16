#!/usr/bin/env python3
"""
RADS Q2 2026 Status Dashboard Generator
Fetches live data from Linear's GraphQL API and regenerates rads-q2-2026-status.html

Usage:
    # With Linear API key (direct fetch):
    LINEAR_API_KEY=lin_api_xxx python3 generate_dashboard.py [--deploy]

    # With pre-fetched data JSON (no API key needed — use Linear MCP to populate):
    python3 generate_dashboard.py --data-file /tmp/linear_data.json [--deploy]

    # JSON format for --data-file:
    # {
    #   "projects":   [ { ...project fields..., "_update": {...} | null } ],
    #   "all_issues": [ { ...issue fields..., "_team": "RADS-DS" } ],
    #   "sprint":     { "name": "Sprint 1", "label": "Apr 6 – Apr 20, 2026",
    #                   "start": "2026-04-06T00:00:00+00:00",
    #                   "end":   "2026-04-20T00:00:00+00:00" }
    # }
"""

import os, sys, re, math, json, argparse, tempfile, zipfile, shutil
import html as _html
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

import urllib.request
import urllib.error

# ─── CONFIGURATION ────────────────────────────────────────────────────────────

LINEAR_API  = "https://api.linear.app/graphql"
INITIATIVE_ID = "eb75cdf5-ba66-4701-8282-0633fc4c45d2"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "rads-q2-2026-status.html")

# Populated at runtime from Linear's active cycles — nothing to configure here.
SPRINT = {"name": "", "label": "", "start": None, "end": None}

TEAMS = {
    "RADS-DS": "e05affa1-a584-4141-94c8-8ec9ca52248e",
    "RISKDS":  "80e52023-7780-4dde-9234-64567fc4453e",
    "CUSTDS":  "0f2a0619-8b8c-490e-98da-7fb25874f979",
    "SPDS":    "9a4369f9-7d50-4a51-9018-778c5d842101",
}

PDT = timezone(timedelta(hours=-7))  # Pacific Daylight Time (Apr–Oct)

def _load_members_from_config() -> list:
    """Load MEMBERS from team-config.json next to this script, if present."""
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "team-config.json")
    if not os.path.exists(config_path):
        return None
    with open(config_path) as f:
        config = json.load(f)
    result = []
    for m in config.get("members", []):
        name   = m["name"]
        role   = m.get("role", "")
        teams  = m.get("teams", [])
        result.append({
            "id":         m["login"],
            "name_match": name,
            "display":    f"{name} [{role}]" if role else name,
            "email":      m.get("email"),
            "team_label": m.get("team_label") or " + ".join(teams),
            "cycle_keys": teams,
        })
    return result

MEMBERS = _load_members_from_config() or [
    {"id": "victor",    "name_match": "Victor Garcia",     "display": "Victor Garcia",          "email": "victorg@squareup.com",    "team_label": "RADS-DS + RISKDS",        "cycle_keys": ["RADS-DS", "RISKDS"]},
    {"id": "nan",       "name_match": "Nan Gao",            "display": "Nan Gao",                "email": None,                       "team_label": "RADS-DS + RISKDS",        "cycle_keys": ["RADS-DS", "RISKDS"]},
    {"id": "jasmine",   "name_match": "Jasmine Dangjaros",  "display": "Jasmine Dangjaros [TL]", "email": "jdangjaros@squareup.com", "team_label": "RISKDS",                  "cycle_keys": ["RISKDS"]},
    {"id": "josh",      "name_match": "Josh Madeira",       "display": "Josh Madeira [TL]",      "email": "jmadeira@squareup.com",   "team_label": "RISKDS (Disputes PDS)",   "cycle_keys": ["RISKDS"]},
    {"id": "shaotian",  "name_match": "Shaotian Zhang",     "display": "Shaotian Zhang",         "email": "shaotian@squareup.com",   "team_label": "RISKDS",                  "cycle_keys": ["RISKDS"]},
    {"id": "scott",     "name_match": "Scott Santor",       "display": "Scott Santor [TL]",      "email": "ssantor@squareup.com",    "team_label": "CUSTDS",                  "cycle_keys": ["CUSTDS"]},
    {"id": "cassandra", "name_match": "Cassandra Milan",    "display": "Cassandra Milan",        "email": "cmilan@squareup.com",     "team_label": "CUSTDS",                  "cycle_keys": ["CUSTDS"]},
    {"id": "lucas",     "name_match": "Lucas Brandl",       "display": "Lucas Brandl",           "email": "lbrandl@squareup.com",    "team_label": "CUSTDS",                  "cycle_keys": ["CUSTDS"]},
    {"id": "cressida",  "name_match": "Cressida Stapleton", "display": "Cressida Stapleton",     "email": "cstapleton@squareup.com", "team_label": "CUSTDS",                  "cycle_keys": ["CUSTDS"]},
    {"id": "janice",    "name_match": "Janice Jiang",       "display": "Janice Jiang",           "email": "jiaojiang@squareup.com",  "team_label": "CUSTDS (COA child team)", "cycle_keys": ["CUSTDS"]},
    {"id": "jeff",      "name_match": "Jeff Cheng",         "display": "Jeff Cheng",             "email": "jeffc@squareup.com",      "team_label": "SPDS",                    "cycle_keys": ["SPDS"]},
    {"id": "kara",      "name_match": "Kara Downey",        "display": "Kara Downey",            "email": "kdowney@squareup.com",    "team_label": "SPDS",                    "cycle_keys": ["SPDS"]},
    {"id": "mariana",   "name_match": "Mariana Echeverria", "display": "Mariana Echeverria",     "email": "mecheverria@squareup.com","team_label": "SPDS",                    "cycle_keys": ["SPDS"]},
]

LABEL_CATEGORIES = ["Analysis", "Automation", "Infrastructure", "KTLO"]
LABEL_COLORS = {
    "Analysis":       "#5e6ad2",
    "Automation":     "#26b96d",
    "Infrastructure": "#9b59b6",
    "KTLO":           "#f29c38",
}

# ─── LINEAR API ───────────────────────────────────────────────────────────────

def gql(query: str, variables: dict = None) -> dict:
    key = os.environ.get("LINEAR_API_KEY")
    if not key:
        sys.exit("Set LINEAR_API_KEY environment variable\nGet one at: https://linear.app/settings/api")
    payload = json.dumps({"query": query, "variables": variables or {}}).encode("utf-8")
    req = urllib.request.Request(
        LINEAR_API,
        data=payload,
        headers={"Authorization": key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"Linear API HTTP {e.code}: {e.read().decode()}")
    if "errors" in data:
        sys.exit(f"GraphQL error: {data['errors']}")
    return data["data"]

def paginate(query: str, path: str, variables: dict = None) -> list:
    """Fetch all pages from a paginated query. path = dot-separated key e.g. 'projects'."""
    results = []
    cursor = None
    while True:
        v = dict(variables or {})
        if cursor:
            v["cursor"] = cursor
        data = gql(query, v)
        node = data
        for key in path.split("."):
            node = node[key]
        results.extend(node["nodes"])
        if not node["pageInfo"]["hasNextPage"]:
            break
        cursor = node["pageInfo"]["endCursor"]
    return results

# ─── DATA FETCHING ────────────────────────────────────────────────────────────

PROJECTS_QUERY = """
query GetProjects($initiativeId: String!, $cursor: String) {
  projects(
    filter: { initiatives: { id: { eq: $initiativeId } } }
    first: 50
    after: $cursor
  ) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id name url slugId status priority targetDate startDate updatedAt
      lead { id name email }
      labels { nodes { name } }
    }
  }
}
"""

UPDATE_QUERY = """
query GetUpdate($projectId: String!) {
  projectUpdates(
    filter: { project: { id: { eq: $projectId } } }
    first: 1
    orderBy: createdAt
  ) {
    nodes {
      id body diffMarkdown createdAt
      user { name email }
    }
  }
}
"""

CYCLES_QUERY = """
query GetCycles($teamId: String!) {
  cycles(filter: { team: { id: { eq: $teamId } } }, first: 20, orderBy: createdAt) {
    nodes { id number name startsAt endsAt isActive }
  }
}
"""

CYCLE_ISSUES_QUERY = """
query GetCycleIssues($cycleId: String!, $cursor: String) {
  cycle(id: $cycleId) {
    issues(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id identifier title url canceledAt completedAt
        state { name type }
        priority
        estimate
        assignee { id name email }
        project { name url }
        labels { nodes { name } }
      }
    }
  }
}
"""

def fetch_projects() -> list:
    print("  Fetching initiative projects...")
    return paginate(PROJECTS_QUERY, "projects", {"initiativeId": INITIATIVE_ID})

def fetch_update(project_id: str) -> dict | None:
    data = gql(UPDATE_QUERY, {"projectId": project_id})
    nodes = data.get("projectUpdates", {}).get("nodes", [])
    return nodes[0] if nodes else None

def fetch_updates_parallel(projects: list) -> None:
    """Fetch status updates for all projects concurrently and attach as _update."""
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fetch_update, p["id"]): p for p in projects}
        for future in as_completed(futures):
            project = futures[future]
            project["_update"] = future.result()
            print(f"  ✓ {project['name'][:50]}")

def find_active_cycle(team_id: str, team_key: str) -> dict | None:
    """Return the currently active cycle for a team, or most recent if none flagged active."""
    data = gql(CYCLES_QUERY, {"teamId": team_id})
    cycles = data.get("cycles", {}).get("nodes", [])
    if not cycles:
        return None
    # Prefer Linear's own isActive flag
    for c in cycles:
        if c.get("isActive"):
            return c
    # Fall back: cycle whose window contains today
    now = datetime.now(timezone.utc)
    for c in cycles:
        start = datetime.fromisoformat(c["startsAt"].replace("Z", "+00:00"))
        end   = datetime.fromisoformat(c["endsAt"].replace("Z", "+00:00"))
        if start <= now <= end:
            return c
    # Fall back: most recent cycle that has already started
    started = [c for c in cycles if datetime.fromisoformat(c["startsAt"].replace("Z", "+00:00")) <= now]
    return max(started, key=lambda c: c["startsAt"]) if started else None

def fetch_cycle_issues(cycle_id: str, team_key: str) -> list:
    results = []
    cursor = None
    while True:
        v = {"cycleId": cycle_id}
        if cursor:
            v["cursor"] = cursor
        data = gql(CYCLE_ISSUES_QUERY, v)
        issues_page = data["cycle"]["issues"]
        for issue in issues_page["nodes"]:
            issue["_team"] = team_key
        results.extend(issues_page["nodes"])
        if not issues_page["pageInfo"]["hasNextPage"]:
            break
        cursor = issues_page["pageInfo"]["endCursor"]
    return results

_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

def _fetch_team_issues(team_key: str, team_id: str) -> tuple:
    """Fetch active cycle + issues for one team. Returns (team_key, cycle, issues)."""
    cycle = find_active_cycle(team_id, team_key)
    if not cycle:
        return team_key, None, []
    issues = fetch_cycle_issues(cycle["id"], team_key)
    return team_key, cycle, issues

def fetch_all_sprint_issues() -> list:
    """Auto-detect the active cycle for every team and fetch their issues in parallel.
    Populates the global SPRINT dict from the discovered cycle data."""
    sprint_starts, sprint_ends, cycle_numbers = [], [], []
    team_results = {}

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(_fetch_team_issues, k, v): k for k, v in TEAMS.items()}
        for future in as_completed(futures):
            team_key, cycle, issues = future.result()
            team_results[team_key] = (cycle, issues)

    all_issues = []
    for team_key in TEAMS:  # preserve original order for display consistency
        cycle, issues = team_results.get(team_key, (None, []))
        if not cycle:
            print(f"  [{team_key}] Warning: no active cycle found — skipping")
            continue
        num = cycle.get("number", "?")
        start = datetime.fromisoformat(cycle["startsAt"].replace("Z", "+00:00"))
        end   = datetime.fromisoformat(cycle["endsAt"].replace("Z", "+00:00"))
        print(f"  [{team_key}] Cycle {num} ({_MONTHS[start.month-1]} {start.day} – {_MONTHS[end.month-1]} {end.day}) → {len(issues)} issues")
        sprint_starts.append(start)
        sprint_ends.append(end)
        cycle_numbers.append(num)
        all_issues.extend(issues)

    if sprint_starts:
        s = min(sprint_starts)
        e = max(sprint_ends)
        num_display = cycle_numbers[0] if len(set(cycle_numbers)) == 1 else "/".join(str(n) for n in sorted(set(cycle_numbers)))
        SPRINT["name"]  = f"Sprint {num_display}"
        SPRINT["start"] = s
        SPRINT["end"]   = e
        SPRINT["label"] = f"{_MONTHS[s.month-1]} {s.day} – {_MONTHS[e.month-1]} {e.day}, {e.year}"

    return all_issues

# ─── HELPERS ──────────────────────────────────────────────────────────────────

def get_pts(issue: dict) -> int:
    est = issue.get("estimate")
    if isinstance(est, dict):
        return est.get("value") or 0
    return int(est) if est else 0

def is_canceled(issue: dict) -> bool:
    return (issue.get("canceledAt") is not None or
            (issue.get("state") or {}).get("type") == "cancelled")

def state_type(issue: dict) -> str:
    return (issue.get("state") or {}).get("type", "unstarted")

def state_pill(issue: dict) -> str:
    stype = state_type(issue)
    sname = (issue.get("state") or {}).get("name", "To-do")
    cls_map = {"completed": "done", "started": "in-progress",
               "cancelled": "canceled", "backlog": "todo",
               "unstarted": "todo", "triage": "todo"}
    css = cls_map.get(stype, "todo")
    return f'<span class="status-pill {css}">{_html.escape(sname)}</span>'

def priority_html(p) -> str:
    if not p:
        return "—"
    names = {1: "Urgent", 2: "High", 3: "Medium", 4: "Low"}
    classes = {1: "urgent", 2: "high", 3: "medium", 4: "low"}
    return f'<span class="priority-pill {classes[p]}">{names[p]}</span>'

def pts_html(issue: dict) -> str:
    pts = get_pts(issue)
    return f'<span class="pts-badge">{pts}</span>' if pts else "—"

def is_late_update(created_at_str: str) -> bool:
    """True if the update was posted after Thursday 5pm PT."""
    dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00")).astimezone(PDT)
    # Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    if dt.weekday() > 3:
        return True
    if dt.weekday() == 3 and dt.hour >= 17:
        return True
    return False

def is_stale_update(created_at_str: str, days: int = 7) -> bool:
    dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - dt).days > days

def fmt_update_date(created_at_str: str) -> str:
    dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00")).astimezone(PDT)
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    return f"{month_names[dt.month-1]} {dt.day}, {dt.year} at {dt.strftime('%-I:%M %p')} PT ({day_names[dt.weekday()]})"

def match_member(issue_assignee: dict | None, member: dict) -> bool:
    if not issue_assignee:
        return False
    name = issue_assignee.get("name", "").lower()
    target = member["name_match"].lower()
    return name == target or target in name

def classify_labels(issue: dict) -> list[str]:
    labels = [l["name"] for l in (issue.get("labels") or {}).get("nodes", [])]
    return [l for l in labels if l in LABEL_CATEGORIES]

def member_stats(issues: list) -> dict:
    active = [i for i in issues if not is_canceled(i)]
    done    = [i for i in active if state_type(i) == "completed"]
    in_prog = [i for i in active if state_type(i) == "started"]
    todo    = [i for i in active if state_type(i) in ("unstarted", "backlog", "triage")]
    total_pts = sum(get_pts(i) for i in active if get_pts(i))
    done_pts  = sum(get_pts(i) for i in done if get_pts(i))
    return {
        "total": len(active), "done": len(done),
        "in_progress": len(in_prog), "todo": len(todo),
        "done_pts": done_pts, "total_pts": total_pts,
    }

# ─── MARKDOWN CONVERTER ───────────────────────────────────────────────────────

def _inline_md(text: str) -> str:
    """Convert inline markdown to HTML (escape first, then apply formatting)."""
    # Escape HTML special chars
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Links [text](url)
    def link_replace(m):
        label = m.group(1)
        url = m.group(2).replace("&amp;", "&")
        return f'<a href="{_html.escape(url)}" target="_blank">{label}</a>'
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", link_replace, text)
    # Bold **text**
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    # Italic *text* (not double-asterisk)
    text = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<em>\1</em>", text)
    # Inline code `text`
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    # Emoji issue-like: LINEAR-123 style (just leave as text, already escaped)
    return text

def _md_table(rows: list[str]) -> str:
    out = ['<table class="issue-table" style="margin-bottom:0.8rem;"><thead>']
    first_data = True
    for row in rows:
        stripped = row.strip().strip("|")
        cells = [c.strip() for c in stripped.split("|")]
        # Skip separator rows like |---|---|
        if all(re.match(r"^[-: ]+$", c) for c in cells if c):
            continue
        if first_data:
            out.append("<tr>" + "".join(f"<th>{_inline_md(c)}</th>" for c in cells) + "</tr></thead><tbody>")
            first_data = False
        else:
            out.append("<tr>" + "".join(f"<td>{_inline_md(c)}</td>" for c in cells) + "</tr>")
    out.append("</tbody></table>")
    return "\n".join(out)

def md_to_html(text: str) -> str:
    """Convert Linear markdown body to HTML."""
    if not text:
        return ""
    lines = text.split("\n")
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Headers
        m = re.match(r"^(#{1,6})\s+(.+)$", line)
        if m:
            level = len(m.group(1))
            tag = "h3" if level <= 2 else "h4"
            out.append(f"<{tag}>{_inline_md(m.group(2))}</{tag}>")
            i += 1; continue

        # HR
        if re.match(r"^[-*_]{3,}$", stripped):
            out.append("<hr>")
            i += 1; continue

        # Unordered list
        if re.match(r"^[-*+] ", line):
            items = []
            while i < len(lines) and re.match(r"^[-*+] ", lines[i]):
                items.append(f"<li>{_inline_md(lines[i][2:])}</li>")
                i += 1
            out.append("<ul>" + "".join(items) + "</ul>")
            continue

        # Ordered list
        if re.match(r"^\d+[.)]\s", line):
            items = []
            while i < len(lines) and re.match(r"^\d+[.)]\s", lines[i]):
                content = re.sub(r"^\d+[.)]\s*", "", lines[i])
                items.append(f"<li>{_inline_md(content)}</li>")
                i += 1
            out.append("<ol>" + "".join(items) + "</ol>")
            continue

        # Table
        if stripped.startswith("|") and "|" in stripped[1:]:
            table_rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_rows.append(lines[i])
                i += 1
            out.append(_md_table(table_rows))
            continue

        # Empty line
        if not stripped:
            i += 1; continue

        # Regular paragraph
        out.append(f"<p>{_inline_md(line)}</p>")
        i += 1

    return "\n".join(out)

# ─── SVG: BURNDOWN CHART ──────────────────────────────────────────────────────

def render_burndown(total_pts: int, done_pts: int) -> str:
    remaining = total_pts - done_pts
    sprint_start = SPRINT["start"]
    sprint_end   = SPRINT["end"]
    today = datetime.now(timezone.utc)
    total_days = (sprint_end - sprint_start).days  # 14 for 2-week sprint

    # Clamp today to sprint window
    sprint_day = max(1, min(total_days, (today - sprint_start).days + 1))

    # Chart geometry: x from 50 (day 1) to 670 (last day), y from 20 (max pts) to 155 (0 pts)
    chart_h = 135
    chart_x_start, chart_x_end = 50, 670
    chart_y_bot = 155
    chart_y_top = 20
    x_step = (chart_x_end - chart_x_start) / (total_days - 1) if total_days > 1 else 1

    def x_for_day(d): return chart_x_start + (d - 1) * x_step
    def y_for_pts(p): return chart_y_bot - (p / max(total_pts, 1)) * chart_h

    today_x = x_for_day(sprint_day)
    actual_y = y_for_pts(remaining)
    ideal_remaining = total_pts * (1 - (sprint_day - 1) / (total_days - 1))
    ideal_y = y_for_pts(ideal_remaining)
    delta = remaining - ideal_remaining
    delta_sign = "+" if delta > 0 else ""

    # Projected end: slope from start through today
    # pts_remaining = remaining - (done_pts/sprint_day) * (days_left)
    days_left = total_days - sprint_day
    daily_burn = done_pts / sprint_day if sprint_day > 0 else 0
    projected_end = max(0, remaining - daily_burn * days_left)
    proj_y = y_for_pts(projected_end)

    # Y-axis tick marks at 0, 25%, 50%, 75%, 100% of total
    ticks = [0, total_pts//4, total_pts//2, 3*total_pts//4, total_pts]

    # X-axis day labels
    start_date = sprint_start
    day_labels = []
    for d in range(1, total_days + 1):
        day_dt = start_date + timedelta(days=d - 1)
        x = x_for_day(d)
        label = f"Apr {day_dt.day}" if d in (1, total_days) else str(day_dt.day)
        color = "#5e6ad2" if d == sprint_day else "#8b91b0"
        weight = 'font-weight="bold"' if d == sprint_day else ""
        mark = " ▲" if d == sprint_day else ""
        day_labels.append(f'<text x="{x:.0f}" y="168" fill="{color}" font-size="9" text-anchor="middle" {weight}>{label}{mark}</text>')

    # Grid lines
    grids = []
    for pts in ticks[1:3]:  # middle ticks only
        y = y_for_pts(pts)
        grids.append(f'<line x1="50" y1="{y:.1f}" x2="670" y2="{y:.1f}" stroke="#2e3250" stroke-width="0.5" stroke-dasharray="3,3"/>')

    return f"""<svg class="burndown-chart" viewBox="0 0 700 180" xmlns="http://www.w3.org/2000/svg">
  <!-- Axes -->
  <line x1="50" y1="20" x2="50" y2="155" stroke="#2e3250" stroke-width="1"/>
  <line x1="50" y1="155" x2="670" y2="155" stroke="#2e3250" stroke-width="1"/>
  <!-- Grid -->
  {"".join(grids)}
  <!-- Y labels -->
  <text x="44" y="24"  fill="#8b91b0" font-size="10" text-anchor="end">{total_pts}</text>
  <text x="44" y="{y_for_pts(total_pts//2)+4:.0f}" fill="#8b91b0" font-size="10" text-anchor="end">{total_pts//2}</text>
  <text x="44" y="158" fill="#8b91b0" font-size="10" text-anchor="end">0</text>
  <!-- X labels -->
  {"".join(day_labels)}
  <!-- Scope label -->
  <text x="58" y="17" fill="#5e6ad2" font-size="8.5" font-weight="600">{total_pts} pts scope (all teams)</text>
  <!-- Ideal burndown -->
  <line x1="50" y1="20" x2="670" y2="155" stroke="#8b91b0" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.5"/>
  <!-- Today marker -->
  <line x1="{today_x:.0f}" y1="20" x2="{today_x:.0f}" y2="155" stroke="#5e6ad2" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/>
  <!-- Actual line to today -->
  <line x1="50" y1="20" x2="{today_x:.0f}" y2="{actual_y:.1f}" stroke="#26b96d" stroke-width="2" opacity="0.7"/>
  <!-- Projected line -->
  <line x1="{today_x:.0f}" y1="{actual_y:.1f}" x2="670" y2="{proj_y:.1f}" stroke="#26b96d" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.5"/>
  <text x="655" y="{proj_y-5:.0f}" fill="#26b96d" font-size="8" text-anchor="end">~{projected_end:.0f} projected</text>
  <!-- Delta bar -->
  <line x1="{today_x:.0f}" y1="{ideal_y:.1f}" x2="{today_x:.0f}" y2="{actual_y:.1f}" stroke="#f29c38" stroke-width="3" opacity="0.7"/>
  <text x="{today_x+6:.0f}" y="{(ideal_y+actual_y)/2+3:.0f}" fill="#f29c38" font-size="8.5" font-weight="600">{delta_sign}{delta:.0f} {'behind' if delta > 0 else 'ahead'}</text>
  <!-- Ideal point -->
  <circle cx="{today_x:.0f}" cy="{ideal_y:.1f}" r="4" fill="#8b91b0" opacity="0.8"/>
  <!-- Actual remaining dot -->
  <circle cx="{today_x:.0f}" cy="{actual_y:.1f}" r="6" fill="#eb5757" stroke="#0f1117" stroke-width="2"/>
  <text x="{today_x:.0f}" y="{actual_y-10:.0f}" fill="#eb5757" font-size="9" text-anchor="middle" font-weight="bold">{remaining} pts remaining</text>
</svg>"""

# ─── SVG: DONUT CHART ─────────────────────────────────────────────────────────

def _polar(cx, cy, r, deg):
    rad = math.radians(deg)
    return cx + r * math.cos(rad), cy + r * math.sin(rad)

def _donut_path(cx, cy, r_out, r_in, start, end):
    large = 1 if (end - start) % 360 > 180 else 0
    x1, y1 = _polar(cx, cy, r_out, start)
    x2, y2 = _polar(cx, cy, r_out, end)
    x3, y3 = _polar(cx, cy, r_in, end)
    x4, y4 = _polar(cx, cy, r_in, start)
    return (f"M {x1:.1f} {y1:.1f} A {r_out} {r_out} 0 {large} 1 {x2:.1f} {y2:.1f} "
            f"L {x3:.1f} {y3:.1f} A {r_in} {r_in} 0 {large} 0 {x4:.1f} {y4:.1f} Z")

def render_donut(title: str, subtitle: str, counts: dict, total: int, done_only: bool = False) -> str:
    cx, cy, r_out, r_in = 170, 150, 110, 55
    order = ["KTLO", "Infrastructure", "Analysis", "Automation"]
    parts, legend = [], []
    angle = -90
    legend_x = 10
    for label in order:
        count = counts.get(label, 0)
        if count == 0:
            continue
        color = LABEL_COLORS[label]
        span = (count / total) * 360
        path = _donut_path(cx, cy, r_out, r_in, angle, angle + span)
        mid_x, mid_y = _polar(cx, cy, (r_out + r_in) / 2 + 5, angle + span / 2)
        pct = round(count / total * 100)
        parts.append(f'<path d="{path}" fill="{color}"/>')
        parts.append(f'<text x="{mid_x:.0f}" y="{mid_y:.0f}" fill="white" font-size="11" font-weight="600" text-anchor="middle">{pct}%</text>')
        short = label[:4] if label != "Infrastructure" else "Infra"
        legend.append(f'<rect x="{legend_x}" y="272" width="12" height="12" fill="{color}" rx="2"/><text x="{legend_x+16}" y="282" fill="#e2e4f0" font-size="10">{short} ({count})</text>')
        legend_x += 85
        angle += span

    center_color = "#26b96d" if done_only else "#8b91b0"
    center_label = "completed" if done_only else "issues"
    return f"""<div class="burndown-wrap" style="flex:1; min-width:300px; max-width:380px;">
  <div class="burndown-title">{_html.escape(title)}</div>
  <div class="burndown-sub">{_html.escape(subtitle)}</div>
  <svg viewBox="0 0 340 300" xmlns="http://www.w3.org/2000/svg" style="width:100%; display:block; margin:0.5rem auto 0;">
    {"".join(parts)}
    <circle cx="{cx}" cy="{cy}" r="{r_in}" fill="#1a1d27"/>
    <text x="{cx}" y="{cy-7}" fill="#e2e4f0" font-size="20" font-weight="700" text-anchor="middle">{total}</text>
    <text x="{cx}" y="{cy+8}" fill="{center_color}" font-size="10" text-anchor="middle">{center_label}</text>
    {"".join(legend)}
  </svg>
</div>"""

# ─── TAB 1: PROJECTS ──────────────────────────────────────────────────────────

PRIORITY_NAMES = {0: "No Priority", 1: "Urgent", 2: "High", 3: "Medium", 4: "Low"}

def render_project_card(project: dict, update: dict | None) -> str:
    name = _html.escape(project.get("name", ""))
    url  = project.get("url", "#")
    lead = project.get("lead") or {}
    dri  = _html.escape(lead.get("name", "Unknown"))
    priority = project.get("priority", 0)
    priority_label = PRIORITY_NAMES.get(priority, "")
    target = project.get("targetDate") or ""
    status_val = project.get("status", "")

    # Tags
    tags = [f'<span class="tag dri">DRI: {dri}</span>']
    if status_val:
        status_display = status_val.replace("inProgress", "In Progress").replace("paused", "Paused").replace("planned", "Planned").replace("completed", "Completed").replace("cancelled", "Cancelled")
        tags.append(f'<span class="tag status-develop">{_html.escape(status_display)}</span>')
    if target:
        tags.append(f'<span class="tag">Target: {_html.escape(target)}</span>')
    if priority_label and priority > 0:
        tags.append(f'<span class="tag">Priority: {priority_label}</span>')
    for lbl in (project.get("labels") or {}).get("nodes", []):
        tags.append(f'<span class="tag">{_html.escape(lbl["name"])}</span>')

    # Determine flag
    if not update:
        flag_class = "flag-no-update"
        badge = '<div class="badge-flag no-update">✗ No Update Posted</div>'
        body_html = '<p class="no-update-msg">No status update has been posted for this project.</p>'
    else:
        created_at = update.get("createdAt", "")
        stale = is_stale_update(created_at, days=8)
        late  = is_late_update(created_at)
        if stale:
            flag_class = "flag-no-update"
            badge = '<div class="badge-flag stale">✗ Stale</div>'
        elif late:
            flag_class = "flag-late"
            badge = '<div class="badge-flag late">⚠ Late Update</div>'
        else:
            flag_class = "flag-ok"
            badge = '<div class="badge-flag ok">✓ On Time</div>'

        date_display = fmt_update_date(created_at) if created_at else ""
        date_flagged = " flagged" if (late or stale) else ""
        late_note    = " (Friday — after Thu 5pm PT deadline)" if late else ""
        author = _html.escape((update.get("user") or {}).get("name", ""))
        body_text = md_to_html(update.get("body") or "")
        diff_md = (update.get("diffMarkdown") or "").strip()
        progress_note = f'\n<p class="progress-note">{_html.escape(diff_md)}</p>' if diff_md else ""

        body_html = f"""<div class="section-label">Latest Weekly Update</div>
        <div class="update-box">
          <div class="update-header">
            <span class="update-by">Posted by {author}</span>
            <span class="update-date{date_flagged}">{'⚠ ' if date_flagged else ''}{_html.escape(date_display)}{_html.escape(late_note)}</span>
          </div>
          <div class="update-text">
            {body_text}
            {progress_note}
          </div>
        </div>"""

    return f"""
    <div class="project-card {flag_class}">
      <div class="card-header">
        <div>
          <div class="card-title"><a href="{url}" target="_blank">{name}</a></div>
          <div class="card-meta">{"".join(tags)}</div>
        </div>
        {badge}
      </div>
      <div class="card-body">{body_html}</div>
    </div>"""

def render_tab1(projects: list) -> str:
    # Count flags for summary bar
    counts = {"ok": 0, "late": 0, "no_update": 0}
    for p in projects:
        u = p.get("_update")
        if not u or is_stale_update(u.get("createdAt",""), days=8):
            counts["no_update"] += 1
        elif is_late_update(u.get("createdAt","")):
            counts["late"] += 1
        else:
            counts["ok"] += 1

    cards = "\n".join(render_project_card(p, p.get("_update")) for p in projects)
    return f"""<div id="tab-projects" class="tab-pane active">
  <div class="legend" style="max-width:1100px; margin: 0 auto 1rem;">
    <div class="legend-item"><span class="dot on-track"></span> Update on time</div>
    <div class="legend-item"><span class="dot late"></span> Update posted late (after Thu 5pm PT)</div>
    <div class="legend-item"><span class="dot no-update"></span> No update / Stale (&gt;1 week)</div>
  </div>
  <div class="summary-bar">
    <div class="stat-card green"><div class="num">{counts['ok']}</div><div class="label">Updates On Time</div></div>
    <div class="stat-card orange"><div class="num">{counts['late']}</div><div class="label">Late Updates</div></div>
    <div class="stat-card red"><div class="num">{counts['no_update']}</div><div class="label">No / Stale Update</div></div>
    <div class="stat-card blue"><div class="num">{len(projects)}</div><div class="label">Total Projects</div></div>
  </div>
  <div class="flag-note">
    ⚠️ <strong>Flag rule:</strong> Updates posted after Thursday 5:00 PM PT for the relevant week are flagged as late. Dates shown in PT (PDT = UTC−7).
  </div>
  <div class="projects">{cards}</div>
</div>"""

# ─── TAB 2: TEAM & SPRINT ─────────────────────────────────────────────────────

def render_issue_row(issue: dict) -> str:
    ident  = _html.escape(issue.get("identifier", ""))
    url    = issue.get("url", "#")
    title  = _html.escape(issue.get("title", ""))
    proj   = _html.escape((issue.get("project") or {}).get("name", "—"))
    labels = classify_labels(issue)
    label_html = "".join(
        f'<span style="padding:0.1rem 0.4rem;border-radius:999px;font-size:0.7rem;'
        f'background:{LABEL_COLORS[l]}22;border:1px solid {LABEL_COLORS[l]}66;color:{LABEL_COLORS[l]};'
        f'white-space:nowrap;margin-right:0.2rem;">{l}</span>'
        for l in labels
    ) if labels else '<span style="color:var(--muted);font-size:0.75rem;">—</span>'
    return (f'<tr><td><a class="issue-link" href="{url}" target="_blank">{ident}</a></td>'
            f'<td>{title}</td><td>{state_pill(issue)}</td>'
            f'<td>{priority_html(issue.get("priority"))}</td>'
            f'<td>{pts_html(issue)}</td><td>{proj}</td><td>{label_html}</td></tr>')

def render_member_card(member: dict, issues: list) -> str:
    stats = member_stats(issues)
    display = _html.escape(member["display"])
    email   = member.get("email") or ""
    team_label = _html.escape(member["team_label"])
    note    = member.get("note", "")
    note_html = f' <span style="font-size:0.75rem; color:var(--muted); font-weight:400;">({_html.escape(note)})</span>' if note else ""

    # Email line
    email_parts = []
    if email:
        email_parts.append(_html.escape(email))
    email_parts.append(team_label)
    email_line = " &nbsp;·&nbsp; ".join(email_parts)

    # Stat badges
    pts_frac = f"{stats['done_pts']}/{stats['total_pts']}" if stats['total_pts'] else "—"
    badges = f"""<div class="member-stats">
      <div class="member-stat s-blue"><div class="s-num">{stats['total']}</div><div class="s-label">Issues</div></div>
      <div class="member-stat s-green"><div class="s-num">{stats['done']}</div><div class="s-label">Done</div></div>
      <div class="member-stat s-orange"><div class="s-num">{stats['in_progress']}</div><div class="s-label">In Progress</div></div>
      <div class="member-stat s-green"><div class="s-num">{pts_frac}</div><div class="s-label">Pts</div></div>
    </div>"""

    # Label breakdown mini-row
    active_issues = [i for i in issues if not is_canceled(i)]
    label_counts = {lbl: sum(1 for i in active_issues if lbl in classify_labels(i)) for lbl in LABEL_CATEGORIES}
    label_pills = "".join(
        f'<span style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.15rem 0.55rem;border-radius:999px;'
        f'background:{LABEL_COLORS[lbl]}22;border:1px solid {LABEL_COLORS[lbl]}66;'
        f'font-size:0.72rem;color:{LABEL_COLORS[lbl]};margin-right:0.35rem;">'
        f'<strong>{label_counts[lbl]}</strong>&nbsp;{lbl}</span>'
        for lbl in LABEL_CATEGORIES
    )
    unlabeled_count = sum(1 for i in active_issues if not classify_labels(i))
    if unlabeled_count:
        label_pills += (
            f'<span style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.15rem 0.55rem;border-radius:999px;'
            f'background:#8b91b022;border:1px solid #8b91b066;'
            f'font-size:0.72rem;color:var(--muted);margin-right:0.35rem;">'
            f'<strong>{unlabeled_count}</strong>&nbsp;Unlabeled</span>'
        )
    label_row = f'<div style="margin-top:0.6rem;margin-bottom:0.2rem;">{label_pills}</div>'

    # Issue table (all issues, canceled included but shown separately)
    sorted_issues = sorted(issues, key=lambda i: (
        0 if state_type(i) == "completed" else
        1 if state_type(i) == "started" else
        2 if state_type(i) not in ("completed","started","cancelled") else 3
    ))
    rows = "".join(render_issue_row(i) for i in sorted_issues)
    if not rows:
        rows = '<tr><td colspan="6" style="color:var(--muted); font-style:italic;">No sprint cycle issues found</td></tr>'

    # Focus line from projects
    proj_names = sorted(set(
        (i.get("project") or {}).get("name", "")
        for i in issues if (i.get("project") or {}).get("name")
    ))
    focus_html = ""
    if proj_names:
        focus_str = " &nbsp;·&nbsp; ".join(_html.escape(p) for p in proj_names[:6])
        focus_html = f'<p style="font-size:0.82rem; color:var(--muted); margin-bottom:0.8rem;">Projects: <strong>{focus_str}</strong></p>'

    return f"""      <div class="member-card">
        <div class="member-header">
          <div>
            <div class="member-name">{display}{note_html}</div>
            <div class="member-email">{email_line}</div>
            {label_row}
          </div>
          {badges}
        </div>
        <div class="member-body">
          {focus_html}
          <table class="issue-table">
            <thead><tr><th>Issue</th><th>Title</th><th>Status</th><th>Priority</th><th>Pts</th><th>Project</th><th>Label</th></tr></thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      </div>"""

def render_all_members_table(members_data: list[tuple]) -> str:
    rows = []
    for member, issues in members_data:
        stats = member_stats(issues)
        display = _html.escape(member["display"])
        team    = _html.escape(member["team_label"])
        pts_frac = f"{stats['done_pts']}/{stats['total_pts']}" if stats['total_pts'] else "—"
        active = stats['total'] > 0
        dot_class = "active-dot" if active else "inactive-dot"
        row_class = "active-row" if active else "inactive-row"
        rows.append(
            f'<tr class="{row_class}"><td><span class="{dot_class}"></span></td>'
            f'<td>{display}</td><td>{team}</td>'
            f'<td>{stats["total"]}</td><td>{stats["done"]}</td>'
            f'<td>{stats["in_progress"]}</td><td>{pts_frac}</td></tr>'
        )
    return f"""  <div class="team-section">
    <h2>All Members — Sprint Summary</h2>
    <div class="members-table-wrap">
      <table class="members-table">
        <thead><tr><th></th><th>Name</th><th>Team</th><th>Issues</th><th>Done</th><th>In Progress</th><th>Pts</th></tr></thead>
        <tbody>{"".join(rows)}</tbody>
      </table>
    </div>
  </div>"""

def render_tab2(members_data: list[tuple], unassigned_issues: list) -> str:
    today = datetime.now(timezone.utc)
    sprint_start = SPRINT["start"]
    sprint_end   = SPRINT["end"]
    sprint_day   = max(1, min(14, (today - sprint_start).days + 1))
    total_days   = (sprint_end - sprint_start).days

    # Scoped issue set: whitelisted members + unassigned only
    whitelisted = [i for _, iss in members_data for i in iss]
    scoped_all  = whitelisted + unassigned_issues

    # Aggregate stats (scoped)
    active_all = [i for i in scoped_all if not is_canceled(i)]
    done_all   = [i for i in active_all if state_type(i) == "completed"]
    ip_all     = [i for i in active_all if state_type(i) == "started"]
    todo_all   = [i for i in active_all if state_type(i) in ("unstarted","backlog","triage")]
    total_pts  = sum(get_pts(i) for i in active_all)
    done_pts   = sum(get_pts(i) for i in done_all)

    # Active contributors
    active_members = sum(1 for _, iss in members_data if any(not is_canceled(i) for i in iss))
    no_issues_members = [m["display"] for m, iss in members_data if not any(not is_canceled(i) for i in iss)]

    burndown_svg = render_burndown(total_pts, done_pts)
    member_cards = "\n".join(render_member_card(m, iss) for m, iss in members_data)
    all_members_table = render_all_members_table(members_data)

    no_issues_note = ""
    if no_issues_members:
        no_issues_note = f"Members with no sprint cycle issues: {', '.join(_html.escape(n) for n in no_issues_members)}."

    # Unassigned section
    active_unassigned = [i for i in unassigned_issues if not is_canceled(i)]
    unassigned_section = ""
    if active_unassigned:
        ua_stats = member_stats(active_unassigned)
        ua_pts_frac = f"{ua_stats['done_pts']}/{ua_stats['total_pts']}" if ua_stats['total_pts'] else "—"
        ua_badges = f"""<div class="member-stats">
      <div class="member-stat s-blue"><div class="s-num">{ua_stats['total']}</div><div class="s-label">Issues</div></div>
      <div class="member-stat s-green"><div class="s-num">{ua_stats['done']}</div><div class="s-label">Done</div></div>
      <div class="member-stat s-orange"><div class="s-num">{ua_stats['in_progress']}</div><div class="s-label">In Progress</div></div>
      <div class="member-stat s-green"><div class="s-num">{ua_pts_frac}</div><div class="s-label">Pts</div></div>
    </div>"""
        ua_sorted = sorted(active_unassigned, key=lambda i: (
            0 if state_type(i) == "completed" else
            1 if state_type(i) == "started" else
            2 if state_type(i) not in ("completed","started","cancelled") else 3
        ))
        ua_rows = "".join(render_issue_row(i) for i in ua_sorted)
        unassigned_section = f"""  <div class="team-section">
    <h2>Unassigned Sprint Issues</h2>
    <div class="member-cards">
      <div class="member-card">
        <div class="member-header">
          <div>
            <div class="member-name">Unassigned</div>
            <div class="member-email">No owner — needs triage</div>
          </div>
          {ua_badges}
        </div>
        <div class="member-body">
          <table class="issue-table">
            <thead><tr><th>Issue</th><th>Title</th><th>Status</th><th>Priority</th><th>Pts</th><th>Project</th><th>Label</th></tr></thead>
            <tbody>{ua_rows}</tbody>
          </table>
        </div>
      </div>
    </div>
  </div>"""

    return f"""<div id="tab-team" class="tab-pane">
  <div class="team-section">
    <h2>{SPRINT['name']} — All Teams (RADS-DS · RISKDS · CUSTDS · SPDS) &nbsp;·&nbsp; {SPRINT['label']} &nbsp;·&nbsp; Day {sprint_day} of {total_days}</h2>
    <p style="font-size:0.82rem; color:var(--muted); margin-bottom:1rem;">Aggregated across {active_members} active contributors. {no_issues_note}</p>
    <div class="sprint-meta-grid">
      <div class="stat-card blue"><div class="num">{len(active_all)}</div><div class="label">Total Issues</div></div>
      <div class="stat-card green"><div class="num">{len(done_all)}</div><div class="label">Completed</div></div>
      <div class="stat-card orange"><div class="num">{len(ip_all)}</div><div class="label">In Progress</div></div>
      <div class="stat-card red"><div class="num">{len(todo_all)}</div><div class="label">Not Started</div></div>
      <div class="stat-card purple"><div class="num">{done_pts} pts</div><div class="label">Pts Done</div></div>
    </div>
  </div>
  <div class="team-section">
    <div class="burndown-wrap">
      <div class="burndown-title">Sprint Burndown — Points Remaining (All Teams)</div>
      <div class="burndown-sub">{SPRINT['label']} &nbsp;·&nbsp; {total_pts} pts total scope &nbsp;·&nbsp; Today = day {sprint_day} &nbsp;·&nbsp; Current snapshot</div>
      {burndown_svg}
      <div class="burndown-legend">
        <div class="burndown-legend-item"><div class="legend-line" style="background:#26b96d"></div> Actual / projected pace</div>
        <div class="burndown-legend-item"><div class="legend-line" style="background:#8b91b0; opacity:0.5"></div> Ideal burndown</div>
        <div class="burndown-legend-item"><div class="legend-line" style="background:#5e6ad2"></div> Today (day {sprint_day})</div>
        <div class="burndown-legend-item"><div class="legend-line" style="background:#eb5757"></div> Current remaining ({total_pts - done_pts} pts)</div>
      </div>
    </div>
  </div>
  <div class="team-section">
    <h2>Active Sprint Contributors — RADS-DS · RISKDS · CUSTDS · SPDS</h2>
    <div class="member-cards">
{member_cards}
    </div>
  </div>
{all_members_table}
{unassigned_section}
</div>"""

# ─── TAB 3: WORK DISTRIBUTION ─────────────────────────────────────────────────

def render_label_table(issues: list, label: str) -> str:
    matching = [i for i in issues if label in classify_labels(i)]
    if not matching:
        return ""
    active = [i for i in matching if not is_canceled(i)]
    done_c = sum(1 for i in active if state_type(i) == "completed")
    ip_c   = sum(1 for i in active if state_type(i) == "started")
    todo_c = sum(1 for i in active if state_type(i) in ("unstarted","backlog","triage"))
    team_set = ", ".join(sorted(set(i.get("_team","") for i in matching)))
    rows = "".join(
        f'<tr><td><a class="issue-link" href="{i.get("url","#")}" target="_blank">{_html.escape(i.get("identifier",""))}</a></td>'
        f'<td>{_html.escape(i.get("title",""))}</td>'
        f'<td>{state_pill(i)}</td>'
        f'<td>{_html.escape((i.get("assignee") or {}).get("name","—"))}</td>'
        f'<td>{pts_html(i)}</td>'
        f'<td>{_html.escape(i.get("_team",""))}</td></tr>'
        for i in sorted(matching, key=lambda x: 0 if state_type(x)=="completed" else 1 if state_type(x)=="started" else 2)
    )
    return f"""  <div class="team-section">
    <h2>{label} <span style="font-size:0.85rem; font-weight:400; color:var(--muted);">— {len(active)} issues across {team_set}</span></h2>
    <div style="overflow-x:auto;">
      <table class="issue-table" style="width:100%;">
        <thead><tr><th>Issue</th><th>Title</th><th>Status</th><th>Assignee</th><th>Pts</th><th>Team</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  </div>"""

def render_tab3(all_issues: list) -> str:
    active = [i for i in all_issues if not is_canceled(i)]
    done   = [i for i in active if state_type(i) == "completed"]

    # Counts per label
    counts_all  = defaultdict(int)
    counts_done = defaultdict(int)
    for i in active:
        for lbl in classify_labels(i):
            counts_all[lbl]  += 1
    for i in done:
        for lbl in classify_labels(i):
            counts_done[lbl] += 1

    total_labeled = sum(counts_all.values())
    total_done_labeled = sum(counts_done.values())

    # Summary stat cards
    stat_cards = []
    color_map = {"Analysis":"#5e6ad2","Automation":"#26b96d","Infrastructure":"#9b59b6","KTLO":"#f29c38"}
    for lbl in LABEL_CATEGORIES:
        c = counts_all.get(lbl, 0)
        lbl_issues = [i for i in active if lbl in classify_labels(i)]
        d  = sum(1 for i in lbl_issues if state_type(i)=="completed")
        ip = sum(1 for i in lbl_issues if state_type(i)=="started")
        td = sum(1 for i in lbl_issues if state_type(i) in ("unstarted","backlog","triage"))
        dp = sum(get_pts(i) for i in lbl_issues if state_type(i)=="completed")
        tp = sum(get_pts(i) for i in lbl_issues)
        pts_str = f"{dp} / {tp} pts done" if tp else "0 pts"
        col = color_map[lbl]
        stat_cards.append(f"""      <div class="stat-card" style="border-top:3px solid {col};">
        <div class="num" style="color:{col};">{c}</div>
        <div class="label">{lbl}</div>
        <div style="font-size:0.75rem; color:var(--muted); margin-top:0.4rem;">{d} done · {ip} in-prog · {td} todo</div>
        <div style="font-size:0.75rem; color:var(--green); margin-top:0.2rem;">{pts_str}</div>
      </div>""")

    # Pie charts
    pie_sprint = render_donut(
        "Current Sprint — All Tasks",
        f"{total_labeled} labeled issues by label · {SPRINT['label']}",
        counts_all, total_labeled
    ) if total_labeled > 0 else ""
    pie_done = render_donut(
        "Current Sprint — Completed Tasks",
        f"{total_done_labeled} done issues by label",
        counts_done, total_done_labeled, done_only=True
    ) if total_done_labeled > 0 else ""

    label_tables = "\n".join(render_label_table(active, lbl) for lbl in LABEL_CATEGORIES)

    # Unlabeled section
    unlabeled = [i for i in active if not classify_labels(i)]
    unlabeled_table = ""
    if unlabeled:
        rows = "".join(
            f'<tr><td><a class="issue-link" href="{i.get("url","#")}" target="_blank">{_html.escape(i.get("identifier",""))}</a></td>'
            f'<td>{_html.escape(i.get("title",""))}</td>'
            f'<td>{state_pill(i)}</td>'
            f'<td>{_html.escape((i.get("assignee") or {}).get("name","—"))}</td>'
            f'<td>{pts_html(i)}</td>'
            f'<td>{_html.escape(i.get("_team",""))}</td></tr>'
            for i in sorted(unlabeled, key=lambda x: (x.get("_team",""), (x.get("assignee") or {}).get("name","")))
        )
        unlabeled_table = f"""  <div class="team-section">
    <h2>Unlabeled <span style="font-size:0.85rem; font-weight:400; color:var(--muted);">— {len(unlabeled)} issues with no work-type label</span></h2>
    <div style="overflow-x:auto;">
      <table class="issue-table" style="width:100%;">
        <thead><tr><th>Issue</th><th>Title</th><th>Status</th><th>Assignee</th><th>Pts</th><th>Team</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  </div>"""

    return f"""<div id="tab-labels" class="tab-pane">
  <div class="team-section">
    <h2>Work Distribution by Label — {SPRINT['name']} (All Teams)</h2>
    <p style="font-size:0.82rem; color:var(--muted); margin-bottom:1.5rem;">{total_labeled} labeled issues across all teams. Labels: <strong>Analysis</strong>, <strong>Automation</strong>, <strong>Infrastructure</strong>, <strong>KTLO</strong>. Issues may carry multiple labels.</p>
    <div class="sprint-meta-grid" style="grid-template-columns: repeat(4, 1fr);">
{"".join(stat_cards)}
    </div>
  </div>
  <div class="team-section">
    <div style="display:flex; gap:2rem; flex-wrap:wrap; justify-content:center;">
      {pie_sprint}
      {pie_done}
    </div>
    <div class="burndown-wrap" style="margin-top:0; background:none; border:none; box-shadow:none; padding:0;">
      <div style="font-size:0.78rem; color:var(--muted); text-align:center; margin-top:0.5rem;">
        Current Sprint = all in-cycle issues by label ({SPRINT['label']}) across RADS-DS, RISKDS, CUSTDS, SPDS
      </div>
    </div>
  </div>
{label_tables}
{unlabeled_table}
</div>"""

# ─── FULL HTML ─────────────────────────────────────────────────────────────────

CSS = """
    :root {
      --bg: #0f1117; --surface: #1a1d27; --surface2: #22263a; --border: #2e3250;
      --accent: #5e6ad2; --green: #26b96d; --red: #eb5757; --yellow: #f2c94c;
      --orange: #f29c38; --text: #e2e4f0; --muted: #8b91b0; --tag-bg: #2a2e4a; --purple: #9b59b6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 2rem; line-height: 1.6; }
    .tab-bar { max-width: 1100px; margin: 0 auto 1.5rem; display: flex; gap: 0.25rem; border-bottom: 2px solid var(--border); }
    .tab-btn { background: none; border: none; color: var(--muted); font-size: 0.9rem; font-weight: 500; padding: 0.6rem 1.2rem; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color 0.15s; }
    .tab-btn:hover { color: var(--text); }
    .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
    .tab-pane { display: none; }
    .tab-pane.active { display: block; }
    header { max-width: 1100px; margin: 0 auto 1.5rem; padding-bottom: 1.2rem; border-bottom: 1px solid var(--border); }
    header h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 0.3rem; }
    header p { color: var(--muted); font-size: 0.9rem; }
    .last-updated { color: var(--green); font-weight: 500; }
    .legend { display: flex; gap: 1.5rem; margin-top: 1rem; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--muted); }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot.on-track { background: var(--green); } .dot.late { background: var(--orange); } .dot.no-update { background: var(--red); }
    .summary-bar { max-width: 1100px; margin: 0 auto 1.5rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.2rem; text-align: center; }
    .stat-card .num { font-size: 2rem; font-weight: 700; line-height: 1.1; }
    .stat-card .label { font-size: 0.78rem; color: var(--muted); margin-top: 0.3rem; }
    .stat-card.green .num { color: var(--green); } .stat-card.red .num { color: var(--red); }
    .stat-card.orange .num { color: var(--orange); } .stat-card.blue .num { color: var(--accent); } .stat-card.purple .num { color: var(--purple); }
    .projects { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.2rem; }
    .project-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .project-card.flag-late { border-left: 4px solid var(--orange); }
    .project-card.flag-no-update { border-left: 4px solid var(--red); }
    .project-card.flag-ok { border-left: 4px solid var(--green); }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.1rem 1.4rem 0.8rem; gap: 1rem; }
    .card-title { font-size: 1rem; font-weight: 600; color: var(--text); }
    .card-title a { color: var(--text); text-decoration: none; }
    .card-title a:hover { color: var(--accent); }
    .card-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.4rem; align-items: center; }
    .tag { background: var(--tag-bg); color: var(--muted); font-size: 0.73rem; padding: 0.15rem 0.55rem; border-radius: 99px; border: 1px solid var(--border); white-space: nowrap; }
    .tag.status-develop { color: var(--accent); border-color: var(--accent); }
    .tag.dri { color: var(--text); }
    .badge-flag { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; font-weight: 600; white-space: nowrap; padding: 0.3rem 0.7rem; border-radius: 6px; flex-shrink: 0; }
    .badge-flag.late { background: rgba(242,156,56,0.15); color: var(--orange); border: 1px solid rgba(242,156,56,0.3); }
    .badge-flag.no-update { background: rgba(235,87,87,0.15); color: var(--red); border: 1px solid rgba(235,87,87,0.3); }
    .badge-flag.ok { background: rgba(38,185,109,0.1); color: var(--green); border: 1px solid rgba(38,185,109,0.25); }
    .badge-flag.stale { background: rgba(235,87,87,0.15); color: var(--red); border: 1px solid rgba(235,87,87,0.3); }
    .card-body { padding: 0 1.4rem 1.2rem; }
    .update-box { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 0.9rem 1rem; margin-top: 0.5rem; }
    .update-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; flex-wrap: wrap; gap: 0.4rem; }
    .update-by { font-size: 0.78rem; color: var(--muted); }
    .update-date { font-size: 0.78rem; color: var(--muted); font-family: monospace; }
    .update-date.flagged { color: var(--orange); font-weight: 600; }
    .update-text { font-size: 0.85rem; color: var(--text); line-height: 1.55; }
    .update-text p { margin-bottom: 0.4rem; }
    .update-text ul { padding-left: 1.2rem; margin: 0.3rem 0 0.6rem; }
    .update-text li { margin-bottom: 0.2rem; }
    .update-text h3 { font-size: 0.95rem; font-weight: 600; margin: 0.8rem 0 0.4rem; color: var(--text); }
    .update-text h4 { font-size: 0.85rem; font-weight: 600; margin: 0.7rem 0 0.3rem; color: var(--text); }
    .update-text hr { border: none; border-top: 1px solid var(--border); margin: 0.8rem 0; }
    .update-text ol { padding-left: 1.4rem; margin: 0.3rem 0 0.6rem; }
    .update-text ol li { margin-bottom: 0.2rem; }
    .update-text .progress-note { font-size: 0.78rem; color: var(--muted); margin-top: 0.6rem; padding-top: 0.6rem; border-top: 1px solid var(--border); }
    .no-update-msg { font-size: 0.85rem; color: var(--muted); font-style: italic; margin-top: 0.5rem; }
    .section-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 0.3rem; }
    .flag-note { max-width: 1100px; margin: 0 auto 1.5rem; background: rgba(242,156,56,0.08); border: 1px solid rgba(242,156,56,0.25); border-radius: 8px; padding: 0.7rem 1rem; font-size: 0.82rem; color: var(--orange); }
    .team-section { max-width: 1100px; margin: 0 auto 2rem; }
    .team-section h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    .sprint-meta-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .burndown-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem 1.4rem; margin-bottom: 2rem; }
    .burndown-title { font-size: 0.9rem; font-weight: 600; margin-bottom: 0.3rem; }
    .burndown-sub { font-size: 0.78rem; color: var(--muted); margin-bottom: 1rem; }
    .burndown-chart { width: 100%; height: 180px; }
    .burndown-legend { display: flex; gap: 1.5rem; margin-top: 0.8rem; flex-wrap: wrap; }
    .burndown-legend-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--muted); }
    .legend-line { width: 20px; height: 3px; border-radius: 2px; }
    .member-cards { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; }
    .member-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .member-header { display: flex; align-items: center; padding: 1rem 1.4rem; gap: 1rem; cursor: pointer; user-select: none; }
    .member-header > div:first-child { flex: 1; min-width: 0; }
    .member-header:hover { background: rgba(94,106,210,0.04); }
    .member-header .chevron { font-size: 0.65rem; color: var(--muted); transition: transform 0.2s; flex-shrink: 0; }
    .member-card.expanded .member-header .chevron { transform: rotate(90deg); }
    .member-name { font-size: 1rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .member-email { font-size: 0.78rem; color: var(--muted); margin-top: 0.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .member-stats { display: flex; gap: 0.6rem; flex-shrink: 0; flex-wrap: nowrap; }
    .member-stat { text-align: center; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 0.4rem 0.6rem; width: 76px; flex-shrink: 0; }
    .member-stat .s-num { font-size: 1.2rem; font-weight: 700; }
    .member-stat .s-label { font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; overflow-wrap: break-word; word-break: break-word; }
    .member-stat.s-green .s-num { color: var(--green); } .member-stat.s-blue .s-num { color: var(--accent); }
    .member-stat.s-orange .s-num { color: var(--orange); } .member-stat.s-red .s-num { color: var(--red); }
    .member-body { padding: 0 1.4rem 1.2rem; display: none; border-top: 1px solid var(--border); }
    .member-card.expanded .member-body { display: block; }
    .issue-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    .issue-table th { text-align: left; color: var(--muted); font-weight: 500; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .issue-table td { padding: 0.5rem 0.6rem; border-bottom: 1px solid rgba(46,50,80,0.5); vertical-align: top; }
    .issue-table tr:last-child td { border-bottom: none; }
    .issue-table tr:hover td { background: rgba(94,106,210,0.05); }
    .status-pill { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 99px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; }
    .status-pill.done { background: rgba(38,185,109,0.15); color: var(--green); }
    .status-pill.in-progress { background: rgba(94,106,210,0.15); color: var(--accent); }
    .status-pill.todo { background: rgba(242,244,248,0.08); color: var(--muted); }
    .status-pill.canceled { background: rgba(139,145,176,0.1); color: var(--muted); }
    .status-pill.blocked { background: rgba(242,156,56,0.15); color: var(--orange); }
    .priority-pill { display: inline-block; padding: 0.1rem 0.45rem; border-radius: 4px; font-size: 0.68rem; font-weight: 600; }
    .priority-pill.urgent { background: rgba(235,87,87,0.15); color: var(--red); }
    .priority-pill.high { background: rgba(242,156,56,0.15); color: var(--orange); }
    .priority-pill.medium { background: rgba(94,106,210,0.12); color: var(--accent); }
    .priority-pill.low { background: rgba(139,145,176,0.1); color: var(--muted); }
    .pts-badge { font-weight: 700; color: var(--yellow); }
    .issue-link { color: var(--accent); text-decoration: none; font-family: monospace; font-size: 0.75rem; }
    .issue-link:hover { text-decoration: underline; }
    .members-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
    .members-table th { text-align: left; color: var(--muted); font-weight: 500; padding: 0.5rem 0.8rem; border-bottom: 1px solid var(--border); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; background: var(--surface2); }
    .members-table td { padding: 0.55rem 0.8rem; border-bottom: 1px solid rgba(46,50,80,0.4); }
    .members-table tr:last-child td { border-bottom: none; }
    .members-table tr:hover td { background: rgba(94,106,210,0.04); }
    .members-table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .active-row td { color: var(--text); } .inactive-row td { color: var(--muted); }
    .active-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); display: inline-block; }
    .inactive-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border); display: inline-block; }
    @media (max-width: 700px) { .summary-bar { grid-template-columns: repeat(2, 1fr); } .sprint-meta-grid { grid-template-columns: repeat(2, 1fr); } body { padding: 1rem; } }
"""

JS = """
  function switchTab(name, btn) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    btn.classList.add('active');
  }
  document.querySelectorAll('.member-header').forEach(header => {
    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.textContent = '▶';
    header.appendChild(chevron);
    header.addEventListener('click', () => {
      header.closest('.member-card').classList.toggle('expanded');
    });
  });
"""

def render_html(tab1: str, tab2: str, tab3: str) -> str:
    now = datetime.now(PDT)
    month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    gen_date     = f"{month_names[now.month-1]} {now.day}, {now.year}"
    gen_datetime = f"{month_names[now.month-1]} {now.day}, {now.year} at {now.strftime('%-I:%M %p')} PT"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RADS Q2 2026 — Initiative Status Report</title>
  <style>{CSS}</style>
</head>
<body>

<header>
  <h1>RADS Q2 2026 — Status Dashboard</h1>
  <p>Initiative: <strong>RADS Q2 2026 initiatives</strong> &nbsp;·&nbsp; Owner: David Broesch &nbsp;·&nbsp; <span class="last-updated">&#x25CF; Last updated: {gen_datetime}</span></p>
</header>

<div class="tab-bar">
  <button class="tab-btn active" onclick="switchTab('projects', this)">Projects</button>
  <button class="tab-btn" onclick="switchTab('team', this)">Team &amp; Sprint</button>
  <button class="tab-btn" onclick="switchTab('labels', this)">Work Distribution</button>
</div>

{tab1}
{tab2}
{tab3}

<footer style="max-width:1100px; margin: 2.5rem auto 0; padding-top: 1.5rem; border-top: 1px solid var(--border); font-size: 0.78rem; color: var(--muted); text-align: center;">
  Data sourced from Linear · RADS Q2 2026 initiatives · {SPRINT['name']} ({SPRINT['label']}) · Last updated {gen_datetime}
</footer>

<script>{JS}</script>
</body>
</html>"""

# ─── BLOCKCELL DEPLOY ─────────────────────────────────────────────────────────

BLOCKCELL_SITE = "rads-sprint-dashboard"
BLOCKCELL_API  = f"https://blockcell.sqprod.co/api/v1/sites/{BLOCKCELL_SITE}/upload"

def deploy_to_blockcell(html_path: str) -> None:
    """Zip the HTML as index.html and POST to Blockcell."""
    tmp_dir = tempfile.mkdtemp()
    try:
        zip_path = os.path.join(tmp_dir, "site.zip")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(html_path, "index.html")

        boundary = "----BlockcellBoundary7f3a9b"
        with open(zip_path, "rb") as fh:
            file_data = fh.read()

        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="site.zip"\r\n'
            f"Content-Type: application/zip\r\n\r\n"
        ).encode("utf-8") + file_data + f"\r\n--{boundary}--\r\n".encode("utf-8")

        req = urllib.request.Request(
            BLOCKCELL_API,
            data=body,
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Accept": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read())
        version = result.get("version_id", result.get("id", "?"))
        print(f"\n  ✓ Deployed to Blockcell")
        print(f"    Version : {version}")
        print(f"    URL     : https://blockcell.sqprod.co/sites/{BLOCKCELL_SITE}/")
    except urllib.error.HTTPError as e:
        print(f"\n  ✗ Blockcell deploy failed: HTTP {e.code} — {e.read().decode()}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="RADS Q2 2026 Dashboard Generator")
    parser.add_argument("--deploy", action="store_true", help="Deploy to Blockcell after generating (requires WARP VPN)")
    parser.add_argument("--data-file", metavar="PATH", help="Load pre-fetched Linear data from JSON (skips API key requirement)")
    args = parser.parse_args()

    print("RADS Q2 2026 Dashboard Generator")
    print("=" * 40)

    if args.data_file:
        # Load pre-fetched data — no API key needed
        print(f"\nLoading pre-fetched data from {args.data_file}...")
        with open(args.data_file, encoding="utf-8") as f:
            saved = json.load(f)
        projects   = saved["projects"]
        all_issues = saved["all_issues"]

        # Normalize MCP field shapes that differ from direct API format
        _status_to_camel = {
            "In Progress": "inProgress", "Paused": "paused", "Planned": "planned",
            "Completed": "completed", "Cancelled": "cancelled", "Started": "inProgress",
        }
        for p in projects:
            if isinstance(p.get("priority"), dict):
                p["priority"] = p["priority"].get("value", 0)
            if isinstance(p.get("status"), dict):
                name = p["status"].get("name", "")
                p["status"] = _status_to_camel.get(name, name)

        # Deduplicate issues by id/identifier (MCP fetches can overlap across teams)
        _seen_ids: set = set()
        _deduped = []
        for _i in all_issues:
            _key = _i.get("id") or _i.get("identifier")
            if _key and _key not in _seen_ids:
                _seen_ids.add(_key)
                _deduped.append(_i)
        all_issues = _deduped
        sprint_raw = saved.get("sprint", {})
        SPRINT["name"]  = sprint_raw.get("name", "")
        SPRINT["label"] = sprint_raw.get("label", "")
        SPRINT["start"] = datetime.fromisoformat(sprint_raw["start"]) if sprint_raw.get("start") else None
        SPRINT["end"]   = datetime.fromisoformat(sprint_raw["end"])   if sprint_raw.get("end")   else None
        print(f"  {len(projects)} projects · {len(all_issues)} sprint issues")
    else:
        # 1. Fetch projects + sprint issues in parallel
        print("\nFetching projects and sprint issues in parallel...")
        with ThreadPoolExecutor(max_workers=2) as pool:
            projects_future = pool.submit(fetch_projects)
            issues_future   = pool.submit(fetch_all_sprint_issues)
            projects  = projects_future.result()
            all_issues = issues_future.result()
        print(f"  {len(projects)} projects · {len(all_issues)} sprint issues")

        # 2. Fetch status updates for all projects in parallel
        print("\nFetching status updates (parallel)...")
        fetch_updates_parallel(projects)

    # 3. Group issues by member
    members_data = []
    for member in MEMBERS:
        member_issues = [
            i for i in all_issues
            if match_member(i.get("assignee"), member)
        ]
        members_data.append((member, member_issues))

    # Unassigned issues: no assignee name, not matched to any whitelisted member
    unassigned_issues = [
        i for i in all_issues
        if not (i.get("assignee") or {}).get("name")
    ]

    # 4. Render tabs
    print("\nGenerating HTML...")
    tab1 = render_tab1(projects)
    tab2 = render_tab2(members_data, unassigned_issues)
    tab3 = render_tab3(all_issues)
    html = render_html(tab1, tab2, tab3)

    # 5. Write output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"\nDone! Dashboard written to:\n  {OUTPUT_FILE}")

    # Summary
    active = [i for i in all_issues if not is_canceled(i)]
    done   = [i for i in active if state_type(i) == "completed"]
    print(f"\nSprint snapshot: {len(active)} issues · {len(done)} done · {sum(get_pts(i) for i in done)} pts done")

    # 6. Optional Blockcell deploy
    if args.deploy:
        print("\nDeploying to Blockcell...")
        deploy_to_blockcell(OUTPUT_FILE)

if __name__ == "__main__":
    main()
