# Synthesis: what the research changes

> Read `00-evaluation-brief.md` first for the objective function. This file
> separates **evidence** (from notes 01, 03, 07, 08, 09) from **inference**
> (labelled as such). Coverage is partial — see "What is missing" at the end.

## The six findings that should change the design

**1. The question developers spend their time on is "how do I get from X to
Y?", and the propositions answer it worst.**

Sunshine, Herbsleb and Aldrich observed professional developers on API-protocol
tasks and found 71% of total task time went to four state-search questions
(note 09, F2). Question D is "How do I transition from state X to state Y?" In
a notation where the target is a `change.draft(...)` call at arbitrary depth in
a handler body, D can only be answered by reading every body in the machine.

The arrow-test complaint is not a stylistic preference. It names one of the four
things that consume most of the time in exactly this class of API.

**2. The same paper names the two mechanisms that help, and one of them is the
visible target.**

Its conclusion: separating members by abstract state helps with questions B and
C; a first-class state-change operation helps with D (note 09, F3). A
state-keyed capability map is the first. A named, visible target is the second.
The propositions have the first and gave up the second.

**3. Every mature FSM notation except one puts the target at a fixed position —
including this project's own current API.**

Boost.SML puts it after `=`; SwingStates as the last constructor argument, with
a `>>` marker whose documented purpose is to make targets stand out; Rust
typestate in the function's return type; Robot3 and today's Totorobot at
argument 2 of `transition(...)`; `gen_statem` at tuple position 2 (note 08, F1,
F2, F10). The exception is Tinder's Kotlin DSL, which is structurally almost
identical to Proposition 1 and gets away with it only because its handlers are
one-liners (note 08, F3).

**Inference:** the brainstorm moved the project _backwards_ on this axis. The
current `transition('finish', 'finished', reduce(...))` already passes the arrow
test. Whatever else is wrong with it, that part was right.

> **Refined by note 07, C1/C3 (probed).** Robot3 passes the arrow test but does
> _not_ check the target: `transition(event, state: string, ...)` types it as
> bare `string`, and a typo fails at `send` with a `TypeError`. XState v5 also
> emits no type error for a bad `target:`. Robot3's typing is weak throughout
> (`ctx: unknown`, `ev: unknown`, a polluted `current` union). Inherit Robot3's
> _notation_, not the belief that it was carefully typed. Totorobot's own
> current API does check the target — that part is genuinely this project's,
> not inherited.

**4. TypeScript can have what SwingStates had to give up.**

SwingStates used an unchecked string for the target purely because Java's
initialization order made a direct reference impossible; the authors name it as
their design's one drawback and judge the visibility worth it (note 03, F4).
TypeScript has no such constraint: a string-literal target checks against a
union of state names and drives completion.

> **Corrected by note 06, F14 (measured).** An earlier version of this sentence
> also claimed such a target "participates in rename". It does not. Driving
> tsserver directly: completion inside the quotes works; go-to-definition
> returns `[]`; renaming the state key returns only locations on the declaration
> line, and renaming from the string returns the string itself. `findInStrings`
> matches textually and will rewrite unrelated strings. **No encoding tested
> supports rename**, so navigation is a cost every candidate pays, not a
> discriminator between them.

**Inference:** the best-evaluated FSM toolkit in HCI accepted _unchecked but
visible_ targets. This project has been choosing _checked but invisible_. Both
are available at once, and no surveyed system in any language has that
combination.

**5. Real interaction machines are smaller than the requirements assume, so the
ceremony floor is the main event.**

In the SwingStates teaching benchmark, student implementations of published
interaction techniques — Marking Menu among them — produced machines of 2 to 9
states and 8 to 32 transitions (note 03, F5, F6). The SwingStates authors also
concede that event handlers are _more compact_ than machines for interfaces with
few states (note 03, F8).

At that size a fourteen-line toggle is not a rounding error, and the competitor
is not XState — it is a `switch` and a union type. Two independent measured
results say indirection at construction has a real cost: factories are
significantly slower to use than constructors, p = 0.005 (note 09, F7).
`defineMachine<Model>()({...})` is a factory returning a factory.

**6. XState removed typestates for a reason that partly applies here.**

Verbatim from the v5 changelog: typestate types "needed to be manually
specified, which is unsound because it is possible to specify _impossible_
typestates" (note 07, F1). The propositions are safer than XState — target-bound
constructors check state data at the site that selects the target — but they
still let the model type declare a state whose data no transition can produce
(note 07, F3).

