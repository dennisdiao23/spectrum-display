function hasSupabase() {
  return !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
}

let storePromise = null;

async function getStore() {
  if (storePromise) return storePromise;
  storePromise = (async function () {
    if (hasSupabase()) {
      const { createSupabaseStore } = require('./store-supabase');
      const store = createSupabaseStore();
      if (store.ready) await store.ready;
      console.log('Database: Supabase');
      return store;
    }
    const { createSqliteStore } = require('./store-sqlite');
    const store = createSqliteStore();
    console.log('Database: local SQLite (add SUPABASE_URL to .env to use Supabase)');
    return store;
  })();
  return storePromise;
}

module.exports = { getStore, hasSupabase };
