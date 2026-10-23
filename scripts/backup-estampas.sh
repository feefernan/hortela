#!/bin/bash
# Baixa tudo do R2 (imagens das estampas e arquivos dos pedidos) para uma pasta local, como cópia fora da Cloudflare (#65).
# Uso, na raiz do repositório: bash scripts/backup-estampas.sh [pasta]   (padrão: ~/hortela-backup/AAAA-MM-DD)
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
BUCKET=hortela-estampas
DEST="${1:-$HOME/hortela-backup/$(date +%F)}"
mkdir -p "$DEST"
count=0
cursor=""
while :; do
  page=$(cf r2 objects list --bucket-name "$BUCKET" --per-page 1000 ${cursor:+--cursor "$cursor"} --json 2>/dev/null || cf r2 objects list --bucket-name "$BUCKET" --per-page 1000 ${cursor:+--cursor "$cursor"})
  keys=$(printf '%s' "$page" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);for(const o of (j.objects??j.result??j))console.log(o.key)})')
  [ -n "$keys" ] || break
  while IFS= read -r key; do
    mkdir -p "$DEST/$(dirname "$key")"
    cf r2 objects get "$key" --bucket-name "$BUCKET" > "$DEST/$key"
    count=$((count + 1))
  done <<< "$keys"
  cursor=$(printf '%s' "$page" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);process.stdout.write(j.cursor??j.result_info?.cursor??"")})')
  [ -n "$cursor" ] || break
done
echo "$count arquivos em $DEST"
