/** Conversa com o Worker de pedidos (worker/): cota o frete, envia o pedido e consulta o status do pagamento. */

export const ORDERS_API = import.meta.env.VITE_ORDERS_API ?? '';

export interface OrderResult {
  serial: string;
  total: number;
  /** Link do Mercado Pago; null quando a cobrança ainda não está ligada no Worker. */
  checkoutUrl: string | null;
}

export interface ShippingOption {
  id: number;
  name: string;
  company: string;
  price: number;
  days: number;
}

export class OrderSendError extends Error {}

const call = async <T>(path: string, init: RequestInit | undefined, fallback: string, f: typeof fetch): Promise<T> => {
  if (!ORDERS_API) throw new OrderSendError('Pedidos indisponíveis no momento. Tente mais tarde.');
  let res: Response;
  try {
    res = await f(`${ORDERS_API}${path}`, init);
  } catch {
    throw new OrderSendError('Sem conexão. Confira a internet e tente de novo.');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new OrderSendError(data.error ?? fallback);
  return data;
};

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const sendOrder = async (payload: unknown, f: typeof fetch = fetch): Promise<OrderResult> => {
  const data = await call<Partial<OrderResult>>(
    '/api/orders',
    post(payload),
    'Não foi possível registrar o pedido. Tente de novo.',
    f,
  );
  if (!data.serial) throw new OrderSendError('Não foi possível registrar o pedido. Tente de novo.');
  return { serial: data.serial, total: Number(data.total), checkoutUrl: data.checkoutUrl ?? null };
};

export const quoteShipping = async (payload: unknown, f: typeof fetch = fetch): Promise<ShippingOption[]> =>
  (
    await call<{ options: ShippingOption[] }>(
      '/api/shipping/quote',
      post(payload),
      'Não foi possível calcular o frete.',
      f,
    )
  ).options;

export const fetchOrderStatus = async (serial: string, f: typeof fetch = fetch): Promise<string> =>
  (
    await call<{ status: string }>(
      `/api/orders/${encodeURIComponent(serial)}/status`,
      undefined,
      'Não foi possível consultar o pedido.',
      f,
    )
  ).status;

export interface CepAddress {
  street: string;
  district: string;
  city: string;
  uf: string;
}

/** Endereço do CEP pelo ViaCEP (gratuito). null se o CEP não existe ou o serviço falhou — o cliente digita. */
export const lookupCep = async (cep: string, f: typeof fetch = fetch): Promise<CepAddress | null> => {
  try {
    const res = await f(`https://viacep.com.br/ws/${cep}/json/`);
    const d = (await res.json()) as {
      erro?: unknown;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (!res.ok || d.erro) return null;
    return { street: d.logradouro ?? '', district: d.bairro ?? '', city: d.localidade ?? '', uf: d.uf ?? '' };
  } catch {
    return null;
  }
};
