import type { Order } from '../domain/orders';
import { config, isEmailConfigured } from './config';

interface EmailJs {
  init(opts: { publicKey: string }): void;
  send(serviceId: string, templateId: string, params: Record<string, string>): Promise<unknown>;
}

declare global {
  interface Window {
    emailjs?: EmailJs;
  }
}

const EMAILJS_SDK = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js';

const currentSdk = (): EmailJs | undefined => window.emailjs;

const loadSdk = async (): Promise<EmailJs> => {
  const loaded = currentSdk();
  if (loaded) return loaded;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = EMAILJS_SDK;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar o EmailJS'));
    document.head.appendChild(s);
  });
  const sdk = currentSdk();
  if (!sdk) throw new Error('EmailJS indisponível');
  sdk.init({ publicKey: config.emailjs.publicKey });
  return sdk;
};

/** Envia o pedido por e-mail. Retorna false quando o EmailJS não está configurado ou falha. */
export const sendOrderEmail = async (order: Order): Promise<boolean> => {
  if (!isEmailConfigured()) {
    console.warn('EmailJS não configurado — modo protótipo ativo');
    return false;
  }
  try {
    const sdk = await loadSdk();
    await sdk.send(config.emailjs.serviceId, config.emailjs.templateId, {
      to_email: config.emailjs.toEmail,
      serial: order.serial,
      client_name: order.name,
      client_email: order.email,
      model: order.cfg.model,
      color: order.cfg.color,
      size: order.cfg.size,
      view: order.cfg.view,
      stamps: order.cfg.stamps.join(', '),
      obs: order.obs || '—',
      total: order.total,
    });
    return true;
  } catch (err) {
    console.warn('Falha ao enviar o pedido por e-mail', err);
    return false;
  }
};
