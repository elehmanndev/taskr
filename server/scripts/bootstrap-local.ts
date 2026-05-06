/**
 * One-time local bootstrap: creates the Viajesparati org and attaches the
 * first signed-in user as OWNER.
 *
 * Safe to re-run — everything is upserted.
 *
 * Run from repo root:
 *   npm run seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.org.upsert({
    where: { slug: 'viajesparati' },
    create: {
      name: 'Viajesparati',
      slug: 'viajesparati',
      emailDomains: ['viajesparati.com'],
    },
    update: {},
  });
  console.log(`✅ Org ready: ${org.name} (${org.id})`);

  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!user) {
    console.log('⚠️  No users in local DB yet.');
    console.log('   Sign in at http://localhost:5173 with Google first, then re-run npm run seed.');
    process.exit(0);
  }

  await prisma.orgMember.upsert({
    where: { orgId_userId: { orgId: org.id, userId: user.id } },
    create: { orgId: org.id, userId: user.id, role: 'OWNER' },
    update: { role: 'OWNER' },
  });
  console.log(`✅ ${user.email} attached as OWNER of ${org.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
