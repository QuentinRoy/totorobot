# Totorobot

Totorobot is a tiny TypeScript state-machine library. One line declares one
transition, and the line looks like the edge it declares:

```
'draft -submit> review'
```

Source state, input, target state: that is the whole notation.

**Each state carries its own data, and the compiler knows which state you are
in.** `review` can require a `reviewer` that `draft` does not have; narrow the
current state on its name and its fields narrow with it. Most libraries hand you
one flat context object shared by every state, where a field only some states
have has to be optional everywhere and checked everywhere. Here it exists
exactly where it is meaningful, and reading it anywhere else is a compile error.
That is typestate on the data, which is the half of typestate TypeScript can
enforce soundly.

Definitions are plain data. `.start()` hands you a running host to send inputs
to and observe, and nothing else in the design is mutable. The whole library is
1.1 kB minified, 580 bytes over the wire, and depends on nothing.

The project asks a specific question: how much state-machine correctness can
TypeScript enforce while keeping the creation API small enough to hold in your
head?

## Contents

- [Install](#install)
- [Example](#example)
- [The surface](#the-surface)
- [`initial`: where a host starts](#initial-where-a-host-starts)
- [`inputs` and `states`: the vocabulary](#inputs-and-states-the-vocabulary)
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
- [What the types check](#what-the-types-check)
- [What is claimed, and what is deliberately absent](#what-is-claimed-and-what-is-deliberately-absent)
- [The untyped path](#the-untyped-path)
- [Beyond v1](#beyond-v1)
- [Documentation](#documentation)
- [Development](#development)
- [Relationship to Robot3](#relationship-to-robot3)
- [License](#license)

## Install

```bash
npm install totorobot
```

v1 is close but not out: the package publishes to npm with that release. It is
ESM, ships its own type declarations, and wants Node 26 or newer.

## Example

```ts
import { machine, type } from 'totorobot'

export const publication = machine({
	initial: 'empty',

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

## The surface

Everything the package exports:

| export                                                      | is                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `machine({ initial, inputs?, states?, transitions })`       | a definition: inert data, never mutated                           |
| `type<T>()`                                                 | a declaration carrying `T`; returns `undefined` at runtime        |
| `InputsOf<M>` `StatesOf<M>` `Handled<M, S>` `Sources<M, S>` | derived types, over `M = typeof publication`                      |
| `Skip`                                                      | what `skip()` returns — it appears in every handler's return type |

## `initial`: where a host starts

`initial` names the state a new host begins in, and it has to be one of the
declared states: anything else is a compile error on the `initial` line.

That state alone decides whether `.start()` takes an argument. `empty` above
carries no payload, so `publication.start()` takes none; an initial state that
does carry data makes its payload a required argument, as in
`counter.start({ count: 0 })`.

Nothing announces the state a host starts in. Listeners are attached to the host
`.start()` hands back, so the first thing they can see is the first transition.
If the initial state has
[immediate rows](#immediate-transitions-an-edge-with-no-input) they run before
the host comes back, and `.start()`'s argument still follows the declared
initial state rather than wherever that chain lands.

## `inputs` and `states`: the vocabulary

```ts
inputs: type<{ type: 'submit'; reviewer: string } | { type: 'cancel' }>(),
states: type<{ name: 'empty' } | { name: 'draft'; text: string; revision: number }>(),
```

Both are declared tagged unions. `inputs` is discriminated by `type` and
`states` by `name`. There is no `void` sentinel on either side: a payload-free
member is a union member carrying nothing but its tag, such as
`{ type: 'cancel' }` and `{ name: 'empty' }`.

`type<T>()` exists only to carry `T`. It returns `undefined`, nothing reads it,
and passing the return value explicitly is the same as omitting the field.

**Inline is fine; naming scales better.** Each is an ordinary type, so either
union can be pulled out, exported, imported, generated, made generic, or built
with `Omit`/`&`/`|`. Once a vocabulary grows past a handful of members, writing
`type<Inputs>()` keeps hover text and error messages from inlining the whole
literal. Extraction goes through the named helpers either way:
`InputsOf<typeof publication>`, `StatesOf<typeof publication>`.

**`data` is a convention rather than a rule**, on both halves of the vocabulary.
A payload that is not a record, or that wants a field called `type` or `name`,
nests it:

```ts
{ type: 'tick', data: 5 } // an input
{ name: 'editing', data: { name: 'foo' } } // a state
```

Nothing in the library requires or inspects `data`; it is an ordinary field and
any other name works. Reach for it deliberately whenever a tag would collide or
a payload is not an object.

Both keys are optional. Omitting them reads the names off `transitions` and
gives you the [untyped path](#the-untyped-path).

## `transitions`: the table

One row per edge, with all four coordinates at fixed positions no formatter can
move.

### The key language

```
from -input> to
```

The input is the arrow's label, and three rules govern the spelling:

- **Whitespace is load-bearing.** Exactly one space before the `-`, one after
  the `>`. Any other spelling is a compile error, which also puts the source at
  column 1 on every row.
- **An edge always contains an arrow, so a key with no arrow names a state.**
  Bare keys are reserved for [residency](#residency) and rejected both in
  `transitions` and in `observe()` patterns. The two halves of the grammar are
  therefore decidable from the string alone.
- **An arrow with no label is an
  [immediate transition](#immediate-transitions-an-edge-with-no-input)**:
  `'checking -> allowed'`. The edge has no input at all, which differs from a
  pattern's unlabelled arrow, where the same absence means the input is
  unconstrained.

A malformed key is reported as `not a transition: '…'` on its own line at
compile time. **The grammar is enforced at runtime too**: `machine()` throws
`SyntaxError` for a malformed key and `observe()` throws the same way for a
malformed pattern, naming the offending string. That is what catches a typo in
plain JavaScript, where nothing else checks the shape of what was written.

### The handler decides and projects

A handler receives the source state whole, tag included, under `state`, plus the
input, and returns the target state's payload with its tag left off. The library
adds the tag back:

```ts
'empty -open> draft': ({ input }) => ({ text: input.text, revision: 0 }),
```

Carrying the tag lets one handler shared across several rows tell which state it
is leaving: `state.name` narrows `state` the same way narrowing `current` does.
It also makes spreading the source into a target payload safe. The library
spreads the target's tag in last, so a source tag carried along by the spread
can never survive onto the committed state.

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
listener fires. So does an input the current state has no row for. Both are
normal outcomes rather than faults, they are indistinguishable, and nothing
reports either one.

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

Sending `submit` from `draft` lands in `checking`, which immediately tries its
own rows and continues on to `allowed` or `denied` without anyone sending
anything. `skip()` falls through to the next candidate exactly as it does on an
input-driven row, so a guarded choice needs no `cond` and no junction
pseudostate. If every candidate skips the machine stays in `checking` and
`checking`'s input rows stay live, which covers "the condition is not met yet".

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
raises `RangeError` — `maximum transitions reached in '<state>'` — naming a
state inside the cycle. There is no rollback: listeners have already seen every
hop that committed, and the host stays usable afterwards. The budget is high on
purpose, because `'a -> a'` is legal and a handler that rewrites its own data
until it declines is a terminating loop the budget must not interrupt.

**`.start()` settles the initial state's immediates too**, chain and all, before
the host is handed back. "On entering" includes the first entering. If every
candidate skips, the host comes back in the declared initial state. Two things
follow when the chain does move it:

- **The settling hops are unobservable.** Nobody has subscribed yet, so only the
  state the chain lands in is visible. If you need to observe an arrival, do not
  make it the initial state.
- **`.start()` can throw.** A cycle among the initial state's immediates raises
  the same `RangeError` from `.start()` rather than from `send`.

What does not change is `.start()`'s argument, which follows the **declared**
initial state's payload rather than the settled one's. An initial state declared
with no payload still takes no argument even when settling carries it into a
state that has data.

### What the table gives you for free

The table is one flat block of string keys, so all three topology questions are
an exact text search, and the reverse index is derivable:

| question                          | search     | derived type           |
| --------------------------------- | ---------- | ---------------------- |
| what can I do in `draft`?         | `'draft -` | `Handled<M, 'draft'>`  |
| where can I `submit`?             | `-submit>` | —                      |
| how does anything reach `review`? | `> review` | `Sources<M, 'review'>` |

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
current state does not handle changes nothing. It does not throw, corrupt, or
half-apply, which is also how a stale asynchronous result lands harmlessly.

**A send issued while a dispatch is in progress is queued**, whether it comes
from a listener or from a hop `.start()` is settling, and whether it targets the
dispatching host or an unrelated one. The queue is shared by every machine in
the process and drains before the outermost `send` returns, synchronously. So a
send is immediate exactly when no dispatch is in progress anywhere; otherwise it
takes effect once the dispatch in progress settles, and a machine's `current`
read right after such a send still shows the state it had before it. See
[commit ordering](#commit-ordering) rule 4.

**There is no typed send site.** `doc.send({ type: 'publish' })` compiles in
`draft` and does nothing at runtime. Per-state capabilities are not enforced by
the compiler. This is a deliberate drop, because the narrow-then-send shape is
unsound in TypeScript, and a sound variant stays addable later without breaking
anything ([rationale §11](docs/api-rationale.md#11-sending-inputs)).

### Observing

```ts
const off = doc.observe('* -> published', (e) => notify(e.to))
doc.observe('draft -cancel> *', () => track('cancelled'))
```

Listeners go on the host, never on the definition, which is inert. `observe()`
returns an unsubscribe function.

**The listener receives the transition record**, `{ input, from, to }`,
discriminated by `input?.type` or by `if (e.input)`. `e.from` and `e.to` are
each their end's state, tag included, so narrowing on `e.from.name` or
`e.to.name` narrows the rest of the fields the way `current` does. An immediate
transition carries `input: undefined`.

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

Scoping something to "while we are in `draft`", with a teardown, is derivable
today from two patterns and needs nothing the host does not already provide.
Observe `'draft -> *'` to tear down and `'* -> draft'` to set up, registering
the exit listener **first** so that a self-transition tears down before it sets
up again, and run the setup once at registration if the host is already in the
state, since nothing will announce a state you are already in. A self-transition
matches both patterns, so restart-on-re-entry falls out for free, and the
policy variants come along too: `persistent` is `if (e.to.name !== e.from.name)`
in the exit handler, and `keyed` compares a key computed from each end.

Declaring it in the definition instead of assembling it by hand is
[a roadmap direction](docs/roadmap.md#residency--a-recipe-today-maybe-declared-later).
The full recipe, with the argument for leaving it to the caller today, is in
[rationale §12](docs/api-rationale.md#residency-is-derivable-not-a-host-feature),
and `tests/helpers.ts` carries it as working code.

### Commit ordering

Five rules, and they are the whole execution model:

1. **One input yields at most one chain.** The input causes at most one
   transition, but arriving somewhere with immediate rows continues on hop after
   hop until the machine stops moving on its own.
2. **Commit, then notify.** A listener always sees a fully committed machine, so
   `e.to` and `doc.current` agree, for every listener, on every hop.
3. **Listeners fire in registration order**, on every hop. The listener list is
   snapshotted before the dispatch, so one unsubscribed by an earlier listener
   still runs for the current transition, and one registered during a dispatch
   does not.
4. **A send from inside a dispatch is queued, unconditionally, across every
   host.** The queue and its draining flag are shared by every machine in the
   process, so this holds whether the listener sends to its own host or to a
   different one, and the queue drains before the outermost `send` returns,
   never on a microtask and never nested. A listener is therefore never
   re-entered while an earlier call is still running, the listeners after it are
   never told about a transition their machine has already left, and a queued
   send waits for the whole chain to settle rather than landing mid-hop. Queued
   sends drain first-in-first-out, and each is evaluated against the state at
   drain time, so one may find no row and do nothing.
5. **`send` returns nothing**, including when it was queued.

**A throwing listener ends the drain, wherever it sits.** The error unwinds out
of the `send` that started the chain, which is the outermost call rather than
necessarily the one on whose host the listener threw. Everything still queued at
that moment is discarded across every host in that chain, since leaving it in
place would let an unrelated later send pick it up at an arbitrary time. The
listeners after the throwing one do not run, the transition stays committed, and
every host in the chain works normally afterwards. A runaway immediate chain's
`RangeError` behaves identically.

**There is no `stop()`.** Disposal is unsubscribing your listeners and not
sending any more; the host holds nothing else.

## What the types check

- **Per-state data.** Narrowing the state narrows its data, with no nullable
  padding in states that logically guarantee a field.
- Unknown state or input names anywhere in a transition key or a pattern.
- **A handler returning the wrong shape for its target state, for every state
  without exception.** A target with no payload accepts only nothing or `{}`. A
  fresh literal carrying extra properties, a wider-typed variable, an
  interface-typed value, and a spread of a wider state are all rejected the way
  an ordinary target's wrong shape is.
- Reads of source data the source state does not have.
- Malformed keys, wrong spacing included, reported as `not a transition: '…'` on
  the offending line.

Errors land on the bad line, from a single declaration site, and no handler
needs a type annotation.

**What is not checked is the send site**, as [Sending](#sending) describes.
Per-state capabilities are not enforced by the compiler.

## What is claimed, and what is deliberately absent

- **A transition is pure.** Given a state and an input it yields either the next
  state or a refusal, and it neither performs nor schedules anything.
- **Big steps terminate**, because one input causes at most one transition.
- **Stale results are free.** A `loaded` arriving after we left `loading`
  matches no row and does nothing. That is ignoring a result rather than
  cancelling work; cancelling is the caller's.
- **States have no runtime existence.** The definition carries transition keys
  rather than a list of states, so there is no source for a visualiser or a
  "valid states are …" message, and a state with no transitions is invisible at
  runtime.
- The design is flat, with no hierarchy and no parallel regions. It is an EFSM,
  so reachability and "this guard can never fire" are out of reach and are not
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

Omitting a vocabulary infers **names** from `transitions`, not data. The state
and input names become exactly the ones the table mentions rather than widening
to `string`, while each inferred member's fields beyond its tag read as
`unknown` and accept anything written back, since nothing declares them.
Declaring one vocabulary and omitting the other checks that half and reads the
other's names off the table.

**The key grammar is enforced either way**, and a malformed key still lands on
its own row. What an omitted vocabulary will not infer is a name a key cannot
round-trip: `*` is already how a pattern spells "any state", and a leading or
trailing space is the grammar's own delimiter, so `'a -x>  b'` would quietly
mint a state no other key can spell the same way twice. A row that mints one is
rejected the way a malformed key is. A **declared** vocabulary is untouched by
this, since declaring an odd name by hand is deliberate in a way a doubled space
never is.

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

Background, from the round that preceded v1:

- [FSM library requirements](docs/requirements.md) prioritizes the target
  behavior, type guarantees, design latitude, and non-goals.
- [FSM API acceptance cases](docs/acceptance-cases.md) defines the pinned
  Marking Menu fixture and the shared comparison tasks for coherent candidates.

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

## Relationship to Robot3

The design work started from [Robot3](https://thisrobot.life/), whose small
functional vocabulary set the size Totorobot was aiming for. None of that API
survived: the notation, the vocabulary and the host are Totorobot's own, and no
Robot3 code, idiom or type carries over. It is an independent library, not a
fork, drop-in replacement, or compatibility layer.

## License

[Blue Oak Model License 1.0.0](LICENSE).
