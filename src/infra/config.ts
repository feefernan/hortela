/** Configuração lida das variáveis de ambiente do build (ver .env.example). */
export const config = {
  emailjs: {
    publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? '',
    serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID ?? '',
    templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? '',
    toEmail: import.meta.env.VITE_ORDERS_EMAIL ?? '',
  },
  /** Vazio desativa o painel. Ainda é verificado no cliente — ver issue de segurança do painel. */
  panelPassword: import.meta.env.VITE_PANEL_PASSWORD ?? '',
};

export const isEmailConfigured = (): boolean =>
  Boolean(config.emailjs.publicKey && config.emailjs.serviceId && config.emailjs.templateId && config.emailjs.toEmail);
