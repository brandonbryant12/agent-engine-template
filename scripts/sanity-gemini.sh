#!/usr/bin/env bash
# Quick sanity check for the Gemini generative-language API.
# Usage: GEMINI_API_KEY=<key> ./scripts/sanity-gemini.sh

set -euo pipefail

: "${GEMINI_API_KEY:?Set GEMINI_API_KEY before running this script}"

curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Say hello in one sentence."}]}]}' \
  | python3 -m json.tool

echo ""
echo "Gemini API sanity check passed."
