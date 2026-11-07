// Pure health-calculation helpers and the calculator registry.
// No React / Expo imports here so it can be unit-tested with plain Node.

export type Sex = 'male' | 'female';
export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export const ACTIVITY_LEVELS = [
  { value: '1.2', label: 'Sedentary (little or no exercise)' },
  { value: '1.375', label: 'Light (1–3 days/week)' },
  { value: '1.55', label: 'Moderate (3–5 days/week)' },
  { value: '1.725', label: 'Active (6–7 days/week)' },
  { value: '1.9', label: 'Very active (hard training / physical job)' },
];

const r1 = (n: number) => Math.round(n * 10) / 10;
const r0 = (n: number) => Math.round(n);

// ---------- core formulas ----------

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(v: number): { label: string; tone: Tone } {
  if (v < 18.5) return { label: 'Underweight', tone: 'warn' };
  if (v < 25) return { label: 'Normal weight', tone: 'good' };
  if (v < 30) return { label: 'Overweight', tone: 'warn' };
  return { label: 'Obesity range', tone: 'bad' };
}

/** U.S. Navy circumference method. All measurements in cm. Returns percent or NaN if inputs are impossible. */
export function navyBodyFat(sex: Sex, heightCm: number, neckCm: number, waistCm: number, hipCm = 0): number {
  if (sex === 'male') {
    const d = waistCm - neckCm;
    if (d <= 0) return NaN;
    return 495 / (1.0324 - 0.19077 * Math.log10(d) + 0.15456 * Math.log10(heightCm)) - 450;
  }
  const d = waistCm + hipCm - neckCm;
  if (d <= 0) return NaN;
  return 495 / (1.29579 - 0.35004 * Math.log10(d) + 0.221 * Math.log10(heightCm)) - 450;
}

export function bodyFatCategory(sex: Sex, pct: number): { label: string; tone: Tone } {
  // ACE (American Council on Exercise) ranges
  const t = sex === 'male' ? [6, 14, 18, 25] : [14, 21, 25, 32];
  if (pct < t[0]) return { label: 'Essential fat range', tone: 'warn' };
  if (pct < t[1]) return { label: 'Athletic range', tone: 'good' };
  if (pct < t[2]) return { label: 'Fitness range', tone: 'good' };
  if (pct < t[3]) return { label: 'Average range', tone: 'neutral' };
  return { label: 'Above average range', tone: 'warn' };
}

/** Mifflin–St Jeor */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

export function tdee(bmrValue: number, activityFactor: number): number {
  return bmrValue * activityFactor;
}

export function minSafeCalories(sex: Sex): number {
  return sex === 'male' ? 1500 : 1200;
}

export function idealWeights(sex: Sex, heightCm: number) {
  const inchesOver60 = Math.max(0, heightCm / 2.54 - 60);
  const m = sex === 'male';
  return {
    devine: (m ? 50 : 45.5) + 2.3 * inchesOver60,
    robinson: (m ? 52 : 49) + (m ? 1.9 : 1.7) * inchesOver60,
    miller: (m ? 56.2 : 53.1) + (m ? 1.41 : 1.36) * inchesOver60,
    hamwi: (m ? 48 : 45.5) + (m ? 2.7 : 2.2) * inchesOver60,
    healthyMin: 18.5 * Math.pow(heightCm / 100, 2),
    healthyMax: 24.9 * Math.pow(heightCm / 100, 2),
  };
}

export const MACRO_PRESETS: Record<string, { label: string; p: number; c: number; f: number }> = {
  balanced: { label: 'Balanced (25P / 45C / 30F)', p: 0.25, c: 0.45, f: 0.3 },
  highprotein: { label: 'High protein (35P / 35C / 30F)', p: 0.35, c: 0.35, f: 0.3 },
  lowcarb: { label: 'Lower carb (30P / 25C / 45F)', p: 0.3, c: 0.25, f: 0.45 },
};

