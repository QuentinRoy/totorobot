// Baseline 2: a plain `switch` over a discriminated union. No library.
//
// Case 1, the reduced Marking Menu.
//
// The vocabulary the neutral machine used (state union, input union, one
// `switch`-on-state / `switch`-on-input reducer) is unchanged, but the return
// type had to grow: this machine has effects, so the reducer returns
// `{ state, effects }` instead of a bare state. That change is invisible to
// the neutral machine, which still returns a bare state. This baseline has no
// vocabulary to overfit, so it simply re-shapes per machine -- see README.

export type Point = { readonly x: number; readonly y: number }
export type Stroke = readonly Point[]

export type Item = { readonly label: string }
export type Menu = {
	readonly label: string
	readonly children: readonly (Item | Menu)[]
}

export type MenuState =
	| { readonly state: 'idle'; readonly nextToken: number }
	| {
			readonly state: 'startup'
			readonly origin: Point
			readonly stroke: Stroke
			readonly timerToken: number
			readonly nextToken: number
	  }
	| {
			readonly state: 'expert'
			readonly stroke: Stroke
			readonly nextToken: number
	  }
	| {
			readonly state: 'novice'
			readonly menu: Menu
			readonly center: Point
			readonly stroke: Stroke
			readonly nextToken: number
	  }

export type MenuInput =
	| { readonly input: 'down'; readonly point: Point }
	| { readonly input: 'move'; readonly point: Point }
	| { readonly input: 'up'; readonly point: Point }
	| { readonly input: 'cancel'; readonly point: Point }
	| { readonly input: 'dwellElapsed'; readonly token: number }

export type MenuEffect =
	| { readonly effect: 'start'; readonly point: Point }
	| { readonly effect: 'scheduleDwell'; readonly token: number }
	| { readonly effect: 'cancelDwell'; readonly token: number }
	| { readonly effect: 'openMenu'; readonly menu: Menu; readonly center: Point }
	| { readonly effect: 'finish'; readonly selection: string | null }
	| { readonly effect: 'cancelled' }

export type Step = {
	readonly state: MenuState
	readonly effects: readonly MenuEffect[]
}

export const initialState: MenuState = { state: 'idle', nextToken: 0 }

const NO_EFFECTS: readonly MenuEffect[] = []
const stay = (state: MenuState): Step => ({ state, effects: NO_EFFECTS })

// Ordinary domain helpers, not library features.
const EXPERT_RADIUS = 16

function isFarEnough(origin: Point, point: Point): boolean {
	return Math.hypot(point.x - origin.x, point.y - origin.y) >= EXPERT_RADIUS
}

function itemAt(
	menu: Menu,
	center: Point,
	point: Point,
): Item | Menu | undefined {
	const count = menu.children.length
	const turn =
		Math.atan2(point.y - center.y, point.x - center.x) / (Math.PI * 2)
	return menu.children[Math.round(((turn % 1) + 1) * count) % count]
}

