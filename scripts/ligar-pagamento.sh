#!/bin/bash
# Liga frete (Melhor Envio) e pagamento (Mercado Pago) na API de pedidos.
# Pede as chaves aqui no terminal (não aparecem na tela nem ficam em arquivo), e então:
#   1. cria as colunas Frete, Envio e Endereço no banco Pedidos do Notion;
#   2. guarda as chaves como secrets do GitHub (o deploy automático usa);
#   3. publica o Worker com as chaves.
# Uso, na raiz do repositório: bash scripts/ligar-pagamento.sh
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
cd "$(dirname "$0")/.."
REPO=feefernan/hortela
DB=3facabbfb8c68005936ac8e551f57037

ask() {
  local value
  read -r -s -p "$1: " value
  echo >&2
  [ -n "$value" ] || { echo "Vazio — cancelado." >&2; exit 1; }
  printf '%s' "$value"
}

NOTION_TOKEN=$(ask "Token do Notion (ntn_…)")
MP_ACCESS_TOKEN=$(ask "Access Token do Mercado Pago (TEST-… ou APP_USR-…)")
MP_WEBHOOK_SECRET=$(ask "Assinatura secreta do webhook do Mercado Pago")
MELHOR_ENVIO_TOKEN=$(ask "Token do Melhor Envio")

echo "1/3 Colunas de entrega no Notion…"
curl -sf -X PATCH "https://api.notion.com/v1/databases/$DB" \
  -H "Authorization: Bearer $NOTION_TOKEN" -H "Notion-Version: 2022-06-28" -H "Content-Type: application/json" \
  -d '{"properties":{"Frete":{"number":{"format":"real"}},"Envio":{"rich_text":{}},"Endereço":{"rich_text":{}}}}' \
  >/dev/null && echo "    ok"

echo "2/3 Secrets do GitHub…"
for name in NOTION_TOKEN MP_ACCESS_TOKEN MP_WEBHOOK_SECRET MELHOR_ENVIO_TOKEN; do
  printf '%s' "${!name}" | gh secret set "$name" --repo "$REPO" && echo "    $name ok"
done

echo "3/3 Publicando o Worker…"
umask 077
secrets=$(mktemp)
trap 'rm -f "$secrets"' EXIT
for name in NOTION_TOKEN MP_ACCESS_TOKEN MP_WEBHOOK_SECRET MELHOR_ENVIO_TOKEN; do
  printf '%s=%s\n' "$name" "${!name}" >> "$secrets"
done
(cd worker && npx cf deploy --secrets-file "$secrets")
echo "PRONTO — frete e pagamento ligados."
