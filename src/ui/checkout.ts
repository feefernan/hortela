import { type Cart, cartSubtotal, lineLabel } from '../domain/cart';
import { formatOrderDate, type Order, type StudioConfig } from '../domain/orders';
import { formatBRL, studioTotal } from '../domain/pricing';
import { contactErrors } from '../domain/validation';
import { fetchOrderStatus, type OrderResult, OrderSendError, sendOrder } from '../infra/order-api';
import { reportError, track } from '../infra/telemetry';
import { captureArt, captureComposition, exportProductionSVG } from './capture';
import { downloadCertificate } from './certificate';
import { initDelivery, readDelivery, resetDelivery } from './delivery';
import { byId, onAction, setLayerOpen } from './dom';
import { clearErrorsOnInput, setFieldError, showFieldErrors } from './field-errors';
import { type ButtonProgress, nextFrame, startButtonProgress } from './progress';
import { navigate, onPageChange, setReturnHook } from './router';
import { readStudioConfig, studioModel } from './studio';
import { toast } from './toast';

type CheckoutSource = { kind: 'estudio' } | { kind: 'colecao'; lines: Cart };

let currentOrder: Order | null = null;
/** Arte sem camiseta da composição em envio, para o certificado. */
let artB64: string | null = null;
let source: CheckoutSource = { kind: 'estudio' };
let onCollectionOrdered: () => void = () => {};

/** Pedido guardado na aba enquanto o cliente paga no Mercado Pago, para a confirmação na volta. */
const PENDING_KEY = 'hortela_pedido_pendente';

const savePending = (order: Order) => {
  // Com as imagens primeiro; se a aba não tiver espaço, sem elas (a confirmação sai sem o preview).
  for (const o of [order, { ...order, imgB64: null, artB64: null, svgData: null }]) {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(o));
      return;
    } catch {}
  }
};

const loadPending = (serial: string): Order | null => {
  try {
    const order = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null') as Order | null;
    return order?.serial === serial ? order : null;
  } catch {
    return null;
  }
};

const collectionConfig = (lines: Cart): StudioConfig => ({
  model: 'Peças da coleção',
  color: '—',
  size: [...new Set(lines.map((l) => l.size))].join(', '),
  view: '—',
  stamps: lines.map(lineLabel),
});

/** Linhas que só fazem sentido para uma composição do Estúdio (modelo, cor, posição). */
const showStudioRows = (prefix: 'ck' | 'conf', isCollection: boolean) => {
  for (const key of ['model', 'color', 'view']) {
    const row = byId(`${prefix}-${key}`).parentElement;
    if (row) row.hidden = isCollection;
  }
};

const fillSummary = (cfg: StudioConfig, goodsTotal: number, isCollection: boolean) => {
  byId('ck-title').textContent = isCollection ? 'Seu pedido' : 'Sua composição';
  byId('ck-cert-note').hidden = isCollection;
  showStudioRows('ck', isCollection);
  byId('ck-model').textContent = cfg.model;
  byId('ck-color').textContent = cfg.color;
  byId('ck-size').textContent = cfg.size;
  byId('ck-view').textContent = cfg.view;
  byId('ck-stamps-label').textContent = isCollection ? 'Itens' : 'Estampas';
  byId('ck-stamps').textContent = cfg.stamps.join(', ');
  resetDelivery(goodsTotal);
  setLayerOpen('checkout-modal', true);
};

/** Checkout de uma composição do Estúdio (peça única, com certificado). */
export const openCheckout = () => {
  source = { kind: 'estudio' };
  fillSummary(readStudioConfig(), studioTotal(studioModel()), false);
};

/** Checkout das peças da coleção que estão no carrinho. */
export const openCartCheckout = (lines: Cart) => {
  source = { kind: 'colecao', lines };
  fillSummary(collectionConfig(lines), cartSubtotal(lines), true);
};

const closeCheckout = () => setLayerOpen('checkout-modal', false);

/** O que o frete precisa saber: as peças do carrinho ou o modelo da composição. */
const goodsPayload = () =>
  source.kind === 'colecao'
    ? { kind: 'colecao', items: source.lines }
    : { kind: 'estudio', studio: { model: studioModel() } };

const showConfirmation = (order: Order, status = 'Pedido confirmado') => {
  const isCollection = order.kind === 'colecao';
  byId('conf-status').textContent = status;
  byId('conf-serial').textContent = order.serial;
  byId('conf-serial-2').textContent = order.serial;
  byId('conf-name').textContent = order.name;
  byId('conf-email').textContent = order.email || 'o seu e-mail';
  showStudioRows('conf', isCollection);
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
  navigate({ page: 'confirmacao', serial: order.serial });
};

