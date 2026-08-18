# v1 implementation, built small

Status: ready for agent. Scope agreed in a design interview; every decision below
was put to the maintainer and answered.

The API is settled ([docs/api.md](../docs/api.md)) and argued
([docs/api-rationale.md](../docs/api-rationale.md)). The v1 test suite is merged.
Nothing implements it.

## Problem Statement

The library has a specified API, a complete behavioural test suite, and no
implementation. `src/totorobot.ts` still holds the previous generation — a
`defineMachine`/`interpret` design with per-state context, modifiers and
`invoke` — which shares no surface with v1. Every test in `tests/` imports
`machine` and `types` from that module, and neither exists, so the entire suite
fails on landing.

Separately, a consumer cannot tell what the library would cost them. There is no
build at all: no bundler dependency, no build script, no `dist`, and `exports`
points directly at TypeScript source. `docs/requirements.md` P1.5 asks for shipped
code to stay small and for a realistic minified-and-gzipped budget to be
established from measurement, but nothing in the repo produces a number, so
"small" is currently an aspiration with no feedback loop.

## Solution

Implement v1 against the merged suite, and build it in the same change so the
size of what ships is visible on every pull request.

The implementation is written to be structurally small — the smallest compiling
shape at each choice point, chosen by measurement — while reading as ordinary
code. Minification renames locals and strips comments, so brevity of spelling
buys nothing; only the shape of the code that exists moves the number. The source
therefore keeps real names and carries comments recording which alternative was
rejected and by how many bytes, so the golf is not re-litigated blindly.

A consumer gets a single dependency-free ESM file with declarations beside it. A
maintainer gets `pnpm size` locally and an automatic per-pull-request size diff in
CI, and a `pnpm test:dist` run that exercises the built artifact rather than only
the source it came from.

## User Stories

**Using the library**

1. As a TypeScript consumer, I want `machine({ initial, inputs, states, transitions })`
   to return a definition, so that I can declare a machine in one expression.
2. As a TypeScript consumer, I want `types<T>()` to carry my vocabulary and return
   `null` at runtime, so that declaring types costs nothing when the code runs.
3. As a consumer, I want `definition.start(data)` to return a host, so that I have
   a running machine with its own state.
4. As a consumer, I want `start()` to take no argument when the initial state is
   declared `void`, so that a data-free machine needs no placeholder.
5. As a consumer, I want two hosts from one definition to share no state and no
   listeners, so that independent uses of one behaviour do not interfere.
6. As a consumer, I want the definition never to be mutated by starting or running
   a host, so that an imported definition stays inert and shareable.
7. As a consumer, I want `host.current` to be `{ state, data }`, so that reading
   the machine is plain data access.
8. As a consumer, I want a value read from `current` to stay valid and unchanged
   across later transitions, so that I can safely compare, serialise, or hold it
   in component state.
9. As a consumer, I want `current.data` to be `undefined` for a state declared
   `void`, so that data-free states need no empty object.
10. As a UI developer, I want `host.available` to list the current state's inputs
    in table declaration order, so that I can render controls in a predictable
    order.
11. As a UI developer, I want `available` to list an input carried by two rows only
    once, so that one input does not render as two controls.
12. As a UI developer, I want `available` derived from the table rather than from
    running handlers, so that an input whose every row would decline is still
    advertised and no handler runs for its answer.
13. As a UI developer, I want `available` to be empty for a state with no outgoing
    rows, so that a terminal state renders no controls.
14. As a consumer, I want `send(name, payload)` to take the name and payload as
    separate arguments, so that a `void` input is just `send('cancel')`.
15. As a consumer, I want sending an input the current state does not handle to
    change nothing and throw nothing, so that a stale asynchronous result lands
    harmlessly.
16. As a consumer, I want `send` to always return `undefined`, including when the
    call was queued, so that I never build logic on a return value.
17. As a machine author, I want a handler to receive the source state's data and
    the input payload, so that I can compute the target state's data from both.
