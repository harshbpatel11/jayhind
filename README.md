# Jayhind ERP

A multi-tenant, GST-compliant ERP platform for the Indian market, split into
a licensing/control-plane API (the "Master Hub") and a client-facing ERP API,
each with its own Angular frontend, plus a local invoice-OCR sidecar.

This repo (`jayhind`) is the orchestration layer: this setup guide, `dev.sh`,
the cross-repo guards in `scripts/`, and the architectural map in
[`CLAUDE.md`](CLAUDE.md). Application code lives in six sub-repositories,
tracked here as git submodules (each pinned to a specific commit — see
`.gitmodules`).

## Projects

| Repo | What | Stack | Port | Database |
|---|---|---|---|---|
| [jayhind-admin-back](https://github.com/harshbpatel11/jayhind-admin-back) | Master Hub API — licensing, GSP gateway (e-Way Bill/e-Invoice), OCR proxy, HSN/SAC master, support desk | NestJS 11 + Sequelize 6 + MySQL | 3100 | `master_hub` |
| [jayhind-client-back](https://github.com/harshbpatel11/jayhind-client-back) | Client ERP API — accounting, inventory, HR, GST documents, invoice scanning, job work, file storage | NestJS 11 + Sequelize 6 + MySQL | 3000 | `jayhind_client` |
| [jayhind-admin-front](https://github.com/harshbpatel11/jayhind-admin-front) | Hub admin console | Angular 21 (standalone, zoneless, signals) + Material | 4500 | — |
| [jayhind-client-front](https://github.com/harshbpatel11/jayhind-client-front) | Client ERP web app | Angular 21 (standalone, zoneless, signals) + Material, PWA | 4300 | — |
| [jayhind-ocr-service](https://github.com/harshbpatel11/jayhind-ocr-service) | Invoice OCR + extraction sidecar, fully offline/local CPU | FastAPI + RapidOCR (ONNX) + Qwen3-8B (llama.cpp) | 8100 | — |
| [jayhind-qa-artifacts](https://github.com/harshbpatel11/jayhind-qa-artifacts) | End-to-end / UI QA harnesses and test fixtures | Node.js + Playwright | — | — |

The client backend is the only service that talks to the outside world (GST
portals, e-Way Bill/e-Invoice, the OCR sidecar) and it does so **through**
the Master Hub — it never calls a government API directly. The two backends
authenticate every internal call to each other — in **both** directions —
with one shared secret, `INTERNAL_SERVICE_KEY` (see below): it must be the
exact same value in `jayhind-admin-back/.env` and `jayhind-client-back/.env`,
or internal calls in either direction (including the hub's "Create company"
action) are refused.

Everything runs natively — no Docker anywhere in this stack. Each service is
started with its own `npm start` (or the OCR service's `serve.sh`) in its own
terminal.

## Branch convention

Every repo (including this one) uses the same two long-lived branches:

- **`main`** — development
- **`production`** — production

Feature work targets `main`; deploys are cut from `production`.

## Prerequisites

- Node.js ≥ 24
- Python 3.12 (for the OCR service — optional, see below)
- MySQL 8, running locally
- Redis (needed by `jayhind-client-back` for the audit/invoice-scan queues;
  the app degrades gracefully to in-process fallback if Redis isn't running)
- `git`, with an SSH key on this machine added to your GitHub account
  (Settings → SSH and GPG keys) — the six sub-repos are private, so plain
  HTTPS won't authenticate. Quickest check: `ssh -T git@github.com` should
  greet you by username; if it says `Permission denied (publickey)`,
  generate one first:

  ```bash
  ssh-keygen -t ed25519 -C "you@example.com"   # accept the default file location
  eval "$(ssh-agent -s)"
  ssh-add --apple-use-keychain ~/.ssh/id_ed25519
  pbcopy < ~/.ssh/id_ed25519.pub               # paste into GitHub → New SSH key
  ```

  (Alternative: skip SSH entirely — `gh auth login`, then use
  `https://github.com/...` clone URLs instead of the `git@github.com:...`
  one below.)

## Getting the code

The six sub-repos are git submodules of this one, so a single command gets
everything, already checked out at the exact commits this repo is pinned to:

```bash
mkdir -p ~/projects && cd ~/projects
git clone --recurse-submodules git@github.com:harshbpatel11/jayhind.git
cd jayhind
```

(Already cloned without `--recurse-submodules`? Run `git submodule update
--init` inside `jayhind/` instead of re-cloning.)

> The client frontend's directory is `jayhindi-client-front` (note the extra
> "i") — the other services' CORS config expects that exact name.
> `.gitmodules` already maps it to the right repo.

## Per-project setup

Start MySQL (and Redis, if you have it installed) before any of the backends
below — both `jayhind-admin-back` and `jayhind-client-back` connect to
`localhost` by default.

**Both backends need the same `INTERNAL_SERVICE_KEY`.** Generate it once,
before setting up either one, and paste the same value into both `.env`
files below:

```bash
openssl rand -hex 64
```

This is the shared secret the two servers use to authenticate every call
between them, in both directions — including the hub's "Create company"
action, which asks the ERP to provision the company rather than writing the
row itself. If it's missing, unset, or different between the two `.env`
files, every one of those calls fails closed with a clear error (never a
silent no-op) — on any environment, not just locally. See each repo's own
README for the full list of what runs over this credential.

### jayhind-admin-back (Master Hub API)

```bash
cd jayhind-admin-back
cp .env.example .env        # fill in DB_PASS, JWT_SECRET, INTERNAL_SERVICE_KEY
                             # (the value generated above), etc. — see the
                             # comments in .env.example for every value
npm install
npx sequelize db:migrate
npx sequelize db:seed:all
npm start                   # http://localhost:3100
```

Seeds a super-admin login (`admin` / `Admin@123` unless
`SEED_DEFAULT_PASSWORD` is set) and the ~22.6k CBIC HSN/SAC master.

### jayhind-client-back (Client ERP API)

```bash
cd jayhind-client-back
cp .env.example .env        # DB creds, JWT_SECRET, INTERNAL_SERVICE_KEY (the
                             # SAME value as jayhind-admin-back's above),
                             # MASTER_URL (defaults to http://localhost:3100,
                             # matches the hub above)
npm install
npx sequelize db:migrate
npx sequelize db:seed:all
npm start                   # http://localhost:3000
```

The seeders provision a full demo company end-to-end (chart of accounts,
roles, tax slabs, HR reference data, one admin user —
`admin@yopmail.com` / `Admin@123`).

`UPLOAD_ROOT` in `.env.example` defaults to a relative `uploads` folder
(created under this project's directory on first run) — override it with an
absolute path if you'd rather store uploads elsewhere.

On staging/production, where the two backends run on different hosts, also
set `jayhind-admin-back`'s `CLIENT_API_URL` to wherever `jayhind-client-back`
is actually reachable from that host (it defaults to `http://localhost:3000`,
which is only correct when both run on the same machine).

### jayhind-admin-front / jayhindi-client-front

```bash
cd jayhind-admin-front    # or jayhindi-client-front
npm install
npm start                 # 4500 / 4300 respectively
```

### jayhind-ocr-service (optional)

CPU/RAM-heavy (runs Qwen3-8B via llama.cpp) — the client backend's invoice
scanning degrades gracefully without it, so skip this unless you're working
on OCR specifically.

```bash
cd jayhind-ocr-service
cp .env.example .env
./scripts/install.sh          # Python venv + dependencies
./scripts/download_models.sh  # fetches the Qwen3-8B GGUF; RapidOCR fetches its own on first use
./scripts/serve.sh            # http://127.0.0.1:8100 (loopback only — no auth by default)
```

Point `jayhind-admin-back/.env`'s `OCR_SERVICE_URL` at
`http://127.0.0.1:8100` to use it.

### qa-artifacts

```bash
cd qa-artifacts
npm install
# see scripts/ for individual harnesses; expects the stack above running
```

## Running everything

`./dev.sh` starts every project that's already set up (`npm install` /
`.venv` present), with combined, color-prefixed live logs in one terminal —
Ctrl+C stops all of them cleanly. Works on macOS and Linux directly; on
Windows, run it from Git Bash or WSL.

```bash
./dev.sh                        # start everything set up so far, foreground
./dev.sh start admin-back client-back   # just the two backends
./dev.sh start -d                # same, but detached (background)
./dev.sh status                  # what's set up / running / listening
./dev.sh logs client-back        # tail one service's log
./dev.sh stop                    # stop everything dev.sh started
```

A typical full-stack session only needs `admin-back`, `client-back`,
`admin-front`, `client-front` — skip the OCR sidecar unless you're working
on OCR specifically (see below). Each project can still be run the old way
too — its own `npm start` (or the OCR service's `serve.sh`) in its own
terminal.

## Keeping submodules in sync

Each sub-repo is its own independent git repo — `cd` into one and commit/push
from there as usual. But this parent repo only stores a *pointer* (a pinned
commit) to each submodule, so after pushing a sub-repo change, also update
the pointer here:

```bash
cd jayhind-client-back && git push   # push the sub-repo's own change first
cd .. && git add jayhind-client-back && git commit -m "bump jayhind-client-back" && git push
```

To pull in everyone else's latest sub-repo commits (not just this repo's own
files): `git pull && git submodule update --init --recursive`.

## Cross-repo checks

Some constants are duplicated on purpose between `jayhind-client-back` (which
enforces them) and `jayhindi-client-front` (which mirrors them so the UI never
offers an action the server will refuse). Each sub-repo is an independent git
repo, so only this one can see both trees at once:

```bash
node scripts/check-mirrors.js     # exit 0 = in sync, 1 = drift, with details
```

Run it after touching module licences, permission keys, or voucher lifecycle
rules on either side.

## API docs

Both backends publish OpenAPI once running — Swagger UI at `/api/docs`, schema
JSON at `/api/docs-json` (ERP on :3000, hub on :3100). Generated from the
`class-validator` DTOs, so it cannot drift from what the API actually accepts.
On by default outside production; set `API_DOCS_ENABLED=true` to expose it on a
deployed environment.

## Further docs

- [`CLAUDE.md`](CLAUDE.md) — the architectural map: service topology, the
  request/guard pipeline, multi-tenancy, permissions, cross-service flows,
  coding and UI standards. **Read this before changing anything.**
- [`_ops/`](_ops/) — decision records, including the frozen status/`code`
  contracts between the services. See [`_ops/README.md`](_ops/README.md) for a
  note on which referenced planning documents are missing from this tree.
- Each sub-repo's own `README.md` has project-specific detail.
