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

**Status:** ready-for-agent

- [ ] The default test command runs both the runtime and the type pass and reports them
      separately
- [ ] A types-only command and a coverage command exist; coverage is not in the default
- [ ] `pnpm typecheck` passes, covering source, examples and explorations but not tests
- [ ] Construction tests exist for observable behaviours 1–3, titled with their numbers
- [ ] Every construction test fails, and fails only because the v1 entry point does not
      exist — no failure is caused by config, imports, or fixture mistakes
- [ ] Coverage runs and fails on the thresholds rather than erroring
- [ ] A shared fixtures module exists and is used by the construction tests
