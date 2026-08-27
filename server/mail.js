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
    'Legal name: ' + (app.legal_name || '—'),
    'Website: ' + (app.website || '—'),
    'Billing email: ' + (app.billing_email || '—'),
    'Tax ID: ' + (app.tax_id || '—'),
    'Years in business: ' + (app.years_in_business || '—'),
    'Business type: ' + listText(app.business_type),
    'Primary verticals: ' + listText(app.primary_verticals),
    'Typical job size (m²): ' + (app.typical_job_size_m2 || '—'),
    'Estimated annual m²: ' + (app.estimated_annual_m2 || '—'),
    '',
    'Billing address:',
    formatAddress(app.billing_address),
    '',
    'Ship address:',
    formatAddress(app.ship_address),
    '',
    'References:',
    app.references_text || '—',
    '',
    'Agreed not to publish nets: ' + (app.agree_not_to_publish_nets ? 'yes' : 'no'),
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
    row('Legal name', app.legal_name || '—'),
    row('Website', app.website || '—'),
    row('Billing email', app.billing_email || '—'),
    row('Tax ID', app.tax_id || '—'),
    row('Years in business', app.years_in_business || '—'),
    row('Business type', listText(app.business_type)),
    row('Primary verticals', listText(app.primary_verticals)),
    row('Typical job size', app.typical_job_size_m2 || '—'),
    row('Estimated annual m²', app.estimated_annual_m2 || '—'),
    row('Agreed not to publish nets', app.agree_not_to_publish_nets ? 'yes' : 'no'),
    row('Resale certificate', app.resale_certificate_name || 'not attached'),
    '</table>',
    '<p style="font-family:sans-serif;font-size:14px;margin:16px 0 4px"><strong>Billing address</strong></p>',
    '<p style="white-space:pre-wrap;font-family:sans-serif;font-size:14px">' +
      escapeHtml(formatAddress(app.billing_address)) +
      '</p>',
    '<p style="font-family:sans-serif;font-size:14px;margin:16px 0 4px"><strong>Ship address</strong></p>',
    '<p style="white-space:pre-wrap;font-family:sans-serif;font-size:14px">' +
      escapeHtml(formatAddress(app.ship_address)) +
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

async function sendWithResend(to, from, replyTo, subject, bodies, attachments) {
  const payload = {
    from,
    to: [to],
    reply_to: replyTo,
    subject,
    text: bodies.text,
    html: bodies.html
  };
  if (attachments && attachments.length) {
    payload.attachments = attachments.map(function (file) {
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

async function sendWithSmtp(to, from, replyTo, subject, bodies, attachments) {
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
    from,
    to,
    replyTo,
    subject,
    text: bodies.text,
    html: bodies.html
  };
  if (attachments && attachments.length) {
    mail.attachments = attachments.map(function (file) {
      return {
        filename: file.filename,
        content: file.content,
        contentType: file.contentType
      };
    });
  }
  await transporter.sendMail(mail);
}

async function sendContactEmail(inquiry) {
  if (!mailConfigured()) {
    throw new Error('Email is not configured on the server.');
  }
  const to = 'sales@spectrumdisplay.com';
  const from = env('CONTACT_FROM_EMAIL', process.env.SMTP_USER || 'Spectrum Display <beth.t@example.com>');
  const subject = 'Spectrum Display inquiry — ' + inquiry.name;
  const bodies = buildBodies(inquiry);
  if (process.env.RESEND_API_KEY) {
    await sendWithResend(to, from, inquiry.email, subject, bodies);
    return;
  }
  await sendWithSmtp(to, from, inquiry.email, subject, bodies);
}

async function sendDealerInquiryEmail(app, attachments) {
  if (!mailConfigured()) {
    throw new Error('Email is not configured on the server.');
  }
  const to = 'sales@spectrumdisplay.com';
  const from = env('CONTACT_FROM_EMAIL', process.env.SMTP_USER || 'Spectrum Display <beth.t@example.com>');
  const subject = 'Dealer registration — ' + (app.company_name || app.contact_name || 'Applicant');
  const bodies = buildDealerBodies(app);
  const replyTo = app.email || app.billing_email || undefined;
  if (process.env.RESEND_API_KEY) {
    await sendWithResend(to, from, replyTo, subject, bodies, attachments);
    return;
  }
  await sendWithSmtp(to, from, replyTo, subject, bodies, attachments);
}

module.exports = { sendContactEmail, sendDealerInquiryEmail, mailConfigured };
