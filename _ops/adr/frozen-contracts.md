# Frozen contracts — JWT payload & HTTP error codes

**Frozen:** 2026-08-13 (Phase 0.1, `MASTER_DEVELOPMENT_PLAN.md` §20.7).
**Authoritative source:** `MASTER_DEVELOPMENT_PLAN.md` §8.2 and §12.3. This
file is a pinned copy so a shape change is visibly a decision (a diff against
this file), not a silent drift between what the plan says and what Phase 1–4
actually build.

**Rule:** changing either shape below requires a new ADR that supersedes
ADR-004 (for the JWT) or explicitly amends this file (for an error code),
updated in the same piece of work as the code change (per this document's own
§0.2 update discipline) — never a silent edit to match code that has already
drifted.

---

## JWT payload (`JwtUser`)

Decided in ADR-004 (D-05 — the active company lives in the signed token, not
a request header).

```ts
interface JwtUser {
  sub: number;               // identity id
  id: number;                // identity id (kept — 60+ call sites read user.id)
  email: string;
  companyId: number;         // the active company
  membershipId: number;
  role: number;               // role within THIS company
  roleName: string;
  userKind: 'staff' | 'party' | 'system';   // within THIS company
  membershipVersion: number; // bumped on any role/permission change
  exp: number; iat: number;
}
```

Notes that are part of the frozen contract, not incidental:

- `id` is kept alongside `sub` (both the identity id) specifically because
  60+ existing call sites already read `user.id` — this is a deliberate
  backward-compatible redundancy, not an oversight to be cleaned up.
- `role`/`roleName`/`userKind` are **per-membership**, i.e. scoped to the
  active company — they change on `switch-company`, they are not a property
  of the identity.
- `membershipVersion` exists solely to let a permission change take effect
  without waiting out the access-token TTL (see the `409 MEMBERSHIP_STALE`
  contract below).
- Access-token TTL is ≤15 minutes (§8.2).

---

## HTTP error contract

Decided across §7.3 (D-03), §8 and §12.3.

| Status | Code | Meaning |
|---|---|---|
| 403 | `COMPANY_SUSPENDED` | The active company is suspended |
| 403 | `NO_MEMBERSHIP` | Authenticated identity has no live membership here |
| 403 | `FEATURE_DISABLED` | Module not licensed for this company (existing code, retained) |
| 409 | `MEMBERSHIP_STALE` | `membershipVersion` mismatch → client refreshes its token |
| 402 | `SUBSCRIPTION_PAST_DUE` | Read-only grace state (§9.4) |
| 404 | — | **Foreign-company resource — never 403** (NFR-005): an existence oracle is itself a leak |

The `404`, not `403`, rule for foreign-company resources is load-bearing and
frozen along with the rest of this table: it is what stops an authenticated
user from being able to distinguish "this id belongs to another company" from
"this id does not exist", which would otherwise let them enumerate the
existence of another company's records one guess at a time.

---

## How to change either contract

1. Write a new ADR (JWT payload) or a dated addendum section below this line
   (error codes) — never edit the tables above in place.
2. Update `MASTER_DEVELOPMENT_PLAN.md` §8.2/§12.3 in the same piece of work
   (per §0.2's update discipline — a stale plan is worse than none).
3. Update this file's own copy to match, in the same commit.

No amendments recorded yet as of the freeze date above.
