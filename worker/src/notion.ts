/** Cliente mínimo da API do Notion: upload de arquivo, criação e atualização da página do pedido. */
import { formatAddress, type PaymentStatus } from '../../src/domain/shipping';
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
  status: PaymentStatus | 'Novo',
) =>
  ok(
    await f(`${API}/pages`, {
      method: 'POST',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          Serial: { title: [{ text: { content: order.serial } }] },
          Status: { select: { name: status } },
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
          // Colunas de entrega só quando há frete: o banco antigo, sem elas, continua aceitando pedidos.
          ...(order.shipping && order.address
            ? {
                Frete: { number: order.shipping.price },
                Envio: rich(order.shipping.service),
                Endereço: rich(formatAddress(order.address)),
              }
            : {}),
        },
      }),
    }),
    'criar pedido',
  );

/** Id da página do pedido com esse serial, ou null. */
export const findOrderPage = async (f: Fetch, token: string, databaseId: string, serial: string) => {
  const data = await ok(
    await f(`${API}/databases/${databaseId}/query`, {
      method: 'POST',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: { property: 'Serial', title: { equals: serial } }, page_size: 1 }),
    }),
    'buscar pedido',
  );
  const page = (data.results as { id: string; properties: Record<string, { select?: { name: string } | null }> }[])[0];
  return page ? { id: page.id, status: page.properties.Status?.select?.name ?? '' } : null;
};

export const updatePaymentStatus = async (
  f: Fetch,
  token: string,
  pageId: string,
  status: PaymentStatus,
  payment: string,
) =>
  ok(
    await f(`${API}/pages/${pageId}`, {
      method: 'PATCH',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: { Status: { select: { name: status } }, 'Pagamento MP': rich(payment) } }),
    }),
    'atualizar pagamento',
  );
