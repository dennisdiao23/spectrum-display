const crypto = require('crypto');

const TZ = 'America/Los_Angeles';
const CHANNELS = ['website', 'store'];
const ACTION_EVENTS = ['contact', 'dealer', 'add_to_cart'];
const TRAFFIC_DAYS = 60;
const EVENT_KEEP_DAYS = 90;
const VISITOR_LOG_LIMIT = 300;
const VISITOR_EVENT_LIMIT = 500;
const BOT_UA = /bot|crawler|spider|crawling|lighthouse|pagespeed|pingdom|preview|slurp|facebookexternalhit|whatsapp|telegram|discordbot|embed/i;

const UTM_LABELS = {
  google: 'Google',
  googleads: 'Google',
  adwords: 'Google',
  cpc: 'Google',
  facebook: 'Facebook',
  fb: 'Facebook',
  meta: 'Facebook',
  instagram: 'Instagram',
  ig: 'Instagram',
  bing: 'Bing',
  microsoft: 'Bing',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  twitter: 'X',
  x: 'X'
};

function dayStamp(value) {
  const d = value instanceof Date ? value : new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function addDays(stamp, n) {
  const parts = String(stamp || '').split('-').map(Number);
  const dt = new Date(Date.UTC(parts[0], (parts[1] || 1) - 1, parts[2] || 1));
  dt.setUTCDate(dt.getUTCDate() + n);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function emptyChannel() {
  return { views: 0, uniques: 0, actions: 0 };
}

function emptyTraffic() {
  return { timezone: TZ, days: [], pages: [], sources: [] };
}

function emptyTrafficLog() {
  return {
    timezone: TZ,
    range: '30d',
    channel: 'both',
    totals: { visitors: 0, views: 0 },
    sources: [],
    visitors: []
  };
}

function channelOf(req, body) {
  const hinted = String((body && body.channel) || '').toLowerCase();
  if (hinted === 'store' || hinted === 'website') return hinted;
  try {
    if (require('./shop-store').isStoreHost(req)) return 'store';
  } catch (e) { /* ignore */ }
  const path = String((body && body.path) || req.path || '');
  if (path === '/store' || path.indexOf('/store/') === 0) return 'store';
  return 'website';
}

function normalizePath(raw) {
  let p = String(raw || '/').split('?')[0].split('#')[0].trim();
  if (!p) p = '/';
  if (p.charAt(0) !== '/') p = '/' + p;
  if (p.indexOf('/store/') === 0) p = p.slice(6) || '/';
  if (p === '/store') p = '/';
  if (p === '/index.html') p = '/';
  p = p.replace(/\/+$/, '') || '/';
  if (
    p.indexOf('/company') === 0 ||
    p.indexOf('/portal') === 0 ||
    p.indexOf('/api/') === 0 ||
    p === '/company.html' ||
    p === '/admin.html' ||
    p === '/portal.html'
  ) return '';
  return p.slice(0, 180);
}

function visitorHash(raw) {
  const id = String(raw || '').trim().slice(0, 80);
  if (!id || id.length < 8) return '';
  return crypto.createHash('sha256').update('sd-pageview:' + id).digest('hex').slice(0, 24);
}

function isAction(event) {
  return ACTION_EVENTS.indexOf(String(event || '').toLowerCase()) !== -1;
}

function isBot(req) {
  const ua = String((req.headers && req.headers['user-agent']) || '');
  if (!ua) return false;
  return BOT_UA.test(ua);
}

function cleanUtm(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '').slice(0, 40);
}

function parseReferrer(raw) {
  const s = String(raw || '').trim().slice(0, 500);
  if (!s) return { host: '', path: '' };
  try {
    const u = new URL(s);
    const host = String(u.hostname || '').toLowerCase();
    if (!host) return { host: '', path: '' };
    return { host: host, path: u.pathname || '/' };
  } catch (e) {
    return { host: '', path: '' };
  }
}

function ownKind(host, path) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  const p = String(path || '/') || '/';
  if (!h) return '';
  if (h === 'store.spectrumdisplay.com' || h.indexOf('store.') === 0) return 'store';
  if (h === 'spectrumdisplay.com') return 'website';
  if (h === 'localhost' || h === '127.0.0.1') {
    if (p === '/store' || p.indexOf('/store/') === 0) return 'store';
    return 'website';
  }
  return '';
}

