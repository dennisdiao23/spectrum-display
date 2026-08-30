const FALLBACK_URL = 'https://mzwgqbnfbfjczasvddan.supabase.co';
const FALLBACK_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16d2dxYm5mYmZqY3phc3ZkZGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Mjk4NzQsImV4cCI6MjEwMjUwNTg3NH0.dI9ufmZ9s_DuK0aFRdEX0ulYW5MbAsFBG3Tw4_0g3js';

function bearerToken(req) {
  const auth = String((req && req.headers && req.headers.authorization) || '');
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
}

async function roleFromBearer(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const url = String(process.env.SUPABASE_URL || FALLBACK_URL).replace(/\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY || FALLBACK_ANON;
  try {
    const userRes = await fetch(url + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: key }
    });
    if (!userRes.ok) return null;
    const user = await userRes.json();
    const uid = user && user.id;
    if (!uid) return null;
    const profRes = await fetch(
      url + '/rest/v1/profiles?id=eq.' + encodeURIComponent(uid) + '&select=role',
      {
        headers: {
          Authorization: 'Bearer ' + token,
          apikey: key,
          Accept: 'application/json'
        }
      }
    );
    if (!profRes.ok) return null;
    const rows = await profRes.json();
    const role = rows && rows[0] && rows[0].role;
    if (role === 'dealer' || role === 'sales') return role;
    return null;
  } catch {
    return null;
  }
}

function canSeeStock(role) {
  return role === 'dealer' || role === 'sales';
}

module.exports = { bearerToken, roleFromBearer, canSeeStock };
