import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  animateOut,
  bump,
  installLazyImages,
  prefersReducedMotion,
  removeWithExit,
  settleLoadedImages,
} from '../../src/ui/motion';
import { nextFrame, startButtonProgress } from '../../src/ui/progress';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('motion', () => {
  it('sem animação CSS ativa, a saída conclui na hora', () => {
    document.body.innerHTML = '<div id="a"></div>';
    const el = document.getElementById('a') as HTMLElement;
    const done = vi.fn();
    animateOut(el, 'page-leaving', done);
    expect(el.classList.contains('page-leaving')).toBe(true);
    expect(done).toHaveBeenCalledOnce();
  });

  it('com animação ativa, espera o animationend (uma única vez)', () => {
    document.body.innerHTML = '<div id="a"></div>';
    const el = document.getElementById('a') as HTMLElement;
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ animationName: 'exit' } as CSSStyleDeclaration);
    vi.useFakeTimers();
    const done = vi.fn();
    animateOut(el, 'removing', done);
    expect(done).not.toHaveBeenCalled();
    el.dispatchEvent(new Event('animationend'));
    vi.advanceTimersByTime(500);
    expect(done).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('respeita prefers-reduced-motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(true);
    document.body.innerHTML = '<div id="a"></div>';
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ animationName: 'exit' } as CSSStyleDeclaration);
    const done = vi.fn();
    animateOut(document.getElementById('a') as HTMLElement, 'removing', done);
    expect(done).toHaveBeenCalledOnce();
  });

  it('removeWithExit tira o elemento do DOM', () => {
    document.body.innerHTML = '<div id="a"></div>';
    const onRemoved = vi.fn();
    removeWithExit(document.getElementById('a') as HTMLElement, onRemoved);
    expect(document.getElementById('a')).toBeNull();
    expect(onRemoved).toHaveBeenCalled();
  });

  it('bump reinicia a classe de pulso', () => {
    document.body.innerHTML = '<span id="b" class="bump"></span>';
    const el = document.getElementById('b') as HTMLElement;
    bump(el);
    expect(el.classList.contains('bump')).toBe(true);
  });

  it('lazy images: tira o placeholder ao carregar ou falhar', () => {
    installLazyImages();
    document.body.innerHTML =
      '<div class="is-loading" id="t1"><img data-lazy id="i1"></div><div class="is-loading" id="t2"><img data-lazy id="i2"></div>';
    document.getElementById('i1')?.dispatchEvent(new Event('load'));
    document.getElementById('i2')?.dispatchEvent(new Event('error'));
    expect(document.getElementById('i1')?.classList.contains('is-loaded')).toBe(true);
    expect(document.getElementById('t1')?.classList.contains('is-loading')).toBe(false);
    expect(document.getElementById('t2')?.classList.contains('is-loading')).toBe(false);
  });

  it('settleLoadedImages marca imagens já em cache', () => {
    document.body.innerHTML = '<div class="is-loading"><img data-lazy id="c"></div>';
    const img = document.getElementById('c') as HTMLImageElement;
    Object.defineProperty(img, 'complete', { value: true });
    Object.defineProperty(img, 'naturalWidth', { value: 10 });
    settleLoadedImages();
    expect(img.classList.contains('is-loaded')).toBe(true);
  });
});

describe('progresso em botão', () => {
  it('mostra etapas, barra e restaura o botão ao final', async () => {
    document.body.innerHTML = '<button id="b">Finalizar pedido</button>';
    const btn = document.getElementById('b') as HTMLButtonElement;
    const progress = startButtonProgress(btn, 'Gerando…');
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.querySelector('.progress-label')?.textContent).toBe('Gerando…');

    progress.step(0.5, 'Salvando…');
    expect(btn.querySelector('.progress-label')?.textContent).toBe('Salvando…');
    expect((btn.querySelector('.progress-bar') as HTMLElement).style.getPropertyValue('--progress')).toBe('0.5');
    expect(btn.getAttribute('aria-valuenow')).toBe('50');

    progress.step(2, 'Salvando…');
    expect(btn.getAttribute('aria-valuenow')).toBe('100');

    await nextFrame();
    progress.done();
    expect(btn.textContent).toBe('Finalizar pedido');
    expect(btn.disabled).toBe(false);
    expect(btn.hasAttribute('aria-busy')).toBe(false);
  });
});
