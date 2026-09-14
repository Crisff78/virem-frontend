// Exercise the actual recipe builders without mounting React Native.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadBuilder(filename) {
  const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let escapeNode, builderNode;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'escapeHTML') escapeNode = node;
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'buildDocumentHTML') builderNode = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(escapeNode && builderNode);
  const code = `${escapeNode.getText(ast)}\nconst ${builderNode.getText(ast)};\n({ escapeHTML, buildDocumentHTML });`;
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020 } });
  const attack = `<img src=x onerror="alert('xss')">&<script>alert(1)</script>`;
  const functions = vm.runInNewContext(compiled.outputText, { doctorName: attack, doctorSpec: attack });
  return { ...functions, attack };
}

for (const filename of ['MedicoRecetasScreen.tsx', 'PacienteRecetasDocumentosScreen.tsx']) {
  test(`${filename}: all five dangerous characters are escaped without losing text`, () => {
    const { escapeHTML } = loadBuilder(filename);
    assert.equal(escapeHTML(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
    assert.equal(escapeHTML('Muñoz & Pérez'), 'Muñoz &amp; Pérez');
    assert.equal(escapeHTML(null), '');
    assert.equal(escapeHTML('&lt;script&gt;'), '&amp;lt;script&amp;gt;');
  });

  test(`${filename}: stored XSS payloads remain text throughout the printed recipe`, () => {
    const { buildDocumentHTML, escapeHTML, attack } = loadBuilder(filename);
    const meds = [{ nombre: attack, dosis: attack, frecuencia: attack, duracion: attack }];
    const html = filename.startsWith('Medico')
      ? buildDocumentHTML({ recetaid: attack, paciente_nombre: attack, diagnostico: attack,
          created_at: '2026-09-14', instrucciones: attack, medicamentos_json: meds })
      : buildDocumentHTML({ title: attack, doctor: attack, date: attack, diagnostico: attack,
          instrucciones: attack, medicamentos: meds });
    assert.ok(!html.includes('<img'), 'No attacker-controlled image/handler is inserted');
    assert.ok(!html.includes('<script>alert(1)</script>'), 'No attacker script is inserted');
    assert.ok(html.includes(escapeHTML(attack)), 'Clinical text is escaped, not removed');
    assert.equal((html.match(/<script>/g) || []).length, 1, 'Only the static print script remains');
    assert.ok(html.includes('<table>') && html.includes('<tr>'), 'Trusted document markup stays usable');
    assert.ok(html.includes('<html>') && html.includes('</html>'));
  });
}

test('login delegates challenge handling to the server and carries no webhook or local OTP comparison', () => {
  const source = fs.readFileSync(path.join(__dirname, '../LoginScreen.tsx'), 'utf8');
  assert.ok(!/hook\.[^\s]*make\.com|MAKE_WEBHOOK_URL|generatedCode|isAdminCredentials|Math\.random\(/.test(source));
  assert.ok(!/password\s*===\s*['"]/.test(source));
  assert.ok(source.includes('otp: adminCodeInput, mfaChallengeId'));
  assert.ok(source.indexOf('if (data?.mfaRequired)') < source.indexOf('await signIn('));
});
