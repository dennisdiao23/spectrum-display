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

const CATEGORIES = [
  'Bank',
  'Software',
  'Cloud',
  'Insurance',
  'Utilities',
  'Shipping',
  'Tax',
  'Phone',
  'Other'
];

function defaultProfile() {
  return {
    legalName: 'Spectrum Display Inc.',
    dba: '',
    phone: '',
    email: '',
    website: '',
    street: '',
    street2: '',
    city: 'Los Angeles',
    state: 'CA',
    zip: '',
    country: 'United States',
    taxId: '',
    notes: ''
  };
}

function normalizeProfile(input) {
  const src = input || {};
  const legalName = trim(src.legalName || src.legal_name, 160) || 'Spectrum Display Inc.';
  return {
    legalName: legalName,
    dba: trim(src.dba, 160),
    phone: trim(src.phone, 40),
    email: trim(src.email, 160).toLowerCase(),
    website: trim(src.website, 200),
    street: trim(src.street, 240),
    street2: trim(src.street2, 240),
    city: trim(src.city, 80),
    state: trim(src.state, 80),
    zip: trim(src.zip, 20),
    country: trim(src.country, 80) || 'United States',
    taxId: trim(src.taxId || src.tax_id, 80),
    notes: trim(src.notes, 4000)
  };
}

function formatProfile(row) {
  const fallback = defaultProfile();
  if (!row) {
    return Object.assign({ id: 1 }, fallback, { createdAt: '', updatedAt: '' });
  }
  return {
    id: row.id || 1,
    legalName: row.legal_name || fallback.legalName,
    dba: row.dba || '',
    phone: row.phone || '',
    email: row.email || '',
    website: row.website || '',
    street: row.street || '',
    street2: row.street2 || '',
    city: row.city || '',
    state: row.state || '',
    zip: row.zip || '',
    country: row.country || fallback.country,
    taxId: row.tax_id || '',
    notes: row.notes || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function profileDbFields(input) {
  return {
    legal_name: input.legalName,
    dba: input.dba,
    phone: input.phone,
    email: input.email,
    website: input.website,
    street: input.street,
    street2: input.street2,
    city: input.city,
    state: input.state,
    zip: input.zip,
    country: input.country,
    tax_id: input.taxId,
    notes: input.notes
  };
}

function profileLine(p) {
  const cityLine = [p.city, p.state, p.zip].filter(Boolean).join(', ').replace(/, (\d)/, ' $1');
  return [p.street, cityLine].filter(Boolean).join(' · ') || 'Legal name and address';
}

function normalizeAccount(input) {
  const src = input || {};
  const name = trim(src.name, 160);
  if (!name) throw new Error('Enter an account name.');
  const category = trim(src.category, 40);
  const monthlyPaymentAmount = Math.max(0, num(src.monthlyPaymentAmount != null ? src.monthlyPaymentAmount : src.monthly_payment_amount));
  const monthlyBillingAmount = Math.max(0, num(src.monthlyBillingAmount != null ? src.monthlyBillingAmount : src.monthly_billing_amount));
  const monthlyPayment = bool(src.monthlyPayment != null ? src.monthlyPayment : src.monthly_payment) || monthlyPaymentAmount > 0;
  const monthlyBilling = bool(src.monthlyBilling != null ? src.monthlyBilling : src.monthly_billing) || monthlyBillingAmount > 0;
  return {
    name: name,
    category: CATEGORIES.indexOf(category) >= 0 ? category : (category || ''),
    website: trim(src.website, 200),
    login: trim(src.login, 160),
    password: String(src.password == null ? '' : src.password).slice(0, 240),
    email: trim(src.email, 160).toLowerCase(),
    notes: trim(src.notes, 4000),
    monthlyPayment: monthlyPayment,
    monthlyPaymentAmount: monthlyPaymentAmount,
    monthlyBilling: monthlyBilling,
    monthlyBillingAmount: monthlyBillingAmount
  };
}

function formatAccount(row, opts) {
  if (!row) return null;
  const includePassword = !opts || opts.includePassword !== false;
  const monthlyPayment = !!(row.monthly_payment === 1 || row.monthly_payment === true);
  const monthlyBilling = !!(row.monthly_billing === 1 || row.monthly_billing === true);
  const monthlyPaymentAmount = Number(row.monthly_payment_amount) || 0;
  const monthlyBillingAmount = Number(row.monthly_billing_amount) || 0;
  const account = {
    id: row.id,
    name: row.name || '',
    category: row.category || '',
    website: row.website || '',
    login: row.login || '',
    email: row.email || '',
    notes: row.notes || '',
    monthlyPayment: monthlyPayment || monthlyPaymentAmount > 0,
    monthlyPaymentAmount: monthlyPaymentAmount,
    monthlyBilling: monthlyBilling || monthlyBillingAmount > 0,
    monthlyBillingAmount: monthlyBillingAmount,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
  if (includePassword) account.password = row.password || '';
  return account;
}

function accountDbFields(input) {
  return {
    name: input.name,
    category: input.category,
    website: input.website,
    login: input.login,
    password: input.password,
    email: input.email,
    notes: input.notes,
    monthly_payment: input.monthlyPayment ? 1 : 0,
    monthly_payment_amount: input.monthlyPaymentAmount,
    monthly_billing: input.monthlyBilling ? 1 : 0,
    monthly_billing_amount: input.monthlyBillingAmount
  };
}

function forSupabaseAccount(fields) {
  const out = Object.assign({}, fields);
  out.monthly_payment = !!fields.monthly_payment;
  out.monthly_billing = !!fields.monthly_billing;
  return out;
}

module.exports = {
  CATEGORIES,
  defaultProfile,
  normalizeProfile,
  formatProfile,
  profileDbFields,
  profileLine,
  normalizeAccount,
  formatAccount,
  accountDbFields,
  forSupabaseAccount
};
