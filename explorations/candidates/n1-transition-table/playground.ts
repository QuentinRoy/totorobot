// SCRATCH FILE — open this in your editor and try the completions.
//
// The whole point of the prototype. Things to try, in order:
//
//  1. Inside `transitions`, type an opening quote and hit ctrl-space. You get
//     the full 4 x 4 x 4 = 64-member list.
//  2. Type `sub` — does it narrow to the 8 `submit:` keys?
//  3. Type `submit: dr` — does it narrow to the 4 `submit: draft -> *` keys?
//     This is the question: does the cross-product collapse as you type?
//  4. Now do the same in `bigMachine` below, where the union is 4 000 members.
//  5. Hover a handler's `data` and `input` — they should be the SOURCE state's
//     data and the input's payload, recovered by parsing the key.
//  6. Break a key (`'submit: draft -> reviw'`) and read the error.
//  7. Break the spacing (`'submit:draft->review'`) and read that error.

import { input, machine, state } from './lib.ts'

type Submit =
	| { readonly route: 'review'; readonly reviewer: string }
	| { readonly route: 'publish' }

export const small = machine({
	initial: 'empty',
	inputs: {
		open: input<{ readonly text: string }>(),
		revise: input<{ readonly text: string }>(),
		submit: input<Submit>(),
		cancel: input(),
	},
	states: {
		empty: state(),
		draft: state<{ readonly text: string; readonly revision: number }>(),
		review: state<{ readonly text: string; readonly reviewer: string }>(),
		published: state<{ readonly text: string }>(),
	},
	transitions: {
		'open: empty -> draft': ({ input }) => ({ text: input.text, revision: 0 }),
		'submit: draft -> review': ({ data, input, skip }) =>
			input.route === 'review'
				? { text: data.text, reviewer: input.reviewer }
				: skip(),
		'submit: empty -> published': ({ input, skip }) =>
			input.route === 'publish' ? { text: '' } : skip(),
	},
})

// --- the same, but with a 4 000-member key union -----------------------------
// 10 inputs x 20 states x 20 states = 4 000. Try step 3 again in here.

const manyInputs = {
	press: input<{ readonly key: string }>(),
	release: input(),
	move: input<{ readonly x: number; readonly y: number }>(),
	tick: input(),
	focus: input(),
	blur: input(),
	save: input(),
	load: input(),
	undo: input(),
	redo: input(),
}

const manyStates = {
	idle: state(),
	booting: state(),
	ready: state<{ readonly n: number }>(),
	editing: state<{ readonly text: string }>(),
	saving: state(),
	saved: state(),
	loading: state(),
	loaded: state(),
	failed: state<{ readonly why: string }>(),
	retrying: state(),
	paused: state(),
	resumed: state(),
	dragging: state<{ readonly x: number; readonly y: number }>(),
	dropped: state(),
	selecting: state(),
	selected: state(),
	zooming: state(),
	panning: state(),
	closing: state(),
	closed: state(),
}

export const bigMachine = machine({
	initial: 'idle',
	inputs: manyInputs,
	states: manyStates,
	transitions: {
		'load: idle -> booting': () => {},
		'tick: booting -> ready': () => ({ n: 0 }),
		'press: ready -> editing': ({ input }) => ({ text: input.key }),
		'save: editing -> saving': () => {},
		'tick: saving -> saved': () => {},
		'move: ready -> dragging': ({ input }) => ({ x: input.x, y: input.y }),
		'release: dragging -> dropped': () => {},

		// <- and here
	},
}).on('press: ready -> *', (event) => {})
