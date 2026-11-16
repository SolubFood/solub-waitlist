// Builds assets/data/solubcard-countries.json: the country shapes the SolubCard draws.
// Source: Natural Earth 1:50m (public domain) via the "world-atlas" npm package.
// Run once when the country list changes (not part of build.sh):
//   npm install --no-save world-atlas@2.0.2 topojson-client@3.1.0
//   node tools/build-card-data.js
// Each country is pre-projected and fitted to the card (240 x 360 units), so the browser only draws paths.
const fs = require('fs');
const path = require('path');
const topojson = require('topojson-client');
const topo = require('world-atlas/countries-50m.json');

// [code, name on the card, Natural Earth name, capital lat, capital lon]
const COUNTRIES = [
  ['ar', 'Argentina', 'Argentina', -34.60, -58.38], ['bo', 'Bolivia', 'Bolivia', -16.50, -68.15],
  ['br', 'Brasil', 'Brazil', -15.79, -47.88], ['cl', 'Chile', 'Chile', -33.45, -70.67],
  ['co', 'Colombia', 'Colombia', 4.71, -74.07], ['cr', 'Costa Rica', 'Costa Rica', 9.93, -84.08],
  ['cu', 'Cuba', 'Cuba', 23.11, -82.37], ['ec', 'Ecuador', 'Ecuador', -0.18, -78.47],
  ['sv', 'El Salvador', 'El Salvador', 13.69, -89.22], ['gt', 'Guatemala', 'Guatemala', 14.63, -90.51],
  ['hn', 'Honduras', 'Honduras', 14.07, -87.19], ['mx', 'México', 'Mexico', 19.43, -99.13],
  ['ni', 'Nicaragua', 'Nicaragua', 12.11, -86.24], ['pa', 'Panamá', 'Panama', 8.98, -79.52],
  ['py', 'Paraguay', 'Paraguay', -25.26, -57.58], ['pe', 'Perú', 'Peru', -12.05, -77.04],
  ['pr', 'Puerto Rico', 'Puerto Rico', 18.47, -66.11], ['do', 'República Dominicana', 'Dominican Rep.', 18.49, -69.93],
  ['uy', 'Uruguay', 'Uruguay', -34.90, -56.16], ['ve', 'Venezuela', 'Venezuela', 10.48, -66.90]
];

const fc = topojson.feature(topo, topo.objects.countries);
const byName = Object.fromEntries(fc.features.map(f => [f.properties.name, f]));
const polysOf = g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const bbox = pts => pts.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [1e9, 1e9, -1e9, -1e9]);

// keep the mainland and nearby islands; drop far-away ones (Easter Island, Galápagos…)
function nearPolys(feature) {
  let polys = polysOf(feature.geometry).map(poly => ({ poly, b: bbox(poly[0]) }));
  polys.sort((a, b) => (b.b[2] - b.b[0]) * (b.b[3] - b.b[1]) - (a.b[2] - a.b[0]) * (a.b[3] - a.b[1]));
  const m = polys[0].b, span = Math.max(m[2] - m[0], m[3] - m[1]) * 0.35;
  return polys.filter(p => p.b[0] > m[0] - span && p.b[2] < m[2] + span && p.b[1] > m[1] - span && p.b[3] < m[3] + span).map(p => p.poly);
}

function fit(polys, capitals) {
  const all = polys.flatMap(p => p[0]);
  const b = bbox(all), lat0 = ((b[1] + b[3]) / 2) * Math.PI / 180;
  const proj = p => [p[0] * Math.cos(lat0), -p[1]];
  const pb = bbox(all.map(proj)), pw = pb[2] - pb[0], ph = pb[3] - pb[1];
  const tall = ph / pw > 1.5;
  // tall countries sit in the centre column, wide ones across the middle; both stay above the name
  const box = tall ? { x: 92, y: 54, w: 78, h: 222 } : { x: 46, y: 58, w: 150, h: 196 };
  const s = Math.min(box.w / pw, box.h / ph);
  const ox = box.x + (box.w - pw * s) / 2 - pb[0] * s, oy = box.y + (box.h - ph * s) / 2 - pb[1] * s;
  const xy = p => { const q = proj(p); return [+(q[0] * s + ox).toFixed(1), +(q[1] * s + oy).toFixed(1)]; };
  const d = polys.map(poly => poly.map(ring => {
    const pts = [];
    ring.forEach(pt => { const q = xy(pt); const l = pts[pts.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.7) pts.push(q); });
    return pts.length > 2 ? 'M' + pts.map(q => q[0] + ' ' + q[1]).join('L') + 'Z' : '';
  }).join('')).join('');
  return { d, tall, caps: capitals.map(c => xy([c[1], c[0]])) };
}

const out = {};
for (const [code, name, ne, lat, lon] of COUNTRIES) {
  const f = byName[ne];
  if (!f) throw new Error('missing ' + ne);
  const r = fit(nearPolys(f), [[lat, lon]]);
  out[code] = { name, d: r.d, tall: r.tall, cap: r.caps[0] };
}
// default card (no country chosen yet): all 20 countries together
const allPolys = COUNTRIES.flatMap(c => nearPolys(byName[c[2]]));
const la = fit(allPolys, []);
out.latam = { name: 'Your country', d: la.d, tall: la.tall, cap: null };

const file = path.join(__dirname, '..', 'assets', 'data', 'solubcard-countries.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log('wrote', file, (fs.statSync(file).size / 1024).toFixed(0) + ' KB');
