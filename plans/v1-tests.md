# Spec: totorobot v1 test suite

> Status: ready for implementation. Produced from a design interview over
> [`docs/api.md`](../docs/api.md) and [`docs/api-rationale.md`](../docs/api-rationale.md).
> This spec covers **the test suite only**. The library implementation is a
> separate, later piece of work.

## Problem Statement

The v1 API is finalised and written down, but nothing executable holds the
implementation to it. `docs/api.md` enumerates 29 numbered observable behaviours
"written for the implementation to be driven from", and there is no suite that
drives from them.

What exists instead actively misleads:

- `tests/totorobot.test.ts` (650 lines) tests the **previous generation** API
  (`defineMachine` / `interpret`), which v1 replaces wholesale. A green run of it
  says nothing about v1.
- `tests/robot3/` tests **robot3 itself** — a reference library that is on its way
  out of the repo.
- No coverage tooling is installed at all, and no provider is configured.
- No type-level testing exists, despite the type behaviour being the substance of
  the project. Half of what `docs/api.md` promises ("what the types check") is
  compile-time only and therefore invisible to a runtime test runner.

Two properties of the coming implementation sharpen this. First, the code will be
**code-golfed** — dense, deliberately hard to read — so review cannot substitute
for coverage, and an uncovered branch is an unreviewable branch. Second, several
v1 guarantees are **negative or ordering-sensitive** (an input that matches no row
must change nothing; a throwing listener must not wedge the queue), and those are
exactly the guarantees that golfed code silently breaks and that eyeballing never
catches.

Without the suite landing first, the implementation has no target, regressions in
the type surface are undetectable, and the numbered behaviour list stays prose.

## Solution

Write the v1 test suite **before** the v1 implementation, and let it fail.

The suite is structurally isomorphic to `docs/api.md`: one test file per numbered
behaviour group, each test titled with the spec item number it asserts. Checking
"is behaviour 23 covered?" becomes opening a file, not grepping and hoping.

It runs on two levels through one entry point:

- **Runtime tests** drive the public surface (`machine`, `types`, `start`,
  `current`, `available`, `send`, `on`) and assert the 29 observable behaviours
  plus three acceptance cases.