function hostLabel(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  if (!h) return '';
  if (/(^|\.)google\./.test(h) || h === 'google.com' || h.endsWith('.google.com')) return 'Google';
  if (h.indexOf('facebook.com') !== -1 || h === 'fb.com' || h.endsWith('.fb.com') || h.indexOf('fbclid') !== -1) return 'Facebook';
  if (h.indexOf('instagram.com') !== -1) return 'Instagram';
  if (h.indexOf('bing.com') !== -1) return 'Bing';
  if (h.indexOf('youtube.com') !== -1 || h === 'youtu.be') return 'YouTube';
  if (h.indexOf('linkedin.com') !== -1 || h === 'lnkd.in') return 'LinkedIn';
  if (h === 'x.com' || h === 't.co' || h.indexOf('twitter.com') !== -1) return 'X';
  if (h.indexOf('yahoo.') !== -1) return 'Yahoo';
  if (h.indexOf('duckduckgo.com') !== -1) return 'DuckDuckGo';
  return h.slice(0, 80);
}

function prettyUtm(utm) {
  if (UTM_LABELS[utm]) return UTM_LABELS[utm];
  if (!utm) return '';
  return utm.charAt(0).toUpperCase() + utm.slice(1);
}

function classifySource(opts) {
  const src = opts || {};
  const channel = src.channel === 'store' ? 'store' : 'website';
  const utm = cleanUtm(src.utmSource);
  if (utm) return prettyUtm(utm);
  const host = String(src.referrerHost || '').toLowerCase();
  const path = String(src.referrerPath || '/') || '/';
  const from = ownKind(host, path);
  if (from) {
    if (from === channel) return 'Direct';
    if (from === 'website' && channel === 'store') return 'Website → Store';
    if (from === 'store' && channel === 'website') return 'Store → Website';
  }
  const named = hostLabel(host);
  if (named) return named;
  return 'Direct';
}

function parseRange(raw) {
  const key = String(raw || '30d').toLowerCase();
  if (key === '1d' || key === 'today') return { key: '1d', start: dayStamp() };
  if (key === '7d') return { key: '7d', start: addDays(dayStamp(), -6) };
  return { key: '30d', start: addDays(dayStamp(), -29) };
}

function parseChannelFilter(raw) {
  const key = String(raw || 'both').toLowerCase();
  if (key === 'website' || key === 'store') return key;
  return 'both';
}

function parseHit(req, body) {
  const src = body && typeof body === 'object' ? body : {};
  const event = String(src.event || 'pageview').toLowerCase().slice(0, 40);
  const action = isAction(event);
  const path = action ? '' : normalizePath(src.path || '');
  if (!action && !path) return null;
  const headerRef = req && typeof req.get === 'function' ? req.get('referer') : '';
  const ref = parseReferrer(src.referrer || src.referer || headerRef || '');
  const channel = channelOf(req, src);
  const utmSource = cleanUtm(src.utm_source || src.utmSource);
  return {
    day: dayStamp(),
    channel: channel,
    path: path,
    visitorHash: visitorHash(src.visitor),
    action: action,
    referrerHost: String(ref.host || '').slice(0, 120),
    source: classifySource({
      referrerHost: ref.host,
      referrerPath: ref.path,
      utmSource: utmSource,
      channel: channel
    })
  };
}

