export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

/** Área estampável da camiseta, em frações da área do Estúdio (peito/costas, sem mangas e gola). */
export const PRINT_AREA = { left: 0.2, top: 0.2, right: 0.8, bottom: 0.9 };

const overlap = (a: Rect, b: Rect): number => {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return w * h;
};

/**
 * Escolhe onde colocar uma estampa nova: começa no centro da área estampável e percorre uma grade
 * de candidatos do centro para fora, ficando com o primeiro que não sobrepõe nada — ou, se todos
 * sobrepõem, o de menor sobreposição total. Determinístico (sem Math.random), para ser previsível.
 */
export const nextPlacement = (existing: readonly Rect[], area: Size, size: Size): { x: number; y: number } => {
  const minX = area.w * PRINT_AREA.left;
  const maxX = Math.max(minX, area.w * PRINT_AREA.right - size.w);
  const minY = area.h * PRINT_AREA.top;
  const maxY = Math.max(minY, area.h * PRINT_AREA.bottom - size.h);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const step = Math.max(12, Math.min(size.w, size.h) / 2);
  const candidates: { x: number; y: number; d: number }[] = [];
  const axis = (min: number, max: number) => {
    const values: number[] = [];
    for (let v = min; v < max; v += step) values.push(v);
    values.push(max); // inclui a borda, para aproveitar a área inteira
    return values;
  };
  for (const x of axis(minX, maxX)) {
    for (const y of axis(minY, maxY)) {
      candidates.push({ x, y, d: (x - cx) ** 2 + (y - cy) ** 2 });
    }
  }
  candidates.push({ x: cx, y: cy, d: -1 }); // o centro exato vem primeiro
  candidates.sort((a, b) => a.d - b.d);

  let best = candidates[0];
  let bestOverlap = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const rect = { x: c.x, y: c.y, w: size.w, h: size.h };
    const total = existing.reduce((sum, r) => sum + overlap(rect, r), 0);
    if (total === 0) return { x: Math.round(c.x), y: Math.round(c.y) };
    if (total < bestOverlap) {
      bestOverlap = total;
      best = c;
    }
  }
  return { x: Math.round(best.x), y: Math.round(best.y) };
};
