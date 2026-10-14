import type { Order } from '../domain/orders';
import { downloadDataUrl } from './capture';

type CertificateData = Pick<Order, 'serial' | 'name' | 'obs' | 'cfg' | 'imgB64'>;

const LEFT_W = 520;

const drawRight = (ctx: CanvasRenderingContext2D, d: CertificateData) => {
  ctx.strokeStyle = '#D6CCBA';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LEFT_W, 60);
  ctx.lineTo(LEFT_W, 814);
  ctx.stroke();

  // símbolo
  const sx = LEFT_W + 56;
  const sy = 72;
  ctx.strokeStyle = '#3C4E2E';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx + 2, sy + 20);
  ctx.quadraticCurveTo(sx + 10, sy + 4, sx + 16, sy + 4);
  ctx.quadraticCurveTo(sx + 22, sy + 4, sx + 26, sy + 16);
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx + 7, sy + 22);
  ctx.quadraticCurveTo(sx + 14, sy + 8, sx + 20, sy + 7);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#7A9268';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sx + 4, sy + 2);
  ctx.lineTo(sx + 26, sy + 24);
  ctx.stroke();
  ctx.fillStyle = '#9B7FA8';
  ctx.beginPath();
  ctx.arc(sx + 25, sy + 4, 3.5, 0, Math.PI * 2);
  ctx.fill();

  const rx = LEFT_W + 56;
  ctx.fillStyle = '#1C1812';
  ctx.font = 'bold 14px Georgia, serif';
  ctx.letterSpacing = '8px';
  ctx.fillText('HORTELÃ', rx + 38, sy + 18);
  ctx.letterSpacing = '0px';
  ctx.font = 'italic 11px Georgia, serif';
  ctx.fillStyle = '#7A9268';
  ctx.fillText('Arte vestível em aquarela', rx + 38, sy + 34);

  ctx.font = 'italic 38px Georgia, serif';
  ctx.fillStyle = '#3C4E2E';
  ctx.fillText('Certificado', rx, 150);
  ctx.font = 'italic 20px Georgia, serif';
  ctx.fillStyle = '#7A9268';
  ctx.fillText('de composição autoral', rx, 178);
  ctx.strokeStyle = '#D6CCBA';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rx, 196);
  ctx.lineTo(rx + 640, 196);
  ctx.stroke();

  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillStyle = '#9B7FA8';
  ctx.fillText(d.serial, rx, 228);

  let y = 272;
  const row = (label: string, value: string) => {
    ctx.font = '10px Georgia, serif';
    ctx.fillStyle = '#7A9268';
    ctx.fillText(label.toUpperCase(), rx, y);
    ctx.font = 'italic 16px Georgia, serif';
    ctx.fillStyle = '#1C1812';
    ctx.fillText(value, rx, y + 16);
    y += 40;
  };
  row('Cliente', d.name);
  row('Modelo', d.cfg.model);
  row('Cor da peça', d.cfg.color);
  row('Tamanho', d.cfg.size);
  row('Posição', d.cfg.view);
  row('Estampas', d.cfg.stamps.join(', '));
  if (d.obs) row('Observações', d.obs);

  ctx.font = 'italic 13px Georgia, serif';
  ctx.fillStyle = '#7A9268';
  ctx.fillText('Esta composição foi criada uma única vez. A arte pertence a quem a veste.', rx, 750);
  ctx.font = '11px Georgia, serif';
  ctx.fillStyle = '#D6CCBA';
  ctx.fillText(new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), rx, 772);
};

/** Gera e baixa o certificado (PNG A5 paisagem, 150dpi). */
export const downloadCertificate = async (d: CertificateData): Promise<void> => {
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 874;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#F3EDE0';
  ctx.fillRect(0, 0, 1240, 874);
  ctx.strokeStyle = '#D6CCBA';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(28, 28, 1184, 818);
  ctx.lineWidth = 0.5;
  ctx.strokeRect(38, 38, 1164, 798);

  if (d.imgB64) {
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => resolve(null);
      i.src = d.imgB64 as string;
    });
    if (img) {
      const ratio = Math.min((LEFT_W - 80) / img.width, 680 / img.height);
      const iw = img.width * ratio;
      const ih = img.height * ratio;
      ctx.drawImage(img, 60 + (LEFT_W - 80 - iw) / 2, 97 + (680 - ih) / 2, iw, ih);
    }
  }
  drawRight(ctx, d);
  downloadDataUrl(canvas.toDataURL('image/png', 1.0), `hortelã-certificado-${d.serial}.png`);
};
