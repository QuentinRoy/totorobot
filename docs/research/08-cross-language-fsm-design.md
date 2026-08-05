# Cross-language FSM library design: where the target state lives

> Research note. Evidence levels: [READ] full text or substantial part,
> [ABSTRACT] abstract/summary only, [SECONDARY] cited elsewhere.
>
> Scope note: reduced inline pass. Deep on the notation question and on
> `gen_statem`; thinner on Rust crates, C++ Boost.MSM, .NET, Python, and
> codegen tools, which are marked where evidence is weaker.

## Scope and questions asked

For each mature ecosystem: what is the definition notation, **where does the
target state appear**, is it compile-time checked, how is state-specific data
carried, and how are effects and timers expressed?

## Key sources

- [Boost::ext].SML user guide and tutorial,
  <https://boost-ext.github.io/sml/user_guide.html> — [ABSTRACT] via
  documentation summary.
- Tinder/StateMachine (Kotlin and Swift DSL), README,
  <https://github.com/Tinder/StateMachine> — [ABSTRACT] via README examples.
- Erlang/OTP `gen_statem` reference manual,
  <https://www.erlang.org/doc/apps/stdlib/gen_statem.html> — [READ] targeted
  sections.
- Robot3 API documentation, <https://thisrobot.life/api/transition.html> and
  the repository's own README example — [ABSTRACT] plus [READ] of this
  repository's usage.
- Rust typestate pattern: Cliff L. Biffle, "The Typestate Pattern in Rust";
  Duarte and Ravara, "Retrofitting Typestates into Rust" (SBLP 2021) —
  [SECONDARY], not retrieved in this pass.

## The arrow-test table

Where a reader's eye finds `(source, input, outcome, target)`, and whether the
compiler checks the target.

| System              | Source                   | Input                     | Target                                   | Target checked?                 |
| ------------------- | ------------------------ | ------------------------- | ---------------------------------------- | ------------------------------- |
| Boost.SML           | first term of the row    | `+ event<E>`              | after `=`, last term                     | yes, compile time               |
| SwingStates         | enclosing `State` object | transition class + params | last constructor arg, `">> name"` string | no (reflection at first use)    |
| Robot3              | state map key            | `transition(` arg 1       | `transition(` **arg 2**                  | **no** — typed as bare `string` |
| XState              | `states:` key            | `on:` key                 | `target:` property                       | **no** — runtime throw only     |
| Tinder StateMachine | `state<S>` block         | `on<E>` block             | inside `transitionTo(...)` in a lambda   | yes, but at depth               |
| Rust typestate      | `impl Idle` block        | method name               | **the function's return type**           | yes, compile time               |
| `gen_statem`        | callback function name   | function clause head      | tuple position 2 of the return           | no (atoms, dialyzer only)       |
| Totorobot today     | state map key            | `transition(` arg 1       | `transition(` **arg 2**                  | yes, against state union        |
| Propositions 1 & 3  | state map key            | handler key               | `change.X(...)` anywhere in the body     | yes, but invisible              |

## Findings

**F1 — Almost every mature FSM notation puts the target at a fixed position.**
Boost.SML's postfix row is `src_state + event<E> [guard] / action = dst_state`;
the destination is always the term after `=`, and the whole table is validated
at compile time by variadic templates. [ABSTRACT, SML user guide]

**F2 — Rust's typestate pattern puts the target in the function signature.** The
idiomatic form consumes `self` and returns the next state type, so the target is
part of the declared type of the operation:

```rust
impl Startup {
    fn move_far(self, p: Point) -> Expert { /* ... */ }
}
```

A reader recovers the whole topology by reading signatures only, never bodies,
and the compiler enforces it. Ownership transfer also makes stale narrowing
impossible: the old value is moved, so it cannot be observed as the old state
after the transition. [SECONDARY — the pattern is well attested, but the primary
sources were not retrieved in this pass; treat the ergonomic-cost claims below
as unverified.]

**F3 — Tinder's Kotlin DSL is structurally almost identical to Proposition 1,
and it hides the target the same way.**

```kotlin
state<State.Liquid> {
    on<Event.OnVaporized> {
        transitionTo(State.Gas, SideEffect.LogVaporized)
    }
}
```

Source is a block, input is a block, target is inside a call in a lambda. It
mitigates the depth problem only by convention: the lambda is usually a single
`transitionTo` expression, so the target lands on one predictable line. That
mitigation disappears exactly when the handler contains real logic — which is
the Marking Menu case. [ABSTRACT, Tinder README]

