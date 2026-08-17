/**
 * Public Supabase client (anon key is safe in the browser).
 */
(function (global) {
  var fallbackUrl = 'https://mzwgqbnfbfjczasvddan.supabase.co';
  var fallbackAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16d2dxYm5mYmZqY3phc3ZkZGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Mjk4NzQsImV4cCI6MjEwMjUwNTg3NH0.dI9ufmZ9s_DuK0aFRdEX0ulYW5MbAsFBG3Tw4_0g3js';

  function makeClient(url, key) {
    if (!global.supabase || !global.supabase.createClient) {
      console.error('Supabase library failed to load');
      return null;
    }
    return global.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  global.spectrumSupabaseReady = fetch('/api/config', { headers: { Accept: 'application/json' } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      var url = (data && data.supabaseUrl) || fallbackUrl;
      var key = (data && data.supabaseAnonKey) || fallbackAnon;
      global.spectrumSupabase = makeClient(url, key);
      return global.spectrumSupabase;
    })
    .catch(function () {
      global.spectrumSupabase = makeClient(fallbackUrl, fallbackAnon);
      return global.spectrumSupabase;
    });
})(window);
