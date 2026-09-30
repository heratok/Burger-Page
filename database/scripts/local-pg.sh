#!/usr/bin/env bash
# =============================================================================
# local-pg.sh — Portable PostgreSQL for local tests and dev (no Docker, no sudo)
# -----------------------------------------------------------------------------
# Installs official Debian PostgreSQL binaries into $HOME (via `apt-get download`
# + `dpkg-deb -x`, without touching the system), initializes a reusable cluster,
# and manages its lifecycle. It is the drop-in replacement for the
# `postgres-test` docker-compose service on machines without Docker.
#
# Usage:
#   ./local-pg.sh setup                # install + init + start + create test/dev DBs
#   ./local-pg.sh start|stop|status    # cluster lifecycle
#   ./local-pg.sh create-db <name>     # create DB + apply 01_schema.sql + 02_seed.sql
#   ./local-pg.sh install              # fetch/extract binaries only
#   ./local-pg.sh init                 # initdb + config (safe if already initialized)
#
# Env overrides: PGROOT, PGDATA, PGPORT, PGUSER, PGPASS, PGVER
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PGROOT="${PGROOT:-$HOME/.local/pg}"
PGVER="${PGVER:-15}"
PGBIN="$PGROOT/usr/lib/postgresql/$PGVER/bin"
PGDATA="${PGDATA:-$HOME/pgtest/data}"
PGLOG="${PGDATA%/*}/server.log"
PGTMP="${PGDATA%/*}/tmp"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGPASS="${PGPASS:-postgres}"
APTLISTS="/tmp/local-pg-aptlists"
APTARCHIVE="/tmp/local-pg-aptarchive"

# Multiarch lib dirs produced by dpkg-deb -x of the Debian packages.
export LD_LIBRARY_PATH="$PGROOT/lib/x86_64-linux-gnu:$PGROOT/usr/lib/x86_64-linux-gnu:$PGROOT/usr/lib/postgresql/$PGVER/lib"

# Shared libraries the server/client need beyond the base image.
DEBIAN_DEPS=(
  "postgresql-$PGVER" "postgresql-client-$PGVER" "libpq5"
  "postgresql-common" "postgresql-client-common"
  "libxml2" "libicu72" "liblz4-1" "libzstd1" "libsystemd0" "libxslt1.1"
  "libpam0g" "libsqlite3-0" "libreadline8" "libtinfo6"
)

log()  { printf '\033[1;34m[local-pg]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[local-pg]\033[0m warning: %s\n' "$*"; }
die()  { printf '\033[1;31m[local-pg]\033[0m error: %s\n' "$*" >&2; exit 1; }

require_repo_root() {
  [ -f "$REPO_ROOT/database/01_schema.sql" ] || \
    die "repo layout not found ($REPO_ROOT/database/01_schema.sql missing)"
}

