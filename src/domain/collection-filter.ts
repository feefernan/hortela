import type { Product } from './catalog';

export type CollectionFilter = 'todas' | 'disponiveis' | 'ultimas';

export const FILTER_EMPTY_MESSAGE: Record<CollectionFilter, string> = {
  todas: 'Nenhuma peça na coleção ainda.',
  disponiveis: 'Tudo esgotado por enquanto. A próxima coleção está sendo pintada.',
  ultimas: 'Nenhuma peça na última unidade agora.',
};

export const filterProducts = (products: readonly Product[], filter: CollectionFilter): Product[] => {
  switch (filter) {
    case 'disponiveis':
      return products.filter((p) => p.status !== 'sold');
    case 'ultimas':
      return products.filter((p) => p.status === 'last');
    default:
      return [...products];
  }
};
