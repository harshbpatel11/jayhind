#!/usr/bin/env bash
# dev — manage all jayhind projects.
#
# MASTER_DEVELOPMENT_PLAN.md O1.4: the five processes are now supervised by
# systemd (auto-restart on crash, start on boot), not tmux — see
# _staging/systemd/*.service (the non "-staging" ones) and
# workspace CLAUDE.md's "Dev workflow" note. This script keeps the exact same
# friendly CLI you already know (`dev start|stop|restart|status|logs <name>`)
# so nothing about how you use it needs to change — it's now a thin wrapper
# over `systemctl`/log-tailing instead of tmux windows.
#
# `dev` / `dev shell` still opens a small persistent tmux session for a
# plain git/shell terminal that survives SSH disconnects — that part of the
# old workflow is still genuinely useful and has nothing to do with process
# supervision, so it's kept.
set -u

SESSION="dev"
ROOT="/home/ubuntu/projects/jayhind"

# name | unit | port | log directory
PROJECTS=(
  "admin-back|jayhind-admin-back|3100|$ROOT/jayhind-admin-back/logs"
  "client-back|jayhind-client-back|3000|$ROOT/jayhind-client-back/logs"
  "admin-front|jayhind-admin-front|4500|$ROOT/jayhind-admin-front/logs"
  "client-front|jayhind-client-front|4300|$ROOT/jayhindi-client-front/logs"
  "ocr|jayhind-ocr|8100|$ROOT/jayhind-ocr-service/logs"
)

all_names() { local p; for p in "${PROJECTS[@]}"; do echo "${p%%|*}"; done; }

lookup() { # lookup <name> -> sets UNIT, PORT, LOGDIR
  local p name
  for p in "${PROJECTS[@]}"; do
    IFS='|' read -r name UNIT PORT LOGDIR <<<"$p"
    [ "$name" = "$1" ] && return 0
  done
  echo "Unknown project: '$1'. Valid names: $(all_names | tr '\n' ' ')" >&2
  return 1
}

port_up() { ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":$1\$"; }

cmd_start() {
  local names=("$@")
  [ $# -eq 0 ] && mapfile -t names < <(all_names)
  local n UNIT PORT LOGDIR
  for n in "${names[@]}"; do
    lookup "$n" || continue
    sudo systemctl start "$UNIT" && echo "✓ $n: started"
  done
}

cmd_stop() {
  local names=("$@")
  [ $# -eq 0 ] && mapfile -t names < <(all_names)
  local n UNIT PORT LOGDIR
  for n in "${names[@]}"; do
    lookup "$n" || continue
    sudo systemctl stop "$UNIT" && echo "✓ $n: stopped"
  done
}

cmd_restart() {
  local names=("$@")
  [ $# -eq 0 ] && mapfile -t names < <(all_names)
  local n UNIT PORT LOGDIR
  for n in "${names[@]}"; do
    lookup "$n" || continue
    sudo systemctl restart "$UNIT" && echo "✓ $n: restarted"
  done
}

cmd_status() {
  printf "%-14s %-10s %-8s %s\n" "PROJECT" "ACTIVE" "PORT" "LISTENING"
  local p name UNIT PORT LOGDIR active listening
  for p in "${PROJECTS[@]}"; do
    IFS='|' read -r name UNIT PORT LOGDIR <<<"$p"
    active=$(systemctl is-active "$UNIT" 2>/dev/null || echo "inactive")
    port_up "$PORT" && listening="✓ up" || listening="✗ down"
    printf "%-14s %-10s %-8s %s\n" "$name" "$active" "$PORT" "$listening"
  done
}

cmd_logs() { # tail one project's stdout+stderr
  [ $# -eq 1 ] || { echo "Usage: dev logs <name>"; return 1; }
  lookup "$1" || return 1
  echo "Tailing $LOGDIR/dev-{stdout,stderr}.log (Ctrl+C to stop) — also: journalctl -u $UNIT -f"
  tail -n 100 -f "$LOGDIR/dev-stdout.log" "$LOGDIR/dev-stderr.log" 2>/dev/null
}

# A plain shell session, unrelated to process supervision — see header.
ensure_shell_session() {
  tmux has-session -t "$SESSION" 2>/dev/null && return
  tmux new-session -d -s "$SESSION" -n shell -c "$ROOT"
}

cmd_shell() {
  ensure_shell_session
  if [ -n "${TMUX:-}" ]; then
    tmux switch-client -t "$SESSION"
  else
    tmux attach -t "$SESSION"
  fi
}

cmd_help() {
  cat <<EOF
dev — manage all jayhind projects (systemd-backed as of O1.4)

Usage:
  dev                    show status, same as 'dev status'
  dev start [name...]    start all projects, or only the named ones
  dev stop [name...]     stop everything, or only the named ones
  dev restart [name...]  restart all, or only the named ones
  dev status             show what is running and which ports are up
  dev logs <name>        tail one project's stdout+stderr
  dev shell              open/attach a persistent tmux shell (git etc.)
  dev help               this help

Projects: $(all_names | tr '\n' ' ')

Each project is a systemd unit (jayhind-<name>, or 'jayhind-ocr' for ocr) —
'systemctl status jayhind-client-back' / 'journalctl -u jayhind-client-back -f'
work directly too. Restart-on-crash and start-on-boot are systemd's job now;
this script no longer hosts the processes in a tmux window.
EOF
}

case "${1:-}" in
  "")        cmd_status ;;
  start)     shift; cmd_start "$@" ;;
  stop)      shift; cmd_stop "$@" ;;
  restart)   shift; cmd_restart "$@" ;;
  status|st) cmd_status ;;
  logs|log)  shift; cmd_logs "$@" ;;
  shell|attach|a) cmd_shell ;;
  help|-h|--help) cmd_help ;;
  *) echo "Unknown command: $1"; echo; cmd_help; exit 1 ;;
esac
