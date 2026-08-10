# Axis 9 — keeping the engine effect-free

API only.

## The correction

[api-async-composition.md](api-async-composition.md) says composition
"relocates the effect boundary, it does not remove it." That is true of
composition *alone*, and it made the wrong thing sound inevitable. It is not.

Two claims were running together:

1. **Something, somewhere, must call `fetch`.** True, unavoidable, uninteresting.
2. **That something must live inside the library.** **False** — and this is the
   one that matters.

**You already have an effect-free engine.** `step(machine, current, input)` is a
pure function returning a `Step`. Nothing in `n2` or `o1` performs an effect.

What would take it away is exactly what the last two documents proposed:
`within(fn)` and `invoke(fn)` put **closures that perform IO inside the machine
definition**, and then the library needs a scheduler to call them, track their
lifetimes, and cancel them. That scheduler is the effectful runtime you did not
want. robot3 has one; that is what its `service` is.

The alternative is the one Elm ships: **the machine computes a *description* of
what should be running, and something outside makes reality match it.**

## The mechanism: reconciliation

```
desired = subscriptions(currentState)     // pure, part of the machine
actual  = what the driver has running     // impure, outside
diff → start the new, stop the departed
```

Two consequences worth being explicit about, because they are the whole payoff:

- **Cancellation stops being something anyone writes.** Leaving `loading` means
  `loading`'s resources are no longer in `desired`, so the driver stops them. No
  cleanup return, no `AbortController` in user code, no forgotten `clearTimeout`.
  It is structural.
- **The machine stays serialisable.** Descriptions are data, so state can be
  snapshotted, replayed, and time-travelled. Closures cannot.

The hidden cost, named up front: **reconciliation needs identity.** Is
`{ fetch, id: 1 }` followed by `{ fetch, id: 2 }` one resource restarted, or one
stopped and another started? React answers with `key`, Elm with structural
equality. Whatever we do, that question has to be answered, and it is the real
complexity here — not the diffing.

---

## P — do nothing

The engine is already pure. Ship no async at all. Users call `send()` when their
promise resolves.

```ts
const s = step(m, current, 'load', { id })
fetchUser(id).then((u) => send('loaded', u))
```

**The good.** Zero API, zero risk, purity by construction. Staleness is already
handled — a late `loaded` matches no row and returns `unavailable`. And the
decision is **reversible**: every option below can be added later without
breaking this one.

**The cost.** The visibility problem, permanently: nothing says `timeout` fires
by itself. Everyone reimplements cancellation, badly. This is a defensible v1
and a bad v3.

## Q — subscriptions in the definition, as data

The `while:` block from option C, but the entries are **descriptions, not
closures**:

```ts
while: {
	loading: ({ id }) => [
		request({ url: `/u/${id}` }, { ok: 'loaded', err: 'failed' }),
		timer('5s', 'timeout'),
	],
	connected: () => [socket(URL, 'message')],
}
```

`request(…)` returns a plain object. It does not fetch. The function from state
data to descriptions is pure and directly testable:

```ts
expect(desired({ state: 'loading', data: { id: 7 } })).toEqual([…])
```

**The good.** Engine stays pure — it computes `desired` and hands it over.
Cancellation is structural. Descriptions are inspectable, so a devtool can show
what is live without reading anyone's closure, which was A's flaw. And the
driver is **swappable**: the test driver records descriptions and never touches
the network, so there is no clock and no mocking.

**The cost.** A **description vocabulary** to design and version — `request`,
`timer`, `socket`, `poll` — plus the driver that interprets each. This is the
vocabulary-growth problem again, now with a serialisation format attached.
Second declaration site.

## R — the desired-resources function lives outside the machine

Same idea as Q, but the mapping is **not part of the definition**. It is an
ordinary function of state that the caller supplies:

```ts
// the machine knows nothing about any of this
const resources = byState({
	loading: ({ id }) => [request(`/u/${id}`, { ok: 'loaded', err: 'failed' })],
	connected: () => [socket(URL, 'message')],
})

run(machine, { resources, driver: browserDriver })
```

**The good.** **The core gains nothing at all.** No `while:`, no `run:`, no
`invoke`, no new key grammar — the machine definition is untouched and the
engine is unchanged. `resources` is a plain function, so it composes, wraps, and
tests like any other value, and different callers can supply different ones
(server-rendered vs browser, real vs simulated).

