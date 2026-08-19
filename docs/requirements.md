# FSM library requirements

This document captures the target for the next round of API exploration. It
describes desired outcomes and accepted boundaries, not an API shape. In
particular, it does not choose events over methods, a declarative configuration
over immutable operations, or a particular TypeScript representation for
typestates.

It also does not require the library to own evolving state. A candidate may
provide caller-owned evolution, a library-owned live execution, or both.
Requirements stated in terms of submission, commitment, reactions, or
observation apply to a library-owned live execution when one is provided.

The list is a priority stack rather than a checklist of independent features.
Related interview answers are folded together. An earlier item within a band
outranks a later one when they conflict.

- **P0 — Defining:** a candidate that misses one of these outcomes is solving
  the wrong problem. Entries explicitly described as design latitude are
  permissions, not features that must be imposed.
- **P1 — Important:** preserve these unless doing so materially harms P0.
- **P2 — Useful:** pursue these after the core works, and only while the P0
  experience stays simple.
- **Deferred probes:** unscored possibilities that may be explored against
  finalists, but must not shape or earn credit for the first API.
- **P4 — Outside the target:** do not spend core complexity on these.

## Status: amended, not superseded (2026-08-05)

This document remains the statement of intent. The priority stack, the accepted
design latitude, and the P4 boundary all still hold, and nothing below replaces
them.

A research round has since produced evidence that **amends six entries**. The
amendments are recorded inline, at the entry they affect, as blockquotes. Read
them; do not inherit an un-amended entry.

| Entry       | Amendment                                                              |
| ----------- | ---------------------------------------------------------------------- |
| P0.2        | 2-9 states, not 2-20 — measured. Plus an open framing question.        |
| P0.3        | Cross-boundary exactness is the least supported requirement here.      |
| P0.4        | Satisfiable, but only by an ownership model — rules out a live handle. |
| P0.9        | Timing should be library-owned, against this document's stance.        |
| P2.1 / P2.9 | Composition is the missing axis; P2.9 is the wrong lever.              |
| P0.7        | Under-specified: run-to-completion is eight decisions, not one.        |

Two entries are _confirmed_ rather than amended, and are worth reading in that
light: **P0.1** already required source, input, decision and target to be
visible near one another — the previous round's propositions violated it, and
the "arrow test" is simply that sentence made testable. **P1.3** is achievable;
see the P0.3 note.

Companions, neither of which replaces this file:

- [api-rationale.md](api-rationale.md) — the working brief for the
  next design round: what to build, what to measure, what not to propose.
- [research/10-synthesis.md](research/10-synthesis.md) — the fifteen findings
  and where each amendment comes from.
- [research/README.md](research/README.md) — the nine underlying notes.

## Accepted scope and design latitude

The first design may assume all of the following:

- a fixed, finite set of control states known before execution;
- one canonical initial control state;
- compile-time capability availability determined by the control state rather
  than arbitrary values inside that state's data;
- at most one transition outcome for each applied input or capability;
- current-generation TypeScript;
- TypeScript strict mode for the strongest guarantees; and
- modern ESM-capable environments rather than legacy browsers or a
  CommonJS-first package.

These assumptions may simplify the design. The interface need not expose them
as user choices or ceremony when they provide no benefit.

## Candidate evidence

The requirements inventory is for evaluating coherent candidates after
divergent ideation, not for rejecting incomplete early seeds. Evidence grows
with candidate maturity:

1. A coherent candidate shows its automatically formatted definitions and use
   sites for the shared [acceptance cases](acceptance-cases.md), and documents
   its decisions and remaining unknowns.
2. A type prototype records passing and failing typestate examples, resulting
   diagnostics, and a downstream declaration-file consumer.
3. A runtime prototype records deterministic traces for ordinary transitions,
   reentrancy, effects, timing races, stale results, and disposal where those
   concerns are library-owned.
4. A finalist is exercised through common comprehension, editing, and debugging
   tasks. Runtime, bundle-size, type-checking, and editor measurements use the
   same cases and toolchain across candidates.

