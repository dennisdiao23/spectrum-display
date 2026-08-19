/**
 * Spectrum Display — header (Sign in / Language hover menus)
 * Header markup is static in HTML so it never jumps on load.
 */
(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function canHover() {
    return window.matchMedia && window.matchMedia('(hover: hover)').matches;
  }

  function closeAll(except) {
    $all('.site-drop.is-open').forEach(function (el) {
      if (el !== except) el.classList.remove('is-open');
    });
  }

  function bindDrop(wrap) {
    if (!wrap) return;
    var btn = wrap.querySelector('.site-util');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      if (canHover()) return;
      e.preventDefault();
      e.stopPropagation();
      var open = wrap.classList.contains('is-open');
      closeAll();
      if (!open) wrap.classList.add('is-open');
    });
  }

  function applyAuth() {
    var header = $('.site-header');
    if (!header) return;
    var session = window.SpectrumAuth && SpectrumAuth.getSession && SpectrumAuth.getSession();
    header.classList.toggle('is-logged-in', !!session);
    var name = session ? (session.name || session.email || '') : '';
    var nameEl = $('#hdr-user-name');
    var namePanel = $('#hdr-user-name-panel');
    var roleEl = $('#hdr-user-role');
    if (nameEl) nameEl.textContent = name;
    if (namePanel) namePanel.textContent = name;
    if (roleEl) {
      roleEl.textContent = session
        ? (session.role === 'dealer' ? 'Dealer / Integrator' : 'Customer / End user')
        : '';
    }
  }

  function applyLangLabel() {
    var label = $('#hdr-lang-label');
    var lang = (window.SpectrumI18n && SpectrumI18n.lang) || localStorage.getItem('spectrumLang') || 'en';
    var names = { en: 'English', es: 'Español', fr: 'Français', ko: '한국어', ja: '日本語', zh: '中文' };
    if (label) label.textContent = names[lang] || 'English';
    $all('[data-set-lang]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-set-lang') === lang);
    });
  }

  function icon(path) {
    return '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>';
  }

  function injectTabbar() {
    if ($('#site-tabbar') || !document.body) return;
    var nav = document.createElement('nav');
    nav.className = 'site-tabbar';
    nav.id = 'site-tabbar';
    nav.setAttribute('aria-label', 'Main');
    nav.innerHTML =
      '<a href="index.html" data-tab="home">' +
        icon('<path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 01-1.5 1.5H14v-6H10v6H4.5A1.5 1.5 0 013 20V10.5z"/>') +
        '<span data-i18n="nav.home">Home</span></a>' +
      '<a href="products.html" data-tab="products">' +
        icon('<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 4.5h6v6h-6v-6zm9 0h6v6h-6v-6zm-9 9h6v6h-6v-6zm9 0h6v6h-6v-6z"/>') +
        '<span data-i18n="nav.products">Products</span></a>' +
      '<a href="designer.html" data-tab="designer">' +
        icon('<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM16.862 4.487L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>') +
        '<span data-i18n="nav.tabDesigner">Calculator</span></a>' +
      '<a href="account.html" data-tab="account">' +
        icon('<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0"/>') +
        '<span data-i18n="nav.account">Account</span></a>';
    document.body.appendChild(nav);

    var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var tab = '';
    if (!file || file === 'index.html') tab = 'home';
    else if (file === 'products.html' || file === 'product.html') tab = 'products';
    else if (file === 'designer.html') tab = 'designer';
    else if (file === 'account.html') tab = 'account';
    $all('[data-tab]', nav).forEach(function (a) {
      var on = tab && a.getAttribute('data-tab') === tab;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function boot() {
    injectTabbar();
    var header = $('.site-header');
    if (!header) return;

    bindDrop($('#hdr-signin-drop'));
    bindDrop($('#hdr-lang-drop'));

    $all('[data-set-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var code = btn.getAttribute('data-set-lang');
        if (window.SpectrumI18n && SpectrumI18n.setLang) SpectrumI18n.setLang(code);
        else {
          localStorage.setItem('spectrumLang', code);
          location.reload();
        }
      });
    });

    var logout = $('#hdr-logout');
    if (logout) {
      logout.addEventListener('click', function () {
        var done = function () { location.href = 'index.html'; };
        if (window.SpectrumAuth && SpectrumAuth.logout) {
          Promise.resolve(SpectrumAuth.logout()).then(done).catch(done);
        } else {
          done();
        }
      });
    }

    var menuBtn = $('#hdr-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        header.classList.toggle('is-nav-open');
      });
    }

    document.addEventListener('click', function (e) {
      if (header.contains(e.target) && (e.target.closest && e.target.closest('.site-drop, #hdr-menu-btn'))) return;
      closeAll();
      header.classList.remove('is-nav-open');
    });

    applyAuth();
    applyLangLabel();
    window.addEventListener('spectrum:auth', applyAuth);
    if (window.SpectrumAuth && SpectrumAuth.ready) {
      SpectrumAuth.ready.then(applyAuth);
    }

    var cart = [];
    try { cart = JSON.parse(localStorage.getItem('spectrumCart') || '[]'); } catch (err) { cart = []; }
    var count = cart.reduce(function (s, i) { return s + (i.qty || 1); }, 0);
    $all('#cart-count').forEach(function (el) { el.textContent = String(count); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
