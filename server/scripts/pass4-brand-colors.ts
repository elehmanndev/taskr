/**
 * One-shot patch: adjust specific brand-label colors on the Marca column.
 *
 * Eric's tweaks (2026-04-19):
 *   BTR → brown
 *   JUM → orange (what BTR was)
 *
 * Idempotent. Run inside the server container:
 *   docker compose exec server npx tsx scripts/pass4-brand-colors.ts
 */
import { PrismaClient, ColumnType } from '@prisma/client';

const prisma = new PrismaClient();

const ORG_SLUG = process.env.ORG_SLUG ?? 'viajesparati';
const IMPORTED_BOARD_NAME = 'MKT VPT (imported)';

const BRAND_OVERRIDES: Record<string, string> = {
  BTR: '#7F5347',
  JUM: '#FDAB3D',
};

type StatusLabel = { id: number; label: string; color?: string; index?: number; is_done?: boolean };

async function main() {
  const org = await prisma.org.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`Org "${ORG_SLUG}" not found`);

  const board = await prisma.board.findFirst({
    where: { orgId: org.id, name: IMPORTED_BOARD_NAME },
  });
  if (!board) throw new Error(`Board "${IMPORTED_BOARD_NAME}" not found`);

  const marca = await prisma.column.findFirst({
    where: { boardId: board.id, type: ColumnType.STATUS, title: 'Marca' },
  });
  if (!marca) throw new Error('Marca column not found');

  const labels = ((marca.settings as any)?.labels ?? []) as StatusLabel[];
  let changed = 0;
  const updated = labels.map((l) => {
    const override = BRAND_OVERRIDES[l.label];
    if (override && l.color !== override) {
      changed++;
      return { ...l, color: override };
    }
    return l;
  });

  if (changed) {
    await prisma.column.update({
      where: { id: marca.id },
      data: { settings: { labels: updated } },
    });
    console.log(`Updated ${changed} brand colors on Marca: ${Object.keys(BRAND_OVERRIDES).join(', ')}`);
  } else {
    console.log('Marca brand colors already match overrides; nothing to change.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
