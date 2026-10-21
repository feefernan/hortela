import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStockCache, type Env, handle } from '../../worker/src/app';

beforeEach(clearStockCache);

const ORIGIN = 'https://usehortela.art.br';
const SERIAL = 'HRT-20261015-ABC123';
const env: Env = {
  ALLOWED_ORIGIN: ORIGIN,
  NOTION_ORDERS_DB: 'db-pedidos',
  NOTION_PIECES_DB: 'db-pecas',
  NOTION_TOKEN: 'segredo',
  ORDERS_LIMITER: { limit: async () => ({ success: true }) },
  QUOTES_LIMITER: { limit: async () => ({ success: true }) },
  SITE_URL: 'https://usehortela.art.br',
  MELHOR_ENVIO_API: 'https://me.test',
  ORIGIN_CEP: '01001000',
  MELHOR_ENVIO_TOKEN: 'me-token',
  MP_ACCESS_TOKEN: 'TEST-mp',
  MP_WEBHOOK_SECRET: 'chave-webhook',
};
const ctx = { waitUntil: () => {} };

const QUOTES = [
  {
    id: 2,
    name: 'SEDEX',
    price: '40.00',
    custom_price: '38.90',
    custom_delivery_time: 3,
    company: { name: 'Correios' },
  },
  { id: 1, name: 'PAC', price: '25.00', custom_price: '22.50', custom_delivery_time: 7, company: { name: 'Correios' } },
  { id: 3, name: '.Com', error: 'Serviço indisponível para o trecho.' },
];

/** Linha do banco Peças como a API do Notion devolve. */
const piece = (
  id: string,
  price: number | null,
  available: number | null,
  active = true,
  extra: Record<string, unknown> = {},
) => ({
  id: `pc-${id}`,
  last_edited_time: '2026-10-21T10:00:00.000Z',
  properties: {
    ID: { rich_text: [{ plain_text: id }] },
    Preço: { number: price },
    'Edição total': { number: 20 },
    Disponíveis: { number: available },
    'Ativa no site': { checkbox: active },
    ...extra,
  } as Record<string, unknown> & { ID: { rich_text: { plain_text: string }[] } },
});

/** Melhor Envio, Mercado Pago e Notion falsos: registram as chamadas e respondem como as APIs reais. */
const apis = (
  opts: {
    mpFails?: boolean;
    payment?: { status: string; external_reference?: string };
    noPage?: boolean;
    pageStatus?: string;
    pieces?: ReturnType<typeof piece>[];
    metadata?: unknown;
  } = {},
) => {
  const calls: { url: string; method: string; body?: unknown; headers: Record<string, string> }[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    calls.push({
      url: u,
      method: init?.method ?? 'GET',
      body,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    if (u.endsWith('/shipment/calculate')) return Response.json(QUOTES);
    if (u.endsWith('/checkout/preferences'))
      return opts.mpFails
        ? new Response('erro', { status: 500 })
        : Response.json({ init_point: 'https://mp.test/real', sandbox_init_point: 'https://mp.test/sandbox' });
    if (u.includes('/v1/payments/'))
      return Response.json({
        id: 999,
        metadata: opts.metadata,
        ...(opts.payment ?? { status: 'approved', external_reference: SERIAL }),
      });
    if (u.endsWith('/databases/db-pecas/query')) {
      const filter = (body as { filter?: { rich_text: { equals: string } } }).filter;
      const all = opts.pieces ?? [];
      return Response.json({
        results: filter ? all.filter((p) => p.properties.ID.rich_text[0].plain_text === filter.rich_text.equals) : all,
      });
    }
    if (u.endsWith('/query'))
      return Response.json({
        results: opts.noPage
          ? []
          : [{ id: 'page-1', properties: { Status: { select: { name: opts.pageStatus ?? 'Aguardando pagamento' } } } }],
      });
    if (u.endsWith('/pages') || /\/pages\/(page-1|pc-[\w-]+)$/.test(u)) return Response.json({ id: 'page-1' });
    return new Response('?', { status: 404 });
  });
  return { f: f as unknown as typeof fetch, calls };
};

const post = (path: string, body: unknown, origin = ORIGIN) =>
  new Request(`https://usehortela.art.br${path}`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
    body: JSON.stringify(body),
  });

