import { describe, expect, it } from 'vitest';
import { BODY_PATH, COLLAR_PATH, viewLabel } from '../../src/domain/garment';
import { nextPlacement, PRINT_AREA, type Rect } from '../../src/domain/placement';

const AREA = { w: 360, h: 416 };
const SIZE = { w: 96, h: 96 };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('nextPlacement', () => {
  it('a primeira estampa vai para o centro da área estampável', () => {
    const p = nextPlacement([], AREA, SIZE);
    const minX = AREA.w * PRINT_AREA.left;
    const maxX = AREA.w * PRINT_AREA.right - SIZE.w;
    const minY = AREA.h * PRINT_AREA.top;
    const maxY = AREA.h * PRINT_AREA.bottom - SIZE.h;
    expect(p).toEqual({ x: Math.round((minX + maxX) / 2), y: Math.round((minY + maxY) / 2) });
  });

  it('estampas seguintes não se sobrepõem enquanto houver espaço', () => {
    const placed: Rect[] = [];
    for (let i = 0; i < 3; i++) {
      const p = nextPlacement(placed, AREA, SIZE);
      const rect = { ...p, ...SIZE };
      for (const r of placed) expect(overlaps(rect, r)).toBe(false);
      placed.push(rect);
    }
  });

  it('fica dentro da área estampável', () => {
    const placed: Rect[] = [];
    for (let i = 0; i < 6; i++) {
      const p = nextPlacement(placed, AREA, SIZE);
      expect(p.x).toBeGreaterThanOrEqual(Math.floor(AREA.w * PRINT_AREA.left));
      expect(p.y).toBeGreaterThanOrEqual(Math.floor(AREA.h * PRINT_AREA.top));
      expect(p.x + SIZE.w).toBeLessThanOrEqual(Math.ceil(AREA.w * PRINT_AREA.right));
      expect(p.y + SIZE.h).toBeLessThanOrEqual(Math.ceil(AREA.h * PRINT_AREA.bottom));
      placed.push({ ...p, ...SIZE });
    }
  });

  it('sem espaço livre, escolhe a posição de menor sobreposição (determinística)', () => {
    const full: Rect[] = [{ x: 0, y: 0, w: 360, h: 416 }];
    const a = nextPlacement(full, AREA, SIZE);
    const b = nextPlacement(full, AREA, SIZE);
    expect(a).toEqual(b);
  });

  it('estampa maior que a área não quebra', () => {
    const p = nextPlacement([], { w: 100, h: 100 }, { w: 300, h: 300 });
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });
});

describe('garment', () => {
  it('Camisetão tem silhueta diferente e mais longa', () => {
    expect(BODY_PATH.long).not.toBe(BODY_PATH.oversized);
    expect(BODY_PATH.long).toContain('404');
  });

  it('gola das costas é mais rasa que a da frente', () => {
    const depth = (d: string) => Math.max(...(d.match(/\d+(?=\s+Q|\s+Z)/g) ?? []).map(Number));
    expect(COLLAR_PATH.frente).toMatch(/^M 108 30 /);
    expect(COLLAR_PATH.costas).toMatch(/^M 108 30 /);
    expect(depth(COLLAR_PATH.costas)).toBeLessThan(depth(COLLAR_PATH.frente));
  });

  it('rótulo de posição conforme os lados usados', () => {
    expect(viewLabel([])).toBe('Frente');
    expect(viewLabel(['frente'])).toBe('Frente');
    expect(viewLabel(['costas'])).toBe('Costas');
    expect(viewLabel(['frente', 'costas'])).toBe('Frente e costas');
  });
});
