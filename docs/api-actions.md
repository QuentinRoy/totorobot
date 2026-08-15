# Actions — where they belong, and how they are written

The effect-free core is abandoned: keeping effects out of the definition forced
either a description vocabulary plus a reconciling driver, or a
`within(state, childFsm)` that grows the input vocabulary through a fluent chain.
**The machine may perform actions.** This document asks where they go, what the
block is called, and how it is spelled.

API only.

## The constraint that decides it

The declaration separates concerns, one block per job:

```
inputs      — what can happen
states      — what we can be
transitions — how we move
```

A proposition is judged first on whether it keeps that true. This is what
eliminated the first round, and it is worth being precise about why, because
**the overload predates actions**:

`with` already does **two** jobs — it decides (`skip`) _and_ projects the target
data. o1's README celebrates the fold, correctly, because splitting `guard` from
`map` lost narrowing. So the transition handler was carrying two jobs before this
conversation started. Adding "and it acts" makes three; proposition Z below made
it **four**. That is the whole diagnosis.

## What the word has to cover

Four jobs travel under "action". They differ in **what owns the lifetime**,
which is the only distinction that matters.

| #   | Kind              | Example                        | Shaped like | Needs                |
| --- | ----------------- | ------------------------------ | ----------- | -------------------- |
| 1   | Transition action | `track('submitted')`           | **edge**    | nothing              |
| 2   | Command           | fetch, then `send('loaded')`   | **edge**?   | `send`               |
| 3   | Activity          | socket, timer, poll            | **node**    | residency + teardown |
| 4   | Entry / exit      | focus an input, release a lock | **node**    | residency            |

The question mark on 2 is a finding, not a hedge — see the duplication argument
below. **3 is the one that decides everything: the test any proposition must pass
is expressing a socket.** A design that only decorates edges cannot say "this is
open while we are here", and fakes it by pairing an entry edge with every exit
edge — the drift the table exists to eliminate.

**4 turns out not to be its own kind.** Entry and exit are transition actions
with one end pinned — `'*: * -> loading'` and `'*: draft -> *'` — and the pattern
grammar already expresses both. Only 3 genuinely needs residency.

## The concern map

| concern                                    | home          |
| ------------------------------------------ | ------------- |
| what can happen                            | `inputs`      |
| what we can be                             | `types<>`     |
| how we move, and what the target's data is | `transitions` |
| **what runs, and for how long**            | **`actions`** |
| what an outside subscriber hears           | `.on()`       |

---

# The decision: actions attach to residency

**A command is a state concern, not an edge concern.** This is the substantive
argument, not an aesthetic one: put the fetch on the edge and it duplicates on
every edge _into_ the state — `load: idle -> loading` and
`retry: failed -> loading` both have to start it, and an edge added later
silently does not. Attached to residency it is written once and is automatically
right. That is what rules out V and Z on merit rather than taste.

**The block is called `actions`, not `states`.** An earlier draft of this
document called it `states:`, which is a lie: the states are already declared in
`types<>`, and every one of them appears in the table. The block does not declare
states — it declares **what runs**. Naming it after its content also frees the
shape, because it is no longer obliged to be a map keyed by state name.

`transitions` is untouched by all of this. Handlers keep exactly the job they
have today: decide and project.

## Why not the alternatives

Three properties come free and are worth naming, because they are what the
rejected options paid for:

- **The type never grows.** `send` sends only **already-declared** inputs, so
  `actions` adds nothing to the Spec. That is exactly what
  `within(state, otherfsm)` could not manage — it added `loading.ok` and
  `loading.rejected` to the input vocabulary, forcing a fluent chain whose type is
  incomplete until the chain ends. This works _because_ it is less powerful.
- **It cannot drift.** State names are checked against the declared vocabulary; a
  name that matches nothing is an error.
- **It is the standard answer.** Harel, SCXML, XState and `gen_statem` all attach
  activities to nodes. It is also the value-level slot whose absence blocked child
  machines ([api-async-composition.md](api-async-composition.md) finding 3):
  robot3 mounts a child at a state because its states are values.

What it costs: **axis 3 reopens by definition**, and it is **opaque** — nothing in
the table says `loading` fetches, so grep `-> loading` finds the edges but not the
work. That was option A's fatal complaint; attaching to residency does not answer
it, it only gives the closure a defensible lifetime.

