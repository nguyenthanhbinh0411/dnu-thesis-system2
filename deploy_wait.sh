#!/usr/bin/env bash
set -euo pipefail

# Deploy helper: run docker compose and wait until a target service is healthy.
# Usage: ./deploy_wait.sh [compose-file] [env-file] [service] [timeout_seconds]
# Defaults: compose-file=docker-compose.production.yml, env-file=.env, service=graduation-thesis-api, timeout=300

COMPOSE_FILE=${1:-docker-compose.production.yml}
ENV_FILE=${2:-.env}
TARGET_SERVICE=${3:-graduation-thesis-api}
TIMEOUT=${4:-300}

echo "Deploying using compose file: ${COMPOSE_FILE} (env: ${ENV_FILE})"
cd "$(dirname "$0")"

echo "Running: docker compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} up -d --remove-orphans"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans

start_ts=$(date +%s)
end_ts=$((start_ts + TIMEOUT))
echo "Waiting up to ${TIMEOUT}s for service ${TARGET_SERVICE} to become healthy..."

while true; do
  now=$(date +%s)
  if [ "$now" -gt "$end_ts" ]; then
    echo "Timeout waiting for ${TARGET_SERVICE} to be healthy"
    echo "---- docker ps ----"
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    echo "---- docker inspect health ----"
    docker inspect --format '{{json .State.Health}}' "${TARGET_SERVICE}" 2>/dev/null || true
    echo "---- last 200 lines of ${TARGET_SERVICE} logs ----"
    docker logs --tail 200 "${TARGET_SERVICE}" || true
    exit 1
  fi

  status=$(docker inspect --format '{{.State.Health.Status}}' "${TARGET_SERVICE}" 2>/dev/null || echo "unknown")
  if [ "$status" = "healthy" ]; then
    echo "${TARGET_SERVICE} is healthy"
    exit 0
  fi

  if [ "$status" = "unhealthy" ]; then
    echo "${TARGET_SERVICE} is currently unhealthy, but still within the wait window. Continuing to poll..."
  fi

  # show progress every 10s
  echo "Current status: ${status}. Sleeping 5s..."
  sleep 5
done
