#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPDATE_SCRIPT="$SCRIPT_DIR/auto-update.sh"
LOG_FILE="$SCRIPT_DIR/auto-update.log"
# Default: run once every hour at minute 0
CRON_SCHEDULE="${CRON_SCHEDULE:-0 * * * *}"

chmod +x "$UPDATE_SCRIPT"

CRON_LINE="$CRON_SCHEDULE \"$UPDATE_SCRIPT\" >> \"$LOG_FILE\" 2>&1"

EXISTING_CRON="$(crontab -l 2>/dev/null || true)"
FILTERED_CRON="$(printf '%s\n' "$EXISTING_CRON" | grep -vF "$UPDATE_SCRIPT" || true)"

{
  if [ -n "$FILTERED_CRON" ]; then
    printf '%s\n' "$FILTERED_CRON"
  fi
  printf '%s\n' "$CRON_LINE"
} | crontab -

echo "Installed hourly EC2 auto-update cron job:"
echo "  $CRON_LINE"
echo "Logs will be written to: $LOG_FILE"

if [ "${1:-}" = "--run-now" ]; then
  "$UPDATE_SCRIPT" >> "$LOG_FILE" 2>&1
  echo "Ran initial sync check. Latest log lines:"
  tail -n 10 "$LOG_FILE" || true
fi
