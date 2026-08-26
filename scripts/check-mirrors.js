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