18. As a machine author, I want a `void` input's payload to arrive as `undefined`,
    so that data-free inputs need no empty object.
19. As a machine author, I want `skip()` to decline a row and fall through to the
    next row declared for the same source and input, so that one input can reach
    two states.
20. As a machine author, I want declaration order to be priority order among
    candidate rows, so that precedence is visible by reading the table top to
    bottom.
21. As a machine author, I want a row whose every candidate declines to change
    nothing and notify nobody, so that declining is an ordinary, silent outcome.
22. As a machine author, I want a self-transition to commit and notify like any
    other row, so that same-state data updates need no special form.
23. As a machine author, I want a handler whose target is `void` to return nothing,
    so that data-free targets need no return value.

**Observing**

24. As a consumer, I want `host.on(pattern, listener)` to return an unsubscribe
    function, so that disposal is unsubscribing and nothing else.
25. As a consumer, I want calling an unsubscribe function more than once to be
    harmless, so that cleanup code needs no guard.
26. As a consumer, I want listeners to fire after the commit, so that `current` and
    the record's target end always agree.
27. As a consumer, I want listeners to fire in registration order, so that ordering
    between my own listeners is mine to control.
28. As a consumer, I want the listener list snapshotted before dispatch, so that a
    listener unsubscribed by an earlier one still runs for the current transition
    and one registered during dispatch does not.
29. As a consumer, I want the transition record `{ on, input, from, to }`
    discriminated by `on`, so that narrowing the input name narrows its payload.
30. As a consumer, I want `from` and `to` each to carry their own `{ state, data }`,
    so that I can compare both ends of an edge.
31. As a consumer, I want `*` to match any state in a pattern, so that I can observe
    every arrival or every departure.
32. As a consumer, I want an unlabelled arrow to match any input, so that the broad
    form needs no wildcard of its own in the label position.
33. As a consumer, I want a labelled arrow to match only that input, so that I can
    narrow to edges caused by one input.
34. As a consumer, I want a self-transition to match both the exit pattern and the
    entry pattern, so that the residency recipe gets restart-on-re-entry for free.
35. As a consumer, I want `.on()` on the host and not on the definition, so that an
    imported definition stays inert.

**Ordering**

36. As a consumer, I want one input to yield at most one transition, so that big
    steps always terminate.
37. As a consumer, I want a send from inside a listener to be queued rather than
    run nested, so that a listener is never re-entered while an earlier call is
    still running.
38. As a consumer, I want the queue to drain before the outermost `send` returns —
    synchronously, not on a microtask — so that the machine is settled when control
    comes back to me.
39. As a consumer, I want queued sends to drain first-in-first-out, so that the
    order I submitted inputs in is the order they are considered.
40. As a consumer, I want a queued send evaluated against the state at drain time,
    so that it may correctly find no row and do nothing.
41. As a consumer, I want a throwing listener to propagate out of `send` with the
    transition still committed and the queue abandoned, so that I see the error
    without the machine being left half-applied.
42. As a consumer, I want the host to keep working after a listener throws, so that
    one bad listener does not permanently break the machine.

**Types**

43. As a TypeScript consumer, I want narrowing `current.state` to narrow
    `current.data`, so that states which guarantee a field need no nullable
    padding.
44. As a TypeScript consumer, I want an unknown state or input name in a transition
    key rejected, so that a typo is a compile error rather than a dead row.
45. As a TypeScript consumer, I want a handler returning the wrong shape for its
    target state rejected, so that the table and the state vocabulary cannot drift.
46. As a TypeScript consumer, I want reading source data the source state does not
    have rejected, so that per-state data is enforced on both ends of an edge.
47. As a TypeScript consumer, I want a malformed key reported as
    `not a transition: '…'` on the offending row, so that the error points at the
    line I got wrong rather than at the whole table.
