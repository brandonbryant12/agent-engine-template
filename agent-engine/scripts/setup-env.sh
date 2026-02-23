#!/usr/bin/env bash
set -euo pipefail

# Agent Engine Template — Environment Setup
# Generates .env files for server, web, and worker apps.
#
# Supports two modes:
#   local   — bare-metal dev (filesystem storage, default ports 3035/8085)
#   docker  — docker compose (MinIO S3 storage, default ports 3036/8086)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
BOLD='\033[1m'
DIM='\033[2m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RESET='\033[0m'

header() { echo -e "\n${BOLD}${CYAN}$1${RESET}"; }
info()   { echo -e "${DIM}$1${RESET}"; }
ok()     { echo -e "${GREEN}  ✓ $1${RESET}"; }
warn()   { echo -e "${YELLOW}$1${RESET}"; }

prompt() {
  local var_name="$1" prompt_text="$2" default="$3"
  local input
  if [[ -n "$default" ]]; then
    echo -en "${BOLD}${prompt_text}${RESET} ${DIM}[${default}]${RESET}: "
  else
    echo -en "${BOLD}${prompt_text}${RESET}: "
  fi
  read -r input
  eval "$var_name=\"${input:-$default}\""
}

prompt_secret() {
  local var_name="$1" prompt_text="$2" default="$3"
  local input
  if [[ -n "$default" ]]; then
    echo -en "${BOLD}${prompt_text}${RESET} ${DIM}[****]${RESET}: "
  else
    echo -en "${BOLD}${prompt_text}${RESET}: "
  fi
  read -rs input
  echo
  eval "$var_name=\"${input:-$default}\""
}

prompt_yn() {
  local var_name="$1" prompt_text="$2" default="$3"
  local input hint="y/n"
  [[ "$default" == "true" ]] && hint="Y/n" || hint="y/N"
  echo -en "${BOLD}${prompt_text}${RESET} ${DIM}[${hint}]${RESET}: "
  read -r input
  input="${input,,}" # lowercase
  if [[ -z "$input" ]]; then
    eval "$var_name=\"$default\""
  elif [[ "$input" == "y" || "$input" == "yes" ]]; then
    eval "$var_name=\"true\""
  else
    eval "$var_name=\"false\""
  fi
}

# ─── Banner ───────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
echo "  ┌─────────────────────────────────────┐"
echo "  │     Agent Engine Template — Env Setup       │"
echo "  └─────────────────────────────────────┘"
echo -e "${RESET}"

# ─── Check for existing .env files ───────────────────────────────────
EXISTING_ENVS=()
for app in server web worker; do
  [[ -f "$ROOT_DIR/apps/$app/.env" ]] && EXISTING_ENVS+=("apps/$app/.env")
done

if [[ ${#EXISTING_ENVS[@]} -gt 0 ]]; then
  warn "Existing .env files found:"
  for f in "${EXISTING_ENVS[@]}"; do
    echo "  - $f"
  done
  echo
  prompt_yn OVERWRITE "Overwrite existing files?" "false"
  if [[ "$OVERWRITE" != "true" ]]; then
    echo "Aborted. Existing files left untouched."
    exit 0
  fi
  echo
fi

# ─── Deployment Mode ─────────────────────────────────────────────────
header "Deployment Mode"
info "local  — run services directly (pnpm dev), filesystem storage"
info "docker — run via docker compose, MinIO S3 storage"
echo
prompt MODE "Mode (local/docker)" "docker"

# Set defaults based on mode
if [[ "$MODE" == "docker" ]]; then
  DEFAULT_SERVER_PORT="3036"
  DEFAULT_WEB_PORT="8086"
  DEFAULT_POSTGRES_URL="postgres://postgres:postgres@localhost:5432/template_app"
  DEFAULT_REDIS_URL="redis://localhost:6379"
  DEFAULT_STORAGE_PROVIDER="s3"
  DEFAULT_TELEMETRY_ENABLED="true"
  DEFAULT_OTEL_ENV="production"
else
  DEFAULT_SERVER_PORT="3035"
  DEFAULT_WEB_PORT="8085"
  DEFAULT_POSTGRES_URL="postgres://postgres:postgres@localhost:5432/postgres"
  DEFAULT_REDIS_URL="redis://localhost:6379"
  DEFAULT_STORAGE_PROVIDER="filesystem"
  DEFAULT_TELEMETRY_ENABLED="false"
  DEFAULT_OTEL_ENV="development"
fi

# ─── Hosting ──────────────────────────────────────────────────────────
header "Hosting"
info "The public hostname or IP where the app will be accessible."
info "Examples: myapp.example.com, 192.168.1.50, localhost"
echo

prompt HOST "Hostname or IP" "localhost"
prompt PROTOCOL "Protocol (http/https)" "http"
prompt SERVER_PORT "Server port" "$DEFAULT_SERVER_PORT"
prompt WEB_PORT "Web app port" "$DEFAULT_WEB_PORT"

PUBLIC_SERVER_URL="${PROTOCOL}://${HOST}:${SERVER_PORT}"
PUBLIC_WEB_URL="${PROTOCOL}://${HOST}:${WEB_PORT}"

echo
info "Server URL: ${PUBLIC_SERVER_URL}"
info "Web URL:    ${PUBLIC_WEB_URL}"

# ─── Database ─────────────────────────────────────────────────────────
header "Database"
prompt POSTGRES_URL "Postgres URL" "$DEFAULT_POSTGRES_URL"

# ─── Redis ────────────────────────────────────────────────────────────
header "Redis"
prompt REDIS_URL "Redis URL" "$DEFAULT_REDIS_URL"

# ─── Auth ─────────────────────────────────────────────────────────────
header "Authentication"
DEFAULT_SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')"
prompt_secret AUTH_SECRET "Auth secret (auto-generated)" "$DEFAULT_SECRET"

# ─── AI ───────────────────────────────────────────────────────────────
header "AI Configuration"
info "Mock AI generates placeholder content — no API key needed."
info "Disable mock AI to use real Gemini LLM + TTS."
echo
prompt_yn USE_MOCK_AI "Use mock AI?" "true"

GEMINI_API_KEY=""
if [[ "$USE_MOCK_AI" == "false" ]]; then
  prompt_secret GEMINI_API_KEY "Gemini API key" ""
  if [[ -z "$GEMINI_API_KEY" ]]; then
    warn "No API key provided — falling back to USE_MOCK_AI=true"
    USE_MOCK_AI="true"
  fi
fi

# ─── Storage ──────────────────────────────────────────────────────────
header "Storage"
info "filesystem = local disk, s3 = S3-compatible (MinIO, AWS, etc.)"
if [[ "$MODE" == "docker" ]]; then
  info "Docker mode defaults to MinIO S3 (included in docker compose)."
fi
echo
prompt STORAGE_PROVIDER "Storage provider (filesystem/s3)" "$DEFAULT_STORAGE_PROVIDER"

STORAGE_PATH=""
STORAGE_BASE_URL=""
S3_BUCKET="" S3_REGION="" S3_ACCESS_KEY_ID="" S3_SECRET_ACCESS_KEY="" S3_ENDPOINT="" S3_PUBLIC_ENDPOINT=""

if [[ "$STORAGE_PROVIDER" == "filesystem" ]]; then
  prompt STORAGE_PATH "Storage path" "./uploads"
  STORAGE_BASE_URL="${PUBLIC_SERVER_URL}/storage"
elif [[ "$STORAGE_PROVIDER" == "s3" ]]; then
  # MinIO defaults from docker compose
  MINIO_PORT="9001"
  MINIO_CONSOLE_PORT="9090"
  prompt S3_BUCKET "S3 bucket" "agent-engine-template"
  prompt S3_REGION "S3 region" "us-east-1"
  prompt S3_ACCESS_KEY_ID "S3 access key ID" "minioadmin"
  prompt_secret S3_SECRET_ACCESS_KEY "S3 secret access key" "minioadmin"
  prompt S3_ENDPOINT "S3 endpoint" "http://localhost:${MINIO_PORT}"
  prompt S3_PUBLIC_ENDPOINT "S3 public endpoint (for file URLs)" "http://${HOST}:${MINIO_PORT}"
fi

# ─── CORS ─────────────────────────────────────────────────────────────
CORS_ORIGINS=""
if [[ "$HOST" != "localhost" ]]; then
  CORS_ORIGINS="*"
fi

# ─── Write .env files ────────────────────────────────────────────────
header "Writing .env files..."

# --- apps/server/.env ---
cat > "$ROOT_DIR/apps/server/.env" <<EOF
SERVER_AUTH_SECRET=${AUTH_SECRET}
SERVER_POSTGRES_URL=${POSTGRES_URL}
SERVER_REDIS_URL=${REDIS_URL}
SSE_REDIS_CHANNEL_PREFIX=cs:sse:user
SERVER_HOST=0.0.0.0
SERVER_PORT=${SERVER_PORT}

PUBLIC_SERVER_URL=${PUBLIC_SERVER_URL}
PUBLIC_SERVER_API_PATH=/api
PUBLIC_WEB_URL=${PUBLIC_WEB_URL}

# AI Configuration
USE_MOCK_AI=${USE_MOCK_AI}
EOF

[[ -n "$GEMINI_API_KEY" ]] && echo "GEMINI_API_KEY=${GEMINI_API_KEY}" >> "$ROOT_DIR/apps/server/.env"
[[ -n "$CORS_ORIGINS" ]] && echo -e "\nCORS_ORIGINS=${CORS_ORIGINS}" >> "$ROOT_DIR/apps/server/.env"

cat >> "$ROOT_DIR/apps/server/.env" <<EOF

# Telemetry (Datadog / OTLP)
TELEMETRY_ENABLED=${DEFAULT_TELEMETRY_ENABLED}
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
# OTEL_EXPORTER_OTLP_HEADERS=DD-API-KEY=your-datadog-api-key
OTEL_SERVICE_NAME=agent-engine-template-server
OTEL_ENV=${DEFAULT_OTEL_ENV}
EOF

# Storage
echo -e "\n# Storage\nSTORAGE_PROVIDER=${STORAGE_PROVIDER}" >> "$ROOT_DIR/apps/server/.env"

if [[ "$STORAGE_PROVIDER" == "filesystem" ]]; then
  cat >> "$ROOT_DIR/apps/server/.env" <<EOF
STORAGE_PATH=${STORAGE_PATH}
STORAGE_BASE_URL=${STORAGE_BASE_URL}
EOF
elif [[ "$STORAGE_PROVIDER" == "s3" ]]; then
  cat >> "$ROOT_DIR/apps/server/.env" <<EOF
S3_BUCKET=${S3_BUCKET}
S3_REGION=${S3_REGION}
S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
S3_ENDPOINT=${S3_ENDPOINT}
S3_PUBLIC_ENDPOINT=${S3_PUBLIC_ENDPOINT}
EOF
fi

ok "apps/server/.env"

# --- apps/web/.env ---
cat > "$ROOT_DIR/apps/web/.env" <<EOF
PUBLIC_SERVER_URL=${PUBLIC_SERVER_URL}
PUBLIC_SERVER_API_PATH=/api
PUBLIC_WEB_URL=${PUBLIC_WEB_URL}
EOF

ok "apps/web/.env"

# --- apps/worker/.env ---
cat > "$ROOT_DIR/apps/worker/.env" <<EOF
SERVER_POSTGRES_URL=${POSTGRES_URL}
SERVER_REDIS_URL=${REDIS_URL}
SSE_REDIS_CHANNEL_PREFIX=cs:sse:user

PUBLIC_SERVER_URL=${PUBLIC_SERVER_URL}

# AI Configuration
USE_MOCK_AI=${USE_MOCK_AI}
EOF

[[ -n "$GEMINI_API_KEY" ]] && echo "GEMINI_API_KEY=${GEMINI_API_KEY}" >> "$ROOT_DIR/apps/worker/.env"

cat >> "$ROOT_DIR/apps/worker/.env" <<EOF

# Telemetry (Datadog / OTLP)
TELEMETRY_ENABLED=${DEFAULT_TELEMETRY_ENABLED}
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
# OTEL_EXPORTER_OTLP_HEADERS=DD-API-KEY=your-datadog-api-key
OTEL_SERVICE_NAME=agent-engine-template-worker
OTEL_ENV=${DEFAULT_OTEL_ENV}
EOF

# Storage (worker needs same storage config as server)
echo -e "\n# Storage\nSTORAGE_PROVIDER=${STORAGE_PROVIDER}" >> "$ROOT_DIR/apps/worker/.env"

if [[ "$STORAGE_PROVIDER" == "filesystem" ]]; then
  cat >> "$ROOT_DIR/apps/worker/.env" <<EOF
STORAGE_PATH=${STORAGE_PATH}
STORAGE_BASE_URL=${STORAGE_BASE_URL}
EOF
elif [[ "$STORAGE_PROVIDER" == "s3" ]]; then
  cat >> "$ROOT_DIR/apps/worker/.env" <<EOF
S3_BUCKET=${S3_BUCKET}
S3_REGION=${S3_REGION}
S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
S3_ENDPOINT=${S3_ENDPOINT}
S3_PUBLIC_ENDPOINT=${S3_PUBLIC_ENDPOINT}
EOF
fi

ok "apps/worker/.env"

# ─── Summary ──────────────────────────────────────────────────────────
echo
echo -e "${BOLD}${GREEN}Done!${RESET} Environment files written."
echo
echo -e "  ${DIM}Mode:    ${MODE}${RESET}"
echo -e "  ${DIM}Server:  ${PUBLIC_SERVER_URL}${RESET}"
echo -e "  ${DIM}Web:     ${PUBLIC_WEB_URL}${RESET}"
echo -e "  ${DIM}Mock AI: ${USE_MOCK_AI}${RESET}"
echo -e "  ${DIM}Storage: ${STORAGE_PROVIDER}${RESET}"

if [[ "$STORAGE_PROVIDER" == "s3" ]]; then
  echo -e "  ${DIM}S3:      ${S3_ENDPOINT} (bucket: ${S3_BUCKET})${RESET}"
fi

echo
header "Next steps"

if [[ "$MODE" == "docker" ]]; then
  info "  docker compose up --build"
  info ""
  info "  Or to expose on your network:"
  info "  HOST_IP=${HOST} docker compose up --build"
  info ""
  info "  MinIO console: http://${HOST}:9090 (minioadmin/minioadmin)"
else
  info "  1. pnpm install"
  info "  2. docker compose -f docker-compose.yml up -d  # start postgres + redis"
  info "  3. pnpm db:push"
  info "  4. pnpm dev"
fi
echo
