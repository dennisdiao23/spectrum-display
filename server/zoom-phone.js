const crypto = require('crypto');

const ANSWERED = {
  answered: 1,
  accepted: 1,
  picked_up: 1,
  connected: 1,
  succeeded: 1
};
const MISSED = {
  voicemail: 1,
  hang_up: 1,
  canceled: 1,
  unconnected: 1,
  rejected: 1,
  busy: 1,
  ring_timeout: 1,
  overflowed: 1,
  no_answer: 1,
  abandoned: 1
};
const INTERNAL_EXT = {
  user: 1,
  call_queue: 1,
  callQueue: 1,
  auto_receptionist: 1,
  autoReceptionist: 1,
  shared_line_group: 1,
  sharedLineGroup: 1,
  common_area: 1,
  commonArea: 1
};

let warnedNoSecret = false;
let zoomToken = { value: '', exp: 0 };

function env(name, fallback) {
  const value = process.env[name];
  return value == null || value === '' ? fallback : value;
}

function webhookSecret() {
  return env('ZOOM_WEBHOOK_SECRET_TOKEN', env('ZOOM_SECRET_TOKEN', ''));
}

function s2sConfigured() {
  return !!(env('ZOOM_ACCOUNT_ID', '') && env('ZOOM_CLIENT_ID', '') && env('ZOOM_CLIENT_SECRET', ''));
}

function phoneDigits(value) {
  let d = String(value == null ? '' : value).replace(/\D/g, '');
  if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
  else if (d.length > 10) d = d.slice(-10);
  return d;
}

function toE164(value) {
  const raw = String(value == null ? '' : value).trim();
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (raw.charAt(0) === '+' && d.length >= 8) return '+' + d;
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d.charAt(0) === '1') return '+' + d;
  if (d.length >= 8) return '+' + d;
  return '';
}

function zoomCallHref(value) {
  const e164 = toE164(value);
  return e164 ? 'zoomphonecall://' + e164 : '';
}

function zoomSmsHref(value) {
  const e164 = toE164(value);
  return e164 ? 'zoomphonesms://' + e164 : '';
}

function phonesMatch(a, b) {
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  return !!(da && db && da === db);
}

function formatDuration(seconds) {
  const n = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  if (!n) return '';
  if (m && s) return m + 'm ' + s + 's';
  if (m) return m + 'm';
  return s + 's';
}

function namesMatch(a, b) {
  const left = String(a || '').trim().toLowerCase();
  const right = String(b || '').trim().toLowerCase();
  return !!(left && right && left === right);
}

function firstName(value) {
  return String(value || '').trim().split(/\s+/)[0].toLowerCase();
}

function pickStaff(admins, hint, mapped) {
  const list = admins || [];
  if (mapped && (mapped.staffName || mapped.staffEmail)) {
    const byMap = list.find(function (row) {
      return namesMatch(row.email, mapped.staffEmail) || namesMatch(row.name, mapped.staffName);
    });
    if (byMap) return byMap;
  }
  const email = String(hint && hint.email || '').trim().toLowerCase();
  if (email) {
    const byEmail = list.find(function (row) { return String(row.email || '').trim().toLowerCase() === email; });
    if (byEmail) return byEmail;
  }
  const name = String(hint && hint.name || '').trim();
  if (name) {
    const byName = list.find(function (row) { return namesMatch(row.name, name); });
    if (byName) return byName;
    const first = firstName(name);
    const firstHits = list.filter(function (row) { return firstName(row.name) === first; });
    if (first && firstHits.length === 1) return firstHits[0];
  }
  return null;
}

function incomingForAdmin(row, admin) {
  if (!row) return false;
  const name = admin && admin.name || '';
  const email = admin && admin.email || '';
  if (!row.staffName && !row.staffEmail) return true;
  if (row.staffEmail && namesMatch(row.staffEmail, email)) return true;
  if (row.staffName && namesMatch(row.staffName, name)) return true;
  const first = firstName(name);
  return !!(first && firstName(row.staffName) === first);
}

