---
'totorobot': minor
---

Widen `actions` values: a bare function, a record with `run`, or an array of
either. The record adds `restart` — `boolean | ((from, to) => boolean)`,
consulted only on a self-transition, restarting by default — and the array
lets one trigger carry several actions, set up in order and torn down in
reverse:

```ts
actions: {
	connected: { run: ({ to }) => subscribe(to.url), restart: false },
	loading: [({ send }) => poll(send), () => track('loading')],
}
```

`restart` on an edge trigger is a compile error. Existing bare-function
actions need no change.
