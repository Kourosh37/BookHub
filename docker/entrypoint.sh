#!/bin/sh
set -e

RUNTIME_DIR="/app/.runtime"
SCHEMA_HASH_FILE="$RUNTIME_DIR/prisma-schema.sha256"

mkdir -p "$RUNTIME_DIR"

run_pm() {
  if [ -f "/app/pnpm-lock.yaml" ] && command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  else
    npm "$@"
  fi
}

if command -v sha256sum >/dev/null 2>&1; then
  CURRENT_SCHEMA_HASH="$(sha256sum /app/prisma/schema.prisma | awk '{print $1}')"
else
  CURRENT_SCHEMA_HASH="$(shasum -a 256 /app/prisma/schema.prisma | awk '{print $1}')"
fi

PREV_SCHEMA_HASH=""
if [ -f "$SCHEMA_HASH_FILE" ]; then
  PREV_SCHEMA_HASH="$(cat "$SCHEMA_HASH_FILE" 2>/dev/null || true)"
fi

echo "[entrypoint] waiting for database and applying schema..."
until npx prisma migrate deploy; do
  echo "[entrypoint] prisma migrate deploy failed, retrying in 2s..."
  sleep 2
done

if [ "${DB_RESET_ON_SCHEMA_CHANGE:-true}" = "true" ] && [ "$CURRENT_SCHEMA_HASH" != "$PREV_SCHEMA_HASH" ]; then
  echo "[entrypoint] prisma schema changed, resetting database..."
  until npx prisma migrate reset --force --skip-seed; do
    echo "[entrypoint] prisma migrate reset failed, retrying in 2s..."
    sleep 2
  done
  echo "$CURRENT_SCHEMA_HASH" > "$SCHEMA_HASH_FILE"
else
  until npx prisma db push --accept-data-loss; do
    echo "[entrypoint] prisma db push failed, retrying in 2s..."
    sleep 2
  done
fi

echo "[entrypoint] starting next server..."
exec run_pm run start
