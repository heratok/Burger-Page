#!/usr/bin/env bash
# ============================================================================
# check-migration-drift.sh — migration drift check
#
# Proves that a production-like database that evolved ONLY through migrations
# ends up with the same schema as a fresh database built from the current
# canonical baseline (database/01_schema.sql):
#
#   1. DB "migrated": build the baseline as it was at BASE_REF (git), mark the
#      migrations that already existed at BASE_REF as applied (node-pg-migrate
#      `up --fake`), then run the new migrations with the real `up`.
#   2. DB "fresh":    apply the CURRENT database/01_schema.sql.
#   3. Compare both with database/scripts/schema-fingerprint.sql. Any
#      difference fails the script and is printed as a unified diff.
#   4. Reversibility: for every migration added since BASE_REF, run its
#      .down.sql (newest first), then `up` again, and require the schema to
#      equal the one after step 1. The state right after the downs is also
#      compared with the BASE_REF baseline (warning only, STRICT_DOWN=1 makes
#      it fatal).
#   5. Idempotency: re-apply each new .up.sql on the migrated database; the
#      schema must not change.
#
# Usage:   database/scripts/check-migration-drift.sh [BASE_REF]
# Env:     PG_BASE_URL  server URL without database name
#                       (default postgres://postgres:postgres@localhost:5432)
#          BASE_REF     same as the first argument (default origin/main)
#          STRICT_DOWN  1 = fail when the state after the downs != BASE_REF
#          KEEP_DBS     1 = do not drop the two scratch databases
# Needs:   bash, git, node + `npm ci` (node-pg-migrate), psql, a PostgreSQL 15+
#          server whose superuser PG_BASE_URL can CREATE/DROP DATABASE.
#          It does NOT use doppler and never touches a database it did not
#          create (drift_migrated / drift_fresh).
#
# Local run with Docker:
#   docker run --rm -d --name drift-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
#   database/scripts/check-migration-drift.sh origin/main
#   docker rm -f drift-pg
# ============================================================================
set -euo pipefail

BASE_REF="${1:-${BASE_REF:-origin/main}}"
PG_BASE_URL="${PG_BASE_URL:-postgres://postgres:postgres@localhost:5432}"
STRICT_DOWN="${STRICT_DOWN:-0}"
KEEP_DBS="${KEEP_DBS:-0}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
FP_SQL="$ROOT/database/scripts/schema-fingerprint.sql"
MIGRATOR="$ROOT/node_modules/node-pg-migrate/bin/node-pg-migrate.js"
# Same ignore patterns as `npm run db:migrate` (only *.up.sql are loaded).
IGNORE_UP='.*\.down\.sql|.*\.md'

DB_MIGRATED="drift_migrated"
DB_FRESH="drift_fresh"
TMP="$(mktemp -d)"

url() { printf '%s/%s' "$PG_BASE_URL" "$1"; }
psql_q() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }
fingerprint() { psql -X -A -t -q -v ON_ERROR_STOP=1 -f "$FP_SQL" "$(url "$1")"; }
migrate_up() { DATABASE_URL="$(url "$DB_MIGRATED")" node "$MIGRATOR" up -m "$1" --ignore-pattern "$IGNORE_UP" "${@:2}"; }

