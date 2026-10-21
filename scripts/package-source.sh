#!/usr/bin/env bash
# Упаковка всех исходников «Железный Разлом» в zip для передачи пользователю.
# Результат: download/zhelezny-razlom-sources.zip (внутри корневая папка zhelezny-razlom/)
set -euo pipefail

ROOT=/home/z/my-project
STG="$ROOT/scripts/pkg-staging"
OUT="$ROOT/download/zhelezny-razlom-sources.zip"
NAME=zhelezny-razlom

rm -rf "$STG"
mkdir -p "$STG/$NAME"

# 1. Игровой код (engine, render, config, protocol) + UI + app
cp -r "$ROOT/src" "$STG/$NAME/src"

# 2. Публичные ассеты
cp -r "$ROOT/public" "$STG/$NAME/public"

# 3. Prisma-схема
mkdir -p "$STG/$NAME/prisma"
cp "$ROOT/prisma/schema.prisma" "$STG/$NAME/prisma/"

# 4. Скрипты сборки и тестов (без PNG-скриншотов)
mkdir -p "$STG/$NAME/scripts"
cp "$ROOT/scripts/build-static.sh" \
   "$ROOT/scripts/test-engine.ts" \
   "$ROOT/scripts/test-merge-ids.ts" \
   "$ROOT/scripts/test-coop.ts" \
   "$STG/$NAME/scripts/"

# 5. Сервис лобби мультиплеера (relay, порт 3003) — без node_modules
mkdir -p "$STG/$NAME/mini-services/mp-service"
cp "$ROOT/mini-services/mp-service/index.ts" \
   "$ROOT/mini-services/mp-service/package.json" \
   "$ROOT/mini-services/mp-service/bun.lock" \
   "$STG/$NAME/mini-services/mp-service/"

# 6. Корневые конфиги
cp "$ROOT/package.json" "$ROOT/bun.lock" "$ROOT/tsconfig.json" \
   "$ROOT/next.config.ts" "$ROOT/tailwind.config.ts" \
   "$ROOT/postcss.config.mjs" "$ROOT/eslint.config.mjs" "$ROOT/components.json" \
   "$STG/$NAME/"

chmod +x "$STG/$NAME/scripts/build-static.sh"

# 7. Упаковка (index.html-совместимость не требуется — это исходники)
rm -f "$OUT"
cd "$STG"
zip -qr "$OUT" "$NAME"
cd "$ROOT"
rm -rf "$STG"

echo "=== Готово ==="
ls -lh "$OUT"
echo "=== Состав (первые уровни) ==="
unzip -l "$OUT" | awk '{print $4}' | grep -v '^$' | cut -d/ -f1-2 | sort -u | head -40
echo "=== Всего файлов ==="
unzip -l "$OUT" | tail -1