export function macros(calories: number, preset: keyof typeof MACRO_PRESETS) {
  const p = MACRO_PRESETS[preset];
  return {
    proteinG: (calories * p.p) / 4,
    carbsG: (calories * p.c) / 4,
    fatG: (calories * p.f) / 9,
  };
}

/** ~35 ml per kg baseline plus ~12 ml per minute of exercise (≈350 ml per 30 min) */
export function waterIntakeMl(weightKg: number, exerciseMin: number, hot: boolean): number {
  return weightKg * 35 + exerciseMin * 12 + (hot ? 500 : 0);
}

/** Tanaka max heart rate. If resting HR provided, uses Karvonen (heart-rate reserve). */
export function hrZones(age: number, restingHr?: number) {
  const max = 208 - 0.7 * age;
  const bands = [
    { zone: 1, name: 'Very light (warm-up / recovery)', lo: 0.5, hi: 0.6 },
    { zone: 2, name: 'Light (fat-burn / base endurance)', lo: 0.6, hi: 0.7 },
    { zone: 3, name: 'Moderate (aerobic)', lo: 0.7, hi: 0.8 },
    { zone: 4, name: 'Hard (threshold)', lo: 0.8, hi: 0.9 },
    { zone: 5, name: 'Maximum (peak effort)', lo: 0.9, hi: 1.0 },
  ];
  const useK = restingHr !== undefined && restingHr > 0;
  const zones = bands.map((b) => {
    const f = (pct: number) => (useK ? (restingHr as number) + pct * (max - (restingHr as number)) : pct * max);
    return { ...b, from: r0(f(b.lo)), to: r0(f(b.hi)) };
  });
  return { max, zones, method: useK ? 'Karvonen (uses resting heart rate)' : '% of max heart rate' };
}

export const KCAL_PER_KG = 7700;

export function calorieDeficitPlan(currentKg: number, targetKg: number, weeks: number, tdeeValue: number, sex: Sex) {
  const kgToLose = currentKg - targetKg;
  const dailyDeficit = (kgToLose * KCAL_PER_KG) / (weeks * 7);
  const dailyTarget = tdeeValue - dailyDeficit;
  const ratePerWeek = kgToLose / weeks;
  const pctPerWeek = (ratePerWeek / currentKg) * 100;
  const floor = minSafeCalories(sex);
  return { kgToLose, dailyDeficit, dailyTarget, ratePerWeek, pctPerWeek, floor, belowFloor: dailyTarget < floor };
}

/** Rough running energy cost: ~1 kcal per kg per km */
export function runCalories(weightKg: number, distanceKm: number): number {
  return weightKg * distanceKm * 1.0;
}

/** kcal = MET x kg x hours */
export function metCalories(met: number, weightKg: number, minutes: number): number {
  return met * weightKg * (minutes / 60);
}

// ---------- calculator registry (drives the generic calculator UI) ----------

export type Field = {
  key: string;
  label: string;
  unit?: string;
  kind: 'number' | 'select';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  optional?: boolean;
  hint?: string;
};

export type CalcResult = {
  headline: string;
  unit?: string;
  rows: { label: string; value: string }[];
  meaning: string;
  tone: Tone;
  /** one-line text kept in history */
  summary: string;
  /** numeric value used for history comparison */
  value: number;
};

export type CalcDef = {
  id: string;
  title: string;
  icon: string;
  short: string;
  fields: Field[];
  compute: (v: Record<string, string>) => CalcResult | { error: string };
};

const SEX: Field = {
  key: 'sex',
  label: 'Sex',
  kind: 'select',
  options: [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
  ],
  hint: 'Formulas below were built on sex-specific data.',
};
const AGE: Field = { key: 'age', label: 'Age', unit: 'years', kind: 'number', min: 10, max: 100 };
const HEIGHT: Field = { key: 'heightCm', label: 'Height', unit: 'cm', kind: 'number', min: 100, max: 250 };
const WEIGHT: Field = { key: 'weightKg', label: 'Weight', unit: 'kg', kind: 'number', min: 25, max: 300 };
const ACTIVITY: Field = { key: 'activity', label: 'Activity level', kind: 'select', options: ACTIVITY_LEVELS };

