#!/usr/bin/env python3
"""Regression guard for the 2026-11-10 change: the public (anon) role may SELECT exactly 21 columns of public.scans.

Exits 0 only when BOTH hold:
  1. EFFECTIVE privileges in the database (PUBLIC and inherited roles count) equal the allowlist, column by column, and anon
     holds no write privilege on the table or on any of its columns.
  2. Real requests with the public key: the page-shaped read returns exactly one row carrying the 21 columns (positive control,
     proves the key is valid), the build listing returns a non-empty list of slugs, and every other column of the table plus a
     star select is refused with PostgreSQL error 42501 (permission denied).
Any transport error, non-JSON body or unexpected shape is a failure. Prints no key.

Config (env): SUPABASE_REF, SCAN_PAGE_URL (a live scan page to take the public key from), SCAN_SLUG (a complete slug).
The database part needs the Supabase CLI token in the macOS keychain.
Run after any schema-wide grant, table re-creation or migration that touches public.scans.
"""
import base64
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

REF = os.environ.get("SUPABASE_REF", "bjbvqvzbzczjbatgmccb")
PAGE = os.environ.get("SCAN_PAGE_URL", "https://inboundonsteroids.com/scan/dr-sami-k-9c/")
SLUG = os.environ.get("SCAN_SLUG", "dr-sami-k-9c")
ALLOW = [
    "id", "company_slug", "domain", "status", "created_at", "completed_at",
    "company_name", "company_size", "revenue_range", "domain_age_years", "email_infra", "logo_url",
    "anthropic_verified", "openai_verified", "automation_score", "automation_grade",
    "top_gap_title", "top_gap_summary", "report_url", "report_json", "matched_offer",
]
PRIV_SQL = """
select
  coalesce(jsonb_agg(a.attname order by a.attnum), '[]'::jsonb) as all_columns,
  coalesce(jsonb_agg(a.attname order by a.attnum)
           filter (where has_column_privilege('anon', c.oid, a.attnum, 'SELECT')), '[]'::jsonb) as readable,
  has_any_column_privilege('anon', c.oid, 'INSERT') as can_insert,
  has_any_column_privilege('anon', c.oid, 'UPDATE') as can_update,
  has_table_privilege('anon', c.oid, 'DELETE') as can_delete,
  has_table_privilege('anon', c.oid, 'TRUNCATE') as can_truncate
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
where n.nspname = 'public' and c.relname = 'scans'
group by c.oid
"""

failures = []


def bad(msg):
    failures.append(msg)
    print("FAIL " + msg)


def ok(msg):
    print("ok   " + msg)


def http(url, headers=None, data=None, timeout=60):
    """Returns (status, body_text). Raises on transport failure or a truncated body."""
    req = urllib.request.Request(url, headers=headers or {}, data=data)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:  # a real HTTP answer with an error status
        return e.code, e.read().decode("utf-8", "replace")


def check_database():
    try:
        raw = subprocess.run(["security", "find-generic-password", "-s", "Supabase CLI", "-w"],
                             capture_output=True, text=True, check=True).stdout.strip()
        token = base64.b64decode(raw.replace("go-keyring-base64:", "", 1)).decode()
    except Exception:
        return bad("db: no Supabase CLI token in the keychain"), None
    try:
        status, body = http("https://api.supabase.com/v1/projects/%s/database/query" % REF,
                            {"Authorization": "Bearer " + token, "Content-Type": "application/json"},
                            json.dumps({"query": PRIV_SQL}).encode())
        rows = json.loads(body)
    except Exception as e:
        return bad("db: request failed (%s)" % type(e).__name__), None
    if status not in (200, 201) or not isinstance(rows, list) or len(rows) != 1:
        return bad("db: unexpected answer (HTTP %s)" % status), None
    row = rows[0]
    readable, every = row.get("readable"), row.get("all_columns")
    if not isinstance(readable, list) or not isinstance(every, list) or not every:
        return bad("db: unexpected answer shape"), None
    extra = [c for c in readable if c not in ALLOW]
    missing = [c for c in ALLOW if c not in readable]
    good = True
    if extra:
        bad("db: anon can read extra columns: %s" % json.dumps(extra)); good = False
    if missing:
        bad("db: anon lost page columns: %s" % json.dumps(missing)); good = False
    for flag, label in (("can_insert", "INSERT"), ("can_update", "UPDATE"), ("can_delete", "DELETE"), ("can_truncate", "TRUNCATE")):
        if row.get(flag) is not False:
            bad("db: anon holds %s on scans (table or column level)" % label); good = False
    if good:
        ok("db: anon effective SELECT = the 21 allowlisted columns; no write privilege at table or column level")
    return None, every


