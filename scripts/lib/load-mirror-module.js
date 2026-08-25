'use strict';
/**
 * Load a TypeScript module out of one of the submodules, so `check-mirrors.js`
 * can **run** the two implementations rather than only reading their names.
 *
 * ## Why this is needed at all
 *
 * §13.4's gap is that the voucher-lifecycle pair is compared by *name*: both
 * sides export the same decision functions, and nothing checks they agree about
 * what those functions mean. BUG-0024 was exactly that — the server honoured the
 * type-level `allowDelete` switch in stage one of delete and not in stage two,
 * while the frontend mirror checked it in both. Names matched throughout.
 *
 * Closing it means calling both. Which means loading TypeScript from two
 * independent repos out of a third one that has no `node_modules` of its own.
 *
 * ## How
 *
 * `esbuild` bundles the entry point to a self-contained CommonJS string, run
 * from **the owning repo's directory** so its own `tsconfig` paths and
 * dependencies resolve. Both lifecycle modules are pure and dependency-free by
 * design (`CLAUDE.md` §4.8: *"domain rules live in `src/const/*.const.ts` as
 * pure, dependency-free functions"*), so each bundle is a few kilobytes of
 * arithmetic with no framework in it.
 *
 * Bundling rather than transpiling one file, deliberately: both entries import
 * their `VoucherStatus` enum from elsewhere, and those are **runtime values**,
 * not types. Transpiling the entry alone would leave the import dangling and the
 * comparison would be run against `undefined === undefined`, which passes.
 *
 * ## Why a missing esbuild is a FAILURE and not a downgrade
 *
 * The obvious kindness is to fall back to the old name-only check when esbuild
 * cannot be found. That is precisely the thing this file exists to remove.
 * 9B-1 found two `FileCategory` enums whose doc comments claimed a contract that
 * had lapsed five days before the mission opened, and the lesson written down
 * was that **a mirror rule that cannot fail is worse than no rule, because it
 * reads as coverage.** A guard that silently becomes weaker when a directory is
 * missing is the same thing on a timer. So this throws, with the command that
 * fixes it.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..', '..');

/**
 * Where to look for `esbuild`. Any of the submodules will do — it is the same
 * bundler either way, and the first one present wins.
 */
const ESBUILD_CANDIDATES = [
  'qa-artifacts/node_modules/esbuild',
  'jayhindi-client-front/node_modules/esbuild',
  'jayhind-client-back/node_modules/esbuild',
  'jayhind-admin-front/node_modules/esbuild',
];

function requireEsbuild() {
  for (const candidate of ESBUILD_CANDIDATES) {
    const full = path.join(ROOT, candidate);
    if (fs.existsSync(full)) return require(full);
  }
  throw new Error(
    'esbuild not found in any submodule, so the behavioural mirror vectors cannot be spent.\n' +
      '  Fix:  cd qa-artifacts && npm install\n' +
      '  This check deliberately FAILS rather than falling back to the old name-only\n' +
      '  comparison — a mirror rule that cannot fail reads as coverage (see 9B-1).',
  );
}

/**
 * Bundle `entry` (relative to `repoDir`) and evaluate it, returning its exports.
 *
 * Evaluated in-process with `Module.prototype._compile` rather than written to a
 * temp file and `require`d: nothing lands on disk, so a failed run leaves no
 * artefact for the next one to pick up stale.
 */
function loadTsModule(repoDir, entry) {
  const esbuild = requireEsbuild();
  const absoluteRepo = path.join(ROOT, repoDir);
  const absoluteEntry = path.join(absoluteRepo, entry);

  if (!fs.existsSync(absoluteEntry)) {
    throw new Error(`${repoDir}/${entry} does not exist — the submodule may not be checked out`);
  }

  const result = esbuild.buildSync({
    entryPoints: [absoluteEntry],
    absWorkingDir: absoluteRepo,
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    logLevel: 'silent',
  });

  const code = result.outputFiles[0].text;
  const compiled = new Module(absoluteEntry, null);
  compiled.filename = absoluteEntry;
  compiled.paths = Module._nodeModulePaths(path.dirname(absoluteEntry));
  compiled._compile(code, absoluteEntry);
  return compiled.exports;
}

module.exports = { loadTsModule };
