/**
 * PROTÓTIPO (Fase P): três variações das páginas públicas, trocadas por `?variant=A|B|C`.
 * Montado só em dev (src/main.ts, `import.meta.env.DEV`); nunca vai para a main.
 * Rotas #/, #/colecao, #/peca/:id e #/sobre mostram a variação; #/estudio segue o site real.
 */
import { parseHash, type Route } from '../domain/routes';
import './prototype.css';
import { sampleStock } from './shared';
import * as A from './variant-a/variant';
import * as B from './variant-b/variant';
import * as C from './variant-c/variant';

export interface Variant {
  key: string;
  name: string;
  render: (route: Route) => string;
  /** Liga comportamento depois de renderizar; devolve a limpeza. */
  mount: (root: HTMLElement, route: Route) => () => void;
}

const VARIANTS: Variant[] = [A, B, C];

const currentKey = () => {
  const v = new URLSearchParams(window.location.search).get('variant')?.toUpperCase();
  return VARIANTS.some((x) => x.key === v) ? (v as string) : 'A';
};

const root = document.createElement('div');
root.id = 'proto-root';
const bar = document.createElement('div');
bar.className = 'proto-bar';
bar.dataset.protoBar = '';
bar.innerHTML = `<button type="button" data-step="-1" aria-label="Variação anterior">←</button>
  <span class="proto-bar-label" aria-live="polite"></span>
  <button type="button" data-step="1" aria-label="Próxima variação">→</button>
  <span class="proto-bar-note"></span>`;
document.body.append(root, bar);

let cleanup = () => {};
let lastKey = '';
let lastHash = '';

const render = () => {
  const variant = VARIANTS.find((v) => v.key === currentKey()) ?? A;
  const route = parseHash(window.location.hash);
  const showsVariant = route.page === 'home' || route.page === 'loja' || route.page === 'sobre';
  const html = document.documentElement;
  for (const v of VARIANTS) html.classList.remove(`proto-${v.key}`);
  html.classList.toggle('proto-on', showsVariant);
  cleanup();
  cleanup = () => {};
  if (showsVariant) {
    html.classList.add(`proto-${variant.key}`);
    root.innerHTML = variant.render(route);
    cleanup = variant.mount(root, route);
    if (variant.key !== lastKey || window.location.hash !== lastHash) window.scrollTo(0, 0);
  } else {
    root.innerHTML = '';
  }
  lastKey = variant.key;
  lastHash = window.location.hash;
  bar.querySelector('.proto-bar-label')!.textContent = `${variant.key} (${variant.name})`;
  bar.querySelector('.proto-bar-note')!.textContent = showsVariant
    ? `Imagens provisórias (aquarela de código)${sampleStock ? ' · estoque de exemplo' : ''}`
    : 'Estúdio real, sem variação';
};

const step = (delta: number) => {
  const i = VARIANTS.findIndex((v) => v.key === currentKey());
  const next = VARIANTS[(i + delta + VARIANTS.length) % VARIANTS.length];
  const url = new URL(window.location.href);
  url.searchParams.set('variant', next.key);
  history.replaceState(null, '', url);
  render();
};

bar.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-step]');
  if (button) step(Number(button.dataset.step));
});

window.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const el = document.activeElement as HTMLElement | null;
  if (el?.matches('input, textarea, select, [contenteditable]') || el?.isContentEditable) return;
  step(event.key === 'ArrowLeft' ? -1 : 1);
});

window.addEventListener('hashchange', render);
window.addEventListener('popstate', render);
render();
