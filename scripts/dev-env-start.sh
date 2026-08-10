#!/usr/bin/env bash
# Per-boot startup for Cursor Cloud agents. Idempotent.
set -euo pipefail
cd /workspace

# Start Postgres if installed
if command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo pg_ctlcluster 16 main start 2>/dev/null || sudo pg_ctlcluster 16 main restart 2>/dev/null || true
  # Wait briefly for readiness
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if sudo -u postgres psql -c 'SELECT 1' >/dev/null 2>&1; then break; fi
    sleep 1
  done

  # Role + database
  sudo -u postgres psql -v ON_ERROR_STOP=0 <<'SQL' >/dev/null 2>&1 || true
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aeon') THEN
    CREATE ROLE aeon LOGIN PASSWORD 'aeon' CREATEDB;
  END IF;
END
$$;
SQL
  if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='aeon_marketing'" | grep -q 1; then
    sudo -u postgres createdb -O aeon aeon_marketing || true
  fi
fi

# Local .env (gitignored) — only create if missing; do not overwrite secrets
if [ ! -f .env ]; then
  SECRET="$(openssl rand -base64 32 2>/dev/null || echo 'dev-secret-change-me')"
  INGRESS="$(openssl rand -hex 32 2>/dev/null || echo 'ingress-dev-secret')"
  RESUME="$(openssl rand -hex 32 2>/dev/null || echo 'resume-dev-secret')"
  BRIDGE="$(openssl rand -hex 32 2>/dev/null || echo '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')"
  CRON="$(openssl rand -hex 32 2>/dev/null || echo 'cron-dev-secret')"
  cat > .env <<EOF
DATABASE_URL="postgresql://aeon:aeon@localhost:5432/aeon_marketing?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="${SECRET}"
ALLOW_PUBLIC_SIGNUP="true"
N8N_INGRESS_SECRET="${INGRESS}"
N8N_RESUME_SECRET="${RESUME}"
N8N_BRIDGE_ENCRYPTION_KEY="${BRIDGE}"
CRON_SECRET="${CRON}"
EOF
fi

# Sync schema + seed baseline rules (idempotent)
if [ -f node_modules/.bin/prisma ]; then
  npx prisma migrate deploy || true
  npx tsx scripts/seed-guardian-rules.ts || true
  npx tsx scripts/ensure-dev-users.ts || true
fi
