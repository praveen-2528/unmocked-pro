#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
UPDATE_SCRIPT="$SCRIPT_DIR/auto-update.sh"
LOG_FILE="$SCRIPT_DIR/auto-update.log"
# Default: run once every hour at minute 0
CRON_SCHEDULE="${CRON_SCHEDULE:-0 * * * *}"
SYSTEMD_CALENDAR="${SYSTEMD_CALENDAR:-hourly}"
UNIT_NAME="${SYSTEMD_UNIT_NAME:-unmocked-auto-update}"
SCHEDULER="${DEPLOY_SCHEDULER:-auto}"

chmod +x "$UPDATE_SCRIPT"
touch "$LOG_FILE"

RUN_NOW=0
if [ "${1:-}" = "--run-now" ]; then
  RUN_NOW=1
fi

install_cron() {
  local cron_line existing_cron filtered_cron
  cron_line="$CRON_SCHEDULE \"$UPDATE_SCRIPT\" >> \"$LOG_FILE\" 2>&1"
  existing_cron="$(crontab -l 2>/dev/null || true)"
  filtered_cron="$(printf '%s\n' "$existing_cron" | grep -vF "$UPDATE_SCRIPT" || true)"

  {
    if [ -n "$filtered_cron" ]; then
      printf '%s\n' "$filtered_cron"
    fi
    printf '%s\n' "$cron_line"
  } | crontab -

  echo "Installed hourly EC2 auto-update cron job:"
  echo "  $cron_line"
  echo "Logs will be written to: $LOG_FILE"

  if [ "$RUN_NOW" -eq 1 ]; then
    "$UPDATE_SCRIPT" >> "$LOG_FILE" 2>&1
    echo "Ran initial sync check. Latest log lines:"
    tail -n 20 "$LOG_FILE" || true
  fi
}

install_systemd() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: crontab is not installed; installing a systemd hourly timer requires root." >&2
    echo "Run: sudo $0 $*" >&2
    exit 1
  fi

  local service_file timer_file esc_script esc_app_dir
  service_file="/etc/systemd/system/${UNIT_NAME}.service"
  timer_file="/etc/systemd/system/${UNIT_NAME}.timer"
  esc_script="$(printf '%s' "$UPDATE_SCRIPT" | sed 's/%/%%/g')"
  esc_app_dir="$(printf '%s' "$APP_DIR" | sed 's/%/%%/g')"

  cat > "$service_file" <<EOF
[Unit]
Description=UnMocked Hourly Auto-Update from GitHub
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$esc_app_dir
ExecStart=/bin/bash "$esc_script" --log
EOF

  cat > "$timer_file" <<EOF
[Unit]
Description=Run UnMocked Auto-Update ($SYSTEMD_CALENDAR)

[Timer]
OnCalendar=$SYSTEMD_CALENDAR
Persistent=true
Unit=${UNIT_NAME}.service

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${UNIT_NAME}.timer"

  echo "Installed hourly EC2 auto-update systemd timer:"
  echo "  Service: $service_file"
  echo "  Timer:   $timer_file ($SYSTEMD_CALENDAR)"
  echo "  Logs:    $LOG_FILE"
  systemctl list-timers "${UNIT_NAME}.timer" --no-pager || true

  if [ "$RUN_NOW" -eq 1 ]; then
    if ! systemctl start "${UNIT_NAME}.service"; then
      echo "Initial sync run failed. Latest log lines:" >&2
      tail -n 20 "$LOG_FILE" >&2 || true
      journalctl -u "${UNIT_NAME}.service" -n 20 --no-pager >&2 || true
      exit 1
    fi
    echo "Ran initial sync check. Latest log lines:"
    tail -n 20 "$LOG_FILE" || true
  fi
}

if [ "$SCHEDULER" = "cron" ]; then
  if ! command -v crontab >/dev/null 2>&1; then
    echo "ERROR: DEPLOY_SCHEDULER=cron requested, but 'crontab' was not found." >&2
    exit 1
  fi
  install_cron
elif [ "$SCHEDULER" = "systemd" ]; then
  if ! command -v systemctl >/dev/null 2>&1 || [ ! -d /run/systemd/system ]; then
    echo "ERROR: DEPLOY_SCHEDULER=systemd requested, but systemd is not active." >&2
    exit 1
  fi
  install_systemd "$@"
else
  # Auto-detect: prefer crontab when installed, otherwise use systemd timer (e.g., Amazon Linux 2023)
  if command -v crontab >/dev/null 2>&1; then
    install_cron
  elif command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    install_systemd "$@"
  else
    echo "ERROR: Neither 'crontab' nor an active 'systemd' was found." >&2
    echo "On Amazon Linux, install cronie: sudo dnf install -y cronie && sudo systemctl enable --now crond" >&2
    exit 1
  fi
fi
