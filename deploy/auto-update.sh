#!/usr/bin/env bash
set -euo pipefail

# Resolve repository root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
BRANCH="${DEPLOY_BRANCH:-main}"
PM2_NAME="${PM2_APP_NAME:-unmocked-api}"
BUILD_FRONTEND="${BUILD_FRONTEND:-auto}"
LOG_FILE="${DEPLOY_LOG_FILE:-$SCRIPT_DIR/auto-update.log}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-/tmp/unmocked-auto-update.lock}"
export HOME="${HOME:-/root}"

if [ "${1:-}" = "--log" ]; then
  mkdir -p "$(dirname "$LOG_FILE")"
  if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt 2000 ]; then
    tail -n 1000 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
  fi
  exec >>"$LOG_FILE" 2>&1
fi

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log() {
  echo "[$(timestamp)] $*"
}

REPO_OWNER=""
if command -v stat >/dev/null 2>&1; then
  REPO_OWNER="$(stat -c '%U' "$APP_DIR" 2>/dev/null || stat -f '%Su' "$APP_DIR" 2>/dev/null || true)"
fi

add_node_bins_from_home() {
  local user_home="$1"
  [ -n "$user_home" ] && [ -d "$user_home" ] || return 0
  if [ -d "$user_home/.nvm/versions/node" ]; then
    local d
    for d in "$user_home"/.nvm/versions/node/*/bin; do
      [ -d "$d" ] && PATH="$d:$PATH"
    done
  fi
  [ -d "$user_home/.npm-global/bin" ] && PATH="$user_home/.npm-global/bin:$PATH"
  [ -d "$user_home/.local/bin" ] && PATH="$user_home/.local/bin:$PATH"
}

# Ensure cron / systemd have access to node, npm, and pm2
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
for candidate_user in "$REPO_OWNER" "ec2-user" "ubuntu"; do
  if [ -n "$candidate_user" ] && [ "$candidate_user" != "root" ] && [ -d "/home/$candidate_user" ]; then
    add_node_bins_from_home "/home/$candidate_user"
  fi
done
add_node_bins_from_home "/root"
add_node_bins_from_home "$HOME"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # nvm.sh is not strict-mode safe under set -euo pipefail
  set +euo pipefail
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh" || true
  set -euo pipefail
fi

# Prevent overlapping runs
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    log "Another auto-update run is already in progress; skipping."
    exit 0
  fi
fi

# Trim log if it grows beyond 2000 lines (when invoked via shell redirection)
if [ "${1:-}" != "--log" ] && [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt 2000 ]; then
  tail -n 1000 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

git_repo() {
  git -c "safe.directory=$APP_DIR" -C "$APP_DIR" "$@"
}

run_as_user() {
  local target_user="$1"
  shift
  local target_home
  target_home="$(getent passwd "$target_user" 2>/dev/null | cut -d: -f6 || true)"
  [ -n "$target_home" ] || target_home="/home/$target_user"
  if command -v runuser >/dev/null 2>&1; then
    runuser -u "$target_user" -- env HOME="$target_home" USER="$target_user" LOGNAME="$target_user" PATH="$PATH" "$@"
  else
    su -s /bin/bash "$target_user" -c 'HOME="$1"; USER="$2"; LOGNAME="$2"; PATH="$3"; export HOME USER LOGNAME PATH; shift 3; exec "$@"' _ "$target_home" "$target_user" "$PATH" "$@"
  fi
}

cd "$APP_DIR"

if ! git_repo rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "ERROR: $APP_DIR is not a git repository."
  exit 1
fi

git_repo fetch origin "$BRANCH" --quiet

LOCAL_SHA="$(git_repo rev-parse HEAD)"
REMOTE_SHA="$(git_repo rev-parse "origin/$BRANCH")"

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  if ! command -v pm2 >/dev/null 2>&1; then
    log "WARNING: 'pm2' not found in PATH ($PATH); future updates will fail until pm2 is reachable."
  fi
  log "No new commits on origin/$BRANCH ($LOCAL_SHA)."
  exit 0
fi

log "New push detected on origin/$BRANCH: $LOCAL_SHA -> $REMOTE_SHA"
CHANGED_FILES="$(git_repo diff --name-only "$LOCAL_SHA" "$REMOTE_SHA")"

if ! git_repo pull --ff-only origin "$BRANCH"; then
  log "ERROR: git pull --ff-only failed. Check for local uncommitted edits on EC2."
  exit 1
fi

# Install backend dependencies if backend manifest changed or node_modules missing
if echo "$CHANGED_FILES" | grep -qE '^backend/(package\.json|package-lock\.json)$' || [ ! -d "$APP_DIR/backend/node_modules" ]; then
  log "Installing backend dependencies..."
  (cd "$APP_DIR/backend" && npm install --omit=dev)
fi

# Rebuild frontend only if explicitly requested or if frontend source changed without updated dist
FRONTEND_SRC_CHANGED=0
FRONTEND_DIST_CHANGED=0
if echo "$CHANGED_FILES" | grep -qE '^frontend/(src/|index\.html|vite\.config\.js|package\.json|package-lock\.json)'; then
  FRONTEND_SRC_CHANGED=1
fi
if echo "$CHANGED_FILES" | grep -qE '^frontend/dist/index\.html$'; then
  FRONTEND_DIST_CHANGED=1
fi

if [ "$BUILD_FRONTEND" = "always" ] || { [ "$BUILD_FRONTEND" = "auto" ] && [ "$FRONTEND_SRC_CHANGED" -eq 1 ] && [ "$FRONTEND_DIST_CHANGED" -eq 0 ]; }; then
  log "Frontend source changed without updated dist; installing & building frontend..."
  (cd "$APP_DIR/frontend" && npm install && npm run build)
elif echo "$CHANGED_FILES" | grep -qE '^frontend/(package\.json|package-lock\.json)$' && [ "$BUILD_FRONTEND" = "auto" ]; then
  log "Frontend package manifest changed (prebuilt dist included)."
fi

# Restart or start the backend PM2 service (checks current user first, then repo owner)
if ! command -v pm2 >/dev/null 2>&1; then
  log "ERROR: pm2 not found in PATH ($PATH)."
  exit 1
fi

PM2_RESTARTED=0
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  log "Restarting PM2 process '$PM2_NAME'..."
  pm2 restart "$PM2_NAME" --update-env
  pm2 save >/dev/null 2>&1 || true
  PM2_RESTARTED=1
elif [ "$(id -u)" -eq 0 ]; then
  for candidate_user in "$REPO_OWNER" "ec2-user" "ubuntu"; do
    if [ -n "$candidate_user" ] && [ "$candidate_user" != "root" ] && id -u "$candidate_user" >/dev/null 2>&1; then
      if run_as_user "$candidate_user" pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
        log "Restarting PM2 process '$PM2_NAME' (owned by $candidate_user)..."
        run_as_user "$candidate_user" pm2 restart "$PM2_NAME" --update-env
        run_as_user "$candidate_user" pm2 save >/dev/null 2>&1 || true
        PM2_RESTARTED=1
        break
      fi
    fi
  done
fi

if [ "$PM2_RESTARTED" -eq 0 ]; then
  log "Starting PM2 process '$PM2_NAME'..."
  (cd "$APP_DIR/backend" && pm2 start server.js --name "$PM2_NAME")
  pm2 save >/dev/null 2>&1 || true
fi

log "Deployment complete at $(git_repo rev-parse --short HEAD)."