## Why a block, and not `.on()` / `.within()` handlers

This is not an argument about capability. Proposition X can express everything the
block can, costs nothing in the core, and half of it is already built. The case
for a block is three things:

1. **The definition is complete.** `machine({…})` is a value that gets exported,
   imported and instantiated. If behaviour arrives through `.within()` calls made
   afterwards, the exported thing is not the machine — it is half a machine plus a
   convention that every caller remembers to configure it. In practice you would
   export a factory instead, and the definition would stop being the definition.
2. **Declarative, in one place.** A chain is imperative and order-dependent, can
   be applied conditionally, and can be spread across modules. A block cannot.
3. **Symmetry.** `inputs`, `states` and `transitions` are all blocks. Actions as a
   chain makes the one concern that is not in the declaration.

**`.on()` survives, with a different job.** `actions` is the machine's own
behaviour and ships with it; `.on()` is a subscription attached by whoever
instantiates it. Analytics on a machine you imported is the second thing, not the
first, which is also why axis 7 settled where it did.

---

# A — how the block is spelled

## A1 — records

```ts
actions: [
	{ within: 'loading', run: ({ data, send }) => { …; return () => c.abort() } },
	{ within: 'connected', run: ({ data, send }) => subscribe(data.url, send) },
],
```

**On the key name.** `fn` is meaningless. `then` is a **thenable hazard** — an
object carrying `.then` changes behaviour when awaited or resolved. `do` is a
reserved word: legal as a property name since ES5, but it highlights as a keyword
in most editors. **`run`** is the pick — a verb, short, and it pairs with the
teardown it returns. `start` is the runner-up and is more honest about the
lifecycle: _start this; what you return stops it._

**The good.** A **list, not a map**, so two independent activities in one state
are two records rather than one closure doing two things — a socket and a timer
stay separable and separately configurable. Extensible in o1's sense: `restart`,
a debug label, a priority are all just more fields. The trigger is a named field,
so edge-shaped actions are the same record with a different field
(`{ on: 'cancel: draft -> *', run }`).

**The cost.** Ordering becomes observable. And the trigger field is a small
vocabulary that can grow (`within`, `on`, `entering`, `leaving`).

## A2 — constructors

```ts
actions: [
	within('loading', ({ data, send }) => { …; return () => c.abort() }),
	on('cancel: draft -> *', () => track('cancelled')),
],
```

**The good.** The key-name problem disappears entirely. This is proposition M
(combinator edges), which died for _transitions_ on per-edge tax — but actions are
sparse, two or three per machine, so that tax is close to nothing here. It also
gives `on` and `within` one home instead of splitting effects between a block and
a fluent chain.

**The cost.** Options move into a trailing argument
(`within('loading', fn, { restart: 'on-reentry' })`) rather than being a field,
which reads worse the moment there is more than one.

## A3 — keyed by trigger, reusing both existing grammars

```ts
actions: {
	'loading': ({ data, send }) => { … },            // no colon → a state name
	'cancel: draft -> *': () => track('cancelled'),  // a colon → a pattern
},
```

**The good.** No new syntax at all — both key languages already exist, and the
distinction between them is structural rather than declared.

**The cost.** Possibly too clever: the reader has to notice the colon to know
which language they are in. One action per trigger unless values may be arrays —
a limit that can be lifted later without breaking anything, since an array value
is a widening of a function value.

**It pairs with string keys.** A3 and `n2` are the same idea applied twice: one
key language, parsed, doing the work that structure does elsewhere. Choosing both
means the whole definition is string-keyed maps, which is the most compact and
most greppable combination available.

## The coupling: A3 leaves the action no options slot

A3's appeal is a **bare function value**. A per-action `restart` policy needs
somewhere to live, and the only slot is the value — which would make it
`{ run, restart }` and reintroduce the two-value-shapes cost that counted against
V. A1 has a natural field for it, and that is the main thing A1 buys.

This is not fatal to A3: section C resolves it by moving the policy into the
**key** instead of the value, where the arrow already means movement. Recorded
here because the coupling is what makes section C necessary at all.

---

# B — re-entry, now that it is observable again

Actions make `draft -> draft` observable for the first time, which is why axes 4
and 5 were closed as a chain (see [api-propositions.md](api-propositions.md)).
The question has to be answered somewhere.

## Are `stay` and `skip` the same thing?

No — on two counts:

|           | changes data | commits                        | reported          |
| --------- | ------------ | ------------------------------ | ----------------- |
| `skip()`  | no           | no — falls through to the next | `none / declined` |
| `stay(d)` | yes          | yes — consumes the input       | `stayed`          |

They coincide only if `stay` were nullary **and** multi-target fall-through were
removed. Neither holds today, so the reduction is not available.

**But neither `stay` nor `next` is needed.** A handler returning data under a key
that reads `draft -> draft` already _is_ a stay — that is what is written today.
The genuinely new question is not "did we move?" but **"does the activity
restart?"**, which is a different question wearing the same clothes.

## B1 — omit the arrow

`'revise: draft'` handles the input, updates the data and does not move.
`'restart: draft -> draft'` leaves and re-enters. The arrow denotes movement, so
its absence denotes none.

Greppable — no `->` on the line — and it strengthens the arrow test rather than
complicating it. It does not appear to be among the ten buried self-transition
propositions; the closest, T3 (self-name), is its opposite.

## B2 — `-> *` means stay

The slot is technically free, since a transition target must be concrete and `*`
is therefore unused there. **Rejected anyway:** `*` already means _wildcard_ in
the listener pattern language, and anyone who has read a pattern will misread it.
Two meanings for one symbol in two adjacent grammars.

## B3 — the action declares its own restart policy — **recommended**

```ts
{ within: 'loading', restart: 'on-reentry', run: … }
```

The transition author is declaring **movement**. Whether some socket survives that
movement is not their concern and they should not have to know — and two
activities in the same state can legitimately want different answers. Put the
lifetime question on the thing that _has_ a lifetime.

Consequences:

- **`draft -> draft` goes back to being an ordinary transition.** Axes 4 and 5
  stay dissolved _in the notation_, which is where they were causing trouble. No
  keyword, no second spelling, no arrow rule.
- **It subsumes the stale-data question.** An activity closing over `data.id` when
  a self-transition changes `id` is the same problem, and `restart` is its knob.
- **Default: restart.** Reversed from an earlier draft of this document, which
  argued that residency is the state's name being current so a self-transition
  should restart nothing. See C2 — restart-by-default fails safe, and it puts the
  opt-out on the rarer thing.

See section C for how the policy is actually spelled — B3 says _where_ it lives,
not _how_ it is written, and the two are separable.

## B4 — data identity decides it

Return `data` unchanged and the resource survives; return a new object and it
restarts. Zero syntax, and it is the `Symbol.dispose` idea from AA below.

**Rejected.** `{ ...data }` versus `data` is an edit made without thinking, and it
would silently change restart behaviour. Correctness should not hinge on whether
someone spread an object.

## Where B lands

**B3 — the policy belongs to the action.** The transition author declares
movement; whether some socket is sensitive to that movement is not their concern.
B1 remains the fallback if per-action policy turns out to be over-engineering.

What B3 does _not_ settle is how the policy is written, which turns out to be a
separate question — A3 gives the action no options slot. That is section C.

---

# C — how the restart policy is spelled

## The two questions are one question

Restart-on-re-entry and restart-on-resident-data-change look like two policies.
They are not. **Resident data can only change via a transition into the state you
are already in** — that is the only event either one names. So there is a single
policy at two granularities: restart on _any_ self-transition, or restart only
when _something relevant_ changed.

This collapses one of the open questions from the previous draft.

## C0 — no policy at all: always restart

A self-transition tears down and re-runs, unconditionally. Anything that must
survive is not really state-scoped, so hoist it out of the machine.

**The good.** Zero surface, one rule, nothing to learn.

**The cost.** A socket in `connected` dies whenever an unrelated counter updates,
and the remedy is to move it somewhere the machine cannot see — which is the
thing `actions` exists to avoid. It is the baseline the rest must beat.

## C1 — spell it in the action key

The key is already a parsed grammar. Give it the distinction, and values stay
bare functions:

```ts
actions: {
	'connected':          ({ data, send }) => subscribe(data.url, send),  // resident — survives
	'-> loading':         ({ data, send }) => fetchUser(data.id, …),      // each entry — restarts
	'draft ->':           () => releaseLock(),                            // on exit
	'cancel: draft -> *': () => track('cancelled'),                       // an edge
},
```

Parsing is unambiguous: a `:` means an edge pattern; a leading or trailing `->`
means entry or exit; neither means residency.

