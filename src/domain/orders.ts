export type OrderStatus = 'novo' | 'em produção' | 'enviado';

export const ORDER_STATUSES: readonly OrderStatus[] = ['novo', 'em produção', 'enviado'];

export interface StudioConfig {
  model: string;
  color: string;
  size: string;
  view: string;
  stamps: string[];
}

export interface Order {
  serial: string;
  name: string;
  email: string;
  obs: string;
  cfg: StudioConfig;
  total: string;
  date: string;
  imgB64?: string | null;
  svgData?: string | null;
}

export interface OrderRecord extends Omit<Order, 'imgB64' | 'svgData'> {
  status: OrderStatus;
  hasImg: boolean;
  hasSVG: boolean;
}

export type OrderAsset = 'img' | 'svg';

/** Contrato de persistência de pedidos — a UI depende só desta interface. */
export interface OrderRepository {
  save(order: Order): void;
  list(): OrderRecord[];
  asset(serial: string, type: OrderAsset): string | null;
  updateStatus(serial: string, status: OrderStatus): void;
  remove(serial: string): void;
}

export const toRecord = (order: Order): OrderRecord => ({
  serial: order.serial,
  name: order.name,
  email: order.email,
  obs: order.obs,
  cfg: order.cfg,
  total: order.total,
  date: order.date,
  status: 'novo',
  hasImg: !!order.imgB64,
  hasSVG: !!order.svgData,
});

export const formatOrderDate = (date: Date): string =>
  date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
