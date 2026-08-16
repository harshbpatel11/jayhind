# Jayhind ERP

A multi-tenant, GST-compliant ERP platform for the Indian market, split into
a licensing/control-plane API (the "Master Hub") and a client-facing ERP API,
each with its own Angular frontend, plus a local invoice-OCR sidecar.

This repo (`jayhind`) is the orchestration layer: this setup guide and
operational runbooks (`_ops/`, `_staging/`). Application code lives in six
sub-repositories, tracked here as git submodules (each pinned to a specific
commit — see `.gitmodules`).

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
authenticate to each other with a shared key (`MASTER_API_KEY` /
`MASTER_PUBLIC_KEY`, see below).

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

### jayhind-admin-back (Master Hub API)

```bash
cd jayhind-admin-back
cp .env.example .env        # fill in DB_PASS, JWT_SECRET, etc. — see the
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
cp .env.example .env        # DB creds, JWT_SECRET, MASTER_URL (defaults to
                             # http://localhost:3100, matches the hub above)
npm install
npx sequelize db:migrate
npx sequelize db:seed:all
npm start                   # http://localhost:3000
```

The seeders provision a full demo company end-to-end (chart of accounts,
roles, tax slabs, HR reference data, one admin user —
`admin@yopmail.com` / `Admin@123`).

Set `UPLOAD_ROOT` in `.env` to a path on this machine, e.g.
`UPLOAD_ROOT=/Users/you/projects/jayhind/client-uploads` (the default in
`.env.example` is a server path and won't exist locally).

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

Each service runs in its own terminal (or tmux pane/window) with its own
`npm start`. There isn't a single command that starts all five — run the
ones you need for what you're working on. A typical full-stack session is
four terminals: `jayhind-admin-back`, `jayhind-client-back`,
`jayhind-admin-front`, `jayhindi-client-front` (skip the OCR sidecar unless
you need it).

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

## Further docs

- `_ops/` — nightly E2E runbook, systemd unit files, architecture decision
  records, review notes.
- `_staging/` — staging environment rollback runbook and refresh scripts.
- Each sub-repo's own `README.md` has project-specific detail.
