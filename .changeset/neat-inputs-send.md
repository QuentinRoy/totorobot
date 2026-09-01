---
'totorobot': major
---

Tagged input objects reserve `type` and exclude primitive payloads. Inputs now
separate names from payloads.

Change `type Inputs = { type: 'open'; text: string } | { type: 'close' }` to
`type Inputs = { open: { text: string }; close: undefined }`. Replace
`send({ type: 'open', text })` with `send('open', { text })`. In callbacks,
replace `input.type` with `input` and read payload fields from `inputData`.

An empty input name no longer dispatches an immediate transition.
