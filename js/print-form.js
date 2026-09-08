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

  function sheetHtml(template, data) {
    const tpl = template || {};
    const blocks = tpl.blocks || {};
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

    let head = '<div class="pf-top">';
    head += '<div class="pf-co">';
    if (blocks.company !== false) {
      head += '<div class="pf-co-name">' + esc(co[0] || '') + '</div>';
      co.slice(1).forEach(function (line) {
        head += '<div>' + esc(line) + '</div>';
      });
    }
    head += '</div>';
    head += '<div class="pf-title">' + esc(title) + '</div>';
    head += '<div class="pf-logo">';
    if (blocks.logo !== false && logo) {
      head += '<img src="' + esc(logo) + '" alt="">';
    }
    head += '</div></div>';

    let boxes = '<div class="pf-boxes">';
    if (blocks.billTo !== false) {
      boxes += '<div class="pf-box"><div class="pf-box-h">Bill To</div><pre>' +
        esc(addressText(doc, 'bill') || ' ') + '</pre></div>';
    } else {
      boxes += '<div></div>';
    }
    if (blocks.shipTo !== false) {
      boxes += '<div class="pf-box"><div class="pf-box-h">Ship To</div><pre>' +
        esc(addressText(doc, 'ship') || ' ') + '</pre></div>';
    } else {
      boxes += '<div></div>';
    }
    boxes += '</div>';

    let meta = '';
    if (headers.length) {
      meta += '<table class="pf-meta"><thead><tr>';
      headers.forEach(function (h) { meta += '<th>' + esc(h.title || h.id) + '</th>'; });
      meta += '</tr></thead><tbody><tr>';
      headers.forEach(function (h) { meta += '<td>' + esc(fieldValue(doc, h.id)) + '</td>'; });
      meta += '</tr></tbody></table>';
    }

    let table = '';
    if (blocks.lines !== false) {
      table += '<table class="pf-lines"><thead><tr>';
      cols.forEach(function (c) { table += '<th>' + esc(c.title || c.id) + '</th>'; });
      table += '</tr></thead><tbody>';
      lines.forEach(function (line, i) {
        table += '<tr class="' + (i % 2 ? 'is-alt' : '') + '">';
        cols.forEach(function (c) { table += '<td>' + esc(lineCell(line, c.id)) + '</td>'; });
        table += '</tr>';
      });
      table += '</tbody></table>';
    }

    let foot = '<div class="pf-foot">';
    foot += '<div class="pf-terms">';
    if (blocks.paymentTerms !== false && tpl.paymentTermsText) {
      foot += '<div class="pf-terms-h">PAYMENT TERMS</div><div>' +
        esc(tpl.paymentTermsText).replace(/\n/g, '<br>') + '</div>';
    }
    foot += '</div>';
    if (blocks.totals !== false) {
      foot += '<div class="pf-totals">';
      foot += '<div><span>Total</span><b>' + money(total) + '</b></div>';
      if (doc.type === 'invoice' || tpl.type === 'invoice') {
        foot += '<div><span>Payments/Credits</span><b>' + money(paid) + '</b></div>';
        foot += '<div class="is-due"><span>Balance Due</span><b>' + money(balance) + '</b></div>';
      }
      foot += '</div>';
    }
    foot += '</div>';

    let contact = '';
    if (blocks.contact !== false && (phone || email)) {
      contact = '<div class="pf-contact">' +
        (phone ? 'Phone # ' + esc(phone) : '') +
        (phone && email ? ' &nbsp; ' : '') +
        (email ? 'E-mail ' + esc(email) : '') +
        '</div>';
    }

    return '<div class="pf-sheet">' + head + boxes + meta + table + foot + contact + '</div>';
  }

  function printCss() {
    return [
      '@page{size:letter;margin:0.45in 0.5in}',
      'html,body{margin:0;padding:0;background:#fff;color:#111;font:12px/1.35 Arial,Helvetica,sans-serif}',
      '.pf-sheet{width:7.5in;max-width:100%;margin:0 auto;color:#111}',
      '.pf-top{display:grid;grid-template-columns:1.4fr auto 1.1fr;gap:12px;align-items:start;margin-bottom:14px}',
      '.pf-co{font-size:12px}',
      '.pf-co-name{font-size:18px;font-weight:800;letter-spacing:.04em;margin-bottom:4px}',
      '.pf-title{font-size:28px;font-weight:700;text-align:center;padding-top:6px}',
      '.pf-logo{text-align:right}',
      '.pf-logo img{max-height:52px;max-width:180px}',
      '.pf-boxes{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:8px 0 12px}',
      '.pf-box{border:1px solid #222;min-height:78px}',
      '.pf-box-h{background:#d9d9d9;border-bottom:1px solid #222;font-weight:700;padding:3px 8px;font-size:12px}',
      '.pf-box pre{margin:0;padding:8px;font:12px/1.4 Arial,Helvetica,sans-serif;white-space:pre-wrap}',
      '.pf-meta{width:100%;border-collapse:collapse;margin:0 0 10px;table-layout:fixed}',
      '.pf-meta th{background:#d9d9d9;border:1px solid #222;font-size:11px;font-weight:700;padding:4px 6px;text-align:left}',
      '.pf-meta td{border:1px solid #222;padding:6px;height:22px;vertical-align:top}',
      '.pf-lines{width:100%;border-collapse:collapse;margin:0 0 16px}',
      '.pf-lines th{background:#d9d9d9;border:1px solid #222;font-size:12px;font-weight:700;padding:5px 6px;text-align:left}',
      '.pf-lines td{border-left:1px solid #222;border-right:1px solid #222;padding:5px 6px;vertical-align:top}',
      '.pf-lines tbody tr.is-alt td{background:#f4f4f4}',
      '.pf-lines tbody tr:last-child td{border-bottom:1px solid #222}',
      '.pf-foot{display:grid;grid-template-columns:1.3fr .9fr;gap:18px;align-items:start;margin-top:8px}',
      '.pf-terms-h{font-weight:800;margin-bottom:4px}',
      '.pf-totals{border-top:1px solid #222;padding-top:6px}',
      '.pf-totals div{display:flex;justify-content:space-between;gap:12px;padding:3px 0}',
      '.pf-totals .is-due{font-size:16px;font-weight:800}',
      '.pf-contact{border-top:1px solid #222;margin-top:28px;padding-top:8px;font-size:12px}',
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
    openPrint: openPrint,
    sampleDoc: sampleDoc,
    fieldValue: fieldValue,
    companyLines: companyLines
  };
})(window);
