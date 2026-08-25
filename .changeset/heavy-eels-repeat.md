---
'totorobot': patch
---

Build the package during `prepack`, so the published tarball always contains a
freshly built `dist/` no matter who or what runs the publish.
