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
      checkoutUrl: null,
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

describe('frete, status e CEP', () => {
  it('cota o frete e consulta o status no Worker', async () => {
    const { quoteShipping, fetchOrderStatus } = await load();
    const opts = [{ id: 1, name: 'PAC', company: 'Correios', price: 22.5, days: 7 }];
    const f = vi.fn(async (url: string) =>
      url.endsWith('/quote') ? Response.json({ options: opts }) : Response.json({ status: 'Pago' }),
    );
    await expect(quoteShipping({ cep: '1' }, f as unknown as typeof fetch)).resolves.toEqual(opts);
    await expect(fetchOrderStatus('HRT-1', f as unknown as typeof fetch)).resolves.toBe('Pago');
    expect(f).toHaveBeenLastCalledWith('https://api.test/api/orders/HRT-1/status', undefined);
  });

  it('CEP pelo ViaCEP; CEP inexistente ou serviço fora do ar viram null', async () => {
    const { lookupCep } = await load();
    const ok = vi.fn(async () =>
      Response.json({ logradouro: 'Rua A', bairro: 'Centro', localidade: 'Rio de Janeiro', uf: 'RJ' }),
    );
    await expect(lookupCep('20040020', ok as unknown as typeof fetch)).resolves.toEqual({
      street: 'Rua A',
      district: 'Centro',
      city: 'Rio de Janeiro',
      uf: 'RJ',
    });
    expect(ok).toHaveBeenCalledWith('https://viacep.com.br/ws/20040020/json/');
    const missing = vi.fn(async () => Response.json({ erro: true }));
    await expect(lookupCep('00000000', missing as unknown as typeof fetch)).resolves.toBeNull();
    const down = vi.fn(async () => {
      throw new TypeError('offline');
    });
    await expect(lookupCep('20040020', down as unknown as typeof fetch)).resolves.toBeNull();
  });
});
