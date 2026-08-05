# Brief: design typestate FSM API candidates

> **You are the next agent.** Your job is to produce a small number of coherent
> candidate APIs for a TypeScript typestate finite-state-machine library, and to
> show evidence for each. This brief is self-contained enough to start from, and
> links to everything you may need to go deeper.
>
> Read this file, then [the evaluation brief](research/00-evaluation-brief.md)
> and [the research synthesis](research/10-synthesis.md). Everything else is
> reference.

## 1. What the library is

A small, dependency-free, build-step-free ESM TypeScript library for **general
finite state machines with per-state data**. The machines it is sized for are
small — roughly **2-9 control states** and a few dozen transitions.

"Typestate" means: when the current control state is statically known, you get

1. that state's precise state-specific data, and
2. only the capabilities legal from that state,

with exact target-state data checking at the point a transition selects a
target.

### This is a general FSM library, not a gesture library

Interaction-technique development is the **motivating domain** — it is where the
author's need comes from, and it is why the requirements care about timing,
staleness and same-state updates. It is not the subject matter. Any machine of
that size should be natural to write: a document workflow, a request lifecycle,
a connection, a wizard, a media player.

Design against a **neutral machine first.** The previous round used a document
publication FSM for exactly this reason, and it is a good choice — reuse it or
pick your own equivalent. From
[propositions.md](api-brainstorm/propositions.md), "Neutral test machine":

| State       | Data                                  |
| ----------- | ------------------------------------- |
| `empty`     | none; initial                         |
| `draft`     | `{ text, revision }`                  |
| `review`    | `{ text, revision, reviewer }`        |
| `published` | readonly `[text, revision]`; terminal |

It exercises a data-free state, structurally different state data including a
tuple, a guard-like refusal distinct from a same-state commit, one source/input
pair with several possible targets, shared inputs with state-specific
availability, and an intentional terminal state — with no pointers, timers or
resources involved.

**Then apply the acceptance cases as pressure**, not as the design target. The
reduced Marking Menu ([acceptance-cases.md](acceptance-cases.md), Case 1) is
**one** of four cases. It earns its place because it concentrates timing races,
stale-result protection, same-state updates and recursive state data in one
small machine — not because the library is about menus.

The previous round called this discipline out explicitly and it is worth
keeping: if applying the interaction cases changes your machine-definition
vocabulary, you have overfitted. That is the test.

## 2. What you are optimizing for

**Ease of authoring, readability, and DX are the goal.** Capabilities —
typestate precision, effects, timing, queueing, observation — are **constraints
in tension with that goal**, not goals of their own. Every capability must pay
for the ceremony it adds to a _small_ machine.

This inverts a naive reading of [requirements.md](requirements.md). That
document is a priority stack of outcomes, not a mandate to maximise coverage.
The target is not a library that can express every machine; it is a library
whose small machines are obviously right at a glance.

Two amendments to that document, established by research (§5 below):

- **P0.4 is not satisfiable as written** and must be read as Fugue's leak rule:
  state claims attach to immutable snapshots and to focus-scoped handler
  parameters, not to live handles.
- **P0.3's cross-boundary exactness is the least supported requirement** in the
  document. Treat it as opt-in rather than defining.

## 3. The evaluation instrument — design against this

### 3.1 The four state-search questions (primary)

Sunshine, Herbsleb and Aldrich observed professional developers on API-protocol
tasks: **71% of total task time** went to four questions. A controlled follow-up
(ECOOP 2014) measured documentation organised by state against Javadoc at
**10.3 vs 22.4 min on state-search tasks (2.17x, p < 0.001), 7.6x fewer
errors**, with method-first questions still 1.87x faster — an improvement the
authors attribute chiefly to **explicit state transitions**.

|       | Question                        | What answers it                        |
| ----- | ------------------------------- | -------------------------------------- |
| **A** | What abstract state is this in? | narrowing + editor hover               |
| **B** | What can I do in state X?       | capabilities grouped under a state key |
| **C** | In what states can I do Z?      | input names scannable across states    |
| **D** | **How do I get from X to Y?**   | **the target being visible**           |

Score every candidate on all four. **D is the one the previous round failed.**

### 3.2 The arrow test (the sharpest single criterion)

