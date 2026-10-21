/**
 * PROTÓTIPO (Fase P) — descartável, vive só no ramo prototype/layout-variantes.
 * Dados e peças pequenas que as três variações usam; o layout é de cada uma.
 */
import { type Product, products } from '../domain/catalog';
import { BODY_PATH, COLLAR_PATH } from '../domain/garment';
import { formatBRL, studioTotal } from '../domain/pricing';
import { layoutWord } from '../domain/word-layout';
import { watercolorSVG } from '../ui/art';

export { formatBRL };

// Sem o Worker em dev, o Notion não responde e `available` fica vazio: usamos um estoque de exemplo.
const SAMPLE_AVAILABLE: Record<string, number> = {
  'floresta-3': 12,
  'tarde-de-outubro': 7,
  raizes: 1,
  nevoa: 16,
  'chuva-fina': 0,
  broto: 4,
};

export interface Piece extends Product {
  avail: number;
  /** Próxima disponível: total − disponíveis + 1; null quando esgotou. */
  next: number | null;
  art: string;
}

export let sampleStock = false;

export const pieces = (): Piece[] =>
  products().map((p) => {
    if (p.available === undefined) sampleStock = true;
    const avail = p.available ?? SAMPLE_AVAILABLE[p.id] ?? (p.status === 'sold' ? 0 : 1);
    return { ...p, avail, next: avail > 0 ? p.edition.total - avail + 1 : null, art: artURL(p.palette) };
  });

export const findPiece = (id: string) => pieces().find((p) => p.id === id);

const artCache = new Map<string, string>();
/** A aquarela placeholder como imagem: barata de repetir (a folha de contatos repete dezenas). */
export const artURL = (palette: Product['palette']): string => {
  const key = palette.join();
  let url = artCache.get(key);
  if (!url) {
    const svg = watercolorSVG(palette, 400).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    artCache.set(key, url);
  }
  return url;
};

export const editionLine = (p: Piece) =>
  p.next === null
    ? `Esgotada · edição de ${p.edition.total}`
    : `Próxima disponível: nº ${p.next} de ${p.edition.total}`;

export const STUDIO_PRICE = formatBRL(studioTotal('oversized'));

/** Medidas de exemplo (cm) — a tabela real ainda não existe no repositório. */
export const SIZES = [
  { size: 'P', width: 54, length: 72 },
  { size: 'M', width: 57, length: 74 },
  { size: 'G', width: 60, length: 76 },
  { size: 'GG', width: 63, length: 78 },
];

export const sizeTable = () => `<table>
  <thead><tr><th scope="col">Tamanho</th><th scope="col">Largura</th><th scope="col">Comprimento</th></tr></thead>
  <tbody>${SIZES.map((s) => `<tr><th scope="row">${s.size}</th><td>${s.width} cm</td><td>${s.length} cm</td></tr>`).join('')}</tbody>
</table>
<p class="pv-note">Medidas de exemplo, camiseta oversized estendida.</p>`;

/** Palavra nas letras do alfabeto da Hortelã, num SVG solto (para pôr sobre a camiseta). */
export const wordSVG = (word: string) => {
  const layout = layoutWord(word);
  if (!layout) return '';
  const imgs = layout.glyphs
    .map((g) => `<image href="${g.href}" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}"/>`)
    .join('');
  return `<svg viewBox="0 0 ${layout.width.toFixed(1)} ${layout.height}" aria-hidden="true">${imgs}</svg>`;
};

/**
 * Camiseta (silhueta real do Estúdio) com uma arte por cima do peito.
 * `art` é HTML: <img> de aquarela ou o SVG da palavra.
 */
export const shirt = (art: string, fill = '#FAFAF8') => `<div class="pv-shirt">
  <svg viewBox="0 0 360 416" aria-hidden="true">
    <path d="${BODY_PATH.oversized}" fill="${fill}"/>
    <path d="${COLLAR_PATH.frente}" fill="#E8E1D0"/>
  </svg>
  <div class="pv-shirt-art">${art}</div>
</div>`;

export const artImg = (p: Pick<Piece, 'art' | 'name'>, alt = true) =>
  `<img src="${p.art}" alt="${alt ? `Arte provisória de ${p.name}` : ''}" width="400" height="400">`;

/**
 * A "coisa viva": escrever uma palavra e ver nas letras da Hortelã, sobre a camiseta.
 * Campos `[data-pv-word]` atualizam todo `[data-pv-word-out]` do mesmo root.
 */
export const bindComposer = (root: HTMLElement) => {
  const update = (value: string) => {
    for (const out of root.querySelectorAll<HTMLElement>('[data-pv-word-out]')) {
      out.innerHTML = wordSVG(value) || '<span class="pv-empty">escreva uma palavra</span>';
    }
  };
  const onInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.matches('[data-pv-word]')) update(input.value);
  };
  root.addEventListener('input', onInput);
  return () => root.removeEventListener('input', onInput);
};

export const DEFAULT_WORD = 'FLORA';
