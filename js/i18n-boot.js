/**
 * Runs in <head> before paint so language swap / font load / lang menu
 * never flash English first or shove the header.
 */
(function () {
  var KEY = 'spectrumLang';
  var lang = '';
  try { lang = localStorage.getItem(KEY) || ''; } catch (e) { lang = ''; }
  if (!/^(en|es|fr|ko|ja|zh)$/.test(lang)) lang = 'en';
  var html = document.documentElement;
  html.setAttribute('data-lang', lang);
  html.lang = lang === 'zh' ? 'zh-CN' : lang;
  if (lang !== 'en') html.classList.add('i18n-wait');
  var vp = document.querySelector('meta[name="viewport"]');
  if (vp && vp.content.indexOf('viewport-fit') === -1) {
    vp.content += ', viewport-fit=cover';
  }

  var css = document.createElement('style');
  css.id = 'spectrum-i18n-boot-css';
  css.textContent =
    ':root{--site-header-h:4.35rem;--site-tabbar-h:0px}' +
    '@media (max-width:767px){:root{--site-header-h:3.35rem;--site-tabbar-h:calc(6.5rem - 35px + env(safe-area-inset-bottom,0px))}body{padding-bottom:var(--site-tabbar-h)}}' +
    'html.i18n-wait{visibility:hidden}' +
    '.site-header{height:var(--site-header-h);box-sizing:border-box}' +
    '.site-header [data-i18n],.site-nav a,.site-util{white-space:nowrap}';
  document.head.appendChild(css);

  if (lang === 'ko' || lang === 'ja' || lang === 'zh') {
    var families = {
      ko: 'Noto+Sans+KR:wght@400;500;600;700',
      ja: 'Noto+Sans+JP:wght@400;500;600;700',
      zh: 'Noto+Sans+SC:wght@400;500;600;700'
    };
    var stacks = {
      ko: '"Noto Sans KR", Inter, sans-serif',
      ja: '"Noto Sans JP", Inter, sans-serif',
      zh: '"Noto Sans SC", Inter, sans-serif'
    };
    var link = document.createElement('link');
    link.id = 'spectrum-cjk-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + families[lang] + '&display=swap';
    document.head.appendChild(link);
    html.style.fontFamily = stacks[lang];
  }

  setTimeout(function () {
    html.classList.remove('i18n-wait');
  }, 1200);
})();