> Can a reader recover **source, input, outcome kind, and target** from _fixed
> syntactic positions_, without reading any body, after Prettier formatting?

The previous round's propositions put source and input at object keys — scannable
down a column — and buried the outcome kind and target inside expressions at
arbitrary depth in handler bodies:

```ts
decide: ({ data, input, change }) =>
	input.verdict === 'approve'
		? change.published([data.text, data.revision])
		: change.draft({ text: input.text, revision: data.revision + 1 }),
```

Answering "where can `review` go?" requires reading every body and unioning the
`change.*` calls mentally. That is the one question a state machine exists to
answer cheaply.

**But the arrow test is necessary, not sufficient.** jssm has literal `A -> B;`
arrows, perfect scannability, _zero_ type knowledge of any state or event name,
53.2 KB gzipped and 4.1K downloads a week. Visibility alone buys nothing.

### 3.3 Ceremony floor

Lines and distinct concepts for the two-state toggle (Case 2). Reference points:
SwingStates ≈ 4 lines per state; the previous propositions ≈ 14 lines total for
a machine whose entire behavior is "flip". Factories measurably slow developers
versus constructors (p = 0.005) — `defineMachine<Model>()({...})` is a factory
returning a factory.

Note the nuance: **compactness and comprehensibility come apart.** Proton++
measured callbacks losing 2.3x on comprehension while being no longer to write.
Spending lines on visible _structure_ is licensed; spending them on
_indirection_ is not.

### 3.4 Edit locality

For each of: add a state, add a transition, add a field to one state's data,
retarget a transition, rename an input — count changed locations and repeated
facts. This is the best instrument in
[acceptance-cases.md](acceptance-cases.md) and should outrank its comprehension
and measurement sections.

## 4. Rival architectures you must beat (or adopt)

**Do not assume a state machine library is the right answer.** Write **both the
neutral machine and Case 1** in each of these as baselines before judging your
own candidates. Using only one of the two will mislead you — see §4.1.

1. **An async generator / un-inverted sequential code.** `mouseDown.switchMap(…)
.takeUntil(mouseUp)`, or a generator that reads `down`, loops on `move`, ends
   on `up`. Drag becomes three sequential steps with **no states named at all**.
   This is the strongest untested competitor and the highest-value thing you can
   do first.
2. **A plain `switch` over a discriminated union.** The real competitor at 2-9
   states, and the one to beat on the neutral machine.
3. **The Radix approach**: one 20-line nested `{state: {event: target}}` lookup
   over `useReducer`, no context, interaction data in refs. Radix and Ariakit
   built the entire accessible widget set — drag included — without machines, at
   69.2M weekly downloads for `react-dialog` alone.

### 4.1 Score the baselines on both machines, and expect them to split

The sequential baseline (1) is strongest exactly where control flow is a
**sequence**: press, then move repeatedly, then release. That is the Marking
Menu's shape, and a win there would be real but narrow. It is weakest where any
state can be re-entered from several others, where the same input means
different things in different states, or where an external input arrives while
the machine is anywhere — which is the neutral machine's shape, and most
business-shaped machines.

The `switch` baseline (2) inverts that profile: fine on the neutral machine,
poor once timing and staleness enter.

**So a win for a baseline on one machine is not a verdict.** Report both. If a
baseline beats every candidate on both, that is the most valuable finding you
could return, and you should return it rather than argue around it.

XState's own author publishes "You don't need a library for state machines". The
"callbacks cause bugs" premise is unsupported: the best empirical study of
client-side JS bugs (317 reports, 12 repos) found 65% DOM-related faults and no
state-management category.

**What justifies existing:** neither XState nor Zag has per-state context, and
**no surveyed library enforces per-state capabilities at the send site.** That
is the gap. Aim at it.

## 5. Measured facts — do not re-derive these

All from [note 06](research/06-typescript-type-engineering.md) (prototypes built
and run on `typescript@5.9.3` and `7.0.2`) and
[note 07](research/07-js-fsm-library-landscape.md) (library type definitions
probed with `tsc`/`node`).

### 5.1 The second declaration site is not forced — but removing it is fragile

A single-declaration-site typestate machine **works**: states, per-state data and
transitions in one object literal, errors landing on the exact offending
sub-expression at exact columns. **No** `const` type parameter, **no**
`NoInfer`, **no** `satisfies`, **no** curried call.