const RETURN_STATUS: Record<string, string> = {
  Pago: 'Pagamento aprovado',
  'Aguardando pagamento': 'Pagamento em análise',
  Cancelado: 'Pagamento não aprovado',
};

/** Volta do Mercado Pago (#/pedido/<serial>): mostra o pedido guardado e o status real do pagamento. */
const showReturn = (serial: string) => {
  const pending = loadPending(serial);
  currentOrder = pending;
  showConfirmation(
    pending ?? {
      kind: 'colecao',
      serial,
      name: '—',
      email: '',
      obs: '',
      cfg: { model: '—', color: '—', size: '—', view: '—', stamps: [] },
      total: '',
      date: '',
    },
    'Consultando o pagamento…',
  );
  // O Mercado Pago devolve o cliente antes de avisar o Worker: se ele já disse "approved" na volta, mostramos
  // aprovado (só a tela; o status real do pedido vem do aviso assinado).
  const approvedOnReturn = /[?&](collection_status|status)=approved\b/.test(window.location.hash);
  fetchOrderStatus(serial)
    .then((status) => {
      const shown = status === 'Aguardando pagamento' && approvedOnReturn ? 'Pago' : status;
      byId('conf-status').textContent = RETURN_STATUS[shown] ?? 'Pedido recebido';
      // Pedido pago ou em análise: o carrinho já virou pedido. Recusado: o carrinho fica para tentar de novo.
      if (status !== 'Cancelado' && pending?.kind === 'colecao') onCollectionOrdered();
    })
    .catch(() => {
      byId('conf-status').textContent = 'Pedido recebido';
    });
};

/** Monta o que vai para o Worker. Preço, frete, total e serial são decididos lá, nunca aqui. */
const buildPayload = async (
  contact: { name: string; email: string; obs: string },
  delivery: Exclude<ReturnType<typeof readDelivery>, unknown[]>,
  progress: ButtonProgress,
) => {
  const shipping = { address: delivery.address, shipping: { serviceId: delivery.serviceId } };
  if (source.kind === 'colecao') return { kind: 'colecao', ...contact, ...shipping, items: source.lines };
  const imgB64 = await captureComposition();
  artB64 = await captureArt();
  progress.step(0.4, 'Preparando arquivo de produção…');
  await nextFrame();
  const cfg = readStudioConfig();
  return {
    kind: 'estudio',
    ...contact,
    ...shipping,
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
  // Todos os problemas de uma vez, cada um ao lado do seu campo; o foco vai para o primeiro.
  const delivery = readDelivery();
  const problems = [
    ...contactErrors(contact).map((e) => ({
      fieldId: e.field === 'name' ? 'ck-name' : 'ck-email',
      message: e.message,
    })),
    ...(Array.isArray(delivery) ? delivery : []),
  ];
  if (showFieldErrors(problems) || Array.isArray(delivery)) return;
  const isCollection = source.kind === 'colecao';
  const progress = startButtonProgress(
    byId<HTMLButtonElement>('ck-submit'),
    isCollection ? 'Conferindo as peças…' : 'Gerando sua composição…',
  );
  await nextFrame();
  const payload = await buildPayload(contact, delivery, progress);
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
    artB64: studio ? artB64 : null,
  };

  if (result.checkoutUrl) {
    // Paga no Mercado Pago e volta para #/pedido/<serial>. O carrinho só é limpo na volta, se o pagamento não for recusado.
    progress.step(1, 'Indo para o pagamento…');
    savePending(order);
    window.location.assign(result.checkoutUrl);
    return;
  }

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
  initDelivery(goodsPayload);
  setReturnHook(showReturn);
  onAction('close-checkout', closeCheckout);
  clearErrorsOnInput(byId('checkout-modal'));
  // E-mail errado avisa ao sair do campo, sem esperar o envio.
  byId('ck-email').addEventListener('blur', () => {
    const email = byId<HTMLInputElement>('ck-email').value;
    if (email.trim()) setFieldError('ck-email', contactErrors({ name: 'x', email })[0]?.message ?? null);
  });
  // O checkout é uma camada sobre a página: trocar de página o fecha.
  onPageChange(closeCheckout);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && byId('checkout-modal').classList.contains('open')) closeCheckout();
  });
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
