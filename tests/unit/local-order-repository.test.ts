import { beforeEach, describe, expect, it } from 'vitest';
import type { Order } from '../../src/domain/orders';
import { createLocalOrderRepository, ORDERS_KEY } from '../../src/infra/local-order-repository';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const order = (serial: string, extra: Partial<Order> = {}): Order => ({
  serial,
  name: 'Ana',
  email: 'ana@site.com',
  obs: '',
  cfg: { model: 'Camiseta', color: 'Musgo', size: 'G', view: 'Frente', stamps: ['Açucena'] },
  total: 'R$ 200',
  date: 'hoje',
  ...extra,
});

describe('createLocalOrderRepository', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('salva pedidos do mais novo para o mais antigo, com anexos separados', () => {
    const repo = createLocalOrderRepository(storage);
    repo.save(order('A', { imgB64: 'img-a', svgData: 'svg-a' }));
    repo.save(order('B'));
    expect(repo.list().map((o) => o.serial)).toEqual(['B', 'A']);
    expect(repo.asset('A', 'img')).toBe('img-a');
    expect(repo.asset('A', 'svg')).toBe('svg-a');
    expect(repo.asset('B', 'img')).toBeNull();
  });

  it('atualiza o status e remove pedidos com seus anexos', () => {
    const repo = createLocalOrderRepository(storage);
    repo.save(order('A', { imgB64: 'img-a' }));
    repo.updateStatus('A', 'enviado');
    repo.updateStatus('inexistente', 'enviado');
    expect(repo.list()[0].status).toBe('enviado');
    repo.remove('A');
    expect(repo.list()).toEqual([]);
    expect(repo.asset('A', 'img')).toBeNull();
  });

  it('tolera JSON corrompido', () => {
    storage.setItem(ORDERS_KEY, '{quebrado');
    expect(createLocalOrderRepository(storage).list()).toEqual([]);
  });
});
