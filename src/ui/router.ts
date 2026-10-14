import { findProduct } from '../domain/catalog';
import { type PageId, pageTitle, parseHash, type Route, routeToHash } from '../domain/routes';
import { byId, onAction, qsa } from './dom';
import { animateOut } from './motion';

export type { PageId };

type ProductHook = (productId: string | null) => void;
let productHook: ProductHook = () => {};
let current: Route = { page: 'home' };

/** O catálogo registra como abrir/fechar o modal de peça quando a rota muda (#/peca/:id). */
export const setProductHook = (hook: ProductHook) => {
  productHook = hook;
};

const showPage = (id: PageId) => {
  const leaving = document.querySelector<HTMLElement>('.page.active');
  if (leaving && leaving.id !== id) {
    // A página anterior sai por cima (sutil e rápida) enquanto a nova entra.
    animateOut(leaving, 'page-leaving', () => leaving.classList.remove('page-leaving'));
    window.scrollTo(0, 0);
  }
  for (const page of qsa('.page')) page.classList.remove('active');
  for (const link of qsa('.nav-center a')) {
    link.classList.remove('active');
    link.removeAttribute('aria-current');
  }
  byId(id).classList.add('active');
  const link = document.getElementById(`n-${id}`);
  link?.classList.add('active');
  link?.setAttribute('aria-current', 'page');
};

const apply = (route: Route) => {
  const pageChanged = route.page !== current.page;
  current = route;
  if (pageChanged || !document.querySelector('.page.active')) showPage(route.page);
  productHook(route.productId ?? null);
  document.title = pageTitle(route, route.productId ? findProduct(route.productId)?.name : undefined);
};

/** Navega e registra no histórico (botão Voltar funciona). `replace` não cria entrada nova. */
export const navigate = (route: Route, { replace = false } = {}) => {
  const hash = routeToHash(route);
  if (window.location.hash !== hash) {
    if (replace) history.replaceState(null, '', hash);
    else history.pushState(null, '', hash);
  }
  apply(route);
};

export const go = (page: PageId) => navigate({ page });

export const initRouter = () => {
  onAction('go', (el, event) => {
    event.preventDefault(); // <a href> continua servindo para "abrir em nova aba"
    go(el.dataset.page as PageId);
  });
  const fromLocation = () => {
    const route = parseHash(window.location.hash);
    // Confirmação e painel não fazem sentido abertos direto por link.
    apply(route.page === 'confirmacao' || route.page === 'painel' ? { page: 'home' } : route);
  };
  window.addEventListener('popstate', fromLocation);
  window.addEventListener('hashchange', fromLocation);
  fromLocation();
};
