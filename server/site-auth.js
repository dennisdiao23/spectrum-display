const FALLBACK_URL = 'https://mzwgqbnfbfjczasvddan.supabase.co';
const FALLBACK_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16d2dxYm5mYmZqY3phc3ZkZGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Mjk4NzQsImV4cCI6MjEwMjUwNTg3NH0.dI9ufmZ9s_DuK0aFRdEX0ulYW5MbAsFBG3Tw4_0g3js';

function bearerToken(req) {
  const auth = String((req && req.headers && req.headers.authorization) || '');
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
}

function supabaseAuthConfig() {
  return {
    url: String(process.env.SUPABASE_URL || FALLBACK_URL).replace(/\/$/, ''),
    key: process.env.SUPABASE_ANON_KEY || FALLBACK_ANON
  };
}

async function userFromBearer(req) {
  const token = bearerToken(req);
  if (!token || token.indexOf('wrb_') === 0) return null;
  const cfg = supabaseAuthConfig();
  try {
    const userRes = await fetch(cfg.url + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: cfg.key }
    });
    if (!userRes.ok) return null;
    const user = await userRes.json();
    const uid = user && user.id;
    if (!uid) return null;
    let role = 'customer';
    let name = (user.user_metadata && user.user_metadata.name) || '';
    let email = user.email || '';
    const profRes = await fetch(
      cfg.url + '/rest/v1/profiles?id=eq.' + encodeURIComponent(uid) + '&select=role,name,email',
      {
        headers: {
          Authorization: 'Bearer ' + token,
          apikey: cfg.key,
          Accept: 'application/json'
        }
      }
    );
    if (profRes.ok) {
      const rows = await profRes.json();
      const row = rows && rows[0];
      if (row) {
        if (row.role === 'dealer' || row.role === 'sales' || row.role === 'customer') role = row.role;
        if (row.name) name = row.name;
        if (row.email) email = row.email;
      }
    }
    return { id: uid, email: email, name: name, role: role };
  } catch {
    return null;
  }
}

async function roleFromBearer(req) {
  const user = await userFromBearer(req);
  if (!user) return null;
  if (user.role === 'dealer' || user.role === 'sales') return user.role;
  return null;
}

function canSeeStock(role) {
  return role === 'dealer' || role === 'sales';
}

module.exports = { bearerToken, userFromBearer, roleFromBearer, canSeeStock };
