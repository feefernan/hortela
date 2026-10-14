import { byId, qsa } from './dom';

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const svgUrl = (svg: Element) =>
  URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));

/** Captura a composição atual da camiseta como PNG (data URL). */
export const captureComposition = async (): Promise<string | null> => {
  const wrap = byId('shirt-wrap');
  const W = wrap.offsetWidth;
  const H = wrap.offsetHeight;
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);
  ctx.fillStyle = '#FAFAF8';
  ctx.fillRect(0, 0, W, H);

  const shirtUrl = svgUrl(byId('shirt-el'));
  const shirt = await loadImage(shirtUrl);
  URL.revokeObjectURL(shirtUrl);
  if (!shirt) return null;
  ctx.drawImage(shirt, 0, 0, W, H);

  for (const el of qsa<HTMLElement>('.ps', byId('drop-zone'))) {
    const art = el.querySelector('svg') ?? el.querySelector('img');
    if (!art) continue;
    const src = art instanceof HTMLImageElement ? art.src : svgUrl(art);
    const img = await loadImage(src);
    if (!(art instanceof HTMLImageElement)) URL.revokeObjectURL(src);
    if (!img) continue;
    ctx.globalAlpha = Number.parseFloat(el.dataset.op ?? '1') || 1;
    ctx.drawImage(
      img,
      Number.parseFloat(el.style.left) || 0,
      Number.parseFloat(el.style.top) || 0,
      el.offsetWidth,
      el.offsetHeight,
    );
    ctx.globalAlpha = 1;
  }
  return canvas.toDataURL('image/png');
};

/** SVG de produção: contorno da camiseta + estampas, sem UI, em escala 3x. */
export const exportProductionSVG = (serial: string): string => {
  const wrap = byId('shirt-wrap');
  const W = wrap.offsetWidth;
  const H = wrap.offsetHeight;
  const shirtSrc = new XMLSerializer().serializeToString(byId('shirt-el'));
  const parts = qsa<HTMLElement>('.ps', byId('drop-zone')).flatMap((el) => {
    const svg = el.querySelector('svg');
    if (!svg) return [];
    const x = Number.parseFloat(el.style.left) || 0;
    const y = Number.parseFloat(el.style.top) || 0;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const op = Number.parseFloat(el.dataset.op ?? '1') || 1;
    const vb = svg.getAttribute('viewBox') || `0 0 ${w} ${h}`;
    return [
      `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})" opacity="${op}"><svg viewBox="${vb}" width="${w}" height="${h}" overflow="visible">${svg.innerHTML}</svg></g>`,
    ];
  });
  const SCALE = 3;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Hortelã Production File -->',
    `<!-- Serial: ${serial} -->`,
    `<!-- Generated: ${new Date().toISOString()} -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}">`,
    `  <g id="shirt-base">${shirtSrc}</g>`,
    `  <g id="composition">${parts.join('\n  ')}</g>`,
    '</svg>',
  ].join('\n');
};

export const downloadDataUrl = (href: string, filename: string) => {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
};

export const downloadText = (text: string, type: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
};
