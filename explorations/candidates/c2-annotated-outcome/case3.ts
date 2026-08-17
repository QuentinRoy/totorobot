// Case 3, the asynchronous request race, in notation B.
//
// This is the case whose staleness CANNOT be solved by a state-scoped timer:
// the identity has to live in the data and be compared in the body. It
// therefore tests the effect channel rather than the transition vocabulary.

import {
	type Keep,
	type None,
	type To,
	command,
	data,
	input,
	machine,
} from './lib.ts'

type Cmd =
	| { readonly do: 'beginWork'; readonly requestId: number }
	| { readonly do: 'abandonWork'; readonly requestId: number }

export const request = machine({
	initial: 'idle',
	commands: command<Cmd>(),
	inputs: {
		start: input<void>(),
		progress: input<{ readonly requestId: number; readonly value: number }>(),
		succeed: input<{ readonly requestId: number; readonly result: string }>(),
		fail: input<{ readonly requestId: number; readonly error: string }>(),
		cancel: input<void>(),
		reset: input<void>(),
	},
	states: {
		idle: {
			data: data<{ readonly nextRequestId: number }>(),
			on: {
				start: ({ data, at }): To<'loading'> =>
					at.loading(
						{
							requestId: data.nextRequestId,
							nextRequestId: data.nextRequestId + 1,
							progress: 0,
						},
						[{ do: 'beginWork', requestId: data.nextRequestId }],
					),
			},
		},

		loading: {
			data: data<{
				readonly requestId: number
				readonly nextRequestId: number
				readonly progress: number
			}>(),
			on: {
				progress: ({ data, input, keep, none }): Keep | None =>
					input.requestId !== data.requestId
						? none()
						: keep({ ...data, progress: input.value }),

				succeed: ({ data, input, at, none }): To<'success'> | None =>
					input.requestId !== data.requestId
						? none()
						: at.success({
								result: input.result,
								nextRequestId: data.nextRequestId,
							}),

				fail: ({ data, input, at, none }): To<'failure'> | None =>
					input.requestId !== data.requestId
						? none()
						: at.failure({
								error: input.error,
								nextRequestId: data.nextRequestId,
							}),

				cancel: ({ data, at }): To<'idle'> =>
					at.idle({ nextRequestId: data.nextRequestId }, [
						{ do: 'abandonWork', requestId: data.requestId },
					]),
			},
		},

		success: {
			data: data<{
				readonly result: string
				readonly nextRequestId: number
			}>(),
			on: {
				reset: ({ data, at }): To<'idle'> =>
					at.idle({ nextRequestId: data.nextRequestId }),
			},
		},

		failure: {
			data: data<{ readonly error: string; readonly nextRequestId: number }>(),
			on: {
				reset: ({ data, at }): To<'idle'> =>
					at.idle({ nextRequestId: data.nextRequestId }),
			},
		},
	},
})
