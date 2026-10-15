import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf-8');
const css = ['main', 'motion', 'cart', 'responsive'].map((f) => read(`src/styles/${f}.css`)).join('\n');

// Regras das skills improve-animations e mobile-native (#43) que não podem voltar.
describe('regras de motion e mobile', () => {
  it('sem transition: all', () => {
    expect(css).not.toMatch(/transition:\s*all/);
  });

  it('sem ease-in em UI (entradas e saídas usam ease-out)', () => {
    expect(css).not.toMatch(/var\(--ease-in\)|\bease-in\s*[;,)]/);
  });

  it('viewport cobre a área segura (env(safe-area-inset-*) funciona)', () => {
    expect(read('index.html')).toMatch(/name="viewport"[^>]*viewport-fit=cover/);
  });

  it('entrada da página não deixa transform residual (fill-mode backwards)', () => {
    expect(css).toMatch(/\.page\.active\s*\{[^}]*backwards/);
  });
});
