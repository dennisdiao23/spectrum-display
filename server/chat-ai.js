'use strict';

const crypto = require('crypto');
const { hasPerm, isOwnerAdmin } = require('./admin-roles');

const PROVIDERS = ['anthropic', 'openai', 'google'];
const PROVIDER_LABEL = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google'
};
const MODELS = {
  anthropic: [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' }
  ],
  openai: [
    { id: 'gpt-5.2', label: 'GPT-5.2' },
    { id: 'gpt-5.2-mini', label: 'GPT-5.2 Mini' }
  ],
  google: [
    { id: 'gemini-3-flash', label: 'Gemini 3 Flash' },
    { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro' }
  ]
};
const DEFAULT_PROVIDER = 'anthropic';
const KEY_PLACEHOLDER = {
  anthropic: 'sk-ant-…',
  openai: 'sk-…',
  google: 'AIza…'
};
const EMPTY_ROW = {
  enabled: 0,
  allow_in_dms: 0,
  provider: DEFAULT_PROVIDER,
  model: MODELS.anthropic[0].id,
  api_key_ciphertext: null,
  api_key_last4: null
};

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function canManage(admin) {
  return isOwnerAdmin(admin) || hasPerm(admin, 'staff', 'edit');
}

function envOverrideKey() {
  return String(process.env.SPECTRUM_CHAT_AI_KEY || '').trim();
}

function encryptSecretBytes() {
  const raw = process.env.SPECTRUM_CHAT_AI_ENCRYPT_KEY
    || process.env.SPECTRUM_ADMIN_SECRET
    || 'spectrum-local-chat-ai';
  return crypto.createHash('sha256').update(String(raw)).digest();
}

function last4Of(key) {
  const s = String(key || '');
  if (s.length < 4) return s;
  return s.slice(-4);
}

function encryptApiKey(plain) {
  const text = String(plain || '').trim();
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptSecretBytes(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'v1:' + iv.toString('base64url') + '.' + tag.toString('base64url') + '.' + enc.toString('base64url');
}

function decryptApiKey(stored) {
  const raw = String(stored || '').trim();
  if (!raw) return '';
  if (raw.indexOf('v1:') !== 0) return '';
  const parts = raw.slice(3).split('.');
  if (parts.length !== 3) return '';
  try {
    const iv = Buffer.from(parts[0], 'base64url');
    const tag = Buffer.from(parts[1], 'base64url');
    const enc = Buffer.from(parts[2], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptSecretBytes(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch (e) {
    return '';
  }
}

function asBool(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 't' || value === 'on';
}

function normalizeProvider(value) {
  const p = String(value || '').toLowerCase().trim();
  return PROVIDERS.indexOf(p) >= 0 ? p : DEFAULT_PROVIDER;
}

function defaultModel(provider) {
  const list = MODELS[normalizeProvider(provider)] || MODELS[DEFAULT_PROVIDER];
  return list[0].id;
}

function normalizeModel(provider, value) {
  const p = normalizeProvider(provider);
  const id = String(value || '').trim();
  const list = MODELS[p] || MODELS[DEFAULT_PROVIDER];
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return id;
  }
  return list[0].id;
}

function storedPlainKey(row) {
  if (!row || !row.api_key_ciphertext) return '';
  return decryptApiKey(row.api_key_ciphertext);
}

function resolveApiKey(row) {
  const fromDb = storedPlainKey(row);
  if (fromDb) return fromDb;
  return envOverrideKey();
}

function publicSettings(row) {
  const data = row || EMPTY_ROW;
  const provider = normalizeProvider(data.provider);
  const fromDb = storedPlainKey(data);
  const fromEnv = envOverrideKey();
  const hasDb = !!(fromDb || (data.api_key_last4 && String(data.api_key_last4).trim()));
  const hasKey = hasDb || !!fromEnv;
  let last4 = '';
  let keySource = null;
  if (hasDb) {
    last4 = String(data.api_key_last4 || last4Of(fromDb) || '').slice(-4);
    keySource = 'settings';
  } else if (fromEnv) {
    last4 = last4Of(fromEnv);
    keySource = 'env';
  }
  return {
    enabled: asBool(data.enabled) && hasKey,
    allowInDms: asBool(data.allow_in_dms),
    provider: provider,
    model: normalizeModel(provider, data.model),
    hasKey: hasKey,
    last4: last4,
    keySource: keySource,
    placeholder: KEY_PLACEHOLDER[provider],
    models: MODELS,
    providers: PROVIDERS.map(function (id) {
      return { id: id, label: PROVIDER_LABEL[id] };
    })
  };
}

function assertNoSecretLeak(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  delete payload.api_key_ciphertext;
  delete payload.apiKeyCiphertext;
  delete payload.api_key;
  delete payload.apiKey;
  delete payload.ciphertext;
  return payload;
}

function incomingKey(body) {
  if (!body) return '';
  return String(body.apiKey || body.api_key || '').trim();
}

function settingsPatchFromBody(body, row) {
  const current = publicSettings(row);
  const nextKey = incomingKey(body);
  const provider = body && body.provider != null
    ? normalizeProvider(body.provider)
    : current.provider;
  const model = body && (body.model != null || body.provider != null)
    ? normalizeModel(provider, body.model)
    : normalizeModel(provider, current.model);
  let enabled = current.enabled;
  if (body && body.enabled != null) enabled = asBool(body.enabled);
  let allowInDms = current.allowInDms;
  if (body && (body.allowInDms != null || body.allow_in_dms != null)) {
    allowInDms = asBool(body.allowInDms != null ? body.allowInDms : body.allow_in_dms);
  }
  const hasKey = current.hasKey || !!nextKey;
  if (enabled && !hasKey) {
    throw httpError(400, 'Add an API key in Settings → Chat / AI.');
  }
  if (nextKey && nextKey.length > 512) {
    throw httpError(400, 'That API key is too long.');
  }
  return {
    enabled: enabled && hasKey,
    allowInDms: allowInDms,
    provider: provider,
    model: model,
    apiKey: nextKey
  };
}

function removeKeyPatch() {
  return {
    enabled: false,
    api_key_ciphertext: null,
    api_key_last4: null
  };
}

async function pingProvider(provider, apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) return { ok: false };
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 12000);
  const p = normalizeProvider(provider);
  try {
    let res;
    if (p === 'openai') {
      res = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + key },
        signal: ctrl.signal
      });
    } else if (p === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        signal: ctrl.signal
      });
    } else {
      res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key),
        { method: 'GET', signal: ctrl.signal }
      );
    }
    return { ok: !!(res && res.ok) };
  } catch (e) {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function testSavedOrPasted(row, body) {
  const pasted = incomingKey(body);
  const provider = body && body.provider != null
    ? normalizeProvider(body.provider)
    : normalizeProvider(row && row.provider);
  const key = pasted || resolveApiKey(row);
  if (!key) return { ok: false, message: 'Key was rejected.' };
  const ping = await pingProvider(provider, key);
  return ping.ok
    ? { ok: true, message: 'Key works.' }
    : { ok: false, message: 'Key was rejected.' };
}

module.exports = {
  PROVIDERS,
  MODELS,
  DEFAULT_PROVIDER,
  KEY_PLACEHOLDER,
  EMPTY_ROW,
  canManage,
  envOverrideKey,
  last4Of,
  encryptApiKey,
  decryptApiKey,
  asBool,
  normalizeProvider,
  normalizeModel,
  defaultModel,
  resolveApiKey,
  publicSettings,
  assertNoSecretLeak,
  incomingKey,
  settingsPatchFromBody,
  removeKeyPatch,
  pingProvider,
  testSavedOrPasted,
  httpError
};
