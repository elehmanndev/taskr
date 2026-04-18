import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

const org = await p.org.create({
  data: { name: 'VICTIM_TEST', slug: `victim-test-${Date.now()}` },
});

const user = await p.user.create({
  data: {
    email: `victim-test-${Date.now()}@example.com`,
    name: 'Victim User',
    googleId: `victim-fake-${Date.now()}`,
  },
});

await p.orgMember.create({
  data: { orgId: org.id, userId: user.id, role: 'OWNER' },
});

const ws = await p.workspace.create({
  data: { orgId: org.id, name: 'Victim WS' },
});

const board = await p.board.create({
  data: {
    orgId: org.id,
    workspaceId: ws.id,
    name: 'Victim Board',
    kind: 'PRIVATE',
  },
});

const group = await p.group.create({
  data: { boardId: board.id, name: 'Victim Group', position: 0 },
});

const item = await p.item.create({
  data: {
    boardId: board.id,
    groupId: group.id,
    name: 'Victim Item - secret',
    columnValues: {},
    position: 0,
  },
});

console.log(JSON.stringify({
  victim_orgId: org.id,
  victim_userId: user.id,
  victim_workspaceId: ws.id,
  victim_boardId: board.id,
  victim_groupId: group.id,
  victim_itemId: item.id,
}, null, 2));

await p.$disconnect();