Above all it preserves what won axis 1: **the transition table stays the whole
definition.** Q's `while:` block competes with it; this does not exist inside it.

**The cost.** State names appear in a second place with **nothing checking the
correspondence** — delete a state and `resources` silently keeps a dead entry.
And it is the worst option for visibility: the answer to "what starts the fetch"
is now in a different file entirely, with no `loading.` prefix in the table to
hint that anything is coming.

## S — handlers return data *and* commands

Elm's `update`. The `Cmd` half, as a pure return value:

```ts
'load: idle -> loading': ({ input }) => [
	{ id: input.id },
	request(`/u/${input.id}`, { ok: 'loaded', err: 'failed' }),
],
```

**The good.** The command is **co-located with the transition that causes it** —
the visibility complaint, answered in the table, with no new key grammar. The
handler stays pure: it returns a description, it does not perform anything.

**The cost.** Every handler's return type becomes "data, or a tuple of data and
commands," which is a tax on the 90% of transitions that command nothing. This
is `emit` again — and worth being precise, because **axis 7 does not settle
this.** That decision was about *outgoing notifications* (`notify`, `track`),
which a listener genuinely can recover from `{ on, input, from, to }`.
**Starting work is not recoverable that way**, so the redundancy argument does
not transfer. If S is ever adopted, it reopens axis 7 on new evidence rather
than contradicting it.

Also: S is `Cmd` only. A socket still needs Q or R.

## T — generators yielding descriptions

```ts
'load: idle -> ready': function* ({ input }) {
	const user = yield request(`/u/${input.id}`)
	return { user }
},
```

The handler yields a description, the interpreter performs it and resumes with
the result. Pure until run — a generator that is never driven does nothing.

**The good.** Sequential async reads sequentially, which nothing else here
manages. Multi-step flows (fetch, then fetch again, then commit) stay one
readable unit instead of four states.

**The cost.** **It hides states.** Each `yield` is a state the machine is really
in and the table does not name — directly against the property that every state
is in the table. Cancellation mid-generator, and what happens on re-entry, are
both new questions. And a generator is not a `(data, input) -> data` function,
so it is a second handler kind.

---

## Side by side

|                             | P nothing | Q `while:` data | R outside   | S return cmds | T generators |
| --------------------------- | --------- | --------------- | ----------- | ------------- | ------------ |
| engine stays pure           | **✓**     | **✓**           | **✓**       | **✓**         | **✓**        |
| core API added              | **none**  | `while:`        | **none**    | tuple return  | new handler  |
| cancellation structural     | ✗         | **✓**           | **✓**       | ✗ (`Cmd`)     | ✗            |
| visible in/near the table   | ✗         | ✓               | **✗✗**      | **✓✓**        | ✓            |
| drift from state names      | n/a       | checked         | **unchecked**| checked      | checked      |
| needs a description vocab   | no        | **yes**         | user's own  | **yes**       | **yes**      |
| expresses `Sub` (socket)    | manual    | **✓**           | **✓**       | ✗             | ✗            |
| serialisable / replayable   | ✓         | **✓**           | **✓**       | **✓**         | ✗            |

## Where this points

**P now, R as the shape it grows into.** P costs nothing and is fully
reversible, which matters while axis 1 is barely settled. R is the version that
respects the constraint hardest: the engine never learns what an effect is, the
table stays the whole definition, and the driver is a value the caller chooses.
Its weakness — unchecked drift between state names and the `resources` map — is
the one thing types can plausibly fix, and that is worth a prototype before
anything else here.

**Q is R with the map moved inside**, buying a checked correspondence and
paying a second declaration site. Decide between them on whether the drift
actually bites.

**S is worth keeping in view for `Cmd` specifically**, and is the only option
that puts "this transition starts a fetch" on the line where the transition
already is. It reopens axis 7 legitimately, since that decision only ever
covered observation.

**T is a different library**, and it hides states — which this project cannot
afford.

**What changes in the composition document:** child machines are compatible with
all of this. A child is just another description — `{ machine: fetchUser, input }`
— and the driver interprets it by running an interpreter. Composition and
effects-as-data are not rivals; effects-as-data is what keeps composition from
dragging a scheduler into the core.
