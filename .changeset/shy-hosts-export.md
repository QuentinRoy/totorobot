---
'totorobot': patch
---

`Machine` and `Host` (what `machine()` and its `start()` method return) are now exported, so a consumer can name them. Before this, exporting a machine (`export const m = machine({...})`) failed a `tsc --declaration` build with `TS4023`.

`--isolatedDeclarations` still requires writing it out by hand: `const m: Machine<Inputs, States, Keys, InitialState, Outputs> = machine({...})`.