def public_key():
    status, html = http(PAGE)
    if status != 200:
        raise RuntimeError("page HTTP %s" % status)
    m = re.search(r"/scan/assets/index-[A-Za-z0-9_-]+\.js", html)
    if not m:
        raise RuntimeError("no bundle reference in the page")
    origin = "{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(PAGE))
    status, js = http(origin + m.group(0))
    if status != 200:
        raise RuntimeError("bundle HTTP %s" % status)
    for t in re.findall(r"eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}", js):
        try:
            payload = json.loads(base64.urlsafe_b64decode(t.split(".")[1] + "=="))
        except Exception:
            continue
        if payload.get("role") == "anon":
            return t
    raise RuntimeError("no anon key in the bundle")


def check_rest(every_column):
    try:
        key = public_key()
    except Exception as e:
        return bad("rest: could not read the public key from %s (%s)" % (PAGE, e))
    base = "https://%s.supabase.co/rest/v1/scans?" % REF
    headers = {"apikey": key, "Authorization": "Bearer " + key}

    def get(query):
        status, body = http(base + query, headers)
        return status, json.loads(body)

    # positive control: the exact page read
    try:
        status, data = get("select=%s&company_slug=eq.%s&status=eq.complete" % (",".join(ALLOW), urllib.parse.quote(SLUG)))
        if status == 200 and isinstance(data, list) and len(data) == 1 and all(c in data[0] for c in ALLOW):
            ok("rest: page-shaped read returns 1 row with the 21 columns (key valid)")
        else:
            bad("rest: page-shaped read gave HTTP %s, %s" % (status, "%d rows" % len(data) if isinstance(data, list) else "non-list body"))
    except Exception as e:
        bad("rest: page-shaped read failed (%s)" % type(e).__name__)
    # build listing
    try:
        status, data = get("select=company_slug&status=eq.complete&limit=3")
        if status == 200 and isinstance(data, list) and data and all(isinstance(r, dict) and r.get("company_slug") for r in data):
            ok("rest: build listing returns slugs")
        else:
            bad("rest: build listing gave HTTP %s with no usable rows" % status)
    except Exception as e:
        bad("rest: build listing failed (%s)" % type(e).__name__)
    # every other column of the table, taken from the database, must be refused with 42501
    excluded = [c for c in (every_column or []) if c not in ALLOW]
    if not excluded:
        return bad("rest: no excluded-column list from the database, cannot test refusals")
    refused = 0
    for col in excluded + ["*"]:
        try:
            status, data = get("select=%s&limit=1" % urllib.parse.quote('"%s"' % col if col != "*" else "*", safe='*"'))
            if isinstance(data, dict) and data.get("code") == "42501":
                refused += 1
            else:
                bad("rest: %s not refused with 42501 (HTTP %s)" % (json.dumps(col), status))
        except Exception as e:
            bad("rest: probe of %s failed (%s)" % (json.dumps(col), type(e).__name__))
    if refused == len(excluded) + 1:
        ok("rest: all %d excluded columns and the star select refused with 42501" % len(excluded))


_, columns = check_database()
check_rest(columns)
print("PASS" if not failures else "FAILED (%d)" % len(failures))
sys.exit(0 if not failures else 1)
