const SPEC_PDF_HOSTS = {
  'oss.novastar.tech': true,
  'en-website001.oss-us-east-1.aliyuncs.com': true,
  'en-website001.oss-accelerate.aliyuncs.com': true
};

function allowedSpecPdfUrl(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw || '').trim());
  } catch (e) {
    return '';
  }
  if (parsed.protocol !== 'https:') return '';
  if (!SPEC_PDF_HOSTS[parsed.hostname.toLowerCase()]) return '';
  if (!/\.pdf$/i.test(parsed.pathname)) return '';
  parsed.hash = '';
  return parsed.toString();
}

function specPdfName(target) {
  const last = String(target || '').split('/').pop() || 'spec.pdf';
  let name = last;
  try { name = decodeURIComponent(last); } catch (e) { name = last; }
  name = name.replace(/[\r\n"]/g, '').slice(0, 180);
  return name || 'spec.pdf';
}

async function fetchSpecPdf(target) {
  const upstream = await fetch(target, {
    redirect: 'follow',
    headers: { 'User-Agent': 'SpectrumDisplay/1.0' }
  });
  const finalUrl = allowedSpecPdfUrl(upstream.url || target);
  if (!upstream.ok || !finalUrl) {
    const err = new Error('Spec sheet could not be downloaded.');
    err.status = upstream.ok ? 400 : 502;
    throw err;
  }
  return upstream;
}

module.exports = {
  allowedSpecPdfUrl,
  specPdfName,
  fetchSpecPdf
};