function ensureSqlite(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_pageview_daily (
      day TEXT NOT NULL,
      channel TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 0,
      uniques INTEGER NOT NULL DEFAULT 0,
      actions INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, channel)
    );
    CREATE TABLE IF NOT EXISTS site_pageview_visitors (
      day TEXT NOT NULL,
      channel TEXT NOT NULL,
      visitor_hash TEXT NOT NULL,
      PRIMARY KEY (day, channel, visitor_hash)
    );
    CREATE TABLE IF NOT EXISTS site_pageview_paths (
      day TEXT NOT NULL,
      channel TEXT NOT NULL,
      path TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, channel, path)
    );
    CREATE TABLE IF NOT EXISTS site_pageview_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      day TEXT NOT NULL,
      channel TEXT NOT NULL,
      visitor_hash TEXT NOT NULL DEFAULT '',
      path TEXT NOT NULL DEFAULT '',
      referrer_host TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'Direct'
    );
    CREATE INDEX IF NOT EXISTS site_pageview_daily_day_idx ON site_pageview_daily (day);
    CREATE INDEX IF NOT EXISTS site_pageview_paths_day_idx ON site_pageview_paths (day, channel, views);
    CREATE INDEX IF NOT EXISTS site_pageview_events_day_idx ON site_pageview_events (day, channel);
    CREATE INDEX IF NOT EXISTS site_pageview_events_visitor_idx ON site_pageview_events (visitor_hash, created_at);
    CREATE INDEX IF NOT EXISTS site_pageview_events_source_idx ON site_pageview_events (day, source);
  `);
}

function pruneSqliteEvents(db) {
  const cutoff = addDays(dayStamp(), -EVENT_KEEP_DAYS);
  db.prepare('DELETE FROM site_pageview_events WHERE day < ?').run(cutoff);
}

function recordSqlite(db, hit) {
  ensureSqlite(db);
  db.exec('BEGIN');
  try {
    if (hit.action) {
      db.prepare(`
        INSERT INTO site_pageview_daily (day, channel, views, uniques, actions)
        VALUES (?, ?, 0, 0, 1)
        ON CONFLICT(day, channel) DO UPDATE SET actions = actions + 1
      `).run(hit.day, hit.channel);
      db.exec('COMMIT');
      return;
    }
    db.prepare(`
      INSERT INTO site_pageview_daily (day, channel, views, uniques, actions)
      VALUES (?, ?, 1, 0, 0)
      ON CONFLICT(day, channel) DO UPDATE SET views = views + 1
    `).run(hit.day, hit.channel);
    if (hit.visitorHash) {
      const ins = db.prepare(`
        INSERT OR IGNORE INTO site_pageview_visitors (day, channel, visitor_hash)
        VALUES (?, ?, ?)
      `).run(hit.day, hit.channel, hit.visitorHash);
      if (ins.changes) {
        db.prepare(`
          UPDATE site_pageview_daily SET uniques = uniques + 1
          WHERE day = ? AND channel = ?
        `).run(hit.day, hit.channel);
      }
    }
    if (hit.path) {
      db.prepare(`
        INSERT INTO site_pageview_paths (day, channel, path, views)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(day, channel, path) DO UPDATE SET views = views + 1
      `).run(hit.day, hit.channel, hit.path);
      db.prepare(`
        INSERT INTO site_pageview_events
          (created_at, day, channel, visitor_hash, path, referrer_host, source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        new Date().toISOString(),
        hit.day,
        hit.channel,
        hit.visitorHash || '',
        hit.path,
        hit.referrerHost || '',
        hit.source || 'Direct'
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
    throw err;
  }
  try { pruneSqliteEvents(db); } catch (e) { /* ignore */ }
}

function fillDays(rows) {
  const today = dayStamp();
  const start = addDays(today, -(TRAFFIC_DAYS - 1));
  const byDay = {};
  (rows || []).forEach(function (row) {
    const day = row.day || row.Day;
    const channel = row.channel || row.Channel;
    if (!day || CHANNELS.indexOf(channel) === -1) return;
    if (!byDay[day]) {
      byDay[day] = { day: day, website: emptyChannel(), store: emptyChannel() };
    }
    byDay[day][channel] = {
      views: Number(row.views) || 0,
      uniques: Number(row.uniques) || 0,
      actions: Number(row.actions) || 0
    };
  });
  const days = [];
  let cursor = start;
  while (cursor <= today) {
    days.push(byDay[cursor] || { day: cursor, website: emptyChannel(), store: emptyChannel() });
    cursor = addDays(cursor, 1);
  }
  return days;
}

function mapPages(rows) {
  return (rows || []).map(function (row) {
    return {
      day: row.day,
      channel: row.channel,
      path: row.path,
      views: Number(row.views) || 0
    };
  });
}

function mapSources(rows) {
  return (rows || []).map(function (row) {
    return {
      day: row.day,
      channel: row.channel,
      source: row.source || 'Direct',
      views: Number(row.views) || 0,
      visitors: Number(row.visitors) || 0
    };
  });
}

function sqliteTraffic(db) {
  ensureSqlite(db);
  const start = addDays(dayStamp(), -(TRAFFIC_DAYS - 1));
  let daily = [];
  let pages = [];
  let sources = [];
  try {
    daily = db.prepare(
      'SELECT day, channel, views, uniques, actions FROM site_pageview_daily WHERE day >= ? ORDER BY day ASC'
    ).all(start);
    pages = db.prepare(
      'SELECT day, channel, path, views FROM site_pageview_paths WHERE day >= ? ORDER BY views DESC LIMIT 4000'
    ).all(start);
    sources = db.prepare(`
      SELECT day, channel, source, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
      FROM site_pageview_events
      WHERE day >= ?
      GROUP BY day, channel, source
    `).all(start);
  } catch (e) {
    return emptyTraffic();
  }
  return {
    timezone: TZ,
    days: fillDays(daily),
    pages: mapPages(pages),
    sources: mapSources(sources)
  };
}

