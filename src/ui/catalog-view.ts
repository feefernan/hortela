import { isGarmentSize } from '../domain/cart';
import { type Product, products } from '../domain/catalog';
import { type CollectionFilter, FILTER_EMPTY_MESSAGE, filterProducts } from '../domain/collection-filter';
import { editionLabel } from '../domain/edition';
import { formatBRL } from '../domain/pricing';
import { routeToHash } from '../domain/routes';
import { track } from '../infra/telemetry';
import { watercolorSVG } from './art';
import { addProductToCart } from './cart';
import { byId, onAction, qsa, selectInGroup } from './dom';
import { navigate, setProductHook } from './router';

const badgeHTML = (p: Product) =>
  p.status === 'last'
    ? '<div class="p-badge">Última</div>'
    : p.status === 'sold'
      ? '<div class="p-badge" style="background:var(--sage)">Esgotada</div>'
      : '';

const infoHTML = (p: Product, cls: string) => `
  <div class="${cls}">
    <div class="p-collection">${p.collection}</div>
    <div class="p-name">${p.name}</div>
    <div class="p-row">
      <span class="p-price">${formatBRL(p.price)}</span>
      <span class="p-edition">${editionLabel(p)}</span>
    </div>
  </div>`;

const homeCardHTML = (p: Product, i: number) => `
  <a class="p-card" href="${routeToHash({ page: 'loja', productId: p.id })}" style="--i:${i}" data-action="open-product" data-product="${p.id}">
    <div class="p-art"><div class="p-art-inner">${watercolorSVG(p.palette, 160)}</div></div>
    ${infoHTML(p, 'p-info')}
    ${badgeHTML(p)}
  </a>`;

const collectionCardHTML = (p: Product, i: number) => {
  const available = p.status !== 'sold';
  return `
  <${available ? 'a' : 'div'} class="loja-card" style="--i:${i}"${available ? ` href="${routeToHash({ page: 'loja', productId: p.id })}" data-action="open-product" data-product="${p.id}"` : ''}>
    <div class="loja-art"><div class="loja-art-inner">${watercolorSVG(p.palette, 180)}</div></div>
    ${infoHTML(p, 'loja-info')}
    ${available ? '<div class="loja-hover"><span class="btn-ver">Ver peça</span></div>' : ''}
    ${badgeHTML(p)}
  </${available ? 'a' : 'div'}>`;
};

let openProductId: string | null = null;
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
  if (!p) return;
  openProductId = id;
  // Cada peça abre no tamanho padrão (G), sem herdar a escolha da peça anterior.
  for (const sz of qsa('#modal-bg .sz')) sz.classList.toggle('on', sz.textContent?.trim() === 'G');
  byId('m-col').textContent = `${p.collection} · ${editionLabel(p)}`;
  byId('m-name').textContent = p.name;
  byId('m-story').textContent = p.story;
  byId('m-price').textContent = formatBRL(p.price);
  byId('m-art').innerHTML = watercolorSVG(p.palette, 220);
  byId('modal-bg').classList.add('open');
};

const hideProduct = () => {
  openProductId = null;
  byId('modal-bg').classList.remove('open');
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
  byId('home-grid').innerHTML = products().slice(0, 3).map(homeCardHTML).join('');
  renderCollection(currentFilter);
};

/** Redesenha com o catálogo vivo (preço e estoque do Notion), inclusive a peça aberta. */
export const refreshCatalog = () => {
  renderAll();
  if (openProductId) showProduct(openProductId);
};

export const initCatalog = () => {
  renderAll();
  for (const id of ['home-grid', 'loja-grid']) byId(id).removeAttribute('aria-busy');
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
