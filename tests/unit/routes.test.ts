import { describe, expect, it } from 'vitest';
import { pageTitle, parseHash, routeToHash } from '../../src/domain/routes';

describe('rotas', () => {
  it('converte páginas e peças em hash', () => {
    expect(routeToHash({ page: 'home' })).toBe('#/');
    expect(routeToHash({ page: 'loja' })).toBe('#/colecao');
    expect(routeToHash({ page: 'estudio' })).toBe('#/estudio');
    expect(routeToHash({ page: 'confirmacao' })).toBe('#/pedido');
    expect(routeToHash({ page: 'loja', productId: 'floresta-3' })).toBe('#/peca/floresta-3');
  });

  it('lê o hash de volta (ida e volta)', () => {
    for (const page of ['home', 'loja', 'estudio', 'sobre', 'confirmacao', 'painel'] as const) {
      expect(parseHash(routeToHash({ page }))).toEqual({ page });
    }
    expect(parseHash('#/peca/tarde-de-outubro')).toEqual({ page: 'loja', productId: 'tarde-de-outubro' });
    expect(parseHash(routeToHash({ page: 'loja', productId: 'a b' }))).toEqual({ page: 'loja', productId: 'a b' });
  });

  it('cai na home com hash vazio ou desconhecido', () => {
    expect(parseHash('')).toEqual({ page: 'home' });
    expect(parseHash('#')).toEqual({ page: 'home' });
    expect(parseHash('#/nao-existe')).toEqual({ page: 'home' });
    expect(parseHash('#/peca')).toEqual({ page: 'home' });
  });

  it('gera títulos por página e por peça', () => {
    expect(pageTitle({ page: 'loja' })).toBe('Coleção — Hortelã');
    expect(pageTitle({ page: 'loja', productId: 'x' }, 'Raízes')).toBe('Raízes — Hortelã');
    expect(pageTitle({ page: 'loja', productId: 'x' })).toBe('Coleção — Hortelã');
  });
});
