/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EMAILJS_PUBLIC_KEY?: string;
  readonly VITE_EMAILJS_SERVICE_ID?: string;
  readonly VITE_EMAILJS_TEMPLATE_ID?: string;
  readonly VITE_ORDERS_EMAIL?: string;
  readonly VITE_PANEL_PASSWORD_SHA256?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_OTEL_EXPORTER_URL?: string;
  readonly VITE_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
