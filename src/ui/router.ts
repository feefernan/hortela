import { byId, onAction, qsa } from './dom';

export type PageId = 'home' | 'loja' | 'estudio' | 'sobre' | 'confirmacao' | 'painel';

export const go = (id: PageId) => {
  for (const page of qsa('.page')) page.classList.remove('active');
  for (const link of qsa('.nav-center a')) link.classList.remove('active');
  byId(id).classList.add('active');
  document.getElementById(`n-${id}`)?.classList.add('active');
  window.scrollTo(0, 0);
};

export const initRouter = () => {
  onAction('go', (el) => go(el.dataset.page as PageId));
  go('home');
};
