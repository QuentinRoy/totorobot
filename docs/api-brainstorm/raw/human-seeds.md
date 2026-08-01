# Human pre-session seeds

These seeds were captured before Wave 1 so they would not be lost. Wave 1
agents must not see them. From Wave 2 onward, they receive the same sampling and
curation treatment as agent-generated seeds, with no priority or foundational
status.

## H-001

**Name:** Transition-keyed edge table

**Provenance:** Supplied by the user before the brainstorm.

**Capture note:** Syntax and the `iddle` typo were lightly normalized; the
mechanism is unchanged.

**Sketch:**

```ts
define<
	// States.
	| ({ name: 'idle' } & IdleData)
	| ({ name: 'activated' } & ActivatedData)
	| { name: 'stopped' },
	// Events.
	({ name: 'activate' } & ActivatePayload) | { name: 'stop' | 'reset' }
>({
	// Idle state.
	'activate: idle -> activated': {
		when(...args) {
			// ...
		},
		data(...args) {
			// ...
		},
	},
	// Activated state.
	'stop: activated -> stopped': {},
	'reset: activated -> idle': {},
	// Stopped state.
	'activate: stopped -> activated': {},
})
```

**Mechanism:** Typed state and event unions supply data shapes, while parseable
`${EventName}: ${SourceState} -> ${TargetState}` keys define topology and edge-local behavior.

**Unlocks:** The graph stays scan-readable while each handler could infer its
source state, event payload, and target data contract from the key.

**Unknown:** Can TypeScript validate the key grammar and infer useful handler
arguments without making users restate the same information?

## H-002

**Name:** Interpolated transition script

**Provenance:** Supplied by the user before the brainstorm.

**Sketch:**

```ts
define<
	// States.
	| ({ name: 'idle' } & IdleData)
	| ({ name: 'activated' } & ActivatedData)
	| { name: 'stopped' },
	// Events.
	({ name: 'activate' } & ActivatePayload) | { name: 'stop' | 'reset' }
>`
	activate: idle -> activated ${{
		when(...args) {
			// ...
		},
		data(...args) {
			// ...
		},
	}}
	stop: activated -> stopped
	reset: activated -> idle ${{
		when(...args) {
			// ...
		},
	}}
	activate: stopped -> activated
`
```

**Mechanism:** A tagged-template edge language defines topology, while
interpolated TypeScript objects attach behavior to the preceding transition.

**Unlocks:** The complete graph reads like compact notation without forcing
guards and data transformations out of ordinary TypeScript.

**Unknown:** Can a template tag correlate each interpolation with its parsed
edge strongly enough to infer source data, event payload, and target data?
How to define the initial state? How to implement reactions?
