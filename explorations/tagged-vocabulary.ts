/**
 * The tagged-union vocabulary of
 * [§17](../docs/api-rationale.md#17-the-shape-of-a-named-thing), pinned.
 *
 * §17 decides that inputs, outputs and states stop being maps of name → payload
 * and become discriminated unions — inputs tagged `type`, states tagged `name` —
 * and it rests on five claims about what TypeScript does. This file is those
 * claims as assertions, so that a compiler release which changes one of them
 * turns `pnpm typecheck` red instead of quietly invalidating a design record.
 *
 * Nothing here is the library. Every function is `declare`d; only signatures
 * matter. The shape is not new to this repository — `config-object-kit.ts`
 * already carries states as `{ name: … }` unions and derives a source context
 * with `Omit<Extract<S, { name: K }>, 'name'>` — and §13's last finding records
 * a hazard with that construction which claim 5 below deliberately avoids.
 */

import { assertType, type Equal } from './config-object-kit.ts'

// ---------------------------------------------------------------------------
// The fixture: the publication machine of the README, restated in the §17 shape.
// ---------------------------------------------------------------------------

type Inputs =
	| { type: 'open'; text: string }
	| { type: 'submit'; route: 'review' | 'publish' }
	/** A payload that is not a record nests under `data` — a convention, not a rule. */
	| { type: 'tick'; data: number }
	/** No payload: no `void` sentinel, just no other fields. */
	| { type: 'cancel' }

type States =
	| { name: 'empty' }
	| { name: 'draft'; text: string; revision: number }
	| { name: 'review'; text: string; revision: number; reviewer: string }

/** What a listener receives. `input: undefined` is an immediate transition. */
type Record_<I, S> =
	{ input: I; from: S; to: S } | { input: undefined; from: S; to: S }

declare const e: Record_<Inputs, States>

// ---------------------------------------------------------------------------
// 1. A nested discriminant narrows. `e.on` can therefore be deleted: the input
//    carries its own tag, and the record keeps one field per key coordinate.
// ---------------------------------------------------------------------------

// A `typeof` query does NOT see control-flow narrowing, so the narrowed value is
// bound first and the assertion made against the binding.
if (e.input?.type === 'open') {
	const text = e.input.text
	assertType<Equal<typeof text, string>>()
}

// The tripwire for claim 1: without narrowing this is an error, and it stays one.
// @ts-expect-error - `text` exists only on the `open` arm
e.input?.text

// ---------------------------------------------------------------------------
// 2. The immediate arm survives it. All three access styles split an
//    input-driven hop from an immediate one.
// ---------------------------------------------------------------------------

switch (e.input?.type) {
	case 'submit': {
		const route = e.input.route
		assertType<Equal<typeof route, 'review' | 'publish'>>()
		break
	}
	case undefined: {
		// An immediate transition: nothing else reaches this arm.
		const immediate = e.input
		assertType<Equal<typeof immediate, undefined>>()
		break
	}
}

if (e.input) {
	const tag = e.input.type
	assertType<Equal<typeof tag, Inputs['type']>>()
}

// ---------------------------------------------------------------------------
// 3. `from` and `to` do not depend on the discriminant. They are narrowed by
//    the listener's *pattern*, so nesting the input costs no narrowing — which
//    is what makes the record reshape free.
// ---------------------------------------------------------------------------

if (e.input?.type === 'open') {
	// Still the whole state union: knowing the input tells you nothing about the ends.
	const to = e.to
	assertType<Equal<typeof to, States>>()
}

// A pattern-narrowed end, by contrast, resolves to one arm.
declare const pinned: {
	input: Inputs | undefined
	to: Extract<States, { name: 'draft' }>
}
assertType<Equal<typeof pinned.to.revision, number>>()

// ---------------------------------------------------------------------------
// 4. `send` loses its arity conditional. One argument, whether or not the input
//    carries a payload — which is what deletes `Dispatch` and `void`.
// ---------------------------------------------------------------------------

declare function send(input: Inputs): void

send({ type: 'open', text: 'hello' })
send({ type: 'tick', data: 5 })
send({ type: 'cancel' })

// @ts-expect-error - `cancel` carries no payload, and excess properties are caught
send({ type: 'cancel', text: 'no' })
// @ts-expect-error - unknown input name
send({ type: 'nope' })

// ---------------------------------------------------------------------------
// 5. A handler returns the target's payload MINUS the tag, so the target is
//    never restated in the lambda and the arrow test survives.
//
//    §13's last finding is the hazard here: deriving the source context from the
//    state name inside a conditional can force the target to resolve before it
//    is read. This spelling keeps the target as a plain parsed string rather
//    than a free parameter to infer, which is why it does not bite.
// ---------------------------------------------------------------------------

type To<P> = P extends `${string}> ${infer T}` ? T : never

// Inlined, NOT behind an alias taking `S`. §17's error-message rule: an alias
// parameterized over the vocabulary makes TypeScript print the whole union in
// every wrong-return error, where the inlined form resolves to the one state.
type Table<S, K extends string> = {
	[P in K]: () => Omit<Extract<S, { name: To<P> }>, 'name'>
}

declare function machine<S, K extends string>(d: {
	states: S
	transitions: Table<S, K>
}): void

declare const states: States

machine({
	states,
	transitions: {
		'empty -open> draft': () => ({ text: 'x', revision: 0 }),
		// @ts-expect-error - `reviewer` is missing for the `review` target
		'draft -submit> review': () => ({ text: 'x', revision: 1 }),
		// NEGATIVE RESULT, and it is why the target is "not required" rather than
		// "not allowed": `Omit<{ name: 'empty' }, 'name'>` is `{}`, and `{}` accepts
		// any object literal — TypeScript's weak-type and excess-property checks
		// both need the target to have at least one property. So for a payload-free
		// state the tag can be restated and nothing objects. Harmless, but it means
		// the arrow test is upheld by the type only where the state carries data.
		'draft -cancel> empty': () => ({ name: 'empty' }),
	},
})
