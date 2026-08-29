---
'totorobot': minor
---

Give a listener `send` in its bag. The transition record a listener receives now
carries `send` beside `input`, `from` and `to`, so a reaction can drive the
machine without closing over the host it was registered on. It is the host's own
`send`: it accepts the whole declared input vocabulary from any state, and a send
from a listener is queued under the existing drain rules — the listener is not
re-entered, and the input is read when the queue reaches it.

Purely additive: existing listener bodies and existing `observe` call sites are
unaffected.
