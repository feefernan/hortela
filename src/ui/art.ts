import { findStamp, type Stamp } from '../domain/catalog';
import { escapeHtml } from '../domain/escape';

let uid = 0;
const nextId = (prefix: string) => `${prefix}${++uid}`;

/** Aquarela vetorial usada como arte placeholder dos produtos. */
const watercolorSVG = ([c1, c2, c3]: readonly [string, string, string], size = 160): string => {
  const id = nextId('wc');
  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" aria-hidden="true">
    <defs>
      <filter id="${id}a"><feGaussianBlur stdDeviation="9"/></filter>
      <filter id="${id}b"><feGaussianBlur stdDeviation="4"/></filter>
    </defs>
    <ellipse cx="100" cy="100" rx="78" ry="62" fill="${c1}" opacity=".42" filter="url(#${id}a)"/>
    <ellipse cx="82"  cy="82"  rx="52" ry="44" fill="${c2}" opacity=".48" filter="url(#${id}a)"/>
    <ellipse cx="118" cy="126" rx="36" ry="28" fill="${c3}" opacity=".28" filter="url(#${id}b)"/>
    <path d="M 72 55 Q 110 24 148 56 Q 138 112 100 98 Q 60 84 72 55 Z" fill="${c1}" opacity=".5"/>
    <path d="M 72 55 Q 110 72 148 56" fill="none" stroke="${c1}" stroke-width="1.2" opacity=".6"/>
    <path d="M 104 28 Q 108 62 112 98" fill="none" stroke="${c1}" stroke-width=".9" opacity=".5"/>
    <circle cx="144" cy="44" r="3.5" fill="#A878E0" opacity=".65"/>
  </svg>`;
};

const BLOB_PATHS: Record<string, string> = {
  s1: 'M 30 10 Q 52 8 56 28 Q 54 50 34 48 Q 12 46 14 26 Q 14 10 30 10 Z',
  s2: 'M 18 30 Q 14 10 34 8 Q 54 6 58 26 Q 60 46 40 50 Q 18 54 18 30 Z',
  s3: 'M 10 38 Q 18 12 38 10 Q 56 8 58 30 Q 60 52 42 54 Q 20 58 10 38 Z',
  s4: 'M 30 12 Q 54 16 56 38 Q 58 56 38 56 Q 16 54 12 38 Q 8 20 30 12 Z',
  s5: 'M 30 14 L 34 28 L 50 30 L 38 42 L 42 58 L 30 50 L 18 58 L 22 42 L 10 30 L 26 28 Z',
  s6: 'M 30 8 Q 30 30 30 54 M 18 18 Q 30 26 42 18 M 14 34 Q 30 40 46 34',
  s7: 'M 30 50 Q 30 26 30 12 Q 40 6 44 16 Q 46 28 34 30 Q 22 28 24 16 Q 28 6 30 12',
  s8: 'M 30 50 Q 16 42 12 28 Q 8 14 20 8 Q 32 2 44 10 Q 56 18 50 32 Q 44 46 30 50 Z',
  s9: 'M 30 30 m -18 0 a 18 18 0 1 0 36 0 a 18 18 0 1 0 -36 0',
};

/** Placeholder vetorial de uma estampa, usado quando a imagem não carrega. */
const stampBlobSVG = (stamp: Stamp, size: number): string => {
  const id = nextId('st');
  const d = BLOB_PATHS[stamp.id] ?? BLOB_PATHS.s1;
  const a = stamp.colorA ?? '#1F4A2E';
  const b = stamp.colorB ?? '#6FA06A';
  return `<svg viewBox="0 0 60 60" width="${size}" height="${size}" aria-hidden="true">
    <defs><filter id="${id}"><feGaussianBlur stdDeviation="2.5"/></filter></defs>
    <ellipse cx="30" cy="30" rx="24" ry="22" fill="${a}" opacity=".28" filter="url(#${id})"/>
    <path d="${d}" fill="${a}" fill-opacity=".55" stroke="${a}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${b}" stroke-width=".8" opacity=".45" stroke-linecap="round"/>
  </svg>`;
};

/**
 * `lazy` (padrão): carrega sob demanda com fade-in. Use `false` em elementos re-renderizados com
 * frequência (miniaturas de camada) ou que já têm animação própria (estampa na camiseta).
 */
export const stampImageHTML = (stamp: Stamp, size = 54, lazy = true): string =>
  `<img src="${stamp.image}" width="${size}" height="${size}" data-stamp="${stamp.id}"${lazy ? ' data-lazy loading="lazy" decoding="async"' : ''}
    style="width:${size}px;height:${size}px;object-fit:contain;display:block;pointer-events:none;"
    draggable="false" alt="${stamp.name}">`;

/** Troca imagens de estampa que falharem pelo placeholder vetorial. */
export const installStampFallback = () => {
  document.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.stamp) return;
      const stamp = findStamp(img.dataset.stamp);
      if (!stamp || stamp.series === 'Alfabeto') return;
      img.closest('.is-loading')?.classList.remove('is-loading');
      img.outerHTML = stampBlobSVG(stamp, img.width || 54);
    },
    true,
  );
};

/** Arte da peça: a imagem real (do Notion) quando existe; senão, o desenho de reserva. */
export const pieceArtHTML = (
  p: { name: string; image?: string; palette: readonly [string, string, string] },
  size: number,
) =>
  p.image
    ? `<img class="piece-img" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" width="${size}" height="${size}" loading="lazy" decoding="async" data-lazy>`
    : watercolorSVG(p.palette, size);
