#!/bin/bash
# Cria o banco Estampas no Notion e semeia as estampas atuais do Estúdio (#65).
# O token é pedido aqui (não aparece na tela, não fica em arquivo nem na linha de comando).
# Uso, na raiz do repositório: bash scripts/notion-estampas.sh
set -euo pipefail
cd "$(dirname "$0")/.."
read -r -s -p "Token do Notion (ntn_…): " NOTION_TOKEN
echo
[ -n "$NOTION_TOKEN" ] || { echo "Vazio — cancelado."; exit 1; }
NOTION_TOKEN="$NOTION_TOKEN" node scripts/notion-estampas.mjs