**The good.** **The arrow keeps its existing meaning — movement** — so this is
B1's insight relocated onto the action key, which is where B3 says the policy
belongs. Values stay bare, so it composes with A3 rather than fighting it. And it
gives entry/exit (kind 4) a spelling for free, which no other option here does.

**The cost.** `'loading'` and `'loading ->'` differ by two characters at the end
of a string, which is subtle in a list.

**C1b — word prefixes instead of arrows**, if that subtlety bites:

```ts
'in loading': fn,
'entering loading': fn,
'leaving draft': fn,
```

Louder and unmissable, at the price of a three-word keyword vocabulary.

## C2 — wrappers, only where the default does not hold — **decided**

```ts
actions: {
	'loading':            ({ data, send }) => fetchUser(data.id, …),          // default
	'connected': persistent(({ data, send }) => subscribe(data.url, send)),   // opts out
	'cancel: draft -> *': () => track('cancelled'),
},
```

**The common case stays a bare function** and a constructor appears only at the
exception. That answers the objection to A2: constructors are not an idiom spread
across every line, they are a rare local escape hatch — which is how `data<T>()`
already works elsewhere in the API.

### The default is restart, and the wrapper opts out

This reverses the position in B3, which said the default should be _survive_.
Two reasons:

- **It fails safe.** Forgetting the wrapper under a survive-default leaves an
  activity closed over stale data — a correctness bug. Forgetting it under a
  restart-default tears something down unnecessarily — a performance bug.
- **It puts the wrapper on the rarer thing.** A fetch should restart when you
  re-enter `loading`; a long-lived socket is the exception. Marking exceptions is
  the whole point of the shape.

Naming: **`persistent`** is clearest. `keep` is shorter but collides with the
`keep`/`repeat` vocabulary from the buried self-transition propositions; `sticky`
and `stable` are vaguer.

### It makes C3 free, which is the real win

Deps do not need a second value shape — they are another wrapper:

```ts
'loading': keyed(({ id }) => id, ({ data, send }) => fetchUser(data.id, …)),
```

So the layering is not "coarse now, object values later". It is **one mechanism
that grows**: `persistent`, `keyed`, and later `once` or `debounced` are all the
same kind of thing, added without touching the block's shape.

### The wrapper returns a record, so nothing goes opaque

The cost previously listed against C2 — that a wrapper is opaque to anything
inspecting the block as data — is avoidable. Have the wrapper return the record,
not a closure:

```ts
persistent(fn)  →  { run: fn, restart: 'never' }
keyed(k, fn)    →  { run: fn, key: k }
```

A bare function is then sugar for `{ run: fn }`. **C2 is A1 with a constructor as
the ergonomic front door**: the underlying data shape is the record, the wrapper
is how it is written, inspection and extensibility both survive, and the common
case is still a bare function. That convergence is the strongest argument for
this option.

### Entry and exit need nothing extra

An earlier draft listed this as C2's one gap. It is not — the **pattern grammar
already covers it**, by pinning one end of the edge:

```ts
actions: {
	'loading':        fn,  // residency: runs while resident, teardown on leaving
	'*: * -> loading': fn,  // entry: every arrival, including re-entry
	'*: draft -> *':   fn,  // exit: every departure
	'draft -> *':      fn,  // same thing — the colon is optional
},
```

`matches` already parses colon-optional patterns
([lib.ts:233](../explorations/candidates/n2-declared-types/lib.ts:233)), so this
works today with no grammar change. It also removes the last thing C1 had over
C2, and collapses kind 4 into kind 1.

**It is consistent with restart-by-default.** `'*: draft -> *'` matches
`draft -> draft`, so an exit action fires on a self-transition — which is exactly
what re-entry means under the C2 default. The two rules agree rather than needing
reconciliation.

### The rule: bare means state, edges carry arrows