function channelWhere(channel) {
  if (channel === 'website' || channel === 'store') {
    return { sql: ' AND channel = ?', args: [channel] };
  }
  return { sql: '', args: [] };
}

function visitorRowsFromHits(stats, hits) {
  const byHash = {};
  (hits || []).forEach(function (row) {
    const hash = row.visitor_hash || row.hash;
    if (!hash) return;
    if (!byHash[hash]) {
      byHash[hash] = {
        landing: row.path || '/',
        exit: row.path || '/',
        source: row.source || 'Direct',
        firstAt: row.created_at,
        lastAt: row.created_at,
        channels: {}
      };
    }
    const cur = byHash[hash];
    cur.channels[row.channel] = true;
    if (String(row.created_at || '') <= String(cur.firstAt || '')) {
      cur.firstAt = row.created_at;
      cur.landing = row.path || '/';
      cur.source = row.source || 'Direct';
    }
    if (String(row.created_at || '') >= String(cur.lastAt || '')) {
      cur.lastAt = row.created_at;
      cur.exit = row.path || '/';
    }
  });
  return (stats || []).map(function (row) {
    const extra = byHash[row.hash] || {};
    const channels = Object.keys(extra.channels || {});
    return {
      hash: row.hash,
      source: extra.source || 'Direct',
      firstAt: extra.firstAt || row.first_at,
      lastAt: extra.lastAt || row.last_at,
      landing: extra.landing || '/',
      exit: extra.exit || '/',
      pages: Number(row.pages) || 0,
      channels: channels.length ? channels : []
    };
  });
}

function sqliteTrafficLog(db, opts) {
  ensureSqlite(db);
  const range = parseRange(opts && opts.range);
  const channel = parseChannelFilter(opts && opts.channel);
  const ch = channelWhere(channel);
  const out = emptyTrafficLog();
  out.range = range.key;
  out.channel = channel;
  try {
    const totals = db.prepare(`
      SELECT COUNT(*) AS views, COUNT(DISTINCT CASE WHEN visitor_hash <> '' THEN visitor_hash END) AS visitors
      FROM site_pageview_events
      WHERE day >= ?${ch.sql}
    `).get(range.start, ...ch.args) || {};
    out.totals = {
      views: Number(totals.views) || 0,
      visitors: Number(totals.visitors) || 0
    };
    out.sources = db.prepare(`
      SELECT source, COUNT(*) AS views, COUNT(DISTINCT CASE WHEN visitor_hash <> '' THEN visitor_hash END) AS visitors
      FROM site_pageview_events
      WHERE day >= ?${ch.sql}
      GROUP BY source
      ORDER BY visitors DESC, views DESC
    `).all(range.start, ...ch.args).map(function (row) {
      return {
        source: row.source || 'Direct',
        views: Number(row.views) || 0,
        visitors: Number(row.visitors) || 0
      };
    });
    const stats = db.prepare(`
      SELECT visitor_hash AS hash, MIN(created_at) AS first_at, MAX(created_at) AS last_at, COUNT(*) AS pages
      FROM site_pageview_events
      WHERE day >= ? AND visitor_hash <> ''${ch.sql}
      GROUP BY visitor_hash
      ORDER BY last_at DESC
      LIMIT ?
    `).all(range.start, ...ch.args, VISITOR_LOG_LIMIT);
    let hits = [];
    if (stats.length) {
      const placeholders = stats.map(function () { return '?'; }).join(',');
      hits = db.prepare(`
        SELECT visitor_hash, path, source, channel, created_at
        FROM site_pageview_events
        WHERE day >= ? AND visitor_hash IN (${placeholders})${ch.sql}
        ORDER BY created_at ASC
      `).all(range.start, ...stats.map(function (row) { return row.hash; }), ...ch.args);
    }
    out.visitors = visitorRowsFromHits(stats, hits);
  } catch (e) {
    return out;
  }
  return out;
}

