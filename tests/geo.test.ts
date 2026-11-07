import assert from 'node:assert/strict';
import { acceptFix, haversineKm, paceSecPerKm, thinRoute } from '../src/lib/geo.ts';

// ~1 degree of latitude is ~111.2 km
const d = haversineKm({ lat: 23.0, lng: 90.0 }, { lat: 24.0, lng: 90.0 });
assert.ok(Math.abs(d - 111.2) < 0.5, `haversine ${d}`);
assert.equal(haversineKm({ lat: 1, lng: 1 }, { lat: 1, lng: 1 }), 0);

const a = { lat: 22.8456, lng: 89.5403 };
// first fix accepted (good accuracy), rejected when accuracy is poor
assert.equal(acceptFix(null, a, 10, 0).accept, true);
assert.equal(acceptFix(null, a, 80, 0).accept, false);
// ~11 m north in 4 s => accepted (~2.8 m/s jogging)
const b = { lat: a.lat + 0.0001, lng: a.lng };
const ok = acceptFix(a, b, 8, 4);
assert.equal(ok.accept, true);
assert.ok(ok.km > 0.010 && ok.km < 0.012);
// 1 m jitter ignored
assert.equal(acceptFix(a, { lat: a.lat + 0.000009, lng: a.lng }, 5, 2).accept, false);
// 1 km in 5 s (720 km/h) is a GPS jump
assert.equal(acceptFix(a, { lat: a.lat + 0.009, lng: a.lng }, 5, 5).accept, false);

assert.equal(paceSecPerKm(5, 1500), 300);
assert.equal(paceSecPerKm(0, 100), 0);

const pts = Array.from({ length: 1000 }, (_, i) => i);
const thin = thinRoute(pts, 300);
assert.equal(thin.length, 300);
assert.equal(thin[0], 0);
assert.equal(thinRoute([1, 2, 3], 300).length, 3);
console.log('geo tests passed');
