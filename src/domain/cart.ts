import { findProduct, type Product } from './catalog';

const SIZES = ['P', 'M', 'G', 'GG'] as const;
export type GarmentSize = (typeof SIZES)[number];

export interface CartLine {
  productId: string;
  name: string;
  size: GarmentSize;
  unitPrice: number;
  qty: number;
}

export type Cart = readonly CartLine[];

export type AddResult = { ok: true; cart: Cart } | { ok: false; reason: 'esgotada' | 'limite' };

/** Peça marcada como "última" só pode ir uma vez para o carrinho; outras, até 3 por tamanho. */
export const maxQty = (product: Pick<Product, 'status'>): number => (product.status === 'last' ? 1 : 3);

const sameLine = (a: Pick<CartLine, 'productId' | 'size'>, b: Pick<CartLine, 'productId' | 'size'>) =>
  a.productId === b.productId && a.size === b.size;

export const addToCart = (cart: Cart, product: Product, size: GarmentSize): AddResult => {
  if (product.status === 'sold') return { ok: false, reason: 'esgotada' };
  const limit = maxQty(product);
  const totalOfProduct = cart.filter((l) => l.productId === product.id).reduce((n, l) => n + l.qty, 0);
  if (totalOfProduct >= limit) return { ok: false, reason: 'limite' };
  const existing = cart.find((l) => sameLine(l, { productId: product.id, size }));
  if (existing) {
    return { ok: true, cart: cart.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l)) };
  }
  return {
    ok: true,
    cart: [...cart, { productId: product.id, name: product.name, size, unitPrice: product.price, qty: 1 }],
  };
};

export const removeLine = (cart: Cart, productId: string, size: GarmentSize): Cart =>
  cart.filter((l) => !sameLine(l, { productId, size }));

export const cartCount = (cart: Cart): number => cart.reduce((n, l) => n + l.qty, 0);

export const cartSubtotal = (cart: Cart): number => cart.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);

export const lineLabel = (l: CartLine): string => `${l.name} (${l.size})${l.qty > 1 ? ` ×${l.qty}` : ''}`;

export const isGarmentSize = (value: unknown): value is GarmentSize => SIZES.includes(value as GarmentSize);

/** Valida dados vindos do storage (podem estar corrompidos ou de versão antiga). */
export const parseCart = (raw: unknown): Cart => {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (l): l is CartLine =>
      typeof l === 'object' &&
      l !== null &&
      typeof l.productId === 'string' &&
      typeof l.name === 'string' &&
      isGarmentSize(l.size) &&
      Number.isFinite(l.unitPrice) &&
      Number.isInteger(l.qty) &&
      l.qty > 0,
  );
};

/** Atualiza um carrinho salvo pelo catálogo atual: preço e nome novos, sem esgotadas/desconhecidas, dentro do limite. */
export const withCurrentCatalog = (cart: Cart): Cart =>
  cart.flatMap((l) => {
    const p = findProduct(l.productId);
    if (!p || p.status === 'sold') return [];
    return [{ ...l, name: p.name, unitPrice: p.price, qty: Math.min(l.qty, maxQty(p)) }];
  });
