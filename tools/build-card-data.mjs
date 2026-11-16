// Builds the data the SolubCard draws, for every country in the world.
//   assets/data/solubcard/countries.json      list for the selector, A–Z: [code, name, hasShape]
//   assets/data/solubcard/shapes/<code>.json  shape fitted to the card (240 x 360 units) + its "heart" dot
//   assets/flags/<code>.svg                   official flags (flag-icons, MIT), real colours
// Sources (all free to use): Natural Earth via world-atlas (public domain), flag-icons (MIT),
// i18n-iso-countries for English names and codes (MIT), polylabel for the heart point (ISC).
// Run when the data should change (not part of build.sh):
//   npm install --no-save world-atlas@2.0.2 topojson-client@3.1.0 i18n-iso-countries@7.14.0 polylabel@2.0.1 flag-icons@7.6.0
//   node tools/build-card-data.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import * as topojson from 'topojson-client';
import countries from 'i18n-iso-countries';
import polylabel from 'polylabel';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WA = path.dirname(require.resolve('world-atlas/package.json'));
const FLAG_PKG = path.dirname(require.resolve('flag-icons/package.json'));
const FLAGS = path.join(FLAG_PKG, 'flags', '4x3');
countries.registerLocale(JSON.parse(fs.readFileSync(require.resolve('i18n-iso-countries/langs/en.json'))));

// Latin America: names in Spanish (Brasil in Portuguese); also drawn together on the default card.
// Every country is in one A–Z list; no group is set apart.
const LATAM = { AR: 'Argentina', BO: 'Bolivia', BR: 'Brasil', CL: 'Chile', CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba',
  EC: 'Ecuador', SV: 'El Salvador', GT: 'Guatemala', HN: 'Honduras', MX: 'México', NI: 'Nicaragua', PA: 'Panamá',
  PY: 'Paraguay', PE: 'Perú', PR: 'Puerto Rico', DO: 'República Dominicana', UY: 'Uruguay', VE: 'Venezuela' };
// Short everyday names where the official English name is long or formal
const SHORT = { IR: 'Iran', KR: 'South Korea', KP: 'North Korea', LA: 'Laos', MD: 'Moldova', RU: 'Russia', SY: 'Syria',
  TZ: 'Tanzania', VN: 'Vietnam', GB: 'United Kingdom', US: 'United States', FM: 'Micronesia', PS: 'Palestine',
  TW: 'Taiwan', CD: 'DR Congo', CG: 'Congo', BN: 'Brunei', CZ: 'Czechia', MK: 'North Macedonia', VA: 'Vatican City',
  CV: 'Cape Verde', SZ: 'Eswatini', TL: 'Timor-Leste', CI: "Côte d'Ivoire", XK: 'Kosovo', AX: 'Åland Islands', CW: 'Curaçao', RE: 'Réunion', BL: 'Saint Barthélemy' };
const SKIP = new Set(['AQ', 'BV', 'HM', 'UM', 'TF', 'IO']); // uninhabited or no permanent population

const t50 = JSON.parse(fs.readFileSync(path.join(WA, 'countries-50m.json')));
const t10 = JSON.parse(fs.readFileSync(path.join(WA, 'countries-10m.json')));
const f50 = topojson.feature(t50, t50.objects.countries).features;
const f10 = topojson.feature(t10, t10.objects.countries).features;
const byId = (list, id) => list.find(f => f.id === id);
const byName = (list, n) => list.find(f => f.properties.name === n);

const polysOf = g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const bbox = pts => pts.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
const area = ring => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]); return Math.abs(a / 2); };

// keep the main land and nearby islands; drop far-away territories so the shape stays recognisable
function nearPolys(feature) {
  let polys = polysOf(feature.geometry);
  // countries across the 180° line (Fiji, Russia, Kiribati…): put all longitudes on one side
  const lons = polys.flatMap(p => p[0].map(q => q[0]));
  if (Math.max(...lons) - Math.min(...lons) > 180) polys = polys.map(p => p.map(r => r.map(([x, y]) => [x < 0 ? x + 360 : x, y])));
  const list = polys.map(poly => ({ poly, b: bbox(poly[0]), a: area(poly[0]) })).sort((a, b) => b.a - a.a);
  // big islands always stay (New Zealand's North Island, Japan's main islands…);
  // small ones only if they are close to the main land (drops Hawaii, Easter Island, Galápagos…)
  const big = list.filter(p => p.a >= list[0].a * 0.12);
  const m = bbox(big.flatMap(p => [[p.b[0], p.b[1]], [p.b[2], p.b[3]]]));
  const span = Math.max(m[2] - m[0], m[3] - m[1], 2) * 0.25;
  return list.filter(p => p.a >= list[0].a * 0.12 || (p.b[0] > m[0] - span && p.b[2] < m[2] + span && p.b[1] > m[1] - span && p.b[3] < m[3] + span)).map(p => p.poly);
}

