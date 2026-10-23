# AGENTS.md — Hortelã

Instruções para **qualquer agente de IA (de qualquer modelo/ferramenta) e pessoa** que trabalhe neste repositório.
`CLAUDE.md` aponta para este arquivo. Se uma regra aqui conflitar com o seu padrão, **esta vence**.

## O projeto

Loja da **Hortelã** — arte vestível em aquarela (`usehortela.art.br`, Instagram `@usehortela`).
Site estático (Vite + TypeScript, sem framework) com Coleção (drops numerados), **Estúdio** (o cliente compõe a
própria estampa sobre a camiseta) e checkout que gera serial e certificado.

Ideais da marca (Notion): sustentabilidade, minimalismo, fauna e flora, saúde e bem-estar, identidade.

## Fluxo de trabalho obrigatório: issue → branch → PR → deploy

1. **Toda tarefa tem uma issue no GitHub** antes de qualquer código — correção (`bug`), melhoria (`melhoria`) ou
   função nova (`feature`). Sem issue, crie uma (`gh issue create`) usando os templates em `.github/ISSUE_TEMPLATE`.
2. **Uma branch por issue**, a partir da `main` (ou da branch da qual depende), com o nome
   `<tipo>/<número-da-issue>-<slug>` — ex.: `fix/12-carrinho-real`.
3. **Commits em Conventional Commits** (validado por commitlint): `feat: …`, `fix: …`, `chore: …`, `ci: …`,
   `docs: …`, `test: …`, `refactor: …`, `perf: …`. Mensagens em português.
4. **Toda mudança entra por Pull Request.** Nunca dê push direto na `main`.
5. **A descrição do PR menciona a(s) issue(s)** com palavra-chave de fechamento: `Closes #12` (ou `Refs #12`
   quando o PR não resolve tudo). Use o template `.github/pull_request_template.md`.
6. O PR só é mergeado com **CI verde** (lint, tipos, arquitetura, knip, testes unitários/integração com cobertura,
   e2e). Merge na `main` = **deploy automático** em produção (workflow `deploy.yml`, via FTP).
7. PRs que dependem de outro PR usam a branch dele como base (PRs empilhados) e dizem isso na descrição.

## Comandos

| Objetivo | Comando |
|---|---|
| Rodar local | `npm run dev` |
| Build de produção | `npm run build` (gera `dist/`) |
| Tudo que o CI checa | `npm run check` |
| Lint/format (Biome) | `npm run lint` · `npm run lint:fix` |
| Contratos de arquitetura | `npm run arch` (dependency-cruiser) |
| Código morto | `npm run knip` |
| Unidade + integração | `npm test` · `npm run test:coverage` |
| End-to-end | `npm run test:e2e` (Playwright, desktop + mobile) |
| Testes de mutação | `npm run test:mutation` (Stryker, só `src/domain`) |
| Worker de pedidos (em `worker/`) | `npx cf dev` · `npm run typecheck` · `npx cf deploy --dry-run` |

## Arquitetura (contratos verificados no CI)

```
src/
  domain/   regras puras: catálogo, preços, edição, serial, validação, layout de palavras, contratos de pedido
  infra/    integrações: storage do carrinho, API de pedidos, telemetria
  ui/       DOM e interação (um módulo por área: catálogo, estúdio, carrinho, checkout…)
  styles/   CSS
  main.ts   composição/bootstrap — ninguém importa main.ts
worker/     API de pedidos (Cloudflare Worker, CLI `cf`, config em cloudflare.config.ts)
  src/app.ts            rotas, CORS, rate limit; pedido, cotação de frete, webhook e status do pagamento
  src/order.ts          valida e recalcula o pedido reaproveitando src/domain
  src/notion.ts         cliente mínimo da API do Notion
  src/melhor-envio.ts   cotação de frete (Melhor Envio)
  src/mercado-pago.ts   Checkout Pro: preferência, consulta de pagamento, assinatura do webhook
  src/entry.ts   ponto de entrada; confere o Env local contra os tipos gerados
```

**Catálogo (banco Peças do Notion):** o Notion é a fonte das peças. Colunas: Peça (nome), ID, Coleção, História, Imagem, Preço, Edição total, Disponíveis, Ordem, Destaque e Ativa no site.
- Quem mostra: o Worker serve tudo em `GET /api/catalog`, com cache de 1 min, e a imagem em `GET /api/pecas/:id/imagem` (link fresco do Notion, cache imutável por versão).
- Peça nova no Notion aparece no site sozinha; desmarcar "Ativa no site" a esconde.
- O catálogo em `src/domain/catalog.ts` (`PRODUCTS`) só vale se o Notion não responder; o site mostra skeleton até o catálogo chegar.
- Colunas novas: `bash scripts/notion-catalogo.sh`.

