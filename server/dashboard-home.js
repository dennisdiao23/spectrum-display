const { hasPerm } = require('./admin-roles');
const inv = require('./inventory');
const dbUtil = require('./db');
const analytics = require('./site-analytics');

function emptyCounts() {
  return {
    products: 0,
    productsShown: 0,
    accounts: 0,
    inventory: 0,
    inventoryLow: 0,
    inventoryOut: 0,
    inventoryMoveMonth: 0,
    inventoryValue: 0,
    receipts: 0,
    vendors: 0,
    vendorsWithEmail: 0,
    pos: 0,
    openPos: 0,
    pendingPoValue: 0,
    customers: 0,
    quotes: 0,
    orders: 0,
    invoices: 0,
    sales: 0,
    leads: 0,
    openLeads: 0,
    deals: 0,
    openDeals: 0,
    pipelineValue: 0,
    activities: 0,
    overdueActivities: 0,
    weightedForecast: 0,
    pendingDealerApplications: 0
  };
}

function lastDays(n) {
  const today = analytics.dayStamp();
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(analytics.addDays(today, -i));
  return out;
}

function emptyDaySeries() {
  return lastDays(30).map(function (day) {
    return { day: day, value: 0 };
  });
}

function emptySeries() {
  return {
    website: emptyDaySeries(),
    inventory: emptyDaySeries(),
    vendor: emptyDaySeries(),
    crm: emptyDaySeries(),
    customer: emptyDaySeries()
  };
}

function emptyDashboard(source) {
  return {
    source: source || 'sqlite',
    counts: emptyCounts(),
    series: emptySeries(),
    products: [],
    inventory: [],
    purchaseOrders: [],
    sales: [],
    customers: [],
    accounts: [],
    staff: [],
    leads: [],
    deals: [],
    reminders: [],
    traffic: analytics.emptyTraffic()
  };
}

function monthStartStamp() {
  return analytics.dayStamp().slice(0, 7) + '-01';
}

function kpiRange() {
  const days = lastDays(30);
  const month = monthStartStamp();
  const start = month < days[0] ? month : days[0];
  return {
    days: days,
    month: month,
    start: start,
    fetchStart: analytics.addDays(start, -1)
  };
}

function stampDay(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.length > 10) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return analytics.dayStamp(d);
  }
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : '';
}

function addToMap(map, day, amount) {
  if (!day) return;
  map[day] = (map[day] || 0) + (Number(amount) || 0);
}

function mergeSeries(series, key, map) {
  if (!series || !series[key]) return;
  series[key] = series[key].map(function (row) {
    return { day: row.day, value: Number(map[row.day]) || 0 };
  });
}

function fillWebsiteSeries(series, traffic) {
  const map = {};
  ((traffic && traffic.days) || []).forEach(function (row) {
    map[row.day] = (Number(row.website && row.website.uniques) || 0)
      + (Number(row.store && row.store.uniques) || 0);
  });
  mergeSeries(series, 'website', map);
}

function applyInventoryMoves(rows, counts, series) {
  const range = kpiRange();
  let month = 0;
  const map = {};
  (rows || []).forEach(function (row) {
    if (String(row.kind || '').toLowerCase() === 'transfer') return;
    const day = stampDay(row.created_at || row.createdAt);
    const dollars = Math.abs(Number(row.qty_delta != null ? row.qty_delta : row.qtyDelta) || 0)
      * (Number(row.cost) || 0);
    if (!day) return;
    if (day >= range.month) month += dollars;
    if (day >= range.days[0]) addToMap(map, day, dollars);
  });
  counts.inventoryMoveMonth = month;
  mergeSeries(series, 'inventory', map);
}

function applyPoIssueSeries(rows, series) {
  const range = kpiRange();
  const map = {};
  (rows || []).forEach(function (row) {
    const day = stampDay(row.issue_date || row.issueDate || row.day);
    if (day && day >= range.days[0]) addToMap(map, day, row.n != null ? row.n : row.value);
  });
  mergeSeries(series, 'vendor', map);
}

