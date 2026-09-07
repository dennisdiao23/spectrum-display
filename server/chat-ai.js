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
    allowInDms: false,
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
  const hasKey = current.hasKey || !!nextKey;
  if (enabled && !hasKey) {
    throw httpError(400, 'Add an API key in Settings → Chat / AI.');
  }
  if (nextKey && nextKey.length > 512) {
    throw httpError(400, 'That API key is too long.');
  }
  return {
    enabled: enabled && hasKey,
    allowInDms: false,
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

const MENTION_RE = /@spectrum\s*ai\b/i;
const SPECTRUM_SYSTEM = [
  'You are Spectrum AI in Spectrum Display’s company Lobby chat.',
  'Staff mention you with @Spectrum AI. Keep replies short and helpful.',
  'You are talking to Spectrum staff, not customers. Do not claim you saved, sent, or deleted a record.'
].join(' ');
const NO_KEY_HINT = 'Add an API key in Settings → Chat / AI.';
const BOT_OFF_HINT = 'Spectrum AI is off. Turn Bot on in Settings → Chat / AI.';
const lobbyQueues = new Map();

function mentionedIn(text) {
  return MENTION_RE.test(String(text || ''));
}

function envProviderKeys() {
  return {
    anthropic: String(process.env.ANTHROPIC_API_KEY || '').trim(),
    openai: String(process.env.OPENAI_API_KEY || '').trim(),
    google: String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim()
  };
}

function fallbackEnvRuntime(preferred) {
  const env = envProviderKeys();
  const order = [preferred, 'anthropic', 'openai', 'google'].filter(function (id, i, arr) {
    return PROVIDERS.indexOf(id) >= 0 && arr.indexOf(id) === i;
  });
  for (let i = 0; i < order.length; i++) {
    const provider = order[i];
    if (env[provider]) {
      return {
        provider: provider,
        model: defaultModel(provider),
        apiKey: env[provider],
        keySource: 'env'
      };
    }
  }
  return null;
}

async function peekRow(store) {
  if (!store || typeof store.peekChatAiSettings !== 'function') return null;
  try {
    return await store.peekChatAiSettings();
  } catch (e) {
    return null;
  }
}

async function resolveRuntime(store, purpose) {
  const row = await peekRow(store);
  const provider = normalizeProvider(row && row.provider);
  const model = normalizeModel(provider, row && row.model);
  const botEnabled = asBool(row && row.enabled);
  let apiKey = storedPlainKey(row);
  let keySource = apiKey ? 'settings' : null;
  if (!apiKey) {
    const fromChatEnv = envOverrideKey();
    if (fromChatEnv) {
      apiKey = fromChatEnv;
      keySource = 'env';
    }
  }
  let resolvedProvider = provider;
  let resolvedModel = model;
  if (!apiKey) {
    const env = envProviderKeys();
    if (env[provider]) {
      apiKey = env[provider];
      keySource = 'env';
    } else {
      const fallback = fallbackEnvRuntime(provider);
      if (fallback) {
        apiKey = fallback.apiKey;
        resolvedProvider = fallback.provider;
        resolvedModel = fallback.model;
        keySource = 'env';
      }
    }
  }
  const hasKey = !!apiKey;
  return {
    ok: purpose === 'spectrum' ? (botEnabled && hasKey) : hasKey,
    botEnabled: botEnabled,
    hasKey: hasKey,
    provider: resolvedProvider,
    model: resolvedModel,
    apiKey: apiKey,
    keySource: keySource
  };
}

function trimReply(text, max) {
  const s = String(text == null ? '' : text).trim();
  const cap = max || 4000;
  if (s.length <= cap) return s;
  return s.slice(0, cap - 1) + '…';
}

function collapseMessages(messages) {
  const out = [];
  (messages || []).forEach(function (m) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return;
    const content = String(m.content || '').trim();
    if (!content) return;
    const last = out[out.length - 1];
    if (last && last.role === m.role) {
      last.content += '\n\n' + content;
    } else {
      out.push({ role: m.role, content: content });
    }
  });
  if (out.length && out[0].role !== 'user') {
    out.unshift({ role: 'user', content: '(continue)' });
  }
  return out;
}

async function completeAnthropic(apiKey, model, system, messages, signal) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      temperature: 0.3,
      system: system || undefined,
      messages: collapseMessages(messages)
    }),
    signal: signal
  });
  if (!res.ok) {
    const err = await res.text();
    throw httpError(502, 'Spectrum AI error: ' + String(err || '').slice(0, 180));
  }
  const data = await res.json();
  const parts = (data.content || []).map(function (p) {
    return p && p.type === 'text' ? String(p.text || '') : '';
  });
  return trimReply(parts.join('\n'));
}