export function reduce(state: MenuState, input: MenuInput, root: Menu): Step {
	switch (state.state) {
		case 'idle':
			switch (input.input) {
				case 'down':
					return {
						state: {
							state: 'startup',
							origin: input.point,
							stroke: [input.point],
							timerToken: state.nextToken,
							nextToken: state.nextToken + 1,
						},
						effects: [
							{ effect: 'start', point: input.point },
							{ effect: 'scheduleDwell', token: state.nextToken },
						],
					}
				default:
					return stay(state)
			}

		case 'startup':
			switch (input.input) {
				case 'move':
					return isFarEnough(state.origin, input.point)
						? {
								state: {
									state: 'expert',
									stroke: [...state.stroke, input.point],
									nextToken: state.nextToken,
								},
								effects: [{ effect: 'cancelDwell', token: state.timerToken }],
							}
						: {
								state: { ...state, stroke: [...state.stroke, input.point] },
								effects: NO_EFFECTS,
							}
				case 'dwellElapsed':
					return input.token !== state.timerToken
						? stay(state)
						: {
								state: {
									state: 'novice',
									menu: root,
									center: state.origin,
									stroke: state.stroke,
									nextToken: state.nextToken,
								},
								effects: [
									{ effect: 'openMenu', menu: root, center: state.origin },
								],
							}
				case 'up':
					return {
						state: { state: 'idle', nextToken: state.nextToken },
						effects: [
							{ effect: 'cancelDwell', token: state.timerToken },
							{ effect: 'finish', selection: null },
						],
					}
				case 'cancel':
					return {
						state: { state: 'idle', nextToken: state.nextToken },
						effects: [
							{ effect: 'cancelDwell', token: state.timerToken },
							{ effect: 'cancelled' },
						],
					}
				default:
					return stay(state)
			}

		case 'expert':
			switch (input.input) {
				case 'move':
					return {
						state: { ...state, stroke: [...state.stroke, input.point] },
						effects: NO_EFFECTS,
					}
				case 'up':
					return {
						state: { state: 'idle', nextToken: state.nextToken },
						effects: [
							{
								effect: 'finish',
								selection:
									itemAt(root, state.stroke[0] ?? input.point, input.point)
										?.label ?? null,
							},
						],
					}
				case 'cancel':
					return {
						state: { state: 'idle', nextToken: state.nextToken },
						effects: [{ effect: 'cancelled' }],
					}
				default:
					return stay(state)
			}

		case 'novice':
			switch (input.input) {
				case 'move':
					return {
						state: { ...state, stroke: [...state.stroke, input.point] },
						effects: NO_EFFECTS,
					}
				case 'up':
					return {
						state: { state: 'idle', nextToken: state.nextToken },
						effects: [
							{
								effect: 'finish',
								selection:
									itemAt(state.menu, state.center, input.point)?.label ?? null,
							},
						],
					}
				case 'cancel':
					return {
						state: { state: 'idle', nextToken: state.nextToken },
						effects: [{ effect: 'cancelled' }],
					}
				default:
					return stay(state)
			}

		default: {
			const unhandled: never = state
			return { state: unhandled, effects: NO_EFFECTS }
		}
	}
}

// --- demonstration ---------------------------------------------------------
// Run: pnpm exec node explorations/candidates/baselines/switch-union/case1.ts
// Covers the five required traces from docs/acceptance-cases.md, Case 1.

declare const console: { log: (...args: unknown[]) => void }

const root: Menu = {
	label: 'root',
	children: [
		{ label: 'east' },
		{ label: 'south', children: [{ label: 'south-inner' }] },
		{ label: 'west' },
		{ label: 'north' },
	],
}

const p0: Point = { x: 100, y: 100 }

// Trace 1: down(p0) from idle(nextToken: 0) enters startup(timerToken: 0,
// nextToken: 1), reports start, and schedules token 0.
const t1 = reduce(initialState, { input: 'down', point: p0 }, root)
const startup = t1.state
if (startup.state !== 'startup') throw new Error(`down gave ${startup.state}`)
if (startup.timerToken !== 0)
	throw new Error(`timerToken ${startup.timerToken}`)
if (startup.nextToken !== 1) throw new Error(`nextToken ${startup.nextToken}`)
if (t1.effects.length !== 2)
	throw new Error(`down gave ${t1.effects.length} effects`)
if (t1.effects[0]?.effect !== 'start') throw new Error('down must report start')
const scheduled = t1.effects[1]
if (scheduled?.effect !== 'scheduleDwell' || scheduled.token !== 0)
	throw new Error('down must schedule token 0')

// Trace 2: a nearby move commits a startup stroke update; a matching
// dwellElapsed(0) then enters novice and reports open.
const t2a = reduce(startup, { input: 'move', point: { x: 103, y: 101 } }, root)
const nearby = t2a.state
if (nearby.state !== 'startup')
	throw new Error(`nearby move gave ${nearby.state}`)
if (nearby === startup)
	throw new Error('a same-state update must be a new value')
if (nearby.stroke.length !== 2)
	throw new Error(`stroke ${nearby.stroke.length}`)
if (t2a.effects.length !== 0) throw new Error('a stroke update has no effects')

