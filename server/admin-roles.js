const ACCESS = ['none', 'view', 'edit'];
const OWNER_ROLE_SLUG = 'owner';

const MENU_KEYS = [
  'dashboard',
  'website', 'products', 'accounts',
  'inventory', 'vendors', 'purchase-orders', 'receipt-shipments',
  'customers',
  'sales', 'quotes', 'orders', 'invoices',
  'settings', 'company', 'staff'
];

const MENU_GROUPS = [
  { key: 'dashboard', label: 'Dashboard' },
  {
    label: 'Website',
    children: [
      { key: 'website', label: 'Website' },
      { key: 'products', label: 'Products' },
      { key: 'accounts', label: 'Accounts' }
    ]
  },
  {
    label: 'Inventory',
    children: [
      { key: 'inventory', label: 'Inventory' },
      { key: 'vendors', label: 'Vendor' },
      { key: 'purchase-orders', label: 'Purchase Order' },
      { key: 'receipt-shipments', label: 'Receipt Shipment' }
    ]
  },
  { key: 'customers', label: 'Customer' },
  {
    label: 'Sales',
    children: [
      { key: 'sales', label: 'Sales' },
      { key: 'quotes', label: 'Sales Quote' },
      { key: 'orders', label: 'Sales Order' },
      { key: 'invoices', label: 'Invoice' }
    ]
  },
  {
    label: 'Settings',
    children: [
      { key: 'settings', label: 'Settings' },
      { key: 'company', label: 'Company' },
      { key: 'staff', label: 'Manage users' }
    ]
  }
];

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

function highestAccess() {
  for (let i = 0; i < arguments.length; i++) {
    if (accessLevel(arguments[i]) === 'edit') return 'edit';
  }
  for (let j = 0; j < arguments.length; j++) {
    if (accessLevel(arguments[j]) === 'view') return 'view';
  }
  return 'none';
}

function slugifyRole(name) {
  let s = String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!s) s = 'role';
  return s.slice(0, 40);
}

function defaultMenuAccess(level) {
  const all = accessLevel(level || 'edit');
  const menu = {};
  MENU_KEYS.forEach(function (key) {
    menu[key] = all;
  });
  return menu;
}

function legacyPerms(role) {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'website') return { website: 'edit', inventory: 'view', settings: false };
  if (r === 'inventory') return { website: 'none', inventory: 'edit', settings: false };
  return { website: 'edit', inventory: 'edit', settings: true };
}

function menuFromLegacy(website, inventory, settings) {
  const w = accessLevel(website);
  const i = accessLevel(inventory);
  const open = 'edit';
  const menu = {
    dashboard: open,
    website: w,
    products: w,
    accounts: w,
    inventory: i,
    vendors: i,
    'purchase-orders': i,
    'receipt-shipments': i,
    customers: open,
    sales: open,
    quotes: open,
    orders: open,
    invoices: open,
    settings: settings ? 'edit' : 'none',
    company: settings ? 'edit' : 'none',
    staff: settings ? 'edit' : 'none'
  };
  return menu;
}

