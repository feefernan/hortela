import { PRODUCTS, type Product } from '../domain/catalog';
import { editionLabel } from '../domain/edition';
import { formatBRL } from '../domain/pricing';
import { track } from '../infra/telemetry';
import { watercolorSVG } from './art';
import { addToCart } from './cart-badge';
import { byId, onAction, selectInGroup } from './dom';

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

const openProduct = (id: string) => {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) return;
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
  byId('loja-grid').innerHTML = PRODUCTS.map(collectionCardHTML).join('');
  for (const id of ['home-grid', 'loja-grid']) byId(id).removeAttribute('aria-busy');

  onAction('open-product', (el) => {
    const id = el.dataset.product as string;
    track('produto.abrir', { produto: id }, () => openProduct(id));
  });
  onAction('close-product', closeProduct);
  onAction('buy-product', () =>
    track('carrinho.adicionar', { origem: 'colecao' }, () => {
      addToCart();
      closeProduct();
    }),
  );
  onAction('pick-size', (el) => selectInGroup(el, '.sz-row', '.sz'));
  onAction('filter', (el) => selectInGroup(el, '.loja-top-right', '.filter-pill'));
};
