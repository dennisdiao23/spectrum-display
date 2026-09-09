function trim(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 240);
}

const TYPES = ['quote', 'order', 'invoice', 'po'];

const HEADER_FIELDS = [
  { id: 'number', label: 'Number' },
  { id: 'date', label: 'Date' },
  { id: 'terms', label: 'Terms' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'poNumber', label: 'P.O. No.' },
  { id: 'soNumber', label: 'S.O. No.' },
  { id: 'tracking', label: 'Tracking No.' },
  { id: 'rep', label: 'Rep' },
  { id: 'account', label: 'Account #' },
  { id: 'shipDate', label: 'Ship Date' },
  { id: 'shipVia', label: 'Ship Via' },
  { id: 'permit', label: 'Permit no.' }
];

const COLUMNS = [
  { id: 'item', label: 'Item' },
  { id: 'sku', label: 'SKU' },
  { id: 'description', label: 'Description' },
  { id: 'qty', label: 'Qty' },
  { id: 'rate', label: 'Rate' },
  { id: 'amount', label: 'Amount' },
  { id: 'onHand', label: 'On hand' },
  { id: 'cost', label: 'Cost' }
];

const BLOCKS = [
  { id: 'logo', label: 'Logo' },
  { id: 'watermark', label: 'Watermark' },
  { id: 'company', label: 'Company address' },
  { id: 'billTo', label: 'Bill To' },
  { id: 'shipTo', label: 'Ship To' },
  { id: 'lines', label: 'Line table' },
  { id: 'totals', label: 'Totals' },
  { id: 'paymentTerms', label: 'Payment terms' },
  { id: 'contact', label: 'Phone / email' }
];

const LOGOS = [
  { id: '/assets/spectrum-logo-print.jpg', label: 'Print logo' },
  { id: '/assets/spectrum-logo.png', label: 'Spectrum logo' },
  { id: '/assets/spectrum-logo-company.png', label: 'Company wordmark' },
  { id: '', label: 'None' }
];

const DEFAULT_PAYMENT =
  'Deposit of 30% is due upon receipt of this invoice. Balance due on shipment. Accepted methods: ACH / wire transfer or company check. Please include invoice number on the remittance. For payment instructions contact accounting at info@spectrumdisplay.com or 844-848-8899';

function typeTitle(type) {
  if (type === 'quote') return 'Sales Quote';
  if (type === 'order') return 'Sales Order';
  if (type === 'po') return 'Purchase Order';
  return 'Invoice';
}

function normalizeType(value) {
  const t = String(value || '').trim().toLowerCase();
  if (TYPES.indexOf(t) !== -1) return t;
  throw new Error('Choose Invoice, Sales Quote, Sales Order, or Purchase Order.');
}

function headerDefaults(type) {
  if (type === 'po') {
    return [
      { id: 'number', title: 'P.O. No.', print: true, order: 1 },
      { id: 'date', title: 'Date', print: true, order: 2 },
      { id: 'dueDate', title: 'Due Date', print: true, order: 3 },
      { id: 'shipVia', title: 'Ship Via', print: true, order: 4 },
      { id: 'permit', title: 'Permit no.', print: true, order: 5 },
      { id: 'tracking', title: 'Tracking No.', print: false, order: 6 }
    ];
  }
  const numberTitle = type === 'quote' ? 'Quote No.' : type === 'order' ? 'S.O. No.' : 'Invoice No.';
  const dateTitle = type === 'invoice' ? 'Inv. Date' : 'Date';
  return [
    { id: 'number', title: numberTitle, print: true, order: 1 },
    { id: 'date', title: dateTitle, print: true, order: 2 },
    { id: 'terms', title: 'Terms', print: true, order: 3 },
    { id: 'dueDate', title: 'Due Date', print: true, order: 4 },
    { id: 'poNumber', title: 'P.O. No.', print: true, order: 5 },
    { id: 'soNumber', title: 'S.O. No.', print: type !== 'order', order: 6 },
    { id: 'tracking', title: 'Tracking No.', print: true, order: 7 },
    { id: 'rep', title: 'Rep', print: true, order: 8 },
    { id: 'account', title: 'Account #', print: true, order: 9 },
    { id: 'shipDate', title: 'Ship Date', print: true, order: 10 },
    { id: 'shipVia', title: 'Ship Via', print: true, order: 11 }
  ];
}

