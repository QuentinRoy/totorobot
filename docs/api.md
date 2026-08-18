# The API

> **Status: shipped.** This is what `src/` implements. Every choice here is argued in
> [api-rationale.md](api-rationale.md) — this document says what the API _is_, that one
> says why.
>
> **v1 is topology and data**: a declared vocabulary, a transition table, a host, and
> listeners on the host. One transition per input. `actions`, immediate transitions and
> composition are argued but deferred, and none of them promised — see
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

## The surface

Everything the package exports, and everything a host has:

| name                                                        | is                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| `machine({ initial, inputs?, states?, transitions })`       | a **definition** — inert data, never mutated           |
| `types<T>()`                                                | a declaration carrying `T`; returns `null` at runtime  |
| `definition.start(data?)`                                   | a **host** — the only mutable object in the design     |
| `host.current`                                              | `{ state, data }`                                      |
| `host.available`                                            | the input names the current state handles              |
| `host.send(name, payload?)`                                 | a dispatch; returns nothing                            |
| `host.on(pattern, listener)`                                | a subscription; returns an unsubscribe function        |
| a handler's `{ data, input, skip }`                         | source data, the input payload, and the way to decline |
| `InputsOf<M>` `StatesOf<M>` `Handled<M, S>` `Sources<M, S>` | derived types, over `M = typeof publication`           |

---

## `inputs` and `states` — the vocabulary

```ts
inputs: types<{ submit: Submit; cancel: void }>(),
states: types<{ empty: void; draft: { text: string; revision: number } }>(),
```

Both maps are **declared**. `types<T>()` exists only to carry `T`; it carries no runtime
value, and **returns `null`** — that is what a caller observes, rather than `undefined`
or a marker object. Nothing reads it, so the two fields are inert at runtime.

- A data-free state, or an input with no payload, is `void`.
- Each map is an ordinary type, so it can be named, exported, imported, generated, made
  generic, or built with `Omit`/`&`. **Name them.** Writing `types<Inputs>()` rather
  than `types<{ … }>()` keeps hover text and error messages from inlining the whole
  literal. A single `Publication = { inputs; states }` still works if you want one
  exported name — pass `types<Publication['inputs']>()`.
- Extraction goes through named helpers rather than the value's type:
  `InputsOf<typeof publication>`, `StatesOf<typeof publication>` — the same family as
  `Handled<M, 'draft'>` and `Sources<M, 'review'>`, which take the machine type as `M`.