The mechanism: build each state through **helpers passed in as parameters of a
contextually-typed callback**, not through independent generic helper calls.
TypeScript defers context-sensitive properties (`CheckMode.SkipContextSensitive`)
and infers the non-function siblings first. The project's "Attempt 1"
([design-explorations.md](design-explorations.md)) failed because each state was
built by its own `state(...)`/`transition(...)` call, inferred in isolation and
blind to siblings — an _architectural_ mistake recorded as a _compiler_
limitation. **That document still states the false conclusion; do not inherit
it.**

The counterweight: `@cassiozen/useStateMachine` derived per-state types soundly
from a single self-constrained literal, and **TypeScript 5.4 silently broke it**
(circular-constraint error, entry-event narrowing gone, typo'd targets no longer
rejected), unfixed since 2022. Zag v1 went the _opposite_ way, deleting an
inference-based v0 for a hand-written schema with `createMachine<T>` as a pure
identity type boundary. Three teams converged on a curried boundary.

**Conclusion for you:** the single site is achievable and worth pursuing, but it
is load-bearing on compiler behavior that has shifted once already. If you choose
it, say so deliberately and pin a type-regression suite across TypeScript
versions. `defineMachine<M>()(...)` is a workaround for
microsoft/TypeScript#53999 (partial type-argument inference), not a considered
judgement.

### 5.2 The four target encodings, measured

| Encoding                                            | Arrow test | Completions                        | Target error                     | Verdict                              |
| --------------------------------------------------- | ---------- | ---------------------------------- | -------------------------------- | ------------------------------------ |
| (a) checked string argument — `go('armed', {...})`  | passes     | yes                                | TS2345, exact column             | good; best data-error locality       |
| (b) template-literal key — `'press -> armed'`       | passes     | **none**                           | excess-property only, can vanish | **do not use**                       |
| (c) declared return type — `): To<'armed'>`         | passes     | only if the name union is nameable | readable assignability error     | good; multi-target via plain ternary |
| (d) sibling property — `{ to: 'armed', with: ... }` | passes     | yes                                | **TS2820 with did-you-mean**     | best errors                          |

- **(b) fails** because a mapped type over `` `${string} -> ${Names<S>}` ``
  produces _pattern index signatures_: tsserver falls back to global scope and
  offers zero completions, the misspelling check is excess-property-based and is
  suppressed whenever a sibling handler also errors, and types grow
  quadratically.
- **(d) is what Zag v1 independently shipped** — the only surveyed library whose
  target is both fixed-position and statically checked. Its weakness is that a
  multi-target transition needs several entries or a nested union.
- **(c) handles multi-target naturally** with an ordinary ternary while still
  stating the arrows at a fixed position.
- **The Marking Menu's `startup.move` is exactly a multi-target transition**, so
  it discriminates between (c) and (d). A hybrid is unexplored territory.

### 5.3 Other measured constraints

- **No encoding supports rename or go-to-definition.** A floor, not a
  discriminator. Stop optimizing for it.
- **Type-check cost cannot decide anything at this scale**: 20-state machines
  measured 976-1962 types, 4216-7445 instantiations, 0.05-0.06 s. Choose on
  readability and diagnostics.
- **Declaration emit** survives the single-declaration design but breaks three
  ways: TS4023 (a type reachable in the inferred machine type is unexported),
  TS2742 (package layout), TS9010 (`--isolatedDeclarations` categorically cannot
  export an inferred machine — so keep an explicit-model path available as an
  option).
- **Narrowing dies in callbacks.** Narrowing a shared machine object is unsound
  across intervening calls and dead inside closures created after the check
  unless captured in a `const`. Since interaction code lives in callbacks, the
  honest guarantee is **at the declaration site and inside handlers**, not at
  arbitrary observation points.
- **Robot3 does not check its target** (typed as bare `string`; a typo dies at
  `send` with a `TypeError`) and its reducers receive `ctx: unknown`. Inherit
  Robot3's notation, not the assumption that it was carefully typed.
- Measured sizes, min+gzip, whole public API: robot3 1.2 KB, useStateMachine
  1.1 KB, typescript-fsm 1.2 KB, `@zag-js/core` 2.3 KB, xstate v5 12.7 KB,
  kingly 11.9 KB, jssm 53.2 KB.

