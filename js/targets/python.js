// Python CLI: the first generator that is pure data (see sdk/declarative.js and sdk/presets.js). No generator code at all.
import { defineDeclarativeGenerator } from '../sdk/declarative.js';
import { PRESETS } from '../sdk/presets.js';

defineDeclarativeGenerator({ ...PRESETS.python, order: 3 });
