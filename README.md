<p align="center">
  <img src="assets/totorobot.svg" alt="Totorobot mascot playing an electric guitar" width="240">
</p>

<h1 align="center">Totorobot</h1>

<p align="center">
  Dead-simple state machines. Hard-core typing. No bloat.
</p>

<br>

<p align="center">
  <a href="https://www.npmjs.com/package/totorobot"><img src="https://img.shields.io/npm/v/totorobot?label=" alt="npm version"></a>
  <a href="https://bundlejs.com/?q=totorobot"><img src="https://deno.bundlejs.com/?q=totorobot&badge" alt="Bundle size"></a>
</p>

Totorobot combines clean, readable definitions with precise types. Its API reads
like a transition graph, and TypeScript checks the details around it.
It is tiny and has no runtime dependencies. We work to keep it that way.

Each line in the transition table looks like the edge it declares:

```
'draft -submit> review'
```

Source state, input, target state. That is the whole notation.

Each state carries its own data, and the compiler knows which state you are in.
`review` requires a `reviewer` that `draft` does not have. Check the current
state's name and TypeScript narrows its fields with it, so reading `reviewer`
anywhere but `review` is a compile error. Most libraries share one context
object across every state, which forces any field that only some states carry to
be optional everywhere and checked everywhere.

A definition is inert data. `.start()` creates a running host that accepts inputs
and notifies observers. The host is the only mutable part.

## Install

```bash
npm install totorobot
```

The package uses ESM and includes its own TypeScript declarations.

## Example

```ts
import { machine, type } from 'totorobot'

export const publication = machine({
	inputs: type<{
		open: { text: string }
		revise: { text: string }
		submit: { reviewer: string }
		publish: undefined
		expireReview: undefined
		cancel: undefined
	}>(),

	states: type<{
		empty: undefined
		draft: { text: string; revision: number }
		review: { text: string; revision: number; reviewer: string }
		published: { text: string; revision: number }
	}>(),

	initial: 'empty',

	transitions: {
		'empty -open> draft': ({ inputData }) => ({
			text: inputData.text,
			revision: 0,
		}),
		'draft -submit> review': ({ fromData, inputData }) => ({
			...fromData,
			reviewer: inputData.reviewer,
		}),
		'review -publish> published': ({ fromData }) => ({
			text: fromData.text,
			revision: fromData.revision,
		}),
		'review -expireReview> draft': ({ fromData }) => ({
			text: fromData.text,
			revision: fromData.revision,
		}),
		'draft -cancel> empty': () => {},
	},

	actions: {
		review: ({ send }) => {
			const timer = setTimeout(() => send('expireReview'), 30_000)
			return () => clearTimeout(timer)
		},
	},
})

const doc = publication.start()
doc.observe('* -> published', (e) => notify(e.toData))
doc.send('open', { text: 'hello' })
doc.send('submit', { reviewer: 'Quentin' })
```

`reviewer` exists only on `review`. `draft` does not have it yet, `published` no
longer needs it, and neither carries a nullable placeholder. While the document
is in review, the action schedules an input on the same host. Its teardown clears
the timer if review ends first. The caller registers publication notifications
through `observe`.

## Contents

