# Jayhind ERP

A multi-tenant, GST-compliant ERP platform for the Indian market, split into
a licensing/control-plane API (the "Master Hub") and a client-facing ERP API,
each with its own Angular frontend, plus a local invoice-OCR sidecar.

This repo (`jayhind`) is the orchestration layer: the dev process manager
(`dev.sh`), this setup guide, and operational runbooks (`_ops/`, `_staging/`).
Application code lives in six sibling repositories, cloned next to this one.

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
authenticate to each other with a shared `INTERNAL_SERVICE_KEY`.

MySQL runs natively (no Docker anywhere in this stack).

## Branch convention

Every repo (including this one) uses the same two long-lived branches:

- **`main`** — development
- **`production`** — production

Feature work targets `main`; deploys are cut from `production`.

## Prerequisites

- Node.js ≥ 24
- Python 3.12 (for the OCR service)
- MySQL 8
- `git` and the [GitHub CLI](https://cli.github.com/) (`gh`), authenticated
  against an account with access to the repos above

## Getting the code

Clone this repo and all six sub-repos as **siblings** in one parent
directory — `dev.sh` and every project's own scripts assume this layout:

```bash
mkdir -p ~/projects && cd ~/projects
git clone git@github.com:harshbpatel11/jayhind.git .

git clone git@github.com:harshbpatel11/jayhind-admin-back.git
git clone git@github.com:harshbpatel11/jayhind-client-back.git
git clone git@github.com:harshbpatel11/jayhind-admin-front.git
git clone git@github.com:harshbpatel11/jayhind-client-front.git jayhindi-client-front
git clone git@github.com:harshbpatel11/jayhind-ocr-service.git
git clone git@github.com:harshbpatel11/jayhind-qa-artifacts.git qa-artifacts
```

> The client frontend's directory is `jayhindi-client-front` (note the extra
> "i") — `dev.sh` and the other services' CORS/proxy config expect that exact
> name.

Resulting layout:

```
projects/
├── dev.sh, README.md, _ops/, _staging/      (this repo)
├── jayhind-admin-back/
├── jayhind-client-back/
├── jayhind-admin-front/
├── jayhindi-client-front/
├── jayhind-ocr-service/
└── qa-artifacts/
```

## Per-project setup

### jayhind-admin-back (Master Hub API)

```bash
cd jayhind-admin-back
cp .env.example .env        # fill in DB creds, INTERNAL_SERVICE_KEY, JWT_SECRET, etc.
npm install
npx sequelize db:migrate
npx sequelize db:seed:all
npm start                   # http://localhost:3100
```

Seeds a super-admin login (`admin` / `Admin@123` unless `SEED_DEFAULT_PASSWORD`
is set) and the ~22.6k CBIC HSN/SAC master.

### jayhind-client-back (Client ERP API)

```bash
cd jayhind-client-back
cp .env.example .env        # DB creds, INTERNAL_SERVICE_KEY (must match the hub's), JWT_SECRET
npm install
npx sequelize db:migrate
npx sequelize db:seed:all
npm start                   # http://localhost:3000
```

The seeders provision a full demo company end-to-end (chart of accounts,
roles, tax slabs, HR reference data, one admin user —
`admin@yopmail.com` / `Admin@123`).

### jayhind-admin-front / jayhindi-client-front

```bash
cd jayhind-admin-front    # or jayhindi-client-front
npm install
npm start                 # 4500 / 4300 respectively
```

### jayhind-ocr-service

```bash
cd jayhind-ocr-service
./scripts/install.sh          # Python venv + dependencies
./scripts/download_models.sh  # fetches the Qwen3-8B GGUF; RapidOCR fetches its own on first use
./scripts/serve.sh            # http://127.0.0.1:8100 (loopback only — no auth of its own)
```

### qa-artifacts

```bash
cd qa-artifacts
npm install
# see scripts/ for individual harnesses; most expect the stack above running locally
```

## Running everything together: `dev.sh`

Once all six sibling repos are set up, this repo's `dev.sh` manages every
process:

```bash
./dev.sh start              # start all five app processes
./dev.sh start client-back  # or just one: admin-back | client-back | admin-front | client-front | ocr
./dev.sh status
./dev.sh logs client-back
./dev.sh stop
./dev.sh restart
./dev.sh shell               # a persistent tmux shell (git etc.), unrelated to process supervision
```

`dev.sh` is a thin wrapper over systemd unit files (see `_ops/systemd/`) — it
starts/stops/status/tails logs for the same five processes regardless of how
they're actually supervised on a given machine.

## Further docs

- `_ops/` — nightly E2E runbook, systemd unit files, architecture decision
  records, review notes.
- `_staging/` — staging environment rollback runbook and refresh scripts.
- Each sub-repo's own `README.md` has project-specific detail.
