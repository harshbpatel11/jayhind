# Jayhind ERP

A multi-tenant, GST-compliant ERP platform for the Indian market, split into
a licensing/control-plane API (the "Master Hub") and a client-facing ERP API,
each with its own Angular frontend, plus a local invoice-OCR sidecar.

This repo (`jayhind`) is the orchestration layer: the Docker Compose setup
that runs every service, this setup guide, and operational runbooks
(`_ops/`, `_staging/`). Application code lives in six sibling repositories,
cloned next to this one.

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

Everything (MySQL, Redis, both backends, both frontends, the OCR sidecar)
runs in Docker, orchestrated by Compose files in this repo. No CI/CD — this
is a manual build-and-run setup, on purpose, for now.

## Branch convention

Every repo (including this one) uses the same two long-lived branches:

- **`main`** — development
- **`production`** — production

Feature work targets `main`; deploys are cut from `production`.

## Architecture

One Docker Compose project, two ways to run it, same images and same
service graph either way:

```
docker-compose.yml            base: all core services (mysql, redis, both
                               backends, both frontends), internal network,
                               no host ports published
docker-compose.override.yml   auto-applied on a plain `docker compose ...`
                               (Mac / local dev): bind-mounts source for
                               hot-reload, publishes everything to localhost
docker-compose.server.yml     this server only: adds the OCR sidecar +
                               Portainer, publishes app ports to 127.0.0.1
                               at the exact ports nginx already expects
```

- **On a Mac**: `docker compose up` — Compose picks up
  `docker-compose.override.yml` automatically. Hot-reload works because your
  local source is bind-mounted into each container (`node_modules` stays
  inside the container via a named volume, so a Mac-built `node_modules`
  never leaks in and breaks native modules like `argon2`).
- **On this server**: `./docker.sh up` — a thin wrapper over
  `docker compose -f docker-compose.yml -f docker-compose.server.yml`, kept
  around so the muscle-memory CLI from the old `dev.sh` still mostly works.
  Containers here run the same images but with the *built* command (no
  bind-mounts, no watch-mode) — code changes require `./docker.sh build
  <service> && ./docker.sh up <service>`.
- **The OCR sidecar and Portainer are server-only.** OCR needs the ~5GB
  `jayhind-ocr-service/models/Qwen3-8B-Q4_K_M.gguf` file (bind-mounted, not
  baked into the image) which most Macs won't have; Portainer only makes
  sense where the thing it's managing lives.

nginx on this server proxies the four public domains
(`frontend.aakhaja.com`, `api.aakhaja.com`, `hub.aakhaja.com`,
`hubapi.aakhaja.com`) to `127.0.0.1:4300/3000/4500/3100` exactly as before —
those nginx configs did **not** need to change, only what's listening on
those ports did (Docker containers instead of systemd-managed processes).

### A deliberate note on the frontends

