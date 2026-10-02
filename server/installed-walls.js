/**
 * Installed wall. Created from a shipped sales order.
 * Warranty end is the ship date plus 3 years.
 * Selected COB also keeps a 5-year support end.
 */

const SERIAL_KINDS = { cabinet: 'Cabinet', module: 'Module', processor: 'Processor' };

function trim(value, max) {
  const text = String(value == null ? '' : value).trim();
  return max ? text.slice(0, max) : text;
}

function nowIso() {
  return new Date().toISOString();
}

function throwIf(error, message) {
  if (!error) return;
  throw new Error(message || error.message || 'Request failed.');
}

function dealerCustomerId(user) {
  const id = user && (user.customerId || user.customer_id);
  return id == null ? '' : String(id);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function addYears(ymd, years) {
  if (!validDate(ymd)) return '';
  const parts = ymd.split('-').map(Number);
  const day = parts[2];
  const d = new Date(Date.UTC(parts[0] + years, parts[1] - 1, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return d.getUTCFullYear() + '-' + m + '-' + dd;
}

function flag(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function nextNumberFrom(numbers) {
  let max = 1000;
  (numbers || []).forEach(function (number) {
    const match = String(number || '').match(/^IW-(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1]) || 0);
  });
  return 'IW-' + (max + 1);
}

function parseSerials(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map(function (row) {
    const kind = trim(row && row.kind, 20);
    return {
      kind: SERIAL_KINDS[kind] ? kind : 'cabinet',
      serial: trim(row && row.serial, 80)
    };
  }).filter(function (row) { return row.serial; }).slice(0, 400);
}

function parseSpares(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map(function (row) {
    return {
      sku: trim(row && row.sku, 80),
      qty: Math.max(0, Math.round(Number(row && row.qty) || 0))
    };
  }).filter(function (row) { return row.sku && row.qty > 0; }).slice(0, 40);
}

function looksCob(doc) {
  const blob = ((doc && doc.lines) || []).map(function (line) {
    return [line.sku, line.item, line.description].join(' ');
  }).join(' ');
  return /\bcob\b/i.test(blob);
}

function datesFor(shipDate, selectedCob) {
  return {
    warrantyStart: validDate(shipDate) ? shipDate : '',
    warrantyEnd: addYears(shipDate, 3),
    supportEnd: selectedCob ? addYears(shipDate, 5) : ''
  };
}

function warrantyFrom(body, current, shipDate, selectedCob) {
  const startIn = body && Object.prototype.hasOwnProperty.call(body, 'warrantyStart');
  const endIn = body && Object.prototype.hasOwnProperty.call(body, 'warrantyEnd');
  if (startIn || endIn) {
    const start = trim(body.warrantyStart, 20);
    const end = trim(body.warrantyEnd, 20);
    if (!validDate(start)) throw Object.assign(new Error('Enter a warranty start date.'), { code: 'invalid' });
    if (!validDate(end)) throw Object.assign(new Error('Enter a warranty end date.'), { code: 'invalid' });
    if (end < start) throw Object.assign(new Error('Warranty end is before the start date.'), { code: 'invalid' });
    return {
      warrantyStart: start,
      warrantyEnd: end,
      supportEnd: selectedCob ? ((current && current.support_end) || addYears(start, 5)) : ''
    };
  }
  if (current && current.warranty_start) {
    return {
      warrantyStart: current.warranty_start,
      warrantyEnd: current.warranty_end || '',
      supportEnd: current.support_end || ''
    };
  }
  return datesFor(shipDate, selectedCob);
}

function readPortalWall(body) {
  const wallName = trim(body && body.wallName, 160);
  if (!wallName) throw Object.assign(new Error('Enter a wall name.'), { code: 'invalid' });
  const warrantyStart = trim(body && body.warrantyStart, 20);
  const warrantyEnd = trim(body && body.warrantyEnd, 20);
  if (!validDate(warrantyStart)) throw Object.assign(new Error('Enter a warranty start date.'), { code: 'invalid' });
  if (!validDate(warrantyEnd)) throw Object.assign(new Error('Enter a warranty end date.'), { code: 'invalid' });
  if (warrantyEnd < warrantyStart) throw Object.assign(new Error('Warranty end is before the start date.'), { code: 'invalid' });
  const shipDate = trim(body && body.shipDate, 20);
  if (shipDate && !validDate(shipDate)) throw Object.assign(new Error('Ship date is not a date.'), { code: 'invalid' });
  return {
    wallName: wallName,
    endCustomer: trim(body && body.endCustomer, 160),
    installer: trim(body && body.installer, 160),
    pitch: trim(body && body.pitch, 40),
    shipDate: shipDate,
    warrantyStart: warrantyStart,
    warrantyEnd: warrantyEnd,
    siteStreet: trim(body && body.siteStreet, 160),
    siteCity: trim(body && body.siteCity, 80),
    siteState: trim(body && body.siteState, 40),
    siteZip: trim(body && body.siteZip, 20),
    siteCountry: trim(body && body.siteCountry, 80),
    panel: trim(body && body.panel, 160),
    controller: trim(body && body.controller, 160),
    imageUrl: trim(body && body.imageUrl, 400)
  };
}

function formatWall(row, serials, spares) {
  if (!row) return null;
  const cob = flag(row.selected_cob);
  const spareRows = spares || [];
  const spareQty = spareRows.reduce(function (sum, item) { return sum + (Number(item.qty) || 0); }, 0);
  return {
    id: String(row.id),
    number: row.number || '',
    salesDocId: row.sales_doc_id == null ? '' : String(row.sales_doc_id),
    orderNumber: row.order_number || '',
    customerId: row.customer_id == null ? '' : String(row.customer_id),
    wallName: row.wall_name || '',
    endCustomer: row.end_customer || '',
    installer: row.installer || '',
    pitch: row.pitch || '',
    selectedCob: cob,
    shipDate: row.ship_date || '',
    warrantyStart: row.warranty_start || '',
    warrantyEnd: row.warranty_end || '',
    supportEnd: cob ? (row.support_end || '') : '',
    siteStreet: row.site_street || '',
    siteCity: row.site_city || '',
    siteState: row.site_state || '',
    siteZip: row.site_zip || '',
    siteCountry: row.site_country || '',
    panel: row.panel || '',
    controller: row.controller || '',
    imageUrl: row.image_url || '',
    serials: (serials || []).map(function (item) {
      return { kind: item.kind || 'cabinet', kindLabel: SERIAL_KINDS[item.kind] || 'Cabinet', serial: item.serial || '' };
    }),
    spares: spareRows.map(function (item) {
      return { sku: item.sku || '', qty: Number(item.qty) || 0 };
    }),
    spareQty: spareQty,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function readUpdate(body, current) {
  const shipDate = trim(body && body.shipDate, 20) || (current && current.ship_date) || '';
  if (!validDate(shipDate)) throw Object.assign(new Error('Enter a ship date.'), { code: 'invalid' });
  const selectedCob = body && body.selectedCob != null ? flag(body.selectedCob) : flag(current && current.selected_cob);
  const dates = warrantyFrom(body, current, shipDate, selectedCob);
  return {
    wallName: trim(body && body.wallName, 160) || (current && current.wall_name) || '',
    endCustomer: trim(body && body.endCustomer, 160),
    installer: trim(body && body.installer, 160),
    pitch: trim(body && body.pitch, 40),
    selectedCob: selectedCob,
    shipDate: shipDate,
    warrantyStart: dates.warrantyStart,
    warrantyEnd: dates.warrantyEnd,
    supportEnd: dates.supportEnd,
    siteStreet: trim(body && body.siteStreet, 160),
    siteCity: trim(body && body.siteCity, 80),
    siteState: trim(body && body.siteState, 40),
    siteZip: trim(body && body.siteZip, 20),
    siteCountry: trim(body && body.siteCountry, 80),
    serials: parseSerials(body && body.serials),
    spares: parseSpares(body && body.spares)
  };
}

function ensureInstalledWalls(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS installed_walls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      sales_doc_id INTEGER,
      order_number TEXT NOT NULL DEFAULT '',
      customer_id INTEGER,
      wall_name TEXT NOT NULL DEFAULT '',
      end_customer TEXT NOT NULL DEFAULT '',
      installer TEXT NOT NULL DEFAULT '',
      pitch TEXT NOT NULL DEFAULT '',
      selected_cob INTEGER NOT NULL DEFAULT 0,
      ship_date TEXT NOT NULL DEFAULT '',
      warranty_end TEXT NOT NULL DEFAULT '',
      support_end TEXT NOT NULL DEFAULT '',
      site_street TEXT NOT NULL DEFAULT '',
      site_city TEXT NOT NULL DEFAULT '',
      site_state TEXT NOT NULL DEFAULT '',
      site_zip TEXT NOT NULL DEFAULT '',
      site_country TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS installed_walls_order_idx ON installed_walls (sales_doc_id);
  `);
  try { db.exec("ALTER TABLE installed_walls ADD COLUMN warranty_start TEXT NOT NULL DEFAULT ''"); } catch (e) { /* already present */ }
  try { db.exec("ALTER TABLE installed_walls ADD COLUMN panel TEXT NOT NULL DEFAULT ''"); } catch (e) { /* already present */ }
  try { db.exec("ALTER TABLE installed_walls ADD COLUMN controller TEXT NOT NULL DEFAULT ''"); } catch (e) { /* already present */ }
  try { db.exec("ALTER TABLE installed_walls ADD COLUMN image_url TEXT NOT NULL DEFAULT ''"); } catch (e) { /* already present */ }
  db.exec(`
    CREATE TABLE IF NOT EXISTS installed_wall_serials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wall_id INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'cabinet',
      serial TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS installed_wall_spares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wall_id INTEGER NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      qty INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function sqliteApi(db, store) {
  function serialsFor(id) {
    return db.prepare('SELECT kind, serial FROM installed_wall_serials WHERE wall_id = ? ORDER BY id').all(id);
  }
  function sparesFor(id) {
    return db.prepare('SELECT sku, qty FROM installed_wall_spares WHERE wall_id = ? ORDER BY id').all(id);
  }
  function present(row) {
    if (!row) return null;
    return formatWall(row, serialsFor(row.id), sparesFor(row.id));
  }
  function replaceChildren(id, serials, spares) {
    db.prepare('DELETE FROM installed_wall_serials WHERE wall_id = ?').run(id);
    db.prepare('DELETE FROM installed_wall_spares WHERE wall_id = ?').run(id);
    const addSerial = db.prepare('INSERT INTO installed_wall_serials (wall_id, kind, serial) VALUES (?, ?, ?)');
    const addSpare = db.prepare('INSERT INTO installed_wall_spares (wall_id, sku, qty) VALUES (?, ?, ?)');
    serials.forEach(function (row) { addSerial.run(id, row.kind, row.serial); });
    spares.forEach(function (row) { addSpare.run(id, row.sku, row.qty); });
  }
  return {
    async listInstalledWalls() {
      return db.prepare('SELECT * FROM installed_walls ORDER BY datetime(created_at) DESC, id DESC').all().map(present);
    },
    async getInstalledWall(id) {
      return present(db.prepare('SELECT * FROM installed_walls WHERE id = ?').get(id));
    },
    async listPortalInstalledWalls(user) {
      const customerId = dealerCustomerId(user);
      if (!customerId) return [];
      return db.prepare(
        'SELECT * FROM installed_walls WHERE customer_id = ? ORDER BY datetime(created_at) DESC, id DESC'
      ).all(customerId).map(present);
    },
    async getPortalInstalledWall(user, id) {
      const row = db.prepare('SELECT * FROM installed_walls WHERE id = ?').get(id);
      if (!row || String(row.customer_id) !== dealerCustomerId(user)) return null;
      return present(row);
    },
    async createPortalInstalledWall(user, body) {
      const customerId = dealerCustomerId(user);
      if (!customerId) {
        throw Object.assign(new Error('Spectrum has not linked a company customer yet.'), { code: 'no_customer' });
      }
      const input = readPortalWall(body);
      const numbers = db.prepare('SELECT number FROM installed_walls').all().map(function (row) { return row.number; });
      const stamp = nowIso();
      const info = db.prepare(`
        INSERT INTO installed_walls (
          number, sales_doc_id, order_number, customer_id, wall_name, end_customer, installer, pitch,
          selected_cob, ship_date, warranty_start, warranty_end, support_end,
          site_street, site_city, site_state, site_zip, site_country, panel, controller, image_url, created_at, updated_at
        ) VALUES (?, NULL, '', ?, ?, ?, ?, ?, 0, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        nextNumberFrom(numbers),
        customerId,
        input.wallName,
        input.endCustomer,
        input.installer,
        input.pitch,
        input.shipDate,
        input.warrantyStart,
        input.warrantyEnd,
        input.siteStreet,
        input.siteCity,
        input.siteState,
        input.siteZip,
        input.siteCountry,
        input.panel,
        input.controller,
        input.imageUrl,
        stamp,
        stamp
      );
      return present(db.prepare('SELECT * FROM installed_walls WHERE id = ?').get(info.lastInsertRowid));
    },
    async updatePortalInstalledWall(user, id, body) {
      const current = db.prepare('SELECT * FROM installed_walls WHERE id = ?').get(id);
      if (!current || String(current.customer_id) !== dealerCustomerId(user)) return null;
      const input = readPortalWall(body);
      const stamp = nowIso();
      db.prepare(`
        UPDATE installed_walls SET
          wall_name = ?, end_customer = ?, installer = ?, pitch = ?,
          ship_date = ?, warranty_start = ?, warranty_end = ?,
          site_street = ?, site_city = ?, site_state = ?, site_zip = ?, site_country = ?,
          panel = ?, controller = ?, image_url = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        input.wallName, input.endCustomer, input.installer, input.pitch,
        input.shipDate, input.warrantyStart, input.warrantyEnd,
        input.siteStreet, input.siteCity, input.siteState, input.siteZip, input.siteCountry,
        input.panel, input.controller, input.imageUrl,
        stamp, id
      );
      return present(db.prepare('SELECT * FROM installed_walls WHERE id = ?').get(id));
    },
    async createInstalledWallFromOrder(salesDocId) {
      const doc = await store.getSalesDoc(salesDocId);
      if (!doc || doc.type !== 'order') {
        throw Object.assign(new Error('Choose a sales order.'), { code: 'invalid' });
      }
      if (!validDate(doc.shipDate)) {
        throw Object.assign(new Error('Enter a ship date on this order first.'), { code: 'invalid' });
      }
      const existing = db.prepare('SELECT * FROM installed_walls WHERE sales_doc_id = ?').get(doc.id);
      if (existing) return present(existing);
      const cob = looksCob(doc);
      const dates = datesFor(doc.shipDate, cob);
      const numbers = db.prepare('SELECT number FROM installed_walls').all().map(function (row) { return row.number; });
      const stamp = nowIso();
      const info = db.prepare(`
        INSERT INTO installed_walls (
          number, sales_doc_id, order_number, customer_id, wall_name, end_customer, installer, pitch,
          selected_cob, ship_date, warranty_start, warranty_end, support_end,
          site_street, site_city, site_state, site_zip, site_country, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        nextNumberFrom(numbers),
        doc.id,
        doc.number || '',
        doc.customerId || null,
        trim((doc.number || 'Wall') + (doc.customerName ? ' · ' + doc.customerName : ''), 160),
        doc.customerName || '',
        cob ? 1 : 0,
        doc.shipDate,
        dates.warrantyStart,
        dates.warrantyEnd,
        dates.supportEnd,
        doc.shipStreet || '',
        doc.shipCity || '',
        doc.shipState || '',
        doc.shipZip || '',
        doc.shipCountry || '',
        stamp,
        stamp
      );
      return present(db.prepare('SELECT * FROM installed_walls WHERE id = ?').get(info.lastInsertRowid));
    },
    async updateInstalledWall(id, body) {
      const current = db.prepare('SELECT * FROM installed_walls WHERE id = ?').get(id);
      if (!current) return null;
      const input = readUpdate(body, current);
      const stamp = nowIso();
      db.prepare(`
        UPDATE installed_walls SET
          wall_name = ?, end_customer = ?, installer = ?, pitch = ?, selected_cob = ?,
          ship_date = ?, warranty_start = ?, warranty_end = ?, support_end = ?,
          site_street = ?, site_city = ?, site_state = ?, site_zip = ?, site_country = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        input.wallName, input.endCustomer, input.installer, input.pitch, input.selectedCob ? 1 : 0,
        input.shipDate, input.warrantyStart, input.warrantyEnd, input.supportEnd,
        input.siteStreet, input.siteCity, input.siteState, input.siteZip, input.siteCountry,
        stamp, id
      );
      replaceChildren(id, input.serials, input.spares);
      return present(db.prepare('SELECT * FROM installed_walls WHERE id = ?').get(id));
    }
  };
}

function supabaseApi(supabase, store) {
  async function children(id) {
    const serials = await supabase.from('installed_wall_serials').select('kind, serial').eq('wall_id', id).order('id');
    throwIf(serials.error, 'Could not load serials.');
    const spares = await supabase.from('installed_wall_spares').select('sku, qty').eq('wall_id', id).order('id');
    throwIf(spares.error, 'Could not load spare kits.');
    return { serials: serials.data || [], spares: spares.data || [] };
  }
  async function present(row) {
    if (!row) return null;
    const kids = await children(row.id);
    return formatWall(row, kids.serials, kids.spares);
  }
  async function replaceChildren(id, serials, spares) {
    const delS = await supabase.from('installed_wall_serials').delete().eq('wall_id', id);
    throwIf(delS.error, 'Could not update serials.');
    const delK = await supabase.from('installed_wall_spares').delete().eq('wall_id', id);
    throwIf(delK.error, 'Could not update the spare kit.');
    if (serials.length) {
      const ins = await supabase.from('installed_wall_serials').insert(serials.map(function (row) {
        return { wall_id: Number(id), kind: row.kind, serial: row.serial };
      }));
      throwIf(ins.error, 'Could not save serials.');
    }
    if (spares.length) {
      const ins = await supabase.from('installed_wall_spares').insert(spares.map(function (row) {
        return { wall_id: Number(id), sku: row.sku, qty: row.qty };
      }));
      throwIf(ins.error, 'Could not save the spare kit.');
    }
  }
  return {
    async listInstalledWalls() {
      const { data, error } = await supabase.from('installed_walls').select('*').order('created_at', { ascending: false });
      throwIf(error, 'Could not load installed walls.');
      const out = [];
      for (let i = 0; i < (data || []).length; i++) out.push(await present(data[i]));
      return out;
    },
    async getInstalledWall(id) {
      const { data, error } = await supabase.from('installed_walls').select('*').eq('id', id).maybeSingle();
      throwIf(error, 'Could not load this wall.');
      return present(data);
    },
    async listPortalInstalledWalls(user) {
      const customerId = dealerCustomerId(user);
      if (!customerId) return [];
      const { data, error } = await supabase.from('installed_walls').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
      throwIf(error, 'Could not load your walls.');
      const out = [];
      for (let i = 0; i < (data || []).length; i++) out.push(await present(data[i]));
      return out;
    },
    async getPortalInstalledWall(user, id) {
      const { data, error } = await supabase.from('installed_walls').select('*').eq('id', id).maybeSingle();
      throwIf(error, 'Could not load this wall.');
      if (!data || String(data.customer_id) !== dealerCustomerId(user)) return null;
      return present(data);
    },
    async createPortalInstalledWall(user, body) {
      const customerId = dealerCustomerId(user);
      if (!customerId) {
        throw Object.assign(new Error('Spectrum has not linked a company customer yet.'), { code: 'no_customer' });
      }
      const input = readPortalWall(body);
      const numbers = await supabase.from('installed_walls').select('number');
      throwIf(numbers.error, 'Could not assign a wall number.');
      const stamp = nowIso();
      const inserted = await supabase.from('installed_walls').insert({
        number: nextNumberFrom((numbers.data || []).map(function (row) { return row.number; })),
        order_number: '',
        customer_id: Number(customerId),
        wall_name: input.wallName,
        end_customer: input.endCustomer,
        installer: input.installer,
        pitch: input.pitch,
        selected_cob: false,
        ship_date: input.shipDate,
        warranty_start: input.warrantyStart,
        warranty_end: input.warrantyEnd,
        support_end: '',
        site_street: input.siteStreet,
        site_city: input.siteCity,
        site_state: input.siteState,
        site_zip: input.siteZip,
        site_country: input.siteCountry,
        panel: input.panel,
        controller: input.controller,
        image_url: input.imageUrl,
        created_at: stamp,
        updated_at: stamp
      }).select('*').single();
      throwIf(inserted.error, 'Could not create this wall.');
      return present(inserted.data);
    },
    async updatePortalInstalledWall(user, id, body) {
      const current = await supabase.from('installed_walls').select('*').eq('id', id).maybeSingle();
      throwIf(current.error, 'Could not load this wall.');
      if (!current.data || String(current.data.customer_id) !== dealerCustomerId(user)) return null;
      const input = readPortalWall(body);
      const updated = await supabase.from('installed_walls').update({
        wall_name: input.wallName,
        end_customer: input.endCustomer,
        installer: input.installer,
        pitch: input.pitch,
        ship_date: input.shipDate,
        warranty_start: input.warrantyStart,
        warranty_end: input.warrantyEnd,
        site_street: input.siteStreet,
        site_city: input.siteCity,
        site_state: input.siteState,
        site_zip: input.siteZip,
        site_country: input.siteCountry,
        panel: input.panel,
        controller: input.controller,
        image_url: input.imageUrl,
        updated_at: nowIso()
      }).eq('id', id);
      throwIf(updated.error, 'Could not save this wall.');
      return this.getPortalInstalledWall(user, id);
    },
    async createInstalledWallFromOrder(salesDocId) {
      const doc = await store.getSalesDoc(salesDocId);
      if (!doc || doc.type !== 'order') {
        throw Object.assign(new Error('Choose a sales order.'), { code: 'invalid' });
      }
      if (!validDate(doc.shipDate)) {
        throw Object.assign(new Error('Enter a ship date on this order first.'), { code: 'invalid' });
      }
      const existing = await supabase.from('installed_walls').select('*').eq('sales_doc_id', doc.id).maybeSingle();
      throwIf(existing.error, 'Could not check this order.');
      if (existing.data) return present(existing.data);
      const cob = looksCob(doc);
      const dates = datesFor(doc.shipDate, cob);
      const numbers = await supabase.from('installed_walls').select('number');
      throwIf(numbers.error, 'Could not assign a wall number.');
      const stamp = nowIso();
      const inserted = await supabase.from('installed_walls').insert({
        number: nextNumberFrom((numbers.data || []).map(function (row) { return row.number; })),
        sales_doc_id: Number(doc.id),
        order_number: doc.number || '',
        customer_id: doc.customerId ? Number(doc.customerId) : null,
        wall_name: trim((doc.number || 'Wall') + (doc.customerName ? ' · ' + doc.customerName : ''), 160),
        end_customer: doc.customerName || '',
        installer: '',
        pitch: '',
        selected_cob: cob,
        ship_date: doc.shipDate,
        warranty_start: dates.warrantyStart,
        warranty_end: dates.warrantyEnd,
        support_end: dates.supportEnd,
        site_street: doc.shipStreet || '',
        site_city: doc.shipCity || '',
        site_state: doc.shipState || '',
        site_zip: doc.shipZip || '',
        site_country: doc.shipCountry || '',
        created_at: stamp,
        updated_at: stamp
      }).select('*').single();
      throwIf(inserted.error, 'Could not create this wall.');
      return present(inserted.data);
    },
    async updateInstalledWall(id, body) {
      const current = await supabase.from('installed_walls').select('*').eq('id', id).maybeSingle();
      throwIf(current.error, 'Could not load this wall.');
      if (!current.data) return null;
      const input = readUpdate(body, current.data);
      const stamp = nowIso();
      const updated = await supabase.from('installed_walls').update({
        wall_name: input.wallName,
        end_customer: input.endCustomer,
        installer: input.installer,
        pitch: input.pitch,
        selected_cob: input.selectedCob,
        ship_date: input.shipDate,
        warranty_start: input.warrantyStart,
        warranty_end: input.warrantyEnd,
        support_end: input.supportEnd,
        site_street: input.siteStreet,
        site_city: input.siteCity,
        site_state: input.siteState,
        site_zip: input.siteZip,
        site_country: input.siteCountry,
        updated_at: stamp
      }).eq('id', id);
      throwIf(updated.error, 'Could not save this wall.');
      await replaceChildren(id, input.serials, input.spares);
      return this.getInstalledWall(id);
    }
  };
}

module.exports = {
  ensureInstalledWalls: ensureInstalledWalls,
  sqliteApi: sqliteApi,
  supabaseApi: supabaseApi
};