const n = (v: Record<string, string>, k: string) => parseFloat(v[k]);

export const CALCULATORS: CalcDef[] = [
  {
    id: 'bmi',
    title: 'BMI',
    icon: 'scale-bathroom',
    short: 'Body Mass Index from height and weight',
    fields: [HEIGHT, WEIGHT],
    compute: (v) => {
      const val = bmi(n(v, 'weightKg'), n(v, 'heightCm'));
      const c = bmiCategory(val);
      const w = idealWeights('male', n(v, 'heightCm'));
      return {
        headline: r1(val).toString(),
        unit: 'kg/m²',
        rows: [
          { label: 'Category (WHO adult ranges)', value: c.label },
          { label: 'Healthy weight range for your height', value: `${r1(w.healthyMin)}–${r1(w.healthyMax)} kg` },
        ],
        meaning:
          'BMI is a screening number, not a diagnosis. It does not separate muscle from fat, so very muscular people can read high. Use it alongside waist size and how you feel.',
        tone: c.tone,
        summary: `BMI ${r1(val)} · ${c.label}`,
        value: r1(val),
      };
    },
  },
  {
    id: 'bodyfat',
    title: 'Body Fat %',
    icon: 'human',
    short: 'U.S. Navy tape-measure estimate',
    fields: [
      SEX,
      HEIGHT,
      { key: 'neckCm', label: 'Neck (below larynx)', unit: 'cm', kind: 'number', min: 20, max: 70 },
      { key: 'waistCm', label: 'Waist (at navel)', unit: 'cm', kind: 'number', min: 40, max: 200 },
      { key: 'hipCm', label: 'Hip (widest point) — women only', unit: 'cm', kind: 'number', min: 50, max: 200, optional: true },
    ],
    compute: (v) => {
      const sex = v.sex as Sex;
      if (sex === 'female' && !(n(v, 'hipCm') > 0)) return { error: 'Hip measurement is required for women.' };
      const pct = navyBodyFat(sex, n(v, 'heightCm'), n(v, 'neckCm'), n(v, 'waistCm'), n(v, 'hipCm') || 0);
      if (!isFinite(pct) || pct < 2 || pct > 60)
        return { error: 'Those measurements do not give a realistic result. Please re-measure (waist must be larger than neck).' };
      const c = bodyFatCategory(sex, pct);
      return {
        headline: r1(pct).toString(),
        unit: '%',
        rows: [{ label: 'Range (ACE categories)', value: c.label }],
        meaning:
          'Tape-measure estimates can be off by several percentage points compared with DEXA scans. Track the trend over weeks using the same technique, not a single reading.',
        tone: c.tone,
        summary: `Body fat ${r1(pct)}% · ${c.label}`,
        value: r1(pct),
      };
    },
  },
  {
    id: 'bmr',
    title: 'BMR',
    icon: 'fire',
    short: 'Calories your body burns at rest',
    fields: [SEX, AGE, HEIGHT, WEIGHT],
    compute: (v) => {
      const val = bmr(v.sex as Sex, n(v, 'weightKg'), n(v, 'heightCm'), n(v, 'age'));
      return {
        headline: r0(val).toString(),
        unit: 'kcal/day',
        rows: [{ label: 'Formula', value: 'Mifflin–St Jeor' }],
        meaning:
          'Basal metabolic rate is the energy needed for basic functions at complete rest. It is an estimate; real values vary by person. Do not eat below this number for long without medical supervision.',
        tone: 'neutral',
        summary: `BMR ${r0(val)} kcal/day`,
        value: r0(val),
      };
    },
  },
  {
    id: 'tdee',
    title: 'TDEE',
    icon: 'lightning-bolt',
    short: 'Total daily energy expenditure',
    fields: [SEX, AGE, HEIGHT, WEIGHT, ACTIVITY],
    compute: (v) => {
      const b = bmr(v.sex as Sex, n(v, 'weightKg'), n(v, 'heightCm'), n(v, 'age'));
      const t = tdee(b, n(v, 'activity'));
      return {
        headline: r0(t).toString(),
        unit: 'kcal/day',
        rows: [
          { label: 'BMR', value: `${r0(b)} kcal` },
          { label: 'Activity multiplier', value: `× ${n(v, 'activity')}` },
        ],
        meaning:
          'TDEE is roughly the calories you burn in a day including activity. Eating around this amount tends to maintain your weight. Activity multipliers are broad guesses, so adjust using real-world results over 2–3 weeks.',
        tone: 'neutral',
        summary: `TDEE ${r0(t)} kcal/day`,
        value: r0(t),
      };
    },
  },
  {
    id: 'calories',
    title: 'Daily Calories',
    icon: 'food-apple',
    short: 'Calorie target for your goal',
    fields: [
      SEX,
      AGE,
      HEIGHT,
      WEIGHT,
      ACTIVITY,
      {
        key: 'goal',
        label: 'Goal',
        kind: 'select',
        options: [
          { value: '-0.5', label: 'Lose ~0.5 kg per week' },
          { value: '-0.25', label: 'Lose ~0.25 kg per week' },
          { value: '0', label: 'Maintain weight' },
          { value: '0.25', label: 'Gain ~0.25 kg per week' },
          { value: '0.5', label: 'Gain ~0.5 kg per week' },
        ],
      },
    ],
    compute: (v) => {
      const sex = v.sex as Sex;
      const t = tdee(bmr(sex, n(v, 'weightKg'), n(v, 'heightCm'), n(v, 'age')), n(v, 'activity'));
      const adj = (n(v, 'goal') * KCAL_PER_KG) / 7;
      const target = t + adj;
      const floor = minSafeCalories(sex);
      const low = target < floor;
      return {
        headline: r0(Math.max(target, floor)).toString(),
        unit: 'kcal/day',
        rows: [
          { label: 'Maintenance (TDEE)', value: `${r0(t)} kcal` },
          { label: 'Daily adjustment', value: `${adj >= 0 ? '+' : ''}${r0(adj)} kcal` },
          ...(low ? [{ label: 'Note', value: `Raised to the general minimum of ${floor} kcal` }] : []),
        ],
        meaning: low
          ? `Your goal would put you below ${floor} kcal/day, which is generally not recommended without a clinician. We raised it to that minimum; choose a slower pace or speak with a dietitian.`
          : 'This is a starting point. Re-check every few weeks and adjust with your actual weight trend. It is a general estimate, not a prescription.',
        tone: low ? 'warn' : 'good',
        summary: `Target ${r0(Math.max(target, floor))} kcal/day`,
        value: r0(Math.max(target, floor)),
      };
    },
  },
  {
    id: 'ideal',
    title: 'Ideal Weight',
    icon: 'target',
    short: 'Reference weights by common formulas',
    fields: [SEX, HEIGHT],
    compute: (v) => {
      const w = idealWeights(v.sex as Sex, n(v, 'heightCm'));
      const avg = (w.devine + w.robinson + w.miller + w.hamwi) / 4;
      return {
        headline: r1(avg).toString(),
        unit: 'kg (average)',
        rows: [
          { label: 'Devine', value: `${r1(w.devine)} kg` },
          { label: 'Robinson', value: `${r1(w.robinson)} kg` },
          { label: 'Miller', value: `${r1(w.miller)} kg` },
          { label: 'Hamwi', value: `${r1(w.hamwi)} kg` },
          { label: 'Healthy BMI range (18.5–24.9)', value: `${r1(w.healthyMin)}–${r1(w.healthyMax)} kg` },
        ],
        meaning:
          'These formulas only use height and sex, so treat them as rough reference points. A healthy weight for you depends on muscle mass, frame and health history.',
        tone: 'neutral',
        summary: `Ideal ≈ ${r1(avg)} kg (healthy ${r1(w.healthyMin)}–${r1(w.healthyMax)})`,
        value: r1(avg),
      };
    },
  },
  {
    id: 'macros',
    title: 'Macronutrients',
    icon: 'nutrition',
    short: 'Protein, carbs and fat split',
    fields: [
      { key: 'calories', label: 'Daily calories', unit: 'kcal', kind: 'number', min: 1000, max: 6000 },
      {
        key: 'preset',
        label: 'Split',
        kind: 'select',
        options: Object.entries(MACRO_PRESETS).map(([value, p]) => ({ value, label: p.label })),
      },
    ],
    compute: (v) => {
      const m = macros(n(v, 'calories'), v.preset);
      return {
        headline: `${r0(m.proteinG)}P · ${r0(m.carbsG)}C · ${r0(m.fatG)}F`,
        unit: 'grams/day',
        rows: [
          { label: 'Protein', value: `${r0(m.proteinG)} g (${r0(m.proteinG * 4)} kcal)` },
          { label: 'Carbohydrates', value: `${r0(m.carbsG)} g (${r0(m.carbsG * 4)} kcal)` },
          { label: 'Fat', value: `${r0(m.fatG)} g (${r0(m.fatG * 9)} kcal)` },
        ],
        meaning:
          'Protein and carbs provide 4 kcal per gram and fat 9 kcal per gram. Splits are general starting points; people with medical conditions should follow their clinician or dietitian.',
        tone: 'neutral',
        summary: `${r0(m.proteinG)}g P / ${r0(m.carbsG)}g C / ${r0(m.fatG)}g F`,
        value: r0(n(v, 'calories')),
      };
    },
  },
  {
    id: 'water',
    title: 'Water Intake',
    icon: 'water',
    short: 'Daily hydration estimate',
    fields: [
      WEIGHT,
      { key: 'exerciseMin', label: 'Exercise per day', unit: 'min', kind: 'number', min: 0, max: 600 },
      {
        key: 'climate',
        label: 'Climate',
        kind: 'select',
        options: [
          { value: 'normal', label: 'Normal / air-conditioned' },
          { value: 'hot', label: 'Hot or humid' },
        ],
      },
    ],
    compute: (v) => {
      const ml = waterIntakeMl(n(v, 'weightKg'), n(v, 'exerciseMin'), v.climate === 'hot');
      return {
        headline: (Math.round(ml / 50) * 50).toString(),
        unit: 'ml/day',
        rows: [
          { label: 'In litres', value: `${r1(ml / 1000)} L` },
          { label: 'In 250 ml glasses', value: `${Math.round(ml / 250)} glasses` },
        ],
        meaning:
          'This is a general guideline including water from drinks; food also contributes. Needs rise with heat, illness or intense exercise. People with kidney or heart conditions should follow medical advice.',
        tone: 'neutral',
        summary: `${Math.round(ml / 50) * 50} ml/day`,
        value: Math.round(ml / 50) * 50,
      };
    },
  },
  {
    id: 'hr',
    title: 'Heart Rate Zones',
    icon: 'heart-pulse',
    short: 'Training zones by age',
    fields: [AGE, { key: 'restingHr', label: 'Resting heart rate (optional)', unit: 'bpm', kind: 'number', min: 30, max: 120, optional: true }],
    compute: (v) => {
      const z = hrZones(n(v, 'age'), n(v, 'restingHr') || undefined);
      return {
        headline: r0(z.max).toString(),
        unit: 'bpm estimated max',
        rows: [
          ...z.zones.map((x) => ({ label: `Zone ${x.zone} · ${x.name}`, value: `${x.from}–${x.to} bpm` })),
          { label: 'Method', value: z.method },
        ],
        meaning:
          'Max heart rate (Tanaka formula) is an estimate and can differ by 10+ bpm between people. Stop exercising and seek care if you feel chest pain, dizziness or unusual breathlessness.',
        tone: 'neutral',
        summary: `Max HR ≈ ${r0(z.max)} bpm`,
        value: r0(z.max),
      };
    },
  },
  {
    id: 'deficit',
    title: 'Calorie Deficit',
    icon: 'trending-down',
    short: 'Plan a safe weight-loss deficit',
    fields: [
      SEX,
      { key: 'weightKg', label: 'Current weight', unit: 'kg', kind: 'number', min: 25, max: 300 },
      { key: 'targetKg', label: 'Target weight', unit: 'kg', kind: 'number', min: 25, max: 300 },
      { key: 'weeks', label: 'Time frame', unit: 'weeks', kind: 'number', min: 1, max: 104 },
      { key: 'tdee', label: 'Maintenance calories (TDEE)', unit: 'kcal', kind: 'number', min: 1000, max: 6000, hint: 'Use the TDEE calculator if unsure.' },
    ],
    compute: (v) => {
      if (n(v, 'targetKg') >= n(v, 'weightKg')) return { error: 'Target weight must be lower than your current weight for a deficit plan.' };
      const p = calorieDeficitPlan(n(v, 'weightKg'), n(v, 'targetKg'), n(v, 'weeks'), n(v, 'tdee'), v.sex as Sex);
      const tooFast = p.pctPerWeek > 1 || p.dailyDeficit > 1000;
      const bad = p.belowFloor || tooFast;
      return {
        headline: r0(p.dailyDeficit).toString(),
        unit: 'kcal/day deficit',
        rows: [
          { label: 'Weight to lose', value: `${r1(p.kgToLose)} kg` },
          { label: 'Pace', value: `${r1(p.ratePerWeek)} kg/week (${r1(p.pctPerWeek)}% of body weight)` },
          { label: 'Daily calorie target', value: `${r0(p.dailyTarget)} kcal` },
        ],
        meaning: bad
          ? `This plan is aggressive (${p.belowFloor ? `below ${p.floor} kcal/day` : 'faster than about 1% of body weight per week'}). Consider a longer time frame, and speak with a doctor or dietitian first.`
          : 'A gradual deficit of up to about 0.5–1% of body weight per week is commonly considered sustainable. This uses ~7,700 kcal per kg of body fat, which is a rule of thumb, not exact.',
        tone: bad ? 'warn' : 'good',
        summary: `Deficit ${r0(p.dailyDeficit)} kcal/day → ${r0(p.dailyTarget)} kcal target`,
        value: r0(p.dailyDeficit),
      };
    },
  },
];

export function validateFields(fields: Field[], values: Record<string, string>): string | null {
  for (const f of fields) {
    const raw = values[f.key];
    if (f.kind === 'select') {
      if (!raw) return `Please choose: ${f.label}`;
      continue;
    }
    if (raw === undefined || raw === '') {
      if (f.optional) continue;
      return `${f.label} is required.`;
    }
    const num = Number(raw);
    if (!isFinite(num)) return `${f.label} must be a number.`;
    if (f.min !== undefined && num < f.min) return `${f.label} must be at least ${f.min}${f.unit ? ' ' + f.unit : ''}.`;
    if (f.max !== undefined && num > f.max) return `${f.label} must be at most ${f.max}${f.unit ? ' ' + f.unit : ''}.`;
  }
  return null;
}

export const HEALTH_DISCLAIMER =
  'These calculators give general estimates for education only. They are not a medical diagnosis or professional medical advice. Talk to a qualified healthcare professional before changing your diet or exercise routine.';
