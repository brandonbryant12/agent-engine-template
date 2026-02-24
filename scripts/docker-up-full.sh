#!/usr/bin/env sh
set -eu

docker compose -f compose.yaml up -d --build

echo ''
echo 'Full stack started:'
echo '  Web:    http://localhost:8086'
echo '  Server: http://localhost:3036'
echo '  MinIO:  http://localhost:9001 (API), http://localhost:9090 (Console)'
echo ''
echo 'Optional: Langfuse observability (start separately):'
echo '  docker compose --profile langfuse up -d'
echo '  Langfuse: http://localhost:3100'
