# The API

> **Status: specified, not built.** Nothing is open that blocks implementing v1.
> The reasoning behind every choice is in [api-rationale.md](api-rationale.md); the
> code in `src/` is the previous generation and does not implement this. The closest
> prototype is
> [`explorations/candidates/n2-declared-types/`](../explorations/candidates/n2-declared-types/),
> which predates the arrow-label notation and so is one spelling behind.
>
> **v1 is topology and data**: a declared vocabulary, a transition table, a host,
> and listeners on the host. One transition per input. `actions`, composition and
> immediate transitions are designed and deferred — see
> [Designed, not in v1](#designed-not-in-v1).

## The whole thing at a glance

```ts
import { machine, types } from 'totorobot'

type Inputs = {
	open: { text: string }
	revise: { text: string }
	submit: { route: 'review' | 'publish'; reviewer?: string }
	cancel: void
}
type States = {
	empty: void
	draft: { text: string; revision: number }
	review: { text: string; revision: number; reviewer: string }
	published: { text: string; revision: number }
}

export const publication = machine({
	initial: 'empty',
	inputs: types<Inputs>(),
	states: types<States>(),

	transitions: {
		'empty -open> draft': ({ input }) => ({ text: input.text, revision: 0 }),
		'draft -revise> draft': ({ data, input, skip }) =>
			input.text === data.text
				? skip()
				: { text: input.text, revision: data.revision + 1 },
		'draft -submit> review': ({ data, input, skip }) =>
			input.route === 'review'
				? { ...data, reviewer: input.reviewer! }
				: skip(),
		'draft -submit> published': ({ data, input, skip }) =>
			input.route === 'publish' ? { ...data } : skip(),
		'draft -cancel> empty': () => {},
	},
})

const doc = publication.start()
doc.on('* -> published', (e) => notify(e.to.data))
doc.send('open', { text: 'hello' })
```

| part          | answers                               |
| ------------- | ------------------------------------- |
| `initial`     | where a new host starts               |
| `inputs`      | what can happen                       |
| `states`      | what we can be                        |
| `transitions` | how we move, and what the new data is |
| `.on()`       | what the outside world does about it  |

No `enter`, no `exit`, no `keep`, no `repeat`, no `else`, no `nothing`, no
`state()`, no listener registry to configure, no type annotation on any handler.

---

## `inputs` and `states` — the vocabulary

```ts
inputs: types<{ submit: Submit; cancel: void }>(),
states: types<{ empty: void; draft: { text: string; revision: number } }>(),
```

Both maps are **declared**, not inferred from marker values. `types<T>()` carries no
runtime value; it exists only to carry `T`. One config key per concept, so `initial`,
`inputs`, `states` and `transitions` are four siblings at one level rather than two
of them nested inside a third.

- A data-free state is `void`. Not `data: nothing`, not `state()` — the actual type.
- Each map is an ordinary type, so it can be named, exported, imported, generated,
  made generic, or built with `Omit`/`&`. **Name them.** Writing `types<Inputs>()`
  rather than `types<{ … }>()` keeps hover text and error messages from inlining the
  whole literal. A single `Publication = { inputs; states }` still works if you want
  one exported name — pass `types<Publication['inputs']>()`.
- Extraction goes through named helpers rather than the value's type:
  `InputsOf<typeof publication>`, `StatesOf<typeof publication>` — the same family as
  `Handled<M, 'draft'>` and `Sources<M, 'review'>`, which take the machine type as
  `M`.

Declaring rather than inferring is what makes the rest of the design safe; the two
silent holes it closed are in the
[rationale](api-rationale.md#5-the-declared-vocabulary).

**Both are optional, and omitting them widens rather than breaks** (P1.4). A
JavaScript caller writes `machine({ initial, transitions })` and gets a working
machine; a TypeScript caller who omits them gets state and input names as `string`,
`data` and `input` as `unknown`, and **the key grammar still enforced** — a malformed
key is a compile error whether or not a vocabulary was declared. Declaring one map
and not the other is supported and checks that half.

This is a real guarantee rather than a happy accident, so it is stated as behaviour:
see [observable behaviour](#observable-behaviour) items 27–29.

**The cost, stated plainly:** states have no runtime existence. The machine object
carries transition keys, not a list of states, so a visualiser or a dev-mode "valid
states are …" message has no source, and a state with no transitions at all is
invisible at runtime.

**`inputs`, not `events`** — the minority word in JavaScript, the majority word in
the formal literature. Two reasons: the core is not a mailbox (no queue, no
broadcast, no run-to-completion semantics come with it), and a state _handles_
inputs, which reads as an interface. The full argument, and what it costs, is in the
[rationale](api-rationale.md#inputs-not-events).

## `transitions` — the table

One row per edge, all four coordinates on one line at fixed positions no formatter
can move.

### The key language

```
from -input> to
```

The input is the arrow's **label**, which is how every drawing tool spells it —
mermaid `A -->|submit| B`, DOT `A -> B [label="submit"]`. Two consequences worth
knowing up front:

- **The source is at column 1 on every row**, whatever the input is called. Under a
  leading-input spelling the source starts after a variable-width name, so the state
  being scanned for sits at a ragged column — and "what can I do in state X" is the
  question the research says dominates.
- **Whitespace is load-bearing**: exactly one space before the `-`, one after the
  `>`. Not strictness for its own sake — `-` is legal inside a name, so
  `'waiting-for-input-submit>ready'` has no unambiguous reading. Fixed spacing makes
  the separator unambiguous **and** makes grep exact, which tolerance was costing.

One rule covers the whole grammar, here and in patterns:

> **A key with no `->` names a state. An edge always contains an arrow.**

It is decidable from the string alone, so a reader never has to know which position
they are in. Nothing in v1 exercises the first half — a bare key is invalid
everywhere — and it earns its keep when `actions` arrives and a bare key means
residency. It is stated now because the grammar has to be consistent from the start:
without it, `'review'` would be an input in one reading and a state in another, and
`review` is plausibly both.

### The handler decides and projects

It receives the **source** state's data and the input payload, and returns the
**target** state's data:

```ts
'empty -open> draft': ({ input }) => ({ text: input.text, revision: 0 }),
```

`skip()` declines, and the next row declared for the same `(from, input)` is tried.
That is how one input reaches two states —

```ts
'draft -submit> review':    ({ input, skip }) => input.route === 'review'  ? {…} : skip(),
'draft -submit> published': ({ input, skip }) => input.route === 'publish' ? {…} : skip(),
```

— and **declaration order is priority order**. If every candidate skips, the machine
refuses and nothing changes, which is deliberate: refusing is often part of the
protocol. There is no `else` keyword; the ambiguous case — every branch skipped by
accident — gets a dev-mode warning instead, _"`submit` in `draft` declined, all 2
branches skipped"_.

### Self-transitions are ordinary transitions

```ts
'draft -revise> draft': ({ data, input }) => ({ …, revision: data.revision + 1 }),
```

No `keep`, no `repeat`, no `&`, no `stay`, no symbol. Whether anything restarts
because of one is a question for `actions`, when it arrives — not for the table.

### What you get for free

The table is one flat block of string keys, so all three topology questions are a
plain text search, and the reverse index is derivable:

| question                          | search     | derived type           |
| --------------------------------- | ---------- | ---------------------- |
| what can I do in `draft`?         | `'draft -` | `Handled<M, 'draft'>`  |
| where can I `submit`?             | `-submit>` | —                      |
| how does anything reach `review`? | `> review` | `Sources<M, 'review'>` |

All three are anchored rather than approximate, which is what fixed spacing buys.

## The host

`definition.start(data)` returns a **host**: the stateful thing that owns the current
state, dispatches to listeners, and is the only mutable object in the design.

```ts
const doc = publication.start() // `empty` is void, so no argument
doc.send('open', { text: 'hello' })

doc.current // { state: 'draft', data: { text: 'hello', revision: 0 } }
doc.available // readonly ['revise', 'submit', 'cancel']
```

A method on the definition rather than a free `run()`: no second import, and
dot-completion makes it discoverable. One host per independent use — two hosts over
one definition share no state and no listeners, and neither mutates the definition.

### Reading

- **`current`** is `{ state, data }`, plain data. `data` is `undefined` for a state
  declared `void`. **A value read from it stays valid and unchanged across later
  transitions**, which is what makes it safe to compare, serialise, or hold in
  component state. Nothing is frozen, though: immutability is `readonly` in the types
  plus a promise not to mutate, not a runtime guard.
- **`available`** is the input names the current state handles, in the table's
  declaration order, without duplicates — one `'submit'` even though two rows carry
  it. This is what UI code needs to render buttons, and it is the runtime half of
  per-state capabilities.

### Sending

`send` takes the input **name and payload as separate arguments**, not one merged
object. Merging them is how robot3's `[key: string]: any` hole appeared, and it makes
a `void` input just `doc.send('cancel')`.

**Sending is broad: every declared input is accepted from every state.** One the
current state does not handle changes nothing — it does not throw, corrupt, or
half-apply, and that is also how a stale async result lands harmlessly.

**`send` returns nothing.** What happened is `doc.current`, and every committed
transition reaches the listeners; there is no third channel. An outcome tag would say
little that is not already available — a move is `current`, and "not handled here" is
`available`, consulted before sending rather than reported after — and the one case
neither covers, a `skip()` refusal, means precisely that nothing happened.

**There is no typed send site**: `doc.send('decide', …)` compiles in `draft` and does
nothing at runtime. That is a deliberate drop, not an omission. The narrow-then-send
shape everyone reaches for is **unsound in TypeScript and uncorrectable** (narrowing
survives mutation, [finding 11](api-rationale.md#13-type-system-findings)), and every
sound spelling makes the caller re-state a fact the machine already knows. Adding one
later is additive; shipping the wrong one now is breaking. Full reasoning, and the
way back in, in [the rationale](api-rationale.md#11-sending-inputs).

**Per-state _data_ is unaffected** — narrow `current` and the data narrows with it,
which is the half of typestate the project is actually claiming:

```ts
const now = doc.current
if (now.state === 'draft') {
	now.data.revision // number — no nullable padding
}
```

### `.on()` — observing transitions

```ts
const off = doc.on('* -> published', (e) => notify(e.to.data))
doc.on('draft -cancel> *', () => track('cancelled'))
```

**On the host, never the definition.** An imported definition is inert — topology and
data, nothing that runs. `.on()` returns an unsubscribe function.

**The handler receives the transition record**, `{ on, input, from, to }`,
discriminated by `on`, so `e.on === 'submit'` narrows `e.input`, and `e.from` /
`e.to` each carry their end's `{ state, data }`. Handing over a snapshot instead
would make "which input caused this" unrecoverable and would reopen the case for
`emit`; robot3 hands its observer the live service and pays exactly that price.

**Patterns are the key language with coordinates left open.** `*` stands for any
state, and an unlabelled arrow means any input, or none:

```ts
'* -> loading' //     entry: every arrival, including re-entry
'draft -> *' //       exit:  every departure, however caused
'draft -submit> *' // narrower: departures caused by `submit`
'* -submit> *' //     every `submit` edge, wherever it goes
```

There is deliberately no `-*>`. `*` appears only in state positions, so the input
coordinate is either a name or absent — one wildcard, one meaning. The unlabelled
form is the broad one: it matches input-driven edges and, once
[immediate transitions](api-rationale.md#7-immediate-transitions) exist, edges with
no input at all.

**A bare key is not legal**: `doc.on('draft', fn)` names a state, states mean
residency, and the host does not implement residency — which is the next point.

### Residency is a recipe, not a feature

Scoping something to "while we are in `draft`", with a teardown, needs nothing the
host does not already provide:

```ts
function residency(doc, state, setup) {
	let teardown
	// exit registered FIRST, so a self-transition tears down before it sets up
	const offExit = doc.on(`${state} -> *`, () => {
		teardown?.()
		teardown = undefined
	})
	const offEnter = doc.on(`* -> ${state}`, (e) => {
		teardown = setup(e.to)
	})
	// nothing will announce a state we are already in
	if (doc.current.state === state) teardown = setup(doc.current)
	return () => {
		offExit()
		offEnter()
		teardown?.()
	}
}
```

A self-transition matches **both** patterns, so restart-on-re-entry falls out rather
than being implemented — which is why registration order is a specified rule and not
an accident. The policy wrappers come along too: `persistent` is
`if (e.to.state !== e.from.state)` in the exit handler, `keyed` compares
`k(e.from.data)` against `k(e.to.data)`.

So the host owns no lifetime, and this can arrive at any time without any version
having been wrong. What the host **would** have to own is
[`actions`](#designed-not-in-v1) — residency declared in the definition, which is
inert data something has to interpret. That is the dividing line: caller-owned
residency is a recipe, definition-owned residency is host machinery.

### Commit ordering

Five rules, and they are the whole execution model:

1. **One input yields at most one transition.** Big steps provably terminate — no
   step budget, no cycle detection, no unbounded settle. This is what deferring
   immediate transitions buys.
2. **Commit, then notify.** A listener always sees a fully committed machine, so
   `e.to` and `doc.current` agree — for every listener, always.
3. **Listeners fire in registration order.**
4. **A send from a listener is queued**, and the queue drains before the outermost
   `send` returns — never on a microtask, never nested. So a listener is never
   re-entered while an earlier call is still running, and the listeners after it are
   never told about a transition the machine has already left.
5. **`send` returns nothing**, including when it was queued.

Rules 2–4 together are what make a listener **list** safe rather than merely
convenient: without the queue, whether your event was stale on arrival would depend
on what somebody else registered before you.

**There is no `stop()`.** The host holds nothing the caller did not give it and
nothing that outlives a `send`, so everything a disposal method would do, the caller
already can: unsubscribe its listeners and stop sending.

---

## Observable behaviour

The spec above, as the list of things that can be asserted. Written for the
implementation to be driven from.

**Construction**

1. `start(data)` yields a host whose `current` is `{ state: initial, data }`.
   `start()` takes no argument when the initial state is declared `void`, and its
   `current.data` is then `undefined`.
2. Two hosts from one definition share no current state and no listeners.
3. Nothing ever mutates the definition.

**Reading**

4. `current` is `{ state, data }`; `data` is `undefined` for a `void` state.
5. A value read from `current` before a transition is unchanged after it.
6. `available` lists the current state's inputs in table order, deduplicated.
7. `available` is `[]` for a state with no outgoing rows.

**Sending**

8. A handled input commits: `current` becomes `{ state: target, data: projection }`,
   and every listener whose pattern matches that edge fires.
9. An input no row matches changes nothing and fires no listener.
10. An input whose every candidate row calls `skip()` changes nothing and fires no
    listener. Externally indistinguishable from 9, deliberately.
11. With several rows for one `(from, input)`, candidates are tried in declaration
    order and the first that does not skip wins.
12. A self-transition commits and notifies like any other, with
    `e.from.state === e.to.state`, `e.from.data` the old data and `e.to.data` the new.
13. A handler receives the source state's data and the input payload; a `void`
    input's payload is `undefined`.
14. A handler whose target is `void` returns nothing.
15. `send` returns `undefined`, always.
16. An input name that is not in the vocabulary (reachable from untyped code) changes
    nothing.

**Observing**

17. `on` returns an unsubscribe function; calling it more than once is harmless.
18. Listeners fire after the commit, in registration order.
19. Inside a listener, `e.to` deep-equals `doc.current`.
20. `*` matches any state; an unlabelled arrow matches any input; a labelled one
    matches only that input.
21. The listener list is snapshotted before dispatch: a listener unsubscribed by an
    earlier listener still runs for the current transition, and one registered during
    a dispatch does not.

**The queue**

22. A `send` from inside a listener does not take effect before the remaining
    listeners for the current transition have run.
23. The queue drains before the outermost `send` returns — synchronously, not on a
    microtask.
24. Several sends from listeners drain first-in-first-out.
25. A queued send is evaluated against the state at drain time, so it may find no row
    and do nothing.
26. A listener that throws propagates out of `send`. The listeners after it do not
    run and that dispatch's queue is abandoned, but the transition stays committed.
    **The host still works afterwards**: a later `send` transitions and notifies
    normally. (Easy to get wrong, and silent when it is.)

**The untyped path** (P1.4)

27. With `inputs` and `states` both omitted, a well-formed table compiles: state and
    input names are any `string`, `data` and `input` are `unknown`, and `initial`
    accepts any string.
28. A malformed key is still rejected with no vocabulary declared, and the error still
    lands on the offending line rather than on the `transitions` block.
29. Declaring one map and omitting the other checks that half and widens the other.

## What the types check

- **Per-state data.** Narrowing the state narrows its data, with no nullable padding
  in states that logically guarantee a field.
- Unknown state or input names anywhere in a transition key or a pattern.
- A handler returning the wrong shape for its target state.
- Reads of source data the source state does not have.
- Malformed keys — wrong spacing included — reported as `not a transition: '…'` on
  the offending line.

Errors land on the bad line, from a single declaration site.

**What is _not_ checked: the send site.** Per-state capabilities are advertised at
runtime (`available`) and not enforced by the compiler — the same place
`@cassiozen/useStateMachine` landed.

## What is claimed, and what is not

- **A transition is pure.** Given a state and an input it yields either the next
  state or a refusal, and it neither performs nor schedules anything.
- **Sending is broad**, and `available` says in advance which inputs will be ignored.
- **Big steps terminate**, because one input causes at most one transition.
- **Stale results are free.** A `loaded` arriving after we left `loading` matches no
  row and does nothing. That is _ignoring a result_, not _cancelling work_;
  cancelling is the caller's until `actions` arrives.
- Flat: no hierarchy, no parallel regions.
- EFSM, not FSM — reachability and "this guard can never fire" are out of reach and
  are not claimed.

## Deliberately absent

| absent                | because                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| residency in the host | derivable from edge patterns in ten lines; owning a lifetime is what `actions` is for                                                         |
| `enter` / `exit`      | patterns with one end pinned already express both                                                                                             |
| `keep` / `repeat`     | unobservable without entry/exit; a restart policy when it matters                                                                             |
| `emit`                | a listener recovers everything from `{ on, input, from, to }`                                                                                 |
| `else`                | throws at runtime, buys no static guarantee; a dev warning instead                                                                            |
| a `send` return value | additive to add, breaking to remove; nothing needs it yet                                                                                     |
| `stop()`              | the host owns no resources, so there is nothing to dispose                                                                                    |
| typed `send`          | unsound in TS (narrowing survives mutation); a sound design is [recorded but unbuilt](api-rationale.md#if-it-comes-back-it-comes-back-as-s12) |
| immediate transitions | chaining forfeits guaranteed termination; deferred to where it pays                                                                           |
| hierarchy             | the key grammar would become paths, and every layout decision reopens                                                                         |

---

## Designed, not in v1

Three settled shapes with the argument written down, each deferred for its own
reason.

### `actions` — effects owned by the definition

v1's answer to effects is "the caller writes a function". `actions` is the answer
that beats it: trigger-keyed, declared inside `machine({…})`, so behaviour travels
with the definition when it is imported instead of being a convention every caller
has to remember.

```ts
actions: {
	loading:              ({ data, send }) => fetchUser(data.id, send),   // residency
	connected: persistent(({ data, send }) => subscribe(data.url, send)), // survives re-entry
	'draft -cancel> *':   () => track('cancelled'),                       // an edge
}
```

Two rules carry it. **The default is to restart**: any transition into the state you
are already in tears the action down and re-runs it, which fails safe — forgetting
the opt-out costs a teardown, not an activity closed over stale data. And **policy is
a wrapper, not syntax**: `persistent(fn)` returns the record a hand-written object
value would have been, `{ run: fn, restart: 'never' }`, so a bare function is sugar
for `{ run: fn }`, the block stays inspectable as data, and a further policy —
`keyed`, `once`, `debounced` — is one more constructor rather than new grammar.

An action's `send` accepts only **already-declared** inputs, so `actions` adds
nothing to the vocabulary. That is why it works, and exactly what a child mount could
not manage. Being a block it holds **one action per trigger**; two activities in one
state compose into one function returning a combined teardown.

This is where the key rule's bare form earns its keep, and where commit ordering
grows: more than one thing happens per commit, so teardown, setup and notification
need an order, and a throwing action needs a channel.

Full argument: [rationale §9](api-rationale.md#9-actions).

### Immediate transitions — `'from -> to'`, no input

A transition that fires on entering a state, with `skip()` fall-through giving a
guarded choice for free. Deferred not because it is hard but because chaining is the
one feature that forfeits guaranteed termination: with it a big step can run forever,
and a step budget or a visited-set is mitigation rather than recovery.

Full argument: [rationale §7](api-rationale.md#7-immediate-transitions).

### Composition — invoked children

A child machine mounted at a state, with **its outcome as a derived state** rather
than an input, reached by an immediate transition:

```ts
invokes: { loading: Child<UserFetch, 'ok' | 'err'> }

transitions: {
	'empty -open> loading': ({ input })   => ({ id: input.id }),
	'loading.ok -> ready':   ({ outcome }) => ({ user: outcome.user }),
	'loading.err -> broken': ({ outcome }) => ({ error: outcome.error }),
}
```

Every edge stays in the table. `loading.ok` is a state name that happens to contain a
dot, so this needs no grammar of its own beyond immediate transitions. At most one
child per state, enforced for free by keying on the state name.

Full argument, the rival designs, and what is unresolved:
[rationale §10](api-rationale.md#10-composition).

---

## Scope

**Known and accepted for v1.** The layout stays revisitable — target keys and classic
records remain complete compiling prototypes
([three-way](api-rationale.md#4-layout)) — and the completion payload grows as
|states|², measured at 1.7 MB per request for a 4 000-member key union, with latency
fine at 26 ms warm (`pnpm measure:completions`).

**v1.1 — `actions`.** Commit ordering extended to effects: teardown, setup and
notification order within one commit, an error channel for a throwing action, and the
first real test of restart-by-default — a self-transition that changes resident data,
which has never been built.

**v1.2 — composition and immediate transitions.** The fork between the dotted form
and the callback form; a termination rule now that chaining exists; cancellation
semantics (does leaving cancel the child's work, or only stop us caring?); what data
`loading.ok` carries; and `all` / `race`.
