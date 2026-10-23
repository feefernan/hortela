import { findStamp, type Stamp, stamps } from '../domain/catalog';
import { escapeHtml as e } from '../domain/escape';
import { BODY_PATH, COLLAR_PATH, SIDE_LABEL, type Side, viewLabel } from '../domain/garment';
import type { StudioConfig } from '../domain/orders';
import { nextPlacement, type Rect } from '../domain/placement';
import { formatBRL, MODELS, type ModelId, studioTotal } from '../domain/pricing';
import { isValidWord } from '../domain/validation';
import { layoutWord } from '../domain/word-layout';
import { track } from '../infra/telemetry';
import { stampImageHTML } from './art';
import { byId, onAction, onEnter, onInput, qsa, selectInGroup } from './dom';
import { removeWithExit } from './motion';
import { toast } from './toast';

type Gesture =
  | { kind: 'drag'; el: HTMLElement; sx: number; sy: number; ox: number; oy: number }
  | { kind: 'resize'; el: HTMLElement; sx: number; ow: number };

let selected: HTMLElement | null = null;
let gesture: Gesture | null = null;
let model: ModelId = 'oversized';
let side: Side = 'frente';
/** Escala visual do palco no celular (o palco tem 360×416 px de coordenadas). */
let stageScale = 1;

const SIDES: readonly Side[] = ['frente', 'costas'];
const zoneFor = (s: Side) => byId(s === 'frente' ? 'drop-zone' : 'drop-zone-back');
const activeZone = () => zoneFor(side);
// Estampas saindo (animação de remoção) já não contam como camadas.
const placedEls = (zone: HTMLElement = activeZone()) => qsa<HTMLElement>('.ps:not(.removing)', zone);
const sidesWithStamps = () => SIDES.filter((s) => placedEls(zoneFor(s)).length > 0);

/** Retângulo pelo style (funciona mesmo com a zona escondida, onde offset* é 0). */
export const rectOf = (el: HTMLElement): Rect => ({
  x: Number.parseFloat(el.style.left) || 0,
  y: Number.parseFloat(el.style.top) || 0,
  w: Number.parseFloat(el.style.width) || el.offsetWidth,
  h: Number.parseFloat(el.style.height) || el.offsetHeight,
});

const setHintVisible = (visible: boolean) => {
  byId('sc-hint').style.opacity = visible ? '1' : '0';
};
const refreshHint = () => setHintVisible(placedEls().length === 0);

const renderStampPicker = () => {
  const scroll = byId('stamps-scroll');
  scroll.innerHTML = '';
  scroll.removeAttribute('aria-busy');
  // Séries na ordem em que aparecem (a Ordem do Notion), mesmo que a lista as intercale.
  const bySeries = new Map<string, Stamp[]>();
  for (const s of stamps().filter((x) => x.series !== 'Alfabeto'))
    bySeries.set(s.series, [...(bySeries.get(s.series) ?? []), s]);
  for (const [series, items] of bySeries) {
    const heading = document.createElement('div');
    heading.className = 'ser-label';
    heading.textContent = series;
    scroll.appendChild(heading);
    const grid = document.createElement('div');
    grid.className = 'sg';
    for (const s of items) {
      const tile = document.createElement('div');
      tile.className = 'st is-loading';
      tile.title = s.name;
      tile.dataset.action = 'add-stamp';
      tile.dataset.stampId = s.id;
      tile.innerHTML = `${stampImageHTML(s, 52)}<div class="st-name">${e(s.name)}</div>`;
      grid.appendChild(tile);
    }
    scroll.appendChild(grid);
  }

  const label = document.createElement('div');
  label.className = 'ser-label';
  label.textContent = 'Alfabeto';
  scroll.appendChild(label);

  const wordBox = document.createElement('div');
  wordBox.style.cssText = 'padding:4px 2px 14px;';
  wordBox.innerHTML = `
    <input id="word-input" type="text" placeholder="Escreva uma palavra" data-enter-action="add-word"
      aria-label="Palavra com letras do alfabeto em aquarela"
      style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--dust);
        border-radius:4px;font-family:var(--body);font-size:13px;background:var(--white);">
    <div id="word-err" style="opacity:0;color:#a33;font-size:11.5px;font-style:italic;margin-top:6px;">
      Só letras de A a Z (sem acento, sem números).
    </div>
    <div style="font-size:11px;color:var(--sage-text);margin-top:6px;">Aperte Enter pra adicionar.</div>`;
  scroll.appendChild(wordBox);
};

