#!/usr/bin/env python3
"""
Deep Slack search for data-discovery skill.

Searches Slack for mentions of a Snowflake table/dataset, identifies which channels
discuss it most, pulls deep message history from top channels, and surfaces likely
subject-matter experts.

Usage:
    python search_slack.py --query "SCHEMA.TABLE_NAME" [--output results.json]
    python search_slack.py --query "txn_events" --schema "RISK"

Reads credentials from:
  - Env vars: SLACK_MCP_XOXP_TOKEN, SLACK_MCP_WORKSPACE_TEAM_ID
  - Fallback: reads /Users/dbroesch/development/mcp-credentials.md and parses the token
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


TEAM_ID = "T01H5TZGHUJ"
MAX_SEARCH_PAGES = 5
SEARCH_PAGE_SIZE = 20  # Slack search.messages max per page
HISTORY_LIMIT = 50     # Messages to pull from top channels
RATE_LIMIT_SLEEP = 1.5


def get_credentials():
    token = os.environ.get("SLACK_MCP_XOXP_TOKEN")
    team_id = os.environ.get("SLACK_MCP_WORKSPACE_TEAM_ID", TEAM_ID)

    if not token:
        # Try parsing credentials file
        creds_path = Path("/Users/dbroesch/development/mcp-credentials.md")
        if creds_path.exists():
            text = creds_path.read_text()
            m = re.search(r"SLACK_MCP_XOXP_TOKEN=(xoxp-\S+)", text)
            if m:
                token = m.group(1)

    if not token:
        print("ERROR: No Slack token found.", file=sys.stderr)
        print("Set SLACK_MCP_XOXP_TOKEN env var or configure mcp-credentials.md", file=sys.stderr)
        sys.exit(1)

    return token, team_id


def slack_get(token, method, params=None):
    """Call a Slack Web API method. Returns parsed JSON."""
    url = f"https://slack.com/api/{method}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def slack_post(token, method, data):
    """POST to Slack Web API (for search which requires POST)."""
    url = f"https://slack.com/api/{method}"
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(
        url, data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/x-www-form-urlencoded",
        }
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def search_messages(token, team_id, query, max_pages=MAX_SEARCH_PAGES):
    """Paginate through search.messages results."""
    all_messages = []
    page = 1

    while page <= max_pages:
        try:
            result = slack_post(token, "search.messages", {
                "query": query,
                "team_id": team_id,
                "count": SEARCH_PAGE_SIZE,
                "page": page,
                "sort": "timestamp",
                "sort_dir": "desc",
            })
        except Exception as e:
            print(f"Search page {page} failed: {e}", file=sys.stderr)
            break

        if not result.get("ok"):
            print(f"Search error: {result.get('error')}", file=sys.stderr)
            break

        messages = result.get("messages", {}).get("matches", [])
        if not messages:
            break

        for msg in messages:
            all_messages.append({
                "channel_id": msg.get("channel", {}).get("id"),
                "channel_name": msg.get("channel", {}).get("name"),
                "user": msg.get("username") or msg.get("user"),
                "user_id": msg.get("user"),
                "timestamp": msg.get("ts"),
                "text": (msg.get("text") or "")[:400],
                "permalink": msg.get("permalink"),
                "datetime": datetime.fromtimestamp(float(msg["ts"])).isoformat() if msg.get("ts") else None,
            })

        pagination = result.get("messages", {}).get("pagination", {})
        total_pages = pagination.get("page_count", 1)
        if page >= total_pages:
            break

        page += 1
        time.sleep(RATE_LIMIT_SLEEP)

    return all_messages


def get_channel_history(token, team_id, channel_id, channel_name, query_terms, limit=HISTORY_LIMIT):
    """Pull recent messages from a channel and filter for query mentions."""
    try:
        result = slack_get(token, "conversations.history", {
            "channel": channel_id,
            "team_id": team_id,
            "limit": limit,
        })
    except Exception as e:
        return {"_error": str(e), "channel": channel_name}

    if not result.get("ok"):
        err = result.get("error", "unknown")
        if err == "not_in_channel":
            return {"_error": "not_in_channel", "channel": channel_name}
        return {"_error": err, "channel": channel_name}

    matched = []
    for msg in result.get("messages", []):
        text = (msg.get("text") or "").upper()
        if any(term.upper() in text for term in query_terms):
            matched.append({
                "user": msg.get("user"),
                "timestamp": msg.get("ts"),
                "text": (msg.get("text") or "")[:400],
                "datetime": datetime.fromtimestamp(float(msg["ts"])).isoformat() if msg.get("ts") else None,
            })

    return {
        "channel_id": channel_id,
        "channel_name": channel_name,
        "messages_scanned": len(result.get("messages", [])),
        "matched_messages": matched,
    }


def find_related_channels(token, team_id, search_terms):
    """Find channels whose names relate to the search terms (schema/domain keywords)."""
    related = []
    cursor = None
    pages_scanned = 0

    while pages_scanned < 3:  # limit to 3 pages for channel search
        params = {
            "team_id": team_id,
            "limit": 1000,
            "exclude_archived": "true",
        }
        if cursor:
            params["cursor"] = cursor

        try:
            result = slack_get(token, "conversations.list", params)
        except Exception as e:
            print(f"conversations.list failed: {e}", file=sys.stderr)
            break

        if not result.get("ok"):
            break

        for ch in result.get("channels", []):
            name = ch.get("name", "").lower()
            if any(term.lower() in name for term in search_terms):
                related.append({
                    "id": ch.get("id"),
                    "name": name,
                    "num_members": ch.get("num_members", 0),
                    "purpose": (ch.get("purpose") or {}).get("value", ""),
                    "topic": (ch.get("topic") or {}).get("value", ""),
                })

        meta = result.get("response_metadata", {})
        cursor = meta.get("next_cursor")
        if not cursor:
            break

        pages_scanned += 1
        time.sleep(RATE_LIMIT_SLEEP)

    return sorted(related, key=lambda x: x["num_members"], reverse=True)


def resolve_user_names(token, team_id, user_ids):
    """Look up display names for a set of user IDs."""
    names = {}
    for uid in user_ids:
        if not uid:
            continue
        try:
            result = slack_get(token, "users.info", {"user": uid, "team_id": team_id})
            if result.get("ok"):
                profile = result["user"].get("profile", {})
                names[uid] = profile.get("display_name") or profile.get("real_name") or uid
        except Exception:
            names[uid] = uid
        time.sleep(0.3)
    return names


def identify_experts(all_messages):
    """
    Score users by how likely they are to be subject-matter experts.
    Heuristic: users who appear in thread replies or send longer messages are
    more likely answering questions than asking them.
    """
    user_counts = Counter()
    user_message_lengths = defaultdict(list)

    for msg in all_messages:
        uid = msg.get("user_id") or msg.get("user")
        if uid:
            user_counts[uid] += 1
            user_message_lengths[uid].append(len(msg.get("text", "")))

    # Score = count * avg_message_length (longer messages = more likely to be answers)
    scores = {}
    for uid, count in user_counts.most_common(20):
        avg_len = sum(user_message_lengths[uid]) / len(user_message_lengths[uid])
        scores[uid] = {"count": count, "avg_message_length": round(avg_len), "score": count * avg_len}

    return sorted(scores.items(), key=lambda x: x[1]["score"], reverse=True)[:10]


def main():
    parser = argparse.ArgumentParser(description="Deep Slack search for a Snowflake table/dataset")
    parser.add_argument("--query", required=True, help="Table name or DATABASE.SCHEMA.TABLE")
    parser.add_argument("--schema", help="Schema name for broader channel search")
    parser.add_argument("--output", help="Write JSON to this path")
    args = parser.parse_args()

    token, team_id = get_credentials()

    # Build search terms: the table name + schema + any dot-separated components
    raw_terms = [args.query]
    parts = args.query.upper().split(".")
    raw_terms.extend(parts)
    if args.schema:
        raw_terms.append(args.schema.upper())
    search_terms = list(dict.fromkeys(t for t in raw_terms if len(t) > 2))  # dedupe, skip tiny

    print(f"Searching Slack for: {search_terms}", file=sys.stderr)

    # Step 1: Search messages
    print("  Step 1: Searching messages...", file=sys.stderr)
    all_messages = []
    for term in search_terms[:2]:  # search top 2 terms to avoid rate limits
        msgs = search_messages(token, team_id, term)
        all_messages.extend(msgs)
        time.sleep(RATE_LIMIT_SLEEP)

    # Deduplicate by permalink
    seen = set()
    unique_messages = []
    for m in all_messages:
        key = m.get("permalink") or m.get("timestamp")
        if key not in seen:
            seen.add(key)
            unique_messages.append(m)

    # Step 2: Find top channels from search results
    channel_counts = Counter(m["channel_name"] for m in unique_messages if m.get("channel_name"))
    top_channels_from_search = [
        {"name": name, "hit_count": count}
        for name, count in channel_counts.most_common(10)
    ]

    # Step 3: Find related channels by name
    print("  Step 2: Finding related channels by name...", file=sys.stderr)
    # Use schema/domain keywords for channel name search
    channel_search_terms = [p.lower() for p in parts if len(p) > 3]
    if args.schema:
        channel_search_terms.append(args.schema.lower())
    # Add common data channel patterns
    channel_search_terms.extend(["data-eng", "data-platform", "analytics"])
    related_channels = find_related_channels(token, team_id, channel_search_terms[:5])

    # Step 4: Deep-dive top 2 channels
    print("  Step 3: Deep-diving top channels...", file=sys.stderr)
    # Combine: channels from search results + related channels, pick top 2 by relevance
    channel_id_map = {}
    for msg in unique_messages:
        if msg.get("channel_id") and msg.get("channel_name"):
            channel_id_map[msg["channel_name"]] = msg["channel_id"]

    deep_dive_targets = []
    for ch_name, _ in channel_counts.most_common(2):
        cid = channel_id_map.get(ch_name)
        if cid:
            deep_dive_targets.append({"id": cid, "name": ch_name})

    deep_dive_results = []
    for ch in deep_dive_targets:
        print(f"    Pulling history from #{ch['name']}...", file=sys.stderr)
        result = get_channel_history(token, team_id, ch["id"], ch["name"], search_terms)
        deep_dive_results.append(result)
        time.sleep(RATE_LIMIT_SLEEP)

    # Step 5: Identify experts
    print("  Step 4: Identifying experts...", file=sys.stderr)
    expert_scores = identify_experts(unique_messages)
    expert_user_ids = [uid for uid, _ in expert_scores]
    expert_names = resolve_user_names(token, team_id, expert_user_ids[:10])

    experts = [
        {
            "user_id": uid,
            "display_name": expert_names.get(uid, uid),
            "message_count": info["count"],
            "avg_message_length": info["avg_message_length"],
        }
        for uid, info in expert_scores
    ]

    output = {
        "query": args.query,
        "search_terms": search_terms,
        "queried_at": datetime.utcnow().isoformat(),
        "total_messages_found": len(unique_messages),
        "messages": unique_messages[:50],  # cap at 50 for output size
        "top_channels_by_hits": top_channels_from_search,
        "related_channels_by_name": related_channels[:10],
        "deep_dive_channels": deep_dive_results,
        "experts": experts,
    }

    output_json = json.dumps(output, indent=2)

    if args.output:
        Path(args.output).write_text(output_json)
        print(f"Wrote Slack results to {args.output}", file=sys.stderr)
    else:
        print(output_json)


if __name__ == "__main__":
    main()