function sqliteVisitorEvents(db, hash, opts) {
  ensureSqlite(db);
  const range = parseRange(opts && opts.range);
  const channel = parseChannelFilter(opts && opts.channel);
  const ch = channelWhere(channel);
  const id = String(hash || '').toLowerCase();
  const empty = { hash: id, range: range.key, channel: channel, source: 'Direct', events: [] };
  if (!/^[a-f0-9]{24}$/.test(id)) return empty;
  try {
    const rows = db.prepare(`
      SELECT created_at, channel, path, source, referrer_host
      FROM site_pageview_events
      WHERE visitor_hash = ? AND day >= ?${ch.sql}
      ORDER BY created_at ASC
      LIMIT ?
    `).all(id, range.start, ...ch.args, VISITOR_EVENT_LIMIT);
    const events = (rows || []).map(function (row) {
      return {
        at: row.created_at,
        channel: row.channel,
        path: row.path || '/',
        source: row.source || 'Direct',
        referrerHost: row.referrer_host || ''
      };
    });
    return {
      hash: id,
      range: range.key,
      channel: channel,
      source: (events[0] && events[0].source) || 'Direct',
      events: events
    };
  } catch (e) {
    return empty;
  }
}

function sqliteApi(db) {
  ensureSqlite(db);
  return {
    async recordSitePageview(hit) {
      recordSqlite(db, hit);
      return { ok: true };
    },
    async getSiteTraffic() {
      return sqliteTraffic(db);
    },
    async getSiteTrafficLog(opts) {
      return sqliteTrafficLog(db, opts);
    },
    async getSiteVisitorEvents(hash, opts) {
      return sqliteVisitorEvents(db, hash, opts);
    }
  };
}

function aggregateSourceDays(rows) {
  const byKey = {};
  (rows || []).forEach(function (row) {
    const day = row.day;
    const channel = row.channel;
    const source = row.source || 'Direct';
    if (!day || CHANNELS.indexOf(channel) === -1) return;
    const key = day + '\0' + channel + '\0' + source;
    if (!byKey[key]) {
      byKey[key] = { day: day, channel: channel, source: source, views: 0, visitors: {} };
    }
    byKey[key].views += 1;
    if (row.visitor_hash) byKey[key].visitors[row.visitor_hash] = true;
  });
  return Object.keys(byKey).map(function (key) {
    const row = byKey[key];
    return {
      day: row.day,
      channel: row.channel,
      source: row.source,
      views: row.views,
      visitors: Object.keys(row.visitors).length
    };
  });
}

function supabaseTrafficLog(rows, opts) {
  const range = parseRange(opts && opts.range);
  const channel = parseChannelFilter(opts && opts.channel);
  const out = emptyTrafficLog();
  out.range = range.key;
  out.channel = channel;
  const events = (rows || []).filter(function (row) {
    if (String(row.day || '') < range.start) return false;
    if (channel !== 'both' && row.channel !== channel) return false;
    return true;
  });
  const visitorSet = {};
  const sourceMap = {};
  const people = {};
  events.forEach(function (row) {
    const hash = row.visitor_hash || '';
    const source = row.source || 'Direct';
    if (!sourceMap[source]) sourceMap[source] = { source: source, views: 0, visitors: {} };
    sourceMap[source].views += 1;
    if (hash) {
      visitorSet[hash] = true;
      sourceMap[source].visitors[hash] = true;
      if (!people[hash]) {
        people[hash] = {
          hash: hash,
          source: source,
          firstAt: row.created_at,
          lastAt: row.created_at,
          landing: row.path || '/',
          exit: row.path || '/',
          pages: 0,
          channels: {}
        };
      }
      const v = people[hash];
      v.pages += 1;
      v.channels[row.channel] = true;
      if (String(row.created_at || '') <= String(v.firstAt || '')) {
        v.firstAt = row.created_at;
        v.landing = row.path || '/';
        v.source = source;
      }
      if (String(row.created_at || '') >= String(v.lastAt || '')) {
        v.lastAt = row.created_at;
        v.exit = row.path || '/';
      }
    }
  });
  out.totals = { views: events.length, visitors: Object.keys(visitorSet).length };
  out.sources = Object.keys(sourceMap).map(function (key) {
    const row = sourceMap[key];
    return { source: row.source, views: row.views, visitors: Object.keys(row.visitors).length };
  }).sort(function (a, b) {
    return b.visitors - a.visitors || b.views - a.views;
  });
  out.visitors = Object.keys(people).map(function (hash) {
    const row = people[hash];
    return {
      hash: row.hash,
      source: row.source,
      firstAt: row.firstAt,
      lastAt: row.lastAt,
      landing: row.landing,
      exit: row.exit,
      pages: row.pages,
      channels: Object.keys(row.channels)
    };
  }).sort(function (a, b) {
    return String(b.lastAt || '').localeCompare(String(a.lastAt || ''));
  }).slice(0, VISITOR_LOG_LIMIT);
  return out;
}

