import type { Product } from './catalog';

/** "Edição de 20 · 12 disponíveis"; sem estoque conhecido, só "Edição de 20" (e "Última" se for o caso). */
export const editionLabel = (product: Pick<Product, 'edition' | 'status' | 'available'>): string => {
  const base = `Edição de ${product.edition.total}`;
  const n = product.available;
  if (n === undefined) return product.status === 'last' ? `${base} · Última` : base;
  if (n <= 0) return `${base} · Esgotada`;
  return `${base} · ${n} ${n === 1 ? 'disponível' : 'disponíveis'}`;
};
