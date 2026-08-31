#!/usr/bin/env node
/**
 * Cross-repo mirror drift guard.
 *
 * Several constants are deliberately duplicated between `jayhind-client-back`
 * (the enforcer) and `jayhindi-client-front` (which mirrors them only so the UI
 * never offers an action the server will refuse). Until now those pairs were
 * kept in step **by comment alone** — "⚠️ Mirror of …, keep the two in sync" —
 * which is a request, not a guarantee.
 *
 * This repo is the only place that can check them: each sub-project is an
 * independent git repo, so neither one's own CI can see the other's tree. The
 * orchestration repo pins both as submodules and therefore sees both at once.
 *
 * Run:  node scripts/check-mirrors.js       (exit 0 = in sync, 1 = drift)
 *
 * ## What this proves, and what it does not
 * Checks 1–3 are exact **data** comparisons — a key added on one side and not
 * the other fails the build, which is the drift that actually bites (the menu
 * offers a module the server 403s, or hides one it would allow).
 *
 * Check 4 used to be deliberately weaker, and said so: the voucher-lifecycle
 * pair cannot be compared as data, because the backend answers
 * `(VoucherLifecycleState) => ActionVerdict` while the frontend answers
 * `(VoucherLifecycleRow, VoucherTypeFlags) => boolean`. Same rules, different
 * shapes — so only *behaviour* is comparable, and the note here promised a
 * shared vector table as the real fix. **That table now exists**
 * (`scripts/vectors/`, Phase 9B-2), so check 4 runs BOTH implementations
 * against it and compares three answers per row: the backend's, the frontend's,
 * and the table's own restatement of the rule. §13.4 is closed.
 *
 * The name comparison is kept alongside it rather than replaced. It answers a
 * question the vectors cannot: *has a decision function appeared on one side
 * with no vector covering it?* A new rule nobody wrote a vector for would
 * otherwise pass by being untested, which is the same failure one level up.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./lib/load-mirror-module');

const ROOT = path.join(__dirname, '..');
const BACK = path.join(ROOT, 'jayhind-client-back');
const FRONT = path.join(ROOT, 'jayhindi-client-front');

const failures = [];
const notes = [];

function read(file) {
  if (!fs.existsSync(file)) {
    failures.push(`missing file: ${path.relative(ROOT, file)} (submodule not checked out?)`);
    return null;
  }
  return fs.readFileSync(file, 'utf8');
}

/** Body of `export enum <name> { … }` → { MemberName: 'value' }. */
function parseEnum(src, name) {
  const m = new RegExp(`export enum ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(src);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const e = /^\s*(\w+)\s*=\s*['"]([^'"]*)['"]\s*,?/.exec(line);
    if (e) out[e[1]] = e[2];
  }
  return out;
}

/**
 * Body of `export const <name>… = { … };` → { key: value }, for the two literal
 * shapes these files use: `'quoted-key': LicensedModule.X` / `bareKey: …` and
 * `[LicensedModule.X]: 'label'`. Comment lines are skipped, so the (differing)
 * prose around each entry never counts as drift.
 */
function parseRecord(src, name) {
  // The terminator tolerates a trailing type assertion — the hub writes
  // `} as const satisfies Record<…>;`, and a strict `\n};` silently parsed it
  // as "not found", which reads the same as "in sync".
  const m = new RegExp(`export const ${name}\\b[^=]*=\\s*\\{([\\s\\S]*?)\\n\\}[^;{}]*;`).exec(src);
  if (!m) return null;
  const out = {};
  for (const raw of m[1].split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;
    const e =
      /^\[?\s*(?:LicensedModule\.)?['"]?([\w.-]+)['"]?\s*\]?\s*:\s*(?:LicensedModule\.)?['"]?([^'",]+)['"]?\s*,?/.exec(
        line,
      );
    if (e) out[e[1]] = e[2].trim();
  }
  return out;
}

/** Names of every `export function <name>` in a file. */
function parseExportedFunctions(src) {
  return [...src.matchAll(/export function (\w+)/g)].map((m) => m[1]).sort();
}

/** Compare two key→value maps and record every difference. */
/** `'repo/some/file.ts'` → `['repo', 'some/file.ts']`, for `loadTsModule`. */
function splitRepoPath(p) {
  const cut = p.indexOf('/');
  return [p.slice(0, cut), p.slice(cut + 1)];
}

function diffMaps(label, a, b, aName, bName) {
  if (!a || !b) {
    failures.push(`${label}: could not parse one side (a=${!!a} b=${!!b}) — has the literal's shape changed?`);
    return;
  }
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const k of keys) {
    if (!(k in a)) failures.push(`${label}: '${k}' is in ${bName} but missing from ${aName}`);
    else if (!(k in b)) failures.push(`${label}: '${k}' is in ${aName} but missing from ${bName}`);
    else if (a[k] !== b[k]) failures.push(`${label}: '${k}' is '${a[k]}' in ${aName} but '${b[k]}' in ${bName}`);
  }
}

// ── 1–3. module-licence: enum, labels, permissionKey → module ────────────────
const backLic = read(path.join(BACK, 'src/const/module-licence.const.ts'));
const frontLic = read(path.join(FRONT, 'src/core/navigation/module-licence.ts'));

if (backLic && frontLic) {
  diffMaps('LicensedModule', parseEnum(backLic, 'LicensedModule'), parseEnum(frontLic, 'LicensedModule'), 'client-back', 'client-front');
  diffMaps('LICENSED_MODULE_LABEL', parseRecord(backLic, 'LICENSED_MODULE_LABEL'), parseRecord(frontLic, 'LICENSED_MODULE_LABEL'), 'client-back', 'client-front');
  diffMaps('MODULE_BY_PERMISSION_KEY', parseRecord(backLic, 'MODULE_BY_PERMISSION_KEY'), parseRecord(frontLic, 'MODULE_BY_PERMISSION_KEY'), 'client-back', 'client-front');
}

// ── 4. Every permissionKey the frontend nav uses must exist in the backend ───
// registry, or the menu shows an item whose permission can never be granted.
const registry = read(path.join(BACK, 'src/const/permission-registry.ts'));
const navConfig = read(path.join(FRONT, 'src/core/navigation/navigation.config.ts'));

