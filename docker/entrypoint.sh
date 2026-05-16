#!/bin/sh
set -e

RUNTIME_DIR="/app/.runtime"
SCHEMA_HASH_FILE="$RUNTIME_DIR/prisma-schema.sha256"
PRISMA_BIN="/app/node_modules/.bin/prisma"

mkdir -p "$RUNTIME_DIR"

if command -v sha256sum >/dev/null 2>&1; then
  CURRENT_SCHEMA_HASH="$(sha256sum /app/prisma/schema.prisma | awk '{print $1}')"
else
  CURRENT_SCHEMA_HASH="$(shasum -a 256 /app/prisma/schema.prisma | awk '{print $1}')"
fi

PREV_SCHEMA_HASH=""
if [ -f "$SCHEMA_HASH_FILE" ]; then
  PREV_SCHEMA_HASH="$(cat "$SCHEMA_HASH_FILE" 2>/dev/null || true)"
fi

if [ ! -x "$PRISMA_BIN" ]; then
  echo "[entrypoint] prisma binary not found at $PRISMA_BIN"
  exit 1
fi

has_migrations() {
  [ -d "/app/prisma/migrations" ] && find /app/prisma/migrations -mindepth 1 -maxdepth 2 -type f | grep -q .
}

retry_prisma_cmd() {
  cmd="$1"
  while true; do
    if sh -c "$cmd"; then
      return 0
    fi
    echo "[entrypoint] command failed, retrying in 2s: $cmd"
    sleep 2
  done
}

echo "[entrypoint] waiting for database and applying schema..."
if has_migrations; then
  while true; do
    set +e
    MIGRATE_OUTPUT="$("$PRISMA_BIN" migrate deploy 2>&1)"
    MIGRATE_STATUS=$?
    set -e

    if [ $MIGRATE_STATUS -eq 0 ]; then
      break
    fi

    echo "$MIGRATE_OUTPUT"
    if echo "$MIGRATE_OUTPUT" | grep -q "P3005"; then
      echo "[entrypoint] migrate deploy returned P3005, falling back to prisma db push."
      break
    fi

    echo "[entrypoint] prisma migrate deploy failed, retrying in 2s..."
    sleep 2
  done
else
  echo "[entrypoint] no prisma migrations found, skipping migrate deploy."
fi

if [ "${DB_RESET_ON_SCHEMA_CHANGE:-true}" = "true" ] && [ "$CURRENT_SCHEMA_HASH" != "$PREV_SCHEMA_HASH" ]; then
  echo "[entrypoint] prisma schema changed, resetting database..."
  retry_prisma_cmd "$PRISMA_BIN migrate reset --force --skip-seed"
  # In migration-less setups, reset leaves DB empty; push schema so tables are created.
  retry_prisma_cmd "$PRISMA_BIN db push --accept-data-loss"
  echo "$CURRENT_SCHEMA_HASH" > "$SCHEMA_HASH_FILE"
else
  retry_prisma_cmd "$PRISMA_BIN db push --accept-data-loss"
fi

echo "[entrypoint] starting next server..."
exec npm run start
