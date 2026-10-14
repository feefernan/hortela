import { byId } from './dom';

let timer: ReturnType<typeof setTimeout> | undefined;

export const toast = (message: string) => {
  const el = byId('toast-el');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), 2400);
};
