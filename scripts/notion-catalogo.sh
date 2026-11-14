#!/bin/bash
# Cria as colunas do catálogo no Notion e copia as histórias das peças atuais (#60).
# O token é pedido aqui (não aparece na tela, não fica em arquivo nem na linha de comando).
# Uso, na raiz do repositório: bash scripts/notion-catalogo.sh
set -euo pipefail
cd "$(dirname "$0")/.."
read -r -s -p "Token do Notion (ntn_…): " NOTION_TOKEN
echo
[ -n "$NOTION_TOKEN" ] || { echo "Vazio — cancelado."; exit 1; }
NOTION_TOKEN="$NOTION_TOKEN" node scripts/notion-catalogo.mjs
