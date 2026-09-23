const test = require('node:test');
const assert = require('node:assert/strict');
const { load, hooks, tick, deferred } = require('./helpers/react-hooks.cjs');

function web(t, permission = async stream => stream, onFile = async () => {}) {
  const h = hooks(), errors = [], instances = [], revoked = [], listeners = new Set();
  let active = true, permissionCalls = 0, stoppedTracks = 0;
  const stream = { getTracks: () => [{ stop: () => { stoppedTracks++; } }] };
  class Recorder {
    static isTypeSupported() { return true; }
    constructor(_stream, options) { this.mimeType = options.mimeType; instances.push(this); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; } // The final data event is intentionally deferred.
    async complete(size = 100) { this.ondataavailable({ data: new Blob([new Uint8Array(size)]) }); await this.onstop(); }
  }
  const document = { hidden: false, addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn) };
  const { useDictation } = load('components/assistant/useDictation.web.ts', { react: h.React, 'fix-webm-duration': async blob => blob }, {
    MediaRecorder: Recorder, document,
    navigator: { mediaDevices: { getUserMedia: () => { permissionCalls++; return permission(stream); } } },
    URL: { createObjectURL: () => 'blob:synthetic', revokeObjectURL: uri => revoked.push(uri) },
  });
  h.mount(() => useDictation(active, onFile, text => errors.push(text)));
  t.after(() => h.unmount());
  return { h, errors, instances, revoked, stream,
    get permissionCalls() { return permissionCalls; }, get stoppedTracks() { return stoppedTracks; },
    hide() { document.hidden = true; listeners.forEach(fn => fn()); },
    deactivate() { active = false; h.update(); },
  };
}

test('web: repeated clicks request permission once; a late grant after leaving discards tracks', async t => {
  const grant = deferred();
  const w = web(t, () => grant.promise);
  const starting = w.h.value.toggle(); await tick();
  await w.h.value.toggle(); assert.equal(w.permissionCalls, 1); assert.equal(w.h.value.preparing, true);
  w.deactivate(); grant.resolve(w.stream); await starting; await tick();
  assert.equal(w.instances.length, 0); assert.ok(w.stoppedTracks > 0);
  assert.equal(w.h.value.recording, false); assert.equal(w.h.value.preparing, false); assert.deepEqual(w.errors, []);
});

test('web: permission rejection is recoverable and never transcribes', async t => {
  let calls = 0;
  const w = web(t, async () => { throw new Error('synthetic permission denial'); }, async () => { calls++; });
  await w.h.value.toggle(); await tick();
  assert.match(w.errors[0], /permisos/); assert.equal(w.h.value.preparing, false);
  await w.h.value.toggle(); assert.equal(w.permissionCalls, 2); assert.equal(calls, 0);
});

test('web: finishing blocks restart, transcribes once, and hiding aborts pending transcription', async t => {
  const transcription = deferred(); let calls = 0, signal;
  const w = web(t, async stream => stream, async (_file, currentSignal) => { calls++; signal = currentSignal; await transcription.promise; });
  await w.h.value.toggle(); await tick();
  const recorder = w.instances[0];
  await w.h.value.toggle(); await w.h.value.toggle(); await tick();
  assert.equal(w.instances.length, 1); assert.equal(w.h.value.preparing, true); assert.ok(w.stoppedTracks > 0);
  const completion = recorder.complete(); await tick();
  assert.equal(calls, 1); assert.equal(signal.aborted, false);
  w.hide(); assert.equal(signal.aborted, true);
  transcription.resolve(); await completion; await tick();
  assert.deepEqual(w.revoked, ['blob:synthetic']); assert.equal(w.h.value.preparing, false);
});

test('web: oversized or unmounted recordings do not reach transcription', async t => {
  let calls = 0;
  const w = web(t, async stream => stream, async () => { calls++; });
  await w.h.value.toggle(); await tick();
  await w.instances[0].complete(10 * 1024 * 1024 + 1); await tick();
  assert.equal(calls, 0); assert.match(w.errors[0], /10 MiB/);
  await w.h.value.toggle(); w.h.unmount(); await w.instances[1].complete();
  assert.equal(calls, 0); assert.ok(w.stoppedTracks > 0);
});

