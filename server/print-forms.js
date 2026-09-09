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
  { id: 'customerMessage', label: 'Customer message' },
  { id: 'paymentTerms', label: 'Payment terms' },
  { id: 'contact', label: 'Phone / email' }
];

const LOGOS = [
  { id: '/assets/spectrum-logo-print.jpg', label: 'Print logo' },
  { id: '/assets/spectrum-logo.png', label: 'Spectrum logo' },
  { id: '/assets/spectrum-logo-company.png', label: 'Company wordmark' },
  { id: '', label: 'None' }
];

const FONTS = [
  { id: 'arial', label: 'Arial' },
  { id: 'helvetica', label: 'Helvetica' },
  { id: 'calibri', label: 'Calibri' },
  { id: 'verdana', label: 'Verdana' },
  { id: 'tahoma', label: 'Tahoma' },
  { id: 'times', label: 'Times New Roman' },
  { id: 'georgia', label: 'Georgia' },
  { id: 'garamond', label: 'Garamond' },
  { id: 'courier', label: 'Courier New' }
];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36];
const FONT_STYLES = [
  { id: 'regular', label: 'Regular' },
  { id: 'italic', label: 'Italic' },
  { id: 'bold', label: 'Bold' },
  { id: 'bold-italic', label: 'Bold italic' }
];

function sanitizeFontFamily(value) {
  const id = String(value || '').trim().toLowerCase();
  if (FONTS.some(function (f) { return f.id === id; })) return id;
  return 'arial';
}

function sanitizeFontSize(value) {
  const n = Number(value);
  if (FONT_SIZES.indexOf(n) !== -1) return n;
  return 12;
}

function sanitizeFontStyle(value) {
  const id = String(value || '').trim().toLowerCase();
  if (FONT_STYLES.some(function (s) { return s.id === id; })) return id;
  return 'regular';
}

function sanitizeBlockFonts(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  LAYOUT_IDS.forEach(function (id) {
    if (id === 'logo' || id === 'watermark') return;
    const src = input[id];
    if (!src || typeof src !== 'object') return;
    out[id] = {
      fontFamily: sanitizeFontFamily(src.fontFamily != null ? src.fontFamily : src.font_family),
      fontSize: sanitizeFontSize(src.fontSize != null ? src.fontSize : src.font_size),
      fontStyle: sanitizeFontStyle(src.fontStyle != null ? src.fontStyle : src.font_style)
    };
  });
  return out;
}

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
    { id: 'item', title: 'Item', print: true, order: 1, width: 18 },
    { id: 'description', title: 'Description', print: true, order: 2, width: 44 },
    { id: 'qty', title: 'Qty', print: true, order: 3, width: 8 },
    { id: 'rate', title: 'Rate', print: true, order: 4, width: 14 },
    { id: 'amount', title: 'Amount', print: true, order: 5, width: 16 },
    { id: 'sku', title: 'SKU', print: false, order: 6, width: 16 },
    { id: 'onHand', title: 'On hand', print: false, order: 7, width: 10 },
    { id: 'cost', title: 'Cost', print: false, order: 8, width: 12 }
  ];
}

function headerLayoutId(id) {
  return 'hdr-' + id;
}

const HEADER_LAYOUT_IDS = HEADER_FIELDS.map(function (f) { return headerLayoutId(f.id); });

const LAYOUT_IDS = [
  'company', 'title', 'logo', 'watermark', 'billTo', 'shipTo', 'lines',
  'customerMessage', 'paymentTerms', 'totals', 'contact'
].concat(HEADER_LAYOUT_IDS);

const GRID_COUNT = 90;
const GRID_STEP = 100 / GRID_COUNT;
const GRID_MIN = GRID_STEP;
const MIN_BOX_W = GRID_MIN;
const MIN_BOX_H = GRID_MIN;

const LAYOUT_VERSION = 2;
const LIVE_INSET_X = (0.5 / 8.5) * 100;
const LIVE_INSET_Y = (0.5 / 11) * 100;
const LIVE_W = (7.5 / 8.5) * 100;
const LIVE_H = (10 / 11) * 100;

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

