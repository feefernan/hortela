/** Símbolo da Hortelã (identidade Brisa): haste, dois arcos e o ponto, traço 26 com pontas arredondadas. */

export const SYMBOL = {
  /** Caixa do desenho: viewBox "150 190 780 840". */
  box: { x: 150, y: 190, w: 780, h: 840 },
  stroke: 26,
  stem: 'M328 973L644 277',
  arcs: [
    'M480 240C495 340 590 380 673 374C760 372 840 335 877 278',
    'M201 838C260 750 340 727 397 733C500 735 580 800 582 899',
  ],
  dot: { x: 647, y: 271 },
} as const;

/** Em tamanhos pequenos o traço 26 some (0,6px a 20px de altura): ali o traço é mais grosso. */
export const strokeFor = (height: number) => (height < 48 ? 44 : SYMBOL.stroke);

interface SymbolColors {
  stem: string;
  arc: string;
  dot: string;
}

/** Cores da identidade sobre Névoa (a versão sobre Floresta é só de drops e embalagem, fora do site). */
const ON_LIGHT: SymbolColors = { stem: '#1F4A2E', arc: '#6FA06A', dot: '#A878E0' };

/** Desenha o símbolo num canvas, com o canto superior esquerdo em (x, y) e `height` px de altura. */
export const drawSymbol = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  c: SymbolColors = ON_LIGHT,
) => {
  const { box, stem, arcs, dot } = SYMBOL;
  const stroke = strokeFor(height);
  const k = height / box.h;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.translate(-box.x, -box.y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke;
  ctx.strokeStyle = c.stem;
  ctx.stroke(new Path2D(stem));
  ctx.strokeStyle = c.arc;
  for (const d of arcs) ctx.stroke(new Path2D(d));
  ctx.fillStyle = c.dot;
  ctx.beginPath();
  ctx.arc(dot.x, dot.y, stroke * 0.95, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};
