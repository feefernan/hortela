/**
 * PROTÓTIPO (Fase P): três variações das páginas públicas, trocadas por `?variant=A|B|C`.
 * Montado só em dev (src/main.ts, `import.meta.env.DEV`); nunca vai para a main.
 * Rotas #/, #/colecao, #/peca/:id e #/sobre mostram a variação; #/estudio segue o site real.
 */
import { parseHash, type Route } from '../domain/routes';
import './prototype.css';
import { STUDIO_VARIANTS } from './estudio/estudio';
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

const onStudio = () => parseHash(window.location.hash).page === 'estudio';
const param = () => (onStudio() ? 'estudio' : 'variant');
const keys = () => (onStudio() ? STUDIO_VARIANTS : VARIANTS);
const currentKey = () => {
  const v = new URLSearchParams(window.location.search).get(param())?.toUpperCase();
  return keys().some((x) => x.key === v) ? (v as string) : 'A';
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
let studioCleanup = () => {};
let lastKey = '';
let lastHash = '';

const renderStudio = () => {
  const v = STUDIO_VARIANTS.find((x) => x.key === currentKey()) ?? STUDIO_VARIANTS[0];
  const html = document.documentElement;
  for (const x of STUDIO_VARIANTS) html.classList.remove(`proto-est-${x.key}`);
  html.classList.remove('proto-on');
  html.classList.add(`proto-est-${v.key}`);
  root.innerHTML = '';
  const shell = document.querySelector<HTMLElement>('#estudio .studio-shell');
  if (shell) studioCleanup = v.mount(shell);
  bar.querySelector('.proto-bar-label')!.textContent = `Estúdio ${v.key} (${v.name})`;
  bar.querySelector('.proto-bar-note')!.textContent = 'Só muda no celular (abra a 390 px)';
};

const render = () => {
  studioCleanup();
  studioCleanup = () => {};
  for (const x of STUDIO_VARIANTS) document.documentElement.classList.remove(`proto-est-${x.key}`);
  if (onStudio()) {
    cleanup();
    cleanup = () => {};
    renderStudio();
    return;
  }
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
  const list = keys();
  const i = list.findIndex((v) => v.key === currentKey());
  const next = list[(i + delta + list.length) % list.length];
  const url = new URL(window.location.href);
  url.searchParams.set(param(), next.key);
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