function defaultLayoutV1() {
  return Object.assign({
    company: { x: 0, y: 0, w: 35, h: 10 },
    title: { x: 35, y: 0, w: 30, h: 10 },
    logo: { x: 65, y: 0, w: 35, h: 10 },
    watermark: { x: 10, y: 40, w: 80, h: 20 },
    billTo: { x: 0, y: 10, w: 50, h: 15 },
    shipTo: { x: 50, y: 10, w: 50, h: 15 },
    lines: { x: 0, y: 45, w: 100, h: 24 },
    customerMessage: { x: 0, y: 69, w: 60, h: 7 },
    paymentTerms: { x: 0, y: 76, w: 60, h: 14 },
    totals: { x: 60, y: 69, w: 40, h: 21 },
    contact: { x: 0, y: 95, w: 100, h: 5 }
  }, defaultHeaderLayout());
}

function liveFromOld(box) {
  const b = box && typeof box === 'object' ? box : { x: 0, y: 0, w: 20, h: 8 };
  return {
    x: LIVE_INSET_X + (Number(b.x) / 100) * LIVE_W,
    y: LIVE_INSET_Y + (Number(b.y) / 100) * LIVE_H,
    w: (Number(b.w) / 100) * LIVE_W,
    h: (Number(b.h) / 100) * LIVE_H
  };
}

function mapLayoutFromV1(layout) {
  const out = {};
  LAYOUT_IDS.forEach(function (id) {
    out[id] = liveFromOld(layout[id]);
  });
  return out;
}

function defaultLayout() {
  const mapped = mapLayoutFromV1(defaultLayoutV1());
  const out = {};
  LAYOUT_IDS.forEach(function (id) {
    out[id] = snapBox(mapped[id], GRID_STEP);
  });
  return out;
}

function layoutIsLetter(layout, version) {
  if (Number(version) >= LAYOUT_VERSION) return true;
  if (Number(version) === 1) return false;
  const lines = layout && layout.lines;
  if (lines && Number(lines.w) < 95) return true;
  const company = layout && layout.company;
  if (company && Number(company.x) > 2) return true;
  return false;
}

function snapTo(n, step) {
  const s = Number(step) > 0 ? Number(step) : GRID_STEP;
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v / s) * s;
}

function snapBox(box, step, mode) {
  const s = Number(step) > 0 ? Number(step) : GRID_STEP;
  const move = mode === 'move';
  const min = GRID_MIN;
  let x = snapTo(box.x, s);
  let y = snapTo(box.y, s);
  let w = snapTo(box.w, s);
  let h = snapTo(box.h, s);
  if (!Number.isFinite(w)) w = min;
  if (!Number.isFinite(h)) h = min;
  if (w < min) w = min;
  if (h < min) h = min;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + w > 100) x = Math.max(0, snapTo(100 - w, s));
  if (y + h > 100) y = Math.max(0, snapTo(100 - h, s));
  if (x + w > 100) {
    if (move) x = Math.max(0, 100 - w);
    else w = Math.max(min, snapTo(100 - x, s));
  }
  if (y + h > 100) {
    if (move) y = Math.max(0, 100 - h);
    else h = Math.max(min, snapTo(100 - y, s));
  }
  return { x: x, y: y, w: w, h: h };
}

