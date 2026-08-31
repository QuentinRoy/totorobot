---
'totorobot': major
---

Starting a host no longer fires edge actions for the initial arrival: entering
the initial state is not a transition, so `* -> *` and every other
wildcard-source pattern no longer runs at startup. Only a declared residency
action on the initial state runs there; real transitions afterwards, immediate
chain included, still invoke their matching edge actions with a defined
`from`.

Move any startup setup a wildcard edge action depended on into a residency
action on the initial state instead.
