#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 ustauretim
#
# Ubuntu kurulum betiği — bağımlılıksız CLI + statik dashboard.
#
# Kullanım:
#   sudo bash scripts/install-ubuntu.sh                     # /opt/dora-ai-package, port 8080
#   sudo bash scripts/install-ubuntu.sh --port 8081
#   sudo bash scripts/install-ubuntu.sh --dir /srv/dora
#   sudo bash scripts/install-ubuntu.sh --service           # systemd servisi kur ve başlat
#   bash scripts/install-ubuntu.sh --offline                # yalnızca mevcut dizinden kur (git yok)
#
# Gereksinim: Node.js 18+ (kurulu değilse betik kurmaz, komut gösterir), git (klon için).

set -euo pipefail

REPO_URL="https://github.com/atlantis77ut/dora-ai-package.git"
TARGET="/opt/dora-ai-package"
PORT="8080"
SERVICE=0
OFFLINE=0
RUN_TESTS=1

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) TARGET="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --service) SERVICE=1; shift ;;
    --offline) OFFLINE=1; shift ;;
    --no-tests) RUN_TESTS=0; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "bilinmeyen seçenek: $1"; exit 1 ;;
  esac
done

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok() { printf '  \033[32m✔\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
die() { printf '\n\033[31mHATA:\033[0m %s\n' "$1"; exit 1; }

# ── 1) ön koşullar ───────────────────────────────────────
say "1) Ön koşullar"
command -v node >/dev/null 2>&1 || die "Node.js bulunamadı. Kurulum:
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  veya: sudo snap install node --classic"
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18+ gerekli (bulunan: $(node -v))"
ok "node $(node -v)"

if [ "$OFFLINE" -eq 0 ]; then
  command -v git >/dev/null 2>&1 || die "git bulunamadı (ya da --offline kullanın)."
  ok "git $(git --version | awk '{print $3}')"
fi

# ── 2) dosyalar ──────────────────────────────────────────
say "2) Dosyalar: $TARGET"
if [ -d "$TARGET/.git" ] || [ -f "$TARGET/README.md" ]; then
  warn "dizin zaten var, güncellenmiyor (elle: git -C $TARGET pull)"
elif [ "$OFFLINE" -eq 1 ]; then
  SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  mkdir -p "$TARGET"
  tar -C "$SRC" --exclude=.git --exclude=node_modules --exclude=.dora-onboarding -cf - . | tar -C "$TARGET" -xf -
  ok "mevcut dizinden kopyalandı: $SRC"
else
  git clone --depth 1 "$REPO_URL" "$TARGET"
  ok "klonlandı: $REPO_URL"
fi

# ── 3) servis kullanıcısı ────────────────────────────────
if [ "$SERVICE" -eq 1 ]; then
  say "3) Servis kullanıcısı"
  if ! id dora >/dev/null 2>&1; then
    useradd --system --home "$TARGET" --shell /usr/sbin/nologin dora
    ok "kullanıcı oluşturuldu: dora"
  else
    ok "kullanıcı var: dora"
  fi
  chown -R dora:dora "$TARGET"
  ok "sahiplik: dora:dora"
fi

# ── 4) testler ───────────────────────────────────────────
if [ "$RUN_TESTS" -eq 1 ]; then
  say "4) Genel test (scripts/smoke-test.sh)"
  if bash "$TARGET/scripts/smoke-test.sh"; then
    ok "tüm testler geçti"
  else
    warn "testlerde başarısız adım var — kuruluma devam ediliyor, çıktıyı inceleyin"
  fi
fi

# ── 5) systemd ───────────────────────────────────────────
if [ "$SERVICE" -eq 1 ]; then
  say "5) systemd servisi"
  sed -e "s#/opt/dora-ai-package#$TARGET#g" -e "s#--port 8080#--port $PORT#g" -e "s#Environment=PORT=8080#Environment=PORT=$PORT#" \
    "$TARGET/deploy/dora-ai-package.service" >/etc/systemd/system/dora-ai-package.service
  systemctl daemon-reload
  systemctl enable --now dora-ai-package
  sleep 1
  if systemctl is-active --quiet dora-ai-package; then
    ok "servis çalışıyor"
  else
    warn "servis başlamadı: journalctl -u dora-ai-package -n 40"
  fi
fi

# ── 6) özet ──────────────────────────────────────────────
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
say "Kurulum tamam"
cat <<EOF
  Dizin      : $TARGET
  Node       : $(node -v)
  Dashboard  : http://${IP:-<sunucu-ip>}:$PORT/dashboard/
  Sağlık     : http://${IP:-<sunucu-ip>}:$PORT/healthz

  Servis yoksa elle çalıştır:
    cd $TARGET/onboarding/cli && node tools/serve.mjs --port $PORT

  systemd:
    sudo systemctl status dora-ai-package
    sudo journalctl -u dora-ai-package -f
EOF
