import { formatOrderDate, type Order, type OrderRepository } from '../domain/orders';
import { generateSerial } from '../domain/serial';
import { CHECKOUT_ERROR_MESSAGES, validateCheckout } from '../domain/validation';
import { sendOrderEmail } from '../infra/email';
import { reportError, track } from '../infra/telemetry';
import { captureComposition, exportProductionSVG } from './capture';
import { addToCart } from './cart-badge';
import { downloadCertificate } from './certificate';
import { byId, onAction } from './dom';
import { go } from './router';
import { readStudioConfig, studioTotalLabel } from './studio';
import { toast } from './toast';

let currentOrder: Order | null = null;

export const openCheckout = () => {
  const cfg = readStudioConfig();
  byId('ck-model').textContent = cfg.model;
  byId('ck-color').textContent = cfg.color;
  byId('ck-size').textContent = cfg.size;
  byId('ck-view').textContent = cfg.view;
  byId('ck-stamps').textContent = cfg.stamps.join(', ');
  byId('ck-total').textContent = studioTotalLabel();
  byId('checkout-modal').classList.add('open');
};

const closeCheckout = () => byId('checkout-modal').classList.remove('open');

const showConfirmation = (order: Order) => {
  byId('conf-serial').textContent = order.serial;
  byId('conf-serial-2').textContent = order.serial;
  byId('conf-name').textContent = order.name;
  byId('conf-model').textContent = order.cfg.model;
  byId('conf-color').textContent = order.cfg.color;
  byId('conf-size').textContent = order.cfg.size;
  byId('conf-view').textContent = order.cfg.view;
  byId('conf-stamps').textContent = order.cfg.stamps.join(', ');
  byId('conf-obs').textContent = order.obs || '—';
  if (order.imgB64) {
    const preview = byId<HTMLImageElement>('conf-preview');
    preview.src = order.imgB64;
    preview.style.display = 'block';
    byId('conf-preview-placeholder').style.display = 'none';
  }
  go('confirmacao');
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
  const btn = byId<HTMLButtonElement>('ck-submit');
  btn.textContent = 'Gerando...';
  btn.disabled = true;

  const serial = generateSerial();
  const order: Order = {
    serial,
    ...input,
    cfg: readStudioConfig(),
    imgB64: await captureComposition(),
    svgData: exportProductionSVG(serial),
    total: studioTotalLabel(),
    date: formatOrderDate(new Date()),
  };
  currentOrder = order;
  repo.save(order);

  closeCheckout();
  btn.textContent = 'Finalizar pedido';
  btn.disabled = false;
  void sendOrderEmail(order).then((sent) => sent && toast('Pedido enviado por e-mail ✓'));
  showConfirmation(order);
  addToCart();
};

export const initCheckout = (repo: OrderRepository) => {
  onAction('close-checkout', closeCheckout);
  onAction('submit-order', () => {
    track('pedido.finalizar', { origem: 'estudio' }, () => submitOrder(repo)).catch(reportError);
  });
  onAction('download-certificate', () => {
    if (!currentOrder) {
      toast('Nenhum pedido ativo');
      return;
    }
    void downloadCertificate(currentOrder).then(() => toast('Certificado baixado ✓'));
  });
};
