# The API

> **Status: shipped.** This is what `src/` implements. Every choice here is argued in
> [api-rationale.md](api-rationale.md) — this document says what the API _is_, that one
> says why.
>
> **v1 is topology and data**: a declared vocabulary, a transition table, a host, and
> listeners on the host — including immediate transitions, which fire on entering a
> state rather than on an input. `actions` is argued but deferred, and is not
> promised — see [Designed, not in v1](#designed-not-in-v1). Composition is a further,
> more prospective direction — see [the roadmap](roadmap.md).

## The whole thing at a glance

```ts
import { machine, types } from 'totorobot'

type Inputs =
	| { type: 'open'; text: string }
	| { type: 'revise'; text: string }
	| { type: 'submit'; route: 'review' | 'publish'; reviewer?: string }
	| { type: 'cancel' }
type States =
	| { name: 'empty' }
	| { name: 'draft'; text: string; revision: number }
	| { name: 'review'; text: string; revision: number; reviewer: string }
	| { name: 'published'; text: string; revision: number }

export const publication = machine({
	initial: 'empty',
	inputs: types<Inputs>(),
	states: types<States>(),

	transitions: {
		'empty -open> draft': ({ input }) => ({ text: input.text, revision: 0 }),
		'draft -revise> draft': ({ state, input, skip }) =>
			input.text === state.text
				? skip()
				: { text: input.text, revision: state.revision + 1 },
		'draft -submit> review': ({ state, input, skip }) =>
			input.route === 'review'
				? { ...state, reviewer: input.reviewer! }
				: skip(),
		'draft -submit> published': ({ state, input, skip }) =>
			input.route === 'publish' ? { ...state } : skip(),
		'draft -cancel> empty': () => {},
	},
})

const doc = publication.start()
doc.observe('* -> published', (e) => notify(e.to))
doc.send({ type: 'open', text: 'hello' })
```

| part          | answers                               |
| ------------- | ------------------------------------- |
| `initial`     | where a new host starts               |
| `inputs`      | what can happen                       |
| `states`      | what we can be                        |
| `transitions` | how we move, and what the new data is |
| `observe()`   | what the outside world does about it  |

## The surface

Everything the package exports, and everything a host has:

| name                                                        | is                                                         |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| `machine({ initial, inputs?, states?, transitions })`       | a **definition** — inert data, never mutated               |
| `types<T>()`                                                | a declaration carrying `T`; returns `undefined` at runtime |
| `definition.start(data?)`                                   | a **host** — the only mutable object in the design         |
| `host.current`                                              | the current state, tag included                            |
| `host.send(input)`                                          | a dispatch; returns nothing                                |
| `host.observe(pattern, listener)`                           | a subscription; returns an unsubscribe function            |
| a handler's `{ state, input, skip }`                        | the source state, the input, and the way to decline        |
| `InputsOf<M>` `StatesOf<M>` `Handled<M, S>` `Sources<M, S>` | derived types, over `M = typeof publication`               |

---

## `inputs` and `states` — the vocabulary

```ts
inputs: types<{ type: 'submit'; route: string } | { type: 'cancel' }>(),
states: types<{ name: 'empty' } | { name: 'draft'; text: string; revision: number }>(),
```

Both are **declared tagged unions**. `inputs` is discriminated by `type`, and `states`
by `name`. There is no `void` sentinel on either side — a payload-free member is a union
member with nothing but its tag, e.g. `{ type: 'cancel' }` and `{ name: 'empty' }`.

`types<T>()` exists only to carry `T`; it carries no runtime value, and **returns
`undefined`** — that is what a caller observes, rather than a marker object. Nothing
reads it, so both fields are inert at runtime, and passing the return value explicitly is
the same as omitting the field.

- Each is an ordinary type, so it can be named, exported, imported, generated, made
  generic, or built with `Omit`/`&`/`|`. **Name them.** Writing `types<Inputs>()` rather
  than `types<{ … }>()` keeps hover text and error messages from inlining the whole
  literal. A single `Publication = { inputs; states }` still works if you want one
  exported name — pass `types<Publication['inputs']>()`.
- Extraction goes through named helpers rather than the value's type:
  `InputsOf<typeof publication>`, `StatesOf<typeof publication>` — the same family as
  `Handled<M, 'draft'>` and `Sources<M, 'review'>`, which take the machine type as `M`.

**Both are optional, and omitting them infers names — not data — from `transitions`.**
A JavaScript caller writes `machine({ initial, transitions })` and gets a working
machine; a TypeScript caller who omits `inputs` gets its names as exactly what
`transitions` mentions rather than widening to `string`, while each inferred member's
fields beyond `type` read as `unknown`. Omitting `states` does the same for the state
names, and each inferred member's fields beyond `name` read as `unknown` and accept
anything written back, rather than being assumed absent — since nothing declares it —
and **the key grammar is still enforced**, a malformed key a compile error whether or
not a vocabulary was declared. Declaring one and not the other is supported and checks
that half while the other's names are still read off the table. This is a guarantee, not
an accident: see [observable behaviour](#observable-behaviour) items 35–38.

**An inferred name has to be one a key can round-trip.** `*` and a name padded by a
leading or trailing space are excluded from what an omitted `inputs`/`states` infers —
not because either is a bad name, but because neither survives being written back into a
key: `*` is already how a pattern spells "any state," and a leading or trailing space is
the grammar's own delimiter, so `'a -x>  b'` does not fail to parse, it quietly mints a
state no other key can spell the same way twice. A key that mints one is rejected on its
own row, `not a transition: '…'`, the same as any other unknown name. **A declared
vocabulary is untouched** — `types<{ type: '*' }>()` or a state tagged `{ name: ' b' }`
still work, since declaring an odd name by hand is deliberate in a way a doubled space in
a key never is.

_Why declared, what it closed, and what it costs:_
[rationale §5](api-rationale.md#5-the-declared-vocabulary). _Why inputs and states are
tagged unions rather than maps, and why the handler's source parameter carries its tag:_
[rationale §17](api-rationale.md#17-the-shape-of-a-named-thing).

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
  halves of the grammar are decidable from the string alone. A bare key is invalid in
  `transitions` and in `observe()` — it is reserved for residency, which is what
  [`actions`](#designed-not-in-v1) would use.
- **An arrow with no label is an [immediate transition](#immediate-transitions-an-edge-with-no-input)** —
  `'checking -> allowed'` rather than `'checking -input> allowed'`. Declaring one says
  the edge has no input at all, which is different from a pattern's unlabelled arrow,
  where the same absence means the input is unconstrained.

**The grammar is also enforced at runtime.** `machine()` throws `SyntaxError` for a
malformed key and `observe()` throws the same way for a malformed pattern, naming the
offending string — see [observable behaviour](#observable-behaviour) items 1 and 22.
This is what catches a typo in plain JavaScript, where nothing else checks the shape of
what was written.

_Why this notation, and the spellings it rejects:_
[rationale §4](api-rationale.md#adopted-the-label-on-the-arrow).

### The handler decides and projects

It receives the **source** state whole, tag included, under `state`, and the input
payload, and returns the **target** state's payload with its tag left off — the library
adds the tag back:

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
nothing reports it.

**Carrying the tag lets a handler shared across several rows tell which state it is
transitioning from** — `state.name` narrows `state` the same way narrowing `current`
does. It also means spreading the source into a target payload carries the source's tag
along for the ride; that is harmless, because the library sets the target's tag by
spreading it in _last_, so a spread of the source can never leave the wrong tag on the
committed state:

```ts
'draft -touch> draft': ({ state }) => ({ ...state }), // state.name is 'draft' here, and stays 'draft' after commit
```

### Self-transitions are ordinary transitions

A row whose target is its source. Its handler receives the old state and returns the new
payload, and it commits and notifies like any other row:

```ts
'draft -revise> draft': ({ state, input }) => ({ …, revision: state.revision + 1 }),
```

### Immediate transitions: an edge with no input

A row whose arrow carries no input. It fires on **entering** its source state, tried
in declaration order alongside every other immediate row declared for that state:

```ts
'draft -submit> checking': ({ state }) => ({ quota: state.quota }),
'checking -> allowed':     ({ state, skip }) => (state.quota > 0 ? { quota: state.quota } : skip()),
'checking -> denied':      ({ state }) => ({ quota: state.quota }),
```

Sending `submit` from `draft` lands in `checking`, which immediately tries its own
rows and continues on to `allowed` or `denied` without anyone sending anything.
`skip()` falls through to the next candidate, exactly as on an input-driven row — a
guarded choice needs no new concept, no `cond`, no junction pseudostate. If every
candidate skips, the machine stays in `checking`, and `checking`'s input rows stay
live: "the condition is not met yet" needs nothing invented.

**Chains settle before anything else runs.** Landing somewhere that itself has
immediate rows continues the chain, hop after hop — each one committing and notifying
before the next is tried — until the machine stops moving on its own. Only then is the
next queued input taken; see [Commit ordering](#commit-ordering).

**The handler receives no input**: `input` is `undefined`, typed that way rather than
absent, so reading it is as ordinary as on any other row. The transition record it
produces carries `input: undefined` too — the discriminant that tells an immediate apart
from a payload-free input, whose `input` carries its tag (e.g. `{ type: 'cancel' }`).

**A chain that never settles throws.** After 1e5 consecutive hops the machine raises
`RangeError` — `maximum transitions reached in '<state>'` — naming the state it could
not settle, which is a state inside the cycle. There is no rollback: by the time it
throws, listeners have already seen every hop that did commit, and the host stays
usable afterward. `1e5` is high on purpose — `'a -> a'` is legal, and a handler that
rewrites its own data and eventually `skip()`s is a terminating loop the budget must
not interrupt.

**`.start()` settles the initial state's immediates too.** A machine whose initial state
has immediate rows tries them, chain and all, before the host is handed back — "on
entering" includes the first entering. If every candidate skips, the host comes back in
the declared initial state, exactly as it would with no immediate rows at all. Two
consequences follow when the chain does move it, both worth knowing before you hit
them:

- **The settling hops are unobservable.** Nobody has subscribed yet when `.start()`
  runs, so a chain off the initial state produces no events — only the state it lands
  in is visible, in the host `.start()` returns. If you need to observe an arrival,
  don't make it the initial state. The chain is still a dispatch, though: it settles
  under the same drain a `send` takes, so anything it sends into another host queues
  behind it rather than landing mid-chain ([commit ordering](#commit-ordering) rule 4).
- **`.start()` can throw.** A cycle among the initial state's immediates raises the same
  `RangeError`, with the same message, from `.start()` rather than from `send`.

What does not change: `.start()`'s argument still follows the **declared** initial
state's payload, not the settled state's — an initial state declared with no payload
that settles into a data-carrying one still takes no argument.

_Why chaining, why a budget instead of forbidding it, and what it costs:_
[rationale §7](api-rationale.md#7-immediate-transitions).

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
const doc = publication.start() // `empty` carries no payload, so no argument
doc.send({ type: 'open', text: 'hello' })

doc.current // { name: 'draft', text: 'hello', revision: 0 }
```

One host per independent use — two hosts over one definition share no state and no
listeners, and neither mutates the definition.

### Reading

- **`current`** is the state itself, plain data, tag included. **A value read from it
  stays valid and unchanged across later transitions**, which is what makes it safe to
  compare, serialise, or hold in component state. Nothing is frozen, though: immutability
  is `readonly` in the types plus a promise not to mutate, not a runtime guard.

### Sending

`send` takes the input **as a single argument** — an ordinary tagged object, so a
payload-free input is `doc.send({ type: 'cancel' })`.

**Sending is broad: every declared input is accepted from every state.** One the
current state does not handle changes nothing — it does not throw, corrupt, or
half-apply, and that is also how a stale async result lands harmlessly.

**A send is immediate only when no dispatch is in progress anywhere** — on this host
or any other. Otherwise it queues and drains once the dispatch in progress settles,
per [commit ordering](#commit-ordering) rule 4. The accepted cost: a send issued from
inside a dispatch, into a machine unrelated to the one dispatching, is deferred too —
reading that machine's `current` right afterwards still shows the state it had before
the send. This widens a property sending already has within a single host — a send
from a listener into its own host is exactly as stale — rather than introducing a new
one.

**`send` returns nothing.** What happened is `doc.current`.

**There is no typed send site**: `doc.send({ type: 'decide', … })` compiles in `draft`
and does nothing at runtime. Per-state capabilities are not enforced by the compiler.
This is a deliberate drop — the narrow-then-send shape is unsound in TypeScript
([finding 11](api-rationale.md#13-type-system-findings)) — and a sound variant stays
addable later without breaking anything
([rationale §11](api-rationale.md#11-sending-inputs)).

**Per-state _data_ is unaffected** — narrow `current` on its tag and the fields narrow
with it, which is the half of typestate the project is actually claiming:

```ts
const now = doc.current
if (now.name === 'draft') {
	now.revision // number — no nullable padding
}
```

### `observe()` — observing transitions

```ts
const off = doc.observe('* -> published', (e) => notify(e.to))
doc.observe('draft -cancel> *', () => track('cancelled'))
```

**On the host, never the definition** — an imported definition is inert. `observe()` returns
an unsubscribe function.

**The handler receives the transition record**, `{ input, from, to }`, discriminated
by `input?.type` (or `if (e.input)`), and `e.from` / `e.to` are each their end's state,
tag included, so narrowing on `e.from.name` / `e.to.name` narrows the rest of the
fields the same way `current` does. An immediate transition carries `input: undefined`.

**Patterns are the key language with coordinates left open.** `*` stands for any state,
and an unlabelled arrow means any input, or none:

```ts
'* -> loading' //     entry: every arrival, including re-entry
'draft -> *' //       exit:  every departure, however caused
'draft -submit> *' // narrower: departures caused by `submit`
'* -submit> *' //     every `submit` edge, wherever it goes
```

There is no `-*>`: `*` appears only in state positions, so the input coordinate is
either a name or absent. The unlabelled form is the broad one — it matches
input-driven edges **and**
[immediate transitions](#immediate-transitions-an-edge-with-no-input), which have no
input at all. A bare key is not legal: `doc.observe('draft', fn)` names a state, and states
mean residency.

_Why patterns and a record rather than a snapshot:_
[rationale §12](api-rationale.md#observation-observe-on-the-host-with-patterns).

### Residency is a recipe, not a feature

Scoping something to "while we are in `draft`", with a teardown, needs nothing the host
does not already provide:

```ts
function residency(doc, state, setup) {
	let teardown
	// exit registered FIRST, so a self-transition tears down before it sets up
	const offExit = doc.observe(`${state} -> *`, () => {
		teardown?.()
		teardown = undefined
	})
	const offEnter = doc.observe(`* -> ${state}`, (e) => {
		teardown = setup(e.to)
	})
	// nothing will announce a state we are already in
	if (doc.current.name === state) teardown = setup(doc.current)
	return () => {
		offExit()
		offEnter()
		teardown?.()
	}
}
```

A self-transition matches **both** patterns, so restart-on-re-entry falls out rather
than being implemented. The policy wrappers come along too: `persistent` is
`if (e.to.name !== e.from.name)` in the exit handler, `keyed` compares
`k(e.from)` against `k(e.to)`.

What the host would have to own instead is [`actions`](#designed-not-in-v1) — residency
declared in the definition ([rationale §12](api-rationale.md#residency-is-derivable-not-a-host-feature)).

### Commit ordering

Five rules, and they are the whole execution model:

1. **One input yields at most one chain.** The input itself causes at most one
   transition, but arriving somewhere with immediate rows continues on, hop after
   hop, until the machine stops moving on its own — see
   [immediate transitions](#immediate-transitions-an-edge-with-no-input).
2. **Commit, then notify.** A listener always sees a fully committed machine, so `e.to`
   and `doc.current` agree — for every listener, on every hop, always.
3. **Listeners fire in registration order**, on every hop.
4. **A send from inside a dispatch is queued, unconditionally, across every host** —
   from a listener, or from a hop `start()` is settling. The queue
   and its draining flag are shared by every machine in the process, not owned one per
   host, so this holds whether the listener sends to its own host or to a completely
   different one. The queue drains before the outermost `send` returns — never on a
   microtask, never nested. So a listener is never re-entered while an earlier call is
   still running, on any host; the listeners after it, on any host, are never told
   about a transition their machine has already left; and a queued send — including
   one into an unrelated host — waits for the whole chain to settle rather than
   landing mid-hop. A `send` is therefore immediate only when no dispatch is in
   progress anywhere; otherwise it queues, which is also why reading a machine's
   `current` immediately after sending to it from inside any dispatch shows the state
   it had before that send, even when the two are unrelated hosts
   ([Sending](#sending)).
5. **`send` returns nothing**, including when it was queued.

**A chain that never settles throws.** After 1e5 consecutive hops, `RangeError` —
naming the state it could not settle — unwinds out of `send` exactly as a throwing
listener does: there is no rollback, the transition stays at its last committed hop,
and the host stays usable.

**A throwing listener ends the drain, wherever it sits.** The error unwinds out of the
`send` that started the chain — the outermost call, not necessarily the one on whose
host the listener threw — and everything still queued at that moment is discarded,
across every host in that chain: leaving it in place would let an unrelated later send
pick it up at an arbitrary time, and draining on would run queued work whose
assumptions the throw may have already broken. The listeners after the throwing one
still do not run. Every host in the chain stays usable afterwards: a later `send`
transitions and notifies normally, on the host that threw and on every other. A
runaway immediate chain's `RangeError` is treated identically.

**There is no `stop()`.** Disposal is unsubscribing your listeners and not sending any
more; the host holds nothing else.

_Why a queue, why chaining resolves the way it does, and what a throwing listener
does:_ [rationale §12](api-rationale.md#commit-ordering) and
[rationale §7](api-rationale.md#7-immediate-transitions).

---

## Observable behaviour

The spec above, as the list of things that can be asserted. Written for the
implementation to be driven from.

**Construction**

1. A transition key that is not well formed throws `SyntaxError` at `machine()`,
   naming the key — `not a transition: '<key>'`, the same wording the type layer
   reports on the offending row. Well formed means exactly one arrow, with a
   non-empty source and a non-empty target; the label between the two separators may
   be empty, which is the unlabelled arrow (18).
2. `start(data)` yields a host whose `current` is the initial state, tag included, `data`
   spread in — or, if the initial state's own immediate rows settle it further, whatever
   state that chain lands in. `start()`'s arity always follows the **declared** initial
   state: it takes no argument when that state carries no payload, even when settling
   carries it into a state that has data.
3. A chain off the initial state settles fully, hop after hop, before `start()`
   returns — exactly as it does after `send` (20).
4. If the initial state's immediate rows all skip, the host comes back sitting in the
   declared initial state, exactly as plain construction would.
5. A cycle among the initial state's immediates throws `RangeError` — same message
   shape as (34) — from `start()` rather than from `send`.
6. The hops `start()` settles are unobservable: nothing has subscribed yet, so only the
   state the chain lands in is visible, never the hops that got it there. They settle
   under the same drain a `send` takes, so a send issued from one of them — into
   another host, since nothing can yet reach the one being started — queues and drains
   after the chain settles, before `start()` returns (rule 4); a `start()` called from
   inside a dispatch settles inline and leaves the queue to the outer drain.
7. Two hosts from one definition share no current state and no listeners.
8. Nothing ever mutates the definition.

**Reading**

9. `current` is the current state, tag included and plain.
10. A value read from `current` before a transition is unchanged after it.

**Sending**

11. A handled input commits: `current` becomes the target state — its tag, and the
    handler's returned payload spread in — and every listener whose pattern matches that
    edge fires.
12. An input no row matches, and an input whose every candidate row calls `skip()`, both
    change nothing and fire no listener — indistinguishable, without exception.
13. With several rows for one `(from, input)`, candidates are tried in declaration order
    and the first that does not skip wins.
14. A self-transition commits and notifies like any other, with `e.from.name ===
e.to.name`, `e.from` the old state and `e.to` the new.
15. A handler receives the source state, tag included, and the input whole, tag
    included; an immediate transition receives `input` as `undefined`.
16. A handler whose target carries no payload returns nothing or `{}`.
17. `send` returns `undefined`, always.
18. An input that is not in the vocabulary (reachable from untyped code) changes
    nothing.
19. Entering a state by an input runs its immediate rows in declaration order;
    `skip()` falls through exactly as it does on an input-driven row, and a state
    whose candidates all skip stays put, its input rows still live.
20. A chain — several immediate hops in a row — settles fully before `send` returns,
    however many hops it takes.

**Observing**

21. `observe` returns an unsubscribe function; calling it more than once is harmless.
22. A malformed `observe()` pattern throws the same `SyntaxError`, at registration,
    naming the pattern — so a typo in a subscription cannot become a listener that
    silently never fires.
23. Listeners fire after the commit, in registration order — on every hop of a chain.
24. Inside a listener, `e.to` deep-equals `doc.current` — for every listener, on every
    hop.
25. `*` matches any state; an unlabelled arrow matches any input, or none — including an
    immediate transition; a labelled one matches only that input and never an
    immediate.
26. The listener list is snapshotted before dispatch: a listener unsubscribed by an
    earlier listener still runs for the current transition, and one registered during a
    dispatch does not.
27. An immediate transition's record carries `input: undefined`; a payload-free
    input's record carries its tagged object (e.g. `{ type: 'cancel' }`),
    distinguishable from it.

**Commit ordering**

28. A `send` from inside a listener does not take effect before the remaining listeners
    for the current transition have run.
29. The queue drains before the outermost `send` returns — synchronously, not on a
    microtask.
30. Several sends from listeners drain first-in-first-out.
31. A queued send is evaluated against the state at drain time, so it may find no row
    and do nothing.
32. A listener that throws propagates out of `send`. The listeners after it do not run
    and that dispatch's queue is abandoned, but the transition stays committed. **The
    host still works afterwards**: a later `send` transitions and notifies normally.
33. An input sent from a listener mid-chain is drained only once the whole chain has
    settled, never mid-hop.
34. A chain that never settles throws `RangeError`, naming the state it could not
    settle. There is no rollback — every hop up to that point has already committed and
    notified — and **the host stays usable afterward**.

**The untyped path**

35. With `inputs` and `states` both omitted, a well-formed table compiles: state and
    input names are exactly the ones `transitions` mentions, a state's fields beyond
    `name` and an input's fields beyond `type` are `unknown`, and `initial` must name a
    state that appears somewhere in the table.
36. A malformed key is still rejected with no vocabulary declared, and the error still
    lands on the offending line rather than on the `transitions` block.
37. Declaring one vocabulary and omitting the other checks that half and infers the other
    from the table, the same as omitting both.
38. An immediate row works the same with no vocabulary declared: its handler's `input`
    is still `undefined`, and it never leaks the empty label into the inferred input
    names.

## What the types check

- **Per-state data.** Narrowing the state narrows its data, with no nullable padding in
  states that logically guarantee a field.
- Unknown state or input names anywhere in a transition key or a pattern.
- **A handler returning the wrong shape for its target state — for every state, without
  exception.** A target with no payload accepts only nothing or `{}`; a fresh literal
  carrying extra properties, a wider-typed variable, an interface-typed value, and a
  spread of a wider state are all rejected the same way an ordinary target's wrong shape
  is.
- Reads of source data the source state does not have.
- Malformed keys — wrong spacing included — reported as `not a transition: '…'` on the
  offending line.
- `*`, or a name padded by a leading or trailing space, joining an _inferred_
  vocabulary — [see above](#inputs-and-states--the-vocabulary): neither is a name a key
  can round-trip, so a row that mints one is rejected the same way a malformed key is.

Errors land on the bad line, from a single declaration site, and no handler needs a type
annotation.

**What is _not_ checked: the send site.** Per-state capabilities are not enforced by
the compiler.

## What is claimed, and what is not

- **A transition is pure.** Given a state and an input it yields either the next state
  or a refusal, and it neither performs nor schedules anything.
- **Sending is broad**: every declared input is accepted from every state, whether or
  not it commits.
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
| `emit`                      | deferred past v1 ([§16](api-rationale.md#16-the-composition-boundary))                                           |
| `else`                      | declining is a normal outcome, and silent ([§4](api-rationale.md#two-decisions-that-fell-out-of-the-comparison)) |
| a `send` return value       | `current` ([§12](api-rationale.md#send-returns-nothing))                                                         |
| `stop()`                    | unsubscribe, and stop sending ([§12](api-rationale.md#no-disposal-and-a-listener-that-throws))                   |
| typed `send`                | nothing at runtime either; recorded but unbuilt ([§11](api-rationale.md#if-it-comes-back-it-comes-back-as-s12))  |
| hierarchy, parallel regions | out of scope ([§10](api-rationale.md#what-the-rest-of-the-record-forbids))                                       |

---

## Changing before v1

Settling the composition boundary
([rationale §16](api-rationale.md#16-the-composition-boundary)) reached back into the
surface above. All planned changes are **already shipped**:

1. **The transition record carries three fields**: `{ input, from, to }`. `e.input?.type === 'submit'` narrows `e.input`, and an immediate transition says so with `input: undefined`.
2. **The input and state vocabularies are tagged unions**: inputs tagged `type`, states tagged `name`.
3. **`send` takes one argument**: `send({ type: 'move', x, y })`.
4. **`.on` became `observe`**, leaving `.on` unclaimed for a future output channel.

**`data` is a convention, not a rule** — for both halves of the vocabulary. A payload
that is not a record, or that wants a field called `type` or `name`, nests it:

```ts
{ type: 'tick', data: 5 } // an input
{ name: 'editing', data: { name: 'foo' } } // a state
```

Nothing in the library requires or inspects `data` — it is an ordinary field, and any
other name works. It is the recommended shape whenever a tag would collide or a payload
is not an object, and it is worth reaching for deliberately: a state or input that
carries its own `name`/`type` field is ordinary enough that meeting the collision by
accident is the thing to avoid.

_Why, what was measured, and the rejected alternatives:_
[rationale §16](api-rationale.md#16-the-composition-boundary) and
[§17](api-rationale.md#17-the-shape-of-a-named-thing).

---

## Designed, not in v1

Two directions v1 leaves room for, argued in the rationale and neither built. Sketches
rather than commitments: whether either ships is open. **The order is not**, and it is
the one thing here that is settled: `actions` first, because `emit` has nowhere to live
without it. A handler may `skip()`, and declaration order is priority order, so a
handler that emitted would announce a transition that then loses. `emit` needs a
post-commit home, and the action bag is the only one
([§16](api-rationale.md#emit-cannot-precede-actions)).

Further out, and past what is designed here at all, is a prospective plan for
composition — see [the roadmap](roadmap.md).

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

### `emit` — a declared output channel

A machine may declare what it announces, separately from what it _is_. `outputs` names
the vocabulary, `emit` reaches actions the way `send` does, and the freed `.on`
subscribes by output name:

```ts
outputs: types<{ type: 'opened'; center: Point } | { type: 'ended' }>(),

actions: {
	novice: persistent(({ data, emit }) => emit({ type: 'opened', center: data.origin })),
},
```

`observe` still sees every transition — **nothing is hidden**, and this adds a channel
rather than replacing one. What it buys is that a consumer can subscribe in the
machine's published words instead of its internal state names, so a topology refactor
stops breaking it. `emit` is deliberately absent from `observe`: an output has to be a
claim the _definition_ makes, or it is worth nothing at a seam. The `.on` spelling above
is illustrative, not reserved — no method name, shape, or syntax is claimed ahead of the
design that would justify it.

_Why not encapsulation, and what it does not fix:_
[rationale §16](api-rationale.md#16-the-composition-boundary).

---

## Scope

**v1** is this document. Two costs are known and accepted: the notation is not settled
beyond appeal — rival layouts still compile — and the completion payload is now
|inputs| × |states|² for input-driven edges plus |states|² for immediate ones, measured,
with latency fine ([rationale §15](api-rationale.md#15-still-open),
`pnpm measure:completions`).

**After v1** is prospective, not promised — see [the roadmap](roadmap.md) for what is
argued and in what order.

[Rationale §15](api-rationale.md#15-still-open) has what is still open, including the
four questions §16 and §17 opened.