async function completeOpenAi(apiKey, model, system, messages, signal) {
  const payload = [];
  if (system) payload.push({ role: 'system', content: system });
  collapseMessages(messages).forEach(function (m) { payload.push(m); });
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: payload,
      temperature: 0.3
    }),
    signal: signal
  });
  if (!res.ok) {
    const err = await res.text();
    throw httpError(502, 'Spectrum AI error: ' + String(err || '').slice(0, 180));
  }
  const data = await res.json();
  const choice = data && data.choices && data.choices[0] && data.choices[0].message;
  return trimReply(choice && choice.content);
}

async function completeGoogle(apiKey, model, system, messages, signal) {
  const contents = collapseMessages(messages).map(function (m) {
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    };
  });
  const body = {
    contents: contents,
    generationConfig: { temperature: 0.3 }
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) +
      ':generateContent?key=' + encodeURIComponent(apiKey),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: signal
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw httpError(502, 'Spectrum AI error: ' + String(err || '').slice(0, 180));
  }
  const data = await res.json();
  const cand = data && data.candidates && data.candidates[0];
  const parts = cand && cand.content && cand.content.parts || [];
  return trimReply(parts.map(function (p) { return p && p.text ? p.text : ''; }).join('\n'));
}

async function complete(opts) {
  const provider = normalizeProvider(opts && opts.provider);
  const model = normalizeModel(provider, opts && opts.model);
  const apiKey = String((opts && opts.apiKey) || '').trim();
  const system = String((opts && opts.system) || '').trim();
  const messages = Array.isArray(opts && opts.messages) ? opts.messages : [];
  if (!apiKey) throw httpError(400, NO_KEY_HINT);
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 25000);
  try {
    if (provider === 'anthropic') {
      return await completeAnthropic(apiKey, model, system, messages, ctrl.signal);
    }
    if (provider === 'openai') {
      return await completeOpenAi(apiKey, model, system, messages, ctrl.signal);
    }
    return await completeGoogle(apiKey, model, system, messages, ctrl.signal);
  } catch (e) {
    if (e && e.name === 'AbortError') throw httpError(504, 'The model timed out.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function historyToLlmMessages(history) {
  const messages = [];
  (history || []).forEach(function (m) {
    if (!m || m.isDeleted || m.isSystem) return;
    const content = String(m.body || '').trim().slice(0, 1500);
    if (!content) return;
    if (m.isSpectrumAi) messages.push({ role: 'assistant', content: content });
    else if (m.userId) {
      const who = (m.user && m.user.name) ? m.user.name + ': ' : '';
      messages.push({ role: 'user', content: who + content });
    }
  });
  return collapseMessages(messages);
}

async function replyOnce(store, admin, room, userMessage) {
  const text = String((userMessage && userMessage.body) || '');
  if (!room || room.kind !== 'lobby' || !mentionedIn(text)) return null;
  const runtime = await resolveRuntime(store, 'spectrum');
  let body = '';
  if (!runtime.hasKey) {
    body = NO_KEY_HINT;
  } else if (!runtime.botEnabled) {
    body = BOT_OFF_HINT;
  } else {
    try {
      const packed = await store.listChatMessages(admin, room.id, { limit: 20 });
      const messages = historyToLlmMessages((packed && packed.messages) || []);
      if (!messages.length) {
        messages.push({ role: 'user', content: text });
      }
      body = await complete({
        provider: runtime.provider,
        model: runtime.model,
        apiKey: runtime.apiKey,
        system: SPECTRUM_SYSTEM,
        messages: messages
      });
    } catch (e) {
      body = 'I could not reply: ' + (e.message || 'something went wrong') + '.';
    }
  }
  if (!body) body = 'I did not have a reply.';
  return store.appendSpectrumAiMessage(admin, room.id, body);
}

async function replyToLobbyMention(store, admin, room, userMessage) {
  if (!room || room.kind !== 'lobby') return null;
  if (!mentionedIn((userMessage && userMessage.body) || '')) return null;
  const key = String(room.id);
  const prev = lobbyQueues.get(key) || Promise.resolve();
  const next = prev.then(function () {
    return replyOnce(store, admin, room, userMessage);
  }).catch(function (err) {
    console.error('spectrum ai reply', err);
    return store.appendSpectrumAiMessage(
      admin,
      room.id,
      'I could not reply: ' + (err.message || 'something went wrong') + '.'
    );
  });
  lobbyQueues.set(key, next);
  return next;
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
  mentionedIn,
  resolveRuntime,
  complete,
  replyToLobbyMention,
  NO_KEY_HINT,
  BOT_OFF_HINT,
  httpError
};
