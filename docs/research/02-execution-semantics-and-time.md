# Execution semantics: run-to-completion, event queues, determinism, and time

> Research note. Evidence levels: [READ] full text, [ABSTRACT] abstract only,
> [SECONDARY] cited elsewhere.
>
> Note 08 covered Erlang `gen_statem` (postpone, `state_timeout`, `next_event`,
> the two callback modes). This note does not repeat it; where it touches
> `gen_statem` it is to _correct or sharpen_ note 08's F7.

## Scope and questions asked

1. What do mature reactive systems actually promise about **when** things
   happen — and in what order do they commit state, run effects, and notify
   observers?
2. Where has that ordering produced real, documented bugs?
3. What is the **minimum** execution semantics a small interaction-machine
   library must specify, and what can it leave unspecified without lying?
4. Is note 01's verdict on timed automata right, and is note 08's F7 claim —
   that state-scoped timers make the Marking Menu's `timerToken` bookkeeping
   unnecessary — actually true?

Framing constraint from `00-evaluation-brief.md`: capabilities must pay for the
ceremony they add. Execution semantics is unusual in that **most of it costs no
syntax at all** — it is a decision, not an API surface. That changes the
cost-benefit calculation and is the through-line of this note.

## Key sources

Peer-reviewed / archival:

- Gérard Berry and Georges Gonthier, "The ESTEREL synchronous programming
  language: design, semantics, implementation", _Science of Computer
  Programming_ 19(2), 1992, pp. 87-152, doi:10.1016/0167-6423(92)90005-V —
  [READ] (full PDF retrieved and converted).
- Nicholas Halbwachs, Paul Caspi, Pascal Raymond, Daniel Pilaud, "The
  Synchronous Data Flow Programming Language LUSTRE", _Proceedings of the IEEE_
  79(9), 1991, pp. 1305-1320, doi:10.1109/5.97300 — [READ] (invited paper,
  full PDF retrieved).
- Rajeev Alur and David L. Dill, "A theory of timed automata", _Theoretical
  Computer Science_ 126(2), 1994, pp. 183-235,
  doi:10.1016/0304-3975(94)90010-8 — [READ] (full PDF retrieved).
