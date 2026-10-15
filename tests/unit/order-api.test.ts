import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const load = async (url = 'https://api.test') => {
  vi.stubEnv('VITE_ORDERS_API', url);
  return import('../../src/infra/order-api');
};

describe('sendOrder', () => {
  it('posta o pedido e devolve serial e total do servidor', async () => {
    const { sendOrder } = await load();
    const f = vi.fn(async () => Response.json({ serial: 'HRT-1', total: 210 }, { status: 201 }));
    await expect(sendOrder({ kind: 'colecao' }, f as unknown as typeof fetch)).resolves.toEqual({
      serial: 'HRT-1',
      total: 210,
    });
    expect(f).toHaveBeenCalledWith('https://api.test/api/orders', expect.objectContaining({ method: 'POST' }));
  });

  it('erros viram mensagens para a pessoa', async () => {
    const { sendOrder, OrderSendError } = await load();
    const recusa = vi.fn(async () => Response.json({ error: 'Raízes esgotou' }, { status: 409 }));
    await expect(sendOrder({}, recusa as unknown as typeof fetch)).rejects.toThrow('Raízes esgotou');
    const semRede = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(sendOrder({}, semRede as unknown as typeof fetch)).rejects.toBeInstanceOf(OrderSendError);
    const lixo = vi.fn(async () => new Response('<html>', { status: 500 }));
    await expect(sendOrder({}, lixo as unknown as typeof fetch)).rejects.toThrow(/Tente de novo/);
  });

  it('sem URL configurada, avisa sem chamar a rede', async () => {
    const { sendOrder } = await load('');
    const f = vi.fn();
    await expect(sendOrder({}, f as unknown as typeof fetch)).rejects.toThrow(/indisponíveis/);
    expect(f).not.toHaveBeenCalled();
  });
});