function native(t, options = {}) {
  const h = hooks(), errors = [], modes = [], deleted = [], events = new Set();
  let active = true, permissionCalls = 0, prepared = 0, recordings = 0, stops = 0;
  const recorder = {
    uri: 'file:///synthetic/dictado.m4a',
    async prepareToRecordAsync() { prepared++; await options.prepare?.(); },
    record() { recordings++; },
    async stop() { stops++; await options.stop?.(); },
  };
  const { useDictation } = load('components/assistant/useDictation.ts', {
    react: h.React,
    'react-native': { AppState: { currentState: 'active', addEventListener: (_event, fn) => { events.add(fn); return { remove: () => events.delete(fn) }; } } },
    'expo-audio': { useAudioRecorder: () => recorder, RecordingPresets: { HIGH_QUALITY: {} },
      requestRecordingPermissionsAsync: async () => { permissionCalls++; return options.permission ? options.permission() : { granted: true }; },
      setAudioModeAsync: async mode => modes.push(mode) },
    'expo-file-system': { File: class { constructor(uri) { this.uri = uri; this.exists = true; } delete() { deleted.push(this.uri); } } },
  });
  h.mount(() => useDictation(active, options.onFile || (async () => {}), text => errors.push(text)));
  t.after(() => h.unmount());
  return { h, errors, modes, deleted, get permissionCalls() { return permissionCalls; }, get prepared() { return prepared; },
    get recordings() { return recordings; }, get stops() { return stops; },
    deactivate() { active = false; h.update(); }, background() { events.forEach(fn => fn('background')); } };
}

test('native: permission is requested once and a late grant after logout never prepares the recorder', async t => {
  const grant = deferred(); const n = native(t, { permission: () => grant.promise });
  const starting = n.h.value.toggle(); await n.h.value.toggle();
  assert.equal(n.permissionCalls, 1);
  n.deactivate(); grant.resolve({ granted: true }); await starting; await tick();
  assert.equal(n.prepared, 0); assert.equal(n.recordings, 0); assert.equal(n.h.value.preparing, false);
  assert.equal(n.modes.at(-1).allowsRecording, false);
});

test('native: background during prepare stops and deletes audio without transcription', async t => {
  const prepare = deferred(); let calls = 0;
  const n = native(t, { prepare: () => prepare.promise, onFile: async () => { calls++; } });
  const starting = n.h.value.toggle(); await tick(); n.background(); prepare.resolve(); await starting;
  assert.equal(n.recordings, 0); assert.equal(n.stops, 1); assert.equal(calls, 0);
  assert.deepEqual(n.deleted, ['file:///synthetic/dictado.m4a']);
  assert.equal(n.modes.at(-1).allowsRecording, false);
});

test('native: stop and transcription are serialized and background aborts the pending upload', async t => {
  const stopped = deferred(), transcription = deferred(); let calls = 0, signal;
  const n = native(t, { stop: () => stopped.promise, onFile: async (_file, currentSignal) => { calls++; signal = currentSignal; await transcription.promise; } });
  await n.h.value.toggle(); const stopping = n.h.value.toggle(); await n.h.value.toggle();
  assert.equal(n.permissionCalls, 1); assert.equal(n.stops, 1);
  stopped.resolve(); await tick(); assert.equal(calls, 1);
  await n.h.value.toggle(); assert.equal(n.recordings, 1);
  n.background(); assert.equal(signal.aborted, true);
  transcription.resolve(); await stopping; await tick();
  assert.equal(n.h.value.preparing, false); assert.equal(n.deleted.length, 1);
});

test('native: stop failure restores audio mode, removes temporary audio and allows retry', async t => {
  const n = native(t, { stop: async () => { throw new Error('synthetic stop failure'); } });
  await n.h.value.toggle(); await n.h.value.toggle(); await tick();
  assert.match(n.errors[0], /completar/); assert.equal(n.modes.at(-1).allowsRecording, false);
  assert.equal(n.deleted.length, 1); assert.equal(n.h.value.preparing, false);
  await n.h.value.toggle(); assert.equal(n.recordings, 2);
});

const backend = { BACKEND_URL: 'http://synthetic.invalid', apiUrl: path => 'http://synthetic.invalid' + path };
test('client: multipart and streams invalidate only the requesting session on 401/403, even with non-JSON errors', async () => {
  for (const status of [401, 403]) {
    const api = load('utils/api.ts', { '../config/backend': backend, './session': { getAuthToken: async () => '' } });
    const failures = []; api.subscribeToAuthFailure(token => failures.push(token));
    const response = () => Promise.resolve(new Response('Unauthorized', { status }));
    const { assistantClient } = load('components/assistant/client.ts', {
      'expo/fetch': { fetch: response }, 'react-native': { Platform: { OS: 'web' } },
      '../../config/backend': backend, '../../utils/api': api,
    }, { fetch: response });
    const client = assistantClient('older-session'); const signal = new AbortController().signal;
    await assert.rejects(client.upload('c', { file: new Blob(['synthetic']), name: 'report.pdf' }, signal), e => e.status === status);
    await assert.rejects(client.send('c', {}, signal, () => {}), e => e.status === status);
    assert.deepEqual(failures, ['older-session', 'older-session']);
  }
});

