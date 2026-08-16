#!/usr/bin/env bash
# MASTER_DEVELOPMENT_PLAN.md O1.3 — the ONE sanctioned way to migrate a
# staging database.
#
#   bash _staging/migrate-staging.sh <client-back|admin-back> <up|status|undo>
#
# This is the "gated pipeline step": it is the only place `.env.staging` is
# loaded and `sequelize db:migrate` is invoked against a *_staging database,
# so a migration cannot reach staging by a stray manual `db:migrate` in the
# wrong terminal (which would silently use whatever `.env` is default-loaded
# there). Prints the resulting schema in/out afterward so the verification —
# "the schema the new code expects is the schema that is there" — is part of
# running the gate, not a separate manual step someone can skip.
set -euo pipefail

REPO="${1:?usage: migrate-staging.sh <client-back|admin-back> <up|status|undo>}"
ACTION="${2:?usage: migrate-staging.sh <client-back|admin-back> <up|status|undo>}"

case "$REPO" in
  client-back) DIR=/home/ubuntu/projects/jayhind/jayhind-client-back; DB=jayhind_client_staging ;;
  admin-back)  DIR=/home/ubuntu/projects/jayhind/jayhind-admin-back;  DB=master_hub_staging ;;
  *) echo "Unknown repo '$REPO' — expected client-back or admin-back" >&2; exit 1 ;;
esac

ENV_FILE="$DIR/.env.staging"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — refusing to guess a target database." >&2
  exit 1
fi

echo "==> Gate: $REPO / $ACTION, target database: $DB"
echo "==> Schema BEFORE:"
mysql -u root -proot -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$DB' ORDER BY table_name;" 2>/dev/null | wc -l | xargs echo "   table count:"

cd "$DIR"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

case "$ACTION" in
  up)     npx sequelize db:migrate ;;
  status) npx sequelize db:migrate:status ;;
  undo)   npx sequelize db:migrate:undo ;;
  *) echo "Unknown action '$ACTION' — expected up, status or undo" >&2; exit 1 ;;
esac

echo "==> Schema AFTER:"
mysql -u root -proot -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$DB' ORDER BY table_name;" 2>/dev/null | wc -l | xargs echo "   table count:"
