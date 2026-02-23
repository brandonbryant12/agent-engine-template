#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${BEST_PRACTICE_RESEARCHER_REPO_ROOT:-$(git rev-parse --show-toplevel)}"
POLL_SECONDS="${BEST_PRACTICE_RESEARCHER_POLL_SECONDS:-900}"
MODEL_NAME="${BEST_PRACTICE_RESEARCHER_MODEL:-gpt-5.3-codex}"
STATE_DIR="${BEST_PRACTICE_RESEARCHER_STATE_DIR:-$HOME/.cache/agent-engine-template/best-practice-researcher-loop}"
REMOTE_URL="${BEST_PRACTICE_RESEARCHER_REMOTE_URL:-$(git -C "$REPO_ROOT" remote get-url origin)}"
RUNNER_REPO_DIR="$STATE_DIR/repo"
RUNNER_WORKTREES_DIR="$STATE_DIR/worktrees"
RUNNER_LOGS_DIR="$STATE_DIR/logs"
LOCK_DIR="$STATE_DIR/lock"
PROMPT_FILE="$STATE_DIR/best-practice-researcher.prompt.txt"

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET='\033[0m'
  C_INFO='\033[36m'
  C_OK='\033[32m'
  C_WARN='\033[33m'
  C_ERR='\033[31m'
else
  C_RESET=''
  C_INFO=''
  C_OK=''
  C_WARN=''
  C_ERR=''
fi

print_line() {
  printf '%s\n' "------------------------------------------------------------"
}

log() {
  local level="$1"
  local color="$2"
  shift 2
  printf '%s[%s][%s]%s %s\n' \
    "$color" \
    "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    "$level" \
    "$C_RESET" \
    "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "ERROR" "$C_ERR" "Missing required command: $1"
    exit 1
  fi
}

release_lock() {
  if [ -f "$LOCK_DIR/pid" ] && [ "$(cat "$LOCK_DIR/pid")" = "$$" ]; then
    rm -f "$LOCK_DIR/pid"
    rmdir "$LOCK_DIR" 2>/dev/null || true
  fi
}

acquire_lock() {
  local existing_pid

  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf '%s\n' "$$" >"$LOCK_DIR/pid"
    return
  fi

  if [ -f "$LOCK_DIR/pid" ]; then
    existing_pid="$(cat "$LOCK_DIR/pid" || true)"
    if [ -n "${existing_pid:-}" ] && kill -0 "$existing_pid" 2>/dev/null; then
      log "ERROR" "$C_ERR" "Another runner is already active (pid $existing_pid). Exiting."
      exit 1
    fi
  fi

  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
  printf '%s\n' "$$" >"$LOCK_DIR/pid"
}

ensure_runner_repo() {
  if [ ! -d "$RUNNER_REPO_DIR/.git" ]; then
    log "INFO" "$C_INFO" "Cloning runner repo into $RUNNER_REPO_DIR"
    git clone --quiet "$REMOTE_URL" "$RUNNER_REPO_DIR"
    return
  fi

  git -C "$RUNNER_REPO_DIR" remote set-url origin "$REMOTE_URL"
}

cleanup_cycle() {
  local worktree_dir="$1"
  local branch_name="$2"
  git -C "$RUNNER_REPO_DIR" worktree remove --force "$worktree_dir" >/dev/null 2>&1 || true
  git -C "$RUNNER_REPO_DIR" branch -D "$branch_name" >/dev/null 2>&1 || true
}

run_cycle() {
  local run_ts branch_name worktree_dir run_log
  local rc=0

  run_ts="$(date -u '+%Y%m%d-%H%M%S')"
  branch_name="codex/best-practice-researcher-loop-${run_ts}"
  worktree_dir="$RUNNER_WORKTREES_DIR/$branch_name"
  run_log="$RUNNER_LOGS_DIR/run-${run_ts}.log"

  print_line
  log "INFO" "$C_INFO" "Best-practice-researcher cycle start"
  log "INFO" "$C_INFO" "Preparing isolated worktree: $worktree_dir"
  git -C "$RUNNER_REPO_DIR" fetch --quiet origin main
  git -C "$RUNNER_REPO_DIR" worktree add -B "$branch_name" "$worktree_dir" origin/main >/dev/null

  trap 'cleanup_cycle "$worktree_dir" "$branch_name"' RETURN

  log "INFO" "$C_INFO" "Starting Codex lane run (model=$MODEL_NAME)"
  set +e
  codex exec \
    --cd "$worktree_dir" \
    --model "$MODEL_NAME" \
    --sandbox danger-full-access \
    --dangerously-bypass-approvals-and-sandbox \
    "$(cat "$PROMPT_FILE")" 2>&1 | tee "$run_log"
  rc=${PIPESTATUS[0]}
  set -e

  if [ "$rc" -eq 0 ]; then
    log "OK" "$C_OK" "Codex run completed successfully."
    log "OK" "$C_OK" "Run log: $run_log"
  else
    log "ERROR" "$C_ERR" "Codex run failed (exit $rc)"
    log "ERROR" "$C_ERR" "Run log: $run_log"
  fi

  trap - RETURN
  cleanup_cycle "$worktree_dir" "$branch_name"
  return "$rc"
}

require_command git
require_command gh
require_command codex

mkdir -p "$STATE_DIR" "$RUNNER_WORKTREES_DIR" "$RUNNER_LOGS_DIR"
acquire_lock
trap release_lock EXIT INT TERM

cat >"$PROMPT_FILE" <<'EOF'
Use gpt-5.3-codex with reasoning effort xhigh.

Execution contract:
- Execute one full `best-practice-researcher` research run.
- Keep reasoning effort at xhigh throughout the run; do not downgrade reasoning depth.
- Execute in a dedicated git worktree rooted at this repository for isolation.
- Repository playbook is the source of truth for this lane.
- Read and execute `agent-engine/automations/best-practice-researcher/best-practice-researcher.md` in the repository root before making decisions.
- Follow the playbook's random-walk, memory-diversity, research, and issue policies exactly.
- If this wrapper conflicts with the playbook, follow the playbook.
- Advisory-only lane: do not implement repository code/docs changes and do not open PRs.
- Exception: every run must append workflow memory and run `pnpm workflow-memory:sync` to commit/push memory artifacts.
- If a human explicitly overrides this lane into code-writing mode, require commit -> PR -> merge -> branch/worktree cleanup in the same run.
- Keep run output concise and include:
  - chosen path (scope + domain) and why selected from memory
  - top ranked recommendations with concrete repo evidence
  - duplicate-check outcome (issues/PRs searched and reuse decisions)
  - issue actions taken (created/updated/skipped) with URLs
  - memory append summary
EOF

ensure_runner_repo
REPO_SLUG="$(cd "$REPO_ROOT" && gh repo view --json nameWithOwner --jq '.nameWithOwner')"
print_line
log "INFO" "$C_INFO" "Best-practice-researcher loop runner started"
log "INFO" "$C_INFO" "Repo: $REPO_SLUG"
log "INFO" "$C_INFO" "Poll interval: ${POLL_SECONDS}s"
log "INFO" "$C_INFO" "State dir: $STATE_DIR"
log "INFO" "$C_INFO" "Runner logs: $RUNNER_LOGS_DIR"
print_line

while true; do
  if ! run_cycle; then
    log "WARN" "$C_WARN" "Cycle failed. Sleeping for ${POLL_SECONDS}s before retry."
    sleep "$POLL_SECONDS"
    continue
  fi

  log "INFO" "$C_INFO" "Cycle complete. Sleeping for ${POLL_SECONDS}s before next run."
  sleep "$POLL_SECONDS"
done
