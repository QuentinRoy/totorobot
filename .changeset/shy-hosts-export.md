---
'totorobot': patch
---

`Machine` and `Host` are now exported: `Machine` is what `machine()` returns,
`Host` is what its `start()` method returns. Before this, `export const m =
machine({...})` — the pattern the README's own example uses — failed a plain
`tsc --declaration` build with `TS4023`: the type of `m` existed but could not
be named outside the package.

`--isolatedDeclarations` still refuses to infer an exported value's type at
all, so a machine exported under that flag still needs its type spelled out by
hand: `export const m: Machine<Inputs, States, Keys, InitialState, Outputs> =
machine({...})`. That was already true; only the ability to name `Machine` and
`Host` in the first place is new.