48. As a TypeScript consumer, I want wrong spacing to count as malformed, so that
    every row's source sits at the same column and the table stays greppable.
49. As a TypeScript consumer, I want a bare key rejected in `transitions`, so that
    the state/edge halves of the grammar stay decidable from the string alone.
50. As a TypeScript consumer, I want `skip()` returnable for every target shape
    including `void`, without it excusing a wrong-shaped return on the same row,
    so that declining costs no type safety.
51. As a TypeScript consumer, I want `start`'s arity to follow the initial state's
    data, so that I cannot forget or invent initial data.
52. As a TypeScript consumer, I want `send`'s arity to follow the input's payload,
    so that a `void` input rejects a payload and a payload-carrying input requires
    one.
53. As a TypeScript consumer, I want an input name outside the vocabulary rejected
    at the send site, so that typos are caught even though per-state capabilities
    are not enforced.
54. As a TypeScript consumer, I want unknown names in an `.on()` pattern rejected,
    so that a listener that could never fire is a compile error.
55. As a TypeScript consumer, I want no `-*>` form and no bare key accepted as a
    pattern, so that patterns and transition keys share one grammar.
56. As a TypeScript consumer, I want `InputsOf`, `StatesOf`, `Handled` and `Sources`
    to resolve over a machine type, so that I can derive the vocabulary and the
    reverse index without restating them.
57. As a JavaScript consumer, I want `machine({ initial, transitions })` with no
    vocabulary to work, so that I can use the library without TypeScript.
58. As a JavaScript consumer, I want an input name outside the table to change
    nothing rather than throw, so that untyped callers cannot crash the machine.
59. As a JavaScript consumer, I want a bad state name in a pattern to register
    without throwing and simply never fire, so that a typo degrades quietly.
60. As a TypeScript consumer with no vocabulary declared, I want state and input
    names widened to `string` and data and payloads to `unknown`, while the key
    grammar stays enforced on the offending line, so that the surface widens rather
    than collapses.
61. As a TypeScript consumer declaring one map and omitting the other, I want the
    declared half checked and the other widened, so that partial typing is useful.
62. As a TypeScript consumer, I want `initial` checked against the declared states
    and left open when none are declared, so that `initial` never reverse-infers
    the state vocabulary and throws every real row off the offending line.

**Shipping and maintaining**

63. As a consumer, I want a single dependency-free ESM file, so that adding the
    library adds one artifact and no transitive dependencies.
64. As a consumer, I want declarations distributed with the library, so that types
    work without me compiling the source.
65. As a consumer, I want the package marked side-effect free, so that my bundler
    can drop what I do not import.
66. As a maintainer, I want `pnpm size` to print raw, gzip and brotli sizes, so
    that I can see the cost of a change before pushing it.
67. As a maintainer, I want a per-pull-request size diff in CI, so that a
    regression is visible in review rather than discovered later.
68. As a maintainer, I want the local number to agree with the CI number, so that
    I can trust what I measure before pushing.
69. As a maintainer, I want the suite to run in CI, so that a pull request cannot
    merge red.
70. As a maintainer, I want the whole suite re-run against the built artifact, so
    that aggressive minifier settings or a declaration rollup cannot silently break
    what ships.
71. As a maintainer, I want the dist run kept out of the default `pnpm test`, so
    that the local edit loop does not wait on a build.
72. As a maintainer, I want the implementation's size decisions recorded in
    comments with their measured deltas, so that the next person can tell a
    deliberate shape from an accident.
73. As a maintainer, I want the type-level tripwires living in the test suite
    rather than in `explorations/`, so that there is one place where guarantees are
    asserted.
74. As a maintainer, I want the previous generation's code, examples and design
    notes removed, so that the repository documents one API rather than two.

## Implementation Decisions

### The module

The entire library stays one file at the existing package entry, exporting
`machine`, `types`, and the derived types `InputsOf`, `StatesOf`, `Handled`,
`Sources`. The previous generation's exports — `defineMachine`, `interpret`, and
the modifier and spec types around them — are deleted, not deprecated.

