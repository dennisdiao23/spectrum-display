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

  function boot() {
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
