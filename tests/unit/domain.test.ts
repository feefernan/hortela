import { describe, expect, it } from 'vitest';
import {
  ALPHABET,
  featuredProducts,
  findStamp as findLiveStamp,
  findProduct,
  findStamp,
  fromNotion,
  fromNotionStamps,
  PRODUCTS,
  STAMPS,
  type StampRow,
  type StockRow,
  stamps,
  useStamps,
  useStock,
} from '../../src/domain/catalog';
import { editionLabel } from '../../src/domain/edition';
import { escapeHtml } from '../../src/domain/escape';
import { formatOrderDate } from '../../src/domain/orders';
import { formatBRL, MODELS, PRINT_FEE, studioTotal } from '../../src/domain/pricing';
import { generateSerial, SERIAL_PATTERN } from '../../src/domain/serial';
import { contactErrors, isValidWord, validateCheckout } from '../../src/domain/validation';
import { GLYPHS, layoutWord } from '../../src/domain/word-layout';

describe('catalog', () => {
  it('tem ids únicos de produtos e estampas', () => {
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
    expect(new Set(STAMPS.map((s) => s.id)).size).toBe(STAMPS.length);
  });

  it('inclui todas as 26 letras do alfabeto como estampas', () => {
    expect(ALPHABET).toHaveLength(26);
    expect(STAMPS.filter((s) => s.series === 'Alfabeto')).toHaveLength(26);
    expect(findStamp('ltY')?.image).toBe('/images/alfabeto/Y.png');
  });

  it('encontra produtos e estampas por id', () => {
    expect(findProduct('raizes')?.status).toBe('last');
    expect(findProduct('nao-existe')).toBeUndefined();
    expect(findStamp('s10')?.name).toBe('Açucena');
    expect(findStamp('s10')?.image).toBe('/images/s10.png');
  });
});

describe('edition', () => {
  it('mostra o tamanho da edição e quantas restam', () => {
    expect(editionLabel({ edition: { total: 20 }, status: 'ok', available: 12 })).toBe('Edição de 20 · 12 disponíveis');
    expect(editionLabel({ edition: { total: 10 }, status: 'last', available: 1 })).toBe('Edição de 10 · 1 disponível');
    expect(editionLabel({ edition: { total: 10 }, status: 'sold', available: 0 })).toBe('Edição de 10 · Esgotada');
  });
  it('sem estoque conhecido (Notion fora do ar), só a edição', () => {
    expect(editionLabel({ edition: { total: 20 }, status: 'ok' })).toBe('Edição de 20');
    expect(editionLabel({ edition: { total: 10 }, status: 'last' })).toBe('Edição de 10 · Última');
  });
});

describe('catálogo vivo (banco Peças)', () => {
  const row = (id: string, o: Partial<StockRow> = {}): StockRow => ({
    id,
    price: null,
    total: null,
    available: null,
    active: true,
    ...o,
  });

  it('preço, edição e estoque do Notion; nome e história do código quando a coluna está vazia', () => {
    const live = fromNotion([row('floresta-3', { price: 250, total: 30, available: 1 })]);
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({
      name: 'Floresta nº 3',
      price: 250,
      edition: { total: 30 },
      available: 1,
      status: 'last',
    });
    expect(live[0].story).toBe(PRODUCTS[0].story);
  });

  it('o Notion manda: peça sem linha some, desativada some, esgotada vira esgotada', () => {
    const live = fromNotion([row('floresta-3', { available: 0 }), row('nevoa', { active: false }), row('raizes')]);
    expect(live.map((p) => p.id)).toEqual(['floresta-3', 'raizes']);
    expect(live[0].status).toBe('sold');
    expect(live[1]).toMatchObject({ price: 225, status: 'last' });
  });

  it('peça nova só no Notion entra com nome, história, imagem e paleta padrão; segue a Ordem', () => {
    const live = fromNotion([
      row('floresta-3', { order: 2 }),
      row('mare-alta', {
        name: 'Maré alta',
        collection: 'Série Mar',
        story: 'Ondas em azul.',
        price: 240,
        total: 12,
        available: 12,
        order: 1,
        featured: true,
        image: '/api/pecas/mare-alta/imagem?v=1',
      }),
      row('sem-nome'),
    ]);
    expect(live.map((p) => p.id)).toEqual(['mare-alta', 'floresta-3']);
    expect(live[0]).toMatchObject({
      name: 'Maré alta',
      collection: 'Série Mar',
      story: 'Ondas em azul.',
      price: 240,
      status: 'ok',
      image: '/api/pecas/mare-alta/imagem?v=1',
      featured: true,
    });
    expect(live[0].palette).toHaveLength(3);
  });

  it('home: peças em Destaque, ou as 3 primeiras', () => {
    useStock([row('floresta-3'), row('nevoa', { featured: true }), row('raizes'), row('broto')]);
    expect(featuredProducts().map((p) => p.id)).toEqual(['nevoa']);
    // Sem Ordem preenchida, vale a ordem do código.
    useStock([row('broto'), row('nevoa'), row('raizes'), row('floresta-3')]);
    expect(featuredProducts().map((p) => p.id)).toEqual(['floresta-3', 'raizes', 'nevoa']);
    useStock([]);
  });

  it('useStock muda o que findProduct enxerga', () => {
    useStock([row('floresta-3', { price: 999 })]);
    expect(findProduct('floresta-3')?.price).toBe(999);
    useStock([]);
    expect(findProduct('floresta-3')?.price).toBe(210);
  });
});

