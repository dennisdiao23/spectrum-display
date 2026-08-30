function trim(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 240);
}

function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeVendor(input) {
  const src = input || {};
  const companyName = trim(src.companyName || src.company_name, 160);
  const first = trim(src.contactFirst || src.contact_first, 80);
  const last = trim(src.contactLast || src.contact_last, 80);
  const displayName = trim(src.displayName || src.display_name, 160) ||
    companyName || [first, last].filter(Boolean).join(' ');
  if (!companyName && !first && !last && !displayName) {
    throw new Error('Enter a company name, display name, or a contact name.');
  }
  return {
    title: trim(src.title, 20),
    companyName: companyName,
    displayName: displayName,
    contactFirst: first,
    contactMiddle: trim(src.contactMiddle || src.contact_middle, 80),
    contactLast: last,
    suffix: trim(src.suffix, 20),
    email: trim(src.email, 160).toLowerCase(),
    emailCc: trim(src.emailCc || src.email_cc, 160).toLowerCase(),
    emailBcc: trim(src.emailBcc || src.email_bcc, 160).toLowerCase(),
    phone: trim(src.phone, 40),
    mobile: trim(src.mobile, 40),
    fax: trim(src.fax, 40),
    otherPhone: trim(src.otherPhone || src.other_phone, 40),
    website: trim(src.website, 200),
    checkName: trim(src.checkName || src.check_name, 160),
    street: trim(src.street || src.billStreet || src.bill_street, 240),
    street2: trim(src.street2 || src.billStreet2 || src.bill_street2, 240),
    city: trim(src.city || src.billCity || src.bill_city, 80),
    state: trim(src.state || src.billState || src.bill_state, 80),
    zip: trim(src.zip || src.billZip || src.bill_zip, 20),
    country: trim(src.country || src.billCountry || src.bill_country, 80) || 'United States',
    notes: trim(src.notes, 4000),
    bankAccount: trim(src.bankAccount || src.bank_account, 40),
    routingNumber: trim(src.routingNumber || src.routing_number, 20),
    taxId: trim(src.taxId || src.tax_id, 80),
    track1099: bool(src.track1099 != null ? src.track1099 : src.track_1099),
    paymentTerms: trim(src.paymentTerms || src.payment_terms, 80) || 'Net 30',
    accountNo: trim(src.accountNo || src.account_no, 80),
    expenseCategory: trim(src.expenseCategory || src.expense_category, 80),
    openingBalance: num(src.openingBalance != null ? src.openingBalance : src.opening_balance),
    openingAsOf: trim(src.openingAsOf || src.opening_as_of, 20)
  };
}

function formatAddress(v) {
  const lines = [];
  if (v.displayName || v.companyName) lines.push(v.displayName || v.companyName);
  if (v.street) lines.push(v.street);
  if (v.street2) lines.push(v.street2);
  const cityLine = [v.city, v.state, v.zip].filter(Boolean).join(', ').replace(/, (\d)/, ' $1');
  const loc = [cityLine, v.country].filter(Boolean).join(' ');
  if (loc) lines.push(loc);
  return lines.join('\n');
}

function formatVendor(row) {
  if (!row) return null;
  const contact = [row.contact_first, row.contact_middle, row.contact_last].filter(Boolean).join(' ').trim();
  const company = row.company_name || '';
  const display = row.display_name || company || contact || row.email || 'Vendor';
  const vendor = {
    id: row.id,
    title: row.title || '',
    companyName: company,
    displayName: display,
    contactFirst: row.contact_first || '',
    contactMiddle: row.contact_middle || '',
    contactLast: row.contact_last || '',
    suffix: row.suffix || '',
    contactName: contact,
    email: row.email || '',
    emailCc: row.email_cc || '',
    emailBcc: row.email_bcc || '',
    phone: row.phone || '',
    mobile: row.mobile || '',
    fax: row.fax || '',
    otherPhone: row.other_phone || '',
    website: row.website || '',
    checkName: row.check_name || '',
    street: row.street || '',
    street2: row.street2 || '',
    city: row.city || '',
    state: row.state || '',
    zip: row.zip || '',
    country: row.country || '',
    notes: row.notes || '',
    bankAccount: row.bank_account || '',
    routingNumber: row.routing_number || '',
    taxId: row.tax_id || '',
    track1099: !!(row.track_1099 === 1 || row.track_1099 === true),
    paymentTerms: row.payment_terms || 'Net 30',
    accountNo: row.account_no || '',
    expenseCategory: row.expense_category || '',
    openingBalance: Number(row.opening_balance) || 0,
    openingAsOf: row.opening_as_of || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
  vendor.mailingAddress = formatAddress(vendor);
  return vendor;
}

function dbFields(input) {
  return {
    title: input.title,
    company_name: input.companyName,
    display_name: input.displayName,
    contact_first: input.contactFirst,
    contact_middle: input.contactMiddle,
    contact_last: input.contactLast,
    suffix: input.suffix,
    email: input.email,
    email_cc: input.emailCc,
    email_bcc: input.emailBcc,
    phone: input.phone,
    mobile: input.mobile,
    fax: input.fax,
    other_phone: input.otherPhone,
    website: input.website,
    check_name: input.checkName,
    street: input.street,
    street2: input.street2,
    city: input.city,
    state: input.state,
    zip: input.zip,
    country: input.country,
    notes: input.notes,
    bank_account: input.bankAccount,
    routing_number: input.routingNumber,
    tax_id: input.taxId,
    track_1099: input.track1099 ? 1 : 0,
    payment_terms: input.paymentTerms,
    account_no: input.accountNo,
    expense_category: input.expenseCategory,
    opening_balance: input.openingBalance,
    opening_as_of: input.openingAsOf
  };
}

function forSupabase(fields) {
  const out = Object.assign({}, fields);
  out.track_1099 = !!fields.track_1099;
  return out;
}

module.exports = { normalizeVendor, formatVendor, formatAddress, dbFields, forSupabase };
