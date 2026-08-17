// The neutral document-publication machine, in the Radix lookup-table style.
//
// The machine is the table and nothing else. It has no context, so all document
// data lives in mutable cells beside it -- the direct analogue of Radix
// Presence's `stylesRef` / `prevAnimationNameRef` / `mountAnimationNameRef`.

import { createRef, createStateMachine, type MachineEvent } from './machine.ts'

// --- the machine -------------------------------------------------------------
// `submit` and `decide` are each SPLIT into two events, because a lookup table
// stores exactly one target per (state, event) pair and therefore cannot hold a
// multi-target transition. The choice moves to the caller, below.
const publication = {
	empty: { open: 'draft' },
	draft: {
		revise: 'draft',
		submitToReview: 'review',
		submitToPublish: 'published',
		cancel: 'empty',
	},
	review: {
		revise: 'draft',
		approve: 'published',
		reject: 'draft',
		cancel: 'empty',
	},
	published: {},
} as const

// --- one document instance ---------------------------------------------------
type Submit =
	| { readonly route: 'review'; readonly reviewer: string }
	| { readonly route: 'publish' }
type Decide =
	| { readonly verdict: 'approve' }
	| { readonly verdict: 'reject'; readonly text: string }

function createDocument() {
	const [getState, send] = createStateMachine('empty', publication)

	// No per-state data exists. Every field is visible from every state and must
	// be nullable or carry a placeholder, whatever the state actually is.
	const text = createRef('')
	const revision = createRef(0)
	const reviewer = createRef<string | null>(null)
	const record = createRef<readonly [text: string, revision: number] | null>(
		null,
	)

	// The reducer is total: `machine[state][event] ?? state` returns the current
	// state both for a refused input and for a same-state commit. To tell those
	// two apart -- and to avoid running the data writes below on a refusal --
	// the caller has to read the table itself, re-deriving what the reducer just
	// computed and threw away.
	const can = (event: MachineEvent<typeof publication>) =>
		Object.hasOwn(publication[getState()], event)

	return {
		getState,
		read: () => ({
			text: text.current,
			revision: revision.current,
			reviewer: reviewer.current,
			record: record.current,
		}),

		open(nextText: string) {
			if (!can('open')) return
			send('open')
			text.current = nextText
			revision.current = 0
		},

		revise(nextText: string) {
			const state = getState()
			if (state === 'draft') {
				if (nextText === text.current) return // guard: no transition
				send('revise')
				text.current = nextText
				revision.current += 1
			} else if (state === 'review') {
				send('revise')
				text.current = nextText
				revision.current += 1
				reviewer.current = null
			}
		},

		submit(input: Submit) {
			if (!can('submitToReview')) return
			if (input.route === 'review') {
				send('submitToReview')
				reviewer.current = input.reviewer
			} else {
				send('submitToPublish')
				record.current = [text.current, revision.current]
			}
		},

		decide(input: Decide) {
			if (!can('approve')) return
			if (input.verdict === 'approve') {
				send('approve')
				record.current = [text.current, revision.current]
				reviewer.current = null
			} else {
				send('reject')
				text.current = input.text
				revision.current += 1
				reviewer.current = null
			}
		},

		cancel() {
			if (!can('cancel')) return
			send('cancel')
			text.current = ''
			revision.current = 0
			reviewer.current = null
		},
	}
}

// --- demonstration -----------------------------------------------------------
declare const console: { log: (...args: unknown[]) => void }

const eq = (actual: unknown, expected: unknown, what: string) => {
	if (actual !== expected) {
		throw new Error(
			`${what}: expected ${String(expected)}, got ${String(actual)}`,
		)
	}
}

// empty + open -> draft
const d1 = createDocument()
eq(d1.getState(), 'empty', 'initial')
d1.open('hello')
eq(d1.getState(), 'draft', 'empty + open')
eq(d1.read().revision, 0, 'draft revision')

// draft + revise unchanged -> no transition; changed -> update draft
d1.revise('hello')
eq(d1.read().revision, 0, 'draft + revise unchanged')
d1.revise('hello world')
eq(d1.getState(), 'draft', 'draft + revise changed stays draft')
eq(d1.read().revision, 1, 'draft + revise changed bumps revision')

// draft + submit(review) -> review
d1.submit({ route: 'review', reviewer: 'ada' })
eq(d1.getState(), 'review', 'draft + submit(review)')
eq(d1.read().reviewer, 'ada', 'review reviewer')

// review + decide(reject) -> draft
d1.decide({ verdict: 'reject', text: 'needs work' })
eq(d1.getState(), 'draft', 'review + decide(reject)')
eq(d1.read().text, 'needs work', 'rejected text')

// draft + cancel -> empty
d1.cancel()
eq(d1.getState(), 'empty', 'draft + cancel')

// draft + submit(publish) -> published, carrying the tuple
const d2 = createDocument()
d2.open('paper')
d2.submit({ route: 'publish' })
eq(d2.getState(), 'published', 'draft + submit(publish)')
eq(d2.read().record?.[0], 'paper', 'published tuple text')
eq(d2.read().record?.[1], 0, 'published tuple revision')

// review + decide(approve) -> published
const d3 = createDocument()
d3.open('draft text')
d3.submit({ route: 'review', reviewer: 'grace' })
d3.decide({ verdict: 'approve' })
eq(d3.getState(), 'published', 'review + decide(approve)')

// published + any broad input -> no transition
d3.open('again')
d3.revise('again')
d3.cancel()
eq(d3.getState(), 'published', 'published is terminal')

// ...but the machine itself does not enforce that. The next line type-checks
// even though `d3` is statically in `published`: the reducer accepts every
// event name in the machine from every state, and silently no-ops.
const [getRaw, sendRaw] = createStateMachine('published', publication)
eq(sendRaw('open'), 'published', 'send is unchecked but inert')
eq(getRaw(), 'published', 'unchecked send did not move')

console.log('neutral.ts: all assertions passed')