const address = {
  cep: '20040-020',
  street: 'Rua A',
  number: '10',
  complement: '',
  district: 'Centro',
  city: 'Rio',
  uf: 'rj',
};
const order = {
  kind: 'colecao',
  name: 'Ana',
  email: 'ana@site.com',
  obs: '',
  items: [{ productId: 'floresta-3', name: 'x', size: 'M', unitPrice: 1, qty: 1 }],
  address,
  shipping: { serviceId: 1 },
};

describe('POST /api/shipping/quote', () => {
  it('cota no Melhor Envio com CEP de origem, pacote e valor declarado; devolve as opções mais baratas primeiro', async () => {
    const a = apis();
    const res = await handle(post('/api/shipping/quote', { ...order, cep: '20040-020' }), env, ctx, a.f);
    expect(res.status).toBe(200);
    const { options } = (await res.json()) as { options: { id: number; price: number; days: number }[] };
    expect(options).toEqual([
      { id: 1, name: 'PAC', company: 'Correios', price: 22.5, days: 7 },
      { id: 2, name: 'SEDEX', company: 'Correios', price: 38.9, days: 3 },
    ]);
    const call = a.calls.find((c) => c.url.endsWith('/shipment/calculate')) as (typeof a.calls)[number];
    expect(call.headers.Authorization).toBe('Bearer me-token');
    expect(call.headers['User-Agent']).toMatch(/@/);
    const body = call.body as {
      from: { postal_code: string };
      to: { postal_code: string };
      products: { insurance_value: number }[];
    };
    expect(body.from.postal_code).toBe('01001000');
    expect(body.to.postal_code).toBe('20040020');
    expect(body.products[0].insurance_value).toBe(210);
  });

  it('CEP inválido, origem desconhecida e Melhor Envio não configurado', async () => {
    const a = apis();
    expect((await handle(post('/api/shipping/quote', { ...order, cep: '123' }), env, ctx, a.f)).status).toBe(400);
    expect((await handle(post('/api/shipping/quote', order, 'https://golpe.example'), env, ctx, a.f)).status).toBe(403);
    const off = { ...env, MELHOR_ENVIO_TOKEN: '' };
    expect((await handle(post('/api/shipping/quote', { ...order, cep: '20040020' }), off, ctx, a.f)).status).toBe(503);
    expect(a.calls).toHaveLength(0);
  });
});

describe('POST /api/shipping/quote com muitas opções', () => {
  it('mostra no máximo 4, mas o pedido aceita qualquer opção cotada', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: 100 + i,
      name: `S${i}`,
      custom_price: String(15 + i),
      custom_delivery_time: 12 - i,
      company: { name: 'X' },
    }));
    const a = apis();
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
      String(url).endsWith('/shipment/calculate') ? Response.json(many) : a.f(url, init),
    ) as unknown as typeof fetch;
    const res = await handle(post('/api/shipping/quote', { ...order, cep: '20040020' }), env, ctx, f);
    const { options } = (await res.json()) as { options: { id: number }[] };
    expect(options.map((x) => x.id)).toEqual([100, 101, 102, 111]);
    const placed = await handle(post('/api/orders', { ...order, shipping: { serviceId: 107 } }), env, ctx, f);
    expect(placed.status).toBe(201);
  });
});

