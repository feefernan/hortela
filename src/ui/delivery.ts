/** Entrega no checkout: CEP → endereço (ViaCEP) e opções de frete (Worker → Melhor Envio), com o total ao vivo. */
import { formatBRL } from '../domain/pricing';
import { type Address, addressErrors, formatCep, normalizeCep, parseAddress, shippingLabel } from '../domain/shipping';
import { lookupCep, OrderSendError, quoteShipping, type ShippingOption } from '../infra/order-api';
import { reportError } from '../infra/telemetry';
import { byId, onAction, onEnter } from './dom';
import { setFieldError } from './field-errors';
import { toast } from './toast';

const ADDRESS_IDS = {
  street: 'ck-street',
  number: 'ck-number',
  complement: 'ck-complement',
  district: 'ck-district',
  city: 'ck-city',
  uf: 'ck-uf',
} as const;

let goods = 0;
let options: ShippingOption[] = [];
let quotePayload: () => object = () => ({});

const input = (id: string) => byId<HTMLInputElement>(id);
const list = () => byId('ck-ship-options');

const chosen = () => {
  const id = Number(list().querySelector<HTMLInputElement>('input[name="ck-ship"]:checked')?.value);
  return options.find((o) => o.id === id) ?? null;
};

const updateTotals = () => {
  const ship = chosen();
  byId('ck-shipping').textContent = ship ? formatBRL(ship.price) : 'informe o CEP';
  byId('ck-total').textContent = formatBRL(goods + (ship?.price ?? 0));
  byId('ck-submit-total').textContent = formatBRL(goods + (ship?.price ?? 0));
};

const renderOptions = () => {
  list().replaceChildren(
    ...options.map((o, i) => {
      const label = document.createElement('label');
      label.className = 'ck-ship';
      label.style.animationDelay = `${i * 40}ms`;
      const radio = document.createElement('input');
      Object.assign(radio, { type: 'radio', name: 'ck-ship', value: String(o.id), checked: i === 0 });
      const text = document.createElement('span');
      text.textContent = shippingLabel(o);
      const days = document.createElement('small');
      days.textContent = `${o.days} ${o.days === 1 ? 'dia útil' : 'dias úteis'}`;
      text.append(days);
      const price = document.createElement('strong');
      price.textContent = formatBRL(o.price);
      label.append(radio, text, price);
      return label;
    }),
  );
  updateTotals();
};

/** Zera a entrega quando o checkout abre para outro carrinho/composição (o frete depende das peças). */
export const resetDelivery = (goodsTotal: number) => {
  goods = goodsTotal;
  options = [];
  list().replaceChildren();
  updateTotals();
};

const fillAddress = (found: Awaited<ReturnType<typeof lookupCep>>) => {
  byId('ck-address').hidden = false;
  if (!found) return;
  for (const key of ['street', 'district', 'city', 'uf'] as const) {
    if (found[key]) input(ADDRESS_IDS[key]).value = found[key];
  }
  input(found.street ? ADDRESS_IDS.number : ADDRESS_IDS.street).focus();
};

const quote = async (button: HTMLButtonElement | null) => {
  const cep = normalizeCep(input('ck-cep').value);
  if (!cep) {
    setFieldError('ck-cep', 'Informe um CEP com 8 números.');
    input('ck-cep').focus();
    return;
  }
  setFieldError('ck-cep', null);
  setFieldError('ck-ship', null);
  input('ck-cep').value = formatCep(cep);
  if (button) button.disabled = true;
  list().classList.add('is-loading');
  try {
    const [found, quoted] = await Promise.all([lookupCep(cep), quoteShipping({ ...quotePayload(), cep })]);
    fillAddress(found);
    options = quoted;
    renderOptions();
  } catch (e) {
    options = [];
    list().replaceChildren();
    updateTotals();
    // Recusa do servidor (CEP inválido, sem opção para o CEP) é sobre o campo; falha de rede vai no toast.
    if (e instanceof OrderSendError) setFieldError('ck-cep', e.message);
    else {
      toast('Não foi possível calcular o frete. Tente de novo.');
      reportError(e);
    }
  } finally {
    list().classList.remove('is-loading');
    if (button) button.disabled = false;
  }
};

type FieldProblem = { fieldId: string; message: string };

/** Endereço e frete escolhidos para o pedido, ou os campos que faltam (com a mensagem de cada um). */
export const readDelivery = (): { address: Address; serviceId: number } | FieldProblem[] => {
  const raw = {
    cep: input('ck-cep').value,
    ...Object.fromEntries(Object.entries(ADDRESS_IDS).map(([key, id]) => [key, input(id).value])),
  };
  const problems: FieldProblem[] = addressErrors(raw).map((e) => ({
    fieldId: e.field === 'cep' ? 'ck-cep' : ADDRESS_IDS[e.field],
    message: e.message,
  }));
  const ship = chosen();
  if (!ship) problems.push({ fieldId: 'ck-ship', message: 'Calcule o frete e escolha uma opção de envio.' });
  // Sem frete calculado, o endereço ainda está escondido: o erro útil é só o do CEP/frete.
  const visible = byId('ck-address').hidden
    ? problems.filter((p) => p.fieldId === 'ck-cep' || p.fieldId === 'ck-ship')
    : problems;
  const address = parseAddress(raw);
  return visible.length || !address || !ship ? visible : { address, serviceId: ship.id };
};

/** `payload` diz o que cotar: as peças do carrinho ou o modelo da composição. */
export const initDelivery = (payload: () => object) => {
  quotePayload = payload;
  onAction('quote-shipping', (el) => void quote(el as HTMLButtonElement));
  onEnter('quote-shipping', (_el, event) => {
    event.preventDefault();
    void quote(null);
  });
  list().addEventListener('change', () => {
    updateTotals();
    setFieldError('ck-ship', null);
  });
};
