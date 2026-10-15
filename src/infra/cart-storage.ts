import { type Cart, parseCart, withCurrentCatalog } from '../domain/cart';

export const CART_KEY = 'hortela_cart_v1';

export interface CartStorage {
  load(): Cart;
  save(cart: Cart): void;
}

/** Carrinho persistido no navegador (sobrevive a recarregar a página). */
export const createCartStorage = (storage: Storage = window.localStorage): CartStorage => ({
  load() {
    try {
      return withCurrentCatalog(parseCart(JSON.parse(storage.getItem(CART_KEY) ?? '[]')));
    } catch {
      return [];
    }
  },
  save(cart) {
    try {
      storage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // storage cheio/bloqueado: o carrinho continua só em memória
    }
  },
});
