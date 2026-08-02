# API brainstorm findings

The exercise did not produce a complete API. Its useful result is a set of
mechanisms that can be combined and tested in more practical candidate designs.

## Useful mechanisms

- **Immutable typestate values** are the strongest basis for truthful narrowing.
  An observation should not change after a consumer has narrowed it.
- **State ownership can remain flexible.** Caller-owned pure evolution and an
  optional library-owned runtime can share the same transition core.
- **Transition results need an explicit algebra:** no transition, same-state
  update, or state change, while preserving source, input, and target
  correlation.
- **Transition decisions should be pure and synchronous.** Effects can leave the
  decision as typed command data.
- **Effects often belong to state residency.** Timers, listeners, requests, and
  cleanup benefit from scopes disposed automatically when residency ends.
- **Staleness is an authority problem.** Tokens, revisions, or epoch-bound
  capabilities can prevent delayed timers and asynchronous results from acting
  on obsolete state.
- **Scoped visits are useful for consumption.** Exhaustive callbacks can expose
  precise state data and capabilities without exposing a mutable narrowed
  handle.
- **Destination-owned constructors can centralize target invariants**, but are
  better treated as helpers than as the organizing principle for a complete
  machine definition.
- **Definition and consumption can use different views.** A source-local
  definition can coexist with exhaustive visits, legal-move palettes, or
  derived diagrams.
- **Readable topology remains important.** Source state, input, decision, and
  ordinary targets should remain colocated in ordinary TypeScript.
- **Broad runtime submission and narrow typed capabilities can coexist.** A
  dynamic input can produce an unavailable outcome while a known typestate
  exposes only its valid operations.

## Donor fragments

A donor fragment is a useful mechanism extracted from an otherwise unsuitable
API idea and transplanted into a more practical design. The exercise's exotic
ideas generally work better as donor fragments than as complete API models.

Examples include:

- From **Live Permissive Circuit**: withdraw an operation when its prerequisites
  disappear, without adopting circuit terminology.
- From **Knowledge in the Visit**: expose narrowed state knowledge only inside a
  scoped callback.
- From **Target-Owned Entrances**: centralize construction of valid target-state
  data without organizing the whole machine by destination.
- From **Compiled Continuation Graph**: tie effects and cleanup to a disposable
  lifetime without requiring linear types or asynchronous transitions.
- From **Legal Move Palette**: optionally derive currently valid actions for UI
  use without making opaque move objects the core API.

## Strongest synthesis

A promising direction is a source-local ordinary-TypeScript definition that
produces immutable `none | update | change` outcomes and typed effect commands,
optionally hosted by a serialized runtime with residency-scoped resources.

This is a direction to prototype, not a conclusion from the brainstorm.
