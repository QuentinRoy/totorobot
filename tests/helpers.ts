/**
 * Small utilities shared across the v1 test suite. Nothing here asserts
 * anything about the library; it exists so two test files don't carry the
 * same helper verbatim.
 */

/**
 * Clones plain objects and arrays; leaves functions and other values by reference.
 *
 * Not `structuredClone`: definitions carry transition functions, and
 * `structuredClone` throws on those. Non-plain values are intentionally kept
 * by reference too, so identity-sensitive assertions (`toStrictEqual` on a
 * definition) aren't broken by cloning things that were never expected to change.
 */
/**
 * The residency recipe the README describes under "Residency": setup/teardown
 * scoped to "while we are in `state`", built from nothing but `.observe()`.
 * Kept here rather than imported from `src/` because it is documentation, not
 * library surface — the point of the recipe is that a caller can write it
 * themselves.
 */
// `doc` is typed `any` on purpose: the recipe is plain JavaScript, with no
// annotations of its own, and threading a real host's pattern-checked
// `observe` through a helper signature would type-check only the one machine
// it was written against.
export function residency(
	doc: any,
	state: string,
	setup: (snapshot: unknown) => (() => void) | undefined,
) {
	let teardown: (() => void) | undefined
	const offExit = doc.observe(`${state} -> *`, () => {
		teardown?.()
		teardown = undefined
	})
	const offEnter = doc.observe(`* -> ${state}`, (e: { toData: unknown }) => {
		teardown = setup(e.toData)
	})
	if (doc.current.name === state) teardown = setup(doc.current.data)
	return () => {
		offExit()
		offEnter()
		teardown?.()
	}
}

export function cloneDeep<T>(value: T): T {
	if (Array.isArray(value)) return value.map(cloneDeep) as T
	if (
		value !== null &&
		typeof value === 'object' &&
		value.constructor === Object
	) {
		return Object.fromEntries(
			Object.entries(value).map(([key, v]) => [key, cloneDeep(v)]),
		) as T
	}
	return value
}
