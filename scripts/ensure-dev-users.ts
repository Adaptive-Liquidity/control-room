import './load-env';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_COMPANY_ID = 'cmpy_adaptive_liquidity';
const DEFAULT_PROJECT_ID = 'proj_aeon';

async function upsertUser(
  email: string,
  role: UserRole,
  name: string,
  password: string
) {
  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { role, password: hash, isActive: true, name },
    create: { email, role, password: hash, name, isActive: true },
  });
  console.log(`${role}: ${user.email}`);
  return user;
}

/**
 * Attach every seeded user to the default AEON project so setup-gate is
 * satisfiable for non-ADMIN roles after migrate + seed-guardian.
 */
async function ensureProjectMemberships(userIds: string[]) {
  const project = await prisma.project.findUnique({
    where: { id: DEFAULT_PROJECT_ID },
    select: {
      id: true,
      activeContextVersionId: true,
      company: { select: { id: true, activeContextVersionId: true } },
    },
  });

  if (!project) {
    console.warn(
      `Project ${DEFAULT_PROJECT_ID} missing — run prisma migrate deploy first. Skipping memberships.`
    );
    return;
  }

  if (!project.activeContextVersionId || !project.company.activeContextVersionId) {
    console.warn(
      'Default project packs not published yet — memberships will still be created.'
    );
  }

  for (const userId of userIds) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) continue;

    await prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId: DEFAULT_PROJECT_ID, userId },
      },
      update: { role: user.role },
      create: {
        projectId: DEFAULT_PROJECT_ID,
        userId,
        role: user.role,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveProjectId: DEFAULT_PROJECT_ID },
    });
  }

  console.log(
    `memberships: ${userIds.length} user(s) → ${DEFAULT_PROJECT_ID} (${DEFAULT_COMPANY_ID})`
  );
}

async function main() {
  const users = await Promise.all([
    upsertUser('admin@aeon.test', 'ADMIN', 'Admin', 'AeonAdmin123!'),
    upsertUser('service@aeon.test', 'SERVICE', 'n8n Service', 'AeonService123!'),
    upsertUser('reviewer@aeon.test', 'REVIEWER', 'Reviewer', 'AeonReview123!'),
    upsertUser('editor@aeon.test', 'EDITOR', 'Editor', 'AeonEditor123!'),
    upsertUser('viewer@aeon.test', 'VIEWER', 'Viewer', 'AeonViewer123!'),
  ]);

  await ensureProjectMemberships(users.map((u) => u.id));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
