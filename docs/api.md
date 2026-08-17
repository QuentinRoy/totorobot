# The API

> **Status: designed, not built.** This is the settled shape of the next API,
> arrived at over the rounds recorded in [api-rationale.md](api-rationale.md).
> The code in `src/` is the previous generation and does not implement it. The
> closest working prototype is
> [`explorations/candidates/n2-declared-types/`](../explorations/candidates/n2-declared-types/),
> which implements everything here except `actions`.

## The whole thing at a glance

```ts
import { machine, types, persistent } from 'totorobot'

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

	actions: {
		draft: ({ data }) => {
			const t = setTimeout(() => autosave(data), 2_000)
			return () => clearTimeout(t)
		},
		'*: draft -> *': () => releaseLock(),
	},
}).on('*: * -> published', (e) => notify(e.to.data))
```

Four blocks, one job each:

| block         | answers                               |
| ------------- | ------------------------------------- |
| `types`       | what can happen, and what we can be   |
| `transitions` | how we move, and what the new data is |
| `actions`     | what runs, and for how long           |
| `.on()`       | what an outside subscriber hears      |

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

Both maps are **declared**, not inferred from marker values. `types<T>()` erases
to `{}` at runtime; it exists only to carry `T`.

- A data-free state is `void`. Not `data: nothing`, not `state()` — the actual
  type.
- The vocabulary is an ordinary type, so it can be named, exported, imported,
  generated, made generic, or built with `Omit`/`&`. **Name it.** Writing
  `types<Publication>()` rather than `types<{ … }>()` keeps hover text and error
  messages from inlining the whole literal.

