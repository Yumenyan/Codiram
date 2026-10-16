// Web target: the original Codiram generator (blocks -> HTML / CSS / JS), wrapped in the Target interface.
import { registerTarget } from '../registry.js';
import { J } from '../i18n-helpers.js';
import { generate, bundleInline } from '../generator.js';

registerTarget({
  id: 'web', order: 0,
  name: J('Web アプリ', 'Web app'),
  icon: '🌐',
  desc: J('HTML / CSS / JavaScript の Web アプリ・ブラウザゲーム', 'HTML / CSS / JavaScript web app or browser game'),
  views: ['design', 'data', 'logic', 'preview'],
  defaultConfig: () => ({ type: 'web' }),
  configFields: [],
  generate: (project) => ({ files: generate(project), problems: [], root: null }),
  bundleInline,
});