`admin-front` and `client-front` run inside Docker the same way they always
have in this "production" tier: via `ng serve` (Angular's dev server), not a
static `ng build` served by nginx. That's not a Docker limitation — it's
matching exactly what was already running, to keep the cutover to Docker as
low-risk as possible. Moving to a real production build (`ng build
--configuration production`, served by a small nginx/static container) is a
reasonable follow-up, but it's an application-level change with its own
review (and `jayhind-admin-front`'s `environment.prod.ts` currently points
`apiBaseUrl` at its own frontend domain rather than the API — worth fixing
whenever that switch happens).

### The backends, by contrast, run their real production build

`admin-back` and `client-back` run `node dist/src/main` (`NODE_ENV=production`)
inside Docker — an upgrade from the `nest start --watch` dev process that was
actually serving this traffic before. This is safe here (verified the
`NODE_ENV`-gated code paths and env vars before switching) and is a strict
improvement: a compiled build with no file-watcher, appropriate for a
container that's meant to just run.

## Server setup

Prerequisites already on this box: Docker Engine + Compose plugin.

```bash
cd ~/projects/jayhind
./docker.sh build          # build all images (first time: several minutes,
                            # the OCR image compiles llama-cpp-python from
                            # source — expect 10-20 min for that one alone)
./docker.sh up              # start everything, in the background
./docker.sh status          # what's running
./docker.sh logs client-back # tail one service's logs (Ctrl+C to stop)
./docker.sh down             # stop everything (containers + data kept)
./docker.sh restart admin-back
```

First run only — the database starts empty, so migrate and seed both apps:

```bash
docker compose exec admin-back npx sequelize db:migrate
docker compose exec admin-back npx sequelize db:seed:all
docker compose exec client-back npx sequelize db:migrate
docker compose exec client-back npx sequelize db:seed:all
```

Seeds a Master Hub super-admin (`admin` / `Admin@123` unless
`SEED_DEFAULT_PASSWORD` is set in `jayhind-admin-back/.env`) and a full demo
company in the client ERP (`admin@yopmail.com` / `Admin@123`, unless
overridden in `jayhind-client-back/.env`) — same as the old native setup.

Each app repo keeps its own `.env` (copy from `.env.example` if starting
fresh) — Compose loads it via `env_file:` and only overrides the handful of
values that need to point at Docker service names instead of `localhost`
(`DB_HOST=mysql`, `REDIS_HOST=redis`, etc. — see `docker-compose.yml` /
`docker-compose.server.yml`). You don't need to edit those by hand.

### Portainer

A browser UI for the Docker stack, at `https://portainer.aakhaja.com` once
set up:

```bash
# 1. Add a DNS A record: portainer.aakhaja.com -> 80.225.223.213
# 2. Once it resolves:
sudo cp _ops/nginx/portainer.aakhaja.com /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/portainer.aakhaja.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d portainer.aakhaja.com
```

First visit prompts you to create the admin account (nothing pre-seeded —
first person to open it wins, so do this promptly after DNS/TLS are live).

## Mac setup (local development)

Prerequisites: [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
mkdir -p ~/projects && cd ~/projects
git clone git@github.com:harshbpatel11/jayhind.git
cd jayhind

git clone git@github.com:harshbpatel11/jayhind-admin-back.git
git clone git@github.com:harshbpatel11/jayhind-client-back.git
git clone git@github.com:harshbpatel11/jayhind-admin-front.git
git clone git@github.com:harshbpatel11/jayhind-client-front.git jayhindi-client-front
git clone git@github.com:harshbpatel11/jayhind-ocr-service.git
git clone git@github.com:harshbpatel11/jayhind-qa-artifacts.git qa-artifacts
```

> The client frontend's directory is `jayhindi-client-front` (note the extra
> "i") — the compose files and other services' CORS config expect that exact
> name.

```bash
cp jayhind-admin-back/.env.example jayhind-admin-back/.env
cp jayhind-client-back/.env.example jayhind-client-back/.env
# fill in JWT_SECRET etc. in both — see the comments in each .env.example

docker compose up          # builds images on first run, then starts everything
```

- Master Hub API: http://localhost:3100
- Client ERP API: http://localhost:3000
- Hub admin console: http://localhost:4500
- Client ERP web app: http://localhost:4300
- MySQL: `localhost:3306` (root / see `MYSQL_ROOT_PASSWORD` in this repo's
  `.env`, defaults to `root`) — connect a GUI client here if you want to
  poke at the data directly
- Redis: `localhost:6379`

First run, same as the server: run the migrate/seed commands above (swap
`docker compose exec` for whatever's convenient — same commands work).

The OCR sidecar isn't part of the Mac stack by default (no model file, and
it's CPU/RAM-heavy — Qwen3-8B via llama.cpp). Backend features that call out
to it degrade gracefully without it. If you do want it locally: download the
model into `jayhind-ocr-service/models/` (see that repo's
`scripts/download_models.sh`) and run
`docker compose -f docker-compose.yml -f docker-compose.server.yml up ocr`
alongside the rest.

### qa-artifacts

Not containerized — it's a Playwright harness that drives the stack above
from outside:

```bash
cd qa-artifacts
npm install
# see scripts/ for individual harnesses; expects the stack above running
```

## Rolling back to native (if needed)

The old systemd units are still on disk (`_ops/systemd/*.service`, minus the
`-staging` ones which were never touched by this change) and MySQL/Redis
still run natively for the staging tier — nothing about native execution was
removed, just stopped for the four services that moved to Docker. To revert:
`./docker.sh down`, then `sudo systemctl start jayhind-admin-back
jayhind-client-back jayhind-admin-front jayhind-client-front jayhind-ocr`.
Note the Docker MySQL/Redis are separate data stores from the native ones —
anything written since the cutover only exists in the Docker volumes.

## Staging (untouched by this change)

A separate, native "staging" tier still runs via systemd on ports
3001/3101/4301/4501 (127.0.0.1-only, off the same native MySQL/Redis with
`_staging`-suffixed database names) — `_staging/` has its rollback runbook
and refresh scripts. It was intentionally left out of the Docker migration;
say the word if you'd like that moved into Docker too (as a second Compose
project, so it doesn't collide with the ports/volumes above).

## Further docs

- `_ops/` — nightly E2E runbook, systemd unit files (incl. the retired
  "dev" ones, kept for rollback), architecture decision records, review
  notes, and the Portainer nginx config.
- `_staging/` — staging environment rollback runbook and refresh scripts.
- Each sub-repo's own `README.md` has project-specific detail.
