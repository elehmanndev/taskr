/**
 * Fetches MKT VPT board items from Monday.com per group via direct GraphQL API.
 * Items are tagged with their actual Monday group ID so the import routes them correctly.
 *
 * Run on laptop (PowerShell in server/):
 *   $env:MONDAY_TOKEN="eyJ..." ; npx tsx scripts/fetch-monday-by-group.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DUMP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'monday-dump');
const API_TOKEN = process.env.MONDAY_TOKEN;
const BOARD_ID = 1211467504;
if (!API_TOKEN) throw new Error('Set $env:MONDAY_TOKEN before running');

const GROUPS = [
  { id: '1695378509_hoja_de_c_lculo_sin', title: 'Social' },
  { id: 'grupo_nuevo19497',               title: 'Paid' },
  { id: 'group_mkwja8n',                  title: 'Data' },
  { id: 'grupo_nuevo75562',               title: 'Newsletter' },
  { id: 'grupo_nuevo62885',               title: 'SMS' },
  { id: 'grupo_nuevo25234',               title: 'Push' },
  { id: 'grupo_nuevo3251',                title: 'Blog y noticias' },
  { id: 'grupo_nuevo23254',               title: 'Reuniones' },
  { id: 'grupo_nuevo77425',               title: 'Web' },
  { id: 'grupo_nuevo',                    title: 'Branding' },
  { id: 'grupo_nuevo92850',               title: 'Vacaciones, compensaciones' },
  { id: 'grupo_nuevo56127',               title: 'Guardias finde' },
  { id: 'grupo_nuevo__1',                 title: 'Bajas' },
  // grupo_nuevo62173 (Histórico) intentionally skipped
];

async function gql(query: string): Promise<any> {
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': API_TOKEN!,
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query }),
  });
  const json: any = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

function parseColValue(col: { id: string; text: string | null; value: string | null }): any {
  // Time tracking: the text is empty but value JSON has { duration: N }
  if ((!col.text) && col.value) {
    try {
      const v = JSON.parse(col.value);
      if (v && typeof v === 'object' && 'duration' in v) return { duration: v.duration };
    } catch {}
  }
  return col.text || null;
}

type ImportItem = {
  id: string; name: string; created_at: string; updated_at: string;
  mondayGroupId: string; column_values: Record<string, any>;
};

async function fetchGroup(groupId: string, title: string): Promise<ImportItem[]> {
  const results: ImportItem[] = [];
  let cursor: string | null = null;

  do {
    const cursorArg = cursor ? `, cursor: "${cursor}"` : '';
    const data = await gql(`{
      boards(ids: [${BOARD_ID}]) {
        groups(ids: ["${groupId}"]) {
          items_page(limit: 200${cursorArg}) {
            cursor
            items {
              id name created_at updated_at
              column_values { id text value }
            }
          }
        }
      }
    }`);

    const page = data?.boards?.[0]?.groups?.[0]?.items_page;
    if (!page) break;

    for (const item of page.items) {
      const cv: Record<string, any> = {};
      for (const c of item.column_values) cv[c.id] = parseColValue(c);

      results.push({
        id: item.id,
        name: item.name,
        created_at: item.created_at,
        updated_at: item.updated_at,
        mondayGroupId: groupId,
        column_values: cv,
      });
    }

    cursor = page.cursor ?? null;
    if (cursor) await new Promise(r => setTimeout(r, 250));
  } while (cursor);

  console.log(`  ${title}: ${results.length} items`);
  return results;
}

async function main() {
  console.log(`Fetching all items from board ${BOARD_ID}\n`);
  const allItems: ImportItem[] = [];

  for (const g of GROUPS) {
    const items = await fetchGroup(g.id, g.title);
    allItems.push(...items);
  }

  const outFile = path.join(DUMP_DIR, 'items-all.json');
  fs.writeFileSync(outFile, JSON.stringify({ items: allItems }));
  console.log(`\nTotal future items: ${allItems.length}`);
  console.log(`Saved → ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
