/**
 * Rotas por hash (#/colecao, #/peca/floresta-3…) — funcionam em hospedagem estática (FTP),
 * sem configurar o servidor, e geram links compartilháveis.
 */
export type PageId = 'home' | 'loja' | 'estudio' | 'sobre' | 'confirmacao' | 'painel';

export interface Route {
  page: PageId;
  productId?: string;
}

const SLUG: Record<PageId, string> = {
  home: '',
  loja: 'colecao',
  estudio: 'estudio',
  sobre: 'sobre',
  confirmacao: 'pedido',
  painel: 'painel',
};

const PAGE_BY_SLUG = new Map(Object.entries(SLUG).map(([page, slug]) => [slug, page as PageId]));

export const routeToHash = (route: Route): string =>
  route.productId ? `#/peca/${encodeURIComponent(route.productId)}` : `#/${SLUG[route.page]}`;

export const parseHash = (hash: string): Route => {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'peca' && parts[1]) return { page: 'loja', productId: decodeURIComponent(parts[1]) };
  return { page: PAGE_BY_SLUG.get(parts[0] ?? '') ?? 'home' };
};

const TITLES: Record<PageId, string> = {
  home: 'Hortelã — arte vestível em aquarela',
  loja: 'Coleção — Hortelã',
  estudio: 'Estúdio — monte sua obra · Hortelã',
  sobre: 'Sobre — Hortelã',
  confirmacao: 'Pedido confirmado — Hortelã',
  painel: 'Pedidos — Hortelã',
};

export const pageTitle = (route: Route, productName?: string): string =>
  route.productId && productName ? `${productName} — Hortelã` : TITLES[route.page];
