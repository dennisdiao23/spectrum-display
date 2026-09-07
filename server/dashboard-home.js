const { hasPerm } = require('./admin-roles');
const inv = require('./inventory');
const dbUtil = require('./db');

function emptyCounts() {
  return {
    products: 0,
    productsShown: 0,
    accounts: 0,
    inventory: 0,
    inventoryLow: 0,
    inventoryOut: 0,
    receipts: 0,
    vendors: 0,
    vendorsWithEmail: 0,
    pos: 0,
    openPos: 0,
    customers: 0,
    quotes: 0,
    orders: 0,
    invoices: 0,
    sales: 0
  };
}

function emptyDashboard(source) {
  return {
    source: source || 'sqlite',
    counts: emptyCounts(),
    products: [],
    inventory: [],
    purchaseOrders: [],
    sales: [],
    customers: [],
    accounts: [],
    staff: []
  };
}

function canSee(admin, module) {
  return hasPerm(admin, module, 'view');
}

function canSeeSales(admin) {
  return canSee(admin, 'sales') || canSee(admin, 'quotes') || canSee(admin, 'orders') || canSee(admin, 'invoices');
}

function productPitchLabel(pitchesRaw, type) {
  const pitches = dbUtil.parseJson(pitchesRaw, []);
  if (pitches.length) {
    return pitches[0] + (pitches.length > 1 ? '–' + pitches[pitches.length - 1] : '') + ' mm';
  }
  return String(type || '').toLowerCase() === 'control' ? 'Control' : '';
}

function mapProductPreview(row, brandName) {
  return {
    name: row.name || '',
    brandName: brandName || '',
    type: row.type || '',
    pitchLabel: productPitchLabel(row.pitches, row.type),
    hidden: !!(row.hidden === true || row.hidden === 1 || Number(row.hidden) === 1)
  };
}

function mapInventoryPreview(row, brandName) {
  const qty = Math.max(0, Number(row.qty) || 0);
  const lowAt = row.low_at != null ? Number(row.low_at) : 0;
  const pitch = inv.pitchKey(row.pitch);
  const unit = String(row.unit || '').toLowerCase() === 'each' ? 'each' : 'panels';
  return {
    sku: row.sku || '',
    name: row.name || '',
    brandName: brandName || row.brand_id || '',
    pitchLabel: pitch ? ('P' + pitch) : (unit === 'each' ? 'Each' : '—'),
    qty: qty,
    status: inv.binStatus(qty, lowAt)
  };
}

function mapPoPreview(row) {
  return {
    number: row.number || '',
    vendorName: row.vendor_name || row.vendorName || '',
    status: row.status || '',
    orderDate: row.issue_date || row.issueDate || row.orderDate || ''
  };
}

function mapSalesPreview(row) {
  return {
    type: row.type || '',
    number: row.number || '',
    customerName: row.customer_name || row.customerName || '',
    status: row.status || '',
    total: Number(row.total) || 0
  };
}

function mapCustomerPreview(row) {
  return {
    displayName: row.display_name || row.displayName || '',
    companyName: row.company_name || row.companyName || '',
    contactFirst: row.contact_first || row.contactFirst || '',
    contactLast: row.contact_last || row.contactLast || '',
    email: row.email || '',
    phone: row.phone || '',
    mobile: row.mobile || '',
    billCity: row.bill_city || row.billCity || ''
  };
}

function mapAccountPreview(row) {
  return {
    name: row.name || '',
    email: row.email || '',
    role: row.role || '',
    company: row.company || '',
    created_at: row.created_at || '',
    updated_at: row.updated_at || ''
  };
}

function mapStaffPreview(row) {
  return {
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    role: row.role || '',
    roleName: row.role_name || row.roleName || '',
    created_at: row.created_at || ''
  };
}

function sqliteCount(db, sql) {
  try {
    const row = db.prepare(sql).get();
    return Number(row && row.n) || 0;
  } catch (err) {
    return 0;
  }
}

function sqliteAll(db, sql) {
  try {
    return db.prepare(sql).all();
  } catch (err) {
    return [];
  }
}

