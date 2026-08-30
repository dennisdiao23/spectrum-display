const ACCESS = ['none', 'view', 'edit'];

function accessLevel(value) {
  const v = String(value || 'none').toLowerCase().trim();
  return ACCESS.indexOf(v) === -1 ? 'none' : v;
}

function canAccess(level, need) {
  const have = accessLevel(level);
  if (need === 'edit') return have === 'edit';
  if (need === 'view') return have === 'view' || have === 'edit';
  return false;
}

function slugifyRole(name) {
  let s = String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!s) s = 'role';
  return s.slice(0, 40);
}

function legacyPerms(role) {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'website') return { website: 'edit', inventory: 'view', settings: false };
  if (r === 'inventory') return { website: 'none', inventory: 'edit', settings: false };
  return { website: 'edit', inventory: 'edit', settings: true };
}

function permsFromRow(row) {
  if (!row) return legacyPerms('owner');
  const locked = !!(row.locked || row.role_locked || row.slug === 'owner');
  if (row.website_access == null && row.inventory_access == null) {
    return legacyPerms(row.role || row.slug);
  }
  if (locked) return { website: 'edit', inventory: 'edit', settings: true };
  return {
    website: accessLevel(row.website_access),
    inventory: accessLevel(row.inventory_access),
    settings: false
  };
}

function publicRole(row, userCount) {
  if (!row) return null;
  const locked = !!row.locked;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    website: locked ? 'edit' : accessLevel(row.website_access),
    inventory: locked ? 'edit' : accessLevel(row.inventory_access),
    locked: locked,
    userCount: Number(userCount) || 0
  };
}

function publicAdmin(row) {
  if (!row) return null;
  const perms = permsFromRow(row);
  const role = String(row.role || row.slug || 'owner');
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: role,
    roleName: row.role_name || row.roleName || (role === 'owner' ? 'Owner' : role),
    created_at: row.created_at || row.createdAt || '',
    perms: perms
  };
}

function hasPerm(admin, module, need) {
  const perms = (admin && admin.perms) || permsFromRow(admin);
  if (perms.settings) return true;
  if (module === 'settings') return !!perms.settings;
  return canAccess(perms[module], need);
}

function isOwnerAdmin(admin) {
  return !!(admin && (admin.role === 'owner' || (admin.perms && admin.perms.settings)));
}

function normalizeRole(role) {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'website' || r === 'inventory') return r;
  if (r) return r;
  return 'owner';
}

function roleLabel(role) {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'website') return 'Website';
  if (r === 'inventory') return 'Inventory';
  if (r === 'owner' || !r) return 'Owner';
  return role;
}

module.exports = {
  ACCESS,
  accessLevel,
  canAccess,
  slugifyRole,
  permsFromRow,
  publicRole,
  publicAdmin,
  hasPerm,
  isOwnerAdmin,
  normalizeRole,
  roleLabel
};
