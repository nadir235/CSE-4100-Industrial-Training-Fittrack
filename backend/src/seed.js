'use strict';
/** Seeds default membership plans if none exist. Usage: npm run seed */
require('dotenv').config();
const { realDeps } = require('./lib/firebase');

const PLANS = [
  { name: 'Monthly Membership', price: 1500, durationDays: 30, description: 'Flexible month-to-month access.', features: ['Full gym access', 'Workout programs', 'AI fitness coach'], active: true },
  { name: 'Quarterly Membership', price: 4000, durationDays: 90, description: 'Three months, save versus monthly.', features: ['Full gym access', 'Workout programs', 'AI fitness coach', 'Progress reports'], active: true },
  { name: 'Half-Yearly Membership', price: 7500, durationDays: 180, description: 'Six months of commitment.', features: ['Full gym access', 'Workout programs', 'AI fitness coach', 'Progress reports', '1 free trainer session'], active: true },
  { name: 'Yearly Membership', price: 14000, durationDays: 365, description: 'Best value for the whole year.', features: ['Full gym access', 'Workout programs', 'AI fitness coach', 'Progress reports', '2 free trainer sessions', 'Guest pass'], active: true },
];

(async () => {
  const { db } = realDeps();
  const existing = await db.collection('plans').limit(1).get();
  if (!existing.empty) {
    console.log('Plans already exist — nothing to seed.');
    return;
  }
  for (const p of PLANS) await db.collection('plans').doc().set({ ...p, createdAt: Date.now() });
  console.log(`Seeded ${PLANS.length} default plans.`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
