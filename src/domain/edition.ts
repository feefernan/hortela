import type { Product } from './catalog';

export const editionLabel = (product: Pick<Product, 'edition' | 'status'>): string => {
  const base = `Ed. ${product.edition.number} de ${product.edition.total}`;
  return product.status === 'last' ? `${base} · Última` : base;
};
