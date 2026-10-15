import { bindings, defineConfig } from 'cf/config';
import * as entrypoint from './src/entry.ts' with { type: 'cf-worker' };

export default defineConfig({
  accountId: 'ed6e9771671dec30d3042eee81ea5f06',
  worker: {
    name: 'hortela-pedidos',
    compatibilityDate: '2026-10-12',
    entrypoint,
    observability: { enabled: true, logs: { enabled: true }, traces: { enabled: true } },
    env: {
      // Origens do site que podem chamar a API (separadas por vírgula).
      ALLOWED_ORIGIN: bindings.text(
        'https://usehortela.art.br,https://www.usehortela.art.br,http://usehortela.comercial.ws,http://localhost:5173,http://localhost:4173',
      ),
      NOTION_ORDERS_DB: bindings.text('3facabbfb8c68005936ac8e551f57037'),
      NOTION_TOKEN: bindings.secret(),
      // 5 pedidos por minuto por IP: suficiente para quem compra, freia spam.
      ORDERS_LIMITER: bindings.rateLimit({ namespace: '1001', simple: { limit: 5, period: 60 } }),
    },
  },
});
