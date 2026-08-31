---
'totorobot': patch
---

Golfed the runtime: the bundle is 767 B brotli, down from 865 B (1,478 B raw,
down from 1,790 B). One flat transition index instead of a map of maps, one
`fire` loop serving the bare-key `observe` as well, edge rows that stop at their
handler, and a handful of smaller shapes measured against `pnpm size`.

No API change and no behaviour change: same exports, same types, same
semantics.
