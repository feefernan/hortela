/**
 * Estampas do Estúdio: o banco Estampas do Notion manda; as imagens são copiadas para o R2.
 *
 * O Notion não é depósito: o link do arquivo expira em ~1h e o arquivo some se a linha for apagada.
 * Por isso cada imagem é baixada uma vez, validada e guardada no R2 com o nome igual ao hash do conteúdo
 * (`estampas/<sha256>`). O endereço público é imutável: trocar a arte gera outro hash, e o antigo continua
 * existindo — os SVGs de produção dos pedidos já feitos seguem reproduzíveis.
 */
import type { StampRow } from '../../src/domain/catalog';
import { firstFile, plain, queryDatabase } from './notion';

type Fetch = typeof fetch;

/** Parte do R2 que o Worker usa (R2Bucket real e o falso dos testes cabem aqui). */
export interface Bucket {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
  head(key: string): Promise<unknown | null>;
  put(
    key: string,
    value: ArrayBuffer | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const SHA_PATTERN = /^[0-9a-f]{64}$/;
export const imageKey = (sha: string) => `estampas/${sha}`;
const metaKey = (id: string) => `estampas/_meta/${encodeURIComponent(id)}.json`;
export const imagePath = (sha: string) => `/api/estampas/img/${sha}`;

/** Tipo da imagem pela assinatura dos primeiros bytes (a extensão ou o tipo informado não valem). */
export const detectImage = (b: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null => {
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
  return null;
};

export const sha256Hex = async (bytes: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');

interface Meta {
  sha: string;
  /** Versão do arquivo no Notion quando foi copiado (última edição + nome). */
  v: string;
}

const readMeta = async (bucket: Bucket, id: string): Promise<Meta | null> => {
  const obj = await bucket.get(metaKey(id));
  if (!obj) return null;
  try {
    return JSON.parse(new TextDecoder().decode(await obj.arrayBuffer())) as Meta;
  } catch {
    return null;
  }
};

/**
 * Garante a cópia no R2 e devolve o hash. Sem mudança desde a última cópia, não baixa nada.
 * Falhou (download, formato, tamanho)? Devolve o hash da cópia anterior, se houver: a arte velha continua valendo.
 */
const syncImage = async (
  f: Fetch,
  bucket: Bucket,
  id: string,
  url: string,
  version: string,
): Promise<string | null> => {
  const previous = await readMeta(bucket, id);
  if (previous?.v === version) return previous.sha;
  try {
    const res = await f(url);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error(`imagem grande demais (${bytes.byteLength} bytes)`);
    const type = detectImage(new Uint8Array(bytes));
    if (!type) throw new Error('o arquivo não é PNG, JPEG nem WebP');
    const sha = await sha256Hex(bytes);
    if (!(await bucket.head(imageKey(sha))))
      await bucket.put(imageKey(sha), bytes, { httpMetadata: { contentType: type } });
    await bucket.put(metaKey(id), JSON.stringify({ sha, v: version } satisfies Meta));
    return sha;
  } catch (e) {
    console.warn(JSON.stringify({ level: 'warn', msg: 'estampa: cópia da imagem falhou', id, error: String(e) }));
    return previous?.sha ?? null;
  }
};

export interface StampEnv {
  NOTION_TOKEN: string;
  NOTION_STAMPS_DB: string;
  ESTAMPAS_BUCKET: Bucket;
}

/** Estampas ativas do banco, na Ordem, com as imagens já copiadas para o R2. Uma estampa ruim não derruba as outras. */
export const listStamps = async (f: Fetch, env: StampEnv): Promise<StampRow[]> => {
  const pages = await queryDatabase(f, env.NOTION_TOKEN, env.NOTION_STAMPS_DB);
  const rows = await Promise.all(
    pages.map(async ({ properties: p, last_edited_time }) => {
      const id = plain(p.ID);
      const name = plain(p.Estampa);
      if (!id || !name || !(p['Ativa no Estúdio']?.checkbox ?? true)) return null;
      const file = firstFile(p.Imagem);
      const sha = file
        ? await syncImage(f, env.ESTAMPAS_BUCKET, id, file.url, `${last_edited_time ?? ''}|${file.name}`)
        : null;
      return {
        id,
        name,
        series: p.Série?.select?.name ?? (plain(p.Série) || 'Estampas'),
        order: p.Ordem?.number ?? null,
        image: sha ? imagePath(sha) : null,
      } satisfies StampRow;
    }),
  );
  return rows.filter((r) => r !== null);
};
