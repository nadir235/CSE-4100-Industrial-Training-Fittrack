import type { FitnessLevel } from '../lib/types';

export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  icon: string; // MaterialCommunityIcons name
  unit: 'reps' | 'sec';
  description: string;
  tips: string;
};

const E = (
  id: string,
  name: string,
  muscle: string,
  equipment: string,
  icon: string,
  unit: 'reps' | 'sec',
  description: string,
  tips: string,
): Exercise => ({ id, name, muscle, equipment, icon, unit, description, tips });

export const EXERCISES: Exercise[] = [
  // ----- beginner -----
  E('bw-squat', 'Bodyweight Squat', 'Legs, glutes', 'None', 'human-handsdown', 'reps', 'Stand with feet shoulder-width apart. Sit your hips back and down as if onto a chair, keep your chest up, then stand tall.', 'Keep your heels down and knees tracking over your toes.'),
  E('wall-pushup', 'Wall Push-up', 'Chest, shoulders, triceps', 'Wall', 'human-handsup', 'reps', 'Place hands on a wall at chest height, step back, bend elbows to bring your chest to the wall, then push away.', 'Keep your body in one straight line.'),
  E('knee-pushup', 'Knee Push-up', 'Chest, triceps, core', 'Mat', 'arm-flex', 'reps', 'From hands and knees, lower your chest toward the floor with elbows ~45° from your body, then press up.', 'Squeeze your glutes and keep your hips from sagging.'),
  E('glute-bridge', 'Glute Bridge', 'Glutes, hamstrings', 'Mat', 'human', 'reps', 'Lie on your back with knees bent. Press through your heels to lift your hips until shoulders, hips and knees line up.', 'Pause for a second at the top and avoid arching your lower back.'),
  E('march', 'Standing March', 'Hip flexors, cardio', 'None', 'walk', 'sec', 'March in place, lifting knees to hip height and swinging your arms.', 'Stay tall and breathe steadily.'),
  E('knee-plank', 'Knee Plank', 'Core', 'Mat', 'human-male-board', 'sec', 'Forearms and knees on the floor, body in a straight line from head to knees. Hold.', 'Tuck your ribs down and breathe normally.'),
  E('bird-dog', 'Bird Dog', 'Core, back, glutes', 'Mat', 'dog-side', 'reps', 'On hands and knees, extend the opposite arm and leg, hold briefly, then switch sides.', 'Move slowly; keep your hips level.'),
  E('step-up', 'Step-up', 'Legs, glutes', 'Step or sturdy stair', 'stairs', 'reps', 'Step onto a low step with one foot, drive through the heel to stand, step down and switch.', 'Use a handrail if you need balance.'),
  E('dead-bug', 'Dead Bug', 'Deep core', 'Mat', 'bug-outline', 'reps', 'Lie on your back, arms up, knees at 90°. Lower opposite arm and leg slowly, then return.', 'Keep your lower back gently pressed to the floor.'),
  E('calf-raise', 'Calf Raise', 'Calves', 'None', 'shoe-sneaker', 'reps', 'Stand tall and rise onto the balls of your feet, pause, then lower slowly.', 'Hold a wall for balance.'),
  E('jacks-lowimpact', 'Low-impact Jacks', 'Full-body cardio', 'None', 'human-handsup', 'sec', 'Step one foot out to the side while raising both arms, then switch, keeping a steady rhythm.', 'No jumping needed — stay light on your feet.'),
  E('band-row', 'Band Row', 'Back, biceps', 'Resistance band', 'dumbbell', 'reps', 'Anchor a band at chest height, pull handles toward your ribs squeezing shoulder blades together, then release slowly.', 'Do not shrug your shoulders.'),
  E('db-press-light', 'Light Dumbbell Shoulder Press', 'Shoulders, triceps', 'Light dumbbells', 'dumbbell', 'reps', 'Hold light dumbbells at shoulder height and press overhead, then lower with control.', 'Start with a very light weight to learn the movement.'),
  E('cat-cow', 'Cat-Cow', 'Spine mobility', 'Mat', 'cat', 'reps', 'On hands and knees, alternate arching and rounding your back with your breath.', 'Move gently within a comfortable range.'),
  E('brisk-walk', 'Brisk Walk', 'Cardio', 'None', 'walk', 'sec', 'Walk at a pace that raises your breathing but still lets you talk.', 'Swing your arms and keep your posture tall.'),
  E('assisted-lunge', 'Supported Lunge', 'Legs, glutes', 'Chair for support', 'human-male', 'reps', 'Holding a chair, step back and lower your back knee toward the floor, then return.', 'Keep your front knee over your ankle.'),
  // ----- intermediate -----
  E('pushup', 'Push-up', 'Chest, shoulders, triceps', 'Mat', 'arm-flex', 'reps', 'In a high plank, lower your chest to just above the floor with elbows at ~45°, then press back up.', 'Keep a straight line from head to heels.'),
  E('goblet-squat', 'Goblet Squat', 'Legs, glutes, core', 'Dumbbell or kettlebell', 'kettlebell', 'reps', 'Hold a weight at your chest, squat deep with an upright torso, then stand.', 'Push your knees out slightly.'),
  E('walking-lunge', 'Walking Lunge', 'Legs, glutes', 'None or dumbbells', 'walk', 'reps', 'Step forward into a lunge, lower your back knee, then step through into the next lunge.', 'Take a long enough step so your front shin stays vertical.'),
  E('db-row', 'One-arm Dumbbell Row', 'Back, biceps', 'Dumbbell, bench', 'dumbbell', 'reps', 'Support one hand on a bench, pull a dumbbell to your hip, lower slowly. Repeat on the other side.', 'Keep your back flat and avoid twisting.'),
  E('plank', 'Plank', 'Core, shoulders', 'Mat', 'human-male-board', 'sec', 'Hold a straight body line on forearms and toes, squeezing glutes and abs.', 'Do not let hips sag or pike.'),
  E('mountain-climber', 'Mountain Climber', 'Core, cardio', 'Mat', 'run-fast', 'sec', 'From a high plank, drive knees alternately toward your chest at a steady pace.', 'Keep your hips low and shoulders over wrists.'),
  E('db-rdl', 'Dumbbell Romanian Deadlift', 'Hamstrings, glutes', 'Dumbbells', 'weight-lifter', 'reps', 'Holding dumbbells, hinge at the hips with a soft knee bend until you feel a hamstring stretch, then stand.', 'Keep the weights close to your legs and your back flat.'),
  E('pike-pushup', 'Pike Push-up', 'Shoulders, triceps', 'Mat', 'human-handsup', 'reps', 'From a downward-dog position, bend elbows to lower your head toward the floor, then press up.', 'Keep elbows pointing slightly back.'),
  E('jump-squat', 'Jump Squat', 'Legs, power', 'None', 'jump-rope', 'reps', 'Squat down, then jump up explosively and land softly into the next squat.', 'Land with soft knees; skip if joints are sore.'),
  E('russian-twist', 'Russian Twist', 'Obliques', 'Optional weight', 'rotate-3d-variant', 'reps', 'Sit leaning back with knees bent and rotate your torso side to side.', 'Move from your ribcage, not just your arms.'),
  E('bicycle-crunch', 'Bicycle Crunch', 'Abs, obliques', 'Mat', 'bike', 'reps', 'Lie back, bring opposite elbow and knee together while extending the other leg, then alternate.', 'Do not pull on your neck.'),
  E('tricep-dip', 'Bench Tricep Dip', 'Triceps', 'Bench or chair', 'arm-flex', 'reps', 'With hands on a bench behind you, lower your hips by bending elbows to ~90°, then press up.', 'Keep your shoulders away from your ears.'),
  E('db-curl-press', 'Curl to Press', 'Arms, shoulders', 'Dumbbells', 'dumbbell', 'reps', 'Curl dumbbells to your shoulders, then press overhead; lower and repeat.', 'Avoid leaning back.'),
  // ----- advanced -----
  E('pullup', 'Pull-up', 'Back, biceps', 'Pull-up bar', 'weight-lifter', 'reps', 'Hang from a bar with palms facing away and pull your chin above the bar, then lower with control.', 'Initiate by pulling your shoulder blades down.'),
  E('archer-pushup', 'Archer Push-up', 'Chest, triceps', 'Mat', 'arm-flex', 'reps', 'Wide hands; lower toward one hand while the other arm stays extended, then alternate.', 'Keep hips square to the floor.'),
  E('bulgarian-split', 'Bulgarian Split Squat', 'Legs, glutes', 'Bench, optional dumbbells', 'human-male', 'reps', 'Back foot on a bench, lower your back knee toward the floor, then drive up through the front heel.', 'Keep your torso tall and front foot flat.'),
  E('barbell-squat', 'Barbell Back Squat', 'Legs, glutes, core', 'Barbell, rack', 'weight-lifter', 'reps', 'With the bar across your upper back, squat to at least parallel and stand while bracing your core.', 'Use a spotter or safety bars for heavy sets.'),
  E('deadlift', 'Conventional Deadlift', 'Back, glutes, hamstrings', 'Barbell', 'weight-lifter', 'reps', 'Hinge to grip the bar, brace, then stand by pushing the floor away, keeping the bar close.', 'Keep a neutral spine; add weight gradually.'),
  E('hiit-sprint', 'Sprint Interval', 'Full-body cardio', 'Track or treadmill', 'run-fast', 'sec', 'Run at near-maximal effort for the work period, then walk to recover.', 'Warm up thoroughly first.'),
  E('burpee', 'Burpee', 'Full body', 'None', 'human-handsup', 'reps', 'Squat, kick back to a plank, do a push-up, jump the feet in, then jump up.', 'Slow the pace to keep good form.'),
  E('hanging-leg-raise', 'Hanging Leg Raise', 'Abs, hip flexors', 'Pull-up bar', 'human', 'reps', 'Hang from a bar and raise straight legs to hip height or higher, then lower slowly.', 'Avoid swinging.'),
  E('kb-swing', 'Kettlebell Swing', 'Glutes, hamstrings, cardio', 'Kettlebell', 'kettlebell', 'reps', 'Hinge and swing the kettlebell to chest height by snapping your hips forward.', 'Power comes from the hips, not the arms.'),
  E('db-thruster', 'Dumbbell Thruster', 'Full body', 'Dumbbells', 'dumbbell', 'reps', 'Squat with dumbbells at your shoulders, then drive up and press them overhead in one motion.', 'Keep your core braced.'),
  E('l-sit', 'L-sit Hold', 'Core, triceps', 'Parallettes or chair', 'human-male-board', 'sec', 'Support your body on your hands and hold your legs straight out in front.', 'Bend knees to scale down.'),
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export type ProgramExercise = { id: string; sets: number; reps: number; rest: number };
export type Program = {
  id: string;
  level: FitnessLevel;
  name: string;
  focus: string;
  description: string;
  met: number;
  exercises: ProgramExercise[];
};

const P = (id: string, sets: number, reps: number, rest: number): ProgramExercise => ({ id, sets, reps, rest });

export const PROGRAMS: Program[] = [
  {
    id: 'b-fullbody', level: 'beginner', name: 'First Steps Full Body', focus: 'Introduction to fitness', met: 3.5,
    description: 'A gentle full-body session that teaches the basic movement patterns.',
    exercises: [P('march', 2, 45, 30), P('bw-squat', 2, 10, 45), P('wall-pushup', 2, 10, 45), P('glute-bridge', 2, 12, 45), P('knee-plank', 2, 20, 45), P('cat-cow', 1, 10, 0)],
  },
  {
    id: 'b-cardio', level: 'beginner', name: 'Light Cardio Starter', focus: 'Light cardio', met: 3.8,
    description: 'Low-impact cardio to build stamina without stressing the joints.',
    exercises: [P('brisk-walk', 1, 300, 0), P('jacks-lowimpact', 3, 40, 30), P('march', 3, 45, 30), P('step-up', 2, 10, 45), P('brisk-walk', 1, 180, 0)],
  },
  {
    id: 'b-core', level: 'beginner', name: 'Core & Mobility Basics', focus: 'Core stability', met: 3.0,
    description: 'Safe core strengthening with spine mobility work.',
    exercises: [P('cat-cow', 2, 10, 20), P('bird-dog', 3, 8, 30), P('dead-bug', 3, 8, 30), P('knee-plank', 3, 20, 30), P('glute-bridge', 2, 12, 30)],
  },
  {
    id: 'b-strength', level: 'beginner', name: 'Beginner Strength A', focus: 'Basic strength training', met: 4.0,
    description: 'Light resistance work to learn lifting technique.',
    exercises: [P('goblet-squat', 3, 8, 60), P('band-row', 3, 10, 45), P('db-press-light', 3, 8, 60), P('assisted-lunge', 2, 8, 45), P('calf-raise', 2, 12, 30)],
  },
  {
    id: 'i-upper', level: 'intermediate', name: 'Upper Body Builder', focus: 'Muscle building', met: 5.0,
    description: 'Push and pull volume for chest, back, shoulders and arms.',
    exercises: [P('pushup', 4, 12, 60), P('db-row', 4, 10, 60), P('pike-pushup', 3, 8, 60), P('tricep-dip', 3, 12, 45), P('db-curl-press', 3, 10, 60)],
  },
  {
    id: 'i-lower', level: 'intermediate', name: 'Lower Body Strength', focus: 'Strength development', met: 5.5,
    description: 'Squat, lunge and hinge patterns for stronger legs and glutes.',
    exercises: [P('goblet-squat', 4, 12, 60), P('walking-lunge', 3, 12, 60), P('db-rdl', 4, 10, 60), P('glute-bridge', 3, 15, 45), P('calf-raise', 3, 15, 30)],
  },
  {
    id: 'i-cardio', level: 'intermediate', name: 'Cardio Endurance Circuit', focus: 'Endurance training', met: 7.0,
    description: 'Moderate-intensity circuit to boost aerobic capacity.',
    exercises: [P('jump-squat', 3, 15, 30), P('mountain-climber', 3, 40, 30), P('burpee', 3, 8, 45), P('bicycle-crunch', 3, 20, 30), P('brisk-walk', 1, 240, 0)],
  },
  {
    id: 'i-core', level: 'intermediate', name: 'Core Strength Builder', focus: 'Core & conditioning', met: 4.5,
    description: 'Progressive core training for stability and power transfer.',
    exercises: [P('plank', 3, 45, 30), P('russian-twist', 3, 20, 30), P('bicycle-crunch', 3, 20, 30), P('mountain-climber', 3, 30, 30)],
  },
  {
    id: 'a-hiit', level: 'advanced', name: 'HIIT Performance', focus: 'High-intensity cardio', met: 9.0,
    description: 'Short, hard intervals for conditioning. Warm up well first.',
    exercises: [P('hiit-sprint', 6, 30, 60), P('burpee', 4, 12, 45), P('kb-swing', 4, 20, 45), P('mountain-climber', 4, 45, 30), P('jump-squat', 4, 15, 30)],
  },
  {
    id: 'a-push', level: 'advanced', name: 'Advanced Strength: Push/Pull', focus: 'Advanced strength training', met: 6.0,
    description: 'Heavy-ish upper body strength work built on bodyweight mastery.',
    exercises: [P('pullup', 5, 6, 90), P('archer-pushup', 4, 6, 75), P('db-thruster', 4, 8, 75), P('hanging-leg-raise', 3, 10, 60), P('l-sit', 3, 20, 60)],
  },
  {
    id: 'a-legs', level: 'advanced', name: 'Heavy Legs & Power', focus: 'Muscle development', met: 6.5,
    description: 'Barbell and unilateral leg work for size and strength. Use a spotter.',
    exercises: [P('barbell-squat', 5, 5, 120), P('deadlift', 4, 5, 120), P('bulgarian-split', 3, 8, 75), P('kb-swing', 3, 15, 60)],
  },
  {
    id: 'a-athlete', level: 'advanced', name: 'Athlete Conditioning', focus: 'Performance-based training', met: 8.0,
    description: 'Mixed power and endurance conditioning for athletic performance.',
    exercises: [P('hiit-sprint', 8, 20, 40), P('db-thruster', 4, 10, 60), P('burpee', 4, 15, 45), P('pullup', 4, 8, 75), P('plank', 3, 60, 30)],
  },
];

export const LEVELS: { id: FitnessLevel; label: string; blurb: string }[] = [
  { id: 'beginner', label: 'Beginner', blurb: 'Basic exercises, light cardio and an introduction to fitness.' },
  { id: 'intermediate', label: 'Intermediate', blurb: 'Moderate intensity, strength development and endurance.' },
  { id: 'advanced', label: 'Advanced', blurb: 'High intensity, advanced strength and performance training.' },
];

/** Estimated seconds for a list of exercises, given ~3 s per rep for rep-based moves. */
export function estimateSeconds(items: { id: string; sets: number; reps: number; rest: number }[]): number {
  let total = 0;
  for (const it of items) {
    const ex = EXERCISE_BY_ID[it.id];
    const work = ex?.unit === 'sec' ? it.reps : it.reps * 3;
    total += it.sets * (work + it.rest);
  }
  return total;
}

export function estimateMinutes(items: { id: string; sets: number; reps: number; rest: number }[]): number {
  return Math.max(1, Math.round(estimateSeconds(items) / 60));
}

export function howToVideoUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' exercise proper form')}`;
}
