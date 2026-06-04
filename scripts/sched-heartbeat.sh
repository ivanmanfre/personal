#!/bin/bash
# sched-heartbeat.sh — wraps a scheduled job, runs it, then fire-and-forget reports
# the run to Supabase scheduled_run_log. NEVER blocks or alters the wrapped job:
# the real command runs first and its exit code is always preserved.
#
# Usage (in launchd ProgramArguments / crontab):
#   /Users/ivanmanfredi/.claude/lib/sched-heartbeat.sh <job_key> -- <command> [args...]
#
# Reads SCHED_SUPABASE_URL + SCHED_SUPABASE_KEY from sched-heartbeat.env (chmod 600).

JOB_KEY="$1"; shift
[ "$1" = "--" ] && shift

ENV_FILE="$HOME/.claude/lib/sched-heartbeat.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

START="$(/bin/date -u +%Y-%m-%dT%H:%M:%SZ)"

# --- run the real command (highest priority; never gated by reporting) ---
"$@"
RC=$?

END="$(/bin/date -u +%Y-%m-%dT%H:%M:%SZ)"
STATUS=$([ "$RC" -eq 0 ] && echo success || echo error)

# --- report the run (synchronous + time-boxed; runs AFTER the real command, so it
# only delays the wrapper's exit, never the job's work. Synchronous because launchd
# reaps the job's process group on exit, which would kill a backgrounded curl.) ---
if [ -n "$SCHED_SUPABASE_URL" ] && [ -n "$SCHED_SUPABASE_KEY" ]; then
  /usr/bin/curl -s -m 8 -X POST "$SCHED_SUPABASE_URL/rest/v1/scheduled_run_log" \
    -H "apikey: $SCHED_SUPABASE_KEY" \
    -H "Authorization: Bearer $SCHED_SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"job_key\":\"$JOB_KEY\",\"status\":\"$STATUS\",\"started_at\":\"$START\",\"finished_at\":\"$END\",\"exit_code\":$RC}" \
    >/dev/null 2>&1 || true
fi

exit $RC
