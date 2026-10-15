/** Cliente mínimo da API do Notion: upload de arquivo e criação da página do pedido. */
import type { ValidOrder } from './order';

const API = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';

type Fetch = typeof fetch;

const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'Notion-Version': VERSION });

const ok = async (res: Response, what: string) => {
  if (!res.ok) throw new Error(`Notion ${what}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<Record<string, unknown>>;
};

/** Sobe um arquivo (single part) e devolve o id para anexar numa propriedade "files". */
export const uploadFile = async (
  f: Fetch,
  token: string,
  name: string,
  type: string,
  body: Uint8Array<ArrayBuffer> | string,
) => {
  const created = await ok(
    await f(`${API}/file_uploads`, {
      method: 'POST',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'single_part', filename: name, content_type: type }),
    }),
    'criar upload',
  );
  const form = new FormData();
  form.append('file', new Blob([body], { type }), name);
  await ok(
    await f(created.upload_url as string, { method: 'POST', headers: headers(token), body: form }),
    'enviar arquivo',
  );
  return created.id as string;
};

const rich = (content: string) => ({ rich_text: content ? [{ text: { content: content.slice(0, 2000) } }] : [] });
const fileRef = (id: string | null, name: string) => (id ? [{ type: 'file_upload', file_upload: { id }, name }] : []);

export const createOrderPage = async (
  f: Fetch,
  token: string,
  databaseId: string,
  order: ValidOrder,
  files: { preview: string | null; production: string | null },
) =>
  ok(
    await f(`${API}/pages`, {
      method: 'POST',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          Serial: { title: [{ text: { content: order.serial } }] },
          // shortcut: sem pagamento ainda, todo pedido entra como "Novo"; com o Mercado Pago (#23) vira "Aguardando pagamento".
          Status: { select: { name: 'Novo' } },
          Tipo: { select: { name: order.kind === 'colecao' ? 'Coleção' : 'Estúdio' } },
          Cliente: rich(order.name),
          'E-mail': { email: order.email },
          'Itens / Estampas': rich(order.lines.join('\n')),
          Modelo: rich(order.model),
          Cor: rich(order.color),
          Tamanho: rich(order.size),
          Posição: rich(order.view),
          Observações: rich(order.obs),
          Total: { number: order.total },
          Preview: { files: fileRef(files.preview, `${order.serial}.png`) },
          Produção: { files: fileRef(files.production, `${order.serial}.svg`) },
          Data: { date: { start: new Date().toISOString() } },
        },
      }),
    }),
    'criar pedido',
  );
