# Axis 9 — five ways to express work-in-flight

API only. No types, no implementation, no feasibility claims — those come after
one or two of these are worth the effort.

## The running example

Small, and it exercises both halves of the problem at once:

```ts
states: { idle: void; loading: { id: string }; ready: { user: User }; failed: void }
inputs: { load: { id: string }; loaded: User; failed: void; timeout: void; retry: void }

'load:    idle    -> loading'
'loaded:  loading -> ready'
'failed:  loading -> failed'
'timeout: loading -> failed'
'retry:   failed  -> loading'
```

Three things must land somewhere: a **fetch** starts on entering `loading`, a
**5 s timeout** races it, and both must stop on the way out.

Recall the seam from the propositions doc: a fetch is a **`Cmd`** (one-shot,
started by a transition), a timer is a **`Sub`** (continuous, alive while
resident). Every option below is really a different answer to *where the
lifetime lives*.

And each must answer the question axis 4 was deleted for: **on
`loading -> loading`, does the clock restart?** A countdown is the first thing
that makes residency observable, so this is no longer a philosophical question.

---

## A — `within`: an effect with a cleanup

```ts
machine
	.on('loaded: loading -> ready', (e) => track('load.ok', e.input))
	.within('loading', ({ data, send }) => {
		const ctrl = new AbortController()
		fetchUser(data.id, { signal: ctrl.signal })
			.then((u) => send('loaded', u))
			.catch(() => send('failed'))

		const t = setTimeout(() => send('timeout'), 5_000)

		return () => {
			ctrl.abort()
			clearTimeout(t)
		}
	})
```

**The good.** Setup and teardown are **lexically paired** — the cleanup closes
over `ctrl` and `t`, so the correlation no library could check becomes one no
author can break. Two listener callbacks (`-> loading` and `loading ->`) can
drift; this cannot.

It is also a genuine **dual to `on`**, and that is the strongest thing about it:

| method   | keyed by | answers                            |
| -------- | -------- | ---------------------------------- |
| `on`     | edges    | "what happens when this happens?"  |
| `within` | nodes    | "what is true while we are here?"  |

Two methods, no other vocabulary, and every reader already knows the shape from
`useEffect`. It is also **escape-hatch complete** — anything expressible at all
is expressible here.

**The cost.** It is **opaque**. Nothing outside that closure knows `loading` has
a 5 s timeout: not a reader, not a devtool, not a diagram. For a project whose
thesis is *the definition is the documentation*, this relocates the visibility
problem into the library's API rather than solving it. Grep `-> failed` and you
find the `timeout` edge, but nothing says it fires by itself.

It is also imperative — the same abort/clear wiring is retyped per state.

**Re-entry:** needs an explicit rule, and `useEffect`'s answer (dependencies)
does not transfer. Simplest defensible rule: **cleanup runs and the effect
re-runs on any transition that leaves the state, self-transitions included.**
One sentence, no keyword — but it does mean `loading -> loading` restarts the
fetch, which may surprise.

---

## B — the trigger on the edge

Put the automatic-ness in the table, where the edge already is:

```ts
transitions: {
	'load:    idle    -> loading': ({ input }) => ({ id: input.id }),
	'timeout: loading -> failed':  after('5s'),
	'loaded:  loading -> ready':   ({ input }) => ({ user: input }),
	'retry:   failed  -> loading': () => …,
}
```

**The good.** **Best visibility of any option, by a distance.** The complaint
that started this axis was "the table shows `timeout: loading -> failed` but not
that it is automatic." Here it does, on the same line, and grep still finds it.
No second declaration site — the one-table property that won axis 1 survives
intact.

**Re-entry answers itself.** The trigger belongs to the source state's
residency, so entering `loading` starts the clock and leaving it stops the
clock. One rule, stated once, no per-edge keyword — which is exactly what the
propositions doc predicted the right shape would be.

**The cost.** It only expresses **self-triggering** edges. A fetch does not fit:
it must be *started*, and it *carries a payload*. Stretching it —

```ts
'loaded: loading -> ready': when(({ data }) => fetchUser(data.id)),
```

— makes one function both **source the input and project the target data**, two
jobs whose payload type is then determined twice. Muddy.

So B is not a complete answer. It is an excellent answer for timers and polls,
and needs a partner for everything else.

---

## C — declarative resources, per state

Declare *what runs*, not how to start and stop it:

```ts
while: {
	loading: [
		timeout('5s', 'timeout'),
		request(({ data }) => fetchUser(data.id), { ok: 'loaded', err: 'failed' }),
	],
	connected: [socket(URL, 'message')],
}
```

**The good.** The library owns every lifetime, so cancellation is not something
an author can forget — it is not something an author *writes*. Resources are
**values**: nameable, reusable across states, composable, and above all
**mockable** — swap `request` for a fake and the machine is testable with no
clock and no network. And it is **inspectable**: a devtool can list what is live
in `loading` without reading anyone's closure, which is the exact thing A
cannot do.

**The cost.** A whole **resource vocabulary** to design, learn, and maintain —
`timeout`, `interval`, `request`, `socket`, `poll`, and the escape hatch for
everything not yet covered. That escape hatch will be `within` (option A), so C
is realistically A *plus* a vocabulary, not an alternative to it.

Second declaration site, in tension with the one-table property.

