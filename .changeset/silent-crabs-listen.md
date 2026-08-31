---
'totorobot': major
---

A residency observer's first matching transition starts it — entry, or a
self-transition if already resident — and `restart` is not consulted for that
one. Setup returning no teardown still counts as started, so `restart: false`
survives the next self-transition instead of running setup again.
