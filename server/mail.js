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

function mailConfigured() {
  return !!(
    process.env.RESEND_API_KEY ||
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

async function sendWithResend(to, from, replyTo, subject, bodies) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: replyTo,
      subject,
      text: bodies.text,
      html: bodies.html
    })
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Resend rejected the message.');
  }
}

async function sendWithSmtp(to, from, replyTo, subject, bodies) {
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
  await transporter.sendMail({
    from,
    to,
    replyTo,
    subject,
    text: bodies.text,
    html: bodies.html
  });
}

async function sendContactEmail(inquiry) {
  if (!mailConfigured()) {
    throw new Error('Email is not configured on the server.');
  }
  const to = env('CONTACT_TO_EMAIL', 'dennisdiao@diaoinc.com');
  const from = env('CONTACT_FROM_EMAIL', process.env.SMTP_USER || 'Spectrum Display <beth.t@example.com>');
  const subject = 'Spectrum Display inquiry — ' + inquiry.name;
  const bodies = buildBodies(inquiry);
  if (process.env.RESEND_API_KEY) {
    await sendWithResend(to, from, inquiry.email, subject, bodies);
    return;
  }
  await sendWithSmtp(to, from, inquiry.email, subject, bodies);
}

module.exports = { sendContactEmail, mailConfigured };
