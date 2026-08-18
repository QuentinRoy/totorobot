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
