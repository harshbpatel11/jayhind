#!/usr/bin/env bash
# MASTER_DEVELOPMENT_PLAN.md O1.6 — nightly E2E: all backend QA harnesses
# against a disposable scratch clone of dev, then all Playwright UI harnesses
# against the live dev app. Triggered by the jayhind-nightly-e2e.timer
# systemd unit (see _ops/systemd/); can also be run by hand:
#
#   bash _ops/nightly-e2e.sh
#
# Design: EVERY backend harness (not just the ones with an explicit `--force`
# guard) runs against a scratch clone, never against the real jayhind_client/
# master_hub. This is a stricter bar than "the safe ones run against live dev,
# the --force ones need a clone" — the ones already documented as safe don't
# care which database they're pointed at, and it removes the need to trust a
# per-harness safety classification getting it exactly right in an unattended
# job. See CLAUDE.md §9 point 9 for why this class of mistake matters here.
set -uo pipefail

ROOT=/home/ubuntu/projects/jayhind
CLIENT_BACK="$ROOT/jayhind-client-back"
ADMIN_BACK="$ROOT/jayhind-admin-back"
QA_ARTIFACTS="$ROOT/qa-artifacts"
DATE_TAG=$(date +%Y-%m-%d_%H%M%S)
RUN_DIR="$ROOT/_ops/nightly-logs/$DATE_TAG"
mkdir -p "$RUN_DIR"

SCRATCH_CLIENT_DB=jayhind_client_scratch_nightly
SCRATCH_HUB_DB=master_hub_scratch_nightly
MYSQL_USER=root
MYSQL_PASS=root

PASS_COUNT=0
FAIL_COUNT=0
declare -a RESULTS=()   # "PASS name" / "FAIL name"

mysql_x() { command mysql -u "$MYSQL_USER" -p"$MYSQL_PASS" "$@" 2>/dev/null; }
mysqldump_x() { command mysqldump -u "$MYSQL_USER" -p"$MYSQL_PASS" "$@" 2>/dev/null; }

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$RUN_DIR/_summary.log"; }

# ── Deliberate exclusions from the automated nightly run, with reasons ──────
# qa-whitebooks-live.ts goes over the wire to the real WhiteBooks GSP sandbox
# (apisandbox.whitebooks.in) — an unattended nightly run should not depend on
# an external service's uptime/rate limits to decide whether OUR code is
# correct, and a failure there is not actionable at 2am the way a code defect
# is. Run it manually when actually verifying the GSP integration.
#
# qa-isolation.ts is deliberately absent from THIS list — see step 5a below,
# not skipped, run against the live dev DB instead of the scratch clone.
CLIENT_SKIP=("qa-whitebooks-live.ts" "qa-isolation.ts")

# NOT skipped, but expected to show RED for a while, deliberately — worth
# knowing before assuming a `qa-volume` failure in the nightly summary is a
# fresh regression. Qb.5 (MASTER_DEVELOPMENT_PLAN.md §20.6) made its report/
# list latency assertions BINDING against NFR-022 at C-2's target scale
# (250k `trx` rows) for the first time; at that volume this codebase's
# current, un-indexed queries genuinely do not meet the ≤500ms list /
# ≤3000ms aggregate budget (measured 2026-08-13: up to ~13s on some report
# endpoints). That is the intended, honest result of finally measuring, not
# a bug in the harness — R18's own ordering rule is dataset → binding
# thresholds → EXPLAIN (Qc.3) → tune, and Phase 3's index strategy is what
# actually closes this. Left running (not skipped) specifically so the
# nightly baseline number is always current the day someone starts that
# work, and so a REGRESSION on top of the already-known gap is still caught.

run_backend_harness() {
    local repo_dir="$1" script="$2" db_name="$3" name="$4"
    local log_file="$RUN_DIR/${name//\//_}.log"
    if (cd "$repo_dir" && DB_NAME_DEVELOPMENT="$db_name" \
        npx ts-node -r tsconfig-paths/register "scripts/$script") \
       > "$log_file" 2>&1
    then
        RESULTS+=("PASS $name"); PASS_COUNT=$((PASS_COUNT+1))
    else
        RESULTS+=("FAIL $name"); FAIL_COUNT=$((FAIL_COUNT+1))
        log "  FAIL: $name (see $log_file)"
    fi
}

