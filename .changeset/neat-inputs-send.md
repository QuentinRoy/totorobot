---
'totorobot': major
---

In actions and observers, narrowing `input` now narrows `inputData`. Separate
names and data also make sends and transition records easier to read.

Change `type Inputs = { type: 'open'; text: string } | { type: 'close' }` to
`type Inputs = { open: { text: string }; close: undefined }`. Replace
`send({ type: 'open', text })` with `send('open', { text })`. In callbacks,
replace `input.type` with `input` and read payload fields from `inputData`.

An empty input name no longer dispatches an immediate transition.
