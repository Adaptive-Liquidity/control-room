import './load-env';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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
}

async function main() {
  await upsertUser('admin@aeon.test', 'ADMIN', 'Admin', 'AeonAdmin123!');
  await upsertUser('service@aeon.test', 'SERVICE', 'n8n Service', 'AeonService123!');
  await upsertUser('reviewer@aeon.test', 'REVIEWER', 'Reviewer', 'AeonReview123!');
  await upsertUser('editor@aeon.test', 'EDITOR', 'Editor', 'AeonEditor123!');
  await upsertUser('viewer@aeon.test', 'VIEWER', 'Viewer', 'AeonViewer123!');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
