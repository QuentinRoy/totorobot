# Totorobot

Totorobot is a tiny TypeScript state-machine library. One line declares one
transition, and the line looks like the edge it declares:

```
'draft -submit> review'
```

Source state, input, target state: that is the whole notation.

**Each state carries its own data, and the compiler knows which state you are
in.** `review` requires a `reviewer` that `draft` does not have. Narrow the
current state on its name and its fields narrow with it, so reading `reviewer`
anywhere but `review` is a compile error. Most libraries share one context
object across every state, which forces any field that only some states carry to
be optional everywhere and checked everywhere.

A definition is inert data. `.start()` hands you a running host to send inputs to
and observe, and that host is the only thing that ever changes. The whole library
is 1.1 kB minified, 580 bytes over the wire, with no dependencies.

The design keeps asking one question: how much state-machine correctness can
TypeScript enforce while the creation API stays small enough to hold in your
head?

## Install

```bash
npm install totorobot
```

It is ESM and ships its own type declarations.

## Example

```ts
import { machine, type } from 'totorobot'

export const publication = machine({
	inputs: type<
		| { type: 'open'; text: string }
		| { type: 'revise'; text: string }
		| { type: 'submit'; reviewer: string }
		| { type: 'publish' }
		| { type: 'cancel' }
	>(),

	states: type<
		| { name: 'empty' }
		| { name: 'draft'; text: string; revision: number }
		| { name: 'review'; text: string; revision: number; reviewer: string }
		| { name: 'published'; text: string; revision: number }
	>(),

	initial: 'empty',

	transitions: {
		'empty -open> draft': ({ input }) => ({ text: input.text, revision: 0 }),
		'draft -submit> review': ({ state, input }) => ({
			...state,
			reviewer: input.reviewer,
		}),
		'review -publish> published': ({ state }) => ({
			text: state.text,
			revision: state.revision,
		}),
		'draft -cancel> empty': () => {},
	},
})

const doc = publication.start()
doc.observe('* -> published', (e) => notify(e.to))
doc.send({ type: 'open', text: 'hello' })
```

`review` carries a `reviewer` that `draft` does not have and `published` sheds
again. Narrowing the state narrows its data, so there is no nullable padding on
the states where the field would be meaningless.

## Contents

