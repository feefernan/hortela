import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SYMBOL, strokeFor } from '../../src/ui/symbol';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf-8');
const sources = (dir: string, ext: string) =>
  readdirSync(resolve(root, dir))
    .filter((f) => f.endsWith(ext))
    .map((f) => ({ file: `${dir}/${f}`, text: read(`${dir}/${f}`) }));

// Identidade Brisa: cores e fontes da marca. As cores antigas (pergaminho, musgo, sage, tinta quente) não voltam.
// Cores de PRODUTO (camiseta, arte das peças) ficam fora: vivem em index.html (opções do Estúdio) e catalog.ts.
const OLD_BRAND = ['#3C4E2E', '#7A9268', '#9B7FA8', '#F3EDE0', '#FAFAF8', '#1C1812', '#D6CCBA', '#55684A', '#6E5680'];
const NEW_BRAND = ['#F6F8F6', '#E9EEE9', '#C9D3CA', '#16261A', '#1F4A2E', '#4F6B55', '#6FA06A', '#A878E0'];

describe('identidade visual (Brisa)', () => {
  it('estilos e código de tela não usam as cores antigas da marca', () => {
    for (const { file, text } of [...sources('src/styles', '.css'), ...sources('src/ui', '.ts')]) {
      for (const hex of OLD_BRAND) expect(text.toUpperCase(), `${file} tem ${hex}`).not.toContain(hex);
    }
    // index.html guarda cores de produto (camiseta e opções do Estúdio); só as cores exclusivas da marca antiga são barradas.
    for (const hex of ['#9B7FA8', '#55684A', '#6E5680'])
      expect(read('index.html').toUpperCase(), `index.html tem ${hex}`).not.toContain(hex);
  });

  it('os tokens da identidade existem em :root', () => {
    const css = read('src/styles/main.css');
    const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
    for (const hex of NEW_BRAND) expect(root.toUpperCase()).toContain(hex);
    for (const old of ['--moss', '--sage', '--parchment', '--dust', '--white', '--ink'])
      expect(css).not.toMatch(new RegExp(`${old}(?![\\w-])`));
  });

  it('só duas fontes: Cormorant Garamond e DM Sans', () => {
    const css = ['main', 'cart', 'motion', 'responsive'].map((f) => read(`src/styles/${f}.css`)).join('\n');
    const html = read('index.html');
    expect(css).not.toMatch(/EB Garamond|Georgia|Courier|monospace/i);
    expect(html).not.toMatch(/EB\+Garamond/);
    expect(html).toMatch(/family=Cormorant\+Garamond[^"]*&family=DM\+Sans/);
    for (const { text } of sources('src/ui', '.ts')) expect(text).not.toMatch(/Georgia|Courier New|EB Garamond/);
  });

  it('o símbolo do cabeçalho e o favicon usam os mesmos caminhos do módulo único', () => {
    for (const text of [read('index.html'), read('public/favicon.svg')]) {
      expect(text).toContain(SYMBOL.stem);
      for (const arc of SYMBOL.arcs) expect(text).toContain(arc);
      expect(text).toContain(`cx="${SYMBOL.dot.x}" cy="${SYMBOL.dot.y}"`);
    }
  });

  it('o traço engrossa em tamanho pequeno para o símbolo não sumir', () => {
    expect(strokeFor(20)).toBeGreaterThan(SYMBOL.stroke);
    expect(strokeFor(300)).toBe(SYMBOL.stroke);
  });

  it('barra do navegador e metadados usam a Floresta', () => {
    expect(read('index.html')).toContain('<meta name="theme-color" content="#1F4A2E">');
  });
});
