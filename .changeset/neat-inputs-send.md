---
'totorobot': major
---

Input names are now top-level discriminants in transition records. In actions
and observers, checking `input` narrows the full record, including `from`, `to`,
and `inputData`. Separate names and data also make sends easier to read.

Change `type Inputs = { type: 'open'; text: string } | { type: 'close' }` to
`type Inputs = { open: { text: string }; close: undefined }`. Replace
`send({ type: 'open', text })` with `send('open', { text })`. In callbacks,
replace `input.type` with `input` and read payload fields from `inputData`.

An empty input name no longer dispatches an immediate transition.