describe('POST /api/orders com frete e pagamento', () => {
  it('recota o frete, cobra peças + frete no Mercado Pago e grava "Aguardando pagamento" com entrega', async () => {
    const a = apis();
    const res = await handle(post('/api/orders', order), env, ctx, a.f);
    expect(res.status).toBe(201);
    const data = (await res.json()) as { serial: string; total: number; checkoutUrl: string };
    expect(data.total).toBe(232.5);
    expect(data.checkoutUrl).toBe('https://mp.test/sandbox');

    const pref = a.calls.find((c) => c.url.endsWith('/checkout/preferences'));
    const body = pref?.body as {
      items: { unit_price: number }[];
      shipments: { mode: string; cost: number };
      external_reference: string;
      notification_url?: string;
      back_urls: { success: string };
    };
    expect(pref?.headers['X-Idempotency-Key']).toBe(data.serial);
    expect(body.items[0].unit_price).toBe(210);
    expect(body.shipments).toEqual({ mode: 'not_specified', cost: 22.5 });
    expect(body.external_reference).toBe(data.serial);
    // O aviso vem do webhook cadastrado no painel (assinado); notification_url aqui teria prioridade sem assinatura.
    expect(body).not.toHaveProperty('notification_url');
    expect(body.back_urls.success).toBe(`https://usehortela.art.br/#/pedido/${data.serial}`);

    const page = a.calls.find((c) => c.url.endsWith('/pages'))?.body as {
      properties: Record<
        string,
        { select?: { name: string }; number?: number; rich_text?: { text: { content: string } }[] }
      >;
    };
    expect(page.properties.Status.select?.name).toBe('Aguardando pagamento');
    expect(page.properties.Total.number).toBe(232.5);
    expect(page.properties.Frete.number).toBe(22.5);
    expect(page.properties.Envio.rich_text?.[0].text.content).toBe('Correios PAC · 7 dias úteis');
    expect(page.properties.Endereço.rich_text?.[0].text.content).toContain('Centro · Rio/RJ');
  });

  it('opção de frete que não existe mais, ou endereço incompleto: nada é cobrado nem gravado', async () => {
    const a = apis();
    const gone = await handle(post('/api/orders', { ...order, shipping: { serviceId: 3 } }), env, ctx, a.f);
    expect(gone.status).toBe(409);
    const noAddress = await handle(
      post('/api/orders', { ...order, address: { ...address, number: '' } }),
      env,
      ctx,
      a.f,
    );
    expect(noAddress.status).toBe(400);
    expect(a.calls.some((c) => c.url.endsWith('/checkout/preferences') || c.url.endsWith('/pages'))).toBe(false);
  });

  it('Mercado Pago fora do ar: 502 e nenhum pedido órfão no Notion', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = apis({ mpFails: true });
    const res = await handle(post('/api/orders', order), env, ctx, a.f);
    expect(res.status).toBe(502);
    expect(a.calls.some((c) => c.url.endsWith('/pages'))).toBe(false);
  });
});

const hmac = async (secret: string, text: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

const webhook = async (opts: { secret?: string; id?: string } = {}) => {
  const id = opts.id ?? '999';
  const v1 = await hmac(opts.secret ?? 'chave-webhook', `id:${id};request-id:req-1;ts:1700000000;`);
  return new Request(`https://usehortela.art.br/api/mp/webhook?data.id=${id}&type=payment`, {
    method: 'POST',
    headers: { 'x-signature': `ts=1700000000,v1=${v1}`, 'x-request-id': 'req-1', 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'payment', data: { id } }),
  });
};

