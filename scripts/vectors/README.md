# Behavioural vectors — closing §13.4

`CLAUDE.md` §13's still-open list, item 4:

> **`voucher-lifecycle` parity is checked by name, not behaviour — and it has now
> cost a bug.** `scripts/check-mirrors.js` verifies both sides export the same
> decision functions, but the two signatures differ by design
> (`(VoucherLifecycleState) => ActionVerdict` vs
> `(VoucherLifecycleRow, VoucherTypeFlags) => boolean`), so semantic drift
> between the rules is still possible. **The real fix is a shared JSON table of
> test vectors both repos' suites run against.**

This directory is that table. `voucher-lifecycle.vectors.json` states one
situation per row — the facts about a voucher, and what the rules say may be
done to it — and `check-mirrors.js` runs **both implementations** against every
row and compares all three answers: the backend's, the frontend's, and the
table's.

## Why the table lives here and not in either repo

The gap says *"both repos' suites run against"*, and the honest reading of that
is one table, not two. Two copies of a vector file in two independent git repos
is the same mirror problem one level up — and this project has now seen a mirror
rule lapse without anyone noticing twice (§13.4's own bug, and 9B-1's
`FileCategory` enums, which stopped being a contract on 2026-08-15 while both
sides' doc comments went on claiming they were).

This repo is the only place that sees both submodules at once. So the vectors
live here, and the runner that spends them lives here, and there is exactly one
of each.

## What a vector is

```jsonc
{
  "id": "V-010",
  "why": "BUG-0024 — deletion switched off must block stage TWO as well…",
  "given": {
    "status": "draft",         // draft | pending | approved | cancelled | rejected
    "everPosted": false,       // did it ever reach Approved (approvedAt != null)
    "isArchived": true,        // soft-deleted, sitting in View Archived
    "activeReferences": 0,     // how many live documents point at it (0 or 2)
    "allowCancel": null,       // the type's flag; null = not configured
    "allowDelete": false
  },
  "expect": { "cancel": false, "archive": false, "erase": false }
}
```

`actions` is the **exhaustive cross-product** of those six facts — 5 statuses ×
`everPosted` × `isArchived` × references × the two type switches = **160 rows**,
plus 7 `recall` rows for the maker/submitter rule. Exhaustive on purpose, for two
reasons: no branch can be missing, and **no two rows can duplicate each other's
inputs**, which a hand-curated table silently did (four pairs of it, before this
was generated).

`why` carries prose on the rows that pin something notable — BUG-0024's cases, the
asymmetries — and a derived label on the rest, so a failure names what it was
about.

`expect` is the **restated rule**: written from the doc comments and §4.9's two
lifecycle rules, not read off either implementation. That is the same discipline
every `*-rules.ts` module in `qa-artifacts` follows, and it is what makes the
table able to disagree with the code instead of agreeing with it by construction.
The restatement is one small predicate per action, evaluated over every row — so
it is one rule to review, not 160 answers.

Which means a failure has three distinguishable shapes, and the runner says
which one it is:

| Shape | Meaning |
|---|---|
| backend ≠ frontend | **drift** — the thing §13.4 is about |
| both ≠ table | the rule changed and the table was not updated (or the change is wrong) |
| one ≠ table, and they also differ | a one-sided change; the table names which side moved |

## Adding a rule

Add the vectors **first**, in the same commit as the rule. A branch with no
vector is a branch nobody compares — which is the state §13.4 describes.

If the new rule turns on a **seventh fact**, the cross-product has to grow with
it, or every existing row silently fixes that fact at one value and the table
stops being exhaustive while still looking it. `check-mirrors.js` also names any
`can*` decision function it finds no vectors for, which is the same question one
level up.