test('client: truncated progressive response keeps partial events and reports interruption', async () => {
  const events = [];
  const { assistantClient } = load('components/assistant/client.ts', {
    'expo/fetch': { fetch: async () => new Response('{"type":"content","text":"Parcial"}\n') },
    'react-native': { Platform: { OS: 'web' } }, '../../config/backend': backend,
    '../../utils/api': { checkAuthStatus() {} },
  });
  await assert.rejects(assistantClient('synthetic').send('c', {}, new AbortController().signal, event => events.push(event)), /interrumpió/);
  assert.equal(events[0].text, 'Parcial');
});

function assistant(t, overrides = {}, picker = async () => ({ canceled: true })) {
  const h = hooks(); let token = 'patient-a', active = true;
  const conversation = { id: 'conversation-a', documents: [], messages: [] };
  const client = { get: async () => ({ conversation }), create: async () => ({ conversation }), ...overrides };
  const { usePatientAssistant } = load('components/assistant/usePatientAssistant.ts', {
    react: h.React, './client': { assistantClient: () => client },
    'expo-document-picker': { getDocumentAsync: picker },
    'react-native': { Platform: { OS: 'web' } }, 'expo-file-system': {},
  });
  h.mount(() => usePatientAssistant(token, active)); t.after(() => h.unmount());
  return { h, client, conversation, logout() { token = ''; h.update(); }, login(next) { token = next; h.update(); } };
}

test('draft: duplicate submits are blocked and a failed send retries with its original idempotency key', async t => {
  const failed = deferred(), bodies = [];
  const a = assistant(t, { send: async (_id, body) => { bodies.push(body); await failed.promise; } });
  await tick(); a.h.value.setDraft('Pregunta sintética'); await tick();
  const first = a.h.value.send(); await a.h.value.send(); await tick();
  assert.equal(bodies.length, 1);
  failed.reject(new Error('Fallo de red simulado')); await first; await tick();
  assert.equal(a.h.value.draft, 'Pregunta sintética');
  await a.h.value.send(); assert.equal(bodies.length, 2); assert.equal(bodies[0].requestId, bodies[1].requestId);
});

test('document explanation: validation errors explain the failure and preserve the ready document and draft', async t => {
  const a = assistant(t, { send: async (_id, _body, _signal, onEvent) => {
    onEvent({ type: 'error', code: 'invalid_response', message: { id: 'm', status: 'error', error_code: 'invalid_response' } });
  } });
  a.conversation.documents.push({ id: 'd', name: 'synthetic.png', status: 'ready' });
  await tick(); a.h.value.setDraft('Explica mi estudio'); await tick();
  await a.h.value.send(); await tick();
  assert.match(a.h.value.error, /validar la explicación/);
  assert.equal(a.h.value.draft, 'Explica mi estudio');
  assert.equal(a.h.value.conversation.documents[0].status, 'ready');
  assert.equal(a.h.value.sending, false);
});

test('draft: canceled transcription cannot append late text and an old completion cannot unlock newer audio', async t => {
  const first = deferred(), second = deferred(); let calls = 0;
  const a = assistant(t, { transcribe: async () => ++calls === 1 ? first.promise : second.promise });
  await tick(); a.h.value.setDraft('Borrador'); await tick();
  const signal = new AbortController();
  const previous = a.h.value.transcribe({}, signal.signal); signal.abort();
  const next = a.h.value.transcribe({}); first.resolve({ text: 'TEXTO DESCARTADO' }); await previous; await tick();
  assert.equal(a.h.value.draft, 'Borrador'); assert.equal(a.h.value.transcribing, true);
  second.resolve({ text: 'Texto editable' }); await next; await tick();
  assert.equal(a.h.value.draft, 'Borrador Texto editable'); assert.equal(a.h.value.transcribing, false);
});

test('session: a late document-picker result cannot survive logout', async t => {
  const selection = deferred(); const a = assistant(t, {}, () => selection.promise);
  await tick(); const pending = a.h.value.pick(); a.logout();
  selection.resolve({ canceled: false, assets: [{ uri: 'blob:synthetic', name: 'private.pdf', size: 12 }] });
  await pending; await tick(); assert.equal(a.h.value.selected, null);
});

test('history: an old refresh cannot overwrite a newer streamed answer', async t => {
  const snapshot = deferred(), done = deferred(); let event;
  t.after(() => done.resolve());
  const a = assistant(t, { send: async (_id, _body, _signal, onEvent) => { event = onEvent; await done.promise; } });
  await tick(); a.client.get = () => snapshot.promise;
  const refreshing = a.h.value.refresh();
  const sending = a.h.value.send('Nueva pregunta'); await tick();
  event({ type: 'status', message: { id: 'm1', status: 'running' } }); await tick();
  snapshot.resolve({ conversation: a.conversation }); await refreshing; await tick();
  assert.equal(a.h.value.conversation.messages[0]?.id, 'm1');
  done.resolve(); await sending;
});

