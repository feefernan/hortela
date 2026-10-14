/** Base32 de Crockford: sem I, L, O, U — fácil de ler e ditar. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SUFFIX_LENGTH = 6; // 32^6 ≈ 1,07 bilhão de combinações por dia

export type RandomBytes = (length: number) => Uint8Array;

const cryptoBytes: RandomBytes = (length) => globalThis.crypto.getRandomValues(new Uint8Array(length));

/** Gera o serial do pedido no formato HRT-AAAAMMDD-XXXXXX. */
export const generateSerial = (date: Date = new Date(), randomBytes: RandomBytes = cryptoBytes): string => {
  const ds =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  const suffix = Array.from(randomBytes(SUFFIX_LENGTH), (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `HRT-${ds}-${suffix}`;
};

export const SERIAL_PATTERN = /^HRT-\d{8}-[0-9A-HJKMNP-TV-Z]{6}$/;
