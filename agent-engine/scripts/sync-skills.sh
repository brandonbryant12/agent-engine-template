#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="$ROOT_DIR/.agents/skills"
TARGETS=(
  "$ROOT_DIR/.claude/skills"
  "$ROOT_DIR/.agent/skills"
  "$ROOT_DIR/.github/skills"
)

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source skills directory not found: $SOURCE_DIR" >&2
  exit 1
fi

for target in "${TARGETS[@]}"; do
  mkdir -p "$target"

  # Clean up broken links only.
  while IFS= read -r broken_link; do
    rm -f "$broken_link"
  done < <(find "$target" -maxdepth 1 -mindepth 1 -type l ! -exec test -e {} \; -print)

  for skill_dir in "$SOURCE_DIR"/*; do
    [[ -d "$skill_dir" ]] || continue
    skill_name="$(basename "$skill_dir")"
    link_path="$target/$skill_name"
    relative_target="../../.agents/skills/$skill_name"

    if [[ -L "$link_path" ]]; then
      current_target="$(readlink "$link_path")"
      if [[ "$current_target" != "$relative_target" ]]; then
        ln -sfn "$relative_target" "$link_path"
      fi
      continue
    fi

    if [[ -e "$link_path" ]]; then
      echo "Skipping non-symlink path: $link_path" >&2
      continue
    fi

    ln -s "$relative_target" "$link_path"
  done
done

echo "Skill symlinks synced from $SOURCE_DIR"