### The definition holds an eager index

`machine(...)` parses every transition key once and builds an index from source
state to input name to an ordered list of candidate rows. It does not touch,
annotate, or cache anything on the caller's configuration object; the index lives
in the closure the definition holds.

This was chosen on grounds other than size. Two complete implementations were
built and measured (see Further Notes): an index and a design that stored nothing
and prefix-scanned the raw keys on every dispatch came out within 1.6% of each
other, which is not a basis for choosing. The index wins because dispatch becomes
a direct lookup instead of a scan, because `available` falls out of object key
insertion order — declaration order and de-duplication for free, deleting the
`Set` the scanning design needs — and because it cannot accidentally prefix-match
a malformed key arriving from untyped code.

### Keys and patterns share one parse

Transition keys and `.on()` patterns are the same grammar with coordinates left
open, so one splitting helper serves both. A pattern is parsed **once, at
registration**, into its three coordinates and stored alongside the listener;
dispatch then compares three coordinates, treating `*` as the wildcard in the
state positions and the empty string as the wildcard in the label position.

The alternative — keeping listeners as opaque strings and generating, per
transition, the eight pattern strings that transition could match, then testing
set membership — was implemented and measured 4.8% larger, and allocates a `Set`
per transition. Parsing at registration also shares the splitting helper with the
index build, which is part of why it compresses better.

Parsing at registration handles the untyped garbage cases without any extra code:
a pattern naming a state that does not exist parses fine and simply never matches,
and a bare key parses to a single coordinate whose `undefined` label fails every
comparison. Neither throws, which is what the untyped path requires.

### Spacing is load-bearing, and nothing is trimmed

The key grammar admits exactly one spelling. No normalisation, no trimming, no
tolerance for extra or missing spaces, in either the types or the runtime. Prior
notation candidates in `explorations/` deliberately tolerated spacing, but that
was a property of a different notation that v1 did not adopt; the merged suite
requires every loose spelling to be a compile error.

This is the part of the type layer with no prior art and the highest risk —
template literal inference around spaces is where it will be won or lost.

### The type layer is re-derived, not imported

The technique is proven in an existing exploration and is lifted into the library
rather than depended upon:

- **Constrained defaults** (`Vocab = Record<string, unknown>`) so widening falls
  out of the constraint and no conditional is needed to express "no vocabulary
  declared".
- **`NoInfer` on `initial`**, in a plain position rather than wrapped in a
  conditional, so `states` stays the only inference site for the state vocabulary.
  Without this, `initial` reverse-infers the states, after which every real row is
  rejected and the error moves off the row onto the whole table.
- **A malformed key poisons its own value type** rather than being reported
  through an intersected missing property, because a missing property is an
  object-level error and would report at the table rather than the row.

The exploration that recorded these — including the two approaches that failed —
moves into the test suite (see Testing Decisions) rather than staying where it is.

### `skip` is a unique symbol

The sentinel is a module-level `const SKIP = Symbol()`, which TypeScript types as
`unique symbol` on a `const`, so `Skip` needs no brand machinery. `skip` is a
single shared function returning it, not a closure created per handler call.

A smaller trick was considered and rejected: a self-returning function
(`const skip = () => skip`) makes the function its own sentinel and saves a
binding. It was rejected because it silently accepts a handler that returns
`skip` _without calling it_. Note this inverts rather than removes the laxness —
with a symbol, that same untyped handler commits the function itself as the new
data. Typed callers are protected either way, so this is only reachable from
JavaScript, and no test covers it. The byte difference is single digits and not a
factor.

Because `Skip` appears in every handler's return type, it is part of the public
surface, and declaration emit must keep the symbol reachable. If the declaration
rollup gets this wrong the public types break silently — which is one of the
things the dist type run exists to catch.

### The host

