#!/usr/bin/env sh
set -eu

docker compose -f compose.minimal.yaml up -d --build

echo ''
echo 'Minimal stack started:'
echo '  Web:    http://localhost:8086'
echo '  Server: http://localhost:3036'
