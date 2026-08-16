#!/usr/bin/env bash
# docker.sh — manage the Dockerized jayhind stack on THIS server.
#
# Thin wrapper over `docker compose -f docker-compose.yml -f
# docker-compose.server.yml`, so the muscle-memory CLI from the old dev.sh
# (systemd-based, retired by this same change) still mostly works.
#
# On a Mac, don't use this script — just run plain `docker compose ...`
# from this directory; docker-compose.override.yml is picked up
# automatically and gives you hot-reload + localhost ports instead.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.server.yml)

cmd_help() {
  cat <<EOF
docker.sh — manage the Dockerized jayhind stack (server)

Usage:
  ./docker.sh                 show status, same as 'status'
  ./docker.sh up [service...] build (if needed) and start everything, or only named services
  ./docker.sh down [service...] stop the named services, or everything (containers kept)
  ./docker.sh restart [service...] restart everything, or only named services
  ./docker.sh status          show what's running
  ./docker.sh logs <service>  tail one service's logs
  ./docker.sh build [service...] rebuild image(s) after a code change, no restart
  ./docker.sh help            this help

Services: mysql redis admin-back client-back admin-front client-front ocr portainer
EOF
}

case "${1:-}" in
  ""|status|ps) "${COMPOSE[@]}" ps ;;
  up|start)     shift || true; "${COMPOSE[@]}" up -d --build "$@" ;;
  down|stop)    shift || true; "${COMPOSE[@]}" stop "$@" ;;
  restart)      shift || true; "${COMPOSE[@]}" restart "$@" ;;
  logs|log)     shift; "${COMPOSE[@]}" logs -f --tail=200 "$@" ;;
  build)        shift || true; "${COMPOSE[@]}" build "$@" ;;
  help|-h|--help) cmd_help ;;
  *) echo "Unknown command: $1"; echo; cmd_help; exit 1 ;;
esac
