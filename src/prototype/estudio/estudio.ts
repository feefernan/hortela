/**
 * Segunda rodada da Fase P — Estúdio no celular (tela de app). Muda só o arranjo dos controles
 * do Estúdio real (#estudio); nada é recriado, os botões continuam os de verdade.
 *   A  Folha de baixo   camiseta presa no alto, estampas e peça numa folha que sobe de baixo
 *   B  Abas             camiseta presa no alto, um painel por vez: Estampas, Peça, Camadas
 *   C  Gaveta lateral   camiseta ocupa a tela, controles deslizam da direita
 */
import './estudio.css';

export interface StudioVariant {
  key: string;
  name: string;
  mount: (shell: HTMLElement) => () => void;
}

const el = (html: string) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};

/** Escala da camiseta para caber no espaço que sobrou no alto. */
const fitShirt = (stageHeight: () => number) => {
  const set = () => {
    const room = stageHeight() - 24;
    document.documentElement.style.setProperty(
      '--pvs-scale',
      String(Math.min(1, Math.max(0.35, room / 416)).toFixed(3)),
    );
  };
  set();
  window.addEventListener('resize', set);
  return () => {
    window.removeEventListener('resize', set);
    document.documentElement.style.removeProperty('--pvs-scale');
  };
};

/** Junta estampas e controles num só bloco que a variação move como quiser. */
const wrapPanels = (shell: HTMLElement) => {
  const sl = shell.querySelector<HTMLElement>('.sl');
  const sr = shell.querySelector<HTMLElement>('.sr');
  const panel = el('<div class="pvs-panel"></div>');
  if (sl && sr) panel.append(sl, sr);
  shell.append(panel);
  return {
    panel,
    sl,
    sr,
    undo: () => {
      if (sl && sr) shell.append(sl, sr);
      panel.remove();
    },
  };
};

export const A: StudioVariant = {
  key: 'A',
  name: 'Folha de baixo',
  mount: (shell) => {
    const { panel, undo } = wrapPanels(shell);
    const handle = el(
      '<button type="button" class="pvs-handle" aria-expanded="true">Estampas e peça <span aria-hidden="true">↓</span></button>',
    );
    panel.prepend(handle);
    const toggle = () => {
      const open = panel.classList.toggle('closed') === false;
      handle.setAttribute('aria-expanded', String(open));
      handle.querySelector('span')!.textContent = open ? '↓' : '↑';
    };
    handle.addEventListener('click', toggle);
    const unfit = fitShirt(() => window.innerHeight * 0.64 - 190);
    return () => {
      handle.removeEventListener('click', toggle);
      unfit();
      undo();
    };
  },
};

export const B: StudioVariant = {
  key: 'B',
  name: 'Abas',
  mount: (shell) => {
    const tabs = el(`<div class="pvs-tabs" role="tablist">
      <button type="button" role="tab" data-tab="estampas" aria-selected="true">Estampas</button>
      <button type="button" role="tab" data-tab="peca" aria-selected="false">Peça</button>
      <button type="button" role="tab" data-tab="camadas" aria-selected="false">Camadas</button>
    </div>`);
    const { panel, undo } = wrapPanels(shell);
    panel.prepend(tabs);
    panel.dataset.tab = 'estampas';
    const onClick = (e: Event) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
      if (!b) return;
      panel.dataset.tab = b.dataset.tab;
      for (const t of tabs.children) t.setAttribute('aria-selected', String(t === b));
    };
    tabs.addEventListener('click', onClick);
    const unfit = fitShirt(() => window.innerHeight * 0.4 - 60);
    return () => {
      tabs.removeEventListener('click', onClick);
      unfit();
      undo();
    };
  },
};

export const C: StudioVariant = {
  key: 'C',
  name: 'Gaveta lateral',
  mount: (shell) => {
    const { panel, undo } = wrapPanels(shell);
    const open = el('<button type="button" class="pvs-open" aria-expanded="false">Estampas e peça →</button>');
    const close = el('<button type="button" class="pvs-close">Fechar</button>');
    panel.prepend(close);
    shell.append(open);
    const set = (on: boolean) => {
      panel.classList.toggle('open', on);
      open.setAttribute('aria-expanded', String(on));
    };
    const onOpen = () => set(true);
    const onClose = () => set(false);
    open.addEventListener('click', onOpen);
    close.addEventListener('click', onClose);
    const unfit = fitShirt(() => window.innerHeight - 220);
    return () => {
      open.removeEventListener('click', onOpen);
      close.removeEventListener('click', onClose);
      open.remove();
      unfit();
      undo();
    };
  },
};

export const STUDIO_VARIANTS = [A, B, C];
