const { isOwnerAdmin, hasPerm } = require('./admin-roles');

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function staffId(value) {
  const s = trim(value);
  return s || '';
}

function seesAllCustomers(admin) {
  if (!admin) return false;
  if (isOwnerAdmin(admin)) return true;
  // Prefer enriched admin.perms from publicAdmin; bare rows without perms must not
  // fall through to legacy defaults that grant settings edit.
  if (!admin.perms) return false;
  if (hasPerm(admin, 'settings', 'edit')) return true;
  return false;
}

function staffLabel(person) {
  if (!person) return '';
  return trim(person.displayName || person.name || person.email);
}

function indexStaff(staffList) {
  const byId = new Map();
  const byName = new Map();
  (staffList || []).forEach(function (person) {
    if (!person || person.id == null) return;
    const id = String(person.id);
    byId.set(id, person);
    const name = staffLabel(person).toLowerCase();
    if (name) byName.set(name, person);
  });
  return { byId: byId, byName: byName };
}

function visibleSalesRepIds(admin, staffList) {
  const myId = staffId(admin && admin.id);
  const allowed = new Set();
  if (!myId) return allowed;
  allowed.add(myId);
  (staffList || []).forEach(function (person) {
    if (staffId(person && (person.managerId != null ? person.managerId : person.manager_id)) === myId) {
      allowed.add(String(person.id));
    }
  });
  return allowed;
}

function resolveCustomerRepId(customer, indexes) {
  const rid = staffId(customer && (customer.salesRepId != null ? customer.salesRepId : customer.sales_rep_id));
  if (rid) return rid;
  const name = trim(customer && (customer.salesRep || customer.sales_rep)).toLowerCase();
  if (!name || !indexes) return '';
  const hit = indexes.byName.get(name);
  return hit ? String(hit.id) : '';
}

function canViewCustomer(admin, customer, staffList) {
  if (!customer) return false;
  if (seesAllCustomers(admin)) return true;
  const indexes = indexStaff(staffList);
  const allowed = visibleSalesRepIds(admin, staffList);
  const rid = resolveCustomerRepId(customer, indexes);
  if (!rid) return false;
  return allowed.has(rid);
}

function filterCustomers(customers, admin, staffList) {
  if (seesAllCustomers(admin)) return customers || [];
  return (customers || []).filter(function (customer) {
    return canViewCustomer(admin, customer, staffList);
  });
}

function filterSalesDocs(docs, admin, staffList, customers) {
  if (seesAllCustomers(admin)) return docs || [];
  const indexes = indexStaff(staffList);
  const allowed = visibleSalesRepIds(admin, staffList);
  const byCustomerId = new Map();
  (customers || []).forEach(function (c) {
    if (c && c.id != null) byCustomerId.set(String(c.id), c);
  });
  return (docs || []).filter(function (doc) {
    const cid = staffId(doc && (doc.customerId != null ? doc.customerId : doc.customer_id));
    if (!cid) return false;
    const customer = byCustomerId.get(cid);
    if (!customer) return false;
    const rid = resolveCustomerRepId(customer, indexes);
    return rid && allowed.has(rid);
  });
}

function normalizeManagerId(raw, selfId, staffList) {
  const mid = staffId(raw);
  if (!mid) return '';
  if (selfId && mid === String(selfId)) {
    throw new Error('A user cannot report to themselves.');
  }
  const indexes = indexStaff(staffList);
  if (!indexes.byId.has(mid)) {
    throw new Error('Choose a valid manager.');
  }
  // Prevent cycles: walk manager chain from chosen manager; must not hit self.
  let cursor = mid;
  const seen = new Set();
  while (cursor) {
    if (selfId && cursor === String(selfId)) {
      throw new Error('That manager link would create a loop.');
    }
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const person = indexes.byId.get(cursor);
    cursor = person ? staffId(person.managerId != null ? person.managerId : person.manager_id) : '';
  }
  return mid;
}

function customersForSalesRep(customers, salesRepId, staffList) {
  const target = staffId(salesRepId);
  if (!target) return [];
  const indexes = indexStaff(staffList);
  return (customers || []).filter(function (customer) {
    return resolveCustomerRepId(customer, indexes) === target;
  });
}

module.exports = {
  seesAllCustomers: seesAllCustomers,
  staffLabel: staffLabel,
  indexStaff: indexStaff,
  visibleSalesRepIds: visibleSalesRepIds,
  resolveCustomerRepId: resolveCustomerRepId,
  canViewCustomer: canViewCustomer,
  filterCustomers: filterCustomers,
  filterSalesDocs: filterSalesDocs,
  normalizeManagerId: normalizeManagerId,
  customersForSalesRep: customersForSalesRep
};
