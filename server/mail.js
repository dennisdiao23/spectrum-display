function env(name, fallback) {
  const value = process.env[name];
  return value == null || value === '' ? fallback : value;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildBodies(inquiry) {
  const lines = [
    'New website inquiry from spectrumdisplay.com',
    '',
    'Name: ' + inquiry.name,
    'Company: ' + (inquiry.company || '—'),
    'Email: ' + inquiry.email,
    'Phone: ' + (inquiry.phone || '—'),
    'Project type: ' + (inquiry.projectType || '—'),
    '',
    inquiry.message || '(no message)'
  ];
  const text = lines.join('\n');
  const html = [
    '<p>New website inquiry from <strong>spectrumdisplay.com</strong></p>',
    '<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">',
    row('Name', inquiry.name),
    row('Company', inquiry.company || '—'),
    row('Email', inquiry.email),
    row('Phone', inquiry.phone || '—'),
    row('Project type', inquiry.projectType || '—'),
    '</table>',
    '<p style="white-space:pre-wrap;font-family:sans-serif;font-size:14px">' +
      escapeHtml(inquiry.message || '(no message)') +
      '</p>'
  ].join('');
  return { text, html };
}

function row(label, value) {
  return (
    '<tr><td style="padding:4px 12px 4px 0;color:#64748b">' +
    escapeHtml(label) +
    '</td><td style="padding:4px 0">' +
    escapeHtml(value) +
    '</td></tr>'
  );
}

function listText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '—';
  return String(value || '').trim() || '—';
}

function formatAddress(addr) {
  if (!addr || typeof addr !== 'object') return '—';
  const parts = [
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postal_code].filter(Boolean).join(', '),
    addr.country || 'US'
  ].filter(Boolean);
  return parts.join('\n') || '—';
}

function buildDealerBodies(app) {
  const lines = [
    'New dealer registration from spectrumdisplay.com',
    '',
    'Contact: ' + (app.contact_name || '—'),
    'Email: ' + (app.email || '—'),
    'Phone: ' + (app.phone || '—'),
    '',
    'Company: ' + (app.company_name || '—'),
    'Website: ' + (app.website || '—'),
    'Tax ID: ' + (app.tax_id || '—'),
    'Years in business: ' + (app.years_in_business || '—'),
    'Company size (people): ' + (app.company_size || '—'),
    'Business type: ' + listText(app.business_type),
    'Primary verticals: ' + listText(app.primary_verticals),
    'Typical job size (m²): ' + (app.typical_job_size_m2 || '—'),
    '',
    'Company address:',
    formatAddress(app.company_address),
    '',
    'References:',
    app.references_text || '—',
    '',
    'Certified authorized representative: ' + (app.certify_authorized ? 'yes' : 'no'),
    'Agreed to Terms & Privacy: ' + (app.agree_terms_privacy ? 'yes' : 'no'),
    'Marketing opt-in: ' + (app.marketing_opt_in ? 'yes' : 'no'),
    app.resale_certificate_name ? 'Resale certificate attached: ' + app.resale_certificate_name : 'Resale certificate: not attached'
  ];
  const text = lines.join('\n');
  const html = [
    '<p>New dealer registration from <strong>spectrumdisplay.com</strong></p>',
    '<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">',
    row('Contact', app.contact_name || '—'),
    row('Email', app.email || '—'),
    row('Phone', app.phone || '—'),
    row('Company', app.company_name || '—'),
    row('Website', app.website || '—'),
    row('Tax ID', app.tax_id || '—'),
    row('Years in business', app.years_in_business || '—'),
    row('Company size (people)', app.company_size || '—'),
    row('Business type', listText(app.business_type)),
    row('Primary verticals', listText(app.primary_verticals)),
    row('Typical job size', app.typical_job_size_m2 || '—'),
    row('Certified authorized', app.certify_authorized ? 'yes' : 'no'),
    row('Agreed Terms & Privacy', app.agree_terms_privacy ? 'yes' : 'no'),
    row('Marketing opt-in', app.marketing_opt_in ? 'yes' : 'no'),
    row('Resale certificate', app.resale_certificate_name || 'not attached'),
    '</table>',
    '<p style="font-family:sans-serif;font-size:14px;margin:16px 0 4px"><strong>Company address</strong></p>',
    '<p style="white-space:pre-wrap;font-family:sans-serif;font-size:14px">' +
      escapeHtml(formatAddress(app.company_address)) +
      '</p>',
    '<p style="font-family:sans-serif;font-size:14px;margin:16px 0 4px"><strong>References</strong></p>',
    '<p style="white-space:pre-wrap;font-family:sans-serif;font-size:14px">' +
      escapeHtml(app.references_text || '—') +
      '</p>'
  ].join('');
  return { text, html };
}

function mailConfigured() {
  return !!(
    process.env.RESEND_API_KEY ||
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

function defaultFrom() {
  return env('CONTACT_FROM_EMAIL', process.env.SMTP_USER || 'Spectrum Display <hello@send.spectrumdisplay.com>');
}

function asList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value];
}