## 6. Semantic decisions the research already settled

You may treat these as inputs rather than open questions. Depth in
[note 01](research/01-automata-statechart-theory.md),
[note 02](research/02-execution-semantics-and-time.md) and
[note 08](research/08-cross-language-fsm-design.md).

- **Stay flat.** ~20 incompatible statechart semantics exist and the
  hierarchy-dependent disagreements vanish when flat. This is a semantic asset,
  not a limitation.
- **You are building an EFSM**, not an FSM. Reachability, minimization and "this
  guard can never fire" are out of reach for any candidate. Do not imply
  otherwise.
- **The outcome algebra has four members, not three.** Erlang distinguishes
  `keep_state` (same state, new data) from `repeat_state` (same state, _do_
  re-run entry). That is requirement P2.2, answered by two differently named
  return values rather than a flag. Plus `next_state` and a no-transition
  outcome.
- **Effects as returned data** is validated independently by Erlang's action
  list and Tinder's sealed `SideEffect` values. Jacob's PMIW (TOCHI 1999) —
  a self-critique by the author of HCI's 1986 FSM specification language —
  independently published the "effects scoped to state residency" model: each
  state owns a dataflow graph enabled on entry, disabled on exit. **Both sides
  are needed** (Mealy and Moore); the theory says converting one to the other
  costs state splitting.
- **The library should own timers**, against the requirements' current stance.
  Every system that got timing right (`gen_statem`, XState, SCXML) owns the
  timer, and an injectable clock is the only route to deterministic tests.
  Proton++ had to encode a one-third-second dwell as **ten literal touch-move
  symbols at a forced 30 Hz sample rate** — decisive evidence against expressing
  duration in the transition notation.
- **But state-scoped timers do not remove tokens in general.** `gen_statem`
  ships a _named_ timeout that deliberately survives state changes, because
  cross-state windows (double-click, press-and-hold) need it. Elm cannot cancel
  `Process.sleep` at all; React's docs prescribe a closure-scoped `ignore` flag.
  Ownership moves; the problem does not vanish. Case 3's request race still
  needs identity.
- **Execution semantics is the cheapest capability** — it adds _zero_ authoring
  syntax — so specify it completely and be stingy about _vocabulary_ instead.
  Run-to-completion is eight semantic decisions, not one, and five stay live when
  flat. XState v5's commit order (`snapshot → deferred effects → observers`,
  inside a mailbox flush, so a send from an effect or observer is queued and
  never nested) is ~30 lines and copyable. XState v4 shipped a named bug here
  (`predictableActionArguments`) whose cause is exactly the pure-step-plus-
  deferred-commands design — avoid it deliberately.
- **Composition, not hierarchy or shared-state reuse, is the missing axis.**
  SwingStates reports state explosion is a non-issue _within_ one technique and
  appears only when combining techniques; their fix, and ConstraintJS's
  independently, is **parallel small machines with light communication**.
  Requirement P2.9 is the wrong lever. Note that SwingStates' own published
  Marking Menu is _three_ parallel machines (linear menu, marking menu, item
  highlighting), while Case 1 folds recognition, timing and feedback into one —
  flag it if that shapes your design.

## 7. Known-bad — do not propose these

- **A separately declared state-to-data map that behavior merely happens to
  satisfy.** This is why XState removed typestates: "types for typestates needed
  to be manually specified, which is unsound", because a hand-written mapping can
  name a state/context pair the machine can never reach. Per-state data must be
  _derived from or checked against_ what transitions actually produce.
- **Target hidden inside handler bodies** (the previous round's Propositions 1
  and 3). Fails question D.
- **Template-literal keys** (§5.2 (b)).
- **A transition mini-language** whose only purpose is recovering narrowing that
  ordinary `if`/`switch` gives for free. Proposition 2's own weakness list admits
  `match` exists for exactly that.
- **Fluent builder chains** — made event inference order-dependent and spread one
  error through later calls.
- **Hierarchical or parallel states in the core API**, middleware that can
  rewrite a selected transition, an actor/observable runtime, runtime schema
  validation of user data, codegen or a build step.
