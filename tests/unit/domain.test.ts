import { describe, expect, it } from 'vitest';
import { ALPHABET, findProduct, findStamp, PRODUCTS, STAMPS } from '../../src/domain/catalog';
import { editionLabel } from '../../src/domain/edition';
import { escapeHtml } from '../../src/domain/escape';
import { formatOrderDate, toRecord } from '../../src/domain/orders';
import { formatBRL, MODELS, PRINT_FEE, studioTotal } from '../../src/domain/pricing';
import { generateSerial, SERIAL_PATTERN } from '../../src/domain/serial';
import { isValidWord, validateCheckout } from '../../src/domain/validation';
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
  it('formata a edição', () => {
    expect(editionLabel({ edition: { number: 8, total: 20 }, status: 'ok' })).toBe('Ed. 8 de 20');
  });
  it('marca a última peça', () => {
    expect(editionLabel({ edition: { number: 1, total: 10 }, status: 'last' })).toBe('Ed. 1 de 10 · Última');
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
  it('converte pedido em registro sem os anexos pesados', () => {
    const record = toRecord({
      serial: 'HRT-1',
      name: 'Ana',
      email: 'ana@site.com',
      obs: '',
      cfg: { model: 'Camiseta', color: 'Musgo', size: 'G', view: 'Frente', stamps: ['Açucena'] },
      total: 'R$ 200',
      date: '1 de janeiro',
      imgB64: 'data:image/png;base64,xyz',
      svgData: null,
    });
    expect(record).toMatchObject({ status: 'novo', hasImg: true, hasSVG: false });
    expect(record).not.toHaveProperty('imgB64');
  });

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