Exploratory measurements reveal realistic budgets; they are not retroactive
grounds for rejecting early ideas. Any quantitative thresholds must be fixed
before finalists are compared.

## P0 — Defining

### P0.1 — Optimize for human understanding and editing

Machine definitions are source code for humans first. A developer unfamiliar
with a small representative machine should be able to understand its states,
available inputs, conditions, and transition paths quickly, without tracing
type-level machinery, consulting generated artifacts, or jumping among
unrelated implementation code.

Common changes such as adding, removing, or modifying a state or transition
must be straightforward and local. The source state, input, decision, and
ordinary transition targets should be visible near one another, and a fact
should not normally need to be updated in several places. Type cleverness,
brevity, or inference does not compensate for behavior that is hard to find or
change confidently.

A representative machine must remain easy to understand after normal automatic
formatting, without hand alignment or other formatting tricks. Representative
candidate APIs should therefore always be reviewed and edited in their
automatically formatted form.

### P0.2 — Optimize for small interaction machines

The main use case is interaction-technique development: roughly 2–20 control
states and dozens rather than hundreds of transitions. The reduced
[Marking Menu case](acceptance-cases.md#case-1-reduced-marking-menu) is the
primary acceptance case. A candidate must express its state-specific data,
pointer-driven transitions, timing races, stale-result protection, effects,
and recursive submenu data.

Larger-machine features must not add ceremony to this case.
Optimization for hundreds of states, enterprise workflow orchestration, or the
full statechart feature set is outside the target.

> **Amended 2026-08-05 — the size band, plus an open framing question.**
>
> **Size.** "2-20" is generous. Measured: in the SwingStates teaching benchmark,
> students implementing published interaction techniques produced machines of
> **2 to 9 states and 8 to 32 transitions**
> ([note 03](research/03-hci-interaction-state-machines.md), F5). Marking Menu
> was one of the eight techniques in that benchmark. Design for the bottom of
> the band: ceremony invisible at 20 states is still paid in full at 3.
>
> **Framing — needs a decision, not an edit by an agent.** This entry says the
> main use case _is_ interaction-technique development. The working brief
> ([api-rationale.md](api-rationale.md), §1) now says the library
> is a **general** FSM library for which interaction technique development is
> the _motivating domain_ — the reason timing, staleness and same-state updates
> are weighted — but not the subject matter. Those two framings are compatible
> but not identical, and they are load-bearing for what a candidate optimizes.
> Reconcile them deliberately. Until then the brief's reading is the one the
> next design round is working from.

### P0.3 — Make typestates the central type guarantee

Knowing the current state must provide precise state-specific data and
capabilities. A state may have no associated data. No particular TypeScript
encoding, including a discriminated union, is prescribed.

On the strongly typed path:

- applying a state-specific capability preserves its precise source state and
  input;
- input payloads or arguments are specific to the capability being applied;
- only valid target states are available;
- target-state data is checked against the selected target;
- an exposed transition outcome contains the exact target typestate, or the
  true union of possible target typestates;
- consumers can handle the complete state space exhaustively;
- declared states and capabilities are implemented exhaustively, with terminal
  states being intentional; and
- public types do not leak `any`; uncertainty is represented precisely or with
  `unknown`.

The full result must survive exporting a machine from a package and generating
TypeScript declaration files. Downstream users must not have to redeclare its
typestates.

> **Amended 2026-08-05.** The core of this entry is confirmed and is the
> project's reason to exist: **no surveyed library enforces per-state
> capabilities at the send site**, and neither XState nor Zag has per-state data
> at all ([note 07](research/07-js-fsm-library-landscape.md), F5).
>
> Two qualifications:
>
> - **Cross-boundary exactness is the least supported item here.** In the only
>   controlled typestate experiment, _every_ participant inserted dynamic checks
>   rather than couple one object's typestate to another's — in a language built
>   for that coupling ([note 05](research/05-typestate-and-behavioural-types.md)).
>   Consider making the exact-outcome-across-boundaries guarantee opt-in rather
>   than defining.
> - **Declaration-file survival is real but has three named failure modes**:
>   TS4023 (a type reachable in the inferred machine type is unexported), TS2742
>   (package layout), and TS9010 — `--isolatedDeclarations` categorically cannot
>   export an inferred machine, so an explicit-model path must stay available as
>   an option ([note 06](research/06-typescript-type-engineering.md), F8/F9).
>
> Related: **P1.3 is achievable.** Describing topology once, for both TypeScript
> and runtime, has been built and measured — see the correction in
> [api-rationale.md](api-rationale.md).

### P0.4 — Keep type narrowing truthful over time

If TypeScript narrows an observed value to state `S`, later machine activity
must not cause that same value to represent another state while TypeScript
still treats it as `S`.

A candidate may satisfy this with immutable snapshots, scoped access, opaque
handles, or another sound ownership model. It must document the lifetime and
aliasing rules of state observations. Because arbitrary values are allowed and
deep cloning or freezing is outside the target, users remain responsible for
objects they place inside state data unless a candidate explicitly assumes
ownership of them.

> **Amended 2026-08-05 — this entry stands, and it is sharper than it looks.**
>
> P0.4 is satisfiable, and this entry already names the mechanism that satisfies
> it. If evolution **returns a new value** rather than mutating something, a
> narrowed observation can never come to mean anything else: later activity
> produces a _different_ value, so "that same value" is never reinterpreted.
> Nothing in the type system has to be clever for this to hold.
>
> What the research adds is that this is a constraint on the **ownership model,
> not on the type system**, and that exactly one family of implementations
> satisfies it in TypeScript — Fugue's leak rule: once a value is observable,
> its state claim is frozen (DeLine and Fähndrich, ECOOP 2004). Every
> observation must be an immutable snapshot, and evolution must produce a new
> one.
>
> **What it rules out is a live mutable handle** — an object whose identity
> stays the same while its state changes underneath, so that narrowing it and
> continuing to use it is unsound. That case is not a TypeScript weakness: Brady
> shows a full-spectrum dependently typed language still accepting a
> double-close on a state-indexed handle until _uniqueness types_ are added
> ([note 05](research/05-typestate-and-behavioural-types.md), F1-F2).
> TypeScript has no uniqueness types and will not get them. So the requirement
> is met by choosing snapshots, not by trying harder at the type level.
>
> Two practical consequences a candidate must address:
>
> - **A truthful snapshot can still carry a stale capability.** P0.4 guarantees
>   that a value narrowed to `S` still _describes_ `S`. It says nothing about
>   whether an operation reached through that value is still legal to apply to a
>   machine that has since moved on. Truthful narrowing and live authority are
>   separate properties; do not let one appear to imply the other.
> - **Narrowing is dead inside closures created after the check**, unless the
>   narrowed value is captured in a `const`
>   ([note 06](research/06-typescript-type-engineering.md), F10, measured).
>   Interaction code lives in callbacks, so this is the common case, not an edge
>   case.
>
> The generation-1 implementation's `service.current` view was the pattern
> most at risk here.

### P0.5 — Make transition decisions deterministic and synchronous

Choosing the next state and its data depends only on the current state, the
submitted input, and data or dependencies explicitly made available by the
user. Conditions are supported, but their expression is an API question.

Transition decision logic does not perform effects or await asynchronous work.
Caller-owned evolution returns its result synchronously. A direct state change
from a non-reentrant submission to a library-owned live execution is committed
before input submission returns; it is not implicitly deferred to a microtask.
A reentrant submission may return after being queued but before being applied,
as specified by P0.7. If transition logic throws unexpectedly, no result is
applied and the programming error is surfaced.

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

Every input submitted to a library-owned live execution receives a deterministic
disposition: it is considered once in submission order, or explicitly rejected
because the execution has been disposed. An active execution does not silently
drop, coalesce, debounce, or reorder inputs. Those policies may be applied
explicitly before submission.

If a reaction or observer submits another input during a transition cycle, the
current commit and reaction cycle finishes first. The new input is queued
rather than processed against a half-committed state. Commit, reaction, and
observation ordering must be deterministic and documented. Unless the execution
is disposed during the cycle, the queue drains before the outermost submission
returns rather than being deferred to a microtask.

A live execution does not retain unbounded transition history by default. The
library provides no built-in undo, redo, or time-travel behavior, and drops its
own references to old state values and inputs when they are no longer
operationally needed. References retained by user code remain the user's
responsibility.

> **Amended 2026-08-05 — under-specified, and cheap to fix.**
>
> Run-to-completion is not one decision but **eight** semantic aspects
> (Esmaeilsabzali, Day, Atlee and Niu, _Requirements Engineering_ 15(2), 2010),
> of which at least five stay live in a flat 2-9 state machine
> ([note 02](research/02-execution-semantics-and-time.md)). Flatness dodges the
> hierarchy-dependent statechart disagreements; it does **not** dodge the
> timing ones.
>
> This entry should therefore be _more_ prescriptive, not less — because
> execution semantics is the one capability that **adds zero authoring syntax**.
> Under this document's own logic, a capability that costs no ceremony should be
> specified completely; the discipline belongs on vocabulary (postpone,
> immediate transitions, priority) instead.
>
> Precedent worth copying: XState v5's commit order, read from `createActor.ts`,
> is **snapshot → deferred effects → observers**, all inside a mailbox flush, so
> a send from an effect or an observer is queued and never nested — about 30
> lines. And a warning: XState v4 shipped a named bug here
> (`predictableActionArguments`) whose cause was exactly a pure step with a
> deferred command list, which is the effect model this project favours.

### P0.8 — Support effects without mixing them into transition decisions

Effects must have a supported integration, although their representation and
ownership remain open. They may be returned descriptions, external reactions,
library-owned lifecycles, or another model that keeps them out of transition
decisions.

The supported effect model must provide:

- work that has become irrelevant can be cancelled, cleaned up, or made unable
  to affect later evolution;
- asynchronous success, failure, or progress can influence later evolution;
- enough lifecycle or identity information to make supported integrations safe
  from stale asynchronous results; and
- explicit shutdown or disposal if a library-owned runtime starts and owns
  effectful resources.

The library cannot prevent arbitrary external code from presenting a stale
result, but it must make race-safe integrations possible. An effect failure
does not roll back an already committed transition. Expected failures may
influence later evolution; unexpected exceptions are surfaced.

### P0.9 — Treat time as a first-class interaction concern

Interaction machines need scheduling, cancellation, protection from stale
timer callbacks, and deterministic tests through a controllable clock,
explicit scheduler, returned schedule descriptions, or an equivalent
mechanism. Transition computation remains synchronous; elapsed time may
influence only later evolution.

Whether timing is described by the machine, returned work, a supported runtime,
or another integration is an API question.

> **Amended 2026-08-05 — the evidence favours library-owned timers.**
>
> Leaving this fully open is probably wrong. Every system surveyed that got
> timing right — `gen_statem`, XState, SCXML — **owns the timer**, and an
> injectable clock is the only route to deterministic tests
> ([note 02](research/02-execution-semantics-and-time.md)). Proton++ had to
> encode a one-third-second dwell as ten literal touch-move symbols at a forced
> 30 Hz sample rate, which is decisive evidence against expressing duration in
> the transition notation ([note 04](research/04-hci-critiques-and-alternatives.md),
> F4).
>
> But **state-scoped timers do not remove staleness tokens in general.**
> `gen_statem` ships a _named_ timeout that deliberately survives state changes,
> because cross-state windows (double-click, press-and-hold) cannot be expressed
> otherwise. Elm cannot cancel `Process.sleep` at all and its community answer
> is an id carried in the message; React's `useEffect` docs prescribe a
> closure-scoped `ignore` flag. Ownership moves; the problem does not vanish,
> and Case 3's request race still needs identity.
>
> Consequence for [acceptance-cases.md](acceptance-cases.md): Case 1's
> `timerToken` bookkeeping is _one implementation_ of stale-dwell protection,
> written into the case as though it were the specification. Decide timer
> ownership before freezing that case, so it specifies the race rather than a
> particular fix for it.

### P0.10 — Make committed transitions observable

Every committed transition in a library-owned live execution, including a
same-state update, must be observable externally. Caller-owned evolution
exposes the corresponding outcome directly. Strongly typed transition records
preserve the correlation among source state, input, and target state rather
than widening each independently.

The exact subscription or reaction mechanism remains open.

> **Settled 2026-08-19 — two mechanisms, not one.** Transitions are observed
> with `observe(pattern, fn)` on the host, keeping the pattern language and the
> correlated record this entry requires. A second, opt-in channel carries
> declared **outputs**, subscribed by name. Both exist because they answer
> different questions: under one merged mechanism a debugging subscription and a
> structural one are the same call, and a consumer of a machine has to name its
> internal states to react to it. Nothing is hidden either way —
> [api-rationale.md, §16](api-rationale.md#16-the-composition-boundary).

### P0.11 — Fit high-frequency, platform-neutral browser code

The primary runtime target is modern ESM-capable browsers. State evolution
remains independent of the DOM, UI frameworks, RxJS, and any particular
scheduler so it can also run in other modern JavaScript environments.

The hot path must have small, synchronous, predictable overhead. It must not
require a microtask, deep clone or freeze, serialization pass, runtime schema
validation, or framework render for every transition. Exact performance
budgets are established through the staged candidate evidence above.

Type-checking and editor performance are also acceptance criteria.
Representative 2–20-state machines must remain responsive and must not trigger
pathological type-checking behavior. Current TypeScript performance means this
is not a reason to weaken the design pre-emptively.

## P1 — Important

### P1.1 — Minimize conceptual learning cost

A candidate should present a compact, coherent mental model that can be learned
from representative use. Familiar FSM graph concepts may help some users, but
no representation receives preference merely for familiarity.

An unfamiliar model remains viable when its learning cost buys materially
easier understanding, editing, or correct use. Novelty alone is not a benefit.

### P1.2 — Produce readable, local TypeScript diagnostics

An invalid source read, target, input, or target-state value should report near
the mistake and explain it in familiar terms. A readable error-bearing helper
type is an acceptable fallback when TypeScript cannot place the error more
precisely, but obscure type-level failures are not.

Perfect error placement does not outrank the readability of valid machine
definitions.

### P1.3 — Avoid duplicate topology declarations

Users should not normally describe the same states, capabilities, and targets
once for TypeScript and again for runtime behavior. If a separate type-level
model proves worthwhile, the compiler must detect drift between it and the
implementation.

### P1.4 — Degrade gracefully outside the fully typed path

JavaScript users and TypeScript users who provide incomplete types should
still receive a usable interface. Types may widen as information is lost, but
should not collapse into an unusable `never`-heavy surface. This does not weaken
the strict, fully typed contract.

### P1.5 — Keep shipped code small

A dependency-free implementation is preferred. A dependency remains
acceptable when it clearly improves correctness or the implementation enough
to justify its cost. Candidate measurements must establish a realistic
minified-and-gzipped budget before finalist comparison. The initial 2–3 KB idea
is an exploratory hypothesis, not a requirement or scoring threshold.

### P1.6 — Support independent uses of the same behavior

Equivalent machine behavior should support multiple independent evolving
values or live executions, each with its own initial state data. This does not
require a reusable definition object or prescribe who owns the evolving state.

### P1.7 — Avoid compilation steps

Prefer an architecture in which the library can be used directly in TypeScript
or JavaScript without a build step or code generation. This is stronger than
merely avoiding a separate compilation step for the library itself, but it must
yield if enforcing the separation makes the primary API materially worse.

## P2 — Useful

### P2.1 — Compose independently defined machines

Independently defined machine behavior should be usable together while each
part keeps its own typestate and effect ownership. Where live executions exist,
a coordinator should be able to start, stop, and communicate with them.
Composition must not require hierarchical or parallel states in the core API.

> **Answered 2026-08-19, and it is mostly not a notation.** Peers communicate by
> declared outputs — each level publishes its own vocabulary and the next
> consumes it without naming a state, which is SwingStates' stacking pattern
> ([note 04](research/04-hci-critiques-and-alternatives.md), F7). Prototyped
> twice over three examples in `explorations/composition/`.
>
> The blocker was not expressiveness. Commit ordering guarantees that a
> listener is never re-entered while an earlier call is still running, but the
> queue is **per host**, so peer wiring — which crosses hosts — is exactly where
> the guarantee lapses. A shared scheduler fixes it in about fifteen lines, and
> it is needed whatever the notation. See
> [api-rationale.md, §16](api-rationale.md#16-the-composition-boundary).
>
> Still outside this entry: the wiring itself remains imperative and outside the
> definition, so an exported peer is still "half a machine plus a convention"
> (§10). Declared outputs improve that — the convention names published outputs
> rather than internal states — without closing it.

### P2.2 — Distinguish same-state updates from explicit re-entry

An ordinary same-state data update should be able to preserve state-lifetime
resources, while an explicit re-entry can restart exit/entry lifecycle
behavior. Exact terminology and representation are deferred.

### P2.3 — Offer small asynchronous-work conveniences

First-class helpers may cover promises or other common invoked work, provided
they build on the supported effect integration and later evolution rather than
making transition computation asynchronous. A general actor or observable model
is unnecessary.

### P2.4 — Represent formal completion when useful

A state with no capabilities already behaves as terminal. A formal final-state
concept may additionally support typed completion output and composition.

### P2.5 — Support concise effect-free sequence tests

Pure, synchronous transitions already make sequence testing straightforward.
Dedicated helpers may improve assertions over inputs, resulting typestates,
and no-transition outcomes.

### P2.6 — Make topology inspectable

Tooling should be able to recover states, accepted inputs, and possible targets
without executing transition logic. Conditions and effects may remain opaque.

### P2.7 — Validate malformed runtime definitions

When static guarantees are unavailable or degraded, development-time runtime
checks may catch unknown initial states, unknown targets, or otherwise
malformed definitions. This is structural validation, not validation of user
data.

### P2.8 — Reject excess target-state fields when practical

Missing fields and fields of the wrong type are part of the core typestate
guarantee. Rejecting extra fields as well is useful, but may be traded for
clearer types and errors.

> **Amended 2026-08-19 — built, for every target, without the trade.** A
> data-carrying target already rejected excess fields through ordinary
> excess-property checking. The one gap was a payload-free target, where the
> bare projection type is `{}` and `{}` accepts any object literal — so a
> handler could restate the target's tag and nothing objected. The tagged
> empty-object encoding closes it: a payload-free target now rejects a fresh
> literal carrying extra properties, a wider-typed variable, an
> interface-typed value, and a spread of a wider state, with error quality
> equal to the data-carrying case — no trade needed
> ([rationale §17](api-rationale.md#17-the-shape-of-a-named-thing)).

### P2.9 — Reuse behavior shared by several states

It should be possible to avoid repeating common behavior such as cancellation
or reset while preserving precise state typing. This is low priority: explicit
repetition is acceptable when the behavior is already easy to define and a
reuse mechanism would obscure targets.

> **Amended 2026-08-05 — this is the wrong axis, and P2.1 is the right one.**
>
> The SwingStates authors report that state explosion is **not** an issue within
> a single interaction technique and appears only when _combining_ techniques.
> Their fix, and ConstraintJS's independently (a radio button as 2×2×4 = 16
> states), is **parallel small machines with light communication — never
> hierarchy, and never shared-state reuse**
> ([note 04](research/04-hci-critiques-and-alternatives.md), F2, C3).
>
> So the pressure this entry tries to relieve does not arise at the scale this
> library targets, and the pressure that _does_ arise is composition — which
> lives in **P2.1**, also scored "useful". Three independent systems converged
> on composition; consider promoting P2.1 and leaving P2.9 where it is.
>
> Relatedly: SwingStates' own published Marking Menu is **three parallel
> machines** (linear menu, marking menu, item highlighting), while
> [acceptance-cases.md](acceptance-cases.md) Case 1 folds recognition, timing
> and feedback into one. The case may be testing the wrong shape.

> **Followed up 2026-08-19 — it was, in two ways.** Written as peers,
> recognition and feedback each stay small and neither names the other's states;
> the split cost nothing and the composition seam is six patterns or four output
> names depending on the model (`explorations/composition/ex1-marking-menu/`).
>
> Timing is the sharper finding, and it goes the other way: the dwell belongs
> **inside** recognition rather than beside it. Once the machine owns the timer,
> leaving the state cancels it, a stale `dwell` cannot arrive, and Case 1's
> `timerToken` and `nextToken` stop being needed at all. That is the strongest
> argument in the record for `actions`, and it is not an argument for splitting.

## Deferred extension probes

These are not requirements, and candidates receive no credit for anticipating
them. Their absence is not a weakness. A probe may be applied to finalists only
after the primary cases work, to learn whether a later extension is plausible
without adding ceremony now.

### Probe 1 — Hierarchical and parallel control states

A finalist may be tested by sketching how composition or an optional extension
could represent them. No accommodation belongs in the initial interface solely
for this probe.

### Probe 2 — Automatic or eventless transitions

A finalist may be tested by sketching their cascading and observability
semantics. The initial execution model need not reserve a representation for
them.

> **Answered 2026-08-18.** Immediate transitions shipped in v1 as
> `'from -> to'`, the transition key with the input removed — see
> [api-rationale.md, §7](api-rationale.md#7-immediate-transitions). Cascading
> settles to exhaustion under a hop budget rather than provably terminating;
> observability is intact, since every hop still commits and notifies before
> the next candidate is tried.

### Probe 3 — Explicit Resource Management interoperability

If the library eventually manages effect lifetimes internally, it may
interoperate with `Disposable`, `AsyncDisposable`, and `using`. This has no
independent value for a library that leaves effects entirely external.

### Probe 4 — Restore serializable state

Users may always place non-serializable values in state data. Much later, a
machine whose user-provided data happens to be serializable could support
restoration. This must not impose serializability on the normal case.

### Probe 5 — Visualization and dedicated development tools

If a concrete tooling need later appears, a finalist may be tested against it.
No metadata or topology representation is required solely to preserve this
possibility.

## P4 — Outside the target

### P4.1 — Dynamic control-state discovery

Do not support adding or discovering control states after definition. State
data may still be recursive or unbounded.

### P4.2 — Runtime schemas for state data or inputs

The library does not validate arbitrary user data against runtime schemas.
Users may add their own validation at system boundaries.

### P4.3 — Semantic middleware or plugins

Do not build a middleware system that can intercept and change transition
semantics. Observation or effect integrations must not be able to rewrite an
already selected transition.

### P4.4 — A general actor or observable runtime

Do not turn the library into an actor framework, stream framework, or broad
asynchronous orchestration system.

### P4.5 — Formal verification toolchains

Model checking, SCXML compatibility, and generation for those toolchains are
outside the project's target. General API code generation remains disfavored by
P1.7 rather than prohibited here.

## Deliberately undecided API questions

The requirements above do not decide:

- whether inputs look like events, methods, commands, or another capability;
- whether definitions use configuration objects, functions, builders,
  immutable state objects, or a combination;
- whether evolving state is caller-owned, runtime-owned, or available both
  ways;
- how conditional behavior is written;
- whether effects are returned descriptions, external reactions,
  runtime-managed lifecycles, or another model;
- whether pure evolution and supported effect integration are separate modules;
- how user dependencies are supplied, including whether a dedicated channel is
  useful;
- how state-indexed capabilities coexist with runtime handling of unavailable
  inputs;
- whether an unavailable input is silent, observable, or diagnostic;
- the exact ordering among state commitment, reactions or effects, and
  observations;
- how no-transition, same-state update, and explicit re-entry are represented;
- how initial state data is supplied; or
- which conveniences, if any, deserve shorthand.

Those remain subjects for API exploration and candidate comparison.
