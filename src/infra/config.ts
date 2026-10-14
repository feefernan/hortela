/** Configuração lida das variáveis de ambiente do build (ver .env.example). */
export const config = {
  emailjs: {
    publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? '',
    serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID ?? '',
    templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? '',
    toEmail: import.meta.env.VITE_ORDERS_EMAIL ?? '',
  },
  /**
   * SHA-256 (hex) da senha do painel. Vazio desativa o painel e esconde o link.
   * Mitigação: a verificação ainda é no navegador — autenticação real depende do backend (#22, #17).
   */
  panelPasswordHash: (import.meta.env.VITE_PANEL_PASSWORD_SHA256 ?? '').trim().toLowerCase(),
};

export const isEmailConfigured = (): boolean =>
  Boolean(config.emailjs.publicKey && config.emailjs.serviceId && config.emailjs.templateId && config.emailjs.toEmail);