- Shahram Esmaeilsabzali, Nancy A. Day, Joanne M. Atlee, Jianwei Niu,
  "Deconstructing the semantics of big-step modelling languages",
  _Requirements Engineering_ 15(2), 2010, pp. 235-265,
  doi:10.1007/s00766-010-0102-z — [READ] (author copy,
  <https://cs.uwaterloo.ca/~sesmaeil/publications/2010/REJ10.pdf>).
- Evan Czaplicki and Stephen Chong, "Asynchronous functional reactive
  programming for GUIs", _PLDI 2013_, pp. 411-422, doi:10.1145/2491956.2462161
  — [READ] (author copy, Harvard).
- Florence Maraninchi and Yann Rémond, "Argos: an automaton-based synchronous
  language", _Computer Languages_ 27(1-3), 2001, pp. 61-92,
  doi:10.1016/S0096-0551(01)00016-9 — [ABSTRACT]; full text paywalled and the
  HAL copy is behind an anti-bot wall. Bibliographic details confirmed against
  the ScienceDirect record and the author's own publication page.
- Lionel Rieg and Gérard Berry, "Towards Coq-verified Esterel Semantics and
  Compiling", arXiv:1909.12582v2 [cs.FL] — [READ]. **Preprint, not
  peer-reviewed**; used only for its restatement of Berry's constructive
  semantics, which it attributes to Berry, "The Constructive Semantics of Pure
  Esterel" (draft book) — [SECONDARY], the draft itself was not retrievable.
- Gregory Cooper and Shriram Krishnamurthi, "Embedding Dynamic Dataflow in a
  Call-by-Value Language", _ESOP 2006_ — [SECONDARY], origin of the term
  "glitch"; not retrieved in this pass.

Engineering documentation (normative or vendor):

- W3C, _State Chart XML (SCXML): State Machine Notation for Control
  Abstraction_, Recommendation, <https://www.w3.org/TR/scxml/> — [READ],
  targeted sections including Appendix D (algorithm), `<raise>`, `<send>`,
  `<cancel>`.
- OMG UML state machine semantics, run-to-completion section (spec text via a
  mirrored copy of §15.3.12) — [READ].
- Erlang/OTP `gen_statem` reference, timeout types —
  <https://www.erlang.org/doc/apps/stdlib/gen_statem.html> — [READ].
- Redux `createStore.ts` source (master) and the `store.subscribe` API docs —
  [READ].
- XState v5 `Mailbox.ts` and `createActor.ts` sources; `eventless-transitions`,
  `delayed-transitions`, `actions`, and migration docs — [READ].
- React `useEffect` reference (race-condition cleanup pattern) and the React 18
  working-group discussion #86 on tearing / `useSyncExternalStore` — [READ].
- WHATWG DOM `dispatchEvent` dispatch flag; MDN `Event.timeStamp`,
  `AbortSignal.any()` — [READ].
- Chrome for Developers, "Aligned input events" (Chrome 60) — [READ].
- `@sinonjs/fake-timers` README; RxJS `TestScheduler` docs — [READ].

Opinion / community (labelled as such throughout):

- Nicholas Jamieson (RxJS core team), "RxJS: Avoiding switchMap-related Bugs" —
  [READ], expert blog.
- Frontside, "AbortController.abort() Doesn't Mean It Stopped" — [READ], vendor
  blog arguing for their own library.
- RxJS issues #2155, #6520; XState issues #193, #721 — [READ], bug reports.
- Elm Discourse thread on cancelling `Process.sleep` — [READ].
- Glenn Fiedler, "Fix Your Timestep!" — [ABSTRACT], widely cited game-dev post.

## Findings

**F1 — "Run-to-completion" is the synchrony hypothesis with the idealization
removed, and Esterel states it more strongly than any FSM library does.** Berry
and Gonthier: "each reaction is assumed to be instantaneous-and therefore atomic
in any possible sense". Two clauses matter. The environment is invariant during
a reaction, _and_ subprocesses take no time relative to each other. [READ, Berry
and Gonthier 1992, §1.4]

Non-obvious consequence: the synchrony hypothesis is not primarily about speed.
It is about **denying the existence of intermediate observable states**. Every
"run-to-completion" rule in UML, SCXML and `gen_statem` is a weakened, queued
approximation of that denial. A library that lets an observer read the machine
mid-transition has not implemented a weak version of RTC; it has implemented
none.

**F2 — Determinism in synchronous languages is conditional on causality, and
programs that fail the condition are rejected outright.** Berry and Gonthier's
Theorem 3 ("Correctness and determinism theorem") is stated only for a program
"causally correct" with respect to a given input; under that hypothesis the
successor program and output event are _unique_. [READ, Berry and Gonthier 1992,
§8.5]

Note the shape of the deal: you get a strong uniqueness theorem, and the price
is that some syntactically legal programs have no semantics at all.

**F3 — A program can be deterministic and still be rejected, because
determinism is not the property being protected.** Rieg and Berry work through
three kernel programs. `s ? !s , !s` (emit `s` in both branches of a test on
`s`) is, in their words, "logically coherent and deterministic but not causal",
and the constructive semantics rules it out; such programs also yield
electrically unstable cycles once compiled to circuits. [READ, Rieg and Berry,
arXiv:1909.12582v2, §3-4; the underlying result is Berry's]

The constructive semantics achieves this with a third signal status ⊥ —
"not known yet" — on which execution simply **blocks**. Nothing guesses a
default.

Transfer to this project: the analogue of a causality cycle is an observer, or
an effect, that submits an input _during_ a transition and whose input's outcome
depends on the transition it is inside. Esterel's answer is not "queue it and
hope"; it is "this program is meaningless, refuse it".

**F4 — But Esterel's answer is unavailable to this project, and there is a
citable reason.** Esmaeilsabzali et al. record that big-step languages using
whole-big-step event visibility avoid non-causal steps by defining a notion of
"correct" model and rejecting incorrect ones at compile time — and then: "if a
BSML supports variables, the detection of incorrect models is undecidable".
[READ, Esmaeilsabzali et al. 2010, §3.3]

Note 01 F2 already established that per-state data makes this project an EFSM,
i.e. a model _with_ variables. So the constructive-rejection route is closed on
principle, not on effort. **The only remaining options are queueing, forbidding,
or leaving it unspecified.**

**F5 — "Run-to-completion" is not one decision; it is eight, and this
contradicts note 01 F5.** Esmaeilsabzali et al. deconstruct big-step languages
into eight mostly orthogonal semantic aspects: Big-Step Maximality, Combo-Step
Maximality, Event Lifeline, Enabledness Memory Protocol, Assignment Memory
Protocol, Order of Small Steps, Concurrency and Consistency, and Priority.
[READ, Esmaeilsabzali et al. 2010, §3, Fig. 4-5]

Note 01 F5 claims that essentially every statechart semantic disagreement
"presupposes nesting". That is **wrong for at least five of the eight**. Only
Concurrency and Consistency (does a small step contain more than one
transition?) and Priority (which of several conflicting transitions wins?) need
hierarchy or orthogonality to be interesting. The other six are live in a flat
machine the moment the machine can raise an event to itself or read a variable
it also writes:

| Aspect                      | Meaningful in a flat 3-state machine? | Flat-machine form                               |
| --------------------------- | ------------------------------------- | ----------------------------------------------- |
| Big-Step Maximality         | yes                                   | does one input yield one transition or a chain? |
| Combo-Step Maximality       | only with internal events             | batching of raised events                       |
| Event Lifeline              | yes                                   | can a raised event trigger the same big step?   |
| Enabledness Memory Protocol | yes                                   | do guards see old or new data?                  |
| Assignment Memory Protocol  | yes                                   | does an effect see old or new data?             |
| Order of Small Steps        | only with chaining                    | FIFO vs LIFO for raised events                  |
| Concurrency and Consistency | no                                    | needs AND-states                                |
| Priority                    | no (if one decision per pair)         | needs conflicting edges                         |

This is a **strengthening** of note 01's underlying point, not a reversal:
flatness dodges the _hierarchy_ half of the variant swamp. It does not dodge the
_time_ half. Note 01's F6 feature table lists "Run-to-completion, event queue"
as one row; it is six.

**F6 — Take-one terminates, run-to-completion does not, and UML's RTC is
classified as the non-terminating kind.** Esmaeilsabzali et al.'s Table 1: under
TAKE ONE each Or-state contributes at most one transition per big step and "a
big step always terminates"; under SYNTACTIC and TAKE MANY a big step can run
forever. They explicitly classify UML StateMachines' run-to-completion and
Rhapsody's compound transitions as SYNTACTIC, listing "non-terminating big
steps" as a drawback of that option. [READ, Esmaeilsabzali et al. 2010, §3.1,
Table 1]

This is the theoretical name for a bug JS developers hit constantly. XState
issue #721: an eventless (`''`) transition whose guarded branch has a target and
whose fallback branch has actions but _no_ target loops forever re-evaluating
the guard. XState's own docs concede only that "XState will help guard against
most infinite loop scenarios". [READ, XState #721; Stately eventless-transitions
docs]

