// Runs every test suite. Usage: node tests/run.mjs
// Each suite asserts on import and prints its own checklist; a thrown
// AssertionError aborts with a non-zero exit code (CI-friendly).
console.log('▶ registry'); await import('./registry.test.mjs');
console.log('\n▶ modes');    await import('./modes.test.mjs');
console.log('\n▶ modeMatrix'); await import('./modeMatrix.test.mjs');
console.log('\n▶ content');  await import('./content.test.mjs');
console.log('\n▶ qaAdapt'); await import('./qaAdapt.test.mjs');
console.log('\n▶ scoring'); await import('./scoring.test.mjs');
console.log('\n▶ teams'); await import('./teams.test.mjs');
console.log('\n▶ render'); await import('./render.test.mjs');
console.log('\n▶ adapters'); await import('./adapters.test.mjs');
console.log('\n▶ solo');      await import('./solo.test.mjs');
console.log('\n▶ textMarks'); await import('./textMarks.test.mjs');
console.log('\n▶ wheel');     await import('./wheel.test.mjs');
console.log('\n▶ core');      await import('./core.test.mjs');
console.log('\n▶ routing');   await import('./routing.test.mjs');
console.log('\n▶ events');    await import('./events.test.mjs');
console.log('\n▶ storageMerge'); await import('./storageMerge.test.mjs');
console.log('\n▶ storage'); await import('./storage.test.mjs');
console.log('\n▶ live');      await import('./live.test.mjs');
console.log('\n▶ liveEngine'); await import('./liveEngine.test.mjs');
console.log('\n▶ sessionEngine'); await import('./sessionEngine.test.mjs');
console.log('\n▶ memory'); await import('./memory.test.mjs');
console.log('\n▶ liveLocal'); await import('./liveLocal.test.mjs');
console.log('\n▶ liveText'); await import('./liveText.test.mjs');
console.log('\n▶ simPlay'); await import('./simPlay.test.mjs');
console.log('\n▶ assignments'); await import('./assignments.test.mjs');
console.log('\n▶ stability'); await import('./stability.test.mjs');
console.log('\n▶ presentation'); await import('./presentation.test.mjs');
console.log('\n▶ security'); await import('./security.test.mjs');
console.log('\n▶ fullscreen'); await import('./fullscreen.test.mjs');
console.log('\n▶ pbAuth'); await import('./pbAuth.test.mjs');
console.log('\n▶ oauth'); await import('./oauth.test.mjs');
console.log('\n▶ authGate'); await import('./authGate.test.mjs');
console.log('\n▶ ranking'); await import('./ranking.test.mjs');
console.log('\n▶ soloTimer'); await import('./soloTimer.test.mjs');
console.log('\n▶ soloPlayer'); await import('./soloPlayer.test.mjs');
console.log('\n▶ clock'); await import('./clock.test.mjs');
console.log('\n▶ offlineQueue'); await import('./offlineQueue.test.mjs');
console.log('\n▶ ballsort'); await import('./ballsort.test.mjs');
console.log('\n▶ penDetector'); await import('./penDetector.test.mjs');
console.log('\n▶ diagram'); await import('./diagram.test.mjs');
console.log('\n▶ styles'); await import('./styles.test.mjs');
console.log('\n▶ templateContract'); await import('./templateContract.test.mjs');
// Tras templateContract: el registro real ya está cargado (homePreview lo necesita
// y algunas suites previas —p.ej. solo— asumen que NO lo está; ver su registerTemplate).
console.log('\n▶ homePreview'); await import('./homePreview.test.mjs');
console.log('\n▶ norms'); await import('./norms.test.mjs');
console.log('\n▶ skins'); await import('./skins.test.mjs');
console.log('\n▶ newTemplate'); await import('./newTemplate.test.mjs');
console.log('\n✅ all suites passed');