function verifyRequest(req) {
  const secret = webhookSecret();
  if (!secret) {
    if (!warnedNoSecret) {
      warnedNoSecret = true;
      console.warn('Zoom Phone webhook secret is not set. Local posts are accepted unsigned.');
    }
    return true;
  }
  const ts = String(req.headers['x-zm-request-timestamp'] || '');
  const sig = String(req.headers['x-zm-signature'] || '');
  const raw = req.rawBody != null ? String(req.rawBody) : JSON.stringify(req.body || {});
  if (!ts || !sig) return false;
  const age = Math.abs(Date.now() - Number(ts) * 1000);
  if (!Number.isFinite(age) || age > 5 * 60 * 1000) return false;
  const digest = crypto.createHmac('sha256', secret).update('v0:' + ts + ':' + raw).digest('hex');
  const expected = Buffer.from('v0=' + digest);
  const got = Buffer.from(sig);
  if (expected.length !== got.length) return false;
  return crypto.timingSafeEqual(expected, got);
}

function crcResponse(plainToken) {
  const secret = webhookSecret();
  const token = String(plainToken || '');
  return {
    plainToken: token,
    encryptedToken: crypto.createHmac('sha256', secret || 'local-zoom-dev').update(token).digest('hex')
  };
}

function obj(payload) {
  return (payload && payload.object) || payload || {};
}

function isInternalCall(el) {
  if (!el) return false;
  if (String(el.connect_type || el.connectType || '').toLowerCase() === 'internal') return true;
  return !!(INTERNAL_EXT[el.caller_ext_type] && INTERNAL_EXT[el.callee_ext_type]);
}

function pickCallElement(payload) {
  const data = obj(payload);
  const elements = Array.isArray(data.call_elements) ? data.call_elements : [];
  if (!elements.length) return data;
  const answered = elements.filter(function (el) { return ANSWERED[el.result]; });
  return answered.length ? answered[answered.length - 1] : elements[elements.length - 1];
}

function outsideNumber(el, direction) {
  if (!el) return '';
  if (direction === 'outbound') {
    return toE164(el.callee_did_number || el.callee_number || el.callee_ext_number) ||
      String(el.callee_did_number || el.callee_number || el.callee_ext_number || '');
  }
  return toE164(el.caller_did_number || el.caller_number || el.caller_ext_number) ||
    String(el.caller_did_number || el.caller_number || el.caller_ext_number || '');
}

function staffHintFromCall(el, direction, userId) {
  if (direction === 'outbound') {
    return {
      name: el.caller_name || el.callerName || '',
      email: el.caller_email || el.callerEmail || '',
      zoomUserId: userId || el.caller_user_id || el.caller_ext_id || ''
    };
  }
  return {
    name: el.callee_name || el.handler_name || el.operator_name || '',
    email: el.callee_email || '',
    zoomUserId: userId || el.callee_user_id || el.callee_ext_id || ''
  };
}

function callResultLabel(result) {
  if (ANSWERED[result]) return 'answered';
  if (result === 'voicemail') return 'voicemail';
  if (MISSED[result]) return 'missed';
  return result || 'ended';
}

function partyLabel(match, number, name) {
  if (match && match.lead) return match.lead.displayName || match.lead.companyName || number;
  if (match && match.customer) return match.customer.displayName || match.customer.companyName || number;
  return name || number || 'Unknown number';
}

async function resolveParty(store, number) {
  if (!number || !store.findCrmByPhone) return { lead: null, customer: null, deal: null };
  return store.findCrmByPhone(number);
}

async function resolveStaff(store, hint) {
  const admins = store.listAdmins ? await store.listAdmins() : [];
  const mapped = hint && hint.zoomUserId && store.getCrmZoomStaff
    ? await store.getCrmZoomStaff(hint.zoomUserId)
    : null;
  const staff = pickStaff(admins, hint, mapped);
  if (staff && hint && hint.zoomUserId && store.saveCrmZoomStaff) {
    await store.saveCrmZoomStaff({
      zoomUserId: hint.zoomUserId,
      staffName: staff.name || '',
      staffEmail: staff.email || ''
    });
  }
  return staff;
}

async function logActivity(store, input) {
  return store.upsertCrmZoomActivity(input);
}

async function handleRinging(store, payload) {
  const data = obj(payload);
  const callee = data.callee || {};
  const caller = data.caller || {};
  if (callee.extension_type && callee.extension_type !== 'user' && !callee.user_id) return { ok: true, skipped: 'not-user' };
  const fromNumber = toE164(caller.phone_number) || caller.phone_number || '';
  const toNumber = toE164(callee.phone_number) || callee.phone_number || '';
  const hint = { name: callee.name || '', email: '', zoomUserId: callee.user_id || '' };
  const staff = await resolveStaff(store, hint);
  const match = await resolveParty(store, fromNumber);
  const row = await store.upsertCrmIncomingCall({
    zoomCallId: String(data.call_id || ''),
    staffZoomUserId: callee.user_id || '',
    status: 'ringing',
    direction: 'inbound',
    fromNumber: fromNumber,
    fromName: caller.name || '',
    toNumber: toNumber,
    staffName: (staff && staff.name) || callee.name || '',
    staffEmail: (staff && staff.email) || '',
    leadId: match.lead && match.lead.id,
    customerId: match.customer && match.customer.id,
    dealId: match.deal && match.deal.id
  });
  return { ok: true, incoming: row };
}

