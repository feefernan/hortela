import { formatOrderDate } from './orders';
import type { Rect } from './placement';

/** Menor retângulo que contém todas as estampas, com folga — o recorte da arte sem a camiseta. */
export const artBounds = (rects: Rect[], pad = 0): Rect | null => {
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.x)) - pad;
  const y = Math.min(...rects.map((r) => r.y)) - pad;
  const right = Math.max(...rects.map((r) => r.x + r.w)) + pad;
  const bottom = Math.max(...rects.map((r) => r.y + r.h)) + pad;
  return { x, y, w: right - x, h: bottom - y };
};

/** Encaixa uma imagem w×h dentro da caixa, sem distorcer, centralizada. */
export const fitContain = (w: number, h: number, box: Rect): Rect => {
  const k = Math.min(box.w / w, box.h / h);
  return { x: box.x + (box.w - w * k) / 2, y: box.y + (box.h - h * k) / 2, w: w * k, h: h * k };
};

export interface ArtworkLabel {
  title: string;
  subtitle: string;
  rows: { label: string; value: string }[];
  note: string;
}

/** Texto da etiqueta do certificado: dados da obra, nunca da compra ou da peça. */
export const artworkLabel = (d: { serial: string; name: string; date: Date }): ArtworkLabel => ({
  title: 'Certificado de autenticidade',
  subtitle: 'Obra original · edição única 1/1',
  rows: [
    { label: 'Código da obra', value: d.serial },
    { label: 'Criada por', value: d.name },
    { label: 'Data', value: formatOrderDate(d.date) },
    { label: 'Técnica', value: 'Composição autoral sobre aquarelas Hortelã' },
  ],
  note: 'Esta composição foi criada uma única vez e não será reproduzida.',
});