function columnDefaults() {
  return [
    { id: 'item', title: 'Item', print: true, order: 1 },
    { id: 'description', title: 'Description', print: true, order: 2 },
    { id: 'qty', title: 'Qty', print: true, order: 3 },
    { id: 'rate', title: 'Rate', print: true, order: 4 },
    { id: 'amount', title: 'Amount', print: true, order: 5 },
    { id: 'sku', title: 'SKU', print: false, order: 6 },
    { id: 'onHand', title: 'On hand', print: false, order: 7 },
    { id: 'cost', title: 'Cost', print: false, order: 8 }
  ];
}

function headerLayoutId(id) {
  return 'hdr-' + id;
}

const HEADER_LAYOUT_IDS = HEADER_FIELDS.map(function (f) { return headerLayoutId(f.id); });

const LAYOUT_IDS = [
  'company', 'title', 'logo', 'watermark', 'billTo', 'shipTo', 'lines', 'paymentTerms', 'totals', 'contact'
].concat(HEADER_LAYOUT_IDS);

const MIN_BOX_W = 5;
const MIN_BOX_H = 5;
const GRID_COUNT = 90;
const GRID_STEP = 100 / GRID_COUNT;

function defaultHeaderLayout() {
  const out = {};
  const cols = 6;
  const w = 15;
  const h = 10;
  const y0 = 25;
  HEADER_FIELDS.forEach(function (f, i) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    out[headerLayoutId(f.id)] = { x: col * w, y: y0 + row * h, w: w, h: h };
  });
  return out;
}

function defaultLayout() {
  return Object.assign({
    company: { x: 0, y: 0, w: 35, h: 10 },
    title: { x: 35, y: 0, w: 30, h: 10 },
    logo: { x: 65, y: 0, w: 35, h: 10 },
    watermark: { x: 10, y: 40, w: 80, h: 20 },
    billTo: { x: 0, y: 10, w: 50, h: 15 },
    shipTo: { x: 50, y: 10, w: 50, h: 15 },
    lines: { x: 0, y: 45, w: 100, h: 30 },
    paymentTerms: { x: 0, y: 75, w: 60, h: 15 },
    totals: { x: 60, y: 75, w: 40, h: 15 },
    contact: { x: 0, y: 95, w: 100, h: 5 }
  }, defaultHeaderLayout());
}

function snapPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 2) / 2;
}

function clampPct(n, min, max) {
  return Math.min(max, Math.max(min, snapPct(n)));
}

function sanitizeBox(box, fallback) {
  const src = box && typeof box === 'object' ? box : fallback;
  const fb = fallback || { x: 0, y: 0, w: 20, h: 10 };
  let w = clampPct(src.w != null ? src.w : fb.w, MIN_BOX_W, 100);
  let h = clampPct(src.h != null ? src.h : fb.h, MIN_BOX_H, 100);
  let x = clampPct(src.x != null ? src.x : fb.x, 0, 100 - MIN_BOX_W);
  let y = clampPct(src.y != null ? src.y : fb.y, 0, 100 - MIN_BOX_H);
  if (x + w > 100) w = Math.max(MIN_BOX_W, snapPct(100 - x));
  if (y + h > 100) h = Math.max(MIN_BOX_H, snapPct(100 - y));
  return { x: x, y: y, w: w, h: h };
}

function splitHeaderBand(band) {
  const n = HEADER_LAYOUT_IDS.length || 1;
  const w = Math.max(MIN_BOX_W, (Number(band.w) || 100) / n);
  const x0 = Number(band.x) || 0;
  const y = Number(band.y) || 25;
  const h = Number(band.h) || 10;
  const out = {};
  HEADER_LAYOUT_IDS.forEach(function (id, i) {
    out[id] = { x: x0 + i * w, y: y, w: w, h: h };
  });
  return out;
}

