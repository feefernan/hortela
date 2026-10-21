/** Erros de formulário ao lado do campo: texto em `#<id>-err` e `aria-invalid` no próprio campo. */

export const setFieldError = (fieldId: string, message: string | null) => {
  const field = document.getElementById(fieldId);
  if (message) field?.setAttribute('aria-invalid', 'true');
  else field?.removeAttribute('aria-invalid');
  const note = document.getElementById(`${fieldId}-err`);
  if (note) {
    note.textContent = message ?? '';
    note.hidden = !message;
  }
};

/** Mostra os erros e põe o foco no primeiro; devolve se havia algum. */
export const showFieldErrors = (errors: { fieldId: string; message: string }[]): boolean => {
  for (const e of errors) setFieldError(e.fieldId, e.message);
  document.getElementById(errors[0]?.fieldId ?? '')?.focus();
  return errors.length > 0;
};

/** O erro de um campo some assim que a pessoa volta a digitar nele. */
export const clearErrorsOnInput = (root: HTMLElement) =>
  root.addEventListener('input', (event) => {
    const id = (event.target as HTMLElement).id;
    if (id) setFieldError(id, null);
  });
