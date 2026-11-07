export type FastingSchedule = { id: string; label: string; fastHours: number; eatHours: number; blurb: string };

export const FASTING_SCHEDULES: FastingSchedule[] = [
  { id: '12:12', label: '12:12', fastHours: 12, eatHours: 12, blurb: 'Gentle start — overnight fast.' },
  { id: '14:10', label: '14:10', fastHours: 14, eatHours: 10, blurb: 'Skip a late-night snack and a early breakfast.' },
  { id: '16:8', label: '16:8', fastHours: 16, eatHours: 8, blurb: 'The most popular schedule.' },
  { id: '18:6', label: '18:6', fastHours: 18, eatHours: 6, blurb: 'Advanced — a shorter eating window.' },
  { id: '20:4', label: '20:4', fastHours: 20, eatHours: 4, blurb: 'Advanced "warrior" style window.' },
];

export const FASTING_DISCLAIMER =
  'Intermittent fasting is not suitable for everyone. Do not fast if you are pregnant or breastfeeding, under 18, have diabetes, an eating disorder or other medical conditions, or take medication, unless your doctor agrees. Stop and eat if you feel unwell.';

export function fastingStage(hours: number): { title: string; text: string } {
  if (hours < 4) return { title: 'Fed state', text: 'Your body is still digesting your last meal.' };
  if (hours < 12) return { title: 'Early fasting', text: 'Digestion finishes and blood sugar settles. Stay hydrated.' };
  if (hours < 16) return { title: 'Fasting', text: 'Your body relies more on stored energy. Water, black coffee and plain tea are fine.' };
  return { title: 'Extended fast', text: 'You are in a longer fasting window. Listen to your body and break the fast if you feel unwell.' };
}