function getSqliteDashboardHome(db, admin) {
  const out = emptyDashboard('sqlite');
  const counts = out.counts;

  try {
    const staffRows = sqliteAll(db, `
      SELECT a.id, a.name, a.email, a.role, a.created_at, r.name AS role_name
      FROM admins a
      LEFT JOIN admin_roles r ON r.slug = a.role
      ORDER BY a.created_at DESC
      LIMIT 8
    `);
    out.staff = staffRows.map(mapStaffPreview);
  } catch (err) {
    out.staff = [];
  }

  if (canSee(admin, 'website')) {
    counts.products = sqliteCount(db, 'SELECT COUNT(*) AS n FROM products');
    counts.productsShown = sqliteCount(db, 'SELECT COUNT(*) AS n FROM products WHERE COALESCE(hidden, 0) = 0');
    counts.accounts = 0;
    out.products = sqliteAll(db, `
      SELECT p.name, p.type, p.pitches, p.hidden, b.name AS brand_name
      FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      ORDER BY p.brand_id, p.sort_order, p.name
      LIMIT 8
    `).map(function (row) {
      return mapProductPreview(row, row.brand_name);
    });
    out.accounts = [];
  }

  if (canSee(admin, 'inventory')) {
    counts.inventory = sqliteCount(db, 'SELECT COUNT(*) AS n FROM inventory_items');
    counts.inventoryLow = sqliteCount(db, `
      SELECT COUNT(*) AS n FROM inventory_items
      WHERE qty > 0 AND COALESCE(low_at, 0) > 0 AND qty <= COALESCE(low_at, 0)
    `);
    counts.inventoryOut = sqliteCount(db, `
      SELECT COUNT(*) AS n FROM inventory_items
      WHERE qty <= 0 AND COALESCE(low_at, 0) > 0
    `);
    out.inventory = sqliteAll(db, `
      SELECT i.sku, i.name, i.pitch, i.unit, i.qty, i.low_at, i.brand_id, b.name AS brand_name
      FROM inventory_items i
      LEFT JOIN brands b ON b.id = i.brand_id
      ORDER BY i.name COLLATE NOCASE, i.pitch
      LIMIT 8
    `).map(function (row) {
      return mapInventoryPreview(row, row.brand_name);
    });
  }

  if (canSee(admin, 'receipt-shipments')) {
    counts.receipts = sqliteCount(db, 'SELECT COUNT(*) AS n FROM receipt_shipments');
  }

  if (canSee(admin, 'vendors')) {
    counts.vendors = sqliteCount(db, 'SELECT COUNT(*) AS n FROM inventory_vendors');
    counts.vendorsWithEmail = sqliteCount(db, `
      SELECT COUNT(*) AS n FROM inventory_vendors
      WHERE email IS NOT NULL AND TRIM(email) != ''
    `);
  }

  if (canSee(admin, 'purchase-orders')) {
    counts.pos = sqliteCount(db, 'SELECT COUNT(*) AS n FROM purchase_orders');
    counts.openPos = sqliteCount(db, `
      SELECT COUNT(*) AS n FROM purchase_orders WHERE lower(status) = 'open'
    `);
    out.purchaseOrders = sqliteAll(db, `
      SELECT number, vendor_name, status, issue_date
      FROM purchase_orders
      ORDER BY id DESC
      LIMIT 8
    `).map(mapPoPreview);
  }

  if (canSee(admin, 'customers')) {
    counts.customers = sqliteCount(db, 'SELECT COUNT(*) AS n FROM company_customers');
    out.customers = sqliteAll(db, `
      SELECT display_name, company_name, contact_first, contact_last, email, phone, mobile, bill_city
      FROM company_customers
      ORDER BY company_name COLLATE NOCASE, contact_last COLLATE NOCASE, id DESC
      LIMIT 3
    `).map(mapCustomerPreview);
  }

  if (canSeeSales(admin)) {
    sqliteAll(db, 'SELECT type, COUNT(*) AS n FROM company_sales_docs GROUP BY type').forEach(function (row) {
      const n = Number(row.n) || 0;
      counts.sales += n;
      if (row.type === 'quote') counts.quotes = n;
      else if (row.type === 'order') counts.orders = n;
      else if (row.type === 'invoice') counts.invoices = n;
    });
    out.sales = sqliteAll(db, `
      SELECT type, number, customer_name, status,
        COALESCE((SELECT SUM(qty * unit_price) FROM company_sales_lines WHERE doc_id = company_sales_docs.id), 0) AS total
      FROM company_sales_docs
      ORDER BY id DESC
      LIMIT 5
    `).map(mapSalesPreview);
  }

  return out;
}

async function countSupabase(supabase, table, apply) {
  try {
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
    if (apply) q = apply(q);
    const { count, error } = await q;
    if (error) return 0;
    return Number(count) || 0;
  } catch (err) {
    return 0;
  }
}

async function brandNameMap(supabase) {
  const { data, error } = await supabase.from('brands').select('id, name');
  if (error) return {};
  const map = {};
  (data || []).forEach(function (b) { map[b.id] = b.name; });
  return map;
}