describe('estampas vivas (banco Estampas)', () => {
  const srow = (id: string, o: Partial<StampRow> = {}): StampRow => ({
    id,
    name: id.toUpperCase(),
    series: 'Série X',
    order: null,
    image: null,
    ...o,
  });

  it('sem linhas, vale a lista do código', () => {
    expect(fromNotionStamps([])).toEqual([...STAMPS]);
  });

  it('o Notion manda: só as linhas dele, por Ordem; o alfabeto segue fixo', () => {
    const live = fromNotionStamps([
      srow('s10', { order: 2, name: 'Açucena' }),
      srow('s12', { order: 1, name: 'Maré' }),
    ]);
    expect(live.filter((s) => s.series !== 'Alfabeto').map((s) => s.id)).toEqual(['s12', 's10']);
    expect(live.filter((s) => s.series === 'Alfabeto')).toHaveLength(26);
  });

  it('imagem: a do Notion; senão /images/<id>.png (404 cai no desenho de reserva)', () => {
    const live = fromNotionStamps([
      srow('s12', { image: 'https://usehortela.art.br/api/estampas/img/abc' }),
      srow('s10'),
    ]);
    expect(live.find((s) => s.id === 's12')?.image).toBe('https://usehortela.art.br/api/estampas/img/abc');
    expect(live.find((s) => s.id === 's10')?.image).toBe('/images/s10.png');
  });

  it('estampa do código mantém as cores do desenho de reserva; a nova não tem', () => {
    const live = fromNotionStamps([srow('s10'), srow('s12')]);
    expect(live.find((s) => s.id === 's10')?.colorA).toBe('#8060B0');
    expect(live.find((s) => s.id === 's12')).not.toHaveProperty('colorA');
  });

  it('useStamps muda o que findStamp enxerga', () => {
    useStamps([srow('s12', { name: 'Maré' })]);
    expect(findLiveStamp('s12')?.name).toBe('Maré');
    expect(stamps().some((s) => s.id === 's1')).toBe(false);
    useStamps([]);
    expect(findLiveStamp('s1')?.name).toBe('Floresta nº 3');
  });
});

describe('pricing', () => {
  it('soma modelo + estampagem', () => {
    expect(PRINT_FEE).toBe(80);
    expect(studioTotal('oversized')).toBe(MODELS.oversized.price + 80);
    expect(studioTotal('long')).toBe(220);
  });
  it('formata em reais', () => {
    expect(formatBRL(200)).toBe('R$ 200');
    expect(formatBRL(232.5)).toBe('R$ 232,50');
  });
});

