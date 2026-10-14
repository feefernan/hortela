import { isGarmentSize } from '../domain/cart';
import { PRODUCTS, type Product } from '../domain/catalog';
import { type CollectionFilter, FILTER_EMPTY_MESSAGE, filterProducts } from '../domain/collection-filter';
import { editionLabel } from '../domain/edition';
import { formatBRL } from '../domain/pricing';
import { track } from '../infra/telemetry';
import { watercolorSVG } from './art';
import { addProductToCart } from './cart';
import { byId, onAction, qsa, selectInGroup } from './dom';

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
  <div class="p-card" style="--i:${i}" data-action="open-product" data-product="${p.id}">
    <div class="p-art"><div class="p-art-inner">${watercolorSVG(p.palette, 160)}</div></div>
    ${infoHTML(p, 'p-info')}
    ${badgeHTML(p)}
  </div>`;

const collectionCardHTML = (p: Product, i: number) => {
  const available = p.status !== 'sold';
  return `
  <div class="loja-card" style="--i:${i}"${available ? ` data-action="open-product" data-product="${p.id}"` : ''}>
    <div class="loja-art"><div class="loja-art-inner">${watercolorSVG(p.palette, 180)}</div></div>
    ${infoHTML(p, 'loja-info')}
    ${available ? '<div class="loja-hover"><button class="btn-ver">Ver peça</button></div>' : ''}
    ${badgeHTML(p)}
  </div>`;
};

let openProductId: string | null = null;

const renderCollection = (filter: CollectionFilter) => {
  const items = filterProducts(PRODUCTS, filter);
  byId('loja-grid').innerHTML = items.map(collectionCardHTML).join('');
  const empty = byId('loja-empty');
  empty.hidden = items.length > 0;
  empty.textContent = items.length ? '' : FILTER_EMPTY_MESSAGE[filter];
};

const openProduct = (id: string) => {
  const p = PRODUCTS.find((x) => x.id === id);
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

const closeProduct = () => byId('modal-bg').classList.remove('open');

export const initCatalog = () => {
  byId('home-grid').innerHTML = PRODUCTS.slice(0, 3).map(homeCardHTML).join('');
  renderCollection('todas');
  for (const id of ['home-grid', 'loja-grid']) byId(id).removeAttribute('aria-busy');

  onAction('open-product', (el) => {
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
