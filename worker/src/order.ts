/**
 * Valida o pedido que vem do navegador e recalcula tudo que envolve dinheiro no servidor.
 * Reaproveita as regras puras de src/domain — o navegador nunca decide preço, total ou serial.
 */
import { addToCart, type Cart, lineLabel, parseCart } from '../../src/domain/cart';
import { findProduct } from '../../src/domain/catalog';
import { MODELS, type ModelId, studioTotal } from '../../src/domain/pricing';
import { generateSerial } from '../../src/domain/serial';
import { validateCheckout } from '../../src/domain/validation';

export interface OrderInput {
  kind: 'estudio' | 'colecao';
  name: string;
  email: string;
  obs: string;
  items?: unknown;
  studio?: { model?: unknown; color?: unknown; size?: unknown; view?: unknown; stamps?: unknown };
  previewPng?: unknown;
  productionSvg?: unknown;
}

export interface ValidOrder {
  serial: string;
  kind: 'estudio' | 'colecao';
  name: string;
  email: string;
  obs: string;
  total: number;
  model: string;
  color: string;
  size: string;
  view: string;
  lines: string[];
  previewPng: Uint8Array<ArrayBuffer> | null;
  productionSvg: string | null;
}

export class OrderError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const MAX_FILE_BYTES = 4 * 1024 * 1024; // limite de upload do Notion no plano grátis é 5 MB
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const decodePng = (v: unknown): Uint8Array<ArrayBuffer> | null => {
  if (typeof v !== 'string' || !v.startsWith('data:image/png;base64,')) return null;
  const bin = atob(v.slice('data:image/png;base64,'.length));
  if (bin.length > MAX_FILE_BYTES) throw new OrderError(413, 'Imagem da composição grande demais');
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** Reconstrói o carrinho peça a peça com as regras do domínio (esgotada, limite, preço atual). */
const rebuildCart = (raw: unknown): Cart => {
  const asked = parseCart(raw);
  if (!asked.length) throw new OrderError(400, 'Carrinho vazio');
  let cart: Cart = [];
  for (const line of asked) {
    const product = findProduct(line.productId);
    if (!product) throw new OrderError(409, `Peça não encontrada: ${line.productId}`);
    for (let i = 0; i < line.qty; i++) {
      const r = addToCart(cart, product, line.size);
      if (!r.ok)
        throw new OrderError(
          409,
          r.reason === 'esgotada' ? `${product.name} esgotou` : `Limite de ${product.name} atingido`,
        );
      cart = r.cart;
    }
  }
  return cart;
};

export const validateOrder = (input: OrderInput, now = new Date()): ValidOrder => {
  const contact = { name: text(input.name, 120), email: text(input.email, 160), obs: text(input.obs, 1000) };
  if (validateCheckout(contact)) throw new OrderError(400, 'Nome ou e-mail inválido');
  const base = { serial: generateSerial(now), ...contact };

  if (input.kind === 'colecao') {
    const cart = rebuildCart(input.items);
    return {
      ...base,
      kind: 'colecao',
      total: cart.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
      model: 'Peças da coleção',
      color: '—',
      size: [...new Set(cart.map((l) => l.size))].join(', '),
      view: '—',
      lines: cart.map(lineLabel),
      previewPng: null,
      productionSvg: null,
    };
  }

  if (input.kind === 'estudio') {
    const s = input.studio ?? {};
    const model = s.model as ModelId;
    if (!(typeof model === 'string' && model in MODELS)) throw new OrderError(400, 'Modelo inválido');
    const stamps = Array.isArray(s.stamps)
      ? s.stamps
          .map((x) => text(x, 80))
          .filter(Boolean)
          .slice(0, 30)
      : [];
    if (!stamps.length) throw new OrderError(400, 'Composição sem estampas');
    const svg = text(input.productionSvg, MAX_FILE_BYTES).replaceAll('__SERIAL__', base.serial);
    return {
      ...base,
      kind: 'estudio',
      total: studioTotal(model),
      model: MODELS[model].label,
      color: text(s.color, 40),
      size: text(s.size, 4),
      view: text(s.view, 40),
      lines: stamps,
      previewPng: decodePng(input.previewPng),
      productionSvg: svg.startsWith('<?xml') || svg.startsWith('<svg') ? svg : null,
    };
  }

  throw new OrderError(400, 'Tipo de pedido inválido');
};
