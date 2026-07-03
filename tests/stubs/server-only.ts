// no-op stub — the real "server-only" package unconditionally throws when
// required outside Next's server-component bundling, which breaks plain
// Node test runners. Aliased in vitest.config.ts.
export {};