function sanitizeBox(box, fallback) {
  const src = box && typeof box === 'object' ? box : fallback;
  const fb = fallback || { x: 0, y: 0, w: 20, h: 10 };
  return snapBox({
    x: src.x != null ? src.x : fb.x,
    y: src.y != null ? src.y : fb.y,
    w: src.w != null ? src.w : fb.w,
    h: src.h != null ? src.h : fb.h
  }, GRID_STEP);
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

function sanitizeLayout(input, version) {
  const src = input && typeof input === 'object' ? input : {};
  const letter = layoutIsLetter(src, version);
  const defs = letter ? defaultLayout() : defaultLayoutV1();
  const migrated = Object.assign({}, src);
  const hasHdr = HEADER_LAYOUT_IDS.some(function (id) { return src[id]; });
  if (!hasHdr && src.header) {
    Object.assign(migrated, splitHeaderBand(src.header));
  }
  if (!src.customerMessage && migrated.paymentTerms) {
    const pt = migrated.paymentTerms;
    const h = Number(pt.h) || 15;
    const memoH = Math.min(8, Math.max(5, h * 0.38));
    migrated.customerMessage = { x: pt.x, y: pt.y, w: pt.w, h: memoH };
    migrated.paymentTerms = {
      x: pt.x,
      y: Number(pt.y) + memoH,
      w: pt.w,
      h: Math.max(5, h - memoH)
    };
  }
  if (!src.customerMessage && migrated.totals) {
    const tot = migrated.totals;
    const y = Number(tot.y) || 0;
    const h = Number(tot.h) || 15;
    const contactY = migrated.contact ? Number(migrated.contact.y) : 95;
    const room = Math.max(h, contactY - y - 0.5);
    if (room > h) {
      migrated.totals = { x: tot.x, y: tot.y, w: tot.w, h: room };
    }
  }
  const out = {};
  LAYOUT_IDS.forEach(function (id) {
    out[id] = sanitizeBox(migrated[id], defs[id]);
  });
  if (letter) return out;
  const mapped = mapLayoutFromV1(out);
  LAYOUT_IDS.forEach(function (id) {
    mapped[id] = sanitizeBox(mapped[id], defaultLayout()[id]);
  });
  return mapped;
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
      customerMessage: true,
      paymentTerms: t !== 'po',
      contact: true
    },
    headerFields: headerDefaults(t),
    columns: columnDefaults(),
    layout: defaultLayout(),
    layoutVersion: LAYOUT_VERSION,
    fontFamily: 'arial',
    fontSize: 12,
    fontStyle: 'regular',
    blockFonts: {}
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

const COL_WIDTH_DEFAULTS = {
  item: 18,
  sku: 16,
  description: 44,
  qty: 8,
  rate: 14,
  amount: 16,
  onHand: 10,
  cost: 12
};

function sanitizeColWidth(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 4) return fallback;
  return Math.min(80, Math.round(n * 10) / 10);
}

function sanitizeColumns(incoming, baseCols) {
  const list = mergeList(COLUMNS.map(function (c) {
    const hit = (baseCols || []).find(function (row) { return row.id === c.id; });
    return { id: c.id, label: hit ? hit.title : c.label, print: hit ? hit.print : false };
  }), incoming);
  const byId = {};
  (incoming || []).forEach(function (row) {
    if (row && row.id) byId[String(row.id)] = row;
  });
  list.forEach(function (row) {
    const src = byId[row.id] || {};
    const fallback = COL_WIDTH_DEFAULTS[row.id] || 12;
    row.width = sanitizeColWidth(src.width, fallback);
  });
  return list;
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
    columns: sanitizeColumns(src.columns, base.columns),
    layout: sanitizeLayout(src.layout, src.layoutVersion),
    layoutVersion: LAYOUT_VERSION,
    fontFamily: sanitizeFontFamily(src.fontFamily != null ? src.fontFamily : src.font_family),
    fontSize: sanitizeFontSize(src.fontSize != null ? src.fontSize : src.font_size),
    fontStyle: sanitizeFontStyle(src.fontStyle != null ? src.fontStyle : src.font_style),
    blockFonts: sanitizeBlockFonts(src.blockFonts || src.block_fonts)
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
  FONTS,
  FONT_SIZES,
  FONT_STYLES,
  DEFAULT_PAYMENT,
  typeTitle,
  normalizeType,
  headerLayoutId,
  LAYOUT_VERSION,
  defaultLayout,
  sanitizeLayout,
  defaultTemplate,
  normalizeTemplate,
  parseStored
};
