/**
 * Progresso dentro de um botão: rótulo da etapa + barra (transform: scaleX).
 * Usado em ações com espera (finalizar pedido, gerar certificado).
 */
export interface ButtonProgress {
  step(fraction: number, label: string): void;
  done(): void;
}

export const startButtonProgress = (button: HTMLButtonElement, firstLabel: string): ButtonProgress => {
  const original = button.innerHTML;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.classList.add('has-progress');
  button.innerHTML = '<span class="progress-label"></span><span class="progress-bar" aria-hidden="true"></span>';
  const bar = button.querySelector<HTMLElement>('.progress-bar') as HTMLElement;

  const step = (fraction: number, text: string) => {
    const clamped = Math.max(0, Math.min(1, fraction));
    bar.style.setProperty('--progress', String(clamped));
    button.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
    const label = button.querySelector<HTMLElement>('.progress-label');
    if (label && label.textContent !== text) {
      // Troca o nó para reiniciar a animação de entrada do novo rótulo.
      const next = document.createElement('span');
      next.className = 'progress-label';
      next.textContent = text;
      label.replaceWith(next);
    }
  };
  step(0.05, firstLabel);

  return {
    step,
    done: () => {
      button.classList.remove('has-progress');
      button.removeAttribute('aria-busy');
      button.removeAttribute('aria-valuenow');
      button.innerHTML = original;
      button.disabled = false;
    },
  };
};

/** Cede um frame para a UI pintar o progresso antes de trabalho pesado (canvas, serialização). */
export const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
