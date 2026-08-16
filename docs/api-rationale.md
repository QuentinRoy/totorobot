# How the API got here

> The design is in [api.md](api.md). This document is the reasoning behind it:
> what was explored, in what order, what was rejected, and on what evidence.
>
> It replaces eighteen working documents (`api-candidates`, `api-notations`,
> `api-self-transitions`, `api-async`, `api-actions`, `api-propositions`, and the
> rest) and `design-explorations.md`. They are in git history if the long form
> is ever needed; nothing load-bearing from them was dropped.
>
> Prior-art research is separate and still current: [`research/`](research/),
> ten notes on automata theory, execution semantics, HCI state machines,
> typestate, TypeScript type engineering, and the JS FSM landscape.

## Contents

1. [The decision ledger](#1-the-decision-ledger)
2. [Generation 1 — Robot3, and what typestate cost](#2-generation-1--robot3-and-what-typestate-cost)
3. [The reset — how anything got measured](#3-the-reset--how-anything-got-measured)
4. [Round 1 — encodings, and the multi-target test](#4-round-1--encodings-and-the-multi-target-test)
5. [Round 2 — notations](#5-round-2--notations)
6. [Round 3 — layout](#6-round-3--layout)
7. [The declared vocabulary](#7-the-declared-vocabulary)
8. [Self-transitions — ten propositions and a collapse](#8-self-transitions--ten-propositions-and-a-collapse)
9. [Effects, round 1 — async](#9-effects-round-1--async)
10. [Effects, round 2 — composition](#10-effects-round-2--composition)
11. [Effects, round 3 — the effect-free core, and why it fell](#11-effects-round-3--the-effect-free-core-and-why-it-fell)
12. [Actions — the concern argument](#12-actions--the-concern-argument)
13. [Reusable type-system findings](#13-reusable-type-system-findings)
14. [The graveyard](#14-the-graveyard)
15. [Sending inputs](#15-sending-inputs)
16. [Definition and instance — open](#16-definition-and-instance--open)

---

## 1. The decision ledger

Twelve axes were tracked. Eleven are closed.

| #   | Axis                       | Answer                                                      | §   |
| --- | -------------------------- | ----------------------------------------------------------- | --- |
| 1   | Overall layout             | string keys — `'submit: draft -> review'`; two rivals alive | 6   |
| 2   | Data-free states           | `void` in the declared vocabulary                           | 7   |
| 3   | Entry / exit actions       | edge patterns with one end pinned; no keyword               | 12  |
| 4   | Re-entry vs stay           | dissolved — it is an action's restart policy                | 12  |
| 5   | Self-transition spelling   | `'revise: draft -> draft'`, an ordinary row                 | 7   |
| 6   | Input vocabulary           | declared: `types<{ inputs, states }>()`                     | 7   |
| 7   | Returned commands (`emit`) | out — a listener recovers it from the transition            | 9   |
| 8   | Fall-through refusal       | no `else`; dev-mode warning                                 | 4   |
| 9   | Async / work-in-flight     | subsumed by axis 10                                         | 11  |
| 10  | Actions in the machine     | `actions:`, keyed by trigger, wrappers for policy           | 12  |
| 11  | The word for what you send | `inputs`, not `events` — the core is not a mailbox          | 7   |
| 12  | Typed send site            | **dropped** — broad `send` only; reversible later           | 15  |

Two things about this table are worth knowing before reading further.

**Axes closed each other.** Declaring the vocabulary (§7) shut 2, 5 and 6 in one
move. Removing entry/exit shut 3, which made 4 and 5 unobservable and therefore
moot. When actions came back (§12), 3 reopened by definition and 4 and 5 had to
be re-answered — from a different direction, and to a better answer.

**Axis 1 reopened once**, late, because two propositions arrived after it had
been decided and both beat the incumbent. That is the reason for the three live
notations rather than one.

---

## 2. Generation 1 — Robot3, and what typestate cost

The project started as a wrapper over [Robot3](https://thisrobot.life/), whose
compact functional vocabulary is still the aesthetic reference. Reading its
declarations against two real machines (a traffic light, an async auth flow)
exposed five gaps between what the types appeared to guarantee and what they
checked:

- **Modifier generics were not tied to the machine.** Each `reduce`, `guard` or
  `action` call was independently generic, so a wrong context annotation inside
  one compiled.
- **Event payloads were effectively untyped.** `send` checked `type`; everything
  else came through an `[key: string]: any` index signature. `send({ type:
'login', username: 42 })` compiled and failed at runtime.
- **`send` was not state-specific.** Accepted events were the union across the
  whole machine; sending one the current state did not handle compiled and
  silently did nothing.
- **Invocation wrappers were invisible.** A resolved promise arriving as
  `{ type: 'done', data }` was not described by the signature.
- **Context and state could not narrow together.** One flat context plus a state
  key. Narrowing to `'authenticated'` did not narrow a nullable `token`.

These are reasonable trades for a 1.2 KB dependency-free library. The question
this project asked instead was: **what can the types guarantee if typestate takes
priority?**

Three prototypes answered it, and all three are in `src/`'s ancestry:

1. **Infer states from the map.** Worked, but errors appeared machine-wide rather
   than at the offending expression, and `send` still could not narrow.
2. **A Kysely-inspired fluent builder.** Payload inference became
   order-dependent and errors cascaded through the chain.
3. **Declare the spec first** — `defineMachine<Spec>().create(…)`. Shipped. It is
   what `src/totorobot.ts` and [design-notes.md](design-notes.md) describe.

That produced three constraints which still hold:

1. Target context must be known before a reducer is checked.
2. Event payload meaning must not depend on declaration order.
3. Errors should stay local, not propagate through a machine-wide validator or a
   fluent type accumulator.

**And one conclusion that turned out to be false**, which matters because it was
inherited into every later design: that a single declaration site necessarily
produces remote errors, so a separate model type is required. Measured on
TS 5.9.3 and 7.0.2, a single-declaration-site typestate machine works — states,
per-state data and transitions in one object literal, errors on the exact
sub-expression, with no `const` type parameter, no `NoInfer`, no `satisfies` and
no curried call.

What actually went wrong in prototype 1 was **architectural**: it built each
state through its own generic helper call, and each such call is inferred in
isolation and cannot see its siblings. Passing the helpers as parameters of a
**single contextually-typed callback for the whole machine** makes TypeScript
defer context-sensitive properties and infer the non-function siblings first, so
target data is known by the time a reducer body is checked. The information did
not arrive too late; it arrived too late _for that arrangement of calls_.

Two caveats kept on record: removing the second declaration site is fragile
(`@cassiozen/useStateMachine` did it soundly and was silently broken by
TypeScript 5.4; Zag v1 deliberately moved the other way, back to a hand-written
schema), and `--isolatedDeclarations` consumers cannot export an inferred machine
at all (TS9010).

## 3. The reset — how anything got measured

Everything after generation 1 was judged against fixed instruments, which is the
only reason the rounds below produce conclusions rather than preferences.

**The four search questions** (Sunshine, Herbsleb & Aldrich — how people actually
read state machines). Every notation is scored on all four:

- **A** — what state is this in?
- **B** — what can I do in state X? _(the research says this one dominates)_
- **C** — in what states can I do Z?
- **D** — how do I get from X to Y?

**The arrow test.** Can a reader recover all four coordinates of a transition —
source, input, outcome kind, target — from fixed positions, after Prettier has
had its way? Several notations pass only by cheating; the qualifier is always
recorded.

**The neutral machine.** A publication flow — `empty → draft → review →
published` — chosen because it contains the three things that separate notations:
a conditional refusal (`revise` with unchanged text), a **multi-target**
transition (`submit` reaching either `review` or `published`), and a plain edge.

**Acceptance cases**, pinned in [acceptance-cases.md](acceptance-cases.md): a
Marking Menu (Case 1, the overfitting test), the toggle (Case 2, the ceremony
floor), a request race (Case 3), a 20-state ring (Case 4, the scaling test).

**Three rival baselines**, built and executed, to establish the honest bar:

|                  | toggle          | neutral | Case 1 | A         | B    | C       | D             | arrow         |
| ---------------- | --------------- | ------- | ------ | --------- | ---- | ------- | ------------- | ------------- |
| `switch` + union | 17 / 6 concepts | 98      | 208    | excellent | good | partial | partial       | partial       |
| radix lookup     | **3 / 3**       | 93      | 103    | good      | good | good    | **excellent** | **excellent** |
| sequential       | 12 / 6          | 62      | 66     | bad       | good | bad     | bad           | bad           |

Two results from the baselines shaped everything after:

- **The radix table's win is bought by deleting the problem.** Its 16-line neutral
  machine reads like a diagram only because `submit` was split into
  `submitToReview`/`submitToPublish` and `decide` into `approve`/`reject`. A
  lookup holds one target per `(state, input)` pair, so the multi-target rows were
  renamed out of existence and the choice pushed to every caller. It also has no
  per-state data and `send` accepts every input from every state with **no
  diagnostic whatsoever**. The honest bar became: _match that scannability while
  still expressing `submit` and `decide` as specified._
- **`switch` is harder to beat than expected.** Its real advantage is zero
  library-specific concepts, and it already produces `TS2820` did-you-mean errors
  on a bad target. A candidate can only match it there, not beat it. It loses on
  the arrow test (outcome kind has no syntax at all), on send-site capabilities,
  and on one dangerous blind spot: an input added to the union and handled
  nowhere produces zero diagnostics, because `default: return state` is
  simultaneously real behaviour and a silent catch-all.

A breadth-first multi-agent brainstorm ran before the candidate rounds. It did
not produce an API, and its useful output was a set of mechanisms rather than a
design — chiefly: **effects often belong to state residency**; transition results
need an explicit algebra (no transition / same-state update / state change);
staleness is an authority problem; definition and consumption can use different
views. The first of those is the conclusion §12 arrived at independently, three
rounds later.

## 4. Round 1 — encodings, and the multi-target test

The headline: **multi-target transitions are the discriminating test, and they
are harder than anyone assumed.** Every approach in the round either failed them
outright or paid for them somewhere else.

**Notation A — edge records** (`{ to, with }`, `c1-edge-records`). Two
independent, separately measured compiler blockers:

- A guarded-clause list makes the edge type `Outcome | readonly Outcome[]`, and
  **a union of an object type with an array of that object type makes every bare
  object edge in the whole machine lose its handler parameter types** — 3×
  `TS7031`, bisected in `blocker.ts`. Supplying the type arguments explicitly
  changes nothing, so a second declaration site does not buy its way out.
- **A guard does not narrow its own clause's projection.** `when` and `with` are
  separate callbacks, so a refinement established in the guard does not reach the
  data projection: `Property 'reviewer' does not exist on type 'Submit'`. Not
  avoidable inside the encoding — the guard and the projection cannot become one
  function without putting the decision back in a body, which is exactly what the
  encoding exists to prevent.

To compile at all, its neutral machine had to split `submit` and `decide` into
four invented input names — **the same capitulation radix was forced into**.
Counted honestly, it does not express the neutral machine.

**Notation C — declared target set as a value.** Negative evidence, kept as a
directory that intentionally does not compile.

**Notation B — annotated outcome** (`c2-annotated-outcome`) survived and got the
full scorecard: toggle 8 lines, neutral 60, Case 1 135, Case 3 87, Case 4 178.
Send-site capabilities verified. Type cost at 20 states: 1 867 types / 6 109
instantiations / 0.004 s. Its multi-target ternary is **total**, so "every branch
skipped by mistake" is a compile error rather than a silent refusal — a real
safety property that no later winner has.

It lost anyway, on the objection that started the next round: **the target lives
in a type annotation**, `): To<'review' | 'published'> =>`. Reading it means
switching into type-reading mode, completions inside `To<'…'>` require the
state-name union to be nameable (it is not, in general), and the target is stated
twice — once in the annotation, once in `at.review(…)`.

**One correction from this round, worth keeping:** `TS2820`'s did-you-mean
suggestion is conditional on name length. `to: 'armd'` gets the suggestion;
`to: 'onn'` gets a plain `TS2322`. Short state names — common in small machines,
which is the stated target — do not get it. The diagnostic advantage credited to
edge records was narrower than recorded.

**And one rejected fix, recorded because it was briefly "the important one":**
an explicit `else: 'decline' | 'unreachable'` key to make fall-through visible.
Dropped — `else: 'unreachable'` throws at _runtime_, so it costs a line on every
multi-branch edge and buys no static guarantee. It relocates the symptom. A
dev-mode warning fires at exactly the same moment for no API surface. That is
axis 8.

## 5. Round 2 — notations

Three that worked, trading different things:

|                                 | B: annotated     | D: target keys      | E: by destination                                  |
| ------------------------------- | ---------------- | ------------------- | -------------------------------------------------- |
| neutral machine                 | 60               | 70                  | 83                                                 |
| **B** what can I do in state X? | one block        | one block           | **scattered** — grep every state's `from` for `X:` |
| **D** how do I get to Y?        | scan annotations | scan target keys    | **the index** — read Y's `from`                    |
| target appears as               | a **type**       | a **key**           | the **enclosing state**                            |
| the deciding condition          | written **once** | once **per branch** | once **per entrance**                              |

**D (target keys) won the round.** The target is a key, so it completes, renames
and greps; the handler just returns that target's data, with no wrapper, because
the enclosing key already said where this goes. It is the `{ to, with }` shape
generalised to multi-target with no annotation anywhere.

It cost 10 lines and one safety property against B: with the decision split
across branches, if every branch skips by mistake the machine silently refuses,
where B's ternary makes the same slip a compile error.

**E (by destination) dissolves multi-target instead of solving it** — every
entrance has exactly one target, the enclosing key, so a target _set_ never
exists anywhere. Question D stops being a search and becomes an index. The price
is the exact transpose: question B now requires reading every state's `from`
block, and B is the question the research says dominates. Retired as a layout,
but its idea was stolen: the reverse index is recoverable from any source-keyed
layout **as a derived type** (`Sources<M, To>`, `Targets<M, From, On>`), which E's
own `lib.ts` demonstrated. So the choice was never "which question do I want to
be cheap" — keep the layout that makes B a single block, and _derive_ the rest.

Also settled here, on measurement rather than argument: **a data-free state
declares nothing at all.** No `nothing` placeholder. What made that safe is in
`d1-target-keys/check.ts` — omitting an inference site normally makes TypeScript
discard the _entire_ inferred state map, and the fix was to widen the constraint
and move the "no data" default into `DataOf`.

## 6. Round 3 — layout

Four more propositions arrived after D had won, and two of them beat it. This is
why axis 1 reopened.

**F — the transition table** (robot3-flavoured, `state(on('submit', 'review', fn))`).
Every transition one row, four coordinates in fixed positional slots. Its
advantages were real — line-order priority instead of key-order, `keep`/`repeat`
stop being reserved names, edges become values that factor — but two of the three
were available in D for free (spread factors edges; line order and key order are
the same order), and its crux was unverified: the handler's `ctx` needs the data
map _and_ the source state, neither of which is an argument to `on(…)`, so they
can only arrive through two levels of generic-call inference. **Every notation
that failed in this project failed at exactly that step.** Not built.

**M — combinator edges** (`submit: [goTo('review', fn), goTo('published', fn)]`).
Its deepest property is a genuine answer rather than a workaround: every previous
technique fought over **key space** (`keep`/`repeat` took two words from the
author, symbols dodged collision but broke declaration order, `&` dodged it with
punctuation), and combinators move the outcome vocabulary into **value space**,
where it cannot collide with state names by construction.

It died on one argument: **`goTo` is a verb with no antonym.** Once re-entry
collapsed into ordinary transition (§8), the outcome vocabulary has exactly one
verb, and a one-word vocabulary carries no information — so writing it on every
edge is pure repetition of what the key position already said. `toggle: 'on'`
becoming `toggle: goTo('on')` is a per-edge tax for the life of the project.
Combinators earn their keep when there are several verbs to distinguish; there
are not. **M becomes right again if the vocabulary ever grows back.**

**N — string keys** (`'submit: draft -> review': fn`, built as `n1` then `n2`)
and **O — classic records** (`{ event, from, to, with }`, built as `o1`) both
compile, both express the neutral machine, both pass their traces.

|                               | target keys     | string keys        | classic records      |
| ----------------------------- | --------------- | ------------------ | -------------------- |
| neutral machine, transitions  | 77 (whole file) | **41**             | 59                   |
| all 4 coordinates on one line | no              | **yes**            | no (Prettier)        |
| question B                    | **one block**   | grep `: draft ->`  | grep `from:`         |
| questions C / D by grep       | scan keys       | **yes, all three** | yes                  |
| reverse index                 | derivable       | **free**           | **free**             |
| completions                   | per key         | key union          | **additive**         |
| instantiations @ 20 states    | —               | **14 864**         | 98 398 (6.6×)        |
| extensible (priority, labels) | no              | no                 | **yes, add a field** |

**String keys won.** It is the shortest, the only notation where all four
coordinates sit on one line at fixed positions, and the only one where all three
topology questions are a plain text search. `'submit: draft -> review'` is not
four coordinates recovered from four positions in a nested structure — it is a
sentence with an actual arrow in it, and no formatter can reflow the inside of a
string literal. Several problems also simply stop arising: self-transitions need
no spelling, two targets for one input are two rows so there is no duplicate-key
question, and declaration order is visibly the priority order.

**A correction to how risk had been judged, recorded because it unblocked this.**
F and M were rejected partly because the handler's context has to arrive through
a standalone generic call. That objection does _not_ apply to string keys:
`{ [K in keyof T]: Handler<Parse<K>> }` is a homomorphic mapped type over the
keys of an inferred object — structurally the same mechanism target keys already
used and that was verified to work. The keys happen to be compound strings, and
`Parse<K>` recovers the coordinates with template-literal inference. The risk was
**DX, not feasibility**, which is a different and more tractable kind of problem.

**What string keys cost, honestly.** Question B stops being co-located —
`draft`'s outgoing edges are greppable but no longer contiguous unless the author
keeps them together, and a flat table optimises the global view over the local
one that the research says dominates. Whitespace tolerance costs the grep story:
`->published` will not match `-> published`, and no formatter can normalise
inside a literal. And the completions dilemma is real — an explicit template
literal type gives segment-by-segment completions but expands to
|inputs| × |states|², fine at 80 members and ugly at Case 4's ~4 000; an inferred
plain string scales but offers no completions at all.

**Why the other two stay alive.** Target keys remains the choice if co-location
matters more — it is the only live notation where a state's data and its outgoing
edges are one block. Classic records remains the choice if the table must be
extensible: priority, labels and metadata are just more fields, and nothing needs
explaining to anyone who has ever seen an FSM. It costs 6.6× the instantiations
and the arrow test.

**One non-stylistic piece of evidence for records** turned up much later, in §12:
a `do:` slot on an edge is absorbed by a record as one more field, while string
keys and target keys grow a second value shape to hold it.

## 7. The declared vocabulary

```ts
types: types<{
	inputs: { submit: Submit; cancel: void }
	states: { empty: void; draft: { text: string; revision: number } }
}>()
```

Orthogonal to layout — it lands on any of the three — and it closed three axes at
once, plus two silent holes.

- **Axis 6, input vocabulary.** The question was "keep `inputs:` or drop it, and
  annotate the payload where it is used". The third option won: declare both maps
  together, as an ordinary named type that can be exported, imported, generated
  or composed.
- **Axis 2, data-free states.** `empty: void`. Not `data: nothing`, not
  `state()` — the actual type.
- **Axis 5, self-transitions.** With axis 4 already deleted, a self-transition is
  just a transition whose target is its source.

**The two holes it closed are the real argument.**

_The `any` leak._ `state<T = void>()` puts the marker call in a position
contextually typed by the unresolved state map, so `T` inferred as `any` — every
data-free state silently accepted anything, and every payload-free input accepted
any payload. A written `void` has **nothing to infer**. The bug is not fixed;
it is unrepresentable.

_The state-name inference cliff._ When every state was data-free and every
handler a closure, `keyof S` collapsed to `string` and target names stopped being
checked — needing a compile-time guard whose error message was the fix. Names are
now declared, so they cannot be recovered wrongly. `n2/check.ts` runs the exact
machine that broke `d1`, and it infers correctly with no guard in the library at
all.

Both are covered by `@ts-expect-error` cases, so a regression fails the build.
Declaring is also cheaper — 14 864 instantiations against 20 103 inferred, ~26%
— though that is small and not the reason.

**Costs**, all recorded at the time: states have no runtime existence (`types<>`
erases to `{}`, so a visualiser or a runtime exhaustiveness check has no source,
and a state with no transitions disappears entirely); state names appear in the
type and again in every transition key with nothing but the checker tying them;
and hover text inlines the whole literal unless the type is named, which is why
`types<Publication>()` is the documented idiom.

**The alternative shape** — `machine<Publication>()({ … })` — removes the `types:`
property but needs the double call, because TypeScript has no partial
type-argument inference (microsoft/TypeScript#53999). `()()` reads worse than one
extra property.

### `inputs`, not `events`

The block is called `inputs`, which is the **minority word in JavaScript** and
the majority word in the formal literature. Prior art splits cleanly along that
line, and the split is not arbitrary — the two words carry different semantics.

| lineage                                   | word         | what it implies                                       |
| ----------------------------------------- | ------------ | ----------------------------------------------------- |
| automata theory (Hopcroft–Ullman, Sipser) | **input**    | a symbol from an alphabet Σ, consumed by δ: Q × Σ → Q |
| Mealy / Moore                             | **input**    | paired with **output**; the machine is a transducer   |
| synchronous languages (Lustre, Esterel)   | input/signal | a value present on a wire this instant                |
| Harel statecharts, UML, SCXML             | **event**    | an occurrence, broadcast, queued, run-to-completion   |
| Erlang `gen_statem`                       | **event**    | tagged by arrival kind: cast, call, info, timeout     |
| XState, robot3, Zag, `useStateMachine`    | **event**    | an object with a `type`, sent to a mailbox            |
| Elm                                       | **message**  | `update : Msg -> Model -> (Model, Cmd Msg)`           |
| Redux                                     | **action**   | a dispatched description of what happened             |

So there are four candidate words, and two of them are unavailable here before
the argument even starts: `action` is taken by the block that says what runs, and
`message` implies a sender and a recipient that this design does not have.

**An argument that does not survive contact, recorded because it was made.** The
first draft claimed the decisive reason was `.on()`: a listener observes a
committed transition, so calling the things you send "events" would make one word
name both directions. That is much weaker than it sounded, because **plenty of
libraries have both directions and manage**, by one of three strategies:

- **One word, because it is one thing.** The DOM dispatches an `Event` and
  listens for the same `Event`; Elm sends a `Msg` and its subscriptions
  _produce_ `Msg`. No confusion, because nothing is being distinguished.
- **The subscription delivers state, not events.** XState's `subscribe` yields
  snapshots, robot3's `onChange` yields the service, Redux's subscriber takes no
  argument at all. "Event" then only ever means input.
- **Qualify when both exist.** XState v5 has events sent _in_ and, since `emit`,
  events sent _out_ — and calls both events, distinguished by the verb.

Our case is a fourth thing rather than a harder version of theirs: `.on()`
delivers neither an input nor a state but a **transition record**,
`{ on, input, from, to }`. Which means the collision is fixable from the other
end — name the observable a transition and `event` is free. So `.on()` is a
convenience for `input`, not a reason.

**What does hold up:**

- **The core is not a mailbox.** `step()` is a pure `(state, input) -> state`
  function, and the host is optional. "Event" is the word from the statechart
  lineage, where it comes bundled with a queue, broadcast, and run-to-completion
  semantics that this core deliberately does not have (§3, and the variant
  problem in research note 01). Using it would promise semantics that are not
  there.
- **Capabilities read as an interface.** The headline feature is that a state
  exposes only what it handles: `at.submit(…)`. That is something you are
  _permitted to do_. An event is something that _happens to you_ — you do not
  ask an object for its available events and then call one. Under `input`,
  `capabilities(m, v)` is an interface; under `event` it is a category error
  wearing a method call.

**What it costs**, and this is real: every JS reader arrives knowing "event", so
`inputs:` is one translation on first contact, against P1.1 (minimize conceptual
learning cost). **Worse, `input` is not unclaimed** — XState v5 uses it for
something else entirely, the parameters passed to an actor when it is spawned
(`createActor(machine, { input })`). So the word collides across libraries in
exactly the population most likely to read this one. That is a genuine cost of
`input`, not a point in its favour, and it is the strongest case for `message`
as a third way. And a few members of the vocabulary genuinely are events —
`loaded` and `timeout` arrive on their own from an action's `send`, and calling a
timer firing an "input" is a small stretch. The counter is that the vocabulary
_mixes_ kinds: `submit` and `cancel` are commands, `loaded` and `failed` are
notifications. A neutral word beats one that biases toward either, and "input" is
the neutral one — it names the _slot in the transition function_, not the
provenance of what fills it.

Note this is a naming decision only. Nothing about the shape changes: the keys
are `'submit: draft -> review'` either way, and the context member is `input`
rather than `event`.

## 8. Self-transitions — ten propositions and a collapse

When a transition targets the state you are already in, does residency re-run?
Ten spellings were proposed across two rounds:

| ID  | Mechanism                                                | Fate                                                                                                                                             |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1  | reserved keys `keep` / `repeat`                          | takes two words from the author's namespace                                                                                                      |
| T2  | symbol keys `[keep]`                                     | collision-proof, but **breaks branch priority** — `Reflect.ownKeys` returns string keys first, so a `[keep]` branch written first runs last      |
| T3  | self-name only                                           | cannot express the distinction at all                                                                                                            |
| T4  | distinction in return position, `repeat({…})`            | moves it out of key position into a body                                                                                                         |
| T5  | `&` as self-reference                                    | recommended at the time; four outcomes, zero reserved words; only key in the notation needing quotes                                             |
| T6  | per-state `rerunOnSelf: true`                            | a per-edge decision made per-state                                                                                                               |
| H   | residency identity, `identity: ({data}) => data.gesture` | React's `key` applied to a state; forces a counter into the data that exists only to drive the restart                                           |
| I   | two blocks, `on` and `while`                             | an input that _conditionally_ stays or leaves must appear in both, with its guard written twice, negated                                         |
| J   | `restartOn: ({input}) => input === 'settle'`             | one line instead of twelve for a state with twelve self-transitions; names inputs in a second place                                              |
| L   | the **form** of the edge value decides                   | function = stay, object = branch map, string = go; cheapest to teach, and its hole — an edge cannot both stay _and_ branch elsewhere — is Case 1 |

**T1 was hiding a real bug**, worth keeping on record. Every property of the
branch-object type is optional, so a bare string is structurally assignable to
it. The only reason an invalid bare target name (`cancel: 'busyy'`) was ever
rejected is that `String.prototype.repeat` collides with the reserved `repeat`
key and produces a type mismatch. Rename `repeat` and target-name checking
silently stops working — which is exactly what happened the first time `&` was
tried. Fixed by intersecting the member with `object`; the guarantee had rested
on an accident.

**Then the whole feature deleted itself.** `keep_state` and `repeat_state` are
observationally identical unless something runs on entry or exit. That is not an
opinion — it is how every prior art defines it. Erlang's `repeat_state` differs
from `keep_state` only in repeating the state-enter call. XState v5's
`reenter: true` exists to control whether entry/exit actions and invoked actors
re-run. SCXML's internal vs external transitions differ only in which onexit /
onentry handlers execute. **Remove entry/exit from the definition and the
distinction has nothing left to denote.** It does not become rare; it becomes
unobservable.

Checked rather than assumed, against the acceptance cases: every place the
distinction would have mattered — the marking menu's dwell clock, the request
race's timeout — is a **timer**, not an entry/exit action.

That produced a cleaner boundary than "no side effects in the definition":

> **Causes in, consequences out.** A timer is a _cause_ — a source of inputs, a
> reason the machine moves — so removing it from the definition would make the
> definition stop telling you every way the machine can transition, which is the
> one thing it must tell you. An action is a _consequence_: nothing about the
> machine's behaviour depends on it, so it can be attached from outside without
> the definition becoming a lie.

**What dropping entry/exit cost**, stated honestly at the time: a measured
consolidation disappeared (using residency for the marking menu's dwell had moved
`cancelDwell` from three edges to one place — that survives with an external
listener scoped to "while in `tracking`", it just moves out of the file), and the
machine stops telling you what it _does_. That is a locality cost, not an
expressiveness one: a transition is identified by (source, input, target), so an
external listener can pattern-match at exactly the granularity inline actions
gave.

Axis 7 (`emit`) closed in the same movement, on three grounds in ascending order
of force: another concept to learn on a project whose thesis is that the table
reads without explanation; **strictly redundant**, since a listener receives
`{ on, input, from, to }` with data on both ends and everything a pure handler
could compute is already in `to.data`; and **the direction is asymmetric** —
adding `emit` later is additive, removing it later is breaking.

§12 reverses the premise of all of this. It does not reverse the conclusions,
which is the interesting part: the ten spellings stayed dead, and axes 4 and 5
stayed dissolved, for a _different_ reason.

## 9. Effects, round 1 — async

Five ways to express work-in-flight, against a running example that exercises
both halves at once: a fetch starts on entering `loading`, a 5 s timeout races
it, both stop on the way out.

The seam that organises all five is Elm's, and it is real:

- **`Cmd`** — one-shot, started _by a transition_. A fetch.
- **`Sub`** — continuous, a function of _which state you are in_, alive while you
  are there. A timer, a socket, a poll. This is the half that needs residency
  scoping and cancellation.

|                          | A `within` | B on the edge | C resources   | D input source | E async  |
| ------------------------ | ---------- | ------------- | ------------- | -------------- | -------- |
| lifetime owned by        | author     | library       | library       | library        | library  |
| visible in the table     | ✗          | **✓✓**        | ✗             | ✗              | ✓        |
| second declaration site  | yes        | **no**        | yes           | (in `inputs`)  | **no**   |
| expresses `Cmd` (fetch)  | ✓          | ✗             | ✓             | ✓              | ✓        |
| expresses `Sub` (socket) | ✓          | ✓             | ✓             | ✓              | **✗**    |
| new vocabulary           | 1 method   | 1 combinator  | **a library** | 1 namespace    | **none** |
| re-entry answer          | one rule   | **falls out** | per resource  | **unclear**    | n/a      |
| escape-hatch complete    | **✓**      | ✗             | via A         | ✗              | ✗        |

- **A, `within('loading', fn)`** — an effect returning its cleanup. Setup and
  teardown are **lexically paired**, so the correlation no library could check
  becomes one no author can break. A genuine dual to `.on()`: `on` is keyed by
  edges, `within` by nodes. Escape-hatch complete. Its cost is opacity — nothing
  outside that closure knows `loading` has a 5 s timeout.
- **B, `'timeout: loading -> failed': after('5s')`** — best visibility by a
  distance, and **re-entry answers itself**: the trigger belongs to the source
  state's residency, so entering starts the clock and leaving stops it. But it
  only expresses self-triggering edges. A fetch must be _started_ and _carries a
  payload_; stretching B makes one function both source the input and project the
  target data, whose payload type is then determined twice.
- **C, a `while:` block of resource constructors** — the library owns every
  lifetime, so cancellation is not something an author can _forget_ because it is
  not something an author _writes_. Inspectable and mockable. Costs a whole
  vocabulary to design, learn and version — and its escape hatch is A, so C is
  realistically **A plus a vocabulary**, not an alternative to it.
- **D, the input declares its own source** (`timeout: from.timer('5s')`) — the
  research bet. **Zero duplication of the topology**: `timeout` is live in exactly
  the states that handle `timeout`, and the table already says which those are.
  Its flaw is that the scope is a _set_ of states, so "leaving" is not well
  defined — if `loading` and `retrying` both handle `timeout`, does the clock
  reset on `loading -> retrying`? Both answers are defensible, which is the
  problem.
- **E, `async` handlers** with a three-part key `'load: idle -> loading -> ready'`
  — no new vocabulary at all, and the best-reading happy path on the page. **A
  trap worth naming**, precisely because of that: the error path is where async
  actually lives, a companion `-> failed` key is odd with nothing pairing them,
  overloading `skip()` conflates "decline" with "failed", throwing leaves the
  machine somewhere unnamed — and every repair reintroduces the vocabulary the
  option existed to avoid. It also cannot express `Sub`.

Recommendation at the time: **A + B**, which fail in opposite directions.

**One thing none of them fixes:** all five leave the fetch _running_ when you
abort — a signal stops the machine from caring, not the server from working.

## 10. Effects, round 2 — composition

The reframe: a promise is `pending -> fulfilled | rejected`. A socket is
`connecting -> open -> closed`. A timer is `waiting -> fired`. If in-flight work
is _already a machine_, the library does not need an async vocabulary — it needs
**one way to embed a machine in a state**, and async comes free.

**robot3 already does this literally**, in about 40 lines: `invoke(fn, …)`
dispatches on whether the call returns a promise, a machine, or a function
returning one. Three findings from reading it:

1. **No cancellation and no cleanup hook at all.** An identity check
   (`machine2 === service.machine`) is the whole staleness story; leaving an
   invoking state **abandons** the work rather than stopping it. A shipping
   1.2 KB library accepted that trade — evidence that "ignore the result, do not
   cancel the work" is liveable.
2. **No timer, interval, socket or poll vocabulary exists.** A timeout is
   `invoke(() => new Promise(r => setTimeout(r, 5000)))`. Empirical support for
   the thesis: one primitive really was enough.
3. **It mounts the child at the state — and we cannot.** robot3's states are
   _values_, so the mount has an obvious home. Ours are _types_, declared in
   `types<>`, so there is no value-level slot to hang it on. **A real consequence
   of §7**, and the reason every mounting option below needs a block or a
   derivation.

Three ways to mount, and the limit that ended the round:

- **F, hierarchical** (the child's state _is_ the parent state's data). Most
  expressive and most standard. Disqualifying for now: the key grammar becomes
  **paths**, `Handled` and `Sources` become recursive, the arrow test dies, grep
  stops being one hop, and **every axis-1 decision is re-litigated**. That is a
  different project.
- **G, an explicit `run:` block**. Every transition stays in the table
  (`'loading.ok: loading -> ready'`), and the `loading.` prefix makes it obvious
  which inputs arrive on their own. Re-entry needs no keyword — residency of a
  single named state is well defined.
- **H, derived from the table** (the child is named in the input vocabulary and
  runs wherever its inputs are handled). The only shape anywhere in this axis
  where the scope **cannot drift**, because there is no mount list. Same
  unresolved question as D: leaving a _set_ of states is not well defined.

Composition also obsoletes C's resource vocabulary — the resources become library
machines — and demotes A to **the leaf primitive**, written once per kind of work
rather than once per state. That is a better job for it.

**And the honest limit:** composition **relocates the effect boundary, it does
not remove it.** At the bottom of every tree is a leaf that really calls `fetch`.
"A promise is a state machine" describes its _shape_, not its _execution_. It
collapses N vocabulary items into **one** primitive, not zero.

## 11. Effects, round 3 — the effect-free core, and why it fell

That limit prompted a correction which was itself a mistake, and it is worth
recording both directions.

The correction: two claims had been running together. _Something must call
`fetch`_ — true, unavoidable, uninteresting. _That something must live inside the
library_ — **false**, and it looked like the one that mattered. `step()` is
already pure. What would take that away is exactly what `within` and `invoke`
propose: IO closures inside the definition, and then the library needs a
scheduler to call them, track their lifetimes and cancel them. That scheduler is
robot3's `service` — the effectful runtime nobody wanted.

The alternative is Elm's: **the machine computes a _description_ of what should
be running, and something outside makes reality match it.**

```
desired = subscriptions(currentState)     // pure, part of the machine
actual  = what the driver has running     // impure, outside
diff → start the new, stop the departed
```

Two consequences are the whole payoff. **Cancellation stops being something
anyone writes** — leaving `loading` means `loading`'s resources are no longer in
`desired`, so the driver stops them; no cleanup return, no `AbortController` in
user code, no forgotten `clearTimeout`. And **the machine stays serialisable**,
so state can be snapshotted, replayed and time-travelled.

Five options were worked through (P do nothing / Q descriptions in a `while:`
block / R the mapping outside the machine / S handlers return data _and_ commands
/ T generators yielding descriptions), landing on "P now, R as the shape it grows
into".

**Then it fell**, on the cost that had been named up front and underweighted:
**reconciliation needs identity.** Is `{ fetch, id: 1 }` followed by
`{ fetch, id: 2 }` one resource restarted, or one stopped and another started?
React answers with `key`, Elm with structural equality. That question has to be
answered, and it is the real complexity — not the diffing.

Adding it up, an effect-free core forces **either** a description vocabulary plus
a reconciling driver plus an identity rule, **or** a `within(state, childMachine)`
mount. And the mount fails for a specific, structural reason: it **grows the
input vocabulary** — mounting a child adds `loading.ok` and `loading.rejected` —
which means it cannot be a block (the vocabulary is declared up front) and must
be a fluent chain, whose accumulated type is incomplete until the chain ends.
That reopens §7.

Verdict: **the constraint costs more than it pays.** The machine may perform
actions.

Option S is worth one note, because it is the only shape that puts "this
transition starts a fetch" on the line where the transition already is, and
because it **reopens axis 7 legitimately rather than contradicting it**: that
decision was about _outgoing notifications_, which a listener can recover from
`{ on, input, from, to }`. _Starting work_ is not recoverable that way, so the
redundancy argument does not transfer.

## 12. Actions — the concern argument

With effects allowed back in, the question is where they go — and it was settled
by concern structure, not taste.

### The constraint

The declaration is one block per job: `inputs` what can happen, `states` what we
can be, `transitions` how we move. A proposition is judged first on whether it
keeps that true. And the diagnosis is sharper than "actions break it", because
**the overload predates actions**: `with` already does **two** jobs — it decides
(`skip`) _and_ projects the target data. `o1`'s README celebrates that fold,
correctly, because splitting `guard` from `map` lost narrowing (§4). So the
handler was carrying two jobs before this question was asked. "And it acts" makes
three; proposition Z below made it **four**.

### What the word has to cover

| #   | Kind              | Example                        | Shaped like | Needs                |
| --- | ----------------- | ------------------------------ | ----------- | -------------------- |
| 1   | Transition action | `track('submitted')`           | **edge**    | nothing              |
| 2   | Command           | fetch, then `send('loaded')`   | **edge**?   | `send`               |
| 3   | Activity          | socket, timer, poll            | **node**    | residency + teardown |
| 4   | Entry / exit      | focus an input, release a lock | **node**    | residency            |

**Kind 3 decides everything: the test any proposition must pass is expressing a
socket.** A design that only decorates edges cannot say "this is open while we
are here", and fakes it by pairing an entry edge with every exit edge — the drift
the table exists to eliminate.

**Kind 4 turns out not to be its own kind.** Entry and exit are transition
actions with one end pinned — `'*: * -> loading'` and `'*: draft -> *'` — and the
pattern grammar already parses both. Axis 3's original question answers itself.

It collapses a second time, from the other direction: **a residency action with
no teardown _is_ an entry action, and one that only tears down _is_ an exit
action** — `loading: fn` and `draft: () => fn`. The two spellings agree because
the default is to restart (below), so a residency action re-runs on
`loading -> loading` exactly as `'*: * -> loading'` fires on it. The pattern form
survives because it can scope the trigger more narrowly than "arriving" or
"leaving" — by the input, or by the other end of the edge — which residency
cannot express. But nothing needed a keyword, which was the question.

The question mark on kind 2 is a finding, not a hedge: **a command placed on an
edge duplicates across every edge _into_ the state.** `load: idle -> loading` and
`retry: failed -> loading` both have to start the fetch, and an edge added later
silently does not. Attached to residency it is written once and is automatically
right. That is what rules out the edge-based propositions on merit rather than
taste.

### The five that lost

| ID  | Proposition                                         | Out because                                                                                                                                                                                                           |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U   | the handler performs                                | takes the handler to three jobs; no node to hang a socket on                                                                                                                                                          |
| V   | a `do:` slot on the edge, beside `with:`            | duplicates across every edge into the state; a second value shape; fails the socket test — but it is **the first non-stylistic evidence for records over string keys**, since a record absorbs `do` as one more field |
| X   | `.on()` / `.within()` as the action layer           | moves the whole action layer outside the definition                                                                                                                                                                   |
| Y   | actions as data, interpreter supplied by the caller | this is §11's effect-free core                                                                                                                                                                                        |
| Z   | handler acts, multi-target returns its own target   | dissolves axis 8 and the `skip`-ordering semantics — but takes the handler to **four** jobs, the diagnosis in its most concentrated form                                                                              |
| AA  | cleanup via `Symbol.dispose` on the state's data    | elegant, and a TC39 standard rather than a concept of ours — but the disposer must be constructed inside the handler, so same overload                                                                                |
| AB  | no feature at all; a named async function drives it | not rejected — **the baseline this has to beat**, and the visibility complaint largely evaporates once the function has a name                                                                                        |

### Why a block, not a chain

X can express everything the block can, costs nothing in the core, and half of it
is already built. Three things decided it anyway:

1. **The definition is complete.** `machine({…})` is a value that gets exported
   and imported. If behaviour arrives through `.within()` calls afterwards, the
   exported thing is not the machine — it is half a machine plus a convention
   that every caller remembers to configure it. In practice you would export a
   factory, and the definition would stop being the definition.
2. **Declarative, in one place.** A chain is imperative and order-dependent, can
   be applied conditionally, and can be spread across modules. A block cannot.
3. **Symmetry.** Everything else is a block.

**`.on()` survives with a different job**: `actions` is the machine's own
behaviour and ships with the definition; `.on()` is a subscription attached by
whoever instantiates it. That is also why axis 7 settled where it did.

### The block is `actions`, not `states`

An earlier draft called it `states:`, which is a lie: the states are already
declared in `types<>` and every one appears in the table. The block declares
**what runs**. Naming it after its content also freed its shape — it is no longer
obliged to be a map keyed by state name, which is what made trigger-keying
possible.

Three shapes were considered: **records** (`[{ within: 'loading', run: fn }]` — a
list, so two activities in one state stay separable; extensible in `o1`'s sense),
**constructors** (`[within('loading', fn), on('cancel: draft -> *', fn)]` — reads
best of the three; this is proposition M, which died for _transitions_ on per-edge
tax, but actions are sparse so the tax is near nothing here), and **trigger-keyed**
(`{ 'loading': fn, 'cancel: draft -> *': fn }` — no new syntax at all, since both
key languages already exist).

**Trigger-keyed won**, because it pairs with string keys: they are the same idea
applied twice — one key language, parsed, doing the work that structure does
elsewhere — and choosing both makes the whole definition string-keyed maps.
Constructors were the near miss; they would have been the only place in the API
using them on every line, and none of the three live layouts has that concept.

### Restart, and how the policy is spelled

Actions make `draft -> draft` observable for the first time, so axes 4 and 5 —
closed in §8 _because_ entry/exit had gone — had to be re-answered.

First, a collapse: **restart-on-re-entry and restart-on-resident-data-change are
one question.** Resident data can only change via a transition into the state you
are already in. So there is a single policy at two granularities: restart on any
self-transition, or restart only when something relevant changed.

Four spellings were considered. `stay` and `next` were not among them — a handler
returning data under a key that reads `draft -> draft` already _is_ a stay, and
the genuinely new question is not "did we move?" but "does the activity restart?".
(`stay` and `skip` are also **not** the same thing: `skip` changes nothing,
commits nothing, and falls through to the next candidate; `stay` changes data and
consumes the input. They coincide only if `stay` were nullary _and_ multi-target
fall-through were removed.)

- **Omit the arrow** — `'revise: draft'` stays, `'restart: draft -> draft'`
  re-enters. Greppable, and it strengthens the arrow test. Kept as the fallback if
  per-action policy turns out to be over-engineering.
- **`-> *` means stay** — technically free, since a transition target must be
  concrete. **Rejected:** `*` already means _wildcard_ in the pattern language,
  and anyone who has read a pattern will misread it.
- **Data identity decides it** — return `data` unchanged and the resource
  survives. Zero syntax. **Rejected:** `{ ...data }` versus `data` is an edit made
  without thinking, and correctness should not hinge on whether someone spread an
  object.
- **The policy belongs to the action** — adopted. The transition author is
  declaring **movement**; whether some socket survives that movement is not their
  concern and they should not have to know, and two activities in the same state
  can legitimately want different answers. Put the lifetime question on the thing
  that _has_ a lifetime.

That leaves _how_ it is written, which is a separate question because
trigger-keying gives the action no options slot — its whole appeal is a bare
function value. Putting the policy in the **key** (`'-> loading'` for each entry,
`'draft ->'` for exit) was the runner-up and is fully superseded: its one
advantage was a spelling for entry and exit, which the pattern grammar already
provides without a third key form.

**Wrappers won.** The common case stays a bare function and a constructor appears
only at the exception, which answers the objection to constructors-everywhere.
And the wrapper **returns a record** — `persistent(fn)` → `{ run: fn, restart:
'never' }` — so a bare function is sugar for `{ run: fn }`, the block stays
inspectable as data, and new policies are new wrappers rather than new syntax.
**That is the records proposition with a constructor as its ergonomic front
door**, and the convergence is the strongest argument for it.

That last property also absorbed what had been a separate question. A
finer-grained policy — restart only when something relevant changed, spelled as
an object value `{ run: fn, key: ({ id }) => id }` — looked like it needed a
second value shape, which was the main cost counted against wrappers. It does
not: written as `keyed(k, fn)` it is one more constructor producing one more
field. So the layering is not "coarse now, object values later"; it is **one
mechanism that grows**. `keyed` is therefore _not_ in the initial API — there is
no use case for it yet, and the whole point of the shape is that adding it later
costs nothing. The same goes for a `once` or a `debounced`.

**The default is to restart. This reverses an earlier draft**, which argued that
residency is the state's name being current, so a self-transition should restart
nothing. Two reasons for the reversal:

- **It fails safe.** Forgetting the wrapper under a survive-default leaves an
  activity closed over stale data — a correctness bug. Forgetting it under a
  restart-default tears something down unnecessarily — a performance bug.
- **It puts the wrapper on the rarer thing.** A fetch should restart when you
  re-enter `loading`; a long-lived socket is the exception.

It is also consistent with the pattern grammar: `'*: draft -> *'` matches
`draft -> draft`, so an exit action fires on a self-transition — exactly what
re-entry means under this default. The two rules agree rather than needing
reconciliation.

### What actions cost

**Axis 3 reopens by definition**, and the block is **opaque**: nothing in the
table says `loading` fetches, so grep `-> loading` finds the edges but not the
work. That was the fatal complaint against `within` in §9, and attaching to
residency does not answer it — it only gives the closure a defensible lifetime.

Three properties come free, and they are what the rejected options paid for:
**the type never grows** (`send` sends only already-declared inputs, so `actions`
adds nothing to the Spec — this works _because_ it is less powerful than a
mount); **it cannot drift** (state names are checked against the declared
vocabulary); and **it is the standard answer** (Harel, SCXML, XState and
`gen_statem` all attach activities to nodes).

### The bare-key conflict, and the rule that closed it

Residency wants a bare key, and the listener language already gave bare keys a
different meaning — `Pattern<Sp>`'s first arm is `InputName<Sp>`. Left alone, the
same syntax would mean an input in one block and a state in the other, and a name
that is legally both — `review` is plausibly both, and the neutral machine has it
as a state — would compile under the wrong reading with **no error**.

> **A key with no `->` names a state. An edge always contains an arrow, even when
> both ends are `*`.**

Decidable from the string alone, so a reader never has to know which block they
are in. The competing fix — rejecting bare keys in `StateName & InputName`, which
is computable since both vocabularies are declared — only patches the silent case
and leaves two meanings standing. Three lines to implement, and nothing currently
uses the bare form.

A consequence worth noticing: under one shared key language, `.on()` could also
accept a bare state key and mean residency, with the same setup-and-teardown
shape. That would make `.on` and `actions` structurally identical, differing only
in who owns them. Not needed now; the rule makes it free later.

## 13. Reusable type-system findings

Each was discovered by a test asserting that something **illegal** fails. No
positive test has ever caught one.

1. **The round-1 cross-product rule was too strong.** It said a cross-product of
   discriminants at value positions kills contextual typing. `o1` is a
   cross-product of _three_ (`event`, `from`, `to`) and TypeScript 7.0.2
   discriminates it correctly. The old finding is narrowed to the encodings
   actually tested then.
2. **Marker calls leak `any`.** `state<T = void>()` puts the call in a position
   contextually typed by the unresolved state map, so `T` infers as `any`. A
   parameterless _overload_ has nothing to infer; a declared vocabulary avoids it
   entirely.
3. **A type parameter in a closure's parameter type gets fixed to its constraint**
   before inference. This killed "compute `S` from the raw literal", and it is why
   the state-name inference cliff existed.
4. **`T[I]` inside a mapped-type template forces `T` to resolve**, collapsing the
   result to `never`. `const T` does not help. Per-row precision has to come from
   a union instead.
5. **Capturing a literal alongside a checking member disables excess-property
   checking** against that member — a key is "known" if _any_ intersection member
   has it. Cost `n1` its per-line errors until a second member restored them.
6. **Reverse-mapped inference needs one non-closure leaf** _and_ only bites when
   the type parameter also appears in a closure parameter. Neither alone is
   enough.
7. **A union of an object type with an array of that object type** destroys
   contextual typing for every bare object in the literal (§4).
8. **`TS2820`'s did-you-mean is conditional on identifier length** (§4).
9. **Omitting an inference site makes TypeScript discard the entire inferred
   map**; the fix is to widen the constraint and move the default into the
   accessor type (§5).
10. **A homomorphic mapped type over inferred keys is the safe mechanism**; a
    standalone generic call needing sibling context is the one that keeps failing
    (§6).
11. **Narrowing is never invalidated by a call, or by `await`.** Measured on
    7.0.2: after `if (doc.current.state === 'draft')`, both `doc.send(…)` and
    `await slow()` leave the narrowing intact, and `const still: 'draft' =
doc.current.state` still compiles. Narrowing an object that something else
    can mutate is unsound in TypeScript and there is no workaround — the language
    has no effect system to invalidate it. **This is the finding that governs
    §15.** A discriminated union on the live object _does_ narrow correctly
    (`live.send('open')` errors inside the `draft` branch), so the shape is
    typeable — it is just wrong the moment the machine moves.

## 14. The graveyard

Everything proposed and rejected, one line each, so the ground is not re-covered.

**Layouts.** A edge records (two compiler blockers, cannot express multi-target)
· B annotated outcome (works; target lives in a type annotation) · C target list
(negative evidence, will not compile) · E by destination (question B scatters;
its one win is derivable) · F transition table (unverified crux; superseded by
string keys) · M combinator edges (one verb, per-edge tax; superseded by records)
· G no input vocabulary (payload at the use site; vocabulary stops being in one
place — held, then subsumed by `types<>`)

**Self-transitions.** T1 reserved keys · T2 symbol keys · T3 self-name · T4
return marker · T5 `&` · T6 per-state flag · H residency identity · I two blocks
· J restart rule · L form dispatch — all moot once entry/exit left, and all still
moot once actions returned, because the answer moved to the action.

**Async.** A `within` (demoted to the leaf primitive) · B `after()` on the edge
(only self-triggering edges) · C resource vocabulary (obsoleted by composition) ·
D input-declared source (leaving a _set_ of states is undefined) · E async
handlers (the error path) · F hierarchical mounting (paths reopen every axis) ·
G mount block · H derived mounting (same set problem as D) · P/Q/R/S/T
effect-free variants (reconciliation needs identity)

**Actions.** U handler performs · V `do:` on the edge · X listeners as the action
layer · Y actions as data · Z handler acts with multi-target return · AA
`Symbol.dispose` on the data · AB no feature at all (the baseline)

**Other.** `emit` (redundant with the listener event) · `else` (throws at
runtime, no static guarantee) · `enter`/`exit` as their own keys (edge patterns
with one end pinned)

---

## 15. Sending inputs

Every round above is about **writing** a machine. This one is about **driving**
it, and it is the round that has not happened yet. What is in
[api.md](api.md#sending-inputs) is one option written up prematurely.

### The constraints this round inherits

1. **Per-state capabilities at the send site is the differentiator.** Research
   note 07 F20: _no_ surveyed library enforces it. `useStateMachine` advertises
   legality via `nextEventsT` but its `send` is machine-wide; XState v5 removed
   even the advertisement; Zag's `send` takes any `T["event"]`. If the project
   ships one thing nobody else has, it is this — so **an option that makes the
   guarantee opt-in has effectively not shipped it.**
2. **Narrowing dies across callbacks**, so the guarantee has to attach to an
   immutable value that has already been narrowed, never to a live handle held
   across time.
3. **Rust gets this for free and we cannot.** The typestate pattern consumes
   `self` and returns the next state type, so the old value is _moved_ and stale
   narrowing is impossible (note 08 F2). TypeScript has no ownership, so
   whatever we do, a stale snapshot remains reachable and needs an answer.
4. **Actions need a host.** `step` cannot start a socket or fire a teardown, so a
   stateful instance has to exist regardless of what the pure path looks like.
5. **The definition is not the instance.** P1.6 requires independent uses of the
   same behaviour, so `publication.send(…)` on the exported definition is out;
   sending targets something `run()` produced.

### First: what a "capability" is

The word has been used loosely. Concretely: **the input names of a state become
method names, and the payload becomes the argument.** Nothing more.

Given these rows,

```ts
'revise: draft -> draft'
'submit: draft -> review'
'submit: draft -> published'
'cancel: draft -> empty'
'decide: review -> published'
```

`Handled<T, 'draft'>` — which already exists in the prototype
([lib.ts:114](../explorations/candidates/n2-declared-types/lib.ts:114)) — reads
the keys and yields `'revise' | 'submit' | 'cancel'`. The capability type is one
mapped type over it:

```ts
type Capabilities<Sp, T, F> = {
	[E in Handled<T, F>]: (input: InputsOf<Sp>[E]) => …
}
```

So in `draft` you get exactly three members:

```ts
at.revise({ text }) // the 'revise: draft -> …' row
at.submit({ route }) // BOTH 'submit: draft -> …' rows, in declaration order
at.cancel() // 'cancel' is void, so no argument
at.decide // not a member → TS2339
```

Note `submit` is **one method for two rows**: capabilities are keyed by _input_,
not by edge, and the method runs the candidate rows in declaration order with
`skip()` fall-through, exactly as `send` would.

### The options

|                                         | typed send site  | ergonomics | actions | stale-narrowing risk |
| --------------------------------------- | ---------------- | ---------- | ------- | -------------------- |
| **S1** pure `step` only                 | only if narrowed | **poor**   | ✗       | none                 |
| **S2** service, broad `send`            | **none**         | familiar   | ✓       | none                 |
| **S3** service + `capabilities(m, v)`   | opt-in           | ok         | ✓       | **see below**        |
| **S4** capabilities **on** the snapshot | **free**         | **best**   | ✓       | **real**             |
| **S5** pure snapshot chaining           | **free**         | good       | ✗       | none                 |
| **S6** S4 + S5, two provenances         | **free**         | good       | ✓       | real + ambiguity     |
| **S7** scoped visit / `when`            | **free**         | **good**   | ✓       | **impossible**       |
| **S8** `available` palette              | n/a (runtime)    | —          | —       | —                    |

Each option below runs **the same script**, so they can be read side by side:
open a document, submit it for review, and try one input the current state does
not handle.

---

#### S1 — pure `step` only

```ts
import { step } from 'totorobot'

let current: StateValue<Publication> = { state: 'empty', data: undefined }

const r1 = step(publication, current, 'open', { text: 'hello' })
if (r1.kind === 'moved') current = r1.next // now draft

const r2 = step(publication, current, 'submit', { route: 'review' })
if (r2.kind === 'moved') current = r2.next // now review

step(publication, current, 'decide', { verdict: 'ok' })
//   → { kind: 'none', reason: 'unavailable' }   — compiles, no error
```

**You hold the state.** Every send is two statements: call, then commit. Nothing
mutates and nothing is hidden, which makes it perfect for tests and replay.

**Why it fails as the API.** Two lines per send is a lot; the `if` is pure
bookkeeping; and because `current` is reassigned from the full union, TypeScript
has nothing narrowed to check the input name against — so the guarantee is only
there if you happen to have narrowed already. **A primitive, not an API.**
Leading with it was the error.

#### S2 — a service with a broad `send`

```ts
const doc = run(publication)

doc.send('open', { text: 'hello' })
doc.send('submit', { route: 'review' })

doc.current.state // 'review'
doc.send('decide', { verdict: 'ok' }) // compiles. does nothing at runtime.
```

**What XState, robot3 and Zag all do.** One concept, no bookkeeping, immediately
familiar, and actions have a host. The last line is the whole problem: it is
legal to the compiler and a silent no-op at runtime — exactly the robot3 gap from
§2, reproduced deliberately.

#### S3 — service, plus `capabilities()` as a separate call

The one that needs spelling out. The snapshot is **plain data** — `{ state, data }`
and nothing else. Capabilities are not on it; they are computed _from_ it by a
function you call yourself.

```ts
import { run, capabilities } from 'totorobot'

const doc = run(publication)
doc.send('open', { text: 'hello' }) // the broad door still exists

const now = doc.current // plain data
now.state // 'draft'
now.data.text // 'hello'
now.submit // ✗ does not exist — `now` is just a value

if (now.state === 'draft') {
	const at = capabilities(publication, now) // ← the extra step
	at.submit({ route: 'review' }) // ✓ typed
	at.decide({ verdict: 'ok' }) // ✗ TS2339
}
```

**The difference from S4 is exactly one line** — `const at = capabilities(…)`. In
S4 that line does not exist because `now` already carries the methods.

**What it buys.** `now` stays serialisable, clonable and comparable, and a
devtool inspecting it sees `{ state, data }` with no functions in the way.

**What it costs.** You have to know `capabilities` exists, import it, and pass
the machine in a second time. So the guarantee is **opt-in**, and the path of
least resistance is `doc.send(…)` — which has no guarantee at all. A
differentiator nobody reaches for has not shipped.

**Correction — S3 does not solve staleness, and an earlier draft of this table
said it did.** The extra call changes nothing about time:

```ts
const at = capabilities(publication, now) // draft
await somethingSlow() // another caller sends 'cancel'
at.submit({ route: 'review' }) // ← same question as S4
```

The only reading under which S3 is stale-free is if `capabilities(definition,
value)` is **pure** — it closes over a definition and a value, never over `doc`,
so it cannot write anywhere. Then `at.submit(…)` returns the next value and
nothing is mutated, and staleness is meaningless because nothing is shared.

But that version **cannot drive the live machine at all**: the result has to be
handed back (`doc.commit(at.submit(…))`), and the alternative —
`capabilities(doc, now)`, closing over the instance — puts the staleness
straight back. So S3 is really two different options wearing one name, and
neither is a free lunch: pure-S3 is S5 with extra ceremony, live-S3 is S4 with
extra ceremony.

**What actually removes staleness** is one of three things, and the extra
function call is not among them:

1. **Zero window** — the handle only exists for the synchronous duration of a
   callback, and is revoked after (S7). The mistake becomes impossible to make
   silently.
2. **Nothing to be stale about** — the whole path is pure, so an old value is
   still a perfectly good value (S5, S1).
3. **Detect it** — the value is epoch-bound and a stale send answers
   `unavailable` (S4 with a rule bolted on). This does not prevent the mistake,
   it makes it safe and loud.

#### S4 — the capabilities are on the snapshot

```ts
const doc = run(publication)
doc.send('open', { text: 'hello' }) // door 1 — broad, unchanged

const now = doc.current // door 2
now.state // 'draft'
now.data.text // 'hello'

if (now.state === 'draft') {
	now.submit({ route: 'review' }) // ✓ commits to doc, returns the next snapshot
	now.decide({ verdict: 'ok' }) // ✗ TS2339
}
```

**The guarantee is free.** You get it by narrowing — which you were doing anyway
to read `data`. That is the whole argument, and it is the only thing separating
S4 from S3. Prior art: `@doeixd/machine` ships transitions as methods returning
the next state type, which is the Rust move in TypeScript (notes 07 F19, 08 F2).

Two costs, both real. **The snapshot stops being plain data** — methods
complicate cloning, equality and serialisation, though non-enumerable members or
a prototype mitigate it and `data` can stay the plain part. And **the stale
hazard** of constraint 3:

```ts
const now = doc.current // draft
await somethingSlow() // meanwhile another caller sent 'cancel'
now.submit({ route: 'review' }) // ← what should this do?
```

#### S5 — pure snapshot chaining

The same methods, but they return the next snapshot and mutate nothing. No
service at all.

```ts
const a = publication.start() // { state: 'empty' }
const b = a.open({ text: 'hello' }) // { state: 'draft' }
const c = b.submit({ route: 'review' }) // { state: 'review' }

a.state // still 'empty' — nothing was mutated
c.data.reviewer // typed
b.decide({ verdict: 'ok' }) // ✗ TS2339
```

**Pure, typed and ergonomic at the same time**, which S1 is not — it answers the
"`step` is complicated" complaint without giving up purity, and `a`, `b`, `c`
coexisting makes replay, undo and time-travel free.

**It cannot host actions**, and in a UI you still have to store the current value
somewhere yourself.

#### S6 — S5's methods on both detached and live snapshots

Provenance decides: a snapshot from `publication.start()` is pure, one from
`doc.current` commits. Best of both, and the hazard is that **the two read
identically at the call site** — `x.submit(…)` gives no clue whether anything
was mutated.

#### S7 — a scoped handle

The capabilities arrive as an argument that **cannot escape the callback**.

```ts
const doc = run(publication)
doc.send('open', { text: 'hello' })

doc.when('draft', (at) => at.submit({ route: 'review' })) // runs iff in draft

doc.visit({
	empty: () => …,
	draft: (at) => at.submit({ route: 'review' }),
	review: (at) => at.decide({ verdict: 'approve' }),
	published: () => …,
}) // exhaustive — omitting a state is a compile error
```

**This is the only option that gets both halves.** The stale hazard is
structurally impossible (the handle has no life outside the call — the closest
TypeScript gets to Rust's move), _and_ `doc.current` can stay plain data, because
the capabilities never live on it. `visit` also answers search question A with
exhaustiveness.

**And the runtime can make it airtight**, which the other options cannot.
TypeScript will not stop anyone stashing `at` in an outer variable or awaiting
inside the callback — but the library can **revoke the handle when the callback
returns**, so a late `at.submit(…)` throws with a clear message instead of
silently acting on a state that has moved. Prevention plus a loud failure, rather
than a rule the reader has to remember.

**Its cost is smaller than "verbose" suggests.** For the common case it is
actually _shorter_ than narrowing by hand:

```ts
const now = doc.current // S4
if (now.state === 'draft') now.submit({ route: 'review' })

doc.when('draft', (at) => at.submit({ route: 'review' })) // S7
```

The real price is inversion of control: the value cannot be returned out of the
callback without unwrapping, and a reader has to accept a callback where an `if`
would have done.

#### S8 — `doc.available`

```ts
doc.available // readonly ['revise', 'submit', 'cancel']
```

The legal-move palette from the brainstorm. **Not a rival** — a runtime array for
rendering buttons, derivable from the table, and the enforced version of
`useStateMachine`'s `nextEventsT`. Cheap, and it composes with any option above.

#### S9 — name the source state at the send site

```ts
doc.from('draft').submit({ route: 'review' })
doc.from('draft').decide({ verdict: 'ok' }) // ✗ TS2339
```

`from('draft')` returns the capabilities of `draft`; at runtime it checks the
machine really is there and answers `unavailable` if not. **No callback, no
subscription reading, and the assumption is written down** — a reader sees
"this code believes we are in draft" instead of inferring it from a narrowing
three lines up, and it greps.

It also reads as the table row it corresponds to: `submit: draft -> review`
against `doc.from('draft').submit(…)`. The stale window is one expression, which
is as short as it gets without a callback.

**Costs.** A little redundant when you have _also_ just narrowed
(`if (doc.current.state === 'draft') doc.from('draft')…`), and it hands you a
handle that can still be stored (`const at = doc.from('draft')`) — smaller
exposure than S4, not zero.

#### S10 — put the source state in the key, as everywhere else

```ts
doc.send('submit: draft', { route: 'review' })
```

The same idea as S9 with no chaining, expressed in **the key language the rest of
the API already uses**. The compiler checks `'submit: draft'` is the prefix of a
real row; the runtime checks residency. One call, one string, and the
`Norm`/`Trim` machinery already parses it.

**Costs.** Naming the source in a _send_ is odd — the machine already knows where
it is — and it reads as a half-written transition key. It is the most consistent
option with the notation and the least obvious one to a newcomer.

#### S11 — `sendIf`

```ts
doc.sendIf('draft', 'submit', { route: 'review' })
doc.sendIf('draft', 'decide', { verdict: 'ok' }) // ✗ not handled in draft
```

S9 flattened to one call, with the conditional nature in the name rather than in
a chain. `send` always attempts; `sendIf` attempts only when the named state is
current, and type-checks the input against **that** state.

Cheapest of the category-3 options: one method, no handle to store at all, so the
stale window is not merely short but nonexistent — there is nothing to hold. The
price is a three-argument call and a second sending verb.

#### S12 — a scoped handle that carries `send`, not methods

S7's scoping with S2's verb. The handle exposes the **same `send` you already
know**, narrowed to the state, rather than a method per input:

```ts
doc.match('draft', ({ send, data }) => {
	send('submit', { route: 'review' }) // ✓
	send('cancel') // ✓ void takes no payload
	data.revision // ✓ narrowed data
	send('decide', { verdict: 'ok' }) // ✗ not handled in draft
})

doc.match({
	draft: ({ send }) => send('submit', { route: 'review' }),
	review: ({ send }) => send('decide', { verdict: 'ok' }),
})
```

**Measured, not assumed.** The whole shape type-checks on 7.0.2, including the
dependent payload and the no-argument `void` case
(`scratchpad/probe/doc-if.ts`):

```
TS2345: Argument of type '"decide"' is not assignable to parameter of type '"cancel" | "submit"'.
TS2322: Type '"nope"' is not assignable to type '"publish" | "review"'.
TS2554: Expected 1 arguments, but got 2.          ← send('cancel', {…})
```

**One name, two forms.** The two-argument call is exactly sugar for a one-key
object — `match('draft', fn)` ≡ `match({ draft: fn })` — so the return-type rule
is uniform rather than special-cased: `R` when every state is covered,
`R | undefined` otherwise. The overload resolves cleanly
(`scratchpad/probe/match.ts`); a string first argument and an object first
argument are trivially discriminated.

An earlier draft called the single-branch form `if`. That was fine — reserved
words have been valid property names since ES5, and `Promise.prototype.catch`
and `Map.prototype.delete` settle any doubt — but two names for one operation was
the wrong shape, and `match` covers both honestly.

**Three things it gets right that earlier options did not.**

- **It is unambiguously one-shot.** That was the whole objection to `when`, which
  read as a subscription next to `.on()`. Nobody reads `match` as a
  subscription.
- **One verb, not a namespace.** `at.send('submit', …)` is the _same call shape_
  as `doc.send('submit', …)`, just narrowed — so there is no second calling
  convention, no `capabilities` type to learn, and input names never become
  members that could collide with `data` or `state`. This is the strongest
  argument for S12 over S4/S7/S9, and it was missed in the first pass.
- **It buys narrowed reading too**, not only a checked send: `data` is on the
  handle, and several sends can share one block.

**Three costs.**

- **It reopens axis 12**, which dropped the typed send site one round ago. The
  reason for dropping was value, not soundness — S12 is sound (category 2) — so
  the question is only whether it buys enough. It buys more than S11 did.
- **`match` invites an XState reading.** There, `state.matches('draft')` is a
  **predicate returning a boolean**. Ours always takes a callback, so arity
  disambiguates and `doc.match('draft')` alone is not valid — but the association
  is real for the population most likely to arrive here.
- **The object form is shaped like `actions`.** `doc.match({ draft: fn })` and
  `actions: { draft: fn }` read alike, and `draft: fn` means "while in draft" in
  one and "if in draft, right now" in the other. Weaker than it was under the name
  `if`, since `match` does not read as a declaration, but not zero.

#### Repeated single-branch calls are not a dispatch — they are a bug

The obvious way to get several branches is to write several calls. It does not
work, and the reason is specific rather than stylistic:

```ts
doc.match('draft', ({ send }) => send('submit', { route: 'review' })) // → review
doc.match('review', ({ send }) => send('decide', { verdict: 'ok' })) // ALSO fires
```

**The machine moves between the two calls**, so the second one matches the state
the first one produced, and both run in a single pass. Nobody writing that meant
"and then, if we just arrived, do the next thing too" — they meant "dispatch on
where we are". Sequential single-branch calls are only safe when no branch sends.

So a multi-branch form is not sugar. It is the only correct way to express
dispatch, and it has to be **one construct that picks one branch**.

#### The two multi-branch spellings, both measured

**A chain** (`if` / `elseIf` / `else`), with the remaining states accumulated in
the type so a state cannot be handled twice, and exhaustiveness detected at the
end. It works on 7.0.2 (`scratchpad/probe/dispatch.ts`), and the error is
excellent — it names what is left:

```
.elseIf('draft', …)   ✗ TS2345: Argument of type '"draft"' is not
                         assignable to parameter of type '"empty"'.
```

Note this does **not** fall foul of the project's finding against fluent type
accumulation (§2, and the `within()` failure in §11). That finding is about
accumulating while _building a definition_, where the type is incomplete until
the chain ends and everything downstream depends on it. Here the accumulator is
consumed immediately at a call site and feeds nothing.

**An object**, which also works (`scratchpad/probe/dispatch2.ts`) — per-branch
narrowing, unknown keys rejected, and the return type tightening from
`R | undefined` to `R` exactly when every state is covered:

```ts
doc.match({
	draft: ({ send }) => send('submit', { route: 'review' }),
	review: ({ send }) => send('decide', { verdict: 'ok' }),
})
```

|                                     | chain                                 | object                           |
| ----------------------------------- | ------------------------------------- | -------------------------------- |
| picks exactly one branch            | ✓                                     | ✓                                |
| a state cannot repeat               | needs an accumulator                  | **free — duplicate key**         |
| exhaustiveness in the return type   | ✓                                     | ✓                                |
| error names the remaining states    | **✓ better**                          | generic `TS1117`                 |
| **Prettier**                        | **indents the whole chain**           | **fine**                         |
| order is                            | line order                            | key order — as in `transitions`  |
| type machinery                      | an interface per link                 | one mapped type                  |
| consistent with the rest of the API | the only fluent thing besides `.on()` | keyed maps, like everything else |

**The object wins.** It gets "same state only once" for free from a rule
JavaScript already has, it formats, its ordering convention matches the
transition table, and it does not introduce the API's only fluent chain. The
chain's one real advantage is a better diagnostic, which does not pay for the
rest.

**Which also settles the name.** `match` is the word every language with pattern
matching already uses, and it is honest at both arities. That leaves one method:

```ts
doc.match('draft', ({ send, data }) => …)  // one branch — sugar for a one-key object
doc.match({ draft: …, review: …, … })      // many branches — exactly one fires
```

### The orthogonal question: the call shape

`send('submit', payload)` or `send({ type: 'submit', ...payload })`? XState and
robot3 take one object. Keeping the name and the payload as **separate
arguments** types more cleanly — merging them is how robot3's
`[key: string]: any` hole appeared (§2) — and it makes a `void` input just
`send('cancel')`. Two arguments, and it already matches an action's `send`.

### The measurement that governs the rest

Can a narrowing type the send?

```ts
if (doc.current.state === 'draft') {
	doc.send('submit', { route: 'review' })
	// doc may now be in `review` — does TypeScript know?
}
```

**No, and there is no workaround** (finding 11). TypeScript never invalidates a
narrowing on a call or an `await` — it has no effect system. The narrowing shape
_is_ typeable (a discriminated union on the live object narrows correctly), it is
simply wrong the moment the machine moves, and the compiler will keep insisting
it is right.

**But the stakes are lower than "unsound" suggests.** The runtime always
re-checks: a send that does not match the current state returns `unavailable`
and changes nothing. So a stale narrowing does not corrupt anything — it
**degrades to exactly S2's behaviour**, which is the baseline everyone else
ships. The loss is a guarantee, not correctness.

That yields a clean trichotomy. A typed send site is sound only when:

1. **nothing mutates** — S1, S5. An old value is still a good value.
2. **the window is closed by construction** — S7. The handle does not outlive the
   check.
3. **the assumption is re-stated at the call** — S9, S10. The type is checked
   against a state the code names out loud, and the runtime verifies it.

Everything else — S3-live, S4, S6, and a narrowed `doc.send` — is category 4:
sound-looking and quietly wrong after the first mutation.

### Decided: S2 alone. No typed send site, for now

**`doc.send(name, payload)` is the whole sending API.** Broad, mutating,
familiar; every declared input accepted from every state; anything the current
state does not handle answers `unavailable` and changes nothing.

The typed send site is **dropped**, and the reason is that it stopped buying
much once finding 11 was measured:

- The version people would actually reach for — narrow, then send — is
  **unsound and uncorrectable**, and worse than absent, because the compiler
  vouches for it.
- Every sound spelling (S7's callback, S9's `from`, S10's key, S11's `sendIf`)
  makes the caller **re-state a fact the machine already knows**. That is
  ceremony in exchange for catching a class of mistake the runtime already
  handles safely.
- Nothing is at risk. A wrong send returns `unavailable`; it does not corrupt
  state, throw, or half-apply.

**What this costs, plainly.** Research note 07 F20 called per-state capabilities
at the send site the one gap nobody has filled, and it was named as the
differentiator. That claim is now narrower, and the honest statement is:

- **Per-state _data_ still works and is untouched.** Narrowing `doc.current`
  gives typed data with no nullable padding — the half XState's global `context`
  gets wrong, and reason enough for the project to exist.
- **Per-state _capabilities_ are advertised, not enforced** — `doc.available` at
  runtime. That is exactly where `useStateMachine` landed, which is worth knowing
  rather than discovering later.
- **The definition site keeps its checking.** Illegal transitions still cannot be
  written; what is unenforced is only the _call_.

**And it is reversible, which is why it is safe to drop now.** Adding a typed
door later is additive — a new method beside `send`, no change to anything
existing. Shipping one now and regretting it is breaking. Same asymmetry that
settled axis 7.

**Also freed by this decision:** `doc.current` can stay plain serialisable data,
since nothing needs to hang capabilities on it; the stale question disappears
entirely; and `capabilities`, `from`, `when` and `visit` all leave the API.

S8's `doc.available` stays — it is cheap, it is what UI code needs to render
buttons, and it is honest about being a runtime advertisement.

Recorded but not built: **S11 `sendIf` is the cheapest way back in** if the
absence bites, because it adds one method and no concepts. **S9's `from`** if a
handle turns out to be wanted for reading as well as sending.

### If it comes back, it comes back as S12

**Not being built.** Recorded because the design work is done, so a future round
starts from a settled shape rather than re-running this one.

```ts
doc.match('draft', ({ send, data }) => …)  // one branch — sugar for a one-key object
doc.match({ draft: …, review: …, … })      // many branches — exactly one fires
```

Everything about it is measured on 7.0.2 and reproducible from
`scratchpad/probe/`: per-branch narrowing of both `send` and `data`, the
dependent payload type, the no-argument `void` case, rejection of unknown states,
and a return type that tightens from `R | undefined` to `R` exactly when every
state is covered.

Why S12 rather than any of S3, S4, S7, S9, S10 or S11:

- **Sound.** The handle does not outlive the callback, so the narrowing cannot go
  stale (finding 11 is what kills the alternatives).
- **No second calling convention.** `at.send('submit', …)` is the same shape as
  `doc.send('submit', …)`, so nothing new is learned and input names never become
  a member namespace.
- **It covers reading too**, not only sending — `data` is on the handle.
- **One method, two arities**, with a uniform return-type rule and no fluent
  chain.

The open question is not technical: it is whether a scoped block per narrowed
region earns its keep in everyday code. Nothing else needs deciding first.

---

## 16. Definition and instance — open

§15 assumed a `run()` without justifying it. This is that question: **are the
thing you write and the thing you drive two objects, or one?**

### There are up to three things, not two

Naming them separately makes the question tractable:

1. **The definition** — what `machine({…})` returns. The table, the actions, the
   vocabulary. Inert.
2. **The snapshot** — `{ state, data }`. A value. Inert.
3. **The host** — holds the current snapshot, runs and tears down actions, holds
   subscriptions. **Mutable.**

Nobody disputes 1 and 2. The whole question is whether 3 exists.

### The options

#### D1 — all three (what §15 assumed)

```ts
export const publication = machine({ … }) // 1, exported and shared
const doc = run(publication, { text: '' }) // 3, one per use
doc.current // 2
```

What XState (`createMachine` → `createActor`), robot3 (`createMachine` →
`interpret`) and Redux (`reducer` → `createStore`) all do.

**Costs one line** in the smallest case, and two names people will conflate —
XState's machine/service/actor confusion is the cautionary tale.

#### D2 — two things: `machine()` is already live

```ts
const doc = machine({ … })
doc.send('open', { text: 'hello' })
```

The shortest possible start, one concept, no ceremony.

**The obvious objection is that a machine exported from a module becomes a
globally shared mutable singleton** — import it twice, get the same running
state. But that is answered by not exporting it: export a factory instead, and
D2 supports as many instances as you like. See below; this option is stronger
than it first looks, and the real case against it is elsewhere.

#### D3 — D1, with the constructor on the definition

```ts
const doc = publication.start({ text: '' })
// or, callable:  const doc = publication({ text: '' })
```

Not a different answer — an ergonomics variant of D1. No second import, and
dot-completion makes it discoverable. It costs putting a method on the thing we
want to be inert data, which is minor but not nothing.

#### D4 — a class

```ts
const Doc = machine({ … })
const a = new Doc({ text: '' })
```

`new` makes instantiation unmistakable and every JS programmer reads it
instantly. It also drags in `this`, invites inheritance, and fights the
"definition is plain data" goal.

#### D5 — two things: no host at all

```ts
const a = publication.start() // a snapshot
const b = a.open({ text: 'hello' }) // another snapshot
```

The definition plus a value is everything; state lives wherever the caller puts
it (React state, a store, a request scope). This is §15's S5 taken to its
conclusion, and it is what **Elm** and **Rust typestate** do — no instance,
because there is nothing to own.

**It has no home for actions**, which is the entire catch.

### The question is not really about instances

The pattern across prior art is exact: **everything that owns effects has a
host, and everything that does not, does not.** Elm has no instance because the
platform owns effects; Rust has none because values are all there is; XState,
robot3 and SCXML sessions all have one because something must own a running
timer.

So D1-vs-D5 is not a fresh decision — **it is axis 10 again.** Deciding that
actions ship with the definition (§12) is what forces a host to exist. If actions
had stayed outside, D5 would be available and the API would be two concepts
instead of three.

Which makes the honest framing: **the host is not a design preference, it is the
price of `actions`.** Worth stating plainly, because it is the one place the
project pays visibly for that decision.

### A correction this exposes

`.on()` is currently called on the **definition** and pushes into a closure array
inside it ([lib.ts:182](../explorations/candidates/n2-declared-types/lib.ts:182)).
That contradicts §12's own claim that "`actions` is the machine's own behaviour
and ships with the definition; `.on()` is a subscription attached by whoever
instantiates it". As written, two hosts running one definition would **share**
listeners, and a value documented as inert is quietly mutated by `.on()`.

**Subscriptions belong on the host.** That makes the ownership split structural
rather than conventional, and it leaves the definition genuinely immutable —
which is what lets it be exported, imported, diffed and visualised. The cost is
that the fluent `machine({…}).on(…)` one-liner stops being available at the
definition site, which is a small loss and arguably a clarification.

### The multi-instance argument does not hold

An earlier draft claimed P1.6 — independent uses of the same behaviour — forces
the split. **It does not.** D2 gets many instances from an ordinary function:

```ts
const makeDoc = () => machine({ … })
const a = makeDoc()
const b = makeDoc()
```

That is simpler than the split, and it costs one closure. So "you need several"
is not a reason, and the question has to be answered on something else.

### What the split actually buys — four arguments, three of which fail

| argument                                   | verdict                                    |
| ------------------------------------------ | ------------------------------------------ |
| several instances                          | ✗ a factory does this                      |
| the compiled index is built once           | ✗ a constant factor, not a design argument |
| replay and tests need no host              | ✗ weaker than it sounds                    |
| **composition takes and returns machines** | ✓ **structural, and the only one**         |

**Several instances — fails.** `const makeDoc = () => machine({…})`, as above.

**The compiled index — fails.** `step` does currently parse every key on every
send ([lib.ts:262](../explorations/candidates/n2-declared-types/lib.ts:262)),
which is a bug to fix in either design: compile `from → input → rows` when the
machine is **constructed**, not when it is sent to. Once that is fixed, the split
buys parsing once for _all_ instances rather than once _per_ instance — a
constant factor on tens of short strings, at interaction rates. Real, and far too
small to decide anything.

**Replay and tests — fails on inspection.** The claim was that replaying a log
needs no host under D1. But under D2, `step(liveThing, someValue, input)` still
works — it reads the table off the object and ignores its current state. Uglier,
not impossible. A clarity argument dressed up as a capability argument.

**Composition — holds, and it is structural.** `retry(fetchUser)`,
`race({ ok, late })`, mounting a child at a state (§10). Each needs a **recipe,
not a running thing**, for concrete reasons rather than aesthetic ones:

- `retry(child, { times: 3 })` must start a **fresh** attempt each time. Handed a
  live child it would have to reset one — a worse design and a new concept.
- A child mounted at `loading` starts on entry, tears down on exit, and starts
  **again** on re-entry. That is a new run each time, from a blueprint.

If a machine is a running thing, composing two of them means composing two
running things, which is not a coherent operation. §10 assumed inert definitions
throughout and never said so.

### Where this points

**One argument survives, and the decision reduces to it:**

> **Ship composition → keep the split. Do not ship composition → D2 plus a
> factory is simpler, and everything else offered here was rationalisation.**

A clean conditional rather than a judgement call. Composition is already listed
as the obvious next feature, so the split probably stays — but it should be
adopted _for that reason_, and revisited the moment composition is dropped.

**D3 is worth taking on top if the split stays** — `publication.start(data)` reads
better than `run(publication, data)` and removes an import, at the cost of one
method on the definition.

**And move `.on()` to the host**, which the current code gets wrong regardless of
how this resolves.

Still open: what the host is called (`run` / `interpret` / `start`), whether the
initial data is an argument or lives in the definition beside `initial:`, and
whether D5's pure path is documented alongside D1 or left as `step`.

---

## What is still open

- **Layout is a live three-way choice**, not a closed question. String keys is
  the recommendation; target keys wins co-location and classic records wins
  extensibility, and both are complete compiling prototypes.
- **Whitespace tolerance costs the grep story** — `->published` will not match
  `-> published`. A lint rule enforcing the canonical form would close it.
- **Editor completion responsiveness at ~4 000 union members is unmeasured.**
  TS 7.0.2's `--lsp` did not answer `textDocument/completion` even for a 4-member
  union.
- **Composition has no home in the current shape.** The mount block (G) is the
  cheapest answer that keeps every transition in the table; derived mounting (H)
  is strictly better if anyone finds a defensible rule for leaving a set of
  states.
- **`step` calls losing candidates' handlers.** Harmless under this design, real
  the moment effects go back in a handler, true of all three layouts.

## Where the code is

| Directory              | Proposition                  | State                                        |
| ---------------------- | ---------------------------- | -------------------------------------------- |
| `n2-declared-types`    | **string keys + `types<>`**  | ✅ whitespace-tolerant, listeners narrow     |
| `o1-classic-table`     | **classic records + `with`** | ✅ narrowing verified, traces pass           |
| `n1-transition-table`  | string keys, inferred vocab  | ✅ has the `playground.ts` completions demo  |
| `d1-target-keys`       | target keys                  | ✅ complete                                  |
| `d4-self-target`       | target keys + `&`            | ✅ compiles — moot since axis 4              |
| `c2-annotated-outcome` | annotated outcome            | ✅ Cases 1–4, live runtime, send-site checks |
| `d3-radical`           | by destination               | 🟡 lib + neutral only                        |
| `c1-edge-records`      | edge records                 | 🟡 cannot express the neutral machine        |
| `c3-target-list`       | target list                  | ⛔ intentionally does not compile            |
| `baselines`            | 3 rivals                     | ✅ switch-union, radix, sequential           |
