(function () {
  var partners = [];
  var map, markers = [];
  var origin = null;
  var radius = "all";
  var follow = false;
  var programmatic = false;
  var selected = null;

  var listEl = document.getElementById("find-list");
  var countEl = document.getElementById("find-count");
  var searchEl = document.getElementById("find-q");
  var emptyEl = document.getElementById("find-empty");

  function miles(a, b) {
    var r = Math.PI / 180;
    var dLat = (b.la - a.la) * r;
    var dLng = (b.ln - a.ln) * r;
    var h = Math.sin(dLat / 2) ** 2 + Math.cos(a.la * r) * Math.cos(b.la * r) * Math.sin(dLng / 2) ** 2;
    return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function tierRank(p) {
    if (p.t === "I" || p.t === "D") return 0;
    return 1;
  }

  function badge(p) {
    if (p.t === "I") return "Authorized Integrator";
    if (p.t === "D") return "Authorized Dealer";
    return "";
  }

  function cities() {
    var map = {};
    partners.forEach(function (p) {
      var key = (p.c + ", " + p.s).toLowerCase();
      if (!map[key]) map[key] = { label: p.c + ", " + p.s, la: p.la, ln: p.ln, n: 0 };
      map[key].la = (map[key].la * map[key].n + p.la) / (map[key].n + 1);
      map[key].ln = (map[key].ln * map[key].n + p.ln) / (map[key].n + 1);
      map[key].n += 1;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function matchPlace(q) {
    var query = q.trim().toLowerCase();
    if (query.length < 2) return null;
    var best = null;
    cities().forEach(function (place) {
      var label = place.label.toLowerCase();
      if (label.indexOf(query) === 0 || place.label.split(",")[0].toLowerCase().indexOf(query) === 0) {
        if (!best || place.label.length < best.label.length) best = place;
      }
    });
    return best;
  }

  function inBounds(p, b) {
    if (p.la < b.getSouth() || p.la > b.getNorth()) return false;
    return p.ln >= b.getWest() && p.ln <= b.getEast();
  }

  function pool() {
    var q = (searchEl.value || "").trim().toLowerCase();
    var place = matchPlace(searchEl.value || "");
    var rows = partners.filter(function (p) {
      if (q && !place) {
        var hay = (p.n + " " + p.c + " " + p.s).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (place && radius !== "all") {
        if (miles(place, p) > Number(radius)) return false;
      }
      return true;
    });
    var center = place || (map ? { la: map.getCenter().lat, ln: map.getCenter().lng } : null);
    rows.sort(function (a, b) {
      var t = tierRank(a) - tierRank(b);
      if (t) return t;
      if (center && radius !== "all") return miles(center, a) - miles(center, b);
      return a.c.localeCompare(b.c) || a.n.localeCompare(b.n);
    });
    return { rows: rows, place: place };
  }

  function visible() {
    var base = pool();
    if (!follow || !map) return base.rows;
    var b = map.getBounds();
    var center = { la: map.getCenter().lat, ln: map.getCenter().lng };
    return base.rows.filter(function (p) { return inBounds(p, b); }).sort(function (a, b) {
      var t = tierRank(a) - tierRank(b);
      if (t) return t;
      return miles(center, a) - miles(center, b);
    });
  }

  function fmt(n) {
    if (n < 10) return n.toFixed(1) + " mi";
    return Math.round(n) + " mi";
  }

  function render() {
    var rows = visible();
    var place = matchPlace(searchEl.value || "");
    var label = follow ? " in this map" : (place && radius !== "all" ? " within " + radius + " mi of " + place.label.split(",")[0] : " across North America");
    countEl.textContent = rows.length + (rows.length === 1 ? " shop" : " shops") + label;
    emptyEl.hidden = rows.length !== 0;
    listEl.innerHTML = rows.map(function (p) {
      var tag = badge(p);
      var dist = "";
      var from = place || (follow && map ? { la: map.getCenter().lat, ln: map.getCenter().lng } : null);
      if (from) dist = " · " + fmt(miles(from, p));
      var web = p.w ? '<a href="' + p.w.replace(/"/g, "") + '" target="_blank" rel="noopener">Website</a>' : "";
      return '<button type="button" class="find-card' + (selected === p.n ? " is-on" : "") + '" data-name="' + p.n.replace(/"/g, """) + '">' +
        "<strong>" + p.n + "</strong>" +
        (tag ? '<span class="find-badge">' + tag + "</span>" : "") +
        "<span>" + p.c + ", " + p.s + dist + (p.k === "n" && !tag ? " · National" : "") + "</span>" +
        (p.p ? "<span>" + p.p + "</span>" : "") +
        web +
        "</button>";
    }).join("");
    drawMarkers(pool().rows);
  }

  function drawMarkers(rows) {
    if (!map || !window.L) return;
    markers.forEach(function (m) { m.remove(); });
    markers = [];
    rows.forEach(function (p) {
      var mark = L.circleMarker([p.la, p.ln], {
        radius: p.t ? 7 : 5,
        color: p.t ? "#111" : "#5c6570",
        weight: 1,
        fillColor: p.t ? "#111" : "#fff",
        fillOpacity: 1
      }).addTo(map);
      mark.on("click", function () { openPartner(p); });
      markers.push(mark);
    });
  }

  function openPartner(p) {
    selected = p.n;
    render();
    if (map) {
      programmatic = true;
      map.flyTo([p.la, p.ln], Math.max(map.getZoom(), 8), { duration: 0.4 });
    }
  }

  function fit() {
    if (!map || !window.L) return;
    var rows = pool().rows;
    programmatic = true;
    follow = false;
    if (!rows.length) return;
    if (radius === "all" && !(searchEl.value || "").trim()) {
      map.fitBounds([[24.5, -125], [49.5, -66]], { padding: [24, 24], maxZoom: 5 });
      return;
    }
    var b = L.latLngBounds(rows.map(function (p) { return [p.la, p.ln]; }));
    map.fitBounds(b.pad(0.2), { padding: [28, 28], maxZoom: 10 });
  }

  function bootMap() {
    map = L.map("find-map", { zoomControl: true, minZoom: 3, maxZoom: 12 }).setView([39.8, -98.5], 4);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      subdomains: "abcd"
    }).addTo(map);
    map.on("movestart", function () {
      if (!programmatic) follow = true;
    });
    map.on("moveend", function () {
      if (programmatic) {
        programmatic = false;
        render();
        return;
      }
      follow = true;
      render();
    });
    fit();
  }

  listEl.addEventListener("click", function (event) {
    var btn = event.target.closest(".find-card");
    if (!btn) return;
    if (event.target.tagName === "A") return;
    var name = btn.getAttribute("data-name");
    var p = partners.filter(function (row) { return row.n === name; })[0];
    if (p) openPartner(p);
  });

  searchEl.addEventListener("input", function () {
    follow = false;
    fit();
  });

  document.getElementById("find-radii").addEventListener("click", function (event) {
    var btn = event.target.closest("button");
    if (!btn) return;
    radius = btn.getAttribute("data-r");
    document.querySelectorAll("#find-radii button").forEach(function (el) {
      el.classList.toggle("is-on", el === btn);
    });
    follow = false;
    fit();
  });

  fetch("/js/find-partners.json")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      partners = data;
      bootMap();
      render();
    })
    .catch(function () {
      countEl.textContent = "Could not load the directory.";
    });
})();
