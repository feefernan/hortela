import { describe, expect, it } from 'vitest';
import { pieceArtHTML } from '../../src/ui/art';

const palette = ['#000000', '#111111', '#222222'] as const;

describe('arte da peça', () => {
  it('imagem real com texto alternativo e carregamento preguiçoso', () => {
    const html = pieceArtHTML({ name: 'Maré alta', image: 'https://x.test/a.jpg', palette }, 180);
    expect(html).toContain('<img class="piece-img" src="https://x.test/a.jpg" alt="Maré alta"');
    expect(html).toContain('loading="lazy"');
  });

  it('nome vindo do Notion não injeta HTML', () => {
    const html = pieceArtHTML({ name: '"><script>x</script>', image: 'https://x.test/a.jpg', palette }, 64);
    expect(html).not.toContain('<script>');
  });

  it('sem imagem, o desenho de reserva', () => {
    expect(pieceArtHTML({ name: 'A', palette }, 64)).toMatch(/^<svg/);
  });
});
