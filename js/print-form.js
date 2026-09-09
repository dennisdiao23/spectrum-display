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
    if (id === 'item') return row.sku || row.item || row.product || '';
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

  const HEADER_FIELD_IDS = [
    'number', 'date', 'terms', 'dueDate', 'poNumber', 'soNumber', 'tracking',
    'rep', 'account', 'shipDate', 'shipVia', 'permit'
  ];

  const LAYOUT_IDS = [
    'company', 'title', 'logo', 'watermark', 'billTo', 'shipTo', 'lines', 'paymentTerms', 'totals', 'contact'
  ].concat(HEADER_FIELD_IDS.map(function (id) { return 'hdr-' + id; }));

  const GRID_COUNT = 90;
  const GRID_STEP = 100 / GRID_COUNT;

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
  const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18];
  const FONT_STYLES = [
    { id: 'regular', label: 'Regular', weight: 400, italic: false },
    { id: 'italic', label: 'Italic', weight: 400, italic: true },
    { id: 'bold', label: 'Bold', weight: 700, italic: false },
    { id: 'bold-italic', label: 'Bold italic', weight: 700, italic: true }
  ];

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
      lines: { x: 0, y: 45, w: 100, h: 30 },
      paymentTerms: { x: 0, y: 75, w: 60, h: 15 },
      totals: { x: 60, y: 75, w: 40, h: 15 },
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
    return mapLayoutFromV1(defaultLayoutV1());
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

  function snapPct(n) {
    const v = Number(n);
    if (!isFinite(v)) return 0;
    return Math.round(v * 2) / 2;
  }

  function snapTo(n, step) {
    const s = Number(step) > 0 ? Number(step) : 0.5;
    const v = Number(n);
    if (!isFinite(v)) return 0;
    return Math.round(v / s) * s;
  }

  function clampPct(n, min, max) {
    return Math.min(max, Math.max(min, snapPct(n)));
  }

  function sanitizeBox(box, fallback) {
    const src = box && typeof box === 'object' ? box : fallback;
    const fb = fallback || { x: 0, y: 0, w: 20, h: 10 };
    let w = clampPct(src.w != null ? src.w : fb.w, 5, 100);
    let h = clampPct(src.h != null ? src.h : fb.h, 5, 100);
    let x = clampPct(src.x != null ? src.x : fb.x, 0, 95);
    let y = clampPct(src.y != null ? src.y : fb.y, 0, 95);
    if (x + w > 100) w = Math.max(5, snapPct(100 - x));
    if (y + h > 100) h = Math.max(5, snapPct(100 - y));
    return { x: x, y: y, w: w, h: h };
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

  function snapBox(box, step) {
    const s = Number(step) > 0 ? Number(step) : 0.5;
    const next = {
      x: snapTo(box.x, s),
      y: snapTo(box.y, s),
      w: snapTo(box.w, s),
      h: snapTo(box.h, s)
    };
    if (next.w < 5) next.w = s >= 5 ? 5 : 5;
    if (next.h < 5) next.h = 5;
    if (next.x < 0) next.x = 0;
    if (next.y < 0) next.y = 0;
    if (next.x + next.w > 100) next.x = Math.max(0, snapTo(100 - next.w, s));
    if (next.y + next.h > 100) next.y = Math.max(0, snapTo(100 - next.h, s));
    if (next.x + next.w > 100) next.w = Math.max(5, 100 - next.x);
    if (next.y + next.h > 100) next.h = Math.max(5, 100 - next.y);
    return next;
  }

  function boxStyle(layout, id) {
    const b = layout[id] || defaultLayout()[id];
    return 'left:' + b.x + '%;top:' + b.y + '%;width:' + b.w + '%;height:' + b.h + '%';
  }

  function wrapAbs(id, inner, layout, edit, off, extraClass) {
    if (!edit && off) return '';
    const cls = ['pf-abs'];
    if (off) cls.push('is-off');
    if (extraClass) cls.push(extraClass);
    return '<div class="' + cls.join(' ') + '" data-pf-block="' + id + '" style="' + boxStyle(layout, id) + '">' +
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
    const lines = doc.lines && doc.lines.length ? doc.lines : [{}, {}, {}, {}];
    const title = tpl.title || 'Invoice';
    const logo = tpl.logo || '';
    const co = companyLines(company);
    const total = Number(doc.total) || 0;
    const paid = Number(doc.paymentsApplied) || 0;
    const balance = doc.balanceDue != null ? Number(doc.balanceDue) : (total - paid);
    const phone = company.phone || '';
    const email = company.email || '';

    let companyInner = '';
    if (blocks.company !== false) {
      companyInner = '<div class="pf-co"><div class="pf-co-name">' + esc(co[0] || '') + '</div>';
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
      headerHtml += wrapAbs(headerLayoutId(id), inner, layout, edit, off);
    });

    let linesInner = '';
    if (blocks.lines !== false) {
      linesInner = '<table class="pf-lines"><thead><tr>';
      cols.forEach(function (c) { linesInner += '<th>' + esc(c.title || c.id) + '</th>'; });
      linesInner += '</tr></thead><tbody>';
      lines.forEach(function (line, i) {
        linesInner += '<tr class="' + (i % 2 ? 'is-alt' : '') + '">';
        cols.forEach(function (c) { linesInner += '<td>' + esc(lineCell(line, c.id)) + '</td>'; });
        linesInner += '</tr>';
      });
      linesInner += '</tbody></table>';
    } else {
      linesInner = ph('Line table');
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
      totalsInner += '<div><span>Total</span><b>' + money(total) + '</b></div>';
      if (doc.type === 'invoice' || tpl.type === 'invoice') {
        totalsInner += '<div><span>Payments/Credits</span><b>' + money(paid) + '</b></div>';
        totalsInner += '<div class="is-due"><span>Balance Due</span><b>' + money(balance) + '</b></div>';
      }
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

    return '<div class="pf-sheet is-abs' + (edit ? ' is-edit' : '') + (edit && opts && opts.grid ? ' is-grid' : '') +
      '" style="' + esc(sheetFontStyle(tpl)) + '">' +
      wrapAbs('watermark', watermarkInner, layout, edit, blocks.watermark === false, 'is-watermark') +
      wrapAbs('company', companyInner, layout, edit, blocks.company === false) +
      wrapAbs('title', '<div class="pf-title">' + esc(title) + '</div>', layout, edit, false) +
      wrapAbs('logo', logoInner, layout, edit, blocks.logo === false || !logo) +
      wrapAbs('billTo', billInner, layout, edit, blocks.billTo === false) +
      wrapAbs('shipTo', shipInner, layout, edit, blocks.shipTo === false) +
      headerHtml +
      wrapAbs('lines', linesInner, layout, edit, blocks.lines === false) +
      wrapAbs('paymentTerms', termsInner, layout, edit, blocks.paymentTerms === false || !tpl.paymentTermsText) +
      wrapAbs('totals', totalsInner, layout, edit, blocks.totals === false) +
      wrapAbs('contact', contactInner, layout, edit, blocks.contact === false) +
      (opts && opts.safe ? '<div class="pf-safe" aria-hidden="true"></div>' : '') +
      '</div>';
  }

  function sheetCss() {
    return [
      '.pf-sheet,.pf-sheet *{box-sizing:border-box}',
      '.pf-sheet.is-abs{position:relative;width:8.5in;height:11in;max-width:none;margin:0 auto;box-sizing:border-box;background:#fff;color:#111;font-family:var(--pf-family,Arial);font-size:var(--pf-size,12pt);font-weight:var(--pf-weight,400);font-style:var(--pf-style,normal);line-height:1.35}',
      '.pf-abs{position:absolute;box-sizing:border-box;overflow:hidden;z-index:1}',
      '.pf-abs.is-watermark{z-index:0}',
      '.pf-abs .pf-co,.pf-abs .pf-title,.pf-abs .pf-logo,.pf-abs .pf-box,.pf-abs .pf-hfield,.pf-abs .pf-lines,.pf-abs .pf-terms,.pf-abs .pf-totals,.pf-abs .pf-contact,.pf-abs .pf-ph,.pf-abs .pf-watermark{width:100%;height:100%;margin:0}',
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
      '.pf-lines{width:100%;border-collapse:collapse}',
      '.pf-lines th{background:#d9d9d9;border:1px solid #222;font-size:1em;font-weight:700;padding:5px 6px;text-align:left}',
      '.pf-lines td{border-left:1px solid #222;border-right:1px solid #222;padding:5px 6px;vertical-align:top}',
      '.pf-lines tbody tr.is-alt td{background:#f4f4f4}',
      '.pf-lines tbody tr:last-child td{border-bottom:1px solid #222}',
      '.pf-terms-h{font-weight:800;margin-bottom:4px}',
      '.pf-totals{border-top:1px solid #222;padding-top:6px}',
      '.pf-totals div{display:flex;justify-content:space-between;gap:12px;padding:3px 0}',
      '.pf-totals .is-due{font-size:1.33em;font-weight:800}',
      '.pf-contact{border-top:1px solid #222;padding-top:8px;font-size:1em}',
      '.pf-ph{display:flex;align-items:center;justify-content:center;color:#888;font-size:.92em;border:1px dashed #bbb;background:#fafafa}'
    ].join('');
  }

  function editorCss() {
    return sheetCss() + [
      '.pf-sheet.is-abs{box-shadow:0 10px 32px rgba(16,32,71,.16)}',
      '.pf-safe{position:absolute;left:0.5in;top:0.5in;width:7.5in;height:10in;border:1px dotted rgba(15,23,42,.5);pointer-events:none;z-index:3;box-sizing:border-box}',
      '.pf-sheet.is-edit.is-grid{background-image:linear-gradient(to right,rgba(14,165,233,.16) 1px,transparent 1px),linear-gradient(to bottom,rgba(14,165,233,.16) 1px,transparent 1px);background-size:calc(100%/90) calc(100%/90)}',
      '.pf-sheet.is-edit .pf-abs{overflow:visible;outline:1px dashed rgba(14,165,233,.55);cursor:move;user-select:none;touch-action:none}',
      '.pf-sheet.is-edit .pf-abs.is-off{outline-style:dotted;opacity:.42}',
      '.pf-sheet.is-edit .pf-abs.is-on{outline:2px solid #0ea5e9;z-index:4}',
      '.pf-resize{position:absolute;right:-1px;bottom:-1px;width:14px;height:14px;background:#0ea5e9;border:2px solid #fff;border-radius:2px;cursor:se-resize;box-shadow:0 0 0 1px rgba(14,165,233,.4);z-index:6;pointer-events:auto}',
      '.pf-resize:after{content:"";position:absolute;right:-6px;bottom:-6px;width:24px;height:24px}',
      '.pf-sheet.is-edit .pf-abs .pf-box,.pf-sheet.is-edit .pf-abs .pf-hfield,.pf-sheet.is-edit .pf-abs .pf-lines,.pf-sheet.is-edit .pf-abs .pf-terms,.pf-sheet.is-edit .pf-abs .pf-totals,.pf-sheet.is-edit .pf-abs .pf-contact,.pf-sheet.is-edit .pf-abs .pf-co,.pf-sheet.is-edit .pf-abs .pf-title,.pf-sheet.is-edit .pf-abs .pf-logo,.pf-sheet.is-edit .pf-abs .pf-ph,.pf-sheet.is-edit .pf-abs .pf-watermark{pointer-events:none}'
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

  function documentHtml(template, data) {
    return '<!doctype html><html><head><meta charset="utf-8"><title></title><style>' + printCss() +
      '</style></head><body>' + sheetHtml(template, data) +
      '<div class="pf-noprint">' +
      '<button type="button" onclick="window.print()" style="font:13px Arial;padding:8px 16px;border:0;border-radius:999px;background:#0ea5e9;color:#fff;cursor:pointer">Print / Save as PDF</button></div>' +
      '</body></html>';
  }

  function openPrint(template, data) {
    const html = documentHtml(template, data);
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(function () {
      try { w.print(); } catch (e) {}
    }, 250);
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
    FONTS: FONTS,
    FONT_SIZES: FONT_SIZES,
    FONT_STYLES: FONT_STYLES,
    fontSpec: fontSpec
  };
})(window);
