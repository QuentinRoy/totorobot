// Regression fixture for #136: re-exporting a machine, the pattern the
// README's own example uses, must survive `tsc --declaration`. Checked by
// `scripts/check-declaration-emit.ts`, since type-checking alone does not
// hit TS4023 — only declaration emission does.
import { machine, type } from 'totorobot'

export const publication = machine({
	states: type<{ idle: undefined; open: { readonly x: number } }>(),
	initial: 'idle',
	transitions: {
		'idle -go> open': () => ({ x: 0 }),
	},
})
