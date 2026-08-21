const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const SKINS = ['default','classroom','kahoot','retro','jungle','tv-show','arcade'];
const rel = (l) => { const s = l.map(v => { v/=255; return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055,2.4); });
  return .2126*s[0]+.7152*s[1]+.0722*s[2]; };
const parse = (c) => (c.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('http://127.0.0.1:8484/teacher.html', { waitUntil: 'networkidle' });
  console.log('tema        fondo      .vs-body/panel      contraste texto/su fondo');
  for (const skin of SKINS) {
    for (const bg of ['none','notebook']) {
      await p.evaluate(async ({ skin, bg }) => {
        await import('/core/registerTemplates.js');
        const s = await import('/core/storage.js');
        s.save({ id:'act_skin', template:'tildes', title:'T', schemaVersion:4,
          content:{ passages:[{id:'p1',text:'crece a treinta minutos por segundo paso a paso y la naturaleza',marks:[{pos:20,kind:'tilde'}]}] },
          rules:{}, scoring:{}, presentation:{skin,background:bg}, live:{}, updatedAt:'2026-08-01T00:00:00Z' });
        location.hash = '#/mine';
      }, { skin, bg });
      await p.waitForTimeout(200);
      await p.evaluate(() => { location.hash = '#/play/act_skin'; });
      await p.waitForTimeout(900);
      await p.locator('.ww-mode[data-mode="vs"]').click().catch(()=>{});
      await p.waitForTimeout(600);
      await p.locator('.ww-mode-start').click().catch(()=>{});
      try { await p.waitForSelector('.vs-body', { timeout: 8000 }); } catch { console.log(`${skin.padEnd(11)} ${bg.padEnd(10)} (no montó)`); continue; }
      await p.waitForTimeout(600);
      const r = await p.evaluate(() => {
        const body = document.querySelector('.vs-body');
        const panel = body.closest('.vs-panel');
        const txt = body.querySelector('.tc-passage') || body;
        const cs = getComputedStyle(txt);
        let fondo=null, el=txt;
        while (el && !fondo) { const c=getComputedStyle(el).backgroundColor; if (c && !/rgba?\(0, 0, 0, 0\)/.test(c)) fondo=c; el=el.parentElement; }
        return { w: Math.round(body.getBoundingClientRect().width), pw: Math.round(panel.getBoundingClientRect().width), color: cs.color, fondo: fondo||'rgb(255,255,255)' };
      });
      const pct = Math.round(100*r.w/r.pw);
      const ratio = (Math.max(rel(parse(r.color)),rel(parse(r.fondo)))+.05)/(Math.min(rel(parse(r.color)),rel(parse(r.fondo)))+.05);
      console.log(`${skin.padEnd(11)} ${bg.padEnd(10)} ${String(r.w).padStart(4)}/${String(r.pw).padEnd(4)}=${String(pct).padStart(3)}% ${pct<80?'❌ANGOSTO':'      '}  ${ratio.toFixed(2)}:1 ${ratio<3?'❌ILEGIBLE':''}`);
    }
  }
  await b.close();
})();