function sanitizeLayout(input) {
  const defs = defaultLayout();
  const src = input && typeof input === 'object' ? input : {};
  const migrated = Object.assign({}, src);
  const hasHdr = HEADER_LAYOUT_IDS.some(function (id) { return src[id]; });
  if (!hasHdr && src.header) {
    Object.assign(migrated, splitHeaderBand(src.header));
  }
  const out = {};
  LAYOUT_IDS.forEach(function (id) {
    out[id] = sanitizeBox(migrated[id], defs[id]);
  });
  return out;
}

function defaultTemplate(type) {
  const t = TYPES.indexOf(type) !== -1 ? type : 'invoice';
  return {
    type: t,
    title: typeTitle(t),
    logo: '/assets/spectrum-logo-print.jpg',
    paymentTermsText: DEFAULT_PAYMENT,
    blocks: {
      logo: true,
      watermark: true,
      company: true,
      billTo: true,
      shipTo: true,
      lines: true,
      totals: true,
      paymentTerms: t !== 'po',
      contact: true
    },
    headerFields: headerDefaults(t),
    columns: columnDefaults(),
    layout: defaultLayout()
  };
}

function bool(value, fallback) {
  if (value === undefined || value === null || value === '') return !!fallback;
  return value === true || value === 1 || value === '1' || value === 'true';
}

function mergeList(defs, incoming, extraKeys) {
  const byId = {};
  (incoming || []).forEach(function (row) {
    if (row && row.id) byId[String(row.id)] = row;
  });
  return defs.map(function (def, i) {
    const src = byId[def.id] || {};
    const out = {
      id: def.id,
      title: trim(src.title != null ? src.title : def.label, 40) || def.label,
      print: bool(src.print, def.print !== false),
      order: Number(src.order) > 0 ? Number(src.order) : (i + 1)
    };
    (extraKeys || []).forEach(function (key) {
      if (src[key] != null) out[key] = src[key];
    });
    return out;
  }).sort(function (a, b) { return a.order - b.order || a.id.localeCompare(b.id); })
    .map(function (row, i) { row.order = i + 1; return row; });
}

function normalizeTemplate(type, input) {
  const t = normalizeType(type);
  const src = input && typeof input === 'object' ? input : {};
  const base = defaultTemplate(t);
  const blocks = {};
  BLOCKS.forEach(function (b) {
    const fallback = base.blocks[b.id];
    blocks[b.id] = src.blocks && src.blocks[b.id] != null ? bool(src.blocks[b.id], fallback) : fallback;
  });
  const logo = trim(src.logo != null ? src.logo : base.logo, 240);
  return {
    type: t,
    title: trim(src.title, 80) || base.title,
    logo: logo,
    paymentTermsText: trim(src.paymentTermsText || src.payment_terms_text, 4000) || base.paymentTermsText,
    blocks: blocks,
    headerFields: mergeList(HEADER_FIELDS.map(function (f) {
      const hit = (base.headerFields || []).find(function (row) { return row.id === f.id; });
      return { id: f.id, label: hit ? hit.title : f.label, print: hit ? hit.print : false };
    }), src.headerFields || src.header_fields),
    columns: mergeList(COLUMNS.map(function (c) {
      const hit = (base.columns || []).find(function (row) { return row.id === c.id; });
      return { id: c.id, label: hit ? hit.title : c.label, print: hit ? hit.print : false };
    }), src.columns),
    layout: sanitizeLayout(src.layout)
  };
}

function parseStored(type, raw) {
  if (!raw) return defaultTemplate(type);
  if (typeof raw === 'object') return normalizeTemplate(type, raw);
  try {
    return normalizeTemplate(type, JSON.parse(raw));
  } catch (e) {
    return defaultTemplate(type);
  }
}

module.exports = {
  TYPES,
  HEADER_FIELDS,
  COLUMNS,
  BLOCKS,
  LAYOUT_IDS,
  HEADER_LAYOUT_IDS,
  GRID_STEP,
  GRID_COUNT,
  LOGOS,
  DEFAULT_PAYMENT,
  typeTitle,
  normalizeType,
  headerLayoutId,
  defaultLayout,
  sanitizeLayout,
  defaultTemplate,
  normalizeTemplate,
  parseStored
};