**Inference:** the defect XState hit is the _second declaration site_, which is
also the source of this project's ceremony complaint. One problem, two symptoms.

## Verdict on the three propositions

Scored against the A/B/C/D instrument (note 09) and the objective function:

|                 | A: what state? | B: what can I do here? | C: where can I do Z? | D: how do I get to Y? | Ceremony floor |
| --------------- | -------------- | ---------------------- | -------------------- | --------------------- | -------------- |
| Behavior-first  | good           | **excellent**          | good                 | **bad**               | moderate       |
| Rules as data   | good           | excellent              | good                 | **good**              | worse          |
| Bound graph     | good           | good                   | good                 | good                  | worst          |
| Totorobot today | partial        | good                   | good                 | **good**              | good           |

Behavior-first is the strongest on the axis the propositions were optimized for
(arbitrary logic in ordinary TypeScript) and the weakest on the axis the
evidence says matters most. Rules-as-data recovers D but pays with a
mini-language — its own weakness list admits `match` exists only to recover
narrowing that ordinary control flow gives away for free.

**This is a false dilemma, and it is the most useful thing the research
produced.** Both propositions assume the target must live wherever the decision
logic lives. Nothing in the evidence requires that.

Note 06 then **measured** four separable encodings in TypeScript rather than
reasoning about them. Results, with the earlier speculation corrected:

| Encoding                                                     | Arrow test | Completions                        | Target error                              | Verdict                                         |
| ------------------------------------------------------------ | ---------- | ---------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| (a) checked string argument — `go('armed', {...})`           | passes     | yes                                | TS2345, exact column                      | good; best data-error locality                  |
| (b) template-literal key — `'press -> armed'`                | passes     | **none**                           | excess-property only, can vanish          | **worst**                                       |
| (c) declared return type — `): To<'armed'>`                  | passes     | only if the name union is nameable | readable assignability error              | good; handles multi-target with a plain ternary |
| (d) discriminated edge record — `{ to: 'armed', with: ... }` | passes     | yes                                | **TS2820 with a did-you-mean suggestion** | **best errors**                                 |

- **(b) was my suggestion and it is the weakest.** I proposed re-examining the
  propositions' decision against parseable keys "since template-literal types can
  now check them". Measured: a mapped type over `` `${string} -> ${Names<S>}` ``
  produces _pattern index signatures_, so tsserver falls back to global scope and
  offers **zero** completions inside the quotes; the misspelled-target check is
  excess-property-based and is silently suppressed whenever a sibling handler
  also errors (note 06, F3/F15); and types grow quadratically. Completions return
  only if the input vocabulary is declared separately — reintroducing a second
  declaration site.
- **(d) was not in my list at all**, and it wins on diagnostics: the only
  encoding producing `TS2820: ... Did you mean '"armed"'?`, with completions on
  `to:` and a formatter-stable position immediately after the input key. Its
  weakness is that a multi-target transition needs several entries or a nested
  union — exactly where (c) is strong, since an ordinary ternary works and the
  union still states the arrows at a fixed position.
- **Type-check cost cannot decide between them** at this scale: 20-state machines
  measured 976-1962 types and 4216-7445 instantiations, 0.05-0.06 s (note 06,
  F6). Choose on readability and diagnostics, not performance.
- **No encoding supports rename or go-to-definition.** That is a floor, not a
  differentiator.

None of these was evaluated in the propositions document.

## What the evidence says about the requirements themselves

- **Flatness is a semantic asset, not a limitation** (note 01, F4/F5). Around 20
  incompatible statechart semantics exist, and essentially every disagreement —
  transition priority, inter-level transitions, entry/exit ordering, history —
  presupposes nesting. Refusing hierarchy dodges the entire literature.
- **The project is building an EFSM, not an FSM** (note 01, F2). Reachability,
  minimization and "this guard can never fire" are out of reach for _any_
  candidate. Proposition 1's disclaimer is the correct universal position.
- **`keep_state` versus `repeat_state`** (note 08, F5): Erlang answers P2.2 with
  two differently named return values rather than a flag.
- **The dwell-token bookkeeping is a workaround only for the dwell case** (note
  08, F7, as corrected by note 02). A state-scoped timer removes the token where
  the timer's lifetime coincides with state residency — the Marking Menu dwell.
  It does **not** remove tokens in general: `gen_statem` ships a _named generic
  timeout_ that deliberately survives state changes, because cross-state windows
  (double-click, press-and-hold) cannot be expressed otherwise; Elm cannot
  cancel `Process.sleep` at all and its community answer is a token in the
  message; React's `useEffect` docs prescribe a closure-scoped `ignore` flag.
  Ownership moves; the problem does not vanish. Case 3's request race still
  needs identity.
