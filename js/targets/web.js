// Web generator — the REFERENCE generator: the smallest complete example of the Generator SDK.
// To add a target, copy this shape: manifest + capabilities + views/config + generate() + verify spec (+ a golden test).
// (This one has engine 'blocks': it generates JavaScript straight from the blocks. IR-based examples: ./rust/index.js)
import { defineGenerator } from '../sdk/index.js';
import { J } from '../i18n-helpers.js';
import { generate, bundleInline } from '../generator.js';

defineGenerator({
  id: 'web', order: 0, engine: 'blocks',
  name: J('Web アプリ', 'Web app'),
  icon: '🌐',
  desc: J('HTML / CSS / JavaScript の Web アプリ・ブラウザゲーム', 'HTML / CSS / JavaScript web app or browser game'),
  version: '1.0.0', language: ['html', 'css', 'javascript'], platforms: ['browser'],
  supports: ['ui', 'events', 'variables', 'conditions', 'loops', 'functions', 'arrays', 'objects', 'data', 'localstorage', 'canvas', 'audio', 'game', 'animation', 'http', 'websocket', 'clipboard', 'notification'],
  views: ['design', 'data', 'logic', 'preview'],
  defaultConfig: () => ({ type: 'web' }),
  configFields: [],
  generate: (project, cfg) => ({ files: generate(project, { htmlOnly: !!cfg?.htmlOnly }), problems: [], root: null, entry: 'index.html' }),
  bundleInline,
  verify: { requiredFiles: ['index.html', 'style.css', 'app.js'], contains: { 'index.html': ['app.js'] }, syntax: { js: ['app.js'] } },
});
