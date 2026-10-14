import { type Cart, cartSubtotal, lineLabel } from '../domain/cart';
import { formatOrderDate, type Order, type OrderRepository, type StudioConfig } from '../domain/orders';
import { formatBRL } from '../domain/pricing';
import { generateSerial } from '../domain/serial';
import { CHECKOUT_ERROR_MESSAGES, validateCheckout } from '../domain/validation';
import { sendOrderEmail } from '../infra/email';
import { reportError, track } from '../infra/telemetry';
import { captureComposition, exportProductionSVG } from './capture';
import { downloadCertificate } from './certificate';
import { byId, onAction } from './dom';
import { type ButtonProgress, nextFrame, startButtonProgress } from './progress';
import { go } from './router';
import { readStudioConfig, studioTotalLabel } from './studio';
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

const buildStudioOrder = async (
  base: Pick<Order, 'serial' | 'name' | 'email' | 'obs' | 'date'>,
  progress: ButtonProgress,
) => {
  const imgB64 = await captureComposition();
  progress.step(0.45, 'Preparando arquivo de produção…');
  await nextFrame();
  const svgData = exportProductionSVG(base.serial);
  return { ...base, kind: 'estudio' as const, cfg: readStudioConfig(), imgB64, svgData, total: studioTotalLabel() };
};

const submitOrder = async (repo: OrderRepository) => {
  const input = {
    name: byId<HTMLInputElement>('ck-name').value.trim(),
    email: byId<HTMLInputElement>('ck-email').value.trim(),
    obs: byId<HTMLTextAreaElement>('ck-obs').value.trim(),
  };
  const error = validateCheckout(input);
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
  const base = { serial: generateSerial(), ...input, date: formatOrderDate(new Date()) };
  const order: Order =
    source.kind === 'colecao'
      ? {
          ...base,
          kind: 'colecao',
          items: [...source.lines],
          cfg: collectionConfig(source.lines),
          total: formatBRL(cartSubtotal(source.lines)),
        }
      : await buildStudioOrder(base, progress);
  progress.step(0.8, 'Registrando o pedido…');
  await nextFrame();
  currentOrder = order;
  repo.save(order);
  progress.step(1, 'Pronto');
  await nextFrame();

  closeCheckout();
  progress.done();
  // Formulário limpo para o próximo pedido.
  for (const id of ['ck-name', 'ck-email', 'ck-obs']) byId<HTMLInputElement>(id).value = '';
  if (isCollection) onCollectionOrdered();
  void sendOrderEmail(order).then((sent) => sent && toast('Pedido enviado por e-mail ✓'));
  showConfirmation(order);
};

export const initCheckout = (repo: OrderRepository, afterCollectionOrder: () => void = () => {}) => {
  onCollectionOrdered = afterCollectionOrder;
  onAction('close-checkout', closeCheckout);
  onAction('submit-order', () => {
    track('pedido.finalizar', { origem: source.kind }, () => submitOrder(repo)).catch(reportError);
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
