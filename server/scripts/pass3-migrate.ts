/**
 * One-shot migration for Pass #3: drops dead columns + splits HR labels out of
 * Marca/Estado into a new "Tipo de tarea" column.
 *
 * Operates on the existing imported board in the DB — does NOT require the
 * monday-dump JSON files (which aren't deployed to prod).
 *
 * Idempotent: safe to re-run.
 *
 * Run inside the server container:
 *   docker compose exec server npx tsx scripts/pass3-migrate.ts
 */
import { PrismaClient, ColumnType } from '@prisma/client';

const prisma = new PrismaClient();

const ORG_SLUG = process.env.ORG_SLUG ?? 'my-org';
const IMPORTED_BOARD_NAME = process.env.BOARD_NAME ?? 'My Board (imported)';

const DEAD_COLUMN_TITLES = ['Producto', 'Subproducto', 'Estación', 'Números 1'];

const HR_LABELS_CANONICAL = [
  { label: 'Vacaciones',     hex: '#fdab3d' },
  { label: 'Guardias',       hex: '#7f5347' },
  { label: 'Compensa',       hex: '#faa1f1' },
  { label: 'Bajas',          hex: '#ff7575' },
  { label: 'International',  hex: '#9d99b9' },
  { label: 'Cambio horario', hex: '#579bfc' },
];
// Normalize variants (singular/plural) → canonical label
const LABEL_ALIASES: Record<string, string> = {
  'Guardia': 'Guardias',
  'Guardias': 'Guardias',
  'Vacaciones': 'Vacaciones',
  'Compensa': 'Compensa',
  'Bajas': 'Bajas',
  'International': 'International',
  'Cambio horario': 'Cambio horario',
};
const HR_LABEL_SET = new Set(Object.keys(LABEL_ALIASES));

type StatusLabel = { id: number; label: string; color?: string; index?: number; is_done?: boolean };

async function main() {
  const org = await prisma.org.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`Org "${ORG_SLUG}" not found`);

  const board = await prisma.board.findFirst({
    where: { orgId: org.id, name: IMPORTED_BOARD_NAME },
  });
  if (!board) throw new Error(`Board "${IMPORTED_BOARD_NAME}" not found`);

  console.log(`Migrating board ${board.name} (${board.id})`);

  // ── 1. Drop dead columns ──
  const dead = await prisma.column.findMany({
    where: { boardId: board.id, title: { in: DEAD_COLUMN_TITLES } },
  });
  if (dead.length) {
    const deadIds = new Set(dead.map(c => c.id));
    await prisma.column.deleteMany({ where: { id: { in: [...deadIds] } } });

    // Strip dead column values from every item on the board.
    const items = await prisma.item.findMany({ where: { boardId: board.id } });
    let itemsCleaned = 0;
    for (const item of items) {
      const cv = (item.columnValues as Record<string, any>) ?? {};
      let changed = false;
      for (const id of deadIds) {
        if (id in cv) { delete cv[id]; changed = true; }
      }
      if (changed) {
        await prisma.item.update({ where: { id: item.id }, data: { columnValues: cv } });
        itemsCleaned++;
      }
    }
    console.log(`Dropped ${dead.length} dead columns (${dead.map(c => c.title).join(', ')}), cleaned ${itemsCleaned} items`);
  } else {
    console.log('No dead columns to drop');
  }

  // ── 2. Find Marca / Estado columns ──
  const statusCols = await prisma.column.findMany({
    where: { boardId: board.id, type: ColumnType.STATUS, title: { in: ['Marca', 'Estado'] } },
  });
  const marca = statusCols.find(c => c.title === 'Marca');
  const estado = statusCols.find(c => c.title === 'Estado');

  // ── 3. Build HR id sets from current column settings (before we filter them) ──
  // For each status column, find which label ids correspond to HR labels, so we can migrate item values.
  const marcaHrIds = new Map<number, string>(); // label id → canonical HR label
  if (marca) {
    const labels = ((marca.settings as any)?.labels ?? []) as StatusLabel[];
    for (const l of labels) {
      if (HR_LABEL_SET.has(l.label)) marcaHrIds.set(l.id, LABEL_ALIASES[l.label]);
    }
  }
  const estadoHrIds = new Map<number, string>();
  if (estado) {
    const labels = ((estado.settings as any)?.labels ?? []) as StatusLabel[];
    for (const l of labels) {
      if (HR_LABEL_SET.has(l.label)) estadoHrIds.set(l.id, LABEL_ALIASES[l.label]);
    }
  }

  // ── 4. Ensure Tipo de tarea column exists ──
  let tipoCol = await prisma.column.findFirst({
    where: { boardId: board.id, title: 'Tipo de tarea', type: ColumnType.STATUS },
  });
  const tipoLabels = HR_LABELS_CANONICAL.map((l, i) => ({
    id: i, label: l.label, color: l.hex, index: i, is_done: false,
  }));
  const tipoLabelIdByName = new Map<string, number>();
  tipoLabels.forEach(l => tipoLabelIdByName.set(l.label, l.id));

  if (!tipoCol) {
    const maxPos = await prisma.column.aggregate({
      where: { boardId: board.id },
      _max: { position: true },
    });
    tipoCol = await prisma.column.create({
      data: {
        boardId: board.id,
        title: 'Tipo de tarea',
        type: ColumnType.STATUS,
        settings: { labels: tipoLabels },
        position: (maxPos._max.position ?? 0) + 1,
      },
    });
    console.log(`Created Tipo de tarea column ${tipoCol.id}`);
  } else {
    // Refresh labels in case HR_LABELS_CANONICAL changed.
    await prisma.column.update({
      where: { id: tipoCol.id },
      data: { settings: { labels: tipoLabels } },
    });
    console.log(`Refreshed existing Tipo de tarea column ${tipoCol.id}`);
  }

  // ── 5. Migrate items: HR values on Marca/Estado → Tipo de tarea ──
  if (marcaHrIds.size || estadoHrIds.size) {
    const items = await prisma.item.findMany({ where: { boardId: board.id } });
    let migrated = 0;
    for (const item of items) {
      const cv = (item.columnValues as Record<string, any>) ?? {};
      let changed = false;

      const migrateFrom = (col: typeof marca, hrIds: Map<number, string>) => {
        if (!col) return;
        const v = cv[col.id];
        if (typeof v !== 'number') return;
        const hrName = hrIds.get(v);
        if (!hrName) return;
        const tipoId = tipoLabelIdByName.get(hrName);
        if (tipoId == null) return;
        cv[tipoCol!.id] = tipoId;
        delete cv[col.id];
        changed = true;
      };
      migrateFrom(marca, marcaHrIds);
      migrateFrom(estado, estadoHrIds);

      if (changed) {
        await prisma.item.update({ where: { id: item.id }, data: { columnValues: cv } });
        migrated++;
      }
    }
    console.log(`Migrated ${migrated} items (HR values moved from Marca/Estado to Tipo de tarea)`);
  }

  // ── 6. Strip HR labels from Marca / Estado column settings ──
  for (const col of [marca, estado]) {
    if (!col) continue;
    const labels = ((col.settings as any)?.labels ?? []) as StatusLabel[];
    const cleaned = labels.filter(l => !HR_LABEL_SET.has(l.label));
    if (cleaned.length !== labels.length) {
      await prisma.column.update({
        where: { id: col.id },
        data: { settings: { labels: cleaned } },
      });
      console.log(`Stripped ${labels.length - cleaned.length} HR labels from ${col.title}`);
    }
  }

  console.log('Pass #3 migration complete.');
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
