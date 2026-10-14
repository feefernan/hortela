import { byId, onAction } from './dom';
import { toast } from './toast';

let count = 0;

export const addToCart = () => {
  count++;
  const badge = byId('cn');
  badge.textContent = String(count);
  badge.classList.add('on');
};

export const initCart = () => {
  onAction('cart', () => toast('Carrinho vazio'));
};
