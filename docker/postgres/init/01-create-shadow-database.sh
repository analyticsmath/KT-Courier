#!/bin/sh
set -eu

shadow_db="${SHADOW_POSTGRES_DB:-kt_courier_shadow}"

if [ -z "$shadow_db" ]; then
  echo "No shadow database configured; skipping shadow database creation."
  exit 0
fi

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v shadow_db="$shadow_db" <<'EOSQL'
SELECT 'CREATE DATABASE ' || quote_ident(:'shadow_db')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'shadow_db'
)\gexec
EOSQL
