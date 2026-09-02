(function (root) {
  if (root.SpectrumPlaces) return;
  var loaded = false;
  var loading = null;
  var bound = [];

  function byId(id) {
    return typeof id === 'string' ? document.getElementById(id) : id;
  }

  function setValue(id, value) {
    var el = byId(id);
    if (!el) return;
    el.value = value == null ? '' : value;
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {}
  }

  function componentValue(components, type, useShort) {
    for (var i = 0; i < (components || []).length; i++) {
      if (components[i].types.indexOf(type) !== -1) {
        return useShort ? components[i].short_name : components[i].long_name;
      }
    }
    return '';
  }

  function parsePlace(place, opts) {
    opts = opts || {};
    var components = (place && place.address_components) || [];
    var streetNumber = componentValue(components, 'street_number', false);
    var route = componentValue(components, 'route', false);
    var line1 = [streetNumber, route].filter(Boolean).join(' ').trim();
    if (!line1 && place && place.name) line1 = place.name;
    var city =
      componentValue(components, 'locality', false) ||
      componentValue(components, 'sublocality_level_1', false) ||
      componentValue(components, 'postal_town', false) ||
      componentValue(components, 'neighborhood', false);
    var state = componentValue(components, 'administrative_area_level_1', true);
    var postal = componentValue(components, 'postal_code', false);
    var country = opts.countryShort
      ? (componentValue(components, 'country', true) || '')
      : (componentValue(components, 'country', false) || componentValue(components, 'country', true) || '');
    var line2 = componentValue(components, 'subpremise', false);
    return { line1: line1, line2: line2, city: city, state: state, postal: postal, country: country };
  }

  function fillFields(place, fields, opts) {
    if (!fields) return;
    var parsed = parsePlace(place, opts);
    if (parsed.line1) setValue(fields.street || fields.line1, parsed.line1);
    if (fields.line2 || fields.street2) setValue(fields.line2 || fields.street2, parsed.line2);
    setValue(fields.city, parsed.city);
    setValue(fields.state, parsed.state);
    setValue(fields.zip || fields.postal, parsed.postal);
    if (parsed.country) setValue(fields.country, parsed.country);
  }

  function bind(input, fields, opts) {
    input = byId(input);
    if (!input || !window.google || !google.maps || !google.maps.places) return null;
    if (input._spectrumPlaces) return input._spectrumPlaces;
    opts = opts || {};
    var options = {
      fields: ['address_components', 'formatted_address', 'geometry', 'name'],
      types: ['address']
    };
    if (opts.countries && opts.countries.length) options.componentRestrictions = { country: opts.countries };
    var autocomplete = new google.maps.places.Autocomplete(input, options);
    input.setAttribute('autocomplete', 'off');
    autocomplete.addListener('place_changed', function () {
      var place = autocomplete.getPlace();
      if (!place || !place.address_components) return;
      fillFields(place, fields, opts);
    });
    input._spectrumPlaces = autocomplete;
    bound.push(autocomplete);
    return autocomplete;
  }

  function load(apiKey) {
    if (!apiKey) return Promise.resolve(false);
    if (loaded && window.google && google.maps && google.maps.places) return Promise.resolve(true);
    if (loading) return loading;
    loading = new Promise(function (resolve) {
      function done(ok) {
        loaded = !!ok;
        resolve(!!ok);
      }
      if (window.google && google.maps && google.maps.places) {
        done(true);
        return;
      }
      var existing = document.querySelector('script[data-spectrum-maps]');
      if (existing) {
        existing.addEventListener('load', function () { done(true); });
        existing.addEventListener('error', function () { done(false); });
        return;
      }
      var cbName = '__spectrumPlacesReady';
      root[cbName] = function () { done(true); };
      var script = document.createElement('script');
      script.src =
        'https://maps.googleapis.com/maps/api/js?key=' +
        encodeURIComponent(apiKey) +
        '&libraries=places&callback=' + cbName;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-spectrum-maps', '1');
      script.onerror = function () {
        console.warn('Google Maps Places failed to load.');
        done(false);
      };
      document.head.appendChild(script);
    });
    return loading;
  }

  function bootFromConfig(then) {
    return fetch('/api/config')
      .then(function (res) { return res.json(); })
      .then(function (cfg) {
        var key = cfg && cfg.googleMapsApiKey;
        if (!key) return false;
        return load(key).then(function (ok) {
          if (ok && then) then();
          return ok;
        });
      })
      .catch(function () { return false; });
  }

  function autoBind() {
    var nodes = document.querySelectorAll('[data-places-fields]');
    for (var i = 0; i < nodes.length; i++) {
      var input = nodes[i];
      var parts = String(input.getAttribute('data-places-fields') || '')
        .split(',')
        .map(function (s) { return s.trim(); });
      var countries = String(input.getAttribute('data-places-countries') || '')
        .split(',')
        .map(function (s) { return s.trim(); })
        .filter(Boolean);
      bind(input, {
        street: parts[0] || input.id,
        line2: parts[1],
        city: parts[2],
        state: parts[3],
        zip: parts[4],
        country: parts[5]
      }, {
        countries: countries,
        countryShort: input.getAttribute('data-places-country-short') === '1'
      });
    }
  }

  root.SpectrumPlaces = {
    load: load,
    bind: bind,
    parsePlace: parsePlace,
    fillFields: fillFields,
    bootFromConfig: bootFromConfig,
    autoBind: autoBind
  };

  function start() {
    bootFromConfig(autoBind);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
