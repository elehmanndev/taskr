/**
 * Imports a one-time dump of Monday.com data (users + MKT VPT board) into Taskr.
 *
 * Expects these files in ./monday-dump/ (relative to this script):
 *   - users.json         Array of Monday users
 *   - board.json         Board schema (columns with settings, groups)
 *   - items-page-*.json  One or more pages of items from get_board_items_page
 *
 * Run inside the server container:
 *   docker compose exec server node scripts/import-monday.js
 *
 * Re-running drops the existing "MKT VPT (imported)" board and recreates it.
 * Users are upserted by email (never dropped).
 */
import { PrismaClient, ColumnType } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();

const ORG_SLUG = process.env.ORG_SLUG ?? 'viajesparati';
const IMPORTED_BOARD_NAME = 'MKT VPT (imported)';
const DUMP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'monday-dump');

type MondayUser = { id: string; name: string; email: string; avatarUrl?: string; title?: string; phone?: string; timezone?: string; location?: string };
type MondayColumn = { id: string; title: string; type: string; settings?: any };
type MondayGroup = { id: string; title: string };
type MondayItem = { id: string; name: string; created_at: string; updated_at: string; column_values: Record<string, any> };

const TYPE_MAP: Record<string, ColumnType | null> = {
  name: null,
  subtasks: null,
  people: ColumnType.PEOPLE,
  status: ColumnType.STATUS,
  date: ColumnType.DATE,
  timeline: ColumnType.TIMELINE,
  text: ColumnType.TEXT,
  long_text: ColumnType.LONG_TEXT,
  dropdown: ColumnType.DROPDOWN,
  tags: ColumnType.TAGS,
  numbers: ColumnType.NUMBERS,
  time_tracking: ColumnType.TIME_TRACKING,
  progress: ColumnType.PROGRESS,
  checkbox: ColumnType.CHECKBOX,
  rating: ColumnType.RATING,
  email: ColumnType.EMAIL,
  phone: ColumnType.PHONE,
  link: ColumnType.LINK,
  file: ColumnType.FILE,
};

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DUMP_DIR, file), 'utf8'));
}

