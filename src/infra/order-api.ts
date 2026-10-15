/** Envia o pedido ao Worker de pedidos (worker/), que valida, calcula o total e grava no Notion. */

export const ORDERS_API = import.meta.env.VITE_ORDERS_API ?? '';

export interface OrderResult {
  serial: string;
  total: number;
}

export class OrderSendError extends Error {}

export const sendOrder = async (payload: unknown, f: typeof fetch = fetch): Promise<OrderResult> => {
  if (!ORDERS_API) throw new OrderSendError('Pedidos indisponíveis no momento. Tente mais tarde.');
  let res: Response;
  try {
    res = await f(`${ORDERS_API}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new OrderSendError('Sem conexão. Confira a internet e tente de novo.');
  }
  const data = (await res.json().catch(() => ({}))) as Partial<OrderResult> & { error?: string };
  if (!res.ok || !data.serial)
    throw new OrderSendError(data.error ?? 'Não foi possível registrar o pedido. Tente de novo.');
  return { serial: data.serial, total: Number(data.total) };
};
