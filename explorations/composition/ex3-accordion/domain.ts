/**
 * PROTOTYPE — throwaway. Example 3, the non-FSM half.
 */

export const labels = ['Shipping', 'Payment', 'Review'] as const

let sink: (text: string) => void = () => {}

export const bind = (fn: (text: string) => void): void => {
	sink = fn
}

/** A panel body that exists only while its panel is open. */
export const body = (label: string): (() => void) => {
	sink(`  ${label}: mount body`)
	return () => sink(`  ${label}: unmount body`)
}
