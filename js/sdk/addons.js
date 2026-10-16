// Add-ons: extra files added to ANY generator's output (GitHub Actions, ...). Chosen at Export time.
import { cm } from '../comments.js';

export const ADDONS = new Map();
export const registerAddon = (def) => ADDONS.set(def.id, def);

const PAGES = (t, { build = false } = {}) => `${t('# GitHub Pages に公開する(Settings → Pages → Source: GitHub Actions)', '# Publishes to GitHub Pages (Settings → Pages → Source: GitHub Actions)')}
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
${build ? `      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
` : ''}      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ${build ? 'dist' : '.'}
      - id: deployment
        uses: actions/deploy-pages@v4
`;

const RUN = (t, name, setup, run) => `${t('# main ブランチへの push / PR で実行する', '# Runs on pushes and pull requests')}
name: ${name}
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${setup}${run.map((r) => `      - run: ${r}\n`).join('')}`;

const TAURI = (t) => `${t('# Windows / macOS / Linux 向けにビルドする', '# Builds for Windows, macOS and Linux')}
name: Build desktop app
on:
  push:
    tags: ['v*']
  workflow_dispatch:
jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-22.04, macos-latest, windows-latest]
    runs-on: \${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: dtolnay/rust-toolchain@stable
      - name: Linux dependencies
        if: matrix.os == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf
      - run: npm install
      - run: npm run icon
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: app-\${{ matrix.os }}
          path: src-tauri/target/release/bundle/
`;

const SETUP = {
  node: '      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n',
  python: '      - uses: actions/setup-python@v5\n        with:\n          python-version: "3.12"\n',
  cargo: '      - uses: dtolnay/rust-toolchain@stable\n',
  nasm: '      - run: sudo apt-get update && sudo apt-get install -y nasm\n',
};

/** { path, content } for the generator, or null */
export function workflowFor(gen, project) {
  const t = cm(project), id = gen.id;
  if (['web', 'static-web', 'html-css'].includes(id)) return { path: '.github/workflows/pages.yml', content: PAGES(t) };
  if (id === 'vite-web') return { path: '.github/workflows/pages.yml', content: PAGES(t, { build: true }) };
  if (id === 'desktop') return { path: '.github/workflows/build.yml', content: TAURI(t) };
  if (id === 'rust-cli') return { path: '.github/workflows/ci.yml', content: RUN(t, 'CI', SETUP.cargo, ['cargo build --release', 'cargo run --quiet']) };
  if (id === 'os-bootloader') return { path: '.github/workflows/ci.yml', content: RUN(t, 'CI', SETUP.nasm, ['make boot.img']) };
  const run = gen.verify?.run;
  const jsFiles = gen.verify?.syntax?.js;
  if (!run && jsFiles?.length) return { path: '.github/workflows/ci.yml', content: RUN(t, 'CI', SETUP.node, jsFiles.map((f) => `node --check ${f}`)) };
  if (!run) return null;
  const kind = { node: 'node', python3: 'python', cargo: 'cargo' }[run.tool];
  if (!kind) return null;
  const cmd = [run.tool === 'python3' ? 'python3' : run.tool, ...run.args].join(' ');
  return { path: '.github/workflows/ci.yml', content: RUN(t, 'CI', SETUP[kind], [kind === 'node' && ['rest-api', 'node-server'].includes(id) ? 'npm test' : cmd]) };
}

registerAddon({
  id: 'github-actions', name: { ja: 'GitHub Actions のワークフロー', en: 'GitHub Actions workflow' }, caps: ['ci'],
  desc: { ja: '.github/workflows/ にこのプロジェクト向けの CI / 公開用ワークフローを追加します', en: 'Adds a CI / deploy workflow for this project under .github/workflows/' },
  applies: (gen) => !!workflowFor(gen, { settings: {} }),
  apply(files, { gen, project }) {
    const wf = workflowFor(gen, project);
    if (wf) files[wf.path] = wf.content;
    return files;
  },
});
