function asStringList(value, max) {
  if (!Array.isArray(value)) return [];
  return value.map(function (item) {
    return String(item || '').trim().slice(0, 40);
  }).filter(Boolean).slice(0, max || 80);
}

function sanitizeColState(state) {
  if (!state || typeof state !== 'object') return null;
  const widths = {};
  if (state.widths && typeof state.widths === 'object') {
    Object.keys(state.widths).slice(0, 80).forEach(function (key) {
      const id = String(key || '').trim().slice(0, 40);
      const width = String(state.widths[key] || '').trim().slice(0, 20);
      if (id && width) widths[id] = width;
    });
  }
  return {
    order: asStringList(state.order),
    hidden: asStringList(state.hidden),
    sortCol: String(state.sortCol || '').trim().slice(0, 40),
    sortDir: state.sortDir === 'desc' ? 'desc' : (state.sortDir === 'asc' ? 'asc' : ''),
    widths: widths
  };
}

function sanitizeColPrefs(input) {
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  Object.keys(input).slice(0, 40).forEach(function (key) {
    if (!/^[a-z0-9-]{1,40}$/.test(key)) return;
    const state = sanitizeColState(input[key]);
    if (state) out[key] = state;
  });
  return out;
}

function parseColPrefs(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return sanitizeColPrefs(value);
  try {
    return sanitizeColPrefs(JSON.parse(value));
  } catch (err) {
    return {};
  }
}

module.exports = {
  sanitizeColState,
  sanitizeColPrefs,
  parseColPrefs
};
