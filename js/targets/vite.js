// Web (Vite): a project generator defined purely by data (sdk/presets.js): scaffold files around the Web generator's output.
import { defineDeclarativeGenerator } from '../sdk/declarative.js';
import { PRESETS } from '../sdk/presets.js';

defineDeclarativeGenerator({ ...PRESETS.viteWeb, order: 4 });
