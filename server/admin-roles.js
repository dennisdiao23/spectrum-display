const ACCESS = ['none', 'view', 'edit'];
const OWNER_ROLE_SLUG = 'owner';

const MENU_KEYS = [
  'dashboard', 'chat',
  'website', 'products', 'accounts',
  'inventory', 'warehouses', 'vendors', 'purchase-orders', 'receipt-shipments',
  'customers',
  'sales', 'quotes', 'orders', 'invoices',
  'crm', 'leads', 'pipeline', 'activities',
  'settings', 'company', 'staff'
];

const MENU_GROUPS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'chat', label: 'Chat' },
  {
    key: 'website',
    label: 'Website',
    children: [
      { key: 'products', label: 'Products' },
      { key: 'accounts', label: 'Accounts' }
    ]
  },
  {
    key: 'inventory',
    label: 'Inventory',
    children: [
      { key: 'warehouses', label: 'Location' },
      { key: 'receipt-shipments', label: 'Receipt Shipment' }
    ]
  },
  {
    key: 'vendors',
    label: 'Vendor',
    children: [
      { key: 'purchase-orders', label: 'Purchase Order' }
    ]
  },
  {
    key: 'crm',
    label: 'CRM',
    children: [
      { key: 'leads', label: 'Lead' },
      { key: 'pipeline', label: 'Pipeline' },
      { key: 'activities', label: 'Activity' }
    ]
  },
  {
    key: 'customers',
    label: 'Customer',
    children: [
      { key: 'sales', label: 'Sales' },
      { key: 'quotes', label: 'Sales Quote' },
      { key: 'orders', label: 'Sales Order' },
      { key: 'invoices', label: 'Invoice' }
    ]
  },
  {
    key: 'settings',
    label: 'Settings',
    children: [
      { key: 'company', label: 'Company' },
      { key: 'staff', label: 'Manage users' }
    ]
  }
];

const MENU_PARENT = {
  products: 'website',
  accounts: 'website',
  warehouses: 'inventory',
  'receipt-shipments': 'inventory',
  'purchase-orders': 'vendors',
  leads: 'crm',
  pipeline: 'crm',
  activities: 'crm',
  sales: 'customers',
  quotes: 'customers',
  orders: 'customers',
  invoices: 'customers',
  company: 'settings',
  staff: 'settings'
};

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

/** Child access cannot exceed parent; parent none hides the whole group. */
function gatedAccess(parentLevel, childLevel) {
  const parent = accessLevel(parentLevel);
  if (!canAccess(parent, 'view')) return 'none';
  const child = accessLevel(childLevel);
  if (child === 'none') return 'none';
  if (parent === 'view' && child === 'edit') return 'view';
  return child;
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
    chat: open,
    website: w,
    products: w,
    accounts: w,
    inventory: i,
    warehouses: i,
    vendors: i,
    'purchase-orders': i,
    'receipt-shipments': i,
    customers: open,
    sales: open,
    quotes: open,
    orders: open,
    invoices: open,
    crm: open,
    leads: open,
    pipeline: open,
    activities: open,
    settings: settings ? 'edit' : 'none',
    company: settings ? 'edit' : 'none',
    staff: settings ? 'edit' : 'none'
  };
  return menu;
}

function parseMenuAccess(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const keys = Object.keys(raw);
    if (!keys.length) return null;
    const menu = {};
    MENU_KEYS.forEach(function (key) {
      menu[key] = accessLevel(raw[key]);
    });
    if (raw.crm == null && raw.leads == null && raw.pipeline == null && raw.activities == null) {
      const inherit = accessLevel(raw.customers) === 'none' ? 'none' : accessLevel(raw.customers || 'edit');
      if (raw.customers == null) {
        menu.crm = 'edit';
        menu.leads = 'edit';
        menu.pipeline = 'edit';
        menu.activities = 'edit';
      } else {
        menu.crm = inherit;
        menu.leads = inherit;
        menu.pipeline = inherit;
        menu.activities = inherit;
      }
    }
    return menu;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '{}') return null;
    try {
      return parseMenuAccess(JSON.parse(trimmed));
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
    website: accessLevel(menu && menu.website),
    inventory: accessLevel(menu && menu.inventory),
    settings: accessLevel(menu && menu.settings)
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
  const k = String(key || '');
  const parentKey = MENU_PARENT[k];
  if (parentKey) return gatedAccess(menu[parentKey], menu[k]);
  if (k === 'store' || k === 'traffic' || k === 'control' || k === 'dealers') {
    const childKey = (k === 'dealers') ? 'accounts' : 'products';
    return gatedAccess(menu.website, menu[childKey]);
  }
  if (k === 'forms') return gatedAccess(menu.settings, menu.company);
  return accessLevel(menu[k]);
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
  if (!currentRow && !canAccess(menu.chat, 'view')) menu.chat = 'edit';
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
  // Parent None clears children so nav and API stay aligned.
  Object.keys(MENU_PARENT).forEach(function (childKey) {
    const parentKey = MENU_PARENT[childKey];
    if (!canAccess(menu[parentKey], 'view')) menu[childKey] = 'none';
  });
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
  MENU_PARENT,
  accessLevel,
  canAccess,
  highestAccess,
  gatedAccess,
  slugifyRole,
  defaultMenuAccess,
  legacyPerms,
  menuFromLegacy,
  parseMenuAccess,
  serializeMenuAccess,
  menuAccessFromRow,
  menuLevel,
  hasPerm,
  isOwnerAdmin,
  isOwnerRole,
  OWNER_ROLE_SLUG,
  publicAdmin,
  publicRole,
  permsFromRow,
  summaryFromMenu,
  normalizeMenuInput,
  normalizeRole,
  roleLabel,
  roleInputFromBody,
};