**Fluxo do pedido:**
1. No checkout, o cliente digita o CEP: o endereço vem do ViaCEP e as opções de frete de `POST /api/shipping/quote`
   (Worker → Melhor Envio).
2. O site envia o pedido (sem preço, frete, total nem serial) para `POST /api/orders`. O Worker valida, recalcula
   tudo com `src/domain`, **recota o frete**, gera o serial, cria a cobrança no Mercado Pago (peças + frete,
   `external_reference` = serial), sobe preview PNG e SVG de produção e cria a página no banco **Pedidos** do Notion
   como "Aguardando pagamento" → devolve `{ serial, total, checkoutUrl }`.
3. O site guarda o pedido na aba (sessionStorage) e vai para o `checkoutUrl`. O Mercado Pago devolve para
   `#/pedido/<serial>`, que mostra o pedido e o status de `GET /api/orders/:serial/status`.
4. O Mercado Pago avisa `POST /api/mp/webhook` — URL cadastrada no **painel** do app (Webhooks → Configurar notificações, evento Pagamentos), nunca como `notification_url` na cobrança, senão o aviso chega sem a assinatura `x-signature` que o Worker confere; o Worker consulta o pagamento
   e muda o Status no Notion para **Pago** ou **Cancelado**.

Sem os tokens do Mercado Pago e do Melhor Envio, o Worker grava o pedido como "Novo", sem cobrança (`checkoutUrl: null`).
Se o Worker falhar, o site mostra o erro e mantém formulário, carrinho e composição para tentar de novo. Dinheiro,
frete e serial **nunca** são decididos no navegador.

- `domain/` **não importa** `infra/` nem `ui/` e não toca no DOM. Toda regra de negócio nova nasce aqui, com teste.
- `infra/` **não importa** `ui/`.
- `worker/src` **só importa** `src/domain/` (nada de DOM, `ui/` ou `infra/` do site).
- Sem dependências circulares.
- Eventos: o HTML declara `data-action="nome"` e o módulo registra `onAction('nome', handler)` (`src/ui/dom.ts`).
  **Não use** `onclick="..."` inline nem funções globais em `window`.

## Qualidade

- **Biome** é o único linter/formatter (sem ESLint/Prettier). Rode `npm run lint:fix` antes de commitar
  (o hook de pre-commit já roda via husky + lint-staged).
- **Knip**: não deixe exports, arquivos ou dependências sem uso.
- **Testes**: todo bug corrigido ganha um teste que falharia antes da correção.
  - `tests/unit` — domínio e infra (ambiente node).
  - `tests/integration` — monta o `index.html` real no jsdom e exercita a UI.
  - `e2e/` — Playwright contra o build de produção, em desktop e mobile.
- **Cobertura** é catraca: os limites em `vitest.config.ts` só sobem. Relatório vai para o Codecov.
- **Mutação**: score mínimo 60% (`stryker.config.json`). Vitest fica fixado na v4 até o runner do Stryker
  suportar a v5 (na v5 todos os mutantes "sobrevivem" por incompatibilidade).

## Revisão de código (skill ponytail)

Skill vendorizada em `.claude/skills/ponytail*` (de github.com/DietrichGebert/ponytail, MIT).

- **Ao escrever código:** siga a `ponytail` no nível `full` — a menor mudança que resolve a tarefa
  inteira, reaproveitando o que já existe (domínio, helpers, tokens), sem abstração ou opção que
  ninguém pediu. Nunca corte validação na borda, tratamento de erro que evita perda de dados,
  segurança, acessibilidade, testes ou o que este AGENTS.md exige (motion, `prefers-reduced-motion`).
- **Antes de pedir merge:** rode a `ponytail-review` sobre o diff do PR e cole o resultado
  (`Verdict: …`) na descrição. Achados de "Must fix" são corrigidos no próprio PR.
- **Atalho consciente:** quando aceitar um limite conhecido, deixe o comentário
  `shortcut: <o limite>, <quando melhorar>` — a `ponytail-debt` lista todos.
- **Auditoria periódica:** `ponytail-audit` no repositório inteiro; cada achado vira issue.
- Em conflito entre a skill e este arquivo, **este arquivo vence**.

