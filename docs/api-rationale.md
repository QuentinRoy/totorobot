# Design record

> The design itself is in [api.md](api.md). This document is the evidence behind
> it: what was considered, what was rejected, and why. It is organised by
> question, not by the order the questions were asked — where a position was
> reversed, only the surviving argument and the reason the other one failed are
> kept.
>
> Prior-art research is separate and still current: [`research/`](research/) —
> ten notes on automata theory, execution semantics, HCI state machines,
> typestate, TypeScript type engineering, and the JS FSM landscape.

## Contents

1. [The ledger](#1-the-ledger)
2. [How anything was judged](#2-how-anything-was-judged)
3. [What generation 1 cost](#3-what-generation-1-cost)
4. [Layout](#4-layout)
5. [The declared vocabulary](#5-the-declared-vocabulary)
6. [Self-transitions](#6-self-transitions)
7. [Immediate transitions](#7-immediate-transitions)
8. [Effects](#8-effects)
9. [Actions](#9-actions)
10. [Composition](#10-composition)
11. [Sending inputs](#11-sending-inputs)
12. [The host](#12-the-host)
13. [Type-system findings](#13-type-system-findings)
14. [The graveyard](#14-the-graveyard)
15. [Still open](#15-still-open)

---

## 1. The ledger

Twenty axes. Nineteen are closed.

| #   | Axis                       | Answer                                                        | §   |
| --- | -------------------------- | ------------------------------------------------------------- | --- |
| 1   | Overall layout             | string keys, input as arrow label — `'draft -submit> review'` | 4   |
| 2   | Data-free states           | `void` in the declared vocabulary                             | 5   |
| 3   | Entry / exit actions       | edge patterns with one end pinned; no keyword                 | 9   |
| 4   | Re-entry vs stay           | dissolved — it is an action's restart policy                  | 9   |
| 5   | Self-transition spelling   | `'draft -revise> draft'`, an ordinary row                     | 5   |
| 6   | Input vocabulary           | declared: `types<{ inputs, states }>()`                       | 5   |
| 7   | Returned commands (`emit`) | out — a listener recovers it from the transition              | 6   |
| 8   | Fall-through refusal       | no `else`; dev-mode warning                                   | 4   |
| 9   | Async / work-in-flight     | subsumed by axis 10                                           | 8   |
| 10  | Actions in the machine     | `actions:`, keyed by trigger, wrappers for policy             | 9   |
| 11  | The word for what you send | `inputs`, not `events` — the core is not a mailbox            | 5   |
| 12  | Typed send site            | **dropped** — broad `send` only; reversible later             | 11  |
| 13  | Composition                | **deferred from v1** — designed; outcome as state, not input  | 10  |
| 14  | Actions in v1              | **deferred** — v1 has no effect mechanism at all              | 9   |
| 15  | Immediate transitions      | `'from -> to'`, no input — designed; **deferred to v1.2**     | 7   |
| 16  | Observation                | `.on(pattern, fn)` on the host; no residency key              | 12  |
| 17  | Commit ordering            | one transition per input; commit, notify in order, queue      | 12  |
| 18  | Definition and instance    | **split kept** — `publication.start(data)`                    | 12  |
| 19  | Disposal and errors        | no `stop()` — the host owns nothing; a throw propagates       | 12  |
| 20  | What `send` returns        | **nothing** — additive to add later, breaking to remove       | 12  |

The axes are not independent. Declaring the vocabulary (§5) settles 2, 5 and 6 in
one move. Removing entry/exit settles 3, which makes 4 and 5 unobservable and
therefore moot — and allowing effects back in (§9) makes them observable again, so
4 and 5 have answers that only hold given the answer to 10.

## 2. How anything was judged

Fixed instruments, which is the only reason the sections below produce
conclusions rather than preferences.

**The four search questions** (Sunshine, Herbsleb & Aldrich — how people actually
read state machines). Every notation is scored on all four:

- **A** — what state is this in?
- **B** — what can I do in state X? _(the research says this one dominates)_
- **C** — in what states can I do Z?
- **D** — how do I get from X to Y?

**The arrow test.** Can a reader recover all four coordinates of a transition —
source, input, outcome kind, target — from fixed positions, after Prettier has
had its way?

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
  per-state data, and every input is accepted from every state with **no
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
views. The first of those is where 9 landed independently.

## 3. What generation 1 cost

The project started as a wrapper over [Robot3](https://thisrobot.life/), whose
compact functional vocabulary is still the aesthetic reference. Reading its
declarations against two real machines (a traffic light, an async auth flow)
exposed five gaps between what the types appeared to guarantee and what they
checked:

- **Modifier generics were not tied to the machine.** Each `reduce`, `guard` or
  `action` call was independently generic, so a wrong context annotation inside
  one compiled.
- **Event payloads were effectively untyped.** `send` checked `type`; everything
  else came through an `[key: string]: any` index signature.
  `send({ type: 'login', username: 42 })` compiled and failed at runtime.
- **`send` was not state-specific.** Accepted events were the union across the
  whole machine; sending one the current state did not handle compiled and
  silently did nothing.
- **Invocation wrappers were invisible.** A resolved promise arriving as
  `{ type: 'done', data }` was not described by the signature.
- **Context and state could not narrow together.** One flat context plus a state
  key. Narrowing to `'authenticated'` did not narrow a nullable `token`.

These are reasonable trades for a 1.2 KB dependency-free library. The question
this project asks instead is: **what can the types guarantee if typestate takes
priority?**

Three prototypes answered it. Inferring states from the map worked but reported
errors machine-wide; a Kysely-style fluent builder made payload inference
order-dependent and cascaded errors through the chain; declaring the spec first
shipped, and is what `src/` and [design-notes.md](design-notes.md) describe.

Three constraints from that generation still hold:

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

What actually went wrong was **architectural**: building each state through its
own generic helper call means each call is inferred in isolation and cannot see
its siblings. Passing the helpers as parameters of a **single contextually-typed
callback for the whole machine** makes TypeScript defer context-sensitive
properties and infer the non-function siblings first, so target data is known by
the time a reducer body is checked. The information did not arrive too late; it
arrived too late _for that arrangement of calls_.

Two caveats kept on record: removing the second declaration site is fragile
(`@cassiozen/useStateMachine` did it soundly and was silently broken by
TypeScript 5.4; Zag v1 deliberately moved the other way, back to a hand-written
schema), and `--isolatedDeclarations` consumers cannot export an inferred machine
at all (TS9010).

## 4. Layout

**Multi-target transitions are the discriminating test**, and they are harder
than they look: every candidate either failed them outright or paid for them
somewhere else.

| Candidate                                      | Verdict                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| **A** edge records — `{ to, with }`            | ✗ two independent compiler blockers; cannot express the neutral machine |
| **B** annotated outcome — `): To<'review'> =>` | ✓ works; lost because the target lives in a type annotation             |
| **C** declared target set as a value           | ✗ does not compile; kept as negative evidence                           |
| **D** target keys — `review: { submit: fn }`   | ✓ works; still alive as the co-location choice                          |
| **E** by destination                           | ✗ dissolves multi-target by transposing it; question B scatters         |
| **F** transition table — `state(on(…))`        | ✗ unverified crux; superseded by string keys                            |
| **M** combinator edges — `goTo('review', fn)`  | ✗ one verb, no antonym; per-edge tax                                    |
| **N** string keys — `'draft -submit> review'`  | ✓ **chosen**                                                            |
| **O** classic records — `{ event, from, to }`  | ✓ works; still alive as the extensibility choice                        |

**A — edge records.** Two separately measured blockers. A guarded-clause list
makes the edge type `Outcome | readonly Outcome[]`, and **a union of an object
type with an array of that object type makes every bare object edge in the whole
machine lose its handler parameter types** — 3× `TS7031`, bisected in
`blocker.ts`. Supplying the type arguments explicitly changes nothing, so a
second declaration site does not buy its way out. And **a guard does not narrow
its own clause's projection**: `when` and `with` are separate callbacks, so a
refinement established in the guard does not reach the data projection
(`Property 'reviewer' does not exist on type 'Submit'`). That is not avoidable
inside the encoding — the guard and the projection cannot become one function
without putting the decision back in a body, which is exactly what the encoding
exists to prevent. To compile at all its neutral machine had to split `submit`
and `decide` into four invented input names, **the same capitulation radix was
forced into**.

**B — annotated outcome.** The full scorecard: toggle 8 lines, neutral 60,
Case 1 135, Case 3 87, Case 4 178, send-site capabilities verified, 1 867 types /
6 109 instantiations / 0.004 s at 20 states. Its multi-target ternary is
**total**, so "every branch skipped by mistake" is a compile error rather than a
silent refusal — a real safety property no later winner has. It lost because the
target lives in a type annotation: reading it means switching into type-reading
mode, completions inside `To<'…'>` require the state-name union to be nameable
(it is not, in general), and the target is stated twice.

**D — target keys.** The target is a key, so it completes, renames and greps; the
handler just returns that target's data, with no wrapper, because the enclosing
key already said where this goes. It costs 10 lines against B and loses B's
totality property: with the decision split across branches, if every branch skips
by mistake the machine silently refuses.

**E — by destination** dissolves multi-target instead of solving it: every
entrance has exactly one target — the enclosing key — so a target _set_ never
exists. Question D stops being a search and becomes an index. The price is the
exact transpose: question B now requires reading every state's `from` block, and
B is the question the research says dominates. Its idea was kept anyway: the
reverse index is recoverable from any source-keyed layout **as a derived type**
(`Sources<M, To>`, `Targets<M, From, On>`), which E's own prototype demonstrated.
So the choice was never "which question do I want to be cheap" — keep the layout
that makes B a single block, and _derive_ the rest.

**F — transition table.** Line-order priority instead of key-order, `keep`/
`repeat` stop being reserved names, edges become values that factor. Two of those
three were available in D for free, and its crux was unverified: the handler's
context needs the data map _and_ the source state, neither of which is an
argument to `on(…)`, so they can only arrive through two levels of generic-call
inference. Every notation that failed in this project failed at exactly that
step.

**M — combinator edges.** Its deepest property is a genuine answer rather than a
workaround: every other technique fought over **key space** (`keep`/`repeat` took
two words from the author, symbols dodged collision but broke declaration order),
and combinators move the outcome vocabulary into **value space**, where it cannot
collide with state names by construction. It died because **`goTo` is a verb with
no antonym**: once re-entry collapsed into ordinary transition (§6), the outcome
vocabulary has exactly one verb, and a one-word vocabulary carries no
information. `toggle: 'on'` becoming `toggle: goTo('on')` is a per-edge tax for
the life of the project. **M becomes right again if the vocabulary ever grows
back.**

### The three that are still live

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
topology questions are a plain text search. `'draft -submit> review'` is not
four coordinates recovered from four positions in a nested structure — it is a
sentence with an actual arrow in it, and no formatter can reflow the inside of a
string literal. Several problems also simply stop arising: self-transitions need
no spelling, two targets for one input are two rows so there is no duplicate-key
question, and declaration order is visibly the priority order.

**What it costs, honestly.** Question B stops being co-located — `draft`'s
outgoing edges are greppable but no longer contiguous unless the author keeps
them together, and a flat table optimises the global view over the local one that
the research says dominates. Whitespace tolerance costs the grep story:
`->published` will not match `-> published`, and no formatter can normalise
inside a literal. And the key type must be an explicit template literal, since an
inferred plain `string` offers no completions at all and completion latency is an
acceptance criterion — which means the type is a cross-product,
|inputs| × |states|². **Measured** (`scripts/measure-completions.mjs`), and it is
not the problem it looked like:

| machine         | entries offered | response | cold  | warm  |
| --------------- | --------------- | -------- | ----- | ----- |
| 4 inputs × 4²   | 64              | 28 KB    | 40 ms | 2 ms  |
| 10 inputs × 20² | 4 000           | 1.7 MB   | 48 ms | 26 ms |

Latency is fine — 26 ms warm at 4 000 members is well inside a keystroke. But the
server **does not narrow**: it returns all 4 000 entries with `isIncomplete: false`
whatever prefix has been typed, so the collapse the playground asks about happens in
the editor's client-side filter, not in TypeScript. The cost is therefore payload
rather than compute — **~1.7 MB per completion request**, growing as |states|² — and
it is the number to set a threshold against. At the stated 2–20-state target it is
liveable; beyond it the split layouts, where each coordinate completes against
|states| or |inputs| alone, win on this axis rather than on taste.

**Why the other two stay alive.** Target keys remains the choice if co-location
matters more — it is the only live notation where a state's data and its outgoing
edges are one block. Classic records remains the choice if the table must be
extensible: priority, labels and metadata are just more fields, and nothing needs
explaining to anyone who has ever seen an FSM. It costs 6.6× the instantiations
and the arrow test. One non-stylistic piece of evidence for records turned up in
9: a `do:` slot on an edge is absorbed by a record as one more field, while
string keys and target keys grow a second value shape to hold it.

### Adopted: the label on the arrow

`'draft -submit> review'` rather than `'draft -submit> review'` — the input as an
arrow label, which is how every drawing tool spells it (mermaid `A -->|submit| B`,
DOT `A -> B [label="submit"]`, PlantUML `A --> B : submit`). **This is axis 1's
answer.** It arrived after the three-way comparison above, so the prototypes below
implement the leading-input spelling; the cardinality of the key type is identical
(|inputs| × |states|²), so every measurement in this section transfers unchanged.

**Three things decided it:**

- **The source sits at column 1 on every row.** Under the current form the source
  starts after a variable-width input name, so `submit: draft` and `open: draft`
  put `draft` at different columns and scanning a table for one state means reading
  past a ragged prefix. Question B is the one the research says dominates.
- **The label/no-label distinction becomes visible.** An omitted input position means
  "no input" (§7); in the labelled form that is literally an unlabelled arrow,
  `draft -> ready`, against a labelled one. In the current form it is the absence of
  a colon, which is subtler.
- Marginally shorter, and multi-target rows share a longer aligned prefix.

**Measured cost** (`scratchpad/arrow/`): a `-` is legal in a state or input name, so
the separator is only unambiguous if **whitespace becomes load-bearing**. With a
lazy `${infer F}-${string}>${string}`, an ordinary kebab-case name mis-splits and
does so silently:

```
'waiting-for-input -submit> ready'   →  from: 'waiting',  on: 'for-input -submit'
```

Requiring the space — `${infer F} -${infer On}> ${infer T}` — parses correctly, and
the compact spellings the current design accepts (`'draft-submit>review'`) then fail
to parse at all rather than mis-parsing. So the choice is: mandatory spacing, or a
last-dash recursion to disambiguate.

**Mandatory spacing may be a feature rather than a cost.** Whitespace tolerance is
what breaks the grep story today — `->published` does not match `-> published` — and
the stated remedy is a lint rule enforcing canonical spelling. Mandatory spacing is
that lint rule, enforced by the compiler. The same move is available to the current
form, so it is a wash rather than a point for either.

**Variable-length padding is rejected** — `'reading ---done> idle'` alongside
`'reading -submit> idle'`, so the target column can be aligned by hand. It parses
(measured: dash-trimming on both sides of the label, interior dashes in
`double-click` intact), and the alignment would make all four coordinates sit at
fixed columns, which no notation here has achieved. It loses on two counts. **Nothing
can re-align it after a rename** — and that is the notation's own headline virtue
inverted, since string keys won partly because no formatter can reflow inside a
string literal, which means none can re-pad one either. And **it makes the key type
infinite**, so the explicit template literal that completions require becomes
impossible. If it is ever wanted, leading-only padding (`-+label>`) is the version to
take: same alignment, and `label>` stays contiguous so question C is still a plain
text search.

**What it costs.** `->` intact is the most recognisable token in the notation, and an
arrow split around a word is something no reader has met before — a genuine
first-contact tax, paid once. And **whitespace becomes load-bearing**: exactly one
space before the `-` and one after the `>`, because `-` is legal inside a name and
`'waiting-for-input-submit>ready'` has no unambiguous reading.

That second cost turns out to be a benefit. Whitespace tolerance is what broke the
grep story — `->published` never matched `-> published`, and the recorded remedy was
"a lint rule enforcing the canonical spelling". Fixed spacing **is** that rule,
enforced by the compiler, so all three topology searches become exact rather than
approximate:

| question                | search     |
| ----------------------- | ---------- |
| what can I do in draft? | `'draft -` |
| where can I submit?     | `-submit>` |
| how do I reach review?  | `> review` |

**`-*>` is not in the language.** With no way to spell "some input, any input", `*`
appears only in state positions and the input coordinate is either a name or absent.
One wildcard, one meaning — and it removes the only place the labelled form read
worse than the leading-input one.

### Two decisions that fell out of the comparison

**No `else` keyword** (axis 8). An explicit `else: 'decline' | 'unreachable'` key
would make fall-through visible, but `else: 'unreachable'` throws at _runtime_,
so it costs a line on every multi-branch edge and buys no static guarantee. It
relocates the symptom. A dev-mode warning fires at exactly the same moment for no
API surface.

**`TS2820`'s did-you-mean suggestion is conditional on identifier length.**
`to: 'armd'` gets the suggestion; `to: 'onn'` gets a plain `TS2322`. Short state
names — common in small machines, which is the stated target — do not get it. The
diagnostic advantage originally credited to edge records was narrower than
recorded.

**And the risk of string keys was misjudged at first.** F and M were rejected
partly because the handler's context has to arrive through a standalone generic
call. That objection does _not_ apply to string keys:
`{ [K in keyof T]: Handler<Parse<K>> }` is a homomorphic mapped type over the
keys of an inferred object — structurally the same mechanism target keys already
used and that was verified to work. The keys happen to be compound strings, and
`Parse<K>` recovers the coordinates with template-literal inference. The risk was
**DX, not feasibility**, which is a different and more tractable problem.

## 5. The declared vocabulary

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
  `state()` — the actual type. (What made that safe was measured separately:
  omitting an inference site normally makes TypeScript discard the _entire_
  inferred state map, and the fix is to widen the constraint and move the "no
  data" default into `DataOf`.)
- **Axis 5, self-transitions.** With axis 4 deleted, a self-transition is just a
  transition whose target is its source.

**The two holes it closed are the real argument.**

_The `any` leak._ `state<T = void>()` puts the marker call in a position
contextually typed by the unresolved state map, so `T` infers as `any` — every
data-free state silently accepted anything, and every payload-free input accepted
any payload. A written `void` has **nothing to infer**. The bug is not fixed; it
is unrepresentable.

_The state-name inference cliff._ When every state was data-free and every
handler a closure, `keyof S` collapsed to `string` and target names stopped being
checked — needing a compile-time guard whose error message was the fix. Names are
now declared, so they cannot be recovered wrongly: `n2/check.ts` runs the exact
machine that broke `d1`, and it infers correctly with no guard in the library at
all.

Both are covered by `@ts-expect-error` cases, so a regression fails the build.
Declaring is also cheaper — 14 864 instantiations against 20 103 inferred, ~26% —
though that is small and not the reason.

**Costs.** States have no runtime existence (`types<>` erases to `{}`, so a
visualiser or a runtime exhaustiveness check has no source, and a state with no
transitions disappears entirely); state names appear in the type and again in
every transition key with nothing but the checker tying them; and hover text
inlines the whole literal unless the type is named, which is why
`types<Publication>()` is the documented idiom.

**The alternative shape** — `machine<Publication>()({ … })` — removes the `types:`
property but needs the double call, because TypeScript has no partial
type-argument inference (microsoft/TypeScript#53999). `()()` reads worse than one
extra property.

### `inputs`, not `events`

The minority word in JavaScript and the majority word in the formal literature.
Prior art splits cleanly along that line, and the split is not arbitrary — the two
words carry different semantics.

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

Four candidate words, two unavailable before the argument starts: `action` is
taken by the block that says what runs, and `message` implies a sender and a
recipient this design does not have. Two arguments decide the rest:

- **The core is not a mailbox.** A transition is a pure `(state, input) -> state`
  function and the host is optional. "Event" is the word from the statechart
  lineage, where it comes bundled with a queue, broadcast, and run-to-completion
  semantics this core deliberately does not have. Using it would promise
  semantics that are not there.
- **Capabilities read as an interface.** A state exposes only what it handles.
  That is something you are _permitted to do_; an event is something that
  _happens to you_, and you do not ask an object for its available events and
  then call one.

**Rejected argument:** that `.on()` decides it, because calling the things you
send "events" would make one word name both directions. Plenty of libraries have
both directions and manage — the DOM dispatches and listens for one `Event`,
XState qualifies by verb, and most subscriptions deliver state rather than
events. Ours delivers a **transition record**, `{ on, input, from, to }`, so the
collision is fixable from the other end. `.on()` is a convenience for `input`,
not a reason.

**What it costs**, and this is real: every JS reader arrives knowing "event", so
`inputs:` is one translation on first contact, against P1.1. **Worse, `input` is
not unclaimed** — XState v5 uses it for the parameters passed to an actor when it
is spawned (`createActor(machine, { input })`), so the word collides in exactly
the population most likely to read this one. That is the strongest case for
`message` as a third way. And a few members of the vocabulary genuinely are
events — `loaded` and `timeout` arrive on their own. The counter is that the
vocabulary _mixes_ kinds: `submit` and `cancel` are commands, `loaded` and
`failed` are notifications. A neutral word beats one that biases toward either,
and "input" names the _slot in the transition function_, not the provenance of
what fills it.

This is a naming decision only. The keys are `'draft -submit> review'` either
way, and the context member is `input` rather than `event`.

## 6. Self-transitions

When a transition targets the state you are already in, does residency re-run?
Ten spellings were proposed:

| ID  | Mechanism                                                | Out because                                                                                                                                      |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1  | reserved keys `keep` / `repeat`                          | takes two words from the author's namespace                                                                                                      |
| T2  | symbol keys `[keep]`                                     | collision-proof, but **breaks branch priority** — `Reflect.ownKeys` returns string keys first, so a `[keep]` branch written first runs last      |
| T3  | self-name only                                           | cannot express the distinction at all                                                                                                            |
| T4  | distinction in return position, `repeat({…})`            | moves it out of key position into a body                                                                                                         |
| T5  | `&` as self-reference                                    | four outcomes, zero reserved words; only key in the notation needing quotes                                                                      |
| T6  | per-state `rerunOnSelf: true`                            | a per-edge decision made per-state                                                                                                               |
| H   | residency identity, `identity: ({data}) => data.gesture` | React's `key` applied to a state; forces a counter into the data that exists only to drive the restart                                           |
| I   | two blocks, `on` and `while`                             | an input that _conditionally_ stays or leaves must appear in both, with its guard written twice, negated                                         |
| J   | `restartOn: ({input}) => input === 'settle'`             | one line instead of twelve for a state with twelve self-transitions; names inputs in a second place                                              |
| L   | the **form** of the edge value decides                   | function = stay, object = branch map, string = go; cheapest to teach, and its hole — an edge cannot both stay _and_ branch elsewhere — is Case 1 |

**T1 was hiding a real bug**, worth keeping on record. Every property of the
branch-object type is optional, so a bare string is structurally assignable to it.
The only reason an invalid bare target name (`cancel: 'busyy'`) was ever rejected
is that `String.prototype.repeat` collides with the reserved `repeat` key and
produces a type mismatch. Rename `repeat` and target-name checking silently stops
working — which is what happened the first time `&` was tried. Fixed by
intersecting the member with `object`; the guarantee had rested on an accident.

**Then the whole feature deleted itself.** `keep_state` and `repeat_state` are
observationally identical unless something runs on entry or exit. That is not an
opinion — it is how every prior art defines it. Erlang's `repeat_state` differs
from `keep_state` only in repeating the state-enter call; XState v5's
`reenter: true` exists to control whether entry/exit actions and invoked actors
re-run; SCXML's internal vs external transitions differ only in which onexit /
onentry handlers execute. **Remove entry/exit from the definition and the
distinction has nothing left to denote.** It does not become rare; it becomes
unobservable. Checked against the acceptance cases: every place it would have
mattered — the marking menu's dwell clock, the request race's timeout — is a
**timer**, not an entry/exit action.

That produced a cleaner boundary than "no side effects in the definition":

> **Causes in, consequences out.** A timer is a _cause_ — a source of inputs, a
> reason the machine moves — so removing it from the definition would make the
> definition stop telling you every way the machine can transition, which is the
> one thing it must tell you. An action is a _consequence_: nothing about the
> machine's behaviour depends on it, so it can be attached from outside without
> the definition becoming a lie.

**What dropping entry/exit cost:** a measured consolidation disappeared (using
residency for the marking menu's dwell had moved `cancelDwell` from three edges to
one place — that survives with an external listener scoped to "while in
`tracking`", it just moves out of the file), and the machine stops telling you
what it _does_. That is a locality cost, not an expressiveness one: a transition
is identified by (source, input, target), so an external listener can
pattern-match at exactly the granularity inline actions gave.

**Axis 7 (`emit`) closed with it**, on three grounds in ascending order of force:
another concept to learn on a project whose thesis is that the table reads without
explanation; **strictly redundant**, since a listener receives
`{ on, input, from, to }` with data on both ends and everything a pure handler
could compute is already in `to.data`; and **the direction is asymmetric** —
adding `emit` later is additive, removing it later is breaking.

9 reverses the premise of all of this and none of the conclusions: the ten
spellings stayed dead, and axes 4 and 5 stayed dissolved, for a _different_
reason — the answer moved to the action.

## 7. Immediate transitions

> **Designed; deferred to v1.2, with composition.** No objection to the shape. The
> reason to wait is that chaining is the one feature that forfeits guaranteed
> termination — see the end of this section.

A transition that fires on **entering** a state rather than on an input. The
spelling is the transition key with the input part removed:

```ts
transitions: {
	'draft -submit> checking': ({ data }) => data,
	'checking -> allowed':       ({ data, skip }) => (data.quota > 0 ? data : skip()),
	'checking -> denied':        ({ data }) => ({ reason: 'over quota' }),
}
```

On arriving in `checking`, its immediate rows are tried in declaration order.
Everything else is the machinery that already exists: `skip()` falls through to the
next candidate, declaration order is priority order, and the handler receives the
source data and returns the target's. **A guarded choice therefore needs no new
concept** — no `cond`, no junction pseudostate, no `always` block. It is the
multi-target mechanism with the input coordinate deleted.

### Why it is wanted independently of composition

- **Transient states** — a state that exists to make a decision, not to be waited
  in. The classic statechart junction, expressible today only by inventing an input
  nobody sends.
- **A child's outcome is a state, not an input** (§10). `'loading.ok -> ready'` is
  the same grammar, and this is what makes the outcome spellable without lying
  about who sends it.
- It is already on the README's list of missing features, and requirements
  [Probe 2](requirements.md#probe-2--automatic-or-eventless-transitions) reserves
  the question — a finalist "may be tested by sketching their cascading and
  observability semantics", which is what the rest of this section does.

### Prior art, and what it says

| source          | spelling                       | note                                                                  |
| --------------- | ------------------------------ | --------------------------------------------------------------------- |
| SCXML           | `<transition>` with no `event` | taken when its condition holds, in **document order** — the same rule |
| XState v5       | `always: [{ guard, target }]`  | a separate block on the state; guards ordered                         |
| UML statecharts | junction / choice pseudostates | a whole extra node kind for what is here a row                        |
| robot3          | `immediate(target, guard)`     | already wrapped in `explorations/robot3-wrapper.ts`                   |

Two findings are already recorded in that wrapper and carry over:

- **An immediate contributes nothing to what a state _handles_.** It is typed
  `handles: never`, because it is not sendable — so it must not appear in
  `Handled<T, S>` or in `doc.available`.
- **robot3 reuses whatever event caused entry** as the immediate's event, which the
  wrapper calls "untyped rather than mistyped". This design avoids the question
  entirely: there is no input, so the handler has **no `input` binding**. Reading
  one is a compile error, which is the honest answer.

### One language, two uses

The key rule extends to three forms and stays decidable from the string alone:

| key                 | meaning             |
| ------------------- | ------------------- |
| no arrow            | a state (residency) |
| **arrow, no colon** | **immediate**       |
| arrow, with colon   | an input edge       |

There is **one** key language. What differs is what a key is being used _for_:

- **Declaring**, in `transitions` — the key _names_ an edge that exists. Every
  coordinate must be concrete; `*` is meaningless, because "some edge with an
  unspecified input" is not a thing you can declare.
- **Matching**, in `.on()` — the key _selects_ edges. A coordinate may be left
  unconstrained.

An omitted input position reads identically in both: **no input is named.** A
declaration has to be complete, so that means the edge has none — it is immediate. A
pattern does not, so it means the input is unconstrained — and an immediate
transition, having no input, is matched by it. The pattern reading is the superset
that contains the declaration reading. `.on('a -> b')` therefore fires for every
transition from `a` to `b`, **immediate or not**, which is the useful answer as well
as the consistent one.

**An objection that does not hold**, recorded because it looks plausible and cost a
round: that this breaks the key rule, since the same string would mean "no input"
when declared and "any input" when matched. It does not. The key rule discriminates
**state from edge** — `'review'` against `'* -submit> *'` — and `'a -> b'` has an
arrow, so it is an edge in both uses and the rule answers identically. How
_completely_ an edge's coordinates are filled in is a different axis, one the rule
never spoke to. If it did, `*` would already be a violation, since `*` is legal in a
pattern and meaningless in a declaration.

### `*` requires an input; an omitted position does not

`*` means **any input, and there is one**. It does not match the absence of an
input. So the two spellings are not the same pattern, and the omitted form is
strictly broader:

| pattern     | matches                                                   |
| ----------- | --------------------------------------------------------- |
| `'a -> b'`  | every transition `a → b` — input-driven **and** immediate |
| `'a -> b'`  | the input-driven ones only                                |
| `'a -x> b'` | that one edge                                             |

**This changes how entry and exit should be written.** They were spelled
`'* -> loading'` and `'draft -> *'`, which now say "by some input" — so they
would miss an arrival or a departure taken immediately, which is exactly the kind of
silent gap the pattern language exists to avoid. Dropping the input position instead
gives the intended meaning:

```ts
'* -> loading' // entry: every arrival, by any route
'draft -> *' //   exit:  every departure, by any route
```

That is a better shape than the sugar reading it replaces. Omitting a coordinate now
does real work rather than being a shorter way to write `*`, and the two forms are
each reachable: `'draft -> *'` for "leaving, however", `'draft -> *'` for "leaving
because someone sent something".

**What it costs:** nothing selects _only_ the immediate edge in the general case —
`'a -> b'` is too broad and `'a -> b'` excludes it. In practice the broad form is
exact whenever no input-driven `a → b` is declared, and nobody has asked for more.

The distinction also stays rare, for a structural reason: **an immediate transition
makes its source transient**, so there is usually nobody in that state to send it an
input, and both patterns then have the same edges to choose between. The exception is
the case §10 records — if every immediate candidate calls `skip()`, you stay, and
input edges out of that state (`'loading.ok -cancel> empty'`) become meaningful.

### What it forces open

- **Termination — and this is why it is deferred.** `'a -> b'` with `'b -> a'`
  spins. Note 02's F6 puts it at the level of a guarantee rather than a cost:
  _"the only way to have a big step that provably terminates is to forbid chaining
  — one input, at most one transition. Every 'immediate' / 'always' / eventless /
  transient transition feature buys expressiveness by giving up the termination
  guarantee."_ XState #721 is that bug in the wild, and Stately's own docs concede
  only that XState "will help guard against most infinite loop scenarios". A step
  budget or **each state entered at most once per settlement** (the statechart
  microstep rule) is mitigation, not recovery. v1 keeps the guarantee; composition
  is where the expressiveness is actually needed and where the price is worth
  paying.
- **Run-to-completion stops being avoidable.** One `send` causes a chain, so
  Big-Step Maximality and Order of Small Steps both go live (§12), on top of the
  queue v1 already has.
- **Does the initial state settle?** If `initial: 'checking'` and `checking` has
  immediate rows, the machine is never observably in `checking`. Consistent with
  "on entering", and it means `run()` can return a host already somewhere else.
  Defensible, and it should be stated rather than discovered.
- **The listener event has no input.** The `.on()` event is a union discriminated
  by `on`; an immediate transition has nothing to put there. Either a `null`
  discriminant or a separate arm — undecided, and small.

**One thing it improves**: the arrow test. There is no fictional input on the line,
so source, target and handler are all that remain.

## 8. Effects

Three questions, asked separately and answered together: how work-in-flight is
expressed, whether the core may perform effects at all, and where the effects go
(§9) once it may.

### Five ways to express work-in-flight

Against a running example that exercises both halves at once: a fetch starts on
entering `loading`, a 5 s timeout races it, both stop on the way out. The seam
that organises all five is Elm's — **`Cmd`**, one-shot, started _by a transition_
(a fetch); **`Sub`**, continuous, a function of _which state you are in_ (a timer,
a socket, a poll). The second half is what needs residency scoping and
cancellation.

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
- **B, `'loading -timeout> failed': after('5s')`** — best visibility by a
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

**One thing none of them fixes:** all five leave the fetch _running_ when you
abort — a signal stops the machine from caring, not the server from working.

### Composition subsumes the question

A promise is `pending -> fulfilled | rejected`. A socket is
`connecting -> open -> closed`. A timer is `waiting -> fired`. If in-flight work
is _already a machine_, the library does not need an async vocabulary — it needs
**one way to embed a machine in a state**, and async comes free. That is axis 9
folding into axis 10, and the design is §10.

**robot3 already does this literally**, in about 40 lines: `invoke(fn, …)`
dispatches on whether the call returns a promise, a machine, or a function
returning one. Three findings from reading it:

1. **No cancellation and no cleanup hook at all.** An identity check is the whole
   staleness story; leaving an invoking state **abandons** the work rather than
   stopping it. A shipping 1.2 KB library accepted that trade — evidence that
   "ignore the result, do not cancel the work" is liveable.
2. **No timer, interval, socket or poll vocabulary exists.** A timeout is
   `invoke(() => new Promise(r => setTimeout(r, 5000)))`. Empirical support for
   the thesis: one primitive really was enough.
3. **It mounts the child at the state — and we cannot.** robot3's states are
   _values_, so the mount has an obvious home. Ours are _types_, declared in
   `types<>`, so there is no value-level slot to hang it on. **A real consequence
   of §5**, and the reason every mounting option needs a block or a derivation.

Composition also obsoletes C's resource vocabulary — the resources become library
machines — and demotes A to **the leaf primitive**, written once per kind of work
rather than once per state.

**The honest limit:** composition **relocates the effect boundary, it does not
remove it.** At the bottom of every tree is a leaf that really calls `fetch`. "A
promise is a state machine" describes its _shape_, not its _execution_. It
collapses N vocabulary items into **one** primitive, not zero.

### The effect-free core, and why it fell

That limit prompted a correction which was itself a mistake, and both directions
are worth recording.

The correction: two claims had been running together. _Something must call
`fetch`_ — true, unavoidable, uninteresting. _That something must live inside the
library_ — **false**, and it looked like the one that mattered. The transition
function is already pure. What would take that away is exactly what `within` and
`invoke` propose: IO closures inside the definition, and then the library needs a
scheduler to call them, track their lifetimes and cancel them.

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

Five variants were worked through — P do nothing / Q descriptions in a `while:`
block / R the mapping outside the machine / S handlers return data _and_ commands
/ T generators yielding descriptions.

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
That reopens §5. (10 finds the crack in this argument: it holds only if children
are _inferred_.)

Verdict: **the constraint costs more than it pays.** The machine may perform
actions.

Option S is worth one note, because it is the only shape that puts "this
transition starts a fetch" on the line where the transition already is, and
because it **reopens axis 7 legitimately rather than contradicting it**: that
decision was about _outgoing notifications_, which a listener can recover from
`{ on, input, from, to }`. _Starting work_ is not recoverable that way, so the
redundancy argument does not transfer.

## 9. Actions

With effects allowed back in, the question is where they go — and it is settled by
concern structure, not taste.

### The constraint

The declaration is one block per job: `inputs` what can happen, `states` what we
can be, `transitions` how we move. A proposition is judged first on whether it
keeps that true. And the diagnosis is sharper than "actions break it", because
**the overload predates actions**: the handler already does **two** jobs — it
decides (`skip`) _and_ projects the target data. `o1`'s README celebrates that
fold, correctly, because splitting `guard` from `map` lost narrowing (§4). "And
it acts" makes three; proposition Z below made it **four**.

### What the word has to cover

| #   | Kind              | Example                        | Shaped like | Needs                |
| --- | ----------------- | ------------------------------ | ----------- | -------------------- |
| 1   | Transition action | `track('submitted')`           | **edge**    | nothing              |
| 2   | Command           | fetch, then `send('loaded')`   | **edge**?   | `send`               |
| 3   | Activity          | socket, timer, poll            | **node**    | residency + teardown |
| 4   | Entry / exit      | focus an input, release a lock | **node**    | residency            |

**Kind 3 decides everything: the test any proposition must pass is expressing a
socket.** A design that only decorates edges cannot say "this is open while we are
here", and fakes it by pairing an entry edge with every exit edge — the drift the
table exists to eliminate.

**Kind 4 turns out not to be its own kind.** Entry and exit are transition actions
with one end pinned — `'* -> loading'` and `'draft -> *'` — and the pattern grammar
already parses both. Axis 3's original question answers itself. It
collapses a second time from the other direction: **a residency action with no
teardown _is_ an entry action, and one that only tears down _is_ an exit action**
— `loading: fn` and `draft: () => fn`. The two spellings agree because the default
is to restart (below). The pattern form survives because it can scope the trigger
more narrowly than "arriving" or "leaving" — by the input, or by the other end of
the edge — which residency cannot express. But nothing needed a keyword, which was
the question.

The question mark on kind 2 is a finding, not a hedge: **a command placed on an
edge duplicates across every edge _into_ the state.** `load: idle -> loading` and
`retry: failed -> loading` both have to start the fetch, and an edge added later
silently does not. Attached to residency it is written once and is automatically
right. That is what rules out the edge-based propositions on merit rather than
taste.

### The seven that lost

| ID  | Proposition                                         | Out because                                                                                                                                                                                                           |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U   | the handler performs                                | takes the handler to three jobs; no node to hang a socket on                                                                                                                                                          |
| V   | a `do:` slot on the edge, beside `with:`            | duplicates across every edge into the state; a second value shape; fails the socket test — but it is **the first non-stylistic evidence for records over string keys**, since a record absorbs `do` as one more field |
| X   | `.on()` / `.within()` as the action layer           | moves the whole action layer outside the definition — **and this is what v1 ships anyway**, see below                                                                                                                 |
| Y   | actions as data, interpreter supplied by the caller | this is §8's effect-free core                                                                                                                                                                                         |
| Z   | handler acts, multi-target returns its own target   | dissolves axis 8 and the `skip`-ordering semantics — but takes the handler to **four** jobs, the diagnosis in its most concentrated form                                                                              |
| AA  | cleanup via `Symbol.dispose` on the state's data    | elegant, and a TC39 standard rather than a concept of ours — but the disposer must be constructed inside the handler, so same overload                                                                                |
| AB  | no feature at all; a named async function drives it | not rejected — **the baseline this has to beat**, and the visibility complaint largely evaporates once the function has a name                                                                                        |

### Why a block, not a chain

X can express everything the block can, costs nothing in the core, and half of it
is already built. Three things decided it:

1. **The definition is complete.** `machine({…})` is a value that gets exported
   and imported. If behaviour arrives through `.within()` calls afterwards, the
   exported thing is not the machine — it is half a machine plus a convention that
   every caller remembers to configure it. In practice you would export a factory,
   and the definition would stop being the definition.
2. **Declarative, in one place.** A chain is imperative and order-dependent, can
   be applied conditionally, and can be spread across modules. A block cannot.
3. **Symmetry.** Everything else is a block.

**`.on()` survives with a different job**: `actions` is the machine's own
behaviour and ships with the definition; `.on()` is a subscription attached by
whoever instantiates it. That is also why axis 7 settled where it did.

### The block is `actions`, not `states`

Calling it `states:` would be a lie: the states are already declared in `types<>`
and every one appears in the table. The block declares **what runs**. Naming it
after its content also freed its shape — it is no longer obliged to be a map keyed
by state name, which is what made trigger-keying possible.

Three shapes were considered: **records** (`[{ within: 'loading', run: fn }]` — a
list, so two activities in one state stay separable; extensible in `o1`'s sense),
**constructors** (`[within('loading', fn), on('draft -cancel> *', fn)]` — reads
best of the three; this is proposition M, which died for _transitions_ on per-edge
tax, but actions are sparse so the tax is near nothing here), and **trigger-keyed**
(`{ 'loading': fn, 'draft -cancel> *': fn }` — no new syntax at all, since both
key languages already exist).

**Trigger-keyed won**, because it pairs with string keys: they are the same idea
applied twice — one key language, parsed, doing the work that structure does
elsewhere. Constructors were the near miss; they would have been the only place in
the API using them on every line, and none of the three live layouts has that
concept.

### Restart, and how the policy is spelled

Actions make `draft -> draft` observable for the first time, so axes 4 and 5 —
closed in §6 _because_ entry/exit had gone — had to be re-answered.

First, a collapse: **restart-on-re-entry and restart-on-resident-data-change are
one question.** Resident data can only change via a transition into the state you
are already in. So there is a single policy at two granularities: restart on any
self-transition, or restart only when something relevant changed.

Four spellings, and the reasons three lost:

- **Omit the target** — `'draft -revise>'` stays, `'draft -restart> draft'`
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

(`stay` and `next` were never candidates: a handler returning data under a key
that reads `draft -> draft` already _is_ a stay. `stay` and `skip` are also **not**
the same thing — `skip` changes nothing, commits nothing, and falls through to the
next candidate; `stay` changes data and consumes the input.)

That leaves _how_ it is written, which is a separate question because
trigger-keying gives the action no options slot — its whole appeal is a bare
function value. Putting the policy in the **key** (`'-> loading'` for each entry,
`'draft ->'` for exit) was the runner-up and is fully superseded: its one
advantage was a spelling for entry and exit, which the pattern grammar already
provides without a third key form.

**Wrappers won.** The common case stays a bare function and a constructor appears
only at the exception, which answers the objection to constructors-everywhere. And
the wrapper **returns a record** — `persistent(fn)` → `{ run: fn, restart:
'never' }` — so a bare function is sugar for `{ run: fn }`, the block stays
inspectable as data, and new policies are new wrappers rather than new syntax.
**That is the records proposition with a constructor as its ergonomic front door**,
and the convergence is the strongest argument for it.

That property also absorbed what looked like a separate question. A finer-grained
policy — restart only when something relevant changed, spelled as an object value
`{ run: fn, key: ({ id }) => id }` — appeared to need a second value shape, which
was the main cost counted against wrappers. It does not: written as `keyed(k, fn)`
it is one more constructor producing one more field. So the layering is not
"coarse now, object values later"; it is **one mechanism that grows**. `keyed` is
therefore _not_ in the initial API — there is no use case for it yet, and the whole
point of the shape is that adding it later costs nothing. Same for `once` or
`debounced`.

**The default is to restart**, for two reasons:

- **It fails safe.** Forgetting the wrapper under a survive-default leaves an
  activity closed over stale data — a correctness bug. Forgetting it under a
  restart-default tears something down unnecessarily — a performance bug.
- **It puts the wrapper on the rarer thing.** A fetch should restart when you
  re-enter `loading`; a long-lived socket is the exception.

It is also consistent with the pattern grammar: `'draft -> *'` matches
`draft -> draft`, so an exit action fires on a self-transition — exactly what
re-entry means under this default. The two rules agree rather than needing
reconciliation. (The opposite default — residency is the state's name being
current, so a self-transition restarts nothing — is coherent, and loses on both
counts above.)

### What actions cost

**Axis 3 reopens by definition**, and the block is **opaque**: nothing in the table
says `loading` fetches, so grep `-> loading` finds the edges but not the work. That
was the fatal complaint against `within` in §8, and attaching to residency does not
answer it — it only gives the closure a defensible lifetime.

Three properties come free, and they are what the rejected options paid for: **the
type never grows** (`send` sends only already-declared inputs, so `actions` adds
nothing to the vocabulary — this works _because_ it is less powerful than a mount);
**it cannot drift** (state names are checked against the declared vocabulary); and
**it is the standard answer** (Harel, SCXML, XState and `gen_statem` all attach
activities to nodes).

### The bare-key conflict, and the rule that closed it

Residency wants a bare key, and the listener language already gave bare keys a
different meaning — a pattern's first arm is an input name. Left alone, the same
syntax would mean an input in one block and a state in the other, and a name that
is legally both — `review` is plausibly both, and the neutral machine has it as a
state — would compile under the wrong reading with **no error**.

> **A key with no `->` names a state. An edge always contains an arrow, even when
> both ends are `*`.**

Decidable from the string alone, so a reader never has to know which block they
are in. The competing fix — rejecting bare keys in `StateName & InputName`, which
is computable since both vocabularies are declared — only patches the silent case
and leaves two meanings standing.

A consequence worth noticing: under one shared key language, `.on()` can also
accept a bare state key and mean residency, with the same setup-and-teardown
shape, making `.on` and `actions` structurally identical and differing only in who
owns them. That is what v1 uses.

### Not in v1

**Do actions earn their place without composition?** Honestly, in both directions.
They do buy something on their own: residency-scoped lifetime with automatic
teardown, written once per state rather than once per incoming edge, plus a restart
policy. Two shipping libraries — Zag (2.3 KB) and `useStateMachine` (1.1 KB) — offer
exactly this and nothing more.

**But the complaint lands anyway**, and the opacity above concedes the half that
matters. Nothing constrains what a residency closure does:

```ts
actions: {
	loading: ({ data, send }) => {
		fetchUser(data.id)
			.then((u) => send('loaded', u)) // nothing says loading can only produce
			.catch((e) => send('failed', e)) // `loaded` or `failed`
	},
}
```

Any action may send any declared input; retry, timeout and sequencing are
hand-rolled inside the closure; and aborting stops the machine caring, not the
server working. Actions fixed `within`'s **lifetime** problem and inherited its
**visibility** problem. In its sharp form: **actions without composition are a
lifetime rule bolted to an opaque closure**, which is `useEffect` with better
scoping.

**So `actions` is deferred, and v1 ships no effect mechanism at all** — not a block,
and not the residency-keyed listener that was briefly going to stand in for one. An
intermediate plan had `.on()` carry residency in v1 and `actions` arrive beside it in
v1.1. That plan died with the listener registry (§12): the two would have been the
same shape with two owners, and §9's own open question — "if both attach to `draft`,
what is the run and teardown order?" — is a question worth never having.

What v1 has instead is proposition **AB**: a named function, driven by the observer.
Listed above as _"not rejected — the baseline this has to beat"_, and shipping the
baseline first is a coherent plan rather than a retreat.

Three reasons to defer:

1. **Actions cannot be specified until commit ordering is.** v1's ordering is four
   rules because only one thing happens per commit (§12). With actions, teardown,
   setup and notification all happen inside one commit and need an order, plus an
   answer for a throwing action. Shipping actions first means guessing.
2. **The residency mechanism should exist exactly once.** Whichever way it is
   spelled, there should never be two of them.
3. **v1 becomes the effect-free core for free.** §8 wanted exactly this and rejected
   it because making it _complete_ needed a description vocabulary, a reconciling
   driver and an identity rule. None of that is needed if the caller attaches
   effects imperatively: the definition stays pure, serialisable and replayable, and
   only ergonomics pay.

**What v1 gives up, plainly.** An imported machine is topology and data only, and
scoping an effect to a state — start on entry, stop on exit — is the caller's
bookkeeping:

```ts
let cancel
const doc = run(publication, (e) => {
	if (e.from.state === 'loading') cancel?.()
	if (e.to.state === 'loading') cancel = startFetch(e.to.data.id, doc.send)
})
```

That is the cost, and it is the thing `actions` exists to delete.

## 10. Composition

> **Designed, deferred.** This is the design to return to, not the plan.

### There are two compositions, and the evidence points at the neglected one

The async question is only about mounting a child **inside** a state. The
strongest external evidence in the repo is about something else:

> The SwingStates authors report that state explosion is **not** an issue within
> a single interaction technique and appears only when _combining_ techniques.
> Their fix, and ConstraintJS's independently, is **parallel small machines with
> light communication — never hierarchy**. — [requirements.md](requirements.md),
> P2.9 amendment, from [note 04](research/04-hci-critiques-and-alternatives.md)
> F7/F8

SwingStates names three patterns, and only one of them is a mount:

| pattern                | mechanism                                                        | replaces               |
| ---------------------- | ---------------------------------------------------------------- | ---------------------- |
| **Parallel machines**  | several machines on one component, communicating by events       | AND/orthogonal states  |
| **Stacking**           | machine per abstraction level; each emits what the next consumes | ad-hoc event synthesis |
| **Shared transitions** | a common transition factored into a shared state class           | Harel super-states     |

Their published Marking Menu — **this project's own acceptance case** — is
**three parallel machines** (linear menu, marking menu, item highlighting), while
[acceptance-cases.md](acceptance-cases.md) Case 1 folds all three into one. Two
independent labs six years apart converged on this; the amendment calls it "as
close to consensus as this literature gets".

So:

- **Vertical composition** — a child runs _while_ we are in a state. Solves async.
  This is robot3's `invoke` and XState's actors.
- **Horizontal composition** — peers run _alongside_ each other. Solves modularity
  and state explosion. This is P2.1, and it is what the field converged on.

They are different problems and probably want different mechanisms. Conflating
them is what made the earlier attempt feel unsolvable.

### What the rest of the record forbids

1. **Hierarchy is out.** Keys become paths, `Handled`/`Sources` become recursive,
   the arrow test dies, grep stops being one hop, and every layout decision is
   re-litigated. "A different project."
2. **A mount grows the input vocabulary** (§8) — `loading.ok`, `loading.rejected`
   — and §5 declares the vocabulary up front.
3. **Actions work _because_ the type never grows** (§9): _"this works because it
   is less powerful than a mount."_
4. **Siblings in one object literal cannot see each other's inferred types**
   (§4, option-e). A `run:` block beside `transitions:` inherits that.
5. **P2.1**: parts keep their own typestate and effect ownership, and "composition
   must not require hierarchical or parallel states in the core API".
6. **P2.3**: "a general actor or observable model is unnecessary."
7. **Size**: XState is the only surveyed library with real composition, at
   **12.7 KB**. Everything else is 1–2.3 KB with `invoke`-for-promises or nothing
   ([note 07](research/07-js-fsm-library-landscape.md)).

Constraint 4 has a crack in it. A mount "cannot be a block… and must be a fluent
chain" holds only if the children are **inferred**. If they are **declared** — in
`types<>`, beside `inputs` and `states` — the derived inputs are computable at the
same moment as everything else, by a mapped type, which is §13 finding 10's safe
mechanism. §5's own answer applies to its own objection.

### Three designs

Each answers **both** halves — async and modularity — because a design that
answers only one is half of someone else's. They differ on a single question:
**where does a child machine live?**

|                                  | Peers                  | Children                     | Inlining           |
| -------------------------------- | ---------------------- | ---------------------------- | ------------------ |
| a machine inside a machine       | never                  | at runtime                   | at definition time |
| machines at runtime              | many, flat             | a tree                       | **one**            |
| new runtime concepts             | none                   | child lifetime, cancellation | **none**           |
| new type machinery               | little                 | moderate                     | **heavy**          |
| async is                         | an action wrapper      | a mounted child              | inlined rows       |
| the work is visible in the table | ✗                      | ✓                            | ✓                  |
| wiring lives                     | outside the definition | inside                       | inside             |

#### Peers — a machine is never inside a machine

Composition is several machines running **side by side**, wired by subscriptions.
Async is not composition at all; it is an action whose outcomes are declared.

```ts
// modularity — SwingStates' Marking Menu, as its authors actually built it
const menu = runAll({
	linear: linearMenu,
	marking: markingMenu,
	highlight: highlighter,
})

menu.marking.on('* -> recognized', (e) => menu.highlight.send('clear'))
```

```ts
// async — an action wrapper, not a child
actions: {
	loading: invoke(({ data }) => getUser(data.id), { ok: 'loaded', err: 'failed' }),
}
```

`invoke`'s outcome map is what makes this typed rather than a bare closure: its
values are checked against `Handled<T, 'loading'>`, so `loading` provably produces
`loaded` or `failed` and nothing else.

**Why it is credible.** `runAll` returns a **host of hosts**, not a machine — if it
were a machine its state would be the product of its children's, which is parallel
states, which P2.1 forbids in the core. So the core is untouched: no child
lifetime, no cancellation semantics, no vocabulary growth. It is also exactly what
two independent labs converged on.

**Its real weakness** is not the obvious one. The peer wiring lives _outside_ the
definition, as imperative `.on()` calls a caller must remember to make. That is
precisely the shape §9 rejected for actions: _"the exported thing is not the
machine — it is half a machine plus a convention."_ This design accepts that
argument for actions and then violates it one level up.

#### Children — the child is declared in the vocabulary

Two cheaper spellings were tried first and both failed on the same principle.

**Rejected — a `children:` map plus a `final` field on the child**, so the child
could contribute an input name. It works, but it buys with structure what is
available without it.

**Rejected — an outcome map inside `actions`:**

```ts
actions: {
	loading: invoke(userFetch, { ok: 'loaded', err: 'failed' })
} // ✗
```

This types well — it checks the names _and_ the payload compatibility — and it is
the cheapest option on offer. **It is still wrong**, because `ok -> loaded` is
an **edge that is not in the table**. The thesis is four coordinates on one line;
a routing map in another block is a hidden arrow, and a reader now needs two hops
to answer "what happens when the fetch succeeds".

**So the child is declared, and its outcome is a _state_, not an input.** An
intermediate draft made the outcome an input — `'fetch.ok: loading -> ready'` —
which is a lie, and a small one that matters: nothing sends `fetch.ok`, no caller
can, and it would appear in `available` as though a user could pick it. The child
reaching `ok` is **a condition that became true**, which is what a state is.

Spelling it as a state requires a way to leave a state with no input — an
**immediate transition** (§7), which is wanted on its own account anyway, so one
mechanism pays twice:

```ts
// an ordinary spec — nothing about it was written to be a child
type UserFetch = {
	inputs: { resolve: { user: User }; reject: { error: Error } }
	states: { pending: { id: string }; ok: { user: User }; err: { error: Error } }
}

type Publication = {
	inputs: { open: { id: string }; cancel: void }
	states: {
		empty: void
		loading: { id: string }
		ready: { user: User }
		broken: { error: Error }
	}
	invokes: { loading: Child<UserFetch, 'ok' | 'err'> } // keyed by the state it runs in
}

transitions: {
	'empty -open> loading': ({ input })   => ({ id: input.id }),
	'loading.ok -> ready':    ({ outcome }) => ({ user: outcome.user }),
	'loading.err -> broken':  ({ outcome }) => ({ error: outcome.error }),
}
```

`loading.ok` is a state name that happens to contain a dot, so the three key forms
of §7 carry this with nothing added, and the property that mattered — decidable
from the string alone — survives.

**Measured** (`scratchpad/probe/`): all three key forms coexist, `Sources<'ready'>`
is still the text search `-> ready`, `loading.ok` carries the child's outcome data,
`'loading.pending -> ready'` is rejected because the parent did not declare
`pending` an outcome, each outcome carries **its own** payload rather than a union
over all of them, and a bare child name is not an input.

**The outcomes are declared by the parent, not the child.** `Child<UserFetch, 'ok'
| 'err'>` puts that choice at the use site: any machine can be a child, two parents
can treat different states as outcomes, and `'bogus'` is still rejected against the
child's real states. A `final` field on the child would instead mean only machines
_written to be invoked_ could be invoked.

Three things fall out that were not designed for:

- **`skip()` needs no change.** If every immediate candidate skips, you stay in
  `loading.ok` — which is meaningful: the child finished and we have not decided
  yet.
- **`'loading.ok -cancel> empty'` is legal** — an ordinary input edge out of a
  derived state. Waiting in a settled-child state for a user decision is
  expressible with nothing added.
- **The arrow test improves.** There is no fictional input on the line, so source,
  target and handler are all that is left.

**Four costs, and the fourth is the serious one.**

- **It is one level of hierarchy.** Here the nesting is bounded — derived only from
  `invokes`, never nested further — and both derivations stayed flat text searches.
  That is the good half without the bad half, but it is visibly the nose of the
  camel, and `a.b.c` will be asked for.
- **A fourth vocabulary map**, `invokes:`. Keyed by the state the child runs in,
  which is more natural than a child name and is what justifies the `loading.ok`
  spelling.
- **`loading.ok`'s data is undecided.** The probe gave it the child's outcome. But
  we are arguably still in `loading` and may still need `{ id }` — so it is the
  child's outcome, the parent's data, or both under separate bindings.
- **Run-to-completion becomes urgent.** A single `send` can now cause a _chain_ of
  transitions. When do actions fire, when do listeners fire, what does `send`
  return, and what stops `'a -> b'` / `'b -> a'` from spinning? P0.7 was already
  amended to say run-to-completion is eight decisions, not one; immediate
  transitions make paying that bill unavoidable.

**One child per state, and that is not a limitation.** Two mounts in _different_
states are free. Two mounts in the _same_ state is the real question, and counting
answers it: one child gives `loading.ok`, `loading.err` — **+2, a sum**; two
children give 3 × 3 = **9, a product**. With one child, `loading.ok` says
everything. With two, `loading.user.ok` says nothing about `prefs`, so either the
name encodes both children's progress or it is incomplete — and encoding both **is
AND-states**, which P2.1 puts outside the core and which is exactly ConstraintJS's
2 × 2 × 4 complaint. So: **at most one child per state, enforced structurally for
free**, since `invokes` is keyed by state name and object keys are unique.

The cases this appears to block have better answers: fetch two things →
`all(a, b)`; fetch with a timeout → `race(fetch, timer)`; two genuinely independent
lifetimes → peer machines. `all` and `race` are ordinary machine specs the library
provides, implemented natively rather than built out of `invokes`, so they flatten
the product into a single declared outcome set before it reaches anyone's
vocabulary. Same move as `Promise.all`, and the same reason. The general
statement: **multiplicity in the vertical direction is a product, and products
belong to the horizontal mechanism.**

**An accumulating cost worth naming.** This design grows the shape three times
without ever proposing to:

|                              | before                                       | after                     |
| ---------------------------- | -------------------------------------------- | ------------------------- |
| vocabulary maps in `types<>` | `inputs`, `states`                           | **+ `invokes`**           |
| blocks in `machine({…})`     | `initial`, `types`, `transitions`, `actions` | **+ a child-value block** |
| key forms                    | 2                                            | **3**                     |

Each step is individually justified and the total is still a real cost, paid
against a feature no shipping library under 12.7 KB provides at all.

#### The fork: is a child's outcome topology, or an input source?

There is a second, complete spelling that shares none of the machinery above. It
is **the alternative**, not a complement — holding both would mean two ways to do
one thing.

```ts
type Publication = {
	inputs: {
		open: { id: string }
		userLoaded: { user: User } // ordinary declared inputs
		userFailed: { error: Error }
	}
	states: { … }
}

actions: {
	loading: invoke(userFetch, ({ child, send }) => {
		child.on('ok', (s) => send('userLoaded', s.data))
		child.on('err', (s) => send('userFailed', s.data))
	}),
}
```

**Its case is stronger than "escape hatch" allows**, and rests on one observation:
**the table has never said where an input comes from.** `open` arrives from a
click, `submit` from a form, `userLoaded` from a child machine — the model does not
distinguish them, and `grep '-> ready'` finds the row either way. On that reading
the dotted form invents a category the design does not otherwise have, and the
callback is not a hidden edge at all — it is an action sending a declared input,
which is what actions already do. It also answers what the dotted form cannot:
`child.send(…)` downward, which P2.1 asks for, plus `child.current` and conditional
or partial wiring. And it needs **no new types whatsoever**.

|                               | dotted (`loading.ok`)      | callback (`child.on`) |
| ----------------------------- | -------------------------- | --------------------- |
| new types                     | `Child<C, Out>`            | **none**              |
| child must be written for it  | no (parent picks outcomes) | no                    |
| outcome payloads checked      | **✓ exact**                | ✗ hand-declared       |
| unhandled outcome detectable  | **✓ possible**             | ✗                     |
| send downward / read progress | ✗                          | **✓**                 |
| where the wiring lives        | the table                  | a closure             |

**The dotted form wins, on a narrower argument than it first appears.** Its two
concessions both have answers elsewhere: reading a running child's progress is a
**view** concern and belongs on the host (`doc.children.fetch.current`, read-only,
no definition change); and sending downward is, in almost every real case,
_restart with different data_ — which residency plus `keyed()` already expresses
without a handle. Once those are subtracted, the callback's remaining advantage is
generality nobody has a use for yet, and its cost is a protocol the compiler cannot
see. That is the same trade this project has made every time: prefer the less
powerful thing the type system can check.

#### Inlining — composition happens before the machine runs

There is only ever **one** machine. A child is a source of rows and vocabulary,
merged in at definition time under a prefix.

```ts
type Publication = Compose<Base, { fetch: UserFetch }>
// states gain 'fetch.pending' | 'fetch.done' | 'fetch.failed'
// inputs gain 'fetch.resolve' | 'fetch.reject'

transitions: {
	...inline('fetch', userFetch),        // the child's own rows, prefixed
	'empty -open> fetch.pending':          ({ input }) => ({ id: input.id }),
	'fetch.resolve: fetch.pending -> ready': ({ input }) => ({ user: input }),
}
```

**The most native of the three.** The table is already data, so composition is
data-merging, and everything downstream is unchanged: the same transition
function, the same `actions` block, no child to own, no lifetime to define, no
cancellation question — leaving `fetch.pending` is an ordinary transition. The
arrow test passes on generated rows because they are real rows. Modularity is the
same mechanism, and reuse is free — `userFetch` can be inlined twice under
different prefixes.

**Costs.** The heaviest type machinery of the three: a `Compose` that merges two
specs under a key prefix, with the rename reaching into every transition key of the
child. State names get long and the flat table gets big. There is **no dynamic
spawning**. And a generated row is not in the source, so grep finds it only in the
composed value, which weakens the property the design was chosen to protect.

**One thing it cannot do**, which decides how far it goes: inlining composes a
_sum_ of states, not a _product_. ConstraintJS's radio button — focus × checked ×
mouse-phase — is a product, and inlining it produces the 2 × 2 × 4 = 16 states
their paper exists to complain about. **Concurrency is out of reach here.**

#### Where this points

**Children.** It is the only one that answers both halves while keeping the
definition complete **and keeping every edge in the table** — the test that
eliminated its own two cheaper spellings.

Against peers: better external support, but its composition is a convention living
outside the exported value — the exact defect §9 rejected for actions. A library
whose thesis is "the definition is the documentation" should not require an
assembly step it cannot express. Children subsumes the useful part anyway: peers in
one state are `all(invoke(a, …), invoke(b, …))`.

Against inlining: the most native and the most elegant, and structurally unable to
express concurrency, which the strongest external evidence says is the case that
matters. It solves async beautifully and modularity not at all.

What makes it affordable is that everything hard was decided for other reasons:
residency defines the child's lifetime (§9), wrappers carry the restart policy
(§9), and declaring the child means the vocabulary grows from a declared type
rather than an inferred sibling — the mechanism §5 built for a different problem.

**Still open besides the fork**: whether leaving cancels the child's work or merely
stops us caring; what data `loading.ok` carries; and that `actions` is
trigger-keyed, so two children in one state need `loading: all(invoke(…),
invoke(…))`.

## 11. Sending inputs

Every other section is about **writing** a machine. This one is about **driving**
it.

### The constraints this inherits

1. **Per-state capabilities at the send site is the differentiator.** Research
   note 07 F20: _no_ surveyed library enforces it. `useStateMachine` advertises
   legality via `nextEventsT` but its `send` is machine-wide; XState v5 removed
   even the advertisement; Zag's `send` takes any `T["event"]`. So **an option
   that makes the guarantee opt-in has effectively not shipped it.**
2. **Narrowing dies across callbacks**, so the guarantee has to attach to an
   immutable value that has already been narrowed, never to a live handle held
   across time.
3. **Rust gets this for free and we cannot.** The typestate pattern consumes
   `self` and returns the next state type, so the old value is _moved_ and stale
   narrowing is impossible (note 08 F2). TypeScript has no ownership, so a stale
   snapshot remains reachable and needs an answer.
4. **Actions need a host.** A pure transition function cannot start a socket or
   fire a teardown, so a stateful instance has to exist regardless.
5. **The definition is not the instance** (§12), so sending targets something the
   host produced.

### What a "capability" is

Concretely: **the input names of a state become method names, and the payload
becomes the argument.** `Handled<T, 'draft'>` — which already exists in the
prototype — reads the table's keys and yields `'revise' | 'submit' | 'cancel'`,
and the capability type is one mapped type over it. So in `draft` you get exactly
three members, `at.decide` is `TS2339`, `at.cancel()` takes no argument because
`cancel` is `void`, and `at.submit` is **one method for two rows** — capabilities
are keyed by input, not by edge, so the method runs the candidate rows in
declaration order with `skip()` fall-through.

### The measurement that governs everything else

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
simply wrong the moment the machine moves, and the compiler will keep insisting it
is right.

**But the stakes are lower than "unsound" suggests.** The runtime always
re-checks: a send that does not match the current state returns `unavailable` and
changes nothing. A stale narrowing does not corrupt anything — it **degrades to
exactly the broad-`send` behaviour** everyone else ships. The loss is a guarantee,
not correctness.

That yields a clean trichotomy. A typed send site is sound only when:

1. **nothing mutates** — an old value is still a good value;
2. **the window is closed by construction** — the handle does not outlive the
   check;
3. **the assumption is re-stated at the call** — the type is checked against a
   state the code names out loud, and the runtime verifies it.

Everything else is **category 4**: sound-looking and quietly wrong after the first
mutation.

### The twelve options

| ID      | Shape                                            | Category | Verdict                                                                                                                                                                                                         |
| ------- | ------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1**  | pure stepping; the caller holds the state        | 1        | a primitive, not an API — two statements per send, and nothing is narrowed to check                                                                                                                             |
| **S2**  | a host with a broad `send`                       | n/a      | **chosen**                                                                                                                                                                                                      |
| **S3**  | a host, plus `capabilities(machine, value)`      | 1 or 4   | two options wearing one name — see below                                                                                                                                                                        |
| **S4**  | capabilities **on** the snapshot                 | **4**    | the guarantee is free — you get it by narrowing, which you were doing anyway to read `data`. Stale after the first `await`, and the snapshot stops being plain data. Prior art: `@doeixd/machine` (note 07 F19) |
| **S5**  | pure snapshot chaining, `b = a.open({…})`        | 1        | pure, typed and ergonomic at once — but cannot host actions                                                                                                                                                     |
| **S6**  | S5's methods on both detached and live snapshots | 1 + 4    | the two read identically at the call site; nothing says whether anything was mutated                                                                                                                            |
| **S7**  | a scoped handle — `when` / `visit`               | 2        | sound and revocable; reads as a subscription next to `.on()`, and inverts control                                                                                                                               |
| **S8**  | `doc.available`                                  | n/a      | **not a rival** — a runtime array for rendering buttons; kept                                                                                                                                                   |
| **S9**  | `doc.from('draft').submit(…)`                    | 3        | the assumption is written down and greps; a handle that can still be stored                                                                                                                                     |
| **S10** | `doc.send('draft -submit>', …)`                  | 3        | most consistent with the notation, least obvious to a newcomer; reads as half a key                                                                                                                             |
| **S11** | `doc.sendIf('draft', 'submit', …)`               | 3        | cheapest of category 3 — one method, no handle at all; a three-argument call, a second verb                                                                                                                     |
| **S12** | a scoped handle carrying `send` — `doc.match(…)` | 2        | **recorded, not built** — the way back in                                                                                                                                                                       |

**S3's correction is worth stating**, because the extra call looks like it buys
safety and does not. `capabilities(publication, now)` changes nothing about time:
an `await` between the call and its use has the same effect as in S4. The only
reading under which S3 is stale-free is if it is **pure** — closing over a
definition and a value, never over the host — and that version cannot drive the
live machine at all, since the result must be handed back. So pure-S3 is S5 with
extra ceremony, and live-S3 is S4 with extra ceremony.

**S7 is the only one whose runtime can make it airtight.** TypeScript will not stop
anyone stashing the handle in an outer variable, but the library can **revoke it
when the callback returns**, so a late send throws with a clear message instead of
silently acting on a state that has moved.

### Decided: a broad `send`, and no typed send site

**`doc.send(name, payload)` is the whole sending API.** Broad, mutating, familiar;
every declared input accepted from every state; anything the current state does not
handle changes nothing. It returns nothing either — see §12.

The typed send site is **dropped**, because it stopped buying much once finding 11
was measured:

- The version people would actually reach for — narrow, then send — is **unsound
  and uncorrectable**, and worse than absent, because the compiler vouches for it.
- Every sound spelling makes the caller **re-state a fact the machine already
  knows**. That is ceremony in exchange for catching a class of mistake the runtime
  already handles safely.
- Nothing is at risk. A wrong send changes nothing; it does not corrupt state,
  throw, or half-apply.

**What this costs, plainly.** Research note 07 F20 called per-state capabilities at
the send site the one gap nobody has filled, and it was named as the
differentiator. The honest statement is now narrower:

- **Per-state _data_ still works and is untouched.** Narrowing `doc.current` gives
  typed data with no nullable padding — the half XState's global `context` gets
  wrong, and reason enough for the project to exist.
- **Per-state _capabilities_ are advertised, not enforced** — `doc.available` at
  runtime. That is exactly where `useStateMachine` landed.
- **The definition site keeps its checking.** Illegal transitions still cannot be
  written; what is unenforced is only the _call_.

**And it is reversible, which is why it is safe to drop.** Adding a typed door
later is additive — a new method beside `send`, no change to anything existing.
Shipping one now and regretting it is breaking. Same asymmetry that settled axis 7.

**Also freed:** `doc.current` stays plain serialisable data, since nothing needs to
hang capabilities on it; the stale question disappears; and `capabilities`, `from`,
`when` and `visit` all leave the API.

**On the call shape**, which is orthogonal: `send('submit', payload)` rather than
`send({ type: 'submit', ...payload })`. XState and robot3 take one object. Separate
arguments type more cleanly — merging them is how robot3's `[key: string]: any`
hole appeared — and it makes a `void` input just `send('cancel')`.

### If it comes back, it comes back as S12

**Not being built.** Recorded because the design work is done, so a future round
starts from a settled shape.

```ts
doc.match('draft', ({ send, data }) => …)  // one branch — sugar for a one-key object
doc.match({ draft: …, review: …, … })      // many branches — exactly one fires
```

Everything about it is measured on 7.0.2 and reproducible from
`scratchpad/probe/`: per-branch narrowing of both `send` and `data`, the dependent
payload type, the no-argument `void` case, rejection of unknown states, and a
return type that tightens from `R | undefined` to `R` exactly when every state is
covered.

Why S12 rather than S3, S4, S7, S9, S10 or S11:

- **Sound.** The handle does not outlive the callback, so the narrowing cannot go
  stale.
- **No second calling convention.** `send('submit', …)` on the handle is the same
  shape as on the host, so nothing new is learned and input names never become a
  member namespace. This is the strongest argument for it.
- **It covers reading too**, not only sending — `data` is on the handle.
- **One method, two arities**, with a uniform return-type rule and no fluent chain.

Two things it must carry with it:

**A multi-branch form is not sugar — it is the only correct dispatch.** The obvious
way to get several branches is several single-branch calls, and it is a bug:

```ts
doc.match('draft', ({ send }) => send('submit', { route: 'review' })) // → review
doc.match('review', ({ send }) => send('decide', { verdict: 'ok' })) // ALSO fires
```

**The machine moves between the two calls**, so the second matches the state the
first produced, and both run in a single pass. Sequential single-branch calls are
only safe when no branch sends.

**And the multi-branch form is an object, not a chain.** Both were measured and
both work; the chain accumulates the remaining states in the type, so a state
cannot be handled twice and exhaustiveness is detected at the end. (Note it does
_not_ fall foul of this project's finding against fluent type accumulation, which
is about accumulating while building a definition. Here the accumulator is consumed
immediately and feeds nothing.)

|                                     | chain                                 | object                           |
| ----------------------------------- | ------------------------------------- | -------------------------------- |
| picks exactly one branch            | ✓                                     | ✓                                |
| a state cannot repeat               | needs an accumulator                  | **free — duplicate key**         |
| exhaustiveness in the return type   | ✓                                     | ✓                                |
| error names the remaining states    | **✓ better**                          | generic `TS1117`                 |
| **Prettier**                        | **indents the whole chain**           | **fine**                         |
| order is                            | line order                            | key order — as in `transitions`  |
| consistent with the rest of the API | the only fluent thing besides `.on()` | keyed maps, like everything else |

The object wins. The chain's one real advantage is a better diagnostic, which does
not pay for the rest.

**Two costs to weigh if it is revived.** `match` invites an XState reading, where
`state.matches('draft')` is a **predicate returning a boolean** — arity
disambiguates, but the association is real for the population most likely to arrive
here. And the object form is shaped like `actions`: `doc.match({ draft: fn })` and
`actions: { draft: fn }` read alike, while `draft: fn` means "while in draft" in
one and "if in draft, right now" in the other.

The open question is not technical: it is whether a scoped block per narrowed
region earns its keep in everyday code.

**Recorded as cheaper ways back in**: `sendIf` adds one method and no concepts;
`from` if a handle turns out to be wanted for reading as well as sending.

## 12. The host

Three questions about the live object: whether it is separate from the definition,
how the outside world observes it, and what happens during a commit.

### Definition and instance

**Are the thing you write and the thing you drive two objects, or one?**

There are up to three things, and naming them separately makes the question
tractable:

1. **The definition** — what `machine({…})` returns. The table, the vocabulary.
   Inert.
2. **The snapshot** — `{ state, data }`. A value. Inert.
3. **The host** — holds the current snapshot, runs and tears down effects, holds
   subscriptions. **Mutable.**

Nobody disputes 1 and 2. The whole question is whether 3 exists.

| ID     | Shape                                        | Note                                                                                                                    |
| ------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **D1** | all three — `run(publication, data)`         | what XState, robot3 and Redux all do; costs one line and two names people will conflate                                 |
| **D2** | two — `machine({…})` is already live         | shortest possible start, one concept; a module-level machine is a shared mutable singleton unless exported as a factory |
| **D3** | D1 with the constructor on the definition    | `publication.start(data)` — an ergonomics variant, no second import; puts a method on inert data                        |
| **D4** | a class, `new Doc({…})`                      | `new` makes instantiation unmistakable; drags in `this`, invites inheritance                                            |
| **D5** | two — no host at all, pure snapshot chaining | what Elm and Rust typestate do; **no home for actions**, which is the entire catch                                      |

#### The question is not really about instances

The pattern across prior art is exact: **everything that owns effects has a host,
and everything that does not, does not.** Elm has no instance because the platform
owns effects; Rust has none because values are all there is; XState, robot3 and
SCXML sessions all have one because something must own a running timer.

So D1-vs-D5 is not a fresh decision — **it is axis 10 again**, and the honest
framing is that **the host is the price of `actions`**. Worth stating plainly,
because it is the one place the project pays visibly for that decision.

#### What the split buys — four arguments, three of which fail

| argument                                   | verdict                                    |
| ------------------------------------------ | ------------------------------------------ |
| several instances                          | ✗ a factory does this                      |
| the compiled index is built once           | ✗ a constant factor, not a design argument |
| replay and tests need no host              | ✗ weaker than it sounds                    |
| **composition takes and returns machines** | ✓ **structural, and the only one**         |

**Several instances — fails.** P1.6 asks for independent uses of the same
behaviour, and `const makeDoc = () => machine({…})` gets them from an ordinary
function, at the cost of one closure. So "you need several" is not a reason.

**The compiled index — fails.** Under the split, the table is parsed once for _all_
instances rather than once _per_ instance: a constant factor on tens of short
strings, at interaction rates. Real, and far too small to decide anything.

**Replay and tests — fails on inspection.** Under D2, stepping a value through a
live machine still works — it reads the table off the object and ignores its
current state. Uglier, not impossible. A clarity argument dressed up as a
capability argument.

**Composition — holds, and it is structural.** `retry(fetchUser)`,
`race({ ok, late })`, mounting a child at a state. Each needs a **recipe, not a
running thing**: `retry(child, { times: 3 })` must start a **fresh** attempt each
time, and a child mounted at `loading` starts again on re-entry, from a blueprint.
If a machine is a running thing, composing two of them means composing two running
things, which is not a coherent operation.

#### Where this points

**One argument survives, and the decision reduces to it:**

> **Ship composition → keep the split. Do not ship composition → D2 plus a factory
> is simpler, and everything else offered here was rationalisation.**

**Decided: the split is kept.** Composition is deferred rather than dropped, and the
conditional's premise is about the eventual shape rather than the first release, so
this is forward-compatibility taken deliberately. The cost is the one D1 always had:
one extra line in the smallest case, and two names people will conflate.

**D3 is taken on top now that the split stays**: the host is
`publication.start(data)`. It reads better than `run(publication, data)`, removes an
import, and dot-completion makes it discoverable — against one method on a value that
is otherwise inert data. Also settled: the initial data is an argument to `start`,
not a field beside `initial:`, so the definition stays free of instance state.

**And observation belongs to the host** regardless of how this resolves. The
prototype attaches `.on()` to the definition, which contradicts the ownership split
§9 relies on: two hosts running one definition would **share** listeners, and a
value documented as inert is quietly mutated. Putting observation on the host makes
the split structural rather than conventional and leaves the definition genuinely
immutable — which is what lets it be exported, imported, diffed and visualised.

Still open: what the host is called (`run` / `interpret` / `start`), and whether
the initial data is an argument or lives in the definition beside `initial:`.

### Observation: `.on()`, on the host, with patterns

`doc.on(pattern, fn)` returns an unsubscribe function. Many listeners, edge patterns
in the transition key language, and **no bare-state key** — a key with no arrow
means residency, which the host does not implement.

**On the host, never the definition.** The prototype attaches listeners to the
definition, which contradicts the ownership split §9 relies on: two hosts running
one definition would share them, and a value documented as inert is quietly mutated.
On the host, the definition stays genuinely immutable — which is what lets it be
exported, imported, diffed and visualised.

**Deliver the transition record, not a snapshot.** Robot3 hands its observer the live
service — no `from`, no `to`, no input — which is why it cannot say what _caused_ a
change. Axis 7 dropped `emit` on the grounds that "a listener recovers everything
from `{ on, input, from, to }`". Deliver the record and that argument stands;
deliver a snapshot and axis 7 reopens.

**Two arguments against a listener list were made and do not survive**, recorded
because both looked strong:

- _"Multiplicity is what makes dispatch hard — with L1, L2, L3 and L1 sending during
  its own notification, the later listeners get told about a transition the machine
  has already left."_ **That is an argument against nesting, not against the list.**
  Under the queue, L1's send is parked, L2 and L3 are notified with the machine still
  where their event says it is, and the drain delivers the next transition to all
  three in order. The invariant holds for any number of listeners. Once the queue is
  in — and it is, for independent reasons — the list costs nothing here.
- _"The pattern language is runtime cost."_ **It is not.** The table already has to
  parse every key into `(on, from, to)` to dispatch at all; a pattern is the same
  parse with the input position allowed to be absent, and matching is three
  comparisons against an already-parsed transition. Ten lines over a bare callback
  list.

**And one argument for patterns that the cost framing hid:** they keep the grep story
whole. `grep '\-> published'` finds the transition rows and the listeners together,
where `if (e.to.state === 'published')` severs the link. "Every topology question is
a text search" is the project's central claim, and this is a place it applies.

**A construction-time callback was also considered** — `run(machine, onChange)`,
robot3's shape — on the grounds that a registration API implies a list and
singularity should be structural. It loses on the standard subscription contract:
`useSyncExternalStore` wants `(cb) => unsubscribe` plus a snapshot getter, and Svelte,
Solid and Vue stores are the same shape. A construction-time observer supplies
neither, so every framework consumer writes its own fan-out. P0.11 asks for
browser-first and framework-neutral, which argues for the standard shape rather than
against it.

### Residency is derivable, not a host feature

The remaining question was whether `.on()` should also accept a bare state key and
scope a setup/teardown pair to residency. It should not — and the reason is not cost
but that **the host does not need to own it**:

```js
function residency(doc, state, setup) {
	let teardown
	const off1 = doc.on(`${state} -> *`, () => {
		teardown?.()
		teardown = undefined
	})
	const off2 = doc.on(`* -> ${state}`, (e) => {
		teardown = setup(e.to)
	})
	if (doc.current.state === state) teardown = setup(doc.current)
	return () => {
		off1()
		off2()
		teardown?.()
	}
}
```

A self-transition matches **both** patterns, so restart-on-re-entry falls out rather
than being implemented. `persistent` is `if (e.to.state !== e.from.state)` in the
exit handler; `keyed` compares `k(e.from.data)` against `k(e.to.data)`. It needs two
things from the host, both worth committing to anyway: **listeners fire in
registration order** (which is what makes exit-before-entry reliable), and
`doc.current` is readable at registration (for the already-resident case that no
transition will announce).

**So the dividing line is ownership, not the feature.** Caller-owned residency is a
helper over public listeners. Definition-owned residency — `actions` — must be host
machinery, because the definition is inert data and something has to interpret it:
read the block, run the right entry, hold the teardown, apply the restart policy.
That is the only place the host is forced into a lifetime.

Two consequences. The v1.1 coexistence worry softens — a helper and `actions` are not
two implementations of one host lifetime, they are one lifetime and one
interpretation of a block, needing only "actions before listeners", which the commit
order needs regardless. And residency **can arrive at any time without any version
having been wrong**, because nothing about it is breaking to add.

### Commit ordering

Most of run-to-completion is already dead here. Esmaeilsabzali et al. deconstruct
big-step semantics into **eight aspects** ([note 02](research/02-execution-semantics-and-time.md)
F5), and P0.7 was amended to say so. Filtered against v1:

| aspect                                   | status                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| Concurrency and Consistency              | **dead** — needs AND-states                                              |
| Priority                                 | **dead** — declaration order plus `skip()` already answers it            |
| Combo-Step Maximality                    | **dead** — no internal events to batch                                   |
| Enabledness Memory (guards)              | **answered** — a handler receives source data; nothing else is in flight |
| Assignment Memory (what a reaction sees) | **answered** — commit precedes notification                              |
| Order of Small Steps                     | live only with chaining; FIFO if it ever exists                          |
| Event Lifeline                           | **P0.7 dictates it** — a raised input joins the next step, not this one  |
| **Big-Step Maximality**                  | **the live one** — one transition per input, or a chain?                 |

**Big-Step Maximality is the immediate-transitions question** (§7), and note 02 F6
settles v1's answer: _"the only way to have a big step that provably terminates is
to forbid chaining — one input, at most one transition."_ v1 keeps the guarantee.

That leaves the rules, all five of them:

1. **One input yields at most one transition.**
2. **Commit, then notify.** A listener always sees a fully committed machine, so
   `e.to` and `doc.current` agree — for every listener, always.
3. **Listeners fire in registration order.**
4. **A send from a listener is queued**, and the queue drains before the outermost
   `send` returns — not on a microtask, and not nested.
5. **`send` returns nothing.**

#### Queue, not stack

With commit-before-notify, nesting and queueing deliver **the same events in the same
order**. Four things differ:

|                                                     | nested               | queued                          |
| --------------------------------------------------- | -------------------- | ------------------------------- |
| what the listener's own `send` returns              | the real outcome     | nothing yet → `queued`          |
| what the machine is in for the rest of the callback | the new state        | the state it was notified about |
| stack depth over a chain                            | a frame pair per hop | constant                        |
| **what the listeners after it are told**            | **a stale event**    | the transition they are in      |

Nesting is free — it is what happens if you write nothing — keeps `send` always
returning a real outcome, and fails loudly on runaway recursion with a stack trace.
Queueing costs about ten lines and turns that runaway into a hang, which is a
**worse** diagnostic. On safety alone neither wins.

Three arguments decide it, and none is stack depth (a transient chain is one or two
hops, not fifty):

- **The last row, once there is more than one listener.** Under nesting, whether
  your event is stale on arrival depends on what somebody else registered before
  you — an ordering nobody controls. Under the queue the invariant holds for any
  number of listeners. **This is what makes the list safe**, and without it the case
  for a single construction-time observer would be strong.
- **A listener is never re-entered.** "This callback may be called while it is
  already running" is a materially harder contract to write against than one that
  cannot be.
- **It is the terminal state anyway.** `actions`, composition and immediate
  transitions each require the queue. Choosing nesting now means the semantics of
  send-from-a-reaction _changes_ when actions land, which is the asymmetry that
  settled axis 7 and the typed send site.

Robot3 nests — measured, and its reentrant send runs to completion inside the outer
callback — which also makes it non-compliant with P0.7 as written. It gets away with
it because it has exactly one observer; with a list it would not.

#### No disposal, and a listener that throws

**There is no `stop()`.** Not because disposal is hard, but because in v1 **the host
owns no resources**: a current state, a listener array, and a queue that always
finishes. Everything a `stop()` would do, the caller already can — unsubscribe the
listeners it registered, stop calling `send`, and call the disposer the residency
helper handed it.

That is the residency dividing line arriving from a third direction. Disposal only
becomes a real concept when the host owns a lifetime it did not receive from the
caller, which is exactly what `actions` introduces. Until then it is API for nothing.

Two things this deletes rather than defers:

- **P0.7's conditional becomes unconditional.** Its drain guarantee is qualified
  _"unless the execution is disposed during the cycle"_; with no disposal, **the
  queue always drains before the outermost `send` returns**. Its other branch —
  an input "explicitly rejected because the execution has been disposed" — is
  vacuous, so every submitted input is considered exactly once. Stronger compliance,
  from less API.
- **The outcome union stays at three.** `moved | none | queued`, with no `stopped`.

#### `send` returns nothing

Earlier drafts had it answer `moved | declined | unavailable | queued`, inherited
from P0.6's requirement that the model distinguish "no transition" from "an update
in the same state" from "a move". That is a requirement on the **model**, and the
transition function does distinguish them; whether the host hands the tag back to the
caller is a separate question, and the answer is no.

- **Two of the four are recoverable without it.** `moved` is `doc.current`, and
  `unavailable` is `doc.available` consulted _before_ sending rather than after.
- **`queued` is not information the caller can use.** It is inside a listener, it
  queued something, it will happen.
- **Only a `skip()` refusal is genuinely unobservable** — nothing commits, so no
  listener fires and nothing changed. But that is the intended meaning of a refusal.
  A machine that needs the refusal to be _visible_ should model it as a transition,
  which is a state change and therefore observable through the normal channel.
- **The asymmetry points this way.** Adding a return later is purely additive;
  removing one is breaking. Same rule that settled axis 7 and axis 12.

A note on the shape, if it ever comes back: return a **string literal**, not
`{ kind, reason }`. Case 1's pointer workload is 350 000 sends, and a bare `'moved'`
allocates nothing where an object allocates once per send — which is what P0.11's
"small, synchronous, predictable overhead" is about. The object shape belongs to the
pure transition function, where it has to carry the next state; the host has already
committed it.

**A listener that throws propagates.** The exception unwinds out of `send`, which is
where the caller is, and the core being synchronous means it surfaces at the exact
call that caused it with the offending listener on the stack. No swallowing, no error
channel, no API.

What that costs, stated so it is not discovered later: **the listeners after it do
not run, and the rest of that dispatch's queue is discarded** — the one case where a
`queued` answer does not lead to a transition. The transition itself is already
committed and stays committed; rolling back would produce a state no listener ever
saw, which is worse. And the implementation must reset the drain flag on the way out
(`try`/`finally`), or a single throw wedges the host into answering `queued` forever
and never draining. That is the one thing "just let it throw" does not get for free.

An error channel is additive later: catching, continuing, and reporting can be added
without changing what the default does.

## 13. Type-system findings

Each was discovered by a test asserting that something **illegal** fails. No
positive test has ever caught one.

1. **The cross-product rule was too strong.** It said a cross-product of
   discriminants at value positions kills contextual typing. `o1` is a
   cross-product of _three_ (`event`, `from`, `to`) and TypeScript 7.0.2
   discriminates it correctly. Narrowed to the encodings actually tested.
2. **Marker calls leak `any`.** `state<T = void>()` puts the call in a position
   contextually typed by the unresolved state map, so `T` infers as `any`. A
   parameterless _overload_ has nothing to infer; a declared vocabulary avoids it
   entirely.
3. **A type parameter in a closure's parameter type gets fixed to its constraint**
   before inference. This killed "compute `S` from the raw literal", and it is why
   the state-name inference cliff existed.
4. **`T[I]` inside a mapped-type template forces `T` to resolve**, collapsing the
   result to `never`. `const T` does not help. Per-row precision has to come from a
   union instead.
5. **Capturing a literal alongside a checking member disables excess-property
   checking** against that member — a key is "known" if _any_ intersection member
   has it. Cost `n1` its per-line errors until a second member restored them.
6. **Reverse-mapped inference needs one non-closure leaf** _and_ only bites when
   the type parameter also appears in a closure parameter. Neither alone is enough.
7. **A union of an object type with an array of that object type** destroys
   contextual typing for every bare object in the literal (§4).
8. **`TS2820`'s did-you-mean is conditional on identifier length** (§4).
9. **Omitting an inference site makes TypeScript discard the entire inferred map**;
   the fix is to widen the constraint and move the default into the accessor type
   (§5).
10. **A homomorphic mapped type over inferred keys is the safe mechanism**; a
    standalone generic call needing sibling context is the one that keeps failing
    (§4).
11. **Narrowing is never invalidated by a call, or by `await`.** Measured on
    7.0.2: after `if (doc.current.state === 'draft')`, both `doc.send(…)` and
    `await slow()` leave the narrowing intact, and
    `const still: 'draft' = doc.current.state` still compiles. Narrowing an object
    that something else can mutate is unsound in TypeScript and there is no
    workaround — the language has no effect system to invalidate it. **This is the
    finding that governs 11.** A discriminated union on the live object _does_
    narrow correctly, so the shape is typeable — it is just wrong the moment the
    machine moves.

There is also one non-type finding worth keeping, recorded in
`config-object-kit.ts`: deriving a transition's source context from the state name
`K` inside `TransitionModifiers` makes resolving that conditional force `To` before
the `target` argument is read, and `To` collapses onto `K`. Carrying the context as
its own free type parameter avoids it.

## 14. The graveyard

Everything proposed and rejected, one line each, so the ground is not re-covered.

**Layouts.** A edge records (two compiler blockers, cannot express multi-target) ·
B annotated outcome (works; target lives in a type annotation) · C target list
(negative evidence, will not compile) · E by destination (question B scatters; its
one win is derivable) · F transition table (unverified crux) · M combinator edges
(one verb, per-edge tax) · G no input vocabulary (payload at the use site;
vocabulary stops being in one place — subsumed by `types<>`)

**Self-transitions.** T1 reserved keys · T2 symbol keys · T3 self-name · T4 return
marker · T5 `&` · T6 per-state flag · H residency identity · I two blocks · J
restart rule · L form dispatch — all moot once entry/exit left, and all still moot
once actions returned, because the answer moved to the action.

**Async.** A `within` (demoted to the leaf primitive) · B `after()` on the edge
(only self-triggering edges) · C resource vocabulary (obsoleted by composition) · D
input-declared source (leaving a _set_ of states is undefined) · E async handlers
(the error path) · F hierarchical mounting (paths reopen every axis) · G mount
block · H derived mounting (same set problem as D) · P/Q/R/S/T effect-free variants
(reconciliation needs identity)

**Actions.** U handler performs · V `do:` on the edge · X listeners as the action
layer · Y actions as data · Z handler acts with multi-target return · AA
`Symbol.dispose` on the data · AB no feature at all — **not rejected; this is what
v1 ships**

**Observation.** A construction-time single observer (loses the standard
subscribe/unsubscribe contract; every framework consumer writes a fan-out) ·
listeners on the definition (two hosts would share them) · handing a listener a
snapshot or the live host instead of the transition record (loses the cause,
reopens `emit`) · nesting a reaction's send instead of queueing it (robot3 does
this; P0.7 forbids it) · a bare state key on `.on()` for residency (derivable in
ten lines; the host owning a lifetime is what `actions` is for)

**Composition.** Peers (wiring lives outside the definition) · inlining (cannot
express a product) · a `children:` map · an outcome map in `actions` (a hidden
arrow) · the child's outcome as an input (nothing sends it) · a `final` field on
the child (only machines written to be invoked could be invoked)

**Sending.** S1 pure stepping · S3 `capabilities()` · S4 methods on the snapshot ·
S5 pure chaining · S6 both provenances · S7 scoped visit · S9 `from` · S10 key
prefix · S11 `sendIf` — and S12 `match`, designed but not built.

**Other.** `emit` (redundant with the listener event) · `else` (throws at runtime,
no static guarantee) · `enter`/`exit` as their own keys (edge patterns with one end
pinned) · a class or `new` for instantiation.

## 15. Still open

- **No prototype implements the adopted notation.** Axis 1 settled on the labelled
  arrow (§4) after the comparison was run, so `n1`/`n2` are one spelling behind. The
  key type's cardinality is identical, so the measurements transfer — but the parser
  and the whitespace rule are unbuilt.
- **The two rival layouts stay alive on one axis**: target keys wins co-location,
  classic records wins extensibility, and both are complete compiling prototypes.
  Against the labelled arrow they also win the completion payload, since each
  coordinate completes against |states| or |inputs| rather than their product.
- **Completion payload grows as |states|².** Measured at 1.7 MB per request for a
  4 000-member key union (§4); latency is fine but the server never narrows, so the
  editor filters client-side. A threshold has not been set, and this is the axis on
  which the split layouts are genuinely better.
- **Composition is designed and deferred** (§10), with the fork between the dotted
  form and the callback unresolved, and **immediate transitions** (§7) deferred with
  it — which is where the rest of run-to-completion has to be paid.
- **If handlers ever gain effects, whether losing candidates run becomes
  observable.** Under this design handlers only project, so the order in which
  candidate rows are tried is invisible. It stops being invisible the moment
  anything puts effects back in a handler — true of all three layouts.

## Where the code is

Note that all of these predate axis 1's final answer and use `'submit: draft ->
review'` rather than `'draft -submit> review'`.

| Directory              | Proposition                  | State                                        |
| ---------------------- | ---------------------------- | -------------------------------------------- |
| `n2-declared-types`    | **string keys + `types<>`**  | ✅ closest to v1; leading-input spelling     |
| `o1-classic-table`     | **classic records + `with`** | ✅ narrowing verified, traces pass           |
| `n1-transition-table`  | string keys, inferred vocab  | ✅ has the `playground.ts` completions demo  |
| `d1-target-keys`       | target keys                  | ✅ complete                                  |
| `d4-self-target`       | target keys + `&`            | ✅ compiles — moot since axis 4              |
| `c2-annotated-outcome` | annotated outcome            | ✅ Cases 1–4, live runtime, send-site checks |
| `d3-radical`           | by destination               | 🟡 lib + neutral only                        |
| `c1-edge-records`      | edge records                 | 🟡 cannot express the neutral machine        |
| `c3-target-list`       | target list                  | ⛔ intentionally does not compile            |
| `baselines`            | 3 rivals                     | ✅ switch-union, radix, sequential           |