- **Type tests** (Vitest's `--typecheck`) assert what the compiler is supposed to
  accept and reject: per-state data narrowing, handler parameter inference, the
  transition-key grammar, pattern validity, and the derived type helpers.

Because `src/` is deliberately left untouched, **every new test fails on landing**:
runtime tests on missing exports, type tests as unused `@ts-expect-error`
directives. This is the intended state. `pnpm typecheck` remains **green**, so the
existing source, examples and explorations keep a working signal throughout the
implementation phase.

The result is a target the implementer works against, a coverage gate that makes
golfing safe, and a mechanical mapping from spec item to test.

## User Stories

**Driving the implementation**

1. As the library implementer, I want a failing test for every numbered behaviour
   in `docs/api.md`, so that I have an unambiguous definition of done rather than a
   prose document I must re-read and interpret.
2. As the library implementer, I want each test titled with its spec item number,
   so that a failure tells me which sentence of the spec I violated without my
   having to reverse-engineer intent from the assertion.
3. As the library implementer, I want the test files grouped exactly as the spec
   groups its behaviours, so that a spec edit maps to exactly one test file.
4. As the library implementer, I want the suite to land fully red, so that going
   green is meaningful progress rather than an accident of vacuous assertions.
5. As the library implementer, I want `pnpm typecheck` to stay green while the
   suite is red, so that I retain a working signal for whether I have broken the
   existing source.
6. As the library implementer, I want the suite to run in one command, so that my
   inner loop is a single keystroke rather than a remembered sequence.

**Confidence in golfed code**

7. As the library implementer, I want coverage thresholds at 100%, so that a dense
   one-line ternary cannot hide an untested branch.
8. As the library implementer, I want coverage measured over `src/` only, so that
   test helpers and fixtures do not inflate the number and mask a real gap.
9. As the library implementer, I want coverage out of the default test command, so
   that the instrumented run does not slow the loop I use constantly while golfing.
10. As a reviewer, I want any deliberate coverage exclusion to be explicit in the
    source, so that gaps are argued in review rather than discovered later.

**Type-level guarantees**

11. As a TypeScript consumer, I want narrowing `current.state` to narrow
    `current.data`, so that I read state-specific fields without nullable padding.
12. As a TypeScript consumer, I want a handler's `data` to be its **source**
    state's data and `input` to be that input's payload, so that I write handlers
    with no type annotations at all.
13. As a TypeScript consumer, I want a handler returning the wrong shape for its
    target state to be a compile error, so that a mis-projected transition is
    caught at the keystroke rather than at runtime.
14. As a TypeScript consumer, I want reading source data the source state does not
    have to be a compile error, so that per-state data is enforced and not merely
    documented.
15. As a TypeScript consumer, I want unknown state or input names in a transition
    key to be rejected, so that a typo in the vocabulary cannot ship.
16. As a TypeScript consumer, I want malformed transition keys — wrong spacing
    included — rejected on the offending row, so that the error points at the line I
    must fix rather than at the whole `transitions` block.
17. As a TypeScript consumer, I want unknown names in an `.on()` pattern rejected,
    so that a listener silently subscribed to nothing is impossible.
18. As a TypeScript consumer, I want the transition record discriminated by `on`,
    so that checking `e.on === 'submit'` narrows `e.input` to that input's payload.
19. As a TypeScript consumer, I want `start()` to take no argument when the initial
    state is `void` and to require one otherwise, so that the ceremony matches the
    machine.
20. As a TypeScript consumer, I want `send('cancel')` to need no payload for a
    `void` input and to require one otherwise, so that I cannot forget a payload or
    invent one.
21. As a TypeScript consumer, I want `InputsOf`, `StatesOf`, `Handled<M, S>` and
    `Sources<M, S>` to resolve correctly, so that I can derive types from a machine
    without reaching into its internals.
22. As a TypeScript consumer, I want `skip()` to be returnable from a handler for
    every target shape including a `void` target, so that declining is available on
    every row.
23. As a TypeScript consumer, I want a wrong-shaped return still rejected on a row
    that could also return `skip()`, so that adding the skip channel did not
    weaken target checking.
24. As a TypeScript consumer authoring a large machine, I want inference to hold at
    20 states and 44 rows, so that the type engine does not degrade on a realistic
    machine.

**The untyped path**

25. As a JavaScript consumer, I want `machine({ initial, transitions })` — no
    vocabulary — to work, so that I can use the library without declaring types.
26. As a JavaScript consumer, I want an input name outside the vocabulary to change
    nothing rather than throw, so that untyped and generated call sites are safe.
27. As a TypeScript consumer who declared no vocabulary, I want state and input
    names to widen to `string` and `data`/`input` to `unknown`, so that omitting
    the vocabulary widens rather than breaks.
28. As a TypeScript consumer who declared no vocabulary, I want malformed keys
    still rejected, so that the key grammar is enforced independently of the
    vocabulary.
29. As a TypeScript consumer, I want declaring one of `inputs`/`states` and omitting
    the other to check that half and widen the other, so that partial adoption is
    supported.

**Runtime behaviour**

30. As a consumer, I want `start(data)` to yield a host at the initial state with
    my data, so that a machine begins where I said it does.
31. As a consumer, I want two hosts from one definition to share no state and no
    listeners, so that one component's machine cannot disturb another's.
32. As a consumer, I want the definition never mutated, so that I can export,
    import and reuse it as inert data.
33. As a consumer, I want a value read from `current` to stay valid and unchanged
    after later transitions, so that I can hold it in component state, compare it,
    or serialise it.
34. As a consumer, I want `current.data` to be `undefined` for a `void` state, so
    that data-free states need no placeholder object.
35. As a UI author, I want `available` to list the current state's inputs in table
    declaration order without duplicates, so that I can render buttons directly
    from it in a stable order.
36. As a UI author, I want `available` to be `[]` for a state with no outgoing
    rows, so that a terminal state renders no controls.
37. As a UI author, I want `available` to list an input whose every candidate row
    would decline, so that capability is a property of the table and not of a
    payload I do not yet have.
38. As a consumer, I want a handled input to commit and notify every matching
    listener, so that a transition is observable.
39. As a consumer, I want an input that matches no row to change nothing and notify
    nobody, so that broad sending is safe from every state.
40. As a consumer, I want an input whose every candidate row declines to be
    indistinguishable from one that matched no row, so that declining is a normal
    silent outcome.
41. As a consumer, I want candidate rows tried in declaration order with the first
    non-declining one winning, so that priority is something I control by where I
    write the row.
42. As a consumer, I want a self-transition to commit and notify like any other
    row, with the old data on `from` and the new on `to`, so that same-state
    updates are ordinary transitions.
43. As a consumer, I want `send` to always return `undefined`, so that I am never
    tempted to branch on its result.
44. As an async caller, I want a result that arrives after the machine has moved on
    to match no row and do nothing, so that stale results are free.

**Observation and ordering**

45. As a consumer, I want `on` to return an unsubscribe function that is safe to
    call more than once, so that cleanup is idempotent.
46. As a consumer, I want listeners to fire after the commit, so that `doc.current`
    and `e.to` always agree inside a listener.
47. As a consumer, I want listeners to fire in registration order, so that ordering
    is something I control.
48. As a consumer, I want the listener list snapshotted before dispatch, so that a
    listener unsubscribed mid-dispatch still runs for the current transition and one
    registered mid-dispatch does not.
49. As a consumer, I want `*` to match any state and an unlabelled arrow to match
    any input, so that I can subscribe at the breadth I need.
50. As a consumer, I want a self-transition to match both the exit pattern and the
    entry pattern, so that restart-on-re-entry falls out of the pattern language.
51. As a consumer, I want a `send` from inside a listener queued rather than
    nested, so that the listeners after it are told about the transition they are
    in and never a stale one.
52. As a consumer, I want a listener never re-entered while an earlier call is
    still running, so that I can write listeners against a contract that excludes
    reentrancy.
53. As a consumer, I want the queue to drain before the outermost `send` returns,
    synchronously and not on a microtask, so that the machine is settled by the time
    control returns to me.
54. As a consumer, I want several queued sends drained first-in-first-out, so that
    ordering is predictable.
55. As a consumer, I want a queued send evaluated against the state at drain time,
    so that it may correctly find no row and do nothing.
56. As a consumer, I want every submitted input considered exactly once, so that
    nothing is silently dropped or applied twice.
57. As a consumer, I want a throwing listener to propagate out of `send` with the
    transition still committed, so that the exception surfaces at the call that
    caused it without leaving a state nobody observed.
58. As a consumer, I want the host to still work after a listener threw —
    **including a later send from inside a listener** — so that one bad listener
    cannot wedge the queue permanently.

**Maintenance**

59. As a maintainer, I want the previous-generation test file and the vendored
    robot3 tests removed, so that the repo holds one suite describing one API.
60. As a maintainer, I want the behavioural cases carried over from the robot3
    tests recorded in the commit message, so that deleting them is auditable.
61. As a maintainer, I want the two behaviours clarified during design written back
    into `docs/api.md`, so that the spec and the suite do not disagree.
62. As a maintainer, I want deliberately untested claims listed explicitly, so that
    a gap is a recorded decision rather than an oversight.

## Implementation Decisions

### Stance: tests first, source untouched

`src/totorobot.ts` is **not modified**. It continues to export the previous
generation (`defineMachine` / `interpret`), which still compiles.

The rejected alternative was a type-complete stub — full v1 type surface with
`throw new Error('not implemented')` bodies — which would make type tests
meaningfully red/green immediately. It was rejected because writing that stub's
types _is_ the hard half of the implementation (the key grammar and handler
inference), so "write the tests" would have quietly become "write the type engine".
An `any`-typed stub was rejected outright: it makes type assertions vacuously pass,
which is worse than red.

Accepted consequence: type tests fail as **unused `@ts-expect-error`** rather than
as assertion failures, and positive `expectTypeOf` assertions fail on the missing
export. Both go green when the implementation lands.

### Testing seam

**One seam: the package's public entry point.** All runtime behaviour is asserted
through `machine` and `types` and the host they produce. No test imports an
internal module, and the implementation exports nothing for testing's sake.

The type seam is the same entry point's declarations. In particular the
**transition-key error carrier stays internal**. The spec promises malformed keys
are reported as `not a transition: '…'`, which in practice requires the expected
type of a bad row to _be_ that string literal — but that carrier is not exported
and no test asserts the message text. Negative type assertions are therefore
`@ts-expect-error` only.

Accepted consequence, recorded because it is a real weakness: with the whole file
red, `@ts-expect-error` cannot distinguish an intended rejection from incidental
breakage. Mitigated by Vitest's recommendation that type-test files also be
_executed_ (see below), which catches mistyped directives.

### Test file layout

**All test files sit flat in `tests/`, one directory, with the `.test-d.ts`
suffix distinguishing type tests from runtime tests.** This is Vitest's own
convention — its default `typecheck.include` glob
(`**/*.{test,spec}-d.?(c|m)[jt]s?(x)`) is location-agnostic, and the guide
prescribes no directory structure. A dedicated `tests/types/` directory was
considered and rejected: it introduces a second organising axis (by tool) on top
of the first (by spec section), and it separates `untyped.test.js` from
`untyped.test-d.ts`, which assert two halves of the same spec group.

Runtime test files mirror the spec's own behaviour groups one-to-one:

| file                   | spec group     | items |
| ---------------------- | -------------- | ----- |
| `construction.test.ts` | Construction   | 1–3   |
| `reading.test.ts`      | Reading        | 4–7   |
| `sending.test.ts`      | Sending        | 8–16  |
| `observing.test.ts`    | Observing      | 17–21 |
| `queue.test.ts`        | The queue      | 22–26 |
| `untyped.test.js`      | untyped caller | 16    |

Type test files are split by subject, since "what the types check" is its own
spec section with no numbered items and does not decompose along the behaviour
groups:

| file                   | subject                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `vocabulary.test-d.ts` | per-state narrowing, handler inference, `start`/`send` arity, derived helpers |
| `keys.test-d.ts`       | transition-key grammar, target checking, source reads, `skip()`               |
| `patterns.test-d.ts`   | `.on()` pattern validity, transition record discrimination                    |
| `untyped.test-d.ts`    | the untyped path (items 27–29)                                                |
| `scale.test-d.ts`      | inference at 20 states / 44 rows                                              |

Acceptance-case traces live in `tests/acceptance/`. Shared machines live in
`tests/fixtures.ts`.

**Test titles carry the spec item number** (e.g. `[8] a handled input commits`).
Accepted cost: churn if the spec's numbering ever shifts.

### Tooling configuration

- **`.test-d.ts` files appear in both `include` and `typecheck.include`.** This is
  Vitest's explicit recommendation — type-test files are also _run_, so a mistyped
  directive (`@ts-expect-errors`) fails instead of silently passing. Given that
  `@ts-expect-error` is the only negative mechanism, this is a guardrail rather
  than a nicety. Vitest ≥2.1 reports the two passes separately.
- **One command.** `test` runs `vitest run --typecheck`, matching Vitest's
  documented script shape. `test:types` (`--typecheck.only`) exists for a focused
  loop; `test:coverage` for the instrumented run.
- **`typecheck.ignoreSourceErrors: false`** — a break in `src/` should be heard.
- **tsconfig split.** Vitest owns the test files via `tests/tsconfig.json`
  (extending the root); `tests` is removed from the root `tsconfig.json` `include`
  so `pnpm typecheck` stays a clean green signal for `src`, `examples` and
  `explorations` throughout the implementation phase. Vitest does not prescribe
  this; it is a project judgement to keep two commands with two distinct meanings.
- **Coverage: the `v8` provider**, the Vitest default. Istanbul was considered for
  exact branch attribution on dense ternaries, and rejected on the documentation's
  statement that V8 has used AST-based remapping since v3.2.0 "which produces
  identical coverage reports to Istanbul"; Istanbul is now only for non-V8
  environments. Thresholds are set to **100** across lines, functions, statements
  and branches, scoped to `src/**`, and land **now** — failing until the
  implementation exists, consistent with the all-red stance. Coverage is **not** in
  the default `test` script.

### Deletions

`tests/totorobot.test.ts` and `tests/robot3/` are removed. The former is
superseded and would otherwise assert a contradictory API; the latter is reference
material already flagged for removal.

The robot3 tests are **mined for behavioural cases before deletion**, and the
carry-over is recorded in the commit message. Known mapping: guard fall-through →
`skip()`; `immediate` → deferred, no v1 equivalent; `invoke` → deferred; `debug`
and `logging` → no v1 equivalent.

`explorations/` and `examples/` are untouched. `explorations/` remains in both the
Vitest `include` and the root `tsconfig` — it is evidence for the rationale
documents and currently passes, so it keeps its signal.

### Two spec clarifications written back to `docs/api.md`

Both surfaced during design and are not currently recorded:

1. **`available` lists an input whose every candidate row would decline.**
   `available` is derived from the table, not from evaluating handlers — computing
   it otherwise would require a payload it does not have.
2. **`types<T>()` returns `null`** at runtime. Previously specified only as
   "carries no runtime value".

### Fixture strategy

Purpose-built minimal machines, defined inline, for the 29 behaviour tests: a
two-state `void`/`void` toggle covers most of the list, and a small machine with
two rows sharing one `(from, input)` pair covers declaration-order fall-through.
The rejected alternative was running the whole suite over the single `publication`
machine from `docs/api.md` — least code, but every test then depends on one
topology and no test reads standalone.

Acceptance cases from `docs/acceptance-cases.md` are handled as follows:

| case                   | disposition                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| 1. Marking Menu        | **In**, with effects re-expressed as caller-side `.on()` listeners, since v1 owns no effects   |
| 2. Two-state toggle    | **In** as written, plus live-runtime trace 1 (queued send during observation)                  |
| 3. Async request race  | **In** as written; settlement is an ordinary `send`, so no timers and no wall-clock dependency |
| 4. Twenty-state stress | **Type fixture only** — its measurement half belongs to `scripts/`, not to Vitest              |
| Live-runtime trace 2   | **Out** — assumes disposal, and v1 has no `stop()`                                             |

### Behaviours added beyond the 29, from the rationale

`docs/api-rationale.md` §12 states guarantees the numbered list does not fully
capture. These get their own tests:

- **The drain flag must be reset on the way out.** The rationale names `try`/
  `finally` and the failure it prevents: a single throw otherwise wedges the host
  into answering `queued` forever and never draining. Spec item 26 only requires
  that "a later `send` transitions and notifies normally", which a _top-level_
  send satisfies even with a wedged flag. The test therefore asserts a **send from
  inside a listener** still queues and drains after a throw.
- **A listener is never re-entered** while an earlier call is still running —
  stated as a contract in its own right, distinct from queue ordering.
- **A self-transition matches both** the exit pattern and the entry pattern — the
  claim that makes restart-on-re-entry fall out of the pattern language.
- **Every submitted input is considered exactly once** — the drain guarantee is
  unconditional now that there is no disposal.
- **Bare keys are rejected in both positions** (`transitions` and `.on()`), and
  there is no `-*>` form.
- **Two hosts share no listeners**, not merely no state.

### Type-surface decisions

- **`skip()` returns an internal symbol.** A handler's return type is therefore
  `TargetData | typeof SkipSymbol`. Because the symbol is internal, tests assert
  only that `skip()` is returnable from a handler for every target shape including
  a `void` target, plus the negative that a wrong-shaped return still errors —
  proving the union did not swallow target checking. Nothing asserts the symbol's
  identity.
- **`available` is asserted as `readonly InputName[]`**, the weak claim — not the
  precise per-state literal union shown in a `docs/api.md` code comment. The
  precise typing is only reachable when the state is statically known, and the
  spec is explicit that per-state capabilities are advertised at runtime rather
  than enforced by the compiler. Asserting the weak claim leaves an implementation
  that cannot manage the strong one free to pass.

## Testing Decisions

### What makes a good test here

**External behaviour only.** Every runtime assertion goes through the public entry
point. No test reaches into internals, and the implementation gains no export it
would not otherwise have. This matters more than usual: the implementation will be
golfed and restructured aggressively, and a suite coupled to its shape would have
to be rewritten alongside it.

**One claim per test, named by spec item.** A failure should identify the violated
sentence without interpretation.

**Ordering claims are asserted as whole sequences.** Eight behaviours are ordering
claims (registration order, snapshot semantics, the queue, abandonment after a
throw, commit-before-notify). Each uses a **shared trace array** — listeners push
a string, and the test asserts one `toEqual` against the entire sequence:

```ts
const log: string[] = []
doc.on('* -> *', () => log.push('first'))
doc.on('* -> *', () => {
	log.push('second')
	doc.send('toggle')
})
doc.send('toggle')
expect(log).toEqual(['first', 'second', 'first(2)', 'second(2)'])
```

One assertion carries the whole claim, the expected array reads like the spec's own
trace prose, and interleaving — the queue draining _after_ the remaining listeners
— is visible rather than inferred. Pairwise `mock.invocationCallOrder` comparisons
were rejected: they state ordering indirectly and read badly past four events.

`vi.fn()` is used **only** where the assertion concerns the transition record's
contents (`{ on, input, from, to }`) rather than sequence. A single test uses one
style or the other, never both.

**Two assertion-precision rulings:**

- _A value read from `current` is unchanged after a transition_ is asserted against
  a deep clone captured beforehand **and** with an object-identity check
  (`before !== after`), so an implementation that mutates in place fails even when
  the values coincide.
- _Inside a listener, `e.to` deep-equals `doc.current`_ uses `toEqual`,
  deliberately **not** `toBe`. The spec says deep-equals; identity is left
  unasserted rather than over-specified.

**Definition immutability** is asserted by deep-cloning the definition before
`start()` and a full trace, then `toStrictEqual` against the clone — not by
freezing. The spec is explicit that immutability is `readonly` in the types plus a
promise, not a runtime guard, so a freeze-based test would assert a guarantee that
was deliberately not made.

**No wall-clock dependence and no fake timers.** v1 is fully synchronous; the async
acceptance case settles by an ordinary `send`.

### The untyped path

The behaviours reachable only from untyped code (an input name outside the
vocabulary; a bad state name at `.on()`) are tested from a **real plain-JavaScript
file**, `tests/untyped.test.js`, with no `@ts-check`. The spec's own wording is
"reachable from untyped code", so a JS file is the literal fixture, and it is the
only option where the runtime claim and the type claim are not entangled. The
existing Vitest `include` already covers `.js`, and `typecheck.allowJs` stays
`false`.

Rejected: a TypeScript file with `@ts-expect-error` above a runtime assertion —
`.test.ts` files are not in `typecheck.include`, so the directive's correctness
would go unchecked. Also rejected: casting through a widened signature, which
asserts nothing about rejection and reads as a workaround.

The corresponding _type_-side claim (that the same call is rejected) is asserted
separately in a `.test-d.ts`.

### Modules under test

One: the package entry point. Coverage is scoped to `src/**`; fixtures and helpers
are excluded from the measurement.

### Prior art in this repo

- `tests/robot3/invoke.test.js` already uses the shared-trace-array style for
  ordering assertions — the pattern is carried over rather than invented.
- Commit `7b70b47` flattened nested `describe` blocks; the new suite keeps that
  shape, favouring one level of grouping and descriptive test titles over nesting.
- `tests/totorobot.test.ts` already pairs `expectTypeOf` with runtime assertions;
  the new suite separates them into `.test.ts` and `.test-d.ts` because Vitest runs
  the two passes independently.
- Prettier formatting and the pinned TypeScript version apply as elsewhere in the
  repo; tabs, per `.prettierrc.json`.

## Out of Scope

- **The v1 implementation itself.** `src/totorobot.ts` is untouched by this work.
  The suite is expected to be entirely red on landing.
- **The residency recipe** from `docs/api.md` — the documented replacement for the
  dropped residency feature, including its `persistent` and `keyed` wrappers. Not
  tested, by explicit decision.
- **Live-runtime trace 2** from `docs/acceptance-cases.md` — it assumes disposal,
  and v1 has no `stop()`.
- **Acceptance case 4's measurement half** — declaration size, cold check
  duration, completion and diagnostic latency. Stays with `scripts/`. Only its
  inference-at-scale aspect is used, as a type fixture.
- **The error-message wording** `not a transition: '…'`. The carrier stays
  internal and no test asserts the message text.
- **The precise per-state literal typing of `available`.** The weak claim is
  asserted; the strong one is left available to a later implementation.
- **`skip()`'s symbol identity.**
- **Deferred v1 features**: `actions`, immediate transitions, composition/invoked
  children. Nothing in the suite anticipates them.
- **`examples/` and `explorations/`.** Untouched; `explorations/` keeps its
  existing Vitest and tsconfig coverage.
- **Benchmarks and bundle-size measurement.**

## Further Notes

**Expected state on landing.** `pnpm test` fails comprehensively — runtime tests on
missing exports, type tests as unused `@ts-expect-error`, coverage below
threshold. `pnpm typecheck` **passes**. Anyone encountering the repo in this state
should read the failure as designed, not broken.

**The `@ts-expect-error` weakness is known and accepted.** Under an all-red file it
cannot distinguish an intended rejection from incidental breakage. The mitigation
is executing the type-test files (Vitest's recommendation) so mistyped directives
fail. The stronger option — exporting the key-grammar validator and asserting the
error message positively — was considered and declined to keep the seam count at
one.

**Numbering is a coupling.** Test titles carry spec item numbers, so renumbering
`docs/api.md` requires a matching pass over test titles. Accepted for the
mechanical spec↔suite mapping it buys.

**The suite is the second source of truth after `docs/api.md`.** Where the two
disagree, `docs/api.md` wins and the suite is corrected — except for the two
clarifications this work writes back into it.
