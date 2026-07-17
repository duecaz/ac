#!/usr/bin/env node
// Doctor de plantilla — diagnostica UNA plantilla contra el contrato completo y
// las normas transversales, con salida accionable. Reusa los MISMOS checkers de
// CI/admin (core/templateContract.js, core/normsCheck.js): cero lógica propia.
//
//   node tools/check-template.mjs diagram
//   node tools/check-template.mjs            # todas
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import '../core/registerTemplates.js';
import { getTemplate } from '../core/registry.js';
import { checkTemplateContract } from '../core/templateContract.js';
import { scanNormsSource } from '../core/normsCheck.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TDIR = join(ROOT, 'templates');

const arg = process.argv[2];
const names = arg
  ? [arg]
  : readdirSync(TDIR).filter(n => statSync(join(TDIR, n)).isDirectory());

let bad = 0;
for (const name of names) {
  const dir = join(TDIR, name);
  if (!existsSync(dir)) { console.error(`✗ ${name}: no existe templates/${name}/`); bad++; continue; }
  const T = getTemplate(name);
  const issues = T ? checkTemplateContract(T) : ['no registrada en core/registerTemplates.js'];
  // Normas sobre los fuentes de la plantilla.
  const norms = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith('.js'))) {
    norms.push(...scanNormsSource(`templates/${name}/${f}`, readFileSync(join(dir, f), 'utf8')));
  }
  const css = join(ROOT, 'styles', `${name}.css`);
  const hasCss = existsSync(css);

  if (!issues.length && !norms.length) {
    console.log(`✓ ${name} — contrato y normas OK${hasCss ? '' : ' (sin styles/' + name + '.css propio)'}`);
    continue;
  }
  bad++;
  console.log(`✗ ${name}`);
  for (const i of issues) console.log(`    contrato: ${i}`);
  for (const v of norms) console.log(`    norma [${v.rule}] ${v.path}:${v.line} → ${v.text}`);
}
process.exit(bad ? 1 : 0);
