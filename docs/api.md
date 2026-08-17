# The API

> **Status: designed, not built.** This is the settled shape of the next API; the
> reasoning behind every choice is in [api-rationale.md](api-rationale.md). The
> code in `src/` is the previous generation and does not implement it. The closest
> working prototype is
> [`explorations/candidates/n2-declared-types/`](../explorations/candidates/n2-declared-types/).
>
> **v1 is topology and data.** Effects are attached by whoever runs the machine.
> `actions` and composition are designed and deferred — see
> [Designed, not in v1](#designed-not-in-v1).

## The whole thing at a glance

```ts
import { machine, types, run } from 'totorobot'

type Publication = {
	inputs: {
		open: { text: string }
		revise: { text: string }
		submit: { route: 'review' | 'publish'; reviewer?: string }
		cancel: void
	}
	states: {
		empty: void
		draft: { text: string; revision: number }
		review: { text: string; revision: number; reviewer: string }
		published: { text: string; revision: number }
	}
}

export const publication = machine({
	initial: 'empty',
	types: types<Publication>(),

	transitions: {
		'open: empty -> draft': ({ input }) => ({ text: input.text, revision: 0 }),
		'revise: draft -> draft': ({ data, input, skip }) =>
			input.text === data.text
				? skip()
				: { text: input.text, revision: data.revision + 1 },
		'submit: draft -> review': ({ data, input, skip }) =>
			input.route === 'review'
				? { ...data, reviewer: input.reviewer! }
				: skip(),
		'submit: draft -> published': ({ data, input, skip }) =>
			input.route === 'publish' ? { ...data } : skip(),
		'cancel: draft -> empty': () => {},
	},
})

const doc = run(publication)
doc.on('*: * -> published', (e) => notify(e.to.data))
```

| block         | answers                               |
| ------------- | ------------------------------------- |
| `types`       | what can happen, and what we can be   |
| `transitions` | how we move, and what the new data is |
| `.on()`       | what runs, and what an observer hears |

No `enter`, no `exit`, no `keep`, no `repeat`, no `else`, no `nothing`, no
`state()`, no type annotation on any handler.

---

## `types` — the vocabulary

```ts
types: types<{
	inputs: { submit: Submit; cancel: void }
	states: { empty: void; draft: { text: string; revision: number } }
}>()
```

Both maps are **declared**, not inferred from marker values. `types<T>()` erases to
`{}` at runtime; it exists only to carry `T`.

- A data-free state is `void`. Not `data: nothing`, not `state()` — the actual
  type.
- The vocabulary is an ordinary type, so it can be named, exported, imported,
  generated, made generic, or built with `Omit`/`&`. **Name it.** Writing
  `types<Publication>()` rather than `types<{ … }>()` keeps hover text and error
  messages from inlining the whole literal.

Declaring rather than inferring is what makes the rest of the design safe; the two
silent holes it closed are in the
[rationale](api-rationale.md#5-the-declared-vocabulary).

**The cost, stated plainly:** states have no runtime existence. The machine object
carries transition keys, not a list of states, so a visualiser or a dev-mode "valid
states are …" message has no source, and a state with no transitions at all is
invisible at runtime.

**`inputs`, not `events`** — the minority word in JavaScript, the majority word in
the formal literature. Two reasons: the core is not a mailbox (no queue, no
broadcast, no run-to-completion semantics come with it), and a state _handles_
inputs, which reads as an interface. The full argument, including what it costs, is
in the [rationale](api-rationale.md#inputs-not-events).

## `transitions` — the table

```ts
'submit: draft -> review': ({ data, input, skip }) => …
```

One row per edge. All four coordinates — input, source, target, and the handler —
sit on one line at fixed positions that no formatter can move.

### The key language

```
input: from -> to
```

Whitespace is **not** load-bearing: `load:idle->booting`, `load: idle -> booting`
and `load : idle ->  booting` all normalise to the canonical form before anything
looks at them. Completions emit the canonical form, so drift should be rare — but
**human grep cannot normalise**, so a compact key will not match a spaced search. A
lint rule enforcing the canonical spelling would close this.

### The handler decides and projects

It receives the **source** state's data and the input payload, and returns the
**target** state's data:

```ts
'open: empty -> draft': ({ input }) => ({ text: input.text, revision: 0 }),
```

`skip()` declines: the next row declared for the same `(input, from)` is tried.
That is how one input reaches two states —

```ts
'submit: draft -> review':    ({ input, skip }) => input.route === 'review'  ? {…} : skip(),
'submit: draft -> published': ({ input, skip }) => input.route === 'publish' ? {…} : skip(),
```

— and **declaration order is priority order**. If every candidate skips, the
machine refuses and reports `{ kind: 'none', reason: 'declined' }`, which is
deliberate: refusing is often part of the protocol. There is no `else` keyword; the
ambiguous case (all branches skipped by accident) gets a dev-mode warning instead —
_"`submit` in `draft` declined, all 2 branches skipped"_.

### Self-transitions are ordinary transitions

```ts
'revise: draft -> draft': ({ data, input }) => ({ …, revision: data.revision + 1 }),
```

No `keep`, no `repeat`, no `&`, no `stay`, no symbol. Whether anything restarts
because of this is a question for the residency handler, not for the table.

### What you get for free

Because the table is one flat block of parsed strings, all three topology questions
are a plain text search, and the reverse index is derivable:

| question                          | search       | derived type           |
| --------------------------------- | ------------ | ---------------------- |
| what can I do in `draft`?         | `: draft ->` | `Handled<T, 'draft'>`  |
| where can I `submit`?             | `'submit:`   | —                      |
| how does anything reach `review`? | `-> review`  | `Sources<T, 'review'>` |

## The host

A machine is driven through a **host** — the stateful thing that owns the current
state, dispatches to listeners, and owns their teardown.

```ts
const doc = run(publication) // one host per independent use

doc.send('open', { text: 'hello' })
doc.send('submit', { route: 'review' })

doc.current // { state: 'review', data: { … } } — an immutable snapshot
doc.available // readonly ['decide', 'cancel'] — what this state handles
```

`send` takes the input **name and payload as separate arguments**, not one merged
object. Merging them is how robot3's `[key: string]: any` hole appeared, and it
makes a `void` input just `doc.send('cancel')`.

- `doc.current` — an immutable snapshot, plain data. Safe to clone, compare,
  serialise, or hold in component state.
- `doc.available` — the inputs this state handles, as a runtime array. What UI code
  needs to render buttons.
- `send` reports its outcome: `moved`, or `none` with `declined` (a row matched and
  every candidate called `skip()`) versus `unavailable` (no row matched).

### Sending is broad, and that is deliberate

**Every declared input is accepted from every state.** An input the current state
does not handle answers `unavailable` and changes nothing — it does not throw,
corrupt, or half-apply. That is also how a stale async result lands harmlessly.

There is **no typed send site**: `doc.send('decide', …)` compiles in `draft` and is
a no-op at runtime. This is a deliberate drop, not an omission — see
[the rationale](api-rationale.md#11-sending-inputs). The short version: the
narrow-then-send shape everyone reaches for is **unsound in TypeScript and
uncorrectable** (narrowing survives mutation,
[finding 11](api-rationale.md#13-type-system-findings)), and every sound spelling
makes the caller re-state a fact the machine already knows. Adding one later is
additive; shipping the wrong one now is breaking.

**Per-state _data_ is unaffected** — narrow `doc.current` and the data narrows with
it, which is the half of typestate that works:

```ts
const now = doc.current
if (now.state === 'draft') {
	now.data.revision // number — no nullable padding
}
```

### `.on()` — effects and observation

One method, two key forms. An **edge** pattern observes committed transitions; a
**bare state key** scopes something to residency, and its return value is the
teardown:

```ts
doc.on('*: * -> published', (e) => notify(e.to.data))
doc.on('cancel: draft -> *', () => track('cancelled'))

doc.on('draft', ({ data }) => {
	const t = setTimeout(() => autosave(data), 2_000)
	return () => clearTimeout(t) // runs on leaving draft, by any route
})
```

For edges, the event is a union discriminated by `on`, so `e.on === 'submit'`
narrows `e.input`, and `e.from` / `e.to` carry each end's data. `*` is allowed at
any position, which is how entry and exit are expressed without being their own
concept:

```ts
'*: * -> loading' // entry: every arrival, including re-entry
'*: draft -> *' //   exit: every departure
```

> **Do not add the `'draft -> *'` shorthand** — dropping the input half to mean
> "any input". It collides head-on with immediate transitions, where the same shape
> means _no_ input. If it ships, it has to be taken away later; if it never ships,
> nothing is lost. See [rationale §7](api-rationale.md#7-immediate-transitions).

For residency, **setup and teardown are lexically paired**, so the correlation no
library could check becomes one no author can break: the cleanup closes over what
the setup created because it was written beside it. The teardown runs when the
state stops being current, **by any route, including a self-transition** — the
default is to restart. Reach for an edge pattern instead when the trigger needs
narrower scoping than "arriving" or "leaving": by the input
(`'submit: draft -> *'`), or by the other end of the edge
(`'*: idle -> loading'`).

**Edge handlers have no teardown.** An edge fires at a moment rather than
occupying a span, so there is nothing for a returned function to be scoped to and
the return value is ignored. The residency form expresses entry and exit too, and
often reads better: `loading: fn` is an entry with nothing to tear down, and
`draft: () => fn` is an exit with nothing to set up.

**Listeners live on the host, not the definition.** An imported definition is
inert: topology and data, nothing that runs. Two hosts over one definition share
nothing.

## The one key rule

> **A key with no `->` names a state. An edge always contains an arrow, even when
> both ends are `*`.**

That is the whole grammar. It is decidable from the string alone, so a reader never
has to know which position they are reading.

The rule costs one thing: `.on('submit', fn)` is not legal and becomes
`.on('submit: * -> *', fn)`. Without it the same bare syntax would mean an input in
one place and a state in another, and a name that is legally both — `review` is
plausibly both, and it is a state in the example above — would compile under the
wrong reading with no error. `'submit: * -> *'` is arguably better anyway: it makes
"across all edges" explicit rather than implied.

---

## What the types check

- **Per-state data.** Narrowing the state narrows its data, with no nullable
  padding in states that logically guarantee a field. This is the half of typestate
  the project is actually claiming.
- Unknown state or input names anywhere — in a transition key, a listener key, or a
  pattern.
- A handler returning the wrong shape for its target state.
- Reads of source data that the source state does not have.
- Malformed keys, reported as `not a transition: '…'` on the offending line.

Errors land on the bad line, from a single declaration site.

**What is _not_ checked: the send site.** Per-state capabilities are advertised at
runtime (`doc.available`) and not enforced by the compiler — the same place
`@cassiozen/useStateMachine` landed. The reasoning, and the way back in if it bites,
are in [the rationale](api-rationale.md#11-sending-inputs).

## Semantics

- **A transition is pure.** Given a state and an input it yields either the next
  state or a refusal (`declined` / `unavailable`), and it neither performs nor
  schedules anything.
- **State values are immutable snapshots**, and plain data — safe to clone,
  compare, serialise, or hold in component state.
- **Sending is broad.** Every declared input is accepted from every state; the ones
  the current state does not handle answer `unavailable`.
- **Effects need a host**, and only a host. Everything else is a function of the
  definition and a value.
- **Stale results are free.** A `loaded` arriving after we left `loading` matches no
  row and returns `unavailable`. That is _ignoring a result_, not _cancelling work_
  — but cancelling is what a residency teardown is for.
- Flat. No hierarchy, no parallel regions.
- EFSM, not FSM: reachability and "this guard can never fire" are out of reach and
  are not claimed.

## Deliberately absent

| absent            | because                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `enter` / `exit`  | edge patterns with one end pinned already express both                                                                                        |
| `keep` / `repeat` | unobservable without entry/exit; now a restart policy                                                                                         |
| `emit`            | a listener recovers everything from `{ on, input, from, to }`                                                                                 |
| `else`            | throws at runtime, buys no static guarantee; a dev warning instead                                                                            |
| typed `send`      | unsound in TS (narrowing survives mutation); a sound design is [recorded but unbuilt](api-rationale.md#if-it-comes-back-it-comes-back-as-s12) |
| hierarchy         | the key grammar would become paths, and every layout decision reopens                                                                         |

---

## Designed, not in v1

Both are settled shapes with the argument written down, deferred because
[commit ordering](#what-still-gates-v1) has to be answered first and neither can be
specified without it.

### `actions` — effects owned by the definition

Structurally identical to `.on()` — the same two key forms, the same teardown, the
same restart rule — but declared inside `machine({…})` rather than attached by the
caller. The split is ownership, not capability: `actions` is the machine's own
behaviour and travels with it when it is imported; `.on()` is a subscription
attached by whoever instantiates it.

```ts
actions: {
	loading:              ({ data, send }) => fetchUser(data.id, send),   // residency
	connected: persistent(({ data, send }) => subscribe(data.url, send)), // survives re-entry
	'cancel: draft -> *': () => track('cancelled'),                       // an edge
}
```

Two rules carry the design. **The default is to restart**: any transition into the
state you are already in tears the action down and re-runs it, which fails safe —
forgetting the opt-out costs a teardown, not an activity closed over stale data.
And **policy is a wrapper, not syntax**: `persistent(fn)` returns the record a
hand-written object value would have been (`{ run: fn, restart: 'never' }`), so a
bare function is sugar for `{ run: fn }`, the block stays inspectable as data, and
a further policy — `keyed`, `once`, `debounced` — is one more constructor rather
than new grammar. None is in the API until something needs it.

An action's `send` accepts only **already-declared** inputs, so `actions` adds
nothing to the vocabulary. That is exactly why it works, and exactly what a child
mount could not manage.

Being a block, it holds **one action per trigger** — two activities in one state
compose into one function that starts both and returns a combined teardown. Array
values stay available later as a pure widening if that ever reads badly. `.on()`
has no such limit, since a subscription list is additive by nature.

Full argument: [rationale §9](api-rationale.md#9-actions).

### Composition — invoked children

A child machine mounted at a state, with **its outcome as a derived state** rather
than an input, reached by an immediate transition:

```ts
invokes: { loading: Child<UserFetch, 'ok' | 'err'> }

transitions: {
	'open: empty -> loading': ({ input })   => ({ id: input.id }),
	'loading.ok -> ready':    ({ outcome }) => ({ user: outcome.user }),
	'loading.err -> broken':  ({ outcome }) => ({ error: outcome.error }),
}
```

Every edge stays in the table. `loading.ok` is a state name that happens to contain
a dot, so this needs no grammar of its own beyond immediate transitions — which are
wanted anyway. At most one child per state, enforced for free by keying on the
state name.

Full argument, the rival designs, and what is still unresolved:
[rationale §10](api-rationale.md#10-composition).

## What still gates v1

|     | question                                        | why it blocks                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **May a residency handler `send`?**             | Yes → commit ordering must define reentrancy. No → v1 cannot express fetch-then-transition at all, and the async story waits. The biggest scoping call left.                                                                                                           |
| 2   | **Commit ordering**                             | When listeners fire relative to the state change, what `send` returns, and what happens when a listener sends during a send.                                                                                                                                           |
| 3   | **`.on()` with a bare state key**               | v1's whole effect mechanism. The key rule makes it free; it is unbuilt.                                                                                                                                                                                                |
| 4   | **Does the definition/instance split survive?** | [§12](api-rationale.md#12-definition-and-instance) made it conditional on shipping composition, which is now deferred — so the conditional points at a single live object. Decide it, do not inherit it.                                                               |
| 5   | Host construction                               | `run(publication, data)` or `publication.start(data)`; initial data as an argument or beside `initial:`.                                                                                                                                                               |
| 6   | **Immediate transitions in v1?**                | `'from -> to'`, no input ([§7](api-rationale.md#7-immediate-transitions)). Designed, wanted on its own account, and it claims a key form the pattern language would otherwise take as sugar — so shipping without it costs a shorthand that has to be withdrawn later. |

Known and shippable without answering: the layout remains revisitable
([three-way, still live](api-rationale.md#4-layout)); whitespace tolerance costs the
grep story until a lint rule exists; editor completion at ~4 000 union members is
unmeasured.

**v1.1 — `actions`.** Needs commit ordering with effects in the loop, an error
channel for a throwing action, an order rule for when `actions` and `.on()` both
attach to one state, and the first real test of restart-by-default: a
self-transition that changes resident data, which has never been built.

**v1.2 — composition.** Needs the fork between the dotted form and the callback
form resolved, cancellation semantics (does leaving cancel the child's work, or only
stop us caring?), what data `loading.ok` carries, and `all` / `race`.
