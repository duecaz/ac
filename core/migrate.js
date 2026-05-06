// Activity migration. Each step is idempotent.
//   v1: { items[] }
//   v2: + rules, scoring, review, presentation
//   v3: + live, author, visibility, forkOf, schemaVersion
//   v4: + templateVersion, tags[], language, media{}; per-template content migration via T.migrateContent
//
// normalize() runs after migration and fills any missing default. Templates
// supply their own default factories via T.meta.defaultRules / defaultScoring /
// defaultLive / defaultContent.
import { SCHEMA_VERSION, DEFAULT_RULES, DEFAULT_SCORING, DEFAULT_REVIEW, DEFAULT_PRESENTATION, DEFAULT_LIVE, DEFAULT_AUTHOR } from './constants.js';
import { getTemplate } from './registry.js';

const STEPS = {
  1: (a) => {
    a = { ...a, content: { items: a.items || [] }, rules: { ...DEFAULT_RULES }, scoring: { ...DEFAULT_SCORING }, review: { ...DEFAULT_REVIEW }, presentation: { ...DEFAULT_PRESENTATION } };
    delete a.items;
    a.schemaVersion = 2;
    return a;
  },
  2: (a) => {
    a = { ...a, live: { ...DEFAULT_LIVE }, author: { ...DEFAULT_AUTHOR }, visibility: 'private', forkOf: null };
    a.schemaVersion = 3;
    return a;
  },
  3: (a) => {
    a = { ...a, templateVersion: a.templateVersion || 1, tags: a.tags || [], language: a.language || 'es', media: a.media || {} };
    a.schemaVersion = 4;
    return a;
  }
};

export function migrate(a) {
  if (!a || typeof a !== 'object') throw new Error('migrate: not an object');
  let v = a.schemaVersion || (a.live ? 3 : a.rules ? 2 : 1);
  while (v < SCHEMA_VERSION) {
    a = STEPS[v](a);
    v = a.schemaVersion;
  }
  // Per-template content migration if the template knows how.
  const T = getTemplate(a.template);
  if (T?.migrateContent) {
    a.content = T.migrateContent(a.content, a.templateVersion || 1);
    a.templateVersion = T.meta?.templateVersion || a.templateVersion || 1;
  }
  return normalize(a);
}

// Fills missing defaults using the template's factories when available, falling
// back to generic constants. This way each template controls its own defaults.
export function normalize(a) {
  const T = getTemplate(a.template);
  const ruleDefs = T?.meta?.defaultRules?.() || { ...DEFAULT_RULES };
  const scoreDefs = T?.meta?.defaultScoring?.() || { ...DEFAULT_SCORING };
  const liveDefs = T?.meta?.defaultLive?.() || { ...DEFAULT_LIVE };
  const contentDefs = T?.meta?.defaultContent?.() || {};
  return {
    id: a.id,
    title: a.title || 'Sin título',
    subtitle: a.subtitle || '',
    template: a.template || 'quiz',
    templateVersion: a.templateVersion || T?.meta?.templateVersion || 1,
    schemaVersion: SCHEMA_VERSION,
    content: { ...contentDefs, ...(a.content || {}) },
    rules: { ...ruleDefs, ...(a.rules || {}) },
    scoring: { ...scoreDefs, ...(a.scoring || {}) },
    review: { ...DEFAULT_REVIEW, ...(a.review || {}) },
    presentation: { ...DEFAULT_PRESENTATION, ...(a.presentation || {}) },
    live: { ...liveDefs, ...(a.live || {}) },
    author: { ...DEFAULT_AUTHOR, ...(a.author || {}) },
    visibility: a.visibility || 'private',
    forkOf: a.forkOf || null,
    tags: Array.isArray(a.tags) ? a.tags : [],
    language: a.language || 'es',
    media: a.media || {},
    createdAt: a.createdAt || new Date().toISOString(),
    updatedAt: a.updatedAt || new Date().toISOString()
  };
}

export function newActivityId() {
  const n = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += n[Math.floor(Math.random()*n.length)];
  return `act_${s}`;
}

// Counts whatever is the "items" of an activity, regardless of content shape.
// Used by views to display "N elementos" without assuming the template.
export function activityItemCount(a) {
  const c = a?.content || {};
  return (c.items?.length ?? c.entries?.length ?? c.pairs?.length
        ?? c.groups?.length ?? c.words?.length ?? c.passages?.length ?? 0);
}

export function newActivity(template = 'quiz') {
  const T = getTemplate(template);
  const content = T?.meta?.defaultContent?.() || {};
  const presentation = T?.meta?.defaultPresentation?.() || {};
  return normalize({
    id: newActivityId(),
    title: 'Nueva actividad',
    template,
    templateVersion: T?.meta?.templateVersion || 1,
    content,
    presentation
  });
}
