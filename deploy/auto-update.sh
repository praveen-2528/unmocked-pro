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

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log() {
  echo "[$(timestamp)] $*"
}

# Ensure cron has access to node, npm, and pm2 (nvm, npm-global, /usr/local/bin)
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"
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

# Trim log if it grows beyond 2000 lines
if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt 2000 ]; then
  tail -n 1000 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

cd "$APP_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "ERROR: $APP_DIR is not a git repository."
  exit 1
fi

git fetch origin "$BRANCH" --quiet

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  log "No new commits on origin/$BRANCH ($LOCAL_SHA)."
  exit 0
fi

log "New push detected on origin/$BRANCH: $LOCAL_SHA -> $REMOTE_SHA"
CHANGED_FILES="$(git diff --name-only "$LOCAL_SHA" "$REMOTE_SHA")"

if ! git pull --ff-only origin "$BRANCH"; then
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

# Restart or start the backend PM2 service
if ! command -v pm2 >/dev/null 2>&1; then
  log "ERROR: pm2 not found in PATH ($PATH)."
  exit 1
fi

if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  log "Restarting PM2 process '$PM2_NAME'..."
  pm2 restart "$PM2_NAME" --update-env
else
  log "Starting PM2 process '$PM2_NAME'..."
  (cd "$APP_DIR/backend" && pm2 start server.js --name "$PM2_NAME")
fi

pm2 save >/dev/null 2>&1 || true
log "Deployment complete at $(git rev-parse --short HEAD)."
