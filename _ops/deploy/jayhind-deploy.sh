#!/usr/bin/env bash
# Activates a release that GitHub Actions has already uploaded.
#
#   jayhind-deploy <service> <release-id>
#
# Installed on the production host as /srv/jayhind/bin/jayhind-deploy by
# server-bootstrap.sh. Each service repo's .github/workflows/deploy-production.yml
# builds on the runner (the host has 1 GB of RAM — an Angular build does not fit
# on it), rsyncs the result to /srv/jayhind/<service>/releases/<release-id>/, and
# then calls this script over SSH.
#
# Layout per service:
#   /srv/jayhind/<service>/releases/<id>/   one directory per deploy (last 5 kept)
#   /srv/jayhind/<service>/current          symlink → the live release
#   /srv/jayhind/<service>/shared/          survives every deploy (.env, uploads, logs, …)
#
# A backend release is only switched live after its migrations have run AND the
# new process answers /health/live; otherwise `current` is pointed back at the
# previous release and the script exits non-zero, which fails the workflow.
# ⚠️ Migrations are NOT rolled back on that path — they are written to be
# forward-only and idempotent (CLAUDE.md §4.8).
set -euo pipefail

ROOT=/srv/jayhind
KEEP_RELEASES=5

svc="${1:?usage: jayhind-deploy <service> <release-id>}"
rel="${2:?usage: jayhind-deploy <service> <release-id>}"

case "$svc" in
  client-back)  kind=backend;  port=3000 ;;
  admin-back)   kind=backend;  port=3100 ;;
  client-front) kind=frontend; port=4300 ;;
  admin-front)  kind=frontend; port=4500 ;;
  *) echo "unknown service: $svc" >&2; exit 2 ;;
esac
[[ "$rel" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "bad release id: $rel" >&2; exit 2; }

base="$ROOT/$svc"
release="$base/releases/$rel"
shared="$base/shared"
[ -d "$release" ] || { echo "release not uploaded: $release" >&2; exit 1; }

# One deploy per service at a time; a second push waits rather than interleaving.
exec 9>"$base/.deploy.lock"
flock 9

log() { printf '[%s] %s: %s\n' "$(date -u +%H:%M:%S)" "$svc" "$*"; }

previous="$(readlink -f "$base/current" 2>/dev/null || true)"

switch_to() { # atomic symlink swap
  ln -sfn "$1" "$base/current.tmp"
  mv -Tf "$base/current.tmp" "$base/current"
}

health() { # health <url> — up to ~60s
  for _ in $(seq 1 30); do
    if curl -fs -o /dev/null --max-time 3 "$1"; then return 0; fi
    sleep 2
  done
  return 1
}

if [ "$kind" = backend ]; then
  [ -f "$shared/.env" ] || { echo "missing $shared/.env" >&2; exit 1; }

  # Everything the app writes relative to its cwd lives in shared/, so a deploy
  # never loses an upload, a log, or a company logo.
  mkdir -p "$shared"/{logs,uploads,tmp}
  ln -sfn "$shared/.env" "$release/.env"
  for d in logs uploads tmp; do
    rm -rf "${release:?}/$d"
    ln -sfn "$shared/$d" "$release/$d"
  done
  if [ "$svc" = client-back ]; then
    # Company logos/favicons are written here at runtime (CLAUDE.md §6.4) and
    # served statically. Seed shared/ from the repo copy once, then keep it.
    if [ ! -d "$shared/site-configuration-assets" ]; then
      cp -a "$release/site-configuration-assets" "$shared/site-configuration-assets" 2>/dev/null \
        || mkdir -p "$shared/site-configuration-assets"
    fi
    rm -rf "$release/site-configuration-assets"
    ln -sfn "$shared/site-configuration-assets" "$release/site-configuration-assets"
  fi

  cd "$release"
  # Reuse the live release's node_modules when the lockfile is unchanged
  # (hard links — instant, no extra disk). Full install otherwise: sequelize-cli
  # is a devDependency and the migrations are .ts run by Node's type stripping.
  if [ -n "$previous" ] && [ -d "$previous/node_modules" ] \
     && cmp -s "$previous/package-lock.json" "$release/package-lock.json"; then
    log "lockfile unchanged — reusing node_modules"
    cp -al "$previous/node_modules" "$release/node_modules"
  else
    log "npm ci"
    npm ci --no-audit --no-fund --loglevel=error
  fi

  log "migrating"
  NODE_ENV=production npx --no-install sequelize db:migrate

  log "switching live"
  switch_to "$release"
  pm2 startOrRestart "$ROOT/ecosystem.config.js" --only "$svc" --update-env >/dev/null

  if ! health "http://127.0.0.1:$port/health/live"; then
    log "HEALTH CHECK FAILED — rolling back"
    pm2 logs "$svc" --lines 60 --nostream || true
    if [ -n "$previous" ]; then
      switch_to "$previous"
      pm2 startOrRestart "$ROOT/ecosystem.config.js" --only "$svc" --update-env >/dev/null
    fi
    exit 1
  fi
  pm2 save >/dev/null
else
  [ -f "$release/index.html" ] || { echo "no index.html in $release" >&2; exit 1; }
  log "switching live"
  switch_to "$release"   # nginx resolves the symlink per request — no reload
  if ! health "http://127.0.0.1:$port/"; then
    log "HEALTH CHECK FAILED — rolling back"
    [ -n "$previous" ] && switch_to "$previous"
    exit 1
  fi
fi

# Prune old releases, never the live one. Ids start with a UTC timestamp, so
# name order is deploy order (mtime is not — rsync -a copies the runner's).
live="$(readlink -f "$base/current")"
find "$base/releases" -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +$((KEEP_RELEASES + 1)) \
  | while read -r old; do [ "$old" = "$live" ] || rm -rf "$old"; done

log "live: $rel"
