function normalizeRole(role) {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'website' || r === 'inventory') return r;
  return 'owner';
}

function publicAdmin(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: normalizeRole(row.role)
  };
}

function roleLabel(role) {
  const r = normalizeRole(role);
  if (r === 'website') return 'Website';
  if (r === 'inventory') return 'Inventory';
  return 'Owner';
}

module.exports = { normalizeRole, publicAdmin, roleLabel };