Residency wants a bare key, and the listener language already gives bare keys a
different meaning —
[`Pattern<Sp>`'s first arm](../explorations/candidates/n2-declared-types/lib.ts:138)
is `InputName<Sp>`, matched by `pattern === on`
([lib.ts:240](../explorations/candidates/n2-declared-types/lib.ts:240)). Left
alone, the same syntax would mean an input in one block and a state in the other,
and a name that is legally both — `review` is plausibly both, and the neutral
machine already has it as a state — would compile under the wrong reading with no
error.

The resolution is a single rule, not a per-block convention:

> **A key with no `->` names a state. An edge always contains an arrow — even when
> both ends are `*`.**

So `.on('submit', fn)` becomes `.on('submit: * -> *', fn)`, and
`Pattern<Sp>` loses its bare-input arm. The other two arms already contain `->`,
so nothing else changes, and **no existing call site uses the bare form** — every
`.on` in `n2` is already a full pattern or an arrow form.

**Why this beats the alternatives.** It is decidable from the string alone: you
never have to know which block you are reading. The competing fix — rejecting bare
keys that are in `StateName & InputName`, which is computable since both
vocabularies are declared — only patches the silent case and leaves two meanings
standing. And `'submit: * -> *'` is arguably better than `'submit'` regardless,
since it makes "across all edges" explicit rather than implied.

**A consequence worth noticing.** Under one shared key language, `.on()` could
also accept a bare state key and mean residency — "while we are here" — with the
same setup-and-teardown shape as an `actions` entry. That would make `.on` and
`actions` structurally identical, differing only in who owns them: the definition
versus a subscriber. Not needed now, but the rule makes it free later.

## C3 — object value carrying a key function — absorbed into C2

```ts
'loading': { run: fn, key: ({ id }) => id },
```

Restart when `key` changes. Strictly more expressive than a boolean — a constant
key means never, and a per-field key expresses "refetch when the id changes but
not when the label does". This is the reconciliation-identity problem from
[api-async-effect-free.md](api-async-effect-free.md), scoped to a single action
where it is tractable.

**Not rejected — this is the record C2's wrappers produce.** Written by hand it
costs a second value shape; written as `keyed(…)` it costs nothing. Both spellings
can be legal, with the wrapper as the documented one.

## C4 — derive it from the action's shape — rejected

If the closure reads `data`, restart on change; if it ignores `data`, it cannot go
stale. Detectable at runtime via `fn.length`. **Rejected:** destructuring makes
the arity lie, and adding a parameter during a refactor would silently change
lifetime behaviour.

## Where C lands

**C2.** The default restarts; `persistent(fn)` opts out; `keyed(k, fn)` refines;
the wrapper returns the record a hand-written object value would have been.

It keeps the `actions` key grammar to exactly the two forms A3 promised — a state
name or an edge pattern — which was A3's whole pitch and which **C1 quietly
broke** by adding entry/exit arrows as a third form. It also collapses the C1/C3
layering into one extension point: new policies are new wrappers, not new syntax
and not new value shapes.

**C1 is now fully superseded.** Its one advantage was a spelling for entry and
exit; the existing pattern grammar provides that (`'*: * -> loading'`,
`'*: draft -> *'`) without a third key form.

The combination now standing: **string keys (`n2`) + A3 + C2 + B3.**

---

# Recorded and rejected

## U — the handler performs

```ts
'load: idle -> loading': ({ input, send }) => {
	fetchUser(input.id).then((u) => send('loaded', u), () => send('failed'))
	return { id: input.id }
},
```

Zero new concepts, and what robot3, machina and every callback-based library
actually do. **Out on the concern argument** — the handler reaches three jobs —
and independently on the socket test: there is no node to hang a socket on.

## V — a `do` slot on the edge

```ts
'load: idle -> loading': {
	with: ({ input }) => ({ id: input.id }),
	do:   ({ data, send }) => fetchUser(data.id).then((u) => send('loaded', u)),
},
```

Sound (a `do` cannot fire for a losing candidate) and visible in the table, which
is genuinely better than the recommendation on visibility. **Out because the
command duplicates across every edge into the state**, and because the
transition's value becomes a function _or_ an object — a second shape in the block
that was meant to have one job. Also fails the socket test.

Worth keeping on record for one reason: it was the first non-stylistic evidence in
o1's favour on axis 1 — records absorb `do` as one more field, while string keys
and target keys grow a second value shape.

## X — listeners as the action layer

```ts
machine({ … })
	.on('cancel: draft -> *', () => track('draft.cancelled'))
	.within('loading', ({ data, send }) => { … return () => c.abort() })
```

Costs nothing in the core and passes the socket test. **Out because it moves the
whole action layer outside the definition**, keyed by glob rather than by line.

But the split is worth stating precisely, because `.on()` survives: **`actions` is
the machine's own behaviour and ships with the definition; `.on()` is a
subscription attached by whoever instantiates it.** Kind 1 — analytics, logging —
is arguably the subscriber's business, and axis 7 already settled it there.

## Y — actions as data, interpreter supplied by the caller

Handler returns `[data, description]`; the caller passes `perform`. Replayable,
mockable, cancellation structural. **Out** — this is the effect-free core, judged
to cost more than it pays: a description vocabulary, a driver, an identity rule
for reconciliation, and a tuple return taxing every handler that commands nothing.

## Z — the handler acts, multi-target returns its target

```ts
'submit: draft -> review | published': ({ data, input }) =>
	input.route === 'review' ? to.review({ … }) : to.published({ … }),
```

An attempt to make U sound by reversing the runtime instead of the API: one row
per `(input, from)`, so no losing candidate is ever called. It does dissolve axis
8 and the `skip`-ordering semantics. **Out** — it takes the handler to **four**
jobs (decide, pick the target, project, act), the diagnosis in its most
concentrated form.

## AA — cleanup via `Symbol.dispose` on the state's data

```ts
'connect: idle -> connected': ({ input }) => {
	const sock = new WebSocket(input.url)
	return { url: input.url, [Symbol.dispose]: () => sock.close() }
},
```

Elegant, and it answers re-entry by object identity, using a TC39 standard rather
than a concept of ours. **Out for the same reason as V**: the disposer must be
constructed where the data is constructed — inside the transition handler. Same
overload, better mechanism. Its identity rule is B4, rejected above for the same
reason in a different place.

## AB — the library adds nothing; actions drive the machine

```ts
async function load(m: Doc, id: string) {
	m.send('load', { id })
	try {
		m.send('loaded', await fetchUser(id))
	} catch {
		m.send('failed')
	}
}
```

The inversion — a named function beside the machine, greppable and testable, with
cancellation however you like. Not rejected so much as **the baseline this has to
beat**: it is what the code looks like with no feature at all, and the visibility
complaint largely evaporates once the function has a name.

---

## A runtime fact to fix regardless

`step` calls **losing** candidates' handlers
([lib.ts:269](../explorations/candidates/n2-declared-types/lib.ts:269)) — it tries
every row and takes the first that does not `skip()`:

```ts
const result = table[key]?.({
	data: current.data,
	input: payload,
	skip: () => SKIP,
})
if (result === SKIP) continue
```

With two rows sharing an input and source, a handler that does anything observable
does it on the transition that loses. o1's array runtime is identical. This was
originally the argument that eliminated U; it is not any more — the concern
argument is — but it remains true for all three layouts. Under this decision it is
harmless, because handlers only project. It becomes a real bug the moment any
proposition puts effects back in a handler.

## Open, and what to prototype

**Settled:** the block is `actions`, keyed by trigger (A3), values are bare
functions or wrapper results (C2), the policy belongs to the action (B3), and the
default is to restart. Paired with string keys (`n2`), the whole definition is
string-keyed maps.

**A2 was the near miss.** It reads best of the three, but it would have been the
only place in the API using constructors on every line — none of the three live
layouts has that concept. C2 recovers most of what A2 offered while confining
constructors to the exceptions.

**Closed: the bare-key conflict.** One rule — no `->` means a state, an edge always
carries an arrow — settles it across both blocks. The change is three lines:
drop `Pattern`'s bare-input arm, drop the no-arrow branch in `matches`, and admit
state names in `actions` keys. Nothing currently relies on `.on('submit')`.

**Closed: multiple actions per trigger.** A3 allows one action per key, and that
is enough — two activities in one state compose into a single function that starts
both and returns a combined teardown. Array values stay available later as a pure
widening if that ever reads badly, but it is not a limitation worth designing
around now.

**Closed: merging the state declaration.** The idea was that
`actions` names states a second time, and declaring each state once with its data
type _and_ its behaviour (`d1`'s shape) would remove the repetition — at the cost
of reviving the marker-call `any`-leak that `types<>` solved. It no longer
applies: `actions` is keyed by **trigger**, not by state, and
`'cancel: draft -> *'` has no home in a per-state block. Only the residency subset
could ever merge, which is not worth splitting the block for.

The prototype: `actions` on `n2` — keys checked against the declared state names
and the pattern grammar, teardown on leaving, `persistent` and `keyed` as the two
wrappers, exercised against a self-transition that changes resident data.
