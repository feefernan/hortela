/**
 * API de pedidos da Hortelã. Cota o frete (Melhor Envio), recebe o pedido, valida e recalcula no servidor,
 * cria a cobrança no Mercado Pago, grava no Notion (com preview PNG e SVG de produção) e acompanha o pagamento.
 *
 * Tipos mínimos e locais (em vez dos gerados pelo cf) para o mesmo código ser checado e testado
 * pelo TypeScript/Vitest da raiz; `entry.ts` confere que eles batem com os tipos gerados.
 */
import { SERIAL_PATTERN } from '../../src/domain/serial';
import { nextOrderStatus, normalizeCep, type PaymentStatus } from '../../src/domain/shipping';
import { quoteShipping } from './melhor-envio';
import { createCheckout, getPayment, verifySignature } from './mercado-pago';
import { createOrderPage, findOrderPage, updatePaymentStatus, uploadFile } from './notion';
import { goodsOf, OrderError, type OrderInput, type ValidOrder, validateOrder } from './order';

interface Limiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  ALLOWED_ORIGIN: string;
  NOTION_ORDERS_DB: string;
  NOTION_TOKEN: string;
  ORDERS_LIMITER: Limiter;
  QUOTES_LIMITER: Limiter;
  SITE_URL: string;
  MELHOR_ENVIO_API: string;
  ORIGIN_CEP: string;
  /** Frete e pagamento ligam quando os tokens existem; vazios, o pedido segue como antes (sem cobrança). */
  MELHOR_ENVIO_TOKEN?: string;
  MP_ACCESS_TOKEN?: string;
  MP_WEBHOOK_SECRET?: string;
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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      }
    : { Vary: 'Origin' };
};

const json = (body: unknown, status: number, extra: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });

/** Origem permitida e dentro do limite por IP; senão, a resposta de erro. */
const guard = async (request: Request, limiter: Limiter, h: Record<string, string>) => {
  if (!h['Access-Control-Allow-Origin']) return json({ error: 'Origem não permitida' }, 403, h);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  if (!(await limiter.limit({ key: ip })).success)
    return json({ error: 'Muitos pedidos seguidos, tente em 1 minuto' }, 429, h);
  return null;
};

const readJson = async (request: Request) => {
  const size = Number(request.headers.get('Content-Length') ?? 0);
  if (size > MAX_BODY_BYTES) throw new OrderError(413, 'Pedido grande demais');
  const raw = await request.arrayBuffer();
  if (raw.byteLength > MAX_BODY_BYTES) throw new OrderError(413, 'Pedido grande demais');
  try {
    return JSON.parse(new TextDecoder().decode(raw)) as OrderInput & { cep?: unknown };
  } catch {
    throw new OrderError(400, 'Pedido inválido');
  }
};

const quote = (f: typeof fetch, env: Env, cep: string, goods: ValidOrder['goods']) =>
  quoteShipping(f, { ...env, MELHOR_ENVIO_TOKEN: env.MELHOR_ENVIO_TOKEN ?? '' }, cep, goods);

/** POST /api/shipping/quote — opções de frete para o carrinho ou a composição, até o CEP informado. */
const shippingQuote = async (request: Request, env: Env, f: typeof fetch, h: Record<string, string>) => {
  const blocked = await guard(request, env.QUOTES_LIMITER, h);
  if (blocked) return blocked;
  if (!env.MELHOR_ENVIO_TOKEN) return json({ error: 'Frete indisponível no momento' }, 503, h);
  try {
    const input = await readJson(request);
    const cep = normalizeCep(input.cep);
    if (!cep) return json({ error: 'CEP inválido' }, 400, h);
    const options = await quote(f, env, cep, goodsOf(input));
    if (!options.length) return json({ error: 'Nenhuma opção de envio para esse CEP' }, 422, h);
    return json({ options }, 200, h);
  } catch (e) {
    if (e instanceof OrderError) return json({ error: e.message }, e.status, h);
    log('error', 'cotação de frete falhou', { error: String(e) });
    return json({ error: 'Não foi possível calcular o frete agora. Tente de novo.' }, 502, h);
  }
};

/** Frete recotado no servidor: o preço que o navegador mostrou nunca é usado. */
const withShipping = async (order: ValidOrder, input: OrderInput, env: Env, f: typeof fetch) => {
  if (!order.address) throw new OrderError(400, 'Endereço de entrega incompleto');
  const options = await quote(f, env, order.address.cep, order.goods);
  const chosen = options.find((o) => o.id === Number(input.shipping?.serviceId));
  if (!chosen) throw new OrderError(409, 'Essa opção de frete mudou. Calcule o frete de novo.');
  const price = Math.round(chosen.price * 100) / 100;
  const service = `${chosen.company} ${chosen.name} · ${chosen.days} dias úteis`.trim();
  return { ...order, shipping: { service, price }, total: Math.round((order.total + price) * 100) / 100 };
};