- **The library should own timers, against the requirements' current stance**
  (note 02, C4). Every system surveyed that got timing right — `gen_statem`,
  XState, SCXML — owns the timer, and an injectable clock is the only route to
  deterministic tests.
- **P0.4 must be rewritten** to Fugue's leak rule (finding 10). As written it
  promises something no available type system can deliver.
- **P0.3's cross-boundary exactness is the most expensive and least supported
  requirement** (finding 9). Consider making it opt-in.
- **Typestate should be sold as productivity, not as defect prevention**
  (Aldrich and Sunshine, PLATEAU 2014). Protocol errors rarely reach production.
- **Documentation outranks elegance** (note 09, F6): 50 respondents cited
  learning resources as an obstacle versus 36 for API structure. Finding 8 says
  documentation organised by state is worth 2.17x on its own — the docs are part
  of the design, not an afterthought.

## 7. The ceremony floor is not forced by TypeScript. Attempt 1 was wrong.

Added after note 06, which built and measured working prototypes rather than
reasoning about the compiler.

A single-declaration-site typestate machine **works**: state names, per-state
data and transitions in one object literal, with errors landing on the exact
offending sub-expression at exact columns. Identical behavior under
`typescript@5.9.3` and `typescript@7.0.2`. It needs **no** `const` type
parameter, **no** `NoInfer`, **no** `satisfies`, and **no** curried call (note
06, F1).

Attempt 1 failed for an _architectural_ reason, not a compiler one. It built
each state through its own generic helper call (`state(...)`, `transition(...)`),
and each such call is inferred in isolation and cannot see its siblings. Passing
the helpers in as parameters of a contextually-typed callback fixes it, because
TypeScript defers context-sensitive properties (`CheckMode.SkipContextSensitive`)
and infers the non-function siblings first (note 06, F2).

**The recorded conclusion in `design-record.md` generalised one specific
mistake into a false claim about object-literal inference, and every proposition
has been paying a two-declaration tax for it since.**

Two caveats that survive: `--isolatedDeclarations` consumers cannot export an
inferred machine at all (TS9010), so an explicit-model path must remain
available as an option; and declaration emit still breaks on unexported
reachable types (TS4023) and package-layout naming (TS2742) — both avoidable by
exporting every type reachable in the machine's inferred type (note 06, F8/F9).

Also worth noting: the `defineMachine<M>()(...)` double call is a workaround for
a known unresolved compiler gap — partial type-argument inference,
microsoft/TypeScript#53999, filed by an XState maintainer — not a considered API
judgement (note 06, F12).

## 8. The arrow test has controlled-experiment support

Note 05 found the evidence I was missing. Sunshine, Herbsleb and Aldrich ran a
**controlled** follow-up (ECOOP 2014) to the observational ICPC 2015 study that
notes 09 and 10 were built on, comparing Plaiddoc — documentation organised by
abstract state, with explicit transitions — against Javadoc:

| Measure                | Javadoc  | Plaiddoc                        |
| ---------------------- | -------- | ------------------------------- |
| State-search tasks     | 22.4 min | **10.3 min** (2.17x, p < 0.001) |
| Errors on those tasks  | baseline | **7.6x fewer**                  |
| Method-first questions | baseline | **1.87x faster**                |
| Non-state tasks        | baseline | no cost                         |

The authors attribute the method-first improvement chiefly to **explicit state
transitions**. That is the arrow test, measured, with an effect size, in a
controlled setting — not merely inferred from the 71% observational figure.

Note that this is a _documentation_ result, not a notation result. Its transfer
to source syntax is an inference. But it is the strongest evidence in this
research round, and it points the same way as notes 03, 08 and 09.

## 9. Typestate has a measured cost, and it falls on open-ended work

The only controlled typestate-versus-mainstream language experiment (Coblenz et
al., Obsidian) **splits**:

- Constrained tasks: Obsidian won — 7/10 vs 2/10 (Auction), 9/10 vs 3/10
  (Prescription).
- Open-ended task: Obsidian **lost** — 64 min vs 37 min, p ≈ 0.02, d ≈ 1.9, and
  0/4 vs 50% correct asset handling.

