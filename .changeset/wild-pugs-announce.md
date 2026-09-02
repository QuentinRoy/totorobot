---
'totorobot': minor
---

A machine can now declare a fourth vocabulary, `outputs`, naming what it
announces separately from what it is. An action reaches it through `emit`, the
way it already reaches inputs through `send`, and a consumer subscribes by name
with `on`:

```ts
const menu = machine({
	initial: 'idle',
	inputs: type<{ press: { at: Point }; release: undefined }>(),
	states: type<{ idle: undefined; open: { at: Point } }>(),
	outputs: type<{ opened: { center: Point }; ended: undefined }>(),
	transitions: {
		'idle -press> open': ({ inputData }) => ({ at: inputData.at }),
		'open -release> idle': () => {},
	},
	actions: {
		open: ({ toData, emit }) => emit('opened', { center: toData.at }),
		'open -release> idle': ({ emit }) => emit('ended'),
	},
})

menu.start().on('opened', ({ data }) => widget.show(data.center))
```

The listener is handed `{ output, data, send }` and runs at the `emit` call, in
registration order. A send it makes is queued like any other send, including
from an `emit` that a residency action captured and called from a timer, so a
listener is never re-entered by one. `on` returns an unsubscribe function,
idempotent like `observe`'s.

`emit` is available in `actions` only. A `transitions` handler may `skip()`, so
one that emitted would announce a hop that then loses, and an `observe` callback
is outside the machine. Emitting an undeclared name, subscribing to one, or
getting a payload wrong are compile errors.

Also exported: `OutputsOf<MachineType>` and `Listener<MachineType, OutputName>`, beside the existing
`InputsOf`, `StatesOf` and `Observer`. A machine that declares no `outputs`
type-checks exactly as before and needs no edits.
