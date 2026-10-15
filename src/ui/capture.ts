import { byId, qsa } from './dom';
import { compositionSides, rectOf } from './studio';

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const svgUrl = (svg: Element) =>
  URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));

const shirtWithCollar = (collar: string): SVGSVGElement => {
  const clone = byId('shirt-el').cloneNode(true) as SVGSVGElement;
  clone.querySelector('#shirt-collar')?.setAttribute('d', collar);
  return clone;
};

const stageSize = () => {
  const wrap = byId('shirt-wrap');
  return { W: wrap.offsetWidth || 360, H: wrap.offsetHeight || 416 };
};

/**
 * Captura a composição como PNG (data URL): o lado da frente, ou as costas se só elas tiverem estampa.
 * Usa as medidas do style das estampas, então funciona mesmo com o lado escondido.
 */
export const captureComposition = async (): Promise<string | null> => {
  const first = compositionSides()[0];
  if (!first) return null;
  const { W, H } = stageSize();
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);
  ctx.fillStyle = '#FAFAF8';
  ctx.fillRect(0, 0, W, H);

  const shirtUrl = svgUrl(shirtWithCollar(first.collar));
  const shirt = await loadImage(shirtUrl);
  URL.revokeObjectURL(shirtUrl);
  if (!shirt) return null;
  ctx.drawImage(shirt, 0, 0, W, H);

  for (const el of qsa<HTMLElement>('.ps:not(.removing)', first.zone)) {
    const art = el.querySelector('svg') ?? el.querySelector('img');
    if (!art) continue;
    const src = art instanceof HTMLImageElement ? art.src : svgUrl(art);
    const img = await loadImage(src);
    if (!(art instanceof HTMLImageElement)) URL.revokeObjectURL(src);
    if (!img) continue;
    const r = rectOf(el);
    ctx.globalAlpha = Number.parseFloat(el.dataset.op ?? '1') || 1;
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
  }
  return canvas.toDataURL('image/png');
};

/** Uma estampa como SVG: palavras/placeholders inline, aquarelas como <image> com URL absoluta. */
const stampSVG = (el: HTMLElement): string | null => {
  const r = rectOf(el);
  const op = Number.parseFloat(el.dataset.op ?? '1') || 1;
  const open = `<g transform="translate(${r.x.toFixed(1)},${r.y.toFixed(1)})" opacity="${op}">`;
  const svg = el.querySelector('svg');
  if (svg) {
    const vb = svg.getAttribute('viewBox') || `0 0 ${r.w} ${r.h}`;
    return `${open}<svg viewBox="${vb}" width="${r.w}" height="${r.h}" overflow="visible">${svg.innerHTML}</svg></g>`;
  }
  const img = el.querySelector('img');
  if (img) {
    const href = new URL(img.getAttribute('src') ?? '', window.location.href).href;
    return `${open}<image href="${href}" width="${r.w}" height="${r.h}" preserveAspectRatio="xMidYMid meet"/></g>`;
  }
  return null;
};

/** SVG de produção: cada lado com estampa (contorno + arte), lado a lado, sem UI, em escala 3x. */
export const exportProductionSVG = (serial: string): string => {
  const { W, H } = stageSize();
  const GAP = 40;
  const sides = compositionSides();
  const groups = sides.map(({ side, label, zone, collar }, i) => {
    const shirt = new XMLSerializer().serializeToString(shirtWithCollar(collar));
    const parts = qsa<HTMLElement>('.ps:not(.removing)', zone).map(stampSVG).filter(Boolean).join('\n      ');
    return `  <g id="${side}" transform="translate(${i * (W + GAP)},0)">
    <title>${label}</title>
    <g class="shirt-base">${shirt}</g>
    <g class="composition">
      ${parts}
    </g>
  </g>`;
  });
  const totalW = Math.max(1, sides.length) * W + Math.max(0, sides.length - 1) * GAP;
  const SCALE = 3;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Hortelã Production File -->',
    `<!-- Serial: ${serial} -->`,
    `<!-- Generated: ${new Date().toISOString()} -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${H}" width="${totalW * SCALE}" height="${H * SCALE}">`,
    ...groups,
    '</svg>',
  ].join('\n');
};

export const downloadDataUrl = (href: string, filename: string) => {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
};
