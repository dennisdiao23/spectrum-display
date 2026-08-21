/**
 * Spectrum Display — customer auth via Supabase.
 * Projects and custom panels are stored online. Orders stay in this browser for now.
 */
(function (global) {
  const PROJECTS_KEY = 'spectrumProjects';
  const ORDERS_KEY = 'spectrumOrders';
  const CUSTOM_PANELS_KEY = 'spectrumCustomPanels';

  let cached = null;
  let projectsCache = [];
  let panelsCache = [];
  let ordersCache = [];
  let readyResolve;
  const ready = new Promise(function (resolve) { readyResolve = resolve; });

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }
  function write(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }
  function sb() {
    return global.spectrumSupabase;
  }
  function numOrNull(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function intOrNull(v) {
    const n = numOrNull(v);
    return n == null ? null : Math.round(n);
  }
  function mapProject(row) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    return Object.assign({}, payload, {
      id: row.id,
      savedAt: row.updated_at || row.created_at,
      brand: row.brand != null && row.brand !== '' ? row.brand : payload.brand,
      brandName: row.brand_name != null && row.brand_name !== '' ? row.brand_name : payload.brandName,
      series: row.series != null && row.series !== '' ? row.series : payload.series,
      seriesName: row.series_name != null && row.series_name !== '' ? row.series_name : payload.seriesName,
      pitch: row.pitch != null ? row.pitch : payload.pitch,
      width: row.width != null ? row.width : payload.width,
      height: row.height != null ? row.height : payload.height,
      cabinets: row.cabinets != null ? row.cabinets : payload.cabinets,
      designerUrl: row.designer_url || payload.designerUrl
    });
  }
  function mapPanel(row) {
    return {
      id: row.id,
      savedAt: row.updated_at || row.created_at,
      name: row.name,
      w: row.w,
      h: row.h,
      pitch: row.pitch,
      type: row.type || 'Custom',
      weight: row.weight,
      price: row.price,
      pavg: row.pavg,
      pmax: row.pmax
    };
  }
  function mapOrder(row) {
    return {
      id: row.public_id || row.id,
      dbId: row.id,
      date: row.date || (row.created_at || '').slice(0, 10),
      status: row.status || 'Processing',
      total: row.total || 0,
      items: row.items || [],
      note: row.note || ''
    };
  }
  async function refreshUserLists(userId) {
    const client = sb();
    if (!client || !userId) {
      projectsCache = [];
      panelsCache = [];
      ordersCache = [];
      return;
    }
    const [projRes, panelRes, orderRes] = await Promise.all([
      client.from('saved_projects').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      client.from('custom_panels').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      client.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    ]);
    projectsCache = (projRes.data || []).map(mapProject);
    panelsCache = (panelRes.data || []).map(mapPanel);
    ordersCache = (orderRes.data || []).map(mapOrder);
  }
  async function migrateLocalSaves(userId) {
    const flag = 'spectrumCloudMigrated:' + userId;
    if (localStorage.getItem(flag) === '1') return;
    const client = sb();
    if (!client || !userId) return;
    const allProjects = read(PROJECTS_KEY, {});
    const allPanels = read(CUSTOM_PANELS_KEY, {});
    const localProjects = allProjects[userId] || [];
    const localPanels = allPanels[userId] || [];
    if (!localProjects.length && !localPanels.length) {
      localStorage.setItem(flag, '1');
      return;
    }
    for (let i = 0; i < localProjects.length; i++) {
      const project = localProjects[i];
      const payload = Object.assign({}, project);
      delete payload.id;
      await client.from('saved_projects').insert({
        user_id: userId,
        brand: project.brand || '',
        brand_name: project.brandName || '',
        series: project.series || '',
        series_name: project.seriesName || '',
        pitch: numOrNull(project.pitch),
        width: numOrNull(project.width),
        height: numOrNull(project.height),
        cabinets: intOrNull(project.cabinets),
        designer_url: project.designerUrl || '',
        payload: payload
      });
    }
    for (let i = 0; i < localPanels.length; i++) {
      const panel = localPanels[i];
      const name = String((panel && panel.name) || '').trim() || 'Custom Panel';
      const row = {
        user_id: userId,
        name: name,
        w: numOrNull(panel.w),
        h: numOrNull(panel.h),
        pitch: numOrNull(panel.pitch),
        type: panel.type || 'Custom',
        weight: numOrNull(panel.weight),
        price: numOrNull(panel.price),
        pavg: numOrNull(panel.pavg),
        pmax: numOrNull(panel.pmax)
      };
      const { error } = await client.from('custom_panels').insert(row);
      if (error && /duplicate|unique/i.test(error.message || '')) {
        await client.from('custom_panels').update(row).eq('user_id', userId).filter('name', 'ilike', name.replace(/[%_]/g, ''));
      }
    }
    if (allProjects[userId]) {
      delete allProjects[userId];
      write(PROJECTS_KEY, allProjects);
    }
    if (allPanels[userId]) {
      delete allPanels[userId];
      write(CUSTOM_PANELS_KEY, allPanels);
    }
    localStorage.setItem(flag, '1');
  }
  function friendlyError(err) {
    const msg = (err && err.message) || 'Something went wrong.';
    if (/invalid login/i.test(msg)) return 'Invalid email or password.';
    if (/already registered/i.test(msg)) return 'An account with this email already exists. Please sign in.';
    if (/email not confirmed/i.test(msg)) return 'Check your email to confirm your account, then sign in.';
    if (/signups not allowed/i.test(msg)) return 'New accounts are temporarily closed.';
    if (/database error saving new user/i.test(msg)) return 'Could not create the account. Please try again or use email.';
    return msg;
  }

  function normalizeRole(role) {
    if (role === 'dealer' || role === 'sales') return role;
    return 'customer';
  }
  function roleLabel(role) {
    const r = normalizeRole(role);
    if (r === 'dealer') return 'Dealer / Integrator';
    if (r === 'sales') return 'Sales';
    return 'Customer';
  }
  function sessionFrom(user, profile) {
    if (!user) return null;
    const meta = user.user_metadata || {};
    return {
      id: user.id,
      email: user.email,
      name: (profile && profile.name) || meta.name || (user.email || '').split('@')[0],
      role: normalizeRole(profile && profile.role),
      provider: (user.app_metadata && user.app_metadata.provider) || 'email',
      company: (profile && profile.company) || '',
      phone: (profile && profile.phone) || '',
      createdAt: user.created_at
    };
  }

  async function loadProfile(user) {
    const client = sb();
    if (!client) return null;
    const { data } = await client.from('profiles').select('id, email, name, role, company, phone, created_at').eq('id', user.id).maybeSingle();
    if (data) return data;
    const meta = user.user_metadata || {};
    const row = {
      id: user.id,
      email: user.email,
      name: meta.name || (user.email || '').split('@')[0],
      role: 'customer',
      company: '',
      phone: ''
    };
    await client.from('profiles').upsert(row);
    return row;
  }

  async function refreshPricing() {
    const client = sb();
    if (!global.SpectrumPricing) return;
    if (!client || !cached) {
      SpectrumPricing.setMultiplier(1);
      return;
    }
    try {
      const { data, error } = await client.rpc('my_price_multiplier');
      if (error) throw error;
      SpectrumPricing.setMultiplier(data);
    } catch (e) {
      SpectrumPricing.setMultiplier(1);
    }
  }

  async function setUser(user) {
    if (!user) {
      cached = null;
      projectsCache = [];
      panelsCache = [];
      ordersCache = [];
      await refreshPricing();
      return;
    }
    const profile = await loadProfile(user);
    cached = sessionFrom(user, profile);
    await migrateLocalSaves(user.id);
    await refreshUserLists(user.id);
    await refreshPricing();
  }

  async function boot() {
    try {
      await (global.spectrumSupabaseReady || Promise.resolve());
      const client = sb();
      if (!client) {
        readyResolve();
        return;
      }
      const { data } = await client.auth.getSession();
      await setUser(data.session && data.session.user);
      client.auth.onAuthStateChange(function (_event, session) {
        setUser(session && session.user).then(function () {
          global.dispatchEvent(new CustomEvent('spectrum:auth'));
        });
      });
    } catch (e) {
      console.error(e);
    }
    readyResolve();
    global.dispatchEvent(new CustomEvent('spectrum:auth'));
  }
  boot();

  const Auth = {
    ready: ready,
    getSession: function () { return cached; },
    isLoggedIn: function () { return !!cached; },
    getFullProfile: function () { return cached; },
    logout: async function () {
      const client = sb();
      if (client) await client.auth.signOut();
      cached = null;
      projectsCache = [];
      panelsCache = [];
      ordersCache = [];
      if (global.SpectrumPricing) SpectrumPricing.setMultiplier(1);
      global.dispatchEvent(new CustomEvent('spectrum:auth'));
    },
    normalizeRole: normalizeRole,
    roleLabel: roleLabel,
    canUsePreviewTools: function () {
      const role = cached && cached.role;
      return role === 'dealer' || role === 'sales';
    },
    register: async function ({ email, password, name }) {
      email = (email || '').trim().toLowerCase();
      if (!email || !password || password.length < 6) {
        return { ok: false, error: 'Email and password (min 6 characters) required.' };
      }
      const client = sb();
      if (!client) return { ok: false, error: 'Sign-in is unavailable. Start the site with npm start.' };
      const { data, error } = await client.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: global.location.origin + '/account.html',
          data: {
            name: (name || email.split('@')[0]).trim()
          }
        }
      });
      if (error) return { ok: false, error: friendlyError(error) };
      if (!data.session) {
        return {
          ok: true,
          needsConfirm: true,
          error: 'Account created. Check your email to confirm, then sign in.'
        };
      }
      await setUser(data.user);
      global.dispatchEvent(new CustomEvent('spectrum:auth'));
      return { ok: true, user: cached };
    },
    login: async function ({ email, password }) {
      email = (email || '').trim().toLowerCase();
      const client = sb();
      if (!client) return { ok: false, error: 'Sign-in is unavailable. Start the site with npm start.' };
      const { data, error } = await client.auth.signInWithPassword({ email: email, password: password });
      if (error) return { ok: false, error: friendlyError(error) };
      await setUser(data.user);
      global.dispatchEvent(new CustomEvent('spectrum:auth'));
      return { ok: true, user: cached };
    },
    loginWithGoogle: async function () {
      const client = sb();
      if (!client) return { ok: false, error: 'Sign-in is unavailable.' };
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: global.location.origin + '/account.html' }
      });
      if (error) {
        return { ok: false, error: 'Google sign-in is not connected yet. Use email for now.' };
      }
      return { ok: true, redirect: true };
    },
    loginWithGoogleDemo: async function () {
      return this.loginWithGoogle();
    },
    updateProfile: async function (updates) {
      if (!cached) return { ok: false, error: 'Not signed in.' };
      const client = sb();
      const patch = { updated_at: new Date().toISOString() };
      if (updates.name != null) patch.name = String(updates.name).trim();
      if (updates.company != null) patch.company = String(updates.company).trim();
      if (updates.phone != null) patch.phone = String(updates.phone).trim();
      const { error } = await client.from('profiles').update(patch).eq('id', cached.id);
      if (error) return { ok: false, error: friendlyError(error) };
      if (patch.name) {
        await client.auth.updateUser({ data: { name: patch.name } });
      }
      cached = Object.assign({}, cached, patch);
      global.dispatchEvent(new CustomEvent('spectrum:auth'));
      return { ok: true, user: cached };
    },
    listProjects: function () { return projectsCache.slice(); },
    saveProject: async function (project) {
      const session = this.getSession();
      if (!session) return { ok: false, error: 'Please sign in to save projects.' };
      const client = sb();
      if (!client) return { ok: false, error: 'Sign-in is unavailable.' };
      const payload = Object.assign({}, project);
      delete payload.id;
      delete payload.savedAt;
      const { data, error } = await client.from('saved_projects').insert({
        user_id: session.id,
        brand: project.brand || '',
        brand_name: project.brandName || '',
        series: project.series || '',
        series_name: project.seriesName || '',
        pitch: numOrNull(project.pitch),
        width: numOrNull(project.width),
        height: numOrNull(project.height),
        cabinets: intOrNull(project.cabinets),
        designer_url: project.designerUrl || '',
        payload: payload
      }).select('*').single();
      if (error) return { ok: false, error: friendlyError(error) };
      const item = mapProject(data);
      projectsCache.unshift(item);
      if (projectsCache.length > 50) {
        const extra = projectsCache.slice(50);
        await client.from('saved_projects').delete().in('id', extra.map(function (p) { return p.id; }));
        projectsCache = projectsCache.slice(0, 50);
      }
      return { ok: true, project: item };
    },
    deleteProject: async function (projectId) {
      const session = this.getSession();
      if (!session) return { ok: false };
      const client = sb();
      if (!client) return { ok: false };
      const { error } = await client.from('saved_projects').delete().eq('id', projectId);
      if (error) return { ok: false, error: friendlyError(error) };
      projectsCache = projectsCache.filter(function (p) { return p.id !== projectId; });
      return { ok: true };
    },
    listCustomPanels: function () { return panelsCache.slice(); },
    saveCustomPanel: async function (panel) {
      const session = this.getSession();
      if (!session) return { ok: false, error: 'Please sign in to save custom panels.' };
      const client = sb();
      if (!client) return { ok: false, error: 'Sign-in is unavailable.' };
      const name = String((panel && panel.name) || '').trim() || 'Custom Panel';
      const row = {
        user_id: session.id,
        name: name,
        w: numOrNull(panel.w),
        h: numOrNull(panel.h),
        pitch: numOrNull(panel.pitch),
        type: panel.type || 'Custom',
        weight: numOrNull(panel.weight),
        price: numOrNull(panel.price),
        pavg: numOrNull(panel.pavg),
        pmax: numOrNull(panel.pmax)
      };
      const nameKey = name.toLowerCase();
      const existing = panelsCache.find(function (p) {
        return (p.name || '').trim().toLowerCase() === nameKey;
      });
      let data;
      let error;
      if (existing) {
        const res = await client.from('custom_panels').update(row).eq('id', existing.id).select('*').single();
        data = res.data;
        error = res.error;
      } else {
        const res = await client.from('custom_panels').insert(row).select('*').single();
        data = res.data;
        error = res.error;
      }
      if (error) return { ok: false, error: friendlyError(error) };
      const item = mapPanel(data);
      panelsCache = [item].concat(panelsCache.filter(function (p) { return p.id !== item.id; }));
      if (panelsCache.length > 40) {
        const extra = panelsCache.slice(40);
        await client.from('custom_panels').delete().in('id', extra.map(function (p) { return p.id; }));
        panelsCache = panelsCache.slice(0, 40);
      }
      return { ok: true, panel: item };
    },
    deleteCustomPanel: async function (panelId) {
      const session = this.getSession();
      if (!session) return { ok: false };
      const client = sb();
      if (!client) return { ok: false };
      const { error } = await client.from('custom_panels').delete().eq('id', panelId);
      if (error) return { ok: false, error: friendlyError(error) };
      panelsCache = panelsCache.filter(function (p) { return p.id !== panelId; });
      return { ok: true };
    },
    listOrders: function () {
      if (ordersCache.length) return ordersCache.slice();
      const session = this.getSession();
      if (!session) return [];
      const all = read(ORDERS_KEY, {});
      return (all[session.id] || []).slice().sort(function (a, b) {
        return (b.date || '').localeCompare(a.date || '');
      });
    },
    createOrder: async function ({ items, total, note }) {
      const session = this.getSession();
      if (!session) return { ok: false, error: 'Please sign in to place an order.' };
      if (!items || !items.length) return { ok: false, error: 'Cart is empty.' };
      const order = {
        id: 'ORD-' + Math.floor(10000 + Math.random() * 89999),
        date: new Date().toISOString().slice(0, 10),
        status: 'Processing',
        total: Math.round(total || items.reduce(function (s, i) { return s + (i.price || 0) * (i.qty || 1); }, 0)),
        items: items.map(function (i) {
          return { name: i.name, qty: i.qty, unit: i.unit || 'm²', price: i.price };
        }),
        note: note || 'Placed from website cart'
      };
      const all = read(ORDERS_KEY, {});
      const list = all[session.id] || [];
      list.unshift(order);
      all[session.id] = list;
      write(ORDERS_KEY, all);
      const client = sb();
      if (client) {
        const { data, error } = await client.from('orders').insert({
          user_id: session.id,
          public_id: order.id,
          date: order.date,
          status: order.status,
          total: order.total,
          items: order.items,
          note: order.note
        }).select('*').single();
        if (!error && data) {
          ordersCache.unshift(mapOrder(data));
        } else if (error) {
          console.warn('Could not store order online:', error.message || error);
        }
      }
      return { ok: true, order: order };
    }
  };

  global.SpectrumAuth = Auth;
})(typeof window !== 'undefined' ? window : globalThis);
