# Explorations

Compilable evidence for the API shapes considered in
[Design explorations](../docs/api-rationale.md). None of this is the
library; nothing here is exported from `totorobot`. Almost every function is
`declare`d, because only the signatures matter - each file exists to record what
TypeScript can and cannot infer for a proposed call shape.

The exception is [`robot3-wrapper.ts`](robot3-wrapper.ts), which has a real
runtime because its claim is a runtime one, and is covered by
[`robot3-wrapper.test.ts`](robot3-wrapper.test.ts).

## Two rounds, checked two ways

The files in this directory are the **first round** — call shapes for the
generation-1 spec. [`candidates/`](candidates/) is the **second**: the nine
notation prototypes and three rival baselines behind the layout decision in
[api-rationale.md](../docs/api-rationale.md), which links into
[`candidates/n2-declared-types/`](candidates/n2-declared-types/) by line number.

They are checked separately, because they need different compiler settings:

|                | covered by                  | config                            |
| -------------- | --------------------------- | --------------------------------- |
| this directory | `pnpm typecheck`            | the root `tsconfig.json`          |
| `candidates/`  | `pnpm typecheck:candidates` | one `tsconfig.json` per candidate |

Candidates relax `noUnusedLocals`/`noUnusedParameters` — a prototype keeps unused
levers on purpose — so the root config excludes them.
`scripts/check-candidates.ts` runs each under its own config and **asserts the
negative results still fail**: `c3-target-list` is kept as evidence that a
notation does not work, and it is reported as a failure if it ever starts
compiling. Same tripwire idea as below, one level up.

## Why they are type-checked

These files are in `tsconfig.json`'s `include`, so `pnpm typecheck` covers them,
and `vitest.config.js` includes the one test file, so `pnpm test` covers that.
This matters more for the failures than the successes.

A prototype that merely _describes_ a limitation rots: the compiler moves on and
nobody notices. So the failures are recorded as assertions instead. Where a
proposal loses inference, the degraded type is asserted directly
(`assertType<Equal<typeof context, unknown>>()`); where it produces a genuine
error, the error is pinned with `@ts-expect-error`.

The useful consequence: if a future TypeScript release fixes one of these
inference limitations, its `@ts-expect-error` becomes an
`Unused '@ts-expect-error' directive` error and `pnpm typecheck` fails. The
tripwire is the point - it announces that a rejected option is worth
reconsidering.

The same idea covers the Robot3 wrapper from the other side: its last three
tests assert Robot3's current misbehaviour, so a Robot3 release that fixes one
of them turns the test red and says so.

So a green `pnpm typecheck` here means "every finding still holds", not "every
prototype works".

## The files

Two independent families. They do not share machinery and cannot - they assume
different spec shapes.

### Callback-kit family

Keeps the current record-shaped spec and the builder callback; only the call
shape changes. Both import the real types from
[`src/totorobot.ts`](../src/totorobot.ts).

| File                                                               | Shape                                                        | Result                                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`option-a-spec-as-value.ts`](option-a-spec-as-value.ts)           | `createMachine(defineMachine<S>(), initial, build)`          | **Fails as written.** Inferring `S` in the same call that infers `States` starves the builder's return of its per-key contextual type. Contains the control that isolates the cause, and the untried levers that might repair it. |
| [`option-b-define-in-callback.ts`](option-b-define-in-callback.ts) | `createMachine(({ define }) => define<S>()(initial, build))` | Works, but `define` cannot escape the callback, so a spec can never be declared ahead of time.                                                                                                                                    |

Option C from the doc has no file: it was sketched, never tested.

### Config-object family

Carries the spec as a value (`types: {} as Spec`), uses `name`-keyed
discriminated unions for states and events, and makes `state` / `transition` /
`reduce` / `guard` top-level functions. Shared machinery lives in
[`config-object-kit.ts`](config-object-kit.ts).

| File                                                                 | Shape                                                                      | Result                                                                                                                                                                                                |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`option-d-state-map-argument.ts`](option-d-state-map-argument.ts)   | `createMachine(config, statesMap)`                                         | **Works completely.** Exact per-state contexts and event objects, errors reported at the `reduce()` call, `send` narrowing intact.                                                                    |
| [`option-e-state-map-in-config.ts`](option-e-state-map-in-config.ts) | `createMachine({ types, initialState, states })`                           | **Fails.** `types` and `states` are siblings in one object literal, so `S` is not yet fixed when `states` is contextually typed.                                                                      |
| [`option-f-positional-states.ts`](option-f-positional-states.ts)     | `createMachine(config, state('idle', ...), ...)`                           | **Forced trade-off.** Both halves are in the file: inferred tuple (exhaustiveness and `send` narrowing, no spec) and no tuple (spec, no checks).                                                      |
| [`option-g-define-then-create.ts`](option-g-define-then-create.ts)   | `createMachine(defineMachine<S>()({...}), states)`                         | **Works, and beats D.** Same guarantees, no `as const` on a hoisted spec, bad `initialState` reported at `defineMachine`. Also pins why the one-call spelling `defineMachine<S>({...})` cannot exist. |
| [`option-h-marker-in-config.ts`](option-h-marker-in-config.ts)       | `createMachine({initialState, specification: defineMachine<S>()}, states)` | **Works, trades differently than G.** No curried call, but no fix for D's `as const` edge either - checked, not assumed.                                                                              |

### Robot3 as the runtime

| File                                               | Shape                                                                                                                             | Result                                                                                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`robot3-wrapper.ts`](robot3-wrapper.ts)           | Options G/H over Robot3, covering `state`/`transition`/`guard`/`reduce`/`action`/`immediate`/`invoke`/`createMachine`/`interpret` | **Works.** The type layer transplants unchanged. Six Robot3 mismatches are documented in the file's header, one of them (invoke settlements arrive wrapped) found by running the tests. |
| [`robot3-wrapper.test.ts`](robot3-wrapper.test.ts) | Runtime coverage for the above                                                                                                    | Runs the machines, including invoke's resolve/reject paths and an immediate transition; pins five of the six mismatches as tests.                                                       |

## The one finding worth carrying over

Recorded at length in [`config-object-kit.ts`](config-object-kit.ts): deriving a
transition's source context from the state name `K` inside `TransitionModifiers`
makes resolving that conditional force `To` before the `target` argument is
read, and `To` collapses onto `K`. `transition('login', 'authenticating', ...)`
is then rejected with `"authenticating" is not assignable to "idle"`.

Carrying `Context` as its own free type parameter avoids it. The real `Kit` in
[`src/totorobot.ts`](../src/totorobot.ts) already does this, for an unrelated
reason - variance of reusable combinators - so the current design was standing
on this without the note having been written down.
