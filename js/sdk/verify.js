// Verification of generated projects. A generator declares WHAT must hold (data); the test harness decides HOW to run it.
//
//   verify: {
//     requiredFiles: ['src/main.rs', 'Cargo.toml'],
//     contains: { 'src/main.rs': [/fn main\(\)/] },
//     json: ['package.json'],                       // must parse
//     syntax: { js: ['src/app.js'] },                // language syntax checks (provided by the runner)
//     build: { tool: 'cargo', args: ['build', '--offline'] },   // optional real build, run only where the tool exists
//   }
export function verifyGenerated(result, spec = {}, { syntax = {} } = {}) {
  const errors = [], files = result.files || {};
  for (const f of spec.requiredFiles || []) if (!(f in files)) errors.push(`missing file: ${f}`);
  for (const [f, pats] of Object.entries(spec.contains || {})) {
    for (const p of pats) {
      const text = typeof files[f] === 'string' ? files[f] : '';
      if (!(p instanceof RegExp ? p.test(text) : text.includes(p))) errors.push(`${f}: missing ${p}`);
    }
  }
  for (const f of spec.json || []) { try { JSON.parse(files[f]); } catch (e) { errors.push(`${f}: invalid JSON (${e.message})`); } }
  for (const [lang, list] of Object.entries(spec.syntax || {})) {
    const check = syntax[lang];
    if (check) for (const f of list) { try { check(files[f], f); } catch (e) { errors.push(`${f}: ${lang} syntax error (${e.message})`); } }
  }
  for (const p of result.problems || []) if (p.level !== 'info') errors.push(`problem: ${p.msg}`);
  return errors;
}