**Re-entry:** each resource kind can answer for itself, declaratively —
`timeout('5s', 'timeout', { restart: 'always' | 'on-reentry' | 'never' })`. This
is the only option where the answer can differ per resource, which may be the
honest answer.

---

## D — the input declares its own source

Nobody has built this. The scope is not declared anywhere — it is **derived from
the table**.

```ts
inputs: {
	load:    payload<{ id: string }>(),
	retry:   payload<void>(),
	timeout: from.timer('5s'),
	loaded:  from.promise(({ data }) => fetchUser(data.id)),
	failed:  from.rejectionOf('loaded'),
}
```

**The good.** **Zero duplication of the topology.** `timeout` is live in exactly
the states that handle `timeout`, and the table already says which those are —
`Handled<T, 'loading'>` computes it today. No `while:` block listing states a
second time, no chance of the list drifting from the table.

It also puts the answer where the question is asked: *"where does `timeout` come
from?"* is answered at the single place `timeout` is defined, once, for the
whole machine.

**The cost.** **One source per input, globally.** A 5 s timeout in `loading` and
a 30 s one in `retrying` needs two input names. That may be a feature —
`timeout` and `slowRetryTimeout` are arguably different events — but it will
chafe.

**Re-entry is genuinely ambiguous**, and worse than in the other options. If
`loading` and `retrying` both handle `timeout`, does the clock reset on
`loading -> retrying`? Residency of *what*? The scope is a set of states, not a
state, so "leaving" is not well defined. There is a rule to be found here, but
it is not obvious, and that is the risk that makes this the research bet.

---

## E — async handlers, and no new concept at all

The handler is `async`. That is the entire proposal.

```ts
transitions: {
	'load: idle -> loading -> ready': async ({ input, signal }) => ({
		user: await fetchUser(input.id, { signal }),
	}),
}
```

The three-part key is load-bearing: **`loading` is the state we occupy while the
promise is pending.** Naming it keeps the project's core property — every state
the machine can be in appears in the table — and it defines cancellation
exactly: `signal` aborts when we leave `loading`, by any route, including a
`timeout` edge declared normally elsewhere.

**The good.** **No new vocabulary whatsoever.** No `within`, no `while`, no
resource constructors, no `from`. You write `async` and name the middle state.
One line expresses start, pending, and success — the most compact expression of
the happy path any of these options manages, and it reads almost like prose.

**The cost.** **The error path is bad.** Where does a rejection go? A companion
`'load: idle -> loading -> failed'` key is odd — two edges from one call, and
nothing pairs them. Overloading `skip()` conflates "decline this transition"
with "the work failed." Throwing leaves the machine somewhere unnamed. Every fix
adds back the vocabulary the option exists to avoid.

It also only covers `Cmd`. A socket has no single resolution, so `Sub` still
needs one of A–D. And a three-part key is a second key grammar to learn and to
grep.

**Re-entry:** not applicable — the async call is scoped to one transition, not
to residency. That is why it cannot express `Sub`.

---

## Side by side

|                              | A `within`   | B on the edge | C resources  | D input source | E async      |
| ---------------------------- | ------------ | ------------- | ------------ | -------------- | ------------ |
| lifetime owned by            | author       | library       | library      | library        | library      |
| visible in the table         | ✗            | **✓✓**        | ✗            | ✗              | **✓**        |
| second declaration site      | yes          | **no**        | yes          | (in `inputs`)  | **no**       |
| expresses `Cmd` (fetch)      | ✓            | ✗             | ✓            | ✓              | ✓            |
| expresses `Sub` (socket)     | ✓            | ✓             | ✓            | ✓              | **✗**        |
| new vocabulary               | 1 method     | 1 combinator  | **a library**| 1 namespace    | **none**     |
| mockable without a clock     | ✗            | ✓             | **✓✓**       | ✓              | ✗            |
| inspectable by tooling       | ✗            | **✓**         | **✓**        | ✓              | ✓            |
| re-entry answer              | one rule     | **falls out** | per resource | **unclear**    | n/a          |
| escape-hatch complete        | **✓**        | ✗             | via A        | ✗              | ✗            |

## Where this points

**A + B is the pair worth building.** They fail in opposite directions and cost
almost nothing together: B makes the common, most-invisible case — a timer —
visible on the line where the edge already lives, answering re-entry for free;
A catches everything else with one familiar method and a lexically paired
cleanup. Two additions to the API, no resource library.

**C is where you end up if resources multiply.** It is strictly better than A
for anything it covers — mockable, inspectable, cancellation-by-construction —
but it is A plus a vocabulary, so it should be grown into, not designed up
front. If three `within` blocks in real code turn out to be the same shape, that
shape is the first resource constructor.

**D is the research bet.** Deriving scope from the table instead of restating it
is the only idea here that no existing library has, and it is the only one that
cannot drift from the topology. It also has the weakest answer to re-entry, and
that may be fatal. Worth one prototype before it is believed.

**E is a trap worth naming.** The happy path is the best-reading code on this
page, which is exactly why it is dangerous: the error path is where async
actually lives, and every repair reintroduces the vocabulary the option was
chosen to avoid.

**Note what none of them fix.** All five leave the fetch *running* when you
abort — `signal` stops the machine from caring, not the server from working. And
the stale-response guarantee is unchanged and already in hand: a late `loaded`
matches no row and returns `{ kind: 'none', reason: 'unavailable' }`.
