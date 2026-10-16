// Every built-in generator. A new generator is one more import here (or, later, an external generator plugin).
import './web.js';
import './desktop/index.js';
import './rust/index.js';
import './builtin-definitions.js';
import './minecraft/index.js'; // paused (hidden from the target list); kept for existing Minecraft projects
import './data/sql.js';
import './data/pipeline.js';
import './data/rest.js';
import './os/index.js';
