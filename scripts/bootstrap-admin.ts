/**
 * Production-safe bootstrap: create or update ONE ADMIN user from env.
 *
 * Required:
 *   BOOTSTRAP_ADMIN_EMAIL
 *   BOOTSTRAP_ADMIN_PASSWORD
 *
 * Optional:
 *   BOOTSTRAP_ADMIN_NAME  (default: "Admin")
 *
 * Behavior (idempotent):
 *   - If no user with that email exists → create ADMIN with bcrypt hash (cost 12).
 *   - If user exists → update role=ADMIN, password hash, name, isActive=true.
 *   - Never hardcodes credentials; refuses to run when required env is missing.
 *
 * Usage (staging/prod):
 *   BOOTSTRAP_ADMIN_EMAIL=ops@example.com \
 *   BOOTSTRAP_ADMIN_PASSWORD='...' \
 *   BOOTSTRAP_ADMIN_NAME='Ops Admin' \
 *   npm run db:bootstrap-admin
 *
 * Local E2E still uses `npm run db:ensure-dev-users` (hardcoded @aeon.test accounts).
 * After bootstrap, create a SERVICE user via ADMIN invite for n8n draft attribution.
 *
 * DATABASE_URL is loaded from `.env` via `./load-env`. BOOTSTRAP_* must still be set in the shell.
 */
import './load-env';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(
      `Missing required env ${name}. Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD (and optionally BOOTSTRAP_ADMIN_NAME).`
    );
    process.exit(1);
  }
  return value;
}

async function main() {
  const email = requireEnv('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const password = requireEnv('BOOTSTRAP_ADMIN_PASSWORD');
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Admin';

  if (password.length < 12) {
    console.error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      password: hash,
      role: 'ADMIN',
      isActive: true,
    },
    update: {
      name,
      password: hash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log(
    existing
      ? `Updated ADMIN user ${user.email} (id=${user.id}) — role/password/name refreshed.`
      : `Created ADMIN user ${user.email} (id=${user.id}).`
  );
  console.log(
    'Next: invite a SERVICE user in-app (or Settings) for n8n draft ingress attribution. Do not use ensure-dev-users on staging/prod.'
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
