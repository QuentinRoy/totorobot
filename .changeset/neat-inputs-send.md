---
'totorobot': major
---

Declare inputs as a name-to-payload map. Send with `send(name, data?)`; handlers,
actions, and observers receive separate `input` and `inputData` fields.
An empty input name no longer dispatches an immediate transition.
