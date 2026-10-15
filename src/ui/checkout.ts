import { type Cart, cartSubtotal, lineLabel } from '../domain/cart';
import { formatOrderDate, type Order, type StudioConfig } from '../domain/orders';
import { formatBRL } from '../domain/pricing';
import { CHECKOUT_ERROR_MESSAGES, validateCheckout } from '../domain/validation';
import { type OrderResult, OrderSendError, sendOrder } from '../infra/order-api';
import { reportError, track } from '../infra/telemetry';
import { captureComposition, exportProductionSVG } from './capture';
import { downloadCertificate } from './certificate';
import { byId, onAction } from './dom';
import { type ButtonProgress, nextFrame, startButtonProgress } from './progress';
import { go } from './router';
import { readStudioConfig, studioModel, studioTotalLabel } from './studio';
import { toast } from './toast';

type CheckoutSource = { kind: 'estudio' } | { kind: 'colecao'; lines: Cart };

let currentOrder: Order | null = null;
let source: CheckoutSource = { kind: 'estudio' };
let onCollectionOrdered: () => void = () => {};

const collectionConfig = (lines: Cart): StudioConfig => ({
  model: 'Peças da coleção',
  color: '—',
  size: [...new Set(lines.map((l) => l.size))].join(', '),
  view: '—',
  stamps: lines.map(lineLabel),
});

const fillSummary = (cfg: StudioConfig, total: string, isCollection: boolean) => {
  byId('ck-model').textContent = cfg.model;
  byId('ck-color').textContent = cfg.color;
  byId('ck-size').textContent = cfg.size;
  byId('ck-view').textContent = cfg.view;
  byId('ck-stamps-label').textContent = isCollection ? 'Itens' : 'Estampas';
  byId('ck-stamps').textContent = cfg.stamps.join(', ');
  byId('ck-total').textContent = total;
  byId('checkout-modal').classList.add('open');
};

/** Checkout de uma composição do Estúdio (peça única, com certificado). */
export const openCheckout = () => {
  source = { kind: 'estudio' };
  fillSummary(readStudioConfig(), studioTotalLabel(), false);
};

/** Checkout das peças da coleção que estão no carrinho. */
export const openCartCheckout = (lines: Cart) => {
  source = { kind: 'colecao', lines };
  fillSummary(collectionConfig(lines), formatBRL(cartSubtotal(lines)), true);
};

const closeCheckout = () => byId('checkout-modal').classList.remove('open');

const showConfirmation = (order: Order) => {
  const isCollection = order.kind === 'colecao';
  byId('conf-serial').textContent = order.serial;
  byId('conf-serial-2').textContent = order.serial;
  byId('conf-name').textContent = order.name;
  byId('conf-model').textContent = order.cfg.model;
  byId('conf-color').textContent = order.cfg.color;
  byId('conf-size').textContent = order.cfg.size;
  byId('conf-view').textContent = order.cfg.view;
  byId('conf-stamps-label').textContent = isCollection ? 'Itens' : 'Estampas';
  byId('conf-stamps').textContent = order.cfg.stamps.join(', ');
  byId('conf-obs').textContent = order.obs || '—';
  // O certificado de composição autoral é das peças únicas do Estúdio.
  byId('conf-cert-btn').hidden = isCollection;
  const preview = byId<HTMLImageElement>('conf-preview');
  const placeholder = byId('conf-preview-placeholder');
  if (order.imgB64) {
    // Skeleton até a imagem decodificar; depois fade-in (img[data-lazy]).
    placeholder.style.display = 'none';
    preview.classList.remove('is-loaded');
    preview.parentElement?.classList.add('is-loading');
    preview.src = order.imgB64;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
    placeholder.style.display = '';
    placeholder.textContent = isCollection ? order.cfg.stamps.join(' · ') : 'Sua composição';
  }
  go('confirmacao');
};

/** Monta o que vai para o Worker. Preço, total e serial são decididos lá, nunca aqui. */
const buildPayload = async (contact: { name: string; email: string; obs: string }, progress: ButtonProgress) => {
  if (source.kind === 'colecao') return { kind: 'colecao', ...contact, items: source.lines };
  const imgB64 = await captureComposition();
  progress.step(0.4, 'Preparando arquivo de produção…');
  await nextFrame();
  const cfg = readStudioConfig();
  return {
    kind: 'estudio',
    ...contact,
    studio: { model: studioModel(), color: cfg.color, size: cfg.size, view: cfg.view, stamps: cfg.stamps },
    previewPng: imgB64,
    // O Worker troca __SERIAL__ pelo serial que ele gerar.
    productionSvg: exportProductionSVG('__SERIAL__'),
  };
};

const submitOrder = async () => {
  const contact = {
    name: byId<HTMLInputElement>('ck-name').value.trim(),
    email: byId<HTMLInputElement>('ck-email').value.trim(),
    obs: byId<HTMLTextAreaElement>('ck-obs').value.trim(),
  };
  const error = validateCheckout(contact);
  if (error) {
    toast(CHECKOUT_ERROR_MESSAGES[error]);
    return;
  }
  const isCollection = source.kind === 'colecao';
  const progress = startButtonProgress(
    byId<HTMLButtonElement>('ck-submit'),
    isCollection ? 'Conferindo as peças…' : 'Gerando sua composição…',
  );
  await nextFrame();
  const payload = await buildPayload(contact, progress);
  progress.step(0.7, 'Registrando o pedido…');
  let result: OrderResult;
  try {
    result = await sendOrder(payload);
  } catch (e) {
    // Nada é perdido: formulário, carrinho e composição continuam como estavam para tentar de novo.
    progress.done();
    toast(e instanceof OrderSendError ? e.message : 'Não foi possível registrar o pedido. Tente de novo.');
    if (!(e instanceof OrderSendError)) reportError(e);
    return;
  }
  const studio = source.kind === 'estudio' ? (payload as { previewPng: string | null; productionSvg: string }) : null;
  const order: Order = {
    kind: source.kind,
    items: source.kind === 'colecao' ? [...source.lines] : undefined,
    serial: result.serial,
    ...contact,
    cfg: source.kind === 'colecao' ? collectionConfig(source.lines) : readStudioConfig(),
    total: formatBRL(result.total),
    date: formatOrderDate(new Date()),
    imgB64: studio?.previewPng ?? null,
    svgData: studio?.productionSvg.replace('__SERIAL__', result.serial) ?? null,
  };
  progress.step(1, 'Pronto');
  await nextFrame();
  currentOrder = order;

  closeCheckout();
  progress.done();
  // Formulário limpo para o próximo pedido.
  for (const id of ['ck-name', 'ck-email', 'ck-obs']) byId<HTMLInputElement>(id).value = '';
  if (isCollection) onCollectionOrdered();
  showConfirmation(order);
};

export const initCheckout = (afterCollectionOrder: () => void = () => {}) => {
  onCollectionOrdered = afterCollectionOrder;
  onAction('close-checkout', closeCheckout);
  onAction('submit-order', () => {
    track('pedido.finalizar', { origem: source.kind }, () => submitOrder()).catch(reportError);
  });
  onAction('download-certificate', (el) => {
    if (!currentOrder) {
      toast('Nenhum pedido ativo');
      return;
    }
    const progress = startButtonProgress(el as HTMLButtonElement, 'Gerando certificado…');
    void nextFrame()
      .then(() => downloadCertificate(currentOrder as Order))
      .then(() => {
        progress.step(1, 'Pronto');
        toast('Certificado baixado ✓');
      })
      .catch(reportError)
      .finally(() => setTimeout(progress.done, 400));
  });
};