async function getSupabaseDashboardHome(supabase, admin) {
  const out = emptyDashboard('supabase');
  const counts = out.counts;

  const staffTask = (async function () {
    const { data, error } = await supabase
      .from('admins')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: false })
      .limit(8);
    if (error) return [];
    const { data: roles } = await supabase.from('admin_roles').select('slug, name');
    const roleNames = {};
    (roles || []).forEach(function (r) { roleNames[r.slug] = r.name; });
    return (data || []).map(function (row) {
      return mapStaffPreview(Object.assign({}, row, { role_name: roleNames[row.role] || '' }));
    });
  })();

  const tasks = [staffTask.then(function (rows) { out.staff = rows; }).catch(function () { out.staff = []; })];

  if (canSee(admin, 'website')) {
    tasks.push((async function () {
      const [products, hidden, accounts, preview, brands, accountRows] = await Promise.all([
        countSupabase(supabase, 'products'),
        countSupabase(supabase, 'products', function (q) { return q.or('hidden.eq.true,hidden.eq.1'); }),
        countSupabase(supabase, 'profiles'),
        supabase.from('products')
          .select('name, type, pitches, hidden, brand_id')
          .order('brand_id')
          .order('sort_order')
          .order('name')
          .limit(8),
        brandNameMap(supabase),
        supabase.from('profiles')
          .select('name, email, role, company, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(8)
      ]);
      counts.products = products;
      counts.productsShown = Math.max(0, products - hidden);
      counts.accounts = accounts;
      const brandNames = brands;
      out.products = ((preview && preview.data) || []).map(function (row) {
        return mapProductPreview(row, brandNames[row.brand_id] || '');
      });
      out.accounts = ((accountRows && accountRows.data) || []).map(mapAccountPreview);
    })().catch(function () {}));
  }

  if (canSee(admin, 'inventory')) {
    tasks.push((async function () {
      const [total, bins, preview, brands] = await Promise.all([
        countSupabase(supabase, 'inventory_items'),
        supabase.from('inventory_items').select('qty, low_at'),
        supabase.from('inventory_items')
          .select('sku, name, pitch, unit, qty, low_at, brand_id')
          .order('name')
          .order('pitch')
          .limit(8),
        brandNameMap(supabase)
      ]);
      counts.inventory = total;
      let low = 0;
      let outStock = 0;
      ((bins && bins.data) || []).forEach(function (row) {
        const status = inv.binStatus(row.qty, row.low_at);
        if (status === 'low') low += 1;
        else if (status === 'out') outStock += 1;
      });
      counts.inventoryLow = low;
      counts.inventoryOut = outStock;
      const brandNames = brands;
      out.inventory = ((preview && preview.data) || []).map(function (row) {
        return mapInventoryPreview(row, brandNames[row.brand_id] || '');
      });
    })().catch(function () {}));
  }

  if (canSee(admin, 'receipt-shipments')) {
    tasks.push(countSupabase(supabase, 'receipt_shipments').then(function (n) {
      counts.receipts = n;
    }).catch(function () {}));
  }

  if (canSee(admin, 'vendors')) {
    tasks.push((async function () {
      counts.vendors = await countSupabase(supabase, 'inventory_vendors');
      counts.vendorsWithEmail = await countSupabase(supabase, 'inventory_vendors', function (q) {
        return q.neq('email', '');
      });
    })().catch(function () {}));
  }

  if (canSee(admin, 'purchase-orders')) {
    tasks.push((async function () {
      const [pos, openPos, preview] = await Promise.all([
        countSupabase(supabase, 'purchase_orders'),
        countSupabase(supabase, 'purchase_orders', function (q) { return q.ilike('status', 'open'); }),
        supabase.from('purchase_orders')
          .select('number, vendor_name, status, issue_date')
          .order('id', { ascending: false })
          .limit(8)
      ]);
      counts.pos = pos;
      counts.openPos = openPos;
      out.purchaseOrders = ((preview && preview.data) || []).map(mapPoPreview);
    })().catch(function () {}));
  }

  if (canSee(admin, 'customers')) {
    tasks.push((async function () {
      const [n, preview] = await Promise.all([
        countSupabase(supabase, 'company_customers'),
        supabase.from('company_customers')
          .select('display_name, company_name, contact_first, contact_last, email, phone, mobile, bill_city')
          .order('company_name', { ascending: true })
          .order('contact_last', { ascending: true })
          .limit(3)
      ]);
      counts.customers = n;
      out.customers = ((preview && preview.data) || []).map(mapCustomerPreview);
    })().catch(function () {}));
  }

  if (canSeeSales(admin)) {
    tasks.push((async function () {
      const [quotes, orders, invoices] = await Promise.all([
        countSupabase(supabase, 'company_sales_docs', function (q) { return q.eq('type', 'quote'); }),
        countSupabase(supabase, 'company_sales_docs', function (q) { return q.eq('type', 'order'); }),
        countSupabase(supabase, 'company_sales_docs', function (q) { return q.eq('type', 'invoice'); })
      ]);
      counts.quotes = quotes;
      counts.orders = orders;
      counts.invoices = invoices;
      counts.sales = quotes + orders + invoices;
      const { data: preview } = await supabase
        .from('company_sales_docs')
        .select('id, type, number, customer_name, status')
        .order('id', { ascending: false })
        .limit(5);
      const rows = preview || [];
      const ids = rows.map(function (row) { return row.id; });
      const totals = {};
      if (ids.length) {
        const { data: lines } = await supabase
          .from('company_sales_lines')
          .select('doc_id, qty, unit_price')
          .in('doc_id', ids);
        (lines || []).forEach(function (line) {
          const key = String(line.doc_id);
          totals[key] = (totals[key] || 0) + (Number(line.qty) || 0) * (Number(line.unit_price) || 0);
        });
      }
      out.sales = rows.map(function (row) {
        return mapSalesPreview(Object.assign({}, row, { total: totals[String(row.id)] || 0 }));
      });
    })().catch(function () {}));
  }

  await Promise.all(tasks);
  return out;
}

module.exports = {
  emptyDashboard,
  getSqliteDashboardHome,
  getSupabaseDashboardHome
};
