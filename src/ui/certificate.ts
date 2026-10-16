import { artworkLabel, fitContain } from '../domain/certificate';
import type { Order } from '../domain/orders';
import { downloadDataUrl, loadImage } from './capture';

type CertificateData = Pick<Order, 'serial' | 'name' | 'artB64' | 'imgB64'>;

// A4 paisagem a 150 dpi.
const W = 1754;
const H = 1240;
const M = 100; // margem interna
const LABEL_W = 420; // etiqueta no canto inferior direito, como numa galeria
const LABEL_X = W - M - LABEL_W;
const ART = { x: M, y: M, w: LABEL_X - M - 60, h: H - 2 * M };

const INK = '#1C1812';
const MOSS = '#3C4E2E';
const SAGE = '#7A9268';
const LILAC = '#9B7FA8';
const LINE = '#D6CCBA';

/** Quebra o texto em linhas que cabem em `width`. */
const wrap = (ctx: CanvasRenderingContext2D, text: string, width: number): string[] =>
  text.split(' ').reduce<string[]>((lines, word) => {
    const last = lines.at(-1);
    if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= width)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
    return lines;
  }, []);

/** O símbolo da Hortelã (mesmo desenho do favicon), em `size` px. */
const drawLogo = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.lineCap = 'round';
  ctx.strokeStyle = MOSS;
  ctx.lineWidth = 1.8;
  ctx.stroke(new Path2D('M 4 18 Q 8 5 12 5 Q 16 5 18 14'));
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.3;
  ctx.stroke(new Path2D('M 8 20 Q 11 9 15 7'));
  ctx.globalAlpha = 1;
  ctx.strokeStyle = SAGE;
  ctx.lineWidth = 1.2;
  ctx.stroke(new Path2D('M 5 4 L 19 20'));
  ctx.fillStyle = LILAC;
  ctx.beginPath();
  ctx.arc(17.5, 5.5, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** Etiqueta da obra, ancorada no canto inferior direito. */
const drawLabel = (ctx: CanvasRenderingContext2D, d: CertificateData) => {
  const label = artworkLabel({ serial: d.serial, name: d.name, date: new Date() });
  const x = LABEL_X;
  const ops: { h: number; draw: (y: number) => void }[] = [];
  const text = (font: string, color: string, value: string, lineH: number, spacing = '0px') => {
    ctx.font = font;
    for (const line of wrap(ctx, value, LABEL_W))
      ops.push({
        h: lineH,
        draw: (y) => {
          ctx.font = font;
          ctx.fillStyle = color;
          ctx.letterSpacing = spacing;
          ctx.fillText(line, x, y);
          ctx.letterSpacing = '0px';
        },
      });
  };
  const gap = (h: number) => ops.push({ h, draw: () => {} });

  ops.push({
    h: 64,
    draw: (y) => {
      drawLogo(ctx, x, y - 40, 48);
      ctx.font = 'bold 20px Georgia, serif';
      ctx.fillStyle = INK;
      ctx.letterSpacing = '10px';
      ctx.fillText('HORTELÃ', x + 64, y - 14);
      ctx.letterSpacing = '0px';
      ctx.font = 'italic 15px Georgia, serif';
      ctx.fillStyle = SAGE;
      ctx.fillText('Arte vestível em aquarela', x + 64, y + 8);
    },
  });
  gap(28);
  text('italic 32px Georgia, serif', MOSS, label.title, 40);
  text('italic 18px Georgia, serif', SAGE, label.subtitle, 26);
  ops.push({
    h: 34,
    draw: (y) => {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + LABEL_W, y);
      ctx.stroke();
    },
  });
  for (const row of label.rows) {
    text('13px Georgia, serif', SAGE, row.label.toUpperCase(), 22, '2px');
    if (row.label === 'Código da obra') text('bold 20px "Courier New", monospace', LILAC, row.value, 34);
    else text('italic 21px Georgia, serif', INK, row.value, 34);
    gap(6);
  }
  gap(10);
  text('italic 15px Georgia, serif', SAGE, label.note, 22);

  let y = H - M - ops.reduce((sum, op) => sum + op.h, 0);
  for (const op of ops) {
    y += op.h;
    op.draw(y);
  }
};

/** Gera e baixa o certificado da obra (PNG A4 paisagem, 150 dpi): a arte em destaque e a etiqueta da obra. */
export const downloadCertificate = async (d: CertificateData): Promise<void> => {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#F3EDE0';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.lineWidth = 0.5;
  ctx.strokeRect(52, 52, W - 104, H - 104);

  // Só a arte; o preview com camiseta fica de reserva para pedidos antigos.
  const src = d.artB64 ?? d.imgB64;
  const img = src ? await loadImage(src) : null;
  if (img) {
    const r = fitContain(img.width, img.height, ART);
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
  }
  drawLabel(ctx, d);
  downloadDataUrl(canvas.toDataURL('image/png', 1.0), `hortelã-certificado-${d.serial}.png`);
};
