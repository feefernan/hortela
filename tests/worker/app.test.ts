import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStockCache, type Env, handle } from '../../worker/src/app';
import { fakeBucket } from './fake-r2';

const ORIGIN = 'http://usehortela.comercial.ws';
const env = (allow = true): Env => ({
  ALLOWED_ORIGIN: `${ORIGIN},http://localhost:5173`,
  NOTION_ORDERS_DB: 'db-pedidos',
  NOTION_PIECES_DB: 'db-pecas',
  NOTION_STAMPS_DB: 'db-estampas',
  ESTAMPAS_BUCKET: fakeBucket().bucket,
  NOTION_TOKEN: 'segredo',
  ORDERS_LIMITER: { limit: vi.fn(async () => ({ success: allow })) },
  QUOTES_LIMITER: { limit: vi.fn(async () => ({ success: allow })) },
  SITE_URL: 'https://usehortela.art.br',
  MELHOR_ENVIO_API: 'https://me.test',
  ORIGIN_CEP: '01001000',
});
const ctx = { waitUntil: () => {} };
beforeEach(clearStockCache);

/** Notion falso: registra as chamadas e responde como a API real. */
const notion = (opts: { failUpload?: boolean; failPage?: boolean } = {}) => {
  const calls: { url: string; body?: unknown }[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    calls.push({ url: u, body });
    expect((init?.headers as Record<string, string> | undefined)?.Authorization).toBe('Bearer segredo');
    if (u.endsWith('/file_uploads')) {
      if (opts.failUpload) return new Response('erro', { status: 500 });
      return Response.json({ id: `up-${body.filename}`, upload_url: `https://api.notion.com/v1/file_uploads/up/send` });
    }
    if (u.endsWith('/send')) return Response.json({ status: 'uploaded' });
    if (u.endsWith('/databases/db-pecas/query')) return Response.json({ results: [] });
    if (u.endsWith('/pages'))
      return opts.failPage ? new Response('erro', { status: 503 }) : Response.json({ id: 'page-1' });
    return new Response('?', { status: 404 });
  });
  return { f: f as unknown as typeof fetch, calls };
};

const post = (body: unknown, origin = ORIGIN) =>
  new Request('https://api.test/api/orders', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
    body: JSON.stringify(body),
  });

const studio = {
  kind: 'estudio',
  name: 'Ana',
  email: 'ana@site.com',
  obs: 'presente',
  studio: { model: 'oversized', color: 'Musgo', size: 'G', view: 'Frente', stamps: ['Açucena'] },
  previewPng: `data:image/png;base64,${btoa('PNG')}`,
  productionSvg: '<svg/>',
};

describe('cópia de segurança do pedido no R2', () => {
  it('guarda a prévia e o SVG de produção por serial, com a estampa embutida', async () => {
    const r2 = fakeBucket();
    const stamp = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);
    const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', stamp))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await r2.bucket.put(`estampas/${sha}`, stamp.buffer as ArrayBuffer);
    const pending: Promise<unknown>[] = [];
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
    const body = {
      ...studio,
      previewPng: `data:image/png;base64,${btoa(String.fromCharCode(...png))}`,
      productionSvg: `<svg><image href="https://usehortela.art.br/api/estampas/img/${sha}"/></svg>`,
    };
    const e = { ...env(), ESTAMPAS_BUCKET: r2.bucket };
    const res = await handle(post(body), e, { waitUntil: (p) => void pending.push(p) }, notion().f);
    expect(res.status).toBe(201);
    await Promise.all(pending);
    const { serial } = (await res.json()) as { serial: string };
    expect(r2.objects.has(`pedidos/${serial}/preview.png`)).toBe(true);
    const svg = new TextDecoder().decode(r2.objects.get(`pedidos/${serial}/producao.svg`)?.bytes);
    expect(svg).toContain('href="data:image/png;base64,');
    expect(svg).not.toContain('/api/estampas/img/');
  });

  it('falha do R2 não derruba o pedido', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = {
      get: async () => null,
      head: async () => null,
      put: async () => {
        throw new Error('R2 fora do ar');
      },
    };
    const pending: Promise<unknown>[] = [];
    const res = await handle(
      post(studio),
      { ...env(), ESTAMPAS_BUCKET: broken },
      { waitUntil: (p) => void pending.push(p) },
      notion().f,
    );
    expect(res.status).toBe(201);
    await Promise.all(pending);
  });
});

