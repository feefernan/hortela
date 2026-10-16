/** Cotação de frete no Melhor Envio (docs.melhorenvio.com.br, "Cálculo de fretes por produtos"). */
import { shippingProducts } from '../../src/domain/shipping';

export interface ShippingOption {
  id: number;
  name: string;
  company: string;
  price: number;
  days: number;
}

export interface MelhorEnvioEnv {
  MELHOR_ENVIO_API: string;
  MELHOR_ENVIO_TOKEN: string;
  ORIGIN_CEP: string;
}

interface Quote {
  id: number;
  name: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  company?: { name?: string };
  error?: string;
}

/** Opções de envio para `count` peças que somam `value` reais, do CEP de origem até `to`. Mais baratas primeiro. */
export const quoteShipping = async (
  f: typeof fetch,
  env: MelhorEnvioEnv,
  to: string,
  goods: { count: number; total: number },
): Promise<ShippingOption[]> => {
  const res = await f(`${env.MELHOR_ENVIO_API}/api/v2/me/shipment/calculate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.MELHOR_ENVIO_TOKEN}`,
      // O Melhor Envio exige nome do app e um e-mail de contato técnico.
      'User-Agent': 'Hortela (usehortela@gmail.com)',
    },
    body: JSON.stringify({
      from: { postal_code: env.ORIGIN_CEP },
      to: { postal_code: to },
      products: shippingProducts(goods.count, goods.total),
    }),
  });
  if (!res.ok) throw new Error(`Melhor Envio cotação: ${res.status} ${await res.text()}`);
  const quotes = (await res.json()) as Quote[];
  return quotes
    .filter((q) => !q.error && (q.custom_price ?? q.price))
    .map((q) => ({
      id: q.id,
      name: q.name,
      company: q.company?.name ?? '',
      // custom_*: já com as taxas e descontos da conta (recomendado pela documentação).
      price: Number(q.custom_price ?? q.price),
      days: Number(q.custom_delivery_time ?? q.delivery_time ?? 0),
    }))
    .sort((a, b) => a.price - b.price);
};
