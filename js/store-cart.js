/**
 * Local mini-cart → Shopify cart permalink. No cards collected here.
 */
(function (global) {
  var KEY = 'spectrum_store_cart';

  function read() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items || []));
    global.dispatchEvent(new CustomEvent('spectrum:store-cart'));
  }

  function count() {
    return read().reduce(function (n, line) { return n + (Number(line.qty) || 0); }, 0);
  }

  function add(item, qty) {
    var variantId = String((item && item.variantId) || '').replace(/\D/g, '');
    if (!variantId) return false;
    var n = Math.max(1, Number(qty) || 1);
    var items = read();
    var found = items.filter(function (line) { return String(line.variantId) === variantId; })[0];
    if (found) found.qty = Math.max(1, (Number(found.qty) || 0) + n);
    else {
      items.push({
        variantId: variantId,
        qty: n,
        handle: item.handle || '',
        name: item.name || '',
        sku: item.sku || '',
        image: item.image || '',
        priceLabel: item.priceLabel || ''
      });
    }
    write(items);
    return true;
  }

  function setQty(variantId, qty) {
    var id = String(variantId);
    var n = Math.max(0, Number(qty) || 0);
    var items = read().filter(function (line) {
      if (String(line.variantId) !== id) return true;
      if (n <= 0) return false;
      line.qty = n;
      return true;
    });
    write(items);
  }

  function clear() { write([]); }

  function checkoutUrl(shop) {
    var host = String(shop || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    var items = read().filter(function (line) { return line.variantId && line.qty > 0; });
    if (!host || !items.length) return '';
    var path = items.map(function (line) {
      return encodeURIComponent(line.variantId) + ':' + encodeURIComponent(String(line.qty));
    }).join(',');
    return 'https://' + host + '/cart/' + path;
  }

  global.SpectrumStoreCart = {
    read: read,
    add: add,
    setQty: setQty,
    clear: clear,
    count: count,
    checkoutUrl: checkoutUrl
  };
})(window);
