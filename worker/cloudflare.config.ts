import { bindings, defineConfig, triggers } from 'cf/config';
import * as entrypoint from './src/entry.ts' with { type: 'cf-worker' };

export default defineConfig({
  accountId: 'ed6e9771671dec30d3042eee81ea5f06',
  worker: {
    name: 'hortela-pedidos',
    compatibilityDate: '2026-10-12',
    entrypoint,
    // A API mora no domínio do site (/api/*), sem subdomínio workers.dev.
    workersDev: false,
    triggers: [triggers.fetch({ pattern: 'usehortela.art.br/api/*', zone: 'usehortela.art.br' })],
    observability: { enabled: true, logs: { enabled: true }, traces: { enabled: true } },
    env: {
      // Origens do site que podem chamar a API (separadas por vírgula).
      ALLOWED_ORIGIN: bindings.text(
        'https://usehortela.art.br,https://www.usehortela.art.br,http://usehortela.comercial.ws,http://localhost:5173,http://localhost:4173',
      ),
      NOTION_ORDERS_DB: bindings.text('3facabbfb8c68005936ac8e551f57037'),
      // Banco Peças: preço, edição e estoque de cada peça da coleção (#56).
      NOTION_PIECES_DB: bindings.text('3facabbfb8c68079aea8c6534c5de876'),
      // Banco Estampas (Estúdio): criado por scripts/notion-estampas.sh; o ID entra aqui (#65).
      NOTION_STAMPS_DB: bindings.text('418cabbfb8c681df813bd8def3580bf1'),
      // Cópia permanente das imagens das estampas e dos arquivos dos pedidos. Bucket criado com `cf r2 buckets create`.
      ESTAMPAS_BUCKET: bindings.r2({ name: 'hortela-estampas' }),
      NOTION_TOKEN: bindings.secret(),
      // 5 pedidos por minuto por IP: suficiente para quem compra, freia spam.
      ORDERS_LIMITER: bindings.rateLimit({ namespace: '1001', simple: { limit: 5, period: 60 } }),
      // Cotações de frete: o cliente pode testar alguns CEPs.
      QUOTES_LIMITER: bindings.rateLimit({ namespace: '1002', simple: { limit: 20, period: 60 } }),
      // Volta do pagamento e aviso do Mercado Pago (webhook) usam este endereço.
      SITE_URL: bindings.text('https://usehortela.art.br'),
      // Conta real do Melhor Envio: cotar é gratuito; só a compra de etiqueta é cobrada.
      MELHOR_ENVIO_API: bindings.text('https://melhorenvio.com.br'),
      // CEP de onde as peças saem (#54).
      ORIGIN_CEP: bindings.text('01403020'),
      MELHOR_ENVIO_TOKEN: bindings.secret(),
      MP_ACCESS_TOKEN: bindings.secret(),
      MP_WEBHOOK_SECRET: bindings.secret(),
    },
  },
});
