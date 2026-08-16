# Nightly E2E runbook

MASTER_DEVELOPMENT_PLAN.md O1.6. Companion to `_staging/ROLLBACK-RUNBOOK.md`
(O1.3) — same directory-per-concern convention.

## What runs, and how

`_ops/nightly-e2e.sh`, triggered nightly at 02:00 by the
`jayhind-nightly-e2e.timer` systemd timer (`Persistent=true` — a missed run,
e.g. the box was rebooting, catches up instead of silently skipping a
night). Three passes:

1. **Provision** a fresh scratch clone of both dev databases
   (`jayhind_client_scratch_nightly`, `master_hub_scratch_nightly` —
   `mysqldump` of `jayhind_client`/`master_hub`, restored into the scratch
   names).
2. **Backend harnesses** — every `scripts/qa-*.ts` in both `jayhind-client-back`
   and `jayhind-admin-back` (globbed, so a newly added harness is picked up
   automatically), run against the scratch clone, never against the real dev
   database. One exclusion: `qa-whitebooks-live.ts` (real external GSP
   sandbox — see the script's own header, or `_ops/nightly-e2e.sh`'s
   `CLIENT_SKIP` array for the reasoning). Scratch DBs are dropped once this
   pass finishes.
3. **Playwright harnesses** — the 14 in `qa-artifacts/scripts/`, against the
   **live dev app** (they're self-cleaning: tagged fixtures via the real API,
   deleted in a `finally` — CLAUDE.md documents this per-harness).

## Checking results

- **Email**: a pass/fail summary is sent to the configured `SMTP_USER`
  (subject ✅ or ⚠️ *N* FAILED) via `_ops/send-nightly-summary.js`, reusing
  the Gmail SMTP relay wired up in O1.5 (`jayhind-client-back/.env`).
- **Logs, always** (email delivery is not the durable record):
  `_ops/nightly-logs/<timestamp>/` — `_summary.log` (the whole run's
  narrative), `results.txt` (machine-readable PASS/FAIL per harness), and one
  `<harness-name>.log` per harness with its full stdout/stderr.

## Running it by hand

```
bash _ops/nightly-e2e.sh
```

Same script the timer calls — safe to run any time; it never touches
`jayhind_client`/`master_hub` for the backend pass (scratch clone only) and
the Playwright pass is exactly what you'd run manually anyway.

## Adding a new harness

- **Backend** (`jayhind-client-back` or `jayhind-admin-back`,
  `scripts/qa-*.ts`): nothing to do — the glob picks it up on the next run.
  If it should NOT run unattended (e.g. it hits a real external service, the
  way `qa-whitebooks-live.ts` does), add it to `CLIENT_SKIP` (or the
  equivalent for admin-back, currently empty) with a one-line reason.
- **Playwright** (`qa-artifacts/scripts/qa-*.js`): add a
  `run_playwright_harness "script.js" "playwright/name"` line in
  `_ops/nightly-e2e.sh` — these are listed explicitly (not globbed) because
  some need per-harness invocation quirks (`qa-push-autoprompt.js` needs
  `xvfb-run -a`, per CLAUDE.md's own note on why headless/incognito silently
  fail the Push API).

## Why every backend harness runs against a scratch clone, not just the
## `--force` ones

The plan's own language splits harnesses into "safe against live DB" and
"the `--force` ones, against a scratch DB" — which requires trusting a
per-harness safety classification to be exactly right in an *unattended*
job. Get one wrong and a nightly run corrupts the one shared dev database.
Routing every backend harness through a scratch clone is strictly safer and
costs nothing: a harness already safe against live dev doesn't care which
database it's pointed at. Verified sound against the existing `--force`
guards too — e.g. `qa-approval-flow.ts` refuses only when
`DB_NAME_DEVELOPMENT === 'jayhind_client'` literally, so pointing it at the
scratch name satisfies the guard without even needing `--force` passed.