describe('POST /api/mp/webhook', () => {
  it('assinatura válida: consulta o pagamento e marca o pedido como Pago', async () => {
    const a = apis();
    const res = await handle(await webhook(), env, ctx, a.f);
    expect(res.status).toBe(200);
    expect(a.calls.find((c) => c.url.includes('/v1/payments/999'))?.headers.Authorization).toBe('Bearer TEST-mp');
    expect((a.calls.find((c) => c.url.endsWith('/query'))?.body as { filter: unknown } | undefined)?.filter).toEqual({
      property: 'Serial',
      title: { equals: SERIAL },
    });
    const patch = a.calls.find((c) => c.method === 'PATCH');
    expect(patch?.url).toMatch(/\/pages\/page-1$/);
    expect(patch?.body).toEqual({
      properties: {
        Status: { select: { name: 'Pago' } },
        'Pagamento MP': { rich_text: [{ text: { content: '999 · approved' } }] },
      },
    });
  });

  it('pagamento recusado vira Cancelado', async () => {
    const a = apis({ payment: { status: 'rejected', external_reference: SERIAL } });
    await handle(await webhook(), env, ctx, a.f);
    expect(
      (a.calls.find((c) => c.method === 'PATCH')?.body as { properties: { Status: unknown } } | undefined)?.properties
        .Status,
    ).toEqual({
      select: { name: 'Cancelado' },
    });
  });

  it('assinatura falsa é recusada sem tocar em nada', async () => {
    const a = apis();
    expect((await handle(await webhook({ secret: 'outra' }), env, ctx, a.f)).status).toBe(401);
    const unsigned = new Request('https://usehortela.art.br/api/mp/webhook?data.id=999&type=payment', {
      method: 'POST',
    });
    expect((await handle(unsigned, env, ctx, a.f)).status).toBe(401);
    expect(a.calls).toHaveLength(0);
  });

  it('pagamento sem pedido conhecido é aceito e ignorado', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = apis({ noPage: true });
    expect((await handle(await webhook(), env, ctx, a.f)).status).toBe(200);
    expect(a.calls.some((c) => c.method === 'PATCH')).toBe(false);
  });
});

describe('aviso atrasado', () => {
  it('tentativa recusada não desfaz um pedido já Pago', async () => {
    const a = apis({ payment: { status: 'rejected', external_reference: SERIAL }, pageStatus: 'Pago' });
    expect((await handle(await webhook(), env, ctx, a.f)).status).toBe(200);
    expect(a.calls.some((c) => c.method === 'PATCH')).toBe(false);
  });
});

describe('GET /api/orders/:serial/status', () => {
  const get = (serial: string) =>
    new Request(`https://usehortela.art.br/api/orders/${serial}/status`, { headers: { Origin: ORIGIN } });

  it('devolve só o status do pedido', async () => {
    const res = await handle(get(SERIAL), env, ctx, apis().f);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'Aguardando pagamento' });
  });

  it('serial fora do formato ou inexistente: 404', async () => {
    const a = apis({ noPage: true });
    expect((await handle(get('qualquer-coisa'), env, ctx, a.f)).status).toBe(404);
    expect((await handle(get(SERIAL), env, ctx, a.f)).status).toBe(404);
  });
});

