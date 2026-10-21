export type CheckoutError = 'missing-fields' | 'invalid-email';

export interface CheckoutInput {
  name: string;
  email: string;
  obs: string;
}

export const validateCheckout = (input: CheckoutInput): CheckoutError | null => {
  if (!input.name.trim() || !input.email.trim()) return 'missing-fields';
  if (!/\S+@\S+\.\S+/.test(input.email.trim())) return 'invalid-email';
  return null;
};

export interface FieldError<F extends string = string> {
  field: F;
  message: string;
}

/** Problemas de nome e e-mail, cada um com o campo onde a mensagem aparece. */
export const contactErrors = (input: Pick<CheckoutInput, 'name' | 'email'>): FieldError<'name' | 'email'>[] => {
  const errors: FieldError<'name' | 'email'>[] = [];
  if (!input.name.trim()) errors.push({ field: 'name', message: 'Informe seu nome.' });
  const email = input.email.trim();
  if (!email) errors.push({ field: 'email', message: 'Informe seu e-mail.' });
  else if (!/\S+@\S+\.\S+/.test(email))
    errors.push({ field: 'email', message: 'Confira o e-mail: algo como nome@site.com.' });
  return errors;
};

/** Só letras de A a Z e espaço (sem acento, sem números). */
export const isValidWord = (raw: string): boolean => /^[A-Z ]+$/.test(raw.trim().toUpperCase());
