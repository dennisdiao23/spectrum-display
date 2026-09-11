const crypto = require('crypto');

const TZ = 'America/Los_Angeles';
const CHANNELS = ['website', 'store'];
const ACTION_EVENTS = ['contact', 'dealer', 'add_to_cart'];
const TRAFFIC_DAYS = 60;
const BOT_UA = /bot|crawler|spider|crawling|lighthouse|pagespeed|pingdom|preview|slurp|facebookexternalhit|whatsapp|telegram|discordbot|embed/i;

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
  return { timezone: TZ, days: [], pages: [] };
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

function parseHit(req, body) {
  const src = body && typeof body === 'object' ? body : {};
  const event = String(src.event || 'pageview').toLowerCase().slice(0, 40);
  const action = isAction(event);
  const path = action ? '' : normalizePath(src.path || '');
  if (!action && !path) return null;
  return {
    day: dayStamp(),
    channel: channelOf(req, src),
    path: path,
    visitorHash: visitorHash(src.visitor),
    action: action
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
    CREATE INDEX IF NOT EXISTS site_pageview_daily_day_idx ON site_pageview_daily (day);
    CREATE INDEX IF NOT EXISTS site_pageview_paths_day_idx ON site_pageview_paths (day, channel, views);
  `);
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
    }
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
    throw err;
  }
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

function sqliteTraffic(db) {
  ensureSqlite(db);
  const start = addDays(dayStamp(), -(TRAFFIC_DAYS - 1));
  let daily = [];
  let pages = [];
  try {
    daily = db.prepare(
      'SELECT day, channel, views, uniques, actions FROM site_pageview_daily WHERE day >= ? ORDER BY day ASC'
    ).all(start);
    pages = db.prepare(
      'SELECT day, channel, path, views FROM site_pageview_paths WHERE day >= ? ORDER BY views DESC LIMIT 4000'
    ).all(start);
  } catch (e) {
    return emptyTraffic();
  }
  return {
    timezone: TZ,
    days: fillDays(daily),
    pages: (pages || []).map(function (row) {
      return {
        day: row.day,
        channel: row.channel,
        path: row.path,
        views: Number(row.views) || 0
      };
    })
  };
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
    }
  };
}

function supabaseApi(supabase) {
  return {
    async recordSitePageview(hit) {
      const { error } = await supabase.rpc('record_site_pageview', {
        p_day: hit.day,
        p_channel: hit.channel,
        p_path: hit.path || '',
        p_visitor: hit.visitorHash || '',
        p_action: !!hit.action
      });
      if (error) throw new Error(error.message || 'Could not record page view.');
      return { ok: true };
    },
    async getSiteTraffic() {
      const start = addDays(dayStamp(), -(TRAFFIC_DAYS - 1));
      const [daily, pages] = await Promise.all([
        supabase.from('site_pageview_daily')
          .select('day, channel, views, uniques, actions')
          .gte('day', start)
          .order('day', { ascending: true }),
        supabase.from('site_pageview_paths')
          .select('day, channel, path, views')
          .gte('day', start)
          .order('views', { ascending: false })
          .limit(4000)
      ]);
      if (daily.error || pages.error) return emptyTraffic();
      return {
        timezone: TZ,
        days: fillDays(daily.data || []),
        pages: (pages.data || []).map(function (row) {
          return {
            day: row.day,
            channel: row.channel,
            path: row.path,
            views: Number(row.views) || 0
          };
        })
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
  parseHit,
  isBot,
  rateLimited,
  ensureSqlite,
  sqliteTraffic,
  sqliteApi,
  supabaseApi
};
