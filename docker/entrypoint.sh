#!/bin/sh
set -e

echo "[entrypoint] waiting for database and applying schema..."
until npx prisma migrate deploy; do
  echo "[entrypoint] prisma migrate deploy failed, retrying in 2s..."
  sleep 2
done

npx prisma db push

echo "[entrypoint] starting next server..."
exec npm run start
