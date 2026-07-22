// Robust extractor for `window.INITIAL_STATE = {...}` — brace-matches, respecting JS strings.
export function extractInitialState(html) {
  const marker = 'window.INITIAL_STATE';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const eq = html.indexOf('=', start);
  let i = html.indexOf('{', eq);
  if (i === -1) return null;
  const objStart = i;
  let depth = 0, inStr = false, quote = '', esc = false;
  for (; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === quote) { inStr = false; continue; }
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  const raw = html.slice(objStart, i);
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { __parseError: e.message, __rawLen: raw.length };
  }
}

// Deep-search: collect every object that has both a lat and lng (or location{lat,lng}).
export function findObjectsWithGeo(node, out = [], seen = new Set()) {
  if (!node || typeof node !== 'object') return out;
  if (seen.has(node)) return out;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const el of node) findObjectsWithGeo(el, out, seen);
    return out;
  }
  const loc = node.location && typeof node.location === 'object' ? node.location : node;
  const lat = loc.lat ?? loc.latitude;
  const lng = loc.lng ?? loc.lon ?? loc.longitude;
  if (typeof lat === 'number' && typeof lng === 'number' && (node.name || node.slug || node.id)) {
    out.push(node);
  }
  for (const k of Object.keys(node)) findObjectsWithGeo(node[k], out, seen);
  return out;
}
