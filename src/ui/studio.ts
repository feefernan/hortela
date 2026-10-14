import { findStamp, STAMPS, type Stamp } from '../domain/catalog';
import type { StudioConfig } from '../domain/orders';
import { formatBRL, MODELS, type ModelId, studioTotal } from '../domain/pricing';
import { isValidWord } from '../domain/validation';
import { layoutWord } from '../domain/word-layout';
import { track } from '../infra/telemetry';
import { stampImageHTML } from './art';
import { byId, onAction, onEnter, onInput, qsa, selectInGroup } from './dom';
import { toast } from './toast';

let selected: HTMLElement | null = null;
let drag: { el: HTMLElement; sx: number; sy: number; ox: number; oy: number } | null = null;
let resize: { el: HTMLElement; sx: number; ow: number } | null = null;
let model: ModelId = 'oversized';

const zone = () => byId('drop-zone');
const placedEls = () => qsa<HTMLElement>('.ps', zone());
const setHintVisible = (visible: boolean) => {
  byId('sc-hint').style.opacity = visible ? '1' : '0';
};

const renderStampPicker = () => {
  const scroll = byId('stamps-scroll');
  scroll.innerHTML = '';
  let currentSeries = '';
  let grid: HTMLElement | null = null;
  for (const s of STAMPS.filter((x) => x.series !== 'Alfabeto')) {
    if (s.series !== currentSeries) {
      if (grid) scroll.appendChild(grid);
      const label = document.createElement('div');
      label.className = 'ser-label';
      label.textContent = s.series;
      scroll.appendChild(label);
      grid = document.createElement('div');
      grid.className = 'sg';
      currentSeries = s.series;
    }
    const tile = document.createElement('div');
    tile.className = 'st';
    tile.title = s.name;
    tile.dataset.action = 'add-stamp';
    tile.dataset.stampId = s.id;
    tile.innerHTML = `${stampImageHTML(s, 52)}<div class="st-name">${s.name}</div>`;
    grid?.appendChild(tile);
  }
  if (grid) scroll.appendChild(grid);

  const label = document.createElement('div');
  label.className = 'ser-label';
  label.textContent = 'Alfabeto';
  scroll.appendChild(label);

  const wordBox = document.createElement('div');
  wordBox.style.cssText = 'padding:4px 2px 14px;';
  wordBox.innerHTML = `
    <input id="word-input" type="text" placeholder="Escreva uma palavra" data-enter-action="add-word"
      style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--dust);
        border-radius:4px;font-family:var(--body);font-size:13px;background:var(--white);">
    <div id="word-err" style="opacity:0;color:#a33;font-size:11.5px;font-style:italic;margin-top:6px;">
      Só letras de A a Z (sem acento, sem números).
    </div>
    <div style="font-size:11px;color:var(--sage);margin-top:6px;">Aperte Enter pra adicionar.</div>`;
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

const place = (el: HTMLElement) => {
  el.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.ps-resize') || target.closest('.ps-del')) return;
    e.stopPropagation();
    select(el);
    drag = { el, sx: e.clientX, sy: e.clientY, ox: el.offsetLeft, oy: el.offsetTop };
    e.preventDefault();
  });
  el.querySelector('.ps-resize')?.addEventListener('mousedown', (e) => {
    const me = e as MouseEvent;
    me.stopPropagation();
    resize = { el, sx: me.clientX, ow: el.offsetWidth };
    me.preventDefault();
  });
  zone().appendChild(el);
  select(el);
  renderLayers();
};

const controlsHTML = '<div class="ps-resize"></div><button class="ps-del" data-action="remove-stamp">✕</button>';

