function trim(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 240);
}

function normalizeCustomer(input) {
  const src = input || {};
  const shipSame = src.shipSame === true || src.shipSame === 1 || src.shipSame === '1' || src.ship_same === 1;
  const bill = {
    street: trim(src.billStreet || src.bill_street, 240),
    city: trim(src.billCity || src.bill_city, 80),
    state: trim(src.billState || src.bill_state, 80),
    zip: trim(src.billZip || src.bill_zip, 20),
    country: trim(src.billCountry || src.bill_country, 80) || 'United States'
  };
  const ship = shipSame ? bill : {
    street: trim(src.shipStreet || src.ship_street, 240),
    city: trim(src.shipCity || src.ship_city, 80),
    state: trim(src.shipState || src.ship_state, 80),
    zip: trim(src.shipZip || src.ship_zip, 20),
    country: trim(src.shipCountry || src.ship_country, 80) || bill.country
  };
  const companyName = trim(src.companyName || src.company_name, 160);
  const first = trim(src.contactFirst || src.contact_first, 80);
  const last = trim(src.contactLast || src.contact_last, 80);
  if (!companyName && !first && !last) {
    throw new Error('Enter a company name or a contact name.');
  }
  return {
    companyName: companyName,
    contactFirst: first,
    contactLast: last,
    email: trim(src.email, 160).toLowerCase(),
    phone: trim(src.phone, 40),
    mobile: trim(src.mobile, 40),
    website: trim(src.website, 200),
    taxId: trim(src.taxId || src.tax_id, 80),
    paymentTerms: trim(src.paymentTerms || src.payment_terms, 80) || 'Net 30',
    billStreet: bill.street,
    billCity: bill.city,
    billState: bill.state,
    billZip: bill.zip,
    billCountry: bill.country,
    shipSame: shipSame,
    shipStreet: ship.street,
    shipCity: ship.city,
    shipState: ship.state,
    shipZip: ship.zip,
    shipCountry: ship.country,
    notes: trim(src.notes, 2000)
  };
}

function formatCustomer(row) {
  if (!row) return null;
  const first = row.contact_first || '';
  const last = row.contact_last || '';
  const contact = (first + ' ' + last).trim();
  const company = row.company_name || '';
  return {
    id: row.id,
    companyName: company,
    contactFirst: first,
    contactLast: last,
    contactName: contact,
    displayName: company || contact || row.email || 'Customer',
    email: row.email || '',
    phone: row.phone || '',
    mobile: row.mobile || '',
    website: row.website || '',
    taxId: row.tax_id || '',
    paymentTerms: row.payment_terms || 'Net 30',
    billStreet: row.bill_street || '',
    billCity: row.bill_city || '',
    billState: row.bill_state || '',
    billZip: row.bill_zip || '',
    billCountry: row.bill_country || '',
    shipSame: !!(row.ship_same === 1 || row.ship_same === true),
    shipStreet: row.ship_street || '',
    shipCity: row.ship_city || '',
    shipState: row.ship_state || '',
    shipZip: row.ship_zip || '',
    shipCountry: row.ship_country || '',
    notes: row.notes || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function dbFields(input) {
  return {
    company_name: input.companyName,
    contact_first: input.contactFirst,
    contact_last: input.contactLast,
    email: input.email,
    phone: input.phone,
    mobile: input.mobile,
    website: input.website,
    tax_id: input.taxId,
    payment_terms: input.paymentTerms,
    bill_street: input.billStreet,
    bill_city: input.billCity,
    bill_state: input.billState,
    bill_zip: input.billZip,
    bill_country: input.billCountry,
    ship_same: input.shipSame ? 1 : 0,
    ship_street: input.shipStreet,
    ship_city: input.shipCity,
    ship_state: input.shipState,
    ship_zip: input.shipZip,
    ship_country: input.shipCountry,
    notes: input.notes
  };
}

module.exports = { normalizeCustomer, formatCustomer, dbFields };