async function handleCallStatus(store, payload, status) {
  const data = obj(payload);
  const callee = data.callee || {};
  if (!data.call_id) return { ok: true };
  await store.updateCrmIncomingCallStatus(String(data.call_id), callee.user_id || '', status);
  return { ok: true };
}

async function handleCallCompleted(store, payload) {
  const data = obj(payload);
  const el = pickCallElement(payload);
  if (isInternalCall(el)) return { ok: true, skipped: 'internal' };
  const direction = String(el.direction || 'inbound').toLowerCase() === 'outbound' ? 'outbound' : 'inbound';
  const result = callResultLabel(el.result);
  const number = outsideNumber(el, direction);
  const outsideName = direction === 'outbound' ? (el.callee_name || '') : (el.caller_name || '');
  const hint = staffHintFromCall(el, direction, data.user_id);
  const staff = await resolveStaff(store, hint);
  const staffName = (staff && staff.name) || hint.name || '';
  const match = await resolveParty(store, number);
  const duration = Number(el.talk_time != null ? el.talk_time : el.duration) || 0;
  const durLabel = formatDuration(duration);
  const party = partyLabel(match, number, outsideName);
  let subject;
  if (result === 'missed') subject = 'Missed ' + (direction === 'outbound' ? 'outbound to ' : 'call from ') + party;
  else if (result === 'voicemail') subject = 'Voicemail from ' + party;
  else if (direction === 'outbound') subject = 'Outbound call to ' + party;
  else subject = 'Inbound call from ' + party;
  if (staffName) subject += (direction === 'outbound' ? ' · ' : ' → ') + staffName;
  const lines = [
    (direction === 'outbound' ? 'Outbound' : 'Inbound') + (result === 'answered' ? '' : ' · ' + result),
    number ? 'Number: ' + number : '',
    outsideName && outsideName !== number ? 'Caller ID: ' + outsideName : '',
    staffName ? 'Staff: ' + staffName : '',
    durLabel ? 'Duration: ' + durLabel : '',
    el.recording_id ? 'Recording id: ' + el.recording_id : '',
    el.voicemail_id ? 'Voicemail id: ' + el.voicemail_id : ''
  ].filter(Boolean);
  const activity = await logActivity(store, {
    type: 'call',
    subject: subject,
    body: lines.join('\n'),
    done: true,
    leadId: match.lead && match.lead.id,
    customerId: match.customer && match.customer.id,
    dealId: match.deal && match.deal.id,
    createdByName: staffName || 'Zoom Phone',
    assignedTo: staffName,
    zoomEventKey: 'call:' + String(el.call_id || data.call_id || ''),
    zoomCallId: String(el.call_id || data.call_id || ''),
    phoneFrom: direction === 'outbound' ? (toE164(el.caller_did_number || el.caller_ext_number) || '') : number,
    phoneTo: direction === 'outbound' ? number : (toE164(el.callee_did_number || el.callee_ext_number) || ''),
    phoneDirection: direction,
    durationSec: duration,
    recordingId: el.recording_id || '',
    voicemailId: el.voicemail_id || ''
  });
  await store.updateCrmIncomingCallStatus(String(el.call_id || data.call_id || ''), '', result === 'missed' ? 'missed' : 'ended');
  return { ok: true, activity: activity };
}

function smsOutside(eventName, data) {
  const sender = data.sender || {};
  const members = Array.isArray(data.to_members) ? data.to_members : [];
  const inbound = eventName === 'phone.sms_received';
  if (inbound) {
    return {
      direction: 'inbound',
      number: sender.phone_number || '',
      outsideName: sender.display_name || '',
      staffName: (members[0] && members[0].display_name) || '',
      zoomUserId: (data.owner && data.owner.id) || (members[0] && members[0].id) || '',
      staffNumber: (members[0] && members[0].phone_number) || ''
    };
  }
  const dest = members.find(function (row) { return row && row.type !== 'user'; }) || members[0] || {};
  return {
    direction: 'outbound',
    number: dest.phone_number || '',
    outsideName: dest.display_name || '',
    staffName: sender.display_name || '',
    zoomUserId: sender.id || (data.owner && (data.owner.sms_sender_user_id || data.owner.id)) || '',
    staffNumber: sender.phone_number || ''
  };
}