cleanup() {
  if [ "$KEEP_DBS" != "1" ]; then
    psql_q "$(url postgres)" -c "DROP DATABASE IF EXISTS $DB_MIGRATED WITH (FORCE)" >/dev/null 2>&1 || true
    psql_q "$(url postgres)" -c "DROP DATABASE IF EXISTS $DB_FRESH WITH (FORCE)" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

fail=0
compare() { # compare <label-a> <file-a> <label-b> <file-b> <fatal 1|0> <message>
  if diff -u --label "$1" --label "$3" "$2" "$4" >"$TMP/diff.out"; then
    echo "OK: $6 (no difference)"
  else
    echo "::group::$6 — schema difference"
    cat "$TMP/diff.out"
    echo "::endgroup::"
    if [ "$5" = "1" ]; then
      echo "FAIL: $6" >&2
      fail=1
    else
      echo "WARNING: $6" >&2
    fi
  fi
}

git rev-parse --verify --quiet "${BASE_REF}^{commit}" >/dev/null \
  || { echo "BASE_REF '$BASE_REF' is not a commit (fetch it, e.g. git fetch origin main)" >&2; exit 2; }
echo "Base ref: $BASE_REF ($(git rev-parse --short "$BASE_REF"))"

for db in "$DB_MIGRATED" "$DB_FRESH"; do
  psql_q "$(url postgres)" -c "DROP DATABASE IF EXISTS $db WITH (FORCE)" -c "CREATE DATABASE $db"
done

# ── 1. migrated database ────────────────────────────────────────────────────
git show "$BASE_REF:database/01_schema.sql" >"$TMP/base_schema.sql"
# The base baseline may still contain bare COMMITs: apply it statement by
# statement (no -1), exactly like docker-entrypoint-initdb.d does.
psql_q -f "$TMP/base_schema.sql" "$(url "$DB_MIGRATED")" >/dev/null

mkdir -p "$TMP/base_migrations"
git archive "$BASE_REF" database/migrations | tar -x -C "$TMP/base_migrations"
echo "Marking the migrations that exist at $BASE_REF as applied (--fake)..."
migrate_up "$TMP/base_migrations/database/migrations" --fake

fingerprint "$DB_MIGRATED" >"$TMP/fp_base.txt"

echo "Applying new migrations..."
migrate_up "$ROOT/database/migrations"
fingerprint "$DB_MIGRATED" >"$TMP/fp_up.txt"

# ── 2 + 3. fresh database vs migrated database ──────────────────────────────
psql_q -1 -f "$ROOT/database/01_schema.sql" "$(url "$DB_FRESH")" >/dev/null
fingerprint "$DB_FRESH" >"$TMP/fp_fresh.txt"
compare "migrations(base+up)" "$TMP/fp_up.txt" "fresh(01_schema.sql)" "$TMP/fp_fresh.txt" 1 \
  "migrated schema equals the current 01_schema.sql"

# ── new migrations since BASE_REF (newest first) ────────────────────────────
git ls-tree --name-only "$BASE_REF" database/migrations/ | xargs -r -n1 basename | sort >"$TMP/base_files.txt" || true
(cd database/migrations && printf '%s\n' *.up.sql | sort) >"$TMP/head_files.txt"
comm -13 "$TMP/base_files.txt" "$TMP/head_files.txt" | sort -r >"$TMP/new_up_files.txt"
echo "New migrations since $BASE_REF (newest first):"
cat "$TMP/new_up_files.txt"

if [ ! -s "$TMP/new_up_files.txt" ]; then
  echo "No new migrations: reversibility and idempotency checks skipped."
  [ "$fail" = "0" ] || exit 1
  exit 0
fi

# ── 4. reversibility: down (newest first) -> up again ───────────────────────
while read -r up_file; do
  name="${up_file%.sql}"                 # recorded name, e.g. 0000000000007_x.up
  down_file="database/migrations/${up_file%.up.sql}.down.sql"
  [ -f "$down_file" ] || { echo "FAIL: missing $down_file" >&2; exit 1; }
  echo "Down: $up_file"
  psql_q -1 -f "$down_file" -c "DELETE FROM public.pgmigrations WHERE name = '$name'" "$(url "$DB_MIGRATED")"
done <"$TMP/new_up_files.txt"

fingerprint "$DB_MIGRATED" >"$TMP/fp_down.txt"
compare "base baseline" "$TMP/fp_base.txt" "after downs" "$TMP/fp_down.txt" "$STRICT_DOWN" \
  "schema after the downs equals the $BASE_REF baseline"

echo "Up again after the downs..."
migrate_up "$ROOT/database/migrations"
fingerprint "$DB_MIGRATED" >"$TMP/fp_up2.txt"
compare "first up" "$TMP/fp_up.txt" "down+up" "$TMP/fp_up2.txt" 1 \
  "down then up reproduces the same schema"

# ── 5. idempotency: re-applying each new up file changes nothing ────────────
while read -r up_file; do
  echo "Re-applying: $up_file"
  psql_q -1 -f "database/migrations/$up_file" "$(url "$DB_MIGRATED")"
done <"$TMP/new_up_files.txt"
fingerprint "$DB_MIGRATED" >"$TMP/fp_up3.txt"
compare "first up" "$TMP/fp_up.txt" "re-applied up" "$TMP/fp_up3.txt" 1 \
  "re-applying the new migrations is idempotent"

[ "$fail" = "0" ] || exit 1
echo "Migration drift check passed."