**Conclusion: the only way to have a big step that provably terminates is to
forbid chaining — one input, at most one transition.** Every "immediate" /
"always" / eventless / transient transition feature buys expressiveness by
giving up the termination guarantee. This is a clean, defensible scope boundary
that costs the project nothing it currently has.

**F7 — "Internal events preempt external ones" is a named semantic choice with
a named cost, not the obvious answer.** Esmaeilsabzali et al. list five Event
Lifeline options with their trade-offs: PRESENT IN WHOLE (Esterel, Argos) gives
modularity and global consistency but admits non-causality; PRESENT IN REMAINDER
(classical statecharts) gives causality but loses "rigorous causal ordering", so
an event generated earlier need not be _handled_ earlier; PRESENT IN NEXT COMBO
STEP (Statemate, RSML) and PRESENT IN NEXT SMALL STEP recover ordering at the
cost of multiple-instance events; PRESENT IN SAME gives instantaneous rendezvous
and is again non-causal. [READ, Esmaeilsabzali et al. 2010, §3.3, Table 3]

Note 08 F8 recorded `gen_statem`'s internal-event preemption as a virtue
("ordering is specified, not incidental"). It is; but the literature says the
specific option chosen is a _trade_, and the SCXML/`gen_statem` family sits in
the causality-preserving, ordering-preserving corner and pays with
multiple-instance events.

**F8 — SCXML's algorithm, stated exactly.** A microstep executes the transitions
in one optimal enabled transition set. A macrostep is a series of microsteps
"ending in a configuration where the internal event queue is empty" and no
eventless transitions are enabled. Within a microstep the order is fixed: exit
the exit set in exit order, run the transitions' executable content in document
order, enter the entry set in entry order. `<invoke>` handlers for newly entered
states run only **after** the macrostep. Errors during evaluation are pushed
onto the _internal_ queue as `error.execution` and processed like any other
event. External events are only dequeued when the internal queue cannot enable
anything. [READ, W3C SCXML, Appendix D and §3-4]

Two details a library author will not guess:

- Errors are events. That is a real design move — an execution error becomes an
  input the machine can handle from a state, rather than an exception that
  unwinds the interpreter.
- Long-running child processes start _after_ the whole macrostep settles, not at
  the entry action. Effect start is deliberately deferred past the point where
  the configuration could still change.

**F9 — `<raise>` and `<send>` to the same session differ only in which queue
they use, and that alone changes observable ordering.** `<raise>` enqueues
internally; a plain `<send>` enqueues externally, so it is processed only after
the current macrostep drains. SCXML also states that a raised event will not be
processed until the current block of executable content has completed. [READ,
W3C SCXML, `<raise>`, `<send>`]

The transferable observation: **a library needs at most two queue positions**
("now, before anything external" and "later, like any other input"), and that
distinction is worth a vocabulary word only if the machine can raise events at
all.

**F10 — SCXML does _not_ auto-cancel delayed sends on state exit; XState and
`gen_statem` do. The three most-cited engines disagree on the single most
important timer question.** SCXML requires an explicit `<cancel sendid="...">`,
conventionally written in `<onexit>`, and specifies only that a processor SHOULD
make a best attempt to cancel. XState v5 documents that "Delayed transition
timers are canceled when the state is exited." `gen_statem`'s `state_timeout` is
cancelled by a state change. [READ, W3C SCXML `<cancel>`; Stately
delayed-transitions docs; Erlang `gen_statem` docs]

**F11 — `gen_statem` ships _three_ timer kinds, and only one is state-scoped.
This substantially weakens note 08's F7.** From the reference manual:

| Kind                        | Cancelled by           | Restart / cancel                                       |
| --------------------------- | ---------------------- | ------------------------------------------------------ |
| `event_timeout`             | **any arriving event** | reset by setting again                                 |
| `{timeout, Name}` (generic) | **nothing automatic**  | same `Name` restarts it; `infinity` cancels            |
| `state_timeout`             | **a state change**     | "A state change cancels this timer, if it is running." |

[READ, Erlang `gen_statem` docs, timeout types]