const createOrder = async (request: Request, env: Env, f: typeof fetch, h: Record<string, string>) => {
  const blocked = await guard(request, env.ORDERS_LIMITER, h);
  if (blocked) return blocked;

  let order: ValidOrder;
  let checkoutUrl: string | null = null;
  try {
    const input = await readJson(request);
    order = validateOrder(input);
    if (env.MELHOR_ENVIO_TOKEN) order = await withShipping(order, input, env, f);
    // A cobrança vem antes do Notion: se ela falhar, nenhum pedido "aguardando" fica órfão.
    if (env.MP_ACCESS_TOKEN)
      checkoutUrl = await createCheckout(f, env.MP_ACCESS_TOKEN, {
        serial: order.serial,
        title: (order.kind === 'colecao' ? `Hortelã — ${order.lines.join(', ')}` : 'Hortelã — obra do Estúdio').slice(
          0,
          200,
        ),
        goods: order.goods.total,
        shipping: order.shipping?.price ?? 0,
        payer: { name: order.name, email: order.email },
        siteUrl: env.SITE_URL,
      });
  } catch (e) {
    if (e instanceof OrderError) return json({ error: e.message }, e.status, h);
    log('error', 'frete ou cobrança falhou', { error: String(e) });
    return json({ error: 'Não foi possível iniciar o pagamento agora. Tente de novo.' }, 502, h);
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
    const status: PaymentStatus | 'Novo' = checkoutUrl ? 'Aguardando pagamento' : 'Novo';
    await createOrderPage(f, env.NOTION_TOKEN, env.NOTION_ORDERS_DB, order, { preview, production }, status);
  } catch (e) {
    log('error', 'pedido não gravado no Notion', { serial: order.serial, kind: order.kind, error: String(e) });
    return json({ error: 'Não foi possível registrar o pedido agora. Tente de novo.' }, 502, h);
  }
  log('info', 'pedido criado', { serial: order.serial, kind: order.kind, total: order.total, cobranca: !!checkoutUrl });
  return json({ serial: order.serial, total: order.total, checkoutUrl }, 201, h);
};

/** POST /api/mp/webhook — o Mercado Pago avisa de um pagamento; o status do pedido no Notion acompanha. */
const paymentWebhook = async (request: Request, env: Env, f: typeof fetch) => {
  if (!env.MP_ACCESS_TOKEN || !env.MP_WEBHOOK_SECRET) return new Response(null, { status: 503 });
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
  const dataId = url.searchParams.get('data.id') ?? String(body.data?.id ?? '');
  const signed = await verifySignature(
    env.MP_WEBHOOK_SECRET,
    request.headers.get('x-signature'),
    request.headers.get('x-request-id'),
    dataId,
  );
  if (!signed) return new Response(null, { status: 401 });
  if ((url.searchParams.get('type') ?? body.type) !== 'payment') return new Response(null, { status: 200 });

  // Erro aqui devolve 500 e o Mercado Pago reenvia o aviso. Repetir é seguro: só regrava o mesmo status.
  try {
    const payment = await getPayment(f, env.MP_ACCESS_TOKEN, dataId);
    const serial = payment.external_reference ?? '';
    const page = SERIAL_PATTERN.test(serial)
      ? await findOrderPage(f, env.NOTION_TOKEN, env.NOTION_ORDERS_DB, serial)
      : null;
    if (!page) {
      log('warn', 'pagamento sem pedido', { payment: payment.id, serial });
      return new Response(null, { status: 200 });
    }
    const status = nextOrderStatus(page.status, payment.status);
    if (status) await updatePaymentStatus(f, env.NOTION_TOKEN, page.id, status, `${payment.id} · ${payment.status}`);
    log('info', 'aviso de pagamento', { serial, payment: payment.id, mp: payment.status, status: status ?? 'mantido' });
    return new Response(null, { status: 200 });
  } catch (e) {
    log('error', 'webhook do pagamento falhou', { dataId, error: String(e) });
    return new Response(null, { status: 500 });
  }
};

/** GET /api/orders/:serial/status — só o status do pedido, para a página de retorno do pagamento. */
const orderStatus = async (request: Request, serial: string, env: Env, f: typeof fetch, h: Record<string, string>) => {
  const blocked = await guard(request, env.QUOTES_LIMITER, h);
  if (blocked) return blocked;
  if (!SERIAL_PATTERN.test(serial)) return json({ error: 'Pedido não encontrado' }, 404, h);
  try {
    const page = await findOrderPage(f, env.NOTION_TOKEN, env.NOTION_ORDERS_DB, serial);
    return page ? json({ status: page.status }, 200, h) : json({ error: 'Pedido não encontrado' }, 404, h);
  } catch (e) {
    log('error', 'consulta de status falhou', { serial, error: String(e) });
    return json({ error: 'Não foi possível consultar o pedido agora' }, 502, h);
  }
};

export const handle = async (request: Request, env: Env, _ctx: Ctx, f: typeof fetch = fetch): Promise<Response> => {
  const url = new URL(request.url);
  const h = cors(request, env);
  const { method } = request;
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (url.pathname === '/api/health') return json({ ok: true }, 200, h);
  if (url.pathname === '/api/orders' && method === 'POST') return createOrder(request, env, f, h);
  if (url.pathname === '/api/shipping/quote' && method === 'POST') return shippingQuote(request, env, f, h);
  if (url.pathname === '/api/mp/webhook' && method === 'POST') return paymentWebhook(request, env, f);
  const status = url.pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
  if (status && method === 'GET') return orderStatus(request, decodeURIComponent(status[1]), env, f, h);
  return json({ error: 'Não encontrado' }, 404, h);
};