async function main() {
  const users = readJson<MondayUser[]>('users.json');
  const board = readJson<{ name: string; columns: MondayColumn[]; groups: MondayGroup[]; topGroupId: string }>('board.json');

  const itemPages = fs.readdirSync(DUMP_DIR)
    .filter(f => /^items-page-\d+\.json$/.test(f))
    .sort()
    .map(f => readJson<{ items: MondayItem[] }>(f));
  const items = itemPages.flatMap(p => p.items);

  const org = await prisma.org.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`Org "${ORG_SLUG}" not found. Create it first.`);

  // Ensure viajesparati.com auto-joins this org.
  const existingDomains = Array.isArray(org.emailDomains) ? (org.emailDomains as string[]) : [];
  if (!existingDomains.includes('viajesparati.com')) {
    await prisma.org.update({
      where: { id: org.id },
      data: { emailDomains: [...existingDomains, 'viajesparati.com'] },
    });
  }

  console.log(`Importing to org ${org.name} (${org.id})`);

  // --- Users ---
  const mondayIdToUserId = new Map<string, string>();
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        name: u.name,
        avatarUrl: u.avatarUrl,
        title: u.title,
        phone: u.phone,
        timezone: u.timezone,
        location: u.location,
      },
      update: {
        name: u.name,
        avatarUrl: u.avatarUrl,
        title: u.title ?? undefined,
        phone: u.phone ?? undefined,
        timezone: u.timezone ?? undefined,
        location: u.location ?? undefined,
      },
    });
    mondayIdToUserId.set(u.id, user.id);

    await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId: org.id, userId: user.id } },
      create: { orgId: org.id, userId: user.id, role: 'MEMBER' },
      update: {},
    });
  }
  console.log(`Upserted ${users.length} users`);

  const nameToUserId = new Map<string, string>();
  for (const u of users) nameToUserId.set(u.name.trim(), mondayIdToUserId.get(u.id)!);

  // --- Reset board ---
  await prisma.board.deleteMany({ where: { orgId: org.id, name: IMPORTED_BOARD_NAME } });

  const workspace = await prisma.workspace.upsert({
    where: { id: `import-${org.id}` },
    create: { id: `import-${org.id}`, orgId: org.id, name: 'Imported' },
    update: {},
  });

  const newBoard = await prisma.board.create({
    data: { orgId: org.id, workspaceId: workspace.id, name: IMPORTED_BOARD_NAME, kind: 'PUBLIC' },
  });

  // --- Columns ---
  const mondayColIdToTaskrId = new Map<string, string>();
  const mondayColIdToDef = new Map<string, MondayColumn>();
  let colPos = 0;
  for (const mc of board.columns) {
    mondayColIdToDef.set(mc.id, mc);
    const taskrType = TYPE_MAP[mc.type];
    if (!taskrType) continue;

    let settings: any = {};
    if (mc.type === 'status') {
      settings = { labels: (mc.settings?.labels ?? []).map((l: any, i: number) => ({
        id: l.id,
        label: l.label,
        color: l.hex ?? '#c4c4c4',
        index: i,
        is_done: !!l.is_done,
      })) };
    } else if (mc.type === 'dropdown') {
      settings = { labels: mc.settings?.labels ?? [] };
    }

    const col = await prisma.column.create({
      data: { boardId: newBoard.id, title: mc.title, type: taskrType, settings, position: colPos++ },
    });
    mondayColIdToTaskrId.set(mc.id, col.id);
  }
  console.log(`Created ${mondayColIdToTaskrId.size} columns`);

  // --- Groups ---
  const GROUP_COLORS = ['#037f4c','#00c875','#9cd326','#cab641','#ffcb00','#784bd1','#a25ddc','#0086c0','#579bfc','#66ccff','#bb3354','#df2f4a','#ff007f','#ff5ac4'];
  const mondayGroupIdToTaskrId = new Map<string, string>();
  let groupPos = 0;
  for (const g of board.groups) {
    const group = await prisma.group.create({
      data: { boardId: newBoard.id, name: g.title, color: GROUP_COLORS[groupPos % GROUP_COLORS.length], position: groupPos++ },
    });
    mondayGroupIdToTaskrId.set(g.id, group.id);
  }
  console.log(`Created ${mondayGroupIdToTaskrId.size} groups`);

  // --- Items (all go into the top group — the page slice returned items only from there) ---
  const topTaskrGroupId = mondayGroupIdToTaskrId.get(board.topGroupId);
  if (!topTaskrGroupId) throw new Error(`topGroup not mapped: ${board.topGroupId}`);

  const me = await prisma.user.findUnique({ where: { email: 'elehmann@viajesparati.com' } });

  let itemPos = 0;
  let assigneeCount = 0;
  for (const mi of items) {
    const columnValues: Record<string, any> = {};
    const assigneeUserIds = new Set<string>();

    for (const [mondayColId, rawValue] of Object.entries(mi.column_values)) {
      if (rawValue === null || rawValue === undefined || rawValue === '') continue;
      const colDef = mondayColIdToDef.get(mondayColId);
      const taskrColId = mondayColIdToTaskrId.get(mondayColId);
      if (!colDef || !taskrColId) continue;

      switch (colDef.type) {
        case 'people': {
          const names = String(rawValue).split(',').map(s => s.trim()).filter(Boolean);
          const userIds = names.map(n => nameToUserId.get(n)).filter((v): v is string => !!v);
          if (userIds.length) {
            columnValues[taskrColId] = userIds;
            if (mondayColId === 'person' || mondayColId === 'personas') {
              for (const id of userIds) assigneeUserIds.add(id);
            }
          }
          break;
        }
        case 'status': {
          const label = String(rawValue);
          const idx = (colDef.settings?.labels ?? []).findIndex((l: any) => l.label === label);
          columnValues[taskrColId] = idx >= 0 ? idx : 0;
          break;
        }
        case 'dropdown': {
          const label = String(rawValue);
          const match = (colDef.settings?.labels ?? []).find((l: any) => l.label === label);
          if (match) columnValues[taskrColId] = [match.id];
          break;
        }
        case 'date': {
          const s = String(rawValue);
          columnValues[taskrColId] = s.length >= 10 ? s.slice(0, 10) : s;
          break;
        }
        case 'timeline': {
          const m = String(rawValue).match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
          if (m) columnValues[taskrColId] = { from: m[1], to: m[2] };
          break;
        }
        case 'tags': {
          columnValues[taskrColId] = String(rawValue).split(',').map(s => s.trim()).filter(Boolean);
          break;
        }
        case 'numbers': {
          const n = Number(rawValue);
          if (!Number.isNaN(n)) columnValues[taskrColId] = n;
          break;
        }
        case 'time_tracking': {
          const dur = rawValue?.duration ?? 0;
          columnValues[taskrColId] = { durationSeconds: dur };
          break;
        }
        case 'progress': {
          const n = Number(rawValue);
          if (!Number.isNaN(n)) columnValues[taskrColId] = n;
          break;
        }
        case 'text':
        case 'long_text':
        default:
          columnValues[taskrColId] = rawValue;
      }
    }

    const item = await prisma.item.create({
      data: {
        boardId: newBoard.id,
        groupId: topTaskrGroupId,
        name: mi.name,
        columnValues,
        position: itemPos++,
        createdById: me?.id,
        createdAt: new Date(mi.created_at),
        updatedAt: new Date(mi.updated_at),
      },
    });

    if (assigneeUserIds.size) {
      await prisma.itemAssignee.createMany({
        data: [...assigneeUserIds].map(userId => ({ itemId: item.id, userId })),
        skipDuplicates: true,
      });
      assigneeCount += assigneeUserIds.size;
    }
  }

  console.log(`Created ${items.length} items with ${assigneeCount} assignee rows`);
  console.log(`Done. Board: ${IMPORTED_BOARD_NAME} (${newBoard.id})`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
