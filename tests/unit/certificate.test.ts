import { describe, expect, it } from 'vitest';
import { artBounds, artworkLabel, fitContain } from '../../src/domain/certificate';

describe('artBounds', () => {
  it('recorta o contorno de todas as estampas, com folga', () => {
    const box = artBounds(
      [
        { x: 100, y: 120, w: 50, h: 40 },
        { x: 180, y: 90, w: 30, h: 100 },
      ],
      5,
    );
    expect(box).toEqual({ x: 95, y: 85, w: 120, h: 110 });
  });

  it('sem estampas não há arte', () => {
    expect(artBounds([])).toBeNull();
  });
});

describe('fitContain', () => {
  it('amplia sem distorcer e centraliza', () => {
    expect(fitContain(100, 50, { x: 10, y: 20, w: 400, h: 400 })).toEqual({ x: 10, y: 120, w: 400, h: 200 });
  });

  it('reduz uma arte alta pela altura', () => {
    expect(fitContain(100, 400, { x: 0, y: 0, w: 300, h: 200 })).toEqual({ x: 125, y: 0, w: 50, h: 200 });
  });
});

describe('artworkLabel', () => {
  const label = artworkLabel({ serial: 'HRT-20261015-ABC123', name: 'Ana', date: new Date(2026, 9, 15) });

  it('só código da obra e autoria com data', () => {
    expect(label.code).toBe('HRT-20261015-ABC123');
    expect(label.author).toMatch(/^Ana · 15 de outubro de 2026$/);
    expect(Object.keys(label)).toEqual(['code', 'author']);
  });
});
