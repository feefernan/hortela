import { describe, expect, it } from 'vitest';
import {
  addToCart,
  type Cart,
  cartCount,
  cartSubtotal,
  isGarmentSize,
  lineLabel,
  maxQty,
  parseCart,
  removeLine,
} from '../../src/domain/cart';
import { findProduct, PRODUCTS, type Product } from '../../src/domain/catalog';
import { filterProducts } from '../../src/domain/collection-filter';
import { CART_KEY, createCartStorage } from '../../src/infra/cart-storage';

const product = (id: string) => findProduct(id) as Product;
const add = (cart: Cart, id: string, size: 'P' | 'M' | 'G' | 'GG') => {
  const r = addToCart(cart, product(id), size);
  if (!r.ok) throw new Error(r.reason);
  return r.cart;
};

describe('carrinho', () => {
  it('adiciona, junta a mesma peça/tamanho e separa tamanhos diferentes', () => {
    let cart: Cart = [];
    cart = add(cart, 'floresta-3', 'G');
    cart = add(cart, 'floresta-3', 'G');
    cart = add(cart, 'floresta-3', 'P');
    expect(cart).toHaveLength(2);
    expect(cart[0].qty).toBe(2);
    expect(cartCount(cart)).toBe(3);
    expect(cartSubtotal(cart)).toBe(630);
    expect(lineLabel(cart[0])).toBe('Floresta nº 3 (G) ×2');
    expect(lineLabel(cart[1])).toBe('Floresta nº 3 (P)');
  });

  it('não aceita esgotadas', () => {
    expect(addToCart([], product('chuva-fina'), 'M')).toEqual({ ok: false, reason: 'esgotada' });
  });

  it('respeita o limite por peça (última = 1, demais = 3, somando tamanhos)', () => {
    expect(maxQty(product('raizes'))).toBe(1);
    expect(maxQty(product('broto'))).toBe(3);
    const one = add([], 'raizes', 'M');
    expect(addToCart(one, product('raizes'), 'G')).toEqual({ ok: false, reason: 'limite' });
    let cart = add([], 'broto', 'P');
    cart = add(cart, 'broto', 'M');
    cart = add(cart, 'broto', 'M');
    expect(addToCart(cart, product('broto'), 'GG')).toEqual({ ok: false, reason: 'limite' });
  });

  it('remove uma linha específica', () => {
    let cart = add([], 'broto', 'P');
    cart = add(cart, 'broto', 'M');
    expect(removeLine(cart, 'broto', 'P').map((l) => l.size)).toEqual(['M']);
  });

  it('valida dados vindos do storage', () => {
    expect(parseCart('lixo')).toEqual([]);
    expect(
      parseCart([
        { productId: 'a', name: 'A', size: 'G', unitPrice: 10, qty: 1 },
        { productId: 'b', name: 'B', size: 'XXL', unitPrice: 10, qty: 1 },
        { productId: 'c', name: 'C', size: 'P', unitPrice: 10, qty: 0 },
        null,
      ]),
    ).toHaveLength(1);
    expect(isGarmentSize('GG')).toBe(true);
    expect(isGarmentSize('XG')).toBe(false);
  });
});

describe('filtros da coleção', () => {
  it('filtra disponíveis e últimas', () => {
    expect(filterProducts(PRODUCTS, 'todas')).toHaveLength(PRODUCTS.length);
    expect(filterProducts(PRODUCTS, 'disponiveis').every((p) => p.status !== 'sold')).toBe(true);
    expect(filterProducts(PRODUCTS, 'ultimas').map((p) => p.id)).toEqual(['raizes']);
  });
});

describe('armazenamento do carrinho', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    } as unknown as Storage;
  };

  it('salva e carrega', () => {
    const storage = memory();
    const cs = createCartStorage(storage);
    const cart = add([], 'broto', 'G');
    cs.save(cart);
    expect(createCartStorage(storage).load()).toEqual(cart);
  });

  it('tolera JSON quebrado e storage cheio', () => {
    const storage = memory();
    storage.setItem(CART_KEY, '{');
    expect(createCartStorage(storage).load()).toEqual([]);
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    } as unknown as Storage;
    expect(() => createCartStorage(full).save([])).not.toThrow();
  });
});
