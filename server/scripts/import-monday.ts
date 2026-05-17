/**
 * Imports a one-time dump of Monday.com data (users + MKT VPT board) into Taskr.
 *
 * Expects these files in ./monday-dump/ (relative to this script):
 *   - users.json       Array of Monday users
 *   - board.json       Board schema (columns with settings, groups)
 *   - items-all.json   All future items fetched from Monday (date4 > today)
 *
 * Items are routed to groups based on the "estado" column value:
 *   Vacaciones/Compensa → Vacaciones, compensaciones group
 *   Guardia             → Guardias finde group
 *   Bajas               → Bajas group
 *   Everything else     → Social (top group, default)
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

const ORG_SLUG = process.env.ORG_SLUG ?? 'my-org';
const ORG_EMAIL_DOMAIN = process.env.ORG_EMAIL_DOMAIN ?? null;
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? null;
const IMPORTED_BOARD_NAME = process.env.BOARD_NAME ?? 'My Board (imported)';
const FILTER_FROM_DATE = process.env.FILTER_FROM_DATE ?? new Date().toISOString().slice(0, 10); // only import items with date4 >= this date (default: today)
const DUMP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'monday-dump');

type MondayUser = { id: string; name: string; email: string; avatarUrl?: string; title?: string; phone?: string; timezone?: string; location?: string };
type MondayColumn = { id: string; title: string; type: string; settings?: any };
type MondayGroup = { id: string; title: string };
type MondayItem = { id: string; name: string; created_at: string; updated_at: string; column_values: Record<string, any> };

// Columns that exist in the Monday board but shouldn't make it into Taskr.
const DEAD_COLUMN_IDS = new Set([
  'numeric_mkzmqmed', // Producto (numbers)
  'text_mm1kenk5',    // Producto (text duplicate)
  'text_mkzmfvrn',    // Subproducto
  'text_mkzmjww7',    // Estación
  'numeric_mkznb282', // Números 1
]);

// The imported Monday board mixes brand / status / HR labels into the `status` and `estado`
// columns. We split them here into a clean trio: Marca (brands), Estado (real statuses), and a
// new Tipo de tarea column that carries the HR labels (Vacaciones / Guardias / etc).
const HR_LABELS = new Set([
  'Vacaciones', 'Guardia', 'Guardias', 'Compensa', 'Bajas', 'International', 'Cambio horario',
]);
// Canonical HR label set used in the new Tipo de tarea column.
const TIPO_DE_TAREA_LABELS = [
  { label: 'Vacaciones',     hex: '#fdab3d' },
  { label: 'Guardias',       hex: '#7f5347' },
  { label: 'Compensa',       hex: '#faa1f1' },
  { label: 'Bajas',          hex: '#ff7575' },
  { label: 'International',  hex: '#9d99b9' },
  { label: 'Cambio horario', hex: '#579bfc' },
];
const TIPO_COL_SYNTHETIC_ID = '__tipo_de_tarea__';

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

function getMondayGroupId(item: MondayItem): string {
  const cv = item.column_values;
  const marca = cv['status'] != null ? String(cv['status']).trim() : '';
  const name = item.name.toLowerCase();

  // HR groups — routed by Marca (status) column
  if (marca === 'Vacaciones' || marca === 'Compensa') return 'grupo_nuevo92850';
  if (marca === 'Guardias') return 'grupo_nuevo56127';
  if (marca === 'Bajas') return 'grupo_nuevo__1';

  // Paid — MetaAds column populated is the reliable signal
  if (cv['multiple_person_mknzxxsz'] != null) return 'grupo_nuevo19497';

  // Content channels — detected from item name keywords
  if (name.includes('newsletter')) return 'grupo_nuevo75562';
  if (name.includes('sms')) return 'grupo_nuevo62885';
  if (name.includes('push')) return 'grupo_nuevo25234';
  if (name.includes('blog')) return 'grupo_nuevo3251';
  if (name.includes('reunión') || name.includes('reunion')) return 'grupo_nuevo23254';
  if (name.includes('banner')) return 'grupo_nuevo77425'; // Web (banners without MetaAds = web banners)

  return '1695378509_hoja_de_c_lculo_sin'; // Social (default)
}

async function main() {
  const users = readJson<MondayUser[]>('users.json');
  const board = readJson<{ name: string; columns: MondayColumn[]; groups: MondayGroup[]; topGroupId: string }>('board.json');

  const { items: allMondayItems } = readJson<{ items: Array<MondayItem & { mondayGroupId?: string }> }>('items-all.json');
  const items: Array<{ item: MondayItem; mondayGroupId: string }> = allMondayItems.map(item => ({
    item,
    mondayGroupId: item.mondayGroupId ?? getMondayGroupId(item),
  }));

  const org = await prisma.org.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`Org "${ORG_SLUG}" not found. Create it first.`);

  // Ensure ORG_EMAIL_DOMAIN auto-joins this org (if provided).
  if (ORG_EMAIL_DOMAIN) {
    const existingDomains = Array.isArray(org.emailDomains) ? (org.emailDomains as string[]) : [];
    if (!existingDomains.includes(ORG_EMAIL_DOMAIN)) {
      await prisma.org.update({
        where: { id: org.id },
        data: { emailDomains: [...existingDomains, ORG_EMAIL_DOMAIN] },
      });
    }
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
    if (DEAD_COLUMN_IDS.has(mc.id)) continue;
    const taskrType = TYPE_MAP[mc.type];
    if (!taskrType) continue;

    let settings: any = {};
    let title = mc.title;
    if (mc.type === 'status') {
      // Strip HR labels from Marca + Estado — they move to the new Tipo de tarea column.
      const labels = (mc.settings?.labels ?? []).filter((l: any) => !HR_LABELS.has(l.label));
      settings = { labels: labels.map((l: any, i: number) => ({
        id: l.id,
        label: l.label,
        color: l.hex ?? '#c4c4c4',
        index: i,
        is_done: !!l.is_done,
      })) };
      if (mc.id === 'status') title = 'Marca';
    } else if (mc.type === 'dropdown') {
      settings = { labels: mc.settings?.labels ?? [] };
    }

    const col = await prisma.column.create({
      data: { boardId: newBoard.id, title, type: taskrType, settings, position: colPos++ },
    });
    mondayColIdToTaskrId.set(mc.id, col.id);
  }

  // Synthesize a Tipo de tarea STATUS column — carries HR labels split out of Marca/Estado.
  const tipoCol = await prisma.column.create({
    data: {
      boardId: newBoard.id,
      title: 'Tipo de tarea',
      type: ColumnType.STATUS,
      settings: { labels: TIPO_DE_TAREA_LABELS.map((l, i) => ({
        id: i, label: l.label, color: l.hex, index: i, is_done: false,
      })) },
      position: colPos++,
    },
  });
  mondayColIdToTaskrId.set(TIPO_COL_SYNTHETIC_ID, tipoCol.id);
  const tipoLabelToIndex = new Map<string, number>();
  TIPO_DE_TAREA_LABELS.forEach((l, i) => {
    tipoLabelToIndex.set(l.label, i);
    if (l.label === 'Guardias') tipoLabelToIndex.set('Guardia', i);
  });
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

  // --- Items (routed to target groups by source file) ---
  // OWNER_EMAIL lets us pre-assign all imported items to the runner. Optional.
  const me = OWNER_EMAIL
    ? await prisma.user.findUnique({ where: { email: OWNER_EMAIL } })
    : null;

  let itemPos = 0;
  let assigneeCount = 0;
  let skipped = 0;
  for (const { item: mi, mondayGroupId } of items) {
    // Skip items whose date4 is before the filter date (or have no date4 at all)
    const itemDate = mi.column_values['date4'];
    const dateStr = itemDate ? String(itemDate).slice(0, 10) : null;
    if (dateStr && dateStr < FILTER_FROM_DATE) { skipped++; continue; } // skip past-dated; include no-date (timeline) items

    const taskrGroupId = mondayGroupIdToTaskrId.get(mondayGroupId);
    if (!taskrGroupId) {
      console.warn(`Skipping item ${mi.id} — no group mapping for ${mondayGroupId}`);
      continue;
    }
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
          if (HR_LABELS.has(label)) {
            // HR label — route to the synthesized Tipo de tarea column, skip original.
            const tipoColId = mondayColIdToTaskrId.get(TIPO_COL_SYNTHETIC_ID);
            const tipoIdx = tipoLabelToIndex.get(label);
            if (tipoColId && tipoIdx != null) columnValues[tipoColId] = tipoIdx;
            break;
          }
          const idx = (colDef.settings?.labels ?? []).findIndex((l: any) => l.label === label);
          if (idx >= 0) columnValues[taskrColId] = idx;
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
        groupId: taskrGroupId,
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

  console.log(`Created ${items.length - skipped} items (skipped ${skipped} with no date or date before ${FILTER_FROM_DATE}) with ${assigneeCount} assignee rows`);
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
