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

  const LAYOUT_IDS = [
    'company', 'title', 'logo', 'billTo', 'shipTo', 'header', 'lines', 'paymentTerms', 'totals', 'contact'
  ];

  function defaultLayout() {
    return {
      company: { x: 0, y: 0, w: 36, h: 10 },
      title: { x: 36, y: 0.5, w: 28, h: 8 },
      logo: { x: 64, y: 0, w: 36, h: 10 },
      billTo: { x: 0, y: 12, w: 48, h: 14 },
      shipTo: { x: 52, y: 12, w: 48, h: 14 },
      header: { x: 0, y: 28, w: 100, h: 9 },
      lines: { x: 0, y: 39, w: 100, h: 36 },
      paymentTerms: { x: 0, y: 77, w: 58, h: 16 },
      totals: { x: 62, y: 77, w: 38, h: 14 },
      contact: { x: 0, y: 94, w: 100, h: 5 }
    };
  }

  function snapPct(n) {
    const v = Number(n);
    if (!isFinite(v)) return 0;
    return Math.round(v * 2) / 2;
  }

  function clampPct(n, min, max) {
    return Math.min(max, Math.max(min, snapPct(n)));
  }

  function sanitizeBox(box, fallback) {
    const src = box && typeof box === 'object' ? box : fallback;
    const fb = fallback || { x: 0, y: 0, w: 20, h: 10 };
    let w = clampPct(src.w != null ? src.w : fb.w, 8, 100);
    let h = clampPct(src.h != null ? src.h : fb.h, 5, 100);
    let x = clampPct(src.x != null ? src.x : fb.x, 0, 92);
    let y = clampPct(src.y != null ? src.y : fb.y, 0, 95);
    if (x + w > 100) w = Math.max(8, snapPct(100 - x));
    if (y + h > 100) h = Math.max(5, snapPct(100 - y));
    return { x: x, y: y, w: w, h: h };
  }

  function mergeLayout(input) {
    const defs = defaultLayout();
    const src = input && typeof input === 'object' ? input : {};
    const out = {};
    LAYOUT_IDS.forEach(function (id) {
      out[id] = sanitizeBox(src[id], defs[id]);
    });
    return out;
  }

  function boxStyle(layout, id) {
    const b = layout[id] || defaultLayout()[id];
    return 'left:' + b.x + '%;top:' + b.y + '%;width:' + b.w + '%;height:' + b.h + '%';
  }

  function wrapAbs(id, inner, layout, edit, off) {
    if (!edit && off) return '';
    const cls = ['pf-abs'];
    if (off) cls.push('is-off');
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
    const layout = mergeLayout(tpl.layout);
    const company = (data && data.company) || {};
    const doc = (data && data.doc) || {};
    const headers = visible(tpl.headerFields);
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

    let headerInner = '';
    if (headers.length) {
      headerInner = '<table class="pf-meta"><thead><tr>';
      headers.forEach(function (h) { headerInner += '<th>' + esc(h.title || h.id) + '</th>'; });
      headerInner += '</tr></thead><tbody><tr>';
      headers.forEach(function (h) { headerInner += '<td>' + esc(fieldValue(doc, h.id)) + '</td>'; });
      headerInner += '</tr></tbody></table>';
    } else {
      headerInner = ph('Header fields');
    }

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

    return '<div class="pf-sheet is-abs' + (edit ? ' is-edit' : '') + '">' +
      wrapAbs('company', companyInner, layout, edit, blocks.company === false) +
      wrapAbs('title', '<div class="pf-title">' + esc(title) + '</div>', layout, edit, false) +
      wrapAbs('logo', logoInner, layout, edit, blocks.logo === false || !logo) +
      wrapAbs('billTo', billInner, layout, edit, blocks.billTo === false) +
      wrapAbs('shipTo', shipInner, layout, edit, blocks.shipTo === false) +
      wrapAbs('header', headerInner, layout, edit, !headers.length) +
      wrapAbs('lines', linesInner, layout, edit, blocks.lines === false) +
      wrapAbs('paymentTerms', termsInner, layout, edit, blocks.paymentTerms === false || !tpl.paymentTermsText) +
      wrapAbs('totals', totalsInner, layout, edit, blocks.totals === false) +
      wrapAbs('contact', contactInner, layout, edit, blocks.contact === false) +
      '</div>';
  }

  function sheetCss() {
    return [
      '.pf-sheet.is-abs{position:relative;width:7.5in;height:10in;max-width:none;margin:0 auto;box-sizing:border-box;background:#fff;color:#111;font:12px/1.35 Arial,Helvetica,sans-serif}',
      '.pf-abs{position:absolute;box-sizing:border-box;overflow:hidden}',
      '.pf-abs .pf-co,.pf-abs .pf-title,.pf-abs .pf-logo,.pf-abs .pf-box,.pf-abs .pf-meta,.pf-abs .pf-lines,.pf-abs .pf-terms,.pf-abs .pf-totals,.pf-abs .pf-contact,.pf-abs .pf-ph{width:100%;height:100%;margin:0}',
      '.pf-co{font-size:12px}',
      '.pf-co-name{font-size:18px;font-weight:800;letter-spacing:.04em;margin-bottom:4px}',
      '.pf-title{display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;text-align:center;padding:0}',
      '.pf-logo{display:flex;align-items:center;justify-content:flex-end}',
      '.pf-logo img{max-height:100%;max-width:100%;object-fit:contain}',
      '.pf-box{border:1px solid #222;min-height:0;display:flex;flex-direction:column}',
      '.pf-box-h{background:#d9d9d9;border-bottom:1px solid #222;font-weight:700;padding:3px 8px;font-size:12px}',
      '.pf-box pre{margin:0;padding:8px;font:12px/1.4 Arial,Helvetica,sans-serif;white-space:pre-wrap;flex:1}',
      '.pf-meta{width:100%;border-collapse:collapse;table-layout:fixed}',
      '.pf-meta th{background:#d9d9d9;border:1px solid #222;font-size:11px;font-weight:700;padding:4px 6px;text-align:left}',
      '.pf-meta td{border:1px solid #222;padding:6px;height:22px;vertical-align:top}',
      '.pf-lines{width:100%;border-collapse:collapse}',
      '.pf-lines th{background:#d9d9d9;border:1px solid #222;font-size:12px;font-weight:700;padding:5px 6px;text-align:left}',
      '.pf-lines td{border-left:1px solid #222;border-right:1px solid #222;padding:5px 6px;vertical-align:top}',
      '.pf-lines tbody tr.is-alt td{background:#f4f4f4}',
      '.pf-lines tbody tr:last-child td{border-bottom:1px solid #222}',
      '.pf-terms-h{font-weight:800;margin-bottom:4px}',
      '.pf-totals{border-top:1px solid #222;padding-top:6px}',
      '.pf-totals div{display:flex;justify-content:space-between;gap:12px;padding:3px 0}',
      '.pf-totals .is-due{font-size:16px;font-weight:800}',
      '.pf-contact{border-top:1px solid #222;padding-top:8px;font-size:12px}',
      '.pf-ph{display:flex;align-items:center;justify-content:center;color:#888;font-size:11px;border:1px dashed #bbb;background:#fafafa}'
    ].join('');
  }

  function editorCss() {
    return sheetCss() + [
      '.pf-sheet.is-edit{box-shadow:0 10px 32px rgba(16,32,71,.16)}',
      '.pf-sheet.is-edit .pf-abs{overflow:visible;outline:1px dashed rgba(14,165,233,.55);cursor:move;user-select:none;touch-action:none}',
      '.pf-sheet.is-edit .pf-abs.is-off{outline-style:dotted;opacity:.42}',
      '.pf-sheet.is-edit .pf-abs.is-on{outline:2px solid #0ea5e9;z-index:4}',
      '.pf-resize{position:absolute;right:1px;bottom:1px;width:12px;height:12px;background:#0ea5e9;border:2px solid #fff;border-radius:2px;cursor:se-resize;box-shadow:0 0 0 1px rgba(14,165,233,.4);z-index:5}',
      '.pf-sheet.is-edit .pf-abs .pf-box,.pf-sheet.is-edit .pf-abs .pf-meta,.pf-sheet.is-edit .pf-abs .pf-lines,.pf-sheet.is-edit .pf-abs .pf-terms,.pf-sheet.is-edit .pf-abs .pf-totals,.pf-sheet.is-edit .pf-abs .pf-contact,.pf-sheet.is-edit .pf-abs .pf-co,.pf-sheet.is-edit .pf-abs .pf-title,.pf-sheet.is-edit .pf-abs .pf-logo,.pf-sheet.is-edit .pf-abs .pf-ph{pointer-events:none}'
    ].join('');
  }

  function printCss() {
    return [
      '@page{size:letter;margin:0.45in 0.5in}',
      'html,body{margin:0;padding:0;background:#fff;color:#111;font:12px/1.35 Arial,Helvetica,sans-serif}',
      sheetCss(),
      '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.pf-noprint{display:none!important}}'
    ].join('');
  }

  function documentHtml(template, data) {
    return '<!doctype html><html><head><meta charset="utf-8"><title>' +
      esc((template && template.title) || 'Print') + '</title><style>' + printCss() +
      '</style></head><body>' + sheetHtml(template, data) +
      '<div class="pf-noprint" style="text-align:right;margin:16px 0 0">' +
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
    LAYOUT_IDS: LAYOUT_IDS
  };
})(window);
