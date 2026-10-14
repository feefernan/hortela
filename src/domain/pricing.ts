export type ModelId = 'oversized' | 'long';

export interface GarmentModel {
  id: ModelId;
  label: string;
  price: number;
}

export const MODELS: Record<ModelId, GarmentModel> = {
  oversized: { id: 'oversized', label: 'Camiseta Oversized', price: 120 },
  long: { id: 'long', label: 'Camisetão Long', price: 140 },
};

/** Valor da estampagem personalizada do Estúdio. */
export const PRINT_FEE = 80;

export const studioTotal = (model: ModelId): number => MODELS[model].price + PRINT_FEE;

export const formatBRL = (value: number): string => `R$ ${value}`;
