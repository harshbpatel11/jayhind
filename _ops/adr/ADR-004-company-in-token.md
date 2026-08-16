# ADR-004 · The active company lives in the signed token, not a request header

**Status:** Decided, 2026-08-12 (SRS/review merge). Frozen 2026-08-13 (Phase 0.1).
**Plan reference:** `MASTER_DEVELOPMENT_PLAN.md` §8.2 (D-05).

## Context

Once one identity can belong to several companies, every request needs to
know which company it is acting within. Two shapes were available: a
client-supplied header (e.g. `X-Company-Id`) re-verified per request, or the
active company signed into the JWT at issue/switch time.

## Decision

**The active company is a claim inside the signed access token, verified once
at issue, never re-derived from anything the client sends.**

| | Header `X-Company-Id` | **In the token (chosen)** |
|---|---|---|
| Trust | Client-supplied; membership must be re-verified per request | Signed; verified once at issue |
| Cost | An extra query or cache read on every request | Zero |
| Attack surface | A guessable id in a header on every request | Forging requires the JWT secret |

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

- **Switching** is `POST /auth/switch-company { companyId }` → membership
  re-verified → a new access token minted with the new `companyId`/`roleId`.
- **The refresh token stays identity-scoped and carries the active company**,
  so a refresh cannot silently drop the user into a different one.
- **`membershipVersion`** lets a permission change take effect without
  waiting out the token TTL: the guard compares the token's value against the
  membership row and returns `409 MEMBERSHIP_STALE` on mismatch, which the
  client turns into a refresh.
- **Access-token TTL ≤15 minutes**, so a revoked membership cannot outlive it
  meaningfully.

## What this costs

- A membership change (role edit, suspension) does not take effect
  instantly — it takes effect on the next token refresh, bounded by the
  ≤15-minute TTL and the `membershipVersion` mismatch check. This is a
  deliberate, bounded staleness window, not an oversight.
- Every place in the codebase that reads "the current company" must read it
  from the verified token (via Layer 1 of ADR-003's `AsyncLocalStorage`
  context), never from a client-supplied value — a discipline that has to be
  maintained across the whole request-handling surface, not enforced by the
  type system alone.
- Switching companies requires a full token reissue round trip, not a cheap
  header swap — acceptable because company switching is an infrequent user
  action, not a per-request concern.

## What would reverse this decision

Moving to a client-supplied header (or any other per-request, unsigned
company selector) would require:

1. Re-verifying the membership on every single request instead of once at
   token issue — an extra query or cache read per request, which this ADR's
   own comparison table already priced out as the cost of the rejected
   option.
2. Re-auditing every guard and service that currently trusts
   `AsyncLocalStorage`'s `companyId` as pre-verified, since a header-sourced
   value cannot carry the same guarantee without that extra verification
   step.
3. Accepting a materially larger attack surface: a guessable id in a header,
   rather than a value that requires the JWT signing secret to forge.

No new information currently on the table would justify this reversal; it
would only make sense if the ≤15-minute staleness window on membership
changes turned out to be unacceptable for some future requirement (e.g. an
instant-suspension SLA), in which case the fix is more likely a
shorter-TTL/push-invalidation addition on top of this design, not abandoning
signed-token trust.

## Consequence for every later phase

Phase 4 (auth, company switching, permissions) is where `switch-company`,
`membershipVersion` comparison and the guard chain ordering
(`ThrottlerGuard → TenantContextGuard → AuthGuard → RolesGuard → RoleMenuGuard
→ ModuleLicenceGuard`) are actually built. Every guard and service written
from Phase 1 onward must treat the token's `companyId` as the single source
of truth for "which company is this request acting within" — never a route
param, query string or request body field, which would reopen exactly the
trust gap this ADR chose to close.