- [Install](#install)
- [Example](#example)
- [The surface](#the-surface)
- [`inputs` and `states`: the vocabulary](#inputs-and-states-the-vocabulary)
  - [Migrating from the tagged shape](#migrating-from-the-tagged-shape)
- [`initial`: where a host starts](#initial-where-a-host-starts)
- [`transitions`: the table](#transitions-the-table)
  - [The key language](#the-key-language)
  - [The handler decides and projects](#the-handler-decides-and-projects)
  - [Declining, and row precedence](#declining-and-row-precedence)
  - [Immediate transitions: an edge with no input](#immediate-transitions-an-edge-with-no-input)
  - [What the table gives you for free](#what-the-table-gives-you-for-free)
- [`actions`: lifetime-scoped work](#actions-lifetime-scoped-work)
- [The host](#the-host)
  - [Reading](#reading)
  - [Sending](#sending)
  - [Observing](#observing)
  - [Residency](#residency)
  - [Commit ordering](#commit-ordering)
- [A worked example](#a-worked-example)
- [What the types check](#what-the-types-check)
- [Guarantees and absences](#guarantees-and-absences)
- [The untyped path](#the-untyped-path)
- [Beyond v1](#beyond-v1)
- [Documentation](#documentation)
- [Development](#development)
- [Releasing](#releasing)
- [Thanks](#thanks)
- [License](#license)

## The surface

Everything the package exports:

| export                                                                                     | is                                                               |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `machine({ inputs?, states?, initial, transitions, actions? })`                            | a definition: inert data, never mutated                          |
| `type<T>()`                                                                                | a declaration carrying `T`; returns `undefined` at runtime       |
| `InputsOf<M>` `StatesOf<M>` `Handled<M, S>` `Sources<M, S>` `Patterns<M>` `Listener<M, P>` | derived types, over `M = typeof publication`                     |
| `Skip`                                                                                     | what `skip()` returns; it appears in every handler's return type |

## `inputs` and `states`: the vocabulary

```ts
inputs: type<{ submit: { reviewer: string }; cancel: undefined }>(),
states: type<{ empty: undefined; draft: { text: string; revision: number } }>(),
```

Both are maps from a name to its payload. Use `undefined` for a name that carries
no data. A payload may be a primitive, function, `Map`, or object with its own
`name` or `type` property. Totorobot stores the value unchanged; it does not
spread, clone, freeze, or validate it. Mutating an object is therefore visible
through earlier snapshots.

`type<T>()` only carries `T`. It returns `undefined`, and nothing reads it.
Either vocabulary can be named, exported, imported, generated, or declared
inline. `InputsOf<typeof publication>` and `StatesOf<typeof publication>`
extract the two maps. Omitting either key infers its names from `transitions`,
with `unknown` payloads.

### Migrating from the tagged shape

Both vocabularies used to be `type`/`name`-tagged unions. Replace each with a
map, pass a name and its payload separately, and read the payload from the
`…Data` field beside each name:

```ts
// before
type Inputs = { type: 'open'; text: string } | { type: 'cancel' }
type States = { name: 'empty' } | { name: 'draft'; text: string }
host.send({ type: 'open', text: 'hello' })
host.current.text
'empty -open> draft': ({ state, input }) => ({ text: input.text }),

// after
type Inputs = { open: { text: string }; cancel: undefined }
type States = { empty: undefined; draft: { text: string } }
host.send('open', { text: 'hello' })
host.current.data.text
'empty -open> draft': ({ inputData }) => inputData,
```

A handler now returns its destination's payload alone, so a target carrying
nothing takes an empty body and a target carrying data returns that data
directly. `{}` is no longer a way to say "nothing": return nothing at all.

## `initial`: where a host starts

`initial` names the state a new host begins in, and it has to be one of the
declared states: anything else is a compile error on the `initial` line.

That state alone decides whether `.start()` takes an argument. `empty` above
carries no payload, so `publication.start()` takes none. An initial state that
does carry data makes its payload a required argument, as in
`counter.start({ count: 0 })`.

Nothing announces the state a host starts in. Listeners attach to the host that
`.start()` hands back, so the earliest thing they can see is the first
transition. If the initial state has
[immediate rows](#immediate-transitions-an-edge-with-no-input) they run before
the host comes back, and `.start()`'s argument still follows the declared
initial state rather than wherever that chain lands.

## `transitions`: the table

One row per edge: the key names it, the value handles it. Source, input and
target sit at fixed positions no formatter can move.

### The key language

```
from -input> to
```

The input is the arrow's label, and three rules govern the spelling:

- **The spaces are part of the grammar.** Exactly one before the `-`, one after
  the `>`; any other spelling is a compile error. The payoff is that the source
  name sits at column 1 on every row.
- **An edge always contains an arrow, so a key with no arrow names a state.**
  Bare keys are reserved for [residency](#residency) and rejected in
  `transitions` and in `observe()` patterns alike. The string alone therefore
  says which of the two you wrote.
- **An arrow with no label is an
  [immediate transition](#immediate-transitions-an-edge-with-no-input)**:
  `'checking -> allowed'`. That edge has no input at all. A pattern's unlabeled
  arrow means something different: there, the input is unconstrained.

A malformed key is reported at compile time as `not a transition: '…'`, on its
own line. The grammar is enforced at runtime too: `machine()` throws
`SyntaxError` for a malformed key, `observe()` does the same for a malformed
pattern, and both name the offending string. That is what catches a typo in plain
JavaScript, where nothing else checks what was written.

### The handler decides and projects

A handler receives the three names its row already spells, `from`, `input`, and
`to`, plus `fromData` and `inputData`. It returns only the destination's payload:

```ts
'empty -open> draft': ({ inputData }) => ({ text: inputData.text, revision: 0 }),
```

The row determines the destination name. A returned payload with its own `name`
property is ordinary data and cannot redirect the transition. A destination
carrying nothing takes a handler with an empty body. If the destination payload
is the source payload, `({ fromData }) => fromData` passes the same reference
through.

### Declining, and row precedence

`skip()` declines the row, and the next row declared for the same source and
input is tried. It returns a private symbol, the only value that cannot be a
payload; every other symbol is ordinary data. Declaration order sets priority.
That is how one input reaches two states:

```ts
'draft -submit> review': ({ fromData, inputData, skip }) =>
	inputData.reviewer ? { ...fromData, reviewer: inputData.reviewer } : skip(),
'draft -submit> published': ({ fromData }) => ({
	text: fromData.text,
	revision: fromData.revision,
}),
```

A submission naming a reviewer goes to `review`; one that names nobody skips that
row and publishes directly.

If every candidate skips, the machine declines the input: nothing changes and no
listener fires. An input the current state has no row for is declined the same
way. Both are normal outcomes rather than faults, both are silent, and nothing
tells them apart.

A row that always declines under some condition is an ordinary way to express
"this input does not apply right now":

```ts
'draft -revise> draft': ({ fromData, inputData, skip }) =>
	inputData.text === fromData.text
		? skip()
		: { text: inputData.text, revision: fromData.revision + 1 },
```

That row is also a self-transition, a row whose target is its source. It
commits and notifies like any other row.

### Immediate transitions: an edge with no input

A row whose arrow carries no label fires on entering its source state, tried
in declaration order alongside every other immediate row declared for that
state:

```ts
'draft -submit> checking': ({ inputData }) => inputData,
'checking -> allowed': ({ fromData, skip }) =>
	fromData.quota > 0 ? fromData : skip(),
'checking -> denied': ({ fromData }) => fromData,
```

Sending `submit` from `draft` lands in `checking`, which tries its own rows at
once and continues on to `allowed` or `denied` without anyone sending anything.
`skip()` falls through to the next candidate exactly as it does on an
input-driven row, so a guarded choice needs no `cond` and no junction
pseudostate. If every candidate skips, the machine stays in `checking` with its
input rows still live, which covers "the condition is not met yet".

Chains settle before anything else runs. Landing somewhere that itself has
immediate rows continues the chain hop after hop, each one committing and
notifying before the next is tried, until the machine stops moving on its own.
Only then is the next queued input taken; see
[commit ordering](#commit-ordering).

The handler receives no input. `input` is `undefined`, typed that way rather
than absent, so reading it is as ordinary as on any other row. The transition
record carries `input: undefined` too. A payload-free named input keeps its name
and carries `inputData: undefined`.

A chain that never settles throws. After 100,000 consecutive hops the machine
raises `RangeError`, naming a state inside the cycle. There is no rollback:
listeners keep every hop that committed, and the host stays usable.

`.start()` settles the initial state's immediates too, chain and all, before
the host is handed back, so those hops are unobservable: nobody has subscribed
yet. If you need to observe an arrival, do not make it the initial state. The
argument still follows the declared initial state's payload rather than the
settled one's, and a cycle among those rows throws from `.start()` instead of
from `send` ([rationale §6](docs/design-record.md#what-it-forces-open)).

### What the table gives you for free

The table is one flat block of string keys, so all three topology questions are
an exact text search:

| question                          | search     |
| --------------------------------- | ---------- |
| what can I do in `draft`?         | `'draft -` |
| where can I `submit`?             | `-submit>` |
| how does anything reach `review`? | `> review` |

Two of the three are derivable as types as well: `Handled<M, 'draft'>` and
`Sources<M, 'review'>`, so the reverse index never has to be maintained by hand.

## `actions`: lifetime-scoped work

Work scoped to a state, or to a transition, declared with the machine rather
than assembled by every caller:

```ts
const profile = machine({
	// ... a `loading` state carrying an `id`, and `loaded` / `failed` inputs
	actions: {
		loading: {
			run: ({ toData, send }) => {
				const ctrl = new AbortController()
				fetchUser(toData.id, ctrl.signal).then(
					(user) => send('loaded', { user }),
					(reason) => send('failed', { reason }),
				)
				return () => ctrl.abort()
			},
			restart: false, // survives re-entry; a fetch already in flight keeps running
		},
		'draft -submit> review': (e) => track('submitted', e.toData.text),
	},
})
```

The key decides how it is read. No `->` names a state: the function runs on
entry, and the function it returns runs on exit. With `->` it is an edge, firing
once per matching transition in the same [pattern language](#observing),
including wildcards.

Every action receives the same transition record as a matching
[listener](#observing):
`{ input, inputData, from, fromData, to, toData, send }`. A residency is an
arrival, so its `to` is the resident state. On an arrival with no transition,
either the initial state or a residency registered while the host already
occupies its state, `input`, `inputData`, `from`, and `fromData` are `undefined`.
Reading `from` therefore requires narrowing first.

Starting a host runs a declared residency on the initial state, never an edge
action. Entering the initial state is not a transition, so no edge action
fires there, including `* -> *`. Edge actions fire only on later transitions,
with `from` always present. An initial immediate chain still fires an edge action
per hop and the residency on every state it passes through, after the initial
state's own residency has run.

Only a residency may return a teardown. Returning one from an edge is a
compile error, so moving a helper between the two cannot silently strand its
cleanup. An `async` body is rejected for the same reason: it returns a promise.

An action is a bare function, a record with `run`, or an array of either.
The record carries `restart`. The array lets one trigger carry several actions,
which are set up in declaration order and torn down in reverse. Two residents of
one state can therefore use different policies.

A self-transition tears down and sets up again by default, exactly as the
[caller-side recipe](#residency) does. Residency runs on every hop of an
immediate chain, including a state entered and left within one drain.
`restart: false` survives it instead: no teardown, no second setup. A predicate
receives the same six transition facts without `send` and returns a boolean. For
example, `({ fromData, toData }) => fromData.id !== toData.id` restarts when the
resident `id` changes. `restart` is consulted only on a self-transition; leaving
for another state always tears down. It is a compile error on an edge, since an
edge has nothing to restart. Each residency's predicate runs once per
self-transition; the same decision governs both the teardown and the setup that
follows it.

For each commit, Totorobot runs the old residency's teardown, commits the new
state, runs every matching action in declaration order, then calls the listeners.
[Commit ordering](#commit-ordering) is otherwise unchanged. If an action throws,
the error propagates and the rest of that commit does not run, just as with a
throwing listener. If one of several teardowns on a trigger throws, the rest of
the reverse-order teardown does not run.

## The host

`definition.start(data)` returns the stateful thing that owns the current state
and dispatches to listeners. One host per independent use: two hosts over one
definition share no state and no listeners, and neither mutates the definition.

| member                            | is                                                                  |
| --------------------------------- | ------------------------------------------------------------------- |
| `definition.start(data?)`         | creates a host; `data` follows the declared initial state's payload |
| `host.current`                    | `{ name, data }`: where the host is, and what that state carries    |
| `host.send(input, inputData?)`    | a dispatch; returns nothing                                         |
| `host.observe(pattern, listener)` | a subscription; returns an unsubscribe function                     |

```ts
const doc = publication.start() // `empty` carries no payload, so no argument
doc.send('open', { text: 'hello' })

doc.current // { name: 'draft', data: { text: 'hello', revision: 0 } }
```

### Reading

`current` pairs the state's name with its payload. A state carrying nothing still
has `data`, set to `undefined`. A snapshot stays valid and unchanged after later
transitions, so you can compare, serialize, or keep it in component state. The
payload is the value you passed in, not a copy. Nothing is frozen, and mutating
that value is visible through every snapshot that holds it.

Checking `name` narrows `data` with it. This is Totorobot's typestate guarantee:

```ts
const now = doc.current
if (now.name === 'draft') {
	now.data.revision // number, with no nullable padding
}
```

### Sending

`send` takes an input name followed by its data. Omit the second argument when
the declared data type includes `undefined`: `doc.send('cancel')`. It returns
nothing; read `doc.current` to see the result. `null` is data like any other and
must be passed.

A union-valued name cannot be paired with a separate union-valued payload: the
values may not belong together. Narrow the name before forwarding a transition
record:

```ts
doc.observe('* -> *', (e) => {
	if (e.input === 'open') e.send(e.input, e.inputData)
})
```

You can send every declared input from every state. If the current state does
not handle an input, nothing changes: the machine does not throw, corrupt its
state, or apply half a transition. That is also how a stale asynchronous result
lands harmlessly.

If you call `send` while a dispatch is in progress, Totorobot queues it. This is
true whether the call comes from a listener or from a hop that `.start()` is
settling, and whether it targets the dispatching host or an unrelated one. A
send takes effect immediately only when no dispatch is running anywhere.
Otherwise it waits for the active dispatch to settle, and `current` read right
after the call still shows the earlier state. [Commit ordering](#commit-ordering)
has the mechanics.

The compiler does not restrict inputs by the current state.
`doc.send('publish')` compiles in `draft` and does nothing at runtime. This is a
deliberate tradeoff: the narrow-then-send shape is unsound in TypeScript, and a
sound variant can be added later without breaking anything
([rationale §12](docs/design-record.md#12-sending-inputs)).

### Observing

```ts
const off = doc.observe('* -> published', (e) => notify(e.toData))
doc.observe('draft -cancel> *', () => track('cancelled'))
```

Listeners go on the host, never on the definition, which is inert. `observe()`
returns an unsubscribe function.

The listener receives the transition record,
`{ input, inputData, from, fromData, to, toData, send }`: three names, each next
to its payload. Checking a name narrows the payload beside it, just as checking
`current.name` narrows `current.data`. For example, `if (e.from === 'draft')`
narrows `e.fromData`. An immediate transition carries `input: undefined` and
`inputData: undefined`; a payload-free named input keeps its name and carries
`inputData: undefined`.

`e.send` is the host's own `send`, so a reaction drives the machine without
closing over the host it was registered on:

```ts
doc.observe('* -> review', (e) => e.send('publish'))
```

It takes the whole declared input vocabulary, however narrow the pattern is.
The pattern does not limit it to what `e.from` or `e.to` handles. A send from a
listener is
[queued](#commit-ordering) and read when the queue reaches it, by which point
the machine has usually moved on, so narrowing to the notified state's rows
would reject the ordinary case.

Patterns use the same key language with some parts left open. `*` stands for any
state, and an unlabeled arrow means any input or no input:

```ts
'* -> loading' //     entry: every arrival, including re-entry
'draft -> *' //       exit:  every departure, however caused
'draft -submit> *' // narrower: departures caused by `submit`
'* -submit> *' //     every `submit` edge, wherever it goes
```

There is no `-*>`. `*` appears only in state positions, so the input coordinate
is either a name or absent. The unlabeled form is the broad one: it matches
input-driven edges and
[immediate transitions](#immediate-transitions-an-edge-with-no-input), which
have no input at all. A labeled pattern never matches an immediate. A bare key
is legal too, but means something else entirely: [residency](#residency), next.

A pattern built from declared state and input names but naming no declared row
— exact or broad — is a compile error, not a listener typed with `never`:

```ts
doc.observe('draft -publish> published', () => {}) // no such row: compile error
```

This checks table membership only, never reachability: a row unreachable from
`initial`, or one a guard always declines, still counts.

Completion in an editor offers only matchable patterns — the row keys
themselves and their wildcard generalizations — instead of every name-valid
combination. `Patterns<typeof publication>` names that set, and
`Listener<typeof publication, P>` names what goes beside it, so a helper
wrapping `observe` can type both of its arguments and stay generic in the
pattern:

```ts
const watch = <P extends Patterns<typeof publication>>(
	pattern: P,
	listener: Listener<typeof publication, P>,
) => doc.observe(pattern, listener)

watch('draft -submit> review', (e) => e.toData.reviewer) // `to` is 'review'
watch('empty -cancel> draft', () => {}) // no such row: compile error
```

The caller of `watch` keeps everything a direct `observe` gives them: the dead
pattern is rejected at the helper's own boundary, and the record is narrowed to
the row the live one matched. Written without a pattern,
`Listener<typeof publication>` covers every row the table can fire, which is
what a helper that takes the whole union wants instead.

### Residency

A bare state key passed to `observe` scopes work to "while we are in `draft`",
teardown included, with the same record [`actions`](#actions-lifetime-scoped-work)
takes:

```ts
const off = doc.observe('draft', {
	run: ({ toData }) => track(toData.text),
	restart: false,
})
```

If the host is already in that state, the residency runs immediately;
registration order cannot decide whether it fires. Unsubscribing tears down an
active residency, and calling the unsubscribe function more than once is
harmless. Declaring a residency in the definition uses the same bare-key trigger
in `actions` for a machine's own states. `observe` remains the way to scope work
to a state you did not use to declare the machine. A test asserts that a declared
residency and `observe` produce the same log for the same machine.

Nothing here is a host feature: `observe(state, { run, restart })` is exactly
the two-pattern recipe below, offered directly instead of assembled by hand.
Observe `'draft -> *'` to tear down and `'* -> draft'` to set up. Register the
exit listener first so a self-transition tears down before it sets up again, and
run the setup once at registration if the host is already in the state.
`persistent` is `if (e.to !== e.from)` in the exit handler; `keyed`
compares a key computed from each end. The full recipe, with the argument for
leaving residency to the caller rather than the host, is in
[rationale §11](docs/design-record.md#residency-is-derivable-not-a-host-feature),
and `tests/helpers.ts` carries it as working code.

### Commit ordering

Three rules cover everything a listener sees:

1. **One input yields at most one chain.** The input causes at most one
   transition, but arriving somewhere with immediate rows continues on hop after
   hop until the machine stops moving on its own.
2. **Commit, then notify.** A listener always sees a fully committed machine, so
   `e.to` and `doc.current` agree, for every listener, on every hop.
3. **Listeners fire in registration order**, on every hop. The listener list is
   snapshotted before the dispatch, so one unsubscribed by an earlier listener
   still runs for the current transition, and one registered during a dispatch
   does not.

Two more rules govern reentrancy. A send from inside a dispatch is queued across
every host in the process. The queue drains first in, first out before the
outermost `send` returns, never on a microtask and never nested. `send` returns
nothing, including when it was queued. A listener is therefore never reentered,
and a queued send waits for the whole chain to settle rather than landing
mid-hop. It is evaluated against the state at drain time and may find no row.

A throwing listener ends the drain and discards what was queued, but the
transition stays committed and every host works normally afterwards. There is no
`stop()`: disposal is unsubscribing your listeners and not sending any more, and
the host holds nothing else. The argument for all of it, the cross-host case
included, is [rationale §11](docs/design-record.md#queue-not-stack).

## A worked example

This machine prevents a slow search response from overwriting a newer one. Each
request takes the next `id`; a result carrying an older `id` declines:

```ts
import { machine, type } from 'totorobot'

declare const api: {
	search(query: string, signal: AbortSignal): Promise<string[]>
}

const search = machine({
	inputs: type<{
		run: { query: string }
		resolved: { id: number; hits: string[] }
		rejected: { id: number; reason: string }
		clear: undefined
	}>(),

	states: type<{
		idle: { nextId: number }
		running: { id: number; query: string; nextId: number }
		done: { hits: string[]; nextId: number }
		failed: { reason: string; nextId: number }
	}>(),

	initial: 'idle',

	transitions: {
		'idle -run> running': ({ fromData, inputData }) => ({
			id: fromData.nextId,
			query: inputData.query,
			nextId: fromData.nextId + 1,
		}),
		'running -run> running': ({ fromData, inputData }) => ({
			id: fromData.nextId,
			query: inputData.query,
			nextId: fromData.nextId + 1,
		}),
		'running -resolved> done': ({ fromData, inputData, skip }) =>
			inputData.id === fromData.id
				? { hits: inputData.hits, nextId: fromData.nextId }
				: skip(),
		'running -rejected> failed': ({ fromData, inputData, skip }) =>
			inputData.id === fromData.id
				? { reason: inputData.reason, nextId: fromData.nextId }
				: skip(),
		'done -clear> idle': ({ fromData }) => ({ nextId: fromData.nextId }),
		'failed -clear> idle': ({ fromData }) => ({ nextId: fromData.nextId }),
	},

	actions: {
		running: ({ toData, send }) => {
			const controller = new AbortController()

			void api.search(toData.query, controller.signal).then(
				(hits) => send('resolved', { id: toData.id, hits }),
				(reason) => send('rejected', { id: toData.id, reason: String(reason) }),
			)

			return () => controller.abort()
		},
	},
})

const box = search.start({ nextId: 0 })
box.observe('* -> failed', (e) => console.error(e.toData.reason))
box.send('run', { query: 'totoro' })
```

The `running` action starts the request and returns its teardown. Sending another
`run` takes the self-transition, aborts the old request, and starts a new one.
The two `skip()` rows cover the race where an old promise settles despite being
aborted. Its `id` no longer matches, so it does nothing. `e.toData.reason` is
readable in the listener because the pattern pins the target to `failed`.

## What the types check

- **Per-state data.** Checking a state's name narrows the payload beside it,
  with no nullable padding in states that logically guarantee a field.
- Unknown state or input names anywhere in a transition key, a pattern, or an
  `actions` trigger.
- A pattern or trigger built from declared names but matching no declared row —
  by table membership, not reachability. A bare-state observer is the one
  exception: it stays valid with no incoming row, since a late registration can
  find the state already occupied.
- **A handler returning the wrong payload for its target state, with no
  exceptions.** A target carrying nothing accepts only a handler that returns
  nothing; a fresh literal with extra properties, a wider-typed variable, an
  interface-typed value, and a spread of a wider payload are all rejected.
- Reads of source data the source state does not have.
- Malformed keys, wrong spacing included, reported as `not a transition: '…'` on
  the offending line.

Errors land on the bad line, from a single declaration site, and no handler
needs a type annotation.

The compiler does not check send sites, as [Sending](#sending) describes.
Per-state capabilities are not enforced.

## Guarantees and absences

- **A transition is pure.** Given a state and an input it yields either the next
  state or a refusal, and it neither performs nor schedules anything.
- **A send always terminates.** One input starts at most one immediate chain, and
  the 100,000-hop limit breaks cycles with a `RangeError`.
- **Stale results are free.** A `loaded` arriving after the machine leaves
  `loading` matches no row and does nothing. That ignores the result; canceling
  the work is a residency teardown's job, or the caller's where no action
  declares one.
- **The state vocabulary has no runtime representation.** The definition carries
  transition keys rather than a list of states, so there is no source for a
  visualizer or a "valid states are …" message. A state with no transitions is
  invisible at runtime.
- The design is flat, with no hierarchy and no parallel regions. It is an
  extended finite-state machine, so reachability and "this guard can never fire"
  are beyond it, and neither is claimed.

The table gives the alternative for each omission and links to its rationale:

| absent                      | instead                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `enter` / `exit`            | patterns with one end pinned ([§9](docs/design-record.md#9-actions))                                                  |
| `keep` / `repeat` / `stay`  | an ordinary self-transition row ([§7](docs/design-record.md#7-self-transitions))                                      |
| `else`                      | declining is a normal outcome, and silent ([§4](docs/design-record.md#two-decisions-that-fell-out-of-the-comparison)) |
| a `send` return value       | `current` ([§11](docs/design-record.md#send-returns-nothing))                                                         |
| `stop()`                    | unsubscribe, and stop sending ([§11](docs/design-record.md#no-disposal-and-a-listener-that-throws))                   |
| typed `send`                | nothing at runtime either; recorded but unbuilt ([§12](docs/design-record.md#if-it-comes-back-it-comes-back-as-s12))  |
| hierarchy, parallel regions | out of scope ([§10](docs/design-record.md#what-the-rest-of-the-record-forbids))                                       |

## The untyped path

`inputs` and `states` are both optional, so a JavaScript caller writes
`machine({ initial, transitions })` and gets a working machine:

```js
const toggle = machine({
	initial: 'off',
	transitions: {
		'off -flip> on': () => {},
		'on -flip> off': () => {},
	},
})
```

Omitting a vocabulary infers names from `transitions`, never payloads. The names
become exactly the ones the table mentions rather than widening to `string`, and
every inferred payload is `unknown`. Declaring one vocabulary and omitting the
other checks that half and reads the other's names from the table.

The key grammar is enforced either way, and a malformed key still lands on
its own row. What inference will not accept is a name a key cannot round-trip.
`*` is already how a pattern spells "any state", and a leading or trailing space
is the grammar's own delimiter, so `'a -x>  b'` would quietly mint a state no
other key can spell the same way twice; such a row is rejected the way a
malformed key is. A declared vocabulary is untouched by this, since declaring
an odd name by hand is deliberate in a way a doubled space never is.

## Beyond v1

A declared `emit` channel and horizontal composition are sketched in
[the roadmap](docs/roadmap.md), and neither is promised.

## Documentation

- [Roadmap](docs/roadmap.md) — what might come after v1: a declared output
  channel and composition.
- [Design record](docs/design-record.md) — the decision ledger: what was
  considered and rejected, and on what evidence.
- [Research notes](docs/research/) — research on automata theory, execution
  semantics, human-computer interaction state machines, typestate, TypeScript
  type engineering, and JavaScript state-machine libraries.

Contributors should read these before changing `src/`:

- [Implementation record](docs/implementation-record.md) — numbered findings
  about the TypeScript behavior the type layer relies on, with stable identifiers
  the source can cite.
- [Explorations](explorations/README.md) — the compilable prototypes behind those
  findings, including one built over Robot3 itself. They are type-checked, and
  the Robot3 one is tested, so a rejected option that starts working again fails
  the build rather than going unnoticed.

Two documents record the work before v1: [requirements](docs/requirements.md)
lists the priorities that guided the exploration, and
[acceptance cases](docs/acceptance-cases.md) lists the scenarios used to compare
candidates. They describe the intended API rather than the shipped API.

## Development

Requires Node.js 26 or newer and pnpm. Node runs the TypeScript sources directly
for development; `pnpm build` produces the published ESM bundle and type
declarations in `dist/`.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm examples
```

`pnpm test` runs the runtime tests, the type tests, and the plain-JavaScript
untyped path against the shipped API. `pnpm typecheck` covers `src/`,
`examples/` and `explorations/`.

## Releasing

Releases run on [Changesets](https://changesets.dev). Only the `Release`
workflow can publish: npm accepts this package through
[trusted publishing](https://docs.npmjs.com/trusted-publishers), so no token
lives in the repository and every release carries provenance.

For a change users should hear about, run `pnpm changeset`, pick the bump, and
commit the file it writes under `.changeset/` with the change. Docs, tooling and
dependency bumps need none, and nothing enforces this.

Merging to `main` opens a "Version Packages" pull request that bumps the version
and writes `CHANGELOG.md`; merging that one publishes, tags, and creates the
GitHub release. Edit changesets, never the changelog or the version field.

Two things live outside the tree: the npm trusted publisher, registered against
`.github/workflows/release.yml` by name, and the repository setting "Allow
GitHub Actions to create and approve pull requests".

## Thanks

To the libraries this one learned from:
[Robot3](https://thisrobot.life/),
[XState](https://github.com/statelyai/xstate), and
[yay-machine](https://yay-machine.js.org/).

## License

[Blue Oak Model License 1.0.0](LICENSE).
