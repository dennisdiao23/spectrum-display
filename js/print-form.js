(function (root) {
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(n) {
    const v = Number(n) || 0;
    return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtDate(value) {
    const s = String(value || '').trim();
    if (!s) return '';
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return Number(m[2]) + '/' + Number(m[3]) + '/' + m[1];
    return s;
  }

  function companyLines(company) {
    const c = company || {};
    const name = c.legalName || c.dba || c.name || 'SPECTRUM DISPLAY INC.';
    const street = [c.street, c.street2].filter(Boolean).join(', ');
    const city = [c.city, c.state, c.zip].filter(Boolean).join(' ');
    const lines = [name];
    if (street) lines.push(street);
    if (city) lines.push(city);
    return lines;
  }

  function addressText(doc, side) {
    if (!doc) return '';
    if (side === 'ship' && doc.shipToText) return String(doc.shipToText).replace(/^—$/, '');
    if (side !== 'ship' && doc.billToText) return String(doc.billToText).replace(/^—$/, '');
    if (doc.kind === 'po' || doc.type === 'po') {
      return side === 'ship' ? (doc.shippingAddress || '') : (doc.mailingAddress || doc.vendorName || '');
    }
    if (side === 'ship') {
      const bits = [doc.shipName || doc.customerName, doc.shipStreet, [doc.shipCity, doc.shipState, doc.shipZip].filter(Boolean).join(', '), doc.shipCountry]
        .filter(Boolean);
      if (bits.length) return bits.join('\n');
    }
    const bits = [doc.billName || doc.customerName, doc.billStreet, [doc.billCity, doc.billState, doc.billZip].filter(Boolean).join(', '), doc.billCountry]
      .filter(Boolean);
    return bits.join('\n') || '';
  }

  function fieldValue(doc, id) {
    const d = doc || {};
    if (id === 'number') return d.number || '';
    if (id === 'date') return fmtDate(d.issueDate);
    if (id === 'terms') return d.paymentTerms || '';
    if (id === 'dueDate') return fmtDate(d.dueDate);
    if (id === 'poNumber') return d.poNumber || '';
    if (id === 'soNumber') return d.soNumber || (d.type === 'order' ? d.number : '');
    if (id === 'tracking') return d.tracking || '';
    if (id === 'rep') return d.rep || '';
    if (id === 'account') return d.account || d.accountNo || '';
    if (id === 'shipDate') return fmtDate(d.shipDate);
    if (id === 'shipVia') return d.shipVia || '';
    if (id === 'permit') return d.permitNo || d.permit || '';
    return '';
  }

  function lineCell(line, id) {
    const row = line || {};
    const empty = !row.sku && !row.item && !row.product && !row.description && !row.qty && !row.unitPrice && !row.rate && !row.amount;
    if (id === 'item') return row.item || row.product || row.sku || '';
    if (id === 'sku') return row.sku || '';
    if (id === 'description') return row.description || row.product || '';
    if (id === 'qty') return row.qty != null && row.qty !== '' ? String(row.qty) : '';
    if (id === 'rate') {
      if (empty) return '';
      return money(row.unitPrice != null ? row.unitPrice : row.rate);
    }
    if (id === 'amount') {
      if (empty) return '';
      if (row.amount != null && row.amount !== '') return money(row.amount);
      const qty = Number(row.qty) || 0;
      const rate = Number(row.unitPrice != null ? row.unitPrice : row.rate) || 0;
      return money(qty * rate);
    }
    if (id === 'onHand') return row.onHand != null && row.onHand !== '' ? String(row.onHand) : '';
    if (id === 'cost') return row.cost != null && row.cost !== '' ? money(row.cost) : '';
    return '';
  }

  function visible(list) {
    return (list || []).filter(function (row) { return row && row.print; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  const COL_MIN = 6;
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

  function columnWidthDefault(id) {
    return COL_WIDTH_DEFAULTS[id] || 12;
  }

  function visibleColumnWidths(columns) {
    const cols = visible(columns);
    if (!cols.length) return [];
    const raw = cols.map(function (c) {
      const w = Number(c && c.width);
      return isFinite(w) && w >= COL_MIN ? w : columnWidthDefault(c.id);
    });
    const sum = raw.reduce(function (a, b) { return a + b; }, 0) || 1;
    return cols.map(function (c, i) {
      return { id: c.id, title: c.title || c.id, width: (raw[i] / sum) * 100 };
    });
  }

  function applyColumnResize(columns, leftId, delta) {
    const widths = visibleColumnWidths(columns);
    const i = widths.findIndex(function (w) { return w.id === leftId; });
    if (i < 0 || i >= widths.length - 1) return columns || [];
    let nextLeft = widths[i].width + Number(delta || 0);
    let nextRight = widths[i + 1].width - Number(delta || 0);
    if (nextLeft < COL_MIN) {
      nextRight += nextLeft - COL_MIN;
      nextLeft = COL_MIN;
    }
    if (nextRight < COL_MIN) {
      nextLeft += nextRight - COL_MIN;
      nextRight = COL_MIN;
    }
    const byId = {};
    widths.forEach(function (w) { byId[w.id] = w.width; });
    byId[widths[i].id] = Math.round(nextLeft * 10) / 10;
    byId[widths[i + 1].id] = Math.round(nextRight * 10) / 10;
    return (columns || []).map(function (col) {
      if (!col || byId[col.id] == null) return col;
      const out = Object.assign({}, col);
      out.width = byId[col.id];
      return out;
    });
  }

  const HEADER_FIELD_IDS = [
    'number', 'date', 'terms', 'dueDate', 'poNumber', 'soNumber', 'tracking',
    'rep', 'account', 'shipDate', 'shipVia', 'permit'
  ];

  const LAYOUT_IDS = [
    'company', 'title', 'logo', 'watermark', 'billTo', 'shipTo', 'lines',
    'customerMessage', 'paymentTerms', 'totals', 'contact'
  ].concat(HEADER_FIELD_IDS.map(function (id) { return 'hdr-' + id; }));

  const GRID_COUNT = 90;
  const GRID_STEP = 100 / GRID_COUNT;
  const GRID_MIN = GRID_STEP;

  const FONTS = [
    { id: 'arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
    { id: 'helvetica', label: 'Helvetica', css: 'Helvetica, Arial, sans-serif' },
    { id: 'calibri', label: 'Calibri', css: 'Calibri, Carlito, sans-serif' },
    { id: 'verdana', label: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
    { id: 'tahoma', label: 'Tahoma', css: 'Tahoma, Geneva, sans-serif' },
    { id: 'times', label: 'Times New Roman', css: '"Times New Roman", Times, serif' },
    { id: 'georgia', label: 'Georgia', css: 'Georgia, serif' },
    { id: 'garamond', label: 'Garamond', css: 'Garamond, "Times New Roman", serif' },
    { id: 'courier', label: 'Courier New', css: '"Courier New", Courier, monospace' }
  ];
  const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36];
  const FONT_STYLES = [
    { id: 'regular', label: 'Regular', weight: 400, italic: false },
    { id: 'italic', label: 'Italic', weight: 400, italic: true },
    { id: 'bold', label: 'Bold', weight: 700, italic: false },
    { id: 'bold-italic', label: 'Bold italic', weight: 700, italic: true }
  ];
  const BLOCK_FONT_PRESET = {
    title: { fontSize: 28, fontStyle: 'bold' },
    company: { fontSize: 18, fontStyle: 'bold' }
  };
  const NO_TYPE_BLOCKS = { logo: true, watermark: true };

  function canTypeBlock(id) {
    return !!id && !NO_TYPE_BLOCKS[id];
  }

  function fontOverride(fonts, id) {
    if (!canTypeBlock(id) || !fonts || typeof fonts !== 'object') return null;
    const ov = fonts[id];
    return ov && typeof ov === 'object' ? ov : null;
  }

  function pick(list, id, fallback) {
    const key = String(id || '').toLowerCase();
    let i = 0;
    for (i = 0; i < list.length; i++) {
      if (list[i].id === key) return list[i];
    }
    return fallback || list[0];
  }

  function fontSpec(tpl) {
    const fam = pick(FONTS, tpl && tpl.fontFamily);
    const style = pick(FONT_STYLES, tpl && tpl.fontStyle);
    let size = Number(tpl && tpl.fontSize);
    if (FONT_SIZES.indexOf(size) === -1) size = 12;
    return {
      familyId: fam.id,
      family: fam.css,
      size: size,
      styleId: style.id,
      weight: style.weight,
      italic: style.italic
    };
  }

  function sheetFontStyle(tpl) {
    const f = fontSpec(tpl);
    return '--pf-family:' + f.family +
      ';--pf-size:' + f.size + 'pt' +
      ';--pf-weight:' + f.weight +
      ';--pf-style:' + (f.italic ? 'italic' : 'normal');
  }

  function effectiveFont(tpl, id) {
    const base = fontSpec(tpl || {});
    const ov = fontOverride(tpl && tpl.blockFonts, id);
    if (ov) return fontSpec(ov);
    const preset = (id && BLOCK_FONT_PRESET[id]) || {};
    return fontSpec({
      fontFamily: base.familyId,
      fontSize: preset.fontSize || base.size,
      fontStyle: preset.fontStyle || base.styleId
    });
  }

  function headerLayoutId(id) {
    return 'hdr-' + id;
  }

  /* v1 = % of the old 7.5×10 in live area. v2 = % of US Letter 8.5×11 in.
     0.5 in inset is Microsoft Word Narrow, which covers HP laser Letter
     (0.25 / 0.20 in) and Canon Letter (0.26 / 0.25 / 0.12 / 0.20 in). */
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
    HEADER_FIELD_IDS.forEach(function (id, i) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      out[headerLayoutId(id)] = { x: col * w, y: y0 + row * h, w: w, h: h };
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
    if (!isFinite(v)) return 0;
    return Math.round(v / s) * s;
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
    const n = HEADER_FIELD_IDS.length || 1;
    const w = Math.max(5, (Number(band.w) || 100) / n);
    const x0 = Number(band.x) || 0;
    const y = Number(band.y) || 25;
    const h = Number(band.h) || 10;
    const out = {};
    HEADER_FIELD_IDS.forEach(function (id, i) {
      out[headerLayoutId(id)] = { x: x0 + i * w, y: y, w: w, h: h };
    });
    return out;
  }

  function mergeLayout(input, version) {
    const src = input && typeof input === 'object' ? input : {};
    const letter = layoutIsLetter(src, version);
    const defs = letter ? defaultLayout() : defaultLayoutV1();
    const migrated = Object.assign({}, src);
    const hasHdr = HEADER_FIELD_IDS.some(function (id) { return src[headerLayoutId(id)]; });
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

  function snapBox(box, step, mode) {
    const s = Number(step) > 0 ? Number(step) : GRID_STEP;
    const move = mode === 'move';
    const min = GRID_MIN;
    let x = snapTo(box.x, s);
    let y = snapTo(box.y, s);
    let w = snapTo(box.w, s);
    let h = snapTo(box.h, s);
    if (!isFinite(w)) w = min;
    if (!isFinite(h)) h = min;
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

  function boxStyle(layout, id) {
    const b = layout[id] || defaultLayout()[id];
    return 'left:' + b.x + '%;top:' + b.y + '%;width:' + b.w + '%;height:' + b.h + '%';
  }

  function wrapAbs(id, inner, layout, edit, off, extraClass, fonts) {
    if (!edit && off) return '';
    const cls = ['pf-abs'];
    if (off) cls.push('is-off');
    if (extraClass) cls.push(extraClass);
    const ov = fontOverride(fonts, id);
    if (ov && id !== 'company') cls.push('is-typed');
    let style = boxStyle(layout, id);
    if (ov && id !== 'company') style += ';' + sheetFontStyle(ov);
    return '<div class="' + cls.join(' ') + '" data-pf-block="' + id + '" style="' + style + '">' +
      inner +
      (edit ? '<span class="pf-resize" aria-hidden="true"></span>' : '') +
      '</div>';
  }

  function ph(label) {
    return '<div class="pf-ph">' + esc(label) + '</div>';
  }

  function sheetHtml(template, data, opts) {
    const tpl = template || {};
    const edit = !!(opts && opts.edit);
    const blocks = tpl.blocks || {};
    const layout = mergeLayout(tpl.layout, tpl.layoutVersion);
    const company = (data && data.company) || {};
    const doc = (data && data.doc) || {};
    const cols = visible(tpl.columns);
    const liveLines = doc.lines && doc.lines.length ? doc.lines.slice() : [];
    const fonts = tpl.blockFonts || {};
    const title = tpl.title || 'Invoice';
    const logo = tpl.logo || '';
    const co = companyLines(company);
    const subtotal = doc.subtotal != null ? Number(doc.subtotal) : Number(doc.total) || 0;
    const discount = Number(doc.discount) || 0;
    const tax = Number(doc.tax) || 0;
    const total = Number(doc.total) || 0;
    const paid = Number(doc.paymentsApplied) || 0;
    const balance = doc.balanceDue != null ? Number(doc.balanceDue) : (total - paid);
    const notes = String(doc.notes || doc.customerMessage || doc.memo || '').trim();
    const phone = company.phone || '';
    const email = company.email || '';

    function paddedLines() {
      const rows = liveLines.slice();
      const box = layout.lines || {};
      const inches = ((Number(box.h) || 24) / 100) * 11;
      const slots = Math.max(rows.length, Math.floor((inches - 0.36) / 0.22));
      while (rows.length < slots) rows.push({});
      return rows;
    }

    let companyInner = '';
    if (blocks.company !== false) {
      const coOv = fontOverride(fonts, 'company');
      companyInner = '<div class="pf-co"><div class="pf-co-name' + (coOv ? ' is-typed' : '') + '"' +
        (coOv ? ' style="' + esc(sheetFontStyle(coOv)) + '"' : '') + '>' + esc(co[0] || '') + '</div>';
      co.slice(1).forEach(function (line) {
        companyInner += '<div>' + esc(line) + '</div>';
      });
      companyInner += '</div>';
    } else {
      companyInner = ph('Company address');
    }

    let logoInner = '';
    if (blocks.logo !== false && logo) {
      logoInner = '<div class="pf-logo"><img src="' + esc(logo) + '" alt="" draggable="false"></div>';
    } else {
      logoInner = ph('Logo');
    }

    let watermarkInner = '';
    if (blocks.watermark !== false) {
      watermarkInner = '<div class="pf-watermark"><img src="/assets/spectrum-watermark.png" alt="" draggable="false"></div>';
    } else {
      watermarkInner = ph('Watermark');
    }

    let billInner = '';
    if (blocks.billTo !== false) {
      billInner = '<div class="pf-box"><div class="pf-box-h">Bill To</div><pre>' +
        esc(addressText(doc, 'bill') || ' ') + '</pre></div>';
    } else {
      billInner = ph('Bill To');
    }

    let shipInner = '';
    if (blocks.shipTo !== false) {
      shipInner = '<div class="pf-box"><div class="pf-box-h">Ship To</div><pre>' +
        esc(addressText(doc, 'ship') || ' ') + '</pre></div>';
    } else {
      shipInner = ph('Ship To');
    }

    let headerHtml = '';
    const headerById = {};
    (tpl.headerFields || []).forEach(function (row) {
      if (row && row.id) headerById[row.id] = row;
    });
    HEADER_FIELD_IDS.forEach(function (id) {
      const row = headerById[id] || { id: id, title: id, print: false };
      const off = !row.print;
      const inner = '<div class="pf-hfield"><div class="pf-hfield-h">' + esc(row.title || id) +
        '</div><div class="pf-hfield-v">' + esc(fieldValue(doc, id)) + '</div></div>';
      headerHtml += wrapAbs(headerLayoutId(id), inner, layout, edit, off, '', fonts);
    });

    let linesInner = '';
    if (blocks.lines !== false) {
      const lines = paddedLines();
      const colWidths = visibleColumnWidths(tpl.columns);
      linesInner = '<div class="pf-lines-box"><table class="pf-lines"><colgroup>';
      colWidths.forEach(function (w) {
        linesInner += '<col data-pf-col="' + esc(w.id) + '" style="width:' + w.width + '%">';
      });
      linesInner += '</colgroup><thead><tr>';
      cols.forEach(function (c) {
        linesInner += '<th data-pf-col="' + esc(c.id) + '">' + esc(c.title || c.id) + '</th>';
      });
      linesInner += '</tr></thead><tbody>';
      lines.forEach(function (line, i) {
        linesInner += '<tr class="' + (i % 2 ? 'is-alt' : '') + '">';
        cols.forEach(function (c) { linesInner += '<td>' + esc(lineCell(line, c.id)) + '</td>'; });
        linesInner += '</tr>';
      });
      linesInner += '</tbody></table>';
      if (edit && colWidths.length > 1) {
        let left = 0;
        linesInner += '<div class="pf-col-resizers">';
        colWidths.forEach(function (w, i) {
          left += w.width;
          if (i === colWidths.length - 1) return;
          linesInner += '<span class="pf-col-resize" data-pf-col="' + esc(w.id) +
            '" style="left:' + left + '%" title="Drag to resize column"></span>';
        });
        linesInner += '</div>';
      }
      linesInner += '</div>';
    } else {
      linesInner = ph('Line table');
    }

    let messageInner = '';
    if (blocks.customerMessage !== false) {
      messageInner = '<div class="pf-msg"><div class="pf-msg-h">Customer message</div><div class="pf-msg-b">' +
        (notes ? esc(notes).replace(/\n/g, '<br>') : '&nbsp;') + '</div></div>';
    } else {
      messageInner = ph('Customer message');
    }

    let termsInner = '';
    if (blocks.paymentTerms !== false && tpl.paymentTermsText) {
      termsInner = '<div class="pf-terms"><div class="pf-terms-h">PAYMENT TERMS</div><div>' +
        esc(tpl.paymentTermsText).replace(/\n/g, '<br>') + '</div></div>';
    } else {
      termsInner = ph('Payment terms');
    }

    let totalsInner = '';
    if (blocks.totals !== false) {
      totalsInner = '<div class="pf-totals">';
      totalsInner += '<div><span>Subtotal</span><b>' + money(subtotal) + '</b></div>';
      totalsInner += '<div><span>Discount</span><b>' + money(discount) + '</b></div>';
      totalsInner += '<div><span>Tax</span><b>' + money(tax) + '</b></div>';
      totalsInner += '<div class="is-total"><span>Total</span><b>' + money(total) + '</b></div>';
      totalsInner += '<div><span>Payments applied</span><b>' + money(paid) + '</b></div>';
      totalsInner += '<div class="is-due"><span>Balance due</span><b>' + money(balance) + '</b></div>';
      totalsInner += '</div>';
    } else {
      totalsInner = ph('Totals');
    }

    let contactInner = '';
    if (blocks.contact !== false && (phone || email)) {
      contactInner = '<div class="pf-contact">' +
        (phone ? 'Phone # ' + esc(phone) : '') +
        (phone && email ? ' &nbsp; ' : '') +
        (email ? 'E-mail ' + esc(email) : '') +
        '</div>';
    } else if (blocks.contact !== false) {
      contactInner = '<div class="pf-contact"></div>';
    } else {
      contactInner = ph('Phone / email');
    }

    return '<div class="pf-sheet is-abs' + (edit ? ' is-edit is-grid' : '') +
      '" style="' + esc(sheetFontStyle(tpl)) + '">' +
      wrapAbs('watermark', watermarkInner, layout, edit, blocks.watermark === false, 'is-watermark', fonts) +
      wrapAbs('company', companyInner, layout, edit, blocks.company === false, '', fonts) +
      wrapAbs('title', '<div class="pf-title">' + esc(title) + '</div>', layout, edit, false, '', fonts) +
      wrapAbs('logo', logoInner, layout, edit, blocks.logo === false || !logo, '', fonts) +
      wrapAbs('billTo', billInner, layout, edit, blocks.billTo === false, '', fonts) +
      wrapAbs('shipTo', shipInner, layout, edit, blocks.shipTo === false, '', fonts) +
      headerHtml +
      wrapAbs('lines', linesInner, layout, edit, blocks.lines === false, '', fonts) +
      wrapAbs('customerMessage', messageInner, layout, edit, blocks.customerMessage === false, '', fonts) +
      wrapAbs('paymentTerms', termsInner, layout, edit, blocks.paymentTerms === false || !tpl.paymentTermsText, '', fonts) +
      wrapAbs('totals', totalsInner, layout, edit, blocks.totals === false, '', fonts) +
      wrapAbs('contact', contactInner, layout, edit, blocks.contact === false, '', fonts) +
      (opts && opts.safe ? '<div class="pf-safe" aria-hidden="true"></div>' : '') +
      '</div>';
  }

  function sheetCss() {
    return [
      '.pf-sheet,.pf-sheet *{box-sizing:border-box}',
      '.pf-sheet.is-abs{position:relative;width:8.5in;height:11in;max-width:none;margin:0 auto;box-sizing:border-box;background:#fff;color:#111;font-family:var(--pf-family,Arial);font-size:var(--pf-size,12pt);font-weight:var(--pf-weight,400);font-style:var(--pf-style,normal);line-height:1.35}',
      '.pf-abs{position:absolute;box-sizing:border-box;overflow:hidden;z-index:1}',
      '.pf-abs.is-watermark{z-index:0}',
      '.pf-abs .pf-co,.pf-abs .pf-title,.pf-abs .pf-logo,.pf-abs .pf-box,.pf-abs .pf-hfield,.pf-abs .pf-lines-box,.pf-abs .pf-msg,.pf-abs .pf-terms,.pf-abs .pf-totals,.pf-abs .pf-contact,.pf-abs .pf-ph,.pf-abs .pf-watermark{width:100%;height:100%;margin:0}',
      '.pf-watermark{display:flex;align-items:center;justify-content:center}',
      '.pf-watermark img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;opacity:.2}',
      '.pf-co{font-size:1em}',
      '.pf-co-name{font-size:1.5em;font-weight:800;letter-spacing:.04em;margin-bottom:4px}',
      '.pf-title{display:flex;align-items:center;justify-content:center;font-size:2.33em;font-weight:700;text-align:center;padding:0}',
      '.pf-logo{display:flex;align-items:center;justify-content:flex-end}',
      '.pf-logo img{max-height:100%;max-width:100%;object-fit:contain}',
      '.pf-box{border:1px solid #222;min-height:0;display:flex;flex-direction:column}',
      '.pf-box-h{background:#d9d9d9;border-bottom:1px solid #222;font-weight:700;padding:3px 8px;font-size:1em}',
      '.pf-box pre{margin:0;padding:8px;font:inherit;line-height:1.4;white-space:pre-wrap;flex:1}',
      '.pf-hfield{border:1px solid #222;min-height:0;display:flex;flex-direction:column;overflow:hidden}',
      '.pf-hfield-h{background:#d9d9d9;border-bottom:1px solid #222;font-weight:700;padding:3px 6px;font-size:.92em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.pf-hfield-v{padding:6px;flex:1;font-size:1em;overflow:hidden}',
      '.pf-lines-box{position:relative;overflow:hidden}',
      '.pf-lines{width:100%;height:auto;border-collapse:collapse;table-layout:fixed}',
      '.pf-lines th{background:#d9d9d9;border:1px solid #222;font-size:1em;font-weight:700;padding:4px 6px;text-align:left;overflow:hidden}',
      '.pf-lines td{border:1px solid #222;padding:3px 6px;vertical-align:top;height:1.35em;overflow:hidden}',
      '.pf-lines tbody tr{height:1.35em}',
      '.pf-lines tbody tr.is-alt td{background:#f4f4f4}',
      '.pf-msg{border:1px solid #222;display:flex;flex-direction:column;min-height:0;overflow:hidden}',
      '.pf-msg-h{background:#d9d9d9;border-bottom:1px solid #222;font-weight:700;padding:3px 8px;font-size:1em}',
      '.pf-msg-b{padding:6px 8px;flex:1;white-space:pre-wrap}',
      '.pf-terms-h{font-weight:800;margin-bottom:4px}',
      '.pf-totals{border-top:1px solid #222;padding-top:4px}',
      '.pf-totals div{display:flex;justify-content:space-between;gap:12px;padding:2px 0}',
      '.pf-totals .is-total,.pf-totals .is-due{font-weight:800}',
      '.pf-totals .is-due{font-size:1.15em}',
      '.pf-contact{border-top:1px solid #222;padding-top:8px;font-size:1em}',
      '.pf-ph{display:flex;align-items:center;justify-content:center;color:#888;font-size:.92em;border:1px dashed #bbb;background:#fafafa}',
      '.pf-abs.is-typed{font-family:var(--pf-family,inherit);font-size:var(--pf-size,inherit);font-weight:var(--pf-weight,inherit);font-style:var(--pf-style,inherit)}',
      '.pf-abs.is-typed .pf-title,.pf-abs.is-typed .pf-co,.pf-abs.is-typed .pf-co-name,.pf-abs.is-typed .pf-box,.pf-abs.is-typed .pf-box-h,.pf-abs.is-typed .pf-box pre,.pf-abs.is-typed .pf-hfield,.pf-abs.is-typed .pf-hfield-h,.pf-abs.is-typed .pf-hfield-v,.pf-abs.is-typed .pf-lines-box,.pf-abs.is-typed .pf-lines,.pf-abs.is-typed .pf-lines th,.pf-abs.is-typed .pf-lines td,.pf-abs.is-typed .pf-msg,.pf-abs.is-typed .pf-msg-h,.pf-abs.is-typed .pf-msg-b,.pf-abs.is-typed .pf-terms,.pf-abs.is-typed .pf-terms-h,.pf-abs.is-typed .pf-totals,.pf-abs.is-typed .pf-totals .is-total,.pf-abs.is-typed .pf-totals .is-due,.pf-abs.is-typed .pf-contact,.pf-abs.is-typed .pf-ph{font-family:inherit;font-size:1em;font-weight:inherit;font-style:inherit}',
      '.pf-co-name.is-typed{font-family:var(--pf-family,inherit);font-size:var(--pf-size,inherit);font-weight:var(--pf-weight,inherit);font-style:var(--pf-style,inherit)}'
    ].join('');
  }

  function editorCss() {
    return sheetCss() + [
      '.pf-sheet.is-abs{box-shadow:0 10px 32px rgba(16,32,71,.16)}',
      '.pf-safe{position:absolute;left:0.5in;top:0.5in;width:7.5in;height:10in;border:1px dotted rgba(15,23,42,.5);pointer-events:none;z-index:3;box-sizing:border-box}',
      '.pf-sheet.is-edit{background-image:linear-gradient(to right,rgba(14,165,233,.16) 1px,transparent 1px),linear-gradient(to bottom,rgba(14,165,233,.16) 1px,transparent 1px);background-size:calc(100%/90) calc(100%/90)}',
      '.pf-sheet.is-edit .pf-abs{overflow:visible;outline:1px dashed rgba(14,165,233,.55);cursor:move;user-select:none;touch-action:none}',
      '.pf-sheet.is-edit .pf-abs.is-off{outline-style:dotted;opacity:.42}',
      '.pf-sheet .pf-abs.is-on{outline:2px solid #0ea5e9;z-index:4}',
      '.pf-resize{position:absolute;right:-1px;bottom:-1px;width:14px;height:14px;background:#0ea5e9;border:2px solid #fff;border-radius:2px;cursor:se-resize;box-shadow:0 0 0 1px rgba(14,165,233,.4);z-index:6;pointer-events:auto}',
      '.pf-resize:after{content:"";position:absolute;right:-6px;bottom:-6px;width:24px;height:24px}',
      '.pf-col-resizers{position:absolute;inset:0;pointer-events:none;z-index:8}',
      '.pf-col-resize{position:absolute;top:0;bottom:0;width:10px;margin-left:-5px;cursor:col-resize;pointer-events:auto;z-index:8}',
      '.pf-col-resize:hover,.pf-col-resize.is-on{background:rgba(14,165,233,.28)}',
      '.pf-sheet.is-edit .pf-abs .pf-box,.pf-sheet.is-edit .pf-abs .pf-hfield,.pf-sheet.is-edit .pf-abs .pf-lines-box,.pf-sheet.is-edit .pf-abs .pf-msg,.pf-sheet.is-edit .pf-abs .pf-terms,.pf-sheet.is-edit .pf-abs .pf-totals,.pf-sheet.is-edit .pf-abs .pf-contact,.pf-sheet.is-edit .pf-abs .pf-co,.pf-sheet.is-edit .pf-abs .pf-title,.pf-sheet.is-edit .pf-abs .pf-logo,.pf-sheet.is-edit .pf-abs .pf-ph,.pf-sheet.is-edit .pf-abs .pf-watermark{pointer-events:none}',
      '.pf-sheet.is-edit .pf-abs .pf-col-resize{pointer-events:auto}'
    ].join('');
  }

  function printCss() {
    return [
      '@page{size:letter;margin:0}',
      'html,body{margin:0;padding:0;background:#fff;color:#111;font:12px/1.35 Arial,Helvetica,sans-serif}',
      '.pf-noprint{position:fixed;right:16px;bottom:16px}',
      sheetCss(),
      '@media print{html,body{width:8.5in;height:11in;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pf-abs{overflow:visible}.pf-noprint{display:none!important}}'
    ].join('');
  }

  function pdfFilename(data, explicit) {
    if (explicit) return String(explicit);
    const doc = (data && data.doc) || {};
    const raw = String(doc.number || 'document').trim() || 'document';
    return raw.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) + '.pdf';
  }

  function pageOrigin() {
    try {
      if (typeof location !== 'undefined' && location.origin) return location.origin + '/';
    } catch (e) {}
    return '/';
  }

  function pdfBootScript(filename) {
    return '<script>(function(){' +
      'var name=' + JSON.stringify(filename) + ';' +
      'function fail(){try{window.print();}catch(e){}}' +
      'function run(){' +
        'try{' +
          'var sheet=document.querySelector(".pf-sheet");' +
          'if(!sheet||typeof html2pdf!=="function"){fail();return;}' +
          'var job=html2pdf().set({margin:0,filename:name,image:{type:"jpeg",quality:.95},' +
            'html2canvas:{scale:2,useCORS:true,logging:false},' +
            'jsPDF:{unit:"in",format:"letter",orientation:"portrait"}})' +
            '.from(sheet).save();' +
          'if(job&&typeof job.catch==="function")job.catch(fail);' +
        '}catch(e){fail();}' +
      '}' +
      'function load(){' +
        'var s=document.createElement("script");' +
        's.src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";' +
        's.onload=run;s.onerror=fail;document.head.appendChild(s);' +
      '}' +
      'function start(){setTimeout(load,200);}' +
      'if(document.readyState==="complete")start();' +
      'else window.addEventListener("load",start);' +
      '})();</script>';
  }

  function documentHtml(template, data, opts) {
    const download = !!(opts && opts.download);
    const filename = pdfFilename(data, opts && opts.filename);
    const title = ((data && data.doc && data.doc.number) || (template && template.title) || 'Document');
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<base href="' + esc(pageOrigin()) + '">' +
      '<style>' + printCss() + '</style></head><body>' + sheetHtml(template, data) +
      '<div class="pf-noprint">' +
      '<button type="button" onclick="window.print()" style="font:13px Arial;padding:8px 16px;border:0;border-radius:999px;background:#0ea5e9;color:#fff;cursor:pointer">Print</button></div>' +
      (download ? pdfBootScript(filename) : '') +
      '</body></html>';
  }

  function openPrint(template, data, opts) {
    const download = !!(opts && opts.download);
    const html = documentHtml(template, data, opts);
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    if (!download) {
      setTimeout(function () {
        try { w.print(); } catch (e) {}
      }, 250);
    }
    return true;
  }

  function sampleDoc(type) {
    const t = type || 'invoice';
    return {
      type: t,
      kind: t === 'po' ? 'po' : 'sales',
      number: t === 'invoice' ? 'SD240822' : t === 'po' ? 'PO-1001' : t === 'order' ? 'SO-1001' : 'SQ-1001',
      customerName: 'Impulse Space Propulsion',
      billName: 'Impulse Space Propulsion\nJoseph Gonzalez',
      billStreet: '',
      shipStreet: '',
      issueDate: '2026-09-02',
      dueDate: '2026-09-02',
      paymentTerms: 'Due on receipt',
      poNumber: '',
      soNumber: '',
      tracking: '',
      rep: 'DD',
      account: '',
      shipDate: '2026-09-30',
      shipVia: 'WILL CALL',
      notes: 'ETA 4-6 WEEKS',
      subtotal: 109781.25,
      discount: 0,
      tax: 0,
      total: 109781.25,
      paymentsApplied: 0,
      balanceDue: 109781.25,
      mailingAddress: 'Impulse Space Propulsion\nJoseph Gonzalez',
      shippingAddress: 'Impulse Space Propulsion\nReceiving',
      permitNo: '',
      lines: [
        { sku: 'CXP093IFCOB', description: 'P0.93 COB 337.5 x 600 PANEL', qty: 60, unitPrice: 1593.75, amount: 95625 },
        { sku: 'MX40PRO', description: 'NOVASTAR MX40 PRO', qty: 1, unitPrice: 6956.25, amount: 6956.25 },
        { sku: 'INSTALLATION', description: 'COB 60 PANEL INSTALLATION', qty: 1, unitPrice: 3000, amount: 3000 },
        { sku: 'SPECTRUM 3-YEAR', description: 'SPECTRUM 3-YEAR WARRANTY 1 YEAR LABOR 3 YEAR PARTS 5 YEAR SUPPORT\nETA 3-4 WEEKS', qty: 1, unitPrice: 4200, amount: 4200 }
      ]
    };
  }

  function pdfOptions(filename) {
    return {
      margin: 0,
      filename: filename || 'document.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
  }

  function loadHtml2Pdf() {
    return new Promise(function (resolve, reject) {
      if (typeof html2pdf === 'function') {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Could not load the PDF library.')); };
      document.head.appendChild(s);
    });
  }

  function letterSrcdoc(template, data) {
    return '<!doctype html><html><head><meta charset="utf-8"><style>' + printCss() +
      'html,body{background:#fff}</style></head><body>' + sheetHtml(template, data) + '</body></html>';
  }

  function coercePdfBlob(out) {
    if (typeof Blob !== 'undefined' && out instanceof Blob) return out;
    if (typeof out === 'string' && out.indexOf('data:') === 0) {
      const parts = out.split(',');
      const bin = atob(parts[1] || '');
      const arr = new Uint8Array(bin.length);
      let i = 0;
      for (i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: 'application/pdf' });
    }
    throw new Error('Could not build PDF.');
  }

  function buildPdfBlob(template, data, filename) {
    return loadHtml2Pdf().then(function () {
      const host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:fixed;left:-12000px;top:0;width:8.5in;background:#fff;pointer-events:none;z-index:-1;';
      const style = document.createElement('style');
      style.textContent = printCss();
      host.appendChild(style);
      const wrap = document.createElement('div');
      wrap.innerHTML = sheetHtml(template, data);
      host.appendChild(wrap);
      document.body.appendChild(host);
      const sheet = host.querySelector('.pf-sheet');
      function cleanup() {
        if (host.parentNode) host.parentNode.removeChild(host);
      }
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          try {
            const job = html2pdf().set(pdfOptions(filename)).from(sheet).outputPdf('blob');
            Promise.resolve(job).then(function (blob) {
              cleanup();
              resolve(coercePdfBlob(blob));
            }).catch(function (err) {
              cleanup();
              reject(err);
            });
          } catch (err) {
            cleanup();
            reject(err);
          }
        }, 180);
      });
    });
  }

  root.SpectrumPrintForm = {
    sheetHtml: sheetHtml,
    documentHtml: documentHtml,
    printCss: printCss,
    editorCss: editorCss,
    openPrint: openPrint,
    sampleDoc: sampleDoc,
    fieldValue: fieldValue,
    companyLines: companyLines,
    defaultLayout: defaultLayout,
    mergeLayout: mergeLayout,
    LAYOUT_VERSION: LAYOUT_VERSION,
    snapBox: snapBox,
    headerLayoutId: headerLayoutId,
    LAYOUT_IDS: LAYOUT_IDS,
    GRID_STEP: GRID_STEP,
    GRID_COUNT: GRID_COUNT,
    GRID_MIN: GRID_MIN,
    FONTS: FONTS,
    FONT_SIZES: FONT_SIZES,
    FONT_STYLES: FONT_STYLES,
    fontSpec: fontSpec,
    effectiveFont: effectiveFont,
    canTypeBlock: canTypeBlock,
    visibleColumnWidths: visibleColumnWidths,
    applyColumnResize: applyColumnResize,
    COL_MIN: COL_MIN,
    COL_WIDTH_DEFAULTS: COL_WIDTH_DEFAULTS,
    letterSrcdoc: letterSrcdoc,
    buildPdfBlob: buildPdfBlob
  };
})(window);
