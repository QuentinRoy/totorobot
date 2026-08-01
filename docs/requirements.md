# FSM library requirements

This document captures the target for the next round of API exploration. It
describes desired outcomes and accepted boundaries, not an API shape. In
particular, it does not choose events over methods, a declarative configuration
over immutable operations, or a particular TypeScript representation for
typestates.

The list is a priority stack rather than a checklist of independent features.
Related interview answers are folded together. An earlier item within a band
outranks a later one when they conflict.

- **P0 — Defining:** a candidate that misses one of these outcomes is solving
  the wrong problem. Entries explicitly described as design latitude are
  permissions, not features that must be imposed.
- **P1 — Important:** preserve these unless doing so materially harms P0.
- **P2 — Useful:** pursue these after the core works, and only while the P0
  experience stays simple.
- **P3 — Reserved:** leave room for these where inexpensive, but do not let them
  shape the first API.
- **P4 — Outside the target:** do not spend core complexity on these.

## P0 — Defining

### P0.1 — Optimize for small interaction machines

The main use case is interaction-technique development: roughly 2–20 control
states and dozens rather than hundreds of transitions. The current
[Marking Menu](https://github.com/QuentinRoy/Marking-Menu) behavior is the
reference acceptance case. A candidate must express its state-specific data,
pointer-driven transitions, timing races, stale-result protection, effects,
and recursive submenu data cleanly.

Larger-machine features must not add ceremony to this case.
Optimization for hundreds of states, enterprise workflow orchestration, or the
full statechart feature set is outside the target.

### P0.2 — Make typestates the central type guarantee

Knowing the current state must provide precise state-specific data and
capabilities. A state may have no associated data. No particular TypeScript
encoding, including a discriminated union, is prescribed.

On the strongly typed path:

- transition logic knows its precise source state and input;
- input payloads or arguments are specific to the capability being applied;
- only valid target states are available;
- target-state data is checked against the selected target;
- the result exposes the exact target typestate, or the true union of possible
  target typestates;
- consumers can handle the complete state space exhaustively;
- declared states and capabilities are implemented exhaustively, with terminal
  states being intentional; and
- public types do not leak `any`; uncertainty is represented precisely or with
  `unknown`.

The full result must survive exporting a machine from a package and generating
TypeScript declaration files. Downstream users must not have to redeclare its
typestates.

### P0.3 — Keep definitions readable

A representative machine must remain easy to read after normal automatic
formatting, without hand alignment or other formatting tricks. Ordinary
transition targets must be apparent locally in the source rather than existing
only in inferred types or being hidden behind unrelated implementation code.

Representative candidate APIs should therefore always be reviewed in their
automatically formatted form.

### P0.4 — Keep type narrowing truthful over time

If TypeScript narrows an observed value to state `S`, later machine activity
must not cause that same value to represent another state while TypeScript
still treats it as `S`.

Committed state evolution must not mutate an already observed state value in
place. The library itself never mutates stored state data. Because arbitrary
values are allowed and deep cloning or freezing is outside the target, users
remain responsible for not mutating objects they place inside state data.

### P0.5 — Make transition decisions deterministic and synchronous

Choosing the next state and its data depends only on the current state, the
submitted input, and data or dependencies explicitly made available by the
user. Conditions are supported, but their expression is an API question.

Transition decision logic does not perform effects or await asynchronous work.
A direct state change is committed before input submission returns; it is not
implicitly deferred to a microtask. If transition logic throws unexpectedly,
no new state is committed and the programming error is surfaced.

### P0.6 — Represent all ordinary transition outcomes

The model must distinguish:

- no transition;
- an intentional update that remains in the same control state; and
- a transition to a different control state.

Receiving an input that is unavailable in the current state is still a valid
runtime outcome. At the same time, a value known statically to be in state `S`
must expose only the capabilities available from `S`. Both goals remain in
force; their apparent tension is deliberately left for API exploration.

### P0.7 — Process submitted inputs predictably

Every submitted input is considered once and in submission order. The library
does not silently drop, coalesce, debounce, or reorder inputs. Those policies
may be applied explicitly before submission.

If a reaction or observer submits another input during a transition cycle, the
current commit and reaction cycle finishes first. The new input is queued
rather than processed against a half-committed state. Commit, reaction, and
observation ordering must be deterministic and documented.

A live execution does not retain transition history. The library provides no
built-in undo, redo, or time-travel behavior, and old state values and inputs
become eligible for garbage collection when user code no longer holds them.

### P0.8 — Support effects without mixing them into transition decisions

Effects must be supported, although whether their descriptions live inside or
outside the machine definition remains open.

The supported effect model must provide:

- state-lifetime work with cleanup when leaving or re-entering a state;
- a way for asynchronous success, failure, or progress to return as later
  inputs;
- enough lifecycle or identity information to make supported integrations safe
  from stale asynchronous results; and
- explicit shutdown or disposal if a library-owned runtime starts and owns
  effectful resources.

The library cannot prevent arbitrary external code from submitting a stale
result, but it must make race-safe integrations possible. An effect failure
does not roll back an already committed transition. Expected failures may be
fed back as inputs; unexpected exceptions are surfaced.

### P0.9 — Treat time as a first-class interaction concern

Interaction machines need scheduling, cancellation, protection from stale
timer callbacks, and a controllable clock for deterministic tests. The core
transition computation remains synchronous; timer callbacks provide later
inputs.

Whether timing is described by the machine or by the supported reaction layer
is an API question.

### P0.10 — Make committed transitions observable

Every committed transition, including a same-state update, must be observable
externally. Strongly typed observations preserve the correlation among source
state, input, and target state rather than widening each independently.

The exact subscription or reaction mechanism remains open.

### P0.11 — Fit high-frequency, platform-neutral browser code

The primary runtime target is modern ESM-capable browsers. The core remains
independent of the DOM, UI frameworks, RxJS, and any particular scheduler so it
can also run in other modern JavaScript environments.

The hot path must have small, synchronous, predictable overhead. It must not
require a microtask, deep clone or freeze, serialization pass, runtime schema
validation, or framework render for every transition. Exact performance
budgets can be established with representative benchmarks later.

Type-checking and editor performance are also acceptance criteria.
Representative 2–20-state machines must remain responsive and must not trigger
pathological type-checking behavior. Current TypeScript performance means this
is not a reason to weaken the design pre-emptively.

### P0.12 — Preserve the accepted simplifying latitude

The first design may rely on all of the following:

- a fixed, finite set of control states known when the machine is defined;
- one canonical initial control state;
- compile-time capability availability determined by the control state rather
  than arbitrary values inside that state's data;
- at most one committed transition for each submitted input;
- current-generation TypeScript;
- TypeScript strict mode for the strongest guarantees; and
- modern ESM-capable environments rather than legacy browsers or a
  CommonJS-first package.

These are freedoms available to the design, not outcomes the API must force
when they provide no benefit.

## P1 — Important

### P1.1 — Produce readable, local TypeScript diagnostics

An invalid source read, target, input, or target-state value should report near
the mistake and explain it in familiar terms. A readable error-bearing helper
type is an acceptable fallback when TypeScript cannot place the error more
precisely, but obscure type-level failures are not.

Perfect error placement does not outrank the readability of valid machine
definitions.

### P1.2 — Avoid duplicate topology declarations

Users should not normally describe the same states, capabilities, and targets
once for TypeScript and again for runtime behavior. If a separate type-level
model proves worthwhile, the compiler must detect drift between it and the
implementation.

### P1.3 — Degrade gracefully outside the fully typed path

JavaScript users and TypeScript users who provide incomplete types should
still receive a usable runtime API. Types may widen as information is lost,
but should not collapse into an unusable `never`-heavy surface. This does not
weaken the strict, fully typed contract.

### P1.4 — Keep the runtime small

A dependency-free implementation is preferred. A dependency remains
acceptable when it clearly improves correctness or the implementation enough
to justify its cost.

### P1.5 — Separate the pure core from supported reactions

Prefer an architecture in which deterministic state evolution can be used by
itself and an optional, library-supported reaction layer manages effects. This
is stronger than merely forbidding effects during transition decisions, but it
must yield if enforcing the separation makes the primary API materially worse.

## P2 — Useful

### P2.1 — Reuse one definition for independent executions

Support multiple independent executions of the same definition. If this is
provided, each execution must be able to receive its own initial state data.

### P2.2 — Compose independently defined machines

A coordinator should be able to start, stop, and communicate with smaller
machines while each keeps its own typestate and effect lifetime. Composition
must not require hierarchical or parallel states in the core API.

### P2.3 — Distinguish same-state updates from explicit re-entry

An ordinary same-state data update should be able to preserve state-lifetime
resources, while an explicit re-entry can restart exit/entry lifecycle
behavior. Exact terminology and representation are deferred.

### P2.4 — Offer small asynchronous-work conveniences

First-class helpers may cover promises or other common invoked work, provided
they build on state-lifetime effects, cleanup, and later inputs rather than
making transition computation asynchronous. A general actor or observable
model is unnecessary.

### P2.5 — Represent formal completion when useful

A state with no capabilities already behaves as terminal. A formal final-state
concept may additionally support typed completion output and composition.

### P2.6 — Support concise effect-free sequence tests

Pure, synchronous transitions already make sequence testing straightforward.
Dedicated helpers may improve assertions over inputs, resulting typestates,
and no-transition outcomes.

### P2.7 — Make topology inspectable

Tooling should be able to recover states, accepted inputs, and possible targets
without executing transition logic. Conditions and effects may remain opaque.

### P2.8 — Validate malformed runtime definitions

When static guarantees are unavailable or degraded, development-time runtime
checks may catch unknown initial states, unknown targets, or otherwise
malformed definitions. This is structural validation, not validation of user
data.

### P2.9 — Reject excess target-state fields when practical

Missing fields and fields of the wrong type are part of the core typestate
guarantee. Rejecting extra fields as well is useful, but may be traded for
clearer types and errors.

### P2.10 — Reuse behavior shared by several states

It should be possible to avoid repeating common behavior such as cancellation
or reset while preserving precise state typing. This is low priority: explicit
repetition is acceptable when the behavior is already easy to define and a
reuse mechanism would obscure targets.

## P3 — Reserved

### P3.1 — Hierarchical and parallel control states

These are possible additions, potentially enabled by composition. They must
not add cost or ceremony to the flat, small-machine API.

### P3.2 — Automatic or eventless transitions

Keep them on the horizon without letting them shape the initial execution
model. If introduced, their cascading and observability semantics will need to
be explicit.

### P3.3 — Explicit Resource Management interoperability

If the library eventually manages effect lifetimes internally, it may
interoperate with `Disposable`, `AsyncDisposable`, and `using`. This has no
independent value for a library that leaves effects entirely external.

### P3.4 — Restore serializable state

Users may always place non-serializable values in state data. Much later, a
machine whose user-provided data happens to be serializable could support
restoration. This must not impose serializability on the normal case.

### P3.5 — Visualization and dedicated development tools

These are extremely distant possibilities and will probably never justify
their own complexity. Inspectable topology at P2 is sufficient for now.

## P4 — Outside the target

### P4.1 — Dynamic control-state discovery

Do not support adding or discovering control states after definition. State
data may still be recursive or unbounded.

### P4.2 — Runtime schemas for state data or inputs

The library does not validate arbitrary user data against runtime schemas.
Users may add their own validation at system boundaries.

### P4.3 — Semantic middleware or plugins

Do not build a middleware system that can intercept and change transition
semantics. External observation and supported reactions are sufficient.

### P4.4 — A general actor or observable runtime

Do not turn the library into an actor framework, stream framework, or broad
asynchronous orchestration system.

### P4.5 — Formal verification toolchains

Model checking, SCXML compatibility, and code generation are outside the
project's target.

### P4.6 — A dedicated environment channel

A separate read-only dependency or environment channel is not an independent
feature goal. The idea can be revisited only if API ergonomics later demand it.

## Deliberately undecided API questions

The requirements above do not decide:

- whether inputs look like events, methods, commands, or another capability;
- whether definitions use configuration objects, functions, builders,
  immutable state objects, or a combination;
- how conditional behavior is written;
- whether effect descriptions live inside or outside machine definitions;
- how state-indexed capabilities coexist with runtime handling of unavailable
  inputs;
- whether an unavailable input is silent, observable, or diagnostic;
- the exact ordering among state commitment, reactions or effects, and
  observations;
- how no-transition, same-state update, and explicit re-entry are represented;
- how initial state data is supplied; or
- which conveniences, if any, deserve shorthand.

Those are the subject of the API-brainstorming phase.
