// EVALUADOR DE REGLAS DE POCKETBASE — hace de servidor en los tests.
//
// Las reglas de acceso son configuración remota que nadie verifica: pueden estar
// demasiado ABIERTAS (un alumno se auto-puntúa) o demasiado CERRADAS (rompen al
// alumno de verdad, y se descubre en mitad de una clase). Con este evaluador las
// reglas de `core/pbRules.js` se ejecutan contra peticiones simuladas, así que
// las dos formas de fallar se vigilan en CI.
//
// Fuente ÚNICA del evaluador: lo comparten `tests/liveRules.test.mjs` (live) y
// `tests/taskRules.test.mjs` (tareas). Antes vivía dentro del primero.
//
// DIALECTO soportado (el que usamos, nada más):
//   ''                       → abierto        · null → cerrado por API
//   `A || B` · `A && B` · paréntesis
//   `@request.auth.id != ""` · `@request.auth.role = "x"`
//   `@request.body.CAMPO:isset = false` · `@request.body.CAMPO = <literal>`
//   `campo = @request.auth.id` · `campo = "literal"` · `@request.headers.NOMBRE`
//   comparaciones `= != > >= < <=` y sus variantes ANY de PB (`?=`, `?>=`, …)
//   `@collection.COLECCION:alias.CAMPO` → join con otra colección (ANY-match:
//     basta que UNA fila del join cumpla todas las condiciones de ese alias, que
//     es la semántica de PocketBase con los operadores `?`).
//
// Un token no soportado LANZA en vez de devolver false: una regla nueva que el
// evaluador no entienda tiene que romper el test, no pasar de largo.
import assert from 'node:assert';

export function evalRule(rule, ctx) {
  if (rule === '') return true;                 // abierto
  if (rule == null) return false;               // cerrado por API
  return orExpr(String(rule).trim(), ctx || {});
}

function splitTop(expr, op) {
  const parts = [];
  let depth = 0, last = 0;
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === '(') depth++;
    else if (expr[i] === ')') depth--;
    else if (depth === 0 && expr.startsWith(op, i)) { parts.push(expr.slice(last, i)); i += op.length - 1; last = i + 1; }
  }
  parts.push(expr.slice(last));
  return parts.map(s => s.trim());
}

const orExpr = (e, c) => splitTop(e, '||').some(p => andExpr(p, c));

// AND con joins: las condiciones que mencionan `@collection.X:alias` se agrupan
// por alias y se resuelven contra las filas de esa colección (ANY-match). Las
// demás se evalúan tal cual. Así `id ?= body.x && max ?>= body.n` exige que UNA
// MISMA fila cumpla las dos — que es justo el error clásico al escribir estas
// reglas (dos filas distintas cumpliendo una condición cada una).
function andExpr(e, ctx) {
  const parts = splitTop(e, '&&');
  const plain = [];
  const byAlias = new Map();
  for (const p of parts) {
    const m = p.match(/@collection\.([\w_]+)(?::([\w_]+))?\./);
    if (!m) { plain.push(p); continue; }
    const alias = m[2] || m[1];
    // Alias YA atado por un AND de fuera (grupo anidado, p.ej. dentro de un
    // paréntesis con `||`): se evalúa contra ESA fila, no se vuelve a iterar la
    // colección. Sin esto, `(a=1 || max>=n)` dentro de un join escaparía del
    // binding y podría cumplirse con OTRA fila — el error clásico de estas reglas.
    if (ctx._bind && ctx._bind[alias] !== undefined) { plain.push(p); continue; }
    if (!byAlias.has(alias)) byAlias.set(alias, { coll: m[1], parts: [] });
    byAlias.get(alias).parts.push(p);
  }
  if (!plain.every(p => atom(p, ctx))) return false;
  for (const [alias, { coll, parts: cond }] of byAlias) {
    const rows = (ctx.collections || {})[coll] || [];
    const some = rows.some(row => cond.every(p => atom(p, { ...ctx, _bind: { ...(ctx._bind || {}), [alias]: row } })));
    if (!some) return false;
  }
  return true;
}

const OPS = ['?>=', '?<=', '?!=', '?=', '?>', '?<', '>=', '<=', '!=', '=', '>', '<'];

function atom(expr, ctx) {
  let e = expr.trim();
  while (e.startsWith('(') && e.endsWith(')')) e = e.slice(1, -1).trim();
  if (e.includes('||') || e.includes('&&')) return orExpr(e, ctx);

  // Busca el operador de MÁS caracteres primero (?>= antes que >, etc.).
  let op = null, at = -1;
  for (const cand of OPS) {
    const i = findOp(e, cand);
    if (i >= 0 && (at < 0 || i < at || (i === at && cand.length > op.length))) { op = cand; at = i; }
  }
  assert.ok(op, `evaluador: expresión no soportada → "${e}" (¿regla nueva? amplía el evaluador)`);
  const L = resolve(e.slice(0, at).trim(), ctx);
  const R = resolve(e.slice(at + op.length).trim(), ctx);
  return compare(L, op.replace('?', ''), R);
}

// Índice del operador fuera de comillas (una comilla puede contener '=' o '>').
function findOp(e, op) {
  let q = null;
  for (let i = 0; i < e.length; i++) {
    const c = e[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (e.startsWith(op, i)) {
      // No confundir `=` con la cola de `!=`/`>=`/`<=`.
      if (op === '=' && i > 0 && '!><?'.includes(e[i - 1])) continue;
      return i;
    }
  }
  return -1;
}

function compare(L, op, R) {
  switch (op) {
    case '=':  return L === R;
    case '!=': return L !== R;
    case '>':  return num(L) > num(R);
    case '>=': return num(L) >= num(R);
    case '<':  return num(L) < num(R);
    case '<=': return num(L) <= num(R);
    default:   throw new Error(`operador no soportado: ${op}`);
  }
}
const num = (v) => (typeof v === 'number' ? v : Number(v));

function resolve(tok, ctx) {
  if (/^".*"$/.test(tok) || /^'.*'$/.test(tok)) return tok.slice(1, -1);
  if (tok === 'true') return true;
  if (tok === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(tok)) return Number(tok);
  if (tok === '@request.auth.id') return ctx.auth?.id ?? '';
  if (tok === '@request.auth.role') return ctx.auth?.role ?? '';
  const isset = tok.match(/^@request\.body\.([\w.]+):isset$/);
  if (isset) return Object.prototype.hasOwnProperty.call(ctx.body || {}, isset[1]);
  const body = tok.match(/^@request\.body\.([\w.]+)$/);
  if (body) return (ctx.body || {})[body[1]];
  // Cabecera de la petición: PocketBase las normaliza a minúsculas con `_`
  // (`X-WW-Claim` → `x_ww_claim`). Lo mismo hace el ctx de los tests.
  const hdr = tok.match(/^@request\.headers\.([\w]+)$/);
  if (hdr) return (ctx.headers || {})[hdr[1].toLowerCase()];
  // Join con otra colección: la fila la ata andExpr() en ctx._bind[alias].
  const coll = tok.match(/^@collection\.([\w_]+)(?::([\w_]+))?\.([\w.]+)$/);
  if (coll) {
    const alias = coll[2] || coll[1];
    const row = (ctx._bind || {})[alias];
    return row ? row[coll[3]] : undefined;
  }
  assert.ok(!tok.startsWith('@'), `evaluador: token no soportado → "${tok}" (amplía el evaluador)`);
  // Cualquier otro identificador es un campo de la FILA (owner, user, visibility…)
  return (ctx.record || {})[tok];
}
