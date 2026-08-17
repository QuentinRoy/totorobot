// Negative evidence for notation B. Every message below is quoted VERBATIM from
// `pnpm exec tsc -p explorations/candidates/c2-annotated-outcome/tsconfig.json`
// on typescript@7.0.2, captured with the @ts-expect-error lines removed.
import { type Keep, type To, data, input, machine } from './lib.ts'

export const m = machine({
	initial: 'a',
	inputs: { go: input<{ readonly v: number }>(), stay: input<void>() },
	states: {
		a: {
			data: data<{ readonly n: number }>(),
			on: {
				// 1. BODY GOES WHERE THE ANNOTATION DOES NOT ALLOW. Column 30, on
				// the returning expression:
				//   error TS2322: Type 'To<"c">' is not assignable to type 'To<"b">'.
				//     Type '"c"' is not assignable to type '"b"'.
				// @ts-expect-error
				go: ({ at }): To<'b'> => at.c(),

				// 2. WRONG TARGET DATA. Column 39, on the offending value:
				//   error TS2322: Type 'string' is not assignable to type 'number'.
				// @ts-expect-error
				stay: ({ at }): To<'b'> => at.b({ q: 'not a number' }),
			},
		},
		b: {
			data: data<{ readonly q: number }>(),
			on: {
				// 3. INVALID SOURCE-DATA READ. Column 50:
				//   error TS2339: Property 'nope' does not exist on type
				//   '{ readonly q: number; }'.
				// @ts-expect-error
				go: ({ data, keep }): Keep => keep({ q: data.nope }),

				// 4. UNKNOWN TARGET -- `at` offers only real states. Column 35:
				//   error TS2339: Property 'nowhere' does not exist on type
				//   'At<{ a: Data<{ readonly n: number; }>; b: Data<{ readonly q:
				//   number; }>; c: Data<void>; }>'.
				// @ts-expect-error
				stay: ({ at }): To<'a'> => at.nowhere(),
			},
		},
		c: { data: data<void>() },
	},
})
