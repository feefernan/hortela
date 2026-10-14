/** Utilitários de motion. Regras em src/styles/motion.css e na skill design-motion-principles. */

export const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** true quando o elemento tem uma animação CSS ativa (no jsdom/sem CSS é sempre false). */
const isAnimating = (el: Element): boolean => {
  const name = getComputedStyle(el).animationName;
  return Boolean(name) && name !== 'none' && !prefersReducedMotion();
};

/**
 * Aplica a classe de saída e chama `done` quando a animação termina.
 * Sem animação (movimento reduzido, testes), chama na hora.
 */
export const animateOut = (el: HTMLElement, className: string, done: () => void) => {
  el.classList.add(className);
  if (!isAnimating(el)) {
    done();
    return;
  }
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    done();
  };
  el.addEventListener('animationend', finish, { once: true });
  setTimeout(finish, 400); // garantia caso animationend não dispare
};

/** Remove o elemento após a animação de saída. */
export const removeWithExit = (el: HTMLElement, onRemoved?: () => void) =>
  animateOut(el, 'removing', () => {
    el.remove();
    onRemoved?.();
  });

/** Reinicia uma animação de "pulso" única (ex.: contador do carrinho). */
export const bump = (el: HTMLElement) => {
  el.classList.remove('bump');
  void el.offsetWidth; // força reflow para reiniciar a animação
  el.classList.add('bump');
};

const markLoaded = (img: HTMLImageElement) => {
  img.classList.add('is-loaded');
  img.closest('.is-loading')?.classList.remove('is-loading');
};

/**
 * Lazy loading com fade-in: imagens com `data-lazy` começam invisíveis e o contêiner
 * `.is-loading` mostra o placeholder; ao carregar (ou falhar) o placeholder sai.
 */
export const installLazyImages = () => {
  const handler = (event: Event) => {
    const img = event.target;
    if (img instanceof HTMLImageElement && 'lazy' in img.dataset) markLoaded(img);
  };
  document.addEventListener('load', handler, true);
  document.addEventListener('error', handler, true);
};

/** Marca como carregadas imagens que já estavam no cache antes do listener. */
export const settleLoadedImages = (root: ParentNode = document) => {
  for (const img of root.querySelectorAll<HTMLImageElement>('img[data-lazy]')) {
    if (img.complete && img.naturalWidth > 0) markLoaded(img);
  }
};
