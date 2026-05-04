import { SCHEMA_VERSION, DEFAULT_RULES, DEFAULT_SCORING, DEFAULT_REVIEW, DEFAULT_PRESENTATION, DEFAULT_LIVE, DEFAULT_AUTHOR } from './constants.js';

// v1: { id, title, items: [...] }
// v2: introduced rules, scoring, review, presentation
// v3: added live, author, visibility, forkOf, schemaVersion
export function migrate(a) {
  if (!a || typeof a !== 'object') throw new Error('migrate: not an object');
  let v = a.schemaVersion || (a.live ? 3 : a.rules ? 2 : 1);

  if (v < 2) {
    a = { ...a, content: { items: a.items || [] }, rules: { ...DEFAULT_RULES }, scoring: { ...DEFAULT_SCORING }, review: { ...DEFAULT_REVIEW }, presentation: { ...DEFAULT_PRESENTATION } };
    delete a.items;
    v = 2;
  }
  if (v < 3) {
    a = { ...a, live: { ...DEFAULT_LIVE }, author: { ...DEFAULT_AUTHOR }, visibility: 'private', forkOf: null };
    v = 3;
  }
  a.schemaVersion = SCHEMA_VERSION;
  return normalize(a);
}

// Fills missing defaults so legacy or partial activities don't crash the Player.
export function normalize(a) {
  const out = {
    id: a.id,
    title: a.title || 'Sin título',
    subtitle: a.subtitle || '',
    template: a.template || 'quiz',
    schemaVersion: SCHEMA_VERSION,
    content: { items: Array.isArray(a.content?.items) ? a.content.items.map(normalizeItem) : [] },
    rules: { ...DEFAULT_RULES, ...(a.rules || {}) },
    scoring: { ...DEFAULT_SCORING, ...(a.scoring || {}) },
    review: { ...DEFAULT_REVIEW, ...(a.review || {}) },
    presentation: { ...DEFAULT_PRESENTATION, ...(a.presentation || {}) },
    live: { ...DEFAULT_LIVE, ...(a.live || {}) },
    author: { ...DEFAULT_AUTHOR, ...(a.author || {}) },
    visibility: a.visibility || 'private',
    forkOf: a.forkOf || null,
    createdAt: a.createdAt || new Date().toISOString(),
    updatedAt: a.updatedAt || new Date().toISOString()
  };
  return out;
}

function normalizeItem(it, idx) {
  return {
    id: it.id || `q_${idx}_${Math.random().toString(36).slice(2,8)}`,
    question: it.question || '',
    answer: it.answer ?? null,
    options: Array.isArray(it.options) ? it.options : [],
    points: typeof it.points === 'number' ? it.points : 1,
    image: it.image || null,
    audio: it.audio || null
  };
}

export function newActivityId() {
  const n = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += n[Math.floor(Math.random()*n.length)];
  return `act_${s}`;
}

export function newActivity(template = 'quiz') {
  return normalize({
    id: newActivityId(),
    title: 'Nueva actividad',
    template,
    content: { items: [] }
  });
}
