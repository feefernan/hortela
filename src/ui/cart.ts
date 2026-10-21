import {
  addToCart,
  type Cart,
  cartCount,
  cartSubtotal,
  type GarmentSize,
  isGarmentSize,
  removeLine,
  withCurrentCatalog,
} from '../domain/cart';
import { findProduct } from '../domain/catalog';
import { escapeHtml as e } from '../domain/escape';
import { formatBRL } from '../domain/pricing';
import type { CartStorage } from '../infra/cart-storage';
import { track } from '../infra/telemetry';
import { watercolorSVG } from './art';
import { byId, onAction, setLayerOpen } from './dom';
import { bump } from './motion';
import { go } from './router';
import { toast } from './toast';

let cart: Cart = [];
let storage: CartStorage | null = null;
let lastFocus: HTMLElement | null = null;

const persist = () => storage?.save(cart);

const renderBadge = () => {
  const badge = byId('cn');
  const count = cartCount(cart);
  badge.textContent = String(count);
  badge.classList.toggle('on', count > 0);
  byId('cart-open-btn').setAttribute(
    'aria-label',
    count ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio',
  );
};

const renderDrawer = () => {
  const lines = byId('cart-lines');
  const foot = byId('cart-foot');
  if (!cart.length) {
    foot.hidden = true;
    lines.innerHTML = `<div class="cart-empty">
      <p>Seu carrinho está vazio.</p>
      <button type="button" class="btn btn-ghost" data-action="cart-browse">Ver coleção</button>
    </div>`;
    return;
  }
  foot.hidden = false;
  lines.innerHTML = cart
    .map((l, i) => {
      const p = findProduct(l.productId);
      return `<div class="cart-line" style="--i:${i}">
        <div class="cart-line-art">${p ? watercolorSVG(p.palette, 64) : ''}</div>
        <div>
          <div class="cart-line-name">${e(l.name)}</div>
          <div class="cart-line-meta">Tamanho ${e(l.size)} · ${l.qty} ${l.qty === 1 ? 'unidade' : 'unidades'}</div>
        </div>
        <div class="cart-line-side">
          ${formatBRL(l.unitPrice * l.qty)}
          <button type="button" class="cart-line-remove" data-action="remove-cart-line"
            data-product="${e(l.productId)}" data-size="${e(l.size)}" aria-label="Remover ${e(l.name)} ${e(l.size)}">Remover</button>
        </div>
      </div>`;
    })
    .join('');
  byId('cart-subtotal').textContent = formatBRL(cartSubtotal(cart));
};

const render = () => {
  renderBadge();
  renderDrawer();
};

const openCart = () => {
  lastFocus = document.activeElement as HTMLElement | null;
  renderDrawer();
  setLayerOpen('cart-drawer-bg', true);
  byId('cart-open-btn').setAttribute('aria-expanded', 'true');
  byId('cart-drawer').querySelector<HTMLElement>('button')?.focus();
};

const closeCart = () => {
  setLayerOpen('cart-drawer-bg', false);
  byId('cart-open-btn').setAttribute('aria-expanded', 'false');
  lastFocus?.focus?.();
};

/** Adiciona uma peça da coleção. Retorna true se entrou no carrinho. */
export const addProductToCart = (productId: string, size: GarmentSize): boolean => {
  const product = findProduct(productId);
  if (!product) return false;
  const result = addToCart(cart, product, size);
  if (!result.ok) {
    toast(result.reason === 'esgotada' ? 'Esta peça esgotou' : 'Limite desta peça já está no carrinho');
    return false;
  }
  cart = result.cart;
  persist();
  render();
  bump(byId('cn'));
  toast(`"${product.name}" (${size}) no carrinho`);
  return true;
};

export const clearCart = () => {
  cart = [];
  persist();
  render();
};

/** Atualiza o carrinho guardado com o catálogo vivo: preço novo, sem esgotadas, dentro do estoque. */
export const refreshCart = () => {
  cart = withCurrentCatalog(cart);
  persist();
  render();
};

export const initCart = (cartStorage: CartStorage, onCheckout: (lines: Cart) => void) => {
  storage = cartStorage;
  cart = cartStorage.load();
  const trigger = document.querySelector<HTMLElement>('[data-action="open-cart"]');
  if (trigger) trigger.id = 'cart-open-btn';
  render();

  onAction('open-cart', () => track('carrinho.abrir', { itens: cartCount(cart) }, openCart));
  onAction('close-cart', closeCart);
  onAction('cart-browse', () => {
    closeCart();
    go('loja');
  });
  onAction('remove-cart-line', (el) => {
    const size = el.dataset.size;
    if (!isGarmentSize(size)) return;
    cart = removeLine(cart, el.dataset.product ?? '', size);
    persist();
    render();
  });
  onAction('checkout-cart', () => {
    if (!cart.length) return;
    closeCart();
    onCheckout(cart);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && byId('cart-drawer-bg').classList.contains('open')) closeCart();
  });
};