function parseMenuAccess(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const menu = {};
    MENU_KEYS.forEach(function (key) {
      menu[key] = accessLevel(raw[key]);
    });
    return menu;
  }
  if (typeof raw === 'string') {
    try {
      return parseMenuAccess(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }
  return null;
}

function serializeMenuAccess(menu) {
  const out = {};
  MENU_KEYS.forEach(function (key) {
    out[key] = accessLevel(menu && menu[key]);
  });
  return JSON.stringify(out);
}

function menuAccessFromRow(row) {
  if (!row) return menuFromLegacy('edit', 'edit', true);
  const locked = !!(row.locked || row.role_locked || row.slug === 'owner');
  if (locked) return defaultMenuAccess('edit');
  const parsed = parseMenuAccess(row.menu_access);
  if (parsed) return parsed;
  if (row.website_access == null && row.inventory_access == null) {
    const legacy = legacyPerms(row.role || row.slug);
    return menuFromLegacy(legacy.website, legacy.inventory, legacy.settings);
  }
  return menuFromLegacy(row.website_access, row.inventory_access, false);
}

function summaryFromMenu(menu) {
  return {
    website: highestAccess(menu.website, menu.products, menu.accounts),
    inventory: highestAccess(menu.inventory, menu.vendors, menu['purchase-orders'], menu['receipt-shipments']),
    settings: highestAccess(menu.settings, menu.company, menu.staff)
  };
}

function isOwnerRole(role) {
  return String(role || '').toLowerCase().trim() === OWNER_ROLE_SLUG;
}

function permsFromRow(row) {
  if (!row) return Object.assign({ settings: true, menu: defaultMenuAccess('edit') }, summaryFromMenu(defaultMenuAccess('edit')));
  if (isOwnerRole(row.role || row.slug)) {
    const menu = defaultMenuAccess('edit');
    return { settings: true, menu: menu, website: 'edit', inventory: 'edit' };
  }
  const locked = !!(row.locked || row.role_locked || row.slug === OWNER_ROLE_SLUG);
  const menu = menuAccessFromRow(row);
  const summary = summaryFromMenu(menu);
  return {
    settings: locked,
    menu: menu,
    website: summary.website,
    inventory: summary.inventory
  };
}

function normalizeMenuInput(input, fallback) {
  const base = Object.assign({}, fallback || defaultMenuAccess('none'));
  if (!input || typeof input !== 'object') return base;
  MENU_KEYS.forEach(function (key) {
    if (input[key] != null) base[key] = accessLevel(input[key]);
  });
  return base;
}

function publicRole(row, userCount) {
  if (!row) return null;
  const locked = !!row.locked || row.slug === OWNER_ROLE_SLUG;
  const menu = menuAccessFromRow(row);
  const summary = summaryFromMenu(menu);
  const count = Number(userCount) || 0;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    website: summary.website,
    inventory: summary.inventory,
    settings: locked ? 'edit' : summary.settings,
    menu: menu,
    locked: locked,
    ownerRole: row.slug === OWNER_ROLE_SLUG,
    singleUser: row.slug === OWNER_ROLE_SLUG,
    userCount: count
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

function menuLevel(perms, key) {
  if (perms.settings) return 'edit';
  const menu = perms.menu || perms;
  if (key === 'settings') return highestAccess(menu.settings, menu.company, menu.staff);
  if (key === 'website') return highestAccess(menu.website, menu.products, menu.accounts);
  if (key === 'inventory') return highestAccess(menu.inventory, menu.vendors, menu['purchase-orders'], menu['receipt-shipments']);
  return accessLevel(menu[key]);
}

function hasPerm(admin, module, need) {
  const perms = (admin && admin.perms) || permsFromRow(admin);
  if (perms.settings) return true;
  return canAccess(menuLevel(perms, module), need);
}

function isOwnerAdmin(admin) {
  return !!(admin && isOwnerRole(admin.role));
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

function roleInputFromBody(body, currentRow) {
  const fallback = currentRow ? menuAccessFromRow(currentRow) : defaultMenuAccess('none');
  const menu = normalizeMenuInput(body && body.menu, fallback);
  if (body && body.website != null && body.menu == null) {
    const w = accessLevel(body.website);
    menu.website = w;
    menu.products = w;
    menu.accounts = w;
  }
  if (body && body.inventory != null && body.menu == null) {
    const i = accessLevel(body.inventory);
    menu.inventory = i;
    menu.vendors = i;
    menu['purchase-orders'] = i;
    menu['receipt-shipments'] = i;
  }
  const summary = summaryFromMenu(menu);
  return {
    menu: menu,
    menuJson: serializeMenuAccess(menu),
    website: summary.website,
    inventory: summary.inventory
  };
}

module.exports = {
  ACCESS,
  MENU_KEYS,
  MENU_GROUPS,
  accessLevel,
  canAccess,
  highestAccess,
  slugifyRole,
  defaultMenuAccess,
  legacyPerms,
  menuFromLegacy,
  parseMenuAccess,
  serializeMenuAccess,
  menuAccessFromRow,
  summaryFromMenu,
  permsFromRow,
  normalizeMenuInput,
  publicRole,
  publicAdmin,
  menuLevel,
  hasPerm,
  isOwnerAdmin,
  normalizeRole,
  roleLabel,
  roleInputFromBody,
  isOwnerRole,
  OWNER_ROLE_SLUG
};
