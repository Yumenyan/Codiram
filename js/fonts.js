// Font catalogue: built-in (system) stacks and Google Fonts. Pure data/strings (also used under Node).
export const BUILTIN_FONTS = [
  { id: '@sans', ja: 'ゴシック体(システム標準)', en: 'Sans-serif (system)', css: 'system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", Meiryo, sans-serif' },
  { id: '@serif', ja: '明朝体(システム標準)', en: 'Serif (system)', css: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", Georgia, "Times New Roman", serif' },
  { id: '@rounded', ja: '丸ゴシック(システム標準)', en: 'Rounded (system)', css: '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "M PLUS Rounded 1c", system-ui, sans-serif' },
  { id: '@mono', ja: '等幅', en: 'Monospace', css: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace' },
  { id: '@yugothic', ja: '游ゴシック', en: 'Yu Gothic', css: '"Yu Gothic", YuGothic, "Hiragino Sans", Meiryo, sans-serif' },
  { id: '@meiryo', ja: 'メイリオ', en: 'Meiryo', css: 'Meiryo, "Hiragino Sans", sans-serif' },
  { id: '@arial', ja: 'Arial / Helvetica', en: 'Arial / Helvetica', css: 'Arial, Helvetica, sans-serif' },
  { id: '@georgia', ja: 'Georgia', en: 'Georgia', css: 'Georgia, "Times New Roman", serif' },
  { id: '@cursive', ja: '手書き風(システム)', en: 'Cursive (system)', css: '"Comic Sans MS", "Hiragino Maru Gothic ProN", cursive' },
];

// w: weights available on Google Fonts (single weight => no wght axis requested)
export const GOOGLE_FONTS = [
  { n: 'Noto Sans JP', w: [400, 700], c: 'sans-serif', jp: 1 }, { n: 'Noto Serif JP', w: [400, 700], c: 'serif', jp: 1 },
  { n: 'M PLUS Rounded 1c', w: [400, 700], c: 'sans-serif', jp: 1 }, { n: 'M PLUS 1p', w: [400, 700], c: 'sans-serif', jp: 1 },
  { n: 'Zen Maru Gothic', w: [400, 700], c: 'sans-serif', jp: 1 }, { n: 'Zen Kaku Gothic New', w: [400, 700], c: 'sans-serif', jp: 1 },
  { n: 'BIZ UDPGothic', w: [400, 700], c: 'sans-serif', jp: 1 }, { n: 'Shippori Mincho', w: [400, 700], c: 'serif', jp: 1 },
  { n: 'Kaisei Decol', w: [400, 700], c: 'serif', jp: 1 }, { n: 'Kosugi Maru', w: [400], c: 'sans-serif', jp: 1 },
  { n: 'Kosugi', w: [400], c: 'sans-serif', jp: 1 }, { n: 'Sawarabi Gothic', w: [400], c: 'sans-serif', jp: 1 },
  { n: 'Sawarabi Mincho', w: [400], c: 'serif', jp: 1 }, { n: 'Klee One', w: [400], c: 'cursive', jp: 1 },
  { n: 'Dela Gothic One', w: [400], c: 'sans-serif', jp: 1 }, { n: 'DotGothic16', w: [400], c: 'sans-serif', jp: 1 },
  { n: 'Potta One', w: [400], c: 'cursive', jp: 1 }, { n: 'Hachi Maru Pop', w: [400], c: 'cursive', jp: 1 },
  { n: 'Yusei Magic', w: [400], c: 'sans-serif', jp: 1 }, { n: 'RocknRoll One', w: [400], c: 'sans-serif', jp: 1 },
  { n: 'Reggae One', w: [400], c: 'sans-serif', jp: 1 }, { n: 'Yomogi', w: [400], c: 'cursive', jp: 1 },
  { n: 'Roboto', w: [400, 700], c: 'sans-serif' }, { n: 'Open Sans', w: [400, 700], c: 'sans-serif' },
  { n: 'Lato', w: [400, 700], c: 'sans-serif' }, { n: 'Montserrat', w: [400, 700], c: 'sans-serif' },
  { n: 'Poppins', w: [400, 700], c: 'sans-serif' }, { n: 'Inter', w: [400, 700], c: 'sans-serif' },
  { n: 'Nunito', w: [400, 700], c: 'sans-serif' }, { n: 'Raleway', w: [400, 700], c: 'sans-serif' },
  { n: 'Oswald', w: [400, 700], c: 'sans-serif' }, { n: 'Bebas Neue', w: [400], c: 'sans-serif' },
  { n: 'Orbitron', w: [400, 700], c: 'sans-serif' }, { n: 'Playfair Display', w: [400, 700], c: 'serif' },
  { n: 'Merriweather', w: [400, 700], c: 'serif' }, { n: 'Lora', w: [400, 700], c: 'serif' },
  { n: 'Roboto Mono', w: [400, 700], c: 'monospace' }, { n: 'Source Code Pro', w: [400, 700], c: 'monospace' },
  { n: 'Fira Code', w: [400, 700], c: 'monospace' }, { n: 'Press Start 2P', w: [400], c: 'monospace' },
  { n: 'Pacifico', w: [400], c: 'cursive' }, { n: 'Lobster', w: [400], c: 'cursive' }, { n: 'Caveat', w: [400, 700], c: 'cursive' },
];

const builtin = (v) => BUILTIN_FONTS.find((f) => f.id === v);
const google = (v) => GOOGLE_FONTS.find((f) => f.n === v);
export const isGoogleFont = (v) => !!v && !String(v).startsWith('@');

/** CSS font-family value for a stored font value ('@id' built-in, otherwise a Google Fonts family). */
export function fontStack(v) {
  if (!v) return '';
  if (builtin(v)) return builtin(v).css;
  if (String(v).startsWith('@')) return '';
  const g = google(v);
  return `"${v}", ${g ? g.c : 'sans-serif'}`;
}

/** <link> URL that loads every Google font used by the given values (or '' if none). */
export function googleFontsUrl(values) {
  const fams = [...new Set(values.filter(isGoogleFont))];
  if (!fams.length) return '';
  const parts = fams.map((n) => {
    const g = google(n);
    const name = encodeURIComponent(n).replace(/%20/g, '+');
    return g && g.w.length > 1 ? `family=${name}:wght@${g.w.join(';')}` : `family=${name}`;
  });
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
}