async function handleSms(store, eventName, payload) {
  const data = obj(payload);
  const bits = smsOutside(eventName, data);
  const number = toE164(bits.number) || bits.number;
  const staff = await resolveStaff(store, { name: bits.staffName, email: '', zoomUserId: bits.zoomUserId });
  const staffName = (staff && staff.name) || bits.staffName || '';
  const match = await resolveParty(store, number);
  const party = partyLabel(match, number, bits.outsideName);
  const subject = (bits.direction === 'outbound' ? 'SMS to ' : 'SMS from ') + party +
    (staffName ? (bits.direction === 'outbound' ? ' · ' : ' → ') + staffName : '');
  const body = [data.message || '', number ? 'Number: ' + number : '', staffName ? 'Staff: ' + staffName : '']
    .filter(Boolean).join('\n');
  const activity = await logActivity(store, {
    type: 'sms',
    subject: subject,
    body: body,
    done: true,
    leadId: match.lead && match.lead.id,
    customerId: match.customer && match.customer.id,
    dealId: match.deal && match.deal.id,
    createdByName: staffName || 'Zoom Phone',
    assignedTo: staffName,
    zoomEventKey: 'sms:' + String(data.message_id || ''),
    zoomCallId: String(data.session_id || ''),
    phoneFrom: bits.direction === 'outbound' ? bits.staffNumber : number,
    phoneTo: bits.direction === 'outbound' ? number : bits.staffNumber,
    phoneDirection: bits.direction,
    mediaUrl: (data.attachments && data.attachments[0] && data.attachments[0].download_url) || ''
  });
  return { ok: true, activity: activity };
}

async function handleVoicemail(store, payload) {
  const data = obj(payload);
  const number = toE164(data.caller_did_number || data.caller_number) || data.caller_number || '';
  const staffHint = { name: data.callee_name || '', email: '', zoomUserId: data.callee_user_id || data.callee_id || '' };
  const staff = await resolveStaff(store, staffHint);
  const staffName = (staff && staff.name) || data.callee_name || '';
  const match = await resolveParty(store, number);
  const party = partyLabel(match, number, data.caller_name);
  const dur = formatDuration(data.duration);
  const activity = await logActivity(store, {
    type: 'call',
    subject: 'Voicemail from ' + party + (staffName ? ' → ' + staffName : ''),
    body: ['Voicemail', number ? 'Number: ' + number : '', staffName ? 'Staff: ' + staffName : '', dur ? 'Duration: ' + dur : '']
      .filter(Boolean).join('\n'),
    done: true,
    leadId: match.lead && match.lead.id,
    customerId: match.customer && match.customer.id,
    dealId: match.deal && match.deal.id,
    createdByName: staffName || 'Zoom Phone',
    assignedTo: staffName,
    zoomEventKey: data.call_id ? 'call:' + String(data.call_id) : 'vm:' + String(data.id || ''),
    zoomCallId: String(data.call_id || ''),
    phoneFrom: number,
    phoneTo: toE164(data.callee_did_number || data.callee_number) || data.callee_number || '',
    phoneDirection: 'inbound',
    durationSec: Number(data.duration) || 0,
    voicemailId: data.id || '',
    mediaUrl: data.download_url || '',
    mergeMedia: true
  });
  await store.updateCrmIncomingCallStatus(String(data.call_id || ''), '', 'missed');
  return { ok: true, activity: activity };
}

