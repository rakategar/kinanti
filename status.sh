#!/usr/bin/env bash
# status.sh — cek status project Kinanti
set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3400
PIDFILE="$APP_DIR/app.pid"

echo "==================== STATUS KINANTI ===================="

echo "--- Next.js app (port $PORT) ---"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "  RUNNING (PID $(cat "$PIDFILE"))"
else
  echo "  PIDFILE tidak aktif."
fi
if ss -ltn "sport = :$PORT" 2>/dev/null | grep -q ":$PORT"; then
  echo "  Port $PORT: LISTENING"
else
  echo "  Port $PORT: tidak ada listener"
fi
code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT" 2>/dev/null || echo "ERR")
echo "  http://127.0.0.1:$PORT -> HTTP $code"

echo "--- Supabase lokal (container *_kinanti) ---"
docker ps --filter name=_kinanti --format '  {{.Names}}  {{.Status}}' 2>/dev/null || echo "  (docker tidak tersedia)"

echo "--- Domain publik ---"
dcode=$(curl -s -o /dev/null -w '%{http_code}' https://kinantiku.com 2>/dev/null || echo "ERR")
echo "  https://kinantiku.com -> HTTP $dcode"

echo "======================================================="
