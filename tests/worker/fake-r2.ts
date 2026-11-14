import type { Bucket } from '../../worker/src/stamps';

/** R2 falso em memória: guarda o que o Worker grava e responde como o R2 real. */
export const fakeBucket = () => {
  const objects = new Map<string, { bytes: ArrayBuffer; contentType?: string }>();
  const puts: string[] = [];
  const bucket: Bucket = {
    async get(key) {
      const o = objects.get(key);
      return o ? { arrayBuffer: async () => o.bytes.slice(0), httpMetadata: { contentType: o.contentType } } : null;
    },
    async head(key) {
      return objects.has(key) ? {} : null;
    },
    async put(key, value, options) {
      puts.push(key);
      const bytes = typeof value === 'string' ? new TextEncoder().encode(value).buffer : value;
      objects.set(key, { bytes: bytes as ArrayBuffer, contentType: options?.httpMetadata?.contentType });
      return {};
    },
  };
  return { bucket, objects, puts };
};
