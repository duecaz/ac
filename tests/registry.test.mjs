// Lightweight Node test (no framework). Run: node tests/registry.test.mjs
// Verifies the registry validates TemplateContract and fails loudly on the
// mistakes that used to slip through (missing contentModel / live methods).
import assert from 'node:assert';
import { registerTemplate, getTemplate, compatibleTemplates } from '../core/registry.js';

let passed = 0;
const ok = (msg) => { passed++; console.log('  ✓', msg); };

function throws(fn, re, msg) {
  assert.throws(fn, re, msg); ok(msg);
}

// Minimal valid solo template.
const Solo = { meta: { name: 't_solo', contentModel: 'qa', modes: { solo: true } },
               renderPlayer() {}, renderEditor() {} };
registerTemplate(Solo);
assert.strictEqual(getTemplate('t_solo'), Solo); ok('valid solo template registers');

// Missing name.
throws(() => registerTemplate({ meta: {}, renderPlayer(){}, renderEditor(){} }),
       /meta\.name/, 'rejects template without meta.name');

// Missing contentModel.
throws(() => registerTemplate({ meta: { name: 't_nocm', modes: {} }, renderPlayer(){}, renderEditor(){} }),
       /contentModel/, 'rejects template without contentModel');

// Missing renderEditor.
throws(() => registerTemplate({ meta: { name: 't_norender', contentModel: 'qa', modes: {} }, renderPlayer(){} }),
       /renderEditor/, 'rejects template without renderEditor');

// LIVE without getRoundPayload.
throws(() => registerTemplate({ meta: { name: 't_live', contentModel: 'qa', modes: { live: true } },
                                renderPlayer(){}, renderEditor(){}, scoreSubmission(){} }),
       /getRoundPayload/, 'rejects live template missing getRoundPayload');

// LIVE without scoreSubmission.
throws(() => registerTemplate({ meta: { name: 't_live2', contentModel: 'qa', modes: { live: true } },
                                renderPlayer(){}, renderEditor(){}, getRoundPayload(){} }),
       /scoreSubmission/, 'rejects live template missing scoreSubmission');

// compatibleTemplates groups by contentModel and excludes self.
const Solo2 = { meta: { name: 't_solo2', label: 'B', contentModel: 'qa', modes: { solo: true } },
                renderPlayer() {}, renderEditor() {} };
registerTemplate(Solo2);
const compat = compatibleTemplates('t_solo').map(t => t.meta.name);
assert.ok(compat.includes('t_solo2'), 'compatibleTemplates finds same-model template');
assert.ok(!compat.includes('t_solo'), 'compatibleTemplates excludes self');
ok('compatibleTemplates groups by contentModel, excludes self');

console.log(`\nregistry.test: ${passed} assertions passed`);