Typestate helps when the protocol is known and you must obey it; it taxes you
when you are still discovering the design. For a library whose users are
_inventing_ interaction techniques — the open-ended case — this is the most
uncomfortable finding in the round, and it argues for typestate that can be
adopted incrementally rather than as an entry fee.

Sharper still, from the field's own leaders: Aldrich and Sunshine (PLATEAU 2014)
conclude that protocol errors do not often reach production, and that typestate
tooling should target **developer productivity rather than defect-catching**.
The evaluation brief's objective function is thereby endorsed from inside the
literature the requirements lean on.

**And P0.3's cross-boundary precision is the least supported requirement in the
document.** In Coblenz et al., _every_ participant inserted dynamic checks
rather than couple one object's typestate to another's — in a language purpose-
built for that coupling. This lands directly on the dwell-timer case.

## 10. P0.4 constrains the ownership model, not the type system

> **Corrected 2026-08-05.** This finding was first written as "P0.4 is not
> satisfiable as written, in any language available here". That overstates it,
> and P0.4 itself already says so: it permits "immutable snapshots, scoped
> access, opaque handles, or another sound ownership model". If evolution
> returns a **new value**, a narrowed observation can never come to mean
> something else, because later activity produces a different value. The
> requirement is met. What follows is the reason only that family of designs
> meets it.

Note 05, F1-F2. Typestate was sound in Strom and Yemini's 1986 NIL only because
NIL had **no aliases at all**. Every system since buys aliasing back through
linearity, permissions with fractions, or Fugue's leak rule — and Fugue's is the
only one TypeScript can implement: per DeLine and Fähndrich (ECOOP 2004), once
an object leaks, its typestate is essentially frozen.

Brady shows a full-spectrum dependently typed language still type-checking a
double-close on a state-indexed handle until _uniqueness types_ are added.
TypeScript is permanently at that failed attempt.

**Therefore:** a narrowable value must be an immutable snapshot, and evolution
must return a new one. The thing that cannot be made sound is a **live mutable
handle** — one object identity whose state changes underneath a narrowing. That
is a statement about one design, not about the requirement. Note 06, F10 reached
the same conclusion by measurement.

