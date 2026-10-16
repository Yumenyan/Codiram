// Tiny PNG encoder (RGBA, uncompressed deflate) + procedural 16x16 Minecraft-style textures.
import { crc32 } from './zip.js';

const be32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const cat = (...arrs) => { const out = new Uint8Array(arrs.reduce((s, a) => s + a.length, 0)); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; };
const chunk = (type, data) => { const t = new TextEncoder().encode(type); return cat(be32(data.length), t, data, be32(crc32(cat(t, data)))); };

export function encodePng(w, h, rgba) {
  const raw = new Uint8Array(h * (1 + w * 4));
  for (let y = 0; y < h; y++) { raw[y * (1 + w * 4)] = 0; raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (1 + w * 4) + 1); }
  let a = 1, b = 0;
  for (const v of raw) { a = (a + v) % 65521; b = (b + a) % 65521; }
  const blocks = [];
  for (let i = 0; i < raw.length; i += 65535) {
    const part = raw.subarray(i, Math.min(raw.length, i + 65535)), last = i + 65535 >= raw.length ? 1 : 0, n = part.length;
    blocks.push(new Uint8Array([last, n & 255, n >> 8, ~n & 255, (~n >> 8) & 255]), part);
  }
  const zlib = cat(new Uint8Array([0x78, 0x01]), ...blocks, be32(((b << 16) | a) >>> 0));
  const ihdr = cat(be32(w), be32(h), new Uint8Array([8, 6, 0, 0, 0]));
  return cat(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib), chunk('IEND', new Uint8Array(0)));
}

const parseColor = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); const n = m ? parseInt(m[1], 16) : 0x888888; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hash = (seed, x, y) => { let h = seed ^ (x * 374761393) ^ (y * 668265263); h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));

/** 16x16 texture: kind 'block' = noisy tile with dark border, 'item' = gem-like icon on transparent background */
export function texturePng(color, kind, seedText = '') {
  const base = parseColor(color), px = new Uint8Array(16 * 16 * 4);
  let seed = 0;
  for (const ch of String(seedText)) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  const put = (x, y, c, a = 255) => { const i = (y * 16 + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = a; };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (kind === 'block') {
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      put(x, y, shade(base, edge ? 0.7 : 0.9 + hash(seed, x, y) * 0.2));
    } else {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      if (d > 7) continue;
      put(x, y, shade(base, d > 6 ? 0.6 : x + y < 14 && d < 4 ? 1.25 : 0.95 - d * 0.02));
    }
  }
  return encodePng(16, 16, px);
}
