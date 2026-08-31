function trim(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 240);
}

function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function contactName(row) {
  return [row.first_name || row.firstName, row.middle_name || row.middleName, row.last_name || row.lastName]
    .filter(Boolean).join(' ').trim();
}

function normalizeContact(input) {
  const src = input || {};
  const first = trim(src.firstName || src.first_name || src.contactFirst || src.contact_first, 80);
  const last = trim(src.lastName || src.last_name || src.contactLast || src.contact_last, 80);
  const email = trim(src.email, 160).toLowerCase();
  const phone = trim(src.phone, 40);
  const mobile = trim(src.mobile, 40);
  if (!first && !last && !email && !phone && !mobile) {
    throw new Error('Enter a contact name, email, or phone.');
  }
  return {
    title: trim(src.title, 20),
    firstName: first,
    middleName: trim(src.middleName || src.middle_name || src.contactMiddle || src.contact_middle, 80),
    lastName: last,
    suffix: trim(src.suffix, 20),
    jobTitle: trim(src.jobTitle || src.job_title, 80),
    role: trim(src.role || src.contactRole || src.contact_role, 80),
    email: email,
    phone: phone,
    mobile: mobile,
    fax: trim(src.fax, 40),
    isPrimary: bool(src.isPrimary != null ? src.isPrimary : src.is_primary),
    notes: trim(src.notes, 2000),
    sortOrder: Number(src.sortOrder != null ? src.sortOrder : src.sort_order) || 0
  };
}

function formatContact(row) {
  if (!row) return null;
  const name = contactName(row);
  return {
    id: row.id,
    title: row.title || '',
    firstName: row.first_name || '',
    middleName: row.middle_name || '',
    lastName: row.last_name || '',
    suffix: row.suffix || '',
    name: name,
    jobTitle: row.job_title || '',
    role: row.role || '',
    email: row.email || '',
    phone: row.phone || '',
    mobile: row.mobile || '',
    fax: row.fax || '',
    isPrimary: !!(row.is_primary === 1 || row.is_primary === true),
    notes: row.notes || '',
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function dbFields(input) {
  return {
    title: input.title,
    first_name: input.firstName,
    middle_name: input.middleName,
    last_name: input.lastName,
    suffix: input.suffix,
    job_title: input.jobTitle,
    role: input.role,
    email: input.email,
    phone: input.phone,
    mobile: input.mobile,
    fax: input.fax,
    is_primary: input.isPrimary ? 1 : 0,
    notes: input.notes,
    sort_order: input.sortOrder
  };
}

function forSupabase(fields) {
  const out = Object.assign({}, fields);
  out.is_primary = !!fields.is_primary;
  return out;
}

function contactFromCustomerRow(row) {
  if (!row) return null;
  const first = row.contact_first || '';
  const last = row.contact_last || '';
  if (!first && !last && !row.email && !row.phone && !row.mobile) return null;
  return normalizeContact({
    title: row.title,
    firstName: first,
    middleName: row.contact_middle,
    lastName: last,
    suffix: row.suffix,
    jobTitle: row.job_title,
    role: row.contact_role || 'Primary',
    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    fax: row.fax,
    isPrimary: true,
    notes: ''
  });
}

function contactFromVendorRow(row) {
  if (!row) return null;
  const first = row.contact_first || '';
  const last = row.contact_last || '';
  if (!first && !last && !row.email && !row.phone && !row.mobile) return null;
  return normalizeContact({
    title: row.title,
    firstName: first,
    middleName: row.contact_middle,
    lastName: last,
    suffix: row.suffix,
    role: 'Primary',
    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    fax: row.fax,
    isPrimary: true,
    notes: ''
  });
}

module.exports = {
  normalizeContact,
  formatContact,
  contactName,
  dbFields,
  forSupabase,
  contactFromCustomerRow,
  contactFromVendorRow
};
