import { artworkLabel, fitContain } from '../domain/certificate';
import type { Order } from '../domain/orders';
import { downloadDataUrl, loadImage } from './capture';

type CertificateData = Pick<Order, 'serial' | 'name' | 'artB64' | 'imgB64'>;

// A4 paisagem a 150 dpi.
const W = 1754;
const H = 1240;
const M = 96; // margem interna
const LABEL_H = 130; // 3 linhas centralizadas na base
const CX = W / 2;
const ART = { x: M, y: M, w: W - 2 * M, h: H - 2 * M - LABEL_H - 30 };

const INK = '#1C1812';
const MOSS = '#3C4E2E';
const SAGE = '#7A9268';
const LINE = '#D6CCBA';

/** Escreve uma linha centralizada, reduzindo a fonte até caber na página (nomes longos). */
const fitText = (ctx: CanvasRenderingContext2D, text: string, y: number, size: number, style: string) => {
  let px = size;
  do ctx.font = `${style} ${px--}px Georgia, serif`;
  while (ctx.measureText(text).width > W - 2 * M && px > 10);
  ctx.fillText(text, CX, y);
};

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
  ctx.fillStyle = '#9B7FA8';
  ctx.beginPath();
  ctx.arc(17.5, 5.5, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** Etiqueta da obra centralizada na base: marca, código da obra e autoria — três linhas. */
const drawLabel = (ctx: CanvasRenderingContext2D, d: CertificateData) => {
  const { code, author } = artworkLabel({ serial: d.serial, name: d.name, date: new Date() });
  const bottom = H - M;
  ctx.font = 'bold 18px Georgia, serif';
  ctx.letterSpacing = '9px';
  const brandW = 50 + ctx.measureText('HORTELÃ').width;
  drawLogo(ctx, CX - brandW / 2, bottom - 118, 40);
  ctx.fillStyle = INK;
  ctx.fillText('HORTELÃ', CX - brandW / 2 + 50, bottom - 88);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'center';
  ctx.fillStyle = MOSS;
  ctx.font = '20px "Courier New", monospace';
  ctx.fillText(code, CX, bottom - 40);
  ctx.fillStyle = SAGE;
  fitText(ctx, author, bottom, 19, 'italic');
  ctx.textAlign = 'start';
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
