#!/usr/bin/env bash
# start.sh — jalankan project Kinanti (Supabase lokal + Next.js) di background
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

PORT=3400
PIDFILE="$APP_DIR/app.pid"
LOG="$APP_DIR/logs/app.log"
mkdir -p "$APP_DIR/logs"

# Lokasi binary supabase (shim di PATH tidak menemukan supabase-go, pakai yang lengkap)
SUPABASE_BIN="/root/.local/share/supabase/supabase"
[ -x "$SUPABASE_BIN" ] || SUPABASE_BIN="supabase"

# corepack pnpm agar tersedia
export PATH="$HOME/.local/bin:$PATH"

echo "[1/2] Memastikan Supabase lokal (DB+Storage+Studio) berjalan..."
if docker ps --filter name=supabase_db_kinanti --format '{{.Names}}' | grep -q kinanti; then
  echo "      Supabase sudah berjalan."
else
  "$SUPABASE_BIN" start
fi

echo "[2/2] Menjalankan Next.js di 127.0.0.1:$PORT ..."
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "      App sudah berjalan (PID $(cat "$PIDFILE")). Hentikan dulu dengan ./stop.sh"
  exit 0
fi

PORT=$PORT HOSTNAME=127.0.0.1 NODE_ENV=production nohup pnpm start > "$LOG" 2>&1 &
echo $! > "$PIDFILE"
sleep 2
echo "      App PID $(cat "$PIDFILE"). Log: $LOG"
echo "Selesai. Cek: ./status.sh"
