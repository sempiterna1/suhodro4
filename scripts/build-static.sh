#!/bin/bash
# Статическая сборка игры «Железный Разлом» для любого static-хостинга.
# Временно переключает next.config.ts на output:'export' и убирает api/route.ts
# (игре сервер не нужен), после сборки всё возвращает обратно через trap.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BAK="$ROOT/scripts/_static_build_backup"
rm -rf "$BAK"
mkdir -p "$BAK"

cleanup() {
  # вернуть api-роут
  if [ -d "$BAK/api_tmp" ]; then
    rm -rf src/app/api
    mv "$BAK/api_tmp" src/app/api
  fi
  # вернуть конфиг
  if [ -f "$BAK/next.config.ts" ]; then
    mv -f "$BAK/next.config.ts" next.config.ts
  fi
  echo "[cleanup] восстановлено: next.config.ts, src/app/api"
}
trap cleanup EXIT

echo "[1/5] Бэкап и подмена конфига..."
mv next.config.ts "$BAK/next.config.ts"
cat > next.config.ts <<'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: ".next-static",
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
};

export default nextConfig;
EOF

echo "[2/5] Временное перемещение src/app/api (игре не нужен)..."
mv src/app/api "$BAK/api_tmp"

echo "[3/5] Сборка next build (static export)..."
NEXT_TELEMETRY_DISABLED=1 npx.cmd next build

echo "[4/5] Поиск выходной папки экспорта..."
EXPORT_DIR=""
for cand in .next-static out .next-static/out .next-static/export; do
  if [ -f "$cand/index.html" ]; then EXPORT_DIR="$cand"; break; fi
done
if [ -z "$EXPORT_DIR" ]; then
  echo "ОШИБКА: index.html не найден ни в out/, ни в .next-static/*"
  exit 1
fi
echo "Экспорт найден: $EXPORT_DIR"
OUT="$ROOT/download/zhelezny-razlom-site"
rm -rf "$OUT"
mkdir -p "$ROOT/download"
cp -r "$EXPORT_DIR" "$OUT"

echo "[5/5] Готово. Содержимое:"
ls -la "$OUT/"
du -sh "$OUT/"
