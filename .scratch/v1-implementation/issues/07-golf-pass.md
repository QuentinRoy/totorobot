# 07 — Golf pass

Source of truth: the v1 implementation spec under `plans/`.

**What to build:** the shipped file gets as small as it can honestly get, and the
next person can tell a deliberate shape from an accident.

Safe to do aggressively only now, because the dist run can catch minifier damage.

**Blocked by:** 05.

**Status:** ready-for-agent

- [ ] The alternatives the spec deliberately left open are tried and measured —
      listener storage (copy-on-write at registration versus a snapshot per
      dispatch), and getters versus assigned properties
- [ ] Terser options are tuned against real numbers rather than assumed
- [ ] Measured deltas are recorded in source comments beside the shape they
      justify, including the alternatives that were rejected and by how much
- [ ] The source still reads normally — real identifier names, no dense
      expression-golf. Minification renames every local and strips every comment,
      so terse spelling is worth exactly zero bytes; only structure moves the
      number.
- [ ] `pnpm test` and `pnpm test:dist` stay green throughout
- [ ] The prototype numbers in the spec are superseded by real ones from the
      actual toolchain — they were measured with a different minifier, on
      sketches that were never run