describe('preço e estoque do Notion (banco Peças)', () => {
  it('GET /api/catalog devolve preço, edição e estoque de cada peça', async () => {
    const a = apis({ pieces: [piece('floresta-3', 250, 12), piece('raizes', null, 0, false)] });
    const res = await handle(
      new Request('https://usehortela.art.br/api/catalog', { headers: { Origin: ORIGIN } }),
      env,
      ctx,
      a.f,
    );
    expect(res.status).toBe(200);
    const empty = { name: null, collection: null, story: null, order: null, featured: false, image: null };
    expect(await res.json()).toEqual({
      pieces: [
        { id: 'floresta-3', price: 250, total: 20, available: 12, active: true, ...empty },
        { id: 'raizes', price: null, total: 20, available: 0, active: false, ...empty },
      ],
    });
  });

  it('GET /api/catalog traz nome, coleção, história, ordem, destaque e o endereço versionado da imagem', async () => {
    const extra = {
      Peça: { title: [{ plain_text: 'Maré alta' }] },
      Coleção: { select: { name: 'Série Mar' } },
      História: { rich_text: [{ plain_text: 'Ondas ' }, { plain_text: 'em azul.' }] },
      Ordem: { number: 1 },
      Destaque: { checkbox: true },
      Imagem: { files: [{ name: 'mare.jpg', file: { url: 'https://s3.notion.test/mare.jpg?X-Amz=1' } }] },
    };
    const a = apis({ pieces: [piece('mare-alta', 240, 12, true, extra)] });
    const res = await handle(
      new Request('https://usehortela.art.br/api/catalog', { headers: { Origin: ORIGIN } }),
      env,
      ctx,
      a.f,
    );
    const { pieces } = (await res.json()) as { pieces: Record<string, unknown>[] };
    expect(pieces[0]).toMatchObject({
      id: 'mare-alta',
      name: 'Maré alta',
      collection: 'Série Mar',
      story: 'Ondas em azul.',
      order: 1,
      featured: true,
      image: '/api/pecas/mare-alta/imagem?v=2026-10-21T10%3A00%3A00.000Z',
    });
  });

  it('GET /api/pecas/:id/imagem busca o link fresco no Notion e devolve a imagem com cache imutável', async () => {
    const extra = { Imagem: { files: [{ file: { url: 'https://s3.notion.test/mare.jpg?X-Amz=1' } }] } };
    const a = apis({ pieces: [piece('mare-alta', 240, 12, true, extra), piece('sem-foto', 200, 1)] });
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
      String(url).startsWith('https://s3.notion.test/')
        ? new Response('JPEGDATA', { headers: { 'Content-Type': 'image/jpeg' } })
        : a.f(url, init),
    ) as unknown as typeof fetch;
    const img = await handle(new Request('https://usehortela.art.br/api/pecas/mare-alta/imagem?v=1'), env, ctx, f);
    expect(img.status).toBe(200);
    expect(img.headers.get('Content-Type')).toBe('image/jpeg');
    expect(img.headers.get('Cache-Control')).toContain('immutable');
    expect(await img.text()).toBe('JPEGDATA');
    const none = await handle(new Request('https://usehortela.art.br/api/pecas/sem-foto/imagem?v=1'), env, ctx, f);
    expect(none.status).toBe(404);
  });

  it('o pedido cobra o preço do Notion e manda as peças junto da cobrança', async () => {
    const a = apis({ pieces: [piece('floresta-3', 250, 12)] });
    const res = await handle(post('/api/orders', order), env, ctx, a.f);
    expect(res.status).toBe(201);
    expect(((await res.json()) as { total: number }).total).toBe(272.5);
    const pref = a.calls.find((c) => c.url.endsWith('/checkout/preferences'))?.body as {
      items: { unit_price: number }[];
      metadata: unknown;
    };
    expect(pref.items[0].unit_price).toBe(250);
    expect(pref.metadata).toEqual({ items: [{ id: 'floresta-3', qty: 1 }] });
  });

  it('peça esgotada ou acima do estoque é recusada sem cobrar', async () => {
    const sold = apis({ pieces: [piece('floresta-3', 210, 0)] });
    const r1 = await handle(post('/api/orders', order), env, ctx, sold.f);
    expect(r1.status).toBe(409);
    expect(((await r1.json()) as { error: string }).error).toMatch(/esgotou/);
    clearStockCache();
    const one = apis({ pieces: [piece('floresta-3', 210, 1)] });
    const two = { ...order, items: [{ ...order.items[0], qty: 2 }] };
    expect((await handle(post('/api/orders', two), env, ctx, one.f)).status).toBe(409);
    expect([...sold.calls, ...one.calls].some((c) => c.url.endsWith('/checkout/preferences'))).toBe(false);
  });

  it('pagamento aprovado baixa o estoque uma vez; aviso repetido não baixa de novo', async () => {
    const metadata = { items: [{ id: 'floresta-3', qty: 2 }] };
    const a = apis({ pieces: [piece('floresta-3', 210, 5)], metadata });
    expect((await handle(await webhook(), env, ctx, a.f)).status).toBe(200);
    const stock = a.calls.find((c) => c.method === 'PATCH' && c.url.endsWith('/pages/pc-floresta-3'));
    expect(stock?.body).toEqual({ properties: { Disponíveis: { number: 3 } } });

    const again = apis({ pieces: [piece('floresta-3', 210, 3)], metadata, pageStatus: 'Pago' });
    await handle(await webhook(), env, ctx, again.f);
    expect(again.calls.some((c) => c.url.includes('/pages/pc-'))).toBe(false);
  });
});
