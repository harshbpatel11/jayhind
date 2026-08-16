# Staging migration & rollback runbook

MASTER_DEVELOPMENT_PLAN.md O1.3. This is the gated procedure for getting a
schema change to staging and, if needed, reversing it — and the record of
the one rollback actually performed (O1.3's own exit criterion).

## What exists

- **Staging databases**: `jayhind_client_staging`, `master_hub_staging` —
  scrubbed copies of the real dev DBs (`_staging/refresh-staging-data.sh`,
  re-run any time staging should catch up to dev's current data).
- **Staging app processes**, systemd-supervised, localhost-only (no nginx
  vhost, no public DNS; UFW default-denies everything except 22/80/443
  regardless):

  | Service | Port | Unit file |
  |---|---|---|
  | client-back (staging) | 3001 | `jayhind-client-back-staging.service` |
  | client-front (staging) | 4301 | `jayhind-client-front-staging.service` |
  | admin-back (staging) | 3101 | `jayhind-admin-back-staging.service` |
  | admin-front (staging) | 4501 | `jayhind-admin-front-staging.service` |

  `sudo systemctl {status,restart,stop} <unit>`. Unit files live in
  `_ops/systemd/` (copy of what's installed in `/etc/systemd/system/` —
  keep the two in sync if you edit one; the same directory also holds the
  five PRIMARY (non "-staging") dev units — see workspace CLAUDE.md's "Dev
  workflow" note and `dev.sh`, O1.4).
- **The gate**: `_staging/migrate-staging.sh <client-back|admin-back> <up|status|undo>`
  — the only sanctioned way to run a migration against a `*_staging`
  database. It loads that repo's `.env.staging` explicitly (never the
  default `.env`), so a migration cannot land on staging by a stray manual
  `db:migrate` run in the wrong terminal. Prints the schema table-count
  before and after every run.

## Procedure: shipping a schema change through staging

1. Write the migration in the app repo as usual.
2. `bash _staging/migrate-staging.sh <repo> up` — runs it against the
   scrubbed staging DB, not dev, not anything real.
3. Verify: check the column/table exists as expected
   (`DESCRIBE <staging_db>.<table>`), and that the staging app process is
   still healthy (`curl http://localhost:3001/...` or open
   `http://localhost:4301` from this box).
4. If something is wrong, roll it back (§ below) — you find out here, not
   after a real deploy exists.
5. Only once staging is verified does the same change go into the real dev
   DB / the app's baseline (current policy — CLAUDE.md §7 — is "edit the
   baseline directly, migrate a scratch DB to verify"; staging is an
   *additional* check before that, not a replacement for it while nothing is
   deployed anywhere for real).

## Procedure: rolling back

```
bash _staging/migrate-staging.sh <repo> undo
```

Reverses the most recent migration recorded in that database's
`SequelizeMeta`. Verify the column/table is actually gone afterward — don't
trust the exit code alone (§7's own lesson: `SequelizeMeta` records a
filename, not a guarantee the `down()` did what you think).

## The rehearsal actually performed (2026-08-12, O1.3)

Real, dated migration `20260812170000-o1-3-rollback-rehearsal.ts` (deleted
after — see its own header for why: it's the deliberate one-time exception to
the "no dated migrations" policy while nothing is deployed) added a
nullable `o13RollbackRehearsalProbe VARCHAR(50)` column to
`jayhind_client_staging.site_configurations`:

1. `migrate-staging.sh client-back up` — migrated cleanly (0.087s). Column
   confirmed present via `DESCRIBE`.
2. **Confirmed the real dev database (`jayhind_client`) was NOT touched** —
   the whole point of the gate. `DESCRIBE jayhind_client.site_configurations`
   showed no such column.
3. Staging backend (port 3001) confirmed still answering real requests
   correctly mid-rehearsal (a validation 400 on `/auth/login` with an empty
   body — i.e. actually running application code, not just "the process
   didn't crash").
4. `migrate-staging.sh client-back undo` — reverted cleanly (0.125s).
5. **Verified reverted**: column absent from `DESCRIBE`, and the migration's
   own row absent from `SequelizeMeta` — the undo didn't just run, it left
   the metadata in the state a fresh `db:migrate` would expect.

Nothing about this touched `jayhind_client` (the real dev database) at any
point — confirmed before and after.

## Known gap, honestly stated

The plan's language ("migrations run in a gated **pipeline** step") most
naturally reads as a CI-triggered gate. That isn't what this is: GitHub-hosted
Actions runners are ephemeral cloud VMs with no route to this box's MySQL, so
a *real* CI-driven staging gate needs a **self-hosted runner on this box** —
which the operator explicitly declined to set up yet when scoping O1.1's CI
(chose GitHub-hosted-only over "GitHub-hosted + self-hosted", precisely to
defer that decision). What's built here instead is a **scripted, verified,
single-entry-point gate** run by hand from this box — meaningfully better
than an ungated `db:migrate` (wrong-database mistakes are what it prevents),
but not yet "a commit triggers it automatically." Upgrading this to a real CI
trigger is O1.6-adjacent (that sub-phase already needs a self-hosted runner
for the nightly E2E harnesses) — wire the same runner to a
`workflow_dispatch` (or a `staging` branch push) job that calls this same
script, at that point, rather than standing up a second self-hosted runner
just for this.
