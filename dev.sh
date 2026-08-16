#!/usr/bin/env bash
# dev.sh — run every Jayhind ERP service locally, from one command, on any OS.
#
# Works on macOS and Linux out of the box. On Windows, run it from Git Bash
# (installed with Git for Windows) or WSL — plain cmd.exe/PowerShell can't
# execute a shell script directly.
#
# Usage:
#   ./dev.sh                    start every set-up project, combined live
#                                logs in this terminal (Ctrl+C stops all)
#   ./dev.sh start [name...]    same, but only the named project(s)
#   ./dev.sh start -d [name...] start in the background instead, and return
#                                control immediately
#   ./dev.sh stop [name...]     stop background-started project(s)
#   ./dev.sh restart [name...]  stop then start (background)
#   ./dev.sh status             show what's set up / running / listening
#   ./dev.sh logs <name>        tail one project's log
#   ./dev.sh help               this help
#
# Projects: admin-back client-back admin-front client-front ocr
#
# No sudo, no systemd, no tmux — this is the local-dev counterpart to the
# staging/production process supervision described in _ops/ and
# _staging/systemd/*.service.
set -u
set -m   # job control: each background service gets its own process group,
         # so `stop` can kill the whole tree (npm -> sh -c -> ng/nest/node),
         # not just the top-level npm process.

