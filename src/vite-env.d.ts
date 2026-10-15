/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORDERS_API?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_OTEL_EXPORTER_URL?: string;
  readonly VITE_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
