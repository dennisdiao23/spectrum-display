'use strict';

let geoip = null;
try {
  geoip = require('geoip-lite');
} catch (e) {
  geoip = null;
}

const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|localhost$|fc|fd|fe80)/i;

function headerVal(req, name) {
  if (!req || !req.headers) return '';
  const v = req.headers[name];
  if (Array.isArray(v)) return String(v[0] || '');
  return String(v || '');
}

function requestIp(req) {
  if (!req) return '';
  const forwarded = headerVal(req, 'x-forwarded-for') || headerVal(req, 'x-real-ip');
  let ip = forwarded.split(',')[0].trim();
  if (!ip) ip = String(req.ip || '');
  if (!ip && req.socket) ip = String(req.socket.remoteAddress || '');
  ip = ip.replace(/^::ffff:/i, '').replace(/^\[|\]$/g, '').trim();
  return ip.slice(0, 64);
}

function countryName(code) {
  const cc = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc) || cc;
  } catch (e) {
    return cc;
  }
}

function formatLocation(city, region, country) {
  const nation = countryName(country) || (/^[A-Za-z]{2}$/.test(String(country || '')) ? String(country).toUpperCase() : '');
  const town = String(city || '').trim();
  const st = String(region || '').trim();
  const parts = [];
  if (town) parts.push(town);
  if (st && st.toLowerCase() !== town.toLowerCase()) parts.push(st);
  if (nation) parts.push(nation);
  return parts.join(', ').slice(0, 120);
}

function lookup(req) {
  const headerCountry = headerVal(req, 'cf-ipcountry').toUpperCase();
  const ip = requestIp(req);
  let city = '';
  let region = '';
  let country = '';
  if (geoip && ip && !PRIVATE_IP.test(ip)) {
    try {
      const hit = geoip.lookup(ip);
      if (hit) {
        city = String(hit.city || '').trim();
        region = String(hit.region || '').trim();
        country = String(hit.country || '').trim().toUpperCase();
      }
    } catch (e) { /* ignore — never log the IP */ }
  }
  if (!country && /^[A-Z]{2}$/.test(headerCountry) && headerCountry !== 'XX' && headerCountry !== 'T1') {
    country = headerCountry;
  }
  return {
    country: country.slice(0, 2),
    region: region.slice(0, 40),
    city: city.slice(0, 80),
    location: formatLocation(city, region, country)
  };
}

module.exports = {
  formatLocation,
  lookup,
  countryName
};
