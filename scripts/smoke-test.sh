#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 ustauretim
#
# Genel test: paketin tüm doğrulama adımlarını sırayla çalıştırır.
# Kullanım: bash scripts/smoke-test.sh
# Çıkış kodu: 0 hepsi geçti · 1 en az bir adım başarısız

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
NODE="${NODE:-node}"
LOG="$(mktemp -t dora-test-XXXXXX.log)"
PASS=0
FAIL=0

c_ok=$'\033[32m'; c_no=$'\033[31m'; c_dim=$'\033[2m'; c_off=$'\033[0m'
[ -t 1 ] || { c_ok=''; c_no=''; c_dim=''; c_off=''; }

say() { printf '\n== %s\n' "$1"; }

run() {
  local name="$1"; shift
  if "$@" >"$LOG" 2>&1; then
    printf '  %sPASS%s  %s\n' "$c_ok" "$c_off" "$name"
    PASS=$((PASS + 1))
  else
    printf '  %sFAIL%s  %s\n' "$c_no" "$c_off" "$name"
    sed 's/^/        /' "$LOG" | tail -n 15
    FAIL=$((FAIL + 1))
  fi
}

say "0) Ortam"
if ! command -v "$NODE" >/dev/null 2>&1; then
  echo "  Node.js bulunamadı. Kurulum: https://nodejs.org (LTS) veya apt/nodesource."
  exit 1
fi
NODE_VERSION="$("$NODE" -p 'process.versions.node')"
printf '  node %s  ·  %s\n' "$NODE_VERSION" "$ROOT"
if [ "$("$NODE" -p 'Number(process.versions.node.split(".")[0])')" -lt 18 ]; then
  echo "  Node.js 18 veya üzeri gerekli (bulunan: $NODE_VERSION)."
  exit 1
fi

# demo ve senaryolar için geliştirme lisans anahtarı
CLI="$ROOT/onboarding/cli"
if [ ! -f "$CLI/license/dev-private.pem" ]; then
  say "0b) Geliştirme lisans anahtarı"
  ( cd "$CLI" && "$NODE" tools/license-gen.mjs --init-dev-keys ) >/dev/null 2>&1 \
    && echo "  anahtar üretildi (yalnız test için)" \
    || echo "  anahtar üretilemedi — demo adımı atlanabilir"
fi

say "1) Katalog şemaları (strict)"
run "validate --strict" bash -c "cd '$CLI' && '$NODE' bin/dora-onboard.mjs validate --strict"

say "2) Kural motoru"
run "49 kural söz dizimi" bash -c "cd '$CLI' && '$NODE' bin/dora-onboard.mjs rules --audit"

say "3) 6 fazlı yaşam döngüsü demosu"
run "demo (6/6 faz)" bash -c "cd '$CLI' && '$NODE' tools/demo.mjs"

say "4) Kabul senaryoları"
run "27/27 assertion" bash -c "cd '$CLI' && '$NODE' tools/demo-scenario.mjs"

say "5) Kanıt paketi ve bildirim formları"
run "demo-export" bash -c "cd '$CLI' && '$NODE' tools/demo-export.mjs"

say "6) Dış veri alımı ve takvim"
run "demo-ingest" bash -c "cd '$CLI' && '$NODE' tools/demo-ingest.mjs"

say "7) DORA eşlemesi"
run "render-mapping --check" bash -c "cd '$ROOT' && '$NODE' docs/tools/render-mapping.mjs --check"

say "8) Dashboard ve site üretimi"
run "build-dashboard" bash -c "cd '$ROOT' && '$NODE' docs/tools/build-dashboard.mjs"
run "build-site" bash -c "cd '$ROOT' && '$NODE' docs/tools/build-site.mjs"

say "ÖZET"
printf '  %d geçti · %d başarısız\n' "$PASS" "$FAIL"
rm -f "$LOG"
if [ "$FAIL" -eq 0 ]; then
  printf '\n%sTÜM ADIMLAR GEÇTİ%s\n' "$c_ok" "$c_off"
  exit 0
fi
printf '\n%sBAŞARISIZ ADIM VAR%s — yukarıdaki çıktıyı inceleyin\n' "$c_no" "$c_off"
exit 1
