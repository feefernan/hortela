export type CheckoutError = 'missing-fields' | 'invalid-email';

export interface CheckoutInput {
  name: string;
  email: string;
  obs: string;
}

export const CHECKOUT_ERROR_MESSAGES: Record<CheckoutError, string> = {
  'missing-fields': 'Preencha nome e e-mail',
  'invalid-email': 'E-mail inválido',
};

export const validateCheckout = (input: CheckoutInput): CheckoutError | null => {
  if (!input.name.trim() || !input.email.trim()) return 'missing-fields';
  if (!/\S+@\S+\.\S+/.test(input.email.trim())) return 'invalid-email';
  return null;
};

/** Só letras de A a Z e espaço (sem acento, sem números). */
export const isValidWord = (raw: string): boolean => /^[A-Z ]+$/.test(raw.trim().toUpperCase());