Declaring rather than inferring is what makes the rest of the design safe; the
two silent holes it closed are in the [rationale](api-rationale.md#7-the-declared-vocabulary).

**The cost, stated plainly:** states have no runtime existence. The machine
object carries transition keys, not a list of states, so a visualiser or a
dev-mode "valid states are …" message has no source, and a state with no
transitions at all is invisible at runtime.

### `inputs`, not `events`

Every JS FSM library — XState, robot3, Zag — says **events**, and the formal
literature says **input** (a symbol from Σ, consumed by δ: Q × Σ → Q). Two
reasons for taking the minority word here:

- **The core is not a mailbox.** `step()` is a pure `(state, input) -> state`
  function and the host is optional. "Event" is the statechart word, and it comes
  bundled with a queue, broadcast and run-to-completion semantics this core does
  not have. Using it would promise them.
- **A state _handles_ inputs.** `doc.available` lists what this state accepts,
  and `Handled<T, 'draft'>` computes it — both read as an interface. An event is
  something that _happens to you_; you do not ask an object for its available
  events.

`.on()` handlers reading `e.input` rather than `e.event` is a convenience, not
the argument — see the rationale, where that claim is walked back.

Full argument and prior art: [rationale §7](api-rationale.md#inputs-not-events).

## `transitions` — the table

```ts
'submit: draft -> review': ({ data, input, skip }) => …
```

One row per edge. All four coordinates — input, source, target, and the handler
— sit on one line at fixed positions that no formatter can move.

### The key language

```
input: from -> to
```

Whitespace is **not** load-bearing: `load:idle->booting`, `load: idle -> booting`
and `load : idle ->  booting` all normalise to the canonical form before anything
looks at them. Completions emit the canonical form, so drift should be rare — but
note that **human grep cannot normalise**, so a compact key will not match a
spaced search. A lint rule enforcing the canonical spelling would close this.

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
deliberate: refusing is often part of the protocol. There is no `else` keyword;
the ambiguous case (all branches skipped by accident) gets a dev-mode warning
instead — _"`submit` in `draft` declined, all 2 branches skipped"_.

### Self-transitions are ordinary transitions

```ts
'revise: draft -> draft': ({ data, input }) => ({ …, revision: data.revision + 1 }),
```

No `keep`, no `repeat`, no `&`, no `stay`, no symbol. Whether anything restarts
because of this is a question for `actions`, not for the table — see below.

### What you get for free

Because the table is one flat block of parsed strings, all three topology
questions are a plain text search, and the reverse index is derivable:

| question                          | search       | derived type           |
| --------------------------------- | ------------ | ---------------------- |
| what can I do in `draft`?         | `: draft ->` | `Handled<T, 'draft'>`  |
| where can I `submit`?             | `'submit:`   | —                      |
| how does anything reach `review`? | `-> review`  | `Sources<T, 'review'>` |

## `actions` — what runs

Keyed by **trigger**, in the same key language. The value is a bare function, or
the result of a wrapper where the default does not hold.

```ts
actions: {
	loading:              ({ data, send }) => fetchUser(data.id, send),      // residency
	connected: persistent(({ data, send }) => subscribe(data.url, send)),    // residency, survives
	'cancel: draft -> *': () => track('cancelled'),                          // an edge
	'*: * -> loading':    () => spinner.show(),                              // entry
	'*: draft -> *':      () => releaseLock(),                               // exit
}
```

### Residency

A key with **no arrow** names a state. Its action runs while that state is
current:

```ts
connected: ({ data, send }) => {
	const sock = new WebSocket(data.url)
	sock.onmessage = (m) => send('message', m.data)
	return () => sock.close()
},
```

This is the case that decides the whole design: **a socket is a node concern,
not an edge concern.** Put it on an edge and it duplicates across every edge
_into_ the state, and an edge added later silently does not start it.

### The teardown

**A residency action's return value is its teardown.** Returning a function is
how you undo what the action did; returning anything else, or nothing, means
there is nothing to undo.

```ts
loading: ({ data, send }) => {
	const c = new AbortController()
	fetchUser(data.id, { signal: c.signal }).then(
		(u) => send('loaded', u),
		() => send('failed'),
	)
	return () => c.abort() // ← runs on the way out
},
```

The teardown runs when the state stops being current — **by any route, including
a self-transition**, since the default is to restart (below). Setup and teardown
are lexically paired, so the correlation no library could check becomes one no
author can break: the cleanup closes over `c` because it was written beside it.

**Edge actions have no teardown.** An edge action fires at a moment rather than
occupying a span, so there is nothing for a returned function to be scoped to.
Its return value is ignored.

### Edges, entry and exit

A key **with** an arrow is an edge pattern, with `*` allowed at any position.
Entry and exit are not their own concept — they are edge patterns with one end
pinned:

```ts
'*: * -> loading': fn,   // entry: every arrival, including re-entry
'*: draft -> *':   fn,   // exit: every departure
'draft -> *':      fn,   // the same thing — the input half is optional
```

**The residency form expresses both too**, and often reads better, because a
teardown that runs on every departure is exactly an exit action:

```ts
loading: fn,       // entry — nothing to tear down, so only the setup runs
draft: () => fn,   // exit  — nothing to set up, so only the teardown runs
```

The two spellings agree because the default is to restart: a residency action
re-runs on `loading -> loading` exactly as `'*: * -> loading'` fires on it, and
tears down on `draft -> draft` exactly as `'*: draft -> *'` fires on it.

Reach for the pattern form when you need to **scope the trigger more narrowly**
than "arriving" or "leaving" — by the input (`'submit: draft -> *'`) or by the
other end of the edge (`'*: idle -> loading'`). Residency cannot say either.

### `send` cannot grow the machine

An action's `send` accepts only **already-declared** inputs. `actions` therefore
adds nothing to the vocabulary — which is exactly why it works, and exactly what
a `within(state, childMachine)` mount could not manage.

### Restart, and `persistent`

**The default is to restart.** Any transition into the state you are already in
tears the action down and re-runs it. That fails safe: forgetting an opt-out
costs a teardown, not an activity closed over stale data.

One wrapper opts out:

```ts
connected: persistent(({ data, send }) => subscribe(data.url, send)),
```

`persistent(fn)` — never restart while resident. A fetch should start again when
you re-enter `loading`; a long-lived socket is the exception, and marking the
exception is the whole point of the shape.

The wrapper returns the record a hand-written object value would have been —
`persistent(fn)` → `{ run: fn, restart: 'never' }` — and a bare function is sugar
for `{ run: fn }`. So the block stays inspectable as data, and **a further policy
is a further wrapper rather than new syntax**: a `keyed(k, fn)` that restarts only
when `k(data)` changes, or a `once`, would each be one more constructor producing
one more field, with the block's shape untouched. None is in the API until
something needs it.

Note that restart-on-re-entry and restart-on-data-change are **one event**:
resident data can only change through a transition into the state you are
already in.

### One action per trigger

Two activities in one state compose into one function that starts both and
returns a combined teardown. Array values remain available later as a pure
widening if that ever reads badly.

## `.on()` — subscription

```ts
machine({ … })
	.on('*: * -> published', (e) => notify(e.to.data))
	.on('cancel: draft -> *', () => track('cancelled'))
```

Same pattern language as `actions` edge keys. The event is a union discriminated
by `on`, so `e.on === 'submit'` narrows `e.input`, and `e.from` / `e.to` carry
each end's data.

**The split with `actions` is about ownership, not capability.** `actions` is the
machine's own behaviour and ships with the definition; `.on()` is a subscription
attached by whoever instantiates it. Analytics on a machine you imported is the
second thing.

`.on()` returns the machine unchanged — listeners add nothing to its type.

> **Open.** Attaching listeners to the _definition_, as shown, contradicts the
> paragraph above it: two hosts running one definition would share them, and a
> value documented as inert gets mutated. Subscriptions likely belong on the
> host — see [rationale §16](api-rationale.md#16-definition-and-instance--open).

## Sending inputs

A machine is driven through a **host** — the stateful thing that owns the current
state and runs the actions.

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

### Sending is broad, and that is deliberate

**Every declared input is accepted from every state.** An input the current state
does not handle answers `unavailable` and changes nothing — it does not throw,
corrupt, or half-apply. That is also how a stale async result lands harmlessly.

There is **no typed send site**: `doc.send('decide', …)` compiles in `draft` and
is a no-op at runtime. This is a deliberate drop, not an omission — see
[rationale §15](api-rationale.md#15-sending-inputs). The short version: the
narrow-then-send shape everyone reaches for is **unsound in TypeScript and
uncorrectable** (narrowing survives mutation, [finding 11](api-rationale.md#13-reusable-type-system-findings)),
and every sound spelling makes the caller re-state a fact the machine already
knows. Adding one later is additive; shipping the wrong one now is breaking.

**Per-state _data_ is unaffected** — narrow `doc.current` and the data narrows
with it, which is the half of typestate that works:

```ts
const now = doc.current
if (now.state === 'draft') {
	now.data.revision // number — no nullable padding
}
```

### Reading, and outcomes

- `doc.current` — an immutable snapshot, plain data. Safe to clone, compare,
  serialise, or hold in component state.
- `doc.available` — the inputs this state handles, as a runtime array. What UI
  code needs to render buttons.
- `send` reports its outcome: `moved`, or `none` with `declined` (a row matched
  and every candidate called `skip()`) versus `unavailable` (no row matched).

### `step` — the engine primitive

Underneath, `step(machine, current, input, payload)` is a pure function returning
`{ kind: 'moved', next }` or `{ kind: 'none', reason }`. It runs no actions and
owns no state, which makes it the right tool for tests and for replaying a log —
`step` in a loop over `(definition, initial, inputs)`, with no clock and no
teardown. It is not the API to reach for otherwise.

## The one key rule

> **A key with no `->` names a state. An edge always contains an arrow, even when
> both ends are `*`.**

That is the whole grammar, across both blocks. It is decidable from the string
alone, so a reader never has to know which block they are in.

The rule costs one thing: `.on('submit', fn)` is no longer legal and becomes
`.on('submit: * -> *', fn)`. Without it the same bare syntax would mean an input
in `.on()` and a state in `actions`, and a name that is legally both — `review`
is plausibly both, and it is a state in the example above — would compile under
the wrong reading with no error. `'submit: * -> *'` is arguably better anyway: it
makes "across all edges" explicit rather than implied.

---

## What the types check

- **Per-state data.** Narrowing the state narrows its data, with no nullable
  padding in states that logically guarantee a field. This is the half of
  typestate the project is actually claiming.
- Unknown state or input names anywhere — in a transition key, an action key, or
  a pattern.
- A handler returning the wrong shape for its target state.
- Reads of source data that the source state does not have.
- Malformed keys, reported as `not a transition: '…'` on the offending line.

Errors land on the bad line, from a single declaration site.

**What is _not_ checked: the send site.** Per-state capabilities are advertised
at runtime (`doc.available`) and not enforced by the compiler — the same place
`@cassiozen/useStateMachine` landed. The reasoning, and the way back in if it
bites, are in [rationale §15](api-rationale.md#15-sending-inputs).

## Runtime semantics

- `step(machine, current, input, payload)` is **pure** and returns
  `{ kind: 'moved', next }` or `{ kind: 'none', reason: 'declined' | 'unavailable' }`.
- **State values are immutable snapshots**, and plain data — safe to clone,
  compare, serialise, or hold in component state.
- **Sending is broad.** Every declared input is accepted from every state; the
  ones the current state does not handle answer `unavailable`.
- **Actions need a host**, and only a host. Everything else works against `step`
  alone.
- **Stale results are free.** A `loaded` arriving after we left `loading` matches
  no row and returns `unavailable`. That is _ignoring a result_, not _cancelling
  work_ — but cancelling is what an action's teardown is for.
- Flat. No hierarchy, no parallel regions.
- EFSM, not FSM: reachability and "this guard can never fire" are out of reach
  and are not claimed.

## Deliberately absent

| absent            | because                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `enter` / `exit`  | edge patterns with one end pinned already express both                                                                                        |
| `keep` / `repeat` | unobservable without entry/exit; now an action's restart policy                                                                               |
| `emit`            | a listener recovers everything from `{ on, input, from, to }`                                                                                 |
| `else`            | throws at runtime, buys no static guarantee; a dev warning instead                                                                            |
| typed `send`      | unsound in TS (narrowing survives mutation); a sound design is [recorded but unbuilt](api-rationale.md#if-it-comes-back-it-comes-back-as-s12) |
| hierarchy         | the key grammar would become paths, and every layout decision reopens                                                                         |

---

## Scope by release

**v1 — no `actions`, no composition.** The definition is topology and data;
effects are attached by whoever runs the machine, via `.on()` on the host.
That makes the core effect-free without needing §11's description vocabulary.

### What still gates v1

|     | question                                           | why it blocks                                                                                                                                                                                                                                                                                                                        |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Does a residency handler get `send`?**           | Yes → commit ordering must define reentrancy. No → v1 cannot express fetch-then-transition **at all**, and the async story waits for v1.1. This is the biggest scoping call left.                                                                                                                                                    |
| 2   | **Commit ordering**                                | When listeners fire relative to the state change, what `send` returns, and what happens when a listener sends during a send. Smaller without actions, but not empty.                                                                                                                                                                 |
| 3   | **`.on()` moves to the host**                      | [§16](api-rationale.md#16-definition-and-instance--open): the current code attaches to the definition, so two hosts would share listeners. Now load-bearing, because `.on()` _is_ the effect mechanism.                                                                                                                              |
| 4   | **`.on()` accepts a bare state key**               | Residency plus teardown, which [§12](api-rationale.md#12-actions--the-concern-argument) says the key rule already makes free. Unbuilt.                                                                                                                                                                                               |
| 5   | **Does the definition/instance split survive v1?** | [§16](api-rationale.md#16-definition-and-instance--open) made it conditional: _"ship composition → keep the split; do not → a factory is simpler."_ Composition is now deferred, so that conditional currently points the other way. Keeping it is defensible as forward-compatibility, but it should be **decided**, not inherited. |
| 6   | Host construction                                  | `run(publication, data)` or `publication.start(data)`; initial data as an argument or beside `initial:`.                                                                                                                                                                                                                             |
| 7   | Are immediate transitions in v1?                   | `'from -> to'`, no input. Independently wanted, and currently only motivated by composition ([§17](api-rationale.md#17-effects-round-4--composition-reopened)). Cheap now, a breaking grammar change later.                                                                                                                          |

Known and shippable without answering: the layout remains revisitable; whitespace
tolerance costs the grep story until a lint rule exists; editor completion at
~4 000 union members is unmeasured; the losing-candidate bug below is harmless
while handlers only project.

### v1.1 — `actions`

The design is settled ([§12](api-rationale.md#12-actions--the-concern-argument)):
trigger-keyed, restart-by-default, wrappers for policy. What is not:

- **Commit ordering with actions in the loop** — the full eight decisions of
  P0.7. When actions fire relative to listeners and to teardown.
- **`actions` and `.on()` residency coexist** — same shape, different owners
  (§12). If both attach to `draft`, what is the run and teardown order?
- **An error channel** — what happens when an action throws.
- **Restart-by-default is unvalidated.** The case that decides it is a
  self-transition that changes resident data, and it has never been built.
- The losing-candidate bug becomes worth fixing.
- `keyed` / `once` / `debounced` — designed as later-and-free; still not needed.

### v1.2 — composition

Designed in [§17](api-rationale.md#17-effects-round-4--composition-reopened) and
deferred. Open:

- **Which spelling** — invoked children with the outcome as a derived _state_,
  or the callback form. The accumulating-cost table in §17 is the case for the
  callback; the typed protocol is the case against it.
- **Vertical or horizontal?** §17 recommends invoked children (vertical), while
  the strongest external evidence — SwingStates, ConstraintJS — is for peer
  machines (horizontal). Both were designed; only one was recommended.
- **What data `loading.ok` carries** — the child's outcome, the parent's data, or
  both under separate bindings.
- **Cancellation** — does leaving cancel the child's work, or only stop us
  caring? Open since §9 and still unanswered.
- Immediate transitions, if they did not land in v1.
- The `invokes:` vocabulary map and the child-value block — a fourth map and a
  fifth block.
- `all` / `race` primitives, needed because only one child may mount per state.
- Reading a running child's progress, which should be host-level and read-only.

## Not settled

- **The layout is a three-way choice that went to string keys, not a closed
  question.** Target keys (`d1`) wins co-location — a state's data and its
  outgoing edges in one block — and classic records (`o1`) wins extensibility,
  since priority or labels are just more fields. Both are complete, compiling
  prototypes. See the [rationale](api-rationale.md#6-round-3--layout).
- **Editor completion responsiveness at ~4 000 union members is unmeasured.**
  TS 7.0.2's `--lsp` did not answer `textDocument/completion` even for a
  4-member union. Open `explorations/candidates/n1-transition-table/playground.ts`
  and try it by hand.
- **The host.** `send`, `current` and `available` are settled; the rest of
  `run()` is a sketch. Commit ordering, receipts for queued inputs, an error
  channel and the name are all open. This matters more than it looks, because
  actions do not run without it. Whether `.on()` moves here is
  [rationale §16](api-rationale.md#16-definition-and-instance--open).
- **Composition.** A child machine mounted at a state is the obvious next
  feature and has no home in this shape yet; the analysis is in the
  [rationale](api-rationale.md#10-effects-round-2--composition).

## Known bug to fix when building

`step` calls **losing** candidates' handlers — it tries every matching row and
takes the first that does not `skip()`
([lib.ts:269](../explorations/candidates/n2-declared-types/lib.ts:269)). Harmless
under this design, because handlers only project. It becomes real the moment
anything puts effects back in a handler, and it is true of all three layouts.

## The prototype to build

`actions` on `n2`: keys checked against both the declared state names and the
pattern grammar, teardown on leaving, `persistent` as the only wrapper —
exercised against a self-transition that changes resident data. That last case is
the one that will actually say whether restart-by-default feels right.
