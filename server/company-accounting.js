/**
 * Company Accounting V1 — chart of accounts, bills/AP, journal entries,
 * bank deposits, and reports. Customer invoices/payments stay in Customer;
 * this module posts GL and owns vendor bills + books reports.
 */

function trim(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 240);
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function idOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const ACCOUNT_TYPES = [
  'bank',
  'accounts_receivable',
  'other_current_asset',
  'fixed_asset',
  'inventory',
  'accounts_payable',
  'other_current_liability',
  'long_term_liability',
  'equity',
  'income',
  'other_income',
  'cogs',
  'expense',
  'other_expense'
];

const BILL_STATUSES = ['draft', 'open', 'paid', 'void'];
const ENTRY_STATUSES = ['draft', 'posted', 'void'];
const DEPOSIT_STATUSES = ['draft', 'posted', 'void'];

const DEFAULT_ACCOUNTS = [
  { number: '1000', name: 'Checking', type: 'bank', systemKey: 'checking' },
  { number: '1050', name: 'Undeposited Funds', type: 'other_current_asset', systemKey: 'undeposited' },
  { number: '1100', name: 'Accounts Receivable', type: 'accounts_receivable', systemKey: 'ar' },
  { number: '1200', name: 'Inventory Asset', type: 'inventory', systemKey: 'inventory' },
  { number: '2000', name: 'Accounts Payable', type: 'accounts_payable', systemKey: 'ap' },
  { number: '3000', name: "Owner's Equity", type: 'equity', systemKey: 'equity' },
  { number: '4000', name: 'Sales Income', type: 'income', systemKey: 'sales' },
  { number: '4100', name: 'Card Fee Income', type: 'other_income', systemKey: 'card_fee_income' },
  { number: '5000', name: 'Cost of Goods Sold', type: 'cogs', systemKey: 'cogs' },
  { number: '6000', name: 'Operating Expense', type: 'expense', systemKey: 'expense' },
  { number: '6100', name: 'Card Processing Fees', type: 'expense', systemKey: 'card_fee_expense' }
];

function accountType(value) {
  const v = String(value || '').toLowerCase().trim();
  return ACCOUNT_TYPES.indexOf(v) === -1 ? 'expense' : v;
}

function billStatus(value) {
  const v = String(value || 'draft').toLowerCase().trim();
  return BILL_STATUSES.indexOf(v) === -1 ? 'draft' : v;
}

function entryStatus(value) {
  const v = String(value || 'draft').toLowerCase().trim();
  return ENTRY_STATUSES.indexOf(v) === -1 ? 'draft' : v;
}

function depositStatus(value) {
  const v = String(value || 'draft').toLowerCase().trim();
  return DEPOSIT_STATUSES.indexOf(v) === -1 ? 'draft' : v;
}

function isDebitNormal(type) {
  return (
    type === 'bank' ||
    type === 'accounts_receivable' ||
    type === 'other_current_asset' ||
    type === 'fixed_asset' ||
    type === 'inventory' ||
    type === 'cogs' ||
    type === 'expense' ||
    type === 'other_expense'
  );
}

function accountTypeLabel(type) {
  const map = {
    bank: 'Bank',
    accounts_receivable: 'Accounts Receivable',
    other_current_asset: 'Other Current Asset',
    fixed_asset: 'Fixed Asset',
    inventory: 'Inventory',
    accounts_payable: 'Accounts Payable',
    other_current_liability: 'Other Current Liability',
    long_term_liability: 'Long-term Liability',
    equity: 'Equity',
    income: 'Income',
    other_income: 'Other Income',
    cogs: 'Cost of Goods Sold',
    expense: 'Expense',
    other_expense: 'Other Expense'
  };
  return map[type] || type;
}

function formatAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    number: row.number || '',
    name: row.name || '',
    type: accountType(row.type),
    typeLabel: accountTypeLabel(row.type),
    systemKey: row.system_key || row.systemKey || '',
    active: row.active == null ? true : bool(row.active),
    isSystem: bool(row.is_system || row.isSystem),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

function normalizeAccount(input) {
  const src = input || {};
  const number = trim(src.number, 20);
  const name = trim(src.name, 120);
  if (!number) throw new Error('Enter an account number.');
  if (!name) throw new Error('Enter an account name.');
  return {
    number: number,
    name: name,
    type: accountType(src.type),
    systemKey: trim(src.systemKey || src.system_key, 40),
    active: src.active == null ? true : bool(src.active),
    isSystem: bool(src.isSystem || src.is_system)
  };
}

function formatBillLine(row) {
  return {
    id: row.id,
    billId: row.bill_id || row.billId,
    sku: row.sku || '',
    item: row.item || '',
    description: row.description || '',
    qty: money(row.qty),
    unitCost: money(row.unit_cost != null ? row.unit_cost : row.unitCost),
    amount: money(row.amount),
    accountId: row.account_id != null ? row.account_id : row.accountId,
    sortOrder: Number(row.sort_order != null ? row.sort_order : row.sortOrder) || 0
  };
}

function normalizeBillLines(list) {
  return (Array.isArray(list) ? list : []).map(function (row, i) {
    const qty = money(row && row.qty);
    const unitCost = money(row && (row.unitCost != null ? row.unitCost : row.unit_cost));
    let amount = money(row && row.amount);
    if (!(amount > 0) && (qty || unitCost)) amount = money(qty * unitCost);
    return {
      sku: trim(row && row.sku, 80),
      item: trim(row && row.item, 120),
      description: trim(row && row.description, 500),
      qty: qty,
      unitCost: unitCost,
      amount: amount,
      accountId: idOrNull(row && (row.accountId != null ? row.accountId : row.account_id)),
      sortOrder: i
    };
  }).filter(function (line) {
    return line.item || line.description || line.amount || line.sku;
  });
}

