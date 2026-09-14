const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { EventEmitter } = require('node:events');

function load(file, dependencies, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, console, setTimeout, clearTimeout, AbortController, Headers, Response, URLSearchParams,
    require(name) { if (!(name in dependencies)) throw new Error('Unexpected import: ' + name); return dependencies[name]; },
    ...globals,
  }, { filename: file });
  return module.exports;
}
const backend = { BACKEND_URL: 'https://api.example.invalid', apiUrl: path => 'https://api.example.invalid' + (path.startsWith('/') ? path : '/' + path) };
function loadApi(fetch, tokenProvider = async () => 'session-a') {
  return load('utils/api.ts', { '../config/backend': backend, './session': { getAuthToken: tokenProvider } }, { fetch });
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('apiClient preserves JSON and legacy Response contracts, headers and query parameters', async () => {
  let sent;
  const { apiClient } = loadApi(async (url, init) => {
    sent = { url, init }; return new Response('{"success":true,"data":[1]}', { status: 201 });
  });
  const body = await apiClient.post('/api/example', { authenticated: true, query: { page: 2 }, body: { name: 'Ana' } });
  assert.equal(body.data[0], 1);
  assert.equal(sent.url, backend.BACKEND_URL + '/api/example?page=2');
  assert.equal(sent.init.headers.Authorization, 'Bearer session-a');
  assert.equal(sent.init.body, '{"name":"Ana"}');
  const response = await apiClient.fetch('/api/example');
  assert.equal(response.status, 201); assert.equal((await response.json()).success, true);
  const raw = loadApi(async () => new Response('{"message":"validation"}', { status: 422 }));
  assert.equal((await raw.apiClient.fetch('/api/example')).status, 422);
});

test('deadline covers stalled fetch, body download and token storage; cancellation remains AbortError', async () => {
  const never = () => new Promise(() => {});
  for (const [fetch, token] of [[never, async () => 'a'], [async () => ({ status: 200, text: never }), async () => 'a'], [never, never]]) {
    const { apiClient } = loadApi(fetch, token);
    await assert.rejects(apiClient.get('/api/test', { authenticated: true, timeoutMs: 20 }), error => error.status === 408);
  }
  let calls = 0;
  const { apiClient } = loadApi(async () => { calls++; return new Response('{}'); });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(apiClient.get('/api/test', { signal: controller.signal }), error => error.name === 'AbortError');
  assert.equal(calls, 0);
});

test('401/403 notify only authenticated requests, preserve status, and support raw fetch', async () => {
  for (const status of [401, 403]) {
    const { apiClient, subscribeToAuthFailure } = loadApi(async () => new Response('{"error":"denied"}', { status }));
    const failures = []; const unsubscribe = subscribeToAuthFailure(token => failures.push(token));
    await assert.rejects(apiClient.get('/api/private', { authenticated: true }), error => error.status === status && error.message === 'denied');
    assert.deepEqual(failures, ['session-a']);
    await assert.rejects(apiClient.post('/api/auth/login'), error => error.status === status);
    assert.equal(failures.length, 1, 'Login/OTP rejections must not invalidate a session');
    const response = await apiClient.fetch('/api/private', { headers: { authorization: 'Bearer session-a' } });
    assert.equal(response.status, status); assert.equal(failures.length, 2);
    unsubscribe();
  }
});

// Small deterministic hook driver: runs actual provider/hook callbacks, dependencies,
// effect cleanup and state updates without requiring a native device or extra packages.
function hooks() {
  const slots = []; let cursor = 0, effects = [], mounted = false, queued = false, renderFn, value;
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => v !== b[i]);
  const render = () => {
    cursor = 0; effects = []; value = renderFn();
    for (const effect of effects) effect();
  };
  const schedule = () => {
    if (!mounted || queued) return;
    queued = true; queueMicrotask(() => { queued = false; if (mounted) render(); });
  };
  const React = {
    createContext: value => ({ value, Provider: 'Provider' }),
    useContext: context => context.value,
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useState(initial) {
      const i = cursor++; slots[i] ||= { value: initial };
      return [slots[i].value, next => { const resolved = typeof next === 'function' ? next(slots[i].value) : next;
        if (resolved !== slots[i].value) { slots[i].value = resolved; schedule(); } }];
    },
    useMemo(factory, deps) { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { deps, value: factory() }; return slots[i].value; },
    useCallback(fn, deps) { return React.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = cursor++; const previous = slots[i];
      if (!previous || changed(previous.deps, deps)) {
        slots[i] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  return { React, jsx: { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    mount(fn) { renderFn = fn; mounted = true; render(); }, update: render,
    get value() { return value?.props?.value ?? value; },
    unmount() { mounted = false; slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('AuthProvider deduplicates logout, ignores old-session errors and waits for clearing before sign-in', async () => {
  const h = hooks(); let listener, sessionListener, clearCount = 0, completeClear;
  const session = {
    loadSession: async () => ({ token: 'session-a', user: {} }),
    clearSession: () => { clearCount++; return new Promise(resolve => { completeClear = resolve; }); },
    saveSession: async token => ({ token, user: {} }), saveSessionUser: async user => ({ token: 'session-a', user }),
    subscribeToSession: fn => { sessionListener = fn; return () => {}; },
  };
  const { AuthProvider } = load('providers/AuthProvider.tsx', {
    react: h.React, 'react/jsx-runtime': h.jsx, '../utils/session': session,
    '../utils/api': { subscribeToAuthFailure: fn => { listener = fn; return () => {}; } },
  });
  h.mount(() => AuthProvider({ children: null })); await tick();
  assert.equal(h.value.token, 'session-a');
  listener('older-session'); await tick(); assert.equal(clearCount, 0);
  listener('session-a'); listener('session-a'); await tick();
  assert.equal(clearCount, 1); assert.equal(h.value.status, 'anonymous');
  sessionListener({ token: 'session-a', user: {} }); await tick();
  assert.equal(h.value.token, '', 'Stale storage events must not restore an invalid session');
  const login = h.value.signIn('session-b');
  completeClear(); await login; await tick();
  listener('session-a'); await tick();
  assert.equal(h.value.token, 'session-b'); assert.equal(clearCount, 1);
  h.unmount();
});

class FakeSocket extends EventEmitter {
  constructor(options) { super(); this.auth = options.auth; this.connected = false; this.sent = []; this.sequence = 0; }
  connect() {
    if (!this.connected) { this.connected = true; this.id = 'connection-' + ++this.sequence; super.emit('connect'); }
    return this;
  }
  disconnect() { this.connected = false; super.emit('disconnect'); return this; }
  timeout() { return { emit: (event, ...args) => {
    const ack = args.pop(); this.sent.push([event, ...args]);
    queueMicrotask(() => ack(null, { ok: true }));
  } }; }
  emit(event, ...args) { this.sent.push([event, ...args]); return true; }
}

test('SocketProvider rejoins active rooms once per connection, respects owners, offline leaves and logout', async () => {
  const h = hooks(); const auth = { token: 'session-a' }; const sockets = [];
  const { SocketProvider } = load('providers/SocketProvider.tsx', {
    react: h.React, 'react/jsx-runtime': h.jsx, '../config/backend': backend,
    './AuthProvider': { useAuth: () => auth },
    'socket.io-client': { io: (_url, options) => { const socket = new FakeSocket(options); sockets.push(socket); return socket; } },
  });
  h.mount(() => SocketProvider({ children: null }));
  await h.value.joinConversation('chat-a'); await h.value.joinConversation('chat-a'); await h.value.joinCita('cita-a');
  const socket = sockets[0];
  assert.equal(socket.sent.filter(([event]) => event === 'join:conversation').length, 1);
  h.value.leaveConversation('chat-a'); // Still one active owner.
  socket.disconnect(); socket.connect(); await tick();
  assert.equal(socket.sent.filter(([event]) => event === 'join:conversation').length, 2);
  assert.equal(socket.sent.filter(([event]) => event === 'join:cita').length, 2);
  socket.disconnect(); h.value.leaveConversation('chat-a'); h.value.leaveCita('cita-a');
  const count = socket.sent.length; socket.connect(); await tick(); assert.equal(socket.sent.length, count);
  await h.value.joinCita('cita-b');
  auth.token = ''; h.update(); await tick();
  assert.equal(socket.connected, false); assert.equal(socket.listenerCount('connect'), 0);
  auth.token = 'session-b'; h.update(); await h.value.ensureConnected(); await tick();
  assert.equal(sockets[1].sent.length, 0, 'No rooms from a previous session are restored');
  h.unmount();
});

test('useSocketRoom leaves on resource change, disable, logout and unmount', async () => {
  const h = hooks(); const auth = { token: 'a' }; const events = [];
  const methods = {
    joinConversation: async id => { events.push('join:' + id); return { ok: true }; },
    leaveConversation: id => events.push('leave:' + id), joinCita: async () => ({ ok: true }), leaveCita() {},
  };
  const { useSocketRoom } = load('hooks/useSocketRoom.ts', {
    react: h.React, '../providers/AuthProvider': { useAuth: () => auth }, '../providers/SocketProvider': { useSocket: () => methods },
  });
  let room = 'a', enabled = true;
  h.mount(() => useSocketRoom('conversation', room, enabled));
  room = 'b'; h.update(); enabled = false; h.update(); enabled = true; h.update();
  auth.token = ''; h.update(); h.unmount(); await tick();
  assert.deepEqual(events, ['join:a', 'leave:a', 'join:b', 'leave:b', 'join:b', 'leave:b']);
});

test('the root session observer resets navigation to Login once when authentication is lost', () => {
  const h = hooks(); const auth = { isReady: false, isAuthenticated: false }; const resets = [];
  const navigation = { reset: state => resets.push(state) };
  const source = fs.readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
  const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'SessionRedirect');
  assert.ok(node);
  const code = ts.transpileModule(node.getText(ast) + '\nSessionRedirect;', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const observer = vm.runInNewContext(code, {
    useRef: h.React.useRef, useEffect: h.React.useEffect, useAuth: () => auth, useNavigation: () => navigation,
  });
  h.mount(observer); auth.isReady = true; h.update();
  assert.equal(resets.length, 0, 'Public registration/login flows must remain usable');
  auth.isAuthenticated = true; h.update(); auth.isAuthenticated = false; h.update(); h.update();
  assert.equal(resets.length, 1); assert.equal(resets[0].routes[0].name, 'Login'); assert.equal(resets[0].index, 0);
  h.unmount();
});
