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

**And P4a is done: the voucher head is a LEDGER.** `app-ledger-picker` replaces
the six `trx_groups` pickers the entry screens carried, `Alt+C` creates a master
without leaving the field, and **`groupFor` stops deciding what is pickable** —
which is **F4**, the finding this programme opened with as *the most likely
source of "why can't I select my own ledger?"*. A Sales voucher's head went from
**one** option to five, a Purchase from one to thirteen, a Payment head from two
to thirty-nine; every context is a measured widening. ⚠️ The two **control
heads** stop being offered, which is the reachable-by-a-person gap D6 named and
could not close on its own. The picker binds the ledger's `legacyTrxGroupId`, so
no DTO, no service and no report changed and **the parity diff is empty**.
Building it found `app-select` swallowing **every keyboard chord** since it was
written — `Ctrl+S` did nothing while a picker's search box had focus — and a
saved head with no ledger about to render as a blank field, which is a
data-loss bug rather than a cosmetic one.

**And P4b is done: Contra, Payment, Receipt and Journal are ONE screen.**
`/transaction/voucher/<type>` is the unified entry surface; the three components
it replaces are deleted, their routes redirect, and the Dr/Cr grid is **derived
from `buildLegs`** — the rows a voucher draws are the legs it will post. §3.5's
missing decision is taken with it: the third mode is the **Workflow Document**,
whose invariant is the conversion chain rather than a balance and which is
deliberately not a `Ctrl+H` destination (F6). ⚠️ Deriving the grid immediately
contradicted the screen it replaces, and the screen was wrong: the old Payment
drew its **head** as the debit row with the amount beside it, and that head is a
leg of **0 of 974 posted payments and 0 of 1,888 receipts** (against 204 of 204
for journals) — the ledger actually debited, the party, was in a side panel with
no Dr against it.

**And P4c is done: the item grid is on the same surface.** Purchase, Sales and
both notes are typed at `/transaction/voucher/<type>` beside the four cash
vouchers — eight types, one surface, two components — and `trx-add-edit` was
**re-hosted, never rewritten**: no DTO, no service, an empty backend diff, and
its 2,250 lines untouched but for the keyboard. The type bar became a shared
component because one surface cannot have two copies of its own button row, and
F4/F6 stopped focusing pickers, which is P4b's correction made a fourth time.
⚠️ Building it found every blank item voucher **born dirty** — P4a's head
preselect propagates through the `ControlValueAccessor`'s view→model path, which
Angular reads as a keystroke — so making a type switch a navigation turned
*"Discard unsaved changes?"* into a prompt between every pair of the eight
vouchers on an empty form.

**And P4d is done: the third mode exists, and the surface is complete.** All
**fourteen** types are typed at `/transaction/voucher/<type>` — the six Workflow
Documents joined the eight — and **no type has an entry route outside the surface
any more**, which is the remaining route redirects. It took **no third
component**: a Workflow Document's grid, pickers and options bar are the item
form's, and what makes it its own mode is the invariant, which `trx-add-edit` has
enforced through `isFinancialTrxType` all along. What it took was turning one
condition round — `loadFor` asks *"is this an accounting voucher?"*, the half
with a closed membership, because asking the other way round drops all six onto
the Dr/Cr grid and draws a Purchase Order as **two rows whose totals are both
zero**, which is precisely the shape F6 was filed about. ⚠️ Fourteen buttons is
not a row of keys, so the eight that post stay a row and the six that do not sit
behind one overflow — a split that **is** `buildLegs` returning legs or none, and
the surface the *no-invented-chords* ruling implies must exist, since purchase
requisition and quotation have no chord at all. ⚠️⚠️ And the mode had to become
**visible**: a document with the item grid and neither of its guarantees reads as
an invoice that has quietly lost its totals, so the title bar states what it
converts into — the mode's own invariant, and the stage *this* company will
actually convert into rather than the one the chain names.

**And P4e‑1 is done: an Accounting Invoice IS representable, and this plan said
it was not.** P4c measured that `trx_items` names a product and never a ledger and
that `buildLegs` gives a sales voucher one `Main` leg, and concluded Tally's
N-ledger invoice needed a new allocation table, several legs, a migration and a
backfill — **XL**. The measurements stand; the conclusion did not. `trx_charges`
is already a per-row `{ ledger, amount, tax }` and `resolveLegs` already expands
it one journal line per row onto that row's own ledger, with nothing constraining
a row's head. A no-items Sales voucher with one allocation to the Sales head
posts **Party Dr 59,000 · CGST Cr 4,500 · SGST Cr 4,500 · Sales Cr 50,000** —
Tally's own posting — with no migration, no DTO change and no posting change.

⚠️ **It was unusable until GST-021 was fixed the same day**, and that is the
phase's real find: `GstReturnAssemblyService` loaded `trx_items` alone, so a
charge's value and its tax reached neither GSTR-1 nor GSTR-3B. On the existing
books that under-declared ₹816 of output tax and left **49 invoices** whose
payload did not close against their own declared value; on an Accounting Invoice
it would have been the *whole document* declared to nobody. `qa-artifacts`' own
oracle was blind in the identical way **and passing**, because every
charge-bearing voucher falls outside the twelve reconciled periods — a missing
rule reconciling against a missing rule for a financial year.

**The ruling is single-head**, and it stands even though the mechanism gives N
heads for the same code: 475 of 475 service-only vouchers carry exactly one
distinct product.

**And P4e‑2 is done, which closes P4: `Ctrl+H` exists.** The four financial item
vouchers switch between stock lines and ledger allocations on the chord and on a
button; a saved voucher reopens in the body its own rows imply, read from the
rows because there is no column to disagree with them; and the six print
templates render an Accounting Invoice as a document that adds up. It needed no
new form control — `trx-add-edit`'s `charges` FormArray was already
`{ ledger, amount, tax }` per row, and P4e‑2 renders it as the body instead of as
a folded chip. ⚠️ Building it found the print half **twice**: the document first
printed no body at all (predicted, and common to both candidate shapes), and then
printed one reading *"Sub Total 0.00 … Grand Total 56,000.00"*, because
`trx.totalAmount` is the **item** net and is zero here. The second was not
predicted; it was found by reading the paper. ⚠️⚠️ And the gate caught an
exclusion the author had talked himself into — the two notes, kept out on an
argument that did not survive `trxAgainstIds` being an optional *header* field
and **43** of this database's service-only vouchers being credit notes.

**P5's gate was then measured before P5 started, and it very nearly held: 380 of
381 parties reconcile.** D-55's opening-balance term had been doing nearly all
the work BUG-0040 asked for — take it out and 54 parties break by ₹2,65,468. The
381st was a real defect, **BUG-0069**, fixed in its own commit: under D-52 a
reverse-charge purchase owes its supplier `net + charges`, and the bill-wise
annexure was billing them the tax as well — ₹944 against a ledger saying ₹800,
while `vendorOutstanding` read `journal_lines` and agreed with the ledger. ⚠️ The
fix that derives the share from the `reverseCharge` **flag** is wrong and was
measured to be: D-52 is forward-only, so 15 of the 19 flagged purchases carry the
full grand total on their party leg and restating them turned a ₹468 gap into
₹2,160. The annexure reads what was **posted** — which is what §3.6 already had
P5 doing by hanging `bill_references` off `journalLineId`. The gate now reads
**381 / 0 / ₹0.00**, so P5 starts green.

**And P5a is done: the bill register exists and is backfilled over the whole of
history**, 11,080 references covering all 11,051 party lines on 834 ledgers, gate
**144/144**. It is not a second derivation of a party's balance — it is a
**partition of the journal lines that already make it up**, which is what stops
BUG-0040 being a recurring class rather than fixed once more: a partition cannot
omit a term, because the term is a row. Nothing read it yet; the annexure moved
onto it at P5d. ⚠️ Its fourth backfill step wrote **zero** rows — every one of
the 2,759 approved payment/receipt vouchers is fully allocated — so `advance` and
`on-account` have no instance and this gate asserts nothing about them. That arm
is **P5b's**, and saying so beats a green line implying otherwise.

**And P5b is done: the posting engine maintains the register**, from
`persistLines` — the one writer of `journal_lines` — so the invariant is
guaranteed by the seam rather than by three call sites remembering. Its gate is
**7/7** over cases this database does not contain: `advance` and `on-account`
have no instance in the world, so the gate constructs a partly-allocated receipt
and an unallocated one. ⚠️ The half a backfill could not teach is **cancellation**
— a reversal *retires* the original's references and records none of its own,
because both entries leave the live population together. ⚠️⚠️ And dropping the
unapplied remainder is caught **at write time by the posting itself** rather than
by an assertion: a posting that cannot describe itself is a refused transaction
naming the line and both figures.

**And P5c‑1 is done: a voucher may name no bill.** Until it, a payment or receipt
had to name an open `trx` document — so an **advance** was impossible, and **53
parties (₹2,65,000) were unsettleable**, their only open item being an opening
balance, which has no `trx` row to appear in a picker built from `trx`. Gate
**9/9**, and its first property measures the gap from both sides at once:
`getDueInvoice` answers 0 where `openBills` answers the bill. ⚠️ The refusal was
written **twice, independently** — `saveReceipt`'s own and `planSettlement`'s —
so relaxing either alone would have changed nothing; §13's standing shape, found
only by going looking after relaxing the first. `advance` vs `on-account` is a
**column**, because there is no arithmetic that separates intent.

**And P5c‑2 is done: the reference grid exists.** A payment or receipt is
entered against the party's open **bills** — read from the register, so an
opening balance is on the list — with a per-bill column saying what this voucher
applies to each. That column is the whole reason a grid replaces a multi-select,
and it is `planBillSettlement` mirrored: `check-mirrors.js` **check 12** runs
both implementations over a shared vector table and compares the **mappings and
the message text**, so the figure on screen is the allocation the server writes
and a refusal arrives in the server's own sentence. The screen it replaces
restated three arms of that rule by hand and said nothing about the other three.
⚠️ Making the rule mirrorable meant splitting it: `planSettlement` speaks in
documents and `settlementRole` switches on `TrxType`, neither of which can say
anything about a bill no document made — so the general form is
`planBillSettlement`, stated about bills, with the old entry point as its
adapter. It had to move file, too: `settlement.const.ts` imports a Sequelize
entity and **could not be bundled** by the mirror check at all.

**And P5c‑3 is done, which closes P5c: the opening balance can be ticked.**
`trx_payment_receipt_trxs.trxId` was a `NOT NULL` foreign key to `trx`, so a bill
the register raised on its own had nowhere to go on the wire — which is why
P5c‑2 could **show** those 53 parties their only open item and not let them
settle it. The column is nullable now, `billRefId` sits beside it, and
`chk_trxprt_one_target` makes the database insist on exactly one of the two.
⚠️ The two halves are planned **together**, by one call to `planBillSettlement`,
because the screen already plans the whole selection at once with that same
mirrored rule — two plans would give the column an operator reads and the
allocation the server writes two derivations of one cash figure. ⚠️⚠️ And the
**mixed** case has no instance in the world: not one party here holds both an
opening balance and an open document, so the gate builds it, exactly as P5b built
`advance`. Gate **18/18**, four injections; the browser property that asserted a
disabled checkbox **inverted** and now follows the tick all the way to the
`against` reference it writes.

**And P5d is done, which closes P5: the annexure reads the register, and Bills
Receivable / Payable exist.** Three hand-written terms came out of `pendingBills`
— D-18's note netting, BUG-0069's posted party share, D-55's synthesised opening
balance — each one a term that had gone missing once and been put back by hand.
A partition cannot lose a term, because the term is a row. Measured before the
phase: **381 party ledgers, and the signed sum of their open bills already
equalled every one of their balances, gap ₹0.00.** Gate **16/16**, three
injections; the parity diff is **empty over every other report**, with the
annexure declared `--rebased` because it is not the same report on both sides.
⚠️ One thing moved and it was ruled: **a return note is a bill of its own on the
opposite side** rather than folded into the document it names — 180 of 802
parties' totals — because the entry screen's own grid has drawn it that way since
P5c‑2, and a collections sheet and a settlement screen disagreeing about what is
open is the defect this programme keeps closing. ⚠️⚠️ Building it found the
phase's own **two id spaces in one column** (`bill_references.voucherId` is a
`trx` id on a document bill and a `trx_payment_receipts` id on an advance),
caught by the gate's constructed-advance property.

⚠️⚠️ **Building it found [BUG-0070](../qa-artifacts/docs/bugs/BUG-0070.md)**, and
that is the phase's real find: approving any payment or receipt offset by a
credit note threw *"Bill references do not balance"* and rolled the approval
back — **44 draft vouchers were un-approvable** — because an allocation row
records document settlement while a reference partitions a journal line, and the
two coincide only until a note enters. Neither existing gate could see it: one
reads history, which contains no approved voucher of the shape, and the other
builds only the cases somebody named.

**And P6 is done: the P&L is two statements, and Net Profit did not move.** A
**Trading Account** — Sales · Direct Incomes against Purchases · Direct Expenses
— closing at a **Gross Profit** carried down into a **Profit & Loss Account** met
by the indirect halves. §3.8's own opening sentence turned out to be the whole
design: the split *arrives free with the group hierarchy* P1 seeded, so it is
four `systemKey`s and no new column, no per-company setting and one migration.
Gate **154/154** over 14 companies and 66 period-reports; the parity diff is
**0 changed, 0 removed**, with the three new payload fields declared `--rebased`.
⚠️ **The plan's gate is not enough on its own, and that was measured**: filing
Purchase Accounts below the line moves ₹5.6 crore and takes company 28's Gross
Profit from −₹2.15 crore to +₹3.47 crore while Net Profit stays right to the
paisa and six of the ten properties stay green — they are invariants of *a*
partition, and a wrong partition is still a partition. ⚠️⚠️ **The first injection
PASSED, and the gate was the defect**: (5)'s oracle *imported* the four trading
keys, so it moved with the rule it was checking — §13's standing shape in
P2b‑3c's variant, third occurrence. ⚠️ `CLOSING_STOCK_INCOME` **could not be
retired the way §3.2 imagined**: §3.10 derives the Balance Sheet from
`journal_lines` alone, so `Dr Stock-in-Hand` must be posted and its credit exists
whatever it is called — what P6 changes is that the credit prints *inside* the
Trading Account (`Direct Incomes`) instead of below the gross-profit line, where
`fallbackGroupForNature` had put it. It moves no figure — not one closing-stock
entry exists in 14 companies — which is why the gate **constructs** one. And open
question 2 closed with nothing built: Direct ↔ Indirect is a **within-nature**
move, so the re-parenting P3d‑2 shipped already permits it on a posted ledger.
⚠️⚠️ Building it found the statements' tree drawing **every** figure left-aligned
in the body font on all three statements since P3b — `app-statement-tree` shares
`reports.shared.scss` to prevent exactly that, and an ancestor-qualified rule
cannot reach it, because Angular stamps every compound of a descendant chain.

**And P7a is done: the books have a parallel dimension, and the general ledger
does not know it exists.** `cost_categories` and `cost_centres`, the second
caller of `materialised-path.const.ts` — which had already anticipated it in its
own header — and the invariant §3.7 asks for: **Σ per category, never Σ over the
line**, because *Department* and *Location* cut the same expense in parallel and
four rows totalling ₹3,38,800 against a ₹1,69,400 line is **correct**. It warns
and never refuses, which is §3.7's own ruling and `statutory-windows.const.ts`'
precedent, and a test asserts the no-throw so it cannot be reversed by accident.
Gate **264/264**, four injections, parity diff **empty** with nothing re-based.
⚠️ **The whole feature has no instance anywhere** — `costCentresApplicable` is
`0` on all 1,383 ledgers of all 14 companies, there are zero centres, and the
real Tally backup carries one category, eleven switched-on ledgers and **no
centres at all**: its owner turned the switch on and never created one. So the
gate constructs everything it measures, P5b's `advance` arm a fourth time. ⚠️⚠️
Two guards bit, both usefully: `ci-guard-raw-sql` failed on **seven sites that
were not P7a's**, because its allow-list is keyed by `path:line` and the
provisioning seed moved every entry below it (CLAUDE.md §14's own trap, met);
and `check-mirrors` caught the licence key existing server-side with no
frontend half. ⚠️ The third injection was caught **twice** — once by the
property it was aimed at and once by a refusal asserted against its own
sentence, *"still holds 2 cost centres"*, which counted 3. That is the argument
for matching the message rather than the throw, made by accident.

**And P7b is done: the dimension has figures, and the general ledger still does
not know.** `cost_allocations` hangs off `journal_lines.id`, `trx_cost_allocations`
holds what a document *says*, and `persistLines` — the one writer of journal lines
— turns the second into the first, beside the bill register and for the same
reason. §5's own gate sentence (*"every Trial Balance figure is unchanged by the
presence of allocations"*) only became falsifiable here, and it is asked as a
**deletion**: the three statements are captured with the rows present, the rows are
deleted inside the same transaction, and all three are captured again — so
`0 changed` is a statement about the allocations rather than about the voucher.
Gate **139/139**, six injections, parity diff **empty**. ⚠️ **The sign is the
leg's, never the operator's**: the wire carries a magnitude, `buildLegs` decides
the side, and that one decision buys the credit-side head, the flipped negative
charge and — the part worth carrying — the **reversal**, which *negates* where a
bill reference *retires*. An allocation is signed, so the cancelled pair cancels
itself and a gross Σ that forgot `liveEntrySql` is **still right**: BUG-0044's
lesson applied in a new dimension before it could be repeated there. ⚠️⚠️ Two
tables, because a **draft has no journal line** — a voucher posts at approval and
an edit reverses and supersedes it, so an allocation typed during entry has to
survive three states in which no line for it exists; that is `trx_payment_receipt_trxs`
beside `bill_references`, exactly. ⚠️ Building it found the raw-SQL guard passing
on an **allow-list entry that described nothing**: P7a's `information_schema` probe
was deleted when P7b's tables arrived and its justification stayed behind. The
guard now fails a stale key, which is `judge()`'s own argument — *an allowance
matching nothing describes a migration that did not happen* — moved one file
across.

**And P7c‑1 is done: the dimension has Tally's percentage template.** A **cost
centre class** — §2.4's own sentence, *"pick one name and the allocation happens
automatically"* — and the one rule that makes such a template safe to store: each
category's lines total 100 %, refused on the **master** even though §3.7 has a
partial allocation only *warn* on a voucher, because a definition that totals
90 % can never produce a complete allocation and would warn on every voucher it
is used on, at a screen with no way to say why. Gate **307/307**, seven
injections, parity diff **empty**. ⚠️ **A class is a stencil and the voucher does
not store which one was used**: the screen expands it into the rows the wire
already carries, the operator may edit them, and what is saved is the rows —
`invoiceBodyOf`'s ruling one phase across, and the reason nothing points at a
class and it is therefore always deletable. ⚠️⚠️ **The rounding IS the
function.** A third of ₹1,000 three ways loses a paisa, and a paisa here is a
coverage warning on every voucher the class is ever used on; the obvious
alternative — round, then correct the largest — takes a share **negative** on ten
lines over five paisa, which the payload rule then refuses, i.e. a class that
makes its own voucher unsavable. It is the largest-remainder method in integer
paisa. ⚠️ Two things the gate found rather than confirmed: **a refusal is not a
rollback inside a caller's transaction** (the header row was written before the
split was judged, so the next five refusals were all answered *"already
exists"*), and **a paisa of slack cannot see a paisa of error** — (3) used the
`near` every other figure test here uses, and injection 1 passed by exactly one
paisa.

**And P7c‑2 is done: the dimension has a screen.**
`/transaction/masters/cost-centres` — the categories beside the selected
category's centre **tree**, and the percentage **classes** on a second tab — with
every rule the API refuses refused there too, in the API's own sentence. Gate
**6/6**, four injections, `check-mirrors` **check 13** comparing the wording of
six refusals across the repo boundary (117 rows over 32 region cases), and the
**backend is untouched**: not one file under `jayhind-client-back` changed, so the
parity diff is empty by construction rather than by measurement. ⚠️ **Because the
feature has no instance anywhere, construction is the FIRST property rather than
the last** — P3d‑2 added its round trip deliberately at the end, since four
refusal properties all pass on a screen whose Create button is broken; here
everything the refusals are asked about is built through the dialogs by the test
that measures it. ⚠️⚠️ Five of the six refusals are the **browser's**, with the
requests counted so a 400 caught and toasted cannot pass for a mirrored refusal,
and the sixth — has this centre been allocated to? — is passed **`null`**, *"not
known here"*: P3d‑2's `hasPostings` ruling, stated in the vector table as a rule
rather than left an accident of two signatures. What the gate measures instead is
the direction available to it — after the class refusal's own alternative is
carried out, the delete **goes**, which a browser guessing at that count would
have pre-empted. ⚠️ The class editor refuses **while somebody types**, because a
split is incomplete for most of the time it is being edited and a refusal that
only arrived on Save would fire once for every keystroke nobody has typed yet.
⚠️⚠️ Injection 4 **passed the first time and the property was not the problem** —
the dev server had not rebuilt, so the browser was running the code the edit had
replaced. P5c‑1's own note a second time, with a different cause.

**And P7c‑3a is done: a figure can be split on the voucher that posts it.** The
Dr/Cr surface's head fields carry Tally's own allocation sub-screen, at Tally's
own moment, and a **cost centre class** expands into its rows to the paisa. Gate
**7/7**, five injections. ⚠️ **Which rows allocate is DERIVED, not written down**:
the trigger sits on the grid's `ledger` rows and `accountingRowPlan` gives a
`Ledger` ref to a **Journal alone**, because `postPaymentReceipt` reads
`trxGroupId` only for a Journal — so a Payment's head is a classification and not
a leg, and rows stored against it would be read by nothing, which is worse than a
missing panel. ⚠️⚠️ **The one backend change is a field on a picker option** —
`VoucherHeadOption.costCategoryIds` answers `applicableCategories` server-side, so
the screen mirrors nothing for it: `costItemKindOf` is a *derivation* from each
nature's own statement (D-54's shape) and its mirror could only have been a list.
No report reads it, so the parity diff is empty by construction. ⚠️ **The two
halves of §3.7 are drawn differently on purpose** — a malformed payload is
refused with Accept disabled, an *incomplete* one is a coverage hint per category
and saves, because a gate there would refuse both the ordinary case and the
default one. ⚠️⚠️ Two real product bugs came out of the gate rather than out of
review: **a dialog closing with the wrong result shape does not close at all**
(`UnsavedChangesService` replaces `ref.close` and swallows anything without
`status: true` — no error, no state change, an Accept button that looked live and
was inert), and **a hydrated head announced nothing**, so every reopened voucher
lost its panel — CLAUDE.md §14's placeholder-over-a-real-choice family one step
on, where the picker renders correctly and the component beside it silently has
nothing. ⚠️ And **injection 2 passed because the FIXTURE could not produce the
error**: ₹1,000 at 33.3333×2 + 33.3334 has every exact share below a half, so
`round` and `floor` agree; check 13 failed on three vectors while the browser gate
stayed green, and the two instruments disagreeing is what exposed it.

**And P7c‑3b is done, which completes P7c: the ITEM form allocates too.** The
voucher's own head and every `trx_charges` row — rendered either as the Accounting
Invoice's body or inside the Charges chip — carry the same sub-screen, re-hosted
rather than rewritten, with **no backend change at all**. Gate **11/11** on the
same file. ⚠️ Here the allocations are **form controls** rather than signals beside
the form, and that is the better shape: the payload needs no surgery, and a
removed charge takes its split with it **structurally** — the hand re-keying
`dropLineKey` exists for cannot arise, and only the map of head *options* still
needs it. ⚠️⚠️ **An item LINE allocates nothing and the gate asserts it**: a
`trx_items` row names a product, never a ledger. The head's figure is the **item
net**, so on an Accounting Invoice it is zero and the money is allocated on the
charge rows that hold it — which falls out of the figure rather than from a rule
anybody wrote. ⚠️ Two things the gate corrected about itself: **a body switch
DISCARDS**, so a split cannot follow a row across `Ctrl+H` (P4e's own ruling —
the Charges chip is host number three, not the same row seen twice), and **a
`mat-form-field`'s text includes its LABEL**, so a `toContain('Purchase')` check
passed against *"Purchase Head"* while the control still held the seeded default —
three runs spent blaming the panel for a helper that could pass without the thing
it checked having happened.

**And P7d‑1 is done: the dimension can be READ.** Tally's four cost reports —
**Cost Centre Summary** (one category's centre tree), **Category Summary**,
**Cost Centre Breakup** (a centre, cut by ledger) and **Ledger Breakup** (a
ledger, cut by centre) — plus the **reconciliation** report where §3.7's *"a
partial or missing allocation is a warning on a reconciliation report"* finally
acquires its report: `costAllocationProblems` had been written and unread for
four phases, and P7c‑3b's own record says so in as many words. Gate **169/169**
over 14 companies, seven injections, parity diff **empty** and nothing re-based.
⚠️ **Every one of them is scoped to a single category STRUCTURALLY** — the Cost
Centre Summary and the Cost Centre Breakup take it from the route rather than
from a filter somebody can omit, the Category Summary emits a row per category
and has **no field to add them up in** (injection 6 was refused by the
*compiler* before the gate could see it, and by (4) once the type was widened
too), and the Ledger Breakup emits a **section** per category, each summing to
the ledger's whole figure. ⚠️⚠️ **The Ledger Breakup's residue and the
reconciliation's sentence are one subtraction**, `unallocatedOf`, which is why
it lives in `cost-allocation.const.ts` beside the invariant and shares its
tolerance: a breakup screen printing *"₹2,000 unallocated"* beside a
reconciliation calling the line complete is BUG-0040's shape in a new dimension,
and a co-located spec asserts the equivalence over a sweep rather than on one
example. ⚠️ **The reconciliation's population is a UNION and the second half is
the one that matters** — a line whose ledger is switched **on**, *or* a line
that has an allocation: the first finds the commonest incompleteness there is
(a switched-on ledger with no allocation at all, which has no rows to be found
by), the second finds its mirror (allocations stranded on a ledger somebody
switched **off**, stored, summed by every report above and reconciling against
nothing). Injections 4 and 5 removed one half each and each failed its own
property. ⚠️⚠️ **Two things the gate found rather than confirmed**, and both
were the gate's premise: the Ledger Breakup's residue is over the **ledger's
whole period**, not over one voucher — ₹5.75 crore of unallocated history on
company 28's purchase head — so the tie is now stated as the *difference between
two parallel sections*, which is exact whatever the history holds; and the
report emits a section for **every applicable category**, so `sections.length
=== 2` was asserting a fixture rather than a rule on a company with thirteen.
⚠️ And injection 1 **passed and was not a defect**: dropping the Cost Centre
Summary's `categoryId` predicate changes nothing, because a centre belongs to
one category for life and `describeAllocationPayloadBlock` refuses a row that
names another — the filter is the index's, not the rule's.

**And P7d‑2 is done, which closes P7: a person can read the dimension.** The
five reports P7d‑1 shipped had **no caller** — BUG-0068's *"an endpoint nothing
calls is an endpoint nobody has run"*, with the gate as the only thing that had
ever run them — and P7d‑2 is the callers, plus the two `DrillTarget` members
that make them a journey: *Category Summary → Cost Centre Summary → a centre →
its ledgers → a ledger's own report → a voucher*, one click a screen, Esc back
out. Gate **8/8** in a browser, seven injections, parity diff **empty** and
nothing re-based, because no DTO, no service and no query changed. ⚠️ **Two
members, not the one the plan named**: the first hop is a *category* opening its
own tree and it resolved nowhere either, and spelling one of them as a
`routerLink` is the per-report URL `drill-target.ts` exists to prevent —
injection 7 measures it. ⚠️⚠️ **Four tabs for five reports**, and the asymmetry is
a rule: a tab is for a report whose subject is at most **one** picker away, and a
cost centre's is two (a category, then a centre in that category's tree) — the
Cost Centre Summary already *is* that picker, so its breakup is reached by
drilling and still has a URL somebody can paste. ⚠️ **The screen is where "no
grand total" becomes visible**: the API says it by having no field, and a reader
who has read neither file has no way to know they must not add the rows up — so
the Category Summary prints a caption where every other report prints a total,
and (1) asserts both halves at once, because *"there is no total"* is true of a
screen with no rows. ⚠️⚠️ **The gate posts real money and cancels it** — these
reports read `cost_allocations`, which exists only once a voucher has posted, so
P7c‑3a's draft-only trade was not available; measured afterwards at **0.00 across
every live allocation**, because an allocation is signed and a reversal negates
it. ⚠️ And reading the two red gates P7d‑1 handed over found
[BUG-0071](../qa-artifacts/docs/bugs/BUG-0071.md), which is **why** they were
red: `trx_cost_allocations.ownerId` carries no foreign key, so erasing a voucher
strands its allocations — unreadable (`sharesForOwners` is keyed by the id that
no longer resolves) *and* undeletable, holding a cost centre hostage through
`describeCentreDeleteBlock` with no draft behind it anybody could act on. 14
orphans across 12 categories, fixed at the two erase seams, repaired by a script,
and both gates' (0) made **census-relative** so they can no longer inherit
another suite's leak.

**P8 split into five, and P8a is done: the leg table is DATA.** `buildLegs` was
a `switch` over fourteen voucher kinds; it is thirty-eight dated rows and an
interpreter now, and **13,461 posted journal entries reproduce exactly** — 5,040
comparisons against the deleted switch transcribed into the gate, then tied to
money nobody in this phase wrote, because a restated switch that shares the rule
table's mistake agrees with it. Two of the plan's own claims moved on
measurement: `voucher_types` already exists as **`transaction_configurations`**
(196 rows, 14 companies × 14 types), and **`statutory_heads` retires before it is
built** — `acc_ledgers.systemKey` already holds exactly one row per key per
company, and what varies by date is the leg set, not the head. ⚠️ §3.4's sketch
had **no condition column**, and reverse charge needs one: the flag adds a leg
*and* changes the party leg's amount, and the sketch's own `'net+charges'` is the
tell that it had met the problem and hard-coded one instance of it. ⚠️⚠️ The gate
failed first run on **15 vouchers**, and they were not a defect — BUG-0069's
population, posted before D-52 shipped. **Dating the RCM rows to our deploy day
makes the gate greener and is wrong**: a rule's `effectiveFrom` is the date the
*law* changed, and §9(3) has applied since 2017, so it would make a back-dated
RCM purchase post the very shape D-52 was filed to fix — inside the rule table,
where it would read as deliberate. They are a declared exception **held to a
shape**, and injection 7 measures the wrong answer being refused four ways.

**And P8b is done: budgets exist, and a person can read one against the
actuals.** `budgets` + `budget_lines`, the pure rules, the masters API, the
**Budget variance report**, and both screens. §3.9's promise is a **negative**
one — *"no engine change at all"* — so the gate leads with it: the three
statements captured with a budget present and without it, **44 figures, nothing
moved**, with `rows.length > 0` beside `0 changed` so it is a claim about the
budget rather than about nothing. ⚠️ It is a **report and not a column on the
statements**, and §3.9 says *"column"*: a budget's lines are **sparse** (fifty
heads out of 1,383 ledgers) and one of its three target kinds — a cost centre —
appears on no statement at all, so a column could carry two of them and would
silently drop the third. ⚠️⚠️ **The verdict refuses to guess**: favourable/adverse
is derivable for Expense and Income and genuinely *not* for Asset and Liability —
a cash target wants to be exceeded and a debtors target does not, and both are
Assets — so it answers `null` there and the screen prints a plain signed figure.
⚠️ And this phase shipped **a mirror with no reader** for an hour: the browser copy
of that verdict was consulted by nothing, and the UI gate proved it by injecting a
wrong verdict into it and **passing 6/6**. Deleted, with the reasoning in check
14's own note. ⚠️⚠️ Three of the gate's own assertions could not fail when first
written — the verdict property budgeted four balance-sheet groups so its rendering
half never ran, the window property asserted the budget's own period rather than
the clipped one, and a fixture named *"Compare"* made four buttons match one
selector. All three are P3d‑1's *"the fixture, not the assertion, was what could
not fail"*. And the file's first version cost **another file's passing test** by
spending a request budget §11 already records as gone.

**And P8c is done: interest exists, and it claims rather than charges.** A pure
calculator, per-ledger parameters, the **Interest Report**, and both screens.
§3.9's central clause is a **prohibition** — *"posting it is an explicit Debit
Note the user accepts, never automatic"* — so the gate leads with it: the three
statements captured either side of a full set of parameters, and the entry and
line counts, **while ₹1,47,740.48 of interest was claimed**. ⚠️ The day count is
a **convention**, and choosing wrong is invisible: ₹1,00,000 at 18 % for a
quarter is ₹4,438.36 on actual/365 and ₹4,500.00 on 30/360, so the gate asserts
the two give **different** figures on the same bills. ⚠️⚠️ §3.9's *"and over the
running balance otherwise"* is deliberately **not** implemented — since P5b every
party line carries a bill reference, so *"otherwise"* is an empty case and a
second path would be a derivation with no population. ⚠️ Two of the gate's own
properties **could not fail**: one compared its own restatement against its own
literals and never touched `daysBetween`, and the 30/360 cap test used two 31sts,
where the cap cancels. Three arms have no instance in the data — all 2,848
settlements are same-day, no due date exists anywhere, and no live bill reference
sits on a dead entry — and all three are constructed. ⚠️⚠️ Only the **refusal** is
mirrored to the browser, never the calculator: P8b‑2's reader-less mirror is why,
and check 15 carries the argument.

**And P8d and P8e are done, which closes the programme's last phase.**
Multi-currency is `currencies` + `exchange_rates` + three **nullable, unbackfilled**
annotation columns on `journal_lines`, and scenarios are a `scenarioId` on
`journal_entries` that `liveEntrySql` excludes **by default for all 57 of its
callers**. Both phases make §3.9's *"every existing report is unaffected by
construction"* a property of the **schema**: nothing was backfilled, so the census
— 45,460 lines with 0 annotated, 15,474 entries with 0 in a scenario, `Σ Dr` and
`Σ Cr` unchanged at ₹6,21,920,688,281.08 — *is* the proof, and each gate's first
property is that census. ⚠️ §3.9's own mechanism for scenarios (*a flag on
`voucher_types`*) does not fit: Tally's voucher types are user-definable and this
app's are a fixed enum of fourteen, so the flag would mean *"every sale is
provisional"* — it is on the **document**, which is what Tally's `Ctrl+L` marks
anyway. ⚠️⚠️ **P8d's injection 6 passed and the code was wrong**: the
base-currency rule was on `update` alone, so creating a *new* currency as base was
an unguarded second door — §13's standing shape, found by an injection rather than
by review. ⚠️ And five of the four gates' properties could not fail as first
written — a fixture out of the report window that made a lenient `!row ||` check
pass vacuously, a `ledgerTrialBalance` with no transaction parameter comparing two
identical results, and a soft-deleted row that a `COUNT(*)` census still counted.

**And P8d‑2 is done: the currencies have a screen, and so does the revaluation.**
P8d's API had no caller at all — BUG-0068's *"an endpoint nothing calls is an
endpoint nobody has run"* — and the first thing a caller found was
[BUG-0072](../qa-artifacts/docs/bugs/BUG-0072.md): both deletes soft-deleted into
a **unique index**, so deleting a currency made its code permanently uncreatable
and withdrawing a wrong quote made that day permanently unquotable, with no
restore route, no archived view and a message reciting the name of a database
index. Both are hard deletes now, which is what the refusal above them had
already decided — a currency any posted line names is refused outright, so the
delete is only ever reached when there is nothing to preserve. ⚠️ **Two of the
four refusals are the SERVER's** and the gate measures the split rather than
glossing it: the dialog states the consequence, **Save stays live**, the request
goes, and the sentence comes back over the wire, with the requests counted.
⚠️⚠️ **The revaluation report can only ever be empty, and the screen says which
ingredient is missing rather than leaving a blank table to read as a defect** —
nothing writes `journal_lines.currencyId`, because P8d added the annotation
columns and no voucher states a currency (0 annotated of 45,460, measured). That
is a feature not built, named here rather than implied. ⚠️ And injection 1
**passed twice** before the rebuild-waiter was found to be the defect: it looped
on `SECONDS`, which is a float in zsh, so every wait reported *"no rebuild"*
instantly while the injection went untested — P7c‑2's own note, this time in the
instrument. Gate **3/3**, six injections, `check-mirrors` **check 16** (112
comparisons) shown to fail three ways, and the screen census's five missing
entries — P8b‑2's two and P8c‑2's two, as well as this phase's — closed in the
same commit.

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
| P4a | `app-ledger-picker`, `Alt+C`, and `groupFor` stops deciding (F4) | M | **done** — [§P4a record](#p4a-record--2026-08-29) |
| P4b | The unified entry screen + the accounting (Dr/Cr) mode; the third mode named (F6) | M | **done** — [§P4b record](#p4b-record--2026-08-29) |
| P4c | Item mode — `trx-add-edit` re-hosted onto the surface | L | **done** — [§P4c record](#p4c-record--2026-08-30) |
| P4d | Workflow Document mode, and the remaining route redirects | M | **done** — [§P4d record](#p4d-record--2026-08-30) |
| P4e‑1 | What an Accounting Invoice IS — the mechanism, and GST-021 | M | **done** — [§P4e‑1 record](#p4e-1-record--2026-08-30) |
| P4e‑2 | `Ctrl+H` — the mode on screen, and the six print templates | M | **done** — [§P4e‑2 record](#p4e-2-record--2026-08-30) |
| P5a | `bill_references` + the full-history backfill (the gate lands here) | M | **done** — [§P5a record](#p5a-record--2026-08-30) |
| P5b | The posting engine writes refs; Advance / On Account | M | **done** — [§P5b record](#p5b-record--2026-08-30) |
| P5c‑1 | A voucher may name no bill; `unappliedRefType`; the open-bills read | M | **done** — [§P5c‑1 record](#p5c-1-record--2026-08-30) |
| P5c‑2 | The entry screen's reference grid | M | **done** — [§P5c‑2 record](#p5c-2-record--2026-08-30) |
| P5c‑3 | A voucher may name a document-less bill (`billRefId` on the allocation) | M | **done** — [§P5c‑3 record](#p5c-3-record--2026-08-31) |
| P5d | Bills Receivable/Payable; the annexure moves onto refs | M | **done** — [§P5d record](#p5d-record--2026-08-31) |
| P6 | Trading Account and Gross Profit | M | **done** — [§P6 record](#p6-record--2026-08-31) |
| P7a | The cost dimension's masters (`cost_categories`, `cost_centres`) and its invariant | M | **done** — [§P7a record](#p7a-record--2026-08-31) |
| P7b | `cost_allocations`, written from `persistLines` | M | **done** — [§P7b record](#p7b-record--2026-09-01) |
| P7c‑1 | Cost centre classes — the tables, the expansion rule, the masters API | M | **done** — [§P7c‑1 record](#p7c-1-record--2026-09-01) |
| P7c‑2 | The masters screen — categories · the centre tree · classes | M | **done** — [§P7c‑2 record](#p7c-2-record--2026-09-01) |
| P7c‑3a | The Dr/Cr surface's allocation panel, the mirrored expansion, the wire | M | **done** — [§P7c‑3a record](#p7c-3a-record--2026-09-01) |
| P7c‑3b | The item form's allocation panel — the voucher head and each charge row | S | **done** — [§P7c‑3b record](#p7c-3b-record--2026-09-01) |
| P7d‑1 | The four cost reports' API, and the reconciliation §3.7 promised | M | **done** — [§P7d‑1 record](#p7d-1-record--2026-09-01) |
| P7d‑2 | The cost reports' screens, and the drill spine's fourth target | M | **done** — [§P7d‑2 record](#p7d-2-record--2026-08-31) |
| P8a | §3.4 — the leg table becomes a dated rule table | M | **done** — [§P8a record](#p8a-record--2026-08-31) |
| P8b‑1 | Budgets — the tables, the rules, the API, the variance report | M | **done** — [§P8b‑1 record](#p8b-1-record--2026-09-01) |
| P8b‑2 | The budget screen, and the variance report's screen | M | **done** — [§P8b‑2 record](#p8b-2-record--2026-09-01) |
| P8c | Interest — the rule, the parameters, the report | M | **done** — [§P8c record](#p8c-record--2026-09-01) |
| P8c‑2 | The interest screens | S | **done** — [§P8c‑2 record](#p8c-2-record--2026-09-01) |
| P8d | Multi-currency — the tables, the annotation, the revaluation report | M | **done** — [§P8d record](#p8d-record--2026-09-01) |
| P8d‑2 | The currency screens | S | **done** — [§P8d‑2 record](#p8d-2-record--2026-09-01) |
| P8e | Scenarios — the table, the flag, the report filter | S | **done** — [§P8e record](#p8e-record--2026-09-01) |
| P8e‑2 | The scenario picker and masters screen | S | not started |

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

#### 🐞 The cash/bank picker could not render a saved voucher's own account, and never could

`PaginatedSelectSource.ensure()` is how every voucher screen pins the account a
saved voucher already names — *"pin it, or that picker opens blank on an edit"*,
in all three of the components this phase deleted. It fetches by id, and that
fetch has been answering **400** the whole time:

```
POST /trx-accounts/list  {"filters":{"id":[{"type":"numeric","value":46,…}]}}
→ 400 Invalid Type numeric for Database Field id Type BIGINT
```

The shared paginator's `checkDataTypeAndFilterType` whitelisted `INTEGER` and
the float family and **not `BIGINT`** — and `TrxAccount.id` is declared
`DataType.BIGINT` on the model (the column itself is `int`; model and schema
disagree, which is its own thing to fix). So the account rendered only when it
happened to be in the picker's first page, and a QA tenant has three accounts,
which is why nobody saw it. On a migrated book with hundreds it is P4a's
data-loss shape exactly: a blank field reads as *"nothing chosen"*, the operator
picks something, and the save writes it over a value that was there all along.

`BIGINT`, `MEDIUMINT`, `SMALLINT` and `TINYINT` are in the list now, in **both
backends** — they carried the identical omission, §13's standing shape — with a
per-width spec and `BOOLEAN` as the control, still refused. Four genuine `BIGINT`
columns could not be filtered on either (`stored_files.size`,
`chat_messages.fileSize`, `export_jobs.totalBytes`, `companies.maxStorageBytes`),
nor could `trx.placeOfSupplyStateCode`, a `TINYINT` GST state code.

⚠️ **It was found by a probe watching RESPONSES, not by an assertion.** The
screen looked right, because the value it could not fetch was on the page
anyway. Property (8) now asserts both halves — the rendered account *and* that
nothing the screen asked for was refused — and fails when `BIGINT` is taken back
out.

#### ⚠️ Two of the eight properties trip the ERP's own rate limiter

Measured: the file is green run after run on its own, and inside a full
`qa:money` — 85 tests, serial, 7½ minutes — properties (1) and (3) fail with
**sixteen `429 Too Many Requests`** in the fixture's console channel. The ERP
throttles 100 requests per minute per IP and the whole suite shares one bucket;
these two are simply the request-heaviest (eight page loads, and a post plus an
approve).

`problems.ignore` takes **`/status of 429/` and nothing else**. Narrow on
purpose: every other status still fails the test, and a rate limit that actually
broke a screen still fails it through the assertions — where it shows up as an
empty picker, not as a log line. The full suite was **83 passed / 2 failed** with
those two 429s as the only failures; with the ignore in place and the `BIGINT`
defect below fixed, `qa:money` + `qa:shell` is **107 / 107**, and
`qa:coa-parity -- selfcheck` reports **PARITY HELD**.

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

### P4a record — 2026-08-29

**`app-ledger-picker` exists, and the voucher head is a LEDGER.** One component
replaces the six `trx_groups` pickers the entry screens carried — the
sales/purchase document's head, an invoice's charge heads, the simple journal's
Dr head, a general journal's rows, the Payment/Receipt head, and the invoice-scan
review's own copy of the first. It lists the Tally chart (a ledger's name, under
its group) and what it offers is decided by the group's **nature** rather than by
`trx_groups.groupFor`, which is **F4**.

Measured on the fourteen development companies, per company:

| Field | `groupFor` offered | the picker offers |
|---|---|---|
| Sales voucher head | **1** | 5 (Income) |
| Purchase voucher head | **1** | 13 (Expense) |
| Credit note head | **1** | 5 |
| Debit note head | **1** | 13 |
| Charge head | 5 | 18 (Income + Expense) |
| Simple journal's Dr head | **1** | 13 |
| Payment / Receipt head | 2 | 39 (all four natures) |

Every one of those is a strict **widening**: measured before it was written, no
head's ledger sits under a nature its own `groupFor` contradicts, in any company.

⚠️ **One thing stops being offered, and it is not a nature.** The two **control
heads** are the only `trx_groups` rows in any company with no ledger behind them
— D3 gave each one ledger per party and none of its own — so a ledger-fed picker
cannot list them. The group-fed pickers offered both, on every voucher screen.
That is the gap D6 named when it wrote `controlHeadNotPostable`: *"nothing in the
installation ever posted to one without a party … but the voucher head pickers
offer every group, so D6 is the step that makes it reachable by a person"*. P4a
is the step that makes it unreachable.

#### ⚠️⚠️ It binds a `trx_groups` id, and that is the whole bridge

`journal_lines.trxGroupId` is `NOT NULL` behind a real foreign key until **D9**,
and every voucher DTO states a *head* id. `ledgerId` is deliberately on **no**
DTO and must not be put on one (D6): it is derived from the head in the one
writer of each table, and declaring it would hand a caller a cross-company ledger
id to aim at — §4.3 rule 7, whose own three columns are exactly these.

So the picker shows the ledger and submits its `legacyTrxGroupId`. Nothing in the
posting engine, the DTOs, the services or the reports changed, and **the parity
diff is empty**. The round trip is exact rather than approximate: D5's third
precedence rule resolves a line on head `G` to the ledger carrying
`legacyTrxGroupId = G`, which is the row that was offered. Measured before it was
built — **0** heads carry two ledgers, and all **815** ledgers with no head are
parties.

`voucher-head-option.const.ts` is where that decision and its expiry live, and
the option's field is named `id` on purpose: `app-select` and
`PaginatedSelectSource` both key an option by `id`, and a picker whose option id
is not the value it binds is where a hydration silently stops matching. At D9 the
projection becomes `id: ledger.id` and every consumer moves in one commit.

#### `groupFor` survives as a DEFAULT, and finding that out was the point of the gate

F4 is about the enum deciding **pickability**. It says nothing about the enum
being a bad *suggestion* — and every company has exactly one head per document
context (F16 measured all fourteen), which is precisely why the old pickers
arrived pre-filled: `groupFor` left them holding a single row and
`autoSelectSingle` took it. Widening the list to five would have silently removed
that, one extra keystroke per voucher on the busiest screen in the product, with
nothing saying it had changed.

So the enum is read once more, by `defaultGroupForContext`, as a suggestion —
and **only when the match is unique**. A company with two sales heads gets no
suggestion rather than the lower id.

⚠️ **`isSystem: false` on that lookup is load-bearing, and the gate found it, not
the reasoning.** `AccLedgerService.createBackingHead` files **every** twin it
writes under `groupFor: 'journal'` — it needs some value and none of them mean
anything for a head nobody picks by category. So one ledger created through the
Chart of Accounts screen made the simple journal's match ambiguous and the
uniqueness rule answered `null`: the default disappearing from a screen because
somebody added an unrelated ledger. Every seeded document head is `isSystem = 0`
and every backing head is `1`; a system head is machinery, not a suggestion.

#### 🐞 A saved head with no ledger would have rendered a BLANK field

Two live rows on the development database name a head that has no ledger — both
`trx_payment_receipts` headers on a **control head**, and the same two the D6
note records as why that table's `ledgerId` is nullable while the column beside
it is not. Under a ledger-fed picker they would have rendered as *"nothing
chosen"*, the operator would have picked something, and the save would have
written it over a value that was there all along.

`legacyHeadOption` is the answer: a **hydration** renders the head itself when
nothing stands behind it. It is reachable only for an id the caller already had,
so it cannot put a head back into circulation that `controlHeadNotPostable`
refuses. The general rule, which is the one to carry: **an offer-time rule
applied to a hydration is a data-loss bug.** The feed's `trxGroupIds` path is
scoped by none of the four filters the search path uses.

#### 🐞 `app-select` swallowed every keyboard chord, and had since it was written

`onSearchKeydown` ended with a bare `event.stopPropagation()` — *"stop all other
keys from reaching mat-select's type-to-navigate handler"*. That handler only
ever cares about printable characters with no modifier, so swallowing
`Alt`/`Ctrl`/`Meta` combinations was collateral, and it cost two real behaviours:
the voucher screens' **`Ctrl+S`** (accept, which a Tally operator presses from
anywhere) did nothing while a picker's search box had focus, and `Alt+C` did
nothing at exactly the moment it is most wanted — the list is open and the ledger
is not in it. Both are document-level listeners, and that line is what they never
reached.

⚠️ `Alt+C` therefore takes **two** listeners, and the reason generalises: the
dropdown's panel is a `.cdk-overlay-pane` on `<body>`, a different DOM tree, so a
host listener cannot see a key pressed in it. Same trap as the voucher options
bar's click-away rule (§9), same answer — ask about the overlay, not about the
host. Measured: the host listener alone opened **zero** dialogs.

#### The gate, and the four injections

`qa-artifacts/tests/ui/money/ledger-picker.ui.spec.ts` + `ledger-picker-rules.ts`
(restated, never imported). Six properties, in a browser, because **P4a moves no
figure**: it changes what a screen offers and what it starts on, so the parity
diff is empty by construction and says nothing about any of it — P3d's argument
exactly.

1. every head field is the one picker, on all seven voucher screens, **and no
   group-fed head select survives** (the half a partial migration would pass);
2. it offers what the nature allows, with the widening compared against a live
   `groupFor` count rather than a number written down;
3. a control head is offered in no context, and no party ledger is either;
4. the default survived the widening, field by field;
5. a saved voucher renders its own head, including one outside the field's scope;
6. `Alt+C` from **inside the open dropdown** creates a ledger, selects it, and
   the created ledger carries the head the form binds.

Shown to fail, four ways: every context widened to all natures (2 fails), the
chord swallowed again (6 fails), `[preselectDefault]` dropped at a call site
(4 fails), the search path allowed to emit legacy heads (3 fails).

⚠️ **A fifth injection PASSED, and the property was the problem** — P3d‑1's
lesson, second time. Scoping the hydration by nature left (5) green, because
`legacyHeadOption` quietly answered instead: the value still rendered, under the
head's name, with no ledger behind it. The assertion now demands the row come
back with its `ledgerId` and the chart's own name. **A fallback that covers a bug
is how a rule stops being measurable.**

⚠️⚠️ The **invoice-scan review** screen is the seventh site and is deliberately
not in the gate: it needs a `scanned_invoices` row and the QA world builds none.
Verified by hand against a real row — thirteen expense ledgers, arriving on
*Purchase* — and recorded in `ledger-picker-rules.ts` as measured-not-gated
rather than left to read as coverage.

#### One pre-existing failure, proved not to be this phase

`qa:transactions` has **one** red test — `lifecycle-matrix.spec.ts`'s
`matrix · purchase`, a `500` from `POST /trx/:id/approve` on the voucher it
creates. It reproduces serially, and it reproduces with **P4a stashed**, so it is
not this phase's; approving an existing draft purchase through the same route
answers `200`. Recorded here rather than absorbed: 193 pass beside it.

#### What P4b inherits

§3.3's frontend is **finished**. What is left of P4 is §3.5 — the unified entry
surface — and the first thing it owes is the decision the plan asks for before
any of it: **name the third mode.** Six of `trx-add-edit`'s ten document types
post no GL at all, and a grid whose invariant is *"Dr must equal Cr"* has nothing
to say about them (F6).

Three things this phase deliberately did **not** do:

- **No party ledger in the picker.** A party has no legacy head to bind and is
  not what these fields name — the party is its own column on the voucher. A
  party ledger becomes pickable as a **row** in the Dr/Cr grid, which is P4c's.
- **`groupFor` is not deleted.** It stopped deciding pickability and it still
  seeds every field's default, and `TrxGroupService` still writes it. It goes
  with `trx_groups` at D9.
- **The `charge` context reaches both natures and nothing narrows it per
  document.** Freight paid on a purchase and freight recovered on a sale share
  one picker; splitting it by the parent voucher's direction is a rule nobody has
  asked for, and inventing one would be a narrowing on the phase that exists to
  widen.

---

### P4b record — 2026-08-29

**Contra, Payment, Receipt and Journal are one screen.**
`/transaction/voucher/<type>/new` is `VoucherEntryComponent`, and the three
entry components it replaces — `trx-contra-add-edit`,
`trx-payment-receipt-add-edit`, `trx-journal-add-edit`, 1,149 lines of
TypeScript and 645 of template — are **deleted**, not wrapped. Their routes
redirect, `VoucherFormDialogService`'s three methods became one, and the same
component serves the routed page and the dialog every voucher list opens.

**And §3.5's missing decision is taken: the third mode is the Workflow
Document** (F6, decided with the phase). Two halves, both load-bearing:

- **Its invariant is the conversion chain, not the balance.** The six upstream
  documents post no legs and move no stock; what makes one correct is that it
  converts forward into the financial document it promises
  (`DOCUMENT_FLOW_NEXT`), and its quantities are answerable there.
- **It is not a `Ctrl+H` destination.** A non-financial type is always in it and
  cannot leave; a financial one can never enter it. That is what keeps the
  accounting grid's *"Dr must equal Cr"* an invariant — retrofitting a
  no-posting case into it is exactly how §3.5 said that rule would get weakened.

#### ⚠️ The grid is DERIVED from the posting engine, and that contradicted the screen it replaces

`accountingRowPlan(kind)` calls `buildLegs(kind, { amount: 1 })` and maps each
leg role to a row — so the rows a voucher screen draws **are** the legs it will
post, and the two cannot come to different answers about what a Payment is. A
leg role with no row kind mapped throws at the first render rather than a
voucher quietly losing a leg from its own screen.

Writing it that way immediately disagreed with the Payment screen, and the
screen was wrong:

| | old screen's Dr row | what `buildLegs` posts |
|---|---|---|
| Payment | the **head** (`trxGroupId`), amount beside it | `Dr party`, `Cr cash` |
| Receipt | the **head**, on the Cr side | `Dr cash`, `Cr party` |

`postPaymentReceipt` reads `trxGroupId` **only for a Journal**. Measured on the
development database: of **974 posted payments and 1,888 posted receipts**, the
head appears in a journal line of its own voucher **0 times** — against **204 of
204** for journals, which is the control that makes the query mean something. So
for six years the entry screen has stated a double entry the books do not
contain, while the ledger that *is* debited — the party — sat in a side panel,
outside the grid, with no Dr or Cr against it.

The head is not deleted: it is a **classification**, read by the payment/receipt
register's `groupName`, and it keeps a field of its own beside the party under
that name. What it no longer is, is a row of the grid with an amount on it.

**`check-mirrors.js` check 11** is what stops the derivation and the screen
drifting: it loads both modules, compares `ENTRY_MODE_BY_TYPE` as data over all
fourteen types, and **runs** `accountingRowPlan` on both sides for each. Both
failure modes were reproduced — a mode moved on one side, and a row plan
restated wrongly. ⚠️ It is also the only thing tying the screen to the engine
across the repo boundary: change a cash voucher's legs and it fails here, naming
the voucher.

#### The keys are one table, read by two components

`VOUCHER_SHORTCUTS` (§2.2's map) is read by the entry screen **and** by
`TransactionLayoutComponent`, whose bare F4–F9 have navigated to voucher lists
since Phase N. One table, so the module-level jump and the in-place switch
cannot disagree about which key is which voucher.

⚠️ **F4 changes meaning inside a voucher, and that is the point.** All three
screens this replaces bound bare F4 to *"focus the first picker"* — ours, not
Tally's, and the opposite of what F4 did one level up in the same module. §3.5's
map wins: F4 is Contra everywhere now.

⚠️⚠️ **Switching type is a NAVIGATION, including between two types this screen
hosts.** Each accounting type is its own route config — so it can carry its own
permission key — which means the router rebuilds the component across the switch
whatever the component does first; the first cut mutated the form in place and
then navigated anyway, doing the work twice and discarding it. Two things fall
out and both are better than the bespoke version: `pendingChangesGuard` is what
asks about a dirty voucher, rather than a `window.confirm` written into the
screen, and a switch genuinely clears the form, which is right — a contra's
fields are not a journal's. A type this screen does not host yet lands on its
existing route: a seam for P4c/P4d, not a shim.

#### F12 gave the configuration editor a second host, rather than a second editor

`TransactionConfigEditComponent` now takes `MAT_DIALOG_DATA`/`MatDialogRef`
`{ optional: true }` and consults the route only when there is no dialog — the
shape every voucher form in this product already uses. §3.5 asks for F12 to be
*"a modal rather than a route"*; building a second editor for the modal would
have been a second definition of one screen, which is the thing this phase
deletes three of one folder over.

#### The gate, and five injections

`qa-artifacts/tests/ui/money/voucher-entry.ui.spec.ts` +
`voucher-entry-rules.ts` (restated, never imported). **Nine properties, in a
browser**, because P4b moves **no figure**: every one of the four still posts
through the API it always did, no DTO changed, and the backend diff is two new
files — a pure const and its spec — so the parity diff is empty by construction
and says nothing about any of it.

1. one screen serves all four, and the **old entry paths land on it**;
2. the rows on screen are the voucher's legs, role for role, read from
   `data-role` in the DOM;
3. a voucher posted **through the screen** posts the legs the screen drew —
   approved, and its `journal_lines` compared back;
3b. and so does a **Payment**, which the contra cannot stand in for: it carries a
   party, an allocation and an over-payment cap, and its debit row is the
   *derived* one — so this is the only place the grid's party row is checked
   against the leg it claims to be;
4. a keyboard-only operator switches type and accepts, `Ctrl+A` from inside an
   open dropdown;
5. an unbalanced split journal is refused **in the voucher's own words** with
   **no request leaving the page** (counted, because a 400 caught and toasted
   looks identical on screen);
6. a Payment's head is on no grid row, and is a leg of none of the company's
   posted payments;
7. every type has a mode, and only the four are on this screen;
8. a saved voucher **renders the accounts it names**, and nothing it asked for
   was refused — the property that found the defect below.

Shown to fail: the payment's Dr row put back to the head (2 fail), the legacy
redirects removed (1 fails), the unbalanced journal allowed to leave the page (1
fails), P4a's chord swallow re-added to `app-select` (1 fails), and `BIGINT`
taken back out of the numeric whitelist (1 fails).

⚠️ **A fifth injection PASSED, and the property was the problem** — P3d‑1's
lesson and P4a's, a third time. Swapping the contra's two grid cells so the Dr
row wrote `fromAccountId` left property (3) green, because it read the saved
voucher's own `toAccountId`/`fromAccountId` and compared them with the legs —
and the posting engine *derives* the debit from `toAccountId`. The assertion was
tying the engine to itself and said nothing about which row the operator typed
into. It now captures the **account names chosen on screen** and requires the Dr
row's name to be the debited leg's account; the same injection then fails,
naming both accounts.

⚠️⚠️ **One rule is not observable through this screen, and the spec says so.**
Whether the accept chord is bound at `document` or at the host cannot be told
apart here: measured, the select's overlay pane renders **inside**
`app-voucher-entry`'s own subtree, so a host-scoped listener answers it too and
downgrading it passes every property. The binding stays `document:` because that
is what `app-ledger-picker`'s own `Alt+C` needs one level down, where the panel
*is* outside the picker's host. Recorded in the spec rather than left to read as
coverage — §9's voucher-options-bar case, in a new place.

#### Three things established on the way

- **The amount is ONE control, rendered on the side the row is on.** A two-leg
  voucher has one figure, not two that must be kept equal, and a second input
  the operator can disagree with is a way to produce an unbalanced voucher out
  of a shape that cannot be unbalanced. Only a **split** journal has per-row
  amounts, and its rule is `validateJournalLines` — already mirrored, already
  enforced server-side, and deliberately not restated a third time.
- **The type is route DATA, not a `:type` parameter**, and that was a real
  defect for an hour: each accounting type has its own path so it can carry its
  own permission key (`trx-contra` for a contra, `trx-payment-receipts` for the
  other three, both read out of `APP_NAVIGATION` by `permissionKeyForUrl` rather
  than restated), which makes the segment a literal — and `paramMap` answered
  `null`, so **every type rendered a Payment's rows**. Caught by the first
  browser run, which is what a screen-shaped gate is for.
- **A cleanup that cannot fail changes the books it is measuring.** The suite's
  `afterAll` cancels what it approved — *a voucher that ever posted is never
  erased* — and the first cut sent `statusRemarks` where `VoucherTransitionDto`
  declares **`reason`**, so `forbidNonWhitelisted` answered 400, the
  `.catch(() => undefined)` swallowed it, and eleven approved `QA·P4b` contras
  sat in a QA tenant's ledger with nothing saying so. It reports what it could
  not undo now, by name — which then had to be taught three more facts about
  this API before it was quiet: a **cancelled** voucher is the end state and not
  a step towards one (rule 2 again), a delete's success envelope carries no
  `data` key, and the *erase* call answers 404 on the row it has just archived.
  Every one of those was a real refusal reported honestly rather than a bug.
- **`.vch-shell` declares `container-type: inline-size`.** Every voucher screen
  renders both routed and inside `vch-dialog`, so its width comes from a dialog
  or from the content column and never from the window — §9's rule. The type bar
  hides below **720px of the shell's own width**; it had no container to query
  against until this phase gave it one, and a container query with no container
  never fires.

#### What P4c inherits

Item mode: `trx-add-edit`'s 2,250 lines re-hosted into the same shell as
`Ctrl+H`'s other half, for Purchase, Sales and both notes. The header strip, the
options bar, `revealInvalidPanel`, `applyCatalogueSnapshots`, the e-invoice and
e-way bill paths, HSN/UQC and price capture are **untouched** — re-hosted, never
rewritten, which is the whole of §3.5's risk note.

Three things this phase deliberately did **not** do:

- **No party ledger as a free Dr/Cr row.** The party row is derived from the
  voucher's own party field, which is where §3.6 hangs bill-wise details — so
  making it a picked row is P5's question, not a widening to do first.
- **The payment's classification head was not removed.** It posts nothing, and
  it is read: the payment/receipt register prints it as `groupName`. Deleting a
  field an operator has been filling in for years because it turns out not to be
  a leg is a product decision, and this phase's job was to stop *drawing it as
  one*.
- **`Ctrl+H` does not exist yet.** There is one mode on this screen and nothing
  to toggle to until P4c; a toggle with one destination is a button that lies.


### P4c record — 2026-08-30

**Purchase, Sales, Debit Note and Credit Note are typed on the same surface as
the four cash vouchers.** `/transaction/voucher/<type>` now hosts **eight** types
across two components — `VoucherEntryComponent` for the Dr/Cr grid (P4b) and
`TrxAddEditComponent` for the item grid — and the second was **re-hosted, never
rewritten**: its 2,250 lines are untouched but for the keyboard. The header
strip, the options bar, `revealInvalidPanel`, the pricing engine, the e-invoice
and e-way bill paths, HSN/UQC and price capture all arrived as they were, which
is the whole of §3.5's risk note.

No DTO changed, no service changed, the backend diff is **empty**, and the
parity diff is empty by construction.

#### One surface means one type bar, so the bar became a component

`app-voucher-type-bar` (`components/shared/voucher-type-bar/`) is rendered by
both halves. Copying the `@for` into the second screen would have been the mirror
problem *inside one repo*, on a bar whose entire purpose is that every voucher is
one key away from every other — and the two copies would have had to agree about
eight buttons, their order and their labels.

It is deliberately **presentational**: it emits the type asked for and knows
nothing about routing. Where a type is typed is `entrySurfaceFor()`'s answer —
one function, read by the bar's two hosts, both route files, the drill spine and
the scan review, so nothing can come to a different answer about where F9 goes.
The six Workflow Document types are absent from it, which keeps P4d a **seam**
rather than a shim: a key naming one navigates to the route it already has.

#### ⚠️ F4 and F6 changed meaning here, exactly as P4b changed them three times

The item form bound bare **F4** to *focus the account head* and **F6** to *focus
the party* — ours, not Tally's, and the opposite of what the same two keys did in
`TransactionLayoutComponent` one level up in the same module. P4b made precisely
this correction on the three cash-voucher screens; leaving it uncorrected would
have meant F4 opening a Contra on a Payment and focusing a picker on a Purchase,
which is worse than either rule alone. §3.5's map wins on both. `Alt+N` / `Alt+D`
(add and remove a line) are the grid's own, collide with no voucher chord, and
stayed.

`Ctrl+A` and `F12` arrived with the re-host — the item form had neither, and F12
opens `TransactionConfigEditComponent` as a dialog, the same second host P4b gave
it rather than a second editor.

⚠️ **`Ctrl+A` costs more on this half than on the other, and it was taken
anyway.** On a two-row cash voucher there is nothing to select; on a twenty-line
item grid *select all* is a chord an operator's fingers already know, and it now
accepts the voucher instead. Three things decided it: §3.5 asks for it by name,
Tally's Ctrl+A **is** accept, and one surface answering the same chord two ways
depending on which half you are on is worse than either rule. The blast radius is
bounded — `onSubmit()` on an incomplete voucher shows its validation errors and
sends nothing — and `Ctrl+S` stays as the alias this screen has always had.

#### ⚠️⚠️ Building it found a blank new voucher being born dirty

`app-ledger-picker`'s `preselectDefault` (P4a) applies the seeded head through
`onSelection`, which propagates via `onChange` — the `ControlValueAccessor`'s
**view→model** path. Angular reads that as the operator having typed something,
so it marks the control `dirty` **and** `touched`: every brand-new Purchase,
Sales, Debit Note and Credit Note was dirty before anybody had typed a character.

It was invisible while nothing navigated away from a blank voucher without being
asked to. P4c makes a type switch a **navigation** — deliberately, so
`pendingChangesGuard` is what asks about a dirty voucher rather than a
`window.confirm` written into the screen — and the defect surfaced immediately as
*"Discard unsaved changes?"* between **every pair of the eight vouchers**, on an
empty form, on the busiest screen in the product.

The rule it breaks was already ruled in this codebase, for the party form's
country/state default: **a default is a starting point, not a change to somebody's
saved row**, applied into an empty field and *never marking the form dirty*. The
fix restores pristine and untouched on that control alone — `markAsPristine`
walks up and re-marks the parent only when every sibling is pristine too, so a
form dirtied by a real edit elsewhere stays dirty, which is what makes clearing
it after the fact safe rather than needing a silent write path.

⚠️ The general shape is worth keeping: **a programmatic write through a CVA is
indistinguishable from a keystroke**, and the only thing that separates them is
the component deciding which it was. P4b's `applyNewVoucherDefaults` already
called `markAsPristine()` for exactly this reason on the head it looks up by key;
what it did not do was fix the picker, so the four screens that had not yet met a
guard went on carrying it.

⚠️⚠️ **The first cut of the fix undid `touched` as well, and that broke `Alt+C`.**
`onSelection` marks the control touched too, so clearing both looked like the
symmetrical thing to do — and `markAsUntouched()` in that subscription **empties
the open dropdown's search box**, which is where `Alt+C` reads the new ledger's
name from. Tally's *"the term that found nothing becomes the name"* silently
became a ledger called `""`. Caught by `qa:money`, on P4a's own gate, in the
full run rather than in the new one: **the phase's own suite is not the whole
gate.** `markAsPristine` alone is what the defect was about — the guard reads
`dirty` and nothing here reads `touched` — so the fix is now the narrower
statement. **Fix the flag the bug is about, not the flag beside it.**

#### The drill spine stopped landing via a redirect

`drillRoute` spelled `/transaction/vouchers/<type>/:id/edit` for all eight
drillable types — which, since P4b, meant four of them arrived through a
redirect, and after P4c all eight would have. It asks `entrySurfaceFor` now.

Esc was never broken by it (`DrillService` sets `ours` before navigating and
reads `urlAfterRedirects`, so one `NavigationEnd` arrives and the stack survives)
— but `drill()`'s own *"am I already here?"* comparison is against the
pre-redirect URL, and a route stack storing a URL the router immediately replaces
is a fact waiting to be relied on. `VOUCHER_EDIT_SEGMENTS` stays a hand-written
list and keeps its argument: *"does a posting naming this document open a screen
at all?"* is a different question from *"where is this type typed?"*, and only the
second moves as each mode is re-hosted.

#### The gate, and three injections

`qa-artifacts/tests/ui/money/voucher-rehost.ui.spec.ts` +
`voucher-rehost-rules.ts` (restated, never imported). **Six properties, in a
browser**, because P4c moves no figure and a snapshot diff is therefore empty by
construction and says nothing about any of it — P3d's argument, P4a's and P4b's.

1. **eight types are one surface**, and the old entry paths land on it;
2. ⚠️ **the LISTS did not move** — the property the redirect itself can break,
   since `sales` and `sales/new` are one segment apart and a `pathMatch` wrong by
   one turns every voucher list in the module into a blank new voucher;
3. **both halves offer the same eight buttons in the same order** — asserted as a
   *sequence*, because a scrambled bar is a different defect from a short one —
   and the six Workflow Documents are on neither;
4. ⚠️ **one key crosses the halves**: F5 from a Sales lands on a Payment, F8 from
   a Payment lands on a Sales. That second one left the surface entirely before
   this phase;
5. **the form arrived whole** — the header strip, the items grid, the options bar
   and P4a's head picker, because a stub renders a route just as well as the real
   form does;
6. ⚠️⚠️ **F4 and F6 switch the voucher rather than focusing a field**, and
   `Alt+N` still adds a line.

Shown to fail: the F4 focus binding put back (1 fails), a redirect that drops its
`/new` segment (2 fail — (1) and (2)), and item mode un-hosted from
`ENTRY_SURFACE_TYPES` (5 fail; only the list property survives, correctly, since
the entry routes come back with it). The dirty-form defect above is the fourth
and was found *by* the gate rather than injected into it.

⚠️ **One existing property changed its meaning and was rewritten rather than
re-pointed.** `transaction-panel.ui.spec.ts` asserted that F4 on a full-page entry
form does **not** move the URL — true of the pre-P4c item form, whose F4 focused a
picker. The module-level keys standing down and the form's own keys taking over
are two different facts, and they now land on two different URLs: the property is
which of the two handlers answered (`/transaction/voucher/contra/new`, not
`/transaction/vouchers/contra`), which is a stronger statement than the one it
replaced.

#### ⚠️ `Ctrl+H` was NOT built, and that is a decision rather than a shortfall

§3.5 asks for `Ctrl+H` to toggle **Accounting Invoice ↔ Item Invoice**. Measured
before writing any of it:

- **all 9,970 financial vouchers carry at least one item row** — there is no
  no-items shape in the data at all;
- **`trx_items` names a `productId`, never a ledger** (`id companyId trxId
  productId unitPrice quantity … hsnCode gstSupplyClass`);
- **`buildLegs` gives a sales voucher exactly one `Main` leg** — the voucher's
  single head.

So Tally's Accounting Invoice — N income/expense ledger rows each with its own
amount — is **not representable**: it needs a per-line ledger allocation the
schema does not have and a posting engine that emits several `Main` legs. That is
a migration and a figure-moving change, not a re-host, and sizing it inside a
phase whose whole discipline is *"nothing inside the form changes"* would have
been the wrong trade.

The need is real and small and already has an answer: **474 vouchers are
service-only** (416 sales, 35 credit notes, 23 purchases) — 4.8% of the financial
documents, entered through the item grid with a service product, which is exactly
what a Tally operator would type as an Accounting Invoice.

It gets its own decision and its own phase, **P4e**, on P4b's own ruling one phase
on: *a toggle with one destination is a button that lies.* The two candidate
shapes are recorded in §3.5 so the next phase starts from the measurement rather
than re-deriving it.

---

### P4d record — 2026-08-30

**The six Workflow Documents are typed on the unified surface, and the mode says
what it is.** `/transaction/voucher/<type>` now hosts **all fourteen** voucher
types — purchase requisition, purchase order, goods receipt, quotation, sales
order and delivery challan joined the eight at P4d — their old entry paths
redirect, and **no type has an entry route outside the surface any more**. That
is the second half of this phase's title: the remaining route redirects.

No DTO changed, no service changed, **the backend diff is empty**, and the
parity diff is empty by construction. The six posted nothing before and post
nothing now.

#### The third mode is a mode, not a screen — so there is no third component

§3.5 names three entry modes and P4d builds the last of them, and the shape of
the phase is that it took **no new component**. A Workflow Document's grid, its
pickers, its header strip, its options bar and its lifecycle are the item form's;
what makes it its own mode is the **invariant** — the forward conversion chain
instead of a balance — and `trx-add-edit` has enforced exactly that through
`isFinancialTrxType` since long before this programme. So the six arrived the way
the four before them did: **re-hosted, never rewritten**. A third component would
have been a copy of the second with one branch removed.

What that leaves is one line, and it is the one line that matters:

```ts
const loadFor = (type: VoucherEntryType) =>
  isAccountingEntry(type)            // ⚠️ not `isItemEntry`
    ? VoucherEntryComponent          // the Dr/Cr grid — a CLOSED set of four
    : TrxAddEditComponent;           // everything else on this surface
```

⚠️ **The test had to be turned round.** P4c asked *"is this an item voucher?"*,
which was a complete question while the surface hosted eight and became a wrong
one the moment it hosted fourteen: the six would have fallen through to the Dr/Cr
component and been drawn as **two rows whose totals are both zero**, held to a
balance they can never have. That is the exact shape F6 was filed about, arriving
by omission. The Dr/Cr grid is the half with a closed membership, so it is the
half the condition should name — the same *"make the safe branch the one you get
for free"* rule §13's still-open #3 records as the strongest of its three
answers.

Two things fell out of the injection that proved it. The defect is **loud**
rather than silent — `accountingRowPlan` throws on a type that is not on the
Dr/Cr grid, which is a guard P4b wrote for its own reasons and which fires here
six times per page. And it is loud *and* still renders a screen: the shell, the
title bar, the type bar and the footer's live difference all came up. **A route
that renders is not a route that works**, which is why property (3) below looks
for the difference rather than for a stack trace.

#### ⚠️ Fourteen buttons is not a row of keys

The type bar's whole purpose is that every voucher is one key away from every
other, and it is read as a **row of chords**. Fourteen of them wrap onto three
lines of a title bar and stop being scannable at all — measured, not reasoned:
the bar already wraps, and the six new labels are the longest in the set
("Ctrl+F9 · Purchase Order").

So the row is the **eight that post** and the six that do not sit behind one
overflow. That split is not a layout convenience wearing a name: it **is**
`buildLegs` returning legs or returning none — the same fact `ENTRY_MODE_BY_TYPE`
is keyed off and the backend's co-located spec asserts — so the bar's two tiers
say out loud what kind of document each of these is.

⚠️ **The menu is also the surface the *no-invented-chords* ruling implies must
exist.** `VOUCHER_SHORTCUTS` has always said that **purchase requisition** and
**quotation** have no chord, deliberately, because they are ours rather than
Tally's and inventing one would be inventing muscle memory. Two of the six are
therefore unreachable by any key, so a keyboard is not a complete way in and
something on screen has to be. The menu lists the six in **conversion** order
rather than key order for the same reason: a bar is read as a row of keys and a
menu as a list, and a third of this list would otherwise be sorted by an absent
fact.

⚠️⚠️ **The menu is filtered by `hiddenTransactionMenus`, and the six hideable
stages are exactly these six.** `nextVisibleInFlow`'s own note says the terminal
Purchase and Sales are never hideable, so the admin's hide list and the overflow's
membership are the same set. `app-sidemenu` already applies that filter and so
does the convert action; a bar that went on offering a stage both of them had
hidden would have been **one rule enforced in two of the three places that need
it** — §13's standing shape, in a third place. The eight above are never
filtered: they are not hideable, and a bar that could lose its Payment button is
a worse failure than the one being fixed.

⚠️ It is **not gated**, and the reason is a measurement rather than an oversight:
`JSON_LENGTH(hiddenTransactionMenus)` is **zero on every company row** in the
development database, so a browser property would have to write a company's
configuration and put it back — a mutation of the shared QA world for a filter
with nothing to exclude. Recorded in the spec's *what is deliberately not here*
rather than asserted, which is the call `ledger-picker.ui.spec.ts` already makes
about the invoice-scan review. It is also, precisely, D-56's *"a filter with
nothing to exclude is not a tested filter"* — stated about this one before it
bites rather than after.

#### The mode had to become visible, or it was an item invoice that lost its totals

An accounting voucher is recognisable from the grid in front of you: two columns
and a live difference. An item invoice is recognisable from its tax and its grand
total. A Workflow Document has the second one's grid and **neither** guarantee —
it posts no legs, moves no stock and carries no payment obligation — so with
nothing saying so, a Purchase Order on this surface reads as a Sales invoice that
has quietly lost half its footer.

So the title bar states the mode's own invariant: **what this document converts
into** — `Quotation → Sales Order`, `Goods Receipt → Purchase Entry`. It is the
one fact that distinguishes the mode, and it is a fact an operator wants anyway.

⚠️ It reads `nextVisibleInFlow`, not `DOCUMENT_FLOW_NEXT`, so the caption names
the stage **this company will actually convert into**: an installation that has
hidden Delivery Challan converts a Sales Order straight to a Sales Invoice, and a
caption promising a stage nobody can reach is worse than no caption. Both ends of
each chain are also renamed by the flow's own labels — a goods receipt becomes a
**Purchase Entry** and a delivery challan a **Sales Invoice** — which is why the
gate asserts the label rather than the type slug: asserting the slug would have
passed on a caption naming the wrong document.

The two option chips that follow from the same fact were already conditional and
are asserted rather than added: a document that declares no supply carries no
**GST** chip, and one that owes nothing on a date carries no **Due Date** chip.

#### The gate, and four injections

`qa-artifacts/tests/ui/money/workflow-document.ui.spec.ts` +
`workflow-document-rules.ts` (restated, never imported). **Six properties, in a
browser** — P3d's argument, P4a's, P4b's and P4c's: the phase moves no figure, so
a snapshot diff is empty by construction and says nothing about a route, a
component boundary, a menu or a caption.

1. **the six are on the surface**, and their old entry paths land on it;
2. ⚠️ **the six LISTS did not move** — the property extending the redirect over
   six more types can break, since `<type>` and `<type>/new` are one segment
   apart;
3. ⚠️⚠️ **a Workflow Document is the item grid and shows no Dr/Cr difference** —
   the `loadFor` property, asserted **from both sides** so that a build rendering
   the difference nowhere cannot pass it;
4. ⚠️ **the mode is legible** — each of the six names the document it converts
   into, with its chain's own label; no financial voucher carries the caption;
   and the GST and Due Date chips are absent here and present on a Purchase;
5. **the bar is eight and the overflow is six**, offered in full, in chain order,
   and the menu actually reaches Quotation — which has no chord at all;
6. ⚠️ **one key crosses in and out**: `Ctrl+F9`, `Ctrl+F8`, `Alt+F8` and `Alt+F9`
   from a Sales invoice reach their documents on the surface, and `F8` from a
   Purchase Order comes back.

Shown to fail: `loadFor` back to `isItemEntry` (**5 of 6 fail**; only the lists
survive, correctly, since a list does not depend on which component an entry
route loads), all fourteen buttons pushed into the row with the overflow removed
(**2 fail** — P4d's (5) *and* P4c's rewritten (3), which is the pair that says the
row did not grow *and* the overflow exists), the conversion caption removed (**(4)
alone**), and the redirect's `pathMatch` moved onto the list path (**(1) and (2)**).

⚠️ **One property was inert when first written, and the reason is worth keeping.**
(3) originally looked for `.vch-grid` as *"the Dr/Cr grid"* — and the item form's
own table is `class="vch-grid vch-grid--items"`, so the selector matched on
**both** components. It failed on the correct build and would have failed on the
broken one for the same reason: a property that cannot pass rather than one that
cannot fail. The right discriminator was never a class name but the **invariant**
— `[data-testid="difference"]`, the live Dr − Cr the accounting mode rests on and
the one thing a document with no legs can never have. **When a property is about
a rule, look for the rule, not for the markup that happens to carry it.**

#### One pre-existing failure, found and fixed in passing

`qa:a11y` came back **106/107** with `/product/product-configuration/general-
settings` failing `button-name [critical]` — a *Clear default* icon button
carrying a `matTooltip` and no `aria-label`, which is UI-010's exact shape (a
tooltip is a *description*, offered after a name the element must already have).
Confirmed pre-existing by re-running the same test with this phase's changes
stashed. Fixed, because a red gate is one nobody reads: **107/107**.

#### The measurements

| | |
|---|---|
| Workflow documents in the development database | **1,494** of 12,015 (12.4%) — PO 270, GRN 269, QUO 241, PRQ 240, SO 238, DC 236 |
| Companies hiding a Transaction stage | **0** of 14 — which is why the overflow's filter is not gated |
| Types on the entry surface | 8 → **14** |
| Types with an entry route outside it | 6 → **0** |
| Buttons in the type bar's row | 8 → **8** (the six went behind one overflow) |

`qa:money` **99/99**, `qa:shell` **30/30**, `qa:screens` **50/50**, `qa:print`
**30/30**, `qa:a11y` **107/107**, `check-mirrors.js` green (487 lifecycle
vectors, 14 entry modes, 14 row plans). Backend diff empty.

#### What P4e inherits

The surface is complete: fourteen types, two components, one type bar, one key
map, one set of redirects. What is left of P4 is **`Ctrl+H`**, and it is a
decision before it is a build — §3.5 carries the measurement and the two
candidate shapes.

Three things this phase deliberately did **not** do:

- **No new component for the third mode**, above.
- **`Ctrl+H` still has one destination**, and a Workflow Document is deliberately
  not the second: a non-financial type is *always* in this mode and can never
  leave it, and a financial one can never enter it. That is what keeps the
  accounting grid's *"Dr must equal Cr"* an invariant rather than a case with an
  exception — P4b's own decision, unchanged by having built the mode.
- **The `hiddenTransactionMenus` filter is not gated**, above, and is the one
  thing in this phase measured by hand.


### P4e‑1 record — 2026-08-30

**An Accounting Invoice IS representable, and this plan said it was not.** §3.5
recorded the opposite at P4c, from a real measurement — `trx_items` names a
`productId` and never a ledger, and `buildLegs` gives a sales voucher exactly one
`Main` leg — and concluded that Tally's N-ledger invoice needed a per-line
allocation table, several `Main` legs, a migration and a backfill: *"XL, and it
moves figures — closer in size to P2 than to P4c."*

It needs none of them. **The allocation table already exists.**

#### `trx_charges` is a ledger allocation line whose name is residue

A `trx_charges` row is `{ head, ledger, amount, taxId, taxPercentage, taxAmount }`
— a per-row ledger allocation with its own tax — and `PostingService.resolveLegs`
expands the single aggregate `LegRole.Charges` leg into **one journal line per
row, on that row's own ledger**, handling both signs. Nothing constrains a row's
head to a "charge" head: the only check on `charges[].groupId` is that it belongs
to this company (BUG-0025). The header arithmetic already carries it —
`grandTotal = totalAmount + chargesTotal + totalTax`.

Measured end to end against the running stack, not reasoned. A Sales voucher with
**no item lines** and one allocation of ₹50,000 to the *Sales* head at 18 %:

```
BUILT   totalAmount 0 · totalTax 9,000 · chargesTotal 50,000 · grandTotal 59,000
LEGS    Party        Dr 59,000
        CGST Output  Cr  4,500
        SGST Output  Cr  4,500
        Sales        Cr 50,000
GSTR-1  val 59,000 · txval 50,000 · camt 4,500 · samt 4,500
```

Which is exactly what Tally posts for an Accounting Invoice, and a return that
closes against its own declared value. `POST /trx` with `productItems: []` was
already accepted — every helper in `TrxWriteService` early-returns on
`!items.length` — it simply stored a **zero** document, because the totals are
derived from lines and there were none. Put the money in allocation rows and the
derivation answers correctly with no change at all.

#### 🐞 The mechanism was unusable until GST-021 was fixed, and that is the phase's real find

`GstReturnAssemblyService` loaded `TrxItem` and **nothing else**, so a charge's
value and its tax reached neither GSTR-1 nor GSTR-3B. On the existing books that
was an under-declaration — ₹816 of output tax and ₹5,600 of taxable value on one
company's month, with the payload failing to close against its own `val` on
**49 invoices** (₹63,566). On an Accounting Invoice built this way it would have
been **the whole document declared to nobody**.

So it was fixed first: [GST-021](../qa-artifacts/docs/findings/gst.md), ruled *a
charge is its own return line, at the rate actually charged*. §15 went into the
citation ledger as row 27 at the same time — its absence from a table holding
every rule about the rate, the split, the document and the portal is part of the
finding. ⚠️ `qa-artifacts`' own oracle was blind in the identical way **and
passing**, because every charge-bearing voucher is dated after the twelve
reconciled periods: a missing rule reconciled against a missing rule for a whole
financial year. Both derivations are taught now, independently, and the test
asserts they **meet** — both one-sided injections reproduced.

**This is what P4e's measurement was for.** The phase's own question — *is an
Accounting Invoice representable?* — could not be answered without walking the
document all the way to the portal, and walking it there is what found a High
defect that had nothing to do with P4e.

#### The second axis, and why it is not `VoucherEntryMode`

`VoucherEntryMode` answers *which screen is this type typed on* and is a property
of the **type**. `Ctrl+H` asks *what is in this document's body* and is a property
of the **voucher**: two Sales invoices raised the same day can differ. So
`InvoiceBodyMode` is a second axis rather than a fourth mode, and:

- **`canSwitchInvoiceBody` is DERIVED from `entryModeFor`**, on both sides, rather
  than listing the four item types — so the toggle belongs to the item form and
  cannot drift from which component a type loads. `check-mirrors.js` **11d** runs
  the function per type rather than diffing a constant, for exactly that reason:
  two lists agree until one is edited alone.
- **`invoiceBodyOf` reads the rows, and there is no `trx.invoiceBodyMode`
  column.** A stored body mode is a second statement of a fact the rows already
  carry, and the two can disagree — BUG-0034's shape, and D-56's.
- ⚠️ **A Workflow Document is still not a destination** (P4d's ruling, now
  enforced by a derivation rather than by a sentence): the spec asserts it, and
  injecting the widening fails 3 of 14 unit tests and 6 mirror comparisons.

The unit spec ties `canSwitchInvoiceBody` to **`buildLegs` returning legs**
rather than to a second list — and it caught its own first probe: an item
voucher's legs are keyed off `net`/`grand`, not the `amount` the four cash
vouchers use, so probing with `{ amount: 1 }` answers *"posts no legs"* for all
four switchable types. **The probe was wrong, not the rule**, which is the
failure a tie-test is supposed to produce before anyone trusts it.

#### What P4e‑2 inherits, and the one cost that did not go away

The server is done: no migration, no DTO change, no posting change, and the
parity diff is empty by construction. What is left is the **screen** and the
**print**, and the print half is worth stating plainly because it is common to
both of §3.5's candidate shapes rather than a consequence of this one:

- **Six print templates iterate `voucher?.trxItem`** for the invoice body, so a
  document with no item lines prints an empty table. An Accounting Invoice has no
  `trxItem` under *any* shape — a stated net on the header would have had the
  identical problem — so this is P4e's work either way, not a cost of choosing
  allocations.
- **The entry screen** needs the mode: `Ctrl+H` on the four item types, a grid of
  `{ ledger, amount, tax }` rows, and a saved voucher reopening in the mode its
  own rows imply.

⚠️ **And one thing to decide rather than drift into.** Single-head was the ruling,
and this mechanism gives **N** heads for the same code — one allocation row or
three is the same path. That is not licence to ship the wider thing: the choice
was made on a measurement (475 of 475 service-only vouchers in the database carry
exactly **one** distinct product, against goods documents averaging 1.61 and
reaching 6), and the screen should offer one head until there is a reason for
more. The mechanism generalising for free is a **property to record**, not a
feature to add.

---


### P4e‑2 record — 2026-08-30

**`Ctrl+H` exists, and P4 is complete.** The four financial item vouchers switch
between stock lines and ledger allocations, on the chord and on a button; a saved
voucher reopens in the body its own rows imply; and the six print templates render
an Accounting Invoice as a document that adds up.

No DTO, no service, no migration, no posting change — P4e‑1 established that the
mechanism was already there, so the whole of this phase is a screen, six
templates and a gate. The parity diff is **empty by construction**.

#### The body is the `charges` FormArray, and nothing new was built to hold it

`trx-add-edit` already carried a `charges` FormArray of exactly the right shape —
`{ label, groupId, amount, taxId, taxPercentage, taxAmount, totalAmount }`, with
an `app-ledger-picker` on the head and the tax master on the rate. P4e‑2 renders
that array as the voucher's **body** instead of as a folded option chip, and
points its picker at the voucher's own `headContext` rather than at `Charge`, so
a Sales accounting invoice offers income heads exactly as its main head field
does.

Three consequences fall out of using the same array:

- ⚠️ **The Charges chip is hidden in accounting mode.** The same rows would
  otherwise be offered twice — once as the body and once as a chip calling them
  something else — and one grid's line would be editable from both.
- **A row names itself after its ledger.** `label` is required by the DTO and the
  ledger already says what the row is, so `onAllocationLedgerPicked` fills a
  **blank** label from the picked option and never overwrites a typed one.
- **`invoiceBodyOf` decides what a saved voucher reopens as**, from its rows.
  There is no `trx.invoiceBodyMode`, so there is nothing that can disagree.

#### ⚠️ The gate caught an exclusion the author had talked himself into

The first cut excluded the two **notes** from `Ctrl+H`, on the argument that a
credit or debit note's lines are derived from the invoices it is raised against,
so an accounting body would drop the link the note exists to carry. Property (1)
failed on it, and the argument did not survive two measurements: `trxAgainstIds`
is an **optional header field**, so the link survives a body with no lines at
all — and **43 of this database's service-only vouchers are credit notes**, a
post-hoc discount being exactly what somebody types as an Accounting Invoice. The
exclusion would have denied the mode to a population that measurably wants it.

**A gate that only confirms what the author already believed is not a gate**, and
this is the second time in two phases that a property written against the plan
rather than against the implementation is what found the defect.

#### 🐞 Two print defects, both found by printing one

The six templates iterate `voucher?.trxItem`. P4e‑1 predicted the first of these
and could not design it away — it is common to both of §3.5's candidate shapes,
since an Accounting Invoice has no `trxItem` under either:

- **The document printed no body at all** — a header, a footer, and nothing
  between them. `PrintService.allocationRows` is the shared answer, and it is
  *shared* deliberately: `PrintService` is the one module all six templates
  already import, and a rule restated six times drifts six ways.
- ⚠️⚠️ **And then it printed one that did not add up.** `trx.totalAmount` is the
  **item** net and is `0` on an Accounting Invoice, whose money sits in
  `chargesTotal` — so the first working print read *"Sub Total 0.00 … Grand Total
  56,000.00"*. That was not predicted; it was found by reading the paper.
  `bodySubTotal` is the fix, and the gate asserts the **arithmetic on the page**
  rather than "the sub-total equals `chargesTotal`", because the defect is a
  template reading the wrong column and the right assertion is the one a reader
  would make.

A third, smaller: the GST template's rate-wise **tax summary** was folded from
item lines only, so the block a recipient reconciles their ITC against printed
empty on a document that plainly charges tax. It now reads the allocations too,
keyed by rate rather than by `taxId` — a charge names one tax where a line names
several citations at the same rate, and the summary is a statement about rates.

#### The gate, and five injections

`qa-artifacts/tests/ui/money/accounting-invoice.ui.spec.ts` +
`accounting-invoice-rules.ts` (restated, never imported). **Six properties in a
browser**, because the backend diff is empty and a snapshot diff says nothing
about a keyboard, a grid, a discard prompt or a printed page:

1. **the toggle is offered on exactly the four** — by chord and by button — and
   on **none** of the other ten, where the chord must also do nothing rather than
   throw or navigate;
2. ⚠️ **the Charges chip is gone** while the allocations are the body;
3. **an accounting invoice saves as a voucher with no item lines** — asserted
   against the rows, which is the definition;
4. **a saved voucher reopens in its own body**, both ways;
5. ⚠️⚠️ **the printed document names the allocation and reconciles**;
6. **a switch that would discard asks first** — and declining keeps the work.

Shown to fail five ways, each on its own property: the Charges chip left up
(**2**), the sub-total reading the item net (**5**), the print body losing its
rows — the pre-P4e‑2 state (**5**), the discard made silent (**6**), and a saved
accounting invoice reopening on the item grid (**4**).

#### The measurements

| | |
|---|---|
| Financial item vouchers that can switch | **4** of 14 (Sales, Purchase, both notes) |
| Types offering the mode control | **4** — the other ten offer none, and the chord is a no-op there |
| Service-only vouchers that are **credit notes** | **43** — the population the first cut would have excluded |
| Print templates touched | **6**, all through one shared rule on `PrintService` |
| Backend files changed | **0** |

`qa:money` **105/105**, `qa:print` **30/30**, `qa:screens` **50/50**, `qa:shell`
**30/30**, `check-mirrors.js` green, 129 suites / 1,937 unit tests, all five
guards. Backend diff empty, so the parity diff is empty by construction.

> ⚠️ **A day of repeated suite runs will produce failures that are not defects,
> and it cost an hour to work out.** `qa:money` degraded from 105/105 to 58/47
> across the afternoon, every failure a `429` on a page load — the ERP throttles
> 100 requests per minute per IP, the store is **in-process**, and the dev
> server's SQL log had reached **107 MB** with `DB_LOGGING=true`. Restarting
> `client-back` and truncating the log restored 105/105 with no code change at
> all. Two things follow: **never run two UI suites concurrently** against one
> stack (they share the bucket, and `print-preview` mutates the print
> configuration a neighbour reads), and read a broad, uniform failure across
> unrelated screens as an environment before reading it as a regression.

#### What is deliberately not here

- **The approved posting.** `resolveLegs`' expansion of an allocation onto its own
  ledger is P4e‑1's measurement and belongs to the posting engine; re-approving
  here would add a posted document to the shared QA world on every run, for a fact
  this phase did not change. The **draft** is what P4e‑2 built.
- **Multi-row allocations.** The mechanism gives N heads for the same code and the
  ruling is single-head, so the screen offers one row at a time and that is what
  is measured. A property asserting N would gate a decision nobody took.
- **`trx_charges` is not renamed.** It is really *a ledger allocation line with
  its own tax*, and the name is residue of the only job it had. Renaming it is a
  migration across four writers, the print payload and the GST assembly, and it
  buys nothing a doc comment does not — §6.4's `hubFileId` ruling, again.

---

### P5a record — 2026-08-30

**`bill_references` exists, is backfilled over the whole of history, and its
gate holds at 144/144.** Nothing reads it yet — the annexure still derives, and
moves onto the register at P5d.

#### What it is, and the sentence that shaped it

The register is **not a second derivation of a party's balance. It is a
partition of the `journal_lines` rows that already make it up**, and every
design decision below follows from that one sentence:

```
for every party journal line:   Σ |ref.amount| = |line.debit − line.credit|
therefore, for every ledger:    Σ signed refs  = its balance
```

The second falls out of the first. That is why `journalLineId` is `NOT NULL`,
why `amount` is a magnitude with the line carrying the direction, and why the
gate's load-bearing property is per **line** rather than per party — a company
total passes on a register that lost one line and gained an offsetting error
somewhere else.

It is also why BUG-0040 stops being a recurring class rather than being fixed
once more. Its two known missing terms — the opening balance (D-55) and reverse
charge (BUG-0069) — were both cases of the document side computing a figure the
ledger already knew. A partition cannot omit a term, because the term is a row.

#### What the backfill wrote

| Step | Rows | |
|---|---|---|
| 1 · `new` from a document's own party line | **8,239** | ⚠️ amount from the **line**, never `trx.grandTotal` — BUG-0069 |
| 2 · `new` from an opening balance, no voucher | **53** | D-55's synthesised annexure row becomes an ordinary entry |
| 3 · `against` from an approved allocation | **2,788** | the existing machinery, renamed rather than replaced (§3.6) |
| 4 · `on-account` from an unapplied remainder | **0** | see below |
| | **11,080** | covering **11,051** party lines on **834** ledgers |

The totals tie independently: `against` comes to ₹7,94,42,472.66, which is
exactly the gross of every party payment and receipt; `new` comes to the trx
gross plus the ₹2,65,000 of opening balances.

⚠️ **Step 4 wrote nothing, and that was measured before the migration was
written rather than discovered after.** All 2,759 approved payment/receipt
vouchers on the development books are fully allocated. So the honest position is
that `advance` and `on-account` have **no instance**, this gate asserts nothing
about them, and the arm belongs to **P5b** — which is where the code that writes
one lives. An arm with no instance is untested coverage; §13's standing shape,
declared rather than papered over.

#### The gate, and the three ways it was shown to fail

`npm run qa:p5-bill-register` — twelve properties over all fourteen companies,
**144/144**. Property (12) is the gate testing itself: an uncovered party line
inserted in a rolled-back transaction, because every other property leans on (1)
and (1) is a query over rows that all happen to be correct. Then two real
injections:

- a **corrupted bill amount** fails (1) and (3), naming the line, the ledger and
  both figures;
- a **settlement repointed at another ledger's bill** fails (6) and (7) — and
  deliberately **not** (1), because the line's coverage is unchanged. That is
  the class the invariant cannot see, and the reason both properties exist.

#### Three things worth carrying

- **`billwise` was already there.** D1 put it on `acc_ledgers` *"written by the
  seed, read by nothing yet"*, and it selects exactly the 834 `origin = 'party'`
  ledgers. P5a added a table, not a column — the reservation paid off.
- **Two denormalised columns, both checked rather than trusted.** `ledgerId` and
  `voucherId` are stored copies of derivable facts, which is BUG-0034 and
  BUG-0042's shape; properties (4) and (5) compare each against its source. And
  there is deliberately **no `voucherType`** beside `voucherId`: that half is one
  join away, and copying it too would give two columns able to disagree with each
  other as well as with the entry.
- **The hard-delete graph needed three lines, and its own spec would not have
  said so.** `bill_references` points at `acc_ledgers` and `journal_lines`
  (both RESTRICT, both edges) and at itself through `againstRefId` (a
  `SELF_REFERENCING_NULL_OUT` entry — without it a settled bill is transitively
  its own ancestor and no topological order places the table). D5 and D6 each hit
  this; `company-hard-delete-order.const.spec.ts` verifies the graph is
  *consistent*, not that it is *complete*.

### P5b record — 2026-08-30

**The posting engine maintains the register.** `PostingService.persistLines` —
the one writer of `journal_lines` — now writes bill references for every party
leg, and its gate holds at **7/7** over cases this database does not contain.

#### The seam is `persistLines`, and that is the whole design decision

The invariant is a statement about journal lines (`Σ|ref| = |line|` on every
party line), so **the place that writes party journal lines is the only place
that can guarantee it**. The alternative — hanging this off `postTrx`,
`postPaymentReceipt` and `postPartyOpeningBalance` — is one rule enforced at the
three places somebody thought of, which is §13's standing shape and the direct
cause of BUG-0024, BUG-0028, BUG-0032 and BUG-0056. §4.9 already requires every
writer of `journal_lines` to go through `persistLines`; putting the register
there **inherits** that guarantee instead of restating it.

It also means the invariant is checked where it is created:
`writeForEntry` puts every line to `referenceCoverageProblem` before inserting,
so a posting that cannot describe itself is a refused transaction rather than a
figure discovered by a nightly report over a book that has already moved.

#### A reversal retires; it does not record

⚠️ **This is the half a backfill could not have taught**, because a backfill only
ever sees the finished state.

Cancelling a voucher writes a reversal whose party line is the opposite of the
original's, and **both entries then leave the live population at once** —
`liveEntrySql` drops the reversal (`isReversal = 1`) *and* the original
(something reverses it). So recording the reversal would create a second bill for
a cancelled document, on a line no report will read; and recording nothing would
strand the original's references on a dead line, which is exactly what P5a's gate
property (2) refuses. A reversal therefore **retires the references of the entry
it reverses** — soft-deleted, because a bill that was raised and then cancelled
is a fact about the past — and writes none of its own.

#### The gate builds what the world does not contain

`npm run qa:p5b-register-maintenance` — seven properties, every write inside one
rolled-back transaction over vouchers **cloned from real ones**, so the scratch
data cannot drift from what the schema actually requires. Properties (2) and (3)
are the reason it exists: `advance` and `on-account` have **no instance** here,
so the gate constructs a partly-allocated receipt and an unallocated one.

Shown to fail two ways, and the second is the more interesting:

- deleting the retire branch fails **(5)**, naming the row whose `deletedAt` is
  still NULL;
- dropping the unapplied remainder is caught **at write time by the posting
  itself**, not by an assertion — the run dies with *"the bill references on
  journal line 73495 come to 84,700.00, which fall short of the line's own
  1,69,400.00"* and the transaction rolls back. A gate that has to notice is
  weaker than a write that cannot happen.

#### Two things to carry

- **`on-account`, never `advance`, wherever nobody was asked.** The two differ by
  *intent*, not arithmetic — an advance is money deliberately paid against a bill
  expected to arrive, and only the person entering it knows that. Both the
  backfill and the engine say the true thing and leave re-designating it to P5c,
  where there is a human and a screen.
- **A missing bill degrades to `on-account` rather than to a dangling
  `against`.** It should be unreachable — `findByIdsForSettlement` refuses a
  target that is not approved, and an approved document has a bill — but if it
  ever happens, money attributed to no bill *is* what on-account means, the
  register's shape survives, and the rows are how you would find out.

⚠️ **The register has no rebuild door yet, and it deliberately should not get a
blind one.** Re-running the P5a migration is idempotent and fills any gap, which
is the repair door for now. That stops being safe at **P5c**: the moment an
operator can state an advance or name a bill by hand, a rebuild from the postings
would erase decisions a person made. BUG-0042's rule — *a cache and its rebuild
are one change* — does not apply unchanged here, because the register stops being
derivable the moment it stops being only a partition.

### P5c‑1 record — 2026-08-30

**A payment or receipt may now name no bill at all, and the register says what
the money is.** Gate **9/9**. P5c split in two on the same argument every other
[L]-shaped phase here did: this is the backend the grid needs, and P5c‑2 is the
grid.

#### The gap, measured from both sides at once

Until this, a payment or receipt **had** to name at least one open `trx`
document. Two ordinary things were therefore impossible:

- an **advance** — money moved before the bill it is meant for exists;
- collecting from a party whose only open item is an **opening balance**, which
  has no `trx` row (D-55) and so can never appear in a picker built from `trx`.

That second one is **53 parties and ₹2,65,000 on the development books, none of
them settleable at all** — and it is the clearest statement of why the register
had to exist. Gate property (1) measures exactly it: on one of those parties,
`getDueInvoice` answers **0** and `openBills` answers the bill.

#### ⚠️ The refusal was written twice, and fixing one would have changed nothing

`saveReceipt` carried its own *"At least one invoice to settle is required"*,
and `planSettlement` — reached through `persistAllocation` — carried *"Select at
least one document to settle."* Two independent statements of one rule, in two
files. Relaxing either alone leaves the gap exactly where it was.

This is §13's standing shape, and it was found **only** by going looking after
relaxing the first: the second is what property (7) exercises, and the injection
that restores it fails that property alone. `planSettlement`'s refusal **stays** —
it is correct for a voucher that does mean to settle something, and the
controller now short-circuits before reaching it.

#### `advance` is a column, because there is no arithmetic that finds it

`trx_payment_receipts.unappliedRefType` (`advance` | `on-account`). Both look
like "cash with no allocation row"; the difference is intent, and only the
person entering it knows. Deriving it would be BUG-0034's shape — a fact that
belonged on the document being re-derived later from something that merely
correlates with it.

⚠️ **The default is on the COLUMN, not the DTO.** §12: `ValidationPipe` runs with
`transform: true`, so a property initialiser on an `@IsOptional()` field is a
value supplied on **every** request that omits it, `PUT` included — BUG-0020,
where renaming a closed financial year reopened it.

#### A note on the injections

Shown to fail three ways — restoring `saveReceipt`'s refusal fails (7), ignoring
the stated intent fails (5), and excluding the opening balance from `openBills`
fails (1).

⚠️ That third one **passed on the first attempt**, and the property was not the
problem: the edit had not applied, because the shell mangled the quoting in a
one-line `python -c`. **A passing injection is a claim about the edit before it
is a claim about the property**, and the difference is one `grep` of the file
under test. Worth writing down, because a green injection reads as reassurance
and is the one result nobody re-checks.

### P5c‑2 record — 2026-08-30

**The reference grid exists.** A payment or receipt is entered against the
party's open **bills**, read from the register rather than from `trx`, with a
per-bill figure saying what this voucher applies to each. Gate **7/7**, shown to
fail four times.

#### The multi-select is gone, and what replaced it is not a prettier one

`app-select[formcontrolname="against"]` — a dropdown of labels reading
*"INV-123 • Due 5,000"* — is deleted. In its place is a table: **Bill · Date ·
Due · Open · This voucher**, one row per open bill, oldest first, with a tick.

⚠️ **The column that justifies the change is "This voucher".** A multi-select can
say *which* bills; only a grid can say *how much of each*, before the voucher is
saved. That figure is `planBillSettlement` — mirrored in
`bill-reference.util.ts` and compared behaviourally by `check-mirrors.js`
**check 12** over `scripts/vectors/bill-settlement.vectors.json`, on the
**mappings and the message text** — so the column and the allocation the server
writes cannot come apart, and a refusal arrives in the server's own sentence
instead of as a toast on a button that looked live.

The screen it replaces restated **three** arms of that rule by hand
(`mixedSides`, `isRefundSelection`, `amountExceedsDue`) and said nothing about
the other three. There is one refusal now, and it is the server's.

#### The rule had to move house before it could be mirrored

`planSettlement` speaks in **documents** — `{ trxId, trxType, open }` — and
`settlementRole` switches on `TrxType`. Neither has anything to say about a bill
no document made, which is the whole point of the register.

So `planSettlement` was split. The general rule is **`planBillSettlement`**,
stated about bills (`{ billId, sign, controlSide, open }`), and `planSettlement`
is now the adapter that turns documents into bills before asking it. The
arithmetic is untouched — its 43 existing unit cases pass unchanged, which is how
that is known.

⚠️ It lives in `bill-reference.const.ts`, not in `settlement.const.ts`, and that
was forced by the mirror rather than chosen: `settlement.const.ts` imports
`TrxType` off a Sequelize entity, so `check-mirrors.js` **could not bundle it**
(`Could not resolve "pg-hstore"`). `src/const` is documented as pure; a rule that
has to be *run* by another repo is where that stops being a convention and starts
being load-bearing. The names it needed are re-exported, so no importer moved.

#### `billSettlementSign` — the register answers what `settlementRole` cannot

The second, smaller rule: `+1` if this voucher **settles** a bill posted on that
side, `−1` if the bill **offsets** it. A receipt credits the party, so it settles
what debits them and is offset by what credits them.

It is `settlementRole(...).sign` derived from the **posting** instead of from the
document — BUG-0069's discipline — and the point is that every bill has a side
while only some have a `TrxType`. A party's opening balance (D-55) is signed
correctly by it and is invisible to the older rule.

⚠️ The two agree on **all eight** `settlementRole` combinations, and
`bill-reference.const.spec.ts` asserts that rather than assuming it. That
agreement is the only thing that makes it safe to use where the older rule
already applies.

#### 🐞 Building it found BUG-0070, and that is the phase's real find

Designing the grid meant asking what the register records when a receipt clears
an invoice partly offset by a **credit note**. The answer was: nothing — the
approval **threw**.

`settlementRows` wrote one reference per allocation row, and an allocation
records *document settlement* while a reference partitions a *journal line*.
`planSettlement` consumes the note in full and then clears the invoice with
`cash + noteTotal`; the line is the cash alone. A ₹1,000 receipt clearing a
₹2,000 invoice with a ₹1,000 note therefore carried ₹3,000 of allocations against
a line of ₹1,000, and the write-time invariant refused the whole approval.

**44 draft vouchers on the development database were un-approvable**, and so
would every voucher of that shape entered since P5b.

⚠️ **Neither existing gate could see it**, and the reason generalises. P5a reads
the finished state of history, which contains no *approved* voucher of the
shape — the only three that name a note allocate nothing else. P5b builds the
cases the world does not contain, but only the ones somebody had named. *A gate
over existing rows cannot see a case the rows do not contain, and a gate that
constructs cases only constructs the ones somebody thought of.* Fixed in its own
commit before this phase, with two new P5b properties that build the case.

#### ⚠️ The read is bounded, and it says so

One party here has **2,589** open bills. Rendering all of them with a Material
checkbox on each takes **3.5 seconds**, measured. The grid takes the oldest
**200**, prints *"Showing the 200 oldest of 2,589 open bills — search to reach
the rest"*, and `search` narrows server-side. §10's `MAX_PAGE_SIZE` doctrine:
clamp, never refuse, and say what was done.

Two things fell out of it, both worth carrying:

- **A bound makes reachability a property.** Property (6) picks the *newest*
  open bill, asserts it is **not** on screen, and then finds it by searching. A
  bound with no way past it has quietly removed those bills from the product.
- ⚠️ **The party field's "Total Due" hint had to go.** It was the truth while
  the feed was unbounded and became the sum of the first 200 of 2,589 the moment
  it was not. The grid's head states *"Open on this page"* instead. A money
  figure whose label overstates its scope is worse than no figure.

#### 🔒 A bill no document made is offered, and cannot be ticked

> ⚠️ **Closed by [P5c‑3](#p5c-3-record--2026-08-31) on 2026-08-31** — the column
> is nullable now, `billRefId` sits beside it, and the row ticks. What follows is
> what was true at P5c‑2.

The wire is unchanged: `against` is still `[{ trxId }]`, and
`trx_payment_receipt_trxs.trxId` is `NOT NULL` behind a foreign key. So an
opening balance **cannot be named** by a voucher yet — that is **P5c‑3**.

It is still shown, and the row says why. Hiding it is what made those 53 parties
look unsettleable in the first place; the money reaches the ledger either way and
the register calls it `advance` or `on-account`. ⚠️ The sentence is on the **row**
rather than in a tooltip, because a disabled control renders no tooltip at all
(§9, UI-010's sibling).

⚠️⚠️ One more consequence, recorded rather than fixed: **a part-allocation with a
remainder is not reachable from this screen.** `planSettlement` caps the cash at
the selection's net (BUG-0029's create-time courtesy), so a ₹1,000 receipt
against a ₹400 bill is refused rather than split into `against 400` +
`on-account 600` the way Tally would. Either the selection is fully applied or
nothing is selected. P5b's register can express it — its gate constructs
one — and only the settlement engine's cap stands in the way.

#### The gate, and four injections

`qa-artifacts/tests/ui/money/bill-reference-grid.ui.spec.ts` +
`bill-reference-rules.ts` (**restated**, never imported — both implementations
already agree by construction, so importing either would make the gate a third
copy of one derivation). Seven properties: the grid is fed by the register in its
own order **and each row is labelled by what it does to this voucher**, judged
against its document's own type read from the database; a document-less bill is
offered and un-tickable; the column is the allocation; a refusal is the server's
sentence with **no request leaving the page**; the bound says so, search reaches
past it and a bill ticked before a search survives it; and an **advance survives
to `bill_references`** through a DTO, a column default and the posting engine;
and **editing shows the bills the voucher settled, still ticked**.

A browser is the only instrument that can see this phase: the wire is unchanged,
so the parity diff is **empty by construction** and `qa:p5c-unapplied` measures
the API rather than the screen.

Shown to fail six ways — hiding the document-less bill, restoring the
*"at least one invoice"* validator the server dropped at P5c‑1, silently showing
a slice, dropping the ticked-bill merge, and dropping the edit-path ordering.

⚠️ **The fourth injection PASSED, and the property was the problem.** Making
"This voucher" echo `open` for any ticked bill left the gate green: with the
prefilled amount every selected bill is applied in full, so the two figures are
*equal* and the column could not be distinguished from the thing it is not. The
property now **under-pays** the selection, which splits the cash oldest-first and
only the real rule produces.

⚠️⚠️ And it passed **twice** before that was understood, because the edit that
was supposed to fix the property had not applied — a `cd` into a directory that
was already the working directory failed, and `&&` short-circuited the `python3`
after it. That is P5c‑1's own note, verbatim: *a passing injection is a claim
about the edit before it is a claim about the property*, and the difference is
one `grep` of the file under test. Written down a second time because knowing it
did not prevent it.

#### 🐞 Two defects in what P5c‑2 itself wrote, both found by writing its properties

**The first cut of the grid dropped a ticked bill.** The read is bounded and
`search` **re-fetches**, and `selectedBills` — the payload's own source — read
from `openBills`; so a bill ticked before searching for another one was no longer
in the page, and saving lost it silently. `pinned` is the fix: the ticked rows
are kept across fetches and merged back into the page in their own date order,
because `planBillSettlement` fills in the order it is given and appending would
let a newer bill be settled before an older one.

**And editing a voucher lost the allocation it already had.** `excludeVoucherId`
frees back a voucher's own contribution so its targets read as open again — which
is necessary and was not sufficient: the read is **bounded**, and a receipt that
settled one of the newest of a party's 2,589 bills opened its own edit screen
with that bill outside the window, un-ticked, and would have dropped it on save.
The query now sorts a voucher's own bills to the **front**; freeing the
contribution back is only half of *"the bill has to be on the page"*.

Both were found by writing the property, not by review, and both are in the gate:
a bill ticked before a search is still ticked after it, and a real approved
receipt reopened shows exactly its own allocations. Each shown to fail by
removing the fix.

#### 🐞 And a defect in P5a's own gate, which only a cancellation could reveal

P5a's gate read `bill_references` **without ever asking whether a row was
retired** — nine queries, none with `deletedAt IS NULL`. A retired reference by
design hangs off a **dead** line, so the moment this phase's browser suite
cancelled its first QA voucher, property (2) called 13 correct rows orphans and
property (3) counted their amounts into a ledger's balance. The register was
exactly right; the gate was measuring something else.

Nothing had been cancelled between the backfill and today. **P5b's gate proves
retirement and rolls it back**; P5a's reads history, and history had none.

Filtering was half the fix. The other half is new property **(11)**: *a reference
is retired exactly when its entry left the live population*, asked in **both**
directions over every company — so a retirement that fails to happen is as
visible as one that happens wrongly. 144 → **157**, and shown to fail by
un-retiring one row (which reproduces (2) and (3)'s original symptom beside it,
now with a property naming the cause).

#### 🐞 `qa:money` outgrew its own throttle — and the opt-out only covered half a 429

The lane runs **serially against the ERP's 100 req/min per-IP limit**
(`app.module.ts`: `{ ttl: 60_000, limit: 100 }`). At 105 tests it was green; the
seven this phase added took it to 112 and **eight tests failed** — none of them
this phase's, and **not one of them an assertion**. Every failure was the
`problems` fixture reporting `page error: HttpErrorResponse`, clustered in the
three alphabetically-last suites, where the bucket is most exhausted.

⚠️ **The tolerance those suites already declared did not cover it.** Five of them
push `/status of 429/` into `problems.ignore` — which matches the **console**
line Chromium logs (*"…responded with a status of 429"*) and **not** the
`pageerror` Angular raises for the same response, whose message is the bare
string `HttpErrorResponse` with no status in it to match on. So the opt-out
silenced one half of one event and the other half went on failing the test. It
had been that way since the line was first written; the lane simply had not been
loaded enough to show it.

The fix is in the fixture and is narrow on three counts, because a tolerance is
the one change that can quietly stop a suite measuring anything:

- **opt-in** — only a suite that already asked to tolerate 429s is affected, and
  that is asked by putting a real 429 console line to the suite's own patterns
  rather than by adding a second flag nobody would set;
- **bounded** — at most as many `HttpErrorResponse` page errors are forgiven as
  there were **429 responses actually observed**;
- **reported** — the count is attached to the test as an annotation.

A 5xx is recorded separately and still fails regardless. All three bounds were
**measured**, not reasoned: a synthetic non-`HttpErrorResponse` page error still
fails in an opted-in suite; an `HttpErrorResponse` still fails in a suite that
did not opt in; and an `HttpErrorResponse` still fails in an opted-in suite that
saw no 429.

`voucher-options-bar.ui.spec.ts` took the opt-in line its five siblings already
had. Two of this phase's own properties were folded into one, and the one added
afterwards for the edit path was written to be cheap — one page load, no party
pick, no save.

That was necessary and **not sufficient**, and finding that out is the other half
of this. With the fixture fixed the next full run failed **ten**, in a completely
different set of suites; splitting the lane in half left the half containing the
51-route sweep still over budget. The damage moves because the lane is simply
over the limit throughout — patching tolerances suite by suite is chasing it.

So the limit itself moved out of a literal: **`RATE_LIMIT_IP_PER_MIN`**, in
`rate-limit.const.ts` beside the company dimension that was already env-tunable
and whose own comment says *"tunable via env pending real measurement"*. The
measurement arrived from an unexpected direction — a harness that cannot
complete — and the default is **unchanged at 100**, asserted by a spec, so
nothing about a deployment that does not set it is different. ⚠️ It is not a
licence to raise it in production: the only environment with any business setting
it is one whose traffic is known to come from a single machine on purpose.

With the limit raised for the harness the lane went **102 → 110 of 112**, and the
two that were left were assertions rather than noise — which is what made them
worth reading. Neither was this phase's (one runs on a **journal**, where the
reference grid does not render at all; the other sweeps `/audit-logs`), and both
were the same latent shape: **a pause standing in for a wait.**

- `ledger-picker` (6) typed a search term, slept 800 ms and pressed `Alt+C`. Under
  load the chord fired against a box that had not received the term, and the
  assertion read `""` — **indistinguishable from the real defect that property
  exists to catch** (P4c's `markAsUntouched` emptying the box). The pause is now
  an assertion that the term arrived.
- `checklist.ts` counted a grid's rows the moment its toolbar appeared, so a
  large list rendered its chrome first and the check read zero on a working
  screen. Polled now, in **both** of its halves — the voucher-list half was the
  other six failures of an earlier run.

⚠️⚠️ The general point outlives all of it: **a serial browser lane has a request
budget, and a new suite spends it.** The next phase to add one should measure the
lane, not only its own file — and should check that whatever it tolerates covers
every event the tolerated thing produces. ⚠️ The corollary this run produced:
**raising the ceiling made the remaining failures legible.** Three runs of
rotating 429 damage hid two ordinary races; the moment the noise stopped, both
named themselves in one run.

#### One selector collision, avoided rather than discovered

The bills table was first given `class="vch-grid vch-bills"` — it is visually the
same table. `rowsOnScreen` in P4b's gate reads `.vch-grid tbody tr` to compare
the Dr/Cr rows against the legs the voucher posts, so six bill rows would have
joined them. It has its own class and shares the base rule instead.

That is P4d's inert-selector finding read forwards rather than backwards: **a
shape shared for a styling reason is not a shape shared for a meaning**, and the
gates read meaning. P4b's own property (3b) did have to move onto the grid — the
multi-select it drove is gone — and it passes unchanged otherwise.

### P5c‑3 record — 2026-08-31

**A voucher may name a bill no document made.** The allocation table's `trxId`
is nullable and `billRefId` sits beside it, the database insists on exactly one
of the two, and the reference grid's opening-balance row — offered and disabled
since P5c‑2 — can now be ticked, settled and posted. Gate **18/18**, shown to
fail four ways; the browser property that asserted the disabled checkbox
**inverted**, and was shown to fail two ways.

#### What was actually in the way, measured

| | |
|---|---|
| Open bills no document made | **53**, ₹2,65,000 |
| …belonging to a party with **no** open document at all | **53 of 53** |
| Existing allocation rows | **3,208**, every one naming a document |
| Rows this migration backfills | **0** |

`trx_payment_receipt_trxs.trxId` was `int NOT NULL` behind a foreign key to
`trx`, and a party's opening balance (D-55) is posted straight to the control
head with no `trx` row at all. So the wire had nowhere to put one — which is why
P5c‑2 could show the row and not tick it, and why what those 53 parties were
shown was every bill they had, greyed out.

⚠️ **The second row of that table is the one that shaped the phase.** Not one
party on the development books holds both an opening balance and an open
document, so the **mixed** selection — one voucher settling a document and a
document-less bill together — has no instance in the world. It is P5b's
`advance` arm again: the gate builds the case rather than reporting green over
an arm nothing exercises.

#### The database says "exactly one", and it is asked whether it means it

`billRefId` is nullable, `trxId` became nullable, and
`chk_trxprt_one_target CHECK ((trxId IS NULL) <> (billRefId IS NULL))` is what
makes those two facts one rule. Not *"at least one"*: a row naming both would be
two answers to *what does this row settle*, and they can disagree — a document's
`new` bill is found through `voucherId`, so a `billRefId` pointing elsewhere
would settle one bill in the register and another one's `paidAmount`.

⚠️ MySQL below 8.0.16 parses a `CHECK` and ignores it, so the gate does not read
the constraint's existence — property (1b)/(1c) **insert the two forbidden
shapes** and require the refusal to name the constraint. The service refuses the
same shape first, in a sentence, because the person meeting it is an operator
and `chk_trxprt_one_target` is not a sentence.

#### One plan over both kinds of target, and the mirror is what decided it

`buildAllocation` used to call `planSettlement` over documents. It now builds one
`BillToSettle[]` spanning both kinds and calls **`planBillSettlement`** once.

That was not a preference: **the screen already plans the whole selection at
once with that rule** (P5c‑2's mirror, `check-mirrors.js` check 12), so planning
the two halves separately here would give the column an operator reads and the
allocation the server writes two different derivations of one cash figure.

Three things fell out of it, and the last is a small correction to something
that was never right:

- `planBillSettlement` treats `billId` as an **opaque key**, so the plan is keyed
  by position in the caller's own list and mapped back afterwards. There is no
  need to invent a shared id space for two tables.
- **`ImportVoucherCommitService` is deliberately untouched** and still calls
  `planSettlement` over documents. A bulk import replays documents the source
  system already accepted; it has no bill the register raised on its own to
  name, and giving it one would be inventing a settlement nobody recorded.
- ⚠️ **The fill order is now the payload's**, which is the grid's order, which is
  the order the "This voucher" column was computed in. What it replaced was
  `findByIdsForSettlement`'s `Op.in`, whose order MySQL never promised — so a
  short-cash selection could be split one way on screen and another in the
  register, and nothing said which. The rule has always consumed bills
  oldest-first *in the order it is given*; until now nobody gave it one.

#### ⚠️ A divergence this phase did not close, and the four documents it is about

A document's `open` is `grandTotal − paidAmount`; a register bill's is
`amount − Σ settled`. For an ordinary document they are the same figure. For a
**reverse-charge purchase** they are not — the party leg is `net + charges`
(BUG-0069) — so the screen, reading the register, is **stricter** than the API
by exactly the RCM tax:

| voucher | document says | register says |
|---|---|---|
| 20746 | 944.00 | 800.00 |
| 20748 | 590.00 | 500.00 |
| 20871 | 944.00 | 800.00 |
| 20873 | 590.00 | 500.00 |

**₹468 across four live purchases**, and nothing is mis-written today: the
narrower cap wins, because it is the one the operator meets. Moving the document
half onto the register would cap `paidAmount` below `grandTotal` and leave such
an invoice permanently part-paid — a document-side change that belongs to
**P5d**, where the annexure moves onto references.

#### 🔒 §4.3 rule 7, for the id this phase adds

`billRefId` arrives off the body, so `BillReferenceService.findOpenBillsByIds` is
the check, at the **seam** the save path funnels through. It is a **filter**
rather than a lookup — a bill that is not this company's, not on **this party's**
ledger, not a live `new` row or no longer open simply does not come back, and the
count refuses the difference. That is the shape `findByIdsForSettlement` already
gives the document half.

⚠️ It is deliberately **not** `openBills` with a filter applied afterwards. That
read is bounded to the oldest `MAX_OPEN_BILLS_SHOWN`, so a bill outside the
window would be refused as *"not available"* while being perfectly settleable.
**A bound is a property of a picker, never of a validation.**

#### ⚠️ Two lines were written, measured, and then unwritten

Both are worth recording, because the version that survives review is not always
the version that is true.

**`resolvePaymentReceiptDirection` grew an arm and lost it.** A voucher naming
only bills reads nothing from the document loop, so the obvious move is to derive
the party's control side from the bill's own posting. That code was written —
and then deleted, because it can never run: a receipt settles **debit**-side
bills and a debit-side party bill is money they owe us, which is
`PARTY_DIRECTION_BY_KIND[Receipt]`; a payment settles **credit**-side bills,
which is `[Payment]`; and `planBillSettlement` refuses a selection whose bills
all *offset* the voucher, so a bill-only voucher of the other shape is never
written at all. The fallback is exactly right. What is left is a comment saying
so — and gate property **(6)**, which asserts the leg's side against the bill's,
because the guarantee is two rules meeting rather than one statement.

**And the skip in `applyReceiptSettlement` is not what makes it safe.**
`if (map.trxId == null) continue;` reads like the guard; `Trx.findByPk(null)`
answers `null` (measured), so the `!trx` below it would have skipped the row
anyway. The line stays — it states the case and spares a query — but its comment
now says plainly that it is not load-bearing, because *a comment claiming a line
is load-bearing when it is not is how the line below it gets deleted by somebody
tidying up*.

#### The gate, and four injections

`client-back/scripts/qa-p5c3-bill-settlement.ts` — nine properties, 18 checks,
every write rolled back except the save path's, which goes through the
controller's own transaction and is deleted after. Shown to fail:

| injection | what went red |
|---|---|
| `settlementRows` ignores `billRefId` | (4)(4b)(7)(7b) — the reference degrades to `on-account 2500 → null` and the bill never closes |
| the exactly-one refusal removed | (2b)(2c)(2d) — a row naming neither is **accepted**, and the scratch voucher survives |
| the ownership filter drops its party predicate | (3) — another party's bill resolves |
| the bill half never reaches the plan | (2) — *"Select at least one document to settle."* |

⚠️ The second injection is the one worth reading: with the refusal gone, a row
naming **neither** id is not an error — it is silently dropped, the voucher saves
with no allocation, and the money quietly becomes `on-account`. That is why the
refusal is a sentence in the service and not only a constraint in the schema.

#### The browser property inverted, and it found a selector collision on the way

`bill-reference-grid.ui.spec.ts` (2) asserted a **disabled** checkbox and a row
explaining why. It now ticks the opening balance, saves, approves, and reads the
`against` reference back out of `bill_references` — the operator's end of the
whole phase, through a DTO, an ownership filter, the settlement rule and the
posting engine. It settles **part** of the bill deliberately, so the case
survives for the next run. Shown to fail by re-disabling the checkbox and by
dropping document-less bills from the payload.

⚠️ **P5c‑2's own selector-collision note arrived back from the other side.** The
new row tag — *"no document"* — was first given the same `.vch-bill__tag` class
as the *"offsets"* tag, which is what `gridRows` reads to decide whether a bill
offsets the voucher. Every opening balance would have reported as an offset, in a
suite that was still green. Each tag carries `data-tag` now, and the gate reads
that. **A shape shared for a styling reason is not a shape shared for a
meaning** — written down at P5c‑2 as a thing avoided, and reintroduced one
release later by the author of the note.

#### 🐞 And the collision had a second half, in a file this phase never opened

`voucher-entry.ui.spec.ts` (3b) — P4b's *"a payment posts the party leg the grid
says it will"* — picks a bill to settle with
`tr[data-selectable="true"]` filtered by `hasNot: .vch-bill__tag`. **Both** of
those moved in this phase: the first attribute no longer exists, and the second
class is no longer only the *"offsets"* tag.

It went red in the full lane and nowhere else, because it lives in a different
file from the grid it reads. Two things worth carrying:

- **A `data-` attribute on a shared component is an interface**, and its readers
  are not in the file that renders it. `grep -rn 'data-selectable\|vch-bill__tag'
  tests/` is the check, and it takes a second.
- ⚠️ Neither failure would have been an *error*. `[data-selectable="true"]`
  matching nothing is a timeout; `hasNot: .vch-bill__tag` excluding one row too
  many silently picks a different bill. The first is loud and the second is the
  kind that would have been read as flakiness for a week.

#### 🐞 A pause replaced by an assertion is an honest failure, not an absent one

Two properties in other suites failed in the full lane and passed alone —
`ledger-picker` (6) and this phase's own (2) — and both were the **same race,
one that P5c‑2 had already been round once**.

That record says (6) *"typed a search term, slept 800 ms and pressed `Alt+C`"*,
and that the pause was replaced by an assertion that the term had arrived. The
assertion is what timed out this time. ⚠️ **The wait was never the problem.**
`page.keyboard.type` types into whatever has focus, and the `app-select` overlay
is still animating when its search box first becomes *visible* — so the first
characters go nowhere at all, and no amount of waiting afterwards puts them
back. The list then comes back unfiltered, which reads as *"the picker never
offered this party"*.

`locator.pressSequentially` focuses the element it is called on and still sends
real key events, which both properties need. Applied at all three sites in the
lane; the assertions stay, as the proof rather than as the fix.

⚠️⚠️ The general form: **replacing a pause with an assertion converts a silent
wrong answer into a visible failure — it does not make the underlying race go
away.** Reading the new failure as "the assertion needs longer" is how the same
race survives two phases.

#### The measurements

- `qa:p5c3-bill-settlement` **18/18**; `qa:p5-bill-register` **157/157**,
  `qa:p5b-register-maintenance` **9/9**, `qa:p5c-unapplied` **9/9** — the three
  earlier gates unchanged by a phase that writes to the same register.
- `npm test` **1971/1971**, all five guards clean, `check-mirrors` green with
  **23** behavioural comparisons on check 12 (up from 21).
- `qa:money` **112/112** — the lane is the same size as P5c‑2 left it, since this
  phase inverted a property rather than adding one, and it is green throughout
  rather than green-with-tolerated-429s: `RATE_LIMIT_IP_PER_MIN` is what P5c‑2
  moved out of a literal for exactly this.
  ⚠️ **Two earlier runs of it were void and are not the measurement**: a
  stylesheet edit hot-reloads the app under a live lane and a service edit
  restarts the backend under it, and both produced failures — `ERR_CONNECTION_
  REFUSED`, 36 `HttpErrorResponse` — that look nothing like the change being
  tested. **Freeze the tree before a serial browser lane**, or read its failures
  as your own editor.
- The **parity diff is empty by construction**: no report, no posting rule and no
  figure derivation changed. What changed is what the allocation table can hold.
  The one join that moved — `settlementRows`' — is provably identical on every
  existing row, because `billRefId` is NULL on all 3,208 of them.

#### What P5d inherits

- `pendingBills` still derives the annexure from `trx`, which is what BUG-0069
  was filed about and what the RCM divergence above is a second instance of.
  Moving it onto `bill_references` is P5d's whole job, and both halves of the
  divergence disappear when it lands.
- **Bills Receivable / Payable** — the two reports §3.6 names and neither P5a nor
  P5c built.
- ⚠️ The document `open` and the register `open` should become one figure at
  P5d, and the cost of doing it is on the **document** side: `trx.paidAmount`
  and `isPaid` are computed against `grandTotal`, so an RCM purchase settled to
  its register bill reads part-paid for ever unless `isPaid` learns the same
  rule.

### P5d record — 2026-08-31

**The annexure stopped deriving and started reading, and the two reports §3.10
names exist.** P5a built the register, P5b made the posting engine maintain it,
P5c put it on the entry screen — and nothing *reported* from it. The bill-wise
annexure still derived from `trx` plus its allocation rows, which is the
derivation BUG-0040 is about and BUG-0069 was filed against.

| Artefact | What it is |
|---|---|
| `BillReferenceService.outstandingBills` | **One read**, and the phase in one method: every live open bill of a party or of a control side. The annexure and both new reports go through it, so they differ in how they *group* and never in what a bill is. |
| `bill-reference.const.ts` `splitBillOpen` · `NORMAL_SIDE_BY_PARTY_SIDE` · `heldBackOnBill` · `sourceOfBill` · `documentIdOfBill` · `labelForBillWithNoDocument` | The rules, pure and specced. `splitBillOpen` is the one that does the work: a bill on the party's own side is outstanding, one on the other side is owed back. |
| `PartyStatementService.pendingBills` | Three hand-written terms deleted — D-18's note netting, BUG-0069's `postedPartyShare`, D-55's synthesised `openingBalanceBill` — and one query in their place. |
| `ReportsService.billsOutstanding` + `GET /reports/bills-receivable` · `/bills-payable` | Party rows carrying their total, expanding to their own bills, with ageing across the report. |
| `client-front` `reports/bills-outstanding/` | One component, two routes. The Outstanding tabs now render it; `VendorOutstandingComponent` and `CustomerOutstandingComponent` are **deleted** and every old path still resolves. |
| `outstanding.const.ts` `paidStatusFor` + `BillReferenceService.postedBillAmounts` | The denominator, moved off `grandTotal` onto what the voucher **posted** — at all four document-side sites, which had two copies of the paid-status rule between them. |
| `scripts/qa-p5d-annexure.ts` · `npm run qa:p5d-annexure` | The gate. **16/16**, shown to fail three ways. |

**The ground was measured before the phase started**, as P2b‑3c and P4e‑1 did.
Over 14 companies: **381 party ledgers, and Σ(open bills, signed) already equalled
every one of their ledger balances — gap ₹0.00.** So the identity P5d turns the
annexure into was verified in SQL before a line of it was written, which is why
its gate can be read as a statement about the code rather than about the data.

#### The one thing that moved, and why it is the right way round

**A return note is a bill of its own now**, on the opposite side, instead of
being folded into the document it names. Measured across the change: **180 of
802 parties' annexure totals moved**, 622 unchanged, 172 row counts changed. It
was ruled deliberately, and D-18 / [BUG-0013](../qa-artifacts/docs/bugs/BUG-0013.md)
are **not** reversed by it.

The defect BUG-0013 records is a note listed as an open item on the **positive**
side while the invoice it offset read as closed — the party's total overstated by
the note's full value and pointing the wrong way. Here the note is signed by the
side it was **posted** on, so it reduces the party's position by exactly its
value and the invoice stands at what is still open on it. The net is identical;
what changed is that the two facts are two rows.

⚠️ **What decided it is that the same party's open items were already being drawn
twice, differently, in one session.** The entry screen's reference grid has
listed the note as its own offsetting row since P5c‑2, because that is what the
register says and what the operator ticks. A collections sheet and a settlement
screen disagreeing about what is open is the class of defect this programme keeps
closing, and one of the two had to give. The register won, because it is the side
that reconciles with the ledger — measured: on company 15's party 137, a supplier
we also sell to, the old annexure reported **₹55,907.10 owed** where the ledger
said ₹36,654.36 Cr, because it carried a sales invoice and two purchases as
positives together. The new one reports ₹55,239.45 owed and ₹18,585.09 owed back,
and the difference **is** the ledger balance.

Three consequences worth knowing before reading the payload:

- **`credited` is gone** — nothing is credited to a document any more.
  `paidAmount` became **`settled`**, Σ of the `against` references standing on
  the bill.
- **An `advance` or an `on-account` amount appears on a party's sheet for the
  first time.** Before P5c it could not be recorded at all; before this it was a
  party balance with nothing on any report naming it (§3.6).
- **`refundDue` is labelled *Owed Back***, because on a party who both buys and
  sells it is a receivable sitting inside a payable ledger rather than a refund.
  The direction is what is true in both readings.

#### The denominator — §P5c‑3's inherited warning, closed

`trx.paidAmount` was capped at, and `isPaid` decided by, `grandTotal`. The bill
half of the same settlement used what the voucher **posted**, so the two halves
of one operation had different denominators and differed by exactly the RCM tax
(D-52). P5c‑3 recorded this as the one thing it could not move on its own:
capping `paidAmount` below `grandTotal` leaves such a document part-paid for ever
unless `isPaid` learns the same rule. Both halves landed together —
`postedBillAmounts` is the figure, `paidStatusFor` is the rule, and the four
sites that needed it are the approve boundary, the restore replay,
`buildAllocation`'s create-time cap and `getDueInvoice`.

⚠️ **Read, never derived from the flag.** D-52 is forward-only: 15 of this
database's 19 flagged purchases carry the whole grand total on the party leg.
BUG-0069's sentence for the third time — *where a figure has been posted, read
the posting.*

⚠️⚠️ The change has **zero instances today** — no reverse-charge purchase has
been settled — so it is forward-only and the gate has to construct the case,
which it does through the save path (a draft, deleted) rather than through an
approval, because `ApprovalService.transition` commits its own transaction. The
gate says so rather than implying coverage it does not have.

#### What the gate measures, and how it was shown to fail

**16 properties, 16 passing.** The identity over every party ledger of every
company; the annexure holding exactly the register's open bills; **the annexure
and the entry grid naming the same bills**, asked from both sides — the
divergence this phase was ruled to close; the two reports partitioning the
parties and agreeing with the per-party sheets; the ageing buckets totalling the
ordinary side alone; no bill on both sides at once; the denominator on real
reverse-charge purchases and at two of its four sites; and the two arms this
database has no instance of — an **advance** reaching both surfaces, and a
cancellation taking its bill off the sheet — constructed in a transaction that is
always rolled back, exactly as P5b constructed `advance` and P5c‑3 the mixed
voucher.

Shown to fail three ways: ignoring the posting side (property 1, naming four
parties and both figures); dropping the unapplied arm from the read (11, 11b);
and putting the `grandTotal` denominator back (10 — which also **left a scratch
voucher behind**, caught by 10c, and the cleanup now sweeps by remark rather than
by the id only the accepted branch holds).

⚠️ **It found a real defect in this phase's own code rather than confirming it.**
`bill_references.voucherId` holds a `trx` id for a document bill and a
**`trx_payment_receipts`** id for an advance — two id spaces in one column — and
the annexure was passing it straight through as the row's `id`, which the SPA
opens as a voucher. `documentIdOfBill` is the fix, and it answers 0 for anything
a `trx` route cannot open, exactly as D-55's synthesised row already did.

#### Parity

**The diff is empty everywhere except the report that changed shape.**
`diff p5d-before p5d-after --rebased pendingBills` drops **237,252 paths** and
reports `PARITY HELD` — so the Trial Balance, the Balance Sheet, the P&L, the Day
Book, both registers, the books, every group statement, both Outstanding reads,
every party statement and summary, and the two cache censuses are **identical
across the change**. Re-basing is a statement about the tape measure and not an
allowance (§11): the annexure is not the same report on both sides, and the
movement it made is the 180 parties measured above rather than a list of paths.

#### Numbers

- `npm test` **1985/1985**, all five guards clean.
- `qa:p5d-annexure` **16/16**; `qa:p5-bill-register` **157/157**,
  `qa:p5b-register-maintenance` **9/9**, `qa:p5c-unapplied` **9/9**,
  `qa:p5c3-bill-settlement` **18/18** — every earlier gate unchanged by a phase
  that rewrites what reads the register.
- `qa:p1-group-tree` **56/56**, `qa:p3-ledger-report` **140/140**,
  `qa:p3b-statements` **323/323**, `qa:p2c-import-tree` **227/227**.
- `qa-artifacts` `tests/transactions/settlement.spec.ts` **21/21, from 9 failing
  on `main`** — and two of those nine were **stale P5c‑1 debt**: they asserted
  that a receipt naming no document is refused and that *"the app has no advance
  shape"*, both of which P5c‑1 deliberately made untrue and neither of which was
  updated with it.
- `npm run qa:reports` **207 passed / 4 failed**, from **202 / 9**. The three
  suites P5d touched are green: `party-statement.spec.ts` 16/16,
  `party-inventory-deltas.spec.ts` 7/7, `outstanding.spec.ts` 14/14. ⚠️ Four of
  the five recovered failures were **not** P5d's to begin with — they are the
  D3-fixture family the P3c‑1 record names, *"fixtures written before a party
  had one ledger on one side"*, and they came green because making a delta
  assertion sign-aware fixes both halves at once. The four that remain are the
  same family on the two dashboards (which read `partyPositions` and
  `customer-outstanding`, neither touched here) plus `main-dashboard`'s
  host-metrics property.
- `qa:money` — `bill-reference-grid.ui.spec.ts` + `voucher-entry.ui.spec.ts`
  **16/16**, and the per-screen sweep passes on both new routes and on the Party
  Statement. ⚠️ The two Outstanding screens were **UI-002 offenders** (money
  through `app-data-table`'s `type: 'number'`, which formats nothing); the
  reports that replaced them render `| number:'1.2-2'`, so that finding closes
  on those two routes as a side-effect rather than as a fix.

⚠️ **`qa:p2-ledgers` fails its property (2) at 332/1 — on `main`, before this
phase, with identical figures** (449 parties in the population, 422 planned and
applied). Verified by stashing. Not P5d's, and recorded here rather than fixed
because re-running `plan-party-ledgers` writes decisions this phase has no
business taking.

#### Three oracles moved, and one retired

`qa-artifacts` restates rules rather than importing them, so a change of
mechanism is a change of restatement:

- **`party-rules.ts` `partyBills`** now restates the **register** instead of
  D-18's document allocation — and it **checks itself against `journal_lines`
  before returning**, throwing in its own voice if the two disagree. A
  restatement built over the same table the report reads can agree with a defect
  in that table; §13's P2b‑3c variant, and the reason the check is inside the
  oracle rather than in a caller's diff.
- **R6 (`outstanding.spec.ts`) changed what answers it.** It held the ledger
  against the party's own DOCUMENTS, and that derivation cannot answer it any
  more: BUG-0069 is precisely that no rule over `trx` gets all nineteen
  reverse-charge purchases right, because D-52 is forward-only. It holds the
  ledger against the **open bills** now, which is the identity `bill_references`
  was built to make true.
- ⚠️ **The annexure's document-by-document comparison with `outstandingOracle`
  is retired**, and that is honest rather than a loss: the two are now different
  derivations of different things, and row for row they disagree by
  construction. What replaced it is the party's **net** against the ledger,
  which is the stronger statement and the one BUG-0040 asked for. The document
  oracle keeps its own tests.

#### What P6 inherits

- **`trx_groups`-era `vendorOutstanding` / `customerOutstanding` are still
  live.** Their screens are gone but the two reads are not, because the parity
  harness captures them and the Financial Dashboard's shape has not been
  revisited. They answer the same question as the new reports, from
  `journal_lines` rather than from the register, and the honest end state is one
  of the two — a decision that belongs with D9, when `trxGroupId` goes.
- **An `advance` can never be applied to a later bill.**
  `planSettlementReferences` only ever points an `against` row at a `new` bill,
  so an advance stands open for ever and the annexure lists it. Tally lets a
  later invoice be settled against one; that is a settlement-engine change, not a
  reporting one, and nothing in P5 promised it.

### P6 record — 2026-08-31

**The P&L became two statements, and Net Profit did not move by a paisa.** §3.8's
opening sentence turned out to be exactly right — *"Direct/Indirect is the split
that makes a Gross Profit line possible, and it arrives free with the group
hierarchy"* — and it is the whole of the phase's design. P1 seeded Tally's six
P&L primaries into all 14 companies in August; P6 is four `systemKey`s saying
which of the six sit above the line, and a report that draws the consequence.

| Artefact | What it is |
|---|---|
| `src/const/trading-account.const.ts` (+ 16 tests) | The rule. `TRADING_ACCOUNT_GROUP_KEYS` (four), `tradingPlacementFor`, `grossProfitLine` (the c/d and b/d columns, always opposite) and `netProfitFrom`. Dependency-free, no new column, no per-company setting. |
| `ReportsService.profitAndLoss` | Returns `tradingAccount`, `profitAndLossAccount` and `grossProfit` **beside** the fields it already returned, which are untouched. The books are filled in the one pass that builds the sections, so a section cannot land in a column and in neither book. |
| `TRX_GROUP_TARGET['CLOSING_STOCK_INCOME']` + migration `20260831000000` | `null` → `Direct Incomes`. 14 ledgers moved off the wrong side of the gross-profit line. |
| `client-front` `reports/profit-and-loss/` | Two stacked statements, each an ordinary `.report-columns` pair, with the carry-down and the result as **real rows** — so each statement adds up on the page. |
| `scripts/qa-p6-trading.ts` · `npm run qa:p6-trading` | The gate. **154/154** over 14 companies and 66 period-reports, shown to fail four ways. |

**Measured before the phase started**, as every phase since P2b‑3c has: 70 Direct
Expenses ledgers against 84 Indirect, 28 Sales and 28 Purchase, **0 Direct
Incomes** and **0 postings anywhere in Indirect Incomes**. So on this database
almost the entire book is the trade, and the second statement holds one figure —
which is worth knowing before reading a Trading Account that is nearly the whole
P&L.

#### The gate is the plan's own sentence, and it is not enough on its own

*"Net Profit after the split equals Net Profit before it, on every company and
every period."* That invariant is cheap to state and total in what it catches —
a section counted twice, a section counted in neither book, a gross profit that
does not feed the net — because the line is drawn **through** the same rows, so
the total cannot move.

What it cannot see is a section in the **wrong** book. Measured, not argued:
filing Purchase Accounts below the line moves ₹5.6 crore of company 28 and takes
its Gross Profit from **−₹2,15,93,857.04 to +₹3,46,60,542.68**, while Net Profit
stays right to the paisa and (1), (2), (3), (4), (6) and (7) all stay green. They
are invariants of *a* partition, and a wrong partition is still a partition.
Property (5a) — *the trading book holds exactly the four trading sections* — is
what fails.

#### 🐞 The first injection PASSED, and the gate was the defect

(5)'s oracle **imported `TRADING_ACCOUNT_GROUP_KEYS`**. So when the injection
removed Purchase Accounts from that constant, the oracle moved with it and
agreed. The aggregation had been restated in SQL; the *rule* had not, and the
rule was the thing under test.

That is §13's standing shape in the variant P2b‑3c filed — *a check that restates
the code by copying the code cannot fail* — and it is the third time this
programme has hit it (`qa-p2-ledgers` reading `trx_natures.name`, `return-rules.ts`
reading `trx_items` alone). The four are **restated by name** in the gate now,
because Tally's names are the stable thing: `tallyGroupKey` derives the
`systemKey` from them and nothing renames them.

⚠️ Worth separating two lessons that look alike. P5c‑1's is *"a passing injection
is a claim about the edit before it is a claim about the property"* — so the edit
was verified to have applied, and it had: the report really did move Purchase
Accounts below the line and print a ₹3.47 crore gross profit. The edit was fine;
the **oracle** was the problem.

#### The closing-stock head could not die, and finding that out is the ruling

§3.2 mapped `CLOSING_STOCK_INCOME` to `null` — *"dies with the Trading Account
(§3.8)"* — so D2's seed had nothing to parent its ledger by and fell through
`fallbackGroupForNature`, which for an Income nature answers **`Indirect
Incomes`**: the second statement, below the line.

Tally can retire it because its Balance Sheet reads the inventory subsystem
directly and shows closing stock on both statements with no voucher at all.
§3.10 commits this report layer to `journal_lines` **and nothing else**, so
`Dr Stock-in-Hand` has to be a posted leg for the sheet to show stock — and a
journal entry balances, so the credit exists whatever it is named. Deriving it
instead would also move Net Profit by the whole stock movement, which is the one
thing this phase's gate forbids. So P6 rules on **where the credit prints**, not
on whether it exists: `Direct Incomes`, inside the Trading Account, on its credit
side.

⚠️ **A line of its own — Tally's actual shape — was refused**, and the reason
generalises past this row: a figure inside a statement that is not the sum of a
group's subtree breaks the invariant `qa:p3b-statements` (5) exists to hold, and
a 29th group breaks §3.2's premise that the tree is Tally's 28.

⚠️⚠️ **It moved no figure, and that is why it was fixed now rather than later.**
`sourceType = 'closing-stock'` has **zero rows across all 14 companies** — the
mechanism has never been exercised once — so both closing-stock ledgers carry no
journal lines and every report answers identically either side of the migration.
The first company to run a close would have got an understated Gross Profit and a
correct Net Profit, found by a customer reading a Trading Account rather than by
a gate. Same reasoning as `20260828500000-ledger-nature-fallback-repair`, whose
33 misplaced ledgers were also all at `0.00`.

Which is exactly why property (10) **constructs** the case: a real close posted
in a rolled-back transaction, with Gross Profit *and* Net Profit each rising by
the valuation and the credit landing in the trading column. Put the ledger back
in Indirect Incomes and it reports the defect in full — *gross unchanged, net
rose, `indInc 0.00 → 1,23,456.78`*. A census over rows that do not exist asserts
nothing; this is P5b's `advance` arm and P5c‑3's mixed voucher a third time.

#### ✅ Open question 2 is closed, and nothing was built for it

*"Direct vs Indirect assignment (P6). A per-company review step with a guided
screen, or a defaulted mapping they can re-parent afterwards?"* — **defaults plus
re-parenting**, as the plan assumed, and both halves already existed.

What makes it work is a fact rather than a feature: **Direct ↔ Indirect is a
within-nature move.** Direct and Indirect Expenses are both Expense, Direct and
Indirect Incomes both Income — so `describeLedgerMoveBlock`, which refuses to
move a *posted* ledger across an account nature, permits every move this split
invites, postings and all, on the Chart of Accounts screen P3d‑2 built. Property
(9) asserts that instead of the plan claiming it, and asserts the cross-nature
refusal beside it so the permission is not vacuous.

#### 🐞 The statements' tree drew its figures left-aligned, on all three, since P3b

Found by reading the rendered page, which is where P4e‑2's second print defect
came from too. Every figure `app-statement-tree` draws — on the Trial Balance,
the Balance Sheet and the Profit & Loss — computed `text-align: start` in the
**body font**, sitting in the same column as the screens' own right-aligned mono
totals.

`app-statement-tree` lists `reports.shared.scss` among its `styleUrls` precisely
to avoid this, and its decorator says so. It cannot work, because Angular's
emulated encapsulation stamps **every** compound of a descendant chain rather
than only the last:

```
.report-table[_ngcontent-TREE]   .num[_ngcontent-TREE]     ← table is the caller's → ancestor misses
.report-table[_ngcontent-CALLER] .num[_ngcontent-CALLER]   ← cell is the tree's   → descendant misses
```

Neither copy can match a tree cell. It looked *nearly* right because
`statement-tree.scss` happens to re-declare the row weights and padding, which is
what kept it unnoticed for three phases — and it is a Trading Account that found
it, because a statement people add up by eye is where a mis-aligned column stops
being cosmetic. Hoisting `.num` and `td.num` **out of `.report-table`** leaves one
compound, which both copies stamp onto the element that carries the class: one
definition, reaching both. Measured after: 105 tree cells across the three
statements, 0 not right-aligned mono. ⚠️ This is the **second** encapsulation trap
in that file; the first, fifteen lines above, is about specificity.

#### The parity diff is empty, and the additions are declared

Captured before and after across all 14 companies: **0 changed, 0 removed, 6006
added** — every added path under `profitAndLoss.tradingAccount` (3780),
`profitAndLoss.profitAndLossAccount` (1932) or `profitAndLoss.grossProfit` (294),
and nothing else. Declared with `diff --rebased` on those three prefixes, which is
the honest instrument: an allowance is a statement about the **books** and no
figure moved; three new fields on a payload are a statement about the **tape
measure**. `PARITY HELD — the diff is empty.`

Every earlier gate re-run green: `qa:p1-group-tree` 56, `qa:p2c-import-tree` 227,
`qa:p3-ledger-report` 140, `qa:p3b-statements` 323, `qa:p5-bill-register` 157,
`qa:p5b` 9, `qa:p5c` 9, `qa:p5c3` 18, `qa:p5d-annexure` 16; `npm test` 2002/2002,
all five guards, `check-mirrors` in sync, `qa:money`'s report sweep 15/15 and axe
clean on all three statements.

#### ⚠️ One pre-existing failure, reproduced on `main` and left alone

`qa:p2-ledgers` (2) fails on company 28 — *"449 in population, 422 planned"*.
Reproduced with P6 stashed, so it is not this phase: 27 parties have acquired
ledgers on that QA scratch tenant since `party_ledger_plan` was written, and that
table is **deliberately frozen after D3** ([§P2a](#p2a-record--2026-08-28)), so
the population will keep drifting past it. Whether that property is still asking
an answerable question belongs to whoever owns D9, not to a Trading Account.

#### Two things P6 deliberately did NOT do

- **A negative section amount still prints negative.** Company 28's Direct
  Expenses reads `−73,150.00` on the Trading Account's debit side. It is the same
  figure the one-statement P&L printed, computed the same way, and moving it to
  the other column would change `totalExpense` and break the parity gate — so it
  is inherited, not introduced. Tally shows a net-credit expense group the same
  way. Worth a decision of its own; it is not this one.
- **No mirrored split on the frontend.** Nothing on the screen is disabled or
  refused by the rule and the payload arrives already partitioned, so a second
  copy could only drift. That is the opposite call from `voucher-lifecycle` and
  the ledger rules, where the mirror exists because a button's state has to match
  what the API will do.

#### What P7 inherits

- **Opening Stock has no line.** Tally's Trading Account opens with `Dr Opening
  Stock`; here the opening balance of Stock-in-Hand is a Balance Sheet figure and
  the Trading Account is a **period** report, so the two statements reconcile
  without it. Adding it means deciding whether the Trading Account gains an
  opening column at all — a shape question, not an arithmetic one.
- **`Direct Incomes` holds the closing-stock credit and nothing else** on all 14
  companies. The first company to run a close is the first reader of that row,
  and it will sit beside whatever direct income they book.

### P7a record — 2026-08-31

**The books gained a parallel dimension, and the general ledger does not know it
exists.** §2.4's design consequence is the whole of P7a's shape, and it is quoted
in the migration for a reason:

> Allocations must **not** be extra journal lines. That would double GL volume and
> put a second, weaker balancing rule into the engine.

So `journal_lines` is untouched and stays untouched at P7b — `cost_allocations`
will point **at** it. The parity diff across the whole phase is `PARITY HELD — the
diff is empty`, with nothing re-based and nothing declared.

| Artefact | What it is |
|---|---|
| `src/const/cost-allocation.const.ts` (+ 29 tests) | The rule. `costItemKindOf`, `applicableCategories`, `costAllocationProblems` (the per-category invariant, as sentences), the three `describe*Block` refusals, and the primary category's name and key. Dependency-free. |
| `src/entities/cost-category.entity.ts` · `cost-centre.entity.ts` | The two masters. The centre carries `acc_groups`' materialised, slash-terminated `path`. |
| Migration `20260831100000-cost-centres` | DDL, plus one `Primary Cost Category` per company — **14 seeded, one each**. Idempotent; re-running is a no-op. |
| `CompanyProvisioningService` step 5d | The same row for a company created tomorrow. |
| `CostCategoryService` · `CostCentreService` · `cost-centre.controller.ts` | **19 routes** over the two masters, one permission key (`cost-centres`), both under `LicensedModule.Transaction`. |
| `scripts/qa-p7a-cost-masters.ts` · `npm run qa:p7a-cost-masters` | The gate. **264/264** over 14 companies and 13 constructed allocation cases, shown to fail four ways. |

**Measured before the phase started**, as every phase since P2b‑3c has, and the
measurement decided the gate:

- `acc_ledgers.costCentresApplicable` is **`0` on all 1,383 ledgers of all 14
  companies**. The column has existed since `20260828100000-acc-ledgers`, whose
  own comment reads *"Reserved for P5 and P7 respectively. Written by the seed,
  read by nothing yet."* P7a is what reads it.
- There are **zero** cost centres and were **zero** cost categories.
- The real Tally Prime backup in `qa-artifacts/fixtures/tally` carries **exactly
  one** Cost Category — `Primary Cost Category`, `allocaterevenue: true`,
  `allocatenonrevenue: true` — **eleven** ledgers with *"cost centres are
  applicable"* switched on (Bank Charges, Freight & Forwarding, two Purchase
  heads, Salary and Wages, Sales Account, two vehicles…), and **no cost centres
  at all**. Its owner turned the switch on and never created a centre.

That last line is the phase in miniature: the feature has **no instance
anywhere**, so a census would report green over a mechanism that has never run
once.

#### The whole feature has no instance, so the gate constructs it

P5b's `advance` arm, P5c‑3's mixed voucher and P6's closing stock, a fourth
time — and by now it is less a discovery than a habit worth naming. Properties
(5) through (10) build, inside a **rolled-back** transaction per company: two
real categories through the real service (one revenue-only, one both), a real
two-level tree in the first and a root in the second, and then — the part the
world has never contained — `costCentresApplicable = 1` on a **real posted P&L
ledger**, so the invariant is asked about a journal line that exists rather than
about a fixture.

Property (0) then asserts nothing survived: `SELECT COUNT(*) … WHERE name LIKE
'QA·P7a%'` is 0 after every rollback. A committed scratch category is a row the
parity harness would capture and a `QA·P7a Department` sitting in a customer's
masters.

#### ⚠️ Σ **per category** — the rule, and why the gate restates it

Every cost centre belongs to exactly one category, and a business may have
several: *Department* and *Location* are two independent ways of cutting the same
expense, so a ₹1,69,400 purchase line is allocated **in full under each**. The
invariant is therefore stated once per category:

```
for each applicable category:  Σ allocation.amount  =  line.debit − line.credit
```

Summing across categories instead is the mistake the rule exists to prevent: four
rows totalling ₹3,38,800 against a ₹1,69,400 line is **correct**, and a whole-line
Σ reads it as a 100 % over-allocation. Property **(7c)** is that sentence measured
on a real line — Σ over *all* the rows is 2× the line and the invariant is quiet —
with **(7d)** computing the per-category sums in the gate rather than trusting the
rule's own arithmetic. P6's first injection passed because its oracle imported the
constant it was checking; that is §13's standing shape in P2b‑3c's variant, and
(7c)/(7d) are written the other way round on purpose.

⚠️⚠️ **It is signed, where the bill register's Σ compares magnitudes**, and the
two differ deliberately. A bill reference partitions what a party *owes* and both
directions genuinely occur on one ledger, so magnitude is the quantity being
partitioned. An allocation partitions the line's own net movement, and a credit
note against a department has to **reduce** that department's spend — so the sign
travels with the allocation and a Cost Centre Summary is a plain Σ with no
direction to reconstruct. The spec asserts the magnitude form would have accepted
a wrong-signed row.

#### It warns. It does not refuse.

§3.7: *"a partial or missing allocation is a warning on a reconciliation report,
not a refused save."* Nothing in `cost-allocation.const.ts` throws, and a test
asserts it — the same ruling and the same test `statutory-windows.const.ts`
carries for the three filing deadlines, for the same reason: refusing punishes an
operator for a fact about the *books* being incomplete, and silence means the
incompleteness is found by whoever reads the report months later.

⚠️ The *"missing"* half is what a lazier rule loses. A check that only looked at
rows that exist could never report the commonest incompleteness there is — a
switched-on ledger with no allocation at all — and property (7a) is that case,
reported with the ledger's name, the category's, and both figures. Injection 2
below is exactly that rule written lazily.

#### Which ledgers a category cuts is DERIVED, not listed again

`allocateRevenue` / `allocateNonRevenue` are Tally's two switches, and they
classify by **statement**: revenue is a Profit & Loss figure, non-revenue a
Balance Sheet one. `costItemKindOf` reads `ACCOUNT_NATURE_META[nature].statement`
rather than restating which natures are which — D-54's shape (`bookForAccountType`
— *"derived, so a new type cannot fall out of both"*), and a fifth account nature
would acquire a kind by having a statement rather than by anyone remembering this
file. A spec asserts every nature that exists resolves.

⚠️ **`null` in, `null` out.** `acc_groups.nature` is nullable for exactly two of
Tally's primaries — `Suspense A/c` and `Branch / Divisions`, which have no fixed
side of the books — and a ledger filed under one cannot be called revenue or
non-revenue without inventing the answer. It means *"no category applies"*, which
is the quiet, correct behaviour for a rule that only warns. It is not a default
waiting to be tidied in.

⚠️⚠️ And a category that allocates **neither** kind is refused at creation, in a
sentence: it would apply to no ledger, no allocation against it could ever be
reconciled, and every one would be reported as `NotApplicable` for ever. Better a
400 than a reconciliation report nobody can act on.

#### The trees have to be parallel, or the per-category Σ is not true

`describeCentrePlacementBlock` refuses a parent in another category, and this is
not tidiness. Every P7d report will roll a subtree up by `path` prefix **within
one category**, so a *location* hanging under a *department* would be collected by
a Department Summary with no business seeing it, and the two categories' totals
would overlap — which is the parallel-category invariant failing one level down
from where it is stated.

The tree itself is `acc_groups`' tree, and `materialised-path.const.ts` had
already said so in its own header: *"§3.7's `cost_centres` carries a `path` too,
for the same reason and with the same trap. One definition, one spec, two
callers."* P7a is the second caller — `buildPath`, `subtreePrefix`, `depthOf` and
`rebuildSubtreePaths` are all shared, so BUG-0023's dropped terminator has one
place to be got wrong rather than two.

⚠️ **A cost centre move is never refused for having posted**, unlike a group's
re-parent, and the difference is worth stating: a group's `nature` is denormalised
onto its whole subtree, so moving it re-signs figures already reported. A centre's
path carries no such copy, and re-organising departments between years is exactly
what a business does. Every allocation keeps naming the same centre and every
report simply rolls it up somewhere new — which is the truthful answer.

#### 🐞 Four injections, all caught, and one caught twice

| Injection | Caught by |
|---|---|
| Σ over **all** allocations instead of per category | (7b) and (7c), the second printing *"Σ all rows ₹3,38,800.00 vs line ₹1,69,400.00"* |
| Only check categories that **have rows** — the *"missing"* half dropped | (7a) and (7b) |
| The cross-category parent refusal removed | (9a) *"did not refuse at all"* — **and (9e)**, whose message counts the category's centres and read `3` where the property says `2` |
| `path` built by hand at the call site, terminator dropped | (5), printing `/137 · /137138 · /139` |

The third is the one worth keeping. (9e) asserts a refusal **against its own
sentence** — *"still holds 2 cost centres"* — so a defect three properties away
that changed how many centres exist failed it as a side effect. That is the
argument for matching the message rather than the throw, made by accident: a bare
`toThrow()` is satisfied by a 404 on a mistyped id, and it would also have been
satisfied here.

⚠️ Property **(2)** — every path terminated and agreeing with its own depth — did
**not** catch the fourth, and that is honest rather than a gap: it is a census
over committed rows, and there are none, so it is vacuous on today's data. (5) is
what exercises path construction, because (5) builds the tree.

#### Guard-rails tripped, and one that bit

Every one of §6's guards was hit and cleared: the scope registry (both entities
classified, with the sharp edge named — a centre list is a map of how a business
is organised), `company-hard-delete-order` (one edge, `cost_centres → cost_
categories`, plus the self-edge in `SELF_REFERENCING_NULL_OUT`; positions 33 and
34 of 122), the audit registries, the permission registry, `MODULE_BY_PERMISSION_
KEY`, the role matrix, and `ci-guard-body-dto`.

⚠️ **`ci-guard-raw-sql` failed on eight sites and seven of them were not P7a's.**
The allow-list is keyed by `path:line`, so the 25 lines P7a added to
`company-provisioning.service.ts` moved every entry below them — the exact trap
CLAUDE.md §14 records from 2026-08-26. Each of the seven was re-read at its new
line and still describes the statement now at it (the `companies` duplicate probe,
the `insert()` helper, `countries`, `states`, `users`-by-email, the `users` insert,
the `freeUsername` probe); the keys were re-pointed, not re-justified.

⚠️⚠️ **`check-mirrors.js` caught the frontend half**, which is what it is for:
`'cost-centres' is in client-back but missing from client-front`. The permission
key exists on the server a phase before any screen does — the order `acc-ledgers`
arrived in (P2b‑3b's 18 routes, P3d‑2's screen) — but the licence map is mirrored
in the same commit regardless, because a key on one side only is the drift the
check exists to catch.

#### The allocation delete guard is wired a phase before the table it protects

`describeCentreDeleteBlock` refuses erasing a centre that has been allocated to —
§4.9 rule 2 (*"a voucher that ever posted is never erased"*) one dimension across
— and `CostCentreService.remove` already calls it, with an `information_schema`
probe answering 0 until `cost_allocations` exists. That is deliberate and is
allow-listed with the argument: §13's standing shape is *one rule enforced at the
places somebody thought of*, and the place that gets forgotten is the delete
written a phase before its table.

#### What P7b inherits

- **The gate sentence.** *"Every Trial Balance figure is unchanged by the presence
  of allocations"* is only falsifiable once allocations exist. P7a's (6) is the
  same capture-either-side shape and will be the skeleton of P7b's.
- **`applicableCategories` is the seam.** It is the only reader of the two
  switches, and P7b's writer in `persistLines` asks it once per party-or-P&L line.
  Nothing else may ask them, or the answer acquires a second definition — BUG-0046's
  shape (a decision applied to every writer of a column and to none of its readers).
- **Nothing is switched on.** A company's first cost centre and its first
  `costCentresApplicable = 1` are both an operator's decision, and P7c is the
  screen where they make it. Until then P7b's writer runs over `applicableCategories`
  returning empty for every line in the world, which is a correct no-op and is
  also why P7b's gate must construct exactly as this one did.
- **No centres are seeded, deliberately** — the call `OPERATION_TYPES` and
  `HOLIDAYS` already make: a guessed *Head Office* / *Marketing* is live master
  data nobody chose, and here it would additionally start demanding allocations on
  every P&L line the moment a ledger's switch went on.

#### Everything else, re-run

`npm test` **2031/2031** (132 suites, was 2002); all five guards green; `npm run
build` and `lint:ci` clean in both repos; `check-mirrors` in sync;
`dump-routes` boots the real `AppModule` and lists **945** routes, 19 of them new.
Earlier gates: `qa:p1-group-tree` 56, `qa:p2c-import-tree` 227, `qa:p3-ledger-report`
140, `qa:p3b-statements` 323, `qa:p5-bill-register` 157, `qa:p5b` 9, `qa:p5c` 9,
`qa:p5c3` 18, `qa:p5d-annexure` 16, `qa:p6-trading` 154.

⚠️ **The one pre-existing failure is unchanged**: `qa:p2-ledgers` (2) on company
28 — *"449 in population, 422 planned"* — reproduced on `main` at P6 and recorded
there. `party_ledger_plan` is deliberately frozen after D3, so that population
keeps drifting past it; whether the property is still asking an answerable
question belongs to whoever owns D9.

### P7b record — 2026-09-01

**The parallel dimension has figures, and the general ledger still does not know
it exists.** §2.4's design consequence survived contact with the writer, which is
the only thing P7b was ever really being asked:

> Allocations must **not** be extra journal lines. That would double GL volume and
> put a second, weaker balancing rule into the engine.

`journal_lines` gained no column, no entry was re-posted, and the parity diff
across the whole phase is `PARITY HELD — the diff is empty`, with nothing
re-based and nothing declared.

| Artefact | What it is |
|---|---|
| `src/const/cost-allocation.const.ts` (+16 tests, 45 total) | P7a's rule, plus P7b's four: `CostAllocationOwnerType`, `signAllocationsForLeg`, `reverseAllocations`, `describeAllocationPayloadBlock`. Still dependency-free, still throws nothing. |
| `src/entities/cost-allocation.entity.ts` | The **posting's record** — signed, hanging off `journal_lines.id`. |
| `src/entities/trx-cost-allocation.entity.ts` | The **document's statement** — a positive share, keyed `(ownerType, ownerId)` over D6's four ledger holders. |
| Migration `20260901000000-cost-allocations` | Both tables. No backfill: nothing has ever been allocated. |
| `CostAllocationService` | `replaceForOwner` (the voucher's, with §4.3 rule 7 at the seam), `sharesForOwners` (the batch load), `writeForEntry` (the GL's). |
| `PostingService.writeCostAllocations` | The seam, called from `persistLines` beside the bill register. |
| `POST /cost-allocations/list` | The read-back. One new route (754 → **755**). |
| `scripts/qa-p7b-cost-allocations.ts` · `npm run qa:p7b-cost-allocations` | The gate. **139/139** over 14 companies, shown to fail **six** ways. |

**Measured before the phase started**, as every phase since P2b‑3c has, and it is
P7a's measurement unchanged — which is the point rather than an oversight:

- `costCentresApplicable` is still **`0` on all 1,383 ledgers of all 14
  companies**, `cost_centres` still holds **zero** rows, and both new tables start
  and end empty. P7b changes none of that on purpose: switching a ledger on is an
  operator's decision and **P7c is the screen where they make it**.
- So the writer runs over `applicableCategories` returning empty for every line in
  the world — a correct no-op — and the gate **constructs everything it
  measures**. P5b's `advance` arm, P5c‑3's mixed voucher, P6's closing stock and
  P7a's whole gate, a fifth time.

#### Two tables, because a draft has no journal line

§3.7 puts `cost_allocations` on `journal_lines.id` and that is not negotiable —
§2.4 is why. But a voucher **posts at approval**, and editing an approved voucher
reverses the GL and supersedes the row with a draft that has to be re-approved
(§4.9, BUG-0028). An allocation typed during entry therefore has to survive three
states in which no journal line for it exists.

So the pair is exactly the pair P5 already ships, for the identical reason:

| | The document's statement | The posting's record |
|---|---|---|
| bills | `trx_payment_receipt_trxs` | `bill_references` |
| cost | `trx_cost_allocations` | `cost_allocations` |

The first is what a person edits; the second is what a report reads;
`persistLines` is the one place the first becomes the second.

#### The owner set is a RULE, not a list somebody wrote down

`trx_cost_allocations` is keyed `(ownerType, ownerId)` over **D6's four
`ledgerId` holders** — `trx`, `trx_charges`, `trx_payment_receipts`,
`trx_payment_receipt_lines` — and the set is derived from a question rather than
enumerated: *an allocation is a statement about a ledger's amount on a document,
so a row that names no ledger has nothing to allocate.* A fifth holder added later
inherits the surface by being asked the same question.

Two consequences worth carrying:

- **The allocation is on the voucher's HEAD, never on its item lines.** A
  `trx_items` row names a product and never a ledger — P4c measured that, and it
  is why an Accounting Invoice needed `trx_charges` rather than the item grid
  (P4e‑1). Tally allocates the ledger entry for the same reason.
- ⚠️ **`ownerId` carries no foreign key**, because its owner is one of four
  tables. That is `journal_entries.sourceType`/`sourceId`'s own idiom, and the
  cost is real: nothing at the database level clears an orphan, so the owner's own
  writer replaces the rows and `company-hard-delete-order.const.ts` carries the
  table before all four owners. It also makes the tenant column **load-bearing in
  a way it usually is not** — with no FK, `companyId` is the only thing standing
  between one company's owner id and another's rows, which is why
  `sharesForOwners` binds it and filters the `IN × IN` cross product back down to
  the pairs actually asked for.

#### ⚠️ The sign is the LEG's, and that is what makes a reversal free

The wire carries a **magnitude**: a voucher says *"₹6,000 of this ₹10,000 belongs
to North"*, and which side that lands on is `buildLegs`' answer, not a person's.
`signAllocationsForLeg` applies it in `persistLines`.

Three things fall out of one decision, which is the argument for it:

- A **sales** head is a credit leg, so the same positive share posts `−500` —
  gate property (5), which drives a real sales voucher through the whole path
  rather than asserting the pure rule twice.
- A **negative charge** (a data-import rounding adjustment) is flipped to the
  opposite side by `resolveLegs`; its allocation flips with it, because the side
  is read off the leg that was actually built.
- A **reversal** is the opposite side of the same figure, so negating the
  original's rows is the whole rule. No second derivation, and no `describe*` of
  its own.

#### ⚠️⚠️ A reversal NEGATES; it does not retire — and that is the opposite of P5b

This is the one place the cost dimension deliberately parts company with the bill
register, and the difference is the sign.

A bill reference carries a **magnitude**, so a reference left on a cancelled
entry breaks `Σ|ref| = |line|` on a dead line — it has to be **retired**
(P5b, and `qa-p5-bill-register` (2) refuses the alternative). An allocation is
**signed**, so the reversal's own negated rows cancel the original's. Which buys
something the retiring version does not:

> **A gross Σ over `cost_allocations` that forgot `liveEntrySql` is still right.**

That is BUG-0044's lesson — *the rule only bites on a GROSS figure; a signed sum
cancels the pair by itself* — applied in a new dimension **before** it can be
repeated there. Gate property (7) is that sentence as a test: it sums by centre
over both entries with no live-entry filter at all and asserts exactly zero.

The negated rows are **copied from the original line**, never re-derived from the
voucher — `journal_lines.ledgerId`'s own ruling (*"a reversal has to cancel where
the original landed"*), because re-deriving answers differently the moment
somebody edits the allocation panel after cancelling.

#### The two entries' lines are paired by position, and the assumption is CHECKED

`reverseSource` builds one opposite leg per line of the original and
`persistLines` inserts them in leg order in one statement, so the two entries'
lines correspond position by position. P7b makes that a fact rather than a hope in
two places: `reverseSource`'s include is now **ordered by id** (it was unordered,
and nothing had depended on it before), and the pairing additionally requires the
two lines' `ledgerId` to match — a reversal carries its original's ledger verbatim
(D6), so a pair that disagrees is a pair that did not line up, and the row is
**skipped rather than written against somebody else's cost centre**. Silence beats
a confident wrong figure in a dimension nothing else reconciles.

#### It still warns. It still does not refuse. But a malformed payload is refused.

§3.7's ruling is unchanged and P7b had to draw the line it implies, because the
two halves look alike:

| | | |
|---|---|---|
| the **books** are incomplete | a partial or missing allocation | `costAllocationProblems` — a **warning**, read by P7d |
| the **payload** is malformed | a centre in another category, another company's centre, a negative share | `describeAllocationPayloadBlock` — **refused**, in a sentence |

A partial allocation is a fact about the books and refusing it punishes an
operator for one. A row naming a real centre under the wrong category is a
mistake, and storing it in silence puts a figure into every P7d report under a
partition it does not belong to, reconciling against nothing — BUG-0040's shape,
which this programme keeps closing. `describeAllocationPayloadBlock`'s spec
asserts that a ₹1 allocation of a ₹10,000 row goes straight through, so the
distinction cannot be collapsed by accident.

⚠️ **The foreign key is a backstop and its sentence is not one a person reads.**
Injection 4 removed the check and the *database* refused a stranger's centre —
with *"Cannot add or update a child row: a foreign key constraint fails
(`jayhind_client_development`.`trx_cost_allocations`, CONSTRAINT
`fk_trx_cost_allocations_centre` …)"*. That is API-023's exact shape. The guard is
what turns it into *"Cost centre #N is not one of this company's."*

#### ⚠️ There is deliberately NO unique index on (line, category, centre)

`CostAllocationProblemKind.Duplicate` is one of the three arms
`costAllocationProblems` reports. A unique index would make that arm
**unreachable** — a rule carrying a branch nothing can produce, which is §6.4's
*"a mirror rule that cannot fail reads as coverage"* inverted — and it would also
reverse §3.7's ruling in the one place nobody would look. Two rows summing to the
right figure are untidy, not wrong; the report says so and P7c is where a person
tidies it.

#### 🐞 The raw-SQL guard was passing on an exemption that described nothing

P7a wired `describeCentreDeleteBlock`'s allocation count a phase early, behind an
`information_schema` probe for a table that did not exist yet, and allow-listed
that probe as `cost-centre.service.ts:266`. P7b deleted the probe — the table is
here — and **the guard went on passing**, with a justification naming no query at
all.

CLAUDE.md §14 already records the first half of this trap (*"a new query can land
on an allow-listed line and inherit a justification written for a different
statement"*). This is the second half, and it is the same defect: the allow-list
is keyed `path:line`, which is a **coordinate rather than a statement**.

`findStaleAllowlistKeys` now fails `npm run guards` on any key that names no raw
SQL call — a file that is gone, a line that is not a call, an entry that drifted
off its own query. It is the argument this programme already makes elsewhere in
its own words: the parity harness's `judge()` **fails an unmet allowance**,
because a list claiming a movement that did not happen describes a migration that
did not happen. An allow-list nobody prunes is one whose keys have stopped meaning
what they say, and it degrades silently into cover for the next query to land on
one of those lines. Five tests, one of which runs the check over the **real**
allow-list so it cannot pass by seeing an empty one.

#### The delete guard now counts BOTH tables, and the second is the one that bites

`describeCentreDeleteBlock`'s allocation count spans `cost_allocations` **and**
`trx_cost_allocations`. A centre named only by an unapproved draft has moved no
figure and is still a centre somebody is using: erasing it would leave that draft
pointing at nothing and surface the failure as a foreign-key error at approval,
weeks later, on a screen that has no idea what a cost centre is. Gate property
(11) constructs exactly that case.

#### The read-back is not P7c's, and leaving it out would have lost data

`POST /cost-allocations/list` ships here rather than with the screen, because
`TrxWriteService` **destroys and rebuilds a voucher's `trx_charges` rows on every
save**. Their ids change; a form that could not read a charge's allocations back
would send none, and the charge's cost centres would vanish on any edit with
nothing saying so. That is P5c‑2's own find (a bill ticked before a search was
silently dropped from the payload) one phase across, and gate property (10) is it.

`@SharedRead({ parties: false })`, not the `cost-centres` key: the entry screen is
not the masters screen, and gating it there would make a company grant the masters
to everyone who types an invoice. A **trading party** is refused — what a
supplier's invoice was allocated to is this company's cost structure, which is
D-46's question answered no.

#### The gate, and the six injections

**139/139** over 14 companies (4 of them have no purchase voucher to model one on
and say so rather than reporting green over nothing). Twelve properties; (3) is
the plan's own gate sentence, and it is the one that could only become falsifiable
here — P7a could ask it of the *masters*, where creating a category moving nothing
is barely a claim.

⚠️ **(3) is written as a deletion, not as a comparison across the posting.** The
voucher itself moves figures, obviously and correctly; what must move nothing is
the **allocations**. So the three statements are captured with the allocation rows
present, the rows are deleted inside the same transaction, and all three are
captured again — `0 changed` is then a statement about the allocations alone. And
it asserts `allocRows.length > 0` beside it, so it cannot pass by there having
been nothing to delete.

⚠️⚠️ **Every Σ is taken in the gate**, never by calling the rule. P6's first
injection passed because its oracle imported the constant it was checking — §13's
standing shape in P2b‑3c's variant, *a check that restates the code by copying the
code cannot fail*. (6) adds the rows up per category here, from what the engine
actually wrote.

| # | Injection | Caught by |
|---|---|---|
| 1 | the sign is the operator's, not the leg's (`sign = 1`) | (5) |
| 2 | a reversal records nothing, like a bill reference | (7) — `#185=600.00×1 · #186=400.00×1 · #187=1,200.00×2` |
| 3 | the head's allocations ride **every** leg, not just Main | (5) and (8) |
| 4 | the payload check removed | (9a) as a raw MySQL FK message, (9b) and (9c) *"did not refuse at all"* |
| 5 | `persistLines` does not call the seam | (3), (5), (6), (7), (8) — five at once |
| 6 | **the Trial Balance reads `cost_allocations`** — §2.4's actual violation | (3), naming three moved figures to the paisa |

Injection 6 is the one that matters: it is the defect the whole phase is a
promise about, and (3) named `tb/148[0] 5,09,70,684.08→5,09,70,484.08` rather
than reporting a total that still balanced.

#### Parity

`capture p7b-before` on `main`, `capture p7b-after` on the branch, `diff`:
**`PARITY HELD — the diff is empty`**. Nothing re-based, nothing declared. P7b
adds a table, a route and a writer that does nothing on any existing row.

#### Everything else, re-run

`npm test` **2052/2052** (132 suites, was 2031); all five guards green — including
the new stale-allow-list check; `npm run build` and `lint:ci` clean;
`check-mirrors` in sync (no new key: `cost-centres` is P7a's and already mirrored);
`dump-routes` boots the real `AppModule` and lists **755** routes, one of them new.
Earlier gates: `qa:p1-group-tree` 56, `qa:p2c-import-tree` 227,
`qa:p3-ledger-report` 140, `qa:p3b-statements` 323, `qa:p5-bill-register` 157,
`qa:p5b` 9, `qa:p5c` 9, `qa:p5c3` 18, `qa:p5d-annexure` 16, `qa:p6-trading` 154,
`qa:p7a-cost-masters` 264.

⚠️ **The one pre-existing failure is unchanged and at identical numbers**:
`qa:p2-ledgers` (2) on company 28 — *"449 in population, 422 planned"* —
reproduced on `main` at P6 and recorded at P7a. `party_ledger_plan` is frozen
after D3, so that population keeps drifting past it; whether the property is still
asking an answerable question belongs to whoever owns D9.

#### What P7c inherits

- **Everything is switched off, and P7c is where that changes.** A company's first
  cost centre and its first `costCentresApplicable = 1` are both an operator's
  decision. Until one is made, every property P7b built runs over an empty set —
  correctly, and invisibly.
- **The panel's two calls already exist**: `GET /cost-categories/list` +
  `GET /cost-centres/tree` to populate it, `POST /cost-allocations/list` to
  rehydrate a saved voucher. What P7c adds is the surface and the **cost centre
  class** (Tally's percentage template), which is a third table and a rule that
  expands a name into shares — and which must expand into the same
  `CostAllocationShare[]` the wire already carries, not into a second payload
  shape.
- ⚠️ **The warning has no reader yet.** `costAllocationProblems` is called by
  nothing in the product: P7d's reconciliation report is where §3.7's *"a warning
  on a reconciliation report"* actually becomes a report. Until then an incomplete
  allocation is stored, correct, and silent — which is the ruling working as
  written, not a gap.
- ⚠️⚠️ **A per-item split would need its own owner type.** The allocation is on the
  voucher's head; `trx_items` names a product and no ledger. If that is ever
  wanted it is a fifth `CostAllocationOwnerType` and a different question about
  what is being partitioned — not a widening of this one.

### P7c‑1 record — 2026-09-01

**The cost dimension has Tally's percentage template, and it is a stencil rather
than a fact about any voucher.** §2.4 states the whole feature in one sentence —
*"a cost centre class pre-defines a percentage split so an operator picks one
name and the allocation happens automatically"* — and P7c‑1 is that sentence
plus the one rule that makes such a template safe to store.

| Artefact | What it is |
|---|---|
| `src/const/cost-centre-class.const.ts` (+25 tests) | The rule: `expandCostCentreClass`, `describeClassLinesBlock`, `describeClassDeleteBlock`, `describeExpansion`, `CLASS_PERCENT_TOTAL`. Dependency-free; imports exactly one thing from `cost-allocation.const.ts` — the `CostAllocationShare` the wire already carries. |
| `src/entities/cost-centre-class.entity.ts` · `…-line.entity.ts` | The template and its split. |
| Migration `20260901100000-cost-centre-classes` | Both tables. **No seed** — Tally ships no class and neither do we (`OPERATION_TYPES`' own call). |
| `CostCentreClassService` | `assertSplitIsOurs` (§4.3 rule 7 + the rule, at the one seam), `writeLines` (wholesale), `list` (the panel's feed, lines included). |
| `CostCentreClassController` | Nine routes under the **existing** `cost-centres` key (755 → **764**). |
| `describeCentreDeleteBlock`'s third count | P7a's guard, extended: a centre a class names is refused. |
| `scripts/qa-p7c-cost-classes.ts` · `npm run qa:p7c-cost-classes` | The gate. **307/307** over 14 companies, shown to fail **seven** ways. |

#### P7c split into three, on the argument the five splits before it used

An `[M]` here is three separable claims — the table, then the screens, then the
screen that consumes them — and the one thing this programme has learned about a
phase larger than its gate is that the gate written at the end covers what the
author remembers.

| | | |
|---|---|---|
| **P7c‑1** | Cost centre classes: the tables, the expansion rule, the masters API | **done** |
| **P7c‑2** | The masters screen — categories · the centre tree · classes | **done** |
| **P7c‑3** | The entry screen's allocation panel and the mirrored expansion | split again at P7c‑3 — see below |

⚠️ `check-mirrors` **check 13 landed at P7c‑2** rather than here: the masters
screen needed the six refusals mirrored, so the check that compares them had to
exist for it. P7c‑3 adds the two rules the *voucher* needs to the same table.

⚠️⚠️ And P7c‑3 split again once measured, on this table's own argument. The panel
has **four** hosts — the Dr/Cr grid's header head and its N-line rows, then the
item form's own head and each of its charge rows — and the second pair is a
re-hosting of a component the first pair builds, which is exactly P4b→P4c's seam.

| | | |
|---|---|---|
| **P7c‑3a** | The Dr/Cr surface (a Journal's header head and its N lines), the mirrored expansion, the wire | **done** |
| **P7c‑3b** | The item form — the voucher's own head, and each charge row | **done** |

The order is P5's and P7's own: *the table, then the engine that maintains it,
then the screens*, because every earlier link is what the next one's gate ties
to.

#### A class is a STENCIL — the voucher does not store which one was used

This is the phase's central ruling and everything else follows from it.

The entry screen expands a class into the `trx_cost_allocations` rows the
voucher already carries, the operator sees those rows and may edit them, and
**what is saved is the rows**. Storing the class id beside them would be two
statements about one split that come apart the moment somebody edits the class:
a voucher entered last March would be *reported* as one split and *re-expand* as
another, with nothing to say which was true. That is `invoiceBodyOf`'s ruling one
phase across — *"a saved voucher reopens in the body its own rows imply, because
there is no stored mode to disagree with them"*.

Three consequences, and the third is the one that surprises:

- **Nothing points at a class**, so `describeClassDeleteBlock` returns `null`
  unconditionally. It exists to say so rather than to be called, and its spec
  asserts it — the opposite of `describeCentreDeleteBlock`, where a centre that
  has been allocated to **is** history and archives.
- **Editing a class moves no figure already allocated.** Gate property (12).
- **The expansion has no server-side product caller until P7c‑3**, and this
  record says so rather than implying coverage — P7b's own honesty about
  `costAllocationProblems` having no reader yet. It ships here because it is one
  statement with the write rule (below), and because a gate can only exercise
  what is in its own repo. The frontend half and `check-mirrors` check 13 land
  with the panel that calls them.

#### The two halves are one statement about the same numbers

`describeClassLinesBlock` refuses a class whose percentages do not total 100
**within each category**; `expandCostCentreClass` turns those percentages into
rupees. They are in one file because a class is storable *exactly when* it can
expand to the whole of a figure, and the expansion is exact *because* the write
rule refused everything else.

⚠️ **Per category, not per class** — `cost-allocation.const.ts`' parallel rule,
inherited. A class naming *Department* centres and *Location* centres totals 200,
and demanding 100 of the whole class is what would make every two-category class
unstorable.

⚠️⚠️ **A class is refused where an allocation only warns, and that does not
reverse §3.7.** *"A partial or missing allocation is a warning on a
reconciliation report, not a refused save"* is about the **books** being
incomplete, and it is untouched: a voucher allocating ₹8,000 of a ₹10,000 line
still saves. A class is a **definition**, written once, away from any voucher —
and one that totals 90 % can never produce a complete allocation, so accepting it
means every voucher entered with it warns, at a screen with no way to show the
operator why. Refusing the master refuses a mistake; refusing the voucher would
punish somebody for a fact.

#### ⚠️ The rounding IS the function, and the obvious algorithm is wrong twice

A third of ₹1,000 three ways is `333.33 × 3 = 999.99`. A paisa lost here is not
cosmetic — it is a `costAllocationProblems` coverage warning on **every voucher
the class is ever used on**, which is precisely what the class was bought to
avoid.

So it is the **largest-remainder method in integer paisa**: floor each line, then
hand the leftover paisa out one at a time, largest fractional remainder first,
ties broken by the given order. Two properties fall out and both are
load-bearing — `Σ` per category is exact, and **no share is ever negative**,
because every share is its own floor plus at most one paisa.

⚠️ The alternative that reads as obviously equivalent — round each line, then
correct the largest by the residual — fails the second: ten lines of 10 % on
₹0.05 round to a paisa each, and the residual `−0.05` takes the largest to
`−0.04`, which `describeAllocationPayloadBlock` refuses. **A class that made its
own voucher unsavable.**

⚠️⚠️ **A share that rounds to nothing is dropped, not written**, for the same
reason: the payload rule refuses a non-positive share, so a 0.4 % line of ₹1 must
not become a row. `Σ` stays exact because the paisa it did not get went to a line
that did.

⚠️ **The denominator is 100, never the lines' own sum.** Normalising a class that
totals 90 would silently complete it and disagree with the write rule that
refuses it. The category's own stated total is what the leftover is distributed
against, so a class that somehow got stored broken under-allocates **visibly** —
which is the honest answer, and which the first cut of this function got wrong
(it handed the missing tenth out as "rounding", one paisa per line).

#### `describeCentreDeleteBlock` now asks three questions, and they are different questions

An allocation is **history**, so a centre that has one archives (§4.9 rule 2, one
dimension across). A class line is a **share of a template**, so a centre a class
names is **refused** — because it is fixable: take the centre out of the class,
which is one edit on the screen the class was written on. Two refusals that read
the same would send somebody to the wrong screen, so they are counted and worded
separately, and the order is the one somebody can act in: children, then classes,
then allocations.

The count joins on the class's own `deletedAt`: an archived class offers nothing
to anybody and must not go on holding a centre hostage. Gate (10) is that
sentence from the other side.

#### 🐞 A refusal is not a rollback inside a caller's transaction

Found by this phase's own gate, and it is worth carrying past P7.

`create` and `update` accept `{ transaction: tx }` — every service here does, so
a caller can compose. Inside somebody else's transaction there is **no
savepoint**: the first version inserted the class header, then judged the split,
so a refusal left the header behind. The gate's next five refusal properties were
all answered *"a cost centre class called … already exists"* instead of the
sentence they were about.

Through the controller it is invisible, because there the service opens its own
transaction and the throw rolls the whole thing back — which is exactly the shape
that survives review. **Judge the payload before writing anything**, and the gate
that composes several writes into one transaction is what notices.

#### The gate, and the seven injections

**307/307** over 14 companies and 13 end-to-end cases (one company has no posted
P&L line and says *skipped* rather than reporting green over nothing). Twelve
properties; (5) is the phase's claim end to end — a real posted line, a real
class, the expansion driven through `CostAllocationService.replaceForOwner`, read
back through the loader the entry screen will use, signed the way `persistLines`
signs it, and put to `costAllocationProblems`, which is **quiet**. Anything short
of that asserts the pure rule twice.

⚠️ **Every Σ is taken in the gate**, never by calling the rule — P6's first
injection's lesson, and P2b‑3c's variant of §13's standing shape.

⚠️⚠️ **And a paisa of slack cannot see a paisa of error.** (3) first used the
`near` every other figure comparison in this programme uses, and **injection 1
passed**: rounding each line on its own turns 70/30 of ₹0.05 into ₹0.06, and
`|0.06 − 0.05| < 0.011`. The expansion's whole reason to exist is that it needs
no tolerance, so (3) and (5c) compare **integer paisa with `===`**. A tolerance
inherited from the surrounding code is how a check comes to be unable to fail —
this file's own version of *a check that restates the code by copying the code*.

⚠️ **A three-way split cannot tell the rounding algorithms apart**, either.
Injection 2 passed the first gate: the negative-share failure needs enough lines
that Σ of the roundings can overshoot the largest one, which is `n² / 2` paisa.
The gate builds a **ten-way even split** for (3) and (4) — a company with ten
branches, which is also the realistic template.

| # | Injection | Caught by |
|---|---|---|
| 1 | round each line on its own, no remainder distribution | (3) — `0.05 → 0.06`, `0.05 → 0.10` |
| 2 | round, then dump the whole residual on the largest share | (3) — `0.05 → 0.09` on the ten-way |
| 3 | the 100 % total taken over the whole class, not per category | the constructed two-category class is refused: *"allocates 200% of a figure across …"* |
| 4 | the per-category total check removed altogether | (7a) *"did not refuse at all"*, and six more behind it |
| 5 | the class-line count never asked in the delete guard | (9a), (9b) — and (10) as a **raw MySQL foreign-key message**, API-023's shape, which is the argument for the guard |
| 6 | the split judged **after** the header row is written | (7b)–(7f), (8) — the defect above, re-injected |
| 7 | the ownership load stops binding `companyId` | (8) — and it came back as the **wrong sentence** (*"is not a cost centre of Department"* instead of *"not one of this company's"*), which a bare `toThrow()` would have passed |

Injection 7 is the one to keep: with the tenant bind gone the stranger's centre
**resolved**, so the refusal was still a refusal and still wrong. Matching the
message rather than the throw is what saw it.

#### Parity

`capture p7c-before` with the change stashed, `capture p7c-after` with it
applied, `diff`: **`PARITY HELD — the diff is empty`**. Nothing re-based, nothing
declared. P7c‑1 adds two tables nothing reads and nine routes nothing calls yet.

#### Everything else, re-run

`npm test` **2079/2079** (133 suites, was 2052/132); all five guards green;
`npm run build` and `lint:ci` clean; `check-mirrors` in sync (no new key —
`cost-centres` is P7a's); `dump-routes` boots the real `AppModule` and lists
**764** routes, nine of them new. Earlier gates: `qa:p1-group-tree` 56,
`qa:p2c-import-tree` 227, `qa:p3-ledger-report` 140, `qa:p3b-statements` 323,
`qa:p5-bill-register` 157, `qa:p5b` 9, `qa:p5c` 9, `qa:p5c3` 18,
`qa:p5d-annexure` 16, `qa:p6-trading` 154, `qa:p7a-cost-masters` 264,
`qa:p7b-cost-allocations` 139.

⚠️ **The one pre-existing failure is unchanged and at identical numbers**:
`qa:p2-ledgers` (2) on company 28 — *"449 in population, 422 planned"* —
reproduced on `main` at P6 and recorded at P7a and P7b. `party_ledger_plan` is
frozen after D3.

#### What P7c‑2 and P7c‑3 inherit

- **Everything is still switched off.** `costCentresApplicable` is `0` on all
  1,383 ledgers, `cost_centres` and `cost_centre_classes` are empty, and the real
  Tally backup has one category, eleven switched-on ledgers and **no centres and
  no classes**. The ledger's own switch already has a screen — the Chart of
  Accounts' ledger form carries it since P7a — so what P7c‑2 adds is the masters
  themselves.
- **The panel's three calls all exist**: `GET /cost-categories/list`,
  `GET /cost-centres/tree`, `GET /cost-centre-classes/list` (with the split), and
  `POST /cost-allocations/list` to rehydrate a saved voucher.
- ⚠️ **`expandCostCentreClass` must be mirrored, not re-derived.** P7c‑3's panel
  is its first caller and the mirror is the check that keeps the figure on screen
  equal to the figure that is saved — `planBillSettlement`'s own shape
  (`check-mirrors` check 12), and the reason this rule sits in a dependency-free
  const that can be bundled.
- ⚠️⚠️ **The warning still has no reader.** `costAllocationProblems` is called by
  nothing in the product; P7d's reconciliation report is where §3.7's *"a warning
  on a reconciliation report"* becomes one.

### P7c‑2 record — 2026-09-01

**The cost dimension has a screen.** `/transaction/masters/cost-centres` — the
categories beside the selected category's centre **tree**, and the percentage
**classes** on a second tab — and every rule the API refuses is refused there
too, in the API's own sentence. P3d‑2's gate, one master across.

| Artefact | What it is |
|---|---|
| `client-front` `components/admin/transaction/cost-centres/` | The screen and its four dialogs: `category-add-edit`, `centre-add-edit`, `centre-move-dialog`, `class-add-edit`, plus `centre-options.ts` (the tree as a picker). |
| `client-front/src/utils/cost-rules.util.ts` | The six `describe*Block` refusals, mirrored. The **wording** is the mirrored thing. |
| `scripts/vectors/cost-rules.vectors.json` + `check-mirrors.js` **check 13** | The shared table and the check that runs both implementations against it — **117 comparisons over 32 region cases**, message text compared. |
| `client-front` `api-call.ts` · `trx-interfaces.ts` · `navigation.config.ts` · `masters.routes.ts` · `masters-layout.ts` | Twelve calls, three interfaces, the nav leaf, the route, the Masters sub-nav tab. |
| `styles/custom/_master-dialog.scss` | Was `_coa-dialog.scss`. Renamed, not copied — see below. |
| `qa-artifacts/tests/ui/masters/cost-centres.ui.spec.ts` + `cost-rules.ts` | The gate, and the sentences restated a third time. **6/6**, shown to fail **four** ways. |

**The backend is untouched.** Not one file under `jayhind-client-back` changed:
P7c‑1 had already shipped the nine routes and both `describe*Block` families, and
every count the screen's refusals name was already on a payload it reads.

#### ⚠️ The feature has no instance, so CONSTRUCTION is the first property

P7a, P7b and P7c‑1 each recorded the same measurement — `costCentresApplicable`
is `0` on all 1,383 ledgers of all 14 companies, `cost_centres` is empty,
`cost_centre_classes` is empty, and even the real Tally backup has no centre at
all. There is nothing here to read.

That inverts the Chart of Accounts gate's shape. P3d‑2 added its round trip
**last**, deliberately, because four refusal properties all pass on a screen whose
Create button is broken (BUG-0068 had just shown that is not hypothetical). Here
the round trip is **first and load-bearing**: everything the five refusal
properties are asked about — a category, a two-level tree, a class — is built
through the dialogs in the test that measures it, so a broken Create fails all
six.

#### Five refusals are the browser's, one is the server's, and the split is stated as a rule

The browser has every fact for five of the six: a centre's category and `path`
come from `GET /cost-centres/tree`, its `childCount` rides on the node (P7a put it
there for this rule by name), a category's centre count is that same tree counted,
and **the number of classes naming a centre is exact** because
`GET /cost-centre-classes/list` returns every class *with its split*. Those five
are refused with **no request leaving the page**, and the gate counts the requests
— a 400 caught and toasted looks identical on screen.

⚠️ `allocationCount` is the server's, and the mirror passes **`null`** for it:
*"not known here"*. P3d‑2's `hasPostings` ruling, unchanged — a *"this has
allocations"* refusal that is sometimes wrong teaches an operator to ignore
refusals. The vector table states that equivalence with a `null` row of its own,
because *both sides answer "allowed" when the fact is absent* is a rule rather
than an accident of two signatures, and injecting the "helpful" guess
(`allocationCount ?? 1`) fails check 13.

⚠️⚠️ **The gate measures that arm in the only direction available to it**: after
the class refusal is met and its own alternative carried out (*"remove it from
that class first"*), the delete **goes** — one request, counted. A browser
guessing at an unknown allocation count would have pre-empted it. Reaching the
refusal itself needs a posted allocation, which is `qa:p7a-cost-masters` (10) and
`qa:p7b-cost-allocations`' job; the spec says so rather than implying coverage.

#### The class editor refuses while somebody types, which is why the WORDING is mirrored

A split is built a row at a time and is **incomplete for most of the time it is
being edited**, so a refusal that only arrived on Save would fire once for every
keystroke nobody has typed yet. `describeClassLinesBlock` runs on every change and
the sentence sits under the rows it is about.

⚠️ A line whose two pickers are still empty is deliberately **not** put to the
rule: an unfinished row is not a wrong one, and *"Cost centre #0 is not one of
this company's"* about a row somebody is halfway through is the dialog shouting at
its own operator. What disables Save there is the form being invalid, which is
what an unfinished row actually is.

⚠️⚠️ The centre picker is **scoped to the line's own category**, and changing the
category clears the centre. That is the one place this screen narrows a picker
rather than showing a refusal, and the reason is that the other categories' trees
are a different *question* rather than a refused answer to this one — the same
call `centre-move-dialog` makes. The subtree of a centre being moved, by contrast,
**is** listed: an operator who cannot find the node they were aiming at concludes
the picker is broken and learns nothing.

#### `.coa-dialog` became `.master-dialog`

Those rules — the hint, the refusal box, the warning box, the full-width field —
are about **a master dialog that states a refusal**, not about the chart of
accounts, and this is the second screen to need them. A second copy under a second
prefix is the duplication that partial's own header warns about (§14's
`.jwd__full`, from the other side), so the file was renamed and the three Chart of
Accounts dialogs moved with it. Global, for the reason its header already gives.

#### 🐞 What the build caught, and what it did not

- **The breakpoint guard bit**, correctly: the class editor's split grid was
  written with `@container (max-width: 620px)`, copied from the route-templates
  dialog's own off-scale value. It is **720** now — and the container moved with
  it, from `:host` to `.cls__lines`, because §9's measured trap is exactly the
  48px of `mat-dialog-content` padding between the pane you sized and the row the
  query is about. The dialog opens at 60vw so the rows get ~816px at 1440: 96px of
  headroom above the threshold, rather than the one pixel P3d‑2 measured itself
  sitting on.
- **`(ngModelChange)` on a `formControlName` control fires nothing.**
  `app-select` emits `(change)`, after writing the control — which is the order the
  category→centre clearing depends on.
- ⚠️ **A `mat-form-field` wrapping a custom `MatFormFieldControl` resolves
  `getByLabel('Category')` to TWO elements** once its panel is open — the combobox
  and the listbox — and Playwright's strict mode refuses it. The spec addresses
  `app-select` directly and says why.

#### The four injections

| # | Injection | Caught by |
|---|---|---|
| 1 | `deleteCentre` stops consulting the mirrored rule and just sends | (4) — no sentence on screen, and `deletes` is 1 where the property expects 0 |
| 2 | the class refusal is computed and **never rendered** | (5) — *"a split is incomplete for most of the time it is edited, so the sentence is live"* |
| 3 | the move picker hides the centre's own subtree — the tidier screen | (2) — the destination cannot be chosen, so the refusal cannot be shown |
| 4 | the 100 % total taken over the whole class rather than per category | (5) — the two-category class, correct at 200, is refused |

⚠️ **Injection 4 passed the first time it was run, and the property was not the
problem**: the dev server had not finished rebuilding, so the browser was still
running the code the edit had replaced. P5c‑1's own note a second time — **a
passing injection is a claim about the edit before it is a claim about the
property** — with a different cause. Re-run after the rebuild, it fails on the
figure.

#### 🐞 What building the gate found — three defects, all in the harness

None of them in the screen, and all three are the same family: a cleanup that
cannot finish is indistinguishable from a screen that does not work.

- **`framework/db` is read-only**, by design, so the sweep goes through the API.
- **The two-stage delete and the archived view.** `BaseCrudService.remove`
  archives on the first call and erases on the second, and the `…/list` feeds are
  paranoid — so an archived leftover is invisible to them and
  `cost_categories`' `UNIQUE(companyId, name)` **includes** tombstones. The next
  run's first create is then a 409 on a screen that is working perfectly.
  Measured, twice, before the cause was clear.
- ⚠️ **`GET /cost-centres/list` is not the centres' feed** — it lands on
  `@Get(':id')` → `ParseIntPipe` → 400. The tree's is `GET /cost-centres/tree`.
  Silent: the sweep enumerated nothing, the centres survived, the category delete
  was then refused *because it still held them*, and the failure surfaced two
  tests later.
- ⚠️⚠️ And a sweep **per test** was a third of the request budget: the ERP
  throttles 100/min per IP, and the lane is documented as over it already
  (CLAUDE.md §11's `problems` row — *"a new suite spends a budget that is already
  gone"*). One `beforeAll` plus one `afterEach`.

  ⚠️ **And the screen itself was two thirds of the rest**, which turned out to be
  a real find rather than a test problem: `loadAll` re-read all three feeds after
  **every** write. All three on arrival is right — each tab states a refusal about
  the other's rows — but after a write the interlock is unchanged, because a write
  touches one master: creating a category moves no centre, creating a centre names
  no class, and a centre a class names cannot be deleted in the first place. It
  refreshes the one that changed. Three requests where one is the answer, on a
  screen whose every action is a write.

  ⚠️⚠️ The full lane is **56 passed · 1 failed**, and the failure is
  `user-form.ui.spec.ts`' *already-a-member* — which **passes in isolation**.
  Recorded rather than explained away: six more browser tests in a lane already
  over the per-IP throttle is a cost this phase added, and the two reductions
  above are what was done about it.

#### Parity

**Empty by construction, and this time that is a statement about a diff nobody
needs to run**: `git status` on `jayhind-client-back` is clean across the whole
phase — no endpoint, no DTO, no rule, no migration. The parity harness captures
API responses; a phase that changes none of them cannot move one.

#### Everything else, re-run

`npm run build` and `lint:ci` clean in `client-front` (586 warnings, all
pre-existing `any`s; **no new one**), the breakpoint and token guards green,
`check-mirrors` **in sync** with check 13's 117 comparisons noted, and
`qa:screens` green over the 30-route sweep with the new screen in the census.

⚠️ `cost-rules.util.ts` mirrors five of the six cost `describe*Block` rules;
`describeAllocationPayloadBlock` is **P7c‑3's**, and check 13 **names it in a
note** rather than failing — a check that demanded a phase which has not landed
is a check somebody switches off.

#### What P7c‑3 inherits

- **The mirror file exists and is checked**, so `expandCostCentreClass` and
  `describeAllocationPayloadBlock` join it rather than starting a new one. Check
  13's `RULES` list is where they are declared; its note already names the second.
- **The three feeds the allocation panel needs are proven from a browser**:
  `GET /cost-categories/list`, `/cost-centres/tree`, `/cost-centre-classes/list`
  (with the split). `POST /cost-allocations/list` still has no caller.
- ⚠️ **The world is still empty.** P7c‑3's gate will have to construct a switched-on
  ledger and a voucher as well as the masters — P5b's `advance` arm a seventh time.

### P7c‑3a record — 2026-09-01

**A figure can now be split on the voucher that posts it.** The Dr/Cr surface's
head fields carry an allocation sub-screen — Tally's own, at Tally's own moment —
and a **cost centre class** expands into its rows to the paisa.

| Artefact | What it is |
|---|---|
| `client-front` `components/shared/voucher-cost-allocation/` | The sub-screen (`cost-allocation-dialog`) and the trigger that says whether a row is allocated (`cost-allocation-button`). |
| `cost-rules.util.ts` `expandCostCentreClass` · `describeAllocationPayloadBlock` | The two rules the voucher needs, mirrored. |
| `voucher-head-option.const.ts` `costCategoryIds` | **The one backend change** — the picker option now answers which categories apply to the head it offers. |
| `acc-ledger.service.ts` `pickerFeed` | One read of the categories per page, through `CostCategoryService.list`. |
| `scripts/vectors/cost-rules.vectors.json` + `check-mirrors.js` **check 13** | Two new sections — **134 comparisons over 49 region cases** — and a second comparator: the expansion, share by share, in **integer paisa**. |
| `voucher-entry.ts` / `.html` | The header head and each N-line row, the payload, and the read-back. |
| `qa-artifacts/tests/ui/money/voucher-allocation.ui.spec.ts` + `-rules.ts` | The gate, **7/7**, shown to fail **five** ways, and the rules restated a third time. |

#### The wire carries the ANSWER, not the inputs — and that is a decision

The panel has to know two things about a head: whether it is allocated at all,
and across which categories. Both are `applicableCategories`, which turns on the
ledger's `costCentresApplicable` switch and on its nature's **kind** — and
`costItemKindOf` is deliberately a *derivation* from each nature's own financial
statement (D-54's shape: *"a fifth nature gets a kind by having a statement, not
by somebody remembering this file"*).

So mirroring it would have meant writing that derivation out as a **list** on the
frontend, which is the one shape the backend refused. `VoucherHeadOption` answers
`costCategoryIds` instead: one field, derived where the fact lives, and the screen
mirrors nothing for it. An empty array means *"not allocated"* and covers all
three ordinary ways that happens at once — the switch off, no nature, no category
configured — because a screen does not need to tell those apart.

⚠️ **"Revenue" is Tally's word for a P&L item, not for income.** An **Expense**
head is a revenue item, so a revenue-only category applies to it. Reading the
flag as "income" is the mistake that makes an Expense head answer no categories
at all — and it is the mistake this phase's own unit spec made first time, caught
by the assertion rather than by review. It is now the one that names it.

#### Which rows allocate is DERIVED from the posting engine, not written down

On this surface only a **Journal** allocates, and nothing says so:

- the trigger renders on the grid's `ledger` rows;
- `accountingRowPlan` gives a `Ledger` ref to `journal` alone;
- because `postPaymentReceipt` reads `trxGroupId` only for a Journal, so a
  Payment's or a Receipt's head is a **classification** and not a leg — P4b
  measured it as a leg of 0 of 974 payments and 0 of 1,888 receipts.

That matters more than tidiness: rows stored against a head that is not a leg
would be read by **nothing**. The operator would have allocated a figure and no
report would ever show it — worse than the panel being absent. The DTO says the
same thing in its own words, which is why the two agree without either importing
the other.

#### ⚠️ The expansion is compared in integer paisa, because a paisa is the defect

`expandCostCentreClass` is a **stencil**: the screen expands it, the operator sees
the rows, and what is saved is the rows. So if the two sides rounded a third of
₹1,000 differently, the operator would read one split and the books would carry
another, with nothing to say which was meant.

Check 13's new comparator therefore compares `[categoryId, costCentreId, paisa]`
with `===` and **in order**, never `near`. P7c‑1 measured why: a paisa-tolerant
check read ₹0.06 as equal to ₹0.05 and passed. Three of its nine expansion
vectors exist only to separate the two candidate algorithms —
`expand-ten-way-nickel` (round-and-correct takes a share to −₹0.04, which the
payload rule then refuses: *a class that made its own voucher unsavable*),
`expand-tie-order` (equal remainders, so the line order breaks the tie), and
`expand-70-30-nickel` (P7c‑1's own injection 1).

#### The two halves of §3.7, drawn differently on purpose

| | | |
|---|---|---|
| the **payload** is malformed | a centre in the wrong category, a negative or zero share | `describeAllocationPayloadBlock` — **refused**, Accept disabled |
| the **books** are incomplete | ₹600 allocated of a ₹1,000 row | a **coverage hint per category**, and Accept stays live |

⚠️ A coverage gate here would refuse the *ordinary* case — somebody allocating
part of a figure and coming back to it — and the **default** case, which is a row
with no allocation at all: a company that has just switched a ledger on has every
voucher unallocated. Check 13 carries a vector for each of those two directions
(`alloc-empty`, `alloc-partial`) precisely so a later "improvement" cannot quietly
turn the panel into a gate, and the gate's (5) drives it end to end.

⚠️⚠️ **Coverage is per category**, because the categories are parallel partitions
of one figure: an expense split across two departments and two locations is four
rows totalling 2× the row, and that is correct. `alloc-two-categories` is the
vector; a whole-payload Σ would refuse every two-category voucher.

#### Two small rulings the code had to make

- **A head change drops the rows whose category no longer applies, and keeps the
  rest.** Carrying them all would store a figure that can never be reconciled
  (`costAllocationProblems` would report `NotApplicable` for ever); clearing them
  all would punish re-picking a head inside the same kind, which is an ordinary
  correction.
- ⚠️ **An N-line Journal's allocations are keyed by POSITION**, so `removeLine`
  re-keys both maps. Without it, removing line 1 hands line 2's split to line 1 —
  silently, and against a different head. It is the defect a `Map<index, …>`
  beside a `FormArray` produces whenever nobody re-keys, and gate property (7) is
  what measures it.
- **Changing an allocation marks the form dirty**, so `pendingChangesGuard` asks
  about it; a hydration then re-marks pristine, because a voucher that opened
  dirty is P4c's own defect one phase across.

#### 🐞 What the gate found — four defects, and two of them were real product bugs

Two are in the product and two in the harness, and the first is the one to carry.

- ⚠️⚠️ **A dialog that closes with the wrong RESULT SHAPE does not close at all.**
  `FormGuardDirective` is auto-applied by selector to any `[formGroup]`
  (`SHARED_IMPORTS`), and inside a dialog it hands the ref to
  `UnsavedChangesService.attachDialogGuard`, which **replaces `ref.close`**: a
  result that is not `true` and does not carry `status: true` is read as *leaving
  with unsaved changes* and swallowed behind a discard prompt. So `close({
  shares })` did **nothing** — no error, no state change, `afterClosed` never
  firing, an Accept button that looked live and was inert. Four gate runs went on
  it. The tell was `MatDialogRef._state` still reading `OPEN` **after** `close()`
  returned without throwing, which is only reachable through an early return.
  `status: true` is therefore load-bearing rather than envelope cargo, and the
  comment at the call site says so.
  > A pleasant consequence: cancelling an edited panel now asks *"Discard unsaved
  > changes?"*, which is exactly the loss that prompt is for.
- ⚠️ **A HYDRATED head announced nothing, so every reopened voucher lost its
  panel.** `app-ledger-picker` emits `optionChange` from `onSelection` — a person
  clicking — and `writeValue` only pinned the id. A host that needs facts *about*
  the chosen head therefore had none on an edit. It is CLAUDE.md §14's
  *"why does a pre-selected picker render its placeholder?"* one step on: the
  picker rendered its own value perfectly and the component beside it silently had
  nothing. The picker now announces a hydrated option once it lands, at most once
  per distinct id.
- **A newly created ledger cannot answer its own `costCategoryIds`.**
  `app-ledger-picker`'s `Alt+C` path *pins* the created option rather than
  refetching (*"no search has run that would return it"*), and pinning cannot
  carry a fact only the server computes. It now re-reads that one option when the
  new ledger switched cost centres **on** — not `ensure()`, which skips an id it
  has already pinned, which is exactly this id.
- **`PUT /acc-ledgers/:id` answers no `data` key**, so the gate's construction
  needed `allowNoData` — the same envelope note `voucher-entry.ui.spec.ts`
  carries about a delete.
- **One new `any` in the dialog**, removed rather than left: P7c‑2 recorded *"no
  new one"* and a lint count that creeps is a count nobody reads.

#### 🐞 And three things the gate got wrong about itself

All three are the shape P7c‑2 recorded: *a harness that cannot set its own world
up is indistinguishable from a screen that does not work.*

- ⚠️ **A category default was a guess, and the gate is what proved it.** Every
  company carries Tally's seeded `Primary Cost Category`, so a company with one
  category of its own has **two** that apply — and `categoryIds[0]` as a default
  opened each line already naming a category nobody chose, whose centre picker is
  scoped to it and therefore **empty**. It is pre-filled only when the match is
  **unique** now, which is `defaultHeadFor`'s own rule one screen across. Four
  properties failed on it, and the fix is in the product rather than in the test.
- ⚠️⚠️ **Coverage is per category, so *"no category has a remainder"* is the
  wrong assertion** — the seeded category being unallocated is a true statement
  about the books. The gate asserts the class's **own** category is covered in
  full. This is the mistake a whole-payload Σ makes, made by the gate rather than
  by the code.
- **`cost_categories` is `UNIQUE(companyId, name)` including tombstones and a
  Playwright RETRY re-runs `beforeAll`**, so a second attempt met its own first
  attempt's category as a 400 and every property after it failed for a reason
  that had nothing to do with the screen. The names carry a per-run token; the
  sweep still matches the mark alone, so it clears every run's rows. The
  construction census is scoped to this run **and to live rows** for the same
  reason — an archived leftover reported four centres where three were built.
- **The dialog is asserted gone with `toHaveCount(0)` at the house 20 s**, not
  `toBeHidden` at 10: the masters gates' own convention, and the difference is
  measurable on a dialog carrying `DialogLayoutDirective`.

#### The five injections

| # | Injection | Caught by |
|---|---|---|
| 1 | the panel refuses an INCOMPLETE split — a coverage gate | 4 fail, including (5), the property it is about |
| 2 | the expansion rounds each line instead of largest-remainder | (3) — *"Σ is 100001 paisa where the figure is 100000"* |
| 3 | `removeLine` stops re-keying the index-keyed maps | (7) — the allocation stays on the old position |
| 4 | the trigger renders whether or not a category applies | (2) — and (7), which counts the switched-off line's triggers |
| 5 | the picker stops announcing a HYDRATED head | (6) — every reopened voucher loses its panel |

⚠️⚠️ **Injection 2 PASSED first time, and the property was the problem — not the
edit.** The fixture split was ₹1,000 at 33.3333 / 33.3333 / 33.3334, and every
exact share there ends in a fraction **below a half** (`33,333.3` paisa), so
`Math.round` and `Math.floor` answer the same number and the two candidate
algorithms are indistinguishable. `check-mirrors` check 13 failed on three
vectors while this gate stayed **7/7 green** — the two instruments disagreeing is
what exposed it.

The split is **solved** now rather than picked: `33.3335 / 33.3335 / 33.3330`
totals 100 % and lands the exact shares exactly ON a half, so
largest-remainder gives `33334 · 33333 · 33333` (₹1,000.00) where
round-each-line gives `33334 · 33334 · 33333` (₹1,000.01). It measures the
**tie-break** at the same time — the first two remainders are equal, so the odd
paisa goes to the line the class lists first. P7c‑1's *"a paisa of slack cannot
see a paisa of error"* has a companion: **a fixture that cannot produce the error
cannot see it either.**

#### What is deliberately NOT here

- ⚠️ **The item form** — the voucher's own head and each charge row. That is
  **P7c‑3b**, and it is a re-hosting of the component this phase builds rather
  than a second mechanism, which is P4b→P4c's own seam.
- ⚠️⚠️ **Approval.** The gate asserts `trx_cost_allocations` — the *voucher's*
  statement, where a draft keeps them — and does not approve. Posting them through
  to `cost_allocations` means `ApprovalService.transition`, which commits its own
  transaction, so a posted scratch voucher is a figure the parity harness would
  capture with nothing behind it. That arm belongs to `qa:p7b-cost-allocations`,
  which does it in a rolled-back transaction; the spec says so rather than
  implying coverage, exactly as P5d's gate did about `isPaid`.
- **`costAllocationProblems` still has no reader in the product.** P7d's
  reconciliation report is where §3.7's *"a warning on a reconciliation report"*
  acquires its report. Said here for the third phase running rather than implied.

#### Parity

The reports are untouched: the one backend change is a field on a **picker
option**, which no report reads, and no DTO, posting rule or migration changed.
The parity diff is empty by construction.

#### Everything else, re-run

`npm test` in `client-back` **2085/2085** across 133 suites (the head-option spec
gained five cases), all five tree-scanning **guards** green (`npm run guards`),
`npm run build` and `lint:ci` clean in `client-front` (**586** warnings, one fewer
than P7c‑2's 587 — no new `any`), the breakpoint and token guards green, and
`check-mirrors` **in sync** with check 13 at 134 comparisons over 49 region cases.
No route is added, so `dump-routes` is unchanged.

⚠️ And the **whole `qa:money` lane is green — 119 passed, 0 failed** in 13.7
minutes, which is worth stating rather than assuming: this phase widened
`app-ledger-picker` to announce a hydrated option, and that picker is on every
voucher head field in the product. The lane's own note about being over the
per-IP throttle still holds (six more browser tests were added to it), and P7c‑2
recorded one unrelated failure in the full sweep; this run has none.

#### What P7c‑3b inherits

- **The component exists and is proven from a browser**, so hosting it on the item
  form is a template change plus a payload field, not a second mechanism.
- **Both rules are mirrored and compared**, and the vector table has a section for
  each — a charge row's allocation is the same payload rule over the same shares.
- ⚠️ **`trx_charges` are destroyed and rebuilt on every save** (`TrxWriteService`),
  so their ids change. That is why `POST /cost-allocations/list` shipped with P7b's
  writer rather than with a screen: a form that could not read a charge's
  allocations back would lose them on any edit, silently. P7c‑3b is the first
  caller that has to get that right.
- ⚠️⚠️ **The world is still empty** — nothing was left switched on. P7c‑3b's gate
  constructs its own dimension, as this one does.

### P7c‑3b record — 2026-09-01

**The item form allocates too, and P7c is complete.** The voucher's own head and
every `trx_charges` row carry the same sub-screen P7c‑3a built — re-hosted, not
rewritten, which is P4b→P4c's seam one phase across.

| Artefact | What it is |
|---|---|
| `trx-add-edit.ts` / `.html` | Three hosts: the head in the header strip, the Accounting Invoice body's rows, and the Charges chip's rows. Plus the payload and the read-back. |
| `costAllocations` on the root form and on each charge `FormGroup` | The allocations are **form controls** here, not signals beside the form. |
| `_voucher.scss` `.vch-hf--alloc` | The trigger's own strip item. |
| `qa-artifacts` `voucher-allocation.ui.spec.ts` (8)–(11) | Four more properties on the same gate — **11/11**. |

**No backend change at all.** P7c‑3a's `costCategoryIds` and P7b's four owner
types were already there; `CreateUpdateTrxDto.costAllocations` and
`CreateUpdateTrxChargeDto.costAllocations` have existed since P7b.

#### A form CONTROL, not a signal — and that is a better shape than P7c‑3a's

The Dr/Cr surface keeps its allocations in signals beside the form and re-keys two
`Map<index, …>` by hand when a line is removed. Here they are `FormControl`s: one
on the root for the head, one inside each charge's own `FormGroup`.

Three things fall out, and the second is the reason:

- **The payload needs no surgery.** This screen sends `transactionForm.value`
  verbatim, so the allocations ride it.
- ⚠️ **A removed charge takes its split with it, structurally.** The shares live
  in the `FormGroup` that is removed, so the class of defect `dropLineKey` exists
  to prevent cannot arise. What still needs re-keying is only the map of head
  **options** — without it the surviving row is asked about the deleted row's head
  and could be offered a category that does not apply to its own.
- **An array is always sent, empty when nothing is allocated.**
  `TrxService.saveCostAllocations` reads *absent* as "not talking about
  allocations" and `[]` as "clear them", and this screen always states the whole
  picture. A partial update from elsewhere still carries neither and still cannot
  empty a voucher's panel.

#### ⚠️ The trigger is its own strip item, and the arithmetic was checked

§9's bases in `_voucher.scss` are *solved* so that no value is ever clipped, and
taking 44px out of a 175px field is exactly the clipping that section is about. So
`.vch-hf--alloc` is a separate `flex: 0 0 auto` item — it adds its own width
rather than eating a field's — and it renders **only when a cost category applies
to the head**, which is off on all 1,383 ledgers of all 14 companies. Every
voucher in the product today draws a byte-identical strip.

Checked against the two widths that file states: five fields at ~1090 is
`778 + 56 = 834`, still one line; at ~678 the strip already wraps and the trigger
joins whichever line it lands on. Gate (8) measures it in a browser at 1440
rather than trusting the sum.

#### The item LINE allocates nothing, and that is asserted

A `trx_items` row names a product, never a ledger, so it has nothing to allocate —
Tally allocates the ledger entry for the same reason, and the DTO says so in its
own words. Gate (8) counts triggers *inside* the items grid and expects zero,
because *"the panel is absent"* is the kind of claim that is true by accident
until somebody checks it.

⚠️ The head's figure is the **item net** (`trx.totalAmount`), which is what the
goods leg carries — not the grand total, whose taxes and charges are legs of their
own. On an **Accounting Invoice** the item net is zero, so the head offers nothing
and the money is allocated on the charge rows that hold it. That falls out of the
figure rather than being a rule anybody wrote.

#### 🐞 What the gate found — and one premise of the gate's own that was wrong

- ⚠️ **A body switch DISCARDS, so a split cannot follow a row across it.**
  Property (9) was written as *"the same row, already allocated, in the Charges
  chip after `Ctrl+H`"* and failed. `toggleInvoiceBody` confirms and clears — the
  two bodies are different tables and there is no honest mapping between an item
  line and a ledger allocation (P4e's own ruling). The Charges chip is therefore
  **host number three**, measured on its own in (11), rather than the same row
  seen twice. The gate finding out what the product actually promises.
- ⚠️⚠️ **A `mat-form-field`'s text includes its LABEL**, and the header's label is
  *"Purchase Head"* — which contains "Purchase", the name of the ledger being
  picked. So a `toContain` check on the field passed while the control still held
  the seeded default, and the missing panel looked like the panel's fault for
  three runs. `pickHead` reads `.mat-mdc-select-value` now, and retries once.
  **A helper that can pass without the thing it checks having happened is worse
  than no helper**: it is the *inert assertion* this programme keeps meeting, in
  a new place.
- **An exact-top row count reports two rows for a strip that is plainly one**, if
  anything on the line is vertically centred against fields that align to their
  top. Tops are grouped into 30px bands now — well under a field's height, so a
  genuine second line is still a second band.

#### Parity

Empty by construction, and this time literally: `git status` on
`jayhind-client-back` is clean across the whole phase.

#### Everything else, re-run

`build` and `lint:ci` clean in `client-front` (**586** warnings, no new one), the
breakpoint and token guards green, `check-mirrors` in sync, and the whole
`qa:money` lane **123 passed · 0 failed** in 15 minutes with the four new
properties in it.

#### What P7d inherits

- **The dimension is usable end to end**: a company can define categories,
  centres and classes (P7c‑2), switch a ledger on, and split every figure that
  names a head — on both entry surfaces.
- ⚠️ **`costAllocationProblems` still has no reader in the product**, for the
  fourth phase running. P7d's reconciliation report is where §3.7's *"a warning
  on a reconciliation report"* finally acquires its report, and it is the last
  thing in P7 that is written and unread.
- **The four Tally reports** are Cost Centre Summary, Category Summary, Cost
  Centre Breakup and Ledger Breakup (§3.7). Each rolls a subtree up by `path`
  prefix **within one category** — `rollUpByPath`'s argument, one dimension
  across — and the Σ is **signed**, because a credit note against a department
  must reduce its spend.
- ⚠️⚠️ **The world is still empty** — nothing is left switched on, and P7a/P7b's
  gates still measure 0 allocations across 14 companies. P7d's gate constructs
  its own, as the last four have.

### P7d‑1 record — 2026-09-01

**The dimension can be read.** P7a gave the books a parallel dimension, P7b gave
it figures and P7c gave it screens to state them on. P7d‑1 is the four reports
Tally ships, and the fifth that §3.7 has been promising since P7a.

| Artefact | What it is |
|---|---|
| `src/services/cost-report.service.ts` | The five derivations. One aggregate (`allocationAggregateSql`) grouped three ways, plus the reconciliation's walk. |
| `ReportsController` +5 handlers | `cost-centre-summary/:categoryId` · `cost-category-summary` · `cost-centre-breakup/:centreId` · `cost-ledger-breakup/:ledgerId` · `cost-allocation-reconciliation`. |
| `cost-allocation.const.ts` `unallocatedOf` · `residueIsMaterial` · `COST_RESIDUE_NEAR` | The coverage arm as a **figure**, beside the sentence, sharing its tolerance. |
| `ledger-report.const.ts` `presentFigures` · `voucherNoFor` | Two display rules lifted out of `ReportsService`, which now delegates to both. |
| `scripts/qa-p7d-cost-reports.ts` | The gate — **169/169** over 14 companies, seven injections. |

#### Why the parity diff cannot gate this phase

These are **additive** reports. A report the harness has never seen is absent
from both sides of a snapshot diff and passes **by being absent** — §6.4's *"a
mirror rule that cannot fail reads as coverage"*, and the same reason P3a needed
`qa-p3-ledger-report` at all. So the diff proves only that P7d‑1 moved nothing
that already existed (it is **empty**, nothing re-based, over a `capture` pair
taken either side of a `git stash`), and everything these five reports actually
*say* is asserted in the gate.

#### ⚠️ Every report is scoped to one category, structurally rather than by a filter

`cost-allocation.const.ts`' header has argued since P7a that the categories are
**parallel partitions of the same figure** — four rows totalling ₹20,000 against
a ₹10,000 expense is *correct*. P7d‑1 is the first thing that has to render
that, and the answer is not a filter anybody can omit:

- the **Cost Centre Summary** and the **Cost Centre Breakup** take the category
  from the **route**, so there is no call that forgets it;
- the **Category Summary** returns a row per category and **no grand total, and
  no field to put one in**;
- the **Ledger Breakup** returns a **section** per category, each summing to the
  ledger's *whole* figure rather than to a share of it.

That is P7c‑2's own ruling for the masters screen — one category at a time, and
deliberately no *"all categories"* row — restated where it is figures rather
than names, which is where getting it wrong would be a number describing
nothing.

⚠️ **Injection 6 was refused by the compiler**, before the gate could see it:
adding `total` to the Category Summary's payload is a `TS2353` against an
interface that has no such property. Widening the interface as well is what (4)
catches. Two layers, and the cheaper one is the type — §13's *"the safe
behaviour has to be the one you get for free"*.

#### ⚠️⚠️ The residue and the sentence are ONE subtraction

The Ledger Breakup prints *"₹2,000 unallocated"* on a section; the
reconciliation prints *"… is allocated ₹8,000.00 across Department against a
line of ₹10,000.00"*. Those are the same arithmetic, and a report that computed
its own would be BUG-0040's shape in a new dimension — two derivations of one
question, agreeing until one of them moves.

So `unallocatedOf` lives in **`cost-allocation.const.ts`**, beside
`costAllocationProblems` rather than in a report module, and
`COST_RESIDUE_NEAR` was exported from the invariant rather than declared in the
report: **the invariant owns the tolerance**. The co-located spec asserts the
equivalence as a *sweep* — a residue is material **exactly** when the rule
reports a Coverage problem, over nine allocated figures straddling the tolerance
in both directions — because *"they agree today"* is what that bug was made of.

#### ⚠️ The reconciliation's population is a UNION, and the second half is the one that matters

A rule that only read lines **with** allocations could never report the
commonest incompleteness there is: a switched-on ledger with **no** allocation
at all, which has no rows to be found by. That is `costAllocationProblems`'
*"missing"* half, and P7a's own injection 2 was that rule written lazily.

Its mirror is the half nobody would think of: allocations left behind on a
ledger somebody has since switched **off**. They are stored, summed by every
report above, and reconcile against nothing —
`CostAllocationProblemKind.NotApplicable`, which has existed since P7a with
nothing that could ever produce it on a real book. So the population is *"a line
whose ledger is switched on, **or** a line that has an allocation"*, property
(7) asks both halves, and injections 4 and 5 removed one half each and each
failed its own property.

The **Ledger Breakup** carries the same distinction: a section for a category
that no longer applies is emitted with `applies: false` rather than hidden.
Hiding it is injection 7, and it fails (7b).

#### 🐞 Two things the gate found, and both were the GATE's premise

- ⚠️ **The Ledger Breakup's residue is over the LEDGER's whole period, not over
  one voucher.** The first cut of property (6) dropped ₹400 of a ₹1,000
  allocation and expected the section to read ₹400 short; it read
  **₹5,75,07,157.23**, which is company 28's purchase head's unallocated history
  and is the report telling the truth. The tie is stated as the **difference
  between the two parallel sections** now — both see the same `ledgerNet`, so
  their residues differ by exactly what one of them is short, which is an exact
  figure whatever the history holds. A property that survives being wrong about
  its fixture.
- ⚠️⚠️ **`sections.length === 2` was asserting a fixture, not a rule.** The
  report emits a section for every category that *applies*, which is the whole
  reason a switched-on ledger with nothing allocated is visible — and this
  company has **thirteen** categories. The count is a rule only in (7b), where
  the ledger is switched off so nothing applies and the only sections left are
  the two with stray rows.

#### ⚠️ Injection 1 passed, and it was not a defect

Dropping the Cost Centre Summary's `AND a.categoryId = :categoryId` predicate
changes nothing observable, and the gate was right not to fail. A centre belongs
to exactly one category **for life** (`describeCentreMoveBlock` refuses a
cross-category parent, and `describeAllocationPayloadBlock` refuses a row naming
another), so `costCentreId = X` already implies its category. The predicate is
the **index's** — `idx_cost_allocations_company_category` — and not the rule's,
and it is kept for that and stated here so the next person does not read its
un-falsifiability as a gap.

That is worth separating from the shape this programme usually meets: a check
that *cannot* fail because the rule was restated wrongly (P2b‑3c), or because
the oracle imported what it was checking (P6). This one cannot fail because the
schema and two refusals already guarantee it — which is the good kind.

#### Seven injections

| # | Injection | Caught by |
|---|---|---|
| 1 | the Cost Centre Summary sums across categories | **nothing — and it is not a defect** (above) |
| 2 | a summary node reports its OWN figures, not its subtree's | (3) and (5) |
| 3 | the Ledger Breakup's residue is taken over the whole line, not per category | (6) |
| 4 | the reconciliation reads only lines that HAVE an allocation | (7a), and (11) |
| 5 | the reconciliation reads only switched-ON ledgers | (7b) |
| 6 | the Category Summary grows a grand total | the **compiler**; and (4) once the type is widened too |
| 7 | a switched-off ledger's stray rows are hidden rather than reported | (7b) |
| 8 | the reconciliation truncates at its cap instead of refusing | (11) |

#### Two red gates that are NOT this phase, and one of them is a leak

Both were reproduced on a `git stash` of the whole change, so neither is P7d‑1's:

- ⚠️ **`qa:p2-ledgers` (2) is data drift**: 449 parties in the population, 422
  planned. `scripts/plan-party-ledgers.ts --apply` has not been re-run since 27
  more identities acquired postings. The remedy is to run it.
- 🐞 **`qa:p7b-cost-allocations` (0) and `qa:p7c-cost-classes` (0) are RED
  because the P7c‑3 browser gate leaks.** The development database holds **12
  scratch cost categories, 14 scratch cost centres and 14 `trx_cost_allocations`
  rows** named `QA·P7c3 …`, left behind by `voucher-allocation.ui.spec.ts` —
  which creates through the real API, as P7c‑2's own record notes it must, and
  does not clean the masters up. Both those gates' (0) is a global `COUNT(*) = 0`,
  so somebody else's leak reads as their own failure. **A permanently-red gate is
  one nobody reads** (§13's own words about `ci-guard-raw-sql`), and this is that
  happening to two of them within a day.
  > P7d‑1's own (0) is written **census-relative** — it captures the four counts
  > before the run and compares after — precisely so it cannot inherit a leak it
  > did not cause, and it names its scratch rows `QA·P7d%` besides. That is the
  > shape the other two want.

#### Everything else, re-run

`npm test` **2096/2096**, all five guards green, `build` and `lint:ci` clean (no
new warning), `check-mirrors` in sync — nothing here is mirrored, and the two
lifted helpers are server-side display rules with no frontend half yet.
`dump-routes` diffs to **exactly the five new routes and nothing else**. The
neighbouring gates: `qa:p1-group-tree` 56/56, `qa:p3-ledger-report` 140/140,
`qa:p3b-statements` 323/323, `qa:p5-bill-register` 157/157, `qa:p5d-annexure`
16/16, `qa:p6-trading` 154/154, `qa:p7a-cost-masters` 264/264.

#### What P7d‑2 inherits

- **Five reports with no screen.** `GET /reports/cost-*` answers every one of
  them and nothing in the SPA calls any of them — which is the shape that
  produced BUG-0068's *"an endpoint nothing calls is an endpoint nobody has
  run"*, except that here the gate has run all five.
- ⚠️ **`DrillTarget` needs a fourth member.** `group | ledger | voucher`
  (P3d‑1) does not include a **cost centre**, and the journey these reports
  imply is Category Summary → Cost Centre Summary → a centre → its ledgers → a
  ledger's own report → a voucher. Four of those five hops already resolve; the
  centre is the one to add, in `src/utils/drill-target.ts`, so a new report
  still gets drill-down by emitting the right target rather than by a
  `routerLink`.
- ⚠️⚠️ **The reconciliation report is the one with no precedent on screen.** It
  is not a statement — it is a list of sentences about lines, each opening a
  voucher. The nearest thing in the product is the Audit Log, not the Trial
  Balance.
- **The world is still empty** — nothing is left switched on, and every P7 gate
  still measures 0 posted allocations across 14 companies. P7d‑2's browser gate
  constructs its own, as P7c‑2's and P7c‑3's did.


### P7d‑2 record — 2026-08-31

**The dimension can be read by a person.** P7d‑1 shipped five derivations and
`qa:p7d-cost-reports` held them to their arithmetic; **not one of them had a
caller**, which is BUG-0068's *"an endpoint nothing calls is an endpoint nobody
has run"* with the gate as the only thing that had ever run them. P7d‑2 is the
callers, and the two `DrillTarget` members that make them a journey rather than
five screens.

| Artefact | What it is |
|---|---|
| `components/admin/transaction/reports/cost-categories/` | **Category Summary** — the landing report, and the one with no total. |
| `…/cost-centres/` | **Cost Centre Summary** — one category's centre tree, `?categoryId=`. |
| `…/cost-centre-breakup/` | **Cost Centre Breakup** — a centre cut by ledger, `?centreId=`. Drill-only. |
| `…/cost-ledger-breakup/` | **Ledger Breakup** — a ledger cut by centre, sectioned per category. |
| `…/cost-allocation-check/` | **The reconciliation** — §3.7's warning, as a list of sentences. |
| `…/cost-reports.shared.scss` | Their five-component stylesheet, beside `reports.shared.scss` rather than in it. |
| `utils/drill-target.ts` | Two new members — `cost-category` and `cost-centre`. |
| `services/api-call.ts` +5 | The five reads. |
| `qa-artifacts/tests/ui/money/cost-reports.ui.spec.ts` + `cost-report-rules.ts` | The gate — **8/8**, seven injections. |
| `client-back` `CostAllocationService.discardForOwners` + `scripts/purge-orphaned-cost-allocations.ts` | 🐞 [BUG-0071](../qa-artifacts/docs/bugs/BUG-0071.md). |

#### ⚠️ `DrillTarget` needed TWO members, not the one the plan named

P7d‑1's handover asked for a **cost centre**. The journey it described in the
same paragraph — *Category Summary → Cost Centre Summary → a centre → its
ledgers → a ledger's own report → a voucher* — needs two: the first hop is a
**category** opening its own tree, and it resolved nowhere either. Adding one and
spelling the other as a `routerLink` would have been the per-report URL
`drill-target.ts` exists to prevent, and injection 7 measures exactly that
(a `router.navigate` in place of the drill leaves the route stack empty, so Esc
walks the reader out one screen and then stops).

They are deliberately **not** interchangeable with `group`/`ledger`, even though
both pairs are a tree and its leaves: a cost centre answers *which part of the
business*, never *which side of the books*, so nothing resolves a `cost-centre`
onto a statement.

#### ⚠️⚠️ Four tabs for five reports, and the asymmetry is a rule

A sub-nav tab is for a report somebody can reach **cold**, which means its
subject is at most one picker away — a ledger, a group, a category. The Cost
Centre Breakup's subject is **two**: the centres are scoped to a category and
their tree is drawn per category, so picking one from nothing means choosing a
category and then a centre. The Cost Centre Summary already *is* that picker,
with the figures beside it, one click away.

So it is reached by drilling — and it is still a real route with its subject in
the query string, which is what makes it pasteable and what lets the drill stack
restore it. `COST_REPORT_TABS` in the gate's rules file states the four, and (8)
asserts the fifth has none, because an asymmetry nobody wrote down is one
somebody tidies away.

#### The screen is where "no grand total" becomes visible

`cost-allocation.const.ts` has argued since P7a that the categories are parallel
partitions of the same figure, and P7d‑1 made the API say so by having **no
field** to put a total in. A screen can still print one, and a reader who has
never read either file has no way to know they should not add the rows up.

So the Category Summary prints a **caption where every other report here prints
a total row**, and (1) asserts both halves at once: two categories carrying the
posted money *and* no `.grand-total-row` in the table. Either alone is
satisfiable by a defect — *"there is no total"* is true of a screen with no rows,
and *"both categories show a figure"* is true of one that would happily add them.

The same ruling one level down is what makes the Ledger Breakup **sections**
rather than one table with a category column: each section is a *complete* cut,
`allocated + unallocated = the ledger's own figure`, and (6) asks it **per
section** — never `Σ sections = the ledger`, which is the check that passes on a
report that split one figure between two categories.

#### ⚠️ The gate posts real money, and the cleanup cancels rather than deletes

Every P7 gate has measured the same empty ground: `costCentresApplicable` is `0`
on all 1,383 ledgers of all 14 companies, no centres, no allocations. P7c‑3a's
browser gate could stop at the **draft's** own statement
(`trx_cost_allocations`) and deliberately did. These five reports read
`cost_allocations`, which exists only once a voucher has **posted** — so this
file approves two real journals, which is the trade
`bill-reference-grid.ui.spec.ts` already makes and ends the same way: *a voucher
that ever posted is never erased*, so the sweep **cancels** them. Measured
afterwards: **0.00 across every live allocation**, because an allocation is
signed and a reversal negates it (P7b), and every one of these reports honours
`liveEntrySql` besides.

⚠️ The masters are **ensured, not re-created per run**, and that is the other
half of the same fact: a centre that has been allocated to can no longer be
erased, so a per-run copy leaves one archived set behind on **every** run —
which is precisely the leak P7d‑1 had to file against P7c‑3. One fixed set,
created on the first run and reused, with the ledger switched back off at the
end so `qa:p7a-cost-masters` (4) still sees the ground it describes.

#### 🐞 Reading the two red gates found a real defect, and it is why they were red

[BUG-0071](../qa-artifacts/docs/bugs/BUG-0071.md).
`trx_cost_allocations.ownerId` carries **no foreign key** — the column is
polymorphic over D6's four `ledgerId` holders, and that is documented. What was
not written down is the consequence: **the database therefore removes nothing
when the owner goes.** A hard delete erases the `trx` or the
`trx_payment_receipts` row, `ON DELETE CASCADE` takes its charges or its lines,
and every allocation they carried stays, naming an id that is not there.

An orphan is worse than untidy in two directions at once. **Nothing can read
it** — `sharesForOwners` is keyed by the id that no longer resolves. And **it
holds a cost centre hostage for ever**: `describeCentreDeleteBlock` counts
`trx_cost_allocations` on purpose, so a centre named by an unapproved draft is
refused rather than turning that draft's approval into a foreign-key error weeks
later — but an orphan has no draft behind it and no screen can show it, so the
refusal it causes can never be acted on. The centre is undeletable, then the
category above it is, with nothing anywhere able to say why.

Measured: **14 orphans holding 14 centres in 12 categories**, every one written
by `voucher-allocation.ui.spec.ts` deleting its own scratch vouchers — the
cleanup doing exactly what it should. `discardForOwners` is the missing half of
`replaceForOwner`, called at the **two erase seams** with the child ids read
*before* the destroy (they cascade away, and a moment later there is no way left
to name them); `scripts/purge-orphaned-cost-allocations.ts` is the repair, and
it **stops** on an `ownerType` it has no table for rather than falling through
to a delete.

⚠️ **And that is what had turned `qa:p7b-cost-allocations` (0) and
`qa:p7c-cost-classes` (0) red.** Both were written as a global `COUNT(*) = 0`, so
they inherited another suite's leak and reported it as their own failure —
*a permanently-red gate is one nobody reads*, which P7d‑1's record filed and
asked for the census-relative form its own (0) already had. Both have it now,
and it stopped being optional the moment this phase's gate started posting and
cancelling real vouchers by design. **139/139** and **307/307**.

#### Seven injections

| # | Injection | Caught by |
|---|---|---|
| 1 | the Category Summary grows a grand total row | (1) |
| 2 | a summary row reports its OWN figures, not its subtree's | (2) and (3) — ⚠️ **and the compiler first** |
| 3 | a `cost-category` drill drops the origin's period | (2) |
| 4 | a category that no longer applies is hidden rather than reported | (7) |
| 5 | the check re-words `costAllocationProblems`' sentence | (8) |
| 6 | the breakup's ledger drill drops the period | (4) |
| 7 | a category row navigates itself instead of emitting a `DrillTarget` | (5) |

⚠️ **Injection 2 was refused by the compiler before the gate could see it** —
the spec's own `CentreNode` does not declare `own`, so printing it is a `TS2339`.
That is P7d‑1's injection 6 a second time, and the same lesson: *the safe
behaviour has to be the one you get for free*. It was then widened deliberately
so the property itself could be measured, and it failed twice.

⚠️⚠️ **Injection 3 failed (2) and NOT (5)**, which is the separation working: the
period travelling *in* is the drill's job, and Esc restoring an origin is the
route stack's — it stores the origin's whole URL, so it comes back correct even
when the outward hop lost the range. Two properties, two mechanisms, and a
single test conflating them would have hidden one of them.

#### ⚠️ And a third absolute count, met while proving the second

`qa:p7d-cost-reports` (0) went **red on this phase's own mark**. Its census half
was already relative; its *named-row* half was written as `LIKE 'QA·P7d%'`, and
that wildcard also matches **`QA·P7d2`** — the mark P7d‑2's gate puts on the
masters it deliberately keeps. So a property whose rollback was perfect failed on
a later phase's name.

The patterns are this script's own spellings now (`QA·P7d ` with the space for a
master, `QA·P7d-` with the hyphen for a voucher). Same family as the two census
fixes above, and worth stating as a rule: **a count that means *"my rows"* has to
be written so it can only ever mean that** — a phase mark is a prefix of the next
phase's mark, every time.

#### Everything else, re-run

`npm test` **2096/2096**, all five guards green, both `build`s and both
`lint:ci`s clean (no new warning), `check-mirrors` in sync — nothing here is
mirrored, because the report payloads are **read**, never restated — `dump-routes`
**unchanged**, and the parity diff **empty with nothing re-based**, which it is by
construction: no DTO, no service and no query changed. The neighbouring gates:
`qa:p7a-cost-masters` 264/264, `qa:p7b-cost-allocations` 139/139,
`qa:p7c-cost-classes` 307/307, `qa:p7d-cost-reports` 169/169.

The whole browser lane is **`qa:money` 130 passed / 1 failed**, and the one
failure is **not this phase's**: `bill-reference-grid` (6) — *"search reaches the
rest"* — which passes **7/7 in isolation**, twice. Nothing here touches the
open-bills read, its `search` or its bounded window; what the lane adds is
position, and this lane is documented as over the ERP's 100 req/min per-IP
budget throughout (CLAUDE.md §11 — *"a new suite spends a budget that is already
gone"*), so a throttled search response arriving after that property's own 2.5 s
wait leaves the grid showing the page it had. Recorded rather than papered over:
widening someone else's timing on a hunch is how a flake becomes a rule nobody
can read.

⚠️ **And the sweep did not see the five new screens on that run** — Playwright
collects a spec's data at load, and `screens.ts` was edited mid-lane, so the
sweep went from `daily-cash` straight to `stock-ledger`. Run on its own
afterwards: **5/5**. Worth knowing before reading a green lane as coverage of a
list that changed while it ran.

#### What P8 inherits

- **P7 is complete.** The cost dimension has masters, figures, a template, five
  entry hosts, four reports, a reconciliation and a screen for every one of them.
- ⚠️ **The world is still empty by choice.** `costCentresApplicable` is `0` on
  every ledger of every company and the gate switches it back off; the feature
  is now reachable end to end by a customer who decides to use it, and no
  customer has. The first one to switch a ledger on is the first real
  measurement this dimension will get.
- ⚠️⚠️ **A browser gate over posted figures leaves a cancelled voucher per run**,
  and that is the standing cost of measuring a report that reads
  `cost_allocations`. It is figure-neutral — the pair nets to zero and
  `liveEntrySql` drops both — but it is not free, and a gate that ran on every
  commit would want a scratch company rather than company 28.

### P8a record — 2026-08-31

§3.4's leg table is data. `buildLegs` was a `switch` over fourteen voucher kinds
collapsing onto eight leg shapes; it is now **thirty-eight rows** in
`src/const/posting-rules.const.ts` and an interpreter over them, with an inclusive
validity window on every row. Same signature (plus an optional `onDate`), same
purity, same answers — **13,461 posted journal entries reproduced exactly**, and
the fifteen that are not are a declared exception with a name.

**Gate `npm run qa:p8a-posting-rules` — 16/16**, plus 54 unit tests in
`posting-rules.const.spec.ts`, shown to fail **seven** ways.

#### What was built

| | |
|---|---|
| `src/const/posting-rules.const.ts` | `PostingRule` · `POSTING_RULES` (38 rows) · `POSTING_EFFECT` · `AmountExpr` · `RuleWhen` · `evalAmount` · `ruleApplies` · `rulesFor` · `buildLegsFromRules` · `buildLegs` |
| `src/const/posting-rules.const.spec.ts` | 54 tests — the eight shapes restated by hand, all fourteen kinds, the dating, both throws |
| `scripts/qa-p8a-posting-rules.ts` | the gate — the plan's own sentence, plus four ties to the existing books |
| `src/const/posting.const.ts` | `buildLegs` removed; the vocabulary stays, with a note on why there is no re-export |
| `src/services/posting.service.ts` | one line — `post()` threads the voucher's own `date` into `buildLegs` |

#### ⚠️ Three things §3.4's own sketch got wrong, all measured

The sketch is
`legRole · side · amountExpr · headCode · effectiveFrom/effectiveTo`, with
`amountExpr` drawn from `'net' | 'tax' | 'grandTotal' | 'charge' | 'net+charges'`.

1. **It has no condition column, and reverse charge needs one.** D-52's RCM
   purchase is not a different voucher *kind* — it is the same kind with a boolean
   on the document, and that boolean does two things at once: it adds the
   `RcmPayable` leg **and** changes the party leg's amount from `grand` to
   `grand − taxTotal`. Neither is expressible by rows keyed on the kind alone. The
   tell is inside the sketch: `'net+charges'` is in that `amountExpr` list for no
   reason other than the RCM party leg, so the sketch had already met the problem
   and answered it by hard-coding one instance. `RuleWhen` is the general answer,
   and the party leg appears **twice** in the table at the same `seq`, exactly one
   of the two applying to any voucher.
2. **`headCode` belongs to role resolution, not to the leg table.** Which ledger a
   role lands on is `resolveRole`'s question and already goes through one seam
   (`resolveStatutoryLedger`, P2b‑3b). A `headCode` column here would be a second
   place deciding it — for the seven roles that are statutory and for none of the
   six that are not.
3. **`side: 'signed'` describes no leg this engine builds.** A negative charge
   does flip sides, but in `resolveLegs`, when the aggregate leg is expanded per
   charge row — the sign is per row and the aggregate has one side.

#### ⚠️⚠️ The dating belongs on the RULES, not on the heads — so `statutory_heads` retires before it is built

`resolveStatutoryLedger`'s own doc comment asks P8 for a dated head so *"a new
levy or a changed head is a seed row"*, and holds back its `onDate` parameter
until the `statutory_heads` table **"P8 introduces"**. Answered rather than
honoured, on two measurements:

- `acc_ledgers.systemKey` already **is** that table — **23 keys × 14 companies,
  exactly one row per key per company, maximum one everywhere.**
- A genuinely *new levy* needs a new `SystemGroupKey` **and** a rule that emits a
  leg for it. That is a code change whatever the head table looks like, so dating
  the head buys nothing the rule's own date does not.

A second table mapping code + date → ledger would be a second definition of a
fact `systemKey` already holds. So the signature stays narrow — which is that
comment's own rule (*"a half-wired signature is worse than a narrow one"*) — and
what carries a date is the leg set.

#### ⚠️ And the attractive way to use that dating is WRONG, which the gate measures

The gate's first run failed on **15 vouchers**: the interpreter builds the
post-D-52 shape (party `Cr 800`, `RcmPayable Cr 144`, five lines) where the books
hold `party Cr 944` in four lines. Measured: BUG-0069's own population — **15 RCM
purchases dated 2026-08-22 posted before D-52 landed, and 4 dated 2026-08-29
after it.** The books legitimately hold two shapes for one voucher kind under one
flag, because D-52 was ruled forward-only.

The fix that presents itself is to date the RCM rows to the day D-52 shipped.
Then all nineteen reproduce and the gate goes green. **It is wrong, and it is
wrong in a way this table makes newly dangerous:** a posting rule's
`effectiveFrom` is the date the **law** changed, not the date we implemented it.
§9(3) and §9(4) have applied since 2017, so dating those rows to our own
deployment would make a genuinely back-dated RCM purchase — a September invoice
entered in October — post the pre-D-52 shape. That is precisely the defect D-52
was filed to fix, restored *inside the rule table*, where it would read as
deliberate rather than as an omission.

So the fifteen are a **declared exception, held to a shape**: recognised by what
the books hold (party credited exactly `grandTotal` **and** no RCM leg at all,
one leg short of the interpreter's answer), never by a date or an id list. An
interpreter defect cannot pass through it, because it would not land on that
shape exactly — injection 3 proves it, failing (4b) as well as (1), (2) and (3).
And it is a **list**, so an allowance matching nothing fails as loudly as a
difference nobody allowed: `judge()`'s rule in `parity-snapshot.const.ts`, applied
one gate over.

Injection 7 is the demonstration. Dating the RCM rows by deployment day makes the
totals and the line counts **greener**, and is caught four ways — by (1), by (5),
by (4b)'s empty allowance, and first of all by (8)'s *"no shipped rule is dated"*,
the property that reads like a tautology and is in fact the guard against exactly
this.

#### ⚠️ The interpreter and the vocabulary cannot be one file, and the reason is a load order

`posting-rules.const.ts` imports `PostingVoucherKind`, `LegRole` and `round2` from
`posting.const.ts`, and `POSTING_RULES` is built **at module-evaluation time** out
of those enums. So a re-export of `buildLegs` from `posting.const.ts` — the
convenient thing, which would have left all four importers untouched — makes the
pair a **cycle**, and it is not a theoretical one: loaded one way round,
`posting.const.ts` evaluates first, its hoisted `require` of the rules runs before
its own enums are assigned, and `LegRole.Main` is a property of `undefined`;
loaded the other way round it works perfectly. §14's job-work provider cycle, one
layer down. `buildLegs` therefore lives with the rules it interprets and the four
importers were repointed.

#### ⚠️⚠️ §3.4 asked for a spec that does not exist

*"`posting.const.spec.ts` keeps testing it the same way"*. There is no
`posting.const.spec.ts`. `buildLegs` **is** tested — 21 tests in
`services/posting.service.spec.ts`, misfiled beside the service rather than beside
the rule, which is why the gap was invisible — and it covers Purchase, Sales,
Payment, Contra and reverse charge in real depth. **Receipt, Journal, Debit Note
and Credit Note have no assertion at all**, and the six no-GL kinds only as a
group. Testing the replacement *"the same way"* would have carried that hole into
the thing that replaces the switch, so `posting-rules.const.spec.ts` is exhaustive
over all fourteen kinds instead. The 21 existing tests were left where they are
and still pass unchanged, which is its own small parity statement.

#### The gate — sixteen properties

Property (1) is the plan's sentence: **5,040 comparisons** — 14 kinds × 24 amount
shapes × 3 flag states × 5 document dates — between the interpreter and
`legacySwitch`, the pre-P8a `buildLegs` **transcribed into the gate**, leg for
leg, role, side and paisa.

⚠️ **A restated switch is not enough on its own**, and this is the phase's
sharpest methodological point. Property (1) proves the interpreter equals a switch
*as transcribed by the person who deleted it* — and if that transcription is wrong
in the same way the rule table is wrong, both agree and the gate is green. That is
§13's P2b‑3c variant exactly. So properties (2)–(5) tie the interpreter to money
**nobody in this phase wrote**: the journal entries already in the books, every
one of them posted by the switch itself, months before this refactor. Those stored
lines *are* the switch's output and cannot inherit a transcription mistake.

- **(2)** Σ debit and Σ credit against `journal_entries.totalDebit`/`totalCredit`,
  9,761 entries.
- **(2b)** the same for the **3,700** payment, receipt, journal and contra
  entries. Left out of the first cut and put back deliberately: one debit, one
  credit, one amount is the simplest shape in the engine and therefore the easiest
  to omit — and an `amountExpr` naming the wrong field there produces a perfectly
  balanced two-leg entry for the wrong money.
- **(3)** the **line count**, with the aggregate charges leg expanded per
  `trx_charges` row the way `resolveLegs` expands it. This is the property that
  sees a leg dropped or added at a total that still balances — and it is what
  caught the RCM population, which (2) could not, because `grand − taxTotal` and
  `taxTotal` sum back to `grand` however wrongly they are split.
- **(4)** the reverse-charge party leg against the books' own party credit; **(4b)**
  the declared exception, held to its shape and required to be non-empty.
- **(5)** every entry re-posted with its own document date and with no date,
  compared — the threading is real and changes nothing today.
- **(6)** the dating **constructed**: a rule set where a journal's credit leg moves
  head on a date, asserted the day before, the day itself and later. Every shipped
  rule is open-ended, so this capability has no instance — P5b built `advance`,
  P5c‑3 the mixed voucher, P6 the closing stock, P7a the whole cost dimension, and
  a capability nobody exercises is one nobody has measured.
- **(7)** a `gl` kind with **no rule in force throws**, naming the kind and the
  day. This is the failure the switch's `default:` gave for free and a rule table
  loses: an empty leg set reads to `post()` as *"zero-value voucher, post
  nothing"* and approves a voucher that is numbered, printed and in no ledger.
  `POSTING_EFFECT` exists only to keep that distinction, and (8) ties it to the
  rules in both directions so it cannot become a stale list beside them.
- **(0)** the gate is **read-only** — stated because every gate since P5b
  constructs, and a reader is entitled to know which kind this one is.

⚠️ Building it found two defects in the gate itself, both of the shape this
programme keeps recording. It excluded **archived** vouchers (`t.deletedAt IS
NULL`, and a paranoid `findByPk`) — but §4.9 rule 2 is that a voucher which ever
posted *archives* rather than being erased, and its journal entry stays in the
books, so the exclusion silently skipped **470 of company 28's entries**, exactly
the rows that rule exists to keep. BUG-0038's shape, one file over. And injection
4 originally **crashed** the gate instead of failing a property, because a throw
from one kind abandoned the sweep over the other thirteen; a throw is drift now,
and is compared as a value.

#### Seven injections

| | | |
|---|---|---|
| 1 | the outward party leg flipped to `Cr` | 5 unit tests · (1) · (2), 5,613 entries adrift |
| 2 | the inward party leg credits `net` instead of `grand` | 3 unit tests · (1) · (2), 3,091 adrift |
| 3 | the `RcmPayable` rule removed | 2 unit tests · (1) · (2) · (3) · **(4b)** |
| 4 | `POSTING_EFFECT` marks a workflow document `gl` | 7 unit tests · (1), quoting the refusal |
| 5 | the tax legs reordered, `sgst` before `cgst` | 4 unit tests · **(1) alone** — (2) and (3) are blind to order, which is why (1) exists |
| 6 | the *"no rule in force"* throw removed | 1 unit test · (7) |
| 7 | the RCM rows dated by our deployment day | (1) · (5) · (8) · **(4b)** — and the totals get *greener* |

#### Cross-repo

`check-mirrors.js` **check 11 is a third, independent confirmation**, and it did
not need changing: it bundles `voucher-entry.const.ts` out of this repo and *runs*
`accountingRowPlan` — which calls `buildLegs` — against the frontend's restated
table, comparing **14 row plans**. It passes, from the other side of the repo
boundary, over the interpreter rather than the switch. All ten checks green.

#### Parity

No report, no query, no DTO and no service behaviour changed: the one edit in
`posting.service.ts` threads a date into a function whose answers are identical
over the whole population. The parity diff is empty **by construction**, and
properties (2)–(5) are a stronger statement than a report snapshot would be — they
compare 13,461 entries figure by figure against what the switch actually wrote,
where a snapshot compares aggregates.

`npm test` 2150/2150 · all five guards · `lint:ci` 0 errors · `nest build` clean.

### P8b‑1 record — 2026-09-01

§3.9's budgets exist and can be read. `budgets` + `budget_lines`, the pure rules,
the masters API, and the **Budget variance report** — every budgeted head with its
actual and variance beside it. The phase's own promise is a **negative** one and
that is what the gate leads with: §3.9 says *"no engine change at all"*, so a
budget must move no figure, and the three statements are captured with a budget
present and without it, figure by figure.

**Gate `npm run qa:p8b-budgets` — 30/30**, plus 53 unit tests in
`budget.const.spec.ts`, shown to fail **six** ways.

⚠️ **P8b split into two** on the same argument as the seven splits before it: the
tables and the report, then the screen. See the split table.

#### What was built

| | |
|---|---|
| `src/const/budget.const.ts` | `BudgetBasis` · `budgetTargetOf` · `describeBudgetLineBlock` · `describeBudgetBlock` · `describeBudgetLineSetBlock` · `compareToBudget` · `varianceDirection` · `varianceVerdict` · `budgetOverlaps` · `budgetWindow` · `describeBudgetDeleteBlock` |
| `src/entities/budget.entity.ts` · `budget-line.entity.ts` | + the scope registry, the model list and **four** hard-delete edges |
| `src/migrations/20260901200000-budgets.ts` | both tables + `chk_budget_lines_one_target`, idempotent both ways |
| `src/services/budget.service.ts` | the masters, with rule 7 at one seam |
| `src/services/budget-report.service.ts` | `GET /reports/budget-variance/:budgetId` |
| `src/controllers/budget.controller.ts` | 10 routes, own permission key `budgets` |
| `scripts/qa-p8b-budgets.ts` | the gate |

#### ⚠️ It is a REPORT, not a column on the statements — and §3.9 says "column"

Two measurements decided it, and both are on `BudgetReportService`'s own header. A
budget's lines are **sparse**: a company budgets twenty or fifty heads out of
1,383 ledgers, so a column on the Trial Balance is blank almost everywhere and a
reader scanning for it finds nothing. And a budget line may target a **cost
centre**, which appears on no statement at all — the statements are `acc_groups`
with `acc_ledgers` leaves (P3b) and a centre is a parallel dimension with no side
of the books (§3.7), so a column could carry two of the three target kinds and
would **silently drop the third**. Tally shows budget variance as its own view for
the same reason. The *column* is honoured literally: every row is budget · actual ·
variance side by side, over exactly the heads somebody budgeted.

#### ⚠️⚠️ The verdict is the one place an opinion is formed, and it refuses to guess

*Is this variance good?* is available for two of the four account natures and
genuinely not available for the other two. `varianceDirection` answers
`lower-is-favourable` for **Expense**, `higher-is-favourable` for **Income**, and
**`null` for Asset and Liability** — because a cash target wants to be exceeded
and a debtors target does not, and both are Assets; a borrowing limit wants to be
undershot and share capital overshot, and both are Liabilities. A report that
coloured an Asset overshoot red because an Expense overshoot is red would be
inventing an opinion about somebody's balance sheet.

That is the same call `applicableCategories` makes for a group with no nature: **a
rule that exists to inform must not invent the thing it is informing about.** A
nil variance also has no verdict, because calling it favourable would make every
head budgeted to zero and left alone a success story. And the direction is
**derived from the nature**, never stored on the line, so a head re-parented
across natures cannot leave a stale opinion behind — D-54's shape, and BUG-0034's
warning about copying a fact off a master.

⚠️ A cost centre therefore carries no nature, no direction and no verdict at all,
and the gate asserts all three.

#### ⚠️ Exactly one target, stated twice — and the CHECK is not the enforcement

A line naming two heads is two answers to *what is this budget on*, and they can
disagree. `chk_budget_lines_one_target` says so in the schema and
`describeBudgetLineBlock` says so in a sentence, and both are needed: a `CHECK` is
**parsed and silently ignored below MySQL 8.0.16**, so its presence in
`information_schema` proves nothing about what a given installation refuses. That
is P5c‑3's finding about `chk_trxprt_one_target`, and this gate follows its method
— it asserts the database by **inserting both forbidden shapes** (rolled back)
rather than by reading the schema.

Injection 3 shows why the sentence matters even where the CHECK bites: with the
service refusal removed the write still failed, and the message the caller got was
*"Check constraint 'chk_budget_lines_one_target' is violated"* — raw MySQL on the
wire, which is API-023's own defect.

#### Two smaller rulings, both deliberate

- **A budget of zero is allowed; a negative one is refused.** *"Budget nothing for
  entertainment"* is a real instruction. A negative target is the account's
  **nature** talking — which the head already states — so accepting one lets a
  budget disagree with the side of the books its own head sits on.
- **The period is required at both ends**, unlike a tax slab's validity (D-50)
  where an absent bound means *"still in force"* and is a real state. Here the
  closing-balance basis needs a last day to stand at and the nett-transactions
  basis a window to move within, so a half-open budget compares against nothing.
  A window that misses the budget entirely is **refused**, not answered with
  zeros — which would report every line as 100 % under.
- **`describeBudgetDeleteBlock` returns `null` unconditionally and exists to say
  so** — `describeClassDeleteBlock`'s shape one phase over. Nothing in the schema
  points at a `budgets` row: no journal line, no voucher, no allocation. If a
  future phase ever posts from a budget, that is the function which has to grow a
  reason.

#### The gate — thirty properties, and two of them nearly could not fail

Property (2) is the plan's promise: the Trial Balance, Balance Sheet and Profit &
Loss captured with a budget present and without it, **44 figures**, with
`rows.length > 0` beside `0 changed` so it is a claim about the budget rather than
about nothing. (3)–(5) tie each target kind's actual to the report that already
publishes that figure — the Ledger report, the Group Summary, and a Σ over
`cost_allocations` taken in the gate. (7) is the two forbidden INSERTs, (8) rule 7
from three angles, (11) the duplicate refusal, (9) the clipped window, (12) the
totals summed here.

⚠️ **Two properties were inert when first written, and the gate said so itself.**

- **(6), the two bases**, passed while reporting *"THEY ARE EQUAL on this fixture,
  so the pair above does not discriminate"* — the fixture's whole history fell
  inside the report window, so `closing` and `nett` were the same figure and a
  build ignoring the basis entirely would have passed. The fixture search now
  requires a ledger with **both** an opening balance and in-window movement, and
  (6) asserts out loud that it found one. P3d‑1's *"the fixture, not the
  assertion, was what could not fail"*, a second time.
- **(4b), the materialised-path trap, did not exist** and had to be added, because
  injection 2 — matching a group's subtree with `path + '%'` instead of
  `subtreePrefix(path)`, which is BUG-0023 exactly — **passed 30/30 against (4)
  alone.** The fixture's group was too deep to have a colliding sibling. Only 1 of
  the 14 companies has a primary group with a posted collision, so (4b) runs **in
  whichever company has it** rather than in the fixture's: the trap is a property
  of the path strings, not of a tenant, and requiring both conditions in one
  company is how a property comes to be skipped for ever. It computes the right
  figure and the wrong one in the gate, asserts they **differ** (₹0.00 against
  ₹1,43,300.00), and only then asserts which the report gives.
- ⚠️⚠️ And **(5) was being skipped entirely** — *"company 15 has no cost
  centre"*. An arm a gate reports as skipped is an arm nobody has measured. The
  fixture search now prefers a company that has one; and because the development
  database's 144 allocation rows **sum to 0.00** (they are cancelled pairs, which
  is the property a signed allocation buys), 0-against-0 would have passed on a
  build answering zero always — so **(5c) constructs a real ₹7,777.77 allocation**
  and reads the report inside the same transaction. That is why `budgetVariance`
  takes an optional read-only `Transaction`: P3c‑2's own device, for P3c‑2's own
  reason — the alternative is a gate that commits scratch figures into the books
  the parity harness captures next.

⚠️ **This gate commits, and says so.** `BudgetService` opens its own transaction —
as it should, since a budget and its lines are one write — so an outer rollback
cannot reach it, and driving the real service is worth more than isolation here.
It is safe in a way P7c‑3a's posted voucher was not, for the reason
`describeBudgetDeleteBlock` returns `null`: **a budget posts nothing and nothing
points at one**, so the cleanup is a delete that cannot be refused. The raw-SQL
probes that must not go through the service do roll back. Its scratch rows are
named from an **explicit list**, never a `LIKE 'QA·P8b%'` wildcard — P7d‑1's own
(0) went red on `QA·P8d2`, because a phase mark is a prefix of the next phase's
mark every time — and (0) is **census-relative** (BUG-0071).

#### Six injections

| | | |
|---|---|---|
| 1 | the two bases swapped | (3) · (4) · both of (6)'s figure checks |
| 2 | a group subtree matched with `path + '%'` | **passed 30/30 at first** — see (4b) above; now fails, naming ₹1,43,300.00 |
| 3 | the exactly-one-target refusal removed | (7), and the message the caller gets is raw MySQL |
| 4 | `assertTargetsAreOurs` removed | (8) twice — *"did not refuse at all"* |
| 5 | the window clipping removed | (9) · (13) |
| 6 | saving a budget **posts a journal line** | **(2)**, naming 5 moved figures to the rupee |

#### Parity

No existing report, query or DTO changed; two new tables and one new route.
⚠️ **`check-mirrors.js` caught the one thing that was missing** —
`MODULE_BY_PERMISSION_KEY: 'budgets' is in client-back but missing from
client-front` — which is the check doing precisely its job across the repo
boundary, and it is fixed in the same commit. All ten checks green.

`npm test` 2203/2203 · all five guards · `lint:ci` 0 errors · `nest build` clean ·
`dump-routes` resolves all 10 routes · P8a's gate still 16/16.

### P8b‑2 record — 2026-09-01

**P8b is complete: a person can set a budget and read it against the actuals.**
`/transaction/masters/budgets` is the plan — a list of budgets, each expanding to
its target figures, with *Compare* beside it — and
`/transaction/reports/budget-variance` is §3.9's *"Budget variance column"* on the
budget's own rows. Every refusal the API makes is made in the browser first, in
the API's own words, **with no request leaving the page**.

**Gate `qa-artifacts/tests/ui/masters/budgets.ui.spec.ts` — 6/6**, shown to fail
**five** ways, two of which passed at first. `check-mirrors.js` gained **check 14**
(62 comparisons over 29 region cases, message text). Full `qa:screens` lane
**63/63**.

#### What was built

| | |
|---|---|
| `utils/budget-rules.util.ts` | the mirror of `budget.const.ts` — four refusals |
| `components/admin/transaction/budgets/` | the list, and `budget-add-edit/` (the header, the target grid, the two bases) |
| `components/admin/transaction/reports/budget-variance/` | the report |
| `core/navigation/navigation.config.ts` | Masters ▸ **Budgets** (`budgets`) and Reports ▸ **Budget Variance** (`reports`) |
| `scripts/check-mirrors.js` + `scripts/vectors/budget-rules.vectors.json` | check 14 |
| `qa-artifacts/tests/ui/masters/budgets.ui.spec.ts` · `budget-rules.ts` | the gate, and the rules restated a third time |

#### ⚠️ The mirror has no server-only arm, so *"no request went"* is the property

`cost-rules.util.ts` deliberately passes `allocationCount: null` — whether a
centre has been allocated to is a fact only the database has — so P7c‑2's gate had
to split its refusals into *the browser can decide this* and *leave it to the
server*. **Budgets have no such split.** Every budget rule is about the payload the
form is holding: how many targets a row names, whether its amount is negative,
whether the period runs backwards, whether two rows name one head. So the dialog
refuses all four with nothing on the wire, and the gate **counts the requests** —
because a 400 caught and toasted renders the same sentence in the same place, so
the sentence alone proves nothing about where the rule ran (P3d‑2's method).

The one rule that is genuinely the server's is §4.3 rule 7, and it is not
mirrorable in principle: the screen only ever offers ids it was given.

#### ⚠️⚠️ A mirror with no reader is not a mirror — and this phase shipped one for an hour

The first cut mirrored `varianceDirection`/`varianceVerdict` into the browser and
had check 14 compare them over every nature. They had **no reader**: the report
renders the `verdict` the API already sends on each row, and the browser copy was
consulted by one method (`verdictAgrees`) that nothing called.

**The gate found it by injection.** *"The screen invents a verdict for Asset and
Liability"*, applied to the browser copy, **passed 6/6** — two implementations
being held in step by a mirror check, only one of which could ever reach a screen.
That is §6.4's *"a mirror rule that cannot fail reads as coverage"* one layer up.

Both are deleted. A mirror exists so a screen does not offer what the server will
refuse; a verdict is not an offer, it is a figure's label computed once
server-side. What checks the rendering is `budget-rules.ts` in the harness — a
third copy typed by hand, compared against the `data-verdict` the screen actually
puts on each row — which is where a presentation rule belongs. Re-aimed at the
**server's** rule, the same injection fails the gate.

#### ⚠️ Three of the gate's own assertions could not fail, and it said so twice

- **The verdict property never exercised its own rendering half.** It budgeted the
  first four groups the picker offered, and Tally's tree starts Capital Account ·
  Loans · Current Liabilities · Fixed Assets — every one a balance-sheet nature,
  so `withVerdict` was **0** while the test passed its other assertion. The heads
  are now looked up **by nature** and selected by name: two that can be judged and
  two that cannot, so both halves are exercised on purpose rather than by luck.
  P3d‑1's *"the fixture, not the assertion, was what could not fail"*, a third
  time in this programme.
- **The window property asserted the budget's own period**, which the first half
  of the same sentence prints — so an injection deleting the *"compared over …"*
  half entirely passed 6/6. It now asks with a report window **narrower** than the
  budget, a date only the clipping can produce.
- **A fixture named "Compare" made four buttons match one selector.** Every button
  in a row carries the budget's name in its `aria-label` (*"Compare X with
  actuals"*, *"Alter X"*, *"Delete X"*, *"Show the target figures of X"*) — right
  for a screen reader, and fatal to a loose `getByRole('button', { name: /Compare/
  })` the moment the name contains that word. The selectors are exact now and the
  fixtures avoid the words they use.

#### The gate found two real defects in the screen, both a11y-shaped

- **A `mat-form-field` in a table cell has no width of its own.** `mat-form-field`
  is `display: inline-flex`, so inside a grid cell it shrinks to its content — and
  a label long enough to wrap then put its notched outline over the **trigger's
  centre**, which is the point a click lands on. The select was genuinely
  unclickable. §14's `.jwd__full` note is the same trap one module across.
- **The Add-a-line button's accessible name did not contain its visible text.**
  `aria-label="Add a budget line"` over a button reading *"Add a line"* fails WCAG
  **2.5.3 (Label in Name)**: a speech-input user saying what they can see cannot
  reach it, and a screen-reader user hears a different label from the one on
  screen. Found because the gate looked for the visible name — which is what a
  person would do.

#### ⚠️ It also cost another file's passing test, which is the honest way to learn §11

`qa:screens` is 68 serial browser tests sharing one 100-request-per-minute
per-IP bucket, and this file's first version did **two full SPA boots** in one
test. The lane went red — in `user-form.ui.spec.ts`, a file this phase never
touched, on a test that passed in isolation; and on the next run the casualty
**moved**, which is what tells a throttle flake from a defect. Cutting the second
boot (the clipped-window check now *replaces* the plain visit rather than
following it) put the lane back to **63/63**. §11's *"a new suite spends a budget
that is already gone — measure the lane, not only your own file"*, measured.

#### Five injections

| | | |
|---|---|---|
| 1 | the dialog stops refusing locally and lets the server 400 | (2) — the sentence arrives, from the wrong place |
| 2 | the **server** invents a verdict for Asset and Liability | (4). ⚠️ Aimed at the *browser* copy first, where it passed 6/6 — which is how the reader-less mirror was found |
| 3 | the report stops stating the window it used | (3). ⚠️ Passed at first; see above |
| 4 | the caption explaining the plain rows is removed | (4) — without it the absence of a colour reads as a rendering bug |
| 5 | the screen guesses a budget *might* be part of the books | (5) — the delete never leaves the page |

Plus `check-mirrors` check 14 shown to fail both ways: **DRIFT** when the browser
"improves" a wording, and **RULE CHANGED** when both sides drop the
Asset/Liability `null` together — the case a two-way parity check cannot see, and
§13.4's whole argument for a restated table.

#### Parity

No endpoint, no query, no DTO and no rule changed on the server: the parity diff
is **empty by construction**, and would be identical if the whole phase had been
deleted (§6.4's rule, P3d‑1's and P4c's own note). `npm run lint` 0 errors with the
breakpoint and token guards green · `ng build` clean · `qa:screens` 63/63 ·
`check-mirrors` all fourteen checks green · backend `npm test` 2203/2203 unchanged.

### P8c record — 2026-09-01

§3.9's interest exists: a pure calculator, per-ledger parameters, and the
**Interest Report**. And the phase's central clause is a **prohibition** —
*"posting it is an explicit Debit Note the user accepts, **never automatic**"* —
so the gate leads with it: the three statements captured either side of a full set
of parameters on a real party ledger, and `journal_entries`/`journal_lines`
counted before and after, **while ₹1,47,740.48 of interest was claimed**.

**Gate `npm run qa:p8c-interest` — 28/28**, plus 47 unit tests in
`interest.const.spec.ts`, shown to fail **six** ways, two of which passed at
first.

#### What was built

| | |
|---|---|
| `src/const/interest.const.ts` | `InterestStyle` · `InterestBasis` · `COMPOUND_INTERVALS` · `daysBetween` · `interestStartsOn` · `interestOn` · `interestOnAll` · `describeInterestTermsBlock` |
| `src/entities/interest-term.entity.ts` · `migrations/20260901300000-interest-terms.ts` | + the scope registry, the model list and the hard-delete edge |
| `src/services/interest-term.service.ts` · `interest-report.service.ts` | the masters (upsert per ledger) and the report |
| routes | `GET|PUT|DELETE /acc-ledgers/:id/interest` · `GET /acc-ledgers/interest-terms` · `GET /reports/interest` |
| `scripts/qa-p8c-interest.ts` | the gate |

#### ⚠️ The day count is a CONVENTION, and choosing wrong is invisible

₹1,00,000 at 18 % for a quarter is **₹4,438.36** on actual/365 and **₹4,500.00**
on 30/360. Both are plausible, neither is rounder, and a customer disputing an
interest note argues from whichever convention their own contract names. So
`InterestBasis` is explicit, `daysBetween` is the only place either is
implemented, and the gate's property (5) asserts the two give **different**
figures on the same bills — because without that, (3) could be passing on a build
that ignored the basis entirely.

The 30/360 arm is **30E/360**: each day-of-month capped at 30, then
`360·Δy + 30·Δm + Δd`.

#### ⚠️⚠️ Nothing posts, and nothing decides to post

Interest on an overdue receivable is a **claim**, and whether a business presses
it against a particular customer is a commercial decision taken one customer at a
time — a ledger that quietly grew an interest charge every month would be a
company billing its customers by accident. There is no cron, no queue job and no
`PostingService` path that reaches `interest_terms`. The Debit Note is `POST /trx`
like any other, raised by a person who read the figure.

Property (7) is that clause as a measurement, and **injection 6** — making the
report post a Debit Note — is caught by two properties at once.

#### ⚠️ §3.9's "and over the running balance otherwise" is not implemented, and that is not an omission

Since P5b **every** party line carries a bill reference — an unallocated receipt
becomes an `advance` or `on-account` row rather than nothing — so *"otherwise"* is
an empty case on this schema. A second code path over the running balance would
be a derivation with no population, and the two would disagree the first time one
of them was wrong. Interest is charged on `bill_references`, which is a
**partition** of the journal lines a party's balance is made of (§3.6), so the
figure it charges reconciles by construction rather than being a second derivation
of the balance.

#### ⚠️⚠️ There is no due date anywhere, so the report says which date it used

`dueDate` is measured **NULL on all 11,350 `bill_references` rows and all 11,432
`trx` rows**: P5a's backfill wrote amounts and ledgers, not terms, and no voucher
has ever carried one. So the effective date falls back to the bill's own posting
date, every line carries a `fromSource`, and the payload states how many lines
used it — because a report that silently used the bill date would look like it was
applying credit terms somebody had set. On this database that count equals the
line count, and the gate's (1) asserts the *absence* so the day a due date appears
this stops being true loudly.

#### Its own table, not four columns on `acc_ledgers`

Two reasons. **`acc_ledgers` is not widened** — every figure-bearing report
resolves through it (P2b‑2) and P8c's claim is that it moves no figure. And
**absence is the meaningful state**: a ledger with no row charges no interest,
which is a *state* rather than a rate of zero, and it is what
`describeInterestTermsBlock` tells an operator who tries to store a negative rate
(*"a ledger that should charge nothing has no interest parameters at all"*).
Nullable columns would make that distinction a convention instead of a shape.
`ON DELETE CASCADE` on the ledger — the opposite of `budget_lines`' `RESTRICT`,
because interest parameters are the ledger's own property and leave no figure
behind to misread.

#### The spec caught two defects in the rule, and the gate caught a third

- **The compounding interval accepted any whole 1–12 while the refusal said
  *"1, 3, 6 or 12"***. A stored 5 was legal and unmentionable. The set is closed
  now (`COMPOUND_INTERVALS`) — the sentence is the contract, which is check 10's
  own argument.
- **An absent interval degraded to MONTHLY.** `Math.max(1, …)` looked like a
  divide-by-zero guard and was in fact the most aggressive charge available,
  arrived at by accident, on the one path where nobody stated an interval. It
  degrades to **annual** now, the least aggressive of the four.
- **`billsWithoutDueDate` counted 6 where the table showed 4** — the counter ran
  inside the map and the fully-settled bills were filtered off afterwards, so the
  report described rows the reader cannot see. Caught by the very property that
  exists to make that number visible.

#### ⚠️ Two of the gate's own properties could not fail, and one was pure ceremony

- **Property (2) compared the gate against itself.** It checked `daysHere` — this
  file's restatement — against this file's own literals, and never touched
  `daysBetween`: the injection removing the 30/360 day-of-month cap **passed
  27/27** while failing two unit tests. It is **three-way** now — literal,
  restatement, implementation — which is the shape `check-mirrors.js` uses for
  every rule it compares.
- **The cap test used two 31sts, where the cap cancels.** `31 → 31` is 60 days
  whether or not each end is capped, so the assertion was arithmetically incapable
  of seeing the bug. Both the spec and the gate now carry the **asymmetric** cases
  (`31 Jan → 1 Mar` is 31, `1 Jan → 31 Jan` is 29). Third instance of P3d‑1's
  *"the fixture, not the assertion, was what could not fail"* in this phase alone.

#### ⚠️⚠️ Three arms had no instance, and all three are constructed

- **A settlement later than its bill.** Measured: **all 2,848** `against`
  references are dated the same day as the bill they settle, so nothing in history
  exercises the `asOf` bound on settlements — the difference between charging
  interest on a bill that was open on the as-at date and quietly netting off a
  payment made three months later. Built in a rolled-back transaction, read
  through the report's optional read-only `Transaction` (P3c‑2's device), and
  asserted in **both** directions: open in full the day before, reduced on the day.
- **A live bill reference on a reversed entry.** Measured: **0** exist, because
  P5c‑2 retires a reference by soft-deleting it and
  `qa:p5-bill-register` (11) asserts that both ways — so `b.deletedAt IS NULL`
  already excludes every cancelled document and removing `liveEntrySql` from this
  service changed **nothing** (injection 5 passed 27/27 with the edit verified as
  applied). The predicate stays, as two independent reasons not to bill a customer
  for a cancelled invoice, and the one shape that separates them is now built.
- **The retired-bill exclusion** ran nowhere on the fixture's ledger and printed
  *"skipped"*. It runs **in whichever company has one**, like P8b's (4b) — an arm
  a gate reports as skipped is an arm nobody has measured.

#### Six injections

| | | |
|---|---|---|
| 1 | the 30/360 basis divides by 365 | 7 unit tests · (4) · (5)'s direction check |
| 2 | the 30/360 day-of-month cap removed | ⚠️ **passed 27/27 at first** — see above; now 2 unit tests · (2), naming the exact day |
| 3 | grace stops moving the start | 2 unit tests · (6) twice |
| 4 | the leftover period compounds instead of running simple | 2 unit tests · (4), to the paisa |
| 5 | `liveEntrySql` removed from the report | ⚠️ **passed 27/27 at first**, edit verified — now (8)'s constructed case |
| 6 | the report posts a Debit Note | **(7)** and **(0)** — §3.9's own prohibition |

`npm test` 2250/2250 · all five guards · `lint:ci` 0 errors · `nest build` clean ·
`dump-routes` resolves all five routes · P8a 16/16 and P8b 30/30 still green ·
`check-mirrors` all fourteen checks green. The parity diff is **empty by
construction**: no existing report, query or DTO changed, one new table and five
new routes.

⚠️ **No screen yet, and it is recorded rather than implied.** The Interest Report
and the per-ledger parameters have an API and no caller — BUG-0068's *"an endpoint
nothing calls is an endpoint nobody has run"*, with this gate as the only thing
that has ever run them. P8c‑2 is those two screens.

### P8c‑2 record — 2026-09-01

**P8c is complete: a person can set a rate and read what it claims.** A ledger's
interest parameters open from its own row on the Chart of Accounts, and
`/transaction/reports/interest` is the Interest Report — which says **in words**
that it claims rather than charges, because the absence of a *Post* button is not
a statement.

**Gate `qa-artifacts/tests/ui/masters/interest.ui.spec.ts` — 3/3**, three
injections. `check-mirrors.js` gained **check 15** (151 comparisons over 10 region
cases). Full `qa:screens` lane **66/66**.

#### What was built

| | |
|---|---|
| `utils/interest-rules.util.ts` | the mirror — the **refusal only**, see below |
| `components/admin/transaction/ledgers/interest-dialog/` | the parameters, opened from the ledger row |
| `components/admin/transaction/reports/interest/` | the report |
| `core/navigation/navigation.config.ts` | Reports ▸ **Interest** (`reports`) |
| `scripts/check-mirrors.js` + `scripts/vectors/interest-rules.vectors.json` | check 15 |

#### ⚠️ Two permission keys, on purpose

The rate is `acc-ledgers` — a ledger's own property — and the report is `reports`.
**A role that may read what is owed must not be able to quietly change what is
charged**, which is why the dialog opens from the ledger grid rather than from the
report it feeds.

#### ⚠️⚠️ Only the REFUSAL is mirrored, and P8b‑2 is why

`interestOn`, `daysBetween` and the two day-count conventions live server-side
alone. The Interest Report renders figures the server computed and the browser
never recomputes one, so a second copy would be a rule with **no reader** — which
P8b‑2 shipped (a `varianceVerdict` copy nothing called) and whose own gate proved
by injecting a wrong verdict into it and passing 6/6. **A mirror exists so a
screen does not OFFER what the server will refuse; a computed figure is not an
offer.** `describeInterestTermsBlock` *is* mirrored, because the dialog genuinely
uses it to refuse a rate before the request leaves the page — counted, not
assumed.

Check 15's own note carries the argument, and the vector table's `__notMirrored`
key repeats it where somebody adding a rule would look.

#### The screen states what the design refuses to do

- **The caption**, not the missing button: *"Interest here is calculated and
  claimed, never charged."* §3.9's *"an explicit Debit Note the user accepts,
  never automatic"* is a design decision, and a reader who cannot find a Post
  button learns nothing from its absence.
- **The action is *Raise a debit note***, and it **navigates to a blank one**
  rather than creating it. A button that posted would be the automatic charge
  this whole design refuses.
- **Every line names the date it ran from**, and the report says how many used
  the bill's own date — which on this database is all of them, because no due
  date exists anywhere. A report that used it silently would look like it was
  applying credit terms somebody had set.
- **No grand total across ledgers**, with a caption saying why: interest on a
  customer is owed *to* you and on a supplier *by* you. The same pair the
  Category Summary carries (P7d‑2) — the API says it by having no field, the
  screen says it in words.
- ***Charge no interest*** is a first-class action beside *Save*, because
  **absence is the meaningful state**. A screen expecting an operator to express
  *"never"* as `0` would leave a ledger that looks configured and charges
  nothing — the shape the negative-rate refusal exists to prevent.

#### ⚠️ The gate found a real defect: `computed()` over a reactive form is not reactive

`isCompound` was a `computed(() => this.form.getRawValue().style === 'compound')`.
A reactive form's value is **not a signal**, so the computed had nothing to track:
it evaluated once, cached, and never recomputed — the compounding-interval field
simply never appeared when the style was switched, on a screen that looked
entirely correct. It is a `signal` set in `judge()` now, which already runs on
`valueChanges`. **A `computed()` is only as reactive as its narrowest source.**

#### And two selector traps the harness had already written down

- **`<mat-table>` has no `<tbody>`.** `parity.ts`'s own header records it —
  *"a `table tbody tr` selector matches nothing even while the grid is on
  screen"* — and this file's first version used exactly that, which reads like a
  broken screen. `rowContaining` is the shared handle, and `toolbar.search` is
  `input[aria-label="Search records"]`.
- **`td.num` is not only the figures.** The Actions cell was right-aligned too,
  so `last()` read the button's own text (*"post_add Raise a debit note"*) and the
  en-IN shape assertion failed on a perfectly correct screen. The cell carries
  `.int__action` now — it is not a figure.

#### ⚠️⚠️ And a test that failed for the wrong reason

Test 1 asserted the **column defaults** (`style: 'simple'`, `basis: 'actual-365'`)
after saving a rate — a real property, since a DTO initialiser would supply them
on every `PUT` (BUG-0020). A leftover from an earlier failed run made the dialog
load somebody else's `compound`, and the test failed four assertions later on a
message about a column default that said nothing about what went wrong. It now
asserts its **precondition** — that this ledger opens with no parameters and no
*Charge no interest* button — so a leftover fails at the point it actually
matters.

#### Three injections

| | | |
|---|---|---|
| 1 | the dialog lets a refused rate through to the server | (1) — Save is live where it must be dead |
| 2 | the report stops saying it claims rather than charges | (2) |
| 3 | *Charge no interest* zeroes the rate instead of removing the row | (3) — a row survives where there must be none |

Plus check 15 shown to fail both ways: **DRIFT** when the browser shortens a
sentence, and **RULE CHANGED** when both sides open the closed compounding set
together — the case a two-way parity check cannot see.

#### Parity

No endpoint, no query, no DTO and no server rule changed: the parity diff is
**empty by construction**. `npm run lint` 0 errors with the breakpoint and token
guards green · `ng build` clean · `qa:screens` **66/66** · `check-mirrors` all
fifteen checks green · `qa:p8c-interest` still 28/28.

### P8d record — 2026-09-01

§3.9's multi-currency exists: `currencies`, `exchange_rates`, three annotation
columns on `journal_lines`, and the **unrealised gain/loss report**. The phase's
claim is the one §3.9 makes in bold — *"`debit`/`credit` stay in base currency and
stay authoritative — every existing report is unaffected **by construction**"* —
and the gate verifies it **structurally** rather than by care.

**Gate `npm run qa:p8d-currency` — 26/26**, plus 49 unit tests in
`currency.const.spec.ts`, shown to fail **seven** ways, one of which passed at
first and **found a real defect**.

#### What was built

| | |
|---|---|
| `src/const/currency.const.ts` | `RateType` · `rateOn` · `toBase` · `toForeign` · `roundForCurrency` · `unrealisedOn` · `unrealisedVerdict` · four `describe*Block` refusals |
| `src/entities/currency.entity.ts` · `exchange-rate.entity.ts` | + the scope registry, the model list and **two** hard-delete edges |
| `migrations/20260901400000-currencies.ts` | both tables, and `currencyId · fcAmount · rate` on `journal_lines` |
| `src/services/currency.service.ts` · `revaluation-report.service.ts` | the masters and the report |
| routes | `GET\|POST\|PUT\|DELETE /currencies…` · `GET /reports/revaluation` |
| `scripts/qa-p8d-currency.ts` | the gate |

#### ⚠️ "By construction" is a property of the schema, and this is what makes it one

The three new columns are **nullable and were not backfilled**. A line with no
`currencyId` **is** a base-currency line, so:

- **45,460 existing rows were not touched.** Backfilling a base-currency id would
  have been 45,460 writes to the busiest table in the schema to record a fact that
  was already true.
- Every figure-bearing report reads `debit`/`credit`, which did not change — so
  the Trial Balance, the Balance Sheet, the P&L, the cost reports and the bill
  register answer exactly what they answered before, **not by care but because the
  columns they read did not change**.
- `ADD COLUMN` of a nullable column with no default is `ALGORITHM=INSTANT` on
  MySQL 8, so the table was not rebuilt either.

Measured after the migration: **45,460 lines, 0 annotated, Σ Dr = Σ Cr =
₹6,21,920,688,281.08** — unchanged. That census is the gate's property (1), and
injection 7 (a backfill actually happening) fails it.

It is the same shape `interest_terms` uses one sub-phase earlier: **absence is a
state**, not a value waiting to be filled in.

#### ⚠️⚠️ The base currency is a row with a flag, and it is immovable

Tally does the same, and it keeps one definition of what a currency is — a
`companies.baseCurrency` string beside a `currencies` table would be two.
`describeBaseCurrencyBlock` refuses to move the flag once anything has posted, and
it is the most consequential refusal in the phase: **every figure in
`journal_lines` is denominated in the base currency implicitly** — there is no
column saying so, which is precisely why `currencyId` can be nullable — so
re-pointing it would silently restate the whole ledger, every statement and every
filed return.

⚠️ **And the first cut applied that rule to `update` alone.** Creating a *new*
currency and marking it base is the same restatement by the other door, and
`create` walked straight past it. Found by **injection 6, which passed**: removing
`claimBase` from `create` changed nothing the gate could see, because the gate
never created a second base currency, because nothing made that worth testing.
§13's standing shape — one rule enforced where somebody thought of it — on the two
doors a person comes in through, which is exactly what
`describeLedgerPlacementBlock` and `describeLedgerMoveBlock` say about `create`
and `move` one master over. The rule is on both now and the gate asserts both.

#### Three rulings worth carrying

- **A rate is not interpolated, and not extrapolated backwards.** A quote stands
  until the next one; a date before the first has **no rate at all**, because
  valuing a 2019 invoice at a 2026 rate is a figure nobody quoted presented as a
  fact. There is deliberately no `effectiveTo` — an end date would be a second
  statement about the same thing, and the two could disagree.
- **The posted base is READ, never recomputed.** Multiplying `fcAmount × rate`
  again answers a hair differently wherever the original rounding fell, and that
  hair would be reported as an exchange movement that never happened — BUG-0069's
  doctrine: *where a figure has been posted, read the posting.* Injection 3
  measures it.
- **Nothing posts.** *"Computed on demand"* means a report, exactly as interest is
  (P8c), and for the same reason: a revaluation is a judgement about a closing
  rate on a particular day, and a ledger that quietly revalued itself every night
  would be a company restating its own accounts without a decision.

⚠️ A currency with **no quoted rate** on the date is reported as such and
**counted** on the payload, never shown as *"no movement"* — which would
understate an exposure to precisely the currency whose rates nobody has kept up.

#### And two smaller ones

- **Not every currency has two decimal places.** The yen has none, the Kuwaiti
  dinar three; `roundForCurrency` takes the currency's own precision, while the
  **base** amounts stay `DECIMAL(14,2)`. A rate is `DECIMAL(18,8)` because it is
  not money — it is multiplied by a principal, so a rounding there is amplified by
  the amount.
- **A currency code is validated by SHAPE, not against a list.** There are 180 ISO
  codes and they change by treaty; three capitals still refuses `usd`, `Rs` and
  `$`, and a company trading in one this app has never heard of does not wait for
  a release.

#### ⚠️ Two of the gate's own properties could not fail, and one passed vacuously

The fixture took the first posted line in the company, whose entry was dated after
every date the gate asks about — so the ledger fell outside `je.date <= :asOf`
entirely. **(9) failed with `undefined` and (7) PASSED**, because *"the row has no
rate"* and *"there is no row"* are the same `undefined` to a `!row ||` check. The
fixture is bounded now and both properties assert the row is actually there.

That is P3d‑1's *"the fixture, not the assertion, was what could not fail"* for
the fifth time in P8 — and the second time in this programme that a **lenient
null check** turned an absent fixture into a green line.

#### The unit spec was wrong about the language, not about the code

It asserted `toBase(1.005, 1) === 1.01`. `1.005` is stored as
`1.00499999999999989…`, so `Math.round(100.4999…)` is `100` and the answer is
`1.00`. Left alone deliberately: `round2`'s `Math.round(n × 100) / 100` is what
**every** money figure in this application uses, and making currency conversion
round decimal halves differently would put it out of step with posting, tax and
cost allocation — a far worse defect than a paisa nobody can observe without
constructing it. The spec asserts a **true binary half** (`0.125 → 0.13`) and the
decimal one against `round2` itself.

#### Seven injections

| | | |
|---|---|---|
| 1 | the report takes the earliest quote instead of the latest | (4) · (4b) · (4c) · (6) · (9) |
| 2 | the rate lookup ignores the as-at date | (9) · (7) |
| 3 | the difference recomputes the posted base | 1 unit test · (4c) |
| 4 | the base currency becomes movable after posting | 1 unit test · (11) |
| 5 | the revaluation stops excluding cancelled vouchers | (8) |
| 6 | the base rule removed from `create` | ⚠️ **passed 24/24 at first — and the code was wrong, not the gate.** Now (10b) · (11b) · (12) · (13) |
| 7 | the annotation columns get backfilled | **(1)**, the phase's own claim |

`npm test` 2299/2299 · all five guards · `lint:ci` 0 errors · `nest build` clean ·
`dump-routes` resolves all six routes and 784 in total · P8a 16/16, P8b 30/30 and
P8c 28/28 still green · `check-mirrors` all fifteen checks green.

⚠️ **No screen, and it is recorded rather than implied.** The currencies, the
rate table and the revaluation report have an API and no caller — BUG-0068's *"an
endpoint nothing calls is an endpoint nobody has run"*, with this gate as the only
thing that has run them. P8d‑2 is those screens — **landed**, and building them
found [BUG-0072](../qa-artifacts/docs/bugs/BUG-0072.md), which is what a caller is
for.

### P8d‑2 record — 2026-09-01

**P8d has screens.** The currencies, their dated quotes and the unrealised
gain/loss report had an API and **no caller** — BUG-0068's *"an endpoint nothing
calls is an endpoint nobody has run"*, with `qa:p8d-currency` as the only thing
that had ever run them. P8d‑2 is the callers.

**Gate `npm run qa:screens` — `currencies.ui.spec.ts` 3/3**, shown to fail
**six** ways, plus `check-mirrors` **check 16** (112 behavioural comparisons over
15 region cases across four refusals), shown to fail three ways.

#### What was built

| | |
|---|---|
| `client-front/src/utils/currency-rules.util.ts` | the four `describe*Block` refusals mirrored, `RateType` as data, `rateTypeLabel` |
| `components/admin/transaction/currencies/` | the masters screen + `currency-add-edit` + `rate-add-edit` |
| `components/admin/transaction/reports/revaluation/` | the report's screen |
| `masters.routes.ts` · `reports.routes.ts` · `navigation.config.ts` | Masters ▸ **Currencies** (`acc-ledgers`) · Reports ▸ **Revaluation** (`reports`) |
| `scripts/vectors/currency-rules.vectors.json` · `check-mirrors.js` check 16 | the shared table and the comparator |
| `qa-artifacts/tests/ui/masters/currency-rules.ts` · `currencies.ui.spec.ts` | the restated third copy, and the gate |

#### ⚠️ Two keys, and it is the same split P8c‑2 made one master over

The masters carry **`acc-ledgers`** and the report carries **`reports`**. Not a
key of its own: the base currency **is** the unit every figure in the chart of
accounts is stated in, so a role that may shape the chart is the role that
decides this, and a separate key would be one more row in every company's
permission matrix for a screen with no independent audience. The split itself is
P8c‑2's sentence with one noun changed — *a role that may read an exposure must
not be able to change the rate it is measured at.*

#### ⚠️⚠️ Two of the four refusals are the SERVER's, and the gate measures the split

`describeBaseCurrencyBlock` turns on *"has this company posted anything?"* and
`describeCurrencyDeleteBlock`'s second arm on *"how many posted lines name this
currency?"*. Neither figure is on any payload the currencies screen reads, so
both are passed **`null`** — *"not known here"* — which is P3d‑2's `hasPostings`
ruling and P7c‑2's `allocationCount: null`, and the vector table states it as a
rule rather than leaving it an accident of two signatures.

What the gate adds is that **both halves are asserted at once**, in the same
test: the dialog shows the consequence, **Save stays live**, the request goes,
and the server's sentence comes back over the wire — with `requestsDuring`
counting, so *"a request has to have gone"* is measured rather than assumed.
Injection 3 is the browser guessing that refusal, and it fails on both halves.

#### 🐞 The phase's real find: two soft deletes into a unique index

[BUG-0072](../qa-artifacts/docs/bugs/BUG-0072.md). `CurrencyService.remove` and
`.removeRate` were paranoid, and both tables carry a unique index that **counts
the tombstone** while Sequelize's paranoid read does not. Measured through the
real API:

```
DELETE /currencies/48        → 200 {"removed":true}   (row 48 still there, deletedAt set)
POST   /currencies {"QAX"}   → 409 "A record with this uq_currencies_company_code already exists"
```

There is **no way back**: no restore route, no archived view, and `findByPk` is
paranoid in `remove` and `update` too — so deleting `USD` by mistake made `USD`
permanently uncreatable in that company, and correcting a wrong quote by removing
it made that `(currency, type, day)` unquotable for ever. The message recited the
name of a database index, which is API-023's family.

⚠️ **The fix is a hard delete, and that is not a relaxation of §4.9 rule 2 — it
is what the refusal above it had already decided.** `describeCurrencyDeleteBlock`
refuses a currency any posted line names (*"It can be made inactive, not
erased"*), with `journal_lines.currencyId` `RESTRICT` behind it, so the delete
that reaches `destroy()` is by construction on a currency the books do not
mention. There is no evidence to keep, exactly as `describeBudgetDeleteBlock`
(P8b) has nothing to bite on. A quote is the same argument by a different route:
a posted line stores the rate it was posted at in its **own** column and every
reader reads that (BUG-0069), so an `exchange_rates` row values nothing already
in the books.

⚠️⚠️ **And the recovery shipped with it**, because a database that ran the old
code is otherwise wedged with no migration to unwedge it: `upsertRate` and
`create` read with `paranoid: false` and revive a tombstone. `create` refuses a
**live** duplicate in a sentence of its own (*"QAX is already one of this
company's currencies."*) rather than letting the unique index answer — a create
that silently updated a live row would be a save nobody asked for.

**The generalisation is worth carrying:** a paranoid model under a unique index
is a dead end unless one of three things exists — a restore route, a
`paranoid: false` read at the write seam, or the recognition that the delete is
only ever reached when there is nothing to preserve. Here none of them did.
P7c‑2's sweep note is the same trap on `cost_categories`, and it was reachable
only by a test; this one was reachable by a customer.

#### ⚠️ The report can only ever be empty, and the screen says so rather than implying it

**Nothing writes `journal_lines.currencyId`.** P8d added the three annotation
columns and **no voucher states a currency** — measured, 0 annotated of 45,460 —
so a foreign exposure can exist only inside a gate's own transaction. That is not
a defect in P8d, whose claim was precisely that the columns move no figure; it is
a **feature that has not been built**, and this record names it rather than
leaving a blank report to be read as one.

So the empty state names which of the three ingredients is missing — no base
currency, no quote, or no annotated line — because *"no rows"* is the same
picture whichever it is. The `noBaseCurrency` flag the API already carried
acquired its first reader here.

⚠️ **What is deferred is a voucher-level currency field**: a DTO, a posting
change and an entry-screen control, which is a phase and not a screen. Until it
lands the annotation is reachable only through a direct write.

#### The gate, and the six injections

| | | |
|---|---|---|
| 1 | the currency dialog stops mirroring its refusal | (1) |
| 2 | the base-flag warning is removed | (1) |
| 3 | the browser **guesses** the base refusal and disables Save | (1), on both halves |
| 4 | the rate dialog stops mirroring, so a zero rate becomes a server 400 | (2) |
| 5 | the report drops *"computed, never posted"* | (3) |
| 6 | the rate basis stops reaching the URL | (3) |

and check 16's three: a one-word wording change on the front (**DRIFT**), the
base refusal removed from **both** sides (**RULE CHANGED**), and a fourth
`RateType` on one side — caught **twice**, once by the data comparison and once
by the `bad-type` vector, because `mid` is in that vector for exactly this.

#### ⚠️⚠️ Injection 1 passed twice, and the instrument was the defect

P7c‑2's injection 4 a second time — *the dev server had not rebuilt, so the
browser was running the code the edit had replaced* — except that here the
**rebuild-waiter itself** was the reason. It looped on bash's `SECONDS`; zsh's
`SECONDS` is a float, `[ "$SECONDS" -lt "$end" ]` is an integer-expression error,
so the loop never ran and every wait reported *"no rebuild"* instantly while the
injection went untested. Two passes were spent before the waiter was fixed to use
`date +%s`. **A harness that cannot wait is a harness that cannot fail**, and the
tell was that it reported the failure it was written to report.

#### The screen census had five holes, and this commit closes them

`tests/ui/masters/screens.ts`' own header says it: *"the silent one is a route
MISSING from the census, because an unswept screen looks exactly like a screen
that passed."* Neither P8b‑2's two screens nor P8c‑2's two were ever added.
Five entries now — Masters ▸ Budgets and Currencies, Reports ▸ Budget Variance,
Interest and Revaluation — each carrying **why** it is empty in this world,
which differs per screen: no company has a budget, no ledger carries interest
parameters, and no journal line records a currency at all. `qa:screens` **32/32**
(was 30), and all three new report entries pass in `qa:money`'s sweep.

⚠️ **That sweep is 46/60, and the 14 failures are NOT this phase's** — every one
is a **voucher list**, and each says *"the list is empty before any search, so
narrowing proves nothing"*. Measured rather than assumed: reverting P8d‑2's four
modified frontend files reproduces the failure exactly, and the request the
browser sends explains it —

```
filters.date: dateAfter 2026-08-30T18:30Z · dateBefore 2026-09-01T18:30Z   → totalItems 0
{"page":1,"pageSize":3}                                                     → totalItems 3661
```

— so a voucher list opens on a **yesterday-to-today window**, and the QA world's
newest sales voucher is older than that. It is a **calendar artefact of the
fixture** that arrived when the clock did, not a defect in a screen and not
something P8d‑2 touched. Recorded here rather than folded into this phase's
numbers: whether a voucher list should default to two days is a product question,
and whether the census should assert data through a default window is the
harness's.

### P8e record — 2026-09-01

**P8 is complete.** §3.9's scenarios exist: a named set of postings that are
*"includable in a report without being in the books"*. That phrase is two claims
and the gate is built round both — a real, balanced, provisional entry is
**invisible** to the three statements, and the same statements **move by exactly
that figure** when the scenario is asked for. A gate that only checked the first
would pass on a scenario that does nothing.

**Gate `npm run qa:p8e-scenarios` — 21/21**, plus 17 unit tests in
`scenario.const.spec.ts`, shown to fail **five** ways.

#### What was built

| | |
|---|---|
| `src/const/scenario.const.ts` | `ScenarioKind` · `scenarioSql` · `describeScenarioBlock` · `describeScenarioDeleteBlock` · `describeScenarioMoveBlock` |
| `src/entities/scenario.entity.ts` · `migrations/20260901500000-scenarios.ts` | the table, and `journal_entries.scenarioId` |
| `src/const/posting.const.ts` | **`liveEntrySql` gained the exclusion** — one edit, 57 callers |
| `src/services/scenario.service.ts` · `controllers/scenario.controller.ts` | the masters, and `resolveForReport` |
| `src/services/reports.service.ts` | `scenarioId` threaded through `statementTree`, the seam all three statements share |
| `scripts/qa-p8e-scenarios.ts` | the gate |

#### ⚠️ §3.9 puts the flag on the voucher TYPE, and this schema cannot

Tally's voucher types are **user-definable** — a company creates a *Memorandum* or
*Provisional Sales* type and marks it optional, so *"the type is optional"* names a
set somebody chose. This application's are a **fixed enum of fourteen system
kinds**, with `transaction_configurations` holding one row per kind per company
(196 rows, none user-created). A flag there would mean *"every sale is
provisional"*, which is not a feature anybody wants.

So the flag is on the **document**: `journal_entries.scenarioId`. That is also
what Tally's own `Ctrl+L` marks — the type-level flag exists there because Tally
has no per-voucher scenario link, and this schema does. Same finding as §3.4's
sketch (P8a) and P4e‑1's *"the plan said it was not representable"*: the
measurement stands, the mechanism does not.

#### ⚠️⚠️ The exclusion is inside `liveEntrySql`, and that is the whole design

`liveEntrySql` is the single most load-bearing fragment in the reporting layer —
its own doc says so — and it is inlined by **57** callers. Putting the scenario
predicate inside it means **every** report, dashboard and register excludes
provisional figures **without being told**, which is the only safe default: a
report that had to remember would eventually be a report that forgot. That is
BUG-0065's rule again — *the safe behaviour has to be the one you get for free*.

And it moved nothing: `scenarioId` is `NULL` on all **15,474** existing entries,
so the widened predicate answers exactly what it answered before. P8d's *"by
construction"* proof, one sub-phase later, and the gate's (1) is that census.

#### A scenario is never a second set of books

It has **no entries of its own** — `journal_entries.scenarioId` marks an
*ordinary* entry as out of the accounts — so a scenario report is the one ledger
with some extra rows. Nothing here duplicates a balance, a cache or a chart of
accounts, and a scenario cannot drift from the books it annotates.

#### Three rulings

- **An unknown or inactive scenario is REFUSED, not ignored.** A reader looking at
  a report they believe includes a forecast must not be handed the ordinary books
  instead — the call `checkDataTypeAndFilterType` makes about an unknown filter
  column (§10), where a silently-dropped predicate returns the unfiltered table to
  somebody who asked for a subset.
- **A scenario holding entries archives**, and the reason is unusual enough to be
  worth the sentence: not that the rows are evidence, but that erasing it would
  **change what the surviving rows mean**. An entry whose `scenarioId` pointed at
  nothing would be excluded by the default (it carries a scenario) and included by
  no scenario (there is none) — invisible to every report *and* in none of them.
- **A posted entry cannot be moved in or out of one** (`describeScenarioMoveBlock`).
  That would restate the accounts by editing one column, with no voucher, no
  reversal and nothing in the audit trail saying a figure moved —
  `describeBaseCurrencyBlock`'s argument (P8d) about a different column.

#### ⚠️ Two of the gate's own properties failed for reasons that were the TEST's

- **(4) reported that the `?view=ledger` toggle "ignored the scenario"**, and it
  did not. `ledgerTrialBalance` had no `tx` parameter — the only one of the four
  statements without it — so both calls read a world without the constructed
  entry and compared two identical results. It takes an optional read-only
  transaction now, like the other three since P3c‑2.
- **(0) found a scenario surviving**, and it was a **tombstone**: `destroy` is
  paranoid, so a scenario the gate deleted through the service was still a row,
  and the census counts every row. The cleanup no longer takes a soft-deleted one
  off its list. **A soft delete is not a cleanup when the census is `COUNT(*)`** —
  P7c‑2's sweep learned the same thing about `UNIQUE(companyId, name)` including
  tombstones.

#### Five injections

| | | |
|---|---|---|
| 1 | the default stops excluding scenario entries | 2 unit-level checks · **(2)**, naming 16 moved figures · (3b) · (4) |
| 2 | a scenario is never includable | (12) · **(3)** — *"a scenario that does nothing"* |
| 3 | an unknown scenario is silently ignored | (6) |
| 4 | a scenario holding entries becomes erasable | (9) · (11) |
| 5 | the statements stop threading the scenario | (3) · (3b) · (4) |

`npm test` **2316/2316** · all five guards · `lint:ci` 0 errors · `nest build`
clean · `dump-routes` resolves 796 routes · **all five P8 gates green** (16/16,
30/30, 28/28, 26/26, 21/21) · `check-mirrors` all fifteen checks green.

⚠️ **No screen, recorded rather than implied.** The scenario masters and the
`?scenarioId=` toggle on the three statements have an API and no caller —
BUG-0068's *"an endpoint nothing calls is an endpoint nobody has run"*. P8e‑2 is
that screen: a scenario picker on the reports toolbar, and a masters list.

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
> ✅ **Closed in P4a** ([record](#p4a-record--2026-08-29)). `app-ledger-picker`
> offers what the group's **nature** allows; the enum survives only as each
> field's default, and only when its match is unique.

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
| Closing Stock (P&L) | **Direct Incomes** | ⚠️ Said *retired — dies with the Trading Account* until **P6 built one and found it cannot** ([§3.8](#38-trading-account-and-gross-profit)): §3.10 derives the Balance Sheet from `journal_lines` alone, so `Dr Stock-in-Hand` must be posted and its balancing credit exists whatever it is called. It is re-filed **above** the gross-profit line instead of below it, which is where `fallbackGroupForNature` had put it. Migration `20260831000000`. |
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
> **`app-ledger-picker` and `Alt+C` landed in P4a**
> ([record](#p4a-record--2026-08-29)), which finishes this section: one component
> now serves every voucher head field, `POST /acc-ledgers/picker` is its feed,
> and `groupFor` has stopped deciding what is pickable (F4). ⚠️ It binds the
> ledger's `legacyTrxGroupId`, not its own id, because every voucher DTO states
> a head and `ledgerId` is on none of them (D6) — `voucher-head-option.const.ts`
> carries that and its expiry at D9.
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
  screen. Replaces the six different group pickers that existed. **Done (P4a.)**
  It owns its own `mat-form-field`, so a call site is one tag rather than a
  form-field/select/error block.
- `Alt+C` on the picker opens ledger-create inline and returns the new id to the
  field — Tally's create-on-the-fly. **Done (P4a.)** ⚠️ It needs **two**
  listeners: the dropdown's panel is a `.cdk-overlay-pane` on `<body>`, so a host
  listener never sees a key pressed in it — and `app-select` was stopping every
  chord besides.

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
| **Mode** | **Done (P4e).** `Ctrl+H` toggles **Accounting Invoice** ↔ **Item Invoice** on the four financial item vouchers — Sales, Purchase and **both notes** — and on nothing else: the Dr/Cr four have no item body to leave, and a Workflow Document is deliberately not a destination (F6). An Accounting Invoice's rows are **ledger allocations**, which `trx_charges` already is; the body is `trx-add-edit`'s own `charges` FormArray rendered as the grid rather than as a folded chip, and the Charges chip is hidden while it is. A saved voucher reopens in the body its **own rows** imply (`invoiceBodyOf` — there is no stored mode to disagree with them). ⚠️ Correct the older sentence you may be carrying: it said an Accounting Invoice was *not representable*, and that was measured and wrong. |
| **Workflow Document mode** | **Done (P4d.)** The six upstream documents are typed on the same surface, on the **item grid** — no third component, because the mode is an invariant rather than a screen. What makes it visible is the title bar naming **what this document converts into**, read through `nextVisibleInFlow` so it names the stage *this company* actually reaches; the GST and Due Date chips are absent, following from posting no legs. ⚠️ `loadFor` asks `isAccountingEntry`, the half with a closed membership: asking `isItemEntry` drops all six onto the Dr/Cr grid, with both totals zero for ever. |
| **Accounting mode grid** | **Done (P4b.)** Dr/Cr rows: side · ledger · amount · (bill-wise popup if the ledger is bill-wise — P5) · (cost-centre popup if applicable — P7). Running Dr and Cr totals with the difference shown live; save is refused while it is non-zero, **in the voucher's own words** rather than a form error. ⚠️ The rows are **derived from `buildLegs`**, so what the screen draws is what the voucher posts — which is how P4b found the old Payment screen drawing its *head* as the debit row, a head that is a leg of none of the 2,862 posted payments and receipts. |
| **Item mode grid** | **Done (P4c.)** The existing form, re-hosted: `trx-add-edit` is routed under `/transaction/voucher/<type>` and gains the shell's type bar and Tally's key map, and nothing inside it changed. `applyCatalogueSnapshots`, `TrxWriteService`, the e-invoice and e-way bill paths, HSN/UQC and price capture are **untouched**. ⚠️ Re-hosted as a **sibling component on the same surface**, not as a child of `VoucherEntryComponent` — both already render `.vch-shell` and `.vch-titlebar`, so nesting would have meant one screen drawing two title bars and the child's own `CanComponentDeactivate` sitting under a guard it no longer owned. What they share is the **type bar**, which became one component. |
| **`Alt+C`** | Create ledger / stock item / cost centre inline from the field that needed it. **The ledger half is done (P4a)**, on every head field. |
| **`Ctrl+A`** | Accept and save from anywhere. `Ctrl+S` kept as an alias — several screens already bind it. **Done (P4b)** on the accounting types. |
| **`F12`** | Per-voucher-type configuration, replacing `/transaction-config/:trxType` as a modal rather than a route. **Done (P4b)** — the same editor component, given a second host rather than a second implementation. |
| **Narration** | Always last, always full width, always present. It is the field Tally operators use most and it is currently folded behind a chip. **Done (P4b)** on the accounting types. |

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
>
> ✅ **Decided 2026-08-29 with P4b; BUILT at P4d (2026-08-30): the third mode is
> the WORKFLOW DOCUMENT.** Its invariant is the forward conversion chain
> (`DOCUMENT_FLOW_NEXT`), never a balance, and it is **not reachable by
> `Ctrl+H`** — a non-financial type is always in it and a financial one can never
> enter it, which is what keeps the accounting grid's invariant an invariant
> rather than a case with an exception. `voucher-entry.const.ts` is the rule and
> its spec asserts the set against `buildLegs` returning no legs at all, so the
> mode cannot drift from the posting behaviour that defines it.
>
> ⚠️ **It needed no third component**, which is the part worth carrying: the mode
> is an *invariant*, not a screen. Its grid, pickers, header strip and options bar
> are the item form's, and `trx-add-edit` has enforced the difference through
> `isFinancialTrxType` since long before this programme. What P4d added was one
> reversed condition in `loadFor` (the Dr/Cr grid is the closed set, so it is the
> half the test should name) and a **caption** — because a document carrying the
> item grid and neither of its guarantees is otherwise an invoice that has quietly
> lost its totals.

> ⚠️ **`Ctrl+H` IS NOT BUILDABLE AS A TOGGLE HERE — measured 2026-08-30, at P4c**,
> and this is where P4e starts. Tally's Accounting Invoice is N income/expense
> ledger rows, each with its own amount. In this schema:
>
> - **all 9,970 financial vouchers carry at least one `trx_items` row** — there is
>   no no-items shape in the data at all;
> - **`trx_items` names a `productId` and never a ledger** (`id companyId trxId
>   productId unitPrice quantity discountType discountValue discountAmount amount
>   totalTaxAmount totalAmount … hsnCode gstSupplyClass`);
> - **`buildLegs` gives a sales voucher exactly one `Main` leg** — the voucher's
>   single head (`trx.groupId` / `.ledgerId`).
>
> So the money lives in the item lines and the classification is one head for the
> whole document. The need is real and small: **474 vouchers are service-only**
> (416 sales, 35 credit notes, 23 purchases — 4.8%), entered through the item grid
> with a service product, which is precisely what a Tally operator would type as
> an Accounting Invoice.
>
> Two shapes were recorded here and the choice was P4e's:
>
> - **Single-head.** A no-items form: party + the one income/expense head +
>   amount + tax. **Chosen 2026-08-30.**
> - **Full multi-ledger.** A per-line allocation and a posting engine emitting
>   several `Main` legs, plus a migration and a backfill — judged **XL**.
>
> ✅ **RULED single-head, and then the sizing above turned out to be wrong**
> (P4e‑1, 2026-08-30). The paragraph above is kept because its *measurements*
> stand and only its conclusion does not. **The allocation table already exists:**
> `trx_charges` is a per-row `{ ledger, amount, tax }` and `resolveLegs` already
> expands it into one journal line per row on that row's own ledger, with nothing
> constraining a row's head to a charge head. A no-items Sales voucher with one
> allocation to the Sales head posts `Party Dr · CGST Cr · SGST Cr · Sales Cr` —
> Tally's own Accounting Invoice — with **no migration, no DTO change and no
> posting change**. Measured, not argued: see
> [§P4e‑1 record](#p4e-1-record--2026-08-30).
>
> ⚠️ It was **unusable until GST-021 was fixed** the same day: the GST returns
> loaded `trx_items` alone, so an invoice whose money lived in allocations would
> have been declared to nobody at all. Walking the document to the portal is what
> found that, and it is what this phase's measurement was for.
>
> ⚠️⚠️ The mechanism gives **N** heads for the same code, and single-head remains
> the ruling: the screen offers one head until there is a reason for more. 475 of
> 475 service-only vouchers in the database carry exactly **one** distinct
> product, against goods documents averaging 1.61 and reaching 6.
>
> ⚠️ The measurement that ranked the need is also narrower than it reads. *"474
> vouchers are service-only (4.8 %)"* is a fact about the **QA fixture
> generator**: on the only real-ish books in the database it is **58 of 69
> (84 %)**, and their service products are named `Subscription Fee` and `Job Work
> Charges` — income heads being typed through the product master, which is
> precisely what an Accounting Invoice is for. A thin sample, stated as one.

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
>
> ✅ **Landed in P5d**, and the equality is now a property rather than an aim:
> `PartyStatementService.pendingBills` reads the register, so
> `Σ outstanding − Σ owed back` **is** the party ledger's balance, over all 381
> ledgers of the development database. The three terms it used to reconstruct by
> hand — D-18's note netting, BUG-0069's posted party share, D-55's synthesised
> opening balance — are gone with the derivation that needed them. ⚠️ The visible
> cost is that a return note is a **bill of its own on the opposite side** rather
> than folded into its target: 180 of 802 parties' totals moved, and §P5d's record
> carries the argument.

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

> ⚠️ **Corrected while building P6 (2026-08-31): the head cannot be retired, only
> re-filed.** Tally shows closing stock on both statements with no voucher because
> its Balance Sheet reads the inventory subsystem directly; §3.10 commits this
> report layer to `journal_lines` **and nothing else**, so `Dr Stock-in-Hand` has
> to be a posted leg for the sheet to show stock at all — and a journal entry
> balances, so the credit exists whatever it is named. Deriving it instead would
> move Net Profit by the whole stock movement, which is the one thing P6's gate
> forbids.
>
> So the credit stays posted and moves **above** the line: `TRX_GROUP_TARGET`
> maps `CLOSING_STOCK_INCOME` to `Direct Incomes` rather than to `null`, which is
> inside the Trading Account on its credit side. A line of its own — Tally's
> actual shape — was refused, because a figure inside a statement that is not the
> sum of a group's subtree breaks the invariant `qa:p3b-statements` (5) exists to
> hold, and a 29th group breaks §3.2's premise that the tree is Tally's 28. See
> [§P6 record](#p6-record--2026-08-31).

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
| **Profit & Loss** | ✅ Grouped in **P3b**; **two stacked statements since P6**. A Trading Account closing at a Gross Profit carried down into a Profit & Loss Account (§3.8), each an ordinary two-column block over the same tree. The whole statement's `income`/`expense`/`totalIncome`/`totalExpense`/`netProfit` are unchanged — the line is drawn *through* the same rows — and the net is computed **through** the gross. ⚠️ No Opening Stock line: it is a period report, and the opening balance of Stock-in-Hand is a Balance Sheet figure. |
| **Ledger** *(new)* | ✅ **Landed in P3a**, and its **screen in P3d‑1**. One ledger, monthly summary rows, each expanding to its vouchers, each opening the voucher — `GET /reports/ledger/:ledgerId` and `…/vouchers`. This is what a Tally user means by "open the ledger". Reads `acc_ledgers` directly; the Particulars column is the contra **ledger's** name, or `(as per details)`. ⚠️ A voucher number is a link only where there is a screen behind it — seven of the ten `sourceType` values have none. |
| **Group Summary** *(new)* | ✅ **Landed in P3a.** A group's children with closing balances — sub-groups carrying their whole subtree, ledgers carrying their own — `GET /reports/group-summary/:groupId`. The intermediate step of every drill-down, and the report whose totals property (8) of the gate ties to its own breakdown. |
| **Bills Receivable / Payable** *(new)* | ✅ **Landed in P5d.** Derived from `bill_references`, with ageing — party rows carrying the total the two Outstanding screens showed, expanding to the bills behind it. `GET /reports/bills-receivable` and `…/bills-payable`; the two Outstanding tabs render them and every old path still redirects. ⚠️ A party appears under **exactly one** side (their ledger hangs under one control group, D3), so a dual-role party's contra bills travel with them as *owed back* rather than being reported twice. |
| **Cash / Bank Book** | Become instances of the Ledger report. `CASH_BOOK_ACCOUNT_TYPES`'s derivation (D-54) is preserved as the group assignment during migration, so no account can fall out of every book the way UPI did. |
| **Day Book** | Its lines drill into the **ledger** since P3d‑1 (P3b put `ledgerId` on every one). The voucher-type chips and the drill into the *voucher* are still to come — `dayBook` returns each entry's id but not the `sourceType`/`sourceId` pair a document is opened by, and adding them is a payload change the parity harness captures. |
| **Cost Centre reports** *(new)* | ✅ **Landed in P7d‑1** — four, per §3.7, plus the reconciliation. `GET /reports/cost-centre-summary/:categoryId` · `…/cost-category-summary` · `…/cost-centre-breakup/:centreId` · `…/cost-ledger-breakup/:ledgerId` · `…/cost-allocation-reconciliation`. ⚠️ Every one is scoped to a single category structurally: the categories are parallel partitions of the same figure, so the Category Summary has **no grand total** and the Ledger Breakup is sectioned rather than summed. **Screens landed in P7d‑2** — four sub-nav tabs (Cost Categories · Cost Centres · Ledger Breakup · Allocation Check) plus the Cost Centre Breakup as a drill destination, and `DrillTarget` gained `cost-category` and `cost-centre`. |

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
(F6). ✅ All fourteen redirect as of P4d.

> **P4a is done** ([record](#p4a-record--2026-08-29)): `app-ledger-picker`,
> `Alt+C`, and F4 closed. It went first, and into the **current** screens rather
> than waiting for the new one, because a component with no caller is an
> endpoint nobody has run (BUG-0068's lesson) — the six pickers it replaces are
> where it gets measured.
>
> ⚠️ One correction to the sentence above, learned by building it: `groupFor`
> stops deciding **pickability**, which is all F4 is about, and survives as each
> field's **default** — every company has exactly one head per document context
> (F16), which is why the old pickers arrived pre-filled at all. Deleting it
> outright would have cost a keystroke per voucher on the busiest screen in the
> product, silently.

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

> **P4b is done** ([record](#p4b-record--2026-08-29)): the unified screen exists
> and hosts the **accounting** mode — Contra, Payment, Receipt and Journal, one
> component, three deleted. The keyboard half of the gate is met for those four
> (property 4 of `voucher-entry.ui.spec.ts` posts one without a mouse); the
> other ten types meet it when P4c and P4d re-host them, and their keys navigate
> until then rather than pretending.
>
> ⚠️ The row shapes are **derived from `buildLegs`** rather than written down,
> and `check-mirrors.js` **check 11** compares that derivation against the
> screen's own table — 14 types as data, 14 row plans run on both sides. It is
> the only thing tying the entry screen to the posting engine across the repo
> boundary, and both of its failure modes were reproduced.

> **P4c is done** ([record](#p4c-record--2026-08-30)): the surface hosts **eight**
> types across two components, with `trx-add-edit` re-hosted and untouched. The
> keyboard half of the gate is met for those eight; the remaining six meet it when
> P4d re-hosts them, and their keys navigate until then rather than pretending.
>
> ⚠️ **`Ctrl+H` moved out of this phase into P4e**, on the reading — correct at
> the time, and **wrong** — that an Accounting Invoice was not representable in
> this schema. P4e‑1 measured it and found the allocation table already there;
> see §3.5 and [§P4e‑1](#p4e-1-record--2026-08-30). The phase heading above still
> lists `Ctrl+H` among P4's keys, which is right: it is P4's work, and it is the
> last of it.

> **P4d is done** ([record](#p4d-record--2026-08-30)): **all fourteen** types are
> typed on the surface and **the old routes redirect — all fourteen of them**,
> which is the second sentence of this phase's heading, closed. The keyboard half
> of the gate is now met for every type that has a chord; the two that do not —
> purchase requisition and quotation, deliberately, because they are ours rather
> than Tally's — are reached from the type bar's overflow, which exists precisely
> because they cannot be reached any other way.
>
> ⚠️ The third mode took **no third component**: it is an invariant, not a screen.
> See §3.5's F6 note.

> **P4e‑1 is done** ([record](#p4e-1-record--2026-08-30)): the decision is taken —
> **single-head** — and the mechanism turned out to exist already, so the phase's
> server half is a rule, a spec and a mirror rather than a migration. What it
> found on the way was **GST-021**, a High defect with nothing to do with P4e: the
> GST returns loaded `trx_items` alone, so an additional charge's value and its
> tax were declared to nobody. Fixed first, because it is what makes the mechanism
> usable.

> **P4e‑2 is done** ([record](#p4e-2-record--2026-08-30)), and with it **P4 is
> complete**: fourteen types on one surface, two components, one type bar, one key
> map, and `Ctrl+H` switching the four that can. It needed no new form control and
> no backend change at all; what it cost was six print templates, which is the one
> price P4e‑1 predicted and could not design away.

**P4 is closed.** The next phase is **P5 — bill-wise details**.

### P5 · Bill-wise details `[L]`

§3.6 in full, including Advance and On Account, Bills Receivable/Payable, and the
reconciliation that closes BUG-0040's two-sided problem for good.

**Gate:** for every party in every QA company, the ledger-side balance equals Σ of
its open bill references. That equality is a **test**, not a report.

#### The gate, measured before the phase starts — 2026-08-30

The same discipline P2b‑3c and P4e‑1 used: measure the ground first, because the
conclusion the plan reasons to is not always the one the data supports.

| | |
|---|---|
| Parties with a ledger (14 companies) | **381** |
| Reconciled — ledger side == document side | **380** |
| Did not | **1**, by ₹468.00 |

BUG-0040's two-sided problem is far closer to closed than this plan assumes:
**D-55's opening-balance term was doing nearly all of the work.** Take it out and
54 parties break by ₹2,65,468, which is the figure that made the gate look
distant.

The 381st was **[BUG-0069](../qa-artifacts/docs/bugs/BUG-0069.md)** — a real
defect, fixed in its own commit before P5a starts (below). Two things it settles
for the phase:

- ⚠️ **A bill's amount is not `trx.grandTotal`.** Under D-52 a reverse-charge
  purchase owes its supplier `net + charges`; the annexure was billing them the
  tax as well, while `vendorOutstanding` — reading `journal_lines` — disagreed on
  the same supplier by exactly that tax.
- ⚠️⚠️ **And it cannot be re-derived from the flags either.** D-52 is
  forward-only, so the books hold both eras under one `reverseCharge` flag: 15
  purchases carry the full grand total on the party leg and 4 carry `net +
  charges`. A share restated from the flag turned the ₹468 gap into ₹2,160.
  **Where a figure has been posted, read the posting** — which is what §3.6
  already had P5 doing, by hanging `bill_references` off `journalLineId`. The
  measurement is that design's first independent confirmation.

With the fix, the gate reads **381 parties, 0 unreconciled, ₹0.00** — so P5
starts from a green gate and its job is to keep it green while the register
becomes the thing that answers it.

#### The split

`[L]`, and every `[L]`/`[XL]` phase in this programme has been split. Four
sub-phases, agreed 2026-08-30:

| | | |
|---|---|---|
| **P5a** | `bill_references` — table, entity, scope registry, hard-delete edge, and the **full-history backfill**. Read by nothing yet | the gate lands here: Σ open refs per party == ledger balance, 381/381 |
| **P5b** | the posting engine writes them — `new` on approval, `against` from `applyReceiptSettlement`, and **Advance / On Account** for the unallocated remainder | forward maintenance keeps the gate green |
| **P5c** | the entry screen's reference grid — the party's open bills, oldest-first, with what this voucher applies to each. ⚠️ Split three ways in the event, all three done: **P5c‑1** the backend (a voucher may name no bill), **P5c‑2** the grid, **P5c‑3** naming a bill no document made (`billRefId` on the allocation, and the database insisting on exactly one target). ⚠️⚠️ It does **not** pop on save — decided 2026-08-30: it is inline, where the multi-select was, because a blocking dialog between `Ctrl+S` and a saved voucher on the busiest cash screens costs more than the Tally muscle memory buys, and `revealInvalidPanel` (P4e) already owns *"Save reveals the blocker"* | `qa:money` — seven properties in a browser |
| **P5d** | Bills Receivable/Payable, and the annexure moves onto refs — ⚠️ split three ways in the event, all landed together: the annexure's read, the two reports, and the **denominator** P5c‑3 could not move on its own (`isPaid` against what a voucher POSTED, not against `grandTotal`) | `pendingBills` stopped deriving and started reading; `qa:p5d-annexure` 16/16 |

**Backfill depth: full history** — every approved current party document becomes
a `new` ref, every approved allocation an `against` ref, and D-55's synthesised
opening balance an ordinary `new` ref with no voucher behind it. §3.6's *"the two
sides stop being two sides"* is only true at that depth, and it is the only depth
at which the gate means anything.

⚠️ `acc_ledgers.billwise` **already exists** from D1 and party ledgers are seeded
`true` — *"written by the seed, read by nothing yet"*, as the migration says. So
does `costCentresApplicable` (P7) and the reserved `registrationId` (X1). P5a
adds a table, not a column to `acc_ledgers`.

### P6 · Trading Account and Gross Profit `[M]` — ✅ done, [record](#p6-record--2026-08-31)

§3.8. Direct/Indirect assignment reviewed per company, the two-statement P&L, and
`CLOSING_STOCK_INCOME` retired from new postings.

**Gate:** Net Profit after the split equals Net Profit before it, on every company
and every period. — `npm run qa:p6-trading`, **154/154**, four injections.

⚠️ Two of the three items above came out differently from this line, and both are
in the record: the *review step* needed nothing built (Direct ↔ Indirect is a
within-nature move, so P3d‑2's re-parenting already covers it), and
`CLOSING_STOCK_INCOME` could not be **retired** — only re-filed above the line,
because the Balance Sheet is derived from `journal_lines` alone. ⚠️⚠️ The gate
sentence is also not sufficient on its own: it holds under *any* partition, so a
section on the wrong side of the line passes it. Property (5a) is the one that
does not.

### P7 · Cost centres `[L]` — split into four

§3.7 in full, including categories, classes and the four reports.

**Gate:** every Trial Balance figure is unchanged by the presence of allocations —
the proof that the GL was not touched.

⚠️ **P7c split again, into three**, on the same argument — the table, then the
screens, then the screen that consumes them. See [§P7c‑1 record](#p7c-1-record--2026-09-01).

⚠️ **Split on the same argument as the four splits before it** (P2, P3, P4, P5):
an `[L]` here is four separable claims, each with its own gate, and the one thing
this programme has learned about a large phase is that the gate written at the
end covers what the author remembers. The order is the same one P5 used — the
table, then the engine that maintains it, then the screens, then the reports —
because every earlier link is what the next one's gate ties to.

| | | |
|---|---|---|
| **P7a** | `cost_categories` · `cost_centres` · the per-category invariant · the masters API | **done** — [record](#p7a-record--2026-08-31) |
| **P7b** | `cost_allocations`, written from `persistLines`; the voucher's allocation payload | **done** — [record](#p7b-record--2026-09-01) |
| **P7c‑1** | Cost centre classes — `cost_centre_classes` · `_lines` · the expansion rule · the masters API | **done** — [record](#p7c-1-record--2026-09-01) |
| **P7c‑2** | The masters screen — categories · the centre tree · classes | **done** — [record](#p7c-2-record--2026-09-01) |
| **P7c‑3** | The entry screen's allocation panel, and `expandCostCentreClass` mirrored | not started |
| **P7d‑1** | Cost Centre Summary · Category Summary · Cost Centre Breakup · Ledger Breakup · the reconciliation — the API | **done** — [record](#p7d-1-record--2026-09-01) |
| **P7d‑2** | Their screens, and `DrillTarget`'s fourth and fifth members | **done** — [record](#p7d-2-record--2026-08-31) |

⚠️ **The plan's gate sentence belongs to P7b**, not to P7a — there are no
allocations until P7b, so *"unchanged by the presence of allocations"* is
unfalsifiable before then. P7a's version of it is the same claim about the
*masters*: a category, a two-level tree in two categories and a switched-on
ledger, all constructed inside a rolled-back transaction, with the Trial Balance
captured either side of them.

### P8 · Posting rules, budgets, interest, multi-currency, scenarios `[L]` — split into five

§3.4's rule table and §3.9's four features. Sequenced last **deliberately**: the
rule table is only worth extracting once the leg set has stopped moving, and doing
it earlier would mean rewriting it twice.

**Gate:** re-posting every QA voucher through the rule interpreter produces
byte-identical journal lines to the switch it replaced.

⚠️ **Split on the same argument as the five splits before it** (P2, P3, P4, P5,
P7): an `[L]` here is five separable claims — one of them the accounting core's
own leg table and four of them additive features that share nothing but a plan
section — and the one thing this programme has learned about a large phase is
that the gate written at the end covers what the author remembers.

| | | |
|---|---|---|
| **P8a** | §3.4 — `buildLegs` becomes an interpreter over a **dated rule table**; the byte-identical gate | **done** — [record](#p8a-record--2026-08-31) |
| **P8b‑1** | Budgets — `budgets` · `budget_lines` · the rules · the API · the variance report | **done** — [record](#p8b-1-record--2026-09-01) |
| **P8b‑2** | The masters screen, and the variance report's screen | **done** — [record](#p8b-2-record--2026-09-01) |
| **P8c** | Interest — the pure rule, the Interest Report, the explicit Debit Note | **done** — [record](#p8c-record--2026-09-01) |
| **P8c‑2** | The Interest Report's screen, and the per-ledger parameters on the Chart of Accounts | **done** — [record](#p8c-2-record--2026-09-01) |
| **P8d** | Multi-currency — `currencies` · `exchange_rates` · the FC columns · the revaluation report | **done** — [record](#p8d-record--2026-09-01) |
| **P8d‑2** | The currency masters' screen and the revaluation report's | **done** — [record](#p8d-2-record--2026-09-01) |
| **P8e** | Scenarios — the table, `journal_entries.scenarioId`, the report filter | **done** — [record](#p8e-record--2026-09-01) |
| **P8e‑2** | The scenario picker on the reports toolbar, and the masters screen | not started |

Four measurements taken before P8a started, two of which move the phase's own
scope:

- ⚠️ **`voucher_types` already exists, under another name.**
  §3.4 keys `posting_rules` by `voucherTypeId` and §3.9 calls Scenarios *"genuinely
  cheap once `voucher_types` exists"* — implying a table to build.
  `transaction_configurations` **is** that table: one row per voucher kind per
  company, **196 of them (14 companies × 14 types)**, seeded and never
  created/deleted from the API, already carrying per-type numbering, approval,
  validation and inventory behaviour, and already reachable on `F12`. A rule
  references the `trxType` string every other config in this app is keyed by;
  nothing new is needed for either claim.
- ⚠️ **The dating belongs on the RULES, not on the heads**, which retires
  `statutory_heads` before it is built. `resolveStatutoryLedger`'s own handover
  note asks P8 for a dated head so *"a new levy or a changed head is a seed row"*,
  and reserves the `onDate` parameter for it. Measured: `acc_ledgers.systemKey`
  already **is** that table — **23 keys × 14 companies, exactly one row per key
  per company, maximum one everywhere** — and a *new levy* needs a new
  `SystemGroupKey` and a leg that emits it, which is a code change whatever the
  head table looks like. What genuinely changes on a date is the **leg set**, and
  that is what P8a dates. A second table mapping code + date → ledger would be a
  second definition of a fact `systemKey` already holds — §14's own warning — so
  `resolveStatutoryLedger` keeps its narrow signature and the note that reserved
  `onDate` is answered rather than honoured.
- **`buildLegs` is 14 kinds → 8 leg shapes**, and its only caller is
  `PostingService.post`. 15,474 posted entries across five `sourceType`s, 45,460
  lines, 2–7 lines an entry; **19 reverse-charge purchases** against 3,292
  ordinary ones. So the interpreter has one seam to replace and a real population
  to be held byte-identical against.
- ⚠️ **There is no `posting.const.spec.ts`**, and §3.4 says *"`posting.const.spec.ts`
  keeps testing it the same way"*. `buildLegs` is tested — 21 tests in
  `services/posting.service.spec.ts`, misfiled beside the service rather than the
  rule — and it covers four of the eight shapes plus reverse charge in depth.
  Receipt, Journal, the two notes and the six no-GL kinds have **no assertion at
  all**, so *"the same way"* would inherit that gap into the thing that replaces
  the switch.

⚠️ **P8 is complete.** Its five claims landed as seven sub-phases, and three of
them found that §3.9 and §3.4's own mechanisms did not fit this schema — the
posting-rule sketch had no condition column, `statutory_heads` was already
`acc_ledgers.systemKey`, and a scenario flag on the voucher *type* would have
meant *"every sale is provisional"*. What was deferred was **screens**, and **P8d‑2 has landed**: the currencies,
their quotes and the revaluation report now have callers, and building them found
[BUG-0072](../qa-artifacts/docs/bugs/BUG-0072.md) — both deletes soft-deleted into
a unique index, so a currency code and a quoted day could never be used again.
**P8e‑2 is the scenario one** and is still recorded rather than implied: its API
has no caller, which is BUG-0068's *"an endpoint nothing calls is an endpoint
nobody has run"*.

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
2. ~~**Direct vs Indirect assignment (P6).**~~ → **closed 2026-08-31: defaults plus
   re-parenting, and nothing had to be built.** What makes it work is a fact
   rather than a feature — Direct ↔ Indirect is a **within-nature** move (both
   Expense, or both Income), so `describeLedgerMoveBlock`, which refuses to move
   a *posted* ledger across an account nature, permits every move this split
   invites — on the Chart of Accounts screen P3d‑2 shipped. `qa:p6-trading` (9)
   asserts the permission *and* the cross-nature refusal beside it, so it is not
   a vacuous claim. See [§P6 record](#p6-record--2026-08-31).
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