describe('serial', () => {
  const bytes =
    (...values: number[]) =>
    () =>
      Uint8Array.from(values);

  it('segue o formato HRT-AAAAMMDD-XXXXXX em base32 de Crockford', () => {
    expect(generateSerial(new Date(2026, 0, 5), bytes(0, 1, 2, 3, 4, 5))).toBe('HRT-20260105-012345');
    expect(generateSerial(new Date(2026, 11, 31), bytes(31, 30, 18, 63, 255, 10))).toBe('HRT-20261231-ZYJZZA');
  });

  it('usa crypto e a data atual por padrão', () => {
    const today = new Date();
    const ds = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < 50; i++) expect(generateSerial()).toMatch(new RegExp(`^HRT-${ds}-`));
    for (let i = 0; i < 50; i++) expect(generateSerial()).toMatch(SERIAL_PATTERN);
  });

  it('cada byte vira um caractere: sufixos distintos para bytes distintos (determinístico, #37)', () => {
    // Fonte de bytes controlada em vez de sorte: 32 sequências diferentes → 32 seriais diferentes.
    const serials = new Set(
      Array.from({ length: 32 }, (_, i) => generateSerial(new Date(2026, 0, 1), bytes(i, 31 - i, i, i, i, i))),
    );
    expect(serials.size).toBe(32);
  });

  it('distribui uniformemente: os 256 valores de byte cobrem os 32 caracteres 8 vezes cada', () => {
    const counts = new Map<string, number>();
    for (let b = 0; b < 256; b++) {
      const ch = generateSerial(new Date(2026, 0, 1), bytes(b, b, b, b, b, b)).slice(-1);
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    expect(counts.size).toBe(32);
    expect(new Set(counts.values())).toEqual(new Set([8]));
  });

  it('nunca usa letras ambíguas (I, L, O, U)', () => {
    const all = Array.from({ length: 32 }, (_, i) => generateSerial(new Date(2026, 0, 1), bytes(i, i, i, i, i, i)));
    expect(all.join('')).not.toMatch(/[ILOU]/);
  });
});

describe('erros de contato', () => {
  it('cada problema com o campo onde aparece', () => {
    expect(contactErrors({ name: ' ', email: '' })).toEqual([
      { field: 'name', message: 'Informe seu nome.' },
      { field: 'email', message: 'Informe seu e-mail.' },
    ]);
    expect(contactErrors({ name: 'Ana', email: 'ana@' })).toEqual([
      { field: 'email', message: 'Confira o e-mail: algo como nome@site.com.' },
    ]);
    expect(contactErrors({ name: 'Ana', email: 'ana@site.com' })).toEqual([]);
  });
});

describe('validation', () => {
  it('exige nome e e-mail', () => {
    expect(validateCheckout({ name: '', email: 'a@b.co', obs: '' })).toBe('missing-fields');
    expect(validateCheckout({ name: 'Ana', email: '  ', obs: '' })).toBe('missing-fields');
  });
  it('valida o formato do e-mail', () => {
    expect(validateCheckout({ name: 'Ana', email: 'ana@', obs: '' })).toBe('invalid-email');
    expect(validateCheckout({ name: 'Ana', email: 'ana@site.com', obs: '' })).toBeNull();
  });
  it('aceita só letras A–Z e espaço nas palavras', () => {
    expect(isValidWord('flor de lis')).toBe(true);
    expect(isValidWord('Açaí')).toBe(false);
    expect(isValidWord('abc1')).toBe(false);
  });
});

describe('word layout', () => {
  it('retorna null para palavra sem letras', () => {
    expect(layoutWord('   ')).toBeNull();
    expect(layoutWord('123')).toBeNull();
  });

  it('posiciona cada letra a partir de x = 0', () => {
    const layout = layoutWord('ola');
    expect(layout?.glyphs.map((g) => g.href)).toEqual([
      '/images/alfabeto/O.png',
      '/images/alfabeto/L.png',
      '/images/alfabeto/A.png',
    ]);
    expect(Math.min(...(layout?.glyphs.map((g) => g.x) ?? []))).toBe(0);
    expect(layout?.height).toBe(GLYPHS.rowH);
  });

  it('espaço aumenta a largura', () => {
    const semEspaco = layoutWord('AB')?.width ?? 0;
    const comEspaco = layoutWord('A B')?.width ?? 0;
    expect(comEspaco).toBeGreaterThan(semEspaco);
  });

  it('garante largura mínima de meia linha', () => {
    const layout = layoutWord('J');
    expect(layout?.width).toBeCloseTo(GLYPHS.rowH * 0.5);
    expect(layout?.aspectRatio).toBeCloseTo(0.5);
  });
});

describe('orders', () => {
  it('formata a data em pt-BR', () => {
    expect(formatOrderDate(new Date(2026, 9, 14))).toMatch(/14 de outubro de 2026/);
  });
});

describe('escapeHtml', () => {
  it('neutraliza tags e aspas', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(escapeHtml("O'Neil & Cia")).toBe('O&#39;Neil &amp; Cia');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});
