// Visual smoke test for the VS and TEAMS views. Seeds a demo quiz via the app's
// own storage module (so it lands in the correct user-scoped key), then drives
// each view and captures screenshots. Run: node tools/vs-teams-smoke.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');

const BASE = 'http://localhost:8000';
const OUT = '/tmp/shots';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });

const ACT = {
  id: 'demo-vs', template: 'quiz', title: 'Demo: capitales y sumas',
  content: { items: [
    { id: 'q1', question: '¿Cuánto es 2 + 2?', answer: '4', options: ['3', '4', '5', '6'], points: 1 },
    { id: 'q2', question: 'Capital de Francia', answer: 'París', options: ['Madrid', 'París', 'Roma', 'Berlín'], points: 1 },
    { id: 'q3', question: '¿Cuánto es 3 × 3?', answer: '9', options: ['6', '9', '12', '3'], points: 1 },
    { id: 'q4', question: 'Capital de Japón', answer: 'Tokio', options: ['Pekín', 'Seúl', 'Tokio', 'Bangkok'], points: 1 },
  ] },
  scoring: { mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0 }, rules: {},
};

const log = (...a) => console.log('•', ...a);
const shot = async (page, name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); log('shot', name); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Stub the Supabase SDK CDN: this env has no outbound network, and the app's
// auth helper imports it from esm.sh. VS/Teams don't use auth, so we fulfill a
// tiny fake module so navigation isn't blocked by the (unrelated) auth import.
await page.route('**/esm.sh/**', route => {
  const url = route.request().url();
  if (url.includes('confetti')) {
    return route.fulfill({ contentType: 'application/javascript', body: 'export default function(){}' });
  }
  return route.fulfill({
  contentType: 'application/javascript',
  body: `
    function qb(){const p=Promise.resolve({data:null,error:null});
      const b=new Proxy({},{get(_,k){if(k==='then')return p.then.bind(p);return ()=>b;}});return b;}
    export function createClient(){const u={id:'test'};return{
      auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:u}}),
        signInAnonymously:async()=>({data:{user:u},error:null}),
        onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}}},
      from:()=>qb(),
      storage:{from:()=>({upload:async()=>({error:null}),getPublicUrl:()=>({data:{publicUrl:''}})})},
      channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}}),
      removeChannel(){}
    };}`,
  });
});
page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('console.error:', m.text()); });

// Boot the teacher app, wait until home renders (so storage user is set).
await page.goto(`${BASE}/teacher.html`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 15000 });
await page.waitForTimeout(500);

// Seed via the app's own save() so it uses the live user-scoped key.
await page.evaluate(async (act) => {
  const s = await import('/core/storage.js');
  s.save(act);
}, ACT);
log('seeded demo activity');

const goHash = async (h) => {
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(150);
  await page.evaluate(x => { location.hash = x; }, h);
  await page.waitForTimeout(350);
};

// ---- VS ----
await goHash(`#/vs/${ACT.id}`);
await page.waitForSelector('#vs-start', { timeout: 8000 });
await shot(page, '01-vs-setup');
await page.click('#vs-start');
await page.waitForSelector('.vs-panel .vs-opt', { timeout: 8000 });
await shot(page, '02-vs-start');

// Left answers two correct, right one correct → left should lead.
async function answer(side, text) {
  const btn = page.locator(`.vs-${side} .vs-opt`, { hasText: text }).first();
  await btn.click();
  await page.waitForTimeout(800); // let the flash + next round paint
}
await answer('left', '4');
await answer('left', 'París');
await answer('right', '4'); // right is still on its q1 (2+2) — answer correctly
await shot(page, '03-vs-midgame');
const tug = await page.locator('#vs-tug-label').textContent();
log('tug label mid-game:', tug);

// ---- TEAMS (judge mode) ----
await goHash(`#/teams/${ACT.id}`);
await page.waitForSelector('#teams-start', { timeout: 8000 });
await shot(page, '04-teams-setup');
// pick judge mode explicitly
await page.click('#teams-scoring [data-mode="judge"]');
await page.click('#teams-start');
await page.waitForSelector('.teams-judge', { timeout: 8000 });
await shot(page, '05-teams-board');
// Equipo 1 correct, then advance, Equipo 2 incorrect
await page.click('.teams-judge[data-correct="1"]');
await page.waitForSelector('#teams-next');
await shot(page, '06-teams-reveal');
await page.click('#teams-next');
await page.waitForSelector('.teams-judge');
const turn = await page.locator('.teams-turn .badge').textContent();
log('turn after next:', turn.trim());
await shot(page, '07-teams-turn2');

// ---- TEAMS (auto mode) quick check ----
await goHash(`#/teams/${ACT.id}`);
await page.waitForSelector('#teams-start');
await page.click('#teams-scoring [data-mode="auto"]');
await page.click('#teams-start');
await page.waitForSelector('.teams-opt');
await page.locator('.teams-opt', { hasText: '4' }).first().click();
await page.waitForSelector('#teams-reveal:not([disabled])');
await page.click('#teams-reveal');
await page.waitForSelector('#teams-next');
const score = await page.locator('.teams-chip').first().textContent();
log('auto mode team1 chip after correct:', score.replace(/\s+/g, ' ').trim());
await shot(page, '08-teams-auto-reveal');

await browser.close();
log('DONE');