## Observabilidade

- Erros, performance e traces via **Sentry** + **OpenTelemetry** (`src/infra/telemetry.ts`), ligados apenas
  quando as variáveis de ambiente existem. Nunca envie dados pessoais do cliente (nome, e-mail) para telemetria.

## Identidade visual (Brisa)

Fonte: guia "Revisão da identidade visual" da Hortelã (direção 1a Brisa). Os tokens vivem em `src/styles/main.css` (`:root`); use sempre a variável, nunca o hex.

| Token | Cor | Uso |
|---|---|---|
| `--nevoa` | `#F6F8F6` | fundo principal |
| `--apoio` | `#E9EEE9` | painéis e campos |
| `--orvalho` | `#C9D3CA` | bordas e divisores (não serve de borda de campo) |
| `--tinta` | `#16261A` | texto corrido |
| `--floresta` | `#1F4A2E` | símbolo, títulos, botões |
| `--texto-2` | `#4F6B55` | texto secundário (5,5:1) |
| `--folha` | `#6FA06A` | arcos e detalhes — **nunca texto** (2,9:1) |
| `--lilas` | `#A878E0` | ponto do símbolo e acento de drop; texto escuro por cima, nunca fundo grande |
| `--lilas-texto` | `#6B3FB5` | lilás quando é texto |
| `--borda-campo` | `#5F7F63` | borda de campo (≥3:1) |

- **Fontes: duas, e só:** Cormorant Garamond (títulos, nome da marca, subtítulo e história em itálico) e DM Sans (todo o resto, sem itálico). Nunca as duas na mesma linha. O teste `tests/unit/identidade.test.ts` barra qualquer outra fonte e as cores antigas.
- **Rótulos:** só o nome HORTELÃ e etiquetas curtas de drop em caixa alta espaçada; os demais, em frase normal, ≥13px.
- **Símbolo:** módulo único `src/ui/symbol.ts` (haste, dois arcos, ponto). O cabeçalho e o `public/favicon.svg` repetem os caminhos e o teste confere que são os mesmos. Abaixo de 48px de altura o traço engrossa (44 em vez de 26), senão some.
- Cores de **produto** (camiseta e opções do Estúdio, arte das peças) não são da marca e ficam fora dessas regras.
- Texto novo respeita o tom de voz do guia: poético, contemplativo, pessoal e discreto; nunca "aproveite" nem "última chance".

## Motion e estados de carregamento

Use a skill **design-motion-principles** (`.claude/skills/design-motion-principles`, de
github.com/kylezantos/design-motion-principles). Contexto: **e-commerce** → peso primário **Jakub Krehel**
(polimento sutil), secundário **Emil Kowalski** (contenção nas interações frequentes).

Regras:
- Todo conteúdo assíncrono tem **skeleton** enquanto carrega; imagens usam **lazy loading** e entram com fade.
- Entrada = opacity + translateY pequeno + blur; **saída mais sutil que a entrada**; nunca `ease`/`ease-in-out`
  puros — use os tokens de easing/duração em `src/styles/motion.css`.
- Ações com espera (finalizar pedido, gerar certificado) mostram **progresso**.
- Anime só `transform`, `opacity`, `filter`, `clip-path`. Nunca `width/height/top/left`.
- Interações de alta frequência (arrastar estampa, slider, atalhos de teclado) **não animam**.
- **`prefers-reduced-motion` é obrigatório** em toda animação nova.

## Segredos e dados

- Nada de senhas, chaves ou e-mails pessoais no código. Use `.env.local` (não versionado) e GitHub Secrets.
  Variáveis documentadas em `.env.example`.
- Worker: `NOTION_TOKEN`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` e `MELHOR_ENVIO_TOKEN` são secrets (declarados com
  `bindings.secret()`), enviados no deploy via `cf deploy --secrets-file` a partir dos GitHub Secrets de mesmo nome.
  Deploy pelo CI usa `CLOUDFLARE_API_TOKEN`. Para cadastrar ou trocar as chaves, a pessoa roda
  `bash scripts/ligar-pagamento.sh` no próprio terminal — chaves nunca passam pelo chat nem por arquivos versionados.
  Valores públicos (ID do banco, origens permitidas) ficam em `worker/cloudflare.config.ts`.
- O site antigo (antes da refatoração) está no commit `e4a1052` (`legacy/index.html`), se precisar consultar.

## Idioma

Código (identificadores) em inglês; textos de interface, commits, issues, PRs e comentários em **português**.
