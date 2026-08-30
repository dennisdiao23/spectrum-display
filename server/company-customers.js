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

function normalizeCustomer(input) {
  const src = input || {};
  const shipSame = src.shipSame !== false && src.shipSame !== 0 && src.shipSame !== '0' && src.ship_same !== false && src.ship_same !== 0;
  const bill = {
    street: trim(src.billStreet || src.bill_street, 240),
    street2: trim(src.billStreet2 || src.bill_street2, 240),
    city: trim(src.billCity || src.bill_city, 80),
    state: trim(src.billState || src.bill_state, 80),
    zip: trim(src.billZip || src.bill_zip, 20),
    country: trim(src.billCountry || src.bill_country, 80) || 'United States'
  };
  const ship = shipSame ? bill : {
    street: trim(src.shipStreet || src.ship_street, 240),
    street2: trim(src.shipStreet2 || src.ship_street2, 240),
    city: trim(src.shipCity || src.ship_city, 80),
    state: trim(src.shipState || src.ship_state, 80),
    zip: trim(src.shipZip || src.ship_zip, 20),
    country: trim(src.shipCountry || src.ship_country, 80) || bill.country
  };
  const companyName = trim(src.companyName || src.company_name, 160);
  const first = trim(src.contactFirst || src.contact_first, 80);
  const middle = trim(src.contactMiddle || src.contact_middle, 80);
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
    contactMiddle: middle,
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
    isSub: bool(src.isSub != null ? src.isSub : src.is_sub),
    emailConsent: bool(src.emailConsent != null ? src.emailConsent : src.email_consent),
    taxId: trim(src.taxId || src.tax_id, 80),
    taxExempt: bool(src.taxExempt != null ? src.taxExempt : src.tax_exempt),
    taxRate: num(src.taxRate != null ? src.taxRate : src.tax_rate),
    paymentTerms: trim(src.paymentTerms || src.payment_terms, 80) || 'Net 30',
    paymentMethod: trim(src.paymentMethod || src.payment_method, 80),
    formDelivery: trim(src.formDelivery || src.form_delivery, 40) || 'Email',
    invoiceLanguage: trim(src.invoiceLanguage || src.invoice_language, 40) || 'English',
    openingBalance: num(src.openingBalance != null ? src.openingBalance : src.opening_balance),
    openingAsOf: trim(src.openingAsOf || src.opening_as_of, 20),
    billStreet: bill.street,
    billStreet2: bill.street2,
    billCity: bill.city,
    billState: bill.state,
    billZip: bill.zip,
    billCountry: bill.country,
    shipSame: shipSame,
    shipStreet: ship.street,
    shipStreet2: ship.street2,
    shipCity: ship.city,
    shipState: ship.state,
    shipZip: ship.zip,
    shipCountry: ship.country,
    source: trim(src.source, 80),
    referredBy: trim(src.referredBy || src.referred_by, 80),
    jobTitle: trim(src.jobTitle || src.job_title, 80),
    contactRole: trim(src.contactRole || src.contact_role, 80),
    preferredContact: trim(src.preferredContact || src.preferred_contact, 40),
    industry: trim(src.industry, 80),
    social: trim(src.social, 200),
    notes: trim(src.notes, 4000)
  };
}

function formatCustomer(row) {
  if (!row) return null;
  const first = row.contact_first || '';
  const last = row.contact_last || '';
  const contact = [row.contact_first, row.contact_middle, row.contact_last].filter(Boolean).join(' ').trim();
  const company = row.company_name || '';
  const display = row.display_name || company || contact || row.email || 'Customer';
  return {
    id: row.id,
    title: row.title || '',
    companyName: company,
    displayName: display,
    contactFirst: first,
    contactMiddle: row.contact_middle || '',
    contactLast: last,
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
    isSub: !!(row.is_sub === 1 || row.is_sub === true),
    emailConsent: !!(row.email_consent === 1 || row.email_consent === true),
    taxId: row.tax_id || '',
    taxExempt: !!(row.tax_exempt === 1 || row.tax_exempt === true),
    taxRate: num(row.tax_rate),
    paymentTerms: row.payment_terms || 'Net 30',
    paymentMethod: row.payment_method || '',
    formDelivery: row.form_delivery || 'Email',
    invoiceLanguage: row.invoice_language || 'English',
    openingBalance: num(row.opening_balance),
    openingAsOf: row.opening_as_of || '',
    billStreet: row.bill_street || '',
    billStreet2: row.bill_street2 || '',
    billCity: row.bill_city || '',
    billState: row.bill_state || '',
    billZip: row.bill_zip || '',
    billCountry: row.bill_country || '',
    shipSame: row.ship_same !== 0 && row.ship_same !== false,
    shipStreet: row.ship_street || '',
    shipStreet2: row.ship_street2 || '',
    shipCity: row.ship_city || '',
    shipState: row.ship_state || '',
    shipZip: row.ship_zip || '',
    shipCountry: row.ship_country || '',
    source: row.source || '',
    referredBy: row.referred_by || '',
    jobTitle: row.job_title || '',
    contactRole: row.contact_role || '',
    preferredContact: row.preferred_contact || '',
    industry: row.industry || '',
    social: row.social || '',
    notes: row.notes || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
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
    is_sub: input.isSub ? 1 : 0,
    email_consent: input.emailConsent ? 1 : 0,
    tax_id: input.taxId,
    tax_exempt: input.taxExempt ? 1 : 0,
    tax_rate: input.taxRate,
    payment_terms: input.paymentTerms,
    payment_method: input.paymentMethod,
    form_delivery: input.formDelivery,
    invoice_language: input.invoiceLanguage,
    opening_balance: input.openingBalance,
    opening_as_of: input.openingAsOf,
    bill_street: input.billStreet,
    bill_street2: input.billStreet2,
    bill_city: input.billCity,
    bill_state: input.billState,
    bill_zip: input.billZip,
    bill_country: input.billCountry,
    ship_same: input.shipSame ? 1 : 0,
    ship_street: input.shipStreet,
    ship_street2: input.shipStreet2,
    ship_city: input.shipCity,
    ship_state: input.shipState,
    ship_zip: input.shipZip,
    ship_country: input.shipCountry,
    source: input.source,
    referred_by: input.referredBy,
    job_title: input.jobTitle,
    contact_role: input.contactRole,
    preferred_contact: input.preferredContact,
    industry: input.industry,
    social: input.social,
    notes: input.notes
  };
}

function forSupabase(fields) {
  const out = Object.assign({}, fields);
  ['ship_same', 'is_sub', 'email_consent', 'tax_exempt'].forEach(function (key) {
    out[key] = !!fields[key];
  });
  return out;
}

module.exports = { normalizeCustomer, formatCustomer, dbFields, forSupabase };
