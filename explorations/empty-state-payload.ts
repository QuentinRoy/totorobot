/**
 * The empty-object encoding for a payload-free state target, pinned.
 *
 * [§5](../docs/design-record.md#revision-the-shape-of-a-named-thing) tags states as
 * a union discriminated by `name` and has a handler return the target's
 * payload minus that tag. For a target that carries no payload beyond its
 * tag, the return type has to accept nothing and `{}` while rejecting
 * everything else — including a spread of a wider state, which is the
 * negative result `tagged-vocabulary.ts` records against the bare
 * `Omit<S, 'name'>` form: `Omit<{ name: 'empty' }, 'name'>` is `{}`, and `{}`
 * accepts any object literal, so a handler could restate the tag and nothing
 * would object.
 *
 * The fix is the **tagged empty-object** encoding: an optional property keyed
 * by a module-private `unique symbol`, never populated. This file pins that it
 * closes the hole — every acceptance and rejection `src/totorobot.ts`'s
 * `Table` relies on for a payload-free target — against an `Omit`/`Record`
 * baseline that does not. TS 7.0.2, each claim carrying a tripwire that must
 * fail.
 */

import { assertType, type Equal } from './config-object-kit.ts'

declare const emptyObjectTag: unique symbol
type EmptyObject = { readonly [emptyObjectTag]?: never }

type States = { name: 'empty' } | { name: 'draft'; text: string }

type Payload<N extends string> = Omit<Extract<States, { name: N }>, 'name'>

type Ret<N extends string> = keyof Payload<N> extends never
	? EmptyObject | void
	: Payload<N>

// ---------------------------------------------------------------------------
// 1. Accepted: nothing, and `{}`.
// ---------------------------------------------------------------------------

declare function toEmpty(): Ret<'empty'>
declare function toEmptyReturningNothing(): Ret<'empty'>

const a: Ret<'empty'> = undefined
const b: Ret<'empty'> = {}
const c = (): Ret<'empty'> => {}
const d = (): Ret<'empty'> => ({})

// ---------------------------------------------------------------------------
// 2. Rejected: a fresh literal carrying extra properties.
// ---------------------------------------------------------------------------

// @ts-expect-error - `empty` carries no payload; `text` is excess
const e: Ret<'empty'> = { text: 'x' }

// ---------------------------------------------------------------------------
// 3. Rejected: a variable of a wider object type.
// ---------------------------------------------------------------------------

declare const wider: { text: string }
// @ts-expect-error - a wider-typed variable is not a fresh literal, but the
// tagged form still rejects it: `wider` has a property `EmptyObject` cannot
// carry.
const f: Ret<'empty'> = wider

// ---------------------------------------------------------------------------
// 4. Rejected: an interface-typed value.
// ---------------------------------------------------------------------------

interface Wide {
	text: string
}
declare const wideInterface: Wide
// @ts-expect-error - same as claim 3, through a named interface rather than
// an object-literal type
const g: Ret<'empty'> = wideInterface

// ---------------------------------------------------------------------------
// 5. Rejected: a spread of a wider state. This is the hole `Omit<S, 'name'>`
//    alone leaves open — spreading a wider state into `{}` produces exactly
//    the excess-property case claim 2 covers, and a spread is checked the
//    same way a fresh literal is.
// ---------------------------------------------------------------------------

declare const draft: Extract<States, { name: 'draft' }>

// @ts-expect-error - spreading `draft` carries `text` along with it
const h: Ret<'empty'> = { ...draft }

// ---------------------------------------------------------------------------
// 6. Negative control: the bare `Omit<S, 'name'>` form does NOT reject any of
//    2, 3, 4 or 5 — this is the hole the tagged form closes, restated as a
//    tripwire of its own so a compiler change that starts rejecting these
//    turns this file red rather than quietly making the comparison stale.
// ---------------------------------------------------------------------------

type BareRet<N extends string> = Payload<N>

const bareLiteral: BareRet<'empty'> = { text: 'x' }
const bareWider: BareRet<'empty'> = wider
const bareInterface: BareRet<'empty'> = wideInterface
const bareSpread: BareRet<'empty'> = { ...draft }

assertType<Equal<typeof bareLiteral, {}>>()
assertType<Equal<typeof bareWider, {}>>()
assertType<Equal<typeof bareInterface, {}>>()
assertType<Equal<typeof bareSpread, {}>>()

// ---------------------------------------------------------------------------
// 7. The data-carrying arm is unaffected: excess-property checking still
//    applies there, tagged form or bare.
// ---------------------------------------------------------------------------

// @ts-expect-error - `draft` needs `text`, not `label`
const i: Ret<'draft'> = { label: 'x' }
const j: Ret<'draft'> = { text: 'x' }

void toEmpty
void toEmptyReturningNothing
void a
void b
void c
void d
void e
void f
void g
void h
void i
void j
