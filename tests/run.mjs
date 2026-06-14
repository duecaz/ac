// Runs every test suite. Usage: node tests/run.mjs
// Each suite asserts on import and prints its own checklist; a thrown
// AssertionError aborts with a non-zero exit code (CI-friendly).
console.log('▶ registry'); await import('./registry.test.mjs');
console.log('\n▶ modes');    await import('./modes.test.mjs');
console.log('\n▶ modeMatrix'); await import('./modeMatrix.test.mjs');
console.log('\n▶ content');  await import('./content.test.mjs');
console.log('\n▶ qaAdapt'); await import('./qaAdapt.test.mjs');
console.log('\n▶ scoring'); await import('./scoring.test.mjs');
console.log('\n▶ adapters'); await import('./adapters.test.mjs');
console.log('\n▶ solo');      await import('./solo.test.mjs');
console.log('\n▶ textMarks'); await import('./textMarks.test.mjs');
console.log('\n▶ wheel');     await import('./wheel.test.mjs');
console.log('\n▶ core');      await import('./core.test.mjs');
console.log('\n▶ routing');   await import('./routing.test.mjs');
console.log('\n▶ storageMerge'); await import('./storageMerge.test.mjs');
console.log('\n▶ live');      await import('./live.test.mjs');
console.log('\n▶ liveEngine'); await import('./liveEngine.test.mjs');
console.log('\n▶ sessionEngine'); await import('./sessionEngine.test.mjs');
console.log('\n▶ memory'); await import('./memory.test.mjs');
console.log('\n▶ liveLocal'); await import('./liveLocal.test.mjs');
console.log('\n▶ liveText'); await import('./liveText.test.mjs');
console.log('\n▶ simPlay'); await import('./simPlay.test.mjs');
console.log('\n▶ assignments'); await import('./assignments.test.mjs');
console.log('\n✅ all suites passed');
