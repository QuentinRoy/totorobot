# Composition prototype — issue #24

> **Throwaway.** Nothing here is the library and nothing here is exported from
> `totorobot`. It exists to answer one question and then be captured on a
> branch. See [issue #24](https://github.com/QuentinRoy/totorobot/issues/24).

## The question

Both models are `machine({ initial, inputs, states, transitions })` — v1 — plus
the pieces each one needs to be judged fairly.

**Option A — open transition host** ([`model-a.ts`](model-a.ts)). Adds residency
to `.on`, designed but unbuilt:

```ts
host.on('loading', () => {
	const socket = open()
	return () => socket.close()
})
```

A bare state name is residency; a teardown comes back from the listener; a
self-transition tears down before it sets up. Arrow keys still mean transitions.
Effects and cross-machine wiring are the same mechanism, attached by whoever
instantiates the machine.

**Option B — encapsulated machine** ([`model-b.ts`](model-b.ts)). Same call,
`+ outputs`, `+ actions`, `− the transition feed`:

```ts
machine({
	initial, inputs, states,
	outputs: types<Outputs>(),
	transitions: { … },
	actions: {
		loading: ({ data, send, emit }) => { … },      // residency, per §9
		'draft -cancel> *': ({ emit }) => emit('abandoned'),
	},
})
```

`emit` rides in the action bag beside `send`. The host publishes declared
outputs only: `.on('opened', …)` names an output, never a state or a pattern.
No `current`, no `available`. `inspect()` is issue #24's debugging caveat and
nothing else.

```bash
pnpm proto:composition
```

`[` `]` example · `\` model A/B · `=` scheduler · `0` clear trace · `q` quit.

## Layout

**The FSMs are written out in full in every file.** `a.ts` and `b.ts` each
contain the complete machines, so the two authoring surfaces can be read against
each other line by line. `domain.ts` holds only the non-FSM half — geometry,
labels, and fake widgets with lifetimes so residency has something real to own.

|                                            |                                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| [`ex1-marking-menu/`](ex1-marking-menu/)   | The issue's own evaluation: recognition ⊥ feedback as parallel peers (SwingStates §7.4, Figure 20). |
| [`ex2-gesture-stack/`](ex2-gesture-stack/) | Stacking (SwingStates §7.1): device → gesture → command.                                            |
| [`ex3-accordion/`](ex3-accordion/)         | The ceremony floor (note 05, finding 5): two states, three rows, three instances, rendered.         |

[`dsl.ts`](dsl.ts) restates the library's own type machinery (`Table`,
`Transition`, `Dispatch`), which is module-local on purpose — a prototype that
extends `machine()` has to. [`scheduler.ts`](scheduler.ts) is the shared queue
and its per-host control; [`trace.ts`](trace.ts) makes ordering visible.

Both models are shims over the real host, so pattern strings are not validated
against the vocabulary here (the real `.on` does validate them). Everything else
is faithful: `emits`, action bags and residency `data` are all narrowed exactly
as the library narrows them, verified with deliberate-error tripwires.

## What it costs in bytes

```bash
pnpm proto:composition:size
```

**Shipped**, through the project's own `vite.config.ts` and the same zlib call
`scripts/size.ts` uses, so these are comparable to `pnpm size`:

| variant | raw   | gzip | brotli | Δ vs core |
| ------- | ----- | ---- | ------ | --------- |
| core    | 1 161 | 657  | 584    |           |
| A       | 1 569 | 803  | 730    | +146 B    |
| B       | 1 778 | 912  | 834    | +250 B    |

**B costs +112 B brotli over A** (+203 raw, +107 gzip) — about +18% on the
whole library, and less than the residency feature A needs anyway.

Read the delta, not the absolutes: both models are _layers_ over the host
rather than forks of it, so each pays for a wrapper object, and residency pays
two `.on` registrations where an integrated implementation would hook the
commit directly. The inflation is roughly the same on both sides.

**Authored**, comments and blank lines stripped:

| example           | whole file A/B         | `machine({…})` only A/B          |
| ----------------- | ---------------------- | -------------------------------- |
| ex1 marking menu  | 4 694 / 5 503 B (+809) | 1 354 / 2 246 B (+892, **+66%**) |
| ex2 gesture stack | 4 739 / 5 678 B (+939) | 1 413 / 2 116 B (+703, **+50%**) |
| ex3 accordion     | 1 559 / 1 738 B (+179) | 225 / 349 B (+124, **+55%**)     |

Both columns grow, and that is the answer. The definition grows 50–66% for the
`outputs` block and the emitting `actions`; the **app grows too**, because a
view lifetime the app used to express as one residency listener now needs a
declared pair of outputs plus a variable to re-pair them by hand. B is a net
addition of 11–20% on the whole source, not a relocation.

## What it showed

Observations from driving it, not conclusions.

1. **The transition tables are identical.** Diff `ex1-marking-menu/a.ts` against
   `b.ts`: the two machines are character-for-character the same. The entire
   difference is one extra declared vocabulary plus an `actions` block on one
   side, and the same code living in the app on the other. Neither model touches
   how a machine is written — only who owns what happens next.

2. **Option B earns it in Example 2 and does not in Example 3.** In `ex2`, `up`
   is one state reached from three sources meaning three different things — a
   tap, the end of a long press, the end of a drag. `tap` / `longPress` /
   `dragged` are names the topology does not contain, written once by the author
   who knows the answer, and `'* -> up'` — the obvious wrong pattern — is
   unwritable by a consumer. In `ex3`, `opened` and `closed` restate the state
   names `open` and `closed` and buy nothing. Same feature, opposite verdict, so
   "does `emit` repeat the transition record?" is a property of the machine, not
   of the design.

3. **Every view lifetime costs two output names and manual re-pairing.** Views
   belong to the app under both models — a machine says what happened, the view
   decides what to draw. Under Option A that is one residency listener returning
   its teardown. Under Option B the app cannot see that `feedback` is in
   `trail`, so the machine must publish `trailShown` / `trailHidden`, and the
   app must keep a variable in step to know what to tear down. Three lifetimes
   in this prototype, three times the same bookkeeping — and it is what makes B
   a net addition in the byte table above rather than a relocation.

4. **An action on the initial state emits into the void.** `ex1/b.ts` declares
   `idle: ({ emit }) => emit('ended')`. That runs during `start()`, before the
   app has subscribed to anything, so the first `ended` reaches nobody. Under
   Option A the app registers its listeners in its own order and decides.

5. **The dwell timer is what makes `actions` worth having, and it is the one
   thing `emit` alone does not argue for.** Example 1's timer is scheduled on
   entering `startup` and cancelled on leaving, so `clock.after`'s cancel _is_
   the residency teardown. Under Option B it lives in the definition, so the
   machine is self-contained — import it, start it, dwelling works. Under
   Option A the identical code lives in the app, and an app that forgets it
   gets a machine that silently never reaches `novice`. This is rationale §9's
   kind 3 (the socket test), and it is the strongest argument for `actions` in
   the whole prototype.

6. **Owning the timer deletes the token.** With the dwell scheduled by
   residency, a stale `dwell` cannot arrive — the timer is cancelled on exit —
   so `dwell` is `void`, `startup` no longer carries a `token`, and neither does
   `down`. That is note 08 F7 as corrected by note 02, demonstrated rather than
   argued: the bookkeeping disappears exactly where the timer's lifetime
   coincides with residency.

7. **Two residents of one state want opposite restart policies.** `startup`
   holds the dwell timer, which must survive a wiggle inside the threshold, and
   `trail` holds a redraw, which must restart on every `track`. Both models need
   §9's `persistent` wrapper, and both duplicate silently without it: forget it
   on `novice` and `opened` fires twice. Policy belongs to the action, measured
   in one file.

8. **Residency restart over-fires, identically in both.** Where the policy is
   deliberately restart, `'* -> startup'` under A and a plain residency action
   under B both fire on self-transitions. It is harmless here only because an
   unhandled input is silent — worth knowing before someone "fixes" the noise.

9. **B is blind exactly where debugging happens.** Compare the Example 2 traces:
   under A you see `up -press> down` and `dragging -release> up`; under B a
   press produces no line at all, and a release that correctly did nothing looks
   the same as one that was dropped. Under A, diagnostics and the seam are the
   same mechanism — which is the whole question — but you do get diagnostics.

10. **Rendering is where B hurts, and it hurts on the smallest machine.**
    `ex3/b.ts` calls `inspect()` — the debug channel — every frame, because a UI
    needs the current state and Option B has no public one. The alternative is a
    third output mirroring the state plus a shadow copy at the consumer.

11. **Cross-machine ordering is broken today, under both models.** The queue in
    `src/totorobot.ts:641` is per host, so a send from one host's listener into
    another settles nested inside the first host's notify loop: flat within a
    machine, nested across machines. Press `=` and watch the indentation change.
    The fix — one queue shared by the peers — is about 15 lines, is needed under
    A and B alike, and is orthogonal to whether the protocol is named. Issue
    #24's criterion 3 cannot be met by either option as written.

## Capture

Fold any decision into `docs/api-rationale.md` / `docs/requirements.md`, then
put this directory on a throwaway branch and leave a pointer on issue #24. Main
keeps the decision, not the prototype.