function formatBill(row, lines, paid) {
  if (!row) return null;
  const total = money(row.total);
  const amountPaid = money(paid != null ? paid : row.amount_paid);
  const balance = money(Math.max(0, total - amountPaid));
  return {
    id: row.id,
    number: row.number || '',
    vendorId: row.vendor_id != null ? row.vendor_id : row.vendorId,
    vendorName: row.vendor_name || row.vendorName || '',
    billDate: row.bill_date || row.billDate || '',
    dueDate: row.due_date || row.dueDate || '',
    status: billStatus(row.status),
    terms: row.terms || '',
    memo: row.memo || '',
    poId: row.po_id != null ? row.po_id : row.poId,
    poNumber: row.po_number || row.poNumber || '',
    subtotal: money(row.subtotal),
    tax: money(row.tax),
    total: total,
    amountPaid: amountPaid,
    balanceDue: balance,
    journalId: row.journal_id != null ? row.journal_id : row.journalId,
    lines: (lines || []).map(formatBillLine),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

function normalizeBill(input) {
  const src = input || {};
  const vendorId = idOrNull(src.vendorId != null ? src.vendorId : src.vendor_id);
  if (!vendorId) throw new Error('Select a vendor.');
  const lines = normalizeBillLines(src.lines);
  const subtotal = money(lines.reduce(function (s, l) { return s + l.amount; }, 0));
  const tax = money(src.tax);
  const total = money(src.total != null ? src.total : subtotal + tax);
  return {
    number: trim(src.number, 40),
    vendorId: vendorId,
    billDate: trim(src.billDate || src.bill_date, 20) || todayIso(),
    dueDate: trim(src.dueDate || src.due_date, 20),
    status: billStatus(src.status || 'open'),
    terms: trim(src.terms, 40) || 'Net 30',
    memo: trim(src.memo, 500),
    poId: idOrNull(src.poId != null ? src.poId : src.po_id),
    subtotal: subtotal,
    tax: tax,
    total: total > 0 ? total : subtotal + tax,
    lines: lines
  };
}

function formatJournalLine(row) {
  return {
    id: row.id,
    entryId: row.entry_id || row.entryId,
    accountId: row.account_id != null ? row.account_id : row.accountId,
    accountNumber: row.account_number || row.accountNumber || '',
    accountName: row.account_name || row.accountName || '',
    description: row.description || '',
    debit: money(row.debit),
    credit: money(row.credit),
    sortOrder: Number(row.sort_order != null ? row.sort_order : row.sortOrder) || 0
  };
}

function normalizeJournalLines(list) {
  const lines = (Array.isArray(list) ? list : []).map(function (row, i) {
    const accountId = idOrNull(row && (row.accountId != null ? row.accountId : row.account_id));
    const debit = money(row && row.debit);
    const credit = money(row && row.credit);
    if (!accountId || (!(debit > 0) && !(credit > 0))) return null;
    if (debit > 0 && credit > 0) throw new Error('A journal line cannot have both debit and credit.');
    return {
      accountId: accountId,
      description: trim(row && row.description, 240),
      debit: debit,
      credit: credit,
      sortOrder: i
    };
  }).filter(Boolean);
  if (lines.length < 2) throw new Error('Enter at least two journal lines.');
  const debits = money(lines.reduce(function (s, l) { return s + l.debit; }, 0));
  const credits = money(lines.reduce(function (s, l) { return s + l.credit; }, 0));
  if (Math.abs(debits - credits) > 0.009) {
    throw new Error('Journal entry must balance. Debits $' + debits.toFixed(2) + ' vs credits $' + credits.toFixed(2) + '.');
  }
  return lines;
}

function formatJournal(row, lines) {
  if (!row) return null;
  const ls = (lines || []).map(formatJournalLine);
  return {
    id: row.id,
    number: row.number || '',
    entryDate: row.entry_date || row.entryDate || '',
    memo: row.memo || '',
    sourceType: row.source_type || row.sourceType || '',
    sourceId: row.source_id != null ? row.source_id : row.sourceId,
    status: entryStatus(row.status),
    lines: ls,
    totalDebit: money(ls.reduce(function (s, l) { return s + l.debit; }, 0)),
    totalCredit: money(ls.reduce(function (s, l) { return s + l.credit; }, 0)),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

function normalizeJournal(input) {
  const src = input || {};
  return {
    number: trim(src.number, 40),
    entryDate: trim(src.entryDate || src.entry_date, 20) || todayIso(),
    memo: trim(src.memo, 500),
    sourceType: trim(src.sourceType || src.source_type, 40),
    sourceId: idOrNull(src.sourceId != null ? src.sourceId : src.source_id),
    status: entryStatus(src.status || 'posted'),
    lines: normalizeJournalLines(src.lines)
  };
}

function formatDeposit(row, paymentIds) {
  if (!row) return null;
  return {
    id: row.id,
    number: row.number || '',
    depositDate: row.deposit_date || row.depositDate || '',
    bankAccountId: row.bank_account_id != null ? row.bank_account_id : row.bankAccountId,
    bankAccountName: row.bank_account_name || row.bankAccountName || '',
    memo: row.memo || '',
    total: money(row.total),
    status: depositStatus(row.status),
    journalId: row.journal_id != null ? row.journal_id : row.journalId,
    paymentIds: paymentIds || [],
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

function normalizeDeposit(input) {
  const src = input || {};
  const bankAccountId = idOrNull(src.bankAccountId != null ? src.bankAccountId : src.bank_account_id);
  if (!bankAccountId) throw new Error('Select a bank account.');
  const paymentIds = (Array.isArray(src.paymentIds || src.payment_ids) ? (src.paymentIds || src.payment_ids) : [])
    .map(idOrNull)
    .filter(Boolean);
  if (!paymentIds.length) throw new Error('Select at least one payment to deposit.');
  return {
    number: trim(src.number, 40),
    depositDate: trim(src.depositDate || src.deposit_date, 20) || todayIso(),
    bankAccountId: bankAccountId,
    memo: trim(src.memo, 500),
    status: depositStatus(src.status || 'posted'),
    paymentIds: paymentIds
  };
}

function nextNumber(existing, prefix) {
  let max = 1000;
  (existing || []).forEach(function (n) {
    const m = String(n || '').match(new RegExp('^' + prefix + '-(\\d+)$', 'i'));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return prefix + '-' + String(max + 1);
}

function daysBetween(a, b) {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 0;
  return Math.floor((db - da) / 86400000);
}

function agingBucket(daysPastDue) {
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 30) return '1-30';
  if (daysPastDue <= 60) return '31-60';
  if (daysPastDue <= 90) return '61-90';
  return '90+';
}

function emptyAging() {
  return { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0, rows: [] };
}

function ensureCompanyAccounting(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_gl_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'expense',
      system_key TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS company_gl_accounts_type_idx ON company_gl_accounts (type, number);

    CREATE TABLE IF NOT EXISTS company_journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      entry_date TEXT NOT NULL DEFAULT '',
      memo TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL DEFAULT '',
      source_id INTEGER,
      status TEXT NOT NULL DEFAULT 'posted',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS company_journal_entries_date_idx ON company_journal_entries (entry_date, id);

    CREATE TABLE IF NOT EXISTS company_journal_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (entry_id) REFERENCES company_journal_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES company_gl_accounts(id)
    );
    CREATE INDEX IF NOT EXISTS company_journal_lines_entry_idx ON company_journal_lines (entry_id, sort_order);
    CREATE INDEX IF NOT EXISTS company_journal_lines_account_idx ON company_journal_lines (account_id);

    CREATE TABLE IF NOT EXISTS company_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      vendor_id INTEGER NOT NULL,
      bill_date TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      terms TEXT NOT NULL DEFAULT 'Net 30',
      memo TEXT NOT NULL DEFAULT '',
      po_id INTEGER,
      subtotal REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      journal_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (vendor_id) REFERENCES inventory_vendors(id)
    );
    CREATE INDEX IF NOT EXISTS company_bills_vendor_idx ON company_bills (vendor_id, bill_date);

    CREATE TABLE IF NOT EXISTS company_bill_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      item TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      qty REAL NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      amount REAL NOT NULL DEFAULT 0,
      account_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (bill_id) REFERENCES company_bills(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS company_bill_lines_bill_idx ON company_bill_lines (bill_id, sort_order);

    CREATE TABLE IF NOT EXISTS company_bill_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      payment_date TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      method TEXT NOT NULL DEFAULT 'ACH',
      reference TEXT NOT NULL DEFAULT '',
      memo TEXT NOT NULL DEFAULT '',
      bank_account_id INTEGER,
      status TEXT NOT NULL DEFAULT 'posted',
      journal_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (vendor_id) REFERENCES inventory_vendors(id)
    );
    CREATE INDEX IF NOT EXISTS company_bill_payments_vendor_idx ON company_bill_payments (vendor_id, payment_date);

    CREATE TABLE IF NOT EXISTS company_bill_payment_apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      bill_id INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (payment_id) REFERENCES company_bill_payments(id) ON DELETE CASCADE,
      FOREIGN KEY (bill_id) REFERENCES company_bills(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS company_bill_payment_apps_payment_idx ON company_bill_payment_apps (payment_id);
    CREATE INDEX IF NOT EXISTS company_bill_payment_apps_bill_idx ON company_bill_payment_apps (bill_id);

    CREATE TABLE IF NOT EXISTS company_bank_deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      deposit_date TEXT NOT NULL DEFAULT '',
      bank_account_id INTEGER NOT NULL,
      memo TEXT NOT NULL DEFAULT '',
      total REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'posted',
      journal_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS company_bank_deposit_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deposit_id INTEGER NOT NULL,
      payment_id INTEGER NOT NULL UNIQUE,
      FOREIGN KEY (deposit_id) REFERENCES company_bank_deposits(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS company_bank_deposit_payments_deposit_idx ON company_bank_deposit_payments (deposit_id);
  `);

  function addColumnIfMissing(table, columnSql) {
    try {
      const cols = db.prepare('PRAGMA table_info(' + table + ')').all().map(function (c) { return c.name; });
      const colName = String(columnSql || '').trim().split(/\s+/)[0];
      if (!colName || cols.indexOf(colName) !== -1) return;
      db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + columnSql);
    } catch (e) {
      console.warn('Accounting migrate ' + table + ':', e.message || e);
    }
  }
  addColumnIfMissing('company_customer_payments', 'deposited INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('company_customer_payments', 'journal_id INTEGER');
  addColumnIfMissing('company_sales_docs', 'journal_id INTEGER');
  addColumnIfMissing('company_card_fee_entries', 'journal_id INTEGER');

  seedDefaultAccounts(db);
}

function seedDefaultAccounts(db) {
  const stamp = require('./db').nowIso();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO company_gl_accounts
      (number, name, type, system_key, active, is_system, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 1, ?, ?)
  `);
  DEFAULT_ACCOUNTS.forEach(function (a) {
    insert.run(a.number, a.name, a.type, a.systemKey, stamp, stamp);
  });
  // Fill system_key on existing seeded rows missing it
  DEFAULT_ACCOUNTS.forEach(function (a) {
    db.prepare(`
      UPDATE company_gl_accounts
      SET system_key = ?, is_system = 1, updated_at = ?
      WHERE number = ? AND (system_key IS NULL OR system_key = '')
    `).run(a.systemKey, stamp, a.number);
  });
}

function sqliteApi(db, store) {
  const dbUtil = require('./db');

  function systemAccount(key) {
    const row = db.prepare('SELECT * FROM company_gl_accounts WHERE system_key = ? AND active = 1 LIMIT 1').get(key);
    return formatAccount(row);
  }

  function requireSystemAccount(key, label) {
    const acct = systemAccount(key);
    if (!acct) throw new Error('Missing system account: ' + (label || key) + '. Add it under Chart of Accounts.');
    return acct;
  }

  function billAmountPaid(billId) {
    const row = db.prepare(`
      SELECT COALESCE(SUM(a.amount), 0) AS paid
      FROM company_bill_payment_apps a
      JOIN company_bill_payments p ON p.id = a.payment_id
      WHERE a.bill_id = ? AND p.status = 'posted'
    `).get(billId);
    return money(row && row.paid);
  }

  function loadBill(id) {
    const row = db.prepare(`
      SELECT b.*, v.company_name AS vendor_name, v.display_name AS vendor_display,
             po.number AS po_number
      FROM company_bills b
      LEFT JOIN inventory_vendors v ON v.id = b.vendor_id
      LEFT JOIN purchase_orders po ON po.id = b.po_id
      WHERE b.id = ?
    `).get(id);
    if (!row) return null;
    if (!row.vendor_name && row.vendor_display) row.vendor_name = row.vendor_display;
    const lines = db.prepare('SELECT * FROM company_bill_lines WHERE bill_id = ? ORDER BY sort_order, id').all(id);
    return formatBill(row, lines, billAmountPaid(id));
  }

  function loadJournal(id) {
    const row = db.prepare('SELECT * FROM company_journal_entries WHERE id = ?').get(id);
    if (!row) return null;
    const lines = db.prepare(`
      SELECT l.*, a.number AS account_number, a.name AS account_name
      FROM company_journal_lines l
      LEFT JOIN company_gl_accounts a ON a.id = l.account_id
      WHERE l.entry_id = ?
      ORDER BY l.sort_order, l.id
    `).all(id);
    return formatJournal(row, lines);
  }

  function loadDeposit(id) {
    const row = db.prepare(`
      SELECT d.*, a.name AS bank_account_name, a.number AS bank_account_number
      FROM company_bank_deposits d
      LEFT JOIN company_gl_accounts a ON a.id = d.bank_account_id
      WHERE d.id = ?
    `).get(id);
    if (!row) return null;
    if (row.bank_account_number) {
      row.bank_account_name = row.bank_account_number + ' · ' + (row.bank_account_name || '');
    }
    const paymentIds = db.prepare('SELECT payment_id FROM company_bank_deposit_payments WHERE deposit_id = ?')
      .all(id)
      .map(function (r) { return r.payment_id; });
    return formatDeposit(row, paymentIds);
  }

  async function createPostedJournal(payload) {
    const input = normalizeJournal(Object.assign({}, payload, { status: 'posted' }));
    const existing = db.prepare('SELECT number FROM company_journal_entries').all().map(function (r) { return r.number; });
    if (!input.number) input.number = nextNumber(existing, 'JE');
    if (db.prepare('SELECT id FROM company_journal_entries WHERE number = ?').get(input.number)) {
      throw new Error('Journal number already exists.');
    }
    const stamp = dbUtil.nowIso();
    const info = db.prepare(`
      INSERT INTO company_journal_entries
        (number, entry_date, memo, source_type, source_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'posted', ?, ?)
    `).run(
      input.number,
      input.entryDate,
      input.memo,
      input.sourceType,
      input.sourceId,
      stamp,
      stamp
    );
    const entryId = info.lastInsertRowid;
    const ins = db.prepare(`
      INSERT INTO company_journal_lines
        (entry_id, account_id, description, debit, credit, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    input.lines.forEach(function (line) {
      ins.run(entryId, line.accountId, line.description, line.debit, line.credit, line.sortOrder);
    });
    return loadJournal(entryId);
  }

  function accountBalances(asOf) {
    const asOfDate = trim(asOf, 20) || todayIso();
    const rows = db.prepare(`
      SELECT a.id, a.number, a.name, a.type, a.system_key,
             COALESCE(SUM(l.debit), 0) AS debit,
             COALESCE(SUM(l.credit), 0) AS credit
      FROM company_gl_accounts a
      LEFT JOIN company_journal_lines l ON l.account_id = a.id
      LEFT JOIN company_journal_entries e ON e.id = l.entry_id AND e.status = 'posted' AND e.entry_date <= ?
      WHERE a.active = 1
      GROUP BY a.id
      ORDER BY a.number COLLATE NOCASE
    `).all(asOfDate);
    return rows.map(function (row) {
      const debit = money(row.debit);
      const credit = money(row.credit);
      const type = accountType(row.type);
      const balance = isDebitNormal(type) ? money(debit - credit) : money(credit - debit);
      return Object.assign(formatAccount(row), {
        debit: debit,
        credit: credit,
        balance: balance
      });
    });
  }

  const api = {
    listGlAccounts: async function () {
      return db.prepare('SELECT * FROM company_gl_accounts ORDER BY number COLLATE NOCASE')
        .all()
        .map(formatAccount);
    },

    getGlAccount: async function (id) {
      return formatAccount(db.prepare('SELECT * FROM company_gl_accounts WHERE id = ?').get(id));
    },

    createGlAccount: async function (payload) {
      const input = normalizeAccount(payload);
      if (db.prepare('SELECT id FROM company_gl_accounts WHERE number = ?').get(input.number)) {
        throw new Error('Account number already exists.');
      }
      const stamp = dbUtil.nowIso();
      const info = db.prepare(`
        INSERT INTO company_gl_accounts
          (number, name, type, system_key, active, is_system, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.number,
        input.name,
        input.type,
        input.systemKey,
        input.active ? 1 : 0,
        input.isSystem ? 1 : 0,
        stamp,
        stamp
      );
      return formatAccount(db.prepare('SELECT * FROM company_gl_accounts WHERE id = ?').get(info.lastInsertRowid));
    },

    updateGlAccount: async function (id, payload) {
      const current = db.prepare('SELECT * FROM company_gl_accounts WHERE id = ?').get(id);
      if (!current) return null;
      const input = normalizeAccount(Object.assign({}, formatAccount(current), payload, {
        isSystem: current.is_system,
        systemKey: current.system_key || (payload && payload.systemKey)
      }));
      if (bool(current.is_system)) {
        input.number = current.number;
        input.type = accountType(current.type);
        input.systemKey = current.system_key;
        input.isSystem = true;
      }
      const taken = db.prepare('SELECT id FROM company_gl_accounts WHERE number = ? AND id != ?').get(input.number, id);
      if (taken) throw new Error('Account number already exists.');
      db.prepare(`
        UPDATE company_gl_accounts
        SET number = ?, name = ?, type = ?, system_key = ?, active = ?, updated_at = ?
        WHERE id = ?
      `).run(
        input.number,
        input.name,
        input.type,
        input.systemKey || current.system_key || '',
        input.active ? 1 : 0,
        dbUtil.nowIso(),
        id
      );
      return formatAccount(db.prepare('SELECT * FROM company_gl_accounts WHERE id = ?').get(id));
    },

    deleteGlAccount: async function (id) {
      const current = db.prepare('SELECT * FROM company_gl_accounts WHERE id = ?').get(id);
      if (!current) return false;
      if (bool(current.is_system)) throw new Error('System accounts cannot be deleted. Mark inactive instead.');
      const used = db.prepare('SELECT id FROM company_journal_lines WHERE account_id = ? LIMIT 1').get(id);
      if (used) throw new Error('Account has journal activity. Mark it inactive instead.');
      db.prepare('DELETE FROM company_gl_accounts WHERE id = ?').run(id);
      return true;
    },

    listBills: async function () {
      const rows = db.prepare(`
        SELECT b.*, v.company_name AS vendor_name, v.display_name AS vendor_display, po.number AS po_number
        FROM company_bills b
        LEFT JOIN inventory_vendors v ON v.id = b.vendor_id
        LEFT JOIN purchase_orders po ON po.id = b.po_id
        ORDER BY b.id DESC
      `).all();
      return rows.map(function (row) {
        if (!row.vendor_name && row.vendor_display) row.vendor_name = row.vendor_display;
        return formatBill(row, [], billAmountPaid(row.id));
      });
    },

    getBill: async function (id) {
      return loadBill(id);
    },

    createBill: async function (payload) {
      const input = normalizeBill(payload);
      const vendor = db.prepare('SELECT id, company_name, display_name FROM inventory_vendors WHERE id = ?').get(input.vendorId);
      if (!vendor) throw new Error('Vendor not found.');
      const existing = db.prepare('SELECT number FROM company_bills').all().map(function (r) { return r.number; });
      if (!input.number) input.number = nextNumber(existing, 'BILL');
      if (db.prepare('SELECT id FROM company_bills WHERE number = ?').get(input.number)) {
        throw new Error('Bill number already exists.');
      }
      if (!input.lines.length) throw new Error('Add at least one bill line.');
      const expense = requireSystemAccount('expense', 'Operating Expense');
      const stamp = dbUtil.nowIso();
      const info = db.prepare(`
        INSERT INTO company_bills
          (number, vendor_id, bill_date, due_date, status, terms, memo, po_id, subtotal, tax, total, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.number,
        input.vendorId,
        input.billDate,
        input.dueDate,
        input.status === 'draft' ? 'draft' : 'open',
        input.terms,
        input.memo,
        input.poId,
        input.subtotal,
        input.tax,
        input.total,
        stamp,
        stamp
      );
      const billId = info.lastInsertRowid;
      const ins = db.prepare(`
        INSERT INTO company_bill_lines
          (bill_id, sku, item, description, qty, unit_cost, amount, account_id, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      input.lines.forEach(function (line) {
        ins.run(
          billId,
          line.sku,
          line.item,
          line.description,
          line.qty,
          line.unitCost,
          line.amount,
          line.accountId || expense.id,
          line.sortOrder
        );
      });
      const bill = loadBill(billId);
      if (bill && bill.status !== 'draft') {
        await api.postBillToGl(billId);
      }
      return loadBill(billId);
    },

    updateBill: async function (id, payload) {
      const current = loadBill(id);
      if (!current) return null;
      if (current.journalId && current.status !== 'draft') {
        throw new Error('Posted bills cannot be edited. Void and recreate if needed.');
      }
      const input = normalizeBill(Object.assign({}, current, payload, { lines: payload.lines || current.lines }));
      if (!input.lines.length) throw new Error('Add at least one bill line.');
      const taken = db.prepare('SELECT id FROM company_bills WHERE number = ? AND id != ?').get(input.number || current.number, id);
      if (taken) throw new Error('Bill number already exists.');
      const expense = requireSystemAccount('expense', 'Operating Expense');
      db.prepare(`
        UPDATE company_bills
        SET number = ?, vendor_id = ?, bill_date = ?, due_date = ?, status = ?, terms = ?, memo = ?,
            po_id = ?, subtotal = ?, tax = ?, total = ?, updated_at = ?
        WHERE id = ?
      `).run(
        input.number || current.number,
        input.vendorId,
        input.billDate,
        input.dueDate,
        input.status,
        input.terms,
        input.memo,
        input.poId,
        input.subtotal,
        input.tax,
        input.total,
        dbUtil.nowIso(),
        id
      );
      db.prepare('DELETE FROM company_bill_lines WHERE bill_id = ?').run(id);
      const ins = db.prepare(`
        INSERT INTO company_bill_lines
          (bill_id, sku, item, description, qty, unit_cost, amount, account_id, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      input.lines.forEach(function (line) {
        ins.run(
          id,
          line.sku,
          line.item,
          line.description,
          line.qty,
          line.unitCost,
          line.amount,
          line.accountId || expense.id,
          line.sortOrder
        );
      });
      const bill = loadBill(id);
      if (bill && bill.status !== 'draft' && !bill.journalId) {
        await api.postBillToGl(id);
      }
      return loadBill(id);
    },

    voidBill: async function (id) {
      const bill = loadBill(id);
      if (!bill) return null;
      if (bill.amountPaid > 0.009) throw new Error('Cannot void a bill with payments applied.');
      db.prepare(`UPDATE company_bills SET status = 'void', updated_at = ? WHERE id = ?`).run(dbUtil.nowIso(), id);
      if (bill.journalId) {
        db.prepare(`UPDATE company_journal_entries SET status = 'void', updated_at = ? WHERE id = ?`)
          .run(dbUtil.nowIso(), bill.journalId);
      }
      return loadBill(id);
    },

    createBillPayment: async function (payload) {
      const src = payload || {};
      const vendorId = idOrNull(src.vendorId != null ? src.vendorId : src.vendor_id);
      if (!vendorId) throw new Error('Select a vendor.');
      const amount = money(src.amount);
      if (!(amount > 0)) throw new Error('Enter a payment amount greater than zero.');
      const apps = (Array.isArray(src.applications || src.apps) ? (src.applications || src.apps) : [])
        .map(function (row) {
          const billId = idOrNull(row && (row.billId != null ? row.billId : row.bill_id));
          const amt = money(row && row.amount);
          if (!billId || !(amt > 0)) return null;
          return { billId: billId, amount: amt };
        })
        .filter(Boolean);
      const applied = money(apps.reduce(function (s, a) { return s + a.amount; }, 0));
      if (applied - amount > 0.009) throw new Error('Applied amount cannot exceed the payment total.');
      const bank = idOrNull(src.bankAccountId != null ? src.bankAccountId : src.bank_account_id) ||
        requireSystemAccount('checking', 'Checking').id;
      const stamp = dbUtil.nowIso();
      const info = db.prepare(`
        INSERT INTO company_bill_payments
          (vendor_id, payment_date, amount, method, reference, memo, bank_account_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'posted', ?, ?)
      `).run(
        vendorId,
        trim(src.paymentDate || src.payment_date, 20) || todayIso(),
        amount,
        trim(src.method, 40) || 'ACH',
        trim(src.reference, 80),
        trim(src.memo, 500),
        bank,
        stamp,
        stamp
      );
      const paymentId = info.lastInsertRowid;
      const ins = db.prepare(`
        INSERT INTO company_bill_payment_apps (payment_id, bill_id, amount, created_at)
        VALUES (?, ?, ?, ?)
      `);
      apps.forEach(function (app) {
        ins.run(paymentId, app.billId, app.amount, stamp);
        const bill = loadBill(app.billId);
        if (bill && bill.balanceDue <= 0.009) {
          db.prepare(`UPDATE company_bills SET status = 'paid', updated_at = ? WHERE id = ?`).run(stamp, app.billId);
        }
      });
      await api.postBillPaymentToGl(paymentId);
      return api.getBillPayment(paymentId);
    },

    getBillPayment: async function (id) {
      const row = db.prepare('SELECT * FROM company_bill_payments WHERE id = ?').get(id);
      if (!row) return null;
      const apps = db.prepare(`
        SELECT a.*, b.number AS bill_number
        FROM company_bill_payment_apps a
        LEFT JOIN company_bills b ON b.id = a.bill_id
        WHERE a.payment_id = ?
      `).all(id);
      return {
        id: row.id,
        vendorId: row.vendor_id,
        paymentDate: row.payment_date,
        amount: money(row.amount),
        method: row.method || '',
        reference: row.reference || '',
        memo: row.memo || '',
        bankAccountId: row.bank_account_id,
        status: row.status || 'posted',
        journalId: row.journal_id,
        applications: apps.map(function (a) {
          return {
            id: a.id,
            billId: a.bill_id,
            billNumber: a.bill_number || '',
            amount: money(a.amount)
          };
        }),
        createdAt: row.created_at || '',
        updatedAt: row.updated_at || ''
      };
    },

    listBillPayments: async function () {
      const rows = db.prepare(`
        SELECT p.*, v.company_name AS vendor_name, v.display_name AS vendor_display
        FROM company_bill_payments p
        LEFT JOIN inventory_vendors v ON v.id = p.vendor_id
        ORDER BY p.id DESC
      `).all();
      return rows.map(function (row) {
        return {
          id: row.id,
          vendorId: row.vendor_id,
          vendorName: row.vendor_name || row.vendor_display || '',
          paymentDate: row.payment_date,
          amount: money(row.amount),
          method: row.method || '',
          reference: row.reference || '',
          status: row.status || 'posted',
          journalId: row.journal_id
        };
      });
    },

    listJournalEntries: async function () {
      const rows = db.prepare(`
        SELECT e.*,
          COALESCE((SELECT SUM(l.debit) FROM company_journal_lines l WHERE l.entry_id = e.id), 0) AS total_debit,
          COALESCE((SELECT SUM(l.credit) FROM company_journal_lines l WHERE l.entry_id = e.id), 0) AS total_credit
        FROM company_journal_entries e
        ORDER BY e.entry_date DESC, e.id DESC
      `).all();
      return rows.map(function (row) {
        const entry = formatJournal(row, []);
        entry.totalDebit = money(row.total_debit);
        entry.totalCredit = money(row.total_credit);
        return entry;
      });
    },

    getJournalEntry: async function (id) {
      return loadJournal(id);
    },

    createJournalEntry: async function (payload) {
      return createPostedJournal(payload);
    },

    voidJournalEntry: async function (id) {
      const entry = loadJournal(id);
      if (!entry) return null;
      if (entry.sourceType) throw new Error('Void the source document instead of this system journal entry.');
      db.prepare(`UPDATE company_journal_entries SET status = 'void', updated_at = ? WHERE id = ?`)
        .run(dbUtil.nowIso(), id);
      return loadJournal(id);
    },

    listUndepositedPayments: async function () {
      const rows = db.prepare(`
        SELECT p.*, c.company_name AS customer_name
        FROM company_customer_payments p
        LEFT JOIN company_customers c ON c.id = p.customer_id
        WHERE p.status = 'posted'
          AND COALESCE(p.deposited, 0) = 0
        ORDER BY p.payment_date DESC, p.id DESC
      `).all();
      return rows.map(function (row) {
        return {
          id: row.id,
          customerId: row.customer_id,
          customerName: row.customer_name || '',
          paymentDate: row.payment_date || '',
          amount: money(row.amount),
          method: row.method || '',
          reference: row.reference || '',
          cardFeeAmount: money(row.card_fee_amount)
        };
      });
    },

    listBankDeposits: async function () {
      const rows = db.prepare(`
        SELECT d.*, a.name AS bank_account_name, a.number AS bank_account_number
        FROM company_bank_deposits d
        LEFT JOIN company_gl_accounts a ON a.id = d.bank_account_id
        ORDER BY d.id DESC
      `).all();
      return rows.map(function (row) {
        const name = (row.bank_account_number ? row.bank_account_number + ' · ' : '') + (row.bank_account_name || '');
        row.bank_account_name = name;
        return formatDeposit(row, []);
      });
    },

    getBankDeposit: async function (id) {
      return loadDeposit(id);
    },

    createBankDeposit: async function (payload) {
      const input = normalizeDeposit(payload);
      const payments = input.paymentIds.map(function (pid) {
        const row = db.prepare('SELECT * FROM company_customer_payments WHERE id = ?').get(pid);
        if (!row || row.status !== 'posted') throw new Error('Payment #' + pid + ' is not available to deposit.');
        if (bool(row.deposited)) throw new Error('Payment #' + pid + ' is already deposited.');
        return row;
      });
      const total = money(payments.reduce(function (s, p) { return s + money(p.amount); }, 0));
      const existing = db.prepare('SELECT number FROM company_bank_deposits').all().map(function (r) { return r.number; });
      if (!input.number) input.number = nextNumber(existing, 'DEP');
      const stamp = dbUtil.nowIso();
      const info = db.prepare(`
        INSERT INTO company_bank_deposits
          (number, deposit_date, bank_account_id, memo, total, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'posted', ?, ?)
      `).run(input.number, input.depositDate, input.bankAccountId, input.memo, total, stamp, stamp);
      const depositId = info.lastInsertRowid;
      const link = db.prepare('INSERT INTO company_bank_deposit_payments (deposit_id, payment_id) VALUES (?, ?)');
      const mark = db.prepare('UPDATE company_customer_payments SET deposited = 1, updated_at = ? WHERE id = ?');
      payments.forEach(function (p) {
        link.run(depositId, p.id);
        mark.run(stamp, p.id);
      });
      await api.postDepositToGl(depositId);
      return loadDeposit(depositId);
    },

    postBillToGl: async function (billId) {
      const bill = loadBill(billId);
      if (!bill || bill.status === 'draft' || bill.status === 'void') return null;
      if (bill.journalId) return loadJournal(bill.journalId);
      const ap = requireSystemAccount('ap', 'Accounts Payable');
      const expense = requireSystemAccount('expense', 'Operating Expense');
      const byAccount = {};
      (bill.lines || []).forEach(function (line) {
        const acctId = line.accountId || expense.id;
        byAccount[acctId] = money((byAccount[acctId] || 0) + line.amount);
      });
      if (bill.tax > 0) {
        byAccount[expense.id] = money((byAccount[expense.id] || 0) + bill.tax);
      }
      const lines = Object.keys(byAccount).map(function (acctId) {
        return { accountId: Number(acctId), debit: byAccount[acctId], credit: 0, description: bill.number };
      });
      lines.push({
        accountId: ap.id,
        debit: 0,
        credit: bill.total,
        description: bill.number + ' · ' + (bill.vendorName || '')
      });
      const je = await createPostedJournal({
        entryDate: bill.billDate || todayIso(),
        memo: 'Bill ' + bill.number,
        sourceType: 'bill',
        sourceId: bill.id,
        lines: lines
      });
      db.prepare('UPDATE company_bills SET journal_id = ?, updated_at = ? WHERE id = ?')
        .run(je.id, dbUtil.nowIso(), bill.id);
      return je;
    },

    postBillPaymentToGl: async function (paymentId) {
      const payment = await api.getBillPayment(paymentId);
      if (!payment || payment.status !== 'posted') return null;
      if (payment.journalId) return loadJournal(payment.journalId);
      const ap = requireSystemAccount('ap', 'Accounts Payable');
      const bankId = payment.bankAccountId || requireSystemAccount('checking', 'Checking').id;
      const je = await createPostedJournal({
        entryDate: payment.paymentDate || todayIso(),
        memo: 'Bill payment' + (payment.reference ? ' · ' + payment.reference : ''),
        sourceType: 'bill_payment',
        sourceId: payment.id,
        lines: [
          { accountId: ap.id, debit: payment.amount, credit: 0, description: 'Pay bills' },
          { accountId: bankId, debit: 0, credit: payment.amount, description: 'Pay bills' }
        ]
      });
      db.prepare('UPDATE company_bill_payments SET journal_id = ?, updated_at = ? WHERE id = ?')
        .run(je.id, dbUtil.nowIso(), payment.id);
      return je;
    },

    postDepositToGl: async function (depositId) {
      const deposit = loadDeposit(depositId);
      if (!deposit || deposit.status !== 'posted') return null;
      if (deposit.journalId) return loadJournal(deposit.journalId);
      const undeposited = requireSystemAccount('undeposited', 'Undeposited Funds');
      const je = await createPostedJournal({
        entryDate: deposit.depositDate || todayIso(),
        memo: 'Deposit ' + deposit.number,
        sourceType: 'deposit',
        sourceId: deposit.id,
        lines: [
          { accountId: deposit.bankAccountId, debit: deposit.total, credit: 0, description: deposit.number },
          { accountId: undeposited.id, debit: 0, credit: deposit.total, description: deposit.number }
        ]
      });
      db.prepare('UPDATE company_bank_deposits SET journal_id = ?, updated_at = ? WHERE id = ?')
        .run(je.id, dbUtil.nowIso(), deposit.id);
      return je;
    },

    postInvoiceToGl: async function (invoiceId) {
      const doc = await store.getSalesDoc(invoiceId);
      if (!doc || doc.type !== 'invoice') return null;
      if (doc.status === 'draft' || doc.status === 'void') return null;
      if (doc.journalId) return loadJournal(doc.journalId);
      // Prefer reading journal_id from DB in case enrich stripped it
      const raw = db.prepare('SELECT journal_id, total, number, issue_date, status FROM company_sales_docs WHERE id = ?').get(invoiceId);
      if (!raw || raw.journal_id) return raw && raw.journal_id ? loadJournal(raw.journal_id) : null;
      if (raw.status === 'draft' || raw.status === 'void') return null;
      const ar = requireSystemAccount('ar', 'Accounts Receivable');
      const sales = requireSystemAccount('sales', 'Sales Income');
      const total = money(raw.total);
      if (!(total > 0)) return null;
      const je = await createPostedJournal({
        entryDate: raw.issue_date || todayIso(),
        memo: 'Invoice ' + (raw.number || invoiceId),
        sourceType: 'invoice',
        sourceId: invoiceId,
        lines: [
          { accountId: ar.id, debit: total, credit: 0, description: raw.number || '' },
          { accountId: sales.id, debit: 0, credit: total, description: raw.number || '' }
        ]
      });
      db.prepare('UPDATE company_sales_docs SET journal_id = ?, updated_at = ? WHERE id = ?')
        .run(je.id, dbUtil.nowIso(), invoiceId);
      return je;
    },

    postCustomerPaymentToGl: async function (paymentId) {
      const row = db.prepare('SELECT * FROM company_customer_payments WHERE id = ?').get(paymentId);
      if (!row || row.status !== 'posted') return null;
      if (row.journal_id) return loadJournal(row.journal_id);
      const ar = requireSystemAccount('ar', 'Accounts Receivable');
      const undeposited = requireSystemAccount('undeposited', 'Undeposited Funds');
      const amount = money(row.amount);
      if (!(amount > 0)) return null;
      // Principal only — card fee stays on company_card_fee_entries (not invoice / not AR).
      const je = await createPostedJournal({
        entryDate: row.payment_date || todayIso(),
        memo: 'Customer payment',
        sourceType: 'customer_payment',
        sourceId: paymentId,
        lines: [
          { accountId: undeposited.id, debit: amount, credit: 0, description: row.reference || '' },
          { accountId: ar.id, debit: 0, credit: amount, description: row.reference || '' }
        ]
      });
      db.prepare('UPDATE company_customer_payments SET journal_id = ?, updated_at = ? WHERE id = ?')
        .run(je.id, dbUtil.nowIso(), paymentId);
      return je;
    },

    getAccountingReports: async function (query) {
      const q = query || {};
      const asOf = trim(q.asOf || q.as_of, 20) || todayIso();
      const from = trim(q.from, 20) || asOf.slice(0, 8) + '01';
      const to = trim(q.to, 20) || asOf;
      const balances = accountBalances(asOf);

      const pnlAccounts = balances.filter(function (a) {
        return a.type === 'income' || a.type === 'other_income' || a.type === 'cogs' || a.type === 'expense' || a.type === 'other_expense';
      });
      // Period activity for P&L
      const periodRows = db.prepare(`
        SELECT a.id, a.number, a.name, a.type,
               COALESCE(SUM(l.debit), 0) AS debit,
               COALESCE(SUM(l.credit), 0) AS credit
        FROM company_gl_accounts a
        LEFT JOIN company_journal_lines l ON l.account_id = a.id
        LEFT JOIN company_journal_entries e
          ON e.id = l.entry_id AND e.status = 'posted' AND e.entry_date >= ? AND e.entry_date <= ?
        WHERE a.type IN ('income','other_income','cogs','expense','other_expense') AND a.active = 1
        GROUP BY a.id
        ORDER BY a.number COLLATE NOCASE
      `).all(from, to).map(function (row) {
        const type = accountType(row.type);
        const debit = money(row.debit);
        const credit = money(row.credit);
        const amount = isDebitNormal(type) ? money(debit - credit) : money(credit - debit);
        return {
          id: row.id,
          number: row.number,
          name: row.name,
          type: type,
          typeLabel: accountTypeLabel(type),
          amount: amount
        };
      });

      let income = 0;
      let cogs = 0;
      let expense = 0;
      periodRows.forEach(function (row) {
        if (row.type === 'income' || row.type === 'other_income') income = money(income + row.amount);
        else if (row.type === 'cogs') cogs = money(cogs + row.amount);
        else expense = money(expense + row.amount);
      });

      const assets = [];
      const liabilities = [];
      const equity = [];
      let assetTotal = 0;
      let liabilityTotal = 0;
      let equityTotal = 0;
      balances.forEach(function (a) {
        if (a.type === 'bank' || a.type === 'accounts_receivable' || a.type === 'other_current_asset' || a.type === 'fixed_asset' || a.type === 'inventory') {
          assets.push(a);
          assetTotal = money(assetTotal + a.balance);
        } else if (a.type === 'accounts_payable' || a.type === 'other_current_liability' || a.type === 'long_term_liability') {
          liabilities.push(a);
          liabilityTotal = money(liabilityTotal + a.balance);
        } else if (a.type === 'equity') {
          equity.push(a);
          equityTotal = money(equityTotal + a.balance);
        }
      });
      const netIncomeAll = money(
        balances.filter(function (a) {
          return a.type === 'income' || a.type === 'other_income';
        }).reduce(function (s, a) { return s + a.balance; }, 0) -
        balances.filter(function (a) {
          return a.type === 'cogs' || a.type === 'expense' || a.type === 'other_expense';
        }).reduce(function (s, a) { return s + a.balance; }, 0)
      );
      equityTotal = money(equityTotal + netIncomeAll);

      const ar = emptyAging();
      const invoices = await store.listSalesDocs('invoice');
      invoices.forEach(function (inv) {
        if (!inv || inv.status === 'void' || inv.status === 'draft') return;
        const bal = money(inv.balanceDue != null ? inv.balanceDue : inv.total);
        if (!(bal > 0.009)) return;
        const due = inv.dueDate || inv.issueDate || todayIso();
        const bucket = agingBucket(daysBetween(due, asOf));
        ar[bucket] = money(ar[bucket] + bal);
        ar.total = money(ar.total + bal);
        ar.rows.push({
          id: inv.id,
          number: inv.number,
          customerName: inv.customerName || inv.billToName || '',
          dueDate: due,
          balance: bal,
          bucket: bucket
        });
      });

      const ap = emptyAging();
      const bills = await api.listBills();
      bills.forEach(function (bill) {
        if (!bill || bill.status === 'void' || bill.status === 'draft') return;
        const bal = money(bill.balanceDue);
        if (!(bal > 0.009)) return;
        const due = bill.dueDate || bill.billDate || todayIso();
        const bucket = agingBucket(daysBetween(due, asOf));
        ap[bucket] = money(ap[bucket] + bal);
        ap.total = money(ap.total + bal);
        ap.rows.push({
          id: bill.id,
          number: bill.number,
          vendorName: bill.vendorName || '',
          dueDate: due,
          balance: bal,
          bucket: bucket
        });
      });

      return {
        asOf: asOf,
        from: from,
        to: to,
        profitAndLoss: {
          from: from,
          to: to,
          income: income,
          cogs: cogs,
          expense: expense,
          grossProfit: money(income - cogs),
          netIncome: money(income - cogs - expense),
          lines: periodRows.filter(function (r) { return Math.abs(r.amount) > 0.009; })
        },
        balanceSheet: {
          asOf: asOf,
          assets: assets.filter(function (a) { return Math.abs(a.balance) > 0.009; }),
          liabilities: liabilities.filter(function (a) { return Math.abs(a.balance) > 0.009; }),
          equity: equity.filter(function (a) { return Math.abs(a.balance) > 0.009; }),
          netIncome: netIncomeAll,
          assetTotal: assetTotal,
          liabilityTotal: liabilityTotal,
          equityTotal: equityTotal
        },
        arAging: ar,
        apAging: ap,
        accountBalances: balances
      };
    },

    getAccountingOverview: async function () {
      const reports = await api.getAccountingReports({});
      const undeposited = await api.listUndepositedPayments();
      const openBills = (await api.listBills()).filter(function (b) {
        return b.status === 'open' || (b.balanceDue > 0.009 && b.status !== 'void' && b.status !== 'draft');
      });
      return {
        arTotal: reports.arAging.total,
        apTotal: reports.apAging.total,
        undepositedTotal: money(undeposited.reduce(function (s, p) { return s + p.amount; }, 0)),
        undepositedCount: undeposited.length,
        openBillCount: openBills.length,
        netIncome: reports.profitAndLoss.netIncome,
        checkingBalance: (reports.accountBalances.find(function (a) { return a.systemKey === 'checking'; }) || {}).balance || 0
      };
    }
  };

  // Wrap sales/payment create to auto-post when available
  if (store && typeof store.createSalesDoc === 'function') {
    const _createSalesDoc = store.createSalesDoc.bind(store);
    const _updateSalesDoc = store.updateSalesDoc && store.updateSalesDoc.bind(store);
    store.createSalesDoc = async function (payload) {
      const doc = await _createSalesDoc(payload);
      if (doc && doc.type === 'invoice' && doc.status !== 'draft' && doc.status !== 'void') {
        try { await api.postInvoiceToGl(doc.id); } catch (e) { console.warn('GL invoice post:', e.message || e); }
      }
      return store.getSalesDoc ? store.getSalesDoc(doc.id) : doc;
    };
    if (_updateSalesDoc) {
      store.updateSalesDoc = async function (id, payload) {
        const before = await store.getSalesDoc(id);
        const doc = await _updateSalesDoc(id, payload);
        if (doc && doc.type === 'invoice') {
          const wasDraft = before && before.status === 'draft';
          const nowLive = doc.status !== 'draft' && doc.status !== 'void';
          if (wasDraft && nowLive) {
            try { await api.postInvoiceToGl(doc.id); } catch (e) { console.warn('GL invoice post:', e.message || e); }
          }
        }
        return store.getSalesDoc ? store.getSalesDoc(id) : doc;
      };
    }
  }
  if (store && typeof store.createCustomerPayment === 'function') {
    const _createPay = store.createCustomerPayment.bind(store);
    store.createCustomerPayment = async function (payload) {
      const payment = await _createPay(payload);
      if (payment && payment.id) {
        for (const app of (payment.applications || [])) {
          if (!(app && app.invoiceId)) continue;
          try {
            db.prepare(`UPDATE company_sales_docs SET status = 'open', updated_at = ? WHERE id = ? AND status = 'draft'`)
              .run(dbUtil.nowIso(), app.invoiceId);
            await api.postInvoiceToGl(app.invoiceId);
          } catch (e) {
            console.warn('GL invoice post before payment:', e.message || e);
          }
        }
        try { await api.postCustomerPaymentToGl(payment.id); } catch (e) { console.warn('GL payment post:', e.message || e); }
      }
      return payment;
    };
  }

  return api;
}

function supabaseApi(supabase, store) {
  // Production uses Supabase; mirror core operations via SQL-friendly queries.
  // For V1 Cloud/local SQLite is primary; Supabase methods call RPC-less table ops.

  function throwIf(error, fallback) {
    if (!error) return;
    const err = new Error((error.message || fallback || 'Database error') + '');
    err.cause = error;
    throw err;
  }

  async function seedAccountsIfEmpty() {
    const { data, error } = await supabase.from('company_gl_accounts').select('id').limit(1);
    throwIf(error, 'Could not read GL accounts.');
    if (data && data.length) return;
    const stamp = new Date().toISOString();
    const rows = DEFAULT_ACCOUNTS.map(function (a) {
      return {
        number: a.number,
        name: a.name,
        type: a.type,
        system_key: a.systemKey,
        active: true,
        is_system: true,
        created_at: stamp,
        updated_at: stamp
      };
    });
    const ins = await supabase.from('company_gl_accounts').upsert(rows, { onConflict: 'number' });
    throwIf(ins.error, 'Could not seed GL accounts.');
  }

  // Reuse sqlite-shaped API by requiring a thin adapter is heavy; implement key methods.
  const api = {
    listGlAccounts: async function () {
      await seedAccountsIfEmpty();
      const { data, error } = await supabase.from('company_gl_accounts').select('*').order('number');
      throwIf(error, 'Could not list accounts.');
      return (data || []).map(formatAccount);
    },
    getGlAccount: async function (id) {
      const { data, error } = await supabase.from('company_gl_accounts').select('*').eq('id', id).maybeSingle();
      throwIf(error, 'Could not load account.');
      return formatAccount(data);
    },
    createGlAccount: async function (payload) {
      const input = normalizeAccount(payload);
      const stamp = new Date().toISOString();
      const { data, error } = await supabase.from('company_gl_accounts').insert({
        number: input.number,
        name: input.name,
        type: input.type,
        system_key: input.systemKey,
        active: input.active,
        is_system: false,
        created_at: stamp,
        updated_at: stamp
      }).select('*').single();
      throwIf(error, 'Could not create account.');
      return formatAccount(data);
    },
    updateGlAccount: async function (id, payload) {
      const current = await api.getGlAccount(id);
      if (!current) return null;
      const input = normalizeAccount(Object.assign({}, current, payload));
      if (current.isSystem) {
        input.number = current.number;
        input.type = current.type;
        input.systemKey = current.systemKey;
      }
      const { data, error } = await supabase.from('company_gl_accounts').update({
        number: input.number,
        name: input.name,
        type: input.type,
        system_key: input.systemKey || current.systemKey,
        active: input.active,
        updated_at: new Date().toISOString()
      }).eq('id', id).select('*').single();
      throwIf(error, 'Could not update account.');
      return formatAccount(data);
    },
    deleteGlAccount: async function (id) {
      const current = await api.getGlAccount(id);
      if (!current) return false;
      if (current.isSystem) throw new Error('System accounts cannot be deleted. Mark inactive instead.');
      const { error } = await supabase.from('company_gl_accounts').delete().eq('id', id);
      throwIf(error, 'Could not delete account.');
      return true;
    },
    listBills: async function () {
      const { data, error } = await supabase
        .from('company_bills')
        .select('*, inventory_vendors(company_name, display_name), purchase_orders(number)')
        .order('id', { ascending: false });
      throwIf(error, 'Could not list bills.');
      return (data || []).map(function (row) {
        row.vendor_name = (row.inventory_vendors && (row.inventory_vendors.company_name || row.inventory_vendors.display_name)) || '';
        row.po_number = row.purchase_orders && row.purchase_orders.number;
        return formatBill(row, [], money(row.amount_paid));
      });
    },
    getBill: async function (id) {
      const { data, error } = await supabase
        .from('company_bills')
        .select('*, company_bill_lines(*), inventory_vendors(company_name, display_name), purchase_orders(number)')
        .eq('id', id)
        .maybeSingle();
      throwIf(error, 'Could not load bill.');
      if (!data) return null;
      data.vendor_name = (data.inventory_vendors && (data.inventory_vendors.company_name || data.inventory_vendors.display_name)) || '';
      data.po_number = data.purchase_orders && data.purchase_orders.number;
      const { data: apps } = await supabase
        .from('company_bill_payment_apps')
        .select('amount, company_bill_payments!inner(status)')
        .eq('bill_id', id);
      const paid = money((apps || []).filter(function (a) {
        return a.company_bill_payments && a.company_bill_payments.status === 'posted';
      }).reduce(function (s, a) { return s + money(a.amount); }, 0));
      return formatBill(data, data.company_bill_lines || [], paid);
    },
    createBill: async function (payload) {
      // Prefer sqlite path in Cloud; Supabase create delegates minimal insert
      const input = normalizeBill(payload);
      const stamp = new Date().toISOString();
      if (!input.number) {
        const { data: existing } = await supabase.from('company_bills').select('number');
        input.number = nextNumber((existing || []).map(function (r) { return r.number; }), 'BILL');
      }
      const { data: accounts } = await supabase.from('company_gl_accounts').select('*').eq('system_key', 'expense').limit(1);
      const expenseId = accounts && accounts[0] && accounts[0].id;
      const { data: bill, error } = await supabase.from('company_bills').insert({
        number: input.number,
        vendor_id: input.vendorId,
        bill_date: input.billDate,
        due_date: input.dueDate,
        status: input.status === 'draft' ? 'draft' : 'open',
        terms: input.terms,
        memo: input.memo,
        po_id: input.poId,
        subtotal: input.subtotal,
        tax: input.tax,
        total: input.total,
        created_at: stamp,
        updated_at: stamp
      }).select('*').single();
      throwIf(error, 'Could not create bill.');
      if (input.lines.length) {
        const lines = input.lines.map(function (line) {
          return {
            bill_id: bill.id,
            sku: line.sku,
            item: line.item,
            description: line.description,
            qty: line.qty,
            unit_cost: line.unitCost,
            amount: line.amount,
            account_id: line.accountId || expenseId,
            sort_order: line.sortOrder
          };
        });
        const li = await supabase.from('company_bill_lines').insert(lines);
        throwIf(li.error, 'Could not save bill lines.');
      }
      return api.getBill(bill.id);
    },
    updateBill: async function () {
      throw new Error('Edit bill on Supabase is limited in V1 — use void and recreate, or run local SQLite.');
    },
    voidBill: async function (id) {
      const { error } = await supabase.from('company_bills').update({
        status: 'void',
        updated_at: new Date().toISOString()
      }).eq('id', id);
      throwIf(error, 'Could not void bill.');
      return api.getBill(id);
    },
    createBillPayment: async function () {
      throw new Error('Bill payments on Supabase need migration applied; use after SQL migration.');
    },
    getBillPayment: async function () { return null; },
    listBillPayments: async function () {
      const { data, error } = await supabase.from('company_bill_payments').select('*, inventory_vendors(company_name, display_name)').order('id', { ascending: false });
      throwIf(error, 'Could not list bill payments.');
      return (data || []).map(function (row) {
        return {
          id: row.id,
          vendorId: row.vendor_id,
          vendorName: (row.inventory_vendors && (row.inventory_vendors.company_name || row.inventory_vendors.display_name)) || '',
          paymentDate: row.payment_date,
          amount: money(row.amount),
          method: row.method || '',
          reference: row.reference || '',
          status: row.status || 'posted',
          journalId: row.journal_id
        };
      });
    },
    listJournalEntries: async function () {
      const { data, error } = await supabase.from('company_journal_entries').select('*').order('entry_date', { ascending: false });
      throwIf(error, 'Could not list journals.');
      return (data || []).map(function (row) { return formatJournal(row, []); });
    },
    getJournalEntry: async function (id) {
      const { data, error } = await supabase
        .from('company_journal_entries')
        .select('*, company_journal_lines(*, company_gl_accounts(number, name))')
        .eq('id', id)
        .maybeSingle();
      throwIf(error, 'Could not load journal.');
      if (!data) return null;
      const lines = (data.company_journal_lines || []).map(function (l) {
        l.account_number = l.company_gl_accounts && l.company_gl_accounts.number;
        l.account_name = l.company_gl_accounts && l.company_gl_accounts.name;
        return l;
      });
      return formatJournal(data, lines);
    },
    createJournalEntry: async function (payload) {
      const input = normalizeJournal(Object.assign({}, payload, { status: 'posted' }));
      const stamp = new Date().toISOString();
      if (!input.number) {
        const { data: existing } = await supabase.from('company_journal_entries').select('number');
        input.number = nextNumber((existing || []).map(function (r) { return r.number; }), 'JE');
      }
      const { data: entry, error } = await supabase.from('company_journal_entries').insert({
        number: input.number,
        entry_date: input.entryDate,
        memo: input.memo,
        source_type: input.sourceType,
        source_id: input.sourceId,
        status: 'posted',
        created_at: stamp,
        updated_at: stamp
      }).select('*').single();
      throwIf(error, 'Could not create journal entry.');
      const lines = input.lines.map(function (line) {
        return {
          entry_id: entry.id,
          account_id: line.accountId,
          description: line.description,
          debit: line.debit,
          credit: line.credit,
          sort_order: line.sortOrder
        };
      });
      const li = await supabase.from('company_journal_lines').insert(lines);
      throwIf(li.error, 'Could not save journal lines.');
      return api.getJournalEntry(entry.id);
    },
    voidJournalEntry: async function (id) {
      const { error } = await supabase.from('company_journal_entries').update({
        status: 'void',
        updated_at: new Date().toISOString()
      }).eq('id', id);
      throwIf(error, 'Could not void journal.');
      return api.getJournalEntry(id);
    },
    listUndepositedPayments: async function () {
      const { data, error } = await supabase
        .from('company_customer_payments')
        .select('*, company_customers(company_name)')
        .eq('status', 'posted')
        .eq('deposited', false)
        .order('payment_date', { ascending: false });
      if (error && /deposited/.test(error.message || '')) {
        // Column not migrated yet
        return [];
      }
      throwIf(error, 'Could not list undeposited payments.');
      return (data || []).map(function (row) {
        return {
          id: row.id,
          customerId: row.customer_id,
          customerName: (row.company_customers && row.company_customers.company_name) || '',
          paymentDate: row.payment_date || '',
          amount: money(row.amount),
          method: row.method || '',
          reference: row.reference || '',
          cardFeeAmount: money(row.card_fee_amount)
        };
      });
    },
    listBankDeposits: async function () {
      const { data, error } = await supabase
        .from('company_bank_deposits')
        .select('*, company_gl_accounts(number, name)')
        .order('id', { ascending: false });
      throwIf(error, 'Could not list deposits.');
      return (data || []).map(function (row) {
        const acct = row.company_gl_accounts;
        row.bank_account_name = acct ? ((acct.number || '') + ' · ' + (acct.name || '')) : '';
        return formatDeposit(row, []);
      });
    },
    getBankDeposit: async function (id) {
      const { data, error } = await supabase
        .from('company_bank_deposits')
        .select('*, company_gl_accounts(number, name), company_bank_deposit_payments(payment_id)')
        .eq('id', id)
        .maybeSingle();
      throwIf(error, 'Could not load deposit.');
      if (!data) return null;
      const acct = data.company_gl_accounts;
      data.bank_account_name = acct ? ((acct.number || '') + ' · ' + (acct.name || '')) : '';
      const paymentIds = (data.company_bank_deposit_payments || []).map(function (r) { return r.payment_id; });
      return formatDeposit(data, paymentIds);
    },
    createBankDeposit: async function () {
      throw new Error('Bank deposits on Supabase need migration applied.');
    },
    postBillToGl: async function () { return null; },
    postBillPaymentToGl: async function () { return null; },
    postDepositToGl: async function () { return null; },
    postInvoiceToGl: async function () { return null; },
    postCustomerPaymentToGl: async function () { return null; },
    getAccountingReports: async function (query) {
      // Lightweight: AR/AP aging from operational tables; P&L/BS empty until journals exist
      const asOf = trim((query && (query.asOf || query.as_of)) || '', 20) || todayIso();
      const from = trim((query && query.from) || '', 20) || asOf.slice(0, 8) + '01';
      const to = trim((query && query.to) || '', 20) || asOf;
      const accounts = await api.listGlAccounts();
      const ar = emptyAging();
      if (store && store.listSalesDocs) {
        const invoices = await store.listSalesDocs('invoice');
        invoices.forEach(function (inv) {
          if (!inv || inv.status === 'void' || inv.status === 'draft') return;
          const bal = money(inv.balanceDue != null ? inv.balanceDue : inv.total);
          if (!(bal > 0.009)) return;
          const due = inv.dueDate || inv.issueDate || todayIso();
          const bucket = agingBucket(daysBetween(due, asOf));
          ar[bucket] = money(ar[bucket] + bal);
          ar.total = money(ar.total + bal);
          ar.rows.push({
            id: inv.id,
            number: inv.number,
            customerName: inv.customerName || '',
            dueDate: due,
            balance: bal,
            bucket: bucket
          });
        });
      }
      const ap = emptyAging();
      const bills = await api.listBills();
      bills.forEach(function (bill) {
        if (!bill || bill.status === 'void' || bill.status === 'draft') return;
        const bal = money(bill.balanceDue);
        if (!(bal > 0.009)) return;
        const due = bill.dueDate || bill.billDate || todayIso();
        const bucket = agingBucket(daysBetween(due, asOf));
        ap[bucket] = money(ap[bucket] + bal);
        ap.total = money(ap.total + bal);
        ap.rows.push({
          id: bill.id,
          number: bill.number,
          vendorName: bill.vendorName || '',
          dueDate: due,
          balance: bal,
          bucket: bucket
        });
      });
      return {
        asOf: asOf,
        from: from,
        to: to,
        profitAndLoss: { from: from, to: to, income: 0, cogs: 0, expense: 0, grossProfit: 0, netIncome: 0, lines: [] },
        balanceSheet: {
          asOf: asOf,
          assets: [],
          liabilities: [],
          equity: [],
          netIncome: 0,
          assetTotal: 0,
          liabilityTotal: 0,
          equityTotal: 0
        },
        arAging: ar,
        apAging: ap,
        accountBalances: accounts.map(function (a) {
          return Object.assign({}, a, { debit: 0, credit: 0, balance: 0 });
        })
      };
    },
    getAccountingOverview: async function () {
      const reports = await api.getAccountingReports({});
      const undeposited = await api.listUndepositedPayments();
      return {
        arTotal: reports.arAging.total,
        apTotal: reports.apAging.total,
        undepositedTotal: money(undeposited.reduce(function (s, p) { return s + p.amount; }, 0)),
        undepositedCount: undeposited.length,
        openBillCount: (await api.listBills()).filter(function (b) {
          return b.balanceDue > 0.009 && b.status !== 'void' && b.status !== 'draft';
        }).length,
        netIncome: reports.profitAndLoss.netIncome,
        checkingBalance: 0
      };
    }
  };

  return api;
}

module.exports = {
  ACCOUNT_TYPES,
  DEFAULT_ACCOUNTS,
  accountTypeLabel,
  ensureCompanyAccounting,
  formatAccount,
  formatBill,
  formatJournal,
  formatDeposit,
  sqliteApi,
  supabaseApi
};
