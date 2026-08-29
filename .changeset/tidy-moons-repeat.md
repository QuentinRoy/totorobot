---
'totorobot': patch
---

Shrink the published bundle to 570 B brotli (down from 580 B) by declaring with
`let` instead of `const` everywhere the type layer does not require `const`.
Terser keeps whichever keyword the source uses, and only merges adjacent
declarations of the same kind, so the last `const` was also blocking a
declaration merge.