describe('POST /api/orders', () => {
  it('cria o pedido no Notion com anexos e devolve serial e total calculados no servidor', async () => {
    const n = notion();
    const res = await handle(post({ ...studio, total: 1 }), env(), ctx, n.f);
    expect(res.status).toBe(201);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const data = (await res.json()) as { serial: string; total: number };
    expect(data.total).toBe(200);
    expect(data.serial).toMatch(/^HRT-/);

    const page = n.calls.find((c) => c.url.endsWith('/pages'))?.body as {
      parent: { database_id: string };
      properties: Record<string, { files?: { file_upload: { id: string } }[]; number?: number }>;
    };
    expect(page.parent.database_id).toBe('db-pedidos');
    expect(page.properties.Total.number).toBe(200);
    expect(page.properties.Preview.files?.[0].file_upload.id).toBe(`up-${data.serial}.png`);
    expect(page.properties.Produção.files?.[0].file_upload.id).toBe(`up-${data.serial}.svg`);
  });

  it('sem tokens de frete e pagamento, o pedido entra como "Novo" e sem link de pagamento', async () => {
    const n = notion();
    const res = await handle(post(studio), env(), ctx, n.f);
    expect(((await res.json()) as { checkoutUrl: unknown }).checkoutUrl).toBeNull();
    const page = n.calls.find((c) => c.url.endsWith('/pages'))?.body as {
      properties: Record<string, { select?: { name: string } }>;
    };
    expect(page.properties.Status.select?.name).toBe('Novo');
    expect(page.properties).not.toHaveProperty('Frete');
  });

  it('upload falhando não perde o pedido: grava sem anexo', async () => {
    const n = notion({ failUpload: true });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await handle(post(studio), env(), ctx, n.f);
    expect(res.status).toBe(201);
    const page = n.calls.find((c) => c.url.endsWith('/pages'))?.body as {
      properties: Record<string, { files: unknown[] }>;
    };
    expect(page.properties.Preview.files).toEqual([]);
  });

  it('Notion fora do ar: 502 e o site pede para tentar de novo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handle(post(studio), env(), ctx, notion({ failPage: true }).f);
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toMatch(/Tente de novo/);
  });

  it('recusa origem desconhecida, excesso de pedidos, corpo grande e JSON quebrado', async () => {
    const n = notion();
    expect((await handle(post(studio, 'https://golpe.example'), env(), ctx, n.f)).status).toBe(403);
    expect((await handle(post(studio), env(false), ctx, n.f)).status).toBe(429);
    const big = new Request('https://api.test/api/orders', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Length': String(7 * 1024 * 1024) },
      body: 'x',
    });
    expect((await handle(big, env(), ctx, n.f)).status).toBe(413);
    const broken = new Request('https://api.test/api/orders', {
      method: 'POST',
      headers: { Origin: ORIGIN },
      body: '{',
    });
    expect((await handle(broken, env(), ctx, n.f)).status).toBe(400);
    expect(n.calls).toHaveLength(0);
  });

  it('o domínio próprio (com e sem www) é origem permitida', async () => {
    const e = { ...env(), ALLOWED_ORIGIN: 'https://usehortela.art.br,https://www.usehortela.art.br' };
    for (const origin of ['https://usehortela.art.br', 'https://www.usehortela.art.br']) {
      const res = await handle(post(studio, origin), e, ctx, notion().f);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    }
  });

  it('pedido inválido devolve a mensagem do domínio', async () => {
    const res = await handle(post({ ...studio, studio: { model: 'x', stamps: ['a'] } }), env(), ctx, notion().f);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('Modelo inválido');
  });
});

describe('outras rotas', () => {
  it('preflight CORS, health e 404', async () => {
    const opt = await handle(
      new Request('https://api.test/api/orders', { method: 'OPTIONS', headers: { Origin: ORIGIN } }),
      env(),
      ctx,
    );
    expect(opt.status).toBe(204);
    expect(opt.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect((await handle(new Request('https://api.test/api/health'), env(), ctx)).status).toBe(200);
    expect((await handle(new Request('https://api.test/nada'), env(), ctx)).status).toBe(404);
  });
});
