(function (global) {
  'use strict';

  var H = {
    api: null,
    canUse: function () { return true; },
    canEdit: function () { return true; },
    esc: function (v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },
    money: function (n) {
      var x = Number(n);
      if (!Number.isFinite(x)) x = 0;
      return x.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    },
    pushPath: null,
    toast: function (msg, bad) {
      var el = document.getElementById('acct-flash');
      if (!el) return;
      el.textContent = msg || '';
      el.className = 'text-sm px-1 ' + (bad ? 'text-red-500' : 'text-sky-600');
      el.classList.toggle('hidden', !msg);
    }
  };

  var S = {
    view: 'overview',
    loaded: false,
    overview: null,
    accounts: [],
    bills: [],
    billPayments: [],
    undeposited: [],
    deposits: [],
    journals: [],
    reports: null,
    vendors: [],
    selectedBillId: '',
    selectedJournalId: '',
    selectedDepositId: '',
    reportTab: 'pnl'
  };

  var ACCOUNT_TYPES = [
    ['bank', 'Bank'],
    ['accounts_receivable', 'Accounts Receivable'],
    ['other_current_asset', 'Other Current Asset'],
    ['fixed_asset', 'Fixed Asset'],
    ['inventory', 'Inventory'],
    ['accounts_payable', 'Accounts Payable'],
    ['other_current_liability', 'Other Current Liability'],
    ['long_term_liability', 'Long-term Liability'],
    ['equity', 'Equity'],
    ['income', 'Income'],
    ['other_income', 'Other Income'],
    ['cogs', 'Cost of Goods Sold'],
    ['expense', 'Expense'],
    ['other_expense', 'Other Expense']
  ];

  function $(id) { return document.getElementById(id); }

  function setView(view) {
    S.view = view || 'overview';
    document.querySelectorAll('[data-acct-panel]').forEach(function (el) {
      el.classList.toggle('hidden', el.getAttribute('data-acct-panel') !== S.view);
    });
    document.querySelectorAll('#acct-subnav .dash-sub-link, #accounting-subnav .dash-sub-link').forEach(function (a) {
      var tab = a.getAttribute('data-acct-tab');
      a.classList.toggle('is-active', tab === S.view);
    });
    refresh();
  }

  async function apiGet(url) {
    var res = await fetch(url, { credentials: 'same-origin' });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || data.ok === false) throw new Error((data && data.error) || 'Request failed');
    return data;
  }

  async function apiSend(method, url, body) {
    var res = await fetch(url, {
      method: method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || data.ok === false) throw new Error((data && data.error) || 'Request failed');
    return data;
  }

  function canViewAccounting() {
    return H.canUse('accounting') || H.canUse('chart-of-accounts') || H.canUse('bills') ||
      H.canUse('bill-payments') || H.canUse('deposits') || H.canUse('journals') || H.canUse('reports');
  }

  async function refresh() {
    if (!canViewAccounting()) return;
    try {
      if (S.view === 'overview') await loadOverview();
      else if (S.view === 'chart-of-accounts') await loadAccounts();
      else if (S.view === 'bills') await loadBills();
      else if (S.view === 'bill-payments') await loadPayBills();
      else if (S.view === 'deposits') await loadDeposits();
      else if (S.view === 'journals') await loadJournals();
      else if (S.view === 'reports') await loadReports();
    } catch (err) {
      H.toast(err.message || String(err), true);
    }
  }

  async function loadOverview() {
    var data = await apiGet('/api/admin/accounting/overview');
    S.overview = data.overview || {};
    var o = S.overview;
    setText('acct-kpi-ar', H.money(o.arTotal));
    setText('acct-kpi-ap', H.money(o.apTotal));
    setText('acct-kpi-undeposited', H.money(o.undepositedTotal));
    setText('acct-kpi-income', H.money(o.netIncome));
    setText('acct-kpi-checking', H.money(o.checkingBalance));
    setText('acct-kpi-bills', String(o.openBillCount || 0));
  }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
  }

  async function loadAccounts() {
    var data = await apiGet('/api/admin/accounting/accounts');
    S.accounts = data.accounts || [];
    var tbody = $('acct-accounts-body');
    if (!tbody) return;
    if (!S.accounts.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="py-6 px-4 text-slate-500">No accounts yet.</td></tr>';
      return;
    }
    tbody.innerHTML = S.accounts.map(function (a) {
      return '<tr class="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer" data-acct-id="' + a.id + '">' +
        '<td class="py-2.5 px-4 font-mono text-xs">' + H.esc(a.number) + '</td>' +
        '<td class="py-2.5 px-4">' + H.esc(a.name) + (a.isSystem ? ' <span class="text-[10px] text-slate-500">system</span>' : '') + '</td>' +
        '<td class="py-2.5 px-4 text-slate-400">' + H.esc(a.typeLabel || a.type) + '</td>' +
        '<td class="py-2.5 px-4">' + (a.active ? 'Active' : '<span class="text-amber-400">Inactive</span>') + '</td>' +
        '<td class="py-2.5 px-4 text-right">' +
          (H.canEdit('chart-of-accounts') ? '<button type="button" class="text-sky-400 text-xs" data-acct-edit="' + a.id + '">Edit</button>' : '') +
        '</td></tr>';
    }).join('');
  }

  async function loadBills() {
    var data = await apiGet('/api/admin/accounting/bills');
    S.bills = data.bills || [];
    var tbody = $('acct-bills-body');
    if (!tbody) return;
    if (!S.bills.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-6 px-4 text-slate-500">No bills yet. Create a bill from a vendor invoice.</td></tr>';
      return;
    }
    tbody.innerHTML = S.bills.map(function (b) {
      return '<tr class="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer" data-bill-id="' + b.id + '">' +
        '<td class="py-2.5 px-4 font-medium">' + H.esc(b.number) + '</td>' +
        '<td class="py-2.5 px-4">' + H.esc(b.vendorName || '—') + '</td>' +
        '<td class="py-2.5 px-4 text-slate-400">' + H.esc(b.billDate || '') + '</td>' +
        '<td class="py-2.5 px-4 text-slate-400">' + H.esc(b.dueDate || '') + '</td>' +
        '<td class="py-2.5 px-4 capitalize">' + H.esc(b.status) + '</td>' +
        '<td class="py-2.5 px-4 text-right">' + H.money(b.total) + '</td>' +
        '<td class="py-2.5 px-4 text-right">' + H.money(b.balanceDue) + '</td></tr>';
    }).join('');
  }

  async function ensureVendors() {
    if (S.vendors.length) return;
    var data = await apiGet('/api/admin/inventory-vendors');
    S.vendors = data.vendors || data.items || data || [];
    if (!Array.isArray(S.vendors)) S.vendors = [];
  }

  async function loadPayBills() {
    await ensureVendors();
    var billsData = await apiGet('/api/admin/accounting/bills');
    S.bills = billsData.bills || [];
    var open = S.bills.filter(function (b) { return b.balanceDue > 0.009 && b.status !== 'void' && b.status !== 'draft'; });
    var tbody = $('acct-pay-bills-body');
    if (!tbody) return;
    if (!open.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="py-6 px-4 text-slate-500">No open bills to pay.</td></tr>';
      return;
    }
    tbody.innerHTML = open.map(function (b) {
      return '<tr class="border-t border-slate-800" data-pay-bill="' + b.id + '">' +
        '<td class="py-2.5 px-4"><input type="checkbox" class="acct-pay-check" data-id="' + b.id + '" data-bal="' + b.balanceDue + '" data-vendor="' + b.vendorId + '"></td>' +
        '<td class="py-2.5 px-4">' + H.esc(b.number) + '</td>' +
        '<td class="py-2.5 px-4">' + H.esc(b.vendorName || '') + '</td>' +
        '<td class="py-2.5 px-4 text-right">' + H.money(b.balanceDue) + '</td>' +
        '<td class="py-2.5 px-4"><input type="number" step="0.01" class="acct-pay-amt w-28 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm" data-id="' + b.id + '" value="' + b.balanceDue + '"></td></tr>';
    }).join('');
    var sel = $('acct-pay-vendor');
    if (sel && !sel.options.length) {
      sel.innerHTML = '<option value="">Choose vendor…</option>' + S.vendors.map(function (v) {
        var name = v.companyName || v.company_name || v.displayName || v.display_name || ('Vendor #' + v.id);
        return '<option value="' + v.id + '">' + H.esc(name) + '</option>';
      }).join('');
    }
  }

  async function loadDeposits() {
    var und = await apiGet('/api/admin/accounting/undeposited');
    S.undeposited = und.payments || [];
    var deps = await apiGet('/api/admin/accounting/deposits');
    S.deposits = deps.deposits || [];
    var accounts = await apiGet('/api/admin/accounting/accounts');
    S.accounts = accounts.accounts || [];
    var banks = S.accounts.filter(function (a) { return a.type === 'bank' && a.active; });
    var bankSel = $('acct-deposit-bank');
    if (bankSel) {
      bankSel.innerHTML = banks.map(function (a) {
        return '<option value="' + a.id + '"' + (a.systemKey === 'checking' ? ' selected' : '') + '>' +
          H.esc(a.number + ' · ' + a.name) + '</option>';
      }).join('');
    }
    var ubody = $('acct-undeposited-body');
    if (ubody) {
      if (!S.undeposited.length) {
        ubody.innerHTML = '<tr><td colspan="5" class="py-6 px-4 text-slate-500">No undeposited customer payments.</td></tr>';
      } else {
        ubody.innerHTML = S.undeposited.map(function (p) {
          return '<tr class="border-t border-slate-800">' +
            '<td class="py-2.5 px-4"><input type="checkbox" class="acct-dep-check" data-id="' + p.id + '"></td>' +
            '<td class="py-2.5 px-4">' + H.esc(p.paymentDate) + '</td>' +
            '<td class="py-2.5 px-4">' + H.esc(p.customerName || '') + '</td>' +
            '<td class="py-2.5 px-4">' + H.esc(p.method || '') + '</td>' +
            '<td class="py-2.5 px-4 text-right">' + H.money(p.amount) + '</td></tr>';
        }).join('');
      }
    }
    var dbody = $('acct-deposits-body');
    if (dbody) {
      if (!S.deposits.length) {
        dbody.innerHTML = '<tr><td colspan="4" class="py-6 px-4 text-slate-500">No bank deposits yet.</td></tr>';
      } else {
        dbody.innerHTML = S.deposits.map(function (d) {
          return '<tr class="border-t border-slate-800">' +
            '<td class="py-2.5 px-4">' + H.esc(d.number) + '</td>' +
            '<td class="py-2.5 px-4">' + H.esc(d.depositDate) + '</td>' +
            '<td class="py-2.5 px-4">' + H.esc(d.bankAccountName || '') + '</td>' +
            '<td class="py-2.5 px-4 text-right">' + H.money(d.total) + '</td></tr>';
        }).join('');
      }
    }
  }

  async function loadJournals() {
    var data = await apiGet('/api/admin/accounting/journals');
    S.journals = data.entries || [];
    var tbody = $('acct-journals-body');
    if (!tbody) return;
    if (!S.journals.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="py-6 px-4 text-slate-500">No journal entries yet.</td></tr>';
      return;
    }
    tbody.innerHTML = S.journals.map(function (e) {
      return '<tr class="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer" data-je-id="' + e.id + '">' +
        '<td class="py-2.5 px-4 font-medium">' + H.esc(e.number) + '</td>' +
        '<td class="py-2.5 px-4">' + H.esc(e.entryDate) + '</td>' +
        '<td class="py-2.5 px-4">' + H.esc(e.memo || e.sourceType || '') + '</td>' +
        '<td class="py-2.5 px-4 capitalize">' + H.esc(e.status) + '</td>' +
        '<td class="py-2.5 px-4 text-slate-500 text-xs">' + H.esc(e.sourceType || 'manual') + '</td></tr>';
    }).join('');
  }

  async function loadReports() {
    var from = ($('acct-report-from') && $('acct-report-from').value) || '';
    var to = ($('acct-report-to') && $('acct-report-to').value) || '';
    var q = [];
    if (from) q.push('from=' + encodeURIComponent(from));
    if (to) q.push('to=' + encodeURIComponent(to));
    if (to) q.push('asOf=' + encodeURIComponent(to));
    var data = await apiGet('/api/admin/accounting/reports' + (q.length ? '?' + q.join('&') : ''));
    S.reports = data.reports || {};
    renderReportTab();
  }

  function renderReportTab() {
    var r = S.reports || {};
    var host = $('acct-report-body');
    if (!host) return;
    var tab = S.reportTab || 'pnl';
    document.querySelectorAll('[data-acct-report-tab]').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.getAttribute('data-acct-report-tab') === tab);
    });
    if (tab === 'pnl') {
      var pnl = r.profitAndLoss || {};
      host.innerHTML =
        '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">' +
        kpi('Income', H.money(pnl.income)) +
        kpi('COGS', H.money(pnl.cogs)) +
        kpi('Expense', H.money(pnl.expense)) +
        kpi('Net income', H.money(pnl.netIncome)) +
        '</div>' +
        tableWrap(['Account', 'Type', 'Amount'], (pnl.lines || []).map(function (l) {
          return [l.number + ' · ' + l.name, l.typeLabel || l.type, H.money(l.amount)];
        }));
    } else if (tab === 'bs') {
      var bs = r.balanceSheet || {};
      host.innerHTML =
        '<div class="grid grid-cols-3 gap-3 mb-4">' +
        kpi('Assets', H.money(bs.assetTotal)) +
        kpi('Liabilities', H.money(bs.liabilityTotal)) +
        kpi('Equity (+ NI)', H.money(bs.equityTotal)) +
        '</div>' +
        '<h4 class="text-sm font-semibold mb-2">Assets</h4>' +
        tableWrap(['Account', 'Balance'], (bs.assets || []).map(function (a) {
          return [a.number + ' · ' + a.name, H.money(a.balance)];
        })) +
        '<h4 class="text-sm font-semibold mb-2 mt-4">Liabilities</h4>' +
        tableWrap(['Account', 'Balance'], (bs.liabilities || []).map(function (a) {
          return [a.number + ' · ' + a.name, H.money(a.balance)];
        })) +
        '<h4 class="text-sm font-semibold mb-2 mt-4">Equity</h4>' +
        tableWrap(['Account', 'Balance'], (bs.equity || []).concat([{ number: '', name: 'Net Income', balance: bs.netIncome }]).map(function (a) {
          return [(a.number ? a.number + ' · ' : '') + a.name, H.money(a.balance)];
        }));
    } else if (tab === 'ar') {
      host.innerHTML = agingHtml('Accounts Receivable', r.arAging, 'Customer');
    } else {
      host.innerHTML = agingHtml('Accounts Payable', r.apAging, 'Vendor');
    }
  }

  function kpi(label, value) {
    return '<div class="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-3">' +
      '<div class="text-[11px] text-slate-500">' + H.esc(label) + '</div>' +
      '<div class="text-lg font-semibold mt-1">' + value + '</div></div>';
  }

  function tableWrap(headers, rows) {
    if (!rows.length) return '<p class="text-sm text-slate-500">No rows.</p>';
    return '<div class="cc-table-wrap overflow-auto max-h-[28rem] border border-slate-800 rounded-xl">' +
      '<table class="w-full text-sm"><thead><tr>' +
      headers.map(function (h) {
        return '<th class="py-2.5 px-4 text-left text-xs font-medium text-slate-400 sticky top-0 bg-slate-950">' + H.esc(h) + '</th>';
      }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (row) {
        return '<tr class="border-t border-slate-800">' + row.map(function (cell, i) {
          var align = i === row.length - 1 ? ' text-right' : '';
          return '<td class="py-2 px-4' + align + '">' + cell + '</td>';
        }).join('') + '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function agingHtml(title, aging, partyLabel) {
    var a = aging || { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0, rows: [] };
    return '<h3 class="font-semibold mb-3">' + H.esc(title) + '</h3>' +
      '<div class="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-4">' +
      kpi('Current', H.money(a.current)) +
      kpi('1–30', H.money(a['1-30'])) +
      kpi('31–60', H.money(a['31-60'])) +
      kpi('61–90', H.money(a['61-90'])) +
      kpi('90+', H.money(a['90+'])) +
      kpi('Total', H.money(a.total)) +
      '</div>' +
      tableWrap(['Doc', partyLabel, 'Due', 'Bucket', 'Balance'], (a.rows || []).map(function (row) {
        return [
          H.esc(row.number),
          H.esc(row.customerName || row.vendorName || ''),
          H.esc(row.dueDate || ''),
          H.esc(row.bucket),
          H.money(row.balance)
        ];
      }));
  }

  function openAccountModal(account) {
    $('acct-account-id').value = account && account.id || '';
    $('acct-account-number').value = account && account.number || '';
    $('acct-account-name').value = account && account.name || '';
    $('acct-account-type').value = account && account.type || 'expense';
    $('acct-account-active').checked = !account || account.active !== false;
    $('acct-account-number').disabled = !!(account && account.isSystem);
    $('acct-account-type').disabled = !!(account && account.isSystem);
    $('acct-account-modal').classList.remove('hidden');
  }

  function closeAccountModal() {
    $('acct-account-modal').classList.add('hidden');
  }

  async function saveAccount(e) {
    e.preventDefault();
    var id = $('acct-account-id').value;
    var body = {
      number: $('acct-account-number').value,
      name: $('acct-account-name').value,
      type: $('acct-account-type').value,
      active: $('acct-account-active').checked
    };
    try {
      if (id) await apiSend('PUT', '/api/admin/accounting/accounts/' + id, body);
      else await apiSend('POST', '/api/admin/accounting/accounts', body);
      closeAccountModal();
      H.toast('Account saved');
      await loadAccounts();
    } catch (err) {
      H.toast(err.message || String(err), true);
    }
  }

  async function openBillModal(bill) {
    await ensureVendors();
    var sel = $('acct-bill-vendor');
    sel.innerHTML = '<option value="">Choose vendor…</option>' + S.vendors.map(function (v) {
      var name = v.companyName || v.company_name || v.displayName || v.display_name || ('Vendor #' + v.id);
      return '<option value="' + v.id + '">' + H.esc(name) + '</option>';
    }).join('');
    if (!S.accounts.length) {
      var acctData = await apiGet('/api/admin/accounting/accounts');
      S.accounts = acctData.accounts || [];
    }
    $('acct-bill-id').value = bill && bill.id || '';
    sel.value = bill && bill.vendorId ? String(bill.vendorId) : '';
    $('acct-bill-date').value = bill && bill.billDate || new Date().toISOString().slice(0, 10);
    $('acct-bill-due').value = bill && bill.dueDate || '';
    $('acct-bill-memo').value = bill && bill.memo || '';
    var lines = (bill && bill.lines && bill.lines.length) ? bill.lines : [{ item: '', description: '', qty: 1, unitCost: 0, amount: 0 }];
    renderBillLines(lines);
    $('acct-bill-modal').classList.remove('hidden');
  }

  function renderBillLines(lines) {
    var expense = S.accounts.find(function (a) { return a.systemKey === 'expense'; });
    var host = $('acct-bill-lines');
    host.innerHTML = lines.map(function (line, i) {
      return '<div class="grid grid-cols-12 gap-2 acct-bill-line" data-i="' + i + '">' +
        '<input class="col-span-3 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm" placeholder="Item" data-f="item" value="' + H.esc(line.item || '') + '">' +
        '<input class="col-span-4 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm" placeholder="Description" data-f="description" value="' + H.esc(line.description || '') + '">' +
        '<input type="number" step="0.01" class="col-span-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm" placeholder="Qty" data-f="qty" value="' + (line.qty || 1) + '">' +
        '<input type="number" step="0.01" class="col-span-2 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm" placeholder="Rate" data-f="unitCost" value="' + (line.unitCost || 0) + '">' +
        '<select class="col-span-2 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm" data-f="accountId">' +
        S.accounts.filter(function (a) { return a.active; }).map(function (a) {
          var selected = String(line.accountId || (expense && expense.id) || '') === String(a.id) ? ' selected' : '';
          return '<option value="' + a.id + '"' + selected + '>' + H.esc(a.number + ' ' + a.name) + '</option>';
        }).join('') +
        '</select></div>';
    }).join('');
  }

  function closeBillModal() {
    $('acct-bill-modal').classList.add('hidden');
  }

  function readBillLines() {
    return Array.from(document.querySelectorAll('#acct-bill-lines .acct-bill-line')).map(function (row) {
      var get = function (f) {
        var el = row.querySelector('[data-f="' + f + '"]');
        return el ? el.value : '';
      };
      var qty = Number(get('qty')) || 0;
      var unitCost = Number(get('unitCost')) || 0;
      return {
        item: get('item'),
        description: get('description'),
        qty: qty,
        unitCost: unitCost,
        amount: Math.round(qty * unitCost * 100) / 100,
        accountId: get('accountId') ? Number(get('accountId')) : null
      };
    });
  }

  async function saveBill(e) {
    e.preventDefault();
    var id = $('acct-bill-id').value;
    var body = {
      vendorId: Number($('acct-bill-vendor').value),
      billDate: $('acct-bill-date').value,
      dueDate: $('acct-bill-due').value,
      memo: $('acct-bill-memo').value,
      status: 'open',
      lines: readBillLines()
    };
    try {
      if (id) await apiSend('PUT', '/api/admin/accounting/bills/' + id, body);
      else await apiSend('POST', '/api/admin/accounting/bills', body);
      closeBillModal();
      H.toast('Bill saved');
      await loadBills();
    } catch (err) {
      H.toast(err.message || String(err), true);
    }
  }

  async function savePayBills(e) {
    e.preventDefault();
    var vendorId = Number($('acct-pay-vendor').value);
    if (!vendorId) return H.toast('Choose a vendor', true);
    var apps = [];
    document.querySelectorAll('.acct-pay-check:checked').forEach(function (chk) {
      if (Number(chk.getAttribute('data-vendor')) !== vendorId) return;
      var id = chk.getAttribute('data-id');
      var amtEl = document.querySelector('.acct-pay-amt[data-id="' + id + '"]');
      var amount = Number(amtEl && amtEl.value);
      if (amount > 0) apps.push({ billId: Number(id), amount: amount });
    });
    if (!apps.length) return H.toast('Select open bills for this vendor', true);
    var amount = apps.reduce(function (s, a) { return s + a.amount; }, 0);
    try {
      await apiSend('POST', '/api/admin/accounting/bill-payments', {
        vendorId: vendorId,
        paymentDate: $('acct-pay-date').value || new Date().toISOString().slice(0, 10),
        method: $('acct-pay-method').value || 'ACH',
        reference: $('acct-pay-ref').value || '',
        amount: Math.round(amount * 100) / 100,
        applications: apps
      });
      H.toast('Bill payment recorded');
      await loadPayBills();
    } catch (err) {
      H.toast(err.message || String(err), true);
    }
  }

  async function saveDeposit(e) {
    e.preventDefault();
    var ids = Array.from(document.querySelectorAll('.acct-dep-check:checked')).map(function (c) {
      return Number(c.getAttribute('data-id'));
    });
    try {
      await apiSend('POST', '/api/admin/accounting/deposits', {
        bankAccountId: Number($('acct-deposit-bank').value),
        depositDate: $('acct-deposit-date').value || new Date().toISOString().slice(0, 10),
        memo: $('acct-deposit-memo').value || '',
        paymentIds: ids
      });
      H.toast('Deposit recorded');
      await loadDeposits();
    } catch (err) {
      H.toast(err.message || String(err), true);
    }
  }

  async function openJournalModal() {
    if (!S.accounts.length) {
      var acctData = await apiGet('/api/admin/accounting/accounts');
      S.accounts = acctData.accounts || [];
    }
    $('acct-je-date').value = new Date().toISOString().slice(0, 10);
    $('acct-je-memo').value = '';
    renderJeLines([
      { accountId: '', description: '', debit: '', credit: '' },
      { accountId: '', description: '', debit: '', credit: '' }
    ]);
    $('acct-je-modal').classList.remove('hidden');
  }

  function renderJeLines(lines) {
    var host = $('acct-je-lines');
    host.innerHTML = lines.map(function () {
      return '<div class="grid grid-cols-12 gap-2 acct-je-line">' +
        '<select class="col-span-4 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm" data-f="accountId">' +
        '<option value="">Account…</option>' +
        S.accounts.filter(function (a) { return a.active; }).map(function (a) {
          return '<option value="' + a.id + '">' + H.esc(a.number + ' · ' + a.name) + '</option>';
        }).join('') +
        '</select>' +
        '<input class="col-span-4 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm" placeholder="Description" data-f="description">' +
        '<input type="number" step="0.01" class="col-span-2 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm" placeholder="Debit" data-f="debit">' +
        '<input type="number" step="0.01" class="col-span-2 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm" placeholder="Credit" data-f="credit">' +
        '</div>';
    }).join('');
  }

  function closeJeModal() {
    $('acct-je-modal').classList.add('hidden');
  }

  async function saveJournal(e) {
    e.preventDefault();
    var lines = Array.from(document.querySelectorAll('#acct-je-lines .acct-je-line')).map(function (row) {
      var get = function (f) {
        var el = row.querySelector('[data-f="' + f + '"]');
        return el ? el.value : '';
      };
      return {
        accountId: get('accountId') ? Number(get('accountId')) : null,
        description: get('description'),
        debit: Number(get('debit')) || 0,
        credit: Number(get('credit')) || 0
      };
    });
    try {
      await apiSend('POST', '/api/admin/accounting/journals', {
        entryDate: $('acct-je-date').value,
        memo: $('acct-je-memo').value,
        lines: lines
      });
      closeJeModal();
      H.toast('Journal entry posted');
      await loadJournals();
    } catch (err) {
      H.toast(err.message || String(err), true);
    }
  }

  async function showJournal(id) {
    var data = await apiGet('/api/admin/accounting/journals/' + id);
    var e = data.entry;
    if (!e) return;
    var host = $('acct-je-detail');
    if (!host) return;
    host.classList.remove('hidden');
    host.innerHTML =
      '<div class="flex items-center justify-between mb-3">' +
      '<div><h3 class="font-semibold">' + H.esc(e.number) + '</h3>' +
      '<p class="text-xs text-slate-500">' + H.esc(e.entryDate) + ' · ' + H.esc(e.status) +
      (e.sourceType ? ' · ' + H.esc(e.sourceType) : '') + '</p></div>' +
      '<button type="button" class="text-slate-400 text-sm" id="acct-je-detail-close">Close</button></div>' +
      '<p class="text-sm text-slate-300 mb-3">' + H.esc(e.memo || '') + '</p>' +
      tableWrap(['Account', 'Description', 'Debit', 'Credit'], (e.lines || []).map(function (l) {
        return [
          H.esc((l.accountNumber || '') + ' · ' + (l.accountName || '')),
          H.esc(l.description || ''),
          l.debit ? H.money(l.debit) : '',
          l.credit ? H.money(l.credit) : ''
        ];
      }));
    $('acct-je-detail-close').onclick = function () { host.classList.add('hidden'); };
  }

  function bind() {
    var root = $('accounting-section');
    if (!root || root.getAttribute('data-bound')) return;
    root.setAttribute('data-bound', '1');

    root.addEventListener('click', function (e) {
      var edit = e.target.closest('[data-acct-edit]');
      if (edit) {
        var acct = S.accounts.find(function (a) { return String(a.id) === edit.getAttribute('data-acct-edit'); });
        if (acct) openAccountModal(acct);
        return;
      }
      var billRow = e.target.closest('[data-bill-id]');
      if (billRow && S.view === 'bills') {
        var bill = S.bills.find(function (b) { return String(b.id) === billRow.getAttribute('data-bill-id'); });
        if (bill) {
          apiGet('/api/admin/accounting/bills/' + bill.id).then(function (data) {
            openBillModal(data.bill);
          }).catch(function (err) { H.toast(err.message, true); });
        }
        return;
      }
      var jeRow = e.target.closest('[data-je-id]');
      if (jeRow && S.view === 'journals') {
        showJournal(jeRow.getAttribute('data-je-id'));
      }
    });

    var newAcct = $('acct-new-account');
    if (newAcct) {
      newAcct.classList.toggle('hidden', !H.canEdit('chart-of-accounts'));
      newAcct.addEventListener('click', function () { openAccountModal(null); });
    }
    var acctForm = $('acct-account-form');
    if (acctForm) acctForm.addEventListener('submit', saveAccount);
    var acctCancel = $('acct-account-cancel');
    if (acctCancel) acctCancel.addEventListener('click', closeAccountModal);

    var newBill = $('acct-new-bill');
    if (newBill) {
      newBill.classList.toggle('hidden', !H.canEdit('bills'));
      newBill.addEventListener('click', function () { openBillModal(null); });
    }
    var addBillLine = $('acct-add-bill-line');
    if (addBillLine) addBillLine.addEventListener('click', function () {
      renderBillLines(readBillLines().concat([{ item: '', description: '', qty: 1, unitCost: 0 }]));
    });
    var billForm = $('acct-bill-form');
    if (billForm) billForm.addEventListener('submit', saveBill);
    var billCancel = $('acct-bill-cancel');
    if (billCancel) billCancel.addEventListener('click', closeBillModal);

    var payForm = $('acct-pay-form');
    if (payForm) payForm.addEventListener('submit', savePayBills);

    var depForm = $('acct-deposit-form');
    if (depForm) depForm.addEventListener('submit', saveDeposit);
    var depDate = $('acct-deposit-date');
    if (depDate && !depDate.value) depDate.value = new Date().toISOString().slice(0, 10);
    var payDate = $('acct-pay-date');
    if (payDate && !payDate.value) payDate.value = new Date().toISOString().slice(0, 10);

    var newJe = $('acct-new-journal');
    if (newJe) newJe.addEventListener('click', openJournalModal);
    var addJeLine = $('acct-add-je-line');
    if (addJeLine) addJeLine.addEventListener('click', function () {
      var cur = Array.from(document.querySelectorAll('#acct-je-lines .acct-je-line')).map(function () { return {}; });
      renderJeLines(cur.concat([{}, {}]));
    });
    var jeForm = $('acct-je-form');
    if (jeForm) jeForm.addEventListener('submit', saveJournal);
    var jeCancel = $('acct-je-cancel');
    if (jeCancel) jeCancel.addEventListener('click', closeJeModal);

    document.querySelectorAll('[data-acct-report-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        S.reportTab = btn.getAttribute('data-acct-report-tab');
        renderReportTab();
      });
    });
    var reportRun = $('acct-report-run');
    if (reportRun) reportRun.addEventListener('click', function () { loadReports(); });

    var typeSel = $('acct-account-type');
    if (typeSel && !typeSel.options.length) {
      typeSel.innerHTML = ACCOUNT_TYPES.map(function (t) {
        return '<option value="' + t[0] + '">' + t[1] + '</option>';
      }).join('');
    }
  }

  function boot(helpers) {
    Object.assign(H, helpers || {});
    bind();
    S.loaded = true;
  }

  async function openRouted(view) {
    var map = {
      accounting: 'overview',
      'chart-of-accounts': 'chart-of-accounts',
      bills: 'bills',
      'bill-payments': 'bill-payments',
      deposits: 'deposits',
      journals: 'journals',
      reports: 'reports'
    };
    setView(map[view] || view || 'overview');
  }

  global.SpectrumAccounting = {
    boot: boot,
    openRouted: openRouted,
    setView: setView,
    view: function () { return S.view; }
  };
})(window);