**F4 — Tinder returns effects as data.** `transitionTo(State.Gas,
SideEffect.LogVaporized)` names a `SideEffect` value from a sealed class; the
caller interprets it. This is independent evidence for the returned-command
effect model the propositions already favour, from a widely used production
library. [ABSTRACT, Tinder README]

**F5 — `gen_statem` is the strongest available answer to this project's
execution-semantics requirements, and its API shape is a returned tuple.** A
state callback returns `{next_state, NextState, NewData, Actions}` — target at
tuple position 2, new data at 3, and a list of _actions executed in list order_
at 4. Also available: `keep_state`, `keep_state_and_data`, `repeat_state`. That
is precisely the project's `none | update | change` algebra, discovered
independently and shipped for a decade. [READ, gen_statem manual]

Note the vocabulary distinction Erlang draws that the propositions do not:
`keep_state` (same state, new data) versus `repeat_state` (same state, and _do_
re-run the state-enter call). That is exactly the P2.2 "same-state update versus
explicit re-entry" question, answered by two differently named return values.

**F6 — `postpone` is Erlang's battle-tested answer to reentrancy.** An event can
be postponed and is automatically retried after the next _state change_. The
manual explains it by analogy to selective receive: postponing corresponds to
not matching an event in a receive, and changing state corresponds to entering a
new receive. The engine keeps the queue divided into postponed events and events
still to process. [READ, gen_statem manual]

**F7 — `state_timeout` solves the stale-timer problem structurally, not with
tokens.** A state timeout applies to the state the machine enters, and a state
change cancels it automatically. The Marking Menu dwell race — the project's
headline timing case, currently solved with an explicit `timerToken` in state
data and a stale-token guard — is _not a problem at all_ under these semantics:
leaving `startup` cancels the dwell by construction. [READ, gen_statem manual]