function applySalesIssueSeries(rows, series) {
  const range = kpiRange();
  const map = {};
  (rows || []).forEach(function (row) {
    const day = stampDay(row.issue_date || row.issueDate || row.day);
    if (day && day >= range.days[0]) addToMap(map, day, row.n != null ? row.n : row.value);
  });
  mergeSeries(series, 'customer', map);
}

function applyLeadCreatedSeries(rows, series) {
  const range = kpiRange();
  const map = {};
  (rows || []).forEach(function (row) {
    const day = stampDay(row.created_at || row.createdAt);
    if (day && day >= range.days[0]) addToMap(map, day, 1);
  });
  mergeSeries(series, 'crm', map);
}

function canSee(admin, module) {
  return hasPerm(admin, module, 'view');
}

function canSeeSales(admin) {
  return canSee(admin, 'sales') || canSee(admin, 'quotes') || canSee(admin, 'orders') || canSee(admin, 'invoices');
}

function canSeeCrm(admin) {
  return canSee(admin, 'crm') || canSee(admin, 'leads') || canSee(admin, 'pipeline') || canSee(admin, 'activities');
}

function canSeeDealerApplications(admin) {
  return canSee(admin, 'dealer-applications') || canSee(admin, 'dealer');
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

function mapLeadPreview(row) {
  return {
    displayName: row.display_name || row.displayName || '',
    companyName: row.company_name || row.companyName || '',
    contactFirst: row.contact_first || row.contactFirst || '',
    contactLast: row.contact_last || row.contactLast || '',
    email: row.email || '',
    phone: row.phone || '',
    status: row.status || '',
    source: row.source || ''
  };
}

function mapDealPreview(row) {
  return {
    title: row.title || '',
    companyName: row.company_name || row.companyName || '',
    stage: row.stage || '',
    value: Number(row.value) || 0,
    expectedClose: row.expected_close || row.expectedClose || ''
  };
}

function mapReminderPreview(row) {
  const dueAt = row.due_at || row.dueAt || '';
  const due = Date.parse(dueAt);
  const overdue = Number.isFinite(due) && due < Date.now() && !(row.done_at || row.doneAt);
  return {
    id: row.id,
    subject: row.subject || '',
    dueAt: dueAt,
    assignedTo: row.assigned_to || row.assignedTo || '',
    leadId: row.lead_id || row.leadId || null,
    dealId: row.deal_id || row.dealId || null,
    leadName: row.lead_name || row.leadName || '',
    dealTitle: row.deal_title || row.dealTitle || '',
    overdue: overdue
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

function sqliteAll(db, sql, params) {
  try {
    const stmt = db.prepare(sql);
    return params && params.length ? stmt.all(...params) : stmt.all();
  } catch (err) {
    return [];
  }
}

function sqliteInventoryKpis(db, counts, series) {
  const range = kpiRange();
  counts.inventoryValue = sqliteCount(db, 'SELECT COALESCE(SUM(qty * COALESCE(cost, 0)), 0) AS n FROM inventory_items');
  applyInventoryMoves(sqliteAll(db, `
    SELECT m.qty_delta, m.kind, m.created_at, COALESCE(i.cost, 0) AS cost
    FROM inventory_item_moves m
    JOIN inventory_items i ON i.id = m.item_id
    WHERE substr(m.created_at, 1, 10) >= ?
  `, [range.fetchStart]), counts, series);
}

function sqliteVendorKpis(db, counts, series) {
  const range = kpiRange();
  counts.openPos = sqliteCount(db, `
    SELECT COUNT(*) AS n FROM purchase_orders WHERE lower(status) = 'open'
  `);
  counts.pendingPoValue = sqliteCount(db, `
    SELECT COALESCE(SUM(l.qty * l.unit_cost), 0) AS n
    FROM purchase_order_lines l
    JOIN purchase_orders p ON p.id = l.po_id
    WHERE lower(p.status) = 'open'
  `);
  applyPoIssueSeries(sqliteAll(db, `
    SELECT p.issue_date, SUM(l.qty * l.unit_cost) AS n
    FROM purchase_orders p
    JOIN purchase_order_lines l ON l.po_id = p.id
    WHERE lower(p.status) != 'cancelled'
      AND p.issue_date >= ?
    GROUP BY p.issue_date
  `, [range.days[0]]), series);
}

function sqliteCustomerKpis(db, series) {
  const range = kpiRange();
  applySalesIssueSeries(sqliteAll(db, `
    SELECT d.issue_date, SUM(l.qty * l.unit_price) AS n
    FROM company_sales_docs d
    JOIN company_sales_lines l ON l.doc_id = d.id
    WHERE d.type IN ('order', 'invoice')
      AND lower(d.status) NOT IN ('cancelled', 'void')
      AND d.issue_date >= ?
    GROUP BY d.issue_date
  `, [range.days[0]]), series);
}

function sqliteCrmKpis(db, series) {
  const range = kpiRange();
  const crm = require('./company-crm');
  applyLeadCreatedSeries(sqliteAll(db, `
    SELECT created_at FROM company_crm_leads
    WHERE NOT ${crm.dealerApplicationLeadSql('')}
      AND substr(created_at, 1, 10) >= ?
  `, [range.fetchStart]), series);
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
    try {
      out.traffic = require('./site-analytics').sqliteTraffic(db);
    } catch (err) {
      out.traffic = require('./site-analytics').emptyTraffic();
    }
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
    sqliteInventoryKpis(db, counts, out.series);
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

  if (canSee(admin, 'purchase-orders') || canSee(admin, 'vendors')) {
    sqliteVendorKpis(db, counts, out.series);
  }

  if (canSee(admin, 'purchase-orders')) {
    counts.pos = sqliteCount(db, 'SELECT COUNT(*) AS n FROM purchase_orders');
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

  const crm = require('./company-crm');
  const notDealerApp = 'NOT ' + crm.dealerApplicationLeadSql('');

  if (canSeeCrm(admin)) {
    counts.leads = sqliteCount(db, 'SELECT COUNT(*) AS n FROM company_crm_leads WHERE ' + notDealerApp);
    counts.openLeads = sqliteCount(db, `
      SELECT COUNT(*) AS n FROM company_crm_leads
      WHERE status IN ('new', 'working', 'qualified')
        AND ${notDealerApp}
    `);
    counts.deals = sqliteCount(db, 'SELECT COUNT(*) AS n FROM company_crm_deals');
    counts.openDeals = sqliteCount(db, `
      SELECT COUNT(*) AS n FROM company_crm_deals
      WHERE stage IN ('new', 'qualified', 'quoted', 'negotiation')
    `);
    counts.pipelineValue = sqliteCount(db, `
      SELECT COALESCE(SUM(value), 0) AS n FROM company_crm_deals
      WHERE stage IN ('new', 'qualified', 'quoted', 'negotiation')
    `);
    counts.weightedForecast = Math.round(sqliteCount(db, `
      SELECT COALESCE(SUM(
        value * CASE
          WHEN probability IS NOT NULL AND probability >= 0 THEN probability
          WHEN stage = 'new' THEN 10
          WHEN stage = 'qualified' THEN 25
          WHEN stage = 'quoted' THEN 50
          WHEN stage = 'negotiation' THEN 75
          ELSE 10
        END / 100.0
      ), 0) AS n FROM company_crm_deals
      WHERE stage IN ('new', 'qualified', 'quoted', 'negotiation')
    `));
    counts.activities = sqliteCount(db, `
      SELECT COUNT(*) AS n FROM company_crm_activities a
      LEFT JOIN company_crm_leads l ON l.id = a.lead_id
      WHERE a.lead_id IS NULL OR a.lead_id = 0 OR NOT ${crm.dealerApplicationLeadSql('l')}
    `);
    counts.overdueActivities = sqliteCount(db, `
      SELECT COUNT(*) AS n FROM company_crm_activities a
      LEFT JOIN company_crm_leads l ON l.id = a.lead_id
      WHERE (a.done_at IS NULL OR a.done_at = '')
        AND a.due_at IS NOT NULL AND a.due_at != ''
        AND datetime(a.due_at) < datetime('now')
        AND (a.lead_id IS NULL OR a.lead_id = 0 OR NOT ${crm.dealerApplicationLeadSql('l')})
    `);
    out.leads = sqliteAll(db, `
      SELECT display_name, company_name, contact_first, contact_last, email, phone, status, source
      FROM company_crm_leads
      WHERE ${notDealerApp}
      ORDER BY datetime(updated_at) DESC, id DESC
      LIMIT 8
    `).map(mapLeadPreview);
    out.deals = sqliteAll(db, `
      SELECT title, company_name, stage, value, expected_close
      FROM company_crm_deals
      WHERE stage IN ('new', 'qualified', 'quoted', 'negotiation')
      ORDER BY datetime(updated_at) DESC, id DESC
      LIMIT 8
    `).map(mapDealPreview);
    out.reminders = sqliteAll(db, `
      SELECT a.id, a.subject, a.due_at, a.assigned_to, a.lead_id, a.deal_id, a.done_at,
        l.display_name AS lead_name, d.title AS deal_title
      FROM company_crm_activities a
      LEFT JOIN company_crm_leads l ON l.id = a.lead_id
      LEFT JOIN company_crm_deals d ON d.id = a.deal_id
      WHERE (a.done_at IS NULL OR a.done_at = '')
        AND a.due_at IS NOT NULL AND a.due_at != ''
        AND (a.lead_id IS NULL OR a.lead_id = 0 OR NOT ${crm.dealerApplicationLeadSql('l')})
      ORDER BY datetime(a.due_at) ASC, a.id ASC
      LIMIT 12
    `).map(mapReminderPreview);
    sqliteCrmKpis(db, out.series);
  }

  if (canSeeDealerApplications(admin)) {
    counts.pendingDealerApplications = sqliteCount(db, `
      SELECT COUNT(*) AS n FROM dealer_applications WHERE status = 'pending'
    `);
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
    sqliteCustomerKpis(db, out.series);
  }

  fillWebsiteSeries(out.series, out.traffic);
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

async function supabaseInventoryKpis(supabase, counts, series) {
  const range = kpiRange();
  const since = range.fetchStart + 'T00:00:00.000Z';
  const [itemsRes, movesRes] = await Promise.all([
    supabase.from('inventory_items').select('id, qty, cost'),
    supabase.from('inventory_item_moves')
      .select('item_id, kind, qty_delta, created_at')
      .gte('created_at', since)
  ]);
  const costById = {};
  let value = 0;
  ((itemsRes && itemsRes.data) || []).forEach(function (row) {
    const cost = Number(row.cost) || 0;
    costById[row.id] = cost;
    value += (Number(row.qty) || 0) * cost;
  });
  counts.inventoryValue = value;
  const moves = ((movesRes && movesRes.data) || []).map(function (row) {
    return {
      kind: row.kind,
      qty_delta: row.qty_delta,
      created_at: row.created_at,
      cost: costById[row.item_id] || 0
    };
  });
  applyInventoryMoves(moves, counts, series);
}

async function supabaseVendorKpis(supabase, counts, series, withPreview) {
  const range = kpiRange();
  const [posRes, openRes, previewRes, recentRes] = await Promise.all([
    withPreview ? countSupabase(supabase, 'purchase_orders') : Promise.resolve(counts.pos),
    countSupabase(supabase, 'purchase_orders', function (q) { return q.ilike('status', 'open'); }),
    withPreview
      ? supabase.from('purchase_orders')
        .select('number, vendor_name, status, issue_date')
        .order('id', { ascending: false })
        .limit(8)
      : Promise.resolve({ data: [] }),
    supabase.from('purchase_orders')
      .select('id, status, issue_date')
      .gte('issue_date', range.days[0])
  ]);
  if (withPreview) {
    counts.pos = posRes;
    counts.openPos = openRes;
  } else {
    counts.openPos = openRes;
  }
  const openRows = await supabase.from('purchase_orders').select('id').ilike('status', 'open');
  const openIds = ((openRows && openRows.data) || []).map(function (row) { return row.id; });
  let pending = 0;
  if (openIds.length) {
    const { data: openLines } = await supabase
      .from('purchase_order_lines')
      .select('po_id, qty, unit_cost')
      .in('po_id', openIds);
    (openLines || []).forEach(function (line) {
      pending += (Number(line.qty) || 0) * (Number(line.unit_cost) || 0);
    });
  }
  counts.pendingPoValue = pending;
  const recent = ((recentRes && recentRes.data) || []).filter(function (row) {
    return String(row.status || '').toLowerCase() !== 'cancelled';
  });
  const recentIds = recent.map(function (row) { return row.id; });
  const byPo = {};
  if (recentIds.length) {
    const { data: lines } = await supabase
      .from('purchase_order_lines')
      .select('po_id, qty, unit_cost')
      .in('po_id', recentIds);
    (lines || []).forEach(function (line) {
      const key = String(line.po_id);
      byPo[key] = (byPo[key] || 0) + (Number(line.qty) || 0) * (Number(line.unit_cost) || 0);
    });
  }
  applyPoIssueSeries(recent.map(function (row) {
    return { issue_date: row.issue_date, n: byPo[String(row.id)] || 0 };
  }), series);
  return ((previewRes && previewRes.data) || []).map(mapPoPreview);
}

async function supabaseCustomerKpis(supabase, series) {
  const range = kpiRange();
  const { data: docs } = await supabase
    .from('company_sales_docs')
    .select('id, type, issue_date, status')
    .in('type', ['order', 'invoice'])
    .gte('issue_date', range.days[0]);
  const usable = (docs || []).filter(function (row) {
    const status = String(row.status || '').toLowerCase();
    return status !== 'cancelled' && status !== 'void';
  });
  const ids = usable.map(function (row) { return row.id; });
  const byDoc = {};
  if (ids.length) {
    const { data: lines } = await supabase
      .from('company_sales_lines')
      .select('doc_id, qty, unit_price')
      .in('doc_id', ids);
    (lines || []).forEach(function (line) {
      const key = String(line.doc_id);
      byDoc[key] = (byDoc[key] || 0) + (Number(line.qty) || 0) * (Number(line.unit_price) || 0);
    });
  }
  applySalesIssueSeries(usable.map(function (row) {
    return { issue_date: row.issue_date, n: byDoc[String(row.id)] || 0 };
  }), series);
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
    tasks.push((async function () {
      out.traffic = await require('./site-analytics').supabaseApi(supabase).getSiteTraffic();
    })().catch(function () {
      out.traffic = require('./site-analytics').emptyTraffic();
    }));
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
      await supabaseInventoryKpis(supabase, counts, out.series);
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

  if (canSee(admin, 'purchase-orders') || canSee(admin, 'vendors')) {
    tasks.push((async function () {
      const preview = await supabaseVendorKpis(
        supabase,
        counts,
        out.series,
        canSee(admin, 'purchase-orders')
      );
      if (canSee(admin, 'purchase-orders')) out.purchaseOrders = preview;
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
      await supabaseCustomerKpis(supabase, out.series);
    })().catch(function () {}));
  }

  if (canSeeCrm(admin)) {
    tasks.push((async function () {
      const crm = require('./company-crm');
      const openDeal = function (q) { return q.in('stage', ['new', 'qualified', 'quoted', 'negotiation']); };
      const [leadRows, deals, openDeals, actRows, dealPreview, openDealRows, reminderPreview] = await Promise.all([
        supabase.from('company_crm_leads')
          .select('id, display_name, company_name, contact_first, contact_last, email, phone, status, source, kind, source_key, created_at')
          .order('updated_at', { ascending: false }),
        countSupabase(supabase, 'company_crm_deals'),
        countSupabase(supabase, 'company_crm_deals', openDeal),
        supabase.from('company_crm_activities').select('id, lead_id, due_at, done_at'),
        supabase.from('company_crm_deals')
          .select('title, company_name, stage, value, expected_close')
          .in('stage', ['new', 'qualified', 'quoted', 'negotiation'])
          .order('updated_at', { ascending: false })
          .limit(8),
        supabase.from('company_crm_deals')
          .select('value, stage, probability')
          .in('stage', ['new', 'qualified', 'quoted', 'negotiation']),
        supabase.from('company_crm_activities')
          .select('id, subject, due_at, assigned_to, lead_id, deal_id, done_at')
          .eq('done_at', '')
          .neq('due_at', '')
          .order('due_at', { ascending: true })
          .limit(24)
      ]);
      const visibleLeads = crm.visibleCrmLeads((leadRows && leadRows.data) || []);
      const visibleActs = crm.hideDealerApplicationActivities
        ? crm.hideDealerApplicationActivities((actRows && actRows.data) || [], (leadRows && leadRows.data) || [])
        : ((actRows && actRows.data) || []);
      counts.leads = visibleLeads.length;
      counts.openLeads = visibleLeads.filter(function (row) {
        return row.status === 'new' || row.status === 'working' || row.status === 'qualified';
      }).length;
      counts.deals = deals;
      counts.openDeals = openDeals;
      counts.activities = visibleActs.length;
      let pipelineValue = 0;
      let weightedForecast = 0;
      ((openDealRows && openDealRows.data) || []).forEach(function (row) {
        const value = Number(row.value) || 0;
        pipelineValue += value;
        const stored = Number(row.probability);
        const p = Number.isFinite(stored) && stored >= 0
          ? stored
          : (row.stage === 'qualified' ? 25 : row.stage === 'quoted' ? 50 : row.stage === 'negotiation' ? 75 : 10);
        weightedForecast += Math.round(value * p / 100);
      });
      counts.pipelineValue = pipelineValue;
      counts.weightedForecast = weightedForecast;
      const now = Date.now();
      counts.overdueActivities = visibleActs.filter(function (row) {
        if (row.done_at) return false;
        const due = Date.parse(row.due_at);
        return Number.isFinite(due) && due < now;
      }).length;
      out.leads = visibleLeads.slice(0, 8).map(mapLeadPreview);
      out.deals = ((dealPreview && dealPreview.data) || []).map(mapDealPreview);
      const reminderRows = crm.hideDealerApplicationActivities
        ? crm.hideDealerApplicationActivities((reminderPreview && reminderPreview.data) || [], (leadRows && leadRows.data) || [])
        : ((reminderPreview && reminderPreview.data) || []);
      out.reminders = reminderRows.slice(0, 12).map(mapReminderPreview);
      applyLeadCreatedSeries(visibleLeads, out.series);
    })().catch(function () {}));
  }

  if (canSeeDealerApplications(admin)) {
    tasks.push((async function () {
      counts.pendingDealerApplications = await countSupabase(supabase, 'dealer_applications', function (q) {
        return q.eq('status', 'pending');
      });
    })().catch(function () {}));
  }

  await Promise.all(tasks);
  fillWebsiteSeries(out.series, out.traffic);
  return out;
}

module.exports = {
  emptyDashboard,
  getSqliteDashboardHome,
  getSupabaseDashboardHome
};
