export const byId = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado`);
  return el as T;
};

export const qsa = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll<T>(selector));

export type ActionHandler = (el: HTMLElement, event: Event) => void;

const clickActions = new Map<string, ActionHandler>();
const enterActions = new Map<string, ActionHandler>();
const inputActions = new Map<string, ActionHandler>();

export const onAction = (name: string, handler: ActionHandler) => clickActions.set(name, handler);
export const onEnter = (name: string, handler: ActionHandler) => enterActions.set(name, handler);
export const onInput = (name: string, handler: ActionHandler) => inputActions.set(name, handler);

/**
 * Delegação de eventos: elementos declaram `data-action="nome"` no HTML.
 * `data-stop` interrompe a busca (equivale ao antigo event.stopPropagation()).
 */
export const bindActions = (root: Document | HTMLElement = document) => {
  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const el = target?.closest<HTMLElement>('[data-action], [data-stop]');
    if (!el || !('action' in el.dataset)) return;
    const handler = clickActions.get(el.dataset.action as string);
    handler?.(el, event);
  });
  root.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key !== 'Enter') return;
    const el = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-enter-action]');
    if (!el) return;
    enterActions.get(el.dataset.enterAction as string)?.(el, event);
  });
  root.addEventListener('input', (event) => {
    const el = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-input-action]');
    if (!el) return;
    inputActions.get(el.dataset.inputAction as string)?.(el, event);
  });
};

/** Marca um único item como ativo (classe `on`) entre seus irmãos de grupo. */
export const selectInGroup = (el: Element, groupSelector: string, itemSelector: string) => {
  const group = el.closest(groupSelector) ?? document;
  for (const item of qsa(itemSelector, group)) item.classList.remove('on');
  el.classList.add('on');
};
