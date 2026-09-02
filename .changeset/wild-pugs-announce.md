---
'totorobot': minor
---

A machine can now declare a fourth vocabulary, `outputs`, naming what it
announces separately from what it is. An action reaches it through `emit`, the
way a handler already reaches inputs through `send`, and a consumer subscribes
by name with `on`:

```ts
const menu = machine({
	initial: 'idle',
	inputs: type<{ press: { at: Point }; release: undefined }>(),
	states: type<{
		idle: undefined
		startup: { at: Point }
		novice: { at: Point }
	}>(),
	outputs: type<{ opened: { center: Point }; ended: undefined }>(),
	transitions: {
		'idle -press> startup': ({ inputData }) => ({ at: inputData.at }),
		'startup -release> idle': () => {},
	},
	actions: {
		novice: {
			run: ({ toData, emit }) => emit('opened', { center: toData.at }),
			restart: false,
		},
	},
})

menu.start().on('opened', ({ data }) => widget.show(data.center))
```

The listener is handed `{ output, data, send }` and runs inline at the `emit`
call, in registration order, with a send of its own queued under the same drain
every other send uses. `on` returns an unsubscribe function, idempotent like
`observe`'s. Emitting an undeclared name, subscribing to one, forgetting a
declared payload, or supplying one an output does not declare are all compile
errors.

`emit` is available in `actions` only. A `transitions` handler may `skip()`, so
one that emitted would announce a hop that then loses; an `observe` callback is
outside the machine. Outputs emitted during `start()` reach nobody, since no
`on` call can have happened yet, and nothing is replayed.

Nothing is hidden and nothing is withdrawn: `current` stays readable and
`observe` still sees every transition. A machine that declares no `outputs`
type-checks exactly as before and needs no edits.

Also exported: `OutputsOf<M>` and `Listener<M, N>`, beside the existing
`InputsOf`, `StatesOf` and `Observer`.

The channel costs 162 bytes raw, 65 gzipped and 76 brotli: `pnpm size` goes
from 1,580 to 1,742 B raw, 867 to 932 B gzipped, and 797 to 873 B brotli. Two
listener stores were built and measured. The flat array that shipped beat the
keyed one by 25 raw and 3 gzipped bytes and lost it by 9 brotli, so raw and
gzip decided, with the flat array's identity-keyed unsubscribe and its reuse of
the existing observer idiom breaking the near-tie.