Note 08 F7 concluded that Erlang's state-scoped timers make the Marking Menu's
`timerToken` bookkeeping "not a problem at all". The stress test:

1. Erlang itself did not conclude that one timer scope suffices. It ships a
   named timer that explicitly _survives_ state changes, precisely because
   state-scoped is not general.
2. Cross-state timing windows are common in interaction techniques and are
   exactly what the named timer is for: a double-click window that spans
   `down → up → down`, a press-and-hold that must keep counting while the
   pointer wanders between `startup` and `drag`, a rate limiter, an idle
   timeout. None of these is state-scoped. The Marking Menu dwell _is_
   state-scoped, so it is the easy case, and generalizing from it is the error.
3. State-scoped cancellation only covers **timers**. It does not cover a pending
   `fetch`, an in-flight `requestAnimationFrame`, a `ResizeObserver`
   notification, or a promise resolution — all of which can also arrive stale.
4. Cancellation is not free even when it exists. See F17.

So: note 08 F7 is right that the _acceptance case_ should specify the race
rather than the fix, and right that owning timers removes token bookkeeping for
the residency-scoped case. It is wrong that state-scoped timers make the general
problem disappear.

**F12 — Elm is the control case: a runtime that does _not_ own timers, where the
community answer is exactly the project's `timerToken`.** `Process.sleep` cannot
be cancelled in Elm — the timeout id lives only in a closure inside
`_Process_sleep` and is not reachable from `Process.kill`. The recommended
workaround is tagging the timeout with an id and "ignoring the message in your
`update`". [READ, Elm Discourse #3666, community answers]

React's official documentation prescribes the same shape for async results: a
closure-local `ignore` flag set to `true` by the effect's cleanup function, so
that a response arriving after the dependency changed is dropped. React's own
justification is that network responses may arrive in a different order than the
requests were sent. [READ, React `useEffect` reference]

The pattern is identical in all three; only the _scope that owns the flag_
differs — machine data (Marking Menu), closure (React), message payload (Elm).
**Staleness protection does not disappear when the runtime owns the timer; it
moves.** Owning the timer moves it from the author's data into the library.

**F13 — There are exactly four shipped answers to "an action sends an event to
its own machine", and each mainstream library picks a different one.**

| Answer                              | Shipped by        | Mechanism            |
| ----------------------------------- | ----------------- | -------------------- |
| Queue and drain (trampoline)        | XState v5         | `Mailbox`            |
| Forbid, throw                       | Redux             | `isDispatching` flag |
| Allow, nest, document the hazard    | Redux subscribers | none                 |
| Reject the _same_ event object only | DOM               | dispatch flag        |

Concretely:

- XState's `Mailbox` is a linked list with a `_current` pointer. `enqueue`
  during a flush sees `_current` non-null, appends, and returns _without_
  calling `flush`; the outer `while (this._current)` loop picks it up. Twelve
  lines of code implement full RTC. [READ, `packages/core/src/Mailbox.ts`]
- Redux sets `isDispatching = true` around the reducer call and throws
  "Reducers may not dispatch actions." It also forbids `getState`, `subscribe`
  and `unsubscribe` during that window. [READ, `redux/src/createStore.ts`]
- Redux does **not** forbid dispatching from a subscriber. Its own API docs warn
  that a listener may not observe every state change, because state may have
  been updated several times by a nested dispatch before that listener runs.
  [READ, Redux `store.subscribe` docs]
- WHATWG DOM sets a dispatch flag on the _event object_ and throws
  `InvalidStateError` if the same object is re-dispatched — but a handler may
  freely `dispatchEvent` a different event, synchronously and reentrantly.
  [READ, WHATWG DOM]

The non-obvious pattern: **Redux forbids reentrancy in the pure part and permits
it in the observation part — and the documented hazard lives entirely in the
permitted half.** A design that protects only the transition function is
protecting the half that was never at risk.

**F14 — RxJS chose "no guarantee" and its users pay in surprise.** Issue #2155:
a `BehaviorSubject` seeded with `INITIAL` whose subscription chain calls `next`
during delivery emits `FIRST, INITIAL, SECOND` where the reporter expected
`INITIAL, FIRST, SECOND`. Reentrancy behaviour also _changed_ between v6 and v7
for subscribing to a subject inside a `next` handler. [READ, RxJS #2155, #6520 —
bug reports]

