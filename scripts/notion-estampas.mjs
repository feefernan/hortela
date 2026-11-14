/**
 * Cria o banco "Estampas" no Notion (ao lado do banco Peças) e semeia as estampas atuais do Estúdio (#65).
 * Uso: bash scripts/notion-estampas.sh (pede o token; nunca passe o token na linha de comando).
 * Se o banco Peças estiver solto no espaço de trabalho, passe a página de destino em NOTION_PARENT_PAGE (link ou ID).
 * Se o banco já existir (mesmo nome na mesma página), não cria outro: só completa o que falta.
 */
import { STAMPS } from '../src/domain/catalog.ts';

const TOKEN = process.env.NOTION_TOKEN;
const PIECES_DB = '3facabbfb8c68079aea8c6534c5de876';
if (!TOKEN) throw new Error('NOTION_TOKEN vazio');

const notion = async (path, method, body) => {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
};

/** Sobe pela árvore até achar a página: o banco pode estar dentro de coluna, callout etc. (block_id). */
const findParentPage = async (start) => {
  let parent = start;
  for (let hops = 0; hops < 10 && parent; hops += 1) {
    if (parent.page_id) return parent.page_id;
    if (!parent.block_id)
      throw new Error(
        `Pai do banco Peças é "${parent.type}": crie uma página no Notion, conecte a integração a ela e passe o link em NOTION_PARENT_PAGE.`,
      );
    parent = (await notion(`/blocks/${parent.block_id}`, 'GET')).parent;
  }
  throw new Error('Não achei a página-mãe do banco Peças.');
};

/** A página pode vir do ambiente (NOTION_PARENT_PAGE: link ou ID) quando o banco Peças está solto no espaço de trabalho. */
const pageFromEnv = (raw) => raw?.match(/[0-9a-f]{32}|[0-9a-f-]{36}/i)?.[0].replaceAll('-', '');

const pieces = await notion(`/databases/${PIECES_DB}`, 'GET');
const parent = pageFromEnv(process.env.NOTION_PARENT_PAGE) ?? (await findParentPage(pieces.parent));

const series = [...new Set(STAMPS.filter((s) => s.series !== 'Alfabeto').map((s) => s.series))];
const found = (
  await notion('/search', 'POST', { query: 'Estampas', filter: { property: 'object', value: 'database' } })
).results.find((d) => d.parent?.page_id === parent && (d.title ?? []).map((t) => t.plain_text).join('') === 'Estampas');

const db =
  found ??
  (await notion('/databases', 'POST', {
    parent: { type: 'page_id', page_id: parent },
    title: [{ text: { content: 'Estampas' } }],
    properties: {
      Estampa: { title: {} },
      ID: { rich_text: {} },
      Série: { select: { options: series.map((name) => ({ name })) } },
      Imagem: { files: {} },
      Ordem: { number: {} },
      'Ativa no Estúdio': { checkbox: {} },
    },
  }));
console.log(found ? 'Banco Estampas já existia.' : 'Banco Estampas criado.');

const existing = await notion(`/databases/${db.id}/query`, 'POST', { page_size: 100 });
const have = new Set(
  existing.results.map((p) =>
    (p.properties.ID?.rich_text ?? [])
      .map((t) => t.plain_text)
      .join('')
      .trim(),
  ),
);
let order = 0;
for (const s of STAMPS.filter((x) => x.series !== 'Alfabeto')) {
  order += 1;
  if (have.has(s.id)) continue;
  await notion('/pages', 'POST', {
    parent: { database_id: db.id },
    properties: {
      Estampa: { title: [{ text: { content: s.name } }] },
      ID: { rich_text: [{ text: { content: s.id } }] },
      Série: { select: { name: s.series } },
      Ordem: { number: order },
      'Ativa no Estúdio': { checkbox: true },
    },
  });
  console.log(`  ${s.id} ${s.name}`);
}
console.log(`ID_DO_BANCO=${db.id}`);
console.log(
  'PRONTO — suba as imagens na coluna Imagem. O ID acima entra em worker/cloudflare.config.ts (NOTION_STAMPS_DB).',
);