**Both are optional, and omitting them infers names — not data — from `transitions`.**
A JavaScript caller writes `machine({ initial, transitions })` and gets a working
machine; a TypeScript caller who omits a map gets that half's _names_ as exactly what
`transitions` mentions rather than widening to `string`, while the _data_ each name
carries stays `unknown`, since nothing declares it — and **the key grammar still
enforced**, a malformed key a compile error whether or not a vocabulary was declared.
Declaring one map and not the other is supported and checks that half while the other's
names are still read off the table. This is a guarantee, not an accident: see
[observable behaviour](#observable-behaviour) items 27–29.

_Why declared, what it closed, and what it costs:_
[rationale §5](api-rationale.md#5-the-declared-vocabulary).

## `transitions` — the table

One row per edge, all four coordinates on one line at fixed positions no formatter can
move.

### The key language

```
from -input> to
```

The input is the arrow's **label**. Two rules:

- **Whitespace is load-bearing**: exactly one space before the `-`, one after the `>`.
  Any other spelling is a compile error, and the source is therefore at column 1 on
  every row.
- **A key with no `->` names a state. An edge always contains an arrow.** So the two
  halves of the grammar are decidable from the string alone. In v1 every key is an edge
  — a bare key is invalid in `transitions` and in `.on()`. The bare form is reserved
  for residency, which is what [`actions`](#designed-not-in-v1) would use.

_Why this notation, and the spellings it rejects:_
[rationale §4](api-rationale.md#adopted-the-label-on-the-arrow).

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
declines the input: nothing changes, and no listener fires. That is a normal outcome
rather than a fault — the `revise` row above declines an unchanged text on purpose — and
nothing reports it. `available` is how you know in advance which inputs a state answers
to at all.

### Self-transitions are ordinary transitions

A row whose target is its source. Its handler receives the old data and returns the new
one, and it commits and notifies like any other row:

```ts
'draft -revise> draft': ({ data, input }) => ({ …, revision: data.revision + 1 }),
```

### What you get for free

The table is one flat block of string keys, so all three topology questions are a plain
text search, exact rather than approximate, and the reverse index is derivable:

| question                          | search     | derived type           |
| --------------------------------- | ---------- | ---------------------- |
| what can I do in `draft`?         | `'draft -` | `Handled<M, 'draft'>`  |
| where can I `submit`?             | `-submit>` | —                      |
| how does anything reach `review`? | `> review` | `Sources<M, 'review'>` |

## The host

`definition.start(data)` returns a **host**: the stateful thing that owns the current
state, dispatches to listeners, and is the only mutable object in the design.

```ts
const doc = publication.start() // `empty` is void, so no argument
doc.send('open', { text: 'hello' })

doc.current // { state: 'draft', data: { text: 'hello', revision: 0 } }
doc.available // readonly ['revise', 'submit', 'cancel']
```

One host per independent use — two hosts over one definition share no state and no
listeners, and neither mutates the definition.

### Reading

- **`current`** is `{ state, data }`, plain data. `data` is `undefined` for a state
  declared `void`. **A value read from it stays valid and unchanged across later
  transitions**, which is what makes it safe to compare, serialise, or hold in
  component state. Nothing is frozen, though: immutability is `readonly` in the types
  plus a promise not to mutate, not a runtime guard.
- **`available`** is the input names the current state handles, in the table's
  declaration order, without duplicates — one `'submit'` even though two rows carry it.
  This is what UI code needs to render buttons, and it is the runtime half of per-state
  capabilities.
  **It is derived from the table, not from running handlers**, so an input whose every
  candidate row would `skip()` is still listed. Deciding otherwise would mean evaluating
  handlers, which needs a payload `available` does not have — and would run them for
  their answer without committing it. `available` therefore says which inputs the state
  has rows for, not which will commit.

### Sending

`send` takes the input **name and payload as separate arguments**, not one merged
object, so a `void` input is just `doc.send('cancel')`.

**Sending is broad: every declared input is accepted from every state.** One the
current state does not handle changes nothing — it does not throw, corrupt, or
half-apply, and that is also how a stale async result lands harmlessly.

**`send` returns nothing.** What happened is `doc.current`; what would have been
accepted is `available`, consulted before sending rather than reported after.

**There is no typed send site**: `doc.send('decide', …)` compiles in `draft` and does
nothing at runtime. Per-state capabilities are advertised at runtime and not enforced
by the compiler. This is a deliberate drop — the narrow-then-send shape is unsound in
TypeScript ([finding 11](api-rationale.md#13-type-system-findings)) — and a sound
variant stays addable later without breaking anything
([rationale §11](api-rationale.md#11-sending-inputs)).

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

**On the host, never the definition** — an imported definition is inert. `.on()` returns
an unsubscribe function.

**The handler receives the transition record**, `{ on, input, from, to }`, discriminated
by `on`, so `e.on === 'submit'` narrows `e.input`, and `e.from` / `e.to` each carry
their end's `{ state, data }`.

**Patterns are the key language with coordinates left open.** `*` stands for any state,
and an unlabelled arrow means any input, or none:

```ts
'* -> loading' //     entry: every arrival, including re-entry
'draft -> *' //       exit:  every departure, however caused
'draft -submit> *' // narrower: departures caused by `submit`
'* -submit> *' //     every `submit` edge, wherever it goes
```

There is no `-*>`: `*` appears only in state positions, so the input coordinate is
either a name or absent. The unlabelled form is the broad one — it matches input-driven
edges, and would match edges with no input at all if
[immediate transitions](#designed-not-in-v1) ever land. A bare key is not legal:
`doc.on('draft', fn)` names a state, and states mean residency.

_Why patterns and a record rather than a snapshot:_
[rationale §12](api-rationale.md#observation-on-on-the-host-with-patterns).

### Residency is a recipe, not a feature

Scoping something to "while we are in `draft`", with a teardown, needs nothing the host
does not already provide:

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
than being implemented. The policy wrappers come along too: `persistent` is
`if (e.to.state !== e.from.state)` in the exit handler, `keyed` compares
`k(e.from.data)` against `k(e.to.data)`.

What the host would have to own instead is [`actions`](#designed-not-in-v1) — residency
declared in the definition ([rationale §12](api-rationale.md#residency-is-derivable-not-a-host-feature)).

### Commit ordering

Five rules, and they are the whole execution model:

1. **One input yields at most one transition.**
2. **Commit, then notify.** A listener always sees a fully committed machine, so `e.to`
   and `doc.current` agree — for every listener, always.
3. **Listeners fire in registration order.**
4. **A send from a listener is queued**, and the queue drains before the outermost
   `send` returns — never on a microtask, never nested. So a listener is never
   re-entered while an earlier call is still running, and the listeners after it are
   never told about a transition the machine has already left.
5. **`send` returns nothing**, including when it was queued.

**There is no `stop()`.** Disposal is unsubscribing your listeners and not sending any
more; the host holds nothing else.

_Why a queue, and what a throwing listener does:_
[rationale §12](api-rationale.md#commit-ordering).

---

## Observable behaviour

The spec above, as the list of things that can be asserted. Written for the
implementation to be driven from.

**Construction**

1. `start(data)` yields a host whose `current` is `{ state: initial, data }`. `start()`
   takes no argument when the initial state is declared `void`, and its `current.data`
   is then `undefined`.
2. Two hosts from one definition share no current state and no listeners.
3. Nothing ever mutates the definition.

**Reading**

4. `current` is `{ state, data }`; `data` is `undefined` for a `void` state.
5. A value read from `current` before a transition is unchanged after it.
6. `available` lists the current state's inputs in table order, deduplicated. It comes
   from the table alone: an input whose every candidate row would `skip()` is listed
   like any other.
7. `available` is `[]` for a state with no outgoing rows.

**Sending**

8. A handled input commits: `current` becomes `{ state: target, data: projection }`, and
   every listener whose pattern matches that edge fires.
9. An input no row matches changes nothing and fires no listener.
10. An input whose every candidate row calls `skip()` changes nothing and fires no
    listener. Externally indistinguishable from 9, deliberately — except that it is in
    `available` and the input of 9 is not (6).
11. With several rows for one `(from, input)`, candidates are tried in declaration order
    and the first that does not skip wins.
12. A self-transition commits and notifies like any other, with
    `e.from.state === e.to.state`, `e.from.data` the old data and `e.to.data` the new.
13. A handler receives the source state's data and the input payload; a `void` input's
    payload is `undefined`.
14. A handler whose target is `void` returns nothing.
15. `send` returns `undefined`, always.
16. An input name that is not in the vocabulary (reachable from untyped code) changes
    nothing.

**Observing**

17. `on` returns an unsubscribe function; calling it more than once is harmless.
18. Listeners fire after the commit, in registration order.
19. Inside a listener, `e.to` deep-equals `doc.current`.
20. `*` matches any state; an unlabelled arrow matches any input; a labelled one matches
    only that input.
21. The listener list is snapshotted before dispatch: a listener unsubscribed by an
    earlier listener still runs for the current transition, and one registered during a
    dispatch does not.

**The queue**

22. A `send` from inside a listener does not take effect before the remaining listeners
    for the current transition have run.
23. The queue drains before the outermost `send` returns — synchronously, not on a
    microtask.
24. Several sends from listeners drain first-in-first-out.
25. A queued send is evaluated against the state at drain time, so it may find no row
    and do nothing.
26. A listener that throws propagates out of `send`. The listeners after it do not run
    and that dispatch's queue is abandoned, but the transition stays committed. **The
    host still works afterwards**: a later `send` transitions and notifies normally.

**The untyped path**

27. With `inputs` and `states` both omitted, a well-formed table compiles: state and
    input names are exactly the ones `transitions` mentions, `data` and `input` are
    `unknown`, and `initial` must name a state that appears somewhere in the table.
28. A malformed key is still rejected with no vocabulary declared, and the error still
    lands on the offending line rather than on the `transitions` block.
29. Declaring one map and omitting the other checks that half and infers the other from
    the table, the same as omitting both.

## What the types check

- **Per-state data.** Narrowing the state narrows its data, with no nullable padding in
  states that logically guarantee a field.
- Unknown state or input names anywhere in a transition key or a pattern.
- A handler returning the wrong shape for its target state.
- Reads of source data the source state does not have.
- Malformed keys — wrong spacing included — reported as `not a transition: '…'` on the
  offending line.

Errors land on the bad line, from a single declaration site, and no handler needs a type
annotation.

**What is _not_ checked: the send site.** Per-state capabilities are advertised at
runtime (`available`) rather than enforced by the compiler.

## What is claimed, and what is not

- **A transition is pure.** Given a state and an input it yields either the next state
  or a refusal, and it neither performs nor schedules anything.
- **Sending is broad**, and `available` says in advance which inputs the current state
  has no row for at all — not which ones will commit, since a row may still decline.
- **Big steps terminate**, because one input causes at most one transition.
- **Stale results are free.** A `loaded` arriving after we left `loading` matches no row
  and does nothing. That is _ignoring a result_, not _cancelling work_; cancelling is
  the caller's.
- **States have no runtime existence.** The definition carries transition keys, not a
  list of states, so there is no source for a visualiser or a "valid states are …"
  message, and a state with no transitions is invisible at runtime.
- Flat: no hierarchy, no parallel regions.
- EFSM, not FSM — reachability and "this guard can never fire" are out of reach and are
  not claimed.

## Deliberately absent

Not oversights. What to reach for instead, and where the argument is:

| absent                      | instead                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `enter` / `exit`            | patterns with one end pinned ([§9](api-rationale.md#9-actions))                                                  |
| residency in the host       | the recipe above ([§12](api-rationale.md#residency-is-derivable-not-a-host-feature))                             |
| `keep` / `repeat` / `stay`  | an ordinary self-transition row; restart is an action's question ([§6](api-rationale.md#6-self-transitions))     |
| `emit`                      | the transition record `{ on, input, from, to }` ([§6](api-rationale.md#6-self-transitions))                      |
| `else`                      | declining is a normal outcome, and silent ([§4](api-rationale.md#two-decisions-that-fell-out-of-the-comparison)) |
| a `send` return value       | `current` and `available` ([§12](api-rationale.md#send-returns-nothing))                                         |
| `stop()`                    | unsubscribe, and stop sending ([§12](api-rationale.md#no-disposal-and-a-listener-that-throws))                   |
| typed `send`                | `available` at runtime; recorded but unbuilt ([§11](api-rationale.md#if-it-comes-back-it-comes-back-as-s12))     |
| immediate transitions       | an explicit input on the edge ([§7](api-rationale.md#7-immediate-transitions))                                   |
| hierarchy, parallel regions | out of scope ([§10](api-rationale.md#what-the-rest-of-the-record-forbids))                                       |

---

## Designed, not in v1

Three directions v1 leaves room for, argued in the rationale and none of them built.
Sketches rather than commitments: whether each ships, in what order, and — for
composition — in what shape are all open.

### `actions` — effects owned by the definition

v1's answer to effects is "the caller writes a function". `actions` is trigger-keyed and
declared inside `machine({…})`, so behaviour travels with the definition when it is
imported:

```ts
actions: {
	loading:              ({ data, send }) => fetchUser(data.id, send),   // residency
	connected: persistent(({ data, send }) => subscribe(data.url, send)), // survives re-entry
	'draft -cancel> *':   () => track('cancelled'),                       // an edge
}
```

The default is to restart: any transition into the state you are already in tears the
action down and re-runs it. Policy is a wrapper rather than syntax — `persistent(fn)`,
and later `keyed`, `once`, `debounced`. An action's `send` accepts only
already-declared inputs, so `actions` adds nothing to the vocabulary. One action per
trigger.

_Full argument: [rationale §9](api-rationale.md#9-actions)._

### Immediate transitions — `'from -> to'`, no input

A transition that fires on entering a state, with `skip()` fall-through giving a guarded
choice for free. The least certain of the three: chaining is the one feature that
forfeits guaranteed termination, so this may end up not landing at all.

_Full argument: [rationale §7](api-rationale.md#7-immediate-transitions)._

### Composition — invoked children

A child machine mounted at a state. The leading sketch has the child's outcome as a
derived state rather than an input, reached by an immediate transition:

```ts
invokes: { loading: Child<UserFetch, 'ok' | 'err'> }

transitions: {
	'empty -open> loading': ({ input })   => ({ id: input.id }),
	'loading.ok -> ready':   ({ outcome }) => ({ user: outcome.user }),
	'loading.err -> broken': ({ outcome }) => ({ error: outcome.error }),
}
```

Every edge stays in the table, and `loading.ok` is a state name that happens to contain
a dot, so this spelling needs no grammar of its own beyond immediate transitions. Rival
designs need none of that, which is part of what is unresolved.

_Full argument, the rival designs, and what is unresolved:
[rationale §10](api-rationale.md#10-composition)._

---

## Scope

**v1** is this document. Two costs are known and accepted: the notation is not settled
beyond appeal — rival layouts still compile — and the completion payload grows as
|states|², measured, with latency fine
([rationale §15](api-rationale.md#15-still-open), `pnpm measure:completions`).

**After v1**, likeliest first and none of it promised: `actions`, which is what extends
commit ordering to effects — teardown, setup and notification within one commit, plus an
error channel for a throwing action — then immediate transitions, then composition.
[Rationale §15](api-rationale.md#15-still-open) has what is still open.
