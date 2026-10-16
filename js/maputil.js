// OpenStreetMap embed URL builder (pure; embedded into exported apps via Function#toString).
export function osmUrl(lat, lon, zoom, marker) {
  lat = Number(lat) || 0; lon = Number(lon) || 0; zoom = Math.min(18, Math.max(1, Number(zoom) || 12));
  const dx = 360 / Math.pow(2, zoom) * 1.6, dy = dx * 0.6;
  const bbox = [lon - dx, lat - dy, lon + dx, lat + dy].map((v) => v.toFixed(5)).join(',');
  return 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox + '&layer=mapnik' + (marker ? '&marker=' + lat + ',' + lon : '');
}
