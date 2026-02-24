#!/usr/bin/env bash
# send-trace.sh — Send an automation trace to Langfuse (optional, best-effort).
#
# Usage:
#   send-trace.sh \
#     --playbook best-practice-researcher \
#     --run-id "abc123" \
#     --playbook-version "def456" \
#     --model "gpt-5.3-codex" \
#     --input '{"context":"...","taskDescription":"..."}' \
#     --output '{"raw":"..."}' \
#     --score 0.78 \
#     --tokens-prompt 12000 \
#     --tokens-completion 3500 \
#     --latency-ms 45000 \
#     --feedback '{"strengths":[...],"improvements":[...]}'
#
# Environment:
#   LANGFUSE_HOST        — Langfuse base URL (required, else script no-ops)
#   LANGFUSE_PUBLIC_KEY  — Langfuse public key
#   LANGFUSE_SECRET_KEY  — Langfuse secret key
#
# Exit code is always 0 — Langfuse being unavailable never fails a pipeline.

set -euo pipefail

# ── Guard: skip if Langfuse is not configured ─────────────
if [ -z "${LANGFUSE_HOST:-}" ] || [ -z "${LANGFUSE_PUBLIC_KEY:-}" ] || [ -z "${LANGFUSE_SECRET_KEY:-}" ]; then
  echo "[langfuse] Skipping — LANGFUSE_HOST/PUBLIC_KEY/SECRET_KEY not set." >&2
  exit 0
fi

# ── Parse arguments ───────────────────────────────────────
PLAYBOOK="" RUN_ID="" PLAYBOOK_VERSION="" MODEL="" INPUT="{}" OUTPUT="{}"
SCORE="" TOKENS_PROMPT="" TOKENS_COMPLETION="" LATENCY_MS="" FEEDBACK="{}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --playbook)           PLAYBOOK="$2";           shift 2;;
    --run-id)             RUN_ID="$2";             shift 2;;
    --playbook-version)   PLAYBOOK_VERSION="$2";   shift 2;;
    --model)              MODEL="$2";              shift 2;;
    --input)              INPUT="$2";              shift 2;;
    --output)             OUTPUT="$2";             shift 2;;
    --score)              SCORE="$2";              shift 2;;
    --tokens-prompt)      TOKENS_PROMPT="$2";      shift 2;;
    --tokens-completion)  TOKENS_COMPLETION="$2";  shift 2;;
    --latency-ms)         LATENCY_MS="$2";         shift 2;;
    --feedback)           FEEDBACK="$2";           shift 2;;
    *) echo "[langfuse] Unknown arg: $1" >&2; shift;;
  esac
done

TRACE_ID="${RUN_ID:-$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || date +%s)}"

# ── Helper: POST to Langfuse API (best-effort) ───────────
langfuse_post() {
  local endpoint="$1" body="$2"
  curl -sS --max-time 10 -X POST \
    "${LANGFUSE_HOST}/api/public${endpoint}" \
    -H "Content-Type: application/json" \
    -u "${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}" \
    -d "$body" >/dev/null 2>&1 || true
}

# ── 1. Create Trace ──────────────────────────────────────
TRACE_BODY=$(cat <<EOF
{
  "id": "${TRACE_ID}",
  "name": "${PLAYBOOK}",
  "metadata": {
    "playbook": "${PLAYBOOK}",
    "playbookVersion": "${PLAYBOOK_VERSION}",
    "runId": "${RUN_ID}"
  },
  "input": ${INPUT},
  "output": ${OUTPUT}
}
EOF
)
langfuse_post "/traces" "$TRACE_BODY"
echo "[langfuse] Trace created: ${TRACE_ID}" >&2

# ── 2. Create Generation span (if model info provided) ───
if [ -n "$MODEL" ]; then
  GEN_BODY=$(cat <<EOF
{
  "traceId": "${TRACE_ID}",
  "name": "${PLAYBOOK}-generation",
  "model": "${MODEL}",
  "input": ${INPUT},
  "output": ${OUTPUT},
  "usage": {
    "promptTokens": ${TOKENS_PROMPT:-0},
    "completionTokens": ${TOKENS_COMPLETION:-0}
  }${LATENCY_MS:+,
  "endTime": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"}
}
EOF
  )
  langfuse_post "/generations" "$GEN_BODY"
  echo "[langfuse] Generation span created for ${MODEL}" >&2
fi

# ── 3. Send score (if provided) ──────────────────────────
if [ -n "$SCORE" ]; then
  SCORE_BODY=$(cat <<EOF
{
  "traceId": "${TRACE_ID}",
  "name": "overall",
  "value": ${SCORE},
  "comment": "Auto-scored by automation"
}
EOF
  )
  langfuse_post "/scores" "$SCORE_BODY"
  echo "[langfuse] Score sent: ${SCORE}" >&2
fi

echo "[langfuse] Done — trace ${TRACE_ID}" >&2
exit 0