test('session: pending deletion cannot clear or block a later patient session', async t => {
  const removed = deferred();
  const a = assistant(t, { remove: () => removed.promise });
  await tick(); const deleting = a.h.value.clear(); await tick();
  assert.equal(a.h.value.mutating, true);
  a.logout();
  a.client.get = async () => ({ conversation: { id: 'conversation-b', documents: [], messages: [] } });
  a.login('patient-b'); await tick();
  a.h.value.setDraft('Borrador de la nueva sesión'); await tick();
  assert.equal(a.h.value.mutating, false);
  removed.resolve(); await deleting; await tick();
  assert.equal(a.h.value.conversation.id, 'conversation-b');
  assert.equal(a.h.value.draft, 'Borrador de la nueva sesión');
});

test('retry: a failure reported by the server or a patient stop makes the next send a new attempt', async t => {
  const bodies = []; let mode = 'error';
  const a = assistant(t, {
    send: async (_id, body, signal, onEvent) => {
      bodies.push(body);
      if (mode === 'error') return onEvent({ type: 'error', code: 'provider_timeout', message: { id: 'm1', status: 'error', error_code: 'provider_timeout' } });
      await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    },
    stop: async () => ({ success: true }),
  });
  await tick(); a.h.value.setDraft('Pregunta sintética'); await tick();
  await a.h.value.send(); await tick();
  assert.match(a.h.value.error, /tardó demasiado/);
  assert.equal(a.h.value.draft, 'Pregunta sintética');
  mode = 'hang';
  const pending = a.h.value.send(); await tick();
  assert.notEqual(bodies[1].requestId, bodies[0].requestId);
  await a.h.value.stop(); await pending; await tick();
  assert.match(a.h.value.error, /detenida/);
  mode = 'error'; await a.h.value.send(); await tick();
  assert.notEqual(bodies[2].requestId, bodies[1].requestId);
});

test('document: a failed reading can be retried with the same local file without deleting the thread', async t => {
  const uploads = [], removed = []; let n = 0;
  const file = { uri: 'blob:synthetic', name: 'estudio.pdf', size: 12 };
  const a = assistant(t, {
    upload: async (_id, uploaded) => { uploads.push(uploaded); return { document: { id: `d${++n}`, name: uploaded.name, status: 'reading' } }; },
    removeDocument: async (_id, documentId) => { removed.push(documentId); a.conversation.documents = a.conversation.documents.filter(d => d.id !== documentId); },
  }, async () => ({ canceled: false, assets: [file] }));
  a.conversation.messages.push({ id: 'm0', status: 'completed', question: 'Anterior', document_ids: [] });
  await tick(); await a.h.value.pick(); await tick();
  await a.h.value.readSelected(); await tick();
  a.conversation.documents = [{ id: 'd1', name: 'estudio.pdf', status: 'error', error_code: 'provider_timeout' }];
  await a.h.value.refresh(); await tick();
  assert.equal(a.h.value.canRetryDocument('d1'), true);
  await a.h.value.retryDocument('d1'); await tick();
  assert.deepEqual(removed, ['d1']);
  assert.equal(uploads.length, 2); assert.equal(uploads[1], file);
  assert.equal(a.h.value.selected, null);
  assert.equal(a.h.value.conversation.messages.length, 1);
  assert.equal(a.h.value.canRetryDocument('d2'), true);
});

test('documents: only included ready documents are sent and a retry reuses the original documents without touching the draft', async t => {
  const bodies = [];
  const a = assistant(t, { send: async (_id, body, _signal, onEvent) => {
    bodies.push(body);
    onEvent({ type: 'done', message: { id: `m${bodies.length}`, status: 'completed', question: body.question, document_ids: body.documentIds } });
  } });
  a.conversation.documents.push({ id: 'd-old', name: 'antiguo.pdf', status: 'ready' }, { id: 'd-new', name: 'nuevo.pdf', status: 'ready' },
    { id: 'd-bad', name: 'fallido.pdf', status: 'error' });
  await tick();
  assert.deepEqual(a.h.value.includedDocumentIds, ['d-old', 'd-new']);
  a.h.value.toggleDocument('d-old'); await tick();
  assert.deepEqual(a.h.value.includedDocumentIds, ['d-new']);
  await a.h.value.send('Pregunta libre'); await tick();
  assert.deepEqual(bodies[0].documentIds, ['d-new']);
  a.h.value.setDraft('Borrador en curso'); await tick();
  await a.h.value.send('Pregunta anterior', true, ['d-old']); await tick();
  assert.deepEqual(bodies[1].documentIds, ['d-old']);
  assert.equal(bodies[1].question, 'Pregunta anterior');
  assert.equal(a.h.value.draft, 'Borrador en curso');
});
