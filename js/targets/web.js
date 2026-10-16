// Web generator: the original Codiram generator (blocks -> HTML / CSS / JS), registered through the Generator SDK.
import { defineGenerator } from '../sdk/index.js';
import { J } from '../i18n-helpers.js';
import { generate, bundleInline } from '../generator.js';

defineGenerator({
  id: 'web', order: 0, engine: 'blocks',
  name: J('Web アプリ', 'Web app'),
  icon: '🌐',
  desc: J('HTML / CSS / JavaScript の Web アプリ・ブラウザゲーム', 'HTML / CSS / JavaScript web app or browser game'),
  version: '1.0.0', language: ['html', 'css', 'javascript'], platforms: ['browser'],
  supports: ['ui', 'events', 'variables', 'conditions', 'loops', 'functions', 'data', 'canvas', 'audio', 'game', 'animation', 'http', 'websocket', 'clipboard', 'notification'],
  views: ['design', 'data', 'logic', 'preview'],
  defaultConfig: () => ({ type: 'web' }),
  configFields: [],
  generate: (project) => ({ files: generate(project), problems: [], root: null }),
  bundleInline,
});