- **Three notations over one kernel.** Choose one definition interface and derive
  consumption views from it.

## 8. What to deliver

Produce **3-4 coherent candidates**, each showing:

1. The **neutral machine** from §1 and the **toggle** (Case 2), in full, **as
   Prettier formats them** using this repository's pinned config. Review them in
   formatted form — hand alignment is not evidence. These two carry most of the
   readability verdict, because they are where ceremony has nowhere to hide.
2. Then the **reduced Marking Menu** (Case 1) and the **asynchronous request
   race** (Case 3), as pressure on the vocabulary established above. State
   explicitly whether either forced a change to the definition vocabulary; if
   so, that is an overfitting signal, not a feature.
3. The **20-state ring** (Case 4) definition, at least in outline, for
   declaration size and editor feel.
4. A filled-in score on §3: A/B/C/D, arrow test, ceremony floor (line and
   concept count for the toggle), edit locality for the five edits in §3.4.
5. Its answers to §6's semantic decisions, stated explicitly.
6. Its **type strategy** — which encoding from §5.2, single or double
   declaration site, and what it does about §5.3's constraints.
7. An honest weakness list. The previous round's propositions had good ones; keep
   that standard.

Also deliver the **three baselines** from §4, written against **both** the
neutral machine and Case 1, scored the same way. Scoring them only on the
Marking Menu would flatter the sequential ones (§4.1).

### What a breakthrough would look like

An API where the toggle and the neutral machine are within a line or two of the
plain `switch` baseline, any machine's topology is readable without opening a
single handler body, and per-state capabilities are still enforced at the call
site. Nothing surveyed in nine research notes does all three. If you find you
cannot have all three, say which one you traded and why — that is a result too.

## 9. Reference map

**Start here**

- [Evaluation brief](research/00-evaluation-brief.md) — objective function, the
  arrow test, the two dissatisfactions that triggered this round.
- [Research synthesis](research/10-synthesis.md) — 15 findings, verdict on the
  previous propositions, corrections audit table.
- [Research index](research/README.md) — all nine notes, with evidence quality
  per note.

**The research notes**

| Note                                                                                    | Use it for                                                   |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [01 Automata and statechart theory](research/01-automata-statechart-theory.md)          | what formalism you are actually in; what flatness buys       |
| [02 Execution semantics and time](research/02-execution-semantics-and-time.md)          | run-to-completion, queueing, timers, staleness, commit order |
| [03 HCI: state machines for interaction](research/03-hci-interaction-state-machines.md) | SwingStates and InterState in detail; real machine sizes     |
| [04 HCI: critiques and alternatives](research/04-hci-critiques-and-alternatives.md)     | the case against; Proton++ numbers; composition              |
| [05 Typestate and behavioural types](research/05-typestate-and-behavioural-types.md)    | aliasing, Fugue's leak rule, the cost of typestate           |
| [06 TypeScript type engineering](research/06-typescript-type-engineering.md)            | **the measured type facts — read this before writing types** |
| [07 JS/TS library landscape](research/07-js-fsm-library-landscape.md)                   | what every library does, probed; sizes; the gap              |
| [08 Cross-language FSM design](research/08-cross-language-fsm-design.md)                | the arrow-test table; `gen_statem`; Rust typestate           |
| [09 API usability and DX evidence](research/09-api-usability-and-dx-evidence.md)        | A/B/C/D; the scoring rubric; cognitive dimensions            |

**Project documents**

- [requirements.md](requirements.md) — the priority stack. Read §2 of this brief
  first; two requirements are amended.
- [acceptance-cases.md](acceptance-cases.md) — Cases 1-4 and the shared
  evaluation tasks. **Normative** for behavior.
- [api-brainstorm/propositions.md](api-brainstorm/propositions.md) — the previous
  round's three candidates. Read the weakness and prior-work sections; do not
  treat the recommendation as settled.
- [api-brainstorm/findings.md](api-brainstorm/findings.md) — mechanisms worth
  reusing from the brainstorm.
- [design-explorations.md](design-explorations.md) — history of rejected shapes.
  **Its "Attempt 1" conclusion is false**; see §5.1.
- [design-notes.md](design-notes.md) — the current implementation's design.
- `src/totorobot.ts`, `explorations/` — existing code and compiled prototypes.
