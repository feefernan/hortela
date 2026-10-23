import { artworkLabel, fitContain } from '../domain/certificate';
import type { Order } from '../domain/orders';
import { downloadDataUrl, loadImage } from './capture';
import { drawSymbol } from './symbol';

type CertificateData = Pick<Order, 'serial' | 'name' | 'artB64' | 'imgB64'>;

// A4 paisagem a 150 dpi.
const W = 1754;
const H = 1240;
const M = 96; // margem interna
const LABEL_H = 130; // 3 linhas centralizadas na base
const CX = W / 2;
const ART = { x: M, y: M, w: W - 2 * M, h: H - 2 * M - LABEL_H - 30 };

const INK = '#16261A';
const MOSS = '#1F4A2E';
const SAGE = '#4F6B55';
const LINE = '#C9D3CA';

/** Escreve uma linha centralizada, reduzindo a fonte até caber na página (nomes longos). */
const fitText = (ctx: CanvasRenderingContext2D, text: string, y: number, size: number, style: string) => {
  let px = size;
  do ctx.font = `${style} ${px--}px "Cormorant Garamond", serif`;
  while (ctx.measureText(text).width > W - 2 * M && px > 10);
  ctx.fillText(text, CX, y);
};

/** Etiqueta da obra centralizada na base: marca, código da obra e autoria — três linhas. */
const drawLabel = (ctx: CanvasRenderingContext2D, d: CertificateData) => {
  const { code, author } = artworkLabel({ serial: d.serial, name: d.name, date: new Date() });
  const bottom = H - M;
  ctx.font = '600 22px "Cormorant Garamond", serif';
  ctx.letterSpacing = '10px';
  const brandW = 52 + ctx.measureText('HORTELÃ').width;
  drawSymbol(ctx, CX - brandW / 2, bottom - 124, 44);
  ctx.fillStyle = INK;
  ctx.fillText('HORTELÃ', CX - brandW / 2 + 52, bottom - 90);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'center';
  ctx.fillStyle = MOSS;
  ctx.font = '500 19px "DM Sans", sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText(code, CX, bottom - 40);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = SAGE;
  fitText(ctx, author, bottom, 22, 'italic 500');
  ctx.textAlign = 'start';
};

/** Gera e baixa o certificado da obra (PNG A4 paisagem, 150 dpi): a arte em destaque e a etiqueta da obra. */
export const downloadCertificate = async (d: CertificateData): Promise<void> => {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#F6F8F6';
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
