#!/bin/sh
set -eu

if [ "${SKIP_DB_MIGRATIONS:-}" = "true" ]; then
  echo "[entrypoint] SKIP_DB_MIGRATIONS=true -> skipping prisma migrate deploy"
else
  echo "[entrypoint] Running prisma migrate deploy"
  npx prisma migrate deploy
fi

echo "[entrypoint] Starting app: $*"
exec "$@"