State lives in closure variables, not on an object. `current` and `available` are
getters returning freshly built values. The definition's returned object exposes
`start` only, carrying the vocabulary at the type level through a phantom that
costs nothing at runtime.

The queue is an array with a draining flag, reset in a `finally` so that a
throwing listener leaves the host usable and the flag correct. Listener list
storage — copy-on-write at registration versus a snapshot copy taken per dispatch
— is left to whichever measures smaller; both satisfy the snapshot semantics the
suite requires.

### No runtime validation anywhere

Nothing throws, nothing warns, nothing checks its arguments. The specification
makes every malformed input a silent no-op, so validation code would be bytes
spent contradicting the spec.

### Build

- **vite** in library mode, **ESM only**, one output file. `type: module` and
  `engines: node >= 26` are already declared, so a CommonJS or UMD build serves
  nobody this package targets.
- **terser**, tuned: multiple compress passes, `unsafe_arrows`, `unsafe_methods`,
  toplevel mangle. **No property mangling** — a closure-based host has almost no
  internal property surface to mangle, so the gain is nil against a real risk of
  renaming a public key.
- **Declarations** are emitted by the vite declaration plugin as part of the build.
- `exports` is repointed at the built output, `sideEffects: false` is added, and
  the package stays private.
- **The size metric is minified + brotli**, with gzip and raw also reported.

### Size reporting

A `pnpm size` script builds and prints raw, gzip and brotli. CI, which does not
exist yet, is created with two jobs: the test suite, and `preactjs/compressed-size-action`
configured for brotli over the built output, which comments a size diff on each
pull request. The action compresses with node's zlib at brotli defaults, which is
what the local script uses, so the two should agree exactly — this is verified
once by running both on the same commit and comparing, not assumed.

No linter is added. Terser has compress and mangle _options_, not lint rules, and
no eslint plugin enforces minifier-friendly source; the size script is the real
feedback loop.

## Testing Decisions

### What makes a good test here

Only external behaviour, through the package's public surface. The merged suite
already holds this line — every file imports `machine` and `types` and asserts on
`current`, `available`, `send`, `on` and the transition record, and nothing
reaches for an index, a queue or a listener list. The implementation is free to
change shape for bytes precisely because no test knows its shape. Any new test
follows the same rule.

### Seams

**One**, and it already exists: the package entry module. This work introduces no
new seam. It adds a _second run of the same seam_ against the built artifact —
the minified bundle for the runtime tests, the emitted declarations for the type
tests — reached by remapping the import specifier, so no test is duplicated to get
it. `pnpm size` is a build-output check, not a test seam.

### Modules tested

The package entry, in both forms: source, and built output.

### Changes to the merged suite

Three, all of them corrections or gap-closing rather than new coverage areas:

1. **The pattern tests observe through a host.** They currently call `.on()` on a
   _definition_, and one of those calls is not marked as an expected error, so the
   definition would need a typed, callable `.on()`. The specification forbids this
   in two places, and these files also execute as runtime tests, so the call would
   throw. The test is wrong; the specification stands.
2. **The type-level tripwires move into the suite.** The vocabulary-degradation
   exploration is a compiling prototype of the degradation rules and the per-row
   error; its assertions become a type test and the exploration is deleted.
   Tripwires belong in tests.
3. **`initial` gets negative coverage**, which the suite currently has none of:
   rejected when it names a state outside a declared vocabulary, and open to any
   string when no states are declared. This is the reverse-inference failure the
   exploration recorded, and it is the one that silently destroys the untyped path.

### The dist run

`pnpm test:dist` builds, then runs the whole existing suite against the built
artifact with coverage disabled, chained after the build and kept out of the
default `pnpm test` so the local loop does not wait on it. CI runs it after the
source suite.

It covers both halves deliberately. The runtime half guards the `unsafe_*` terser
options, which are named unsafe because they can change semantics. The type half
guards the declaration rollup, which can alter the public type surface without any
runtime symptom at all. A suite that only imports source is blind to both.

