import type { CartLine } from './cart';

export interface StudioConfig {
  model: string;
  color: string;
  size: string;
  view: string;
  stamps: string[];
}

type OrderKind = 'estudio' | 'colecao';

export interface Order {
  kind: OrderKind;
  /** Peças da coleção, quando kind = 'colecao'. */
  items?: CartLine[];
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

export const formatOrderDate = (date: Date): string =>
  date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
