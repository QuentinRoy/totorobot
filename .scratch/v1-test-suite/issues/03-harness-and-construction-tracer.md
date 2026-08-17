# 03 — Test harness and the construction tracer

**What to build:** The thinnest complete path through the whole testing setup — config,
fixtures, and one behaviour group — so that everything after it is additive.

A contributor can run one command and see the v1 suite execute, with the construction
behaviours failing for the one correct reason: the v1 entry point does not exist yet.
`pnpm typecheck` stays green throughout, so the existing source keeps a working signal
during the whole implementation phase.

The harness:

- Vitest config with `.test-d.ts` files in **both** `include` and `typecheck.include`,
  per Vitest's own recommendation, so type-test files are executed as well as
  type-checked and a mistyped `@ts-expect-error` directive fails instead of silently
  passing. This is the guardrail for the decision that `@ts-expect-error` is the only
  negative type mechanism.
- `typecheck.enabled`, pointed at a `tests` tsconfig, with `ignoreSourceErrors: false`.
- The tsconfig split: the tests get their own tsconfig extending the root, and `tests`
  is removed from the root tsconfig's `include`, so `tsc` covers `src`/`examples`/
  `explorations` only.
- Coverage via the `v8` provider (the Vitest default; AST-based remapping has been the
  default since v3.2.0 and produces reports identical to Istanbul), scoped to `src`,
  thresholds at 100 across lines/functions/statements/branches. Thresholds land now and
  fail now, consistent with the red-by-design stance.
- Scripts: the default test command runs runtime and type passes together; a
  types-only command exists for a focused loop; coverage is its own command and is
  **not** in the default, so the inner loop stays fast during golfing.

The tracer:

- Shared fixtures module holding the minimal machines the suite reuses — chiefly a
  two-state `void`/`void` toggle, which covers a large share of the behaviour list.
- Construction tests for observable behaviours 1–3: `start(data)` yields a host at the
  initial state; `start()` takes no argument for a `void` initial state and its data is
  `undefined`; two hosts from one definition share neither current state nor listeners;
  nothing mutates the definition.

Definition immutability is asserted by deep-cloning the definition before `start()` and
a full trace, then comparing — **not** by freezing. The spec is explicit that
immutability is `readonly` in the types plus a promise, not a runtime guard, so a
freeze-based test would assert a guarantee that was deliberately not made.

All test files sit flat in `tests/`, with the `.test-d.ts` suffix distinguishing type
tests from runtime tests. Test titles carry their spec item number.

**Blocked by:** 01 — Retire the legacy suites. The harness cannot be verified while the
superseded suites are still present, since they would run under the new config and
type-check against the old API.

**Status:** done

- [x] The default test command runs both the runtime and the type pass and reports them
      separately — `pnpm test` is `vitest run --typecheck`, and its output carries a
      `Tests` line and a separate `Type Errors` line
- [x] A types-only command and a coverage command exist; coverage is not in the default —
      `test:types` (`vitest run --typecheck.only`) and `test:coverage`
      (`vitest run --coverage`), both added alongside `test` rather than folded into it
- [x] `pnpm typecheck` passes, covering source, examples and explorations but not tests —
      `tests` is removed from the root `tsconfig.json`'s `include`, and `tests/tsconfig.json`
      extends the root and covers `tests` on its own, referenced from
      `vitest.config.ts`'s `typecheck.tsconfig`
- [x] Construction tests exist for observable behaviours 1–3, titled with their numbers —
      `tests/construction.test.ts`, five tests over items `[1]`, `[2]`, `[3]`
- [x] Every construction test fails, and fails only because the v1 entry point does not
      exist — no failure is caused by config, imports, or fixture mistakes — the run
      reports one `TypeError: types is not a function` at `tests/fixtures.ts:16`, where
      the shared fixture calls the not-yet-existing `types()`; `pnpm typecheck` and
      `pnpm format:check` are both clean, so nothing else is wrong
- [x] Coverage runs and fails on the thresholds rather than erroring — the `coverage`
      block in `vitest.config.ts` also sets `reportOnFailure` to `true` (undocumented by
      the ticket text but necessary: without it Vitest skips the coverage report
      entirely once the run has already failed, so the threshold check never appears).
      With it, `pnpm test:coverage` prints the V8 summary and four explicit
      `ERROR: Coverage for … does not meet global threshold (100%)` lines against the
      previous-generation `src/totorobot.ts`
- [x] A shared fixtures module exists and is used by the construction tests —
      `tests/fixtures.ts` exports the two-state `void`/`void` `toggle` machine, imported
      by `tests/construction.test.ts`

`@vitest/coverage-v8` was added as a devDependency (`^4.1.10`, matching the pinned
`vitest` version) — the `v8` coverage provider is not bundled with `vitest` itself.
`vitest.config.js` was renamed to `vitest.config.ts` for consistency with the rest of the
TypeScript-first tooling in this repo.