This is a significant result. The project's acceptance case bakes in manual
token bookkeeping (`timerToken`, `nextToken`, "stale `dwellElapsed` → no
transition") that a better timer model would make unnecessary. The requirement
(P0.9, "protection from stale timer callbacks") is real; the _token_ is one
implementation of it, and the acceptance case may be encoding the workaround
into the spec.

> **Overstated — corrected by note 02, C2 and C3.** Two errors here.
>
> First, Erlang does **not** conclude that state-scoped timers suffice.
> `gen_statem` ships three timer kinds, and the _named generic timeout_
> explicitly survives state changes — precisely because cross-state windows
> (double-click, press-and-hold spanning states) cannot be expressed by a timer
> the state change cancels.
>
> Second, staleness protection does not disappear when the runtime owns the
> timer; **ownership only moves**. Elm cannot cancel `Process.sleep` at all and
> its community answer is an id carried in the message and ignored in `update` —
> i.e. exactly a `timerToken`. React's own `useEffect` documentation prescribes
> a closure-scoped `ignore` flag. And non-timer staleness — a pending fetch, a
> queued rAF, a settling promise — is outside state-scoped cancellation
> entirely.
>
> The narrower surviving claim: a state-scoped timer removes the token for the
> _dwell_ case specifically, because that timer's lifetime coincides with
> `startup` residency. It does not remove tokens in general, and Case 3's
> request race still needs identity.

**F8 — `gen_statem` guarantees internal events preempt external ones.** Events
inserted via `{next_event, ...}` are queued as the next to process, before
previously queued events; zero-time timeouts are guaranteed to be delivered
before any external event not yet received. Ordering is specified, not
incidental. [READ, gen_statem manual]

**F9 — `gen_statem` offers two callback modes, which is a direct precedent for
the project's proposition split.** `state_functions` dispatches on the state
name (one function per state, co-located behavior — Proposition 1's shape);
`handle_event_function` routes everything through one callback where the state
can be any term (a rules/table shape). Erlang ships both rather than choosing.
[READ, gen_statem manual]

**F10 — Robot3 — this project's own inspiration — already passes the arrow
test.** `transition('finish', 'finished', reduce(...))` puts input at argument 1
and target at argument 2, both at fixed positions, both scannable down a column.
The current Totorobot API in this repository's README inherits exactly that
shape and additionally checks the target against the declared state union.
[READ, robot3 docs and this repository]

> **The checking half is wrong — corrected by note 07, C1 (probed).** Robot3's
> `transition(event, state: string, ...)` types the target as bare `string`. A
> misspelled target produces no type error and fails at `send` time with
> `TypeError: Cannot read properties of undefined (reading 'enter')`. XState v5
> likewise emits no type error for a bad `target:` and only throws at
> `createMachine` time. The row in the table above has been fixed.
>
> Robot3's typing is weak generally: reducers, guards and actions receive
> `ctx: unknown` and `ev: unknown`, and `machine.current` resolves to a union
> polluted with `'enter' | 'final' | 'transitions' | 'immediates'`. **Inherit
> the notation, not the assumption that it was carefully typed.**
>
> The arrow-test claim itself stands — Robot3's target is at a fixed, scannable
> position. Only the "checked" column was false. Totorobot's own current API
> does check the target against its declared state union; Robot3 does not.

**F11 — Therefore the propositions are a regression on this dimension.** The
project started from a notation where source, input and target all sit at fixed
positions, and the brainstorm moved to one where the target is an expression at
arbitrary depth inside a body. Nothing in the propositions document identifies
this as a cost; it is recorded only obliquely, as "runtime topology cannot be
fully recovered from opaque function bodies".

## Design moves worth stealing

1. **Target in the return type annotation** (Rust, F2). In TypeScript:
   `move: (s, input): Change<'expert'> | Update => ...`. Cost: an explicit
   annotation duplicating what the body already implies — but it also fixes
   declaration emit and type-check cost, which inference-captured codomains
   threaten.
2. **Target at a fixed argument position** (Boost.SML, Robot3, F1/F10). Cost:
   one position holds one target, so multi-target decisions must split into
   several rows or move the choice into a guard.
3. **Distinct named returns for keep / repeat / change** (`gen_statem`, F5).
   Cost: none apparent; it is strictly clearer than one `update` that has to
   document whether lifecycle re-runs.
4. **Postpone as a first-class outcome** (`gen_statem`, F6). Cost: introduces a
   queue concept into the pure kernel; probably belongs to the live execution
   layer only.
5. **State-scoped timers cancelled by state change** (`gen_statem`, F7). Cost:
   requires the library to own timer lifetimes, which the project has so far
   tried to keep external.
6. **Effects as returned sealed-class values** (Tinder, F4). Cost: the command
   union must be declared somewhere, adding one more type parameter.
7. **Ship two callback modes rather than picking one** (`gen_statem`, F9). Cost:
   directly contradicts the propositions' "Do not merge all three" advice; two
   modes over one kernel is not the same as three definition notations.

## Traps, negative results, and things that failed

- **Depth-hidden targets are a known, repeated pattern, not an innovation.**
  Tinder ships it; it works because handlers are trivial. It degrades precisely
  where this project's primary case lives.
- **Compile-time transition tables cost compile time.** Boost.SML's table is
  fully checked, and template-heavy C++ metaprogramming is notoriously slow to
  compile. The TypeScript analogue of a fully type-level table is exactly the
  editor-latency risk the project already flags. [ABSTRACT — no measurement
  retrieved; treat as a hypothesis to test, not a finding.]
- **Unchecked target atoms survive in production.** `gen_statem` targets are
  plain atoms with no compile-time check beyond Dialyzer. A decade of use
  suggests visibility matters more than checking — though Erlang's culture of
  supervision and crash-fast recovery makes this a weak transfer.

## Disagreements and open questions

- Whether a return-type annotation (Rust-style) is acceptable ceremony in
  TypeScript, or whether it re-introduces the double-declaration the project is
  already unhappy about. It differs from the propositions' model type in one
  important way: it is _local to the transition_, not a machine-wide second
  declaration.
- Whether state-owned timers (F7) belong in the kernel, the live execution, or
  outside — and whether adopting them would simplify the Marking Menu case
  enough to justify the ownership.

## Implications for a typestate FSM library for interaction techniques

1. **The arrow test is the ecosystem norm, not a preference.** Six of eight
   surveyed systems put the target at a fixed position or in a signature. The
   two that do not (Tinder, Propositions 1 and 3) rely on handlers staying
   trivial.
2. **TypeScript has a move Java, Erlang and Kotlin lack**: a target that is both
   at a fixed position _and_ statically checked — either as a literal argument
   checked against the state union, or as a return-type annotation. Neither
   SwingStates nor `gen_statem` could have both. The project can.
3. **The project already had this and gave it up.** Reverting to a
   fixed-position target is not a new invention; it is restoring `transition(
input, target, ...)` and then solving the harder problem — per-state data and
   exact target-data checking — on top of it.
4. **Erlang's `state_timeout` questions the acceptance case.** Before treating
   `timerToken` bookkeeping as a requirement, decide whether it is a requirement
   or a symptom of not owning timers.
