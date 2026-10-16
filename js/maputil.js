// Map tiles without any embed: a grid of tile images + a marker, positioned with Web-Mercator math.
// (The old OpenStreetMap iframe returned 403 in previews and file:// exports because it was loaded without a Referer.)
// Pure functions: embedded into exported apps via Function#toString.
export const TILE_PROVIDERS = {
  carto: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', // needs a real Referer (works when the app is served over http(s))
  'osm-de': 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
};
export const ATTRIBUTION = '© OpenStreetMap contributors © CARTO';

/** tiles needed to fill a w x h box centred on lat/lon at the zoom level: { tiles:[{url,left,top}], marker:{left,top} } */
export function mapTiles(lat, lon, zoom, w, h, template) {
  lat = Math.max(-85, Math.min(85, Number(lat) || 0)); lon = Number(lon) || 0;
  zoom = Math.min(18, Math.max(1, Math.round(Number(zoom) || 12)));
  const n = Math.pow(2, zoom), rad = lat * Math.PI / 180;
  const xt = (lon + 180) / 360 * n, yt = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n;
  const tiles = [];
  for (let ty = Math.floor(yt - h / 512); ty <= Math.floor(yt + h / 512); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(xt - w / 512); tx <= Math.floor(xt + w / 512); tx++) {
      const wx = ((tx % n) + n) % n;
      tiles.push({ url: template.replace('{s}', 'a').replace('{z}', zoom).replace('{x}', wx).replace('{y}', ty), left: Math.round((tx - xt) * 256 + w / 2), top: Math.round((ty - yt) * 256 + h / 2) });
    }
  }
  return { tiles, marker: { left: Math.round(w / 2), top: Math.round(h / 2) } };
}

/** draws / redraws the map inside el (a .cx-map element carrying data-lat / data-lon / data-zoom / data-marker / data-tiles) */
export function drawMap(el) {
  const d = el.dataset, w = el.clientWidth || 640, h = el.clientHeight || 320;
  const m = mapTiles(d.lat, d.lon, d.zoom, w, h, d.tiles);
  el.textContent = '';
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;inset:0;overflow:hidden;cursor:grab';
  el.style.position = 'relative'; el.style.overflow = 'hidden'; el.style.touchAction = 'none';
  for (const t of m.tiles) {
    const img = document.createElement('img');
    img.src = t.url; img.alt = ''; img.draggable = false; img.referrerPolicy = 'origin-when-cross-origin';
    img.style.cssText = 'position:absolute;width:256px;height:256px;left:' + t.left + 'px;top:' + t.top + 'px;max-width:none';
    box.append(img);
  }
  if (d.marker === 'true') {
    const pin = document.createElement('div');
    pin.textContent = '📍'; pin.style.cssText = 'position:absolute;font-size:28px;line-height:1;transform:translate(-50%,-100%);left:' + m.marker.left + 'px;top:' + m.marker.top + 'px';
    box.append(pin);
  }
  const zoom = (dz) => { d.zoom = Math.min(18, Math.max(1, (Number(d.zoom) || 12) + dz)); drawMap(el); };
  const btn = (label, dz, top) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-label', dz > 0 ? 'zoom in' : 'zoom out'); b.style.cssText = 'position:absolute;right:8px;top:' + top + 'px;width:30px;height:30px;border:1px solid #9ca3af;border-radius:6px;background:#fff;font-size:18px;cursor:pointer'; b.onclick = () => zoom(dz); return b; };
  const credit = document.createElement('div');
  credit.textContent = d.credit || ''; credit.style.cssText = 'position:absolute;right:4px;bottom:2px;font:10px sans-serif;background:rgba(255,255,255,.75);padding:0 4px';
  if (!el._pan) { // pan handlers live on the persistent element, so redrawing does not interrupt a drag
    el._pan = true;
    let sx = 0, sy = 0, dragging = false;
    el.onpointerdown = (e) => { if (e.target.tagName === 'BUTTON') return; dragging = true; sx = e.clientX; sy = e.clientY; el.setPointerCapture(e.pointerId); };
    el.onpointermove = (e) => {
      if (!dragging) return;
      const px = 256 * Math.pow(2, Number(d.zoom) || 12), la = Number(d.lat) * Math.PI / 180;
      const yp = (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * px - (e.clientY - sy);
      d.lon = Number(d.lon) - (e.clientX - sx) / px * 360;
      d.lat = Math.max(-85, Math.min(85, Math.atan(Math.sinh(Math.PI * (1 - 2 * yp / px))) * 180 / Math.PI));
      sx = e.clientX; sy = e.clientY; drawMap(el);
    };
    el.onpointerup = () => { dragging = false; };
  }
  el.append(box, btn('+', 1, 8), btn('−', -1, 42), credit);
}
