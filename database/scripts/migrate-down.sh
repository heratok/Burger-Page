#!/usr/bin/env bash
# ============================================================================
# migrate-down.sh — revert the LAST applied migration (one per run).
#
# node-pg-migrate 9 records .sql migrations by file name without ".sql", so the
# applied names end in ".up" (e.g. 0000000000007_schema_integrity.up) and its
# own `down` action cannot find the matching *.down.sql. This script reads the
# last row of pgmigrations, runs database/migrations/<name>.down.sql and deletes
# the row, both in ONE transaction.
#
# Usage:  DATABASE_URL=postgres://... database/scripts/migrate-down.sh
#         npm run db:migrate:down      (wraps it with doppler)
# Needs:  bash, psql on PATH.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG_DIR="$ROOT/database/migrations"

command -v psql >/dev/null 2>&1 \
  || { echo "ERROR: psql not found on PATH. Install the PostgreSQL client (e.g. postgresql-client)." >&2; exit 1; }
[ -n "${DATABASE_URL:-}" ] \
  || { echo "ERROR: DATABASE_URL is not set." >&2; exit 1; }

last="$(psql -X -A -t -q -v ON_ERROR_STOP=1 "$DATABASE_URL" \
  -c "SELECT name FROM public.pgmigrations ORDER BY run_on DESC, id DESC LIMIT 1")"

[ -n "$last" ] || { echo "ERROR: pgmigrations is empty; nothing to revert." >&2; exit 1; }
case "$last" in
  *.up) ;;
  *) echo "ERROR: last applied migration '$last' does not end in '.up'; refusing to guess its down file." >&2; exit 1 ;;
esac
# The name ends up inside a SQL literal: accept only file-name characters.
case "$last" in
  *[!A-Za-z0-9_.-]*) echo "ERROR: unexpected characters in migration name '$last'." >&2; exit 1 ;;
esac

down_file="$MIG_DIR/${last%.up}.down.sql"
[ -f "$down_file" ] \
  || { echo "ERROR: down file not found: database/migrations/${last%.up}.down.sql" >&2; exit 1; }

echo "Reverting: $last"
echo "  using:   database/migrations/${last%.up}.down.sql"
psql -X -q -v ON_ERROR_STOP=1 -1 \
  -f "$down_file" \
  -c "DELETE FROM public.pgmigrations WHERE name = '$last'" \
  "$DATABASE_URL"
echo "Reverted:  $last"
