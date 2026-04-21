#!/usr/bin/env python3
"""
Snowflake metadata deep-dive for data-discovery skill.

Usage:
    python query_snowflake.py --table DATABASE.SCHEMA.TABLE [--output results.json]
    python query_snowflake.py --table SCHEMA.TABLE
    python query_snowflake.py --table TABLE_NAME

Outputs a JSON file with all metadata, or prints to stdout if --output not given.
"""

import argparse
import configparser
import json
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path


# ---------------------------------------------------------------------------
# Connection helpers
# ---------------------------------------------------------------------------

def get_connection():
    """Try multiple auth methods and return an active snowflake.connector.connect()."""
    try:
        import snowflake.connector
    except ImportError:
        print("ERROR: snowflake-connector-python not installed.", file=sys.stderr)
        print("Install via: pip install snowflake-connector-python", file=sys.stderr)
        sys.exit(1)

    # Method 1: environment variables
    account = os.environ.get("SNOWFLAKE_ACCOUNT")
    user = os.environ.get("SNOWFLAKE_USER")
    if account and user:
        password = os.environ.get("SNOWFLAKE_PASSWORD")
        private_key_path = os.environ.get("SNOWFLAKE_PRIVATE_KEY_PATH")
        if password:
            return snowflake.connector.connect(account=account, user=user, password=password)
        elif private_key_path:
            from cryptography.hazmat.backends import default_backend
            from cryptography.hazmat.primitives.serialization import load_pem_private_key
            with open(private_key_path, "rb") as f:
                private_key = load_pem_private_key(f.read(), password=None, backend=default_backend())
            from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption
            pk_bytes = private_key.private_bytes(Encoding.DER, PrivateFormat.PKCS8, NoEncryption())
            return snowflake.connector.connect(account=account, user=user, private_key=pk_bytes)
        else:
            # Try SSO (externalbrowser) — works for Block accounts
            return snowflake.connector.connect(account=account, user=user, authenticator="externalbrowser")

    # Method 2: SnowSQL config
    snowsql_config = Path.home() / ".snowsql" / "config"
    if snowsql_config.exists():
        cfg = configparser.ConfigParser()
        cfg.read(snowsql_config)
        section = "connections"
        if cfg.has_section(section):
            a = cfg.get(section, "accountname", fallback=None)
            u = cfg.get(section, "username", fallback=None)
            p = cfg.get(section, "password", fallback=None)
            if a and u:
                kwargs = {"account": a, "user": u}
                if p:
                    kwargs["password"] = p
                else:
                    kwargs["authenticator"] = "externalbrowser"
                return snowflake.connector.connect(**kwargs)

    print("ERROR: No Snowflake credentials found.", file=sys.stderr)
    print("Set SNOWFLAKE_ACCOUNT + SNOWFLAKE_USER + (SNOWFLAKE_PASSWORD or SNOWFLAKE_PRIVATE_KEY_PATH)", file=sys.stderr)
    print("Or configure ~/.snowsql/config", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------

def safe_query(cur, sql, label="query"):
    """Execute a query and return rows as list of dicts. Swallow errors gracefully."""
    try:
        cur.execute(sql)
        cols = [d[0].lower() for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    except Exception as e:
        return {"_error": str(e), "_query": label}


def serialize(obj):
    """Make datetime/date/Decimal objects JSON-serializable."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    try:
        import decimal
        if isinstance(obj, decimal.Decimal):
            return float(obj)
    except ImportError:
        pass
    return str(obj)


# ---------------------------------------------------------------------------
# Individual metadata queries
# ---------------------------------------------------------------------------

def get_table_info(cur, database, schema, table):
    db_prefix = f"{database}." if database else ""
    sql = f"""
        SELECT table_name, table_type, row_count, bytes,
               created, last_altered, comment,
               is_transient, clustering_key
        FROM {db_prefix}information_schema.tables
        WHERE table_schema ILIKE '{schema}'
          AND table_name ILIKE '{table}'
    """
    return safe_query(cur, sql, "table_info")


def get_columns(cur, database, schema, table):
    db_prefix = f"{database}." if database else ""
    sql = f"""
        SELECT column_name, ordinal_position, data_type,
               character_maximum_length, numeric_precision, numeric_scale,
               is_nullable, column_default, comment
        FROM {db_prefix}information_schema.columns
        WHERE table_schema ILIKE '{schema}'
          AND table_name ILIKE '{table}'
        ORDER BY ordinal_position
    """
    return safe_query(cur, sql, "columns")


def get_tags(cur, database, schema, table):
    """Fetch object-level and column-level tags."""
    db_prefix = f"{database}." if database else ""
    # Object tags
    sql = f"""
        SELECT tag_name, tag_value, domain
        FROM table({db_prefix}information_schema.tag_references(
            '{schema}.{table}', 'table'
        ))
    """
    return safe_query(cur, sql, "tags")


def get_privileges(cur, database, schema, table):
    fqn = f"{database}.{schema}.{table}" if database else f"{schema}.{table}"
    sql = f"""
        SELECT grantee_name, privilege, grant_option
        FROM snowflake.account_usage.grants_to_roles
        WHERE granted_on = 'TABLE'
          AND name ILIKE '{fqn}'
          AND deleted_on IS NULL
        ORDER BY privilege, grantee_name
    """
    return safe_query(cur, sql, "privileges")


def get_access_history(cur, database, schema, table):
    """Who queried this table in the last 90 days."""
    fqn = f"{database}.{schema}.{table}".upper() if database else f"{schema}.{table}".upper()
    cutoff = (datetime.utcnow() - timedelta(days=90)).strftime("%Y-%m-%d")
    sql = f"""
        SELECT
            user_name,
            role_name,
            COUNT(*) as query_count,
            MAX(query_start_time) as last_access,
            MIN(query_start_time) as first_access
        FROM snowflake.account_usage.access_history,
             LATERAL FLATTEN(base_objects_accessed) f
        WHERE f.value:objectName::STRING ILIKE '{fqn}'
          AND query_start_time >= '{cutoff}'
        GROUP BY user_name, role_name
        ORDER BY query_count DESC
        LIMIT 30
    """
    return safe_query(cur, sql, "access_history")


def get_query_samples(cur, database, schema, table):
    """Sample recent queries against this table for usage context."""
    fqn_pattern = f"%{schema}.{table}%".upper()
    cutoff = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    sql = f"""
        SELECT
            query_id, user_name, role_name, warehouse_name,
            start_time, total_elapsed_time,
            LEFT(query_text, 800) as query_text_trimmed,
            bytes_scanned, rows_produced
        FROM snowflake.account_usage.query_history
        WHERE UPPER(query_text) LIKE '{fqn_pattern}'
          AND query_type = 'SELECT'
          AND start_time >= '{cutoff}'
          AND execution_status = 'SUCCESS'
        ORDER BY start_time DESC
        LIMIT 10
    """
    return safe_query(cur, sql, "query_samples")


def get_lineage_upstream(cur, database, schema, table):
    """What feeds into this table (upstream sources)."""
    fqn = f"{database}.{schema}.{table}".upper() if database else f"{schema}.{table}".upper()
    sql = f"""
        SELECT DISTINCT
            referenced_object_name as upstream_object,
            referenced_object_type,
            referencing_object_name as this_object
        FROM snowflake.account_usage.object_dependencies
        WHERE UPPER(referencing_object_name) = '{fqn}'
        ORDER BY upstream_object
    """
    return safe_query(cur, sql, "lineage_upstream")


def get_lineage_downstream(cur, database, schema, table):
    """What this table feeds into (downstream consumers)."""
    fqn = f"{database}.{schema}.{table}".upper() if database else f"{schema}.{table}".upper()
    sql = f"""
        SELECT DISTINCT
            referencing_object_name as downstream_object,
            referencing_object_type,
            referenced_object_name as this_object
        FROM snowflake.account_usage.object_dependencies
        WHERE UPPER(referenced_object_name) = '{fqn}'
        ORDER BY downstream_object
    """
    return safe_query(cur, sql, "lineage_downstream")


def get_masking_policies(cur, database, schema, table):
    """Find columns with masking policies (PII signals)."""
    db_prefix = f"{database}." if database else ""
    sql = f"""
        SELECT column_name, masking_policy_name, expression
        FROM table({db_prefix}information_schema.policy_references(
            ref_entity_name => '{schema}.{table}',
            ref_entity_domain => 'TABLE'
        ))
        WHERE policy_kind = 'MASKING_POLICY'
    """
    return safe_query(cur, sql, "masking_policies")


def find_dbt_manifest():
    """Search common locations for a dbt manifest.json."""
    search_roots = [
        Path.home() / "development",
        Path.home() / "dbt",
        Path.cwd(),
    ]
    for root in search_roots:
        if not root.exists():
            continue
        for manifest in root.rglob("manifest.json"):
            # Quick sanity check — real manifests have a "metadata" key with dbt_schema_version
            try:
                with open(manifest) as f:
                    head = f.read(200)
                if "dbt_schema_version" in head:
                    return manifest
            except Exception:
                continue
    return None


def get_dbt_model(table_name, schema=None):
    """Look up a table in the dbt manifest by model name."""
    manifest_path = find_dbt_manifest()
    if not manifest_path:
        return {"_info": "No dbt manifest found"}

    try:
        with open(manifest_path) as f:
            manifest = json.load(f)
    except Exception as e:
        return {"_error": f"Could not parse dbt manifest: {e}"}

    results = []
    for node_id, node in manifest.get("nodes", {}).items():
        if node.get("resource_type") not in ("model", "seed", "snapshot"):
            continue
        node_schema = (node.get("schema") or "").upper()
        node_name = (node.get("name") or "").upper()
        if node_name == table_name.upper() or (schema and node_schema == schema.upper() and node_name == table_name.upper()):
            results.append({
                "node_id": node_id,
                "name": node.get("name"),
                "schema": node.get("schema"),
                "database": node.get("database"),
                "description": node.get("description"),
                "owner": node.get("config", {}).get("meta", {}).get("owner"),
                "tags": node.get("tags", []),
                "depends_on": node.get("depends_on", {}).get("nodes", []),
                "columns": {
                    col: {
                        "description": meta.get("description"),
                        "tags": meta.get("tags", []),
                    }
                    for col, meta in node.get("columns", {}).items()
                },
                "manifest_path": str(manifest_path),
            })

    return results if results else {"_info": f"No dbt model found for {table_name}"}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_object_name(name):
    """Parse DATABASE.SCHEMA.TABLE, SCHEMA.TABLE, or TABLE into parts."""
    parts = [p.strip().upper() for p in name.split(".")]
    if len(parts) == 3:
        return parts[0], parts[1], parts[2]
    elif len(parts) == 2:
        return None, parts[0], parts[1]
    else:
        return None, None, parts[0]


def main():
    parser = argparse.ArgumentParser(description="Snowflake deep metadata query")
    parser.add_argument("--table", required=True, help="DATABASE.SCHEMA.TABLE (partial ok)")
    parser.add_argument("--output", help="Write JSON to this file path")
    args = parser.parse_args()

    database, schema, table = parse_object_name(args.table)

    print(f"Connecting to Snowflake...", file=sys.stderr)
    conn = get_connection()
    cur = conn.cursor()

    print(f"Querying metadata for {'.'.join(filter(None, [database, schema, table]))}...", file=sys.stderr)

    results = {
        "subject": {
            "database": database,
            "schema": schema,
            "table": table,
            "queried_at": datetime.utcnow().isoformat(),
        },
        "table_info": get_table_info(cur, database, schema, table),
        "columns": get_columns(cur, database, schema, table),
        "tags": get_tags(cur, database, schema, table),
        "masking_policies": get_masking_policies(cur, database, schema, table),
        "privileges": get_privileges(cur, database, schema, table),
        "access_history": get_access_history(cur, database, schema, table),
        "query_samples": get_query_samples(cur, database, schema, table),
        "lineage_upstream": get_lineage_upstream(cur, database, schema, table),
        "lineage_downstream": get_lineage_downstream(cur, database, schema, table),
        "dbt": get_dbt_model(table, schema),
    }

    cur.close()
    conn.close()

    output_json = json.dumps(results, default=serialize, indent=2)

    if args.output:
        Path(args.output).write_text(output_json)
        print(f"Wrote metadata to {args.output}", file=sys.stderr)
    else:
        print(output_json)


if __name__ == "__main__":
    main()