async function handleRecording(store, payload) {
  const data = obj(payload);
  const recordings = Array.isArray(data.recordings) ? data.recordings : (data.id ? [data] : []);
  const out = [];
  for (let i = 0; i < recordings.length; i += 1) {
    const rec = recordings[i] || {};
    const direction = String(rec.direction || 'inbound').toLowerCase() === 'outbound' ? 'outbound' : 'inbound';
    const number = toE164(direction === 'outbound' ? rec.callee_did_number || rec.callee_number : rec.caller_did_number || rec.caller_number) ||
      (direction === 'outbound' ? rec.callee_number : rec.caller_number) || '';
    const staffName = (rec.accepted_by && rec.accepted_by.name) || (rec.outgoing_by && rec.outgoing_by.name) ||
      (rec.owner && rec.owner.name) || (direction === 'outbound' ? rec.caller_name : rec.callee_name) || '';
    const match = await resolveParty(store, number);
    const party = partyLabel(match, number, direction === 'outbound' ? rec.callee_name : rec.caller_name);
    const activity = await logActivity(store, {
      type: 'call',
      subject: (direction === 'outbound' ? 'Outbound call to ' : 'Inbound call from ') + party +
        (staffName ? (direction === 'outbound' ? ' · ' : ' → ') + staffName : ''),
      body: ['Call recording', number ? 'Number: ' + number : '', staffName ? 'Staff: ' + staffName : '',
        formatDuration(rec.duration) ? 'Duration: ' + formatDuration(rec.duration) : ''].filter(Boolean).join('\n'),
      done: true,
      leadId: match.lead && match.lead.id,
      customerId: match.customer && match.customer.id,
      dealId: match.deal && match.deal.id,
      createdByName: staffName || 'Zoom Phone',
      assignedTo: staffName,
      zoomEventKey: rec.call_id ? 'call:' + String(rec.call_id) : 'rec:' + String(rec.id || ''),
      zoomCallId: String(rec.call_id || ''),
      phoneFrom: direction === 'outbound' ? (toE164(rec.caller_did_number || rec.caller_number) || '') : number,
      phoneTo: direction === 'outbound' ? number : (toE164(rec.callee_did_number || rec.callee_number) || ''),
      phoneDirection: direction,
      durationSec: Number(rec.duration) || 0,
      recordingId: rec.id || '',
      recordingUrl: rec.download_url || '',
      mergeMedia: true
    });
    out.push(activity);
  }
  return { ok: true, activities: out };
}

async function handleEvent(store, body) {
  const event = String(body && body.event || '');
  const payload = (body && body.payload) || {};
  if (event === 'endpoint.url_validation') {
    return { crc: crcResponse(payload.plainToken) };
  }
  if (event === 'phone.callee_ringing') return handleRinging(store, payload);
  if (event === 'phone.callee_answered') return handleCallStatus(store, payload, 'answered');
  if (event === 'phone.callee_missed' || event === 'phone.callee_rejected') {
    return handleCallStatus(store, payload, 'missed');
  }
  if (event === 'phone.callee_ended' || event === 'phone.caller_ended') {
    return handleCallStatus(store, payload, 'ended');
  }
  if (event === 'phone.callee_call_element_completed' || event === 'phone.caller_call_element_completed' ||
      event === 'phone.callee_call_history_completed' || event === 'phone.caller_call_history_completed') {
    return handleCallCompleted(store, payload);
  }
  if (event === 'phone.sms_received' || event === 'phone.sms_sent') return handleSms(store, event, payload);
  if (event === 'phone.voicemail_received' || event === 'phone.voicemail_received_for_access_member') {
    return handleVoicemail(store, payload);
  }
  if (event === 'phone.recording_completed' || event === 'phone.recording_completed_for_access_member') {
    return handleRecording(store, payload);
  }
  return { ok: true, ignored: event };
}

async function getZoomAccessToken() {
  if (!s2sConfigured()) return '';
  if (zoomToken.value && Date.now() < zoomToken.exp - 30000) return zoomToken.value;
  const basic = Buffer.from(env('ZOOM_CLIENT_ID', '') + ':' + env('ZOOM_CLIENT_SECRET', '')).toString('base64');
  const res = await fetch(
    'https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + encodeURIComponent(env('ZOOM_ACCOUNT_ID', '')),
    { method: 'POST', headers: { Authorization: 'Basic ' + basic } }
  );
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok || !data.access_token) {
    throw new Error(data.reason || data.error || 'Could not get Zoom access token.');
  }
  zoomToken = {
    value: data.access_token,
    exp: Date.now() + (Number(data.expires_in) || 3600) * 1000
  };
  return zoomToken.value;
}

async function fetchZoomMedia(url) {
  if (!url) throw new Error('No Zoom media URL.');
  const token = await getZoomAccessToken();
  if (!token) throw new Error('Add Zoom Server-to-Server credentials to play recordings here.');
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, redirect: 'follow' });
  if (!res.ok) throw new Error('Zoom media download failed.');
  return res;
}

module.exports = {
  webhookSecret,
  s2sConfigured,
  phoneDigits,
  toE164,
  zoomCallHref,
  zoomSmsHref,
  phonesMatch,
  formatDuration,
  pickStaff,
  incomingForAdmin,
  verifyRequest,
  crcResponse,
  handleEvent,
  getZoomAccessToken,
  fetchZoomMedia
};
