// Generators that are pure data (Generator Definitions, see sdk/presets.js). Each line = one generator, no generator code.
import { defineDeclarativeGenerator } from '../sdk/declarative.js';
import { PRESETS } from '../sdk/presets.js';
import './bot/blocks.js';

const ORDER = ['python', 'nodejs', 'javascript', 'typescript', 'godot', 'vscode', 'discord', 'staticWeb', 'htmlCss', 'viteWeb'];
ORDER.forEach((key, i) => defineDeclarativeGenerator({ ...PRESETS[key], order: 3 + i / 10 }));