# Resolve the directory this script lives in, so it works no matter where the
# repo was cloned or which OS/shell invoked it — no hardcoded paths.
SRC="${BASH_SOURCE[0]}"
while [ -h "$SRC" ]; do
  SRC_DIR="$(cd -P "$(dirname "$SRC")" >/dev/null 2>&1 && pwd)"
  SRC="$(readlink "$SRC")"
  [[ $SRC != /* ]] && SRC="$SRC_DIR/$SRC"
done
ROOT="$(cd -P "$(dirname "$SRC")" >/dev/null 2>&1 && pwd)"

LOGDIR="$ROOT/.dev-logs"
PIDDIR="$ROOT/.dev-pids"
mkdir -p "$LOGDIR" "$PIDDIR"

# name | dir (relative to ROOT) | port | start command (run from inside dir)
PROJECTS=(
  "admin-back|jayhind-admin-back|3100|npm start"
  "client-back|jayhind-client-back|3000|npm start"
  "admin-front|jayhind-admin-front|4500|npm start"
  "client-front|jayhindi-client-front|4300|npm start"
  "ocr|jayhind-ocr-service|8100|./scripts/serve.sh"
)

all_names() { local p; for p in "${PROJECTS[@]}"; do echo "${p%%|*}"; done; }

lookup() { # lookup <name> -> sets DIR (absolute), PORT, RUNCMD
  local p name
  for p in "${PROJECTS[@]}"; do
    IFS='|' read -r name DIR PORT RUNCMD <<<"$p"
    if [ "$name" = "$1" ]; then
      DIR="$ROOT/$DIR"
      return 0
    fi
  done
  echo "Unknown project: '$1'. Valid names: $(all_names | tr '\n' ' ')" >&2
  return 1
}

is_available() { # has this project actually been set up (deps installed)?
  lookup "$1" || return 1
  case "$1" in
    ocr) [ -x "$DIR/.venv/bin/python" ] ;;
    *)   [ -d "$DIR/node_modules" ] ;;
  esac
}

# Portable TCP check — no ss/lsof/nc dependency, works via bash's own /dev/tcp.
port_up() { (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

pidfile_for() { echo "$PIDDIR/$1.pid"; }
logfile_for() { echo "$LOGDIR/$1.log"; }

is_running() {
  local pf; pf="$(pidfile_for "$1")"
  [ -f "$pf" ] && kill -0 "$(cat "$pf")" 2>/dev/null
}

# Colors, only when attached to a real terminal.
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  COLORS=(36 35 33 32 34)
else
  COLORS=()
fi

color_for() {
  [ ${#COLORS[@]} -eq 0 ] && return
  local idx=0 n
  for n in $(all_names); do
    [ "$n" = "$1" ] && { echo "${COLORS[$((idx % ${#COLORS[@]}))]}"; return; }
    idx=$((idx + 1))
  done
}

start_one_bg() {
  local name="$1"
  lookup "$name" || return 1
  if ! is_available "$name"; then
    echo "‣ $name: skipped — not set up yet (see README's per-project setup)"
    return 0
  fi
  if is_running "$name"; then
    echo "‣ $name: already running (pid $(cat "$(pidfile_for "$name")"))"
    return 0
  fi
  ( cd "$DIR" && exec $RUNCMD ) >"$(logfile_for "$name")" 2>&1 &
  local pid=$!
  disown 2>/dev/null
  echo "$pid" >"$(pidfile_for "$name")"
  echo "‣ $name: started (pid $pid, port $PORT)"
}

stop_one() {
  local name="$1"
  lookup "$name" || return 1
  local pf; pf="$(pidfile_for "$name")"
  if ! is_running "$name"; then
    echo "‣ $name: not running"
    rm -f "$pf"
    return 0
  fi
  local pid; pid="$(cat "$pf")"
  # Negative PID targets the whole process group (see `set -m` above), so
  # this reaches npm's/serve.sh's child processes (ng serve, nest, node...)
  # too, not just the immediate child we forked.
  kill -- "-$pid" 2>/dev/null
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.2
  done
  kill -0 "$pid" 2>/dev/null && kill -9 -- "-$pid" 2>/dev/null
  rm -f "$pf"
  echo "‣ $name: stopped"
}

follow_one() { # stream one project's log to stdout, prefixed and colored
  local name="$1" col; col="$(color_for "$name")"
  local lf; lf="$(logfile_for "$name")"
  tail -n +1 -F "$lf" 2>/dev/null | while IFS= read -r line; do
    if [ -n "$col" ]; then
      printf '\033[%sm[%s]\033[0m %s\n' "$col" "$name" "$line"
    else
      printf '[%s] %s\n' "$name" "$line"
    fi
  done
}

FOLLOW_PIDS=()

stop_watch() {
  local names=("$@") p
  echo
  echo "Stopping..."
  for p in "${FOLLOW_PIDS[@]:-}"; do kill "$p" 2>/dev/null; done
  cmd_stop "${names[@]}"
  exit 0
}

watch_logs() { # combined, colorized, live tail — foreground, Ctrl+C stops all
  local names=("$@") n
  echo
  echo "Combined logs — Ctrl+C stops every service started above."
  echo
  trap 'stop_watch "${names[@]}"' INT TERM
  FOLLOW_PIDS=()
  for n in "${names[@]}"; do
    follow_one "$n" &
    FOLLOW_PIDS+=("$!")
  done
  wait
}

cmd_start() {
  local detach=0
  if [ "${1:-}" = "-d" ] || [ "${1:-}" = "--detach" ]; then
    detach=1
    shift
  fi
  local requested=("$@")
  [ ${#requested[@]} -eq 0 ] && requested=($(all_names))
  local n
  for n in "${requested[@]}"; do lookup "$n" >/dev/null || return 1; done

  local started=()
  for n in "${requested[@]}"; do
    start_one_bg "$n"
    is_running "$n" && started+=("$n")
  done

  if [ ${#started[@]} -eq 0 ]; then
    echo
    echo "Nothing is running. Set a project up first (npm install, or the OCR"
    echo "service's ./scripts/install.sh), then run this again."
    return 1
  fi

  if [ "$detach" -eq 1 ]; then
    echo
    echo "Running in background. Use: $0 status | $0 logs <name> | $0 stop"
  else
    watch_logs "${started[@]}"
  fi
}

cmd_stop() {
  local names=("$@")
  [ ${#names[@]} -eq 0 ] && names=($(all_names))
  local n
  for n in "${names[@]}"; do stop_one "$n"; done
}

cmd_restart() {
  local names=("$@")
  [ ${#names[@]} -eq 0 ] && names=($(all_names))
  local n
  for n in "${names[@]}"; do
    stop_one "$n"
    start_one_bg "$n"
  done
}

cmd_status() {
  printf "%-14s %-8s %-9s %-8s %s\n" "PROJECT" "SET UP" "RUNNING" "PORT" "LISTENING"
  local p name port cmd avail running listening
  for p in "${PROJECTS[@]}"; do
    IFS='|' read -r name _ port cmd <<<"$p"
    is_available "$name" && avail="yes" || avail="no"
    is_running "$name" && running="pid $(cat "$(pidfile_for "$name")")" || running="-"
    port_up "$port" && listening="✓ up" || listening="✗ down"
    printf "%-14s %-8s %-9s %-8s %s\n" "$name" "$avail" "$running" "$port" "$listening"
  done
}

cmd_logs() {
  [ $# -eq 1 ] || { echo "Usage: $0 logs <name>"; return 1; }
  lookup "$1" || return 1
  local lf; lf="$(logfile_for "$1")"
  [ -f "$lf" ] || { echo "No log yet for '$1' — start it first."; return 1; }
  echo "Tailing $lf (Ctrl+C to stop)"
  tail -n 100 -f "$lf"
}

cmd_help() {
  cat <<EOF
dev.sh — run every Jayhind ERP service locally, from one command, on any OS.

Usage:
  ./dev.sh                    start all set-up projects, combined live logs
                               in this terminal (Ctrl+C stops all)
  ./dev.sh start [name...]    same, but only the named project(s)
  ./dev.sh start -d [name...] start in the background, return immediately
  ./dev.sh stop [name...]     stop background-started project(s)
  ./dev.sh restart [name...]  stop then start (background)
  ./dev.sh status             show what's set up / running / listening
  ./dev.sh logs <name>        tail one project's log
  ./dev.sh help               this help

Projects: $(all_names | tr '\n' ' ')

Logs live in .dev-logs/, pid files in .dev-pids/ (both git-ignored). Start
MySQL (and Redis, if installed) yourself first — this script only manages
the five app processes, same as README.md's per-project setup does.

Windows: run this from Git Bash or WSL, not cmd.exe/PowerShell directly.
EOF
}

case "${1:-}" in
  ""|start)       [ "${1:-}" = "start" ] && shift; cmd_start "$@" ;;
  stop)           shift; cmd_stop "$@" ;;
  restart)        shift; cmd_restart "$@" ;;
  status|st)      cmd_status ;;
  logs|log)       shift; cmd_logs "$@" ;;
  help|-h|--help) cmd_help ;;
  *) echo "Unknown command: $1"; echo; cmd_help; exit 1 ;;
esac