function fit(polys) {
  const all = polys.flatMap(p => p[0]);
  const b = bbox(all), lat0 = ((b[1] + b[3]) / 2) * Math.PI / 180;
  const proj = p => [p[0] * Math.cos(lat0), -p[1]];
  const pb = bbox(all.map(proj)), pw = Math.max(pb[2] - pb[0], 1e-6), ph = Math.max(pb[3] - pb[1], 1e-6);
  const tall = ph / pw > 1.5;
  const box = tall ? { x: 92, y: 54, w: 78, h: 222 } : { x: 46, y: 58, w: 150, h: 196 };
  const s = Math.min(box.w / pw, box.h / ph);
  const ox = box.x + (box.w - pw * s) / 2 - pb[0] * s, oy = box.y + (box.h - ph * s) / 2 - pb[1] * s;
  const xy = p => { const q = proj(p); return [+(q[0] * s + ox).toFixed(1), +(q[1] * s + oy).toFixed(1)]; };
  const rings = polys.map(poly => poly.map(ring => {
    const pts = [];
    ring.forEach(pt => { const q = xy(pt); const l = pts[pts.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.7) pts.push(q); });
    return pts;
  }).filter(r => r.length > 2)).filter(p => p.length);
  const d = rings.map(poly => poly.map(r => 'M' + r.map(q => q[0] + ' ' + q[1]).join('L') + 'Z').join('')).join('');
  // the "heart": the point deepest inside the largest piece of land; the contour rings close around it
  const biggest = rings.slice().sort((a, b) => area(b[0]) - area(a[0]))[0];
  const h = biggest ? polylabel(biggest, 0.5) : null;
  return { d, tall, dot: h ? [+h[0].toFixed(1), +h[1].toFixed(1)] : null };
}

const outDir = path.join(ROOT, 'assets', 'data', 'solubcard');
const shapeDir = path.join(outDir, 'shapes');
const flagDir = path.join(ROOT, 'assets', 'flags');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(shapeDir, { recursive: true });
fs.mkdirSync(flagDir, { recursive: true });

const list = [];
let withShape = 0;
for (const a2 of Object.keys(countries.getAlpha2Codes())) {
  if (SKIP.has(a2)) continue;
  const code = a2.toLowerCase();
  const name = LATAM[a2] || SHORT[a2] || countries.getName(a2, 'en', { select: 'alias' }) || countries.getName(a2, 'en');
  const num = countries.alpha2ToNumeric(a2);
  const f = byId(f50, num) || byId(f10, num) || (a2 === 'XK' ? (byName(f50, 'Kosovo') || byName(f10, 'Kosovo')) : null);
  if (f) { fs.writeFileSync(path.join(shapeDir, code + '.json'), JSON.stringify(fit(nearPolys(f)))); withShape++; }
  fs.copyFileSync(path.join(FLAGS, code + '.svg'), path.join(flagDir, code + '.svg'));
  list.push([code, name, f ? 1 : 0]);
}
list.sort((a, b) => a[1].localeCompare(b[1], 'en', { sensitivity: 'base' }));
fs.writeFileSync(path.join(outDir, 'countries.json'), JSON.stringify(list));
// default card: all of Latin America together
const la = fit(Object.keys(LATAM).flatMap(a2 => nearPolys(byId(f50, countries.alpha2ToNumeric(a2)))));
la.dot = null;
fs.writeFileSync(path.join(shapeDir, 'latam.json'), JSON.stringify(la));
fs.copyFileSync(path.join(FLAG_PKG, 'LICENSE'), path.join(flagDir, 'LICENSE'));
console.log(list.length + ' countries, ' + withShape + ' with a shape');
