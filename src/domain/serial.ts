/** Gera o serial do pedido no formato HRT-AAAAMMDD-XXXX. */
export const generateSerial = (date: Date = new Date(), random: () => number = Math.random): string => {
  const ds =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  const rnd = Math.floor(1000 + random() * 9000);
  return `HRT-${ds}-${rnd}`;
};
