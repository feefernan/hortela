import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStampsCache, type Env, handle } from '../../worker/src/app';
import { embedImages } from '../../worker/src/backup';
import { detectImage, sha256Hex } from '../../worker/src/stamps';
import { fakeBucket } from './fake-r2';

beforeEach(clearStampsCache);

const ORIGIN = 'https://usehortela.art.br';
const ctx = { waitUntil: (p: Promise<unknown>) => void p.catch(() => {}) };

const PNG = (extra = 'a') =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new TextEncoder().encode(extra)]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PDF = new TextEncoder().encode('%PDF-1.7 não é imagem');

const row = (id: string, name: string, extra: Record<string, unknown> = {}, edited = '2026-10-23T10:00:00.000Z') => ({
  id: `pg-${id}`,
  last_edited_time: edited,
  properties: {
    ID: { rich_text: [{ plain_text: id }] },
    Estampa: { title: [{ plain_text: name }] },
    Série: { select: { name: 'Série Florescer' } },
    Ordem: { number: 1 },
    'Ativa no Estúdio': { checkbox: true },
    ...extra,
  },
});
const file = (name: string, url: string) => ({ Imagem: { files: [{ name, file: { url } }] } });

/** Notion falso (banco Estampas) e o servidor de arquivos do Notion: contam as chamadas. */
const world = (pages: ReturnType<typeof row>[], files: Record<string, Uint8Array>) => {
  const downloads: string[] = [];
  const f = vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith('/databases/db-estampas/query')) return Response.json({ results: pages });
    if (u.startsWith('https://s3.notion.test/')) {
      downloads.push(u);
      const bytes = files[u];
      return bytes ? new Response(bytes as BodyInit) : new Response('sumiu', { status: 403 });
    }
    return new Response('?', { status: 404 });
  }) as unknown as typeof fetch;
  return { f, downloads };
};

const makeEnv = (bucket = fakeBucket()) =>
  ({
    ALLOWED_ORIGIN: ORIGIN,
    NOTION_ORDERS_DB: 'db-pedidos',
    NOTION_PIECES_DB: 'db-pecas',
    NOTION_STAMPS_DB: 'db-estampas',
    ESTAMPAS_BUCKET: bucket.bucket,
    NOTION_TOKEN: 'segredo',
    ORDERS_LIMITER: { limit: async () => ({ success: true }) },
    QUOTES_LIMITER: { limit: async () => ({ success: true }) },
    SITE_URL: ORIGIN,
    MELHOR_ENVIO_API: 'https://me.test',
    ORIGIN_CEP: '01001000',
  }) satisfies Env;

const list = (env: Env, f: typeof fetch) =>
  handle(new Request(`${ORIGIN}/api/estampas`, { headers: { Origin: ORIGIN } }), env, ctx, f);

