const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../..', file), 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, console, setTimeout, clearTimeout, setInterval, clearInterval,
    AbortController, Headers, Response, URLSearchParams, TextDecoder, Blob, FormData, URL, performance,
    require(name) { if (!(name in dependencies)) throw new Error('Unexpected import: ' + name); return dependencies[name]; },
    ...globals,
  }, { filename: file });
  return module.exports;
}
function hooks() {
  const slots = []; let cursor = 0, effects = [], mounted = false, queued = false, renderFn, value;
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => v !== b[i]);
  const render = () => { cursor = 0; effects = []; value = renderFn(); for (const effect of effects) effect(); };
  const schedule = () => {
    if (!mounted || queued) return;
    queued = true; queueMicrotask(() => { queued = false; if (mounted) render(); });
  };
  const React = {
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
  return { React, mount(fn) { renderFn = fn; mounted = true; render(); }, update: render,
    get value() { return value; }, unmount() { mounted = false; slots.forEach(slot => slot?.cleanup?.()); } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
module.exports = { load, hooks, tick, deferred };
