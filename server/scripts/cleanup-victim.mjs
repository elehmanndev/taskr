import { PrismaClient } from '@prisma/client';

const victim_orgId = process.argv[2];
const victim_userId = process.argv[3];

if (!victim_orgId || !victim_userId) {
  console.error('usage: node cleanup-victim.mjs <orgId> <userId>');
  process.exit(1);
}

const p = new PrismaClient();

await p.org.delete({ where: { id: victim_orgId } });
console.log('deleted org', victim_orgId);

await p.user.delete({ where: { id: victim_userId } });
console.log('deleted user', victim_userId);

await p.$disconnect();