const addStamp = (id: string) => {
  const s = findStamp(id);
  if (!s) return;
  setHintVisible(false);
  const wrap = byId('shirt-wrap');
  const size = 96;
  const x = (wrap.offsetWidth - size) / 2 + (Math.random() - 0.5) * 64;
  const y = (wrap.offsetHeight - size) / 2 + (Math.random() - 0.5) * 48;
  const el = document.createElement('div');
  el.className = 'ps';
  el.dataset.sid = id;
  el.dataset.op = '1';
  el.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;`;
  el.innerHTML = stampImageHTML(s, size) + controlsHTML;
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
  const wrap = byId('shirt-wrap');
  const size = 140;
  const dispH = size / layout.aspectRatio;
  const x = (wrap.offsetWidth - size) / 2 + (Math.random() - 0.5) * 40;
  const y = (wrap.offsetHeight - dispH) / 2 + (Math.random() - 0.5) * 30;
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
  el.remove();
  if (selected === el) selected = null;
  renderLayers();
  if (!placedEls().length) setHintVisible(true);
};

const layerThumb = (el: HTMLElement, stamp: Stamp | undefined): string => {
  if (el.dataset.word) {
    const svg = el.querySelector('svg');
    const ar = Number.parseFloat(el.dataset.ar || '1');
    return `<svg viewBox="${svg?.getAttribute('viewBox')}" width="${Math.round(20 * ar)}" height="20">${svg?.innerHTML ?? ''}</svg>`;
  }
  return stamp ? stampImageHTML(stamp, 20) : '';
};

const renderLayers = () => {
  const wrap = byId('layers-wrap');
  const els = placedEls();
  if (!els.length) {
    wrap.innerHTML =
      '<div style="font-family:var(--body);font-style:italic;font-size:13px;color:var(--sage);">Nenhuma estampa adicionada</div>';
    return;
  }
  wrap.innerHTML = els
    .map((el, idx) => {
      const stamp = el.dataset.word ? undefined : findStamp(el.dataset.sid ?? '');
      const name = el.dataset.word ?? stamp?.name ?? 'Estampa';
      return `<div class="layer-item ${el.classList.contains('sel') ? 'hi' : ''}" data-action="select-layer" data-index="${idx}">
        <div class="layer-thumb">${layerThumb(el, stamp)}</div>
        <div class="layer-name">${name}</div>
        <button class="layer-del" title="Remover" data-action="remove-layer" data-index="${idx}">✕</button>
      </div>`;
    })
    .reverse()
    .join('');
};

const pickModel = (el: HTMLElement) => {
  selectInGroup(el, '.model-row', '.mo');
  model = el.dataset.model as ModelId;
  const m = MODELS[model];
  byId('o-model').textContent = m.label;
  byId('o-mprice').textContent = formatBRL(m.price);
  byId('o-total').textContent = formatBRL(studioTotal(model));
};

const clearComposition = () => {
  zone().innerHTML = '';
  selected = null;
  renderLayers();
  setHintVisible(true);
  toast('Composição limpa');
};

const undo = () => {
  const els = placedEls();
  els[els.length - 1]?.remove();
  renderLayers();
  if (!placedEls().length) setHintVisible(true);
};

const center = () => {
  if (!selected) {
    toast('Selecione uma estampa');
    return;
  }
  const wrap = byId('shirt-wrap');
  selected.style.left = `${(wrap.offsetWidth - selected.offsetWidth) / 2}px`;
  selected.style.top = `${(wrap.offsetHeight - selected.offsetHeight) / 2}px`;
};

const surprise = () => {
  clearComposition();
  const pool = [...STAMPS].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2));
  pool.forEach((s, i) => {
    setTimeout(() => addStamp(s.id), i * 200);
  });
  toast('✦ Composição surpresa');
};

export const studioTotalLabel = () => byId('o-total').textContent ?? formatBRL(studioTotal(model));

const hasStamps = () => placedEls().length > 0;

export const readStudioConfig = (): StudioConfig => ({
  model: document.querySelector('.mo.on .mo-name')?.textContent || 'Camiseta Oversized',
  color: document.querySelector<HTMLElement>('.sr .sw.on')?.title || 'Pergaminho',
  size: document.querySelector('.sz-row .sz.on')?.textContent || 'G',
  view: byId('vf').classList.contains('on') ? 'Frente' : 'Costas',
  stamps: placedEls().map((el) => findStamp(el.dataset.sid ?? '')?.name ?? 'Estampa'),
});

export const initStudio = (onCheckout: () => void) => {
  renderStampPicker();

  document.addEventListener('mousemove', (e) => {
    if (drag) {
      drag.el.style.left = `${drag.ox + e.clientX - drag.sx}px`;
      drag.el.style.top = `${drag.oy + e.clientY - drag.sy}px`;
    }
    if (resize) {
      const nw = Math.max(48, resize.ow + e.clientX - resize.sx);
      const nh = nw / Number.parseFloat(resize.el.dataset.ar || '1');
      resize.el.style.width = `${nw}px`;
      resize.el.style.height = `${nh}px`;
      const art = resize.el.querySelector<HTMLElement>('svg, img');
      if (art) {
        art.setAttribute('width', String(nw));
        art.setAttribute('height', String(nh));
        art.style.width = `${nw}px`;
        art.style.height = `${nh}px`;
      }
    }
  });
  document.addEventListener('mouseup', () => {
    drag = null;
    resize = null;
  });

  onAction('add-stamp', (el) => {
    const id = el.dataset.stampId as string;
    track('estudio.estampa', { estampa: id }, () => addStamp(id));
  });
  onEnter('add-word', (el) => {
    const input = el as HTMLInputElement;
    track('estudio.palavra', { letras: input.value.trim().length }, () => addWord(input.value));
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
    placedEls()[Number(el.dataset.index)]?.remove();
    renderLayers();
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
  onAction('view', (el) => {
    selectInGroup(el, '.sc-btn-group', '.sc-btn');
    toast(el.dataset.view === 'costas' ? 'Vista traseira' : 'Vista frontal');
  });
  onAction('stamp-tab', (el) => selectInGroup(el, '.sl-tabs', '.sl-tab'));
  onAction('center', center);
  onAction('clear', clearComposition);
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
