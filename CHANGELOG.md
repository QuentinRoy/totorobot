# totorobot

## 2.1.1

### Size

`dist/totorobot.js` — brotli 818 B (no change vs 2.1.0), gzip 881 B, raw 1,633 B

### Patch Changes

- [#137](https://github.com/QuentinRoy/totorobot/pull/137) [`a419306`](https://github.com/QuentinRoy/totorobot/commit/a41930639044bac4f93b9237d6eaeeb34eff91e5) - `Machine` and `Host` (what `machine()` and its `start()` method return) are now exported, so a consumer can name them. Before this, exporting a machine (`export const m = machine({...})`) failed a `tsc --declaration` build with `TS4023`.

  `--isolatedDeclarations` still requires writing it out by hand: `const m: Machine<Inputs, States, Keys, InitialState, Outputs> = machine({...})`.

## 2.1.0

### Size

`dist/totorobot.js` — brotli 818 B (+21 B, +2.6% vs 2.0.0), gzip 881 B, raw 1,633 B

### Minor Changes

- [#129](https://github.com/QuentinRoy/totorobot/pull/129) [`6d4710a`](https://github.com/QuentinRoy/totorobot/commit/6d4710a10cbf6359b24fefbdd340107b1838d49f) - A machine can now declare a fourth vocabulary, `outputs`, naming what it
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

## 2.0.0

### Size

`dist/totorobot.js` — brotli 797 B (+217 B, +37.4% vs 1.0.1), gzip 867 B, raw 1,580 B

### Major Changes

- [#107](https://github.com/QuentinRoy/totorobot/pull/107) [`64be8d0`](https://github.com/QuentinRoy/totorobot/commit/64be8d04edde29390342fa7a93b4aed06c0b745b) - Input names are now top-level discriminants in transition records. In actions
  and observers, checking `input` narrows the full record, including `from`, `to`,
  and `inputData`. Separate names and data also make sends easier to read.

  Change `type Inputs = { type: 'open'; text: string } | { type: 'close' }` to
  `type Inputs = { open: { text: string }; close: undefined }`. Replace
  `send({ type: 'open', text })` with `send('open', { text })`. In callbacks,
  replace `input.type` with `input` and read payload fields from `inputData`.

  An empty input name no longer dispatches an immediate transition.

- [#109](https://github.com/QuentinRoy/totorobot/pull/109) [`a6ee97e`](https://github.com/QuentinRoy/totorobot/commit/a6ee97e6b025d171b8fd4983d40adc216b65c1f7) - State names are now top-level too, so a state vocabulary is a name-to-payload
  map like the input one, and every callback record is flat: `input`, `inputData`,
  `from`, `fromData`, `to`, `toData`. Checking a name narrows the payload beside
  it, in a record and in `host.current` alike.

  Change `type States = { name: 'empty' } | { name: 'draft'; text: string }` to
  `type States = { empty: undefined; draft: { text: string } }`. Read
  `host.current.data` rather than fields on `host.current`, and `fromData` rather
  than `state` in a handler. A handler returns only the destination's payload;
  the destination name comes from the row, not from that value, so a payload
  with its own `name` or `type` field is never confused with it. A restart
  predicate takes one record of the same six facts instead of two states.

  Payloads are stored as supplied, so any value works (including a primitive, a
  function, or an object with its own `name` or `type` field), and mutating one
  is visible through older snapshots. A destination that carries nothing takes a
  handler with an empty body; `{}` is no longer accepted for one.

- [#112](https://github.com/QuentinRoy/totorobot/pull/112) [`8e4d61f`](https://github.com/QuentinRoy/totorobot/commit/8e4d61fc80f1aa5037df40a54d1aa739755d583c) - Transition record types now include only combinations declared in `transitions`.
  They no longer include sources, inputs, or destinations that the machine cannot
  use at runtime.

  This is a breaking type change. Remove checks for impossible combinations, or
  add the corresponding transition when it is valid. Remove a `restart` predicate
  from a state without a self-transition, or add that self-transition. An action
  registered for a noninitial state no longer receives `from: undefined`; an
  `observe` handler registered with a bare state key can still receive it when it
  starts observing a state that is already occupied.

- [#114](https://github.com/QuentinRoy/totorobot/pull/114) [`ea40137`](https://github.com/QuentinRoy/totorobot/commit/ea40137eac0b7ce0cbdeb8375c8c2b7fa7aeab97) - A pattern or trigger that matches no declared row is now a type error instead
  of an observer typed with `never`.

  This is a breaking type change. Add the missing row, or remove the
  registration. It checks table membership, not reachability, so a row that is
  unreachable from `initial`, or a guard that always declines it, still counts
  as declared. A bare `observe` call is exempt: it can always find its state
  already occupied by the time it registers. A residency action on a noninitial
  state needs an incoming row to ever run, and is rejected without one.

### Minor Changes

- [#86](https://github.com/QuentinRoy/totorobot/pull/86) [`e9c07f5`](https://github.com/QuentinRoy/totorobot/commit/e9c07f5823277671c89162f89c360f000dd6c6dd) - `observe` now also accepts a bare state key, meaning residency, using the
  same `{ run, restart }` record `actions` takes:

  ```ts
  doc.observe('loading', {
  	run: ({ toData }) => subscribe(toData.url),
  	restart: false,
  })
  ```

  If the state is already resident when you call `observe`, the run callback
  fires immediately. Unsubscribing tears down a run in flight. There's no
  array form, no third-argument options object, and no subscription
  `AbortSignal`. Existing `observe(pattern, observer)` calls need no change.

- [#83](https://github.com/QuentinRoy/totorobot/pull/83) [`67d8f99`](https://github.com/QuentinRoy/totorobot/commit/67d8f9943a3a16cef6c50aad43f616c84ffc25b1) - Add an `actions` block, so work scoped to a state, or fired by a transition,
  travels with the definition instead of being bookkeeping that every caller
  writes:

  ```ts
  actions: {
  	connected: ({ toData }) => {
  		const socket = connect(toData.url)
  		return () => socket.close()
  	},
  }
  ```

- [#79](https://github.com/QuentinRoy/totorobot/pull/79) [`3b235c4`](https://github.com/QuentinRoy/totorobot/commit/3b235c4296f77bb696b77213095d2ca3199a9415) - Add `send` to the transition record an observer receives, so a reaction can drive
  the machine without closing over the host it was registered on:

  ```ts
  doc.observe('* -> review', (e) => e.send('publish'))
  ```

  It accepts any declared input, whatever the pattern matched, and is queued like
  any other send. Existing observers need no change.

- [#118](https://github.com/QuentinRoy/totorobot/pull/118) [`5fc4023`](https://github.com/QuentinRoy/totorobot/commit/5fc40232927c20576fc823f1af79c7e17bf415d9) - `observe`'s pattern completions now list only the patterns a declared row can
  fire, rather than every combination the names allow. A dead pattern still fails
  to compile with the same `no row matches '...'` message as before.

  Add `Patterns` and `Observer`, beside the existing `Handled` and `Sources`. Both
  take the machine's own type. You can use them, for example, to name an observer
  before you register it, and it narrows the record just as an inline one does:

  ```ts
  const notify: Observer<typeof publication, '* -> published'> = ({ toData }) =>
  	announce(toData.text)
  ```

  Written without a pattern, `Observer` covers every row the table can fire. The
  two types also compose: a helper that wraps `observe` can hold one generic `P`
  across its pattern and its observer, and still reject a dead pattern at its own
  boundary. Existing calls need no change.

- [#85](https://github.com/QuentinRoy/totorobot/pull/85) [`4386512`](https://github.com/QuentinRoy/totorobot/commit/438651296f94ea0632ea950186410054ca874b8c) - `actions` values widen to a record with `run` and `restart`, or an array of
  either, alongside the existing bare function:

  ```ts
  actions: {
  	connected: { run: ({ toData }) => subscribe(toData.url), restart: false },
  }
  ```

  `restart` (a boolean, or a predicate over the transition facts) is consulted
  only on a self-transition and restarts by default; it's a compile error on
  an edge. A predicate runs once per self-transition, and that one decision
  governs both the teardown and the setup that follows it. Arrays set up in
  order and tear down in reverse. Existing actions need no change.

## 1.0.1

### Patch Changes

- [#70](https://github.com/QuentinRoy/totorobot/pull/70) [`dc56cd9`](https://github.com/QuentinRoy/totorobot/commit/dc56cd92f221c1d7ddecaf5b53180fe74d5a2f6e) - Build the package during `prepack`, so the published tarball always contains a
  freshly built `dist/` no matter who or what runs the publish.