install_binaries() {
  if [ -x "$PGBIN/postgres" ]; then
    log "binaries already present at $PGBIN"
    return 0
  fi
  command -v apt-get >/dev/null || die "apt-get not found (only Debian/Ubuntu are supported)"
  log "downloading PostgreSQL $PGVER binaries (apt-get download, no install)..."
  mkdir -p "$APTLISTS/partial" "$APTARCHIVE/partial"
  apt-get -o "Dir::State::lists=$APTLISTS" -o "Dir::Cache::archives=$APTARCHIVE" \
    download "${DEBIAN_DEPS[@]}" >/dev/null
  mkdir -p "$PGROOT"
  for deb in ./*.deb; do
    [ -e "$deb" ] || continue
    dpkg-deb -x "$deb" "$PGROOT"
    rm -f "$deb"
  done
  [ -x "$PGBIN/postgres" ] || die "postgres binary missing after extraction; check the DEBIAN_DEPS list"
  echo "--- missing shared libraries (should be empty) ---"
  ldd "$PGBIN/postgres" | grep -i "not found" || true
  ldd "$PGBIN/psql" | grep -i "not found" || true
  log "installed: $($PGBIN/postgres --version)"
}

init_cluster() {
  [ -x "$PGBIN/initdb" ] || die "binaries not installed yet (run install or setup first)"
  if [ -f "$PGDATA/PG_VERSION" ]; then
    log "cluster already initialized at $PGDATA"
    return 0
  fi
  mkdir -p "$PGDATA" "$PGTMP"
  printf '%s\n' "$PGPASS" > "$PGTMP/pwfile"
  log "running initdb (-U $PGUSER, scram-sha-256)..."
  "$PGBIN/initdb" -D "$PGDATA" -U "$PGUSER" -A scram-sha-256 \
    --pwfile="$PGTMP/pwfile" --encoding=UTF8 --locale=C.UTF-8 >/dev/null
  rm -f "$PGTMP/pwfile"
  mkdir -p "$PGDATA/conf.d"
  cat > "$PGDATA/conf.d/local-pi.conf" <<EOF
listen_addresses = '127.0.0.1'
unix_socket_directories = '$PGTMP'
port = $PGPORT
# jit = off: the official Debian server binary ships llvmjit.so but depends on
# libLLVM-14, which we intentionally do not extract into the portable tree; the
# planner would otherwise JIT-compile some queries and fail to load llvmjit.so.
jit = off
EOF
  log "configured (listen 127.0.0.1:$PGPORT, socket in $PGTMP)"
}

start_server() {
  [ -x "$PGBIN/pg_ctl" ] || die "binaries not installed yet (run install or setup first)"
  if "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    log "already running"
    return 0
  fi
  if (command -v ss >/dev/null && ss -tln | grep -q ":$PGPORT ") || \
     (command -v pg_isready >/dev/null && "$PGBIN/pg_isready" -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1); then
    warn "port $PGPORT is occupied by another server; refusing to start"
    return 1
  fi
  mkdir -p "${PGLOG%/*}"
  log "starting server (log: $PGLOG)..."
  "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGLOG" -w start >/dev/null
}

stop_server() {
  [ -x "$PGBIN/pg_ctl" ] || die "binaries not installed yet"
  "$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop >/dev/null 2>&1 || true
  log "stopped"
}

status_server() {
  if [ -x "$PGBIN/pg_ctl" ] && "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    "$PGBIN/pg_ctl" -D "$PGDATA" status
    PGPASSWORD="$PGPASS" "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" -d postgres \
      -tAc "SELECT 'server ok: ' || version();"
  else
    echo "server is not running"
    return 1
  fi
}

create_db() {
  local name="${1:-}"
  [ -n "$name" ] || die "create-db requires a database name"
  require_repo_root
  start_server
  log "creating database '$name'..."
  PGPASSWORD="$PGPASS" "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" -d postgres \
    -tAc "SELECT 1 FROM pg_database WHERE datname='$name'" | grep -q 1 || \
    PGPASSWORD="$PGPASS" "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" -d postgres \
      -c "CREATE DATABASE $name;"
  log "applying 01_schema.sql + 02_seed.sql to '$name' (same as docker-entrypoint-initdb.d)..."
  PGPASSWORD="$PGPASS" "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" -d "$name" \
    -v ON_ERROR_STOP=1 -f "$REPO_ROOT/database/01_schema.sql" >/dev/null
  PGPASSWORD="$PGPASS" "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" -d "$name" \
    -v ON_ERROR_STOP=1 -f "$REPO_ROOT/database/02_seed.sql" >/dev/null
  log "database '$name' ready (schema + demo seed applied)"
}

setup_all() {
  install_binaries
  init_cluster
  start_server
  create_db burger_page_test
  create_db burger_page_dev
  status_server
  log "DATABASE_URLs for tests/dev:"
  echo "  postgres://$PGUSER:$PGPASS@localhost:$PGPORT/burger_page_test"
  echo "  postgres://app_user:app_user_test_only@localhost:$PGPORT/burger_page_test"
  echo "  postgres://app_user:app_user_test_only@localhost:$PGPORT/burger_page_dev"
}

case "${1:-help}" in
  install)   install_binaries ;;
  init)      init_cluster ;;
  start)     start_server ;;
  stop)      stop_server ;;
  status)    status_server ;;
  create-db) create_db "${2:-}" ;;
  setup)     setup_all ;;
  help|--help|-h)
    sed -n '2,20p' "$0" | sed 's/^# \?//'
    ;;
  *) die "unknown command '$1' (try: setup|install|init|start|stop|status|create-db)" ;;
esac