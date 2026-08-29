---
'totorobot': minor
---

Add `send` to the transition record a listener receives, so a reaction can drive
the machine without closing over the host. It takes any declared input, and is
queued like any other send.
