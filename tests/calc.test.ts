import assert from 'node:assert/strict';
import * as c from '../src/lib/calc.ts';

const near = (a: number, b: number, tol: number, msg: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: expected ~${b}, got ${a}`);

// BMI: 70 kg, 175 cm -> 22.857
near(c.bmi(70, 175), 22.86, 0.01, 'bmi');
assert.equal(c.bmiCategory(17).label, 'Underweight');
assert.equal(c.bmiCategory(22).label, 'Normal weight');
assert.equal(c.bmiCategory(27).label, 'Overweight');
assert.equal(c.bmiCategory(33).label, 'Obesity range');

// BMR Mifflin-St Jeor: male 80kg 180cm 30y => 10*80+6.25*180-5*30+5 = 1780
near(c.bmr('male', 80, 180, 30), 1780, 0.01, 'bmr male');
// female 60kg 165cm 25y => 600+1031.25-125-161 = 1345.25
near(c.bmr('female', 60, 165, 25), 1345.25, 0.01, 'bmr female');
near(c.tdee(1780, 1.55), 2759, 0.5, 'tdee');

// Navy body fat (male 180cm, neck 38, waist 85) ~ 14-16%
const bf = c.navyBodyFat('male', 180, 38, 85);
assert.ok(bf > 12 && bf < 18, `navy male bf out of range: ${bf}`);
const bfF = c.navyBodyFat('female', 165, 32, 75, 98);
assert.ok(bfF > 20 && bfF < 32, `navy female bf out of range: ${bfF}`);
assert.ok(Number.isNaN(c.navyBodyFat('male', 180, 50, 40)), 'impossible measurements -> NaN');

// Ideal weight (Devine) male 180cm: 50 + 2.3*(70.87-60)=75.0
near(c.idealWeights('male', 180).devine, 75.0, 0.1, 'devine');
const iw = c.idealWeights('female', 165);
near(iw.healthyMin, 18.5 * 1.65 * 1.65, 0.001, 'healthy min');

// Macros: 2000 kcal balanced => P 125g, C 225g, F 66.7g
const m = c.macros(2000, 'balanced');
near(m.proteinG, 125, 0.01, 'protein');
near(m.carbsG, 225, 0.01, 'carbs');
near(m.fatG, 66.67, 0.01, 'fat');
near(m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9, 2000, 0.01, 'macro kcal sum');

// Water: 70kg, 30 min exercise => 2450 + 360 = 2810
near(c.waterIntakeMl(70, 30, false), 2810, 0.01, 'water');
near(c.waterIntakeMl(70, 30, true), 3310, 0.01, 'water hot');

// HR zones: age 30 => Tanaka 187
const z = c.hrZones(30);
near(z.max, 187, 0.01, 'max hr');
assert.equal(z.zones.length, 5);
assert.equal(z.zones[0].from, Math.round(0.5 * 187));
// Karvonen: rest 60, max 187, zone2 lower bound = 60 + 0.6*127 = 136.2
const zk = c.hrZones(30, 60);
assert.equal(zk.zones[1].from, Math.round(60 + 0.6 * 127));

// Deficit: 80 -> 72 kg in 16 weeks => 8*7700/112 = 550 kcal/day
const d = c.calorieDeficitPlan(80, 72, 16, 2600, 'male');
near(d.dailyDeficit, 550, 0.01, 'deficit');
near(d.dailyTarget, 2050, 0.01, 'deficit target');
assert.equal(d.belowFloor, false);
const aggressive = c.calorieDeficitPlan(80, 60, 4, 2000, 'female');
assert.equal(aggressive.belowFloor, true);

// Registry compute smoke tests + validation
for (const calc of c.CALCULATORS) {
  assert.ok(calc.fields.length > 0, calc.id);
}
const bmiCalc = c.CALCULATORS.find((x) => x.id === 'bmi')!;
const r = bmiCalc.compute({ heightCm: '175', weightKg: '70' });
assert.ok(!('error' in r));
assert.equal((r as c.CalcResult).headline, '22.9');
assert.ok(c.validateFields(bmiCalc.fields, { heightCm: '50', weightKg: '70' })?.includes('at least'));
assert.ok(c.validateFields(bmiCalc.fields, { heightCm: '', weightKg: '70' })?.includes('required'));
assert.equal(c.validateFields(bmiCalc.fields, { heightCm: '170', weightKg: '70' }), null);

const defCalc = c.CALCULATORS.find((x) => x.id === 'deficit')!;
const bad = defCalc.compute({ sex: 'male', weightKg: '70', targetKg: '75', weeks: '8', tdee: '2400' });
assert.ok('error' in bad);

const runKcal = c.runCalories(70, 5);
near(runKcal, 350, 0.01, 'run kcal');
near(c.metCalories(8, 70, 30), 280, 0.01, 'met kcal');

console.log('calc tests passed');
