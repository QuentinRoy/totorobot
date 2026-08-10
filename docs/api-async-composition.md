# Axis 9, composition — "a promise is a state machine"

API only. Sketches, not proposals-with-types.

A promise is `pending -> fulfilled | rejected`. A socket is
`connecting -> open -> closed`. A timer is `waiting -> fired`. A form is a
machine, a wizard is a machine, an upload is a machine. If in-flight work is
already a machine, the library does not need an async vocabulary — it needs
**one way to embed a machine in a state**, and async comes free.

That is the whole idea. It is worth taking seriously because composition is
something you want anyway: reusable fragments, submachines, a `retry` wrapper
you write once.

## What it actually buys — and the limit

**Buys:** the vocabulary stops growing. Option C in
[api-async.md](api-async.md) needed `timeout`, `interval`, `request`, `socket`,
`poll`, each a bespoke API surface. Here they are all **machines written in the
notation we already have**, shipped in a standard library rather than the core.
A user who needs `webSocketWithBackoff` writes it; they do not petition for it.

Testing follows: a child is tested like any machine, and mocking is swapping one
value for another.

**The limit, stated up front:** composition **relocates the effect boundary, it
does not remove it.** At the bottom of every tree is a leaf that really calls
`fetch`. "A promise is a state machine" describes its *shape*, not its
*execution*. So this collapses N vocabulary items into **one** primitive — not
zero. Any pitch that claims otherwise is hiding the leaf.

> **Correction — see [api-async-effect-free.md](api-async-effect-free.md).** The
> sentence above is true of composition *alone*, but it made the wrong
> conclusion sound inevitable. Something must call `fetch`; that something need
> not live **inside the library**. Every `invoke`/`within` shape below puts
> IO-performing closures in the definition and therefore requires the library to
> grow a scheduler. Describing effects as **data** and letting a driver outside
> reconcile them keeps the engine pure and makes cancellation structural. Read
> both documents together — that one supersedes this limit.

## Prior art: robot3 already does this

Worth reading before designing anything — robot3 implements the insight
literally, in about 40 lines. `invoke(fn, ...transitions)` replaces `state(...)`
for that state, and unifies promises with machines at construction *and* at
runtime (`node_modules/robot3/machine.js:84`):

```js
let rn = this.fn.call(service, service.context, event)
if (machine.isPrototypeOf(rn))
	return create(invokeMachineType, {…}).enter(machine2, service, event)
rn.then(data => { if (machine2 === service.machine) service.send({ type: 'done', data }) })
  .catch(error => { if (machine2 === service.machine) service.send({ type: 'error', error }) })
```

A promise-returning function, a machine, or a function returning a machine — one
construct, dispatched on what turns up. Terminals become events: `done` / `error`
for promises, `done` with the child's context when a child reaches a final state
(`final` is `args.length === 0`, a state with no transitions).

Three findings:

1. **No cancellation, and no cleanup hook at all.** The identity check
   `machine2 === service.machine` is the whole staleness story, and
   `transitionTo` never touches `service.child`. Leaving an invoking state
   **abandons** the work rather than stopping it. A shipping 1.2 KB library
   accepted that trade — evidence the "ignore the result, do not cancel the
   work" position is liveable.
2. **No timer, interval, socket or poll vocabulary exists.** A timeout is
   `invoke(() => new Promise(r => setTimeout(r, 5000)))`. Empirical support for
   the thesis above: one primitive really was enough.
3. **It mounts the child at the state — and we cannot.** robot3's states are
   **values** (`loading: invoke(…)` in the states map), so the mount has an
   obvious home. Our states are **types**, declared in `types<>`, so there is no
   value-level slot to hang it on. This is a real consequence of the
   declared-vocabulary decision and it is exactly why G needs a `run:` block and
   H needs derivation. The obvious placement is closed to us.

Where our shape can beat it: fixed `done` / `error` names do not say *what*
finished — `transition('done', 'loaded')` reads worse than
`'loading.ok: loading -> ready'` — and robot3 allows only one invoke per state.

---

# Part 1 — building the child

## The leaf primitive

Exactly one thing connects a machine to the world:

```ts
const delay = (ms: number) =>
	external<void, void>(({ done }) => {
		const t = setTimeout(done, ms)
		return () => clearTimeout(t)
	})

const fromPromise = <In, Out>(fn: (input: In) => Promise<Out>) =>
	external<In, Out>(({ input, done, fail }) => {
		const c = new AbortController()
		fn({ ...input, signal: c.signal }).then(done, fail)
		return () => c.abort()
	})
```

**Note what this is: it is option A.** `within`'s effect-with-a-cleanup shape was
never wrong — it was at the wrong altitude. As the everyday API it is retyped per
state and opaque to tooling. As **the leaf you write once per kind of work**, its
lexical setup/teardown pairing is exactly right, and almost no application author
ever touches it.

So the child is just:

```ts
const fetchUser = fromPromise((i: { id: string }) => api.user(i.id))
// a machine: pending -> fulfilled(User) | rejected(Error)
```

## Combinators

Promise combinators have machine analogues, and this is where composition earns
its keep. Naming the branches is what makes them read:

```ts
const loadUser = race({
	ok: fetchUser,
	late: delay('5s'),
})
// terminals: ok(User) | late | rejected(Error)

const bootstrap = all({
	user: fetchUser,
	prefs: fetchPrefs,
})
// terminal: done({ user, prefs })

const resilient = retry(fetchUser, { times: 3, backoff: '200ms' })
```

