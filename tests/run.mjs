// Runs every test suite. Usage: node tests/run.mjs
// Each suite asserts on import and prints its own checklist; a thrown
// AssertionError aborts with a non-zero exit code (CI-friendly).
console.log('▶ registry'); await import('./registry.test.mjs');
console.log('\n▶ modes');    await import('./modes.test.mjs');
console.log('\n▶ modeMatrix'); await import('./modeMatrix.test.mjs');
console.log('\n▶ content');  await import('./content.test.mjs');
console.log('\n▶ qaAdapt'); await import('./qaAdapt.test.mjs');
console.log('\n▶ aiContent'); await import('./aiContent.test.mjs');
console.log('\n▶ scoring'); await import('./scoring.test.mjs');
console.log('\n▶ teams'); await import('./teams.test.mjs');
console.log('\n▶ render'); await import('./render.test.mjs');
console.log('\n▶ adapters'); await import('./adapters.test.mjs');
console.log('\n▶ solo');      await import('./solo.test.mjs');
console.log('\n▶ textMarks'); await import('./textMarks.test.mjs');
console.log('\n▶ tcTools'); await import('./tcTools.test.mjs');
console.log('\n▶ tcRevision'); await import('./tcRevision.test.mjs');
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
console.log('\n▶ liveJoin'); await import('./liveJoin.test.mjs');
console.log('\n▶ stressClaim'); await import('./stressClaim.test.mjs');
console.log('\n▶ raceRank'); await import('./raceRank.test.mjs');
console.log('\n▶ raceResume'); await import('./raceResume.test.mjs');
console.log('\n▶ quizAnswer'); await import('./quizAnswer.test.mjs');
console.log('\n▶ quotas'); await import('./quotas.test.mjs');
console.log('\n▶ liveLoops'); await import('./liveLoops.test.mjs');
console.log('\n▶ roundsLoop'); await import('./roundsLoop.test.mjs');
console.log('\n▶ liveEnd'); await import('./liveEnd.test.mjs');
console.log('\n▶ stressTest'); await import('./stressTest.test.mjs');
console.log('\n▶ pbHttp'); await import('./pbHttp.test.mjs');
console.log('\n▶ liveAnswers'); await import('./liveAnswers.test.mjs');
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
// Va DESPUÉS de authGate y en su propio proceso mental: siembra `localStorage`
// con sesiones vencidas, así que si corriera antes contaminaría a las de al lado.
console.log('\n▶ sesionCaducada'); await import('./sesionCaducada.test.mjs');
console.log('\n▶ ranking'); await import('./ranking.test.mjs');
console.log('\n▶ itemStats'); await import('./itemStats.test.mjs');
console.log('\n▶ sessionTable'); await import('./sessionTable.test.mjs');
console.log('\n▶ roles'); await import('./roles.test.mjs');
console.log('\n▶ soloTimer'); await import('./soloTimer.test.mjs');
console.log('\n▶ soloPlayer'); await import('./soloPlayer.test.mjs');
console.log('\n▶ stageClaim'); await import('./stageClaim.test.mjs');
console.log('\n▶ bugReport'); await import('./bugReport.test.mjs');
console.log('\n▶ menu'); await import('./menu.test.mjs');
console.log('\n▶ pbQueries'); await import('./pbQueries.test.mjs');
console.log('\n▶ pbSchema'); await import('./pbSchema.test.mjs');
console.log('\n▶ editorPanels'); await import('./editorPanels.test.mjs');
console.log('\n▶ realtimePort'); await import('./realtimePort.test.mjs');
console.log('\n▶ clock'); await import('./clock.test.mjs');
console.log('\n▶ fechas'); await import('./fechas.test.mjs');
console.log('\n▶ offlineQueue'); await import('./offlineQueue.test.mjs');
console.log('\n▶ ballsort'); await import('./ballsort.test.mjs');
console.log('\n▶ penDetector'); await import('./penDetector.test.mjs');
console.log('\n▶ penVeredicto'); await import('./penVeredicto.test.mjs');
console.log('\n▶ diagram'); await import('./diagram.test.mjs');
console.log('\n▶ styles'); await import('./styles.test.mjs');
console.log('\n▶ templateContract'); await import('./templateContract.test.mjs');
// Tras templateContract: el registro real ya está cargado (homePreview lo necesita
// y algunas suites previas —p.ej. solo— asumen que NO lo está; ver su registerTemplate).
console.log('\n▶ homePreview'); await import('./homePreview.test.mjs');
console.log('\n▶ norms'); await import('./norms.test.mjs');
// Reglas de PocketBase como contrato ejecutable (ley de confianza §22):
// invariantes + anti-divergencia con el script, y el adaptador real jugando
// contra un evaluador de esas reglas (alumno puede jugar / tramposo rebota).
console.log('\n▶ pbRules'); await import('./pbRules.test.mjs');
console.log('\n▶ modeAuth'); await import('./modeAuth.test.mjs');
console.log('\n▶ serverMs'); await import('./serverMs.test.mjs');
console.log('\n▶ serverNow'); await import('./serverNow.test.mjs');
console.log('\n▶ liveGate'); await import('./liveGate.test.mjs');
console.log('\n▶ liveSnapshot'); await import('./liveSnapshot.test.mjs');
console.log('\n▶ taskRules'); await import('./taskRules.test.mjs');
console.log('\n▶ unscorable'); await import('./unscorable.test.mjs');
console.log('\n▶ idempotency'); await import('./idempotency.test.mjs');
console.log('\n▶ liveRules'); await import('./liveRules.test.mjs');
console.log('\n▶ skins'); await import('./skins.test.mjs');
console.log('\n▶ contrast'); await import('./contrast.test.mjs');
console.log('\n▶ ajusteConectado'); await import('./ajusteConectado.test.mjs');
console.log('\n▶ tokenConectado'); await import('./tokenConectado.test.mjs');
console.log('\n▶ vendor'); await import('./vendor.test.mjs');
console.log('\n▶ inventario'); await import('./inventario.test.mjs');
console.log('\n▶ puntosPorAcierto'); await import('./puntosPorAcierto.test.mjs');
console.log('\n▶ effects'); await import('./effects.test.mjs');
console.log('\n▶ activityCheck'); await import('./activityCheck.test.mjs');
console.log('\n▶ publicarListo'); await import('./publicarListo.test.mjs');
console.log('\n▶ imageSearch'); await import('./imageSearch.test.mjs');
console.log('\n▶ newTemplate'); await import('./newTemplate.test.mjs');
console.log('\n▶ activityCard'); await import('./activityCard.test.mjs');
console.log('\n▶ search'); await import('./search.test.mjs');
console.log('\n▶ raceKey'); await import('./raceKey.test.mjs');
console.log('\n▶ duelSummary'); await import('./duelSummary.test.mjs');
console.log('\n▶ playOptions'); await import('./playOptions.test.mjs');
console.log('\n▶ journeys'); await import('./journeys.test.mjs');
console.log('\n▶ kind'); await import('./kind.test.mjs');
console.log('\n▶ vocabulario'); await import('./vocabulario.test.mjs');
console.log('\n▶ nombresRetirados'); await import('./nombresRetirados.test.mjs');
console.log('\n▶ cacheBusting'); await import('./cacheBusting.test.mjs');
console.log('\n▶ docs'); await import('./docs.test.mjs');
console.log('\n▶ qaRonda'); await import('./qaRonda.test.mjs');
console.log('\n▶ layers'); await import('./layers.test.mjs');
console.log('\n▶ moduleRefs'); await import('./moduleRefs.test.mjs');
console.log('\n▶ huerfanos'); await import('./huerfanos.test.mjs');
console.log('\n▶ rutasNorte'); await import('./rutasNorte.test.mjs');
console.log('\n▶ citasFuente'); await import('./citasFuente.test.mjs');
console.log('\n▶ guiones'); await import('./guiones.test.mjs');
console.log('\n▶ temaSinMedidas'); await import('./temaSinMedidas.test.mjs');
console.log('\n▶ temaPorTokens'); await import('./temaPorTokens.test.mjs');
console.log('\n▶ scoringSources'); await import('./scoringSources.test.mjs');
console.log('\n▶ persistPolicy'); await import('./persistPolicy.test.mjs');
console.log('\n▶ afterPlay'); await import('./afterPlay.test.mjs');
console.log('\n▶ deadlineTicker'); await import('./deadlineTicker.test.mjs');
console.log('\n▶ streamWatchdog'); await import('./streamWatchdog.test.mjs');
console.log('\n▶ answerSafety'); await import('./answerSafety.test.mjs');

// GUARDARRAÍL DE DESCUBRIMIENTO (la lección de la tarjeta única, v1.51.388):
// esta lista es ENUMERADA, y una lista enumerada vigila el pasado — una suite
// nueva olvidada aquí simplemente NO corre y todo sigue verde. Se escanea la
// carpeta y se exige que cada *.test.mjs esté citado arriba.
{
  const { readdirSync, readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('./run.mjs', import.meta.url), 'utf8');
  const sinRegistrar = readdirSync(new URL('.', import.meta.url))
    .filter(f => f.endsWith('.test.mjs') && !src.includes(`./${f}`));
  if (sinRegistrar.length) {
    console.error(`\n❌ suites en tests/ que run.mjs NO importa (no corren en CI): ${sinRegistrar.join(', ')}`);
    process.exit(1);
  }
}

console.log('\n✅ all suites passed');