const t2b = reduce(nearby, { input: 'dwellElapsed', token: 0 }, root)
const novice = t2b.state
if (novice.state !== 'novice') throw new Error(`dwell gave ${novice.state}`)
if (novice.menu !== root) throw new Error('novice must open the root menu')
if (t2b.effects[0]?.effect !== 'openMenu')
	throw new Error('dwell must report open')

// Trace 3: in a fresh execution, a far move enters expert and cancels token 0;
// a later dwellElapsed(0) produces no transition.
const t3a = reduce(startup, { input: 'move', point: { x: 200, y: 100 } }, root)
const expert = t3a.state
if (expert.state !== 'expert') throw new Error(`far move gave ${expert.state}`)
const cancelDwell = t3a.effects[0]
if (cancelDwell?.effect !== 'cancelDwell' || cancelDwell.token !== 0)
	throw new Error('a far move must cancel token 0')

const t3b = reduce(expert, { input: 'dwellElapsed', token: 0 }, root)
if (t3b.state !== expert) throw new Error('a stale dwell must not transition')
if (t3b.effects.length !== 0) throw new Error('a stale dwell has no effects')

// Trace 3': a stale dwell that is still *available* (startup, wrong token).
const t3c = reduce(startup, { input: 'dwellElapsed', token: 7 }, root)
if (t3c.state !== startup)
	throw new Error('a mismatched dwell must not transition')

// Trace 4: cancel(p) from startup returns to idle, cancels its dwell work, and
// reports cancellation.
const t4 = reduce(startup, { input: 'cancel', point: p0 }, root)
const backToIdle = t4.state
if (backToIdle.state !== 'idle')
	throw new Error(`cancel gave ${backToIdle.state}`)
if (backToIdle.nextToken !== 1) throw new Error('cancel must keep nextToken')
if (t4.effects[0]?.effect !== 'cancelDwell')
	throw new Error('cancel must cancel dwell')
if (t4.effects[1]?.effect !== 'cancelled')
	throw new Error('cancel must report cancel')

// Trace 5: an input unavailable in the current state produces no transition,
// not a same-state update. `down` is only available from `idle`.
const t5 = reduce(expert, { input: 'down', point: p0 }, root)
if (t5.state !== expert)
	throw new Error('an unavailable input must not transition')
if (t5.effects.length !== 0)
	throw new Error('an unavailable input has no effects')

// Expert selection still works end to end.
const t6 = reduce(expert, { input: 'up', point: { x: 300, y: 100 } }, root)
const finished = t6.effects[0]
if (finished?.effect !== 'finish') throw new Error('up must finish')
if (finished.selection !== 'east')
	throw new Error(`selected ${finished.selection}`)

// --- what this baseline does NOT give you ----------------------------------

// WEAKNESS 1 -- per-state capabilities are NOT enforced at the call site.
// `dwellElapsed` is meaningless from `idle` and `down` is illegal from
// `expert`, yet both calls type-check. Only the runtime `default: return
// stay(state)` arms stop them. These lines are here because they COMPILE.
const illegalDwell = reduce(
	initialState,
	{ input: 'dwellElapsed', token: 0 },
	root,
)
if (illegalDwell.state !== initialState)
	throw new Error('idle dwell must not move')

// WEAKNESS 2 -- the reducer's return type is the whole union, so the target of
// a statically known transition is NOT statically known. This only compiles
// because of the suppression; with real typestate the suppression would error.
const afterDown = reduce(initialState, { input: 'down', point: p0 }, root).state
// @ts-expect-error Property 'origin' does not exist on type 'MenuState'.
const leaked: Point = afterDown.origin
void leaked

// WEAKNESS 3 -- staleness is entirely hand-written. `timerToken` and
// `dwellElapsed.token` are both `number`; nothing relates them, so comparing
// against the wrong field is a silent, well-typed bug.
const wrongFieldButWellTyped = (s: MenuState, i: MenuInput): boolean =>
	s.state === 'startup' && i.input === 'dwellElapsed' && i.token === s.nextToken
void wrongFieldButWellTyped

console.log('case1: all five required traces passed')