This is the strongest available evidence that "leave it unspecified" is a real
option (RxJS is enormous and a decade old) and a bad one (the ordering becomes
the user's problem and can silently change across a major version).

**F15 — XState v5's commit order, read from source, is: state, then effects,
then observers — all inside the mailbox flush.** `Actor.update()` assigns
`this._snapshot = snapshot` first, then drains a deferred-effect list, then
iterates `this.observers` calling `observer.next(snapshot)`. Because all of this
runs inside `Mailbox.flush`, a `send` from an effect _or_ from an observer is
enqueued rather than processed reentrantly. [READ,
`packages/core/src/createActor.ts`]

This is a complete, copyable answer to the ordering question, in about thirty
lines. It is also strictly stronger than Redux's, which protects the reducer and
not the subscribers.

**F16 — Ordering ambiguity has caused shipped, named bugs in the largest JS FSM
library, and the cause is a design the project shares.** XState v4 computed a
transition purely, accumulating an action list, and executed it later in the
interpreter. Two consequences:

- `assign` actions were hoisted and executed before other actions, so an action
  written before an `assign` still saw the post-`assign` context (issue #193).
- Custom actions were invoked with the event that triggered the current _macro_
  transition rather than the event responsible for their own transition.

The fix shipped in v4.33 as an opt-in flag literally named
`predictableActionArguments`, and became the default in v5: "Assign actions will
always run in the order they are defined." [READ, XState #193, PR #3289
description, migration guide]

The relevant warning: **the "effects as returned commands" model that notes 08
(F4) and the propositions favour is exactly the design that produced this bug.**
Deferring a command list past the point where data changed forces a decision —
which snapshot does a command see? — that the Esmaeilsabzali taxonomy calls the
Assignment Memory Protocol. It must be answered explicitly.

**F17 — The observation half of the ordering problem has a name and a
mainstream fix, and it only exists if observation can interleave with update.**
React's working group documents "tearing": under concurrent rendering, different
components read different versions of an external store. Their framing is that
external stores expose one version — "Redux's store has a `getState` method, but
it doesn't have a `getBackgroundState` method". Redux's "zombie child" bug and a
Relay variant drove the design of `useSyncExternalStore`, whose contract
requires `getSnapshot` to return a cached, referentially stable value. [READ,
reactwg/react-18 discussion #86]

For this project this is _good_ news and a boundary marker: a synchronous,
single-threaded, notify-after-commit design (F15) cannot tear. Tearing is the
price of interruptible observation, which a small interaction library has no
reason to offer.

**F18 — Timed automata: note 01 F8 is confirmed, but it discarded one
transferable primitive.** Alur and Dill's contribution is language-theoretic:
closure under union and intersection but not complement for the
nondeterministic case; a PSPACE algorithm for emptiness via the region
construction; undecidability (Π¹₁-hard) of universality and language inclusion
in the nondeterministic case, PSPACE-complete in the deterministic case. The
paper's application section is about _verification_. [READ, Alur and Dill 1994,
abstract, §4.2, §5, §7]

Confirmed: none of this transfers to a library that has ruled out verification.
But the _modelling_ primitive is smaller and does transfer: a clock reset on a
transition, whose value is the time since that reset, with transition guards
that are constraints over clocks. That is `state_timeout` (reset on entering the
state) and the generic named timer (reset explicitly) described in a uniform
way. The right reading of note 01 F8 is "the decidability results do not
transfer"; "clocks reset by transitions" is just the correct name for what
`gen_statem` already does.

**F19 — Deterministic tests are bought by injecting a clock, and the required
interface is two functions.** XState's `Clock` is exactly `{ setTimeout,
clearTimeout }`, passed to `createActor(machine, { clock })`, with a
`SimulatedClock` for tests. `@sinonjs/fake-timers` fakes a configurable list
including `setTimeout`, `setInterval`, `Date`, `performance`, `nextTick` and
`hrtime`, and drives them with `tick`/`runAll`. RxJS's `TestScheduler` in
`run()` mode makes one marble frame equal 1 ms of virtual time. [READ, XState
docs and `SimulatedClock` API; sinon fake-timers README; RxJS TestScheduler
docs]

The important line is RxJS's documented limitation: `TestScheduler` only
virtualizes `AsyncScheduler` delays. Code that awaits a Promise, or schedules on
`asap`/`animationFrame`, **cannot be made deterministic by a fake clock**.
[READ, RxJS testing docs]

That is the real constraint on this project: a fake clock buys determinism only
if the library's own execution never crosses a microtask boundary. A synchronous
`send` → transition → effects → observers pipeline (F15) stays testable; an
`async` one does not.

**F20 — Global event order is the guarantee users want until they measure
latency, and Elm's answer was to make the exception syntactically visible.**
Czaplicki and Chong note that previous FRP systems process events "one at a time
in the exact order of occurrence", and that this is what lets a programmer
reason about the system — but that a slow computation then blocks every later
event, which is unacceptable in a GUI. Their `async` annotation marks a subgraph
as not needing to respect the global order; internally the graph is pipelined
with per-edge FIFO queues and `noChange` values so the _semantics_ stays
synchronous while execution overlaps. [READ, Czaplicki and Chong 2013, §1, §3.3]

The design lesson is about notation as much as scheduling: the default is the
strong guarantee, the escape is a single visible keyword, and the escape's scope
is syntactic. Compare `gen_statem`'s `postpone`, which is also a _named outcome_
rather than a hidden policy.

**F21 — Browser input is already batched and frame-aligned, so a library-owned
scheduler is competing with one that already exists and is better
placed.** Since Chrome 60, continuous input events (`wheel`, `mousewheel`,
`touchmove`, `pointermove`, `mousemove`) are delayed and dispatched just
before the `requestAnimationFrame` callback; discrete events (`keydown`,
`mousedown`, `touchstart`) still fire immediately. The full trajectory is
available via `event.getCoalescedEvents()`. Chrome's experiment reported 35%
fewer hit tests.
[READ, Chrome for Developers, "Aligned input events"]

Consequences for an interaction-technique library:

- A pointer machine receives roughly one `pointermove` per frame, not a raw
  device stream. Any internal throttling the library adds is redundant.
- Discrete and continuous inputs arrive on _different_ schedules. A
  `pointerdown` can be delivered before the `pointermove` that preceded it in
  real time was dispatched. A machine that compares wall-clock `Date.now()`
  inside handlers will occasionally compute a negative interval.
- `Event.timeStamp` is a `DOMHighResTimeStamp` on the same origin as
  `performance.now()`, but clamped for fingerprinting resistance — Firefox
  rounds to 2 ms by default and to 100 ms under `resistFingerprinting`. [READ,
  MDN `Event.timeStamp`] So the library should carry the _input's_ timestamp
  rather than sampling a clock, and must not assume sub-millisecond resolution.

**F22 — Fixed-timestep game loops are the wrong analogy for interaction
machines, and the reason is instructive.** Fiedler's argument is that a physics
simulation's behaviour depends on the delta passed in, so a variable timestep
destroys determinism; the fix is an accumulator that runs the simulation in
fixed increments. The known failure is the "spiral of death" when simulation
cost exceeds the frame budget. [ABSTRACT, Fiedler, "Fix Your Timestep!" —
widely-cited practitioner post, not peer-reviewed]

This does not transfer, and saying why is useful: an interaction machine is
**event-driven and idempotent between inputs**, not integrated. There is no
accumulated numerical drift to protect and no reason to run the machine on a
tick. The one idea worth keeping is the diagnosis: _determinism dies when the
step size is an implicit input_. Applied here that means the machine must never
read a clock implicitly; every time-dependent decision must take its time from
an explicit input or an explicit timer.

**F23 — Automatic cancellation is a real mechanism with a documented failure
mode, argued by an RxJS core-team member.** `switchMap` unsubscribes from the
previous inner observable when a new outer value arrives — cancellation by
construction, no tokens. Jamieson's argument is that this is "unsafe for create,
update and delete actions": the silently aborted work may have already had an
effect, so a burst of cart-removal clicks can remove some items on the backend
without reflecting it on the frontend. His recommendation is `concatMap` when
order matters, `mergeMap` when it does not, and `switchMap` only when a stale
result is genuinely worthless. [READ, ncjamieson.com — expert blog, opinion]

Direct application to F10/F11: "cancel this state's effects when the state is
exited" is `switchMap` at the state level and inherits the same critique. It is
correct for a dwell timer and wrong for a network write. **A single global
cancellation policy is not safe; the policy has to be per-effect.**

**F24 — Cancellation as _signal_ does not guarantee cancellation as _fact_.**
`AbortSignal.any()` (Baseline March 2024) composes signals — a scope signal and
a timeout signal — and propagates the reason of whichever aborts first, which is
the right primitive for "cancel when the state exits _or_ after 300 ms". But
`abort()` returns immediately whether or not anything stopped; a listener that
ignores the signal, or a `setInterval` nobody cleared, keeps running. The
structured-concurrency counterposition is that a scope must _await_ its
children's teardown — "A child cannot outlive its parent." [READ, MDN
`AbortSignal.any()`; Frontside blog — vendor opinion, arguing for their own
library]

For a synchronous FSM the practical residue is small but real: if the library
offers state-scoped effect cleanup, exiting a state must run cleanup
synchronously and before entering the next state, or the guarantee is
advertising rather than semantics.

## What real systems actually promise

Answering the brief's first question directly. Order of _commit state / run
effects / notify observers_, and what is guaranteed:

| System       | Commit order                                                          | Reentrant input during a step                                              | Cross-step ordering                                        |
| ------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Esterel      | no intermediate state exists                                          | rejected at compile time (F3)                                              | total, per instant                                         |
| SCXML        | exit → content → entry, per microstep; `<invoke>` after the macrostep | internal queue, drained before any external event                          | internal before external, FIFO within each                 |
| UML          | RTC step is atomic; deferred events re-queued                         | queued; RTC step cannot be interrupted                                     | one event occurrence at a time                             |
| `gen_statem` | state change, then actions in list order                              | `next_event` inserted at the head; `postpone` retried after a state change | zero-time timeouts precede unreceived external events      |
| XState v5    | snapshot → deferred effects → observers, inside the mailbox flush     | enqueued by `Mailbox`, never nested                                        | FIFO; `raise` before external                              |
| Redux        | reducer (isolated) → snapshot listener list → notify                  | **forbidden** in the reducer, **permitted** in a listener                  | nested dispatch runs to completion inside the outer notify |
| RxJS Subject | none specified                                                        | permitted, nested                                                          | none; changed between v6 and v7                            |
| Elm          | `update` is pure; `Cmd`s issued after the model is committed          | impossible (no synchronous dispatch)                                       | no ordering guarantee across `Cmd`s                        |

Where the ordering caused real bugs, with citations: XState `assign`
hoisting and macro-event action arguments (F16); XState eventless-transition
non-termination (F6); Redux nested-dispatch listener staleness, documented by
Redux itself (F13); React/Redux "zombie child" and Relay tearing (F17); RxJS
`BehaviorSubject` emission order (F14); Elm's uncancellable `Process.sleep`
(F12).

## Design moves worth stealing

1. **A twelve-line mailbox.** XState's `Mailbox` (F13/F15) is the whole of
   run-to-completion for a single machine: a linked list, a `_current` guard,
   and a `while` loop. Cost: nothing at the authoring surface — it is invisible
   in machine source. This is the cheapest capability in the entire requirements
   document under the brief's objective function, and it should be taken.

2. **Commit, then effects, then observers — and say so in one sentence.**
   (F15.) Cost: forbids any lazy/interruptible observation later. That is a
   feature (F17).

3. **One input, at most one transition.** (F6.) Refusing eventless/immediate
   transitions is the only way to guarantee a big step terminates, and it also
   removes the Combo-Step Maximality and Order-of-Small-Steps aspects from the
   spec entirely (F5). Cost: chained decisions must be written as ordinary
   control flow inside one handler, which the propositions already do.

4. **Two timer scopes, both owned by the library, named differently.** (F11.)
   `gen_statem`'s split — one cancelled by leaving the state, one that survives
   until explicitly cancelled or restarted by name. Cost: the library owns timer
   lifetimes, which note 08 already flagged; the payoff is that the _common_
   case (dwell) needs no token and the _uncommon_ case (double-click window) is
   still expressible instead of being pushed outside the machine.

5. **A two-function clock injection point.** (F19.) `{ setTimeout, clearTimeout
}`, plus `now` if the machine reads time. Cost: one optional options-bag
   field, invisible in the machine definition. Pays for the entire deterministic
   test story.

6. **Carry the input's timestamp, never sample a clock inside a handler.**
   (F21/F22.) Cost: one field on the delivered input. Removes a whole class of
   ordering bug caused by rAF-aligned dispatch.

7. **Errors as inputs.** (F8.) SCXML converts an evaluation error into an
   internal event. For an interaction machine the analogue is `pointercancel`,
   a rejected promise, or a lost pointer capture: they belong in the input
   vocabulary, at the arrow position, not in a `try`/`catch` around the
   interpreter.

8. **Make the escape from the default ordering a visible word.** (F20, and
   `gen_statem`'s `postpone`.) If deferral is ever offered, it must be a named
   outcome at the fixed target position, not a configuration flag. Cost: one
   more entry in the outcome vocabulary — which the arrow test says is exactly
   where cost is affordable, because it is at a scannable position.

9. **`AbortSignal.any()` for effect scoping.** (F24.) Compose "state exited"
   with "timed out" without inventing a cancellation type. Cost: Baseline March
   2024, so it is a soft platform floor; trivially polyfilled.

## Traps, negative results, and things that failed

- **Constructive causality checking is not available to this project.**
  Undecidable once variables are present (F4). Any ambition to statically reject
  "an observer sends an input that depends on the transition it is inside" is
  dead on arrival; the honest answers are queue (F13) or forbid.

- **UML run-to-completion does not terminate.** It is classified as SYNTACTIC
  big-step maximality precisely because a big step may never reach a stable
  configuration (F6). Adopting "RTC" as a slogan imports that hazard.

- **Note 01 F5 is too strong.** Five of the eight big-step semantic aspects are
  live in a flat machine (F5). Flatness dodges the hierarchy variants, not the
  timing variants.

- **Note 08 F7 over-generalizes from the dwell timer.** State-scoped
  cancellation covers the residency-scoped case only; Erlang ships a
  state-surviving named timer alongside it, and cancellation covers timers but
  not pending async results (F11). Elm shows what happens when the runtime does
  not own timers: the token comes back (F12).

- **Timed automata still do not transfer.** Confirmed against the primary source
  (F18); the value is decidable verification, explicitly out of scope. Only the
  "clock reset on transition" primitive survives, and it is already present
  under another name.

- **Fixed-timestep loops are a false analogy** (F22). No integration, no drift,
  no reason to tick.

- **`switchMap`-style automatic cancellation is unsafe as a global policy**
  (F23). "Cancel the state's effects on exit" is right for timers and wrong for
  writes.

- **`abort()` is a request, not a receipt** (F24). Cleanup must be run
  synchronously by the library or the guarantee is fictional.

- **A fake clock cannot rescue an async pipeline** (F19). RxJS's `TestScheduler`
  documents exactly this limit. If the library ever awaits, its determinism
  story dies with it.

- **"Leave ordering unspecified" is a real, shipped option and it is bad.** RxJS
  survives without RTC, and its emission order surprises users and changed
  between major versions (F14).

## Disagreements and open questions in the literature

- **Whole-instant visibility versus causal ordering.** Esterel and Argos take
  PRESENT IN WHOLE and accept non-causal-but-rejected programs; classical
  statecharts take PRESENT IN REMAINDER and accept unordered handling;
  Statemate/RSML take NEXT COMBO STEP and accept multiple-instance events (F7).
  Forty years on there is no consensus, only a documented trade table. A library
  that never raises internal events avoids picking.

- **Whether reentrancy should be forbidden or queued.** Redux forbids it in the
  reducer on the grounds that dispatch-within-dispatch signals a design error;
  XState and `gen_statem` queue it as normal operation. Both positions are held
  by serious maintainers. The empirical tiebreaker in this domain is that
  interaction code legitimately needs to synthesize inputs (a timer firing, a
  pointer cancel synthesized from a lost capture), so forbidding pushes authors
  into `setTimeout(..., 0)` — the very hack Redux's own troubleshooting page
  discourages.

- **Whether a big step should be able to chain at all.** TAKE ONE guarantees
  termination; TAKE MANY and SYNTACTIC do not (F6). Esmaeilsabzali et al.
  present this as a genuine trade (sequential Or-transitions versus termination)
  rather than a solved question.

- **Whether cancellation should be signalled or structured.** `AbortSignal` is
  the platform answer and is a signal; Trio-style nurseries and Effection argue
  a scope must await teardown (F24). Unresolved in JS; the standards track has
  no structured-concurrency primitive.

## Implications for a typestate FSM library for interaction techniques

**1. Execution semantics is the cheapest capability the project has, and the
brief's objective function should be read as _favouring_ it, not resisting
it.** The `00-evaluation-brief` rule is that a capability must pay for the
ceremony it adds to a small machine. Run-to-completion adds **zero syntax**: a
mailbox, a commit order, and a sentence of documentation. Compare typestate
precision, which costs a declaration site, or effects-as-data, which costs a
command union. The correct triage is the opposite of the requirements document's
ordering: **specify execution, and be stingy about vocabulary.**

**2. The minimum specification is six sentences.** Everything else can be left
out honestly:

1. Inputs are processed one at a time, to completion. An input delivered while
   one is being processed is queued and processed after it.
2. One input causes at most one transition. There are no eventless, immediate or
   automatic transitions, so a step always terminates.
3. Order within a step: the new state and data are committed, then the state's
   exit/entry effects run, then observers are notified. A `send` from an effect
   or an observer is queued (rule 1).
4. Guards and handlers see the data as of the start of the step; effects and
   observers see the data as of the end. (This is the Enabledness and Assignment
   Memory Protocol, F5, answered explicitly — the answer XState needed a flag
   named `predictableActionArguments` to reach, F16.)
5. Timers are owned by the library. A state timer is cancelled when the state is
   left; a named timer survives until cancelled or restarted. Both go through an
   injectable clock.
6. Every input carries the timestamp it was created with; the library never
   samples a clock on its own behalf.

What is **left out**, and can be, without over-promising: internal/external
event queues (rule 2 removes the need), deferral/`postpone`, priority, causality
analysis (undecidable, F4), reachability (note 01 F2), interruptible or
concurrent observation (F17), and any statement about ordering across
independent machines.

**3. The three requirements most likely to be miscosted.** _Deferred events /
`postpone`_: it is a whole queue concept and a second vocabulary word for a case
(`up` and `cancel` handled from every state) that three explicit handlers cover
at this scale. Drop it until an acceptance case forces it. _Immediate/eventless
transitions_: they buy expressiveness by surrendering termination (F6); refuse
them on semantic grounds, as note 01 F5 recommends refusing hierarchy.
_Observation_: notify-after-commit, synchronously, is both the cheapest and the
only one immune to tearing.

**4. The acceptance case needs re-specifying, and note 08 was half right.** The
Marking Menu should specify the _race_ — "the dwell must not fire after the
pointer has left `startup`" — and the library should satisfy it with a
state-scoped timer, removing `timerToken` from the authored machine. But the
case should gain a second timing requirement that a state-scoped timer cannot
satisfy, because otherwise the design will be tuned to the easy half (F11).
A double-click or press-and-hold window spanning `idle → startup → idle` is the
natural candidate and is squarely in the domain.

**5. The effects-as-returned-commands direction carries a specific, named
liability.** XState v4's `predictableActionArguments` bug (F16) is the exact
failure mode of computing a step purely and executing the resulting command list
afterwards: the commands see data from a different moment than the code that
produced them. If the project keeps returned commands — and notes 08 F4 and 01
F1 both argue it should — then rule 4 above is not optional documentation. It is
the thing that prevents this bug.

**6. Nothing in the execution-semantics evidence rescues the propositions'
notation problem, and one thing sharpens it.** Execution semantics is invisible
in source; the arrow test is about what is visible. But there is a connection
worth naming: the reason SCXML, `gen_statem` and Boost.SML can specify ordering
crisply is that the transition's _shape_ is fixed — a tuple, a row, a labelled
target. A handler body that returns `change.x(...)` from arbitrary depth makes
the library's own execution rules harder to state ("the outcome is whatever the
body returned, whenever it returned it") and harder for a reader to check
against them. The arrow test and the ordering spec are the same discipline
applied at two levels.

**7. One place the project's current direction looks wrong.** The requirements
treat timing as an integration concern to be kept outside the kernel. Every
system surveyed that got timing right — `gen_statem`, XState, SCXML — owns the
timer, because cancellation semantics is inseparable from state-change
semantics, and because an injectable clock is the only route to deterministic
tests (F19). Keeping timers outside does not simplify the library; it exports
the hardest problem in the note to every author, and guarantees that every
machine reinvents `timerToken`.
