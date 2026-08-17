# 04 — Reading and Sending behaviours

**What to build:** The two behaviour groups that describe what a host reports and what
happens when you send it an input — observable behaviours 4 through 16.

**Reading (4–7):**

- `current` is `{ state, data }`, with `data` `undefined` for a `void` state.
- A value read from `current` before a transition is unchanged after it. Asserted both
  against a deep clone captured beforehand **and** with an object-identity check, so an
  implementation that mutates in place fails even when the values happen to coincide.
- `available` lists the current state's inputs in table declaration order, without
  duplicates — one entry for an input carried by two rows.
- `available` is empty for a state with no outgoing rows.
- `available` lists an input whose every candidate row would decline. This is the
  clarification added by ticket 02: capability is a property of the table, not of a
  payload the host does not have.

**Sending (8–16):**

- A handled input commits and every listener whose pattern matches fires.
- An input matching no row changes nothing and notifies nobody.
- An input whose every candidate row declines is **externally indistinguishable** from
  one that matched no row — deliberately, so assert the same observable outcome.
- With several rows for one source/input pair, candidates are tried in declaration
  order and the first that does not decline wins.
- A self-transition commits and notifies like any other row, with the same state on
  both ends, the old data on the source end and the new data on the target end.
- A handler receives the source state's data and the input payload; a `void` input's
  payload is `undefined`, and a handler whose target is `void` returns nothing.
- `send` returns `undefined`, always.
- An input name outside the vocabulary changes nothing. The runtime half of this is
  ticket 06's plain-JavaScript file; this ticket covers what is reachable from typed
  code.

All assertions go through the public entry point. No test imports an internal module.

**Blocked by:**

- 03 — Test harness and the construction tracer (config and fixtures)
- 02 — Doc clarifications (the `available` skip-only behaviour must be specified before
  it is asserted)

**Status:** done

- [x] Tests exist for observable behaviours 4–16 — `tests/reading.test.ts` (4–7) and
      `tests/sending.test.ts` (8–16), 16 tests total, some behaviours covered by more
      than one test where the checklist below called for separate assertions. Titled by
      what each test asserts rather than with its spec number, on request: a bracketed
      number is meaningless once read outside this ticket, and a failure report should
      not need the spec open to be legible
- [x] `available` ordering, deduplication, emptiness and skip-only inclusion are each
      asserted separately — four tests in `tests/reading.test.ts` ("available lists the
      current state inputs in table declaration order", "…an input carried by two rows
      only once", "…an input whose every candidate row would decline", "available is
      empty for a state with no outgoing rows"), against a new `editor` fixture
      (`tests/fixtures.ts`) whose `draft` state has five rows (`revise`, `touch`,
      `submit` ×2, `poke`, `lock`) so ordering, the `submit` duplicate and the
      always-declining `poke` row are all exercised on one topology, and whose `locked`
      state has none
- [x] The all-decline case asserts the same observable outcome as the no-match case —
      "an input no row matches…" and "an input whose every candidate row declines…" in
      `tests/sending.test.ts` are written with the same shape (unchanged `current`, no
      listener fired) on purpose, the latter sending `editor`'s always-declining `poke`
- [x] Declaration-order priority is asserted with at least two rows sharing one
      source/input pair and different targets — two tests: a one-off `priority` machine
      with two unconditional rows for `start -go>` (`first` reachable, `second`
      shadowed) proves order alone decides, and `editor`'s guarded `draft -submit>`
      pair (`review` declared before `published`) shows the same rule under realistic
      guards
- [x] `current` stability is asserted by both deep equality against a prior clone and
      object identity — "a value read from current before a transition is unchanged
      after it" in `tests/reading.test.ts` captures `current.data` and a clone before a
      `revise`, then checks the retained value both deep-equals the clone and stays
      `toBe` the same reference, so mutation-in-place fails even where the mutated
      value would coincidentally still match the clone
- [x] Every test fails only because the v1 entry point does not exist — both new files import only `editor`/`toggle` from `tests/fixtures.ts` and `machine`/`types` from `../src/totorobot.ts` (plus one inline `machine`/`types` use each in the declaration-order-priority and handler-arguments tests); at runtime, `tests/fixtures.ts` already throws on import, the same `TypeError` ticket 03 hit, so both new files fail to load with that one error, same as `construction.test.ts`. `pnpm typecheck` and `pnpm format:check` are both clean

Sanity-checked against a throwaway local v1 implementation (not committed): all 16 new
tests pass against a correct implementation, the `current`-stability test fails when a
transition mutates the source data in place instead of replacing it, and both
declaration-order-priority tests fail when rows are tried in reverse declaration order —
the pure `priority` machine catches it, the guarded `editor` scenario does not (only one
candidate ever matches there regardless of order), which is why both are kept.

**Found while rebasing onto 05 and 06, not caused by this ticket:** `pnpm test` (the
full run, typecheck included) is red across the whole suite as of ticket 06 —
`construction.test.ts`, `observing.test.ts` and `queue.test.ts` too, not just this
ticket's files. `tests/untyped.test-d.ts` (ticket 06) is the suite's first
`.test-d.ts` file; adding it turns on Vitest's typecheck pool, which runs `tsc` over
the whole `tests/tsconfig.json` program rather than only the files it lists under
`typecheck.include`. That surfaces `noImplicitAny` errors on every destructured
handler parameter (`{ data, input }`) in every ticket's tests, because there is no
real `machine`/`types` yet to infer them from — a pre-existing condition of an
unbuilt v1, not new breakage. `tests/reading.test.ts` and `tests/sending.test.ts` hit
the same class of error and nothing else; verified in isolation against
`origin/v1-test-suite` before this ticket's commit (6 of 7 test files already red,
same error shapes). Left as found rather than fixed here, since a real fix (either
scoping `typecheck.include`/`exclude` in `vitest.config.ts`, or annotating every
handler by hand) touches tickets 03, 05 and 06 as much as this one.
