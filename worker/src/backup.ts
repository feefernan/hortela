/**
 * Cópia de segurança dos arquivos de cada pedido no R2 (por serial): a prévia em PNG e o SVG de produção.
 * No Notion esses arquivos ficam hospedados por lá, com o mesmo risco das imagens das estampas.
 * O SVG de produção é guardado com as imagens embutidas, para estar completo mesmo sem o site.
 */
import { type Bucket, detectImage, imageKey, SHA_PATTERN } from './stamps';

type Fetch = typeof fetch;

const toBase64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/**
 * Troca cada `<image href="…">` do SVG por data URL. Só imagens do próprio site: as estampas (R2, por hash)
 * e as letras do alfabeto (`/images/…`). Qualquer outro endereço fica como está — o Worker nunca busca
 * uma URL qualquer vinda do navegador.
 */
export const embedImages = async (svg: string, siteUrl: string, bucket: Bucket, f: Fetch): Promise<string> => {
  const site = new URL(siteUrl);
  const urls = new Set([...svg.matchAll(/<image\b[^>]*?\bhref="([^"]+)"/g)].map((m) => m[1]));
  const data = new Map<string, string>();
  await Promise.all(
    [...urls].map(async (href) => {
      let url: URL;
      try {
        url = new URL(href, site);
      } catch {
        return;
      }
      if (url.origin !== site.origin) return;
      const stamp = url.pathname.match(/^\/api\/estampas\/img\/([0-9a-f]{64})$/);
      let bytes: Uint8Array | null = null;
      if (stamp && SHA_PATTERN.test(stamp[1])) {
        const obj = await bucket.get(imageKey(stamp[1]));
        bytes = obj ? new Uint8Array(await obj.arrayBuffer()) : null;
      } else if (url.pathname.startsWith('/images/')) {
        const res = await f(url.href);
        bytes = res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
      }
      const type = bytes && detectImage(bytes);
      if (bytes && type) data.set(href, `data:${type};base64,${toBase64(bytes)}`);
    }),
  );
  return svg.replace(/(<image\b[^>]*?\bhref=")([^"]+)(")/g, (all, a: string, href: string, b: string) =>
    data.has(href) ? `${a}${data.get(href)}${b}` : all,
  );
};

export interface OrderFiles {
  serial: string;
  previewPng: Uint8Array<ArrayBuffer> | null;
  productionSvg: string | null;
}

export const backupOrder = async (bucket: Bucket, siteUrl: string, order: OrderFiles, f: Fetch) => {
  if (order.previewPng)
    await bucket.put(`pedidos/${order.serial}/preview.png`, order.previewPng.buffer, {
      httpMetadata: { contentType: 'image/png' },
    });
  if (order.productionSvg) {
    // Embutir é o ideal; se alguma imagem falhar, o SVG original é guardado mesmo assim.
    const svg = await embedImages(order.productionSvg, siteUrl, bucket, f).catch(() => order.productionSvg as string);
    await bucket.put(`pedidos/${order.serial}/producao.svg`, svg, {
      httpMetadata: { contentType: 'image/svg+xml' },
    });
  }
};