Two properties that must not be conflated: a snapshot narrowed to `S` still
truthfully _describes_ `S` forever, but an operation reached through it may no
longer be legal to apply to a machine that has moved on. P0.4 covers the first
only. Stale authority is a separate problem, solved by tokens or epochs
(finding 15's timer discussion, and note 02).

Fowler (ECOOP 2020) then vindicates the surrounding architecture: directly
embedding linear resources into a GUI is, in his words, a non-starter, and the
prescribed alternative is exactly submission plus stale-message rejection — a
process owns the resource, the UI sends non-linear messages, duplicates are
ignored. The project's `submit()`-plus-token design is principled, not a
workaround.

## 11. Execution semantics is the cheapest capability, so specify it fully

This **inverts** the evaluation brief's triage for one area, and note 02 makes
the case convincingly.

- Run-to-completion is not one decision but **eight** semantic aspects
  (Esmaeilsabzali, Day, Atlee and Niu, Requirements Engineering 15(2), 2010), of
  which at least five stay live in a flat 2-9 state machine.
- Ambiguity here has already shipped as a named bug in the largest JS FSM
  library: XState v4 hoisted `assign` actions and passed custom actions the
  macro-transition's event, fixed behind a flag literally called
  `predictableActionArguments` and made default in v5. The cause — a pure step
  with a deferred command list — is precisely the effects-as-returned-commands
  design the propositions favour, so this is _our_ bug to avoid.
- XState v5's commit order, read from `createActor.ts`, is **snapshot → deferred
  effects → observers**, all inside a mailbox flush, so a send from an effect or
  an observer is queued and never nested. Roughly 30 lines, and copyable.
- The minimum viable specification is six sentences, and **it costs zero
  authoring syntax**.

Under the brief's own logic — capabilities must pay for the ceremony they add —
a capability that adds none should be specified completely. The discipline
belongs on _vocabulary_ (postpone, immediate transitions, priority), not on
semantics.

## 12. The arrow test is necessary, not sufficient

Note 07, F7 supplies the counterexample I needed. **jssm** has literal `A -> B;`
arrows in a template-literal DSL — perfect scannability, the arrow test passed
outright — and it has _zero_ type knowledge of any state or event name, weighs
53.2 KB gzipped, and gets 4.1K downloads a week. Visibility alone buys nothing.

Note 04, F3 gives the strongest numbers in the whole round, from Proton++
(12 experienced programmers, gesture comprehension):

| Notation                   | Task 1   | Task 2  |
| -------------------------- | -------- | ------- |
| iOS callbacks              | 110.99 s | 75.29 s |
| Textual regular expression | 49.25 s  | 35.49 s |
| Graphical tablature        | 23.50 s  | 17.82 s |

F(2,22) = 55.37, p < .001, all pairwise differences significant.

**But half the advantage belongs to the _graphical_ form** (note 04, C6). A
source-only library should expect the ~2.3x expression-versus-callbacks gap, not
the 4.7x headline. This is the same caution as note 03, F13 about InterState,
now with a number attached.

## 13. Removing the second declaration site is possible but fragile

Note 07 is the counterweight to finding 7, and both are measured.

- `@cassiozen/useStateMachine` is the only library that derived per-state types
  soundly from a single self-constrained object literal — and **TypeScript 5.4
  silently broke it**: `TS2313 circular constraint`, entry-event narrowing gone,
  typo'd targets no longer rejected. Unfixed since 2022 (note 07, F3).
- **Zag v1 moved the opposite way**, replacing three generics with one
  hand-written `MachineSchema` and making `createMachine<T>` a pure identity
  function used only as a type boundary. It arrived at the explicit boundary by
  _removing_ an inference-based v0 (note 07, F4).
- Three independent teams converged on a curried type boundary: XState
  `setup()`, Zag `setup<T>()`, and this project's `defineMachine<Model>()(...)`
  (note 07, C2).

**Reconciled with finding 7:** the single declaration site is _achievable_
(note 06 built and measured one) but _load-bearing on compiler behavior that has
already shifted once under a minor release_. The honest position is that the
double call is not forced, and that removing it buys real ergonomics at a real
maintenance risk. That is a trade to make deliberately — with a type-regression
test suite pinned across TypeScript versions — not a defect to be embarrassed
about.

Note also that Zag v1 is **the only surveyed library whose target is both at a
fixed position and statically checked, with a did-you-mean suggestion** (note
07, F4) — i.e. it independently arrived at encoding (d) from finding 3.

## 14. The competitor is not XState. It is no machine at all.

- **Radix ships one 20-line state machine** for its entire primitive set — a
  nested `{state: {event: target}}` lookup over `useReducer`, no context, all
  interaction data in refs — and `react-dialog` alone does 69.2M weekly
  downloads. Radix and Ariakit built the full accessible widget set, drag
  included, with hooks, refs and controlled/uncontrolled props (note 07, F6,
  C4).
- **XState's own author publishes "You don't need a library for state
  machines"**, and Stately shipped `@xstate/store` in 2024 explicitly for cases
  where full machines are overkill (note 07, C5). The ceremony complaint is the
  vendor's position, not a fringe one.
- **The "callbacks cause bugs" premise is unsupported.** The best empirical study
  of client-side JS bugs (317 reports, 12 repositories) found 65% DOM-related
  faults and has _no_ state-management or event-sequencing category. The famous
  "1/3 of the code, 1/2 of the bugs" figure is a 2008 Sean Parent slide, not a
  study (note 04, C5).
- **The real untested competitor is un-inverted sequential code** (note 04, F8):
  `mouseDown.switchMap(...).takeUntil(mouseUp)`, or an async generator that
  reads `down`, then loops on `move`, then `up`. Drag becomes three sequential
  steps with no states named at all.

**This is the most important strategic finding in the round.** The Marking Menu
should be written as an async generator and scored on the same tasks _before_
the API is frozen. If sequential code wins on the primary acceptance case, the
project's premise — not its notation — is what needs revisiting.

The encouraging half, from note 07, F5: neither XState nor Zag has per-state
context, and **no surveyed library enforces per-state capabilities at the send
site**. That is the sharpest available statement of the gap this project fills.

## 15. Composition is the missing axis — and the acceptance case may be wrong

Note 04 relocates the state-explosion argument. The SwingStates authors state
that explosion is _not_ an issue within a single interaction technique and
appears only when **combining** techniques. Their fix, and ConstraintJS's
independently (a radio button as 2x2x4 = 16 states), is **parallel small
machines with light communication — never hierarchy** (note 04, F2).

Consequences:

- `requirements.md` P2.9 ("reuse behavior shared by several states") is the
  wrong axis. Three independent systems converged on machine _composition_, and
  the requirements do not cover it at all (note 04, C3). P2.1 exists but is
  scored as P2 "useful".
- Finding 3 of note 01 (state explosion from Harel's shared-event and
  orthogonality patterns) is half right: the orthogonality half bites, and its
  fix is parallel machines rather than hierarchy (note 04, C2).
- **SwingStates' own published Marking Menu is three parallel machines** —
  linear menu, marking menu, item highlighting. This project's acceptance case
  folds recognition, timing and feedback into one machine, so it may be testing
  the wrong thing (note 04, C4).

Also from note 04: no criticism in this literature is fatal at this scope. The
three genuinely fatal objections — Petri-net markings making "current state" a
token distribution, probabilistic input making it a probability distribution,
continuous-first dynamics making discretisation wrong — all bite at multitouch,
recognition and VR, and none bites a single certain-event pointer with a timer
(note 04, F1).

And two more that support decisions already taken: Proton++ encodes a
one-third-second dwell as **ten literal touch-move symbols at a forced 30 Hz
sample rate** (note 04, F4) — decisive evidence that a state-owned cancellable
timer beats expressing duration in the transition notation. Jacob's PMIW (TOCHI
1999), a self-critique by the author of HCI's 1986 FSM specification language,
already published the "effects scoped to state residency" design: each state
owns a dataflow graph enabled on entry and disabled on exit (note 04, F6).