async function sendWithResend(opts) {
  const payload = {
    from: opts.from,
    to: asList(opts.to),
    subject: opts.subject,
    text: opts.text,
    html: opts.html
  };
  if (opts.replyTo) payload.reply_to = opts.replyTo;
  if (opts.cc && opts.cc.length) payload.cc = asList(opts.cc);
  if (opts.bcc && opts.bcc.length) payload.bcc = asList(opts.bcc);
  if (opts.attachments && opts.attachments.length) {
    payload.attachments = opts.attachments.map(function (file) {
      return {
        filename: file.filename,
        content: Buffer.isBuffer(file.content)
          ? file.content.toString('base64')
          : String(file.content || '')
      };
    });
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Resend rejected the message.');
  }
}

async function sendWithSmtp(opts) {
  const nodemailer = require('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  const mail = {
    from: opts.from,
    to: asList(opts.to).join(', '),
    subject: opts.subject,
    text: opts.text,
    html: opts.html
  };
  if (opts.replyTo) mail.replyTo = opts.replyTo;
  if (opts.cc && opts.cc.length) mail.cc = asList(opts.cc).join(', ');
  if (opts.bcc && opts.bcc.length) mail.bcc = asList(opts.bcc).join(', ');
  if (opts.attachments && opts.attachments.length) {
    mail.attachments = opts.attachments.map(function (file) {
      return {
        filename: file.filename,
        content: file.content,
        contentType: file.contentType
      };
    });
  }
  await transporter.sendMail(mail);
}

function writeLocalOutbox(opts) {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '..', 'data', 'outbox');
  fs.mkdirSync(dir, { recursive: true });
  const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const record = {
    id: id,
    from: opts.from,
    to: asList(opts.to),
    cc: asList(opts.cc),
    bcc: asList(opts.bcc),
    replyTo: opts.replyTo || '',
    subject: opts.subject,
    text: opts.text,
    createdAt: new Date().toISOString(),
    attachments: (opts.attachments || []).map(function (file) { return file.filename; })
  };
  fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(record, null, 2));
  (opts.attachments || []).forEach(function (file, i) {
    if (!file || !file.content) return;
    const name = String(file.filename || ('file-' + i)).replace(/[\\/]+/g, '-');
    fs.writeFileSync(path.join(dir, id + '-' + name), file.content);
  });
  return { local: true, id: id };
}

async function deliverMail(opts) {
  if (process.env.RESEND_API_KEY) {
    await sendWithResend(opts);
    return { provider: 'resend' };
  }
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    await sendWithSmtp(opts);
    return { provider: 'smtp' };
  }
  if (process.env.NODE_ENV !== 'production') {
    return Object.assign({ provider: 'local' }, writeLocalOutbox(opts));
  }
  throw new Error('Email is not configured on the server.');
}

function htmlFromText(text) {
  return '<p style="white-space:pre-wrap;font-family:sans-serif;font-size:14px;line-height:1.45">' +
    escapeHtml(text) +
    '</p>';
}

async function sendStaffEmail(input) {
  const { parseEmails } = require('./company-emails');
  const to = parseEmails(input.to);
  if (!to.length) throw new Error('Add at least one To address.');
  const cc = parseEmails(input.cc);
  const bcc = parseEmails(input.bcc);
  const subject = String(input.subject || '').trim() || 'Spectrum Display';
  const text = String(input.body || '').trim();
  if (!text) throw new Error('Write a message before sending.');
  const attachments = (input.attachments || []).filter(function (file) {
    return file && file.filename && file.content;
  });
  return deliverMail({
    from: defaultFrom(),
    to: to,
    cc: cc,
    bcc: bcc,
    replyTo: input.replyTo || undefined,
    subject: subject,
    text: text,
    html: htmlFromText(text),
    attachments: attachments
  });
}

async function sendContactEmail(inquiry) {
  if (!mailConfigured()) {
    throw new Error('Email is not configured on the server.');
  }
  const to = env('CONTACT_TO_EMAIL', 'sales@spectrumdisplay.com');
  const from = defaultFrom();
  const subject = 'Spectrum Display inquiry — ' + inquiry.name;
  const bodies = buildBodies(inquiry);
  await deliverMail({
    from: from,
    to: to,
    replyTo: inquiry.email,
    subject: subject,
    text: bodies.text,
    html: bodies.html
  });
}

async function sendDealerInquiryEmail(app, attachments) {
  if (!mailConfigured()) {
    throw new Error('Email is not configured on the server.');
  }
  const to = env('CONTACT_TO_EMAIL', 'sales@spectrumdisplay.com');
  const from = defaultFrom();
  const subject = 'Dealer registration — ' + (app.company_name || app.contact_name || 'Applicant');
  const bodies = buildDealerBodies(app);
  await deliverMail({
    from: from,
    to: to,
    replyTo: app.email || undefined,
    subject: subject,
    text: bodies.text,
    html: bodies.html,
    attachments: attachments
  });
}

module.exports = {
  sendContactEmail,
  sendDealerInquiryEmail,
  sendStaffEmail,
  mailConfigured
};
