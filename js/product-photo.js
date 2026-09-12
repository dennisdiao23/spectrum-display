/**
 * Public-catalog photo fallback: generic controller chassis or receiving card
 * when a series has no product photo. Do not write these paths into the DB.
 */
(function (global) {
  var CONTROLLER = '/assets/products/placeholders/controller.webp?v=dark1';
  var CARD = '/assets/products/placeholders/receiving-card.webp?v=dark1';

  function isReceivingCard(p) {
    if (!p) return false;
    if (p.replacementOnly) return true;
    var sub = String(p.subtype || '').toLowerCase();
    if (sub === 'receiving-card' || sub === 'receiving-cards') return true;
    var slug = String(p.collectionSlug || '').toLowerCase();
    return slug === 'spares';
  }

  function isController(p) {
    if (!p || isReceivingCard(p)) return false;
    var type = String(p.type || '').toLowerCase();
    if (type === 'control') return true;
    var slug = String(p.collectionSlug || '').toLowerCase();
    if (slug === 'control') return true;
    var sub = String(p.subtype || '').toLowerCase();
    return sub === 'all-in-one' || sub === 'sending' || sub === 'playback'
      || sub === 'accessories' || sub === 'fiber';
  }

  function fallbackSrc(p) {
    if (isReceivingCard(p)) return CARD;
    if (isController(p)) return CONTROLLER;
    return '';
  }

  function abs(src) {
    if (!src) return '';
    if (/^https?:/i.test(src) || src.charAt(0) === '/') return src;
    return '/' + src;
  }

  function productPhoto(p, kind) {
    var src = (p && p.image) || fallbackSrc(p);
    if (!src) return '';
    if (global.spectrumDisplayImage) return global.spectrumDisplayImage(src, kind || 'card');
    return abs(src);
  }

  global.spectrumProductPhoto = productPhoto;
  global.spectrumProductPhotoFallback = fallbackSrc;
})(window);