`retry` is the case that sells it. In every option in
[api-async.md](api-async.md), retry-with-backoff is bespoke code in a closure.
Here it is a machine that wraps a machine, written once, and it works on
anything — a fetch, a socket handshake, a child wizard.

**This part is orthogonal to everything in Part 2.** How you build a child and
how you mount it are independent choices.

---

# Part 2 — mounting the child

Three genuinely different answers to *where the child's lifetime is declared*.

## F — the state contains the machine (hierarchical)

Harel statecharts. The child's current state **is** the parent state's data.

```ts
states: {
	idle: void,
	loading: sub(loadUser),
	ready: { user: User },
}
```

**The good.** The most expressive, and the most standard — this is what SCXML and
XState mean by nesting. Parallel regions, deep history, and hierarchical
"cancel everything below" fall out. If the domain is genuinely hierarchical, no
flat notation will ever be as honest.

**The cost, and it is disqualifying for now.** The key grammar becomes **paths**.
`'loading.ok: loading -> ready'` is a third grammar to learn on top of the key
language and the pattern language; `Handled` and `Sources` become recursive; the
arrow test dies; grep stops being one hop. **Every axis-1 decision would be
re-litigated.** That is a different project, not a feature.

## G — an explicit mount block

```ts
run: {
	loading: loadUser.with(({ data }) => ({ id: data.id })),
},
transitions: {
	'load: idle -> loading': ({ input }) => ({ id: input.id }),

	'loading.ok:       loading -> ready':  ({ input }) => ({ user: input }),
	'loading.late:     loading -> failed': () => {},
	'loading.rejected: loading -> failed': () => {},
}
```

The child runs exactly while `loading` is current. Its terminal states surface as
inputs namespaced by **mount point**, not by child name — so the same machine can
be mounted twice without collision.

**The good.** **Every transition is still in the table.** Grep `-> failed` finds
both ways in, and `loading.` prefixes make it obvious at a glance which inputs
arrive on their own rather than from a user. The mount block is one line per
state; the one-table property survives nearly intact.

**Re-entry is unambiguous and needs no keyword:** the child is torn down when
`loading` is left and started when it is entered, so `loading -> loading`
restarts it. Same rule as option B, for the same reason — residency of a single
named state is well defined.

**The cost.** A second declaration site, small but real. And the child's internal
states are invisible in the parent (`loading.ok` is visible, `pending` is not) —
correct encapsulation, but a devtool has to walk the tree to show what is
actually happening.

## H — mounting derived from the table

No mount block. The child is named in the input vocabulary and runs wherever its
inputs are handled.

```ts
inputs: {
	load: payload<{ id: string }>(),
	user: loadUser.from(({ data }) => ({ id: data.id })),
},
transitions: {
	'user.ok:       loading -> ready':  ({ input }) => ({ user: input }),
	'user.rejected: loading -> failed': () => {},
}
```

`user` is live in exactly the states that handle `user.*`, and the table already
says which those are.

**The good.** **The mount list cannot drift from the topology, because there is no
mount list.** This is the only shape here — and, with option D, the only shape
anywhere in this axis — where the scope is derived rather than restated. Delete
the last `user.*` transition and the child stops being mounted, automatically.

**The cost, unchanged from D and still the risk.** The scope is a **set** of
states, so "leaving" is not well defined: if `loading` and `retrying` both handle
`user.*`, does the child survive `loading -> retrying`, or restart? Both answers
are defensible, which is the problem. And `.from(({ data }) => …)` reads a `data`
whose type is the union of every state it might be mounted in.

---

## Side by side

|                             | F hierarchical | G mount block | H derived    |
| --------------------------- | -------------- | ------------- | ------------ |
| transitions stay in table   | paths          | **✓**         | **✓**        |
| second declaration site     | (states)       | small         | **none**     |
| scope can drift from table  | n/a            | yes           | **no**       |
| re-entry answer             | standard       | **falls out** | **unclear**  |
| new grammar to learn        | **paths**      | `mount.term`  | `child.term` |
| re-opens axis 1             | **yes**        | no            | no           |

## Where this points

**G, with Part 1 underneath it.** The leaf primitive plus `fromPromise` plus
`race`/`all`/`retry` is the part that carries the value, and it is independent of
mounting; `G` is the cheapest mounting that keeps every transition in the table
and answers re-entry for free.

**H stays the research bet**, now for the second time — same idea as D, same
single unresolved question. If someone finds a defensible rule for leaving a
*set* of states, H is strictly better than G. Worth one prototype, not a
commitment.

**F is a different library.** Revisit only if real machines turn out to be
genuinely hierarchical, and expect axis 1 to reopen when they do.

## What composition does to the earlier options

- **A (`within`) survives, demoted.** It becomes the leaf primitive — written
  once per kind of work, not once per state. That is a better job for it.
- **C (resource vocabulary) is obsoleted.** Its resources become library
  machines. This is the clear win of the composition framing.
- **B (`after('5s')` on the edge) is now redundant but still better.**
  `race({ ok: fetch, late: delay('5s') })` expresses a timeout, but for a plain
  one-line timeout `'timeout: loading -> failed': after('5s')` reads better than
  mounting a machine to wait. Worth keeping both, and worth being suspicious of
  that instinct — two ways to write a timeout is exactly how vocabularies start
  growing again.
- **E (async handlers) is unaffected and still trapped by its error path.**