- [Install](#install)
- [Example](#example)
- [The surface](#the-surface)
- [`inputs` and `states`: the vocabulary](#inputs-and-states-the-vocabulary)
- [`initial`: where a host starts](#initial-where-a-host-starts)
- [`transitions`: the table](#transitions-the-table)
  - [The key language](#the-key-language)
  - [The handler decides and projects](#the-handler-decides-and-projects)
  - [Declining, and row precedence](#declining-and-row-precedence)
  - [Immediate transitions: an edge with no input](#immediate-transitions-an-edge-with-no-input)
  - [What the table gives you for free](#what-the-table-gives-you-for-free)
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
- [Thanks](#thanks)
- [License](#license)

## The surface

Everything the package exports:

| export                                                      | is                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| `machine({ inputs?, states?, initial, transitions })`       | a definition: inert data, never mutated                          |
| `type<T>()`                                                 | a declaration carrying `T`; returns `undefined` at runtime       |
| `InputsOf<M>` `StatesOf<M>` `Handled<M, S>` `Sources<M, S>` | derived types, over `M = typeof publication`                     |
| `Skip`                                                      | what `skip()` returns; it appears in every handler's return type |

## `inputs` and `states`: the vocabulary

```ts
inputs: type<{ type: 'submit'; reviewer: string } | { type: 'cancel' }>(),
states: type<{ name: 'empty' } | { name: 'draft'; text: string; revision: number }>(),
```

Both are tagged unions: `inputs` is discriminated by `type`, `states` by `name`.
A member with no payload carries nothing but its tag, as `{ type: 'cancel' }` and
`{ name: 'empty' }` do. There is no `void` sentinel on either side.

`type<T>()` exists only to carry `T`. It returns `undefined`, and nothing reads
it.

**Inline is fine; naming scales better.** Each is an ordinary type, so either
union can be pulled out, exported, imported, generated, made generic, or built
with `Omit`/`&`/`|`. Past a handful of members, writing `type<Inputs>()` keeps
the whole literal out of hover text and error messages. Either way, extraction
goes through the named helpers: `InputsOf<typeof publication>`,
`StatesOf<typeof publication>`.

**`data` is a convention rather than a rule.** A payload that is not a record, or
that wants a field called `type` or `name`, nests it under one:
`{ type: 'tick', data: 5 }`. Nothing in the library requires or inspects `data`,
and any other name works
([rationale §17](docs/api-rationale.md#data-is-a-convention-not-a-rule)).

Both keys are optional. Omitting them reads the names off `transitions` and
gives you the [untyped path](#the-untyped-path).

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

- **Whitespace is load-bearing.** Exactly one space before the `-`, one after
  the `>`; any other spelling is a compile error. The payoff is that the source
  name sits at column 1 on every row.
- **An edge always contains an arrow, so a key with no arrow names a state.**
  Bare keys are reserved for [residency](#residency) and rejected in
  `transitions` and in `observe()` patterns alike. The string alone therefore
  says which of the two you wrote.
- **An arrow with no label is an
  [immediate transition](#immediate-transitions-an-edge-with-no-input)**:
  `'checking -> allowed'`. That edge has no input at all. A pattern's unlabelled
  arrow means something different: there, the input is simply unconstrained.

A malformed key is reported at compile time as `not a transition: '…'`, on its
own line. **The grammar is enforced at runtime too**: `machine()` throws
`SyntaxError` for a malformed key, `observe()` does the same for a malformed
pattern, and both name the offending string. That is what catches a typo in plain
JavaScript, where nothing else checks what was written.

### The handler decides and projects

A handler receives the source state whole, tag included, under `state`, plus the
input, and returns the target state's payload with its tag left off. The library
adds the tag back:

```ts
'empty -open> draft': ({ input }) => ({ text: input.text, revision: 0 }),
```

The tag lets a handler shared across several rows tell which state it is leaving:
`state.name` narrows `state` the same way narrowing `current` does. It also makes
it safe to spread the source into a target payload, because the library spreads
the target's tag in last, so a source tag caught up in the spread never survives
onto the committed state.

### Declining, and row precedence

`skip()` declines the row, and the next row declared for the same source and
input is tried. **Declaration order is priority order.** That is how one input
reaches two states:

```ts
'draft -submit> review': ({ state, input, skip }) =>
	input.reviewer ? { ...state, reviewer: input.reviewer } : skip(),
'draft -submit> published': ({ state }) => ({
	text: state.text,
	revision: state.revision,
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
'draft -revise> draft': ({ state, input, skip }) =>
	input.text === state.text
		? skip()
		: { text: input.text, revision: state.revision + 1 },
```

That row is also a **self-transition**, a row whose target is its source. It
commits and notifies like any other row.

### Immediate transitions: an edge with no input

A row whose arrow carries no label fires on **entering** its source state, tried
in declaration order alongside every other immediate row declared for that
state:

```ts
'draft -submit> checking': ({ input }) => ({ quota: input.quota }),
'checking -> allowed': ({ state, skip }) =>
	state.quota > 0 ? { quota: state.quota } : skip(),
'checking -> denied': ({ state }) => ({ quota: state.quota }),
```

Sending `submit` from `draft` lands in `checking`, which tries its own rows at
once and continues on to `allowed` or `denied` without anyone sending anything.
`skip()` falls through to the next candidate exactly as it does on an
input-driven row, so a guarded choice needs no `cond` and no junction
pseudostate. If every candidate skips, the machine stays in `checking` with its
input rows still live, which covers "the condition is not met yet".

**Chains settle before anything else runs.** Landing somewhere that itself has
immediate rows continues the chain hop after hop, each one committing and
notifying before the next is tried, until the machine stops moving on its own.
Only then is the next queued input taken; see
[commit ordering](#commit-ordering).

**The handler receives no input.** `input` is `undefined`, typed that way rather
than absent, so reading it is as ordinary as on any other row. The transition
record carries `input: undefined` too, which is the discriminant that tells an
immediate apart from a payload-free input, whose record carries its tag.

**A chain that never settles throws.** After 1e5 consecutive hops the machine
raises `RangeError`, naming a state inside the cycle. There is no rollback:
listeners keep every hop that committed, and the host stays usable.

**`.start()` settles the initial state's immediates too**, chain and all, before
the host is handed back, so those hops are unobservable: nobody has subscribed
yet. If you need to observe an arrival, do not make it the initial state. The
argument still follows the **declared** initial state's payload rather than the
settled one's, and a cycle among those rows throws from `.start()` instead of
from `send` ([rationale §7](docs/api-rationale.md#what-it-forces-open)).

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

## The host

`definition.start(data)` returns the stateful thing that owns the current state
and dispatches to listeners. One host per independent use: two hosts over one
definition share no state and no listeners, and neither mutates the definition.

| member                            | is                                                                  |
| --------------------------------- | ------------------------------------------------------------------- |
| `definition.start(data?)`         | creates a host; `data` follows the declared initial state's payload |
| `host.current`                    | the current state, tag included                                     |
| `host.send(input)`                | a dispatch; returns nothing                                         |
| `host.observe(pattern, listener)` | a subscription; returns an unsubscribe function                     |

```ts
const doc = publication.start() // `empty` carries no payload, so no argument
doc.send({ type: 'open', text: 'hello' })

doc.current // { name: 'draft', text: 'hello', revision: 0 }
```

### Reading

`current` is the state itself, plain data, tag included. **A value read from it
stays valid and unchanged across later transitions**, which is what makes it
safe to compare, serialise, or hold in component state. Nothing is frozen:
immutability is `readonly` in the types plus a promise not to mutate, not a
runtime guard.

Narrowing `current` on its tag narrows its fields with it, which is the half of
typestate the project claims:

```ts
const now = doc.current
if (now.name === 'draft') {
	now.revision // number, with no nullable padding
}
```

### Sending

`send` takes the input as a single argument, an ordinary tagged object, so a
payload-free input is `doc.send({ type: 'cancel' })`. It returns nothing; what
happened is `doc.current`.

**Sending is broad: every declared input is accepted from every state.** One the
current state does not handle changes nothing; it does not throw, corrupt, or
half-apply. That is also how a stale asynchronous result lands harmlessly.

**A send issued while a dispatch is in progress is queued**, whether it comes
from a listener or from a hop `.start()` is settling, and whether it targets the
dispatching host or an unrelated one. So a send takes effect immediately only
when no dispatch is running anywhere; otherwise it waits for the one in progress
to settle, and `current` read right after such a send still shows the earlier
state. [Commit ordering](#commit-ordering) rule 4 has the mechanics.

**There is no typed send site.** `doc.send({ type: 'publish' })` compiles in
`draft` and does nothing at runtime, so per-state capabilities go unchecked. That
is a deliberate drop: the narrow-then-send shape is unsound in TypeScript, and a
sound variant stays addable later without breaking anything
([rationale §11](docs/api-rationale.md#11-sending-inputs)).

### Observing

```ts
const off = doc.observe('* -> published', (e) => notify(e.to))
doc.observe('draft -cancel> *', () => track('cancelled'))
```

Listeners go on the host, never on the definition, which is inert. `observe()`
returns an unsubscribe function.

**The listener receives the transition record**, `{ input, from, to }`,
discriminated by `input?.type` or by `if (e.input)`. `e.from` and `e.to` are the
states at each end, tags included, so narrowing on `e.from.name` or `e.to.name`
narrows their fields the way `current` does. An immediate transition carries
`input: undefined`.

**Patterns are the key language with coordinates left open.** `*` stands for any
state and an unlabelled arrow means any input, or none:

```ts
'* -> loading' //     entry: every arrival, including re-entry
'draft -> *' //       exit:  every departure, however caused
'draft -submit> *' // narrower: departures caused by `submit`
'* -submit> *' //     every `submit` edge, wherever it goes
```

There is no `-*>`. `*` appears only in state positions, so the input coordinate
is either a name or absent. The unlabelled form is the broad one: it matches
input-driven edges **and**
[immediate transitions](#immediate-transitions-an-edge-with-no-input), which
have no input at all. A labelled pattern never matches an immediate. A bare key
is not legal here either, for the reason the [key language](#the-key-language)
gives.

### Residency

Scoping something to "while we are in `draft`", teardown included, is derivable
today from two patterns and needs nothing the host does not already provide.
Observe `'draft -> *'` to tear down and `'* -> draft'` to set up. Register the
exit listener **first**, so a self-transition tears down before it sets up again,
and run the setup once at registration if the host is already in the state, since
nothing will announce a state you are already in.

A self-transition matches both patterns, so restart-on-re-entry falls out for
free, and the policy variants come along too: `persistent` is
`if (e.to.name !== e.from.name)` in the exit handler, and `keyed` compares a key
computed from each end.

Declaring it in the definition instead of assembling it by hand is
[a roadmap direction](docs/roadmap.md#residency--a-recipe-today-maybe-declared-later).
The full recipe, with the argument for leaving it to the caller today, is in
[rationale §12](docs/api-rationale.md#residency-is-derivable-not-a-host-feature),
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

Re-entrancy is two more. **A send from inside a dispatch is queued**, across
every host in the process, and the queue drains first in first out before the
outermost `send` returns, never on a microtask and never nested. **`send` returns
nothing**, including when it was queued. So a listener is never re-entered, and a
queued send waits for the whole chain to settle rather than landing mid-hop,
where it is evaluated against the state at drain time and may find no row.

A throwing listener ends the drain and discards what was queued, but the
transition stays committed and every host works normally afterwards. There is no
`stop()`: disposal is unsubscribing your listeners and not sending any more, and
the host holds nothing else. The argument for all of it, the cross-host case
included, is [rationale §12](docs/api-rationale.md#queue-not-stack).

## A worked example

A search box, where a slow response must not overwrite a newer one. Each run
takes the next id, and a result carrying a stale one declines:

```ts
import { machine, type } from 'totorobot'

declare const api: { search(query: string): Promise<string[]> }

const search = machine({
	inputs: type<
		| { type: 'run'; query: string }
		| { type: 'resolved'; id: number; hits: string[] }
		| { type: 'rejected'; id: number; reason: string }
		| { type: 'clear' }
	>(),

	states: type<
		| { name: 'idle'; nextId: number }
		| { name: 'running'; id: number; query: string; nextId: number }
		| { name: 'done'; hits: string[]; nextId: number }
		| { name: 'failed'; reason: string; nextId: number }
	>(),

	initial: 'idle',

	transitions: {
		'idle -run> running': ({ state, input }) => ({
			id: state.nextId,
			query: input.query,
			nextId: state.nextId + 1,
		}),
		'running -resolved> done': ({ state, input, skip }) =>
			input.id === state.id
				? { hits: input.hits, nextId: state.nextId }
				: skip(),
		'running -rejected> failed': ({ state, input, skip }) =>
			input.id === state.id
				? { reason: input.reason, nextId: state.nextId }
				: skip(),
		'done -clear> idle': ({ state }) => ({ nextId: state.nextId }),
		'failed -clear> idle': ({ state }) => ({ nextId: state.nextId }),
	},
})

const box = search.start({ nextId: 0 })
box.observe('* -> failed', (e) => console.error(e.to.reason))

async function run(query: string) {
	box.send({ type: 'run', query })
	const started = box.current
	if (started.name !== 'running') return
	try {
		box.send({
			type: 'resolved',
			id: started.id,
			hits: await api.search(query),
		})
	} catch (err) {
		box.send({ type: 'rejected', id: started.id, reason: String(err) })
	}
}
```

Four things are doing work here. `started` is narrowed to `running`, so
`started.id` exists to close over; the same read on `idle` would not compile.
Awaiting after that read is safe because a value read from `current` never
changes underneath you. The two `skip()` rows are the whole staleness policy, so
an overtaken response finds no row and does nothing. And `e.to.reason` is
readable in the listener only because the pattern pins the target to `failed`.

Nothing here schedules or cancels the request. The machine records which one it
is waiting for; starting and abandoning the work stays the caller's.

## What the types check

- **Per-state data.** Narrowing the state narrows its data, with no nullable
  padding in states that logically guarantee a field.
- Unknown state or input names anywhere in a transition key or a pattern.
- **A handler returning the wrong shape for its target state, with no
  exceptions.** A target with no payload accepts only nothing or `{}`. A fresh
  literal with extra properties, a wider-typed variable, an interface-typed
  value, and a spread of a wider state are all rejected.
- Reads of source data the source state does not have.
- Malformed keys, wrong spacing included, reported as `not a transition: '…'` on
  the offending line.

Errors land on the bad line, from a single declaration site, and no handler
needs a type annotation.

**What is not checked is the send site**, as [Sending](#sending) describes.
Per-state capabilities are not enforced by the compiler.

## Guarantees and absences

- **A transition is pure.** Given a state and an input it yields either the next
  state or a refusal, and it neither performs nor schedules anything.
- **Big steps terminate**, because one input causes at most one transition.
- **Stale results are free.** A `loaded` arriving after we left `loading`
  matches no row and does nothing. That ignores the result; cancelling the work
  is still the caller's job.
- **States have no runtime existence.** The definition carries transition keys
  rather than a list of states, so there is no source for a visualiser or a
  "valid states are …" message, and a state with no transitions is invisible at
  runtime.
- The design is flat, with no hierarchy and no parallel regions. It is an EFSM,
  so reachability and "this guard can never fire" are beyond it, and neither is
  claimed.

The absences below are all deliberate. What to reach for instead, and where the
argument is:

| absent                      | instead                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `enter` / `exit`            | patterns with one end pinned ([§9](docs/api-rationale.md#9-actions))                                                  |
| `keep` / `repeat` / `stay`  | an ordinary self-transition row ([§6](docs/api-rationale.md#6-self-transitions))                                      |
| `else`                      | declining is a normal outcome, and silent ([§4](docs/api-rationale.md#two-decisions-that-fell-out-of-the-comparison)) |
| a `send` return value       | `current` ([§12](docs/api-rationale.md#send-returns-nothing))                                                         |
| `stop()`                    | unsubscribe, and stop sending ([§12](docs/api-rationale.md#no-disposal-and-a-listener-that-throws))                   |
| typed `send`                | nothing at runtime either; recorded but unbuilt ([§11](docs/api-rationale.md#if-it-comes-back-it-comes-back-as-s12))  |
| hierarchy, parallel regions | out of scope ([§10](docs/api-rationale.md#what-the-rest-of-the-record-forbids))                                       |

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

Omitting a vocabulary infers **names** from `transitions`, never data. The state
and input names become exactly the ones the table mentions rather than widening
to `string`, while every field beyond a tag reads as `unknown` and accepts
anything written back, since nothing declares it. Declaring one vocabulary and
omitting the other checks that half and reads the other's names off the table.

**The key grammar is enforced either way**, and a malformed key still lands on
its own row. What inference will not accept is a name a key cannot round-trip.
`*` is already how a pattern spells "any state", and a leading or trailing space
is the grammar's own delimiter, so `'a -x>  b'` would quietly mint a state no
other key can spell the same way twice; such a row is rejected the way a
malformed key is. A **declared** vocabulary is untouched by this, since declaring
an odd name by hand is deliberate in a way a doubled space never is.

## Beyond v1

`actions`, a declared `emit` channel, residency as a declared feature, and
horizontal composition are sketched in [the roadmap](docs/roadmap.md), and none
of it is promised.

## Documentation

- [Roadmap](docs/roadmap.md) — the prospective plan past v1: effects, a declared
  output channel, residency, and composition.
- [Design record](docs/api-rationale.md) — the decision ledger: what was
  considered and rejected, on what evidence, plus the reusable TypeScript
  findings.
- [Research notes](docs/research/) — ten prior-art notes on automata theory,
  execution semantics, HCI state machines, typestate, TypeScript type
  engineering, and the JS FSM landscape.
- [Explorations](explorations/README.md) — the compilable prototypes behind the
  findings, including one built over Robot3 itself. They are type-checked, and
  the Robot3 one is tested, so a rejected option that starts working again fails
  the build rather than going unnoticed.

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

## Thanks

To the libraries this one learned from:
[Robot3](https://thisrobot.life/),
[XState](https://github.com/statelyai/xstate), and
[yay-machine](https://yay-machine.js.org/).

## License

[Blue Oak Model License 1.0.0](LICENSE).
