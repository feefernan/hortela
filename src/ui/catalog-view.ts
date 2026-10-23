import { isGarmentSize } from '../domain/cart';
import { featuredProducts, type Product, products } from '../domain/catalog';
import { type CollectionFilter, FILTER_EMPTY_MESSAGE, filterProducts } from '../domain/collection-filter';
import { editionLabel } from '../domain/edition';
import { escapeHtml as e } from '../domain/escape';
import { formatBRL } from '../domain/pricing';
import { routeToHash } from '../domain/routes';
import { track } from '../infra/telemetry';
import { pieceArtHTML } from './art';
import { addProductToCart } from './cart';
import { byId, onAction, qsa, selectInGroup, setLayerOpen } from './dom';
import { navigate, setProductHook } from './router';

const badgeHTML = (p: Product) =>
  p.status === 'last'
    ? '<div class="p-badge">Última</div>'
    : p.status === 'sold'
      ? '<div class="p-badge" style="background:var(--folha)">Esgotada</div>'
      : '';

const infoHTML = (p: Product, cls: string) => `
  <div class="${cls}">
    <div class="p-collection">${e(p.collection)}</div>
    <div class="p-name">${e(p.name)}</div>
    <div class="p-row">
      <span class="p-price">${formatBRL(p.price)}</span>
      <span class="p-edition">${editionLabel(p)}</span>
    </div>
  </div>`;

const homeCardHTML = (p: Product, i: number) => `
  <a class="p-card" href="${e(routeToHash({ page: 'loja', productId: p.id }))}" style="--i:${i}" data-action="open-product" data-product="${e(p.id)}">
    <div class="p-art"><div class="p-art-inner">${pieceArtHTML(p, 160)}</div></div>
    ${infoHTML(p, 'p-info')}
    ${badgeHTML(p)}
  </a>`;

const collectionCardHTML = (p: Product, i: number) => {
  const available = p.status !== 'sold';
  return `
  <${available ? 'a' : 'div'} class="loja-card" style="--i:${i}"${available ? ` href="${e(routeToHash({ page: 'loja', productId: p.id }))}" data-action="open-product" data-product="${e(p.id)}"` : ''}>
    <div class="loja-art"><div class="loja-art-inner">${pieceArtHTML(p, 180)}</div></div>
    ${infoHTML(p, 'loja-info')}
    ${available ? '<div class="loja-hover"><span class="btn-ver">Ver peça</span></div>' : ''}
    ${badgeHTML(p)}
  </${available ? 'a' : 'div'}>`;
};

let openProductId: string | null = null;
/** Peça pedida pelo link antes de o catálogo chegar do Notion; abre quando ele chega. */
let pendingProductId: string | null = null;
/** true quando o modal foi aberto por clique aqui (há uma entrada de histórico para desfazer). */
let openedInApp = false;
let currentFilter: CollectionFilter = 'todas';

const renderCollection = (filter: CollectionFilter) => {
  currentFilter = filter;
  const items = filterProducts(products(), filter);
  byId('loja-grid').innerHTML = items.map(collectionCardHTML).join('');
  const empty = byId('loja-empty');
  empty.hidden = items.length > 0;
  empty.textContent = items.length ? '' : FILTER_EMPTY_MESSAGE[filter];
};

const showProduct = (id: string) => {
  const p = products().find((x) => x.id === id);
  if (!p) {
    pendingProductId = id;
    return;
  }
  pendingProductId = null;
  openProductId = id;
  // Cada peça abre no tamanho padrão (G), sem herdar a escolha da peça anterior.
  for (const sz of qsa('#modal-bg .sz')) sz.classList.toggle('on', sz.textContent?.trim() === 'G');
  byId('m-col').textContent = `${p.collection} · ${editionLabel(p)}`;
  byId('m-name').textContent = p.name;
  byId('m-story').textContent = p.story;
  byId('m-price').textContent = formatBRL(p.price);
  byId('m-art').innerHTML = pieceArtHTML(p, 220);
  setLayerOpen('modal-bg', true);
};

const hideProduct = () => {
  openProductId = null;
  setLayerOpen('modal-bg', false);
};

/** Abre a peça e muda a URL para #/peca/:id (link compartilhável). */
const openProduct = (id: string) => {
  openedInApp = true;
  navigate({ page: 'loja', productId: id });
};

/** Fecha o modal; se ele foi aberto aqui, o Voltar do histórico desfaz a entrada #/peca/:id. */
const closeProduct = () => {
  if (!openProductId) return;
  hideProduct();
  if (openedInApp) {
    openedInApp = false;
    history.back();
  } else {
    navigate({ page: 'loja' }, { replace: true });
  }
};

const renderAll = () => {
  byId('home-grid').innerHTML = featuredProducts().map(homeCardHTML).join('');
  renderCollection(currentFilter);
  for (const id of ['home-grid', 'loja-grid']) byId(id).removeAttribute('aria-busy');
};

/** Desenha o catálogo vivo (do Notion, ou o do código se ele falhar), inclusive a peça aberta ou pedida. */
export const refreshCatalog = () => {
  renderAll();
  const id = openProductId ?? pendingProductId;
  if (id) showProduct(id);
};

/** Liga as ações; as grades ficam em skeleton até `refreshCatalog` (catálogo chegou ou falhou). */
export const initCatalog = () => {
  setProductHook((id) => (id ? showProduct(id) : hideProduct()));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openProductId) closeProduct();
  });

  onAction('open-product', (el, event) => {
    event.preventDefault();
    const id = el.dataset.product as string;
    track('produto.abrir', { produto: id }, () => openProduct(id));
  });
  onAction('close-product', closeProduct);
  onAction('buy-product', () =>
    track('carrinho.adicionar', { origem: 'colecao' }, () => {
      const size = document.querySelector('#modal-bg .sz.on')?.textContent?.trim();
      if (!openProductId || !isGarmentSize(size)) return;
      if (addProductToCart(openProductId, size)) closeProduct();
    }),
  );
  onAction('pick-size', (el) => selectInGroup(el, '.sz-row', '.sz'));
  onAction('filter', (el) => {
    selectInGroup(el, '.loja-top-right', '.filter-pill');
    for (const pill of qsa('.filter-pill')) pill.setAttribute('aria-pressed', String(pill === el));
    renderCollection(el.dataset.filter as CollectionFilter);
  });
};