describe('assinatura de imagem', () => {
  it('reconhece PNG, JPEG e WebP pelos bytes, e recusa o resto', () => {
    expect(detectImage(PNG())).toBe('image/png');
    expect(detectImage(JPG)).toBe('image/jpeg');
    expect(detectImage(new TextEncoder().encode('RIFF....WEBPVP8 '))).toBe('image/webp');
    expect(detectImage(PDF)).toBeNull();
    expect(detectImage(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
  });
});

describe('GET /api/estampas', () => {
  it('copia a imagem do Notion para o R2 pelo hash do conteúdo e devolve o endereço fixo', async () => {
    const url = 'https://s3.notion.test/a.png?X-Amz=1';
    const { f, downloads } = world([row('s12', 'Maré', file('mare.png', url))], { [url]: PNG('mare') });
    const r2 = fakeBucket();
    const res = await list(makeEnv(r2), f);
    expect(res.status).toBe(200);
    const sha = await sha256Hex(PNG('mare'));
    expect(await res.json()).toEqual({
      stamps: [{ id: 's12', name: 'Maré', series: 'Série Florescer', order: 1, image: `/api/estampas/img/${sha}` }],
    });
    expect(downloads).toHaveLength(1);
    expect(r2.objects.get(`estampas/${sha}`)?.contentType).toBe('image/png');
  });

  it('sem mudança no Notion não baixa de novo; a arte trocada vira outro hash e o antigo continua guardado', async () => {
    const r2 = fakeBucket();
    const url = 'https://s3.notion.test/a.png?X-Amz=1';
    const first = world([row('s12', 'Maré', file('mare.png', url))], { [url]: PNG('v1') });
    await list(makeEnv(r2), first.f);
    clearStampsCache();
    const again = await list(makeEnv(r2), first.f);
    expect(first.downloads).toHaveLength(1);
    expect(((await again.json()) as { stamps: { image: string }[] }).stamps[0].image).toContain(
      await sha256Hex(PNG('v1')),
    );

    clearStampsCache();
    const url2 = 'https://s3.notion.test/b.png?X-Amz=2';
    const edited = world([row('s12', 'Maré', file('mare.png', url2), '2026-10-24T09:00:00.000Z')], {
      [url2]: PNG('v2'),
    });
    const res = await list(makeEnv(r2), edited.f);
    expect(((await res.json()) as { stamps: { image: string }[] }).stamps[0].image).toContain(
      await sha256Hex(PNG('v2')),
    );
    expect(r2.objects.has(`estampas/${await sha256Hex(PNG('v1'))}`)).toBe(true);
  });

  it('o Notion perder o arquivo depois não derruba a estampa: a cópia anterior continua valendo', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r2 = fakeBucket();
    const url = 'https://s3.notion.test/a.png?X-Amz=1';
    await list(makeEnv(r2), world([row('s12', 'Maré', file('mare.png', url))], { [url]: PNG('v1') }).f);
    clearStampsCache();
    const url2 = 'https://s3.notion.test/c.png?X-Amz=3';
    const lost = world([row('s12', 'Maré', file('mare.png', url2), '2026-10-25T09:00:00.000Z')], {});
    const res = await list(makeEnv(r2), lost.f);
    expect(((await res.json()) as { stamps: { image: string }[] }).stamps[0].image).toContain(
      await sha256Hex(PNG('v1')),
    );
  });

  it('apagar a imagem no Notion mantém a última cópia, até entrar uma nova', async () => {
    const r2 = fakeBucket();
    const url = 'https://s3.notion.test/a.png?X-Amz=1';
    await list(makeEnv(r2), world([row('s12', 'Maré', file('mare.png', url))], { [url]: PNG('v1') }).f);
    clearStampsCache();
    const removed = world([row('s12', 'Maré', {}, '2026-10-25T09:00:00.000Z')], {});
    const kept = await list(makeEnv(r2), removed.f);
    expect(((await kept.json()) as { stamps: { image: string }[] }).stamps[0].image).toContain(
      await sha256Hex(PNG('v1')),
    );

    clearStampsCache();
    const url2 = 'https://s3.notion.test/b.png?X-Amz=2';
    const replaced = world([row('s12', 'Maré', file('nova.png', url2), '2026-10-26T09:00:00.000Z')], {
      [url2]: PNG('v2'),
    });
    const res = await list(makeEnv(r2), replaced.f);
    expect(((await res.json()) as { stamps: { image: string }[] }).stamps[0].image).toContain(
      await sha256Hex(PNG('v2')),
    );
  });

  it('arquivo que não é imagem ou é grande demais é recusado sem derrubar as outras estampas', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = 'https://s3.notion.test/bad.pdf';
    const big = 'https://s3.notion.test/big.png';
    const ok = 'https://s3.notion.test/ok.png';
    const { f } = world(
      [
        row('x1', 'Falso', file('x.png', bad)),
        row('x2', 'Enorme', file('big.png', big)),
        row('x3', 'Boa', file('ok.png', ok)),
      ],
      {
        [bad]: PDF,
        [big]: new Uint8Array(2 * 1024 * 1024 + 1).fill(1).map((_, i) => (i < 8 ? PNG()[i] : 1)),
        [ok]: PNG('ok'),
      },
    );
    const res = await list(makeEnv(), f);
    const { stamps } = (await res.json()) as { stamps: { id: string; image: string | null }[] };
    expect(stamps.map((s) => [s.id, s.image === null])).toEqual([
      ['x1', true],
      ['x2', true],
      ['x3', false],
    ]);
  });

  it('estampa desativada, sem nome ou sem ID não aparece; sem imagem aparece sem endereço', async () => {
    const { f } = world(
      [row('s1', 'Escondida', { 'Ativa no Estúdio': { checkbox: false } }), row('s2', ''), row('s3', 'Sem arte')],
      {},
    );
    const res = await list(makeEnv(), f);
    expect(((await res.json()) as { stamps: { id: string; image: null }[] }).stamps).toEqual([
      { id: 's3', name: 'Sem arte', series: 'Série Florescer', order: 1, image: null },
    ]);
  });

  it('Notion fora do ar: 502 sem derrubar o resto', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    expect((await list(makeEnv(), f)).status).toBe(502);
  });
});

describe('GET /api/estampas/img/:sha', () => {
  const get = (path: string) => new Request(`${ORIGIN}${path}`);

  it('serve do R2 com cache imutável; só aceita hash de 64 caracteres', async () => {
    const r2 = fakeBucket();
    const sha = await sha256Hex(PNG('z'));
    await r2.bucket.put(`estampas/${sha}`, PNG('z').buffer as ArrayBuffer, {
      httpMetadata: { contentType: 'image/png' },
    });
    const env = makeEnv(r2);
    const ok = await handle(get(`/api/estampas/img/${sha}`), env, ctx);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Cache-Control')).toContain('immutable');
    expect(ok.headers.get('Content-Type')).toBe('image/png');
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect((await handle(get('/api/estampas/img/..%2F..%2Fpedidos'), env, ctx)).status).toBe(404);
    expect((await handle(get(`/api/estampas/img/${'0'.repeat(64)}`), env, ctx)).status).toBe(404);
    expect((await handle(get('/api/estampas/img/abc'), env, ctx)).status).toBe(404);
  });
});

describe('SVG de produção com as imagens embutidas', () => {
  it('embute estampas do R2 e letras do site; deixa de fora endereços de outros sites', async () => {
    const r2 = fakeBucket();
    const sha = await sha256Hex(PNG('e'));
    await r2.bucket.put(`estampas/${sha}`, PNG('e').buffer as ArrayBuffer);
    const f = vi.fn(async (url: string | URL | Request) =>
      String(url) === `${ORIGIN}/images/alfabeto/F.png`
        ? new Response(PNG('letra'))
        : new Response('?', { status: 404 }),
    ) as unknown as typeof fetch;
    const svg = `<svg><image href="${ORIGIN}/api/estampas/img/${sha}"/><image href="${ORIGIN}/images/alfabeto/F.png"/><image href="https://golpe.example/x.png"/></svg>`;
    const out = await embedImages(svg, ORIGIN, r2.bucket, f);
    expect(out).toContain('href="data:image/png;base64,');
    expect(out.match(/data:image\/png;base64,/g)).toHaveLength(2);
    expect(out).toContain('href="https://golpe.example/x.png"');
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).not.toHaveBeenCalledWith('https://golpe.example/x.png');
  });
});
