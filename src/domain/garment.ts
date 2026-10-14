import type { ModelId } from './pricing';

export type Side = 'frente' | 'costas';

export const SIDE_LABEL: Record<Side, string> = { frente: 'Frente', costas: 'Costas' };

/** Silhuetas no viewBox 0 0 360 416 do Estúdio. O Camisetão é mais longo e um pouco mais largo. */
export const BODY_PATH: Record<ModelId, string> = {
  oversized:
    'M 108 30 L 26 82 L 62 112 L 62 372 L 298 372 L 298 112 L 334 82 L 252 30 Q 216 57 180 57 Q 144 57 108 30 Z',
  long: 'M 108 30 L 22 86 L 58 118 L 54 404 L 306 404 L 302 118 L 338 86 L 252 30 Q 216 57 180 57 Q 144 57 108 30 Z',
};

/** Gola: decote fundo na frente, raso nas costas. */
export const COLLAR_PATH: Record<Side, string> = {
  frente: 'M 108 30 Q 144 66 180 57 Q 216 66 252 30 Q 216 88 180 78 Q 144 88 108 30 Z',
  costas: 'M 108 30 Q 144 44 180 42 Q 216 44 252 30 Q 216 56 180 52 Q 144 56 108 30 Z',
};

/** Rótulo de posição para o pedido, conforme os lados que receberam estampa. */
export const viewLabel = (sides: readonly Side[]): string => {
  const has = new Set(sides);
  if (has.has('frente') && has.has('costas')) return 'Frente e costas';
  if (has.has('costas')) return 'Costas';
  return 'Frente';
};
