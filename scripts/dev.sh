#!/usr/bin/env bash

set -euo pipefail

pids=()

stop_children() {
  trap - EXIT INT TERM
  if ((${#pids[@]})); then
    kill "${pids[@]}" 2>/dev/null || true
    wait "${pids[@]}" 2>/dev/null || true
  fi
}

trap stop_children EXIT INT TERM

pnpm --filter @wisp/api dev &
pids+=("$!")

pnpm --filter @wisp/api dev:indexer &
pids+=("$!")

pnpm --filter @wisp/web dev &
pids+=("$!")

wait -n "${pids[@]}"