if (registry && navConfig) {
  const known = new Set([...registry.matchAll(/\bkey:\s*'([^']+)'/g)].map((m) => m[1]));
  // Keys used by @Permissions(...) but deliberately absent from the matrix —
  // only Admin (who bypasses RoleMenuGuard) can reach them. Documented in
  // permission-registry.ts's own header note.
  const intentionallyUnlisted = new Set(['payment-terms', 'tag', 'site-configuration']);
  const navKeys = new Set(
    [...navConfig.matchAll(/permissionKey:\s*'([^']*)'/g)].map((m) => m[1]).filter(Boolean),
  );
  for (const k of [...navKeys].sort()) {
    if (!known.has(k) && !intentionallyUnlisted.has(k)) {
      failures.push(`navigation.config.ts uses permissionKey '${k}', which is not in client-back's PERMISSION_REGISTRY`);
    }
  }
}

// ── 5. voucher-lifecycle: same decision functions AND the same answers ───────
// One pair of paths, used by check 5 (names, read as text) and check 6
// (behaviour, loaded and run) — so the two checks can never end up looking at
// different files.
const BACK_VL = 'jayhind-client-back/src/const/voucher-lifecycle.const.ts';
const FRONT_VL = 'jayhindi-client-front/src/utils/voucher-lifecycle.util.ts';
const backVl = read(path.join(ROOT, BACK_VL));
const frontVl = read(path.join(ROOT, FRONT_VL));

const DECISIONS = /^can[A-Z]/;
let decisionNames = [];

if (backVl && frontVl) {
  const b = parseExportedFunctions(backVl).filter((n) => DECISIONS.test(n));
  const f = parseExportedFunctions(frontVl).filter((n) => DECISIONS.test(n));
  for (const n of b) if (!f.includes(n)) failures.push(`voucher-lifecycle: '${n}' exists in client-back but not client-front`);
  for (const n of f) if (!b.includes(n)) failures.push(`voucher-lifecycle: '${n}' exists in client-front but not client-back`);
  decisionNames = b.filter((n) => f.includes(n));
}

// ── 6. voucher-lifecycle: the behavioural vectors (§13.4) ────────────────────
//
// The gap this closes, in `CLAUDE.md` §13's own words: *"semantic drift between
// the rules is still possible. The real fix is a shared JSON table of test
// vectors both repos' suites run against."*
//
// One table, spent here, because this is the only place that sees both trees —
// two copies of a vector file in two independent repos would be the same mirror
// problem one level up.
if (backVl && frontVl) {
  const vectorFile = path.join(__dirname, 'vectors/voucher-lifecycle.vectors.json');
  let vectors;
  try {
    vectors = JSON.parse(fs.readFileSync(vectorFile, 'utf8'));
  } catch (err) {
    failures.push(`voucher-lifecycle vectors: could not read ${path.relative(ROOT, vectorFile)} — ${err.message}`);
  }

  if (vectors) {
    let back, front;
    try {
      back = loadTsModule(...splitRepoPath(BACK_VL));
      front = loadTsModule(...splitRepoPath(FRONT_VL));
    } catch (err) {
      failures.push(`voucher-lifecycle vectors: ${err.message}`);
    }

    if (back && front) {
      // The two sides take different shapes of the same facts. These adapters are
      // the ONLY place that knows the mapping, and they are deliberately dumb:
      // anything clever here could reconcile a real disagreement into agreement,
      // which is the one failure mode a parity check cannot afford.
      const toBackState = (g) => {
        const state = {
          status: g.status,
          everPosted: g.everPosted,
          isArchived: g.isArchived,
          // The backend needs the references themselves, because its refusal
          // names them; the vector states only how many, because the count is
          // what every rule actually turns on.
          activeReferences: Array.from({ length: g.activeReferences }, (_, i) => ({
            label: `Doc #${i + 1}`,
            status: 'approved',
          })),
        };
        // `null` in a vector means "not configured", which is `undefined` here —
        // and the difference matters: the rules test `=== false`, so a present
        // `null` would read as "not disabled" by luck rather than by intent.
        if (g.allowCancel !== null) state.allowCancel = g.allowCancel;
        if (g.allowDelete !== null) state.allowDelete = g.allowDelete;
        return state;
      };
      const STAMP = '2026-01-01T00:00:00.000Z';
      const toFrontRow = (g) => ({
        status: g.status,
        approvedAt: g.everPosted ? STAMP : null,
        activeReferenceCount: g.activeReferences,
        deletedAt: g.isArchived ? STAMP : null,
      });
      const toFrontFlags = (g) => {
        const flags = {};
        if (g.allowCancel !== null) flags.allowCancel = g.allowCancel;
        if (g.allowDelete !== null) flags.allowDelete = g.allowDelete;
        return flags;
      };

      const ACTIONS = [
        ['cancel', 'canCancelVoucher'],
        ['archive', 'canArchiveVoucher'],
        ['erase', 'canEraseVoucher'],
      ];

      let compared = 0;
      for (const vector of vectors.actions) {
        const state = toBackState(vector.given);
        const row = toFrontRow(vector.given);
        const flags = toFrontFlags(vector.given);

        for (const [action, fn] of ACTIONS) {
          const backAnswer = !!back[fn](state).allowed;
          const frontAnswer = !!front[fn](row, flags);
          const expected = vector.expect[action];
          compared++;

          // Three answers, so a failure can say WHICH kind it is — drift between
          // the two, or both having moved away from the stated rule. Those need
          // different fixes and conflating them is how a mirror check stops
          // being actionable.
          if (backAnswer !== frontAnswer) {
            failures.push(
              `voucher-lifecycle DRIFT · ${vector.id} · ${action}: ` +
                `client-back says ${backAnswer}, client-front says ${frontAnswer} ` +
                `(table says ${expected}) — ${vector.why}`,
            );
          } else if (backAnswer !== expected) {
            failures.push(
              `voucher-lifecycle RULE CHANGED · ${vector.id} · ${action}: ` +
                `both sides say ${backAnswer}, the vector table says ${expected} — ${vector.why}\n` +
                `      If the rule genuinely changed, update scripts/vectors/ in the same commit.`,
            );
          }
        }
      }

      for (const vector of vectors.recall) {
        const { status, userId, makerId, submitterId } = vector.given;
        const backAnswer = !!back.canRecallVoucher(status, userId, makerId, submitterId).allowed;
        const frontAnswer = !!front.canRecallVoucher({ status }, userId, makerId, submitterId);
        const expected = vector.expect.recall;
        compared++;

        if (backAnswer !== frontAnswer) {
          failures.push(
            `voucher-lifecycle DRIFT · ${vector.id} · recall: ` +
              `client-back says ${backAnswer}, client-front says ${frontAnswer} ` +
              `(table says ${expected}) — ${vector.why}`,
          );
        } else if (backAnswer !== expected) {
          failures.push(
            `voucher-lifecycle RULE CHANGED · ${vector.id} · recall: ` +
              `both sides say ${backAnswer}, the vector table says ${expected} — ${vector.why}`,
          );
        }
      }

      notes.push(
        `voucher-lifecycle: ${compared} behavioural comparisons over ` +
          `${vectors.actions.length + vectors.recall.length} vectors, run against BOTH implementations ` +
          '(§13.4 — no longer a name-only check).',
      );

      // A decision function with no vector is a rule nobody compares — the same
      // gap one level up. Named rather than failed, because a new rule may
      // legitimately land minutes before its vectors do; it is loud enough to
      // be noticed in a review and does not block the commit that adds it.
      const covered = new Set(['canCancelVoucher', 'canArchiveVoucher', 'canEraseVoucher', 'canRecallVoucher']);
      const uncovered = decisionNames.filter((n) => !covered.has(n));
      if (uncovered.length) {
        notes.push(
          `⚠️  voucher-lifecycle: ${uncovered.join(', ')} ${uncovered.length === 1 ? 'has' : 'have'} ` +
            'no vectors. Add them to scripts/vectors/voucher-lifecycle.vectors.json — an uncompared ' +
            'rule is exactly the gap §13.4 was about.',
        );
      }
    }
  }
}

// ── 7. hub console ↔ hub API: what a licence switch is CALLED on the wire ────
//
// The console names a switch by its `companies` column (`productEnabled`); the
// hub's API names the capability (`product`). Both vocabularies are legitimate
// and both are needed — the grid reads columns off the row, the DTO declares
// capabilities — so the danger is not that two names exist but that the
// translation between them drifts.
//
// It had never worked at all: `TenantModulesDialog` posted the column names,
// `ValidationPipe` runs with `forbidNonWhitelisted: true`, and every save was a
// 400 reciting *"property productEnabled should not exist"*. No module could be
// switched off from the console, and nothing anywhere said so — the two files
// are in different git repos, which is exactly the class of drift this script
// exists for.
//
// Compared as data, both ways: every capability the hub can write must have a
// wire name in the console, and every wire name must be one the hub's DTO
// accepts.
const ADMIN_BACK = path.join(ROOT, 'jayhind-admin-back');
const ADMIN_FRONT = path.join(ROOT, 'jayhind-admin-front');

const hubFeatureColumns = read(path.join(ADMIN_BACK, 'src/services/company.service.ts'));
const hubFeaturesDto = read(path.join(ADMIN_BACK, 'src/dto/company.dto.ts'));
const consoleFeatures = read(path.join(ADMIN_FRONT, 'src/core/tenant-features.ts'));

if (hubFeatureColumns && hubFeaturesDto && consoleFeatures) {
  // { capability: 'columnName' } on the hub, { columnName: 'capability' } in the
  // console — inverted before comparing, so the check reads as one statement.
  const hubMap = parseRecord(hubFeatureColumns, 'COMPANY_FEATURE_COLUMN');
  const wireMap = parseRecord(consoleFeatures, 'FEATURE_WIRE_KEY');

  if (!hubMap || !wireMap) {
    failures.push(
      'licence switch names: could not parse COMPANY_FEATURE_COLUMN (admin-back) or ' +
        'FEATURE_WIRE_KEY (admin-front) — has the literal\'s shape changed?',
    );
  } else {
    const hubInverted = Object.fromEntries(Object.entries(hubMap).map(([cap, col]) => [col, cap]));
    diffMaps('licence switch names', hubInverted, wireMap, 'admin-back (column → capability)', 'admin-front FEATURE_WIRE_KEY');

    // …and the capability has to be a field the DTO actually declares, which is
    // the thing `forbidNonWhitelisted` judges. Parsed from the DTO rather than
    // assumed from the column map, because those are two different files and it
    // is the DTO that answers the request.
    const dtoBody = /export class UpdateCompanyFeaturesDto\s*\{([\s\S]*?)\n\}/.exec(hubFeaturesDto);
    if (!dtoBody) {
      failures.push('licence switch names: could not find UpdateCompanyFeaturesDto in admin-back');
    } else {
      const declared = new Set([...dtoBody[1].matchAll(/^\s*(?:@[^\n]*\s)?(\w+)\??\s*:/gm)].map((m) => m[1]));
      for (const capability of Object.values(wireMap).sort()) {
        if (!declared.has(capability)) {
          failures.push(
            `licence switch names: the console posts '${capability}', which UpdateCompanyFeaturesDto ` +
              'does not declare — ValidationPipe answers 400 "property … should not exist"',
          );
        }
      }
    }
  }
}

// ── 8. display-case: one capitalisation rule, two implementations ───────────
//
// The frontend tidies a name as it is TYPED (`TitleCaseNameDirective`); the
// backend's copy powers `scripts/normalise-names.ts` over the rows already
// saved. A drift between them means a name changing the moment somebody opens
// and re-saves a record it had already tidied — invisible until a customer asks
// why their party keeps renaming itself.
//
// Compared THREE ways per row, like check 6: back against front (drift), and
// both against the table's own stated answer (a rule they forgot together).
{
  const BACK_DC = 'jayhind-client-back/src/const/display-case.const.ts';
  const FRONT_DC = 'jayhindi-client-front/src/utils/display-case.util.ts';
  const vectorFile = path.join(__dirname, 'vectors/display-case.vectors.json');

  let vectors;
  try {
    vectors = JSON.parse(fs.readFileSync(vectorFile, 'utf8')).vectors;
  } catch (err) {
    failures.push(`display-case vectors: could not read ${path.relative(ROOT, vectorFile)} — ${err.message}`);
  }

  if (vectors) {
    let back, front;
    try {
      back = loadTsModule(...splitRepoPath(BACK_DC));
      front = loadTsModule(...splitRepoPath(FRONT_DC));
    } catch (err) {
      failures.push(`display-case vectors: ${err.message}`);
    }

    if (back && front) {
      let compared = 0;
      for (const vector of vectors) {
        const b = back.normaliseName(vector.in);
        const f = front.normaliseName(vector.in);
        compared += 1;

        if (b !== f) {
          failures.push(
            `display-case DRIFT · ${JSON.stringify(vector.in)}: ` +
              `client-back says ${JSON.stringify(b)}, client-front says ${JSON.stringify(f)}`,
          );
          continue;
        }
        if (b !== vector.out) {
          // Both sides agree and both are wrong — the case a two-way parity
          // check cannot see, which is why the table states its own answer.
          failures.push(
            `display-case RULE CHANGED · ${JSON.stringify(vector.in)}: ` +
              `both sides now say ${JSON.stringify(b)}, the table expects ${JSON.stringify(vector.out)}` +
              (vector.why ? ` (${vector.why})` : ''),
          );
        }
      }

      // The acronym lists ARE the rule — a word in one and not the other is a
      // drift the vectors would only catch if that word happened to be in them.
      for (const listName of ['NAME_ACRONYMS', 'NAME_SUFFIX_WORDS']) {
        const b = [...(back[listName] ?? [])].sort();
        const f = [...(front[listName] ?? [])].sort();
        for (const w of b) if (!f.includes(w)) failures.push(`display-case ${listName}: '${w}' in client-back, missing in client-front`);
        for (const w of f) if (!b.includes(w)) failures.push(`display-case ${listName}: '${w}' in client-front, missing in client-back`);
      }

      notes.push(`display-case: ${compared} behavioural comparisons, run against BOTH implementations`);
    }
  }
}

// ── 9. job-work board stage: the buckets the lanes and the chips are keyed by ─
//
// `JobWorkBoardStage` is duplicated because the board builds its Kanban lanes
// and its filter chips before any response arrives, and the strings ARE the
// tokens the server's `stage` filter compares — so a member added on one side
// and not the other is a lane that silently returns nothing, or a chip the
// server answers with a 400.
//
// Data, not behaviour: unlike voucher-lifecycle, both sides are a plain enum
// and a plain sequence, so an exact comparison is available and is strictly
// stronger than any vector table would be. `deriveBoardStage` deliberately
// lives on the BACKEND ONLY — the frontend never derives a stage, it reads the
// one the row carries — so there is no second implementation to compare.
{
  const backStage = read(path.join(BACK, 'src/const/job-work-stage.const.ts'));
  const frontStage = read(path.join(FRONT, 'src/components/admin/job-work/job-work.interface.ts'));

  if (backStage && frontStage) {
    diffMaps(
      'JobWorkBoardStage',
      parseEnum(backStage, 'JobWorkBoardStage'),
      parseEnum(frontStage, 'JobWorkBoardStage'),
      'client-back',
      'client-front',
    );

    // The ORDER matters as much as the membership: it is the lane order left to
    // right and the chip order, and the two repos each declare it.
    const sequence = (src) => {
      const m = /export const BOARD_STAGE_SEQUENCE[^=]*=\s*\[([\s\S]*?)\];/.exec(src);
      return m ? [...m[1].matchAll(/JobWorkBoardStage\.(\w+)/g)].map((x) => x[1]) : null;
    };
    const backSeq = sequence(backStage);
    const frontSeq = sequence(frontStage);
    if (!backSeq || !frontSeq) {
      failures.push('BOARD_STAGE_SEQUENCE: could not parse one side — has the literal\'s shape changed?');
    } else if (backSeq.join(',') !== frontSeq.join(',')) {
      failures.push(
        `BOARD_STAGE_SEQUENCE: client-back is [${backSeq.join(', ')}] but client-front is [${frontSeq.join(', ')}]`,
      );
    } else {
      // A sequence that covers fewer members than the enum is the drift that
      // reads as coverage: every check above passes and a bucket has no lane.
      const members = Object.keys(parseEnum(backStage, 'JobWorkBoardStage') ?? {});
      const missing = members.filter((m) => !backSeq.includes(m));
      if (missing.length) {
        failures.push(`BOARD_STAGE_SEQUENCE omits ${missing.join(', ')} — that stage has no lane and no chip`);
      }
      notes.push(`job-work stage: ${backSeq.length} buckets, same members and same order in both repos`);
    }

    // The labels are the frontend's alone (the server never sends a label), so
    // there is nothing to compare — but a MISSING one renders a raw slug on a
    // lane head, which is the same class of defect one file over.
    const labels = parseRecord(frontStage, 'BOARD_STAGE_LABEL');
    const icons = parseRecord(frontStage, 'BOARD_STAGE_ICON');
    for (const [name] of Object.entries(parseEnum(frontStage, 'JobWorkBoardStage') ?? {})) {
      const key = `JobWorkBoardStage.${name}`;
      if (labels && !(key in labels)) failures.push(`BOARD_STAGE_LABEL has no entry for ${key}`);
      if (icons && !(key in icons)) failures.push(`BOARD_STAGE_ICON has no entry for ${key}`);
    }
  }
}

// ── 10. the Chart of Accounts' refusals: same verdict AND same SENTENCE ─────
//
// `ledger.const.ts` decides what the API refuses; `ledger-rules.util.ts` says
// the same thing on the Chart of Accounts screen (P3d‑2), so an operator reads
// the reason rather than meeting a 400 on a button that looked live.
//
// ⚠️ This check compares the **message text**, not only the verdict, and that is
// the point of it. A mirror that agreed about *whether* to refuse and disagreed
// about *why* would leave one wording on screen and another in the toast the
// same click produces — and the wording is the deliverable here: each of these
// sentences names the actual problem and the alternative (deactivate it, use a
// sub-group, add the party), which is what P3d‑2's gate asks for.
//
// ⚠️⚠️ Two arms turn on a fact only the database has (`hasPostings`,
// `subtreeHasPostings`). The browser passes **nothing** rather than a guess, and
// both sides must then answer "allowed" so the request goes and the server —
// which does know — refuses with this same sentence. The vector table states
// that equivalence with a `null`, because it is a rule and not an accident.
{
  const BACK_LR = 'jayhind-client-back/src/const/ledger.const.ts';
  const FRONT_LR = 'jayhindi-client-front/src/utils/ledger-rules.util.ts';
  const vectorFile = path.join(__dirname, 'vectors/ledger-rules.vectors.json');

  const backLr = read(path.join(ROOT, BACK_LR));
  const frontLr = read(path.join(ROOT, FRONT_LR));

  // The name check first, and it is not redundant: a rule that exists on one
  // side only has no vector to fail, which is check 5's argument for keeping a
  // name comparison beside a behavioural one.
  if (backLr && frontLr) {
    const REFUSALS = /^describe[A-Z].*Block$/;
    const b = parseExportedFunctions(backLr).filter((n) => REFUSALS.test(n));
    const f = parseExportedFunctions(frontLr).filter((n) => REFUSALS.test(n));
    for (const n of b) if (!f.includes(n)) failures.push(`ledger-rules: '${n}' exists in client-back but not client-front — the screen cannot state a refusal it does not have`);
    for (const n of f) if (!b.includes(n)) failures.push(`ledger-rules: '${n}' exists in client-front but not client-back`);
  }

  let table;
  try {
    table = JSON.parse(fs.readFileSync(vectorFile, 'utf8'));
  } catch (err) {
    failures.push(`ledger-rules vectors: could not read ${path.relative(ROOT, vectorFile)} — ${err.message}`);
  }

  if (table && backLr && frontLr) {
    let back, front;
    try {
      back = loadTsModule(...splitRepoPath(BACK_LR));
      front = loadTsModule(...splitRepoPath(FRONT_LR));
    } catch (err) {
      failures.push(`ledger-rules vectors: ${err.message}`);
    }

    // A case's `given` holds arrays: the cross-product is expanded here, so one
    // hand-written case is a statement about a REGION of the fact space. The
    // regions of each rule partition it exactly — which is what makes 22 cases
    // an exhaustive table rather than a sample.
    const expand = (given) => {
      const keys = Object.keys(given);
      let rows = [{}];
      for (const k of keys) {
        const values = Array.isArray(given[k]) ? given[k] : [given[k]];
        rows = rows.flatMap((row) => values.map((v) => ({ ...row, [k]: v })));
      }
      return rows;
    };

    // `null` in a vector means ABSENT, not "null was passed" — the browser
    // simply does not have the field. Dropping the key is what reproduces that;
    // passing an explicit null would test a shape no caller produces.
    const dropUnknown = (row, keys) => {
      const out = { ...row };
      for (const k of keys) if (out[k] === null) delete out[k];
      return out;
    };

    // The expected sentence, with the counts substituted from the row itself.
    // The placeholder NAMES its field, so this is a mechanical substitution and
    // never a second opinion about which arm won.
    const sentence = (id, row) => {
      if (id === null) return null;
      const template = table.messages[id];
      if (template === undefined) return `«no message called '${id}' in the table»`;
      return template.replace(/\$\{(\w+)\}/g, (_, k) => String(row[k]));
    };

    // How each rule's row becomes the two calls. Deliberately dumb: anything
    // clever here could reconcile a real disagreement into agreement, which is
    // the one failure mode a parity check cannot afford.
    const RULES = [
      {
        section: 'placement',
        call: (mod, row) => mod.describeLedgerPlacementBlock(
          { isPrimary: row.isPrimary, systemKey: row.systemKey, nature: row.nature },
          { isParty: row.isParty },
        ),
      },
      {
        section: 'groupDelete',
        call: (mod, row) => mod.describeGroupDeleteBlock(row),
      },
      {
        section: 'groupReparent',
        call: (mod, row) => mod.describeGroupReparentBlock(dropUnknown(row, ['subtreeHasPostings'])),
      },
      {
        section: 'ledgerMove',
        call: (mod, row) => mod.describeLedgerMoveBlock(dropUnknown(row, ['hasPostings'])),
      },
      {
        section: 'ledgerDelete',
        call: (mod, row) => mod.describeLedgerDeleteBlock(dropUnknown(row, ['hasPostings'])),
      },
    ];

    if (back && front) {
      let compared = 0;
      for (const rule of RULES) {
        const cases = table[rule.section];
        if (!Array.isArray(cases)) {
          failures.push(`ledger-rules vectors: no '${rule.section}' cases in the table`);
          continue;
        }
        for (const vector of cases) {
          for (const row of expand(vector.given)) {
            const expected = sentence(vector.expect, row);
            const b = rule.call(back, row) ?? null;
            const f = rule.call(front, row) ?? null;
            compared++;

            const shape = JSON.stringify(row);
            // Three answers, so a failure says WHICH kind it is. Drift between
            // the two sides and a rule both sides moved away from need
            // different fixes, and conflating them is how a mirror check stops
            // being actionable.
            if (b !== f) {
              failures.push(
                `ledger-rules DRIFT · ${rule.section}/${vector.id} · ${shape}:\n` +
                  `      client-back:  ${JSON.stringify(b)}\n` +
                  `      client-front: ${JSON.stringify(f)}\n` +
                  `      — ${vector.why}`,
              );
            } else if (b !== expected) {
              failures.push(
                `ledger-rules RULE CHANGED · ${rule.section}/${vector.id} · ${shape}:\n` +
                  `      both sides say ${JSON.stringify(b)}\n` +
                  `      the table says ${JSON.stringify(expected)}\n` +
                  `      — ${vector.why}\n` +
                  '      If the rule or the wording genuinely changed, update scripts/vectors/ in the same commit.',
              );
            }
          }
        }
      }
      notes.push(
        `ledger-rules: ${compared} behavioural comparisons over ` +
          `${RULES.reduce((n, r) => n + (table[r.section]?.length ?? 0), 0)} region cases, run against BOTH ` +
          'implementations, comparing the message text (P3d‑2).',
      );

      // A refusal with no section in the table is a rule nobody compares — the
      // same gap one level up. Named rather than failed, for check 6's reason.
      const covered = new Set(RULES.map((r) => r.section === 'placement' ? 'describeLedgerPlacementBlock'
        : r.section === 'groupDelete' ? 'describeGroupDeleteBlock'
          : r.section === 'groupReparent' ? 'describeGroupReparentBlock'
            : r.section === 'ledgerMove' ? 'describeLedgerMoveBlock' : 'describeLedgerDeleteBlock'));
      const uncovered = parseExportedFunctions(frontLr)
        .filter((n) => /^describe[A-Z].*Block$/.test(n))
        .filter((n) => !covered.has(n));
      if (uncovered.length) {
        notes.push(
          `⚠️  ledger-rules: ${uncovered.join(', ')} ${uncovered.length === 1 ? 'has' : 'have'} no vectors. ` +
            'Add a section to scripts/vectors/ledger-rules.vectors.json — an uncompared rule is the gap this check is about.',
        );
      }
    }
  }
}

// ── 11. voucher entry: which surface a voucher type is typed into (P4b) ─────
//
// `voucher-entry.const.ts` decides the mode and the Dr/Cr row shape;
// `voucher-entry.util.ts` is what the entry screen renders from. The pair is
// unusual and worth reading before changing either side:
//
// ⚠️ The backend does not *state* the row plans — it **derives** them from
// `buildLegs`, the posting engine's own leg builder, so the grid and the general
// ledger cannot come to different answers about what a Payment is. The frontend
// has no `buildLegs` and restates the answer. So this check is the only thing
// tying the screen to the engine: change a cash voucher's legs and it fails
// here, naming the voucher, rather than the grid quietly drawing a shape that
// stopped being true.
//
// ⚠️⚠️ Data, not text: both sides are loaded and CALLED, and the mode map is an
// exact comparison. F6's decision — that the six upstream documents are a third
// mode — is asserted on the backend against `buildLegs` returning no legs at
// all (`voucher-entry.const.spec.ts`), which is the half a cross-repo check
// cannot see.
{
  const BACK_VE = 'jayhind-client-back/src/const/voucher-entry.const.ts';
  const FRONT_VE = 'jayhindi-client-front/src/utils/voucher-entry.util.ts';

  let back = null;
  let front = null;
  try {
    back = loadTsModule(...splitRepoPath(BACK_VE));
    front = loadTsModule(...splitRepoPath(FRONT_VE));
  } catch (err) {
    failures.push(`voucher-entry: ${err.message}`);
  }

  if (back && front) {
    // 11a. Every type, and the same mode for each. A type present on one side
    // only is a screen with no mode or a mode with no screen.
    diffMaps('ENTRY_MODE_BY_TYPE', back.ENTRY_MODE_BY_TYPE, front.ENTRY_MODE_BY_TYPE, 'client-back', 'client-front');

    // 11b. The mode NAMES themselves, so the third mode cannot be called one
    // thing in the engine and another on the screen.
    diffMaps('VoucherEntryMode', back.VoucherEntryMode, front.VoucherEntryMode, 'client-back', 'client-front');
    diffMaps('VoucherRowRef', back.VoucherRowRef, front.VoucherRowRef, 'client-back', 'client-front');

    // 11c. The row plans, per accounting voucher — the derivation against the
    // restatement.
    const types = Object.keys(back.ENTRY_MODE_BY_TYPE);
    let compared = 0;
    for (const type of types) {
      const isAccounting = back.ENTRY_MODE_BY_TYPE[type] === back.VoucherEntryMode.Accounting;
      const call = (mod) => {
        try {
          return { plan: mod.accountingRowPlan(type) };
        } catch (err) {
          return { threw: String(err.message) };
        }
      };
      const b = call(back);
      const f = call(front);
      compared++;

      // A non-accounting type must be refused by BOTH — a grid that rendered
      // rows for a Sales Order is the invariant-weakening F6 warned about.
      if (!isAccounting) {
        if (!b.threw || !f.threw) {
          failures.push(
            `voucher-entry: accountingRowPlan('${type}') should be refused on both sides ` +
              `(client-back ${b.threw ? 'refused' : 'answered'}, client-front ${f.threw ? 'refused' : 'answered'})`,
          );
        }
        continue;
      }

      // `role` is the backend's LegRole value and the frontend carries it as a
      // plain string, so JSON is the comparison — same keys, same order.
      const bj = JSON.stringify(b.plan ?? b.threw);
      const fj = JSON.stringify(f.plan ?? f.threw);
      if (bj !== fj) {
        failures.push(
          `voucher-entry DRIFT · accountingRowPlan('${type}'):\n` +
            `      client-back:  ${bj}\n` +
            `      client-front: ${fj}\n` +
            '      — the backend derives this from buildLegs; if the legs changed, restate the frontend table in the same commit.',
        );
      }
    }
    // 11d. The invoice BODY axis — P4e's `Ctrl+H`. Both sides DERIVE
    // `canSwitchInvoiceBody` from their own `entryModeFor` rather than listing
    // the four item types, so this runs it per type rather than diffing a
    // constant: a list on each side would agree until one was edited alone.
    // `invoiceBodyOf` is run too, because "a voucher with no item lines IS an
    // Accounting Invoice" is the rule that decides which grid a SAVED document
    // reopens on, and a screen that disagreed with the server about that would
    // reopen an invoice in the wrong mode.
    if (back.canSwitchInvoiceBody && front.canSwitchInvoiceBody) {
      diffMaps('InvoiceBodyMode', back.InvoiceBodyMode, front.InvoiceBodyMode, 'client-back', 'client-front');
      let bodyCompared = 0;
      for (const type of types) {
        const b = back.canSwitchInvoiceBody(type);
        const f = front.canSwitchInvoiceBody(type);
        bodyCompared++;
        if (b !== f) {
          failures.push(
            `voucher-entry DRIFT · canSwitchInvoiceBody('${type}'): client-back ${b}, client-front ${f}\n` +
              '      — Ctrl+H belongs to the item form and to nothing else; both sides derive it from entryModeFor.',
          );
        }
      }
      for (const count of [0, 1, 5]) {
        const b = back.invoiceBodyOf({ itemLineCount: count });
        const f = front.invoiceBodyOf({ itemLineCount: count });
        if (b !== f) {
          failures.push(
            `voucher-entry DRIFT · invoiceBodyOf({ itemLineCount: ${count} }): ` +
              `client-back ${b}, client-front ${f}`,
          );
        }
      }
      notes.push(`voucher-entry: ${bodyCompared} invoice-body answers run on both sides (P4e).`);
    } else {
      failures.push(
        'voucher-entry: `canSwitchInvoiceBody` is missing on one side — P4e\'s Ctrl+H axis must be mirrored, ' +
          'and a check that silently skips is the coverage-that-cannot-fail this script exists to avoid.',
      );
    }

    notes.push(
      `voucher-entry: ${Object.keys(back.ENTRY_MODE_BY_TYPE).length} types compared as data and ` +
        `${compared} row plans run on both sides (P4b).`,
    );
  }
}

// ── 12. the bill register: how a settlement is split, and the sentence why ──
//
// `settlement.const.ts`'s `planBillSettlement` decides how much of each selected
// bill a payment or receipt closes; `bill-reference.util.ts` says the same thing
// in the reference grid (P5c‑2), which is the whole of what a grid adds over the
// multi-select it replaces — a per-bill figure, before the voucher is saved.
//
// ⚠️ Compared on the **mappings and the message text**, for check 10's reason:
// every refusal here is a sentence an operator reads, and one of them
// (`Amount exceeds due. Max allowed: …`) carries a number the screen prints.
//
// ⚠️⚠️ `billSettlementSign` is the smaller rule beneath it and is compared too,
// because it is the one that lets the grid offer a bill NO DOCUMENT MADE. The
// backend has a second, older statement of the same fact — `settlementRole`,
// which switches on `TrxType` — and the two are held together by a unit spec
// (`bill-reference.const.spec.ts`) rather than by this check, since only one of
// them exists on the client.
{
  // ⚠️ The rule is loaded from `bill-reference.const.ts`, not `settlement.const.ts`
  // — that file imports `TrxType` off a Sequelize entity and cannot be bundled
  // standalone, which is why the bill-shaped half lives in the dependency-free
  // one and is re-exported from the other. `src/const` is documented as pure for
  // exactly this reason; a rule that has to be RUN is where the rule proves it.
  const BACK_BR = 'jayhind-client-back/src/const/bill-reference.const.ts';
  const FRONT_BR = 'jayhindi-client-front/src/utils/bill-reference.util.ts';
  const vectorFile = path.join(__dirname, 'vectors/bill-settlement.vectors.json');

  let table;
  try {
    table = JSON.parse(fs.readFileSync(vectorFile, 'utf8'));
  } catch (err) {
    failures.push(`bill-settlement vectors: could not read ${path.relative(ROOT, vectorFile)} — ${err.message}`);
  }

  if (table) {
    let backBr, front;
    try {
      backBr = loadTsModule(...splitRepoPath(BACK_BR));
      front = loadTsModule(...splitRepoPath(FRONT_BR));
    } catch (err) {
      failures.push(`bill-settlement vectors: ${err.message}`);
    }

    const expand = (given) => {
      let rows = [{}];
      for (const k of Object.keys(given)) {
        // ⚠️ `bills` is an array VALUE, not a set of alternatives to expand over.
        // Expanding it would silently turn one case into N single-bill cases —
        // the opposite of what every multi-bill vector is about.
        const values = Array.isArray(given[k]) && k !== 'bills' ? given[k] : [given[k]];
        rows = rows.flatMap((row) => values.map((v) => ({ ...row, [k]: v })));
      }
      return rows;
    };

    const opposite = (v) => (v === 'payment' ? 'receipt' : 'payment');

    if (backBr && front) {
      let compared = 0;

      // -- billSettlementSign: the four rows ARE the fact space ---------------
      for (const vector of table.sign ?? []) {
        for (const row of expand(vector.given)) {
          const b = backBr.billSettlementSign(row.voucher, row.side);
          const f = front.billSettlementSign(row.voucher, row.side);
          compared++;
          if (b !== f) {
            failures.push(
              `bill-settlement DRIFT · sign/${vector.id} · ${JSON.stringify(row)}:\n` +
                `      client-back:  ${b}\n      client-front: ${f}\n      — ${vector.why}`,
            );
          } else if (b !== vector.expect) {
            failures.push(
              `bill-settlement RULE CHANGED · sign/${vector.id} · ${JSON.stringify(row)}:\n` +
                `      both sides say ${b}, the table says ${vector.expect}\n      — ${vector.why}`,
            );
          }
        }
      }

      // -- planBillSettlement: verdict, mappings, and the sentence ------------
      // Both sides are called the same way and the outcome normalised to one
      // shape, so a throw and a plan are comparable without the checker having
      // an opinion about which is right.
      const outcome = (fn, row) => {
        try {
          const plan = fn(row.voucher, row.bills, row.cash);
          return { ok: true, direction: plan.direction ?? null, mappings: plan.mappings, netCash: plan.netCash };
        } catch (err) {
          return { ok: false, message: err.message };
        }
      };

      for (const vector of table.plan ?? []) {
        for (const row of expand(vector.given)) {
          const b = outcome(backBr.planBillSettlement, row);
          const f = outcome(front.planBillSettlement, row);
          compared++;

          const shape = JSON.stringify(row);
          if (JSON.stringify(b) !== JSON.stringify(f)) {
            failures.push(
              `bill-settlement DRIFT · plan/${vector.id} · ${shape}:\n` +
                `      client-back:  ${JSON.stringify(b)}\n` +
                `      client-front: ${JSON.stringify(f)}\n      — ${vector.why}`,
            );
            continue;
          }

          // The table's own answer — the third opinion check 6 exists for: a
          // rule BOTH sides moved away from together passes a parity check and
          // fails this.
          let expected;
          if (vector.expect.error) {
            const template = table.messages[vector.expect.error];
            expected = template === undefined
              ? `«no message called '${vector.expect.error}' in the table»`
              : template
                .replace('${opposite}', opposite(row.voucher))
                .replace('${max}', String(vector.expect.max));
            if (b.ok || b.message !== expected) {
              failures.push(
                `bill-settlement RULE CHANGED · plan/${vector.id} · ${shape}:\n` +
                  `      both sides say ${JSON.stringify(b.ok ? b : b.message)}\n` +
                  `      the table says a refusal: ${JSON.stringify(expected)}\n      — ${vector.why}\n` +
                  '      If the rule or the wording genuinely changed, update scripts/vectors/ in the same commit.',
              );
            }
          } else {
            const want = { ok: true, direction: vector.expect.direction ?? null, mappings: vector.expect.mappings, netCash: row.cash };
            if (JSON.stringify(b) !== JSON.stringify(want)) {
              failures.push(
                `bill-settlement RULE CHANGED · plan/${vector.id} · ${shape}:\n` +
                  `      both sides say ${JSON.stringify(b)}\n` +
                  `      the table says ${JSON.stringify(want)}\n      — ${vector.why}\n` +
                  '      If the rule genuinely changed, update scripts/vectors/ in the same commit.',
              );
            }
          }
        }
      }

      // The document-shaped entry point must still agree with the bill-shaped
      // one it delegates to. Named rather than compared over vectors: it is one
      // repo's own internal consistency, and its unit spec is where 43 existing
      // cases already hold it.
      // The window the grid is handed, compared as data. It is stated twice —
      // the read bounds itself, the screen says *"the 200 oldest of 2,589"* —
      // and a drift makes that sentence a lie rather than an error.
      if (backBr.MAX_OPEN_BILLS_SHOWN !== front.MAX_OPEN_BILLS_SHOWN) {
        failures.push(
          `bill-settlement: MAX_OPEN_BILLS_SHOWN is ${backBr.MAX_OPEN_BILLS_SHOWN} in client-back and ` +
            `${front.MAX_OPEN_BILLS_SHOWN} in client-front — the grid would misstate how much it is hiding`,
        );
      }

      // The document-shaped entry point is checked by NAME rather than run: it
      // is the adapter that turns a `trx` into a bill before asking the rule
      // above, and its 43 existing unit cases are what hold the two together.
      const backSet = read(path.join(ROOT, 'jayhind-client-back/src/const/settlement.const.ts'));
      if (backSet && !/export function planSettlement\(/.test(backSet)) {
        failures.push('bill-settlement: `planSettlement` is gone from client-back — the settlement engine\'s own entry point');
      }
      // ⚠️ **What a ticked bill is NAMED BY on the wire** (P5c‑3). Until then a
      // document-less bill could not be named at all and this compared
      // `billIsSelectable`, which refused to offer one; the allocation column is
      // nullable now and `allocationTargetFor` says which of the two ids to
      // send. It is RUN, and the field names it produces are compared against
      // the fields the server's own DTO declares — `ValidationPipe` runs with
      // `forbidNonWhitelisted: true`, so a client posting a key the DTO does not
      // declare is a 400 reciting the field name and nothing local to either
      // repo could catch it. That is BUG-0066's shape exactly, which is how
      // check 7 came to be written the same way.
      if (typeof front.allocationTargetFor !== 'function') {
        failures.push(
          'bill-settlement: `allocationTargetFor` is missing on client-front — it is what names a ticked bill ' +
            'on the wire, and the two kinds of bill are named by different ids (P5c‑3).',
        );
      } else {
        const backDto = read(path.join(ROOT, 'jayhind-client-back/src/dto/trx-payment-receipt.dto.ts'));
        const dtoBody = backDto
          ? (backDto.match(/export class CreateUpdateTrxPaymentReceiptTrxDto \{[\s\S]*?\n\}/) || [''])[0]
          : '';
        const cases = [
          { bill: { id: 7, voucherId: 42 }, want: { trxId: 42 }, why: 'a bill a document made is named by that document' },
          { bill: { id: 7, voucherId: null }, want: { billRefId: 7 }, why: 'a bill the register raised on its own is named by its own id (D-55)' },
        ];
        for (const c of cases) {
          const got = front.allocationTargetFor(c.bill);
          compared += 1;
          if (JSON.stringify(got) !== JSON.stringify(c.want)) {
            failures.push(
              `bill-settlement: allocationTargetFor(${JSON.stringify(c.bill)}) is ${JSON.stringify(got)}, ` +
                `expected ${JSON.stringify(c.want)} — ${c.why}`,
            );
            continue;
          }
          const field = Object.keys(got)[0];
          if (dtoBody && !new RegExp(`\\b${field}\\??:`).test(dtoBody)) {
            failures.push(
              `bill-settlement: client-front posts \`${field}\` and ` +
                'CreateUpdateTrxPaymentReceiptTrxDto does not declare it — `forbidNonWhitelisted` answers 400 (P5c‑3).',
            );
          }
        }
      }

      notes.push(
        `bill-settlement: ${compared} behavioural comparisons over ` +
          `${(table.sign?.length ?? 0) + (table.plan?.length ?? 0)} region cases, run against BOTH ` +
          'implementations, comparing the mappings and the message text (P5c‑2).',
      );
    }
  }
}

// ── 13. the cost dimension's refusals: same verdict AND same SENTENCE ───────
//
// `cost-allocation.const.ts` (the centre tree) and `cost-centre-class.const.ts`
// (the percentage template) decide what the API refuses; `cost-rules.util.ts`
// says the same thing on the Cost Centres masters screen (P7c‑2), so an operator
// reads the reason rather than meeting a 400 on a control that looked live.
//
// ⚠️ Check 10's argument, one master across: the **message text** is compared,
// not only the verdict. Each of these sentences names the problem AND what to do
// instead (*re-file them first*; *remove it from that class*; *it can be
// archived, not erased*), and the class one runs on every keystroke in the class
// editor — a wording the two sides disagreed about would put one sentence under
// the operator's cursor and another in the toast the Save produces.
//
// ⚠️⚠️ One arm turns on a fact only the database has — `allocationCount`. The
// browser passes **null** rather than a guess, and both sides must then answer
// "allowed" so the request goes and the server refuses with this same sentence.
// The vector table states that equivalence, because it is a rule and not an
// accident of two signatures.
//
// ⚠️ Two backend files, one mirror. `describeClassLinesBlock` lives with the
// expansion it is one statement with; the centre rules live with the allocation
// invariant they protect. The screen is one screen, so the mirror is one file —
// and the name check below reads both sources.
//
// ⚠️⚠️ **P7c‑3 added a comparison that is not a sentence.** `expandCostCentreClass`
// is MONEY: a class is a stencil, so the entry screen expands it, the operator
// sees the rows, and what is saved is the rows — two sides rounding a third of
// ₹1,000 differently means the operator reads one split and the books carry
// another, with nothing to say which was meant. `FIGURE_RULES` compares it share
// by share in **integer paisa with `===`**, never `near`: P7c‑1 measured a
// paisa-tolerant check reading ₹0.06 as equal to ₹0.05 and passing.
{
  const BACK_CA = 'jayhind-client-back/src/const/cost-allocation.const.ts';
  const BACK_CC = 'jayhind-client-back/src/const/cost-centre-class.const.ts';
  const FRONT_CR = 'jayhindi-client-front/src/utils/cost-rules.util.ts';
  const vectorFile = path.join(__dirname, 'vectors/cost-rules.vectors.json');

  const backCa = read(path.join(ROOT, BACK_CA));
  const backCc = read(path.join(ROOT, BACK_CC));
  const frontCr = read(path.join(ROOT, FRONT_CR));

  let table;
  try {
    table = JSON.parse(fs.readFileSync(vectorFile, 'utf8'));
  } catch (err) {
    failures.push(`cost-rules vectors: could not read ${path.relative(ROOT, vectorFile)} — ${err.message}`);
  }

  if (table && backCa && backCc && frontCr) {
    let backAlloc, backClass, front;
    try {
      backAlloc = loadTsModule(...splitRepoPath(BACK_CA));
      backClass = loadTsModule(...splitRepoPath(BACK_CC));
      front = loadTsModule(...splitRepoPath(FRONT_CR));
    } catch (err) {
      failures.push(`cost-rules vectors: ${err.message}`);
    }

    // A case's `given` holds arrays: the cross-product is expanded, so one
    // hand-written case is a statement about a REGION. The regions are split
    // along the singular/plural seam, because these sentences count things.
    const expand = (given) => {
      let rows = [{}];
      for (const k of Object.keys(given)) {
        const values = Array.isArray(given[k]) ? given[k] : [given[k]];
        rows = rows.flatMap((row) => values.map((v) => ({ ...row, [k]: v })));
      }
      return rows;
    };

    const sentence = (id, row) => {
      if (id === null) return null;
      const template = table.messages[id];
      if (template === undefined) return `«no message called '${id}' in the table»`;
      return template.replace(/\$\{(\w+)\}/g, (_, k) => String(row[k]));
    };

    // The centre a placement/move case is about, and the parent it is aimed at.
    // `parentKind` is a NAME rather than a set of coordinates so that "inside
    // its own subtree" is expressed as a path relationship — which is the fact
    // the rule actually reads, and the one a parent-walk would get right for the
    // wrong reason.
    const CENTRE = (row) => ({ id: 5, name: row.centreName, categoryId: row.centreCategoryId, parentId: null, path: '/5/' });
    const PARENT = (row) => {
      const other = row.centreCategoryId + 1;
      switch (row.parentKind) {
        case 'none': return null;
        case 'self': return CENTRE(row);
        case 'same': return { id: 9, name: row.parentName, categoryId: row.centreCategoryId, parentId: null, path: '/9/' };
        case 'other': return { id: 9, name: row.parentName, categoryId: other, parentId: null, path: '/9/' };
        case 'descendant': return { id: 7, name: row.parentName, categoryId: row.centreCategoryId, parentId: 5, path: '/5/7/' };
        case 'descendant-other-category': return { id: 7, name: row.parentName, categoryId: other, parentId: 5, path: '/5/7/' };
        default: return null;
      }
    };
    const mapById = (rows) => new Map((rows ?? []).map((r) => [r.id, r]));

    // How each rule's row becomes the two calls. Deliberately dumb: anything
    // clever here could reconcile a real disagreement into agreement, which is
    // the one failure mode a parity check cannot afford. In particular BOTH
    // sides are handed the identical arguments — including a `null`
    // `allocationCount`, which is what makes the "not known here" row a
    // comparison rather than two different questions.
    const RULES = [
      {
        section: 'centrePlacement', fn: 'describeCentrePlacementBlock', mod: () => backAlloc,
        call: (m, row) => m.describeCentrePlacementBlock({ name: row.centreName, categoryId: row.centreCategoryId }, PARENT(row)),
      },
      {
        section: 'centreMove', fn: 'describeCentreMoveBlock', mod: () => backAlloc,
        call: (m, row) => m.describeCentreMoveBlock(CENTRE(row), PARENT(row)),
      },
      {
        section: 'categoryDelete', fn: 'describeCategoryDeleteBlock', mod: () => backAlloc,
        call: (m, row) => m.describeCategoryDeleteBlock({ name: row.name, isPrimary: row.isPrimary }, row.centreCount),
      },
      {
        section: 'centreDelete', fn: 'describeCentreDeleteBlock', mod: () => backAlloc,
        call: (m, row) => m.describeCentreDeleteBlock({ name: row.name }, row.childCount, row.allocationCount, row.classLineCount),
      },
      {
        // Literal: the fact space is a LIST plus two maps, not a product of
        // scalars — expanding `lines` would turn one multi-line case into N
        // single-line ones, which is the opposite of what a total or a duplicate
        // is about.
        section: 'classLines', fn: 'describeClassLinesBlock', mod: () => backClass, literal: true,
        call: (m, row) => m.describeClassLinesBlock(row.className, row.lines, mapById(row.centres), mapById(row.categories)),
      },
      {
        section: 'classDelete', fn: 'describeClassDeleteBlock', mod: () => backClass, literal: true,
        call: (m) => m.describeClassDeleteBlock(),
      },
      {
        // P7c‑3 — the VOUCHER's own payload rule. Literal for `classLines`'
        // reason: the fact space is a list of shares plus two maps.
        section: 'allocationPayload', fn: 'describeAllocationPayloadBlock', mod: () => backAlloc, literal: true,
        call: (m, row) => m.describeAllocationPayloadBlock(row.shares, mapById(row.centres), mapById(row.categories)),
      },
    ];

    // ⚠️ **The expansion is not a sentence, it is MONEY**, so it is compared
    // separately and in INTEGER PAISA with `===`. A class is a stencil: the
    // screen expands it, the operator sees the rows, and what is saved is the
    // rows — so two sides rounding a third of ₹1,000 differently means the
    // operator reads one split and the books carry another, with nothing to say
    // which was meant. A paisa-tolerant comparison cannot see that defect;
    // P7c‑1 measured it (70/30 of ₹0.05 came out as ₹0.06 and passed a `near`
    // check), which is why this comparator exists rather than reusing the one
    // above.
    const FIGURE_RULES = [
      {
        section: 'classExpansion', fn: 'expandCostCentreClass',
        call: (m, row) => m.expandCostCentreClass(row.lines, row.amount),
      },
    ];

    // The name check, and it is not redundant: a rule that exists on one side
    // only has no vector to fail (check 5's argument for keeping a name
    // comparison beside a behavioural one).
    const REFUSALS = /^describe[A-Z].*Block$/;
    const backNames = [
      ...parseExportedFunctions(backCa).filter((n) => REFUSALS.test(n)),
      ...parseExportedFunctions(backCc).filter((n) => REFUSALS.test(n)),
    ];
    const frontNames = parseExportedFunctions(frontCr).filter((n) => REFUSALS.test(n));

    // `RULES` only: `backNames`/`frontNames` are the `describe*Block` families,
    // and `expandCostCentreClass` is not one of them. Its own name check is
    // below, inside the loaded guard.
    const mirrored = new Set(RULES.map((r) => r.fn));
    for (const n of mirrored) {
      if (!backNames.includes(n)) failures.push(`cost-rules: '${n}' is compared here and no longer exists in client-back`);
      if (!frontNames.includes(n)) failures.push(`cost-rules: '${n}' exists in client-back but not client-front — the screen cannot state a refusal it does not have`);
    }
    for (const n of frontNames) {
      if (!backNames.includes(n)) failures.push(`cost-rules: '${n}' exists in client-front but not client-back — the screen would refuse something the server allows`);
    }
    // A backend refusal with no mirror is NAMED, not failed. As of P7c‑3 all
    // seven are mirrored and this is quiet; it stays because the next cost
    // refusal will be written on the server first, and a check that FAILED on
    // that gap would be demanding a screen that has not been built — which is a
    // check somebody switches off. A note asks for the mirror without stopping
    // the work that has to precede it.
    const unmirrored = backNames.filter((n) => !mirrored.has(n));
    if (unmirrored.length) {
      notes.push(
        `⚠️  cost-rules: ${unmirrored.join(', ')} ${unmirrored.length === 1 ? 'is' : 'are'} not mirrored in ` +
          'cost-rules.util.ts — add the mirror and a section in scripts/vectors/cost-rules.vectors.json ' +
          'with the screen that needs it.',
      );
    }

    if (backAlloc && backClass && front) {
      // The expansion is not a `describe*Block`, so the name regex above cannot
      // see it — and a rule that exists on one side only has no vector to fail
      // (check 5's argument for keeping a name comparison beside a behavioural
      // one). Named explicitly for that reason.
      for (const rule of FIGURE_RULES) {
        if (typeof backClass[rule.fn] !== 'function') {
          failures.push(`cost-rules: '${rule.fn}' is compared here and no longer exists in client-back`);
        }
        if (typeof front[rule.fn] !== 'function') {
          failures.push(
            `cost-rules: '${rule.fn}' exists in client-back but not client-front — the entry screen ` +
              'would have to ask the server to expand a class, which is not what a stencil is',
          );
        }
      }

      let compared = 0;
      for (const rule of RULES) {
        const cases = table[rule.section];
        if (!Array.isArray(cases)) {
          failures.push(`cost-rules vectors: no '${rule.section}' cases in the table`);
          continue;
        }
        for (const vector of cases) {
          for (const row of rule.literal ? [vector.given] : expand(vector.given)) {
            const expected = sentence(vector.expect, row);
            const b = rule.call(rule.mod(), row) ?? null;
            const f = rule.call(front, row) ?? null;
            compared++;

            const shape = JSON.stringify(row);
            // Three answers, so a failure says WHICH kind it is: drift between
            // the two sides and a rule both sides moved away from together need
            // different fixes.
            if (b !== f) {
              failures.push(
                `cost-rules DRIFT · ${rule.section}/${vector.id} · ${shape}:\n` +
                  `      client-back:  ${JSON.stringify(b)}\n` +
                  `      client-front: ${JSON.stringify(f)}\n` +
                  `      — ${vector.why}`,
              );
            } else if (b !== expected) {
              failures.push(
                `cost-rules RULE CHANGED · ${rule.section}/${vector.id} · ${shape}:\n` +
                  `      both sides say ${JSON.stringify(b)}\n` +
                  `      the table says ${JSON.stringify(expected)}\n` +
                  `      — ${vector.why}\n` +
                  '      If the rule or the wording genuinely changed, update scripts/vectors/ in the same commit.',
              );
            }
          }
        }
      }

      // ── the expansion, share by share, in integer paisa ───────────────────
      for (const rule of FIGURE_RULES) {
        const cases = table[rule.section];
        if (!Array.isArray(cases)) {
          failures.push(`cost-rules vectors: no '${rule.section}' cases in the table`);
          continue;
        }
        // ⚠️ `[categoryId, costCentreId, paisa]`, and the ORDER is compared too:
        // an expansion emitting the same shares in a different order would hand
        // the panel's rows to different centres than the operator read.
        const paisa = (shares) =>
          (shares ?? []).map((x) => [Number(x.categoryId), Number(x.costCentreId), Math.round(Number(x.amount) * 100)]);
        const show = (v) => JSON.stringify(v);
        for (const vector of cases) {
          const row = vector.given;
          const b = paisa(rule.call(backClass, row));
          const f = paisa(rule.call(front, row));
          const expected = (vector.expect ?? []).map((x) => x.map(Number));
          compared++;

          if (show(b) !== show(f)) {
            failures.push(
              `cost-rules DRIFT · ${rule.section}/${vector.id}:\n` +
                `      client-back:  ${show(b)}\n` +
                `      client-front: ${show(f)}\n` +
                '      (as [categoryId, costCentreId, PAISA] — compared exactly, never `near`)\n' +
                `      — ${vector.why}`,
            );
          } else if (show(b) !== show(expected)) {
            failures.push(
              `cost-rules RULE CHANGED · ${rule.section}/${vector.id}:\n` +
                `      both sides say ${show(b)}\n` +
                `      the table says ${show(expected)}\n` +
                '      (as [categoryId, costCentreId, PAISA])\n' +
                `      — ${vector.why}\n` +
                '      If the rule genuinely changed, update scripts/vectors/ in the same commit.',
            );
          }
        }
      }

      // The one constant both halves of the class rule are stated against. It is
      // compared as data because the sentence PRINTS it ("each category's lines
      // total 100%") and the expansion divides by it.
      if (backClass.CLASS_PERCENT_TOTAL !== front.CLASS_PERCENT_TOTAL) {
        failures.push(
          `cost-rules: CLASS_PERCENT_TOTAL is ${backClass.CLASS_PERCENT_TOTAL} in client-back and ` +
            `${front.CLASS_PERCENT_TOTAL} in client-front — the two would refuse different splits and say so in the same words`,
        );
      }

      notes.push(
        `cost-rules: ${compared} behavioural comparisons over ` +
          `${[...RULES, ...FIGURE_RULES].reduce((n, r) => n + (table[r.section]?.length ?? 0), 0)} region cases, run ` +
          'against BOTH implementations — the message text for the seven refusals, and the class ' +
          'expansion share by share in integer paisa (P7c‑2, P7c‑3).',
      );
    }
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
for (const n of notes) console.log(`note: ${n}`);

if (failures.length) {
  console.error(`\n✗ mirror drift — ${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`  • ${f}`);
  console.error('\nThese constants are duplicated on purpose (the server enforces, the UI mirrors');
  console.error('so it never offers what the server refuses). Fix both sides in the same change.\n');
  process.exit(1);
}

console.log('\n✓ all mirrored constants are in sync\n');