## What I would do next

0. **Write the Marking Menu as an async generator and score it first** (finding
   14). It is the untested competitor, it costs an afternoon, and if it wins the
   comparison then the notation debate is premature. Nothing else on this list
   matters if this one comes out badly.
1. ~~Re-falsify the "declare the model first" constraint.~~ **Done — note 06.
   It is not forced** — but note 07 shows removing it is fragile (finding 13).
   Decide deliberately, and if the single site is chosen, pin a type-regression
   suite across TypeScript versions. Correct `docs/design-record.md`
   either way; it still records a false conclusion about object-literal
   inference.
2. **Prototype encodings (a), (c) and (d)** against the toggle and the Marking
   Menu, formatted, scored on A/B/C/D plus edit locality. Drop (b). The open
   question is now narrow: (d) has the best errors but needs several entries for
   a multi-target transition; (c) handles multi-target with a plain ternary but
   loses completions unless the state-name union is nameable. The Marking Menu's
   `startup.move` is exactly a multi-target transition, so it discriminates.
   Note that Zag v1 independently shipped (d) (note 07, F4) — read it before
   building.
3. **Re-weight `acceptance-cases.md`.** Its editing tasks are the best
   instrument it has; the evidence says they should outrank the comprehension
   and measurement sections rather than sit beside them.
4. **Decide the timer-ownership question before freezing the Marking Menu case**,
   so the case specifies the race rather than a particular fix for it.
5. **Set expectations on narrowing.** Note 06, F10: narrowing a shared machine
   object is unsound across intervening calls and is dead inside closures created
   after the check unless captured in a `const`. Since interaction code lives in
   callbacks, the honest guarantee is at the declaration site and inside
   handlers — not at arbitrary observation points. P0.4 should be reworded to
   match what is actually deliverable.

## What is missing

**All nine notes are written.** This synthesis has been revised against every
one; where an earlier note disagrees with a later one, the earlier note carries
an inline correction block rather than being silently rewritten.

Corrections applied across the round, for audit:

| Note             | Claim                                               | Overturned by                                                   |
| ---------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| 01, F5           | "every statechart disagreement presupposes nesting" | 02 — five of eight big-step aspects stay live when flat         |
| 03, F8           | callbacks are more compact, so ceremony loses       | 04 — compactness and comprehensibility come apart               |
| 08, F7           | state-scoped timers make `timerToken` unnecessary   | 02 — named timeouts survive state changes; ownership only moves |
| 08, F10          | Robot3 checks its target                            | 07 — typed as bare `string`, fails at `send`                    |
| 09, F1           | "3x, Java Standard Library"                         | 05 — 2.9x (7.2% vs 2.5%), 16-program corpus                     |
| 10, inference 4  | string targets participate in rename                | 06 — no encoding supports rename                                |
| 10, encoding (b) | worth re-examining                                  | 06 — worst of four, measured                                    |

The remaining thin spot is not a topic but a _comparison_: no note scores the
async-generator baseline (finding 14, next step 0). That is now the largest
open question in the round, and it is a prototype task rather than a research
task.
