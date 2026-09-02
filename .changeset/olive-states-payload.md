---
'totorobot': major
---

State names are now top-level too, so a state vocabulary is a name-to-payload
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
