// Contracts: the explicit, typed boundary between the kernel and its plugins.
// These files declare *shapes only* (JSDoc @typedef) — zero runtime code — so
// importing them is free and they never affect behaviour. Enable `// @ts-check`
// in a module to get editor/CI checking against these without a build step.
//
// This barrel re-exports nothing at runtime; it exists so other modules can do
//   /** @typedef {import('../kernel/contracts/index.js').TemplateContract} TemplateContract */
// from a single stable path.

export {};