const select = (el: HTMLElement) => {
  for (const p of placedEls()) p.classList.remove('sel');
  el.classList.add('sel');
  selected = el;
  const op = Number.parseFloat(el.dataset.op || '1') * 100;
  byId<HTMLInputElement>('op-slider').value = String(op);
  byId('op-val').textContent = `${Math.round(op)}%`;
  renderLayers();
};

const deselect = () => {
  for (const p of placedEls()) p.classList.remove('sel');
  selected = null;
  renderLayers();
};

const capturePointer = (target: Element, e: PointerEvent) => {
  try {
    target.setPointerCapture?.(e.pointerId);
  } catch {
    // Alguns ambientes (testes, navegadores antigos) não suportam captura.
  }
};

const place = (el: HTMLElement) => {
  // Pointer Events: mouse, caneta e toque com o mesmo código (#13).
  el.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.ps-del')) return;
    e.stopPropagation();
    e.preventDefault();
    select(el);
    capturePointer(el, e);
    const r = rectOf(el);
    gesture = target.closest('.ps-resize')
      ? { kind: 'resize', el, sx: e.clientX, ow: r.w }
      : { kind: 'drag', el, sx: e.clientX, sy: e.clientY, ox: r.x, oy: r.y };
  });
  activeZone().appendChild(el);
  select(el);
  renderLayers();
};

const controlsHTML =
  '<div class="ps-resize" aria-hidden="true"></div><button type="button" class="ps-del" data-action="remove-stamp" aria-label="Remover estampa">✕</button>';

const placementFor = (w: number, h: number) => {
  const wrap = byId('shirt-wrap');
  return nextPlacement(placedEls().map(rectOf), { w: wrap.offsetWidth || 360, h: wrap.offsetHeight || 416 }, { w, h });
};

