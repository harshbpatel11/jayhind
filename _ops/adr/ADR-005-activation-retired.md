# ADR-005 · Activation cryptography retired — the hub becomes an internal platform admin

**Status:** Decided, 2026-08-12 (SRS/review merge). Frozen 2026-08-13 (Phase 0.1).
**Plan reference:** `MASTER_DEVELOPMENT_PLAN.md` §12.5, §13.6, §8.3, roadmap row for Phase 6.

## Context

Today's Master Hub / Client ERP split assumes the child is an **untrusted
remote installation**: it polls `GET /api/v1/activation`, receives an
Ed25519-signed token (`ACTIVATION_PRIVATE_KEY` at the hub,
`MASTER_PUBLIC_KEY` at the child), honours a 7-day offline grace period, and
authenticates every tenant-plane call with a hashed `x-api-key`. This exists
because a real installation could, in principle, run on a customer's own
server, disconnected from the hub for days at a time.

Once the platform becomes one shared multi-tenant application (ADR-001), the
child process and the hub process are **both ours, on our own host,
co-located**. Cryptographically proving licensing to an untrusted remote peer
no longer describes the actual deployment shape.

## Decision

**Retire the activation cryptography.** The signed-token/offline-grace/
API-key-hash mechanism is replaced by direct, trusted internal
communication:

- One internal service credential replaces per-tenant `x-api-key` hashes.
- Licence delivery becomes a `SELECT`, not a polled Ed25519-signed token with
  a 7-day offline grace — module licensing is read live off the company row
  (§14, per-company module licensing).
- GSTIN binding becomes **stronger**, not weaker: the platform reads the
  company's own GSTIN directly rather than comparing a payload against a
  separately licensed value that could drift.
- `ActivationGuard` is deleted from the guard chain; `TenantContextGuard`
  (ADR-003, Layer 1) takes its exact position — one new guard, one position,
  where the existing chain already made room for it.
- `companies` (Phase 1) supersedes `tenants` at the platform, with the
  uniqueness direction inverted (Phase 6): the platform now looks companies
  up by identity, not the reverse.

## What this costs

- The entire cryptographic trust model (key generation, `npm run
  keys:generate`, 7-day offline grace, runtime API-key rotation via
  `master_activation_cache`) becomes dead code to remove, not evolve. This is
  real deletion work, not free.
- The `master-activation-cache` entity (classified `platform` in the Phase
  0.2 tenant-scope registry) is explicitly slated for retirement once this
  ADR's Phase 6 work lands — a marker that the registry's classification is
  itself provisional for that one table.
- Any future deployment shape that genuinely does put an untrusted remote
  installation on a customer's own infrastructure would need to reintroduce
  something like the mechanism being retired here — this ADR is a bet that
  the "one company, one server" model (§5.3's problems P1/P2/P4) is not coming
  back.

## What would reverse this decision

Reversing this would mean re-introducing the very thing this migration exists
to remove: per-installation, cryptographically self-proving deployments. That
would require:

1. Regenerating and distributing a real (not shared-dev) activation keypair
   per remote installation — exactly the pre-launch checklist item (§9,
   `CLAUDE.md`'s own item 2) this migration was going to make permanently
   moot.
2. Reintroducing `ActivationGuard` into the guard chain ahead of
   `TenantContextGuard`, and re-deriving licence state from a polled signed
   token instead of a live `SELECT` against the company row.
3. Rebuilding the offline-grace logic and its 7-day window, which only makes
   sense when the child cannot reach the hub for extended periods — a
   condition that does not exist once both processes are co-located and
   trusted.

This is only plausible if the platform's own deployment model changes back to
per-customer infrastructure (a reversal of the business decision behind the
whole migration, not just this ADR) — e.g. a single very large customer
insisting on running their own isolated instance. Even then, the more likely
design is a hybrid (that one company on `companies.shardKey`'s escape hatch,
ADR-001) rather than reviving the shared-installation activation model
wholesale.

## Consequence for every later phase

Phase 4 places `TenantContextGuard` exactly where `ActivationGuard` sat.
Phase 6 is where `companies` formally supersedes `tenants` and per-company
module licensing is read live with no restart — the direct successor to
today's "Company Configuration → Refresh" mechanism, minus the cryptography.
Any code written between now and Phase 6 that still assumes the
Ed25519/API-key model (e.g. new tenant-plane routes guarded by
`ApiKeyGuard`) should be written with this ADR in mind — it is being removed,
not hardened.
