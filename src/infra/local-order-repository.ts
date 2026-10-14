import {
  type Order,
  type OrderAsset,
  type OrderRecord,
  type OrderRepository,
  type OrderStatus,
  toRecord,
} from '../domain/orders';

export const ORDERS_KEY = 'hortela_orders_v1';
const assetKey = (serial: string, type: OrderAsset) => `hortela_${type}_${serial}`;

/** Persistência em localStorage (só no navegador de quem fez o pedido — ver issue de backend). */
export const createLocalOrderRepository = (storage: Storage = window.localStorage): OrderRepository => {
  const list = (): OrderRecord[] => {
    try {
      return JSON.parse(storage.getItem(ORDERS_KEY) || '[]') as OrderRecord[];
    } catch {
      return [];
    }
  };
  const write = (orders: OrderRecord[]) => storage.setItem(ORDERS_KEY, JSON.stringify(orders));

  return {
    list,
    save(order: Order) {
      const orders = list();
      orders.unshift(toRecord(order));
      try {
        write(orders);
        if (order.imgB64) storage.setItem(assetKey(order.serial, 'img'), order.imgB64);
        if (order.svgData) storage.setItem(assetKey(order.serial, 'svg'), order.svgData);
      } catch (e) {
        console.warn('localStorage cheio ou indisponível:', e);
      }
    },
    asset(serial, type) {
      try {
        return storage.getItem(assetKey(serial, type));
      } catch {
        return null;
      }
    },
    updateStatus(serial: string, status: OrderStatus) {
      const orders = list();
      const order = orders.find((o) => o.serial === serial);
      if (order) {
        order.status = status;
        write(orders);
      }
    },
    remove(serial) {
      write(list().filter((o) => o.serial !== serial));
      try {
        storage.removeItem(assetKey(serial, 'img'));
        storage.removeItem(assetKey(serial, 'svg'));
      } catch {
        // storage indisponível: nada a limpar
      }
    },
  };
};
