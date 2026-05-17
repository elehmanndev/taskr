/**
 * One-time local bootstrap: creates an org and attaches the first signed-in
 * user as OWNER. Safe to re-run — everything is upserted.
 *
 * Configure via env vars before running:
 *   ORG_NAME          (default: "My Org")
 *   ORG_SLUG          (default: "my-org")
 *   ORG_EMAIL_DOMAIN  (optional: e.g. "yourcompany.com" — Google sign-ins from
 *                     this domain auto-join the org)
 *
 * Run from repo root:
 *   npm run seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORG_NAME         = process.env.ORG_NAME         ?? 'My Org';
const ORG_SLUG         = process.env.ORG_SLUG         ?? 'my-org';
const ORG_EMAIL_DOMAIN = process.env.ORG_EMAIL_DOMAIN ?? null;

async function main() {
  const org = await prisma.org.upsert({
    where: { slug: ORG_SLUG },
    create: {
      name: ORG_NAME,
      slug: ORG_SLUG,
      emailDomains: ORG_EMAIL_DOMAIN ? [ORG_EMAIL_DOMAIN] : [],
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
