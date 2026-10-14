import { alphabetImage } from './catalog';

interface Glyph {
  /** Largura e altura da imagem, já normalizadas pela altura da "tinta". */
  w: number;
  h: number;
  /** Deslocamento vertical que alinha a letra na linha de base comum. */
  y: number;
  /** Bordas esquerda/direita da tinta dentro da imagem (sem a decoração). */
  il: number;
  ir: number;
}

// Cada letra tem largura/altura normalizadas para que a tinta tenha sempre a
// mesma altura visual, e um deslocamento vertical que alinha todas numa linha de
// base comum, como numa fonte. O espaçamento usa as bordas da tinta (il/ir), não
// a ilustração ao redor, para que flores e folhas não empurrem a próxima letra.
// Stryker disable next-line all : métricas das letras (dados)
export const GLYPHS: { baseline: number; rowH: number; letters: Record<string, Glyph> } = {
  baseline: 110.21,
  rowH: 119.62,
  letters: {
    A: { w: 72.86, h: 64.74, y: 45.96, il: 0.49, ir: 72.37 },
    B: { w: 123.8, h: 64.99, y: 45.71, il: 43.74, ir: 92.17 },
    C: { w: 94.15, h: 80.8, y: 36.57, il: 28.42, ir: 86.24 },
    D: { w: 110.95, h: 65.24, y: 45.71, il: 22.98, ir: 85.75 },
    E: { w: 85.99, h: 76.11, y: 34.59, il: 35.34, ir: 81.79 },
    F: { w: 86.98, h: 81.54, y: 29.16, il: 36.08, ir: 79.57 },
    G: { w: 100.08, h: 64.74, y: 45.96, il: 36.57, ir: 99.34 },
    H: { w: 96.62, h: 78.08, y: 32.62, il: 21.0, ir: 92.91 },
    I: { w: 83.03, h: 97.11, y: 13.59, il: 44.97, ir: 70.92 },
    J: { w: 27.57, h: 65.97, y: 45.96, il: 0.25, ir: 24.86 },
    K: { w: 129.48, h: 82.04, y: 28.91, il: 32.37, ir: 96.12 },
    L: { w: 51.4, h: 64.74, y: 45.96, il: 0.49, ir: 50.66 },
    M: { w: 130.22, h: 85.0, y: 25.7, il: 22.24, ir: 103.29 },
    N: { w: 90.44, h: 86.73, y: 24.22, il: 21.99, ir: 89.95 },
    O: { w: 70.42, h: 64.74, y: 45.96, il: 3.95, ir: 69.93 },
    P: { w: 75.37, h: 81.54, y: 29.16, il: 26.93, ir: 74.87 },
    Q: { w: 106.25, h: 64.74, y: 45.96, il: 26.93, ir: 81.54 },
    R: { w: 88.96, h: 81.79, y: 28.91, il: 21.99, ir: 88.46 },
    S: { w: 92.66, h: 70.92, y: 39.78, il: 7.41, ir: 44.48 },
    T: { w: 113.42, h: 110.7, y: 0.0, il: 24.22, ir: 79.32 },
    U: { w: 71.41, h: 67.46, y: 45.96, il: 3.21, ir: 69.19 },
    V: { w: 101.07, h: 84.76, y: 25.95, il: 31.88, ir: 100.57 },
    W: { w: 125.78, h: 64.74, y: 45.96, il: 17.72, ir: 112.98 },
    X: { w: 121.58, h: 83.77, y: 26.93, il: 19.03, ir: 83.52 },
    Y: { w: 48.24, h: 64.0, y: 46.21, il: 0.0, ir: 48.24 },
    Z: { w: 57.08, h: 78.08, y: 39.78, il: 2.97, ir: 52.39 },
  },
};

interface PlacedGlyph {
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WordLayout {
  glyphs: PlacedGlyph[];
  width: number;
  height: number;
  aspectRatio: number;
}

const GAP = 8;

/** Calcula a posição de cada letra de uma palavra. Retorna null se não houver letras. */
export const layoutWord = (raw: string): WordLayout | null => {
  const word = raw.trim().toUpperCase();
  const rowH = GLYPHS.rowH;
  let cursorX = 0;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  const placed: PlacedGlyph[] = [];

  for (const ch of word) {
    if (ch === ' ') {
      cursorX += rowH * 0.32;
      continue;
    }
    const g = GLYPHS.letters[ch];
    if (!g) continue;
    const imgX = cursorX - g.il;
    placed.push({ href: alphabetImage(ch), x: imgX, y: g.y, w: g.w, h: g.h });
    minX = Math.min(minX, imgX);
    maxX = Math.max(maxX, imgX + g.w);
    cursorX += g.ir - g.il + GAP;
  }
  if (!placed.length) return null;

  const shift = -minX;
  const width = Math.max(maxX - minX, rowH * 0.5);
  return {
    glyphs: placed.map((p) => ({ ...p, x: Number((p.x + shift).toFixed(2)) })),
    width,
    height: rowH,
    aspectRatio: width / rowH,
  };
};