run_playwright_harness() {
    local script="$1" name="$2" prefix="${3:-}"
    local log_file="$RUN_DIR/${name//\//_}.log"
    if (cd "$QA_ARTIFACTS" && eval "$prefix node scripts/$script") > "$log_file" 2>&1
    then
        RESULTS+=("PASS $name"); PASS_COUNT=$((PASS_COUNT+1))
    else
        RESULTS+=("FAIL $name"); FAIL_COUNT=$((FAIL_COUNT+1))
        log "  FAIL: $name (see $log_file)"
    fi
}

log "=== O1.6 nightly E2E run starting: $DATE_TAG ==="

# ── 1. Provision scratch databases from a fresh dump of dev ─────────────────
log "Provisioning scratch databases from dev…"
mysql_x -e "DROP DATABASE IF EXISTS $SCRATCH_CLIENT_DB; CREATE DATABASE $SCRATCH_CLIENT_DB CHARACTER SET utf8mb4;"
mysql_x -e "DROP DATABASE IF EXISTS $SCRATCH_HUB_DB; CREATE DATABASE $SCRATCH_HUB_DB CHARACTER SET utf8mb4;"
mysqldump_x --routines --triggers jayhind_client | mysql_x "$SCRATCH_CLIENT_DB"
mysqldump_x --routines --triggers master_hub | mysql_x "$SCRATCH_HUB_DB"
log "Scratch databases ready: $SCRATCH_CLIENT_DB, $SCRATCH_HUB_DB"

# ── 2. client-back harnesses, against the scratch client DB ────────────────
log "Running client-back harnesses (scratch DB)…"
for script_path in "$CLIENT_BACK"/scripts/qa-*.ts; do
    script=$(basename "$script_path")
    skip=false
    for s in "${CLIENT_SKIP[@]}"; do [[ "$script" == "$s" ]] && skip=true; done
    if $skip; then
        log "  SKIP: $script (excluded — see CLIENT_SKIP)"
        continue
    fi
    name="client-back/$script"
    log "  running $name"
    run_backend_harness "$CLIENT_BACK" "$script" "$SCRATCH_CLIENT_DB" "$name"
done

# ── 3. admin-back harnesses, against the scratch hub DB ─────────────────────
log "Running admin-back harnesses (scratch DB)…"
for script_path in "$ADMIN_BACK"/scripts/qa-*.ts; do
    script=$(basename "$script_path")
    name="admin-back/$script"
    log "  running $name"
    run_backend_harness "$ADMIN_BACK" "$script" "$SCRATCH_HUB_DB" "$name"
done

# ── 4. Teardown scratch databases — done with them before the (slower)
#      Playwright pass, so a scratch DB never lingers longer than it must ────
log "Tearing down scratch databases…"
mysql_x -e "DROP DATABASE IF EXISTS $SCRATCH_CLIENT_DB;"
mysql_x -e "DROP DATABASE IF EXISTS $SCRATCH_HUB_DB;"

# ── 5a. qa-isolation.ts (MASTER_DEVELOPMENT_PLAN.md §20.9, Phase 2's own
#      isolation suite) — the ONE backend harness that runs against the LIVE
#      jayhind_client, not a scratch clone, and so has to run in this section
#      rather than step 2 above. It is HTTP-driven against the RUNNING
#      client-back on purpose — the point is proving the real guard chain +
#      Sequelize hooks, not a mocked approximation — which means step 2's own
#      `DB_NAME_DEVELOPMENT=$SCRATCH_CLIENT_DB` pattern cannot reach it: that
#      would redirect only the harness's own fixture-setup connection, never
#      the already-running systemd service answering the HTTP calls, so
#      Company B would exist in the scratch clone and be invisible to the
#      server that logs it in (the harness detects exactly this mismatch
#      itself and exits 0 rather than fail confusingly). Passing the literal
#      `jayhind_client` name below is what the harness already requires by
#      default — safe here for the same reason every OTHER harness in this
#      file is safe against live data: tagged fixtures (`IS-Test-<ts>`),
#      created and torn down via the real API/its own `finally`, verified
#      manually across many consecutive runs before this was wired in.
log "Running qa-isolation.ts (live dev DB, not scratch — see comment above)…"
run_backend_harness "$CLIENT_BACK" "qa-isolation.ts" "jayhind_client" "client-back/qa-isolation.ts (live DB)"

