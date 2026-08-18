# 03 — v1 runtime, untyped path

Source of truth: the v1 implementation spec under `plans/`.

**What to build:** a working state machine library for a JavaScript consumer.
They can declare a machine from a transition table, start independent hosts from
it, read the current state and the inputs available in it, send inputs, and
observe transitions with patterns — with the ordering guarantees the spec
promises.

**Note on green:** every runtime test passes at the end of this ticket. The
type-test pass stays red until 04, so `pnpm test` as a whole is not yet green.

**Blocked by:** 01 (size feedback loop), 02 (correct target).

**Status:** ready-for-agent

- [ ] The definition parses every transition key **once** into an eager index
      from source state to input name to an ordered list of candidate rows. It
      never mutates, annotates or caches anything on the caller's configuration
      object.
- [ ] `available` falls out of the index's key insertion order — declaration
      order and de-duplication for free, with no `Set`
- [ ] Patterns are parsed **once, at registration**, into three coordinates;
      dispatch compares coordinates, with `*` the wildcard in state positions and
      the empty string the wildcard in the label position. A pattern naming a
      state that does not exist never matches and never throws; a bare key
      likewise.
- [ ] The transition-key splitting helper is shared between the index build and
      pattern registration
- [ ] `skip` is a module-level unique symbol with a single shared function
      returning it — **not** a self-returning function, and not a closure created
      per handler call
- [ ] Host state lives in closure variables; `current` and `available` are
      getters; the definition exposes `start` only
- [ ] The queue is an array with a draining flag reset in a `finally`, so a
      throwing listener leaves the host usable and the flag correct
- [ ] Nothing throws, warns or validates its arguments anywhere
- [ ] The previous generation's exports are deleted, not deprecated
- [ ] The examples are ported to v1 and run
- [ ] Every runtime test in the suite passes
