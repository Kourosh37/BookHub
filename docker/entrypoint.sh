#!/bin/sh
set -eu
# Never push/reset schemas at startup. Failed migrations must fail deployment.
if [ "${PRISMA_MIGRATE_ON_START:-true}" = "true" ]; then
  /app/node_modules/.bin/prisma migrate deploy
fi
exec node .next/standalone/server.js