function supabaseApi(supabase) {
  return {
    async recordSitePageview(hit) {
      const args = {
        p_day: hit.day,
        p_channel: hit.channel,
        p_path: hit.path || '',
        p_visitor: hit.visitorHash || '',
        p_action: !!hit.action,
        p_source: hit.source || 'Direct',
        p_referrer: hit.referrerHost || ''
      };
      let { error } = await supabase.rpc('record_site_pageview', args);
      if (error && /p_source|p_referrer|PGRST202|could not find the function/i.test(error.message || '')) {
        const retry = await supabase.rpc('record_site_pageview', {
          p_day: args.p_day,
          p_channel: args.p_channel,
          p_path: args.p_path,
          p_visitor: args.p_visitor,
          p_action: args.p_action
        });
        error = retry.error;
      }
      if (error) throw new Error(error.message || 'Could not record page view.');
      return { ok: true };
    },
    async getSiteTraffic() {
      const start = addDays(dayStamp(), -(TRAFFIC_DAYS - 1));
      const [daily, pages, events] = await Promise.all([
        supabase.from('site_pageview_daily')
          .select('day, channel, views, uniques, actions')
          .gte('day', start)
          .order('day', { ascending: true }),
        supabase.from('site_pageview_paths')
          .select('day, channel, path, views')
          .gte('day', start)
          .order('views', { ascending: false })
          .limit(4000),
        supabase.from('site_pageview_events')
          .select('day, channel, source, visitor_hash')
          .gte('day', start)
          .limit(20000)
      ]);
      if (daily.error || pages.error) return emptyTraffic();
      return {
        timezone: TZ,
        days: fillDays(daily.data || []),
        pages: mapPages(pages.data || []),
        sources: events.error ? [] : aggregateSourceDays(events.data || [])
      };
    },
    async getSiteTrafficLog(opts) {
      const range = parseRange(opts && opts.range);
      const channel = parseChannelFilter(opts && opts.channel);
      let query = supabase.from('site_pageview_events')
        .select('created_at, day, channel, visitor_hash, path, source, referrer_host')
        .gte('day', range.start)
        .order('created_at', { ascending: true })
        .limit(20000);
      if (channel !== 'both') query = query.eq('channel', channel);
      const { data, error } = await query;
      if (error) return emptyTrafficLog();
      return supabaseTrafficLog(data || [], opts);
    },
    async getSiteVisitorEvents(hash, opts) {
      const range = parseRange(opts && opts.range);
      const channel = parseChannelFilter(opts && opts.channel);
      const id = String(hash || '').toLowerCase();
      const empty = { hash: id, range: range.key, channel: channel, source: 'Direct', events: [] };
      if (!/^[a-f0-9]{24}$/.test(id)) return empty;
      let query = supabase.from('site_pageview_events')
        .select('created_at, channel, path, source, referrer_host')
        .eq('visitor_hash', id)
        .gte('day', range.start)
        .order('created_at', { ascending: true })
        .limit(VISITOR_EVENT_LIMIT);
      if (channel !== 'both') query = query.eq('channel', channel);
      const { data, error } = await query;
      if (error) return empty;
      const events = (data || []).map(function (row) {
        return {
          at: row.created_at,
          channel: row.channel,
          path: row.path || '/',
          source: row.source || 'Direct',
          referrerHost: row.referrer_host || ''
        };
      });
      return {
        hash: id,
        range: range.key,
        channel: channel,
        source: (events[0] && events[0].source) || 'Direct',
        events: events
      };
    }
  };
}

const analyticsHits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (analyticsHits.get(ip) || []).filter(function (t) { return now - t < 60000; });
  if (list.length >= 40) {
    analyticsHits.set(ip, list);
    return true;
  }
  list.push(now);
  analyticsHits.set(ip, list);
  return false;
}

module.exports = {
  TZ,
  dayStamp,
  addDays,
  emptyTraffic,
  emptyTrafficLog,
  parseHit,
  parseRange,
  parseChannelFilter,
  classifySource,
  isBot,
  rateLimited,
  ensureSqlite,
  sqliteTraffic,
  sqliteApi,
  supabaseApi
};
