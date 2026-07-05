#!/usr/bin/env bash
# stop.sh — hentikan project Kinanti (Next.js + Supabase lokal). Data volume TETAP utuh.
set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

PORT=3400
PIDFILE="$APP_DIR/app.pid"
SUPABASE_BIN="/root/.local/share/supabase/supabase"
[ -x "$SUPABASE_BIN" ] || SUPABASE_BIN="supabase"

echo "[1/2] Menghentikan Next.js app..."
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  kill "$(cat "$PIDFILE")" 2>/dev/null || true
  sleep 2
fi
# fallback: bunuh proses yang listen di PORT 3400 saja (tidak mengganggu next app lain)
PIDS="$(ss -ltnp "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u)"
if [ -n "${PIDS:-}" ]; then
  echo "      Menutup PID di port $PORT: $PIDS"
  kill $PIDS 2>/dev/null || true
fi
rm -f "$PIDFILE"

echo "[2/2] Menghentikan container Supabase lokal (kinanti)..."
"$SUPABASE_BIN" stop 2>/dev/null || true

echo "Selesai. Project Kinanti dihentikan (data DB & storage tetap tersimpan)."
