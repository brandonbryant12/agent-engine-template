#!/bin/sh
set -e

# Generate runtime env.js from PUBLIC_* environment variables.
# This allows a single Docker image to be deployed to any environment.

ENV_FILE="/app/dist/env.js"

echo "globalThis.__ENV__ = {" > "$ENV_FILE"

# Iterate over all env vars starting with PUBLIC_
env | grep '^PUBLIC_' | while IFS='=' read -r key value; do
  # Escape backslashes and double quotes in the value
  escaped=$(printf '%s' "$value" | sed 's/\\/\\\\/g; s/"/\\"/g')
  echo "  \"$key\": \"$escaped\"," >> "$ENV_FILE"
done

echo "};" >> "$ENV_FILE"

echo "Generated $ENV_FILE:"
cat "$ENV_FILE"

exec node /app/serve.js