# ── 5. Playwright harnesses, against the LIVE dev app ────────────────────────
# Documented throughout CLAUDE.md as safe against the live database (tagged
# fixtures created via the real API, deleted in a `finally`) — run as-is,
# exactly how they're already run by hand. qa-push-autoprompt.js additionally
# needs headed Chrome + a persistent profile + xvfb (CLAUDE.md's own note —
# headless/incognito silently fail the Push API, not a real defect).
log "Running Playwright harnesses (live dev app)…"
run_playwright_harness "qa-chat-notifications.js"  "playwright/qa-chat-notifications"
run_playwright_harness "qa-chat-ui.js"              "playwright/qa-chat-ui"
run_playwright_harness "qa-hsn-admin-ui.js"         "playwright/qa-hsn-admin-ui"
run_playwright_harness "qa-job-work-ui.js"          "playwright/qa-job-work-ui"
run_playwright_harness "qa-module-licence-ui.js"    "playwright/qa-module-licence-ui"
run_playwright_harness "qa-paginated-selects.js"    "playwright/qa-paginated-selects"
run_playwright_harness "qa-party-statement-ui.js"   "playwright/qa-party-statement-ui"
run_playwright_harness "qa-push-autoprompt.js"      "playwright/qa-push-autoprompt" "xvfb-run -a"
# Qa.3 (MASTER_DEVELOPMENT_PLAN.md §20.3) — the permanent regression net for
# Qa.1's shared data-grid card mode: 33 list screens x 3 widths x 2 themes
# diffed against committed baselines (qa-artifacts/scripts/_shots/qa3-baselines/).
# job-work-board/job-work-challans are pixel-diffed too but never failed on
# content alone — confirmed live shop-floor data other processes on this box
# genuinely change minute to minute, not a rendering flake.
run_playwright_harness "qa-qa3-responsive-regression.js" "playwright/qa-qa3-responsive-regression"
run_playwright_harness "qa-socket-lifecycle.js"     "playwright/qa-socket-lifecycle"
run_playwright_harness "qa-stock-conversion-ui.js"  "playwright/qa-stock-conversion-ui"
run_playwright_harness "qa-trx-ocr.js"              "playwright/qa-trx-ocr"
run_playwright_harness "qa-trx-prq-po-grn.js"       "playwright/qa-trx-prq-po-grn"
run_playwright_harness "qa-trx-purchase.js"         "playwright/qa-trx-purchase"
run_playwright_harness "qa-trx-sales.js"            "playwright/qa-trx-sales"

TOTAL=$((PASS_COUNT+FAIL_COUNT))
log "=== Nightly E2E run complete: $PASS_COUNT/$TOTAL passed, $FAIL_COUNT failed ==="

# ── 6. Write a machine-readable summary + email it ───────────────────────────
{
    echo "O1.6 nightly E2E — $DATE_TAG"
    echo "$PASS_COUNT/$TOTAL passed, $FAIL_COUNT failed"
    echo ""
    for r in "${RESULTS[@]}"; do echo "$r"; done
} > "$RUN_DIR/results.txt"

node "$ROOT/_ops/send-nightly-summary.js" "$RUN_DIR/results.txt" "$DATE_TAG" "$PASS_COUNT" "$FAIL_COUNT" "$TOTAL" 2>&1 | tee -a "$RUN_DIR/_summary.log"

exit 0
