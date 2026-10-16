// Pure canvas chart renderer. Used by the editor and (via Function#toString) embedded into exported apps,
// so it must not reference anything outside itself.
export function drawChart(canvas, rows, o) {
  const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const palette = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#dc2626', '#ca8a04', '#db2777'];
  c.clearRect(0, 0, W, H);
  c.font = '12px system-ui, sans-serif';
  c.textBaseline = 'middle';
  let top = 10;
  if (o.title) { c.fillStyle = '#1f2328'; c.font = 'bold 14px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(o.title, W / 2, 14); top = 30; c.font = '12px system-ui, sans-serif'; }
  if (!rows.length) { c.fillStyle = '#9aa3b2'; c.textAlign = 'center'; c.fillText('(no data)', W / 2, H / 2); return; }
  const vals = rows.map((r) => Number(r.value) || 0);
  const color = o.color || palette[0];
  if (o.kind === 'pie') {
    const total = vals.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const r = Math.min(W * 0.3, (H - top) / 2 - 8), cx = W * 0.35, cy = top + (H - top) / 2;
    let a0 = -Math.PI / 2;
    rows.forEach((row, i) => {
      const a1 = a0 + (Math.max(0, vals[i]) / total) * Math.PI * 2;
      c.fillStyle = palette[i % palette.length];
      c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, a0, a1); c.closePath(); c.fill();
      a0 = a1;
      c.fillStyle = palette[i % palette.length]; c.fillRect(W * 0.62, top + 8 + i * 20, 12, 12);
      c.fillStyle = '#1f2328'; c.textAlign = 'left'; c.fillText(String(row.label) + ' (' + Math.round(vals[i] / total * 100) + '%)', W * 0.62 + 18, top + 14 + i * 20);
    });
    return;
  }
  const L = 44, R = 12, B = 28, pw = W - L - R, ph = H - top - B;
  const max = Math.max(...vals, 0), min = Math.min(...vals, 0), span = (max - min) || 1;
  const y = (v) => top + ph - ((v - min) / span) * ph;
  c.strokeStyle = '#d9dde5'; c.fillStyle = '#6b7280'; c.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = min + (span * i) / 4, yy = y(v);
    c.beginPath(); c.moveTo(L, yy); c.lineTo(W - R, yy); c.stroke();
    c.fillText(Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : String(Math.round(v * 100) / 100), L - 6, yy);
  }
  const step = pw / rows.length;
  c.textAlign = 'center';
  rows.forEach((row, i) => { c.fillStyle = '#6b7280'; c.fillText(String(row.label).slice(0, 8), L + step * (i + 0.5), H - B / 2); });
  if (o.kind === 'line') {
    c.strokeStyle = color; c.lineWidth = 2; c.beginPath();
    vals.forEach((v, i) => { const x = L + step * (i + 0.5); i ? c.lineTo(x, y(v)) : c.moveTo(x, y(v)); });
    c.stroke();
    c.fillStyle = color;
    vals.forEach((v, i) => { c.beginPath(); c.arc(L + step * (i + 0.5), y(v), 3.5, 0, Math.PI * 2); c.fill(); });
  } else {
    const bw = Math.min(48, step * 0.6), zero = y(0);
    vals.forEach((v, i) => { c.fillStyle = o.color || palette[i % palette.length]; const x = L + step * (i + 0.5) - bw / 2; c.fillRect(x, Math.min(zero, y(v)), bw, Math.abs(zero - y(v)) || 1); });
  }
}
