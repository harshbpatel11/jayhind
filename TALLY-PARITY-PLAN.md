# Jayhind ERP — Transaction module Tally parity plan

*A ledger-first rebuild of the accounting core. Primarily `jayhind-client-back`
(schema, posting engine, reports) and `jayhindi-client-front` (chart of accounts,
voucher entry, report drill-down), with `qa-artifacts` carrying the parity gate.*

> **Reference artifact:** "Tally Parity Programme" —
> **https://claude.ai/code/artifact/0f6e7461-3371-4d03-8f65-940d5650c8db**
> Same content as this file, laid out for reading. This file is the working copy
> and the one that gets edited as phases land; the artifact is re-published from
> it when a phase closes.
>
> **Scope was set by four decisions (2026-08-28), all taken at the maximal
> option** — see [§0](#0-scope-decisions). Every section below is written to
> those four answers.
>
> **Rollout shape:** one phase per hand-over. Each phase is finished, migrated,
> parity-checked against the harness and committed on its own before the next
> starts. P0–P4 is the coherent shippable unit; nothing after P4 blocks anything
> before it.

## Progress

**P0, P1 and P2a are done (2026-08-28).** The parity harness exists and has been
shown to **fail** on the exact defect P2 risks; the group tree exists, is seeded
in all 14 companies, and its own gate holds at 126/126. The **ledger layer now
exists too** — 1,351 ledgers across the 14 companies — and D5's resolution has
been run over all 41,690 journal lines as a **dry run**, with zero unresolvable.
Nothing in the accounting core has been touched: `trx_groups` is untouched,
every journal line still points at it, and the parity diff is still empty.

**P2b‑1 is done too: `journal_lines.ledgerId` exists, is backfilled on all
41,690 lines, is `NOT NULL` behind a foreign key, and is maintained by the
posting engine.**

**And P2b‑2 is done: the reports read it.** Every figure-bearing statement now
resolves through `ledgerId`, and the declared exception has appeared —
**76,445 moved paths across seven report families, every one of them declared,
nothing else.** `trxGroupId` survives as a shadow for two labels and a handful
of unaffected reads until D9.

**P2b‑3 split into three, on the same argument the two splits before it used**
(see [§P2b‑3a record](#p2b-3a-record--2026-08-28)), and **P2b‑3a is done: the
VOUCHER names a ledger too.** All four of D6's holders — `trx.groupId`,
`trx_charges.groupId`, `trx_payment_receipts.trxGroupId` and a journal line's
`trxGroupId` — carry a `ledgerId` beside them, backfilled on **11,856** rows,
and the posting engine now posts to the ledger *the document says* rather than
re-deriving one. The parity diff is **empty** across the change. **P2b‑3b is
done** as well — 18 routes over `acc_groups`/`acc_ledgers`, and the statutory
legs now ask `acc_ledgers.systemKey` directly instead of walking D2's
correspondence.

**And P2b‑3c is done, which closes P2: the import keeps the customer's chart of
accounts instead of flattening it** (F15). The source's own Groups become
`acc_groups` rows under their source parents, and a head the import creates gets
its ledger **where the source filed it** rather than from
`fallbackGroupForNature` at first posting. Measured on the real Tally backup in
`qa-artifacts/fixtures/tally`: **60 of its 230 ledgers land somewhere new**, among
them 15 Fixed Assets and 17 Duties & Taxes that were being reported as current
assets and current liabilities. Building the gate also found a live defect —
both callers of the placement fallback read `trx_natures.name` where the rule
switches on `AccountNature`, so **all 33 fallback-placed ledgers on the
development database were in Suspense A/c** — fixed and repaired. The parity diff
is **empty** across the whole phase.

**P3 split into four**, on the same argument as the three splits before it.
**P3a is done: the two reports §3.10 calls *new* exist.** The **Ledger report**
(*"open the ledger"* — one account, a row per month, each month expanding to its
vouchers) and the **Group Summary** (a group's children with closing balances,
the intermediate step of every drill-down). Both read `acc_ledgers`/`acc_groups`
**directly**, with no presentation layer in the path, so they are the new
mechanism's own answer from their first render — and the gate ties that answer
back to the Trial Balance a customer is reading today, head by head.

**And P3b is done: the STATEMENTS are the tree.** The Trial Balance, the Balance
Sheet and the Profit & Loss read `acc_groups` with `acc_ledgers` leaves,
collapsed by default and expanding through the Group Summary; the Day Book's
line label and the books' `particulars` crossed over to the ledger on 13,471 of
41,690 lines. The flat statements did not go anywhere — they are computed
unchanged as `legacy*` and are what the harness captures — so **the parity diff
is empty** and the tree is tied to them head by head by `qa:p3b-statements`
(309/309). Two figures move on a customer's sheet, both declared: the four GST
input heads become liabilities (₹1,54,85,553.06), and **a loss moves to the
Assets side**, which is Tally's own placement.

**And P3c‑1 is done: the presentation layer is gone.** `ledger-presentation
.const.ts` is deleted, and with it the three `legacy*` statements, `?view=legacy`,
the Trial Balance's `natureShift` annotation and the parity harness's exception
generator. The last three product callers moved onto `acc_groups`, the Group Book
took the tree's id space, the Financial Dashboard's two panels stopped describing
the flat chart, and `qa-artifacts/tests/reports/` was ported to the tree — which
found that its party-facing oracles had been asking the legacy question all
along, and took the suite from **25 failures to 8** against a measured baseline.
No report renders `trx_groups` any more.

**And P3c‑2 is done: a ledger can be created.** `POST /acc-ledgers`, with
`describeLedgerPlacementBlock` at the seam — which refuses exactly two
placements, the two party control groups (a ledger with no party under Sundry
Debtors is a balance no receivables report can attribute to anybody) and a group
with no account nature. ⚠️ **"Unblocked" was true about the reports and false
about posting**: `journal_lines.trxGroupId` is still `NOT NULL` behind a real FK
until D9, and every voucher picker still lists `trx_groups`, so a ledger created
in the new chart alone would have appeared on the Trial Balance at nil with **no
way to post a rupee to it**. `create` writes the pair — the ledger and a legacy
head, linked by `legacyTrxGroupId`, which is D5's own precedence rule — and the
rename, restore and delete all carry the twin, because an orphaned head does not
fail when posted to, it silently provisions a fresh ledger. The parity diff is
**empty**.

**And P3d‑1 is done: the drill spine exists, and the Ledger report has a
screen.** A report row emits a **`DrillTarget`** (`group` | `ledger` |
`voucher`) and one resolver turns it into a URL; Tally's Esc-goes-back is a
**route stack** rather than browser history, and a navigation nobody drilled
empties it; a report's period lives in its **own URL**, which is what makes Esc
restore the sheet a reader came from on the date they left it — and makes every
statement a link somebody can paste. P3a's Ledger report, which had an API and no
screen, is the middle of the journey. The gate is
four properties in a browser, **shown to fail four times** — and one of those
injections passed first time, because the busiest ledger's last posting is
*today* and today is also the screen's own default: the fixture, not the
assertion, was what could not fail. Building it found `POST /acc-ledgers/list`
answering **every call with a 500** since P2b‑3b — an include naming an alias
`AccLedger` never declared — which nothing had noticed because nothing had
called it.

**And P3d‑2 is done, which closes P3: the Chart of Accounts is a screen.**
`/transaction/ledgers` is the `acc_groups` tree with the selected group's
`acc_ledgers` beside it, and **every refusal the API makes is made on the screen,
in the API's own sentence** — which is what P3's gate asked for and why the
mirrored thing is the **wording**: `check-mirrors.js` check 10 runs both
implementations of the five `describe*Block` rules over 182 rows and compares the
text, and both failure modes were reproduced. The two arms that turn on whether
anything has **posted** are deliberately left to the server — the browser has no
such field and a guess would be a refusal that is sometimes wrong — so the dialog
warns, the request goes, and the refusal comes back in the same words. Masters ▸
**Nature** retired with it (a nature is inherited in the new chart, and F8 measured
`trx_natures` as four fixed rows per company); Masters ▸ **Transaction Group**
deliberately did not, because it is still the only door to a legacy head's
opening balance and its `groupFor` until D9. ⚠️ Building it found the two-pane
layout leaving the grid's own toolbar at **719px** — one pixel under the 720 its
container query fires at — so the widest screen the app supports was the one
showing the compact search button.

**P4 — voucher entry — is next**, and `app-ledger-picker` with `Alt+C` goes with
it, because P4 is their only consumer.

⚠️ **The parity harness's question changed at P3c‑1**, which is that phase in one
line: it existed to ask *"did a figure move as the mechanism changed underneath a
report whose shape is fixed?"*, and there is no longer a second derivation to
hold the tree against. That question is finished. `diff --rebased` is how a pair
straddling the change declares which reports are not the same report on both
sides — seven of them, and the diff over everything else is **empty**.

> ⚠️ **Building D3 corrected this plan's own headline figure.** §4.2 and F14
> describe the declared exception as *"Sundry Debtors and Sundry Creditors each
> fall by ₹1,57,11,850"* across **63** parties. That is `Σ min(|debtorNet|,
> |creditorNet|)`, and it is wrong twice over. The true movement is
> **₹2,51,44,323.21**, across **76** parties. See
> [§P2a record](#p2a-record--2026-08-28).

| Phase | Title | Size | Status |
|---|---|---|---|
| P0 | Foundations and the parity harness | M | **done** — [§P0 record](#p0-record--2026-08-28) |
| P1 | Groups become a hierarchy | M | **done** — [§P1 record](#p1-record--2026-08-28) |
| P2a | The ledger layer exists (D1–D4) | L | **done** — [§P2a record](#p2a-record--2026-08-28) |
| P2b‑1 | The GL names a ledger (D5, D8's third cache) | M | **done** — [§P2b‑1 record](#p2b-1-record--2026-08-28) |
| P2b‑2 | Reports read the ledger (the declared exception appears) | M | **done** — [§P2b‑2 record](#p2b-2-record--2026-08-28) |
| P2b‑3a | D6 — the voucher names a ledger | M | **done** — [§P2b‑3a record](#p2b-3a-record--2026-08-28) |
| P2b‑3b | The Ledger module API; `resolveStatutoryLedger` | M | **done** — [§P2b‑3b record](#p2b-3b-record--2026-08-28) |
| P2b‑3c | The Data Import module | M | **done** — [§P2b‑3c record](#p2b-3c-record--2026-08-29) |
| P3a | The Ledger report and the Group Summary | M | **done** — [§P3a record](#p3a-record--2026-08-29) |
| P3b | The statements become the tree (Trial Balance, Balance Sheet, P&L) | M | **done** — [§P3b record](#p3b-record--2026-08-29) |
| P3c‑1 | The presentation layer retires | M | **done** — [§P3c‑1 record](#p3c-1-record--2026-08-29) |
| P3c‑2 | Ledger creation | M | **done** — [§P3c‑2 record](#p3c-2-record--2026-08-29) |
| P3d‑1 | The drill-down spine, Esc as a route stack, the Ledger report's screen | M | **done** — [§P3d‑1 record](#p3d-1-record--2026-08-29) |
| P3d‑2 | `/transaction/ledgers` — the Chart of Accounts screen | M | **done** — [§P3d‑2 record](#p3d-2-record--2026-08-29) |
| P4 | Voucher entry | XL | not started |
| P5 | Bill-wise details | L | not started |
| P6 | Trading Account and Gross Profit | M | not started |
| P7 | Cost centres | L | not started |
| P8 | Posting rules, budgets, interest, multi-currency, scenarios | L | not started |

Sizes are relative, not calendar.

### P0 record — 2026-08-28

Built, and verified against the live development database (14 companies, 41,690
journal lines, 564 groups, 27 instruments — the same figures the verification
pass measured).

| Artefact | What it is |
|---|---|
| `client-back/src/const/parity-snapshot.const.ts` | The flatten-and-diff **rule**, pure and dependency-free, with `parity-snapshot.const.spec.ts` beside it — **31 tests**. It knows no accounting: it turns any report payload into `path → scalar` and compares two such maps. §4.2's "do not write a second oracle" is satisfied by construction, because there is nothing here to restate. |
| `client-back/scripts/qa-coa-parity.ts` | The runner. `capture <label>` · `diff <before> <after> [--allow f]` · `selfcheck`. Calls the report services inside `TenantContext.run` rather than going over the wire — the services are what P2 changes, and fourteen logins plus a permission matrix between the harness and a number is noise. |
| `.github/workflows/ci.yml` in **both** backends | §13 still-open #1(a), closed. `npm test` · `npm run guards` (client-back) · `lint:ci` · `build`. |
| `npm run guards` (client-back) | All **five** tree-scanning guards, not the three §13 named. admin-back needs no equivalent — its one guard scans `src/**/*.ts` from inside its own spec. |

**What the snapshot covers**, per company: three periods (all-time, first FY,
active FY) × Trial Balance · P&L · Balance Sheet · Day Book · payment and
receipt registers · cash and bank book; then per-instrument cash/bank books,
daily cash on every day with instrument activity, a group statement for **every**
group, both Outstanding reports, and per party — over F13's **union** population,
not `company_parties` — summary, statement and pending bills. Plus the BUG-0042
cache census for `trx_groups.currentBalance` and `trx_accounts.balance`.

**Gate met.** `selfcheck` captures twice on unchanged code across all 14
companies and reports `PARITY HELD — the diff is empty`.

> ⚠️ **An empty diff proves nothing until the harness has been shown to fail**,
> which is this repo's own doctrine (§13 still-open #3: a rule that cannot fail
> reads as coverage). So the D5 failure mode was injected directly: one
> `journal_lines` row repointed from `Purchase` to `General Expenses` in company
> 15 — a **balanced** perturbation, which is what a mis-mapped backfill actually
> produces. Every total stayed identical and the Trial Balance still balanced.
> The harness reported **63 differences**, naming the ₹93,814.40 in each place
> it surfaced: both group statements and their running balances, the Day Book
> line, the P&L expense row, the Trial Balance. Reverting the row restored the
> empty diff.
>
> The **unmet-allowance** half was verified the same way: an exception list
> declaring a movement that had been reverted fails with *"1 declared
> exception(s) matched NOTHING"*. That is what keeps §4.2's exception a list
> rather than a tolerance.

**Three things P0 established that the plan should carry forward:**

1. **F13 and F14 reproduce exactly.** 362 `(companyId, partyUserId)` pairs on a
   control head; 63 dual-role parties; ₹1,80,78,934 debtor against ₹4,28,14,914
   creditor, **₹1,57,11,850 netting away**. D3's union population is what the
   harness already uses, so P2 inherits it rather than re-deriving it.
2. **The diff must be structural, and it is.** Rows are keyed by identity, not
   index, and `added`/`removed` are reported alongside `changed` — which is the
   only way the netted-to-exactly-zero party leaving the Trial Balance is
   visible at all (§4.2's last ⚠️).
3. **`npm run` swallows flags without `--`.** `npm run qa:coa-parity selfcheck
   --company 15` silently runs every company. Write `npm run qa:coa-parity --
   selfcheck --company 15`, or call the script directly.

---

### P1 record — 2026-08-28

The chart of accounts has a tree. Nothing posts to it yet — `trx_groups` is
untouched, every journal line still points at it, and `qa-coa-parity selfcheck`
is still an empty diff. P1 is additive by construction, which is what makes it
safe to have landed before P2 depends on it.

| Artefact | What it is |
|---|---|
| `src/const/provisioning/tally-chart.const.ts` (+ spec, **34 tests**) | Tally's 28 as a **tree**, plus `TRX_GROUP_TARGET` — §3.2's mapping as data. ⚠️ It does **not** re-type the 28 names: it reads them from `import/tally-nature-map.const.ts` and adds only the parent linkage and sort order, with a spec asserting the two key sets are identical (V3). |
| `src/const/materialised-path.const.ts` (+ spec, **22 tests**) | `buildPath` · `subtreePrefix` · `wouldCycle` · `rebuildSubtreePaths`. §3.3's re-parent rule, and the terminator that stops `/1/7/` collecting `/1/70/`. |
| `src/entities/acc-group.entity.ts` · `migrations/20260828000000-acc-groups.ts` | The table. DDL only — seeding reads the constant, so the names exist once. |
| `src/services/acc-group-seed.ts` | One seeding definition, shared by `CompanyProvisioningService` and `scripts/seed-acc-groups.ts` (BUG-0032's lesson: put it where a new caller cannot fail to import it). |
| `ReportsService.groupedTrialBalance()` | The opt-in grouped view. `trialBalance()` is untouched. |
| `scripts/qa-p1-group-tree.ts` | P1's gate. `npm run qa:p1-group-tree`. |

Seeded into all 14 companies: **392 groups** = 14 × (15 primary + 13 sub), 28
nature-ambiguous (Tally's own two, per company), zero malformed paths, zero
depth mismatches.

**Gate: 126 passed, 0 failed.** And, per P0's discipline, shown to fail — twice.
Stripping a path's terminator is caught by the structural check; the harder
injection, a **well-formed path pointing at the wrong parent**, was caught three
ways at once (per-nature NET, the roll-up identity, and the explicit
prefix-vs-parentId cross-check) while the Σ checks correctly stayed green.

#### ⚠️ The gate's own wording was half wrong, and the half that was wrong matters

P1's gate reads *"grouped Trial Balance totals equal the flat one, per nature
and overall"*. Two corrections, both load-bearing for P3:

1. **Closing columns are not regroup-invariant.** `closingDebit` is
   `max(net, 0)`, so merging the thirteen tax heads into Duties & Taxes **nets
   them before the max is taken** and the closing total legitimately falls. A
   gate asserting those equal would be asserting that grouping does not group.
   What ties the two reports is **Σ debit, Σ credit and Σ net** — pure sums,
   which survive any regrouping. The report exposes both.
2. **Per-nature totals do not match, by design** — see below.

#### ⚠️⚠️ A second declared exception to the parity gate: ₹1,54,85,553

§3.2 maps input **and** output GST to Duties & Taxes — correct, it is what Tally
does and it keeps GSTR reconciliation reading one subtree — without noticing
that Duties & Taxes hangs under **Current Liabilities**. Nature is inherited
(§3.3), so `TAX_INPUT`, `CGST_INPUT`, `SGST_INPUT` and `IGST_INPUT`, seeded
under Assets, become Liability-natured and carry a debit balance there, exactly
as a Tally input-GST ledger does.

Measured across the 14 companies: **₹1,54,85,553.06** (CGST 62,59,652 · SGST
62,59,649 · IGST 29,66,252 · `TAX_INPUT` nil). Assets and Liabilities both fall
by that figure, so **the Balance Sheet still balances while it happens** — the
same property that makes the dual-role party netting invisible to a "does it
still balance?" check (§4.2, R8).

Unlike R8's, this set is fully enumerable in advance — 4 heads × 14 companies —
and `NATURE_CHANGING_KEYS` carries it with a spec asserting it is **exactly**
those four, so a fifth head acquiring a nature change fails a test rather than
somebody's Balance Sheet. **Reversing the decision is one edit to
`TRX_GROUP_TARGET`**, pointing the four at a Current Assets child instead; that
is deliberately all it takes, because the mapping is data and nothing else
encodes it.

#### Three things the gate found that the plan had not

- **Instrument backing groups are not seeded heads.** `trx_accounts` silently
  auto-creates a `trx_groups` row per bank account, UPI handle and card (F5),
  so `TRX_GROUP_TARGET` cannot name them — company 28's Current Account, ₹4.99
  crore, was landing unmapped. They are routed by **AccountType**, derived from
  `bookForAccountType` so D-54's rule is reused rather than restated (§3.10) and
  a new account type is placed the day it is added.
- **Some backing groups have no account left.** Company 28 carries four whose
  `trx_accounts` row was hard-deleted and one whose row is soft-deleted, holding
  ₹1,23,456 each. `fallbackGroupForNature` places them by their own nature and
  the report lists them in `fellBackToNature`: **a fallback that is reported is
  safer than an omission that is not** — the alternative was a grouped Trial
  Balance quietly smaller than the flat one, which loses money and still
  balances.
- **The raw-SQL allow-list trap fired, exactly as CLAUDE.md §14 predicts.**
  Adding ten lines to `company-provisioning.service.ts` moved the `countries`
  probe from `:441` onto `:451` — an existing key, whose justification describes
  the **`states`** probe. It would have passed the guard carrying a reason
  written for a different statement. Every key was re-read against the query now
  at it, rather than having its number shifted.

---

### P2a record — 2026-08-28

**The chart of accounts has a postable leaf.** Nothing posts to it yet:
`journal_lines` still points at `trx_groups`, every report still reads it, and
`qa-coa-parity selfcheck` is still an empty diff. P2a is additive by
construction — the same property that made P1 safe to land before P2 depended on
it, applied one level down.

| Artefact | What it is |
|---|---|
| `src/const/ledger.const.ts` (+ spec, **30 tests**) | D3's derivation and **D5's precedence**, pure. `derivePartySide` · `displacedBalance` · `controlHeadDelta` · `resolveLedgerForLine` · the Ledger module's own rules. |
| `src/entities/acc-ledger.entity.ts` · `party-ledger-plan.entity.ts` · `migrations/20260828100000-acc-ledgers.ts` | The two tables. DDL only — seeding reads the constants, so the mapping exists once. |
| `src/services/acc-ledger-seed.ts` | D2, D3 and D4 as one function, shared by `CompanyProvisioningService` and `scripts/seed-acc-ledgers.ts` (BUG-0032's lesson, the same shape `seedAccGroups` uses). |
| `src/services/party-ledger-plan.ts` + `scripts/plan-party-ledgers.ts` | D3 steps 1–2: derive, and write the reviewable plan. Dry-runs by default. |
| `scripts/seed-acc-ledgers.ts` | D2/D3/D4 backfill. Dry-runs by default, one transaction per company. |
| `scripts/qa-p2-ledgers.ts` | P2a's gate. `npm run qa:p2-ledgers`. |

**Landed on all 14 companies:** 1,351 ledgers — 509 from legacy heads, 27
instruments claiming theirs, 815 parties — with 28 control heads deliberately
left without one, because they become **groups**. `party_ledger_plan` holds 815
rows. Every gate is green: **P2a 196/196 · P1 126/126 · parity diff empty ·
`npm test` 1,796/1,796 · all five guards · `check-mirrors` in sync.**

#### The gate that matters is D5's dry run

`resolveLedgerForLine` was run over **all 41,690 journal lines**, resolving
every one. That is the whole reason P2 was split: §4.1 D5 ends with a `NOT
NULL`, and V1/F13 records what discovering a gap *there* costs — a migration
stopping mid-flight on a live book. Finding out first costs one script run.

Shown to fail, per this repo's own doctrine (§13 still-open #3): soft-deleting
one party ledger produced *"5 unresolvable: no-party-ledger×5"* — V1's failure
mode reproduced in miniature — and named the plan row pointing at a dead ledger
in the same run.

#### ⚠️ The declared exception was computed with the wrong formula, and it is ₹94 lakh larger

§4.2, F14 and R8 all describe the movement as *"Sundry Debtors and Sundry
Creditors each fall by ₹1,57,11,850"* across **63** parties. That figure is
`Σ min(|debtorNet|, |creditorNet|)` and it is wrong in two independent ways:

1. **`min()` is only the movement when the party is parented to the side with
   the larger net — and parentage is by GROSS.** That is not an oversight in the
   parenting rule; it is the rule's whole point (§4.1 D3: *"gross, not net, so a
   party who has settled down to a small balance is still parented where their
   trading actually happens"*). A party with ₹5,000 outstanding on a ₹40 lakh
   history, against one ₹80,000 purchase unpaid, is correctly a debtor — and the
   whole ₹80,000 moves, not ₹5,000.
2. **A party can move a figure without being dual-role at all.** One net zero,
   the other not, and the gross pointing at the zero side. **Thirteen parties**
   on the development database are in exactly that state, and every one of them
   reports `isDualRole = false`. Keying the gate off "holds a live balance on
   both heads" would have left thirteen unexplained differences in a diff
   required to be empty apart from a named list.

The measured figures, reproduced two independent ways — from
`party_ledger_plan`'s own arithmetic, and from the journal lines through the
resolver:

| | Plan as written | Measured |
|---|---|---|
| Parties moving a figure | 63 | **76** |
| Δ Sundry Debtors | −₹1,57,11,850 | **−₹2,51,44,323.21** |
| Δ Sundry Creditors | −₹1,57,11,850 | **+₹2,51,44,323.21** |

⚠️ Note the **sign**, which the old wording also got wrong. The two heads move
by *exactly opposite* amounts — `controlHeadDelta` returns the pair and the gate
asserts it — which is why the Balance Sheet still balances. "Both fall by the
same figure" happens to be true only for an opposed pair; it is not the
mechanism, and describing it that way is what made a `min()` look right.

`displacedBalance` in `ledger.const.ts` carries the whole argument, and the plan
table stores the figure per party, so the exception stays **a list**.

#### Four things P2a established that P2b should carry

1. **`strictNullChecks: false` makes discriminated unions unreliable here.**
   `LedgerResolution` was written twice as a union — discriminated on
   `ledgerId: number | null`, then on an added `ok: true | false` — and neither
   narrowed at the obvious call site. It is now **one total shape**, and callers
   write `if (answer.ledgerId === null)` with no narrowing at all. A result type
   whose callers need `'failure' in x` to compile is one that will be got wrong.
2. **A derived column on the plan table can go stale, and it did.** Editing
   `chosenSide` directly leaves `displacedBalance` describing a migration that
   is not the one about to run — BUG-0034's shape a third time. It first
   surfaced as an unexplained ₹5,96,950.55 on a group total, three steps from
   its cause; checks (2b) and (2c) now name it. Note the asymmetry the fix
   established: **before D3 the plan row is a proposal and its figures refresh
   with the books; after D3 it is the record of a movement that happened**, and
   the decision lives in the ledger's `groupId`.
3. **"No plan rows" and "no parties" are different states.** The seed's first
   guard refused company 2 — which has neither a roster nor a posting — as
   un-planned. Comparing a count against zero answers a different question from
   comparing it against the population.
4. **The raw-SQL allow-list drifted again, exactly as CLAUDE.md §14 predicts.**
   Adding `seedAccLedgers` to `company-provisioning.service.ts` moved all seven
   of its entries; each was re-read against the statement now at its line before
   the number was changed. **Budget for this in every commit that edits a file
   with entries.**

---

### P2b‑1 record — 2026-08-28

**D5. The general ledger stops naming a group and starts naming a ledger.** This
is the first step of the programme that is not additive — everything before it
could have been dropped without touching a book.

`journal_lines.ledgerId` is backfilled on all **41,690** lines, `NOT NULL`,
behind `fk_journal_lines_ledger`. `trxGroupId` survives beside it as a shadow
(§3.1, R2), every report still reads it, and **`qa-coa-parity selfcheck` is
still an empty diff** — which is the point: repointing and re-reading are two
steps, and doing them together would have made a wrong figure and a wrong
mechanism indistinguishable.

| Artefact | What it is |
|---|---|
| `migrations/20260828200000-journal-line-ledger.ts` | D5 in five statements — nullable column · three backfills in precedence order · **verify** · tighten · index · FK — plus D8's rebuild of the third cache. |
| `PostingService.persistLines` | Resolves and stamps `ledgerId`, and maintains `acc_ledgers.currentBalance`, in the single writer of `journal_lines` (§4.9). |
| `src/services/ledger-resolution.ts` | `loadLedgerIndex` · `resolveOrCreateLedger` — posting-time resolution, provisioning a ledger on demand inside the posting transaction. |
| `PostingService.rebuildBalances` | Now rebuilds the third cache too, so the existing repair door still repairs everything. |
| `scripts/qa-p2-ledgers.ts` | Checks (10), (11) and (12) — see below. **229/229.** |

#### The backfill and the engine are one step, deliberately

A backfilled column the posting engine does not write **goes stale on the very
next voucher**, and a column that is stale but present is worse than one that is
absent, because the next reader believes it. So D5 is not "the migration": it is
the migration *and* `persistLines`, in one commit.

`ledgerId` being `NOT NULL` sharpens that. A resolution failing at runtime is not
a wrong figure — it is **every voucher approval throwing**. Which is why the gate
grew a twelfth property that actually posts.

#### Three new gate properties, and why each exists

- **(10) Every stored `ledgerId` equals what the pure rule answers**, over all
  41,690 lines. The migration *restates* `resolveLedgerForLine`'s precedence in
  SQL — a migration in this repo imports nothing, because it is a historical
  record and a rule it imported would change under it. That makes it a mirror,
  and §13 is four paragraphs on what an unchecked mirror costs. Shown to fail:
  repointing one line reports the drift and names the row. It **skips**, rather
  than passing, before the column exists.
- **(11) The third balance cache equals its own Σ.** `acc_ledgers.currentBalance`
  joins `trx_groups.currentBalance` and `trx_accounts.balance` as a duplicate of
  a sum, and BUG-0042's whole lesson is that a drifted one is invisible to every
  ledger-derived report. The census is the only thing that sees it.
- **(12) Posting still works** — a party opening balance for an identity with
  **no ledger**, exercising the branch that provisions one, asserting the line
  carries a ledgerId, the ledger landed under a control-head group, and the
  cache was maintained. Rolled back, and (12e) asserts nothing survived: a gate
  that leaves a journal entry behind changes the books it is checking, and the
  parity harness's next capture would have seen it.

#### ⚠️ A ledger is provisioned on demand, and a new party's side comes from the posting

A party invited today has no `party_ledger_plan` row and no ledger. Refusing to
post a receipt for want of a row the engine can create is a regression, not a
safety property — so `resolveOrCreateLedger` creates it, **inside the posting
transaction**, so it commits with the entry that needed it or rolls back with it.

Its side is taken from **the control head the first posting is on**, not from
`derivePartySide`'s no-activity default. At migration time there was a history to
weigh and a human to review it (R8); here there is neither — but there is better
information than a default, namely which side of the books this party has just
appeared on. It is also what Tally does: you place a party under a group the
first time you use them.

#### ⚠️⚠️ The new foreign key broke company hard delete, and nothing local would have said so

`journal_lines.ledgerId` is `ON DELETE RESTRICT`. The topological sort had
`acc_ledgers` at position 25 and `journal_lines` at 62 — so **every company hard
delete would have been refused**, by a foreign key that had no edge describing
it. Caught by asking the delete order directly, not by a test: `onDelete`
behaviour lives only in the raw migration SQL and never in Sequelize's
association metadata, which is exactly why
`company-hard-delete-order.const.ts` is hand-transcribed.

**A new FK between two tenant-scoped tables is a new line in that file**, in the
same commit. Its own spec passes either way — it verifies the graph is
consistent, not that the graph is complete — and the test that would have caught
it, `qa-artifacts/tests/cross-service/hard-delete.spec.ts`, needs a running
stack. Verified afterwards that all **119** `companyId`-bearing tables are still
in the order.

---

### P2b‑2 record — 2026-08-28

**The reports stopped reading the shadow.** Every figure-bearing statement now
aggregates by `journal_lines.ledgerId` and maps each ledger back to the legacy
head it is presented under; `trialBalance`, `profitAndLoss`, `balanceSheet`,
`groupedTrialBalance`, `groupStatement`, both Outstanding reports, the party
statement and the Financial Dashboard's two analytics panels. **This is the
step where the declared exception finally appears in a report**, and it did:

| | |
|---|---|
| Paths that moved | **76,445**, across **seven** report families and nothing else |
| Undeclared differences | **0** |
| Unmet allowances | **0** |
| Δ Sundry Debtors / Creditors | **−₹2,51,44,323.21 / +₹2,51,44,323.21** — exactly what `party_ledger_plan` declared |
| Journal lines reported under a different head than they were posted to | **4,281** live (5,393 including cancelled), across 8 companies |
| `qa-p2-ledgers` | **232/232**, with three new properties |

| Artefact | What it is |
|---|---|
| `src/const/ledger-presentation.const.ts` (+ spec, **15 tests**) | The transitional rule: **which legacy head a ledger reports under**. Two branches — a `legacyTrxGroupId` *is* that head (D2 and D4's 536 ledgers); a party ledger reports under the control head of the side D3 parented it to (815). `presentationJoinSql` / `presentationGroupExpr` are the same rule in SQL, written once for the ten statements that paste it. |
| `qa-coa-parity exceptions` | Writes the declared exception as a **list** — 513 entries, each naming the party or the head it is about. |
| `qa-p2-ledgers` (13) (13b) (14) | The presentation rule is total over every posting ledger; the SQL says what the pure rule says; and **no party is outstanding on both sides at once**. |

#### Why the reports still render the legacy chart

Because repointing and re-rendering are two steps — P2b‑1's argument, one phase
on. **P3** is where the Trial Balance becomes a tree of `acc_groups` and a line
names its ledger. P2b‑2 changes only the mechanism, so that a wrong figure and a
wrong mechanism stay distinguishable, and its gate is that **exactly one thing
moves**.

That it did is the result worth reading twice. Seven families changed —
`groupStatements` (75,407 paths, all on the two control heads of the 8 affected
companies), `trialBalance`, `balanceSheet`, `financialDashboard`,
`outstanding.vendor`, `outstanding.customer`, `parties.summary`. The Day Book,
both registers, the cash and bank books, daily cash, every party statement,
every pending-bill list and both cache censuses are **byte-identical**.

#### ⚠️ The gate was shown to fail, and the way it fails is the proof

P0's discipline: an empty diff proves nothing until the harness has been shown
to fail. So one `journal_lines` row in company 15 was repointed from the
`Purchase` ledger to `General Expenses` — **`ledgerId` only, leaving the shadow
`trxGroupId` untouched**, which is exactly the shape of a mis-mapped backfill.

- Under the new code the harness reported **47 differences**, naming
  ₹1,75,455.32 in every place it surfaced: the P&L expense rows, both Trial
  Balance periods, the dashboard's group panel.
- Under the **old** code, the same injected row produced **an empty diff**.

That second half is the phase's actual acceptance test. It is not "the reports
still answer the same"; it is *"the reports are reading the column we spent
P2b‑1 filling"* — and nothing else could have said so, because both versions
agree on every figure that is not a merged party's.

#### The exception is generated, and it is derived from the LINES

513 allowances, not 76,445, because §4.2's own test for an exception that has
stopped being one is *"a list nobody could review"*. One entry per **named row**
— a control head's statement, a Trial Balance row, a party's summary card, a
party's line in an Outstanding report — each carrying the party's name, the side
D3 parented them to, and the amount displaced.

Three things about it that are deliberate:

- **It is derived from the repointing, not from `party_ledger_plan`.** The plan
  is D3's *decision*, and `qa-p2-ledgers` (8b) already checks the movement
  against it. What the allow-file needs is the other question — *which figures
  does the repointing touch?* — and the honest source for that is every live
  journal line whose ledger's presentation head differs from the head it was
  posted to. The plan supplies only the **reason** text.
- **`judge` fails an allowance that matched nothing**, so the generator may not
  be generous. Getting that right needed three predicates, not one, and
  companies 32 and 33 are what proved it: their displaced lines predate the
  active financial year and net to zero on each head, so **that year's Trial
  Balance row does not move even though the head's membership did**. A period
  column moves iff a displaced line falls inside it; an opening moves iff the
  lines before it do not net; a closing — and every total, and the Balance Sheet
  — moves iff the lines up to the period's end do not net.
- **`periodsOf` is now shared by `capture` and `exceptions`**, because a period
  label is half of every allowance path. Two derivations of one label is the
  mirror problem this plan is about, one level down.

The file is **generated, not committed** (`scripts/_reports/` is gitignored, and
the ids in it are one installation's). Re-run `npm run qa:coa-parity --
exceptions` before every diff.

#### ⚠️⚠️ Two reads are deliberately still on the shadow, and they are LABELS

`dayBook`'s line label and `accountBook`'s `particulars` still join
`trx_groups` through `jl.trxGroupId`. They are not figures, and moving them now
would relabel **5,393 lines** to the *wrong* head's name on the way to the right
one — P3 turns both into the **ledger's** name, which is what a Tally user reads
in a Day Book ("Ramesh Traders", not "Customer Dues"). Moving them in this phase
would also have cost the gate a per-entry allowance list, i.e. the thing §4.2
says an exception may not become.

The other shadow readers, all of which answer the **same figure** either way
because their heads are 1:1 with a D2 ledger — listed so the D9 sweep has a
list rather than a grep (§13 still-open #3):

| Reader | Why it is unaffected |
|---|---|
| `DashboardService.cashBankBalance` · `.profitMtd` · `.gstLiability` | instrument and tax heads, one ledger each |
| `Gstr3bService` GL cross-check | tax heads |
| `ExportJobService` day-book export | a **label**, same class as the two above |
| `PostingService.rebuildBalances` | it maintains `trx_groups.currentBalance`, which **is** the shadow's own cache and must keep reading it |
| `party-ledger-plan.ts` | it measures the historical position *by head*; reading it through the ledger would make D3's own derivation circular |

`DashboardService.partyOutstanding` is the one that **was** moved, and had to be:
it is the KPI card sitting one screen from the Outstanding reports, and leaving
it behind would have shipped a card and a breakdown that count different rows —
BUG-0043's rule, which this codebase has already paid for twice.

#### The tape measure changed too, and both changes were needed before the capture

- **Outstanding rows had no identity.** `vendorId`/`customerId` are in no
  `IDENTITY_KEYS` entry, so those rows fell back to their **index** — and both
  reports are `ORDER BY outstanding DESC`, so one moved balance renumbered every
  row behind it and reported the whole report as changed. Property 2 of
  `parity-snapshot.const.ts`, failing on the one report the exception is most
  about.
- **The Financial Dashboard was not in the snapshot at all**, and the merge moves
  money between two account **natures** on its top panel. It is in now
  (`formatVersion` 2), with `monthlyTrend` replaced by a marker because it is
  the one figure in the whole snapshot derived from *today* rather than a stated
  period.

> ⚠️ `financialDashboard.topGroups` is a **top-20 ranking**. On this data every
> row it moved is one of the 16 control heads, so the exception stays
> attributable — but a ranking is the one shape a parity diff cannot attribute,
> and if a future capture shows a `topGroups` row that is **not** a control head,
> that is the ranking cascading. Do not widen the exception to cover it; drop the
> panel from the snapshot the way `monthlyTrend` is dropped.

---

### P2b‑3a record — 2026-08-28

**D6, for the four holders of a group id that are not the general ledger.** D5
gave the GL a `ledgerId`; this gives it to the **document** — which is where a
person chose the head in the first place. Backfilled on **11,856** rows, behind
four foreign keys, and the posting engine now believes the column instead of
re-deriving it.

| | |
|---|---|
| `trx.ledgerId` | 11,495 rows · NOT NULL |
| `trx_charges.ledgerId` | 90 rows · NOT NULL |
| `trx_payment_receipts.ledgerId` | 271 journals · **nullable**, see below |
| `trx_payment_receipt_lines.ledgerId` | 0 rows (the table is unused on this install) · NOT NULL |
| Parity diff across the change | **empty** |
| `qa:p2-ledgers` | **302/302**, with six new properties |
| `npm test` | 1,825 in 124 suites |

| Artefact | What it is |
|---|---|
| `migrations/20260828300000-voucher-head-ledger.ts` | The four columns, as one loop over a `HOLDERS` table rather than four copies — nullable · backfill · **verify** · tighten · index · FK. |
| `ledger.const.ts` `voucherHeadRefs` (+ 6 specs) | D6's rule, expressed as a **projection** of D5's — see below. |
| `ledger.const.ts` `controlHeadNotPostable` | The one refusal message, and the argument for refusing rather than provisioning. |
| `tally-chart.const.ts` `isControlHead` (+ 5 specs) | The same three lines, extracted from the four places that had written them out. |
| `ledger-resolution.ts` `resolveLedgersForHeads` / `resolveLedgerForHead` | The seam the four writer services share. |
| `PostingService` | `ResolvedLeg.ledgerId`, `PostingRequest.mainLedgerId`, `charges[].ledgerId` — and `persistLines` believing a leg that carries one. |
| `company-hard-delete-order.const.ts` | Four new edges. P2b‑1's lesson, applied without having to relearn it. |

#### D6 is not a second rule, and saying so is the design

A voucher head — `trx.groupId`, a charge's, a journal line's — is a posting
target with **no party and no instrument behind it**, which is exactly the
degenerate case `resolveLedgerForLine`'s third precedence arm already answers. So
there is deliberately **no `resolveLedgerForHead` in `ledger.const.ts`**: the
pure layer gained a five-line *projection* (`voucherHeadRefs`) and nothing else.

A second resolution function would have been a mirror of a rule ten lines above
it — §13's shape, inside one file. The spec asserts the property that keeps it
one rule: a head **cannot reach the party arm even when the head IS a control
head**. If a later edit gave `voucherHeadRefs` a `partyUserId` — *"the voucher
knows its supplier, after all"* — a Sales voucher's **revenue** would post into
the customer's ledger and the Trial Balance would lose its Sales row with
everything still balancing.

#### ⚠️ The stamp is in the four WRITERS, not in the two save paths

`TrxWriteService.saveTrx` is the seam six callers share and it would have been
the obvious place. It is the wrong place: `Trx.create` is reachable from
`TrxService` directly, and `ImportVoucherCommitService` calls
`TrxPaymentReceiptService.create` **without going through the controller** that
assembles the DTO. A check in either save path would have been correct for every
caller somebody thought of — BUG-0032 exactly.

So each stamp sits in the one writer of its own table — `TrxService`,
`TrxChargeService`, `TrxPaymentReceiptService`, `TrxPaymentReceiptLineService` —
where a new caller cannot get a row in without it.

**And `ledgerId` is on no DTO.** It is derived from the head, in the service,
which is CLAUDE.md §12's rule about a column the server owns: `whitelist: true`
strips only fields nobody *declared*, so declaring it would have handed any
caller a cross-company ledger id to aim at (§4.3 rule 7 — BUG-0025's own three
ids being the very columns this phase touches). P2b‑3b is where the direction
reverses — the picker sends the **ledger** and the group becomes the derived
half — and the four writers are the seam that flips.

#### ⚠️⚠️ A control head is refused, not provisioned

`resolveOrCreateLedger`'s head branch would happily have created a ledger named
*"Customer Dues (Sundry Debtors)"* **under** Sundry Debtors — resurrecting as a
leaf the head that D3's party ledgers replaced, and `presentationGroupId` would
then report it under the very control head it had vacated. A silently wrong chart
of accounts with every total still adding up.

Measured before deciding: **0** journal lines, **0** vouchers and **0** charges
in the installation sit on a control head without a party. But the head *pickers*
offer every group, so D6 is the step that makes it reachable by a person rather
than only by a bug. It answers a `400` naming the head.

#### ⚠️⚠️ The receipt header's column is nullable, and the first cut of the backfill got it wrong

`trx_payment_receipts.trxGroupId` is `NOT NULL` and is **residue for two of the
three voucher types**: `postPaymentReceipt` reads it only for a Journal. Two of
the 3,308 rows — a payment draft and a receipt draft — name a **control head**,
i.e. one of the two heads that deliberately has no ledger. A `NOT NULL` here
would have had to invent a value for them.

The first version of the migration scoped only the *verification* by voucher
type and left the backfill unscoped, so it handed **3,035 payment and receipt
rows** a ledger their posting will never read — while
`TrxPaymentReceiptService.create` leaves that column null for those types. A
migration and a writer disagreeing about what a column means is P2b‑1's own
warning, one table over: *a value true for the old rows and absent for the new
ones is worse than absent for all, because the next reader believes it.*

What caught it is the **phrasing of the check**: (16) asserts *"set for every
Journal, null for every Payment and Receipt"* rather than *"not null"*. The
weaker version passes on 3,035 wrong rows. The migration was corrected and
re-run from `down`, so what is committed is a single correct historical record.

#### The gate was shown to fail — and D6's real claim needed a different test

Six new properties. (15) compares the stored `ledgerId` on **all four** holders
against what the pure rule answers, which is the check behind the migration's
SQL restatement, exactly as (10) is for the general ledger. Injected drift on
`trx` and on `trx_payment_receipts` reports **3 failures** naming the rows;
reverting restores 302/302.

But (15) and the parity diff together still cannot answer the question the phase
is actually about: **does the posting engine follow the document, or does it
still re-derive from the group?** The two agree on every row in the
installation, which is why nothing that reads real data can tell them apart. So
they were made to disagree — one approved voucher's `trx.ledgerId` repointed at
`Cash In Hand`, `groupId` untouched, and the voucher re-posted in a rolled-back
transaction:

- Under P2b‑3a the main leg posted to **ledger 1**, the one the voucher names.
- Under P2b‑2's code the identical injection posted to **ledger 23**, the one the
  group resolves to.

That second half is the acceptance test, the same shape P2b‑2 used. *"Every
figure is unchanged"* is necessary and says nothing; *"the engine reads the
column we spent this phase filling"* is the property.

#### Two things found on the way that were not D6

- **A reversal now carries its original's ledger.** `reverseSource` rebuilt each
  opposite leg from the group and let resolution answer again. It answers the
  same thing today and a *different* thing the moment anything moves underneath
  — a party ledger re-parented, a head's ledger replaced — leaving a cancelled
  voucher that nets to zero overall and to something non-zero on two ledgers.
  `journal_lines.ledgerId` is `NOT NULL`, so the original always has one to
  copy.
- **A `ci-guard-raw-sql` allow-list entry was deleted, not re-keyed.**
  `posting.service.ts:215` moved under this phase's +35 lines, and re-reading it
  the way CLAUDE.md §14 asks found the justification *already dead*: it said
  *"`user_details` has no `companyId` column"*, which stopped being true on
  2026-08-20, and the query has bound it ever since. Its only remaining effect
  was to exempt whatever query drifted onto line 215. Verified by removing it —
  still green. **Re-reading a key means asking both *is this still the
  statement?* and *does that statement still need an exemption?***

#### Why P2b‑3 split into three

The same argument the two splits before it used. P2b‑3 as written was D6 **plus**
the Ledger module's CRUD and `app-ledger-picker` **plus**
`resolveSystemGroup` → `resolveStatutoryLedger` **plus** the import module — and
D6 is the only part of that which touches the **write path of the busiest write
in the product**. Landing it beside a new frontend picker would have put a
figure-moving risk and a UI change in one commit, which is the thing P2b‑2's
gate was structured to prevent. One phase, one gate, nothing else in the commit
to confuse a difference.

---

### P2b‑3b record — 2026-08-28

**The chart of accounts gets an API, and the statutory legs stop asking a
correspondence.** 18 routes over `acc_groups` and `acc_ledgers`;
`resolveSystemGroup` → `resolveStatutoryLedger`; three pure rules for the moves
that can restate a figure someone has already read.

| | |
|---|---|
| Routes | 18 — `/acc-groups` (10), `/acc-ledgers` (8) |
| Parity diff across the change | **empty** |
| `qa:p2-ledgers` | **312/312**, with ten new properties |
| `npm test` | 1,840 in 124 suites |
| New permission key | **one**, `acc-ledgers`, covering both tables |

| Artefact | What it is |
|---|---|
| `acc-group.service.ts` + controller | The tree's CRUD. Create derives `path`, `depth` and `nature` from the parent; `reparent` rewrites all three for the **whole subtree** in one transaction. |
| `acc-ledger.service.ts` + controller | The leaf's edit surface — rename, code, the two reserved flags, deactivate, move, delete. **No create** (below). |
| `ledger.const.ts` `describeGroupReparentBlock` · `describeGroupDeleteBlock` · `describeLedgerMoveBlock` (+ 16 specs) | The three refusals, pure, so the picker, the API and the gate ask one question. |
| `PostingService.resolveStatutoryLedger` | The statutory head as **both halves** — `{ trxGroupId, ledgerId }` — resolved by `acc_ledgers.systemKey`. Used by the tax, GST-component, RCM, payroll, salaries-payable, closing-stock and opening-balance-equity legs. |
| `ledger-resolution.ts` `insertLedger` | Now carries the head's `systemKey` onto a ledger it provisions. It wrote `NULL` until this phase, because nothing read the column. |

#### ⚠️⚠️ Creating a ledger is deferred to P3, and that is a measurement

§3.3 puts ledger create/alter in P2. Building it surfaced a constraint the plan
had not: **while the reports still render the legacy chart, a ledger nothing
places has no presentation head.** `presentationGroupId` has exactly two
branches — a `legacyTrxGroupId` *is* the head, and a party ledger reports under
the control head of its side — and answers `null` for anything else,
deliberately, so an unplaceable ledger fails a census rather than landing its
money in a row nobody posted to. The reports inner-join on that head, so a
brand-new ledger's figures would **disappear from every statement**, silently,
with the books still balancing.

The three ways out were each worse than waiting:

- **Reuse `legacyTrxGroupId` as a presentation pointer.** It is **1:1** — it is
  D5's third precedence rule, and `qa-p2-ledgers` (1b) asserts no head has two
  ledgers — so two ledgers sharing one makes resolution ambiguous.
- **Add a `presentationTrxGroupId` column.** Inventing schema to serve a
  transitional rule that **P3 deletes**.
- **Auto-create a `trx_groups` twin per new ledger.** A row in the table this
  programme is retiring, which P1's own gate would then report as an unplaced
  flat head.

So creation lands with **P3**, where a report's rows come from `acc_groups`.
Everything a person can do to the 1,351 ledgers that already exist is here.
`openingBalance` is absent for a neighbouring reason: D2 copied each legacy
head's figure onto its ledger and the *entry* is still posted from `trx_groups`,
so accepting it here too would post it twice, once per chart, with the trial
balance balancing throughout.

**The general shape is worth keeping.** §4.2's rule is that the migration does
not move a figure; the corollary nobody had written down is that **a new surface
must not be able to create something the presentation layer cannot render.** That
is the question to ask of every write P3 and P4 add.

#### The refusals are the feature, and the permissive halves are what make them rules

Three pure functions, and in each the interesting case is the one that is
*allowed*:

- **`describeGroupReparentBlock`** refuses a primary, a cycle, and a nature
  change **once the subtree has posted** — because `acc_groups.nature` is
  denormalised onto every descendant, so moving `Freight` from Direct Expenses to
  Current Assets re-signs every figure already posted under it, shifting money
  between the P&L and the Balance Sheet with both still balancing (D-19's
  forward-only doctrine, which this codebase has paid for twice). An **empty**
  subtree has nothing to rewrite, so that move is allowed — which is what makes
  it a rule about postings rather than about natures. And `isSystem` deliberately
  does **not** block a move: the seeded 28 are system rows because they may not
  be deleted or renamed away from the keys everything resolves by, not because
  their placement is sacred, and Tally lets an operator re-file them too.
- **`describeLedgerMoveBlock`** refuses a move that would change the ledger's
  **presentation head** once it has posted. For D2/D4's 536 ledgers the head is
  their own `legacyTrxGroupId` whatever group they hang under, so moving one is
  invisible to every statement — a blanket *"a posted ledger does not move"*
  would have refused a re-filing that changes nothing. For a **party** ledger the
  head follows the group, so moving one between Sundry Debtors and Sundry
  Creditors is D3's declared parity exception happening again, one party at a
  time, with no plan row and no human review behind it. The "would it change"
  question is answered by running `presentationGroupId` **twice** rather than by
  a rule of its own: the reports and this refusal have to agree about where money
  appears.
- **`describeGroupDeleteBlock`** reports children before ledgers before
  structure, because both FKs it protects are `RESTRICT` — a delete that got past
  it surfaces as a 409 naming a constraint rather than a problem an operator can
  act on.

#### 🔒 One permission key, and the shared read that §3.3 flagged before it existed

`acc-ledgers` covers **both** controllers. A group and a ledger are two halves of
one screen, and a role that may edit the tree but not its leaves is a grant
nobody would make on purpose; two keys would also mean two rows to decide per
role for a screen that has not shipped.

Both list surfaces are `@SharedRead({ parties: false })` — every module's voucher
screen picks a ledger, so they need the shared-read lane, and **a ledger list
carries bank account names, opening balances and every party's outstanding
position.** D-46/BUG-0031 is exactly the case where *"any authenticated user"*
quietly meant *"including the customer you are invoicing"*: 38 endpoints answered
a party, among them the company's bank accounts with their IFSC codes. §3.3 named
this route as the one to get right, before it existed. `SharedReadPartyGuard` is
global, and the regenerated inventory shows both routes with
`partyReadable=false`, so `shared-read-party.spec.ts` sweeps them the day the
stack runs.

#### The statutory seam was shown to fail, and the failure is worse than expected

`resolveStatutoryLedger` asks `acc_ledgers.systemKey` directly instead of walking
`legacyTrxGroupId` back to the head. Those answer the same ledger today, so the
only way to tell them apart is to break the correspondence: one company's
`IGST_OUTPUT` ledger had its `legacyTrxGroupId` set to `NULL` and a sales voucher
was re-posted in a rolled-back transaction.

- Under P2b‑3b the leg landed on **ledger #228, "IGST Output"** — the real
  statutory ledger, found by key.
- Under P2b‑3a's code the same injection **silently created a duplicate**,
  `"IGST Output (467)"` with a `NULL` systemKey, and posted the company's entire
  output IGST into it.

That second result is the argument for the seam, not just evidence of it: the
correspondence-based path **fails by inventing a ledger**, which is the failure
mode nothing downstream can detect — the entry balances, the trial balance
balances, and a second "IGST Output" appears in the chart of accounts.

⚠️ Which also explains the one-line fix beside it: `insertLedger` wrote
`systemKey: NULL`, harmlessly, for as long as nothing read the column. The moment
`resolveStatutoryLedger` gave it a reader, a ledger provisioned on demand for a
statutory head became invisible to the resolver — *"Statutory ledger not found"*
about a row sitting right there. **When you give a column its first reader, look
at every writer.**

⚠️⚠️ The two control heads are deliberately **not resolvable** through it and say
so: after D3 they hold one ledger per party and have none of their own (measured:
0 of 14 companies, against 14 for every other key). A plausible answer there
would put the whole of Sundry Debtors on one leg. The party legs keep
`resolveSystemGroup` for the head and let `persistLines` resolve the ledger from
the **party**, which is what they were already doing.

#### Ten new gate properties, three of them writes

(17) exercises the group tree — a created group's derived columns, a re-parent
rewriting a **subtree**'s paths, a cycle, a primary, a cross-nature move of an
empty subtree carrying its nature down, and a delete refused for its children.
(18) resolves all 21 statutory keys and asserts the two control heads are
refused. (19) moves a posted D2 ledger (allowed) and a posted party ledger across
control groups (refused). All rolled back, for check (12)'s reason.

⚠️ **Each refusal is asserted against its own message**, through a `refuses()`
helper that fails when the reason does not match. A bare *"it threw"* would be
satisfied by a 404 on a mistyped id or a unique-name clash — BUG-0015's standing
lesson in this repo: *a check that exists as a side-effect of an unrelated one is
not a check.*

---

### P2b‑3c record — 2026-08-29

**The import stops flattening the customer's chart of accounts.** F15's upside,
delivered, and the last slice of P2.

| | |
|---|---|
| Parity diff across the change | **empty** |
| `qa:p2c-import-tree` (new) | **227/227** over 14 companies, 19 properties each |
| `qa:p2-ledgers` | **326/326** — one new census, per company |
| `npm test` | 1,861 in 125 suites (+21) |
| Migrations | 2 — an enum widening, and a repair that **moved 33 ledgers** |
| Ledgers that would have been misplaced, per import of the real backup | **60 of 230** |

| Artefact | What it is |
|---|---|
| `src/const/import/import-group-tree.const.ts` (+ spec, **21 tests**) | The pure plan: which source groups **are** one of Tally's 28, which are the customer's own and must be created (**parents first**), and which cannot be placed at all. Plus `sourcePlacementApplies`, the three-way answer to *"may this kind of ledger be parented where the source put it?"* |
| `ImportCommitService.commitGroupTree` | The tree, committed once per batch **before** the ledger rows, in its own transaction. Reserved groups resolve by name; the customer's own are created through `AccGroupService.create`, so `path`, `depth` and the inherited `nature` have one definition. |
| `ImportCommitService.placeLedgerForHead` | The imported head's ledger, put where the source said. |
| `ledger-resolution.ts` `provisionLedgerForHead` | The head branch of `resolveOrCreateLedger`, extracted, with the placement as its **only** overridable input. |
| `20260828400000-import-resolved-acc-group` | `import_staging_masters.resolvedTargetType` gains `acc_group`. Group rows sat at `parsed` for ever before, because nothing committed them. |
| `20260828500000-ledger-nature-fallback-repair` | 33 ledgers out of Suspense A/c — below. |
| `scripts/qa-p2c-import-tree.ts` | The gate. Parses the real backup, stages it into a real batch, runs the real commit, reads `acc_groups` back, rolls everything back. |

#### What actually moves, measured on a real customer's books

`qa-artifacts/fixtures/tally/Master.json` is a genuine Tally Prime export — 314
messages, 50 Groups, 230 Ledgers. Two measurements from it shaped the phase:

- **It has zero custom groups.** Its tree *is* Tally's 28. So the celebrated
  half of F15 — *"the tree the customer arrives with can be preserved rather
  than reconciled"* — is real but was not what this customer needed.
- **60 of its 230 ledgers were landing in the wrong place**, because a head the
  import creates has no ledger until its first posting and then gets one from
  `fallbackGroupForNature`: 15 under Fixed Assets, 17 under Duties & Taxes, 7
  under Unsecured Loans, 3 under Capital Account, 3 under Loans & Advances, and
  so on — every asset one reported as a **current** asset. A factory building in
  current assets, on a Balance Sheet that balanced.

So the phase's value is in the **ledger** placement rather than in the group
creation, which is the opposite of what the plan expected, and is why the gate
carries both a real export and a synthetic subtree: the export proves the
placement, and only a synthetic tree exercises the create path at all.

#### ⚠️ `TrxGroupService.create` posts before it returns, so the placement had to MOVE

The first cut of `placeLedgerForHead` only ever *created* a ledger, and it was a
silent no-op. `TrxGroupService.create` posts the head's opening balance before
returning — statements are journal-derived, so the column alone would be
invisible to them — and that posting runs `persistLines`, which provisions the
ledger through `resolveOrCreateLedger` on its way. By the time the import states
a placement the ledger **already exists**, and `provisionLedgerForHead`
faithfully resolves it.

The move is safe by construction rather than by permission: the ledger carries
the head's `legacyTrxGroupId`, which is `presentationGroupId`'s first branch, so
no report's rows change. It is put to `describeLedgerMoveBlock` anyway, so the
import cannot make a move the Ledger module would refuse — and it is only
correct because **the head was created in this same transaction**. A ledger
somebody has since re-filed by hand is a decision, and an import does not
restate decisions already taken (D-19). A re-import of the same source ledger
takes `match-existing` and never arrives here.

**Property (9) of the gate is the only one that sees this**, and it exists
because the first version of the gate did not have it: (6) calls
`provisionLedgerForHead` directly, so deleting the whole of this phase's change
to the import left every other check green.

#### ⚠️⚠️ Two of the three ledger kinds are deliberately NOT placed from the source

`sourcePlacementApplies` returns true for a plain account head only, and each
refusal is a constraint rather than a preference:

- **A party ledger** would break the presentation. `presentationGroupId`'s party
  branch matches `groupId` against the two control groups **exactly**, not
  against their subtrees — that is what makes the branch unambiguous. A party
  under a customer's own `Sundry Debtors › Export` has **no presentation head at
  all**, and its money leaves every statement while the books balance. The same
  wall P2b‑3b hit when it tried to add ledger creation, and the same answer: P3.
- **An instrument ledger** is placed by its `AccountType`
  (`instrumentTargetGroup`, derived from `bookForAccountType` so an account
  cannot fall out of both a book and the tree), it is a **system** ledger, and
  `describeLedgerMoveBlock` refuses to move one: *"where it sits decides how
  statutory figures are reported"*. Honouring the source's bank sub-grouping too
  would be two rules for one placement, and the type has to win, because the
  type is what the cash and bank books read.

#### 🐞 The nature fallback read the wrong column, in both callers, and the gate agreed with it

`fallbackGroupForNature` switches on the **`AccountNature` enum** — `'Asset'`,
`'Liability'`, `'Income'`, `'Expense'`. Both callers asked the database for
`trx_natures.name`, which is the display **plural** (`'Assets'`), so every arm
missed and the `default` answered: **`Suspense A/c`**, for every fallback-placed
head whatever its nature.

All **33** fallback-placed ledgers on the development database were there, and
every one carries a real nature — 14 a retired `Party Payment` head that belongs
in Indirect Expenses, 19 an orphaned instrument's backing group that belongs in
Current Assets. Every balance is `0.00`, and
`presentationGroupId` reads `legacyTrxGroupId`, so **no report was wrong** — and
every one of them would have been a wrong row in the Balance Sheet and the P&L
the day P3 renders `acc_groups` instead.

Three things worth carrying out of it:

- **The parity gate could not have caught this.** §4.2 compares reports, and no
  report reads `groupId` yet. A defect that is invisible until a later phase
  needs a **census of the data**, which is what `qa-p2-ledgers` (4c) now is.
- ⚠️ **`qa-p2-ledgers`' own restatement of the placement rule read `n.name`
  too**, so it agreed with the defect and could not see it. That is the mirror
  problem inside a gate: *a check that restates the code by copying the code's
  query is a check that cannot fail*. (4c) asks a question about the **rows**
  instead — *is any ledger in Suspense A/c with a nature of its own?* — and has
  no way to inherit the mistake.
- **`Suspense A/c` is reachable only as that `default` arm** — nothing in
  `TRX_GROUP_TARGET` maps into it — which is what makes the repair unambiguous
  and the census exact.

#### Two injected regressions, both reproduced

- **Create-only placement** (the first cut): the specimen ledger lands in
  **Current Assets (92)** rather than **Fixed Assets (90)**; (9) and (9b) both
  fail and name the groups. Every other property stays green, which is the point.
- **Source order instead of parents-first** in `planGroupTree`: the unit spec
  fails, the gate's (2b) fails naming `CNC Machines → Plant & Machinery`, and the
  commit refuses loudly — *"group \"CNC Machines\" names parent \"plant &
  machinery\", which was not created first"* — rather than orphaning a subtree.

#### What P2b‑3c deliberately did NOT do

- **The voucher import was already correct and needed no repointing.** §5's plan
  says its 13 `trxGroupId` references *"must repoint inside P2"*; D6 is what
  answered that, by deriving `ledgerId` in the **one writer of each table**. So
  `ResolvedVoucherLedger.kind: 'group'` stays: a caller stating a ledger id is
  exactly what D6 forbids (`ledgerId` is on no DTO, §4.1 D6), and the GL-only
  `imported-journal` path resolves through `persistLines` like every other
  posting. Nothing to do is a finding, not an omission.
- **It does not re-file a ledger that already exists** for a head the import
  merely matched. That is `describeLedgerMoveBlock`'s question asked with no
  human behind it.
- ⚠️ **P1's grouped Trial Balance still places an imported head by nature**
  (`reports.service.ts` — correctly, off `accountNature`), so an imported Fixed
  Assets head appears under Current Assets *there* while its ledger sits under
  Fixed Assets. A transitional discrepancy between the optional grouped view and
  the tree, for exactly as long as P3 takes: that report's rows come from
  `acc_groups` afterwards and the two become one answer. Recorded rather than
  patched, because patching it would give the placement a second definition.

---

### P3a record — 2026-08-29

**The two reports §3.10 calls *new* exist**, and they are the first thing in this
programme that reads the new chart with no transitional rule in the path.

| | |
|---|---|
| Parity diff across the change | **empty** |
| `qa:p3-ledger-report` (new) | **154/154** over 14 companies — 1,351 ledgers, 350 walked month by month, 392 groups |
| `npm test` | 1,889 in 126 suites (+28) |
| `qa:p2-ledgers` · `qa:p1-group-tree` · `qa:p2c-import-tree` | 326 · 126 · 227, all green |
| Migrations | **none** — this phase adds no column and no table |

| Artefact | What it is |
|---|---|
| `src/const/ledger-report.const.ts` (+ spec, **28 tests**) | Everything that decides what a reader sees: the month buckets, a month's closing balance and its side, the Particulars column, and the subtree roll-up. |
| `ReportsService.ledgerReport` | One ledger: opening, a row per month with the balance it closed at, period totals, closing. |
| `ReportsService.ledgerVouchers` | The drill from a month row — the vouchers, with a running balance and the contra ledger named. |
| `ReportsService.groupSummary` | A group's children — sub-groups carrying their whole subtree, ledgers carrying their own — plus the group's own total. |
| `GET /reports/ledger/:ledgerId` · `…/vouchers` · `GET /reports/group-summary/:groupId` | Three routes, all on the existing `reports` key. |
| `scripts/qa-p3-ledger-report.ts` | The gate. Fourteen properties, every one a question about the **rows**. |

#### Why the new reports come before the statements are re-shaped

P3's headline is the Trial Balance and the Balance Sheet becoming trees of
`acc_groups`, which is the step that changes what a report **looks like**. These
two change nothing that already renders: they are additive, and the parity diff
across them is empty by construction.

That ordering buys one specific thing. A report that reads the new chart
directly, standing beside the statements that still read the legacy one, is a
**second derivation of the same figures** — and the gate's property (6) is the
two of them meeting: Σ of the ledger closings that present under each legacy
head, against that head's own closing on `trialBalance()`. It ties across **59
heads on company 28 alone**. When P3b repoints a statement, that equality is
already known to hold, so a difference afterwards is the repointing rather than
a question about which side was right all along.

Same argument that split P2b‑1 out of P2b and P2b‑3a out of P2b‑3, applied one
phase later: **the additive half first, and then the figure-moving half alone
with the diff as its whole gate.**

#### ⚠️ An additive report has nothing checking it, which is why the gate exists

`qa-coa-parity` compares a report against its own earlier self. **A report with
no earlier self passes it by being absent from both sides** — so the empty diff
above is a statement about the *other* reports and says nothing at all about
these two. That is the trap this repo already knows in another form: §6.4's
lapsed `FileCategory` contract, *a mirror rule that cannot fail is worse than no
rule, because it reads as coverage.*

So the fourteen properties are the actual gate, and they are deliberately
written as questions about the **rows** rather than restatements of the
service's SQL — P2b‑3c's lesson, where `qa-p2-ledgers`' own restatement of the
placement rule copied the code's query, agreed with the defect and could not
fail. The oracle here is one `GROUP BY` over `journal_lines` with no report code
near it, and `liveEntrySql`'s *"this entry did not happen"* rule is **restated**
in it rather than imported, for the same reason.

Three of the fourteen are worth naming:

- **(6) the new report against the old Trial Balance**, above. The other
  thirteen check the new reports against themselves.
- **(9) a drill-down never changes a figure.** A child group's row on its
  parent's summary equals that child's own total when you step into it. That is
  what §3.10's *"four clicks from every leaf"* means in practice, and it is the
  property a per-report drill-down link would break silently.
- **(8) total = Σ(child groups) + Σ(child ledgers)**, on every group. BUG-0043's
  rule — a card and the breakdown drawn under it must count the same rows —
  applied to the report whose entire job is being a breakdown.

#### Two injected regressions, both reproduced

- **Empty months dropped** from `buildMonthRows` (the obvious "tidy": emit only
  the months something happened in). Property (5) fails and names the ledger and
  the expected span. This is the property that separates a Ledger report from a
  `GROUP BY MONTH()`: a ledger with activity in April and June must show May at
  April's balance, or the column is a list of events rather than a balance
  history.
- **The Group Summary hiding ledgers with no postings** — equally plausible, and
  it is how a ledger falls out of the tree. Property (10a) fails: *"0 listed
  twice, 273 listed nowhere"* on company 28. The Σ properties stay green
  throughout, because a zero-balance ledger contributes nothing to any total —
  which is exactly why a census is needed beside them.

#### ⚠️⚠️ The month buckets are bounded by the DATA, and an absurd period is refused

`ReportsService` answers an omitted `from` with `1900-01-01` and an omitted `to`
with `9999-12-31`. Handing those to a monthly summary is ~96,000 rows of
nothing. The rule that landed is one sentence: **a stated bound is honoured; an
omitted one is clamped to the ledger's own first and last posting.** So a caller
who states a financial year gets its twelve months whether or not anything moved
in them — Tally's behaviour, and what makes the column readable — and a caller
who states nothing gets the months the ledger has actually seen.

`MAX_MONTH_BUCKETS` (600, fifty years) catches the remaining case, and it
**refuses with a message naming the limit** rather than truncating. A report
silently missing its later months is worse than one that says the period is too
long; property (14) asserts the refusal *against its own message*, so a 404 on a
mistyped id cannot satisfy it.

#### Three things established on the way

- **`particularsFor` is the count, not a `GROUP_CONCAT`.** The Particulars
  column is *the contra ledger's name when there is one, `(as per details)` when
  there are several* — Tally's own behaviour. The obvious implementation
  concatenates the contra names and counts them; `GROUP_CONCAT` truncates at
  `group_concat_max_len` **silently**, so a voucher with many contra ledgers
  would come back looking like one and print that single ledger's name as the
  whole other side of the entry. The count is exact whatever the names weigh.
  `particularsForCount` is defined **in terms of** the list rule rather than
  beside it, so there is one rule and not two that agree today.
- **The roll-up now has one definition.** `rollUpByPath` was lifted out of
  `groupedTrialBalance`, where it had been inline since P1, because the Group
  Summary needs the identical walk. Two copies of a subtree roll-up is the
  mirror problem this programme is about — and it means BUG-0023's
  trailing-slash argument (`/1/7/` must not collect `/1/70/`) has one place to
  be true, with a spec asserting exactly that case. Behaviour-identical: every
  value it sums is already rounded to the paisa, and `qa:p1-group-tree` still
  reports 126/126.
- **The Day Book and the cash book are deliberately still on the shadow.**
  P2b‑2 left two `trxGroupId` reads alive because they are **labels**, and
  moving them would relabel 5,393 lines to the *wrong* head's name on the way to
  the right one. That argument is unchanged, and this phase does not touch them
  — the new report is right from its first render because it has no earlier
  render to contradict. They move with the statements in **P3b**.

#### Why P3 split into four

Same shape as the two splits before it. **P3b** is the only slice that moves what
a customer sees — the Trial Balance becomes a tree with ledger leaves, the
Balance Sheet takes Tally's section order, and the two label reads cross over —
so it lands alone with the parity diff as its entire gate and nothing else in
the commit to confuse a difference.

**P3c** split again, into **P3c‑1** (the presentation layer retires) and
**P3c‑2** (ledger creation), and creation is second for a measured reason
recorded twice already (§3.3, and the P2b‑3b record): while any figure-bearing
report resolves through `presentationGroupId`, a ledger with neither a
`legacyTrxGroupId` nor a party has **no presentation head**, and its money would
leave every statement silently. Creation becomes safe on the day the last such
report stops asking — which is what P3b began and P3c‑1 finished, by retiring
the transitional rule from the party statement, the two Outstanding reports and
the Financial Dashboard, and the rule itself with them.

**P3d** is the drill-down spine — the shared `DrillTarget` resolver, Tally's
Esc-as-a-route-stack, and the `/transaction/ledgers` tree-plus-grid screen. It is
last because it is the only slice with no backend risk in it, and because the
three reports it navigates between all have to exist first.

---

### P3b record — 2026-08-29

**The statements are the tree.** The Trial Balance, the Balance Sheet and the
Profit & Loss now read `acc_groups` with `acc_ledgers` leaves; the Day Book's
line label and the cash/bank book's `particulars` crossed over from the
`trxGroupId` shadow to the ledger. This is the slice that changes what a
customer sees, and it landed alone.

| | |
|---|---|
| Parity diff across the change | **empty** |
| `qa:p3b-statements` (new) | **309/309** over 14 companies — sixteen properties |
| `npm test` | 1,906 in 127 suites (+17) |
| `qa:p1-group-tree` · `qa:p3-ledger-report` · `qa:p2c-import-tree` | 126 · 154 · 227, all green |
| `qa:p2-ledgers` | **325 of 326** — see the ⚠️ below; it fails with the phase stashed too |
| `check-mirrors` · five guards · `lint:ci` · `build` (both repos) | green |
| Migrations | **none** — this phase adds no column and no table |

| Artefact | What it is |
|---|---|
| `src/const/statement-tree.const.ts` (+ spec, **16 tests**) | Which side of the Balance Sheet a group falls on, which column of the P&L, how the Profit & Loss A/c line is built, and a node's presented figures. |
| `ReportsService.trialBalance` · `.balanceSheet` · `.profitAndLoss` | The three statements, off one aggregate (`ledgerFigures`) and one roll-up. |
| `.ledgerTrialBalance` | §3.10's **Ledger-wise** toggle — the one statement that returns every leaf, because that is what it was asked for. |
| `.legacyTrialBalance` · `.legacyBalanceSheet` · `.legacyProfitAndLoss` | The flat reports, unchanged, **unrouted**, kept for one release as the parity anchor. They retire with the presentation rule in P3c. |
| `GET /reports/trial-balance?view=ledger` | The toggle on the wire. An unrecognised `view` is the grouped report, not a 400. |
| `?view=legacy` on the three routes | The flat report, on a URL, for one release — see below. |
| `scripts/qa-p3b-statements.ts` | The gate. Sixteen properties, every one a question about the rows. |
| `components/shared/statement-tree/` + the three screens | Collapsed by default, expanding to sub-groups and then to ledgers through `GET /reports/group-summary/:groupId`. |

#### ⚠️ One earlier gate went red, and not because of this

`qa:p2-ledgers` (8b) — *"the movement equals what `party_ledger_plan`
declared"* — now reports **325 of 326** on the development database: one party
of company 28 has gained ₹5,25,960 on the control head it was **not** parented
to, so the resolver's figure no longer equals the frozen `displacedBalance`.

It fails identically **with this phase stashed**, which is how it was checked
rather than argued: P3b writes no `journal_lines` and no `party_ledger_plan`
row, and the reports are read-only. What moved is the QA world — new party
vouchers landing on the other side after D3 froze the plan (§4.1 D3: after the
migration the row is *the record of a movement that happened*, deliberately not
refreshed).

So the check as written can only stay green on a book nobody posts to, which is
worth deciding about rather than re-deriving next time it goes red: either it
compares against the ledger's own `groupId` (what actually happened) rather than
against the frozen column, or it is scoped to lines that predate the plan. **P3c's
call** — it is P2's gate and its semantics are P2's to change.

#### The gate is the diff AND a script, and neither would do alone

The user-facing half of this phase is a **shape** change, so the plan's own
instruction was to say which it is before capturing. It is neither, in the end,
because the flat statements did not go anywhere: they are still computed, byte
for byte, as `legacy*`, and the harness captures **those**. So the parity diff
across P3b is **empty** — no figure moved in the derivation a customer is
reading today — and the tree is tied to that derivation figure by figure by
`qa-p3b-statements`, head by head, on every company.

That is the same *two derivations meeting* the programme has used since P2b‑1,
and it is what the P3a record predicted P3b would need. What it buys, concretely:
property (4) of the gate reproduces every legacy head's closing from the ledgers
the tree files under it — so **a ledger routed to the wrong group is caught even
though every total still adds up**, which is exactly the failure a diff of
totals cannot see.

⚠️ **A report the harness has never seen passes it by being absent from both
sides.** The three tree payloads are new; the empty diff says nothing whatever
about them. §6.4's rule again — *a mirror rule that cannot fail reads as
coverage* — and the reason P3a needed its own gate too.

#### Two figures moved on the Balance Sheet, and both are decisions

Neither is in the parity diff, because the flat sheet still answers what it
always did. Both are what a customer will see change, so both are named here:

- **The four GST input heads move from Assets to Liabilities**, ₹1,54,85,553.06
  across the fourteen companies — Tally parents Duties & Taxes under Current
  Liabilities and nature is inherited (§3.3). This is P1's declared shift,
  arriving on the sheet for the first time. Both totals fall by exactly it, so
  the sheet still balances — which is why *"does it still balance?"* is not a
  substitute for property (10b), which asserts the two totals against the flat
  ones less that figure.
- **A loss moves to the Assets side.** The flat sheet folded the period's result
  into the liabilities column whichever way it went, so a loss printed there as
  a negative liability. The tree places the Profit & Loss A/c by the sign of its
  own balance, which is what Tally shows. On company 28 that is
  ₹2,55,64,403.06 — a third of the sheet — and it is the reason the two sheets'
  totals differ by more than the nature shift.

And the sheet carries the **Profit & Loss A/c as two lines**, brought forward
and this period, split at the financial year covering the date (§3.10). A book
with no year covering it carries the whole balance as `current` rather than
having a boundary invented for it; the two lines add to the same total either way.

#### The label crossover is masked in the capture pair, on purpose

13,471 of the development database's 41,690 journal lines change what the Day
Book calls them, and 3,178 of the books' 4,128 lines change `particulars`. Three
ways to declare that were available and two of them are traps:

- **One allowance per changed path** is tens of thousands of entries — the *list
  nobody could review* that §4.2 warns is an exception that has stopped being one.
- **One allowance per distinct `head → ledger` pair** is 691 entries and reads
  reviewable, and every one of them would have been derived by re-running the
  report's own query. That is P2b‑3c's lesson exactly: a gate that restates the
  code by copying the code agrees with the defect and cannot fail.
- So the harness gained **`--mask-labels`**, which records those two fields as a
  marker in both captures. **Every figure beside them is still compared**, per
  line; what is masked is a label. Whether each label is *right* is a question
  about the rows, and properties (13), (14) and (15) ask it there — against
  `acc_ledgers.name` for the Day Book, and by asking whether a `particulars`
  value is a name that exists at all for the books.

The flag is per-run and is **not** the default: it exists for the P3b pair, the
snapshot records whether it was in force, and `diff` refuses a mixed pair rather
than reporting the mask as thousands of rows removed.

⚠️ **A Day Book line was being keyed by its LABEL** in the parity snapshot,
which is stable exactly until a label changes. It now carries `lineId` — an id
it has had all along — and `parity-snapshot.const.ts` keys on it. Without that,
every relabelled line would have read as one row removed and another added,
**taking its figures with it**, which is the diff nobody reads that the
identity rule exists to prevent.

#### Three things established on the way

- **Placement stopped being a name match.** P1's grouped Trial Balance placed
  each flat head onto the tree through `targetGroupFor` plus a nature fallback,
  because nothing else said where a head belonged. `acc_ledgers.groupId` says
  now, so `retired` and `fellBackToNature` are gone with the guessing. What
  survives is `unplaceable` — a ledger whose group row is missing, which the
  foreign key makes impossible and which is listed so that "impossible" is
  observable rather than assumed.
- **The statements return groups; the leaves are fetched.** A company with 5,000
  parties has 5,000 ledgers (R3), so expanding a group calls
  `GET /reports/group-summary/:groupId` — the report P3a built for exactly this
  step, and the reason property (6) can assert that *stepping into a group never
  changes its figure*.
- **The shared tree component lists `reports.shared.scss` among its own
  `styleUrls`**, first. Angular's emulated encapsulation stamps every rule with
  the component that declared it, so `.report-table td` written in a screen's
  stylesheet does **not** reach rows rendered by a child component — the cells
  come out unpadded and left-aligned inside a table that looks correct either
  side of them. Sharing the file rather than copying ten lines of table CSS is
  what keeps one definition of what a report row looks like.

#### What P3c inherits

The presentation rule now has **three** callers left — `party-statement.service
.ts`, `trx.service.ts`'s two Outstanding reads and `financial-dashboard.service
.ts` — plus the three `legacy*` statements and the harness block that captures
them. P3c moves the first three onto `acc_groups`, deletes the rest, and only
then may `AccLedgerService` gain the `create` §3.3 asked for: while any
figure-bearing report resolves through `presentationGroupId`, a hand-created
ledger has no presentation head and its money leaves that report silently.

⚠️ **`qa-artifacts/tests/reports/` still restates the FLAT statements**, and
reaches them through **`?view=legacy`** — 41 call sites, wrapped in one helper
(`legacyStatement`) that carries the whole argument. Its oracle is Σ over
`journal_lines` by presentation head, which is exactly what that view answers
and exactly what the three routes stopped answering by default. Those specs, the
`legacy*` trio and the parameter retire together in P3c; porting 10,280 lines to
the tree now and again when the presentation rule goes is work nobody gets back.

Two things were found doing it, and both are the shape §13 keeps recording:

- **A check that could no longer fail.** `tests/security/injection.spec.ts`
  compared `sections` between a control read and an injected one to prove the
  date is bound. The tree has no `sections`, so both sides were `undefined` and
  the assertion passed while measuring nothing. It reads `nodes` now, and
  asserts the control returned some — *a rule that cannot fail reads as
  coverage*, §6.4, in a security spec this time.
- **The suite was already red.** 25 of its tests fail on `main` before P3b —
  measured by stashing the phase and re-running — and every one of them still
  fails for its own reason. P3b's own 24 were all shape, and are what the view
  parameter answers.

---

### P3c‑1 record — 2026-08-29

**The presentation layer retired.** `ledger-presentation.const.ts` is deleted,
and with it the three `legacy*` statements, `?view=legacy`, the Trial Balance's
`natureShift` annotation and the parity harness's exception generator. The last
three product callers moved onto `acc_groups`, the Group Book took the tree's id
space, the Financial Dashboard's two panels stopped describing the flat chart,
and `qa-artifacts/tests/reports/` — 10,314 lines whose oracle was Σ by legacy
head — was ported to the tree.

| | |
|---|---|
| Parity diff across the change | **empty**, over everything that is still the same report — 803,098 paths compared per figure, seven declared re-basings |
| `npm test` | 1,892 in 126 suites |
| `qa:p1-group-tree` · `qa:p2-ledgers` · `qa:p2c-import-tree` | 56 · 325 · 227 |
| `qa:p3-ledger-report` · `qa:p3b-statements` | 140 · 323 |
| `qa-artifacts` `qa:reports` | **203 passed · 8 failed** against **186 · 25** on `main` — measured by stashing the phase, restarting the backend and re-running, and the eight are a strict subset of the twenty-five |
| five guards · `check-mirrors` · `lint:ci` · `build` (both repos) | green |
| Migrations | **none** — this phase adds no column and no table |

#### P3c split in two, and creation is second

Same argument as the four splits before it, with the order reversed for a
reason the plan already records twice (§3.3, the P2b‑3b record): ledger
**creation** is blocked until the retirement lands, because while any
figure-bearing report resolves through `presentationGroupId` a hand-created
ledger has no presentation head and its money leaves that report silently. So
**P3c‑1** is the retirement — the slice that can move a figure — and **P3c‑2**
is `AccLedgerService.create` and its gate, which is additive.

#### ⚠️ The harness's own question changed, and that is the phase

`qa-coa-parity` was built to ask *"did a figure move as the mechanism changed
underneath a report whose shape is fixed?"* — and it answered that question
seven times, from P1 to P3b, by capturing the FLAT statements either side of
every change. Deleting the presentation rule deletes the flat derivation, so
there is no longer a fixed shape to hold the tree against. **That question is
finished**: the mechanism change is complete, every step of it was gated, and
from here the harness asks the ordinary one — *did anything move between these
two builds?* — of the reports a customer actually reads.

Three consequences, all of them decisions rather than side effects:

- **`diff --rebased <prefix>` is new, and it is NOT an allowance.** An allowance
  says *"this figure moved, and here is why"* — a statement about the books,
  judged per path. A re-basing says *"this report is not the same report on the
  two sides"*, which is a statement about the tape measure: a pair straddling
  P3c has the flat Trial Balance on one side and the `acc_groups` tree on the
  other, and diffing them reports tens of thousands of rows added and removed,
  taking every figure with them. The paths under a declared prefix are dropped
  from **both** sides, the count dropped is printed rather than swallowed, and a
  prefix matching nothing **fails** exactly as an unmet allowance does.
- **Seven prefixes were declared and no eighth was needed**, which is the
  measurement: `trialBalance`, `profitAndLoss`, `balanceSheet`,
  `groupStatements`, the dashboard's `natures` and `topGroups`, and
  `meta.groups` — the harness's own census of which chart it enumerates. The
  diff over **everything else** is empty: both Outstanding reports, every
  party's summary, statement and pending bills, the Day Book, the registers, the
  cash and bank books, the daily cash reports, the dashboard's summary and
  account panel, and all three balance caches.
- **`exceptions` retired with the reports it named.** Every path it emitted was
  a row of a flat statement — a Trial Balance section keyed by
  `trx_natures.accountNature`, a Balance Sheet row keyed by a `trx_groups` id —
  so it could only emit allowances matching nothing, which `judge` fails,
  correctly and confusingly. It has no successor because it has no remaining
  job: the movement it declared was applied and diffed at P2b‑2. The note where
  it stood records what it was and why a later phase wanting one should write
  its own rather than teach this one a third report shape.

#### The gates lost their second opinion, and each one says what it does now

Every tie in the programme has been *two derivations of one figure meeting*.
Half of those derivations was the flat report, so five gates had to be re-based
in this commit. The pattern is the same in each: what was a comparison against
another REPORT becomes a comparison against **Σ over `journal_lines`**, restated
in the gate — which is the discipline `qa-artifacts` has always used and which
does not depend on a second report being right either.

| Gate | Was | Is |
|---|---|---|
| `qa-p3b-statements` (3) | Σ debit/credit/net identical to the flat report | identical to Σ over `journal_lines` |
| `qa-p3b-statements` (4) | **head by head** against the flat closing | **ledger by ledger** against that ledger's own Σ |
| `qa-p3b-statements` (10) | the sheet reconciled to the flat one, less the nature shift and the moved loss | the two movements as **placements** — the four GST input ledgers on the liability side, the P&L A/c on the side its own balance takes — plus each side totalling its own sections |
| `qa-p3b-statements` (11) | P&L identical to the flat report | P&L against Σ for the Income- and Expense-natured groups |
| `qa-p1-group-tree` (3)(4) | the tree's totals, overall and per nature, against the flat report | **retired** — the questions moved to `qa-p3b-statements` (3) and (10); restating them here would be two scripts deriving the same Σ from the same rows |
| `qa-p3-ledger-report` (6) | Σ ledger closings by legacy head vs the flat Trial Balance | Σ by **group** vs the Trial Balance node's own `ownClosing` |
| `qa-p2-ledgers` (13) | the presentation rule is total, and its SQL restatement agrees with the pure one | every posting ledger is filed under one of Tally's 15 **primaries**, so its money is somewhere a statement walks |
| `qa-p2-ledgers` (19) | a posted ledger whose presentation head does not change may be re-filed | a posted ledger may be re-filed **within its own nature** |
| `qa-p2c-import-tree` (6b)(7) | a placed ledger still reports under its own legacy head; a party under a sub-group has no presentation head | the placement keeps the head's **nature**; a party under a sub-group is invisible to the four party-side reads |

The numbering gaps in `qa-p1-group-tree` are left in place deliberately, so a
reader looking for (3) finds out where it went.

#### ⚠️ `qa-p2-ledgers` (8b) was the one the plan asked P3c to decide

The P3b record left it open: it compared the resolver's measured movement
against `party_ledger_plan.displacedBalance`, a figure **frozen at migration
time**, and so could only stay green on a book nobody posts to — one party of
company 28 gained ₹5,25,960 on the control head they were not parented to and
the check went red for a reason that was not a defect.

Decided: it compares against **what actually happened**, derived a second and
independent way — one SQL statement over the stored `ledgerId` and the shadow
head each line was posted to, against the TypeScript resolver's own tally. The
plan row is *the record of a movement that happened* and is deliberately not
refreshed (§4.1 D3); where each party's ledger hangs is already (2c)'s question,
so what was worth a second opinion here was the **arithmetic**, and it is now
recomputed from the rows that exist today rather than from a column describing
the day the migration ran. 326 → 325 checks, all green.

#### Two figures move on the Financial Dashboard, and one of them is BUG-0043's rule

The dashboard's nature and group panels were the last two product surfaces
reading the flat chart, and moving them is what the phase's name means. Both are
declared re-basings above; what a customer sees change:

- **The nature panel's money moves by the GST-input shift** — the four input
  heads are Assets on the legacy chart and Liabilities on Tally's (₹1,54,85,553.06
  across the fourteen development companies), P1's declared shift arriving on a
  third surface after the Balance Sheet. `trx_natures` stays the row source: it
  is exactly four rows per company with no drift (F8), and it is the four
  natures' display names and `trxType`.
- **"Top groups" are `acc_groups` rows**, and each one's activity is its **own**
  ledgers' — not its subtree's, because a parent and its child would then both
  count the same line and a "top 20 by activity" list would fill up with
  ancestors.

⚠️ **The card and the breakdown had to be brought back into agreement, and the
port broke it first.** `totalGroups` still counted `trx_groups` while the panel
under it counted `acc_groups` — D-56's exact shape, *a KPI card and the
breakdown drawn under it must count the same rows* — and the spec that noticed
was `qa-artifacts`' own, not a review. It counts the tree now. The two still
differ by exactly the **nature-less** groups (Tally's Suspense A/c and Branch /
Divisions carry no nature deliberately, so no nature row can claim them), and
that difference is asserted against the rows rather than allowed for.

#### The Group Book moved id spaces, and three callers had to move with it

`GET /reports/group-statement/:groupId` takes an `acc_groups` id, reports the
whole **subtree** by `path` prefix, and the third id space on that controller is
gone — `:ledgerId` on the Ledger report is the only other one left. What had to
follow it, and is worth knowing because none of it is in the service:

- the screen's picker, from `trx-groups/list` to a new `acc-groups/list` feed;
- the Transaction dashboard's funds cards, which deep-linked with the
  per-instrument backing group `trx_accounts` auto-creates (F5, F16).
  `getFundsSummary` now also answers `accGroupId` — the group the instrument's
  **ledger** hangs under — and the link is deliberately **wider** than it was:
  it opens the group every bank account shares rather than one account's own
  statement. The per-account drill is P3a's Ledger report, whose screen lands in
  P3d; until then the widening is visible (the Group Book names the group it is
  showing) rather than silent;
- two QA specs that picked "the busiest head" straight out of
  `journal_lines.trxGroupId`, which is now an id in a different space. Both
  answered **404**, which is the right answer and is exactly how a silent id-space
  change would have looked if the route had gone on answering.

#### `describeLedgerMoveBlock` became a rule about NATURE

It asked whether a move changed the ledger's *presentation head*, and that rule
permitted moving one of D2/D4's 536 ledgers anywhere in the tree — because its
`legacyTrxGroupId` decided where it printed whatever group it hung under. The
statements read the tree now, so where a ledger hangs **is** where it prints, and
the question that survives is `describeGroupReparentBlock`'s third rule one level
down: **a posted ledger may not cross an account nature**, because that re-signs
figures already reported (D-19's forward-only doctrine).

It keeps D3's protection through a rule that outlives the transition: Sundry
Debtors is an Asset and Sundry Creditors a Liability, so moving a posted party
between them is still refused. And it is deliberately *permissive* within a
nature — a posted ledger re-filed under a sibling group is a pure re-filing, and
a blanket "posted ledgers do not move" would have been the wrong rule.

#### The QA suite was ported, and the port is what found the rest

`qa-artifacts/tests/reports/` restated the FLAT statements — R1 of
`statement-rules.ts` read *"a ledger head is a `trx_groups` row"* — and reached
them through `?view=legacy` at 61 call sites. The oracle is the tree now:
`ledgerFigures` (Σ per ledger) and `groupFigures` (the same, rolled up by the
materialised `path`, with the terminator carried because `/1/7/` must not
collect `/1/70/`).

Two things fell out that are worth carrying:

- **Σ is taken over the LEAVES, never over the tree.** A parent's figure
  includes its whole subtree, so adding the nodes up counts every line once per
  ancestor. Three sums survive any regrouping — Σ period debit, Σ period credit,
  Σ net — and they are the only figures a grouped report may be held to
  identically; the closing columns are `max(net, 0)` over the primaries, so
  merging thirteen tax heads into Duties & Taxes legitimately changes them.
- **The party-facing oracles were still asking the legacy question**, and that
  is why twelve of `main`'s twenty-five failures were failing. They computed a
  party's position from the two `trx_groups` control heads — *which head was
  this line posted to?* — where every report answers *which group does this
  party's ledger hang under?* The two differ by the whole of D3's movement, per
  tenant. `party-rules.ts`, `agreement-rules.ts`, `dashboard-rules.ts` and
  `party-statement.spec.ts` all read the tree now.

⚠️ **The suite is not green, and the honest number is the one measured on
`main`.** 25 fail before this phase and 8 after, and the eight are a **strict
subset** of the twenty-five — checked by stashing the phase, restarting the
backend and re-running, then diffing the failing set by name. What is left is
the same family one layer out: fixtures and party-facing oracles outside
`tests/reports/` that assume a party is a debtor, written before D3 gave a party
one ledger on one side.

Two of them were fixed on the way and are worth naming, because both were an
oracle **encoding the pre-D3 world in an arithmetic** rather than in a query:

- **`Math.max(receivable, payable)`** read a party's control balance. Exactly one
  of the two is non-zero after D3 and either can be **negative** — a party who
  has paid us more than they owe carries a net advance on their own side — so
  `max` picked the zero from the other side and reported a real ₹17,16,889 as
  ₹0. It is a sum now.
- **Which parties are "single-sided"** was read off the LEDGER, and D3 made that
  the wrong question: every party has one ledger under one group now, so *every*
  party reads as single-sided there while their documents may still have two
  sides. It is asked of `trx` — did this party both buy and sell? — which is
  what the annexure under test is built from.

And one reconciliation had to be **netted**: R6 held a party's receivable against
their sales-side documents and their payable against their purchase-side ones,
separately, which is only well-posed while a party has a position on each head.
The statement that survives is stronger — *the party's single ledger net is their
sales side less their purchase side, plus the opening nothing documents* — and it
held on all 187 of alpha's parties where the pair it replaced failed on 22.

#### What P3c‑2 inherits

Nothing blocks ledger creation any more: no figure-bearing report resolves
through a presentation rule, so a ledger created under any group appears on the
Trial Balance under it. `AccLedgerService` has `update`, `move`, `remove`,
`findOne` and `findAll` and no `create`; the class doc still explains why, and
that explanation is now history rather than a constraint — P3c‑2 replaces it
along with `POST /acc-ledgers`, its DTO, `groupAcceptsLedgers` at the seam, and
the gate §P3's entry names: *a ledger created through the API appears on the
Trial Balance, the Group Summary and the Balance Sheet.*

⚠️ **`openingBalance` is a separate question and is deliberately still absent.**
D2 copied each legacy head's figure onto its ledger and the *entry* is still
posted from `trx_groups` (`JournalSourceType.GroupOpening`); accepting one here
too would post it twice, once per chart, with the trial balance balancing
throughout.

---

### P3c‑2 record — 2026-08-29

**Ledger creation exists.** `POST /acc-ledgers` → `AccLedgerService.create`,
with `describeLedgerPlacementBlock` at the seam §3.3 asked for
(`groupAcceptsLedgers` is that rule as a predicate, for the picker, derived
rather than restated). `npm test` **1,896** across 126 suites; five guards,
`lint:ci`, `build` and `check-mirrors` green; the five gate scripts
`qa:p1-group-tree` **56**, `qa:p2-ledgers` **333**, `qa:p2c-import-tree`
**227**, `qa:p3-ledger-report` **140** and `qa:p3b-statements` **323** all
green; the parity diff over a real capture pair is **empty**, with no
re-basings.

#### ⚠️ "Unblocked" was true about the reports and false about POSTING

P3c‑1's record ends *"nothing blocks ledger creation any more: no figure-bearing
report resolves through a presentation rule, so a ledger created under any group
appears on the Trial Balance under it."* That is correct, and it is only half
the question. **Appearing on a statement and being postable are different
things**, and building this measured the second:

```
journal_lines.trxGroupId  INT NOT NULL   FK → trx_groups.id
```

The shadow D5 kept and D9 drops (§3.1 R2) is still `NOT NULL` behind a real
foreign key, and every voucher picker in the product still lists `trx_groups` —
`app-ledger-picker` is P4. So a ledger created in the new chart alone would have
rendered on the Trial Balance at nil, under the right group, and there would
have been **no way to post a rupee to it**: not a wrong figure, a master nobody
can use. Which is the worse failure of the two, because a wrong figure gets
filed and a dead master gets worked around.

So `create` writes **the pair** — an `acc_ledgers` row and a `trx_groups` head,
in one transaction, linked by `legacyTrxGroupId`, which is D5's third precedence
rule and therefore makes a line posted to that head resolve back to this ledger
by the rule that already exists rather than by a new one.

`AccLedgerService`'s own header had weighed the twin and rejected it — *"a row in
the table this programme is retiring, which P1's own gate would then report as an
unplaced flat head"* — and that argument was about **presentation**, which is
what P3c‑1 deleted; P1's gate asks about `acc_ledgers` placement and has no
flat-head property to fail. The reason to write the twin now is a different one
the note never considered. ⚠️ **A rejected option is rejected for a reason, and
when the reason retires the option has to be re-asked rather than left rejected.**

Three things make the twin an established shape here rather than an invention:

- `trx_accounts` has auto-created a backing `trx_groups` row per instrument since
  long before this programme (F5, F16) — `TrxAccountService.createBackingGroup`
  is what `createBackingHead` mirrors, including keeping the two names in sync.
- `ImportCommitService` already creates the same pair from the other side, and
  defaults a created head's `groupFor` to `Journal` exactly as this does.
- D9 deletes the twin half of every pair with the column that needs it. It is
  one release's scaffolding, not a second chart of accounts.

The twin is `isSystem`, which is a **lock rather than a claim**:
`TrxGroupService.update` and `.remove` both refuse a system row, so neither half
of a pair can be renamed or deleted on its own and the ledger is the only door.
It carries no `systemKey` — that is what `resolveStatutoryLedger` resolves the
seeded heads by (§4.1 D1), and minting one here would let a hand-made head
impersonate a tax head.

#### The lifecycle is the pair's, not the ledger's

Three writes had to follow it, and the third is the one that would have bitten:

- **Rename** syncs the head's name. Two names for one fact is an operator
  picking *"Printing & Stationery"* on a journal voucher and reading
  *"Stationery"* on the Trial Balance.
- **Restore** restores the head.
- ⚠️ **Delete deletes it, through both stages.** An orphaned legacy head is
  still listed by every voucher picker in the product, and posting to one whose
  ledger is gone does **not** fail — `resolveOrCreateLedger` provisions a fresh
  ledger for it, inside the posting transaction, by design. So a deleted account
  head would have silently come back the first time somebody used it, under
  whatever group the fallback chose, with the entry posting cleanly.

All three go through one `carryTwin` seam and all three ask `origin === user`
first: a D2 ledger's `legacyTrxGroupId` names a head somebody created in the
legacy master, and erasing that because its ledger was deleted would destroy a
row this service does not own.

#### 🔒 Two placements are refused, and the first is a report question

`describeLedgerPlacementBlock` answers §3.3's *"which groups accept a ledger"*,
and the honest answer is *almost all of them* — Tally allows a ledger under any
group, primaries included, and so does this. Two do not:

- **The two party control groups.** In this ERP a debtor or creditor ledger *is*
  a party (D3), and every report that answers *"who owes us what"* — both
  Outstanding reports, the party statement, the ageing annexure and the Business
  Dashboard's `partyPositions` — reads `journal_lines.partyUserId` with the
  ledger's parentage as the side. A hand-made ledger under Sundry Debtors
  carries no party, so its balance would sit on the Assets side of the Balance
  Sheet and appear in **no receivables report at all**: money nobody is chasing,
  with the sheet still balancing. That is the same class of defect this phase
  exists to close, one report over.
- **A group with no account nature.** Tally's two deliberately-ambiguous
  primaries carry none and `ledgerNature` propagates the null rather than
  guessing. `trx_natures.accountNature` is `NOT NULL` with exactly four values,
  so the twin would have to be filed under an invented nature — which decides
  which side of the Balance Sheet its money lands on. Refused. It is also the
  same answer `qa-p2-ledgers` (4c) already gives from the other end: a ledger in
  Suspense A/c with a nature of its own is a placement bug.

⚠️ **The rule is told what is being placed, not only where.** The first cut asked
only about the destination, and it broke `qa-p2-ledgers` (19b) — *a posted party
ledger cannot be moved to the other control group* — by refusing the move with
the create-time message. Both refusals are correct; only one describes the
problem. A party ledger belongs under a control group, so the arm asks
`ledger.isParty`, and moving a posted one across the two is refused where it
always was, by `describeLedgerMoveBlock`, whose message names the actual reason:
it re-signs figures already reported. **A refusal whose message does not describe
the problem is BUG-0015's tell**, and the gate asserting refusals against their
own messages is what caught it.

⚠️⚠️ It is deliberately **not** folded into `describeLedgerMoveBlock`, which is
the rule the **import** asks (`ImportCommitService.placeLedgerForHead`, P2b‑3c).
The import files a ledger where the customer's own Tally filed it; refusing there
would refuse an import for reproducing a chart that already exists in the
customer's books. This is a rule about the door a **person** comes in through,
and both by-hand doors — `create` and `move` — go through one helper.

#### The gate had to read inside its own transaction

§P3's gate for this phase is *a ledger created through the API appears on the
Trial Balance, the Group Summary and the Balance Sheet*, and asking it honestly
needed one thing the reports did not have. `qa-p2-ledgers` (20) creates a ledger,
posts a **real balanced entry** to it through `postJournalLines`, and follows the
rupees onto all three — then rolls everything back, which is (12)'s standing
rule: a gate that leaves a journal entry behind changes the books it is checking,
and the parity harness's next capture would see it. Reports read committed data,
so `trialBalance`, `profitAndLoss`, `balanceSheet` and `groupSummary` now take an
optional `Transaction`. Nothing there writes; every product caller omits it.

Three things about the property that are the point:

- ⚠️ **Money, not a name.** All three reports LEFT-join their aggregate from
  `acc_ledgers`, so a created ledger appears on them at nil *whatever happens* —
  a check that looked for the row would have passed on the very build where
  nothing could be posted to it. That build existed; it is what the section
  above measured.
- ⚠️ **The Trial Balance half is a DELTA.** A group normally carries other
  ledgers, so *"its closing equals the amount"* asserts something only on an
  empty one, and stops asserting anything the day somebody points the probe at
  Indirect Expenses. Baseline and after, read through the same transaction.
- **The statement is chosen by the group's own nature**, not hoped for. A check
  that looked only at the Balance Sheet would assert nothing at all whenever the
  probe landed on an expense group.

**Shown to fail, twice.** Dropping the twin (`legacyTrxGroupId: null`) fails (20)
and then (20c) with the reason stated — *it has no legacy head, so
`journal_lines.trxGroupId` has nothing to name* — which is the defect this phase
found, reproduced. And re-instating the shape of the retired presentation join in
`ledgerFigures` — a statement that only shows a ledger it can map back to a
legacy head — fails (20c) and (20e) while **(20d) stays green**, because the
Group Summary has its own query. That is why all three reports are asked
separately rather than one standing in for the others.

#### What P3d inherits

`POST /acc-ledgers` is the last backend piece of §3.3. What is left there is
frontend and belongs to P3d and P4: `/transaction/ledgers` (the tree-plus-grid
Chart of Accounts replacing today's three Masters screens), the drill-down spine,
and — P4's, because it is their only consumer — `app-ledger-picker` and `Alt+C`.

⚠️ **`openingBalance` is still absent**, and P3d does not change that either. D2
copied each legacy head's figure onto its ledger and the *entry* is still posted
from `trx_groups` (`JournalSourceType.GroupOpening`); accepting one here would
post it twice, once per chart, with the trial balance balancing throughout. It
moves at **D9**, with the head that owns it — the same release that drops the
twin.

---

### P3d‑1 record — 2026-08-29

**The drill spine exists, and the Ledger report has a screen.** A report row now
emits a **`DrillTarget`** — `group` | `ledger` | `voucher` — and one resolver
turns it into a URL; Tally's Esc-goes-back is a **route stack**; and P3a's
Ledger report, which had an API and no screen, is the middle of the journey:
Balance Sheet → group → ledger → voucher, and back out with each screen on its
own period.

| | |
|---|---|
| Parity diff across the change | **empty** (`p3d-before` / `p3d-after`, captured either side of the one backend line this phase touches) — no allowances, no re-basings |
| `qa:money` (new: `drill-spine.ui.spec.ts`, four properties) | **72 passed** — the four new ones green, and shown to fail four times |
| `npm test` (client-back) | 1,896 in 126 suites — unchanged, this phase adds no rule to `src/const/` |
| `qa:p1-group-tree` · `qa:p2-ledgers` · `qa:p3-ledger-report` · `qa:p3b-statements` · `qa:p2c-import-tree` | 56 · 333 · 140 · 323 · 227 |
| five guards · `check-mirrors` · `lint:ci` · `build` (both repos) | green |
| Migrations | **none** |

| Artefact | What it is |
|---|---|
| `client-front/src/utils/drill-target.ts` | The union and the **one** resolver. Where a `group`, a `ledger` and a `voucher` each live, and which postings have no screen at all. |
| `client-front/src/services/drill.service.ts` | The route stack: `drill()`, `back()`, `backOr()`, and the rule that a navigation nobody drilled empties it. |
| `client-front/src/directives/drill-back.directive.ts` | Esc, applied **once** to the reports layout. |
| `client-front/src/utils/report-period-url.ts` | A report's period in its own URL — `readPeriodParams`, `writePeriodParams`, and `periodDebounce`. |
| `components/admin/transaction/reports/ledger/` | The Ledger report screen: a row per month, expanding to its vouchers, each opening the voucher. |
| `qa-artifacts/tests/ui/money/drill-spine.ui.spec.ts` + `drill-rules.ts` | The gate, and the rule restated beside it. |

#### P3d split in two, and the half with a gate landed first

Same argument as the five splits before it. **P3d‑1** is the spine — the part
§P3's gate is written about (*"Balance Sheet → group → ledger → voucher …
back out with Esc preserving the period"*) — and it is measurable end to end
today. **P3d‑2** is `/transaction/ledgers`, the tree-plus-grid Chart of Accounts
that replaces the Masters screens: a master screen with no figure on it, whose
gate is a different question.

#### ⚠️ The parity harness cannot gate this phase, and neither can the backend

P3d‑1 changes **no query and adds no report**, so the parity diff is empty *by
construction* — it would be empty if the whole phase had been deleted. That is
§6.4's rule in a new place (*a mirror rule that cannot fail reads as coverage*),
and the same reason P3a needed a gate of its own.

What can fail here is a **journey**, and a journey is only observable by taking
one. So the gate is four properties in a browser, and each is a question about
what a reader can reach:

1. **Four screens, one click each.** Every click counted, from a Balance Sheet
   as-of a stated date down to the voucher. Reaching the leaf costs one click
   per group level — asserted to be *exactly* that, because the chart's own
   depth is not the spine's to add to — and from a leaf the voucher is three:
   the ledger's name, its month, the voucher number. The ledger screen must be
   **already loaded** on arrival, which is the half of "one click each" a URL
   cannot show. And the gate says *"from every leaf"*, so the count of drillable
   ledger rows is asserted against the count of ledger rows, and the same for
   the groups' own control — one journey is a journey, and the claim is about
   all of them.
2. **Esc walks back out, each screen on its own period** — from the URL *and*
   from the rendered date field, because a screen that ignored the parameter
   satisfies the first and not the second.
3. **A posting with no document is not offered as a link** — and not by
   counting: the same month is read from the API and every line put to
   `drill-rules.ts`'s own `voucherPath`, so the set of voucher numbers the
   screen offers has to equal the set the **restated** rule says has a
   document.
4. **A navigation nobody drilled clears the stack.**

**Shown to fail, four times**: deleting the stack-clearing rule (property 4),
making every voucher row a link (3), dropping the period from the drill (1, 2),
and making Esc a no-op on the reports layout (2).

#### ⚠️⚠️ One of those injections passed, and the property was the problem

Dropping the period from the drill left the gate **green** the first time it was
injected. The reason is worth carrying: the property asserted that the ledger
arrived with `?to=` equal to the sheet's as-of date, the busiest ledger's last
posting is **today**, and *today* is also what the ledger screen's own default
period (`this month`) puts in `to`. The assertion was true either way.

The fix is not a stronger assertion but a **date no default can produce**: the
leaf is now chosen from the busiest ledger's busiest month **strictly before
this one**. Re-injected, it fails on both properties.

This is the same shape §13 keeps recording — *a check that cannot fail reads as
coverage* — arriving through the **fixture** rather than through the assertion,
which is the harder half to see. A test whose data makes two different answers
identical is measuring nothing, and nothing about the assertion says so.

#### 🐞 The ledger list answered every call with a 500, and had no caller to notice
*(filed as [BUG-0068](qa-artifacts/docs/bugs/BUG-0068.md))*

`POST /acc-ledgers/list` — the feed §3.3 named by name, and P2b‑3b's own
*"the paginated master list, and the feed `app-ledger-picker` will read"* —
**500'd on every request** from the day it was built until this phase called it:

```
SequelizeEagerLoadingError: User is associated to AccLedger using an alias.
You've included an alias (deletedByUser), but it does not match the alias(es)
defined in your association (partyUser).
```

`acc_ledgers` and `acc_groups` are soft-deletable and carry **`deletedAt`
alone** — no `deletedBy` column, and so no `deletedByUser` association — while
`findAll` asked for both. Sequelize refuses an include whose alias the model
never declared, which is a 500 rather than a missing column.

Three things about it:

- **It is the shape §13 still-open #1 is about, in its purest form.** Nothing
  called the route between P2b‑3b and P3d, and `npm test`, five guards,
  `lint:ci`, `build` and every gate script were green throughout, because none
  of them issues an HTTP request. **An endpoint nothing calls is an endpoint
  nobody has run** — and a `@SharedRead()` feed is exactly the shape that
  acquires its callers all at once, so the first consumer finds it for
  everybody.
- **The fix is to stop asking for a column the table does not have**, not to add
  one. Who deleted a ledger is the audit trail's answer (`@Audit('acc-ledgers')`
  is already on the controller); the column would be a migration **plus** an
  edge in `company-hard-delete-order.const.ts`, because a `users.deletedBy`
  foreign key is `RESTRICT` and a missing edge refuses every hard delete
  (§4.1 D5's own lesson).
- It is the whole of this phase's backend diff, which is why the parity diff is
  empty over it: no captured report reads that route.

#### The period moved into the URL, and that is what makes Esc honest

The gate says *"back out with Esc preserving the period"*, and there were two
ways to hold a period: a stack frame remembering a component's signal, or the
URL. The second is one copy rather than two, and it falls out of what the drill
does anyway — so every report that can be a drill origin now reads its range
from the query string on arrival and writes it back on every change
(`replaceUrl`, and only when something changed).

Two things fall out, both wanted independently: **every statement is a link
somebody can paste**, and `back()` is a plain navigation to a stored URL rather
than a restore protocol.

⚠️ **And one bug fell out of it, which is worth naming because it is a shape
rather than a slip.** Every report debounces the period selector by 250 ms (a
custom range emits `from` and `to` as two events). Since this phase that
debounce *navigates* — and a timer that outlives its component navigates from a
screen the reader has already left: clicking another report's tab within the
window put them **back** on the ledger, because `relativeTo` a route that is no
longer active still resolves to it. `periodDebounce(destroyRef, …)` is the one
place that clears it, rather than the line four screens would each have had.

The same window produced the other defect the gate found: the Ledger report
loaded **twice** on arrival — once in `ngOnInit`, once from the selector's
`emitOnInit` — and the second load reset the expansion state, so a month opened
inside those 250 ms closed by itself. The first load is now the selector's, as
it already was on every other report here.

#### Esc is listened for in exactly two places, and that is the design

A single global listener in the service was the obvious shape and is wrong: the
last hop of the spine is a **voucher screen**, which already owns Esc for
closing the form, and two handlers for one key navigate twice.

So: `DrillBackDirective` on the reports layout — one application, covering every
report and any report added later — and the voucher screens' own `close()`
through `DrillService.backOr`. The second is better than intercepting Esc there
would have been, because it fixes the **Close button** in the same stroke: a
voucher reached by drilling now returns to the ledger it was opened from, and
one reached from its list still returns to the list. It also keeps
`pendingChangesGuard` in the path, so a dirty voucher is still asked about.

⚠️ A `.cdk-overlay-pane` on screen owns the key — a datepicker, a select panel,
a dialog — which is the rule the voucher entry screen already states for its own
listener (CLAUDE.md §9).

#### What P3d‑2 inherits

`/transaction/ledgers` — the tree-plus-grid Chart of Accounts replacing today's
Masters ▸ Nature and ▸ Group screens — is what is left of §3.3's frontend. Its
backend has been complete since P3c‑2, and its list feed works now.

Three things this phase deliberately did **not** do:

- **The Group Book's lines do not drill.** `groupStatement` returns each line's
  entry id but not the `sourceType`/`sourceId` pair a voucher is opened by, so
  the voucher leg of the spine runs through the Ledger report, which carries
  both. Adding them is a payload change **the parity harness captures**, so it
  is declared work rather than a quiet extra field.
- **The Day Book opens a ledger, not a voucher**, for the same reason and on the
  same payload — §3.10's row for that report asks for both, and the ledger half
  is free because P3b already put `ledgerId` on every line.
- **The Cash and Bank Books are still their own reports.** §3.10 says they
  *"become instances of the Ledger report"*, and that is neither P3d‑1's spine
  nor P3d‑2's master screen — it is a third thing: two screens a customer reads
  today, whose payloads the parity harness **captures**, replaced by a report
  that renders differently. It wants the treatment P3b had (land alone, declare
  what moves), and D-54's `bookForAccountType` derivation has to survive the
  swap so no account falls out of both books the way UPI once did. Recorded
  here rather than folded into P3d‑2 quietly.
- **The instrument master stays.** §3.3 describes `/transaction/ledgers` as
  replacing three Masters screens, and the third — Chart of Accounts, i.e.
  `trx_accounts` — is the **instrument** master: account numbers, IFSC, type,
  facts a ledger row does not model. It is re-homed with D9, not before.

### P3d‑2 record — 2026-08-29

**`/transaction/ledgers` exists: the Chart of Accounts is a screen.** The
`acc_groups` tree on the left, the selected group's `acc_ledgers` on the right,
create/rename/move/delete on both halves — and **every refusal the API makes is
made on the screen too, in the API's own sentence**, which is what P3's gate asks
for. §3.3's frontend is finished except for `app-ledger-picker` and `Alt+C`,
which belong to P4 because P4 is their only consumer.

| | |
|---|---|
| `qa:screens` (new: `chart-of-accounts.ui.spec.ts`, five properties) | **50/50** over the 29-route sweep, the five new properties among them — and the four refusal properties **shown to fail four times** |
| `qa:a11y` · `/transaction/ledgers` | green — the census in `tests/ui/masters/screens.ts` feeds the accessibility sweep, so the new screen was swept the day it landed |
| Parity diff across the change | **empty by construction** — the backend diff is one field on `GET /acc-groups/tree` (a route no captured report reads) and `@DeletedAt` on two entities, whose effect on a report is to exclude archived rows that do not exist. The five gate scripts above are what actually watched the second one |
| `check-mirrors` (new: check 10) | green — **182 behavioural comparisons over 21 region cases**, comparing the message TEXT, both failure modes reproduced |
| `npm test` (client-back) | 1,896 in 126 suites — unchanged; this phase adds no rule to `src/const/` |
| `qa:p2-ledgers` | **333/333** — including (20)'s create-and-post probe over the same two entities the paranoid fix touches |
| `qa:p1-group-tree` · `qa:p3-ledger-report` · `qa:p3b-statements` · `qa:p2c-import-tree` | 56 · 140 · 323 · 227 — unchanged, and re-run **because** the paranoid fix changes what every Sequelize read of those two tables returns |
| five guards · `lint:ci` · `build` (both repos) | green |
| Migrations | **none** — and the entity fix below needed none either: the `deletedAt` column was always in both tables; what was missing was the model saying so |

| Artefact | What it is |
|---|---|
| `client-front/src/components/admin/transaction/ledgers/` | The screen, and its three dialogs: `group-add-edit`, `ledger-add-edit`, `move-dialog` (shared by a group re-parent and a ledger move — two rules, one question). |
| `client-front/src/utils/ledger-rules.util.ts` | The five `describe*Block` refusals, mirrored. The **wording** is the mirrored thing. |
| `scripts/vectors/ledger-rules.vectors.json` + `check-mirrors.js` check 10 | The shared table, and the check that runs both implementations against it. |
| `client-back` `AccGroupService.tree()` → `AccGroupTreeNode` | Each node carries its own `ledgerCount` — the number `describeGroupDeleteBlock`'s sentence names. |
| `client-back` `acc-ledger.entity.ts` · `acc-group.entity.ts` | `@DeletedAt` on both, which is what makes a delete an **archive** — see the defect below. The rest of the backend is untouched. |
| `qa-artifacts/tests/ui/masters/chart-of-accounts.ui.spec.ts` + `coa-rules.ts` | The gate, and the sentences restated a third time. |
| `styles/custom/_coa-dialog.scss` | The dialogs' shared rules — **global**, for §14's `.jwd__full` reason. |

#### The refusal is the deliverable, so the wording is what the mirror compares

P3d‑2's gate is not *"the screen refuses"* — it is *"each with the message that
names the actual problem rather than a dead button"*. Those messages are the work
`ledger.const.ts` did: each one names the problem **and the alternative** (*add
the party instead, or use a sub-group*; *deactivate it instead — the entries that
name it must stay readable*; *create the group in the new place and use it going
forward*). A screen that refused correctly and said *"Not allowed"* would satisfy
every check in this repo and none of the gate.

So the mirror is compared **by message**, not by verdict:
`check-mirrors.js` check 10 loads both implementations, expands 21 hand-written
**region** cases into 182 rows (a case's `given` holds arrays, so one case is a
statement about a region of the fact space and the regions partition it exactly),
and asserts `client-back === client-front === the table's own sentence`. Three
answers, so a failure says which kind it is — and both were reproduced:

- shortening one sentence on the frontend only → **DRIFT**, 16 rows, printing
  both strings;
- deleting the control-group arm from **both** sides → **RULE CHANGED**, 16 rows,
  because the table states its own answer.

⚠️ **And check 10 still cannot gate this phase**, which is why the browser test
exists. Agreeing about a sentence is not showing it: a screen that computed the
right refusal and rendered nothing — or disabled a button silently — passes all
182 comparisons.

#### ⚠️ A refused action stays CLICKABLE, and clicking it answers why

The obvious reading of CLAUDE.md §9 (*"a screen must never offer an action the
server will refuse"*) is a disabled menu item. That is the wrong instrument here,
for a measured reason: **Material renders no tooltip on a disabled item**, so a
greyed-out *New ledger* under Sundry Debtors is precisely the *"dead button"* the
gate names, and the sentence — the thing this phase is about — has nowhere to go.

So the rule is read as it was written: never send a request the server will
refuse. A click that never leaves the browser offers nothing. *New ledger* under
a control group answers with the API's own paragraph and opens no form; the
picker inside the dialog lists **every** group, including the refused ones, and
choosing one prints the reason beside it and disables Create. Omitting them was
the tidier screen and the worse one — an operator looking for Sundry Debtors
would conclude the picker was broken and learn nothing.

The gate asserts the *"never sends"* half directly: it counts
`POST /acc-ledgers`, `DELETE /acc-ledgers/:id` and `DELETE /acc-groups/:id`
requests and expects **zero** for the refusals the browser owns. Without that
clause a 400 caught and toasted would look identical on screen.

#### Two arms are the SERVER's, and the browser says so rather than guessing

`describeLedgerMoveBlock` and `describeGroupReparentBlock` each turn on whether
anything has **posted**, and that is on no payload this screen reads. Both were
available cheaply — an `EXISTS` per row on the list, a subtree count on the tree
— and both were **declined**: a *"this has posted entries"* refusal that is
sometimes wrong teaches an operator to ignore refusals, and the honest shape is
already available.

So `hasPostings` is **optional** in the mirror, an absent one means *"not known
here"*, and the rule does not fire. What the dialog does instead is say what will
happen: *"The destination sits under a different account nature (Asset →
Liability). If this ledger already has posted entries the move will be refused,
because it would re-sign figures that have already been reported."* Then the
request goes and the server refuses it — **in the same words**, which is what
check 10 guarantees and what the gate asserts by text.

⚠️ The vector table states that equivalence with a `null`, deliberately: *both
sides answer "allowed" when the fact is absent* is a rule, not an accident of two
signatures. Injecting `hasPostings: true` into the dialog — the "helpful" guess —
turns the warning into a refusal and fails the gate.

#### `GET /acc-groups/tree` carries `ledgerCount`, because the sentence names a number

*"This group holds 12 ledger(s). Move or delete them first."* is a specific claim
about the operator's own chart. The count is `describeGroupDeleteBlock`'s second
arm and the one an operator meets most often, and nothing in the tree payload
could answer it — child groups are derivable from `parentId`, ledgers are not.

One grouped read under the tenant hooks (`AccLedger.findAll` with a `COUNT`), not
a per-node subquery and not raw SQL — so there is nothing for
`ci-guard-raw-sql` to have an opinion about, and §6's *"do not cache the ledger
tree"* row stays satisfied: the screen re-reads it on every visit and after every
write.

It is this group's **own** ledgers, never the subtree's — that is the question
the rule asks, and a subtree figure would make a parent holding nothing look
undeletable. The gate reads the real count out of the database and expects that
sentence: **a mirrored message built on a number nothing checked is a confident
lie about somebody's books**, and injecting `ledgerCount: 0` fails it.

#### ⚠️ The two-pane layout put the grid's toolbar ONE PIXEL under its own container query

At 1440 — the widest breakpoint, and the QA viewport — the ledger grid rendered
the **compact search button** instead of its inline search field. Nothing was
wrong on either side. `app-paginated-table` collapses its quick search at
`@container (max-width: 720px)`, measured on its own `.toolbar-container`; with
the tree column at 300px that element came out at **719px**.

Measured rather than reasoned, and the numbers are the point: the content column
is 1152, the page container 1120, the grid pane **800**, and the toolbar **719**
— the table's own padding sits between the last two, so the pane looked like it
had 80px of headroom and had none. The column gives up 60px (240px, gap
`--ds-space-4`), which puts the toolbar at **783**.

Two things worth carrying. **A container query is measured on the container, not
on the pane you sized** — and the two differ by whatever padding lies between.
And a layout sitting one pixel from a threshold is the intermediate-width failure
`_breakpoints.scss` was written about: it is not a bug you find by reading, and
at 1441px it would have looked fine.

#### Masters ▸ Nature is retired; Masters ▸ Transaction Group deliberately is NOT

§3.3 says this screen replaces three Masters screens. Two of those retirements
are not this phase's to make, and the plan's own wording had them mixed together:

- **Nature is gone** — the grid, its route, its Masters tab and its nav entry.
  In the new chart a nature is inherited from the primary group, and `trx_natures`
  was never a master with anything to maintain: F8 measured exactly four rows per
  company across all fourteen, with no drift to preserve. `transaction/masters/
  trx-nature` redirects to `transaction/ledgers`. The table itself goes at D9.
  ⚠️ Its **dialog** went with it, and that was the less obvious half: the Nature
  master's add/edit dialog survived as the Transaction Group form's
  create-on-the-fly (`AddDialogService.addEditNature`), which would have left a
  nature an operator could **create and never see again**. Worse than either end
  state, so the picker is a plain one now.
- **Transaction Group stays.** `trx_groups` is still the voucher head master and
  the **only door** to a head's opening balance and its `groupFor` — both of
  which a P3c‑2 twin cannot receive, because the twin is `isSystem` and
  `TrxGroupService` refuses a system row. Retiring it now would remove
  capability, so D9 retires it, and both the Masters shell and the nav config say
  which chart is which.
- **The instrument master stays**, as P3d‑1 already recorded: `trx_accounts` is
  account numbers, IFSC and type — facts a ledger row does not model. It keeps
  the name *"Chart of Accounts"* in the rail until D9, which is why the new
  screen is called **Ledgers** there — and why `permission-registry.ts` was
  relabelled to match: `acc-ledgers` read *"Chart of Accounts"* in the permission
  matrix, which is the name the rail gives the OTHER screen, so an admin granting
  it read one name and found a different screen under it. `trx-nature` is now
  *"Nature (picker feed)"* for the same reason — its screen is gone, its key
  still gates the list the Transaction Group form's nature picker reads.

#### 🐞 `acc_ledgers` and `acc_groups` were NOT paranoid, so their soft delete erased the row
*(found by property 5 — the round trip — and fixed in this phase)*

Both tables have carried a `deletedAt` column since their own migrations, and
every raw statement that reads them says `deletedAt IS NULL`. **Neither model
declared it** — no `@DeletedAt`, no `paranoid: true` — so sequelize-typescript
left them non-paranoid and `BaseCrudService.remove`'s first stage
(`row.destroy()`) **physically deleted** the row.

Everything around it was built for the two-stage delete and could not work:
`GET /acc-ledgers/restore/:id` and `bulk-restore` had nothing to find,
`POST …/list { isDeleted: true }` was empty by construction, and
`carryTwin`'s `force: Boolean(ledger.deletedAt)` — the line that decides whether
the legacy twin is archived or erased with its ledger — read a column the model
never selected, so it was always `false`.

Three things worth carrying:

- **It was invisible until something deleted SUCCESSFULLY.** P2b‑3b built the
  routes, P3c‑2 built create, and nothing in `npm test`, five guards, `lint:ci`
  or `build` deletes anything. ⚠️ `qa:p2-ledgers` **does** call
  `AccGroupService.remove` — at (17f) — and could not have caught this, because
  it calls it through `refuses(...)`: the assertion is that the delete is
  *refused*, so the line that would have erased the row was never reached. A
  check that only ever exercises the refusal path is blind to what the happy path
  does, which is the same shape as BUG-0068 (*an endpoint nothing calls is an
  endpoint nobody has run*) with the same two tables in it.
- **The four refusal properties would never have found it**, because a refusal
  is what they measure and every refusal was correct. What found it is the
  property that does the ordinary thing and then **looks for the tombstone**.
- **The fix is one decorator per entity**, and it also makes every Sequelize read
  of those tables exclude archived rows — which is what all of them already
  intended, since the raw SQL beside them says so out loud.

⚠️ No migration: the column was always there. What was missing was the model's
knowledge of it.

#### 🐞 A filter is a `FilterCondition[]`, and a bare value matches nothing silently

Found while building, in this phase's own code: `filters: { groupId: 17 }` on
`POST /acc-ledgers/list` produced *"No records found"* for a group holding **353**
ledgers. The shape is `[{ type: 'numeric', matchMode: 'equals', value, operator }]`
and a bare number is neither refused nor applied — D-34's `ignoredFilters` names
a filter the server could not *resolve*, not one whose shape it could not read.

Recorded because the symptom is the dangerous kind: an empty grid is what a group
with no ledgers looks like, so a screen filtering by a mistyped key reads as
correct.

#### The gate, and the four injections

Four properties, each a question about what an operator is told:

1. **What the browser knows, the browser says — and nothing is sent.** Sundry
   Debtors refuses a hand-made ledger from the tree menu *and* from the dialog's
   picker, with the exact paragraph, Create disabled, and **zero** create
   requests.
2. **What only the server knows, the server answers — in the same words.** A
   cross-nature move of a posted ledger: the dialog warns, the request goes, the
   refusal is asserted by text, and the ledger's `groupId` is re-read from the
   database to prove the refusal refused.
3. **A delete is refused twice, differently.** The system ledger in the browser
   (no request), the posted ledger by the server (one request), and the two
   sentences are different — each naming its own alternative.
4. **The counts are real, and a group shows exactly its own ledgers.** The
   paginator's total against `COUNT(*) WHERE groupId`, and the delete refusal's
   number against the same query.

5. **And the screen can actually create one** — through the dialog, found in
   the grid, with the `trx_groups` **twin** asserted (P3c‑2's pair, without which
   a ledger is visible and not postable), then deleted through the same screen
   with the twin going too. ⚠️ Four refusal properties would every one of them
   pass on a master screen whose Create button was broken, and that is not
   hypothetical: `POST /acc-ledgers/list` answered every call with a 500 for a
   month because nothing called it (BUG-0068).

**Shown to fail four times**: dropping the placement check from the screen (1),
guessing `hasPostings: true` in the move dialog (2), dropping `isSystem` from the
delete check (3), and returning `ledgerCount: 0` from the tree (4).

⚠️ One of them found a defect in the **test** rather than the screen, and it is
worth naming: the first three assertions read `.snk-card--error .snk__msg` and
matched **nothing** — `SnackbarComponent` promotes a single-line message to
`.snk__title` — so the sentence was on screen in front of the reader while the
locator reported *"element not found"*. A refusal test whose selector cannot see
a one-line refusal is inert on every refusal this screen makes.

#### What P4 inherits

§3.3's frontend is finished apart from **`app-ledger-picker` and `Alt+C`**, which
are P4's: the picker replaces the six group pickers the voucher screens use
today, and create-on-the-fly is the same `AddDialogService` shape this phase's
dialogs already return a created row for (`POST /acc-ledgers` answers the row for
exactly that reason).

Three things this phase deliberately did **not** do:

- **No opening balance on a ledger.** D2 copied each legacy head's figure onto
  its ledger and the opening *entry* is still posted from `trx_groups`, so a
  figure accepted here would be posted twice with the trial balance balancing
  throughout. The form says a new ledger opens at nil rather than leaving
  somebody hunting for the field; it moves at D9, with the head that owns it.
- **No bill-wise or cost-centre behaviour**, only the two flags — they are
  stored and read by P5 and P7. Accepting them now is what stops a company
  revisiting every ledger when those phases land.
- **No `deletedBy` on either table.** BUG-0068's lesson stands: who deleted a
  ledger is the audit trail's answer, and the column would be a migration **plus**
  an edge in `company-hard-delete-order.const.ts`. So the archived view carries
  no *Deleted By* column, deliberately.
- **No archived view for GROUPS.** The ledger grid has one (it is
  `app-paginated-table`'s own Active/Archived tabs, and the entity fix above is
  what made it reachable at all), and the tree deliberately shows live groups
  only: a group can only be deleted once it holds no sub-groups and no ledgers,
  so an archived group is an empty container, and a second tree of empty
  containers is a screen for a case nobody has. `POST /acc-groups/bulk-restore`
  and `GET /acc-groups/restore/:id` are the door if one is ever wanted.

---

### Verification pass — 2026-08-28

The plan was written from a reading of the source. It has since been checked
against the **running code and the live development database** (14 companies,
41,690 journal lines, 564 groups, 27 instruments), and against Tally's own
documentation. Most of it held. **Five things did not**, and two of them would
have broken the migration:

| # | What changed | Where |
|---|---|---|
| **V1** | `company_parties` covers **16 %** of the parties that actually have ledger postings. D3's population source was wrong and D5 would have failed on 84 % of party lines. | [§1.2 F13](#12-sixteen-findings) · [§4.1 D3](#41-order-of-operations) |
| **V2** | **63 parties carry live balances on BOTH control heads** — and **76** move a figure when merged, which is not the same set ([§P2a](#p2a-record--2026-08-28)). Merging them into one ledger shifts **₹2,51,44,323.21** between the two heads — so "every report renders identical numbers" **cannot hold**, and the Balance Sheet still balances while it happens. **Decided:** derive the side, human-review it, and make the netting the one enumerated exception to the gate. | [§1.2 F14](#12-sixteen-findings) · [R8](#risks) · [closed #4](#closed-on-2026-08-28) |
| **V3** | The repo **already has** a Tally 28-group table — `tally-nature-map.const.ts`, used by the Data Import module. A second one would be the mirror problem §13 warns about. | [§3.2](#32-mapping-todays-groups-onto-tallys-tree) |
| **V4** | The Data Import module is an unlisted consumer of the whole migration — and its biggest beneficiary. | [§1.2 F15](#12-sixteen-findings) · [P2](#p2--ledgers-become-the-postable-leaf-xl--the-hard-one) |
| **V5** | **Multi-GSTIN** — TallyPrime keeps several GST registrations in one company; we key one GSTIN per company. A parity gap the plan never named. **Decided:** reserve a nullable `registrationId` at D1, build later. | [§2.5](#25-what-tally-has-that-this-plan-does-not-cover) · [R9](#risks) · [closed #5](#closed-on-2026-08-28) |

What the pass **confirmed**, so it need not be re-litigated: the §2.1 group tree
(15 primary + 13 sub, Reserves & Surplus under Capital Account); the §3.7 cost
centre design, which matches Tally's own description clause for clause; the four
id holders in D6; `resolveSystemGroup` as the single seam; and F8 — `trx_natures`
is exactly four rows per company across all fourteen, with no drift to preserve.

---

## 0 · Scope decisions

Taken 2026-08-28. Each is load-bearing for a different part of the plan.

| Axis | Decision | What it forces |
|---|---|---|
| **Account model** | Full Tally model | New `acc_ledgers` becomes the postable leaf; `trx_groups` becomes a hierarchy; `journal_lines` is repointed. Parties and bank accounts become real ledgers. |
| **Entry UX** | Full Tally replacement | One keyboard-first Voucher Entry surface for every type, including Sales and Purchase. The current item grid survives as Tally's *Item Invoice* mode — see [§3.5](#35-voucher-entry--one-screen-two-modes) and risk [R1](#risks). |
| **Data** | Live — migrate in place | Every step reversible, every figure asserted identical before and after, no journal entry re-posted. Shadow columns stay for one release. |
| **Extra scope** | All four groups | Cost centres, Trading Account & Gross Profit, bill-wise details, plus budgets, interest, multi-currency and scenarios. |
| **Dual-role parties**<br>*(2026-08-28)* | Derive the side, **then have a human review it** | 63 parties are a debtor and a creditor at once, and **76** move a figure when merged (the two sets differ — [§P2a](#p2a-record--2026-08-28)). One ledger per party is kept — it is what Tally does — so ₹2,51,44,323.21 shifts from Sundry Debtors to Sundry Creditors. The assignment is written to a reviewable table before D5 and is overridable per row; the netting is the **one declared exception** to the parity gate. [§4.2](#42-the-parity-harness) · [R8](#risks) |
| **Multi-GSTIN**<br>*(2026-08-28)* | **Reserve the column now**, build later | `acc_ledgers`, the voucher header and `bill_references` each carry a nullable `registrationId` from D1. Not wired to anything in this programme. Retrofitting it after P2 has repointed every journal line and P5 has built the bill register would be a second migration over the same tables. [§2.5 X1](#25-what-tally-has-that-this-plan-does-not-cover) · [R9](#risks) |

> ⚠️ **One concern, on the record.** Full Tally replacement of **Sales and
> Purchase** entry is the single highest-risk item here. That path carries GST
> classification snapshots (`applyCatalogueSnapshots`), e-invoice IRN payloads,
> e-way bills, HSN/UQC resolution, stock movements and price capture. It is
> designed the way Tally itself resolves the tension — one voucher screen with
> two modes — so nothing on that path is rewritten, only re-hosted. **If the
> mode toggle is ever dropped, all of it has to be rebuilt inside the Dr/Cr
> grid.**

---

## 1 · What the Transaction module is today

The accounting core is sound double-entry. It stops one level short of the model
the users already know.

### 1.1 The chart of accounts is two levels and flat

| Table | Rows per company | Role |
|---|---|---|
| `trx_natures` | Exactly 4 | Asset · Liability · Income · Expense. Also carries `trxType` (debit/credit). Exposed as a **user-editable** Masters screen. |
| `trx_groups` | ~37 seeded | A **flat** list under a nature. **This is the postable leaf.** Carries `groupFor`, `systemKey`, `isSystem`, and two balance caches. |
| `trx_accounts` | 1 seeded | Cash/bank/UPI/card instruments. Each silently auto-creates and auto-renames a backing `trx_groups` row. |
| `journal_lines` | millions | `trxGroupId` NOT NULL · `trxAccountId` nullable (cash/bank legs only) · `partyUserId` nullable (party legs only). |

A prior refactor deliberately *removed* a ledger layer and merged it into groups
(`LEDGER_REMOVAL_PLAN.md`, cited in `trx-group.entity.ts`'s doc comment).
Everything downstream was rebuilt around that decision — which is why
re-introducing ledgers is structural, not additive.

### 1.2 Sixteen findings

Numbered because the rest of the plan refers back to them. F1–F12 were written
from the source; **F13–F16 came out of the 2026-08-28 verification pass** against
the running code and the live database, and two of them change the migration.

**F1 — A customer is not an account.** `[high]`
Every receivable posts to one shared `SUNDRY_DEBTORS_CONTROL` group; the party is
a *column on the line*. The Trial Balance therefore prints a single row,
"Customer Dues (Sundry Debtors)", where a Tally user expects a group that expands
to every customer. Per-party balances exist only in bespoke reports that group on
`partyUserId`.
*`posting.const.ts:101` · `reports.service.ts:56` · `party-statement.service.ts`*

**F2 — No group hierarchy at all.** `[high]`
`trx_groups` has no `parentId`. No Capital Account, no Fixed Assets, no Current
Assets, no Direct vs Indirect expense split. The Balance Sheet is two flat lists
of leaf heads with net profit appended.
*`reports.service.ts:218`*

**F3 — No Trading Account, and the code says so.** `[high]`
Closing stock is credited to **Income** via `CLOSING_STOCK_INCOME`, with a comment
admitting the reason: *"this app's P&L is a flat Income-vs-Expense split with no
separate Gross Profit / Trading Account concept."* There is no Gross Profit figure
anywhere in the product.
*`posting.const.ts` · `closing-stock.const.ts`*

**F4 — `groupFor` welds the chart of accounts to the voucher UI.** `[high]`
A head is pickable only in the voucher context its enum names — `purchase`,
`sales`, `payment`, `receipt`, `journal`, `charge`, `account`. A user who creates
"Electricity Expenses" as a journal head will not find it on a Payment voucher.
Tally decides pickability from the group's nature, never from a per-voucher enum,
so this is the most likely source of *"why can't I select my own ledger?"*.
*`trx-group.entity.ts:12`*

**F5 — Cash and bank live in a parallel universe.** `[medium]`
`trx_accounts` is a second account entity with its own balance cache, its own
opening balance, its own `AccountType` taxonomy — and a hidden shadow group per
row. Two balance caches, two opening-balance mechanisms, two sets of report code
(`cashBook`/`bankBook` vs `groupStatement`). In Tally a bank is a ledger under
Bank Accounts and nothing else.
*`trx-accounts.entity.ts` · `account-type.const.ts`*

**F6 — Four entry components, fourteen routes, one missing idea.** `[high]`
Each voucher type is its own route with its own field order, its own keyboard
behaviour and its own save semantics. Journal alone has a bolted-on
`simple`/`multi` mode toggle. Nothing offers the one thing a Tally operator does
all day: pick a voucher type with a function key and type Dr/Cr rows without
leaving the keyboard.

> ⚠️ **Corrected 2026-08-28.** This finding said *"six voucher screens"*. There
> are **four** entry components, and the largest of them already serves **ten**
> document types:
>
> | Component | Lines | Serves |
> |---|---|---|
> | `trx-add-edit` | **2,274** | purchase-requisition · purchase-order · goods-receipt · purchase · quotation · sales-order · delivery-challan · sales · credit-note · debit-note |
> | `trx-payment-receipt-add-edit` | 526 | payment · receipt |
> | `trx-journal-add-edit` | 353 | journal |
> | `trx-contra-add-edit` | 300 | contra |
>
> Both halves of that cut against the plan's sizing, in opposite directions.
> **Fewer components** to re-host than P4 assumed — but **six more document
> types**, and six of them (requisition, order, goods receipt, quotation, sales
> order, delivery challan) post **no GL at all** (`buildLegs ⇒ []`). Tally
> reaches those with `Ctrl+F8`/`Ctrl+F9` for orders and `Alt+F8`/`Alt+F9` for
> delivery and receipt notes, which §2.2 already lists and §3.5's key map only
> partially covers. **The unified screen has to host a document with no posting
> at all**, and that is a third mode, not a variant of the two named in §3.5.
>
> *`vouchers/` — 32 files across 6 folders; `trx-add-edit.ts` alone is 2,274 lines.*

**F7 — No drill-down.** `[medium]`
Balance Sheet → Group → Ledger → Voucher is the spine of how Tally is actually
used, and none of those links exist. `groupStatement` is reachable only as its own
report with a group picker.
*`reports/` — 15 flat report routes*

**F8 — The four natures are editable masters.** `[medium]`
`/masters/trx-nature` lets a user rename, add or delete an account nature. These
are structural — every report branches on them, and `ACCOUNT_NATURE_META` is a
total `Record` over the enum. Tally's primary groups cannot be deleted, and
neither should these.
*`masters/trx-nature` · `account-nature.const.ts`*

**F9 — Opening balances are a form field, not an account fact.** `[low]`
`trx_groups.openingBalance` and `trx_accounts.openingBalance` are posted as an
opening journal entry against `OPENING_BALANCE_EQUITY`. Correct as far as it goes,
but there is no Dr/Cr choice, no per-party opening bill breakdown, and no
"Difference in Opening Balances" figure — the number Tally shows when the two
sides do not agree.

**F10 — Absent entirely.** `[medium]`
Cost centres and cost categories · budgets · interest calculation · multi-currency
· scenarios · voucher classes · a ledger monthly summary · Bills
Receivable/Payable as first-class registers. All of these sit inside the requested
scope.

**F11 — Two derived balance caches that no report reads.** `[low]`
`trx_groups.currentBalance` and `trx_accounts.balance` are Σ-duplicates of
`journal_lines`, written only by `PostingService.persistLines`. Every statement
deliberately ignores them; the funds summary and Financial Dashboard read them. A
drift is invisible to the reports that matter. This constrains the migration —
see [§4](#4-migrating-live-books-without-moving-a-figure).

**F12 — Blast radius, re-measured 2026-08-28.** `[planning input]`
`trxGroupId` appears **168 times across 31 backend files** — verified exactly.
`trx_groups` appears **65 times across 17 files** (the plan said "65 raw SQL
sites"; 65 is the string count, and not all of it is SQL). The frontend has
**73 references across 20 files**, not the 55-across-14 first recorded.

The good news is where they concentrate: `posting.service.ts` (37) and
`reports.service.ts` (15), and **every system head resolves through one seam** —
`resolveSystemGroup()` at `posting.service.ts:1123`. Next after those two:
`voucher-import.const.ts` (13 — see F15), `dashboard.service.ts` (11),
`trx-payment-receipt.controller.ts` (9), `trx-account.service.ts` (8).

**F13 — The party registry the migration needs is not `company_parties`.** `[critical]`
Measured on the development database: **362** distinct `(companyId, partyUserId)`
pairs carry postings on a control head. `company_parties` holds a row for **58**
of them — **16 %**. On eight of the thirteen companies with party postings it
holds **none at all**:

| companyId | parties on the ledger | with a `company_parties` row |
|---|---|---|
| 28 | 187 | 53 |
| 29 | 80 | **0** |
| 30 | 40 | **0** |
| 31 | 20 | **0** |
| 15 · 16 | 10 each | **0** |
| 32 · 33 · 1 | 4 · 4 · 2 | **0** |

`company_members` (`userKind = 'party'`, keyed `identityId`) and `user_details`
each cover **362 of 362**. This is D-02's unfinished split showing through
(CLAUDE.md §4.3: *"`company_parties` still owns the per-company balances"* — and
little else). D3 is repopulated accordingly; see [§4.1](#41-order-of-operations).

**F14 — 63 parties are a debtor and a creditor at the same time.** `[critical]`
Trading both ways with one party is ordinary, and today it renders honestly:
their receivable sits in `SUNDRY_DEBTORS_CONTROL` and their payable in
`SUNDRY_CREDITORS_CONTROL`, as **two Trial Balance rows on opposite sides**.
Measured over live entries only (`liveEntrySql`), 63 parties hold a non-zero
balance on **both**, ₹1,80,78,934 gross on the debtor side against ₹4,28,14,914
on the creditor side.

⚠️ **This finding originally said ₹1,57,11,850 nets away the moment they become
one ledger. Both halves of that were wrong** (corrected 2026-08-28 while
building D3 — [§P2a](#p2a-record--2026-08-28)). The figure was
`Σ min(|debtorNet|, |creditorNet|)`, which is the movement only when a party is
parented to the side with the larger *net*, and §4.1 D3 parents by **gross**.
And 63 is not the population that matters: **76** parties move a figure, the
extra 13 having a zero net on the side their gross points at, so they never
appear as dual-role at all. The measured movement is **Sundry Debtors
−₹2,51,44,323.21, Sundry Creditors +₹2,51,44,323.21** — a shift between the two
heads, not a fall on both.

There is also **nothing to parent them by**: `UserKind` is `staff | party |
system`, `company_parties` has no role column, and `PartyDirection` is decided
**per voucher** by the posting engine, never stored on the party. The plan's
"by their declared role" has no field to read. See [R8](#risks) and
[closed #4](#closed-on-2026-08-28).

**F15 — The Data Import module already speaks Tally, and nobody told the plan.** `[medium]`
`src/const/import/` holds `tally-nature-map.const.ts` — Tally's 28 reserved
groups with their natures and a `resolveReservedAncestor` walk up a parsed
parent chain — plus `voucher-import.const.ts` (13 `trxGroupId` references),
`opening-balance.const.ts`, `party-import.const.ts` and four import services.
It is a **consumer** of everything P2 changes, and it is the migration's largest
single beneficiary: today it must **flatten** a customer's Tally tree into our
flat groups through a mapping-review screen, because there is no tree to import
*into*. After P2 there is. See [§3.2](#32-mapping-todays-groups-onto-tallys-tree)
and [P2](#p2--ledgers-become-the-postable-leaf-xl--the-hard-one).

> ✅ **Closed by P2b‑3c**, and it was half right. The tree can now be preserved —
> but the real Tally backup this repo carries has **zero** custom groups, so what
> the phase actually recovered was the **ledger placement**: 60 of that
> customer's 230 ledgers were being filed by `fallbackGroupForNature` instead of
> where they belonged. And the 13 `trxGroupId` references needed no repointing at
> all, because D6 derives the ledger in the one writer of each table. See
> [§P2b‑3c record](#p2b-3c-record--2026-08-29).

**F16 — In fourteen companies, not one user has created an account head.** `[evidence]`
Every company carries exactly **one** `sales` group, one `purchase`, one
`journal`, one `debit-note` and one `credit-note`. All 196 non-system groups
across all fourteen companies are the seeded ones; the 40.3 groups per company
are the 37 of `TRX_GROUPS` plus the auto-created backing group per instrument.

Read two ways, both useful. It is the strongest available evidence for **F4** —
a chart of accounts nobody extends is one that cannot usefully be extended. And
it makes **D2 far safer than the plan assumed**: there is no corpus of
hand-made heads whose parentage has to be guessed. The mapping in §3.2 is,
today, exhaustive.

---

## 2 · Tally reference — what we are matching

Only the parts that constrain the design. Where two secondary sources disagreed on
whether a group is "primary" or a "sub-group", the **parent linkage** is what the
reports depend on, so that is what is recorded.

### 2.1 The 28 predefined groups

Two predefined **ledgers** also exist from birth: `Cash` under Cash-in-Hand, and
`Profit & Loss A/c` at the root. Users may add groups anywhere and nest them
without limit; predefined groups cannot be deleted.

```
BALANCE SHEET — Liabilities side
Capital Account
└─ Reserves & Surplus
Loans (Liability)
├─ Bank OD A/c          (alias: Bank OCC A/c)
├─ Secured Loans
└─ Unsecured Loans
Current Liabilities
├─ Duties & Taxes        ← every GST head, input AND output
├─ Provisions
└─ Sundry Creditors      ← one ledger per supplier
Suspense A/c
Branch / Divisions

BALANCE SHEET — Assets side
Fixed Assets
Investments
Current Assets
├─ Bank Accounts
├─ Cash-in-Hand          └─ ledger: Cash
├─ Deposits (Asset)
├─ Loans & Advances (Asset)
├─ Stock-in-Hand
└─ Sundry Debtors        ← one ledger per customer
Misc. Expenses (Asset)

PROFIT & LOSS
Sales Accounts
Purchase Accounts
Direct Incomes      ┐
Direct Expenses     ┴ above the Gross Profit line
Indirect Incomes    ┐
Indirect Expenses   ┴ below it
```

### 2.2 Voucher types and the keyboard

TallyPrime ships 24 predefined voucher types. The accounting set:

| Key | Voucher | Key | Voucher | Key | Voucher |
|---|---|---|---|---|---|
| `F4` | Contra | `F7` | Journal | `Alt+F5` | Debit Note |
| `F5` | Payment | `F8` | Sales | `Alt+F6` | Credit Note |
| `F6` | Receipt | `F9` | Purchase | `Alt+F7` | Stock Journal |
| `Ctrl+F8` | Sales Order | `Alt+F8` | Delivery Note | `Ctrl+F7` | Physical Stock |
| `Ctrl+F9` | Purchase Order | `Alt+F9` | Receipt Note | `Ctrl+F4` | Payroll |

Three general shortcuts do most of the work: **`Ctrl+A`** accepts and saves from
anywhere on the screen, **`Alt+C`** creates a master (ledger, stock item, cost
centre) without leaving the field that needed it, and **`Ctrl+H`** changes the
voucher's *mode* — which is how one Sales voucher serves both an accounting-only
bill and a stock invoice. **`F12`** opens per-screen configuration.

- **Accounting Invoice mode** — ledger rows only ("Consultancy Fees ₹50,000"). No
  stock. In our terms: no `trx_items` at all.
- **Item Invoice mode** — stock items first, each allocated to a sales/purchase
  ledger, then ledger rows for freight and tax. In our terms: **this is the form
  that exists today.**

### 2.3 Bill-wise details — the four reference types

Turned on per party ledger (*Maintain balances bill-by-bill*); the whole of
Tally's receivables/payables reporting derives from it.

| Type | Meaning | Creates a bill? | Our nearest equivalent |
|---|---|---|---|
| **New Ref** | This voucher raises a new debt — an invoice. | Yes | A `trx` row with an outstanding balance. |
| **Agst Ref** | Settles a named existing bill. | No — reduces one | `trx_payment_receipt_transactions` allocation rows. |
| **Advance** | Money moved before any bill exists; adjustable later. | Yes, as a negative-side reference | **Nothing.** Lands as unallocated party balance. |
| **On Account** | Deliberately unreferenced — the holding pen. | No | **Nothing named.** Same silent bucket as Advance. |

### 2.4 Cost centres

A parallel allocation dimension that never touches the ledger's own balance. Every
cost centre belongs to a **cost category**; Tally supplies one called *Primary Cost
Category* and a business may add more, so one expense can be allocated to a
department *and* a location at the same time. A **cost centre class** pre-defines a
percentage split so an operator picks one name and the allocation happens
automatically.

> **Design consequence — copy this exactly.** Allocations must **not** be extra
> journal lines. That would double GL volume and put a second, weaker balancing
> rule into the engine. One `cost_allocations` table pointing at
> `journal_lines.id` keeps the ledger untouched and makes cost reporting a join.

### 2.5 What Tally has that this plan does not cover

Found by the 2026-08-28 pass. Recorded here rather than folded into the phases,
because each is a **scope decision**, not an oversight to be silently corrected.

| # | Tally does | We do | Verdict |
|---|---|---|---|
| **X1** | **Several GST registrations inside one company** (TallyPrime 3.0+; extended again in 6.1). State-wise GSTINs share one set of books, one chart of accounts, one Balance Sheet, and file a return each. | `companies.gstin` is **one nullable column**. A business registered in three states needs three companies — so three charts of accounts, three sets of books, and no consolidated Balance Sheet. | **Genuine parity gap, unplanned.** Structural: it touches the voucher header, GST return assembly, the e-invoice and e-way paths, and the party master. See [R9](#risks), [closed #5](#closed-on-2026-08-28). |
| **X2** | **IMS — Invoice Management System.** Download supplier invoices, Accept / Reject / Pending inside the product, keep books and the IMS dashboard in sync (TallyPrime 5.0+). | Nothing. | **Adjacent, and getting less optional.** GSTR-3B Table 3.1/3.2 has been hard-locked since **July 2025**; ITC in Table 4 auto-populating from GSTR-2B is indicated for around **July 2026** and **is not yet firmly notified** — check the GSTN advisory before building to a date. Once it lands, ITC not accepted in IMS cannot be claimed, so a purchase carries an **IMS state** the purchase register has to show. §3.11 #5's dated field map covers a return's *shape* changing, not this *workflow*. |
| **X3** | **Connected Banking and auto-reconciliation** — bank statements pulled in, vouchers proposed from them, exact matches reconciled automatically (TallyPrime 6.0). | Manual entry only. | **Out of scope, and the plan already leaves room.** §3.1's call to keep `trx_accounts` as an instrument satellite — IFSC, UPI id, account number, credit limit — is exactly the row a statement importer needs to key on. Nothing here forecloses it. |

X2 and X3 are **not** proposed for this programme. They are written down so that
P8's flexibility layer is designed to *accept* them rather than be retrofitted
around them — and so that "Tally parity" is not later read as having promised
them.

**Sources:**
[Ledgers and Groups](https://help.tallysolutions.com/ledgers-and-groups-in-tallyprime/) ·
[Keyboard Shortcuts](https://help.tallysolutions.com/keyboard-shortcuts-tally-prime/) ·
[Cost Centres](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/) ·
[Managing Outstanding Receivables](https://help.tallysolutions.com/manage-receivables-outstanding-tally/) ·
[Voucher Types and Classes](https://help.tallysolutions.com/tally-prime/accounting/voucher-types-tally/) ·
[28 Predefined Groups](https://www.ankititsolutions.com/28-predefine-groups-in-tally-prime/) ·
[Bill-wise Details](https://tallysolutions.com/tally/bill-wise-details-report-in-tally-prime/) ·
[Multi-GSTIN in one company](https://tallysolutions.com/tally/manage-multi-gstin-in-single-company-with-tallyprime/) ·
[IMS in TallyPrime](https://tallysolutions.com/gst/gst-invoice-reconciliation-tallyprime-ims/) ·
[Release 6.0 notes](https://help.tallysolutions.com/release-notes-tallyprime-6/)

> **Verified 2026-08-28.** §2.1's tree was re-checked against Tally's own help
> and the 15-primary/13-sub arithmetic: Reserves & Surplus **is** under Capital
> Account, Current Liabilities **is** primary, and Bank OD A/c sits under Loans
> (Liability) — 1 + 3 + 3 + 6 = 13 sub-groups, which is the check that settles
> it when a secondary source garbles the table. §2.4's cost-centre design was
> re-checked the same way and matches Tally clause for clause, **including the
> property the design turns on**: allocations do not affect the trial balance.

---

## 3 · Target architecture

Eleven design decisions. Each names the files it lands in, because this repo's
conventions — pure rules in `src/const/*.const.ts` with a spec beside them,
registries that fail a test when unclassified — decide where a change is allowed
to go.

### 3.1 Schema

| Table | Status | Shape |
|---|---|---|
| `acc_groups` | **new** | `id · companyId · name · parentId (self FK, nullable) · path · depth · rootKey · nature (enum) · isPrimary · isSystem · systemKey · sortOrder`. `path` is a materialised path (`/1/7/22/`) so a report rolls up with a `LIKE 'path%'` prefix rather than a recursive CTE. |
| `acc_ledgers` | **new** | `id · companyId · name · groupId · code · isSystem · systemKey · billwise · costCentresApplicable · currencyId · openingBalance · openingSide (Dr/Cr) · openingDate · currentBalance · partyUserId (nullable) · trxAccountId (nullable) · legacyTrxGroupId (nullable) · registrationId (nullable — reserved, see below) · isActive`. **The postable leaf.** |
| `journal_lines` | altered | `+ ledgerId` (NOT NULL after backfill). `trxGroupId` demoted to a nullable shadow for one release. `trxAccountId` and `partyUserId` **kept** — denormalised, no longer the mechanism, and cheap for the reports that already index on them. |
| `trx_groups` | altered | Survives the migration as a read-only compatibility view of `acc_ledgers`, then is dropped in a later release. **Not** deleted in the same migration that repoints the lines. |
| `trx_accounts` | altered | Loses `balance`, `openingBalance` and `trxGroupId`; gains `ledgerId` (1:1). Becomes a pure **instrument-detail satellite** — IFSC, UPI id, credit limit — hanging off a ledger. `AccountType` and its `FundGroup` taxonomy survive untouched, so the cash/bank book derivation (D-54) keeps working. |
| `trx_natures` | **retired** | Replaced by `acc_groups.nature` plus the fixed `AccountNature` enum. The Masters screen and its permission key go (F8). |
| `cost_categories` · `cost_centres` · `cost_allocations` | **new** | [§3.7](#37-cost-centres-and-categories) |
| `bill_references` | **new** | [§3.6](#36-bill-wise-details) |
| `voucher_types` · `voucher_classes` · `posting_rules` | **new** | [§3.4](#34-the-posting-engine-becomes-an-interpreter), [§3.11](#311-the-flexibility-layer) |
| `statutory_heads` | **new** | [§3.11](#311-the-flexibility-layer) — the dated levy→ledger registry. |
| `budgets` · `budget_lines` · `currencies` · `exchange_rates` · `scenarios` | **new** | [§3.9](#39-budgets--interest--multi-currency--scenarios) |

> ⚠️ **`registrationId` is reserved, not implemented** (decided 2026-08-28, X1).
> `acc_ledgers`, the voucher header and `bill_references` each carry a nullable
> `registrationId` from D1, referencing nothing and read by nothing. It is there
> because multi-GSTIN is a real parity gap this programme does not close, and the
> cheapest moment to leave room for it is **before** P2 repoints every journal
> line and P5 builds the bill register — after that, adding it is a second
> migration over the same tables. **Do not wire it up opportunistically**: a
> column that is half-read is worse than one that is not read at all, and the
> whole point of reserving it is that the decision to use it is taken once,
> deliberately, later.

> ⚠️ **Why a materialised path and not a recursive CTE.** The three statement
> queries in `reports.service.ts` already carry measured optimiser hints and an
> aggregate-before-join restructuring because the naive four-table join took
> **9.9 s** on a 250k-voucher company. Adding a `WITH RECURSIVE` group walk on top
> of that is the wrong direction, and it also collides with `ci-guard-raw-sql`,
> which has no notion of a CTE and would need every derived table inside it to
> bind `companyId`. A stored `path` keeps the reports as flat aggregate-then-join
> and keeps the guard's job unchanged.

### 3.2 Mapping today's groups onto Tally's tree

Every existing `trx_groups` row becomes a **ledger** under the Tally group named
here. Nothing is deleted, nothing is merged, **no figure moves** — a group's total
is the sum of its child ledgers, so the Trial Balance value for "Sundry Debtors"
after migration equals the old "Customer Dues" line exactly.

| Today (`trx_groups`) | Becomes ledger under | Note |
|---|---|---|
| Cash In Hand *(system)* | Cash-in-Hand | Named **Cash**, matching Tally's predefined ledger. |
| Bank / UPI / wallet / card accounts | Bank Accounts · Cash-in-Hand | Routed by `AccountType` → `FundGroup`. Credit cards go to **Current Liabilities**, which is what `isLiabilityAccountType` already says. |
| Customer Dues (Sundry Debtors) | **Sundry Debtors** — becomes a *group* | One ledger per party. The control account stops being a ledger. |
| Supplier Dues (Sundry Creditors) | **Sundry Creditors** — becomes a *group* | Same. |
| CGST/SGST/IGST Input · Output · GST Input Credit · GST Output Payable · RCM Payable · TDS Payable | Duties & Taxes | Tally puts input and output GST in the same group. Keeps GSTR reconciliation reading from one subtree. |
| PF · ESI · PT Payable | Duties & Taxes | Statutory dues. |
| Salaries Payable | Provisions | Under Current Liabilities. |
| Employee Advances | Loans & Advances (Asset) | |
| Closing Stock | Stock-in-Hand | |
| Closing Stock (P&L) | **retired** | Dies with the Trading Account ([§3.8](#38-trading-account-and-gross-profit)). Historic lines keep pointing at the migrated ledger; only new postings stop using it. |
| Opening Balance Equity | Capital Account | Plus a new system ledger **Difference in Opening Balances** under Suspense A/c (F9). |
| Sales · Sales Return | Sales Accounts | |
| Purchase · Purchase Return | Purchase Accounts | |
| Freight · Labour · Packaging · Installation · Additional Charges | Direct Expenses | Re-parentable. Freight *charged to a customer* is arguably Indirect Income — that judgement is now the customer's to make, which is the point. |
| General Expenses · Salaries & Wages · Employer PF/ESI | Indirect Expenses | |
| Other Receipts | Indirect Incomes | |
| Other Payments | Indirect Expenses | |
| Party Receipt · Party Payment | **retired** | Artefacts of `groupFor` (F4). A receipt posts party ↔ bank; it never needed a head of its own. |

The mapping lives in `src/const/provisioning/tally-chart.const.ts` as pure data
with a `.spec.ts` beside it, exactly like `company-defaults.const.ts`. **Two
properties the spec must assert:** every seeded `TRX_GROUPS` key has a target, and
every target names a group that exists in the 28.

> ⚠️ **The 28 are already in this repo — do not write them twice** (V3).
> `src/const/import/tally-nature-map.const.ts` holds
> `TALLY_RESERVED_GROUP_NATURE`: all 28 reserved group names keyed lower-case,
> each with its `AccountNature`, and `null` on the two Tally itself leaves
> ambiguous (`branch / divisions`, `suspense a/c`) so nothing guesses a nature
> for them. Beside it, `resolveReservedAncestor` already walks a parsed parent
> chain up to the nearest reserved group — which is *exactly* the lookup a
> re-parenting rule needs.
>
> `tally-chart.const.ts` must therefore **extend** that file's table with the
> parent linkage and the sort order it lacks, and the two must share one list of
> names. Two independent transcriptions of the same 28 names in one repo is the
> mirror problem §13 spends four paragraphs on — and this one would have **no
> `check-mirrors.js` check behind it**, because both copies live in the same
> submodule and that script only compares across repos. A spec asserting the two
> tables have identical key sets is the cheapest thing that can fail here.

> ⚠️ **This table's "no figure moves" claim holds for every row above and fails
> for the parties** (F14). A group's total is the sum of its child ledgers, so
> each mapped head reappears intact. A party who is **both** a debtor and a
> creditor cannot: one ledger sits under one group, and the two control balances
> net. **76 parties, ₹2,51,44,323.21** — moved between the two heads rather than
> netted off both (the original *"63 parties, ₹1.57 crore"* was a `min()`; see
> [§P2a](#p2a-record--2026-08-28)). See [R8](#risks).

### 3.3 The Ledger module

> **Status:** the **backend is complete.** `AccLedgerController`/`Service` and
> `AccGroupController`/`Service` landed in P2b‑3b
> ([record](#p2b-3b-record--2026-08-28)); **ledger creation** landed in P3c‑2
> ([record](#p3c-2-record--2026-08-29)) — it waited for P3c‑1 because a ledger
> with neither a `legacyTrxGroupId` nor a party had no presentation head and its
> figures vanished from every statement, and ⚠️ it writes the **pair** because
> `journal_lines.trxGroupId` is `NOT NULL` until D9. **The `/transaction/ledgers`
> screen landed in P3d‑2** ([record](#p3d-2-record--2026-08-29)), with the five
> refusals mirrored into `client-front/src/utils/ledger-rules.util.ts` and
> compared **by message text** across the repos (`check-mirrors.js` check 10).
> What is left of this section is `app-ledger-picker` and `Alt+C`, in **P4**,
> which is their only consumer.
> ⚠️ **`POST /acc-ledgers/list` — the feed named below — answered every call
> with a 500** from the day it was built until P3d‑1 called it: it included a
> `deletedByUser` alias `AccLedger` never declares (these two tables carry
> `deletedAt` and no `deletedBy`). Nothing had noticed because nothing had
> called it; see the [P3d‑1 record](#p3d-1-record--2026-08-29).

**Backend**
- `modules/accounting/` gains `LedgerController`, `LedgerService`,
  `AccGroupController`, `AccGroupService`.
- Pure rules in `src/const/ledger.const.ts`: which groups accept a ledger, whether
  a ledger may be deleted (never, once posted — `posting-source-lifecycle.const.ts`'s
  rule generalised), and how a group's nature is inherited.
- **Nature is inherited from the root group and never stated on a ledger.** A
  ledger cannot be an Asset under Indirect Expenses.
- Re-parenting a group rewrites `path` for its whole subtree in one transaction,
  and is refused across natures once the subtree has postings.

**Frontend**
- `/transaction/ledgers` — a tree-plus-grid Chart of Accounts. **Done (P3d‑2.)**
  ⚠️ It replaces **one** of the three Masters screens named here, not three.
  **Nature** retired with it (inherited from the primary group now; F8 measured
  `trx_natures` as four fixed rows per company) — its create-on-the-fly dialog
  went too, since a nature nobody can see afterwards is worse than either end
  state. **Transaction Group stays until D9**: `trx_groups` is still the voucher
  head master and the only door to a head's opening balance and its `groupFor`,
  neither of which a P3c‑2 twin can receive (it is `isSystem`). And the third is
  the **instrument** master (`trx_accounts`: account numbers, IFSC, type), which
  a ledger row does not model — re-homed with D9, which is why the new screen is
  called *"Ledgers"* in the rail and that one keeps *"Chart of Accounts"*.
- Ledger create/alter with Tally's field order: Name → Under → opening balance with
  Dr/Cr → bill-wise → cost centres → GST/statutory detail.
- `app-ledger-picker`, a paginated searchable select used by **every** voucher
  screen. Replaces the six different group pickers that exist today.
- `Alt+C` on the picker opens ledger-create inline and returns the new id to the
  field — Tally's create-on-the-fly. The repo already has `AddDialogService` for
  this shape.

> 🔒 **Security — easy to get wrong.** The ledger list needs `@SharedRead()`
> because every module's voucher screen picks from it. It must be declared
> **`@SharedRead({ parties: false })`**. A ledger list carries **bank account
> names and balances**, and D-46/BUG-0031 is exactly the case where "any
> authenticated user" quietly meant "including the customer you are invoicing".
> `shared-read-party.spec.ts` sweeps new routes automatically, so this fails
> loudly — but get it right at the decorator.

### 3.4 The posting engine becomes an interpreter

Today `buildLegs` is a switch over `PostingVoucherKind` and `LegRole`, with
`resolveRole` mapping a role to an id and `resolveSystemGroup` resolving a
`systemKey`. That is a good structure and it is *nearly* the Tally model already.
The change is to move the leg table out of code and into data:

```
posting_rules
  id · companyId · voucherTypeId · voucherClassId(null) · seq
  legRole      'party' | 'main' | 'statutory' | 'charge' | 'instrument' | 'roundoff'
  side         'dr' | 'cr' | 'signed'
  amountExpr   'net' | 'tax' | 'grandTotal' | 'charge' | 'net+charges'
  headCode     null | 'CGST_OUTPUT' | 'RCM_PAYABLE' | ...   → statutory_heads
  effectiveFrom / effectiveTo
```

`buildLegs` keeps its signature and its purity — it becomes a function of
`(rules, voucher)` instead of a switch, and `posting.const.spec.ts` keeps testing it
the same way. `resolveSystemGroup` becomes `resolveStatutoryLedger(code, onDate)`,
still one seam, still one method.

**What this buys:** the CGST/SGST/IGST split, the RCM leg (D-52), reverse charge
being purchase-only, the closing-stock pair — all become rows with dates instead of
branches. A new levy, a changed head, a state that wants a different control
account: a seed row and a migration, not a change to a file that eleven other
things depend on.

### 3.5 Voucher entry — one screen, two modes

A single routed component, `/transaction/voucher`, replaces the six entry screens.
It is the whole of the "full Tally replacement" decision.

| Element | Behaviour |
|---|---|
| **Voucher type** | `F4` Contra · `F5` Payment · `F6` Receipt · `F7` Journal · `F8` Sales · `F9` Purchase · `Alt+F5` Debit Note · `Alt+F6` Credit Note, plus `Ctrl+F8/F9` for orders. Switching type on an unsaved blank voucher is free; on a dirty one it asks. |
| **Mode** | `Ctrl+H` toggles **Accounting Invoice** ↔ **Item Invoice**. Contra, Payment, Receipt and Journal are accounting-only. Sales, Purchase and both notes default to Item Invoice and remember per voucher type. ⚠️ **A third mode is needed** — see below. |
| **Accounting mode grid** | Dr/Cr rows: side · ledger · amount · (bill-wise popup if the ledger is bill-wise) · (cost-centre popup if applicable). Running Dr and Cr totals with the difference shown live; save is refused while it is non-zero, **in the voucher's own words** rather than a form error. |
| **Item mode grid** | **The existing form, re-hosted.** `trx-add-edit`'s item grid, its pricing engine, its GST classification, its charges and its attachments move in as a child component. `applyCatalogueSnapshots`, `TrxWriteService`, the e-invoice and e-way bill paths, HSN/UQC and price capture are **untouched**. |
| **`Alt+C`** | Create ledger / stock item / cost centre inline from the field that needed it. |
| **`Ctrl+A`** | Accept and save from anywhere. `Ctrl+S` kept as an alias — several screens already bind it. |
| **`F12`** | Per-voucher-type configuration, replacing `/transaction-config/:trxType` as a modal rather than a route. |
| **Narration** | Always last, always full width, always present. It is the field Tally operators use most and it is currently folded behind a chip. |

> ⚠️ **Two modes was one short** (F6, 2026-08-28). `trx-add-edit` already serves
> **ten** document types, and six of them — purchase requisition, purchase order,
> goods receipt, quotation, sales order, delivery challan — post **no GL at all**
> (`buildLegs ⇒ []`). A document with items and no legs is neither Accounting
> Invoice (ledger rows, no stock) nor Item Invoice (stock rows allocated to
> ledgers, then tax): the Dr/Cr totals it would show are both zero, and the
> balancing rule the accounting grid rests on has nothing to say about it. Tally
> keeps these on their own keys — `Ctrl+F8`/`Ctrl+F9` for orders, `Alt+F8`/`Alt+F9`
> for delivery and receipt notes (§2.2). **Name the third mode before building
> the toggle**; retrofitting a "no posting" case into a grid whose invariant is
> "Dr must equal Cr" is how that invariant gets weakened.

> ⚠️ **What must not be lost.** The voucher options bar, `revealInvalidPanel`, the
> maker–checker lifecycle and `voucher-lifecycle.const.ts`'s rules all stay exactly
> as they are. The lifecycle is compared behaviourally across both repos by
> `check-mirrors.js` against **487 vectors** — if the entry rewrite changes a
> lifecycle answer, that check is what tells you, and the answer is to change the
> vectors deliberately or not at all.

### 3.6 Bill-wise details

```
bill_references
  id · companyId · ledgerId · journalLineId · voucherId
  refType  'new' | 'against' | 'advance' | 'on-account'
  refName          -- the bill number the operator sees
  againstRefId     -- set only for 'against'
  amount · dueDate · creditPeriodDays
```

A party ledger with `billwise = true` pops the reference grid on save, pre-filled:
a Sales voucher proposes **New Ref** with the invoice number; a Receipt proposes
**Agst Ref** rows for every open bill oldest-first. The existing allocation
machinery — `TrxPaymentReceiptController.buildAllocation`'s create-time cap and
`ApprovalService.applyReceiptSettlement`'s `FOR UPDATE` re-check (BUG-0029/0030) —
is what writes `against` rows. It is **not replaced**; it gains two sibling types
it never had.

**Advance** and **On Account** are the genuinely new behaviour, and they close a
real gap: today an unallocated receipt is a silent party balance with nothing
naming it. `outstanding.const.ts`'s two-sign rule (D-18 — a refund due is reported
beside the receivable, never netted into it) extends naturally: an Advance is a
negative-side open item, an On Account amount is reported as unapplied.

> **Reconciliation, finally.** BUG-0040 named the standing problem: a party's
> position exists twice — `journal_lines.partyUserId` on the control heads, and
> `trx` plus its allocations — and the two reconcile only if every term is
> accounted for. `bill_references` hangs off `journalLineId`, so it is derived from
> the **same rows** as the ledger side. D-55's synthesised opening-balance bill
> becomes an ordinary `refType: 'new'` row with no voucher behind it, and the two
> sides stop being two sides.

### 3.7 Cost centres and categories

```
cost_categories   id · companyId · name · allocateRevenue · allocateNonRevenue · isPrimary
cost_centres      id · companyId · categoryId · name · parentId · path
cost_allocations  id · companyId · journalLineId · costCentreId · amount
cost_centre_classes / _lines   -- percentage templates (Tally's Cost Centre Class)
```

- Enabled per ledger via `costCentresApplicable`, so it stays invisible to
  companies that do not use it.
- **Allocations never touch the GL.** The journal entry balances without them; a
  partial or missing allocation is a warning on a reconciliation report, not a
  refused save.
- Σ allocations per line must equal the line amount **per category** — that
  invariant is a pure function in `src/const/cost-allocation.const.ts` with its
  spec, and it is where the parallel-category rule lives.
- Reports: Cost Centre Summary, Category Summary, Cost Centre Breakup, Ledger
  Breakup — the four Tally ships.

### 3.8 Trading Account and Gross Profit

Direct/Indirect is the split that makes a Gross Profit line possible, and it
arrives free with the group hierarchy. The P&L becomes two stacked statements:

**Trading Account**
- `Dr` Opening Stock · Purchase Accounts · Direct Expenses
- `Cr` Sales Accounts · Direct Incomes · Closing Stock
- **= Gross Profit / Loss**, carried down

**Profit & Loss Account**
- Gross Profit b/d · `Cr` Indirect Incomes
- `Dr` Indirect Expenses
- **= Net Profit / Loss** → Balance Sheet

**This retires the `CLOSING_STOCK_INCOME` workaround (F3).** Closing stock appears
on the credit side of the Trading Account where it belongs, and the Balance Sheet
reads it from Stock-in-Hand. The change is **forward-only** — the same doctrine
D-19 and BUG-0034 set. Vouchers already posted keep their legs; the *statement* is
what changes, and it changes for history too because the statement is derived.

### 3.9 Budgets · Interest · Multi-currency · Scenarios

**Budgets.** `budgets` (name, period) + `budget_lines` (groupId *or* ledgerId *or*
costCentreId, amount, type: on closing balance / on nett transactions). Reports gain
a **Budget variance** column, which is a second aggregate over the same rows — no
engine change at all.

**Interest calculation.** Per-ledger simple/compound rate + basis (30-day month,
calendar, per annum), applied over `bill_references` for bill-wise parties and over
the running balance otherwise. Produces an *Interest Report*; posting it is an
explicit Debit Note the user accepts, **never automatic**. Pure rule in
`src/const/interest.const.ts`.

**Multi-currency.** `currencies` + `exchange_rates` (dated, buy/sell/standard).
`journal_lines` gains `currencyId · fcAmount · rate`; **`debit`/`credit` stay in
base currency and stay authoritative** — every existing report is unaffected by
construction. Unrealised gain/loss becomes a system ledger under Indirect
Income/Expense, computed on demand.

**Scenarios.** A named set of voucher types marked *optional* or *provisional*,
includable in a report without being in the books. A flag on `voucher_types` plus a
`scenarioId` filter threaded through the report layer — genuinely cheap once
`voucher_types` exists, which is why it is grouped here.

### 3.10 Reports and drill-down

The report layer keeps its architecture — derived purely from `journal_lines`,
caches deliberately not consulted — and gains a hierarchy and a spine.

| Report | Change |
|---|---|
| **Trial Balance** | ✅ **Landed in P3b.** Rows are **groups**, collapsed by default, expanding to sub-groups then ledgers — Tally's own default; `?view=ledger` is the "Ledger-wise" toggle. Closing-only vs opening/movement/closing columns are still a shape rather than a config. |
| **Balance Sheet** | ✅ **Landed in P3b.** Liabilities \| Assets in Tally's section order (from `acc_groups.sortOrder`, not a second list), Profit & Loss A/c as two lines — brought forward and this period. ⚠️ A **loss** appears under Assets, which is Tally's placement and a visible change from the flat sheet. |
| **Profit & Loss** | ✅ Grouped in **P3b**. The Trading Account and the Gross Profit line are §3.8 and land in **P6** — half a Trading Account would print a gross profit with no direct/indirect split behind it. |
| **Ledger** *(new)* | ✅ **Landed in P3a**, and its **screen in P3d‑1**. One ledger, monthly summary rows, each expanding to its vouchers, each opening the voucher — `GET /reports/ledger/:ledgerId` and `…/vouchers`. This is what a Tally user means by "open the ledger". Reads `acc_ledgers` directly; the Particulars column is the contra **ledger's** name, or `(as per details)`. ⚠️ A voucher number is a link only where there is a screen behind it — seven of the ten `sourceType` values have none. |
| **Group Summary** *(new)* | ✅ **Landed in P3a.** A group's children with closing balances — sub-groups carrying their whole subtree, ledgers carrying their own — `GET /reports/group-summary/:groupId`. The intermediate step of every drill-down, and the report whose totals property (8) of the gate ties to its own breakdown. |
| **Bills Receivable / Payable** *(new)* | Derived from `bill_references`, with ageing. Supersedes the two Outstanding screens, which keep redirecting. |
| **Cash / Bank Book** | Become instances of the Ledger report. `CASH_BOOK_ACCOUNT_TYPES`'s derivation (D-54) is preserved as the group assignment during migration, so no account can fall out of every book the way UPI did. |
| **Day Book** | Its lines drill into the **ledger** since P3d‑1 (P3b put `ledgerId` on every one). The voucher-type chips and the drill into the *voucher* are still to come — `dayBook` returns each entry's id but not the `sourceType`/`sourceId` pair a document is opened by, and adding them is a payload change the parity harness captures. |
| **Cost Centre reports** *(new)* | Four, per §3.7. |

**The drill-down is one shared mechanism**, not per-report links: a `DrillTarget`
union (`group` \| `ledger` \| `voucher`) with a single resolver, so a new report
gets drill-down by emitting the right target. Tally's Esc-goes-back is a **route
stack**, not browser history — a report opened from a Balance Sheet returns to that
Balance Sheet with its date intact.

✅ **Landed in P3d‑1.** `client-front/src/utils/drill-target.ts` is the resolver,
`services/drill.service.ts` the stack, and a report's period lives in its **own
URL** — which is what makes "with its date intact" a property of the URL rather
than of a component's memory, and every statement a link somebody can paste. Esc
is listened for in exactly two places (`DrillBackDirective` on the reports
layout, and the voucher screens' own `close()` via `backOr`), because the last
hop is a voucher screen that already owns the key. ⚠️ A navigation nobody
drilled **clears** the stack, by path.

### 3.11 The flexibility layer

*This is the part of the plan that answers "future tax and government rule changes
adoptable with minimal change". It is five mechanisms, not one.*

| # | Mechanism | A change that used to be code, now data |
|---|---|---|
| 1 | **Dated statutory head registry**<br>`statutory_heads(companyId, code, ledgerId, effectiveFrom, effectiveTo)` | A new levy — a fresh cess, a state surcharge — is a head code and a ledger row. `resolveStatutoryLedger('CESS_OUTPUT', voucher.date)` finds it, or refuses with a message naming the code and the date. |
| 2 | **Dated tax components**<br>extends the `effectiveFrom/effectiveTo` already on the tax master (D-50) | A levy's *composition* changes — GST splitting three ways instead of two, a rate reform like 22-09-2025. The component table says which heads a supply attracts on its own document date; `gstLineTax` stays the primitive that charges each head at its own rate. |
| 3 | **Posting rules** (§3.4) | A leg's direction, its amount basis or its head changes — RCM's own arrival (D-52) would have been rows. A rule carries dates, so old vouchers keep posting the way they were posted. |
| 4 | **Voucher types & classes** | A new statutory document — a new note type, a self-invoice variant — is a `voucher_types` row with its own numbering series and posting rules. Today it is an enum member plus a migration plus eleven switch arms. |
| 5 | **Dated return field maps**<br>`return_field_map(returnCode, table, field, headCode, from, to)` | GSTR-1's or 3B's schema changes. The return assembler stops naming heads and starts asking the map — which is also what makes "which head fed this cell?" answerable on screen. |

> **The rule that keeps this honest.** Every one of these five is **dated**, and
> every resolution takes the **document's own date**, never today's. That is
> already the doctrine in this codebase — `tax-validity.const.ts`, the
> two-schedule `TAX_SLABS` seed, `applyCatalogueSnapshots`, `applyAsOfDateCost`.
> Extending it to heads, legs and return fields means a statutory change is
> **forward-only by construction**: adopting it cannot rewrite a return already
> filed.

---

## 4 · Migrating live books without moving a figure

**The acceptance test for this whole migration is one sentence: every report
renders identical numbers before and after.** Not "ties out" — identical, figure
for figure, on every company.

### 4.1 Order of operations

| Step | Action | Reversible by |
|---|---|---|
| **D1** | Create `acc_groups` and `acc_ledgers`. Seed the 28 Tally groups per company from `tally-chart.const.ts`, keyed and remapped exactly the way `CompanyProvisioningService` already does — **never a literal id**. | drop tables |
| **D2** | One ledger per existing `trx_groups` row, parented per §3.2, carrying `legacyTrxGroupId`. The correspondence is a stored column, so the mapping is auditable rather than reconstructed. | `legacyTrxGroupId` |
| **D3** | One ledger per party, under Sundry Debtors or Sundry Creditors — **population and parentage per the note below**. Name from `company_parties.displayName ?? users.name`, which finally gives `displayName` a reader, the sweep BUG-0040's note says is still owed. | `partyUserId` on the ledger |
| **D4** | One ledger per `trx_accounts` row, under Bank Accounts / Cash-in-Hand / Current Liabilities by `AccountType`. `trx_accounts.ledgerId` written. | `trxAccountId` on the ledger |
| **D5** | **Backfill `journal_lines.ledgerId`**, in this precedence: `partyUserId` set on a control head → that party's ledger; else `trxAccountId` set → that account's ledger; else → the ledger whose `legacyTrxGroupId` matches `trxGroupId`. Then `NOT NULL`. | the shadow `trxGroupId`, kept |
| **D6** | Repoint the other four holders of a group id: `trx.groupId`, `trx_charges.groupId`, `trx_payment_receipts.trxGroupId`, and journal voucher `lines[].trxGroupId`. Each gains a `ledgerId` beside it, derived in the **one writer of its own table** and never taken from the body; the posting engine believes it rather than re-deriving. ⚠️ The receipt header's is deliberately **nullable** — its head column is residue for a Payment and a Receipt, two rows of which name a control head that has no ledger at all. **Done** — [§P2b‑3a](#p2b-3a-record--2026-08-28). | shadow columns |
| **D7** | Backfill `bill_references` from `trx` (New Ref) and `trx_payment_receipt_transactions` (Agst Ref), plus D-55's synthesised opening bills. | drop table |
| **D8** | Rebuild both caches through `PostingService.rebuildBalances` — the existing repair door at `POST /trx-accounts/rebuild-balances`. **Not** a second writer (F11, BUG-0042). | re-run |
| **D9** | Drop `trx_natures`, the `groupFor` column and the shadow columns — **a separate release**, after the parity gate has held in production for one cycle. | — |

> ⚠️ **D3 as first written would have failed on 84 % of party lines** (V1, F13).
> It said *"one ledger per `company_parties` row"*. That table holds **58** of the
> **362** `(companyId, partyUserId)` pairs that actually carry control-head
> postings, and **none at all** on eight of the thirteen companies with party
> activity — D-02's split was never finished, and `company_parties` ended up
> owning balances and little else. D5's first precedence rule (*"`partyUserId` set
> on a control head → that party's ledger"*) would then have found no ledger for
> five party lines in six, and the `NOT NULL` at the end of D5 is where the
> migration would have stopped.
>
> **The population is the union of two sets, and it must be a union:**
> `company_members WHERE userKind = 'party'` (815 rows — the roster, including
> parties who have never been invoiced) **∪** every distinct
> `(companyId, partyUserId)` on `journal_lines` (362 — including anyone whose
> membership has since been tombstoned but whose postings remain). Each covers
> 362 of 362 on its own today; taking the union is what stops the next
> tombstoned party from re-opening this. `company_parties` becomes what it
> already is — a **detail satellite** for GSTIN, PAN, address, `displayName` and
> the opening balance — read for the ledger's name and fields, never for its
> existence.
>
> ⚠️⚠️ **There is no role to parent them by, so D3 derives one and a human
> confirms it** (decided 2026-08-28). D3 said "by their declared role". `UserKind`
> is `staff | party | system`; `company_parties` has no such column; and
> `PartyDirection` is decided **per voucher** inside the posting engine and stored
> nowhere. The rule:
>
> 1. **Derive** the side from the control head carrying the party's larger
>    **gross** volume — gross, not net, so a party who has settled down to a
>    small balance is still parented where their trading actually happens.
>    A party with activity on one side only takes that side; a party with none
>    (453 of them: on the roster, never invoiced) goes under Sundry Debtors.
> 2. **Write the whole assignment to a reviewable table before D5**, carrying
>    both gross figures, the derived side and the netted amount — a `party_ledger_plan`
>    the migration reads rather than recomputes, so what shipped is auditable
>    afterwards rather than reconstructed from the rule.
> 3. **Every row is overridable** by an operator before D5 runs. The 63 that net
>    are the ones worth a human's attention and are flagged as such; the other 299
>    are unambiguous.
>
> Tally's own guidance is the same shape — *place the party where you would
> naturally look for them* — which is a judgement, not a computation, and that is
> exactly why step 3 exists. **The derivation is a proposal; the table is the
> decision.**

### 4.2 The parity harness

A script — `scripts/qa-coa-parity.ts`, in the family of the 67 that already exist
— snapshots every report for every company before D5 and re-runs them after:

- Trial Balance, P&L, Balance Sheet at three period boundaries each
- Every party statement and both Outstanding reports
- Cash book, bank book and daily cash for every account
- Day Book over the full history
- The census already written for BUG-0042: every cache compared against its Σ

Differences are reported **per figure**, not as a pass/fail. **The migration does
not ship until the diff is empty — except in exactly one place, named below.**

> ⚠️ **Do not write a second oracle.** `qa-artifacts/tests/reports/` is already
> 10,280 lines over 23 files, with `statement-rules.ts` (415 lines) and
> `party-rules.ts` **restating** the report rules rather than importing them —
> plus the BUG-0042 cache census in `outstanding.spec.ts`, which D8 needs
> anyway. The parity harness is a **snapshot-and-diff over those endpoints**,
> and it belongs beside them. A third restatement of what a Trial Balance means
> is a mirror that cannot fail.

> ⚠️⚠️ **The empty diff is not achievable once a party's two positions share one
> ledger, and pretending otherwise is how this gate gets switched off** (V2,
> F14). **76 parties** displace a balance between the two control heads:
> **Sundry Debtors falls by ₹2,51,44,323.21 and Sundry Creditors rises by
> exactly that.** The Balance Sheet still balances afterwards — the two moves
> are equal and opposite *by construction* — which is precisely why nothing but
> a figure-for-figure diff would catch it, and why a "does it still balance?"
> check is not a substitute.
>
> ⚠️ **This paragraph used to say 63 parties and ₹1,57,11,850 off EACH side, and
> both halves were wrong** (corrected 2026-08-28 while building D3 —
> [§P2a](#p2a-record--2026-08-28)). The figure was `Σ min(|debtorNet|,
> |creditorNet|)`, which is the movement only when a party is parented to the
> side with the larger *net* — and §4.1 D3 parents by **gross**, deliberately.
> And 13 of the 76 are not dual-role at all: one net zero, the other not, the
> gross pointing at the zero side. Keying the exception list off *"holds a live
> balance on both heads"* would have left thirteen unexplained differences in a
> diff required to be empty apart from a named list. `displacedBalance` in
> `src/const/ledger.const.ts` is the rule; `party_ledger_plan.displacedBalance`
> is the per-party figure.
>
> So the harness needs a **declared, enumerated exception**: the affected party
> set is computed **before** D3, written out with both gross figures and the net,
> and the diff is asserted to contain *those rows and nothing else*. An exception
> list that is a list is a gate; an exception that is a tolerance is not.
>
> ✅ **Built, and it is `npm run qa:coa-parity -- exceptions`** (P2b‑2). 513
> entries, one per **named row** rather than per path — 76,445 paths would be the
> list nobody could review that the sentence above is warning about. Each names
> the party or the head it is about, and each is derived from the **repointing
> itself** (every live line whose ledger's presentation head differs from the
> head it was posted to), with `party_ledger_plan` supplying only the reason
> text — so the allow-file and the plan are two independent derivations that have
> to agree.
>
> One more consequence, easy to miss: `trialBalance`'s
> `HAVING openingNet <> 0 OR periodDebit <> 0 OR periodCredit <> 0` suppresses
> zero rows. A dual-role party whose two sides net to **exactly** zero does not
> move a figure — it **disappears from the Trial Balance altogether**. That is a
> row count changing with no figure changing, and a diff keyed on figures alone
> will not see it.

> ⚠️ **Four things that will bite.**
> **(1)** MySQL 8's default `sql_mode` includes `ONLY_FULL_GROUP_BY` — a
> non-aggregated column beside a `GROUP BY` aborts the migration, which is exactly
> how `rcm-payable-head` shipped as a release that would not install (BUG-0051).
> **(2)** Write every step **idempotently**, checking `information_schema` first,
> so a re-run is a no-op.
> **(3)** The party-ledger step is the **volume** risk: a company with 5,000
> parties gets 5,000 ledgers — fine for the schema, wrong for a Trial Balance that
> renders leaves by default. Hence §3.10's collapsed-by-default. For calibration,
> the development database's largest company has **187** parties on the ledger
> against 40 groups, so the Trial Balance goes from ~40 rows to ~230 there — a
> five-fold jump, not the thousand-fold the 5,000-party case implies, but past
> the width at which a flat list is readable.
> **(4)** `journal_lines.trxGroupId` is `ON DELETE RESTRICT` against `trx_groups`,
> and D5 adds a second FK beside it. Adding `ledgerId` as `NOT NULL` in one
> statement is not available — the column arrives nullable, is backfilled, and is
> tightened in a **third** statement, with the FK added last. On the development
> database that is 41,690 rows; the 250k-voucher company is where the lock window
> has to be measured rather than assumed.

---

## 5 · Phases

Sizing is relative, not calendar. **P0–P4 is the core**: at the end of P4 the
product is Tally-shaped and everything after is additive. Each phase ships behind
its own gate and leaves the app working.

### P0 · Foundations and the parity harness `[M]`

Build the safety net before touching anything. `scripts/qa-coa-parity.ts`, a full
report snapshot of every QA company, and CI wiring for the three `ci-guard-*`
scripts on both backends (§13 still-open #1, which this programme cannot proceed
safely without).

**Gate:** snapshot is reproducible twice with an empty diff, on unchanged code.

### P1 · Groups become a hierarchy `[M]`

`acc_groups`, the 28 Tally groups, `tally-chart.const.ts` + spec, materialised path
and its rebuild-on-reparent. `trx_groups` untouched; nothing posts here yet. Trial
Balance gains an *optional* grouped view reading the new tree through
`legacyTrxGroupId`.

**Gate:** grouped Trial Balance totals equal the flat one, per nature and overall.

### P2 · Ledgers become the postable leaf `[XL — the hard one]`

> **Split into P2a and P2b (2026-08-28), and the split is the safety property.**
> P2a is everything that is **additive** — D1–D4, the tables and the ledgers —
> and it ends with D5's resolution run over every existing journal line as a
> **dry run**. P2b is the first step that is not additive. §4.1 D5 ends with a
> `NOT NULL`; V1/F13 records what discovering a gap *there* costs, and a script
> run is the cheap way to find out. **P2a is done** —
> [§P2a record](#p2a-record--2026-08-28).
>
> **P2b split again on 2026-08-28, on the same argument.** P2b‑1 is D5 — the
> lines name a ledger. **P2b‑2 is the reports reading it**, which is the only
> step in the whole programme that moves a figure, so it lands with the parity
> diff as its entire gate and nothing else in the commit to confuse a
> difference.
>
> **P2b‑3 split into three on 2026-08-28**, on the same argument: D6 is the only
> part of it that touches the write path of the busiest write in the product, so
> it lands on its own with the diff as its gate. **P2b‑3a is D6 — done**
> ([§P2b‑3a record](#p2b-3a-record--2026-08-28)). **P2b‑3b** is the Ledger
> module's own CRUD, `app-ledger-picker` and `resolveSystemGroup` →
> `resolveStatutoryLedger`. **P2b‑3c** is the Data Import module below. Both
> remaining slices are additive or mechanical, and both are gated on the diff
> being empty again. **Both are now done** —
> [§P2b‑3b record](#p2b-3b-record--2026-08-28),
> [§P2b‑3c record](#p2b-3c-record--2026-08-29).

**All of P2 is done as of 2026-08-29.**

D1–D8. `acc_ledgers`, the party and instrument ledgers, `journal_lines.ledgerId`,
the four other id holders, `resolveSystemGroup` → `resolveStatutoryLedger`, and all
65 `trx_groups` sites. The Ledger module's own CRUD and the shared
`app-ledger-picker`.

**And the Data Import module, which is not optional here** (F15). `src/const/import/`
carries 13 `trxGroupId` references in `voucher-import.const.ts` alone, plus
`opening-balance.const.ts`, `party-import.const.ts` and four import services, all
resolving a **group** as the posting target. They repoint with everything else.

The upside is worth stating, because it is the clearest user-visible win in the
whole programme: today a Tally import must **flatten** the customer's own tree
into our flat groups through a mapping-review screen, since there is nothing to
import a hierarchy *into*. After P2 there is — `resolveReservedAncestor` already
walks the parsed parent chain, so the tree the customer arrives with can be
**preserved rather than reconciled**, and the mapping review shrinks to the
genuinely ambiguous rows.

**Gate (P2a, met):** `npm run qa:p2-ledgers` — the ledger layer is complete and
**D5 resolves every journal line**, proved by a dry run over all 41,690, with
the declared exception computed a second independent way and agreeing. The
parity diff stays empty throughout, because nothing has been repointed.

**Gate (P2b‑1, met):** D5 landed — 41,690 lines repointed, `NOT NULL`, FK — and
the parity diff is **still empty**, because no report reads the column yet. Plus
three new properties: the stored column against the pure rule, the third cache
against its own Σ, and a live posting that provisions a ledger and is rolled
back. `npm run qa:p2-ledgers` — 229/229.

**Gate (P2b‑2, met):** the parity diff contains **the enumerated party exception
and nothing else** — 76,445 paths, 0 undeclared, 0 unmet, against a 513-entry
allow-file generated by `qa-coa-parity exceptions` and derived from the
repointing itself. `npm test` (1,812), all five CI guards, `lint:ci`, `build`
and `node scripts/check-mirrors.js` green; `qa:p1-group-tree` 126/126 and
`qa:p2-ledgers` 232/232. Shown to fail: a `ledgerId` repointed with the shadow
left alone reports 47 differences under the new code and **an empty diff under
the old** — [§P2b‑2 record](#p2b-2-record--2026-08-28).

**Gate (P2b‑3a, met):** all four id holders carry a `ledgerId` — 11,856 rows
backfilled, four foreign keys, four new hard-delete edges — and the **parity
diff across the change is empty**, captured before and after on the same
database. `qa:p2-ledgers` 302/302 with six new properties; `npm test` 1,825; all
five guards, `lint:ci`, `build`, `check-mirrors` and `qa:p1-group-tree` 126/126
green. Shown to fail twice: injected drift on two holders reports 3 failures and
names the rows, **and** an injected disagreement between a voucher's `ledgerId`
and its `groupId` posts to the voucher's ledger under this phase's code and to
the group's under P2b‑2's — [§P2b‑3a record](#p2b-3a-record--2026-08-28).

**Gate (P2b‑3b, met):** 18 routes over `acc_groups`/`acc_ledgers`,
`resolveSystemGroup` → `resolveStatutoryLedger`, and the **parity diff empty
again**. `qa:p2-ledgers` 312/312 with ten new properties (three of them writes,
all rolled back); `npm test` 1,840; five guards, `lint:ci`, `build`,
`check-mirrors` and `qa:p1-group-tree` 126/126 green. Both list routes are
`@SharedRead({ parties: false })` and the regenerated inventory shows them with
`partyReadable=false`, so `shared-read-party.spec.ts` sweeps them. Shown to fail:
with one statutory ledger's `legacyTrxGroupId` nulled, the leg lands on the real
statutory ledger under this code and on a **silently created duplicate** under
P2b‑3a's — [§P2b‑3b record](#p2b-3b-record--2026-08-28).

⚠️ **Two items moved out.** §3.3's `/transaction/ledgers` screen goes with **P3**
(it renders the tree the Trial Balance is about to) and `app-ledger-picker` with
**P4** (voucher entry is its only consumer). **Ledger creation** moved to P3 as
well, and that one is a finding: a ledger nothing places has no presentation
head, so its figures would vanish from every statement.

**Gate (P2b‑3c, met):** the real Tally backup is re-imported into a real batch
and the resulting `acc_groups` rows are read back and checked against the
source's own parent chain — `npm run qa:p2c-import-tree`, **227/227** over 14
companies, every write rolled back. The parity diff is **empty** across the
change. Shown to fail twice: a create-only placement lands the specimen in
Current Assets rather than Fixed Assets while every other property stays green,
and source-ordered creates fail the spec, the gate and the commit itself.

⚠️ **The voucher import needed no repointing**, and that is a finding rather than
a skipped step: D6 derives `ledgerId` in the one writer of each table, so a
caller stating one is exactly what it forbids. What the phase actually closed is
the **ledger placement** — 60 of the real backup's 230 ledgers were landing in
Current Assets or Current Liabilities whatever the customer's tree said. See
[§P2b‑3c record](#p2b-3c-record--2026-08-29).

### P3 · Reports, drill-down, and the Ledger report `[L]`

> **Split into four (2026-08-29), on the same argument as the three splits
> before it.** **P3a** is the additive half — the two reports §3.10 calls *new*,
> which read the new chart directly and move nothing. **P3b** is the only slice
> that changes what a customer sees, so it lands alone with the parity diff as
> its whole gate. **P3c** split in two: **P3c‑1** retires the presentation
> layer, and **P3c‑2** is ledger creation, which cannot come earlier — while any
> figure-bearing report resolves through `presentationGroupId`, a hand-created
> ledger has no presentation head and its money leaves every statement (§3.3,
> and the P2b‑3b record). **P3d** is the navigation spine and
> the Chart of Accounts screen, last because it has no backend risk in it and
> because the reports it moves between must exist first.

Trial Balance as a tree, Balance Sheet in Tally sections, the new Ledger and Group
Summary reports, the shared `DrillTarget` resolver and the Esc route stack.
Cash/Bank Book become Ledger instances.

**P3a — the Ledger report and the Group Summary. Done**
([record](#p3a-record--2026-08-29)). Both read `acc_ledgers`/`acc_groups`
directly, with no presentation rule in the path.

**Gate (P3a, met):** `npm run qa:p3-ledger-report` — **154/154** over 14
companies, fourteen properties, every one a question about the rows. The parity
diff across the change is **empty**, and that is *not* the gate here: an
additive report is absent from both sides of a snapshot diff and passes it by
default. What gates it is property (6) — Σ of the ledger closings presenting
under each legacy head against `trialBalance()`'s own figure for that head — plus
the census that no ledger falls out of the tree. `npm test` 1,889; five guards,
`lint:ci`, `build`, `check-mirrors`, `qa:p1-group-tree` 126, `qa:p2-ledgers` 326
and `qa:p2c-import-tree` 227 all green. Shown to fail twice: dropping the empty
month rows, and hiding a group's postingless ledgers — the second with every Σ
property still green, which is why the census sits beside them.

**P3b — the statements become the tree. Done**
([record](#p3b-record--2026-08-29)). Trial Balance grouped by default with a
Ledger-wise toggle, Balance Sheet in Tally's section order with the Profit &
Loss A/c as two lines, P&L, and the two label reads P2b‑2 left on the
`trxGroupId` shadow — both now the **ledger's** name.

**Gate (P3b, met):** the parity diff **and** `npm run qa:p3b-statements`
(309/309, sixteen properties over 14 companies), and neither would do alone.
⚠️ This entry used to say *"expect a declared baseline change rather than an
empty diff"*. It is empty, because the flat statements are still computed as
`legacy*` and are what the harness captures — so the diff answers *did a figure
move in what a customer reads today?* and the script answers *does the new
derivation reproduce it, head by head?* A report the harness has never seen
passes it by being absent from both sides, which is why the second half exists.
The two label reads are **masked** in the capture pair (`--mask-labels`): every
figure beside them is still compared per line, and whether each label is right
is asked of the rows instead — the 691-entry `head → ledger` allowance list the
obvious alternative wanted would have been derived by re-running the report's
own query, which is P2b‑3c's lesson.

**P3c‑1 — the presentation layer retires. Done**
([record](#p3c-1-record--2026-08-29)). The remaining `presentationGroupId`
callers — `party-statement.service.ts`, `trx.service.ts`'s two Outstanding reads
and `financial-dashboard.service.ts`'s inverted join — moved onto `acc_groups`;
the rule, the three `legacy*` statements, `?view=legacy`, `natureShift` and the
harness's exception generator are deleted; the Group Book took the tree's id
space; and `qa-artifacts/tests/reports/` was ported to the tree.

**Gate (P3c‑1, met):** the parity diff, **empty** over everything that is still
the same report — seven declared re-basings, 803,098 paths compared per figure —
plus five re-based gate scripts (`qa:p1-group-tree` 56, `qa:p2-ledgers` 325,
`qa:p3-ledger-report` 140, `qa:p3b-statements` 323, `qa:p2c-import-tree` 227) and
`qa-artifacts`' own suite at **203 passed · 8 failed** against a measured
baseline of **186 · 25** on `main`, the eight a strict subset of the
twenty-five. ⚠️ The half of every earlier gate that was *another report* is gone
with the flat statements; each tie is now against **Σ over `journal_lines`**,
restated in the gate. `diff --rebased` is the new declaration and it is not an
allowance: it says *this report is not the same report on both sides*, drops the
paths under a named prefix from BOTH, prints how many it dropped, and fails a
prefix that matches nothing.

**P3c‑2 — ledger creation. Done**
([record](#p3c-2-record--2026-08-29)). `AccLedgerService.create` and
`POST /acc-ledgers`, with `describeLedgerPlacementBlock` at the seam
(`groupAcceptsLedgers` is the same rule as a predicate). ⚠️ It writes the
**pair**: `journal_lines.trxGroupId` is `NOT NULL` until D9 and every voucher
picker still lists `trx_groups`, so a ledger with no legacy head appears on
every statement at nil and can never be posted to. Unblocking the reports was
not the same as unblocking the write.

**Gate (P3c‑2, met):** `qa:p2-ledgers` (20) — a ledger created through the
service, a **real balanced entry** posted to it, and the rupees followed onto
the Trial Balance, the Group Summary and whichever of the Balance Sheet or the
P&L its group's nature belongs to, all rolled back. **333/333**, and the parity
diff across the change is empty. ⚠️ Money rather than a name: all three reports
LEFT-join their aggregate from `acc_ledgers`, so a created ledger appears on
them at nil whatever happens — the version of this check that looked for the row
would have passed on the build where nothing could be posted to it. Shown to
fail twice: dropping the twin, and re-instating the retired presentation join's
shape in `ledgerFigures` (which leaves (20d) green, because the Group Summary
has its own query).

**P3d split in two (2026-08-29)**, on the same argument as the five splits
before it: the half §P3's gate is written about is measurable end to end today,
and the Chart of Accounts screen is a master with no figure on it.

**P3d‑1 — the drill spine, Esc as a route stack, the Ledger report's screen.
Done** ([record](#p3d-1-record--2026-08-29)). One `DrillTarget` union and one
resolver; a report's period in its own URL; Esc listened for in exactly two
places, because the last hop is a voucher screen that already owns the key.

**Gate (P3d‑1, met):** four properties in a browser
(`qa-artifacts/tests/ui/money/drill-spine.ui.spec.ts`, run by `npm run
qa:money`) — Balance Sheet → group → ledger → voucher with **every click
counted**, Esc back out with each screen on its own period, a posting with no
document rendering as visibly-not-a-link, and a navigation nobody drilled
clearing the stack. ⚠️ The parity diff is **empty by construction** and gates
nothing here: this phase changes no query and adds no report, so the diff would
be empty if the whole phase had been deleted (§6.4's rule again). Shown to fail
four times — and ⚠️⚠️ **one of those injections passed first**, because the
busiest ledger's last posting is *today* and today is what the screen's own
default period puts in `to`: the **fixture** was what could not fail, not the
assertion.

**P3d‑2 — `/transaction/ledgers`, the Chart of Accounts screen. Done**
([record](#p3d-2-record--2026-08-29)). The tree-plus-grid master over the
`acc_groups`/`acc_ledgers` API that has been complete since P3c‑2. It replaces
Masters ▸ **Nature**; Masters ▸ **Transaction Group** deliberately stays until
D9, because it is still the only door to a legacy head's opening balance and its
`groupFor`.

**Gate (P3d‑2, met):** every rule the API refuses is refused on the screen too —
each with the message that names the actual problem rather than a dead button —
measured as four properties in a browser
(`qa-artifacts/tests/ui/masters/chart-of-accounts.ui.spec.ts`, run by `npm run
qa:screens`) and **shown to fail four times**. The refusals are mirrored into
`client-front/src/utils/ledger-rules.util.ts` and compared **by message text**,
not by verdict, by `check-mirrors.js` check 10 — 182 rows over 21 region cases,
with DRIFT and RULE CHANGED both reproduced. ⚠️ That check still cannot gate the
phase: agreeing about a sentence is not showing it, and a screen that computed
the right refusal and rendered nothing passes all 182 comparisons. ⚠️⚠️ Two arms
turn on whether anything has **posted**, which is on no payload this screen
reads; those are left to the server rather than guessed, the dialog says what
will happen, and the gate asserts the server's sentence by text. The parity diff
is **empty by construction** — the whole backend diff is one field on
`GET /acc-groups/tree`, a route no captured report reads.

### P4 · Voucher entry `[XL]`

The unified entry screen, its modes, the function keys, `Alt+C`, `Ctrl+A`,
`Ctrl+H`, `F12`. `groupFor` stops being consulted (F4) and the picker offers what
the group nature allows. The old routes redirect — **fourteen of them, not six**
(F6).

> ⚠️ **§3.5 names two modes and the code needs three** (F6). Six of the ten
> document types `trx-add-edit` serves — purchase requisition, purchase order,
> goods receipt, quotation, sales order, delivery challan — post **no GL at
> all** (`buildLegs ⇒ []`). They are workflow documents with items and no legs,
> which is neither Accounting Invoice (ledger rows, no stock) nor Item Invoice
> (stock rows allocated to ledgers, then tax). Tally reaches them with
> `Ctrl+F8`/`Ctrl+F9` and `Alt+F8`/`Alt+F9`, already listed in §2.2 and only
> partly in §3.5's key map. Decide the third mode before building the mode
> toggle, not after.

**Gate:** `check-mirrors.js` reports no lifecycle drift across all 487 vectors;
`qa:money`, `qa:print` and `qa:shell` green; a keyboard-only operator can post one
of each voucher type without a mouse.

### P5 · Bill-wise details `[L]`

§3.6 in full, including Advance and On Account, Bills Receivable/Payable, and the
reconciliation that closes BUG-0040's two-sided problem for good.

**Gate:** for every party in every QA company, the ledger-side balance equals Σ of
its open bill references. That equality is a **test**, not a report.

### P6 · Trading Account and Gross Profit `[M]`

§3.8. Direct/Indirect assignment reviewed per company, the two-statement P&L, and
`CLOSING_STOCK_INCOME` retired from new postings.

**Gate:** Net Profit after the split equals Net Profit before it, on every company
and every period.

### P7 · Cost centres `[L]`

§3.7 in full, including categories, classes and the four reports.

**Gate:** every Trial Balance figure is unchanged by the presence of allocations —
the proof that the GL was not touched.

### P8 · Posting rules, budgets, interest, multi-currency, scenarios `[L]`

§3.4's rule table and §3.9's four features. Sequenced last **deliberately**: the
rule table is only worth extracting once the leg set has stopped moving, and doing
it earlier would mean rewriting it twice.

**Gate:** re-posting every QA voucher through the rule interpreter produces
byte-identical journal lines to the switch it replaced.

> **If the programme has to be cut.** P0–P4 is the coherent unit — it delivers the
> ledger model, the reports and the entry screen, which is what "work like Tally"
> means to a user. P5 is the highest-value single addition after that. P8's rule
> table is the one that pays for itself over years rather than at launch, and it is
> also the cheapest to defer, since `resolveStatutoryLedger` is already the seam it
> needs.

---

## 6 · Repo guard-rails this programme trips

This codebase fails a test rather than shipping a silent gap, in nine specific
places that new tables and new routes touch. Each is a **build break**, not a
review comment — which is the good news.

| Guard | What this programme must do |
|---|---|
| `tenant-scope-registry.const.ts` | Classify all fourteen new entities as `scoped`. An unclassified entity is a failing test. |
| `company-hard-delete-order.const.ts` | Add every new FK edge to the hand-transcribed edge list. Kahn's algorithm and the `information_schema` census in `hard-delete.spec.ts` will both catch an omission — the census asserts a deleted company leaves **zero** rows in every `companyId`-bearing table. |
| `ci-guard-raw-sql.ts` | All 65 rewritten sites bind `companyId` for **every joined scoped table**, not just the driving one (BUG-0047). The join allow-list is empty; keep it empty. Note the allow-list is keyed `path:line`, so an edit in a file with entries moves them — re-read each key after this work. |
| `ci-guard-cached-state.ts` | The ledger tree is the exact shape that caused BUG-0036 — a per-company structure that begs to be memoised on a singleton service. **Do not cache it.** One indexed read per request. |
| `audit-coverage.const.ts` | Ledger and group mutations are identity-and-money adjacent; tag them `@Audit()` and add the controllers to the covered set, or the new handlers sit outside a line D-36 drew deliberately. |
| `shared-read-party.spec.ts` | Sweeps every `@SharedRead()` route as a trading party and asserts the allow-list **exactly**. The ledger picker will be swept the day it lands (§3.3). |
| `parent-scope.spec.ts` · §4.3 rule 7 | Every caller-supplied `ledgerId`, `groupId`, `costCentreId`, `billReferenceId` needs an ownership check before it is written against. These point at company-scoped tables, so `findByPk` under the hooks is enough — but a `*UserId` still needs `assertMemberIsOurs`. Put the checks at a **seam**, not per call site (BUG-0032). |
| `check-mirrors.js` (root repo) | **Ten** checks since P3d‑2, whose check 10 runs both copies of the Chart of Accounts' five refusals over `scripts/vectors/ledger-rules.vectors.json` and compares the **message text** — the sentence is the deliverable there, so a mirror agreeing about the verdict and not the wording is the drift that matters. New permission keys must land in `permission-registry.ts`, `module-licence.const.ts`, the frontend `module-licence.ts` and `navigation.config.ts` **together**. ⚠️ *"Retiring `trx-nature` means retiring it in four places"* — this row's own earlier wording — turned out to be **wrong in the safe direction**, and P3d‑2 measured it: retiring the *screen* touches `navigation.config.ts` alone. The key stays in `permission-registry.ts` and in **both** copies of `MODULE_BY_PERMISSION_KEY` because `TrxNatureController` still uses it and check 3 compares those two maps exactly — pulling the key would have left the API ungated or the check red. The key goes with the table, at D9. ⚠️ It compares **across submodules only**, so the second copy of Tally's 28 group names — `tally-chart.const.ts` beside `tally-nature-map.const.ts`, both in `client-back` — is invisible to it (§3.2, V3). That pair needs a co-located spec asserting identical key sets, or it is a mirror with nothing behind it. |
| Data Import — `src/const/import/` | **Answered by P2b‑3c**, and not the way this row expected. The 13 `trxGroupId` references stay: D6 derives the ledger in the one writer of each table, so a caller stating one is what it forbids. What did change is `import-group-tree.const.ts` (+ 21 tests) and where an imported head's ledger LANDS. `scripts/qa-p2c-import-tree.ts` is the gate. |
| D-49's writer list · `assertPostingAllowed` | The unified entry screen adds writers of `journal_entries` and `stock_movements`. Every one must clear the financial-period gate on **both** dates when it supersedes an approved voucher (BUG-0028). `grep -rn "reverseSource\|inventoryService.reverse"` is the check, and CLAUDE.md §4.9 must list every writer. |

And **CLAUDE.md itself**: §15 requires the map to be updated in the *same commit*
as the change, for guard-chain changes, new permission keys, new licensed modules
and cross-service contracts. This programme touches all four. Sections 4.3, 4.9,
10, 12 and 14 need rewriting as the phases land — **§4.9 most of all**, since much
of it describes a ledger layer that will no longer exist.

---

## 7 · Risks, and calls made

### Risks

| # | Risk | Mitigation in this plan |
|---|---|---|
| **R1** | `[high]` Full Tally entry replacement destabilises the GST/e-invoice/e-way/stock path. | Item Invoice mode **is** the current form, re-hosted as a child component. No rewrite of `TrxWriteService`, `applyCatalogueSnapshots`, the IRN payload or stock movement. P4's gate includes `qa:money` and `qa:print`. |
| **R2** | `[high]` Repointing `journal_lines` on live books. | Shadow column kept for a release; parity harness gates the ship; no journal entry is re-posted, only re-pointed; D9 is a separate release. |
| **R3** | `[med]` Party-ledger explosion makes the Trial Balance unusable. | Groups collapsed by default (Tally's own behaviour). Ledger-wise is a toggle, and it pages. |
| **R4** | `[med]` Hierarchy queries regress report performance, already tuned with optimiser hints at 250k vouchers. | Materialised `path`, no recursive CTE; reports stay aggregate-then-join; roll-up by path prefix. Re-measure against the same dataset at P3's gate. |
| **R5** | `[med]` Cost allocations inflate GL volume or introduce a second balancing rule. | Allocations are a satellite table keyed to `journal_lines.id`. The GL never sees them; P7's gate is that no Trial Balance figure moves. |
| **R6** | `[med]` Multi-currency changes the meaning of every amount column. | `debit`/`credit` stay base-currency and authoritative; foreign amounts are additive columns. Every existing report is unaffected by construction. |
| **R7** | `[med]` Programme size — nine phases across two repos and 137 QA specs. | P0–P4 is the shippable unit; each phase leaves the app working and has its own gate. Nothing after P4 blocks anything before it. |
| **R8** | `[high]` **Merging a party's two positions moves real figures, and balances while it does.** ~~63 parties, ₹1.57 crore off each of Sundry Debtors and Sundry Creditors~~ → **76 parties; Sundry Debtors −₹2,51,44,323.21 and Sundry Creditors +₹2,51,44,323.21, exactly opposite.** Added 2026-08-28 (F14); figure corrected the same day while building D3 ([§P2a](#p2a-record--2026-08-28)) — the original was `Σ min(|debtorNet|,|creditorNet|)`, which under-counts because parentage is by *gross*, and misses 13 parties that are not dual-role at all. | The one declared exception to the parity gate, enumerated party by party before D3 and asserted as *exactly* that set (§4.2). Gross positions survive in `bill_references` (P5), which is where Tally itself keeps them. The parenting rule is reviewed by a human, not computed — [closed #4](#closed-on-2026-08-28). |
| **R9** | `[med]` **Multi-GSTIN is a parity gap this plan does not close**, and closing it later is harder once every ledger, party and voucher has been repointed once (X1). | Decide *before* P2 whether registration becomes a dimension. If yes, `acc_ledgers` and the voucher header carry a `registrationId` from the start — a nullable column added at D1 costs nothing and retrofitting it after P4 means a second pass over the same tables. If no, say so on the record. [closed #5](#closed-on-2026-08-28). |

### Calls made without asking

- **One ledger per party per company** — *not* one per direction. A party who is
  both keeps one ledger and shows on the side its balance falls, which is what
  Tally does (it does not restrict a ledger from carrying an obverse balance —
  a Sundry Debtor may sit in credit).
  > ⚠️ **Revised 2026-08-28.** This call said "parented … by their declared
  > role". **There is no declared role** — `UserKind` is `staff | party |
  > system`, `company_parties` has no such column, and `PartyDirection` is
  > decided per voucher inside the posting engine and stored nowhere (F14). It
  > also turns out to move **₹2,51,44,323.21 between the two control heads**
  > across 76 parties, which the call was made without knowing (measured while
  > building D3 — [§P2a](#p2a-record--2026-08-28); the first estimate,
  > *"₹1.57 crore off each side across 63 parties"*, was a `min()`). The call itself
  > stands — it is what Tally does — but it is now [closed #4](#closed-on-2026-08-28)
  > rather than a decision already taken, and its cost is the single declared
  > exception to the parity gate (§4.2).
  `partyUserId` stays on the line as a denormalised aid.
- **`trx_accounts` survives as an instrument satellite** rather than being deleted.
  It holds real detail (IFSC, UPI id, credit limit) that a Tally ledger holds in
  its own bank-detail block, and keeping it preserves `AccountType`'s derived
  cash/bank book split (D-54).
- **`trx_natures` is retired, not fixed in place.** Four rows per company that must
  never differ from a code enum are a table pretending to be data.
- **Cost allocations are never journal lines.** Stated as an invariant rather than
  a preference, because the alternative quietly weakens the one rule the whole
  engine rests on.
- **Interest is never auto-posted.** It produces a report; posting is an explicit
  Debit Note a person accepts. Tally behaves the same way, and the alternative
  writes into a customer's books without them asking.
- **Posting rules come last (P8), not first.** Extracting a rule table before the
  leg set stops moving means writing it twice.

### Open — confirm before P2 starts

1. **Group naming on migration.** Should existing companies' groups be **renamed**
   to Tally's names, or keep their current names as ledgers under Tally-named
   groups? *This plan assumes the latter* — an operator's own head names survive,
   only the tree above them is new.
2. **Direct vs Indirect assignment (P6).** A per-company review step with a guided
   screen, or a defaulted mapping they can re-parent afterwards? *This plan assumes
   defaults plus re-parenting.*
3. **Old voucher routes.** Permanent redirect at P4, or kept live behind a setting
   for one release? *This plan assumes permanent redirect.* Note the count is
   **fourteen** routes, not six (F6).

### Closed on 2026-08-28

Both were raised by the verification pass as blocking for P2, and both were
answered the same day. Recorded here rather than deleted, so the reasoning is not
rediscovered.

4. ~~**How is a dual-role party parented, and who decides?**~~ `[R8]` →
   **derive, then have a human confirm.** One ledger per party stays — it is what
   Tally does, and Tally lets a ledger carry an obverse balance rather than
   splitting the party. The side is derived from **gross** volume on each control
   head, the whole assignment is written to a reviewable `party_ledger_plan`
   before D5 with both gross figures and the netted amount, and every row is
   overridable. The 63 that net are flagged for attention; the other 299 are
   unambiguous. See [§4.1 D3](#41-order-of-operations).

   The rejected options are worth keeping. **Two ledgers per dual-role party**
   would have made the parity diff genuinely empty and was refused because one
   business appearing as two account heads is a worse daily cost than a
   one-time, enumerated, reviewed movement. **Deriving silently** was refused as
   BUG-0034's shape — a fact derived from a master with nothing reading it back —
   where the first reader of the change would have been a customer whose
   creditors figure had dropped overnight.

5. ~~**Does a company get more than one GST registration?**~~ `[R9]` →
   **reserve the column, build later.** `acc_ledgers`, the voucher header and
   `bill_references` carry a nullable `registrationId` from D1, wired to nothing.
   Multi-GSTIN stays out of this programme's scope; what changes is that the
   option survives it. See [§3.1](#31-schema) and [§2.5 X1](#25-what-tally-has-that-this-plan-does-not-cover).

   Note the direction this cuts against: CLAUDE.md §5 records that `companies`
   *deliberately* replaced the old GSTIN-keyed `tenants` table, whose
   `UNIQUE(gstin)` stopped one owner running several companies on one
   registration. That fixed the reverse problem. Reserving the column is what
   keeps this one answerable without undoing that.
