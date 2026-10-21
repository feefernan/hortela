/**
 * Prepara o Notion para o catálogo 100% no Notion (#60):
 *   1. banco Peças ganha História, Imagem, Ordem e Destaque; banco Pedidos ganha "Nº da edição";
 *   2. as peças que já existem recebem a história e a ordem do código — só onde a coluna está vazia.
 * Uso: bash scripts/notion-catalogo.sh (pede o token; nunca passe o token na linha de comando).
 */
import { PRODUCTS } from '../src/domain/catalog.ts';

const TOKEN = process.env.NOTION_TOKEN;
const PIECES_DB = '3facabbfb8c68079aea8c6534c5de876';
const ORDERS_DB = '3facabbfb8c68005936ac8e551f57037';
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

await notion(`/databases/${PIECES_DB}`, 'PATCH', {
  properties: { História: { rich_text: {} }, Imagem: { files: {} }, Ordem: { number: {} }, Destaque: { checkbox: {} } },
});
await notion(`/databases/${ORDERS_DB}`, 'PATCH', { properties: { 'Nº da edição': { number: {} } } });
console.log('Colunas criadas: Peças (História, Imagem, Ordem, Destaque) e Pedidos (Nº da edição).');

const { results } = await notion(`/databases/${PIECES_DB}/query`, 'POST', { page_size: 100 });
for (const page of results) {
  const id = (page.properties.ID?.rich_text ?? [])
    .map((t) => t.plain_text)
    .join('')
    .trim();
  const index = PRODUCTS.findIndex((p) => p.id === id);
  if (index < 0) continue;
  const props = {};
  if (!(page.properties.História?.rich_text ?? []).length)
    props.História = { rich_text: [{ text: { content: PRODUCTS[index].story } }] };
  if (page.properties.Ordem?.number == null) props.Ordem = { number: index + 1 };
  if (Object.keys(props).length) {
    await notion(`/pages/${page.id}`, 'PATCH', { properties: props });
    console.log(`  ${id}: ${Object.keys(props).join(' e ')} preenchidos`);
  } else console.log(`  ${id}: já preenchida`);
}
console.log('PRONTO — suba as imagens na coluna Imagem de cada peça.');
