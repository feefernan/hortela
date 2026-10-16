/** Regras puras de frete, endereço e status de pagamento — usadas pelo site e pelo Worker. */

/** CEP só com os 8 dígitos, ou null se não for um CEP. */
export const normalizeCep = (value: unknown): string | null => {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  return digits.length === 8 ? digits : null;
};

export const formatCep = (cep: string) => `${cep.slice(0, 5)}-${cep.slice(5)}`;

/**
 * Pacote de uma peça dobrada (cm, kg).
 * shortcut: medidas provisórias até a Hortelã enviar as reais (#52); o frete cotado sai aproximado até lá.
 */
const PIECE_PACKAGE = { width: 30, height: 4, length: 25, weight: 0.3 };

/** Itens para a cotação do Melhor Envio: `count` peças que somam `value` reais (valor declarado). */
export const shippingProducts = (count: number, value: number) => [
  {
    id: 'pecas',
    ...PIECE_PACKAGE,
    insurance_value: Math.round((value / count) * 100) / 100,
    quantity: count,
  },
];

/**
 * Opções de frete que o cliente vê: até `max`, as mais baratas, com a mais rápida sempre entre elas
 * (o Melhor Envio devolve uma dúzia e a lista cansa). O pedido continua aceitando qualquer opção cotada.
 */
export const pickShippingOptions = <T extends { price: number; days: number }>(options: T[], max = 4): T[] => {
  const picked = [...options].sort((a, b) => a.price - b.price || a.days - b.days).slice(0, max);
  const fastest = [...options].sort((a, b) => a.days - b.days || a.price - b.price)[0];
  if (fastest && !picked.includes(fastest)) picked[picked.length - 1] = fastest;
  return picked;
};

export interface Address {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  uf: string;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Endereço de entrega validado, ou null se faltar algo obrigatório. */
export const parseAddress = (raw: unknown): Address | null => {
  const a = (raw ?? {}) as Record<string, unknown>;
  const cep = normalizeCep(a.cep);
  const address = {
    cep: cep ?? '',
    street: clean(a.street, 120),
    number: clean(a.number, 20),
    complement: clean(a.complement, 80),
    district: clean(a.district, 80),
    city: clean(a.city, 80),
    uf: clean(a.uf, 2).toUpperCase(),
  };
  const required = [address.cep, address.street, address.number, address.district, address.city];
  return required.every(Boolean) && /^[A-Z]{2}$/.test(address.uf) ? address : null;
};

export const formatAddress = (a: Address) =>
  [
    `${a.street}, ${a.number}${a.complement ? ` — ${a.complement}` : ''}`,
    `${a.district} · ${a.city}/${a.uf}`,
    `CEP ${formatCep(a.cep)}`,
  ].join('\n');

export type PaymentStatus = 'Aguardando pagamento' | 'Pago' | 'Cancelado';

/** Status do pagamento no Mercado Pago → status do pedido no Notion. */
export const paymentStatus = (mpStatus: string): PaymentStatus => {
  if (mpStatus === 'approved') return 'Pago';
  if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(mpStatus)) return 'Cancelado';
  return 'Aguardando pagamento';
};

/**
 * Status novo do pedido diante de um aviso de pagamento. Um pedido Pago só sai de Pago por estorno ou
 * contestação: o aviso atrasado de uma tentativa recusada (outro cartão) não desfaz o pagamento aprovado.
 */
export const nextOrderStatus = (current: string, mpStatus: string): PaymentStatus | null => {
  const next = paymentStatus(mpStatus);
  if (current === 'Pago' && next !== 'Pago' && !['refunded', 'charged_back'].includes(mpStatus)) return null;
  return next === current ? null : next;
};