Note the coverage configuration carries 100% thresholds scoped to the source
directory, so the dist run must not carry it; and the type pass resolves through
the tests' own tsconfig, so redirecting types needs a path mapping rather than a
bundler alias.

### Prior art

`explorations/candidates/*/check.ts` are the closest existing type-assertion
tests, and `scripts/check-candidates.ts` is prior art for treating a negative
result as a first-class expectation — a candidate that starts compiling is
reported as a failure. The same instinct applies to the tripwires being absorbed.

## Out of Scope

- **Everything v1 defers**: `actions`, immediate transitions, composition of
  invoked children, `enter`/`exit`, `emit`, `else`, a `send` return value,
  `stop()`, hierarchy and parallel regions. All argued in the rationale, none
  promised.
- **A typed send site.** Per-state capabilities stay advertised at runtime through
  `available` and unenforced by the compiler; the narrow-then-send shape is
  recorded as unsound.
- **Publishing to npm**, dropping `private`, and the BundleJS badge that depends on
  it. The badge cannot render for an unpublished package; it lands with the release
  that publishes. Everything else in the size story works without publishing.
- **CommonJS, UMD or IIFE builds.**
- **Property mangling**, and any minifier setting whose damage the dist run could
  not detect.
- **A linter.**
- **A committed size baseline or a hard size gate.** The requirements are explicit
  that a budget is not a scoring threshold; the pull-request diff reports, it does
  not block.
- **Rewriting the design-rationale documents.** The stale design-notes document is
  deleted rather than rewritten; the API reference and the rationale already cover
  its ground.

## Further Notes

### Fallout from deleting the previous generation

Three files under `examples/` import the old entry points and are inside the root
type-check project, so type-checking goes red the moment the entry is rewritten,
and three package scripts run them. They are ported to v1 — the publication
machine from the API reference covers the ground. The design-notes document
describes the previous generation end to end and is deleted as superseded. The
README carries both APIs today; the stale half is cut. `explorations/` only
references the old entry in prose and needs no change beyond the tripwire move.

### Measurements behind the runtime decisions

Two complete implementations were written and minified to settle the table
strategy, and a third to settle pattern matching:

| design                                     | raw  | gzip | brotli |
| ------------------------------------------ | ---- | ---- | ------ |
| prefix scan, no index                      | 1589 | 787  | 693    |
| eager index, eight generated keys per edge | 1596 | 788  | 704    |
| eager index, patterns parsed at `on()`     | 1549 | 751  | 670    |

Two caveats, both load-bearing on how much weight these carry. They were minified
with the bundler's built-in minifier, not terser, because terser is not installed
in the repository yet — so they are a _relative_ comparison, not a prediction of
the shipped number. And all three are structurally complete but were never run
against the suite; they were written to be size-representative, not correct. The
first number the implementation produces under the real toolchain supersedes all
of this.

The headline is that the whole runtime lands somewhere near 700 bytes brotli, and
that the two structural choices between them span about 5% — which is why the
table strategy was decided on dispatch behaviour rather than bytes.

### Where size actually comes from

Worth restating because it shapes review: minification renames every local and
strips every comment, so short identifiers and terse formatting in the source are
worth exactly zero bytes. What moves the number is how many distinct code shapes
exist, whether helpers are shared, closures versus objects, plain objects versus
`Set`/`Map`, and getters versus assigned properties. A reviewer should push back
on structure, not on spelling — and the source is expected to read normally.

### Known risks

- **Strict spacing in the type layer.** No prior art anywhere in the repository;
  every existing candidate deliberately tolerated spacing. Template literal
  inference around spaces is the single most likely thing to need iteration.
- **Declaration emit of the `Skip` symbol**, described above.
- **The size action cannot comment on pull requests from forks.** It prints the
  comment to its log instead, which is a degradation to be aware of rather than a
  blocker for a single-maintainer repository.
