/**
 * API de pedidos da Hortelã. Recebe o pedido do site, valida e recalcula no servidor,
 * grava no Notion (com preview PNG e SVG de produção) e devolve o serial.
 *
 * Tipos mínimos e locais (em vez dos gerados pelo cf) para o mesmo código ser checado e testado
 * pelo TypeScript/Vitest da raiz; `entry.ts` confere que eles batem com os tipos gerados.
 */
import { createOrderPage, uploadFile } from './notion';
import { OrderError, type OrderInput, validateOrder } from './order';

export interface Env {
  ALLOWED_ORIGIN: string;
  NOTION_ORDERS_DB: string;
  NOTION_TOKEN: string;
  ORDERS_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

const MAX_BODY_BYTES = 6 * 1024 * 1024;

const log = (level: 'info' | 'warn' | 'error', msg: string, data: Record<string, unknown> = {}) =>
  console[level === 'info' ? 'log' : level](JSON.stringify({ level, msg, ...data }));

const cors = (request: Request, env: Env): Record<string, string> => {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGIN.split(',').map((o) => o.trim());
  return allowed.includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      }
    : { Vary: 'Origin' };
};

const json = (body: unknown, status: number, extra: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });

const createOrder = async (request: Request, env: Env, f: typeof fetch, h: Record<string, string>) => {
  if (!h['Access-Control-Allow-Origin']) return json({ error: 'Origem não permitida' }, 403, h);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  if (!(await env.ORDERS_LIMITER.limit({ key: ip })).success)
    return json({ error: 'Muitos pedidos seguidos, tente em 1 minuto' }, 429, h);

  const size = Number(request.headers.get('Content-Length') ?? 0);
  if (size > MAX_BODY_BYTES) return json({ error: 'Pedido grande demais' }, 413, h);
  const raw = await request.arrayBuffer();
  if (raw.byteLength > MAX_BODY_BYTES) return json({ error: 'Pedido grande demais' }, 413, h);

  let order: ReturnType<typeof validateOrder>;
  try {
    order = validateOrder(JSON.parse(new TextDecoder().decode(raw)) as OrderInput);
  } catch (e) {
    if (e instanceof OrderError) return json({ error: e.message }, e.status, h);
    return json({ error: 'Pedido inválido' }, 400, h);
  }

  // Arquivo que falha no upload não derruba o pedido: ele é gravado sem o anexo e o erro vai para o log.
  const upload = async (name: string, type: string, body: Uint8Array<ArrayBuffer> | string | null) => {
    if (!body) return null;
    try {
      return await uploadFile(f, env.NOTION_TOKEN, name, type, body);
    } catch (e) {
      log('warn', 'upload falhou', { serial: order.serial, name, error: String(e) });
      return null;
    }
  };
  const [preview, production] = await Promise.all([
    upload(`${order.serial}.png`, 'image/png', order.previewPng),
    upload(`${order.serial}.svg`, 'image/svg+xml', order.productionSvg),
  ]);

  try {
    await createOrderPage(f, env.NOTION_TOKEN, env.NOTION_ORDERS_DB, order, { preview, production });
  } catch (e) {
    log('error', 'pedido não gravado no Notion', { serial: order.serial, kind: order.kind, error: String(e) });
    return json({ error: 'Não foi possível registrar o pedido agora. Tente de novo.' }, 502, h);
  }
  log('info', 'pedido criado', { serial: order.serial, kind: order.kind, total: order.total });
  return json({ serial: order.serial, total: order.total }, 201, h);
};

export const handle = async (request: Request, env: Env, _ctx: Ctx, f: typeof fetch = fetch): Promise<Response> => {
  const url = new URL(request.url);
  const h = cors(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (url.pathname === '/api/health') return json({ ok: true }, 200, h);
  if (url.pathname === '/api/orders' && request.method === 'POST') return createOrder(request, env, f, h);
  return json({ error: 'Não encontrado' }, 404, h);
};
