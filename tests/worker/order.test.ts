import { describe, expect, it } from 'vitest';
import { type OrderError, validateOrder } from '../../worker/src/order';

const contact = { name: 'Ana', email: 'ana@site.com', obs: '' };
const fail = (input: Parameters<typeof validateOrder>[0]) => {
  try {
    validateOrder(input);
  } catch (e) {
    return e as OrderError;
  }
  throw new Error('deveria falhar');
};

describe('pedido da coleção', () => {
  it('recalcula preço e total pelo catálogo, ignorando o que o navegador mandou', () => {
    const o = validateOrder({
      kind: 'colecao',
      ...contact,
      items: [
        { productId: 'floresta-3', name: 'X', size: 'G', unitPrice: 1, qty: 2 },
        { productId: 'broto', name: 'Y', size: 'P', unitPrice: 1, qty: 1 },
      ],
    });
    expect(o.total).toBe(210 * 2 + 185);
    expect(o.lines).toEqual(['Floresta nº 3 (G) ×2', 'Broto (P)']);
    expect(o.serial).toMatch(/^HRT-\d{8}-[0-9A-Z]{6}$/);
  });

  it('recusa esgotada, limite e peça desconhecida com 409', () => {
    const line = (productId: string, qty = 1, size = 'M') => ({ productId, name: 'n', size, unitPrice: 1, qty });
    expect(fail({ kind: 'colecao', ...contact, items: [line('chuva-fina')] }).status).toBe(409);
    expect(fail({ kind: 'colecao', ...contact, items: [line('raizes', 2)] }).status).toBe(409);
    expect(fail({ kind: 'colecao', ...contact, items: [line('broto', 2, 'P'), line('broto', 2, 'M')] }).status).toBe(
      409,
    );
    expect(fail({ kind: 'colecao', ...contact, items: [line('nao-existe')] }).status).toBe(409);
  });

  it('recusa carrinho vazio, contato inválido e tipo desconhecido com 400', () => {
    expect(fail({ kind: 'colecao', ...contact, items: [] }).status).toBe(400);
    expect(fail({ kind: 'colecao', name: '', email: 'x', obs: '', items: [] }).status).toBe(400);
    expect(fail({ kind: 'outro' as 'colecao', ...contact }).status).toBe(400);
  });
});

describe('pedido do Estúdio', () => {
  const png = `data:image/png;base64,${btoa('PNGDATA')}`;

  it('preço vem do modelo, não do navegador; arquivos decodificados', () => {
    const o = validateOrder({
      kind: 'estudio',
      ...contact,
      studio: { model: 'long', color: 'Musgo', size: 'G', view: 'Frente e costas', stamps: ['Frente: Açucena'] },
      previewPng: png,
      productionSvg: '<?xml version="1.0"?><svg/>',
    });
    expect(o.total).toBe(220);
    expect(o.model).toBe('Camisetão Long');
    expect(new TextDecoder().decode(o.previewPng as Uint8Array)).toBe('PNGDATA');
    expect(o.productionSvg).toContain('<svg');
  });

  it('ignora arquivos com formato errado e corta textos longos', () => {
    const o = validateOrder({
      kind: 'estudio',
      name: 'A'.repeat(500),
      email: 'a@b.co',
      obs: '',
      studio: { model: 'oversized', stamps: ['x'] },
      previewPng: 'data:text/html;base64,AAAA',
      productionSvg: '<script>alert(1)</script>',
    });
    expect(o.name).toHaveLength(120);
    expect(o.previewPng).toBeNull();
    expect(o.productionSvg).toBeNull();
  });

  it('recusa modelo inválido e composição sem estampas', () => {
    expect(fail({ kind: 'estudio', ...contact, studio: { model: 'gigante', stamps: ['x'] } }).status).toBe(400);
    expect(fail({ kind: 'estudio', ...contact, studio: { model: 'long', stamps: [] } }).status).toBe(400);
  });
});
