# 05 — Run the suite against dist

Source of truth: the v1 implementation spec under `plans/`.

**What to build:** a maintainer can verify that what ships behaves like what was
tested — the same guarantees, asserted against the built artifact rather than the
source it came from.

This exists because a suite that only imports source is blind to two real
failures: the `unsafe_*` terser options can change semantics, and the declaration
rollup can alter the public type surface with no runtime symptom at all.

**Blocked by:** 01, 04.

**Status:** ready-for-agent

- [ ] `pnpm test:dist` builds, then runs the **whole existing suite** against the
      built artifact — no test is duplicated to get there
- [ ] Both halves are covered: runtime tests against the minified bundle, type
      tests against the emitted declarations
- [ ] Coverage is disabled for this run — its thresholds are scoped to the source
      directory
- [ ] Redirecting the type pass uses a path mapping, since the type pass resolves
      through the tests' own tsconfig rather than a bundler alias
- [ ] The dist run stays **out** of the default `pnpm test`, so the local edit
      loop does not wait on a build
- [ ] The public sentinel type survives declaration emit — it appears in every
      handler's return type, so the symbol must stay reachable