const addStamp = (id: string) => {
  const s = findStamp(id);
  if (!s) return;
  setHintVisible(false);
  const size = 96;
  const { x, y } = placementFor(size, size);
  const el = document.createElement('div');
  el.className = 'ps';
  el.dataset.sid = id;
  el.dataset.op = '1';
  el.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;`;
  el.innerHTML = stampImageHTML(s, size, false) + controlsHTML;
  place(el);
  toast(`"${s.name}" adicionada`);
};

const addWord = (raw: string): boolean => {
  const errEl = document.getElementById('word-err');
  if (!raw.trim()) return false;
  if (!isValidWord(raw)) {
    if (errEl) errEl.style.opacity = '1';
    return false;
  }
  if (errEl) errEl.style.opacity = '0';
  const layout = layoutWord(raw);
  if (!layout) return false;
  setHintVisible(false);

  const word = raw.trim().toUpperCase();
  const size = 140;
  const dispH = size / layout.aspectRatio;
  const { x, y } = placementFor(size, dispH);
  const parts = layout.glyphs.map(
    (g) => `<image href="${g.href}" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" />`,
  );

  const el = document.createElement('div');
  el.className = 'ps';
  el.dataset.sid = `word-${word}`;
  el.dataset.op = '1';
  el.dataset.ar = layout.aspectRatio.toFixed(4);
  el.dataset.word = word;
  el.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${dispH}px;`;
  el.innerHTML = `<svg viewBox="0 0 ${layout.width} ${layout.height}" width="${size}" height="${dispH}">${parts.join('')}</svg>${controlsHTML}`;
  place(el);
  toast(`"${word}" adicionada`);
  return true;
};

const removeStamp = (el: HTMLElement) => {
  if (selected === el) selected = null;
  removeWithExit(el);
  renderLayers();
  refreshHint();
};

const layerThumb = (el: HTMLElement, stamp: Stamp | undefined): string => {
  if (el.dataset.word) {
    const svg = el.querySelector('svg');
    const ar = Number.parseFloat(el.dataset.ar || '1');
    return `<svg viewBox="${svg?.getAttribute('viewBox')}" width="${Math.round(20 * ar)}" height="20">${svg?.innerHTML ?? ''}</svg>`;
  }
  return stamp ? stampImageHTML(stamp, 20, false) : '';
};

/** Nome legível da camada, como aparece no pedido e no certificado (#8). */
const layerName = (el: HTMLElement): string =>
  el.dataset.word ? `Palavra "${el.dataset.word}"` : (findStamp(el.dataset.sid ?? '')?.name ?? 'Estampa');

const renderLayers = () => {
  const wrap = byId('layers-wrap');
  const els = placedEls();
  if (!els.length) {
    wrap.innerHTML = `<div style="font-family:var(--body);font-style:italic;font-size:13px;color:var(--sage-text);">Nenhuma estampa ${side === 'frente' ? 'na frente' : 'nas costas'}</div>`;
    return;
  }
  wrap.innerHTML = els
    .map((el, idx) => {
      const stamp = el.dataset.word ? undefined : findStamp(el.dataset.sid ?? '');
      return `<div class="layer-item ${el.classList.contains('sel') ? 'hi' : ''}" data-action="select-layer" data-index="${idx}">
        <div class="layer-thumb">${layerThumb(el, stamp)}</div>
        <div class="layer-name">${e(el.dataset.word ?? stamp?.name ?? 'Estampa')}</div>
        <button type="button" class="layer-del" title="Remover" aria-label="Remover camada" data-action="remove-layer" data-index="${idx}">✕</button>
      </div>`;
    })
    .reverse()
    .join('');
};

const pickModel = (el: HTMLElement) => {
  selectInGroup(el, '.model-row', '.mo');
  model = el.dataset.model as ModelId;
  const m = MODELS[model];
  byId('shirt-body').setAttribute('d', BODY_PATH[model]);
  byId('o-model').textContent = m.label;
  byId('o-mprice').textContent = formatBRL(m.price);
  byId('o-total').textContent = formatBRL(studioTotal(model));
};

const setView = (next: Side) => {
  side = next;
  deselect();
  for (const s of SIDES) zoneFor(s).hidden = s !== side;
  for (const btn of qsa<HTMLElement>('[data-action="view"]')) {
    const on = btn.dataset.view === side;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  }
  byId('shirt-collar').setAttribute('d', COLLAR_PATH[side]);
  refreshHint();
  renderLayers();
  toast(side === 'costas' ? 'Vista traseira' : 'Vista frontal');
};

const clearComposition = (silent = false) => {
  activeZone().innerHTML = '';
  selected = null;
  renderLayers();
  setHintVisible(true);
  if (!silent) toast(side === 'frente' ? 'Frente limpa' : 'Costas limpas');
};

const undo = () => {
  const els = placedEls();
  const last = els[els.length - 1];
  if (last) removeStamp(last);
};

const center = () => {
  if (!selected) {
    toast('Selecione uma estampa');
    return;
  }
  const wrap = byId('shirt-wrap');
  const r = rectOf(selected);
  selected.style.left = `${(wrap.offsetWidth - r.w) / 2}px`;
  selected.style.top = `${(wrap.offsetHeight - r.h) / 2}px`;
};

const surprise = () => {
  clearComposition(true);
  const artwork = stamps().filter((s) => s.series !== 'Alfabeto');
  const pool = [...artwork].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2));
  const target = side;
  pool.forEach((s, i) => {
    // Se a pessoa trocar de lado antes de terminar, o resto da surpresa não vai para o outro lado.
    setTimeout(() => side === target && addStamp(s.id), i * 200);
  });
  toast('✦ Composição surpresa');
};

export const studioModel = (): ModelId => model;

const hasStamps = () => sidesWithStamps().length > 0;

/** Lados com estampa e a zona de cada um — usado na captura e no SVG de produção. */
export const compositionSides = () =>
  sidesWithStamps().map((s) => ({ side: s, label: SIDE_LABEL[s], zone: zoneFor(s), collar: COLLAR_PATH[s] }));

export const readStudioConfig = (): StudioConfig => {
  const sides = sidesWithStamps();
  const both = sides.length > 1;
  return {
    model: MODELS[model].label,
    color: document.querySelector<HTMLElement>('.sr .sw.on')?.title || 'Pergaminho',
    size: document.querySelector('#estudio .sz-row .sz.on')?.textContent || 'G',
    view: viewLabel(sides),
    stamps: sides.flatMap((s) =>
      placedEls(zoneFor(s)).map((el) => (both ? `${SIDE_LABEL[s]}: ${layerName(el)}` : layerName(el))),
    ),
  };
};

const STAGE_W = 360;
const STAGE_GUTTER = 32;

/** Calcula a escala do palco para caber na largura da tela (só reduz, nunca amplia). */
export const updateStageScale = (viewportWidth = window.innerWidth) => {
  stageScale = Math.min(1, Math.max(0.5, (viewportWidth - STAGE_GUTTER) / STAGE_W));
  document.documentElement.style.setProperty('--stage-scale', String(stageScale));
};

/** Redesenha o seletor quando as estampas vivas (Notion) chegam. */
export const refreshStamps = renderStampPicker;

export const initStudio = (onCheckout: () => void) => {
  renderStampPicker();
  updateStageScale();
  window.addEventListener('resize', () => updateStageScale(), { passive: true });

  document.addEventListener('pointermove', (e) => {
    if (!gesture) return;
    // Deltas da tela → coordenadas do palco (que pode estar escalado no celular).
    if (gesture.kind === 'drag') {
      gesture.el.style.left = `${gesture.ox + (e.clientX - gesture.sx) / stageScale}px`;
      gesture.el.style.top = `${gesture.oy + (e.clientY - gesture.sy) / stageScale}px`;
      return;
    }
    const nw = Math.max(48, gesture.ow + (e.clientX - gesture.sx) / stageScale);
    const nh = nw / Number.parseFloat(gesture.el.dataset.ar || '1');
    gesture.el.style.width = `${nw}px`;
    gesture.el.style.height = `${nh}px`;
    const art = gesture.el.querySelector<HTMLElement>('svg, img');
    if (art) {
      art.setAttribute('width', String(nw));
      art.setAttribute('height', String(nh));
      art.style.width = `${nw}px`;
      art.style.height = `${nh}px`;
    }
  });
  const endGesture = () => {
    gesture = null;
  };
  document.addEventListener('pointerup', endGesture);
  document.addEventListener('pointercancel', endGesture);

  onAction('add-stamp', (el) => {
    const id = el.dataset.stampId as string;
    track('estudio.estampa', { estampa: id, lado: side }, () => addStamp(id));
  });
  onEnter('add-word', (el) => {
    const input = el as HTMLInputElement;
    track('estudio.palavra', { letras: input.value.trim().length, lado: side }, () => addWord(input.value));
    input.value = '';
  });
  onAction('remove-stamp', (el, e) => {
    e.stopPropagation();
    const ps = el.closest<HTMLElement>('.ps');
    if (ps) removeStamp(ps);
  });
  onAction('select-layer', (el) => {
    const ps = placedEls()[Number(el.dataset.index)];
    if (ps) select(ps);
  });
  onAction('remove-layer', (el) => {
    const ps = placedEls()[Number(el.dataset.index)];
    if (ps) removeStamp(ps);
  });
  onAction('deselect', deselect);
  onInput('opacity', (el) => {
    const v = (el as HTMLInputElement).value;
    byId('op-val').textContent = `${v}%`;
    if (selected) {
      selected.dataset.op = String(Number(v) / 100);
      selected.style.opacity = String(Number(v) / 100);
    }
  });
  onAction('pick-model', pickModel);
  onAction('pick-color', (el) => {
    selectInGroup(el, '.sw-row', '.sw');
    byId('shirt-body').setAttribute('fill', el.dataset.hex as string);
    toast(`Cor: ${el.dataset.name}`);
  });
  onAction('view', (el) => setView(el.dataset.view as Side));
  onAction('stamp-tab', (el) => selectInGroup(el, '.sl-tabs', '.sl-tab'));
  onAction('center', center);
  onAction('clear', () => clearComposition());
  onAction('undo', undo);
  onAction('surprise', surprise);
  onAction('add-studio', () => {
    if (!hasStamps()) {
      toast('Adicione pelo menos uma estampa');
      return;
    }
    onCheckout();
  });
};
