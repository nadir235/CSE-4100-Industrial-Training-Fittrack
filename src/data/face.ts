export type FaceCategory = 'Face yoga' | 'Jawline' | 'Cheeks' | 'Forehead' | 'Neck' | 'Relaxation';

export type FaceExercise = {
  id: string;
  name: string;
  category: FaceCategory;
  icon: string;
  steps: string[];
  durationSec: number;
  reps: string;
  note: string;
};

const F = (
  id: string,
  name: string,
  category: FaceCategory,
  icon: string,
  steps: string[],
  durationSec: number,
  reps: string,
  note: string,
): FaceExercise => ({ id, name, category, icon, steps, durationSec, reps, note });

export const FACE_EXERCISES: FaceExercise[] = [
  F('lion', "Lion's Face", 'Face yoga', 'emoticon-excited-outline', ['Inhale through your nose.', 'Open your mouth wide, stick your tongue out and stretch it down toward your chin.', 'Widen your eyes and exhale with a "haa" sound.'], 30, '5 rounds', 'Releases tension around the eyes and mouth.'),
  F('fish', 'Fish Face', 'Face yoga', 'fish', ['Suck your cheeks inward to make a "fish" face.', 'Try to smile while holding it.', 'Hold, then relax.'], 30, '3 × 10 s hold', 'Gently engages the cheek muscles.'),
  F('smile-lift', 'Smile Lifts', 'Face yoga', 'emoticon-happy-outline', ['Smile as wide as you comfortably can with lips closed.', 'Press fingertips lightly on the cheek folds and hold the smile.', 'Release slowly.'], 30, '10 reps', 'A light facial-muscle activation exercise.'),
  F('o-pose', 'Vowel "O" Lift', 'Face yoga', 'emoticon-kiss-outline', ['Form a large "O" with your mouth, covering your teeth with your lips.', 'Smile up into the corners of your mouth while keeping the O.', 'Hold, then relax.'], 30, '3 × 10 s hold', 'Targets the area around the mouth.'),
  F('jaw-release', 'Jaw Release', 'Jawline', 'face-man-outline', ['Let your jaw hang loose and open slowly.', 'Move your jaw gently side to side for 10 seconds.', 'Close softly without clenching.'], 40, '5 rounds', 'Helps relieve jaw tension.'),
  F('chin-lift', 'Chin Lift', 'Jawline', 'arrow-up-bold-outline', ['Tilt your head back and look at the ceiling.', 'Pucker your lips as if kissing the ceiling, then relax.', 'Return your head to neutral.'], 45, '10 reps', 'Stretches under the chin and neck.'),
  F('jaw-resist', 'Jaw Resistance', 'Jawline', 'hand-back-right-outline', ['Place a fist under your chin.', 'Slowly open your mouth against light resistance from your fist.', 'Close slowly. Keep resistance gentle.'], 45, '10 reps', 'Stop if you feel any jaw pain or clicking.'),
  F('tongue-press', 'Tongue Press', 'Jawline', 'tooth-outline', ['Press the whole tongue gently against the roof of your mouth.', 'Hold 5 seconds while keeping your teeth slightly apart.', 'Relax.'], 40, '10 reps', 'Supports good tongue posture.'),
  F('cheek-puff', 'Cheek Puff', 'Cheeks', 'balloon', ['Fill your cheeks with air and hold.', 'Move the air from the left cheek to the right cheek.', 'Release slowly.'], 40, '3 × 20 s', 'Gentle cheek muscle control.'),
  F('cheek-lift', 'Cheek Lift', 'Cheeks', 'arrow-expand-up', ['Smile and place your fingertips on the top of your cheekbones.', 'Lift your cheeks up toward your eyes against light finger pressure.', 'Release.'], 40, '15 reps', 'Light activation of the cheek muscles.'),
  F('cheek-massage', 'Cheek Massage', 'Cheeks', 'hand-wave-outline', ['Use clean fingertips to make small circles on your cheeks.', 'Move from the nose outward toward the ears.', 'Use light pressure only.'], 60, '1 minute', 'Promotes relaxation and circulation.'),
  F('brow-lift', 'Brow Lift', 'Forehead', 'eye-outline', ['Place your fingers just above your eyebrows.', 'Raise your eyebrows against gentle resistance, hold 5 s.', 'Release slowly.'], 40, '10 reps', 'Relaxes and activates the forehead muscles.'),
  F('forehead-smooth', 'Forehead Smoothing', 'Forehead', 'gesture-swipe-horizontal', ['Lay both hands flat across your forehead.', 'Sweep gently outward toward the temples, three times slowly.', 'Close your eyes and breathe.'], 45, '10 sweeps', 'A relaxing self-massage.'),
  F('temple-circles', 'Temple Circles', 'Forehead', 'circle-outline', ['With fingertips on your temples, make slow circles.', 'Switch directions after 20 seconds.', 'Keep your jaw relaxed.'], 40, '2 × 20 s', 'Helps ease tension headaches in some people.'),
  F('neck-tilts', 'Neck Side Tilts', 'Neck', 'human-handsup', ['Sit tall and drop your right ear toward your right shoulder.', 'Hold 15 seconds, breathe, then switch sides.', 'Keep your shoulders down.'], 60, '2 each side', 'A gentle neck stretch; move within a comfortable range.'),
  F('neck-rotate', 'Neck Rotations', 'Neck', 'rotate-right', ['Turn your head slowly to look over your right shoulder, hold 5 s.', 'Return to centre and turn left.', 'Never force the movement.'], 60, '8 each side', 'Stop if you feel dizzy or have pain.'),
  F('chin-tuck', 'Chin Tucks', 'Neck', 'arrow-collapse-down', ['Sit or stand tall.', 'Draw your chin straight back, making a "double chin", hold 5 seconds.', 'Release.'], 50, '10 reps', 'Improves neck posture awareness.'),
  F('eye-palming', 'Eye Palming', 'Relaxation', 'hand-front-left', ['Rub your palms together to warm them.', 'Cup them gently over closed eyes without pressure.', 'Breathe slowly for the duration.'], 60, '1 minute', 'A calming exercise for tired eyes.'),
  F('facial-breath', 'Facial Relaxation Breath', 'Relaxation', 'meditation', ['Soften your forehead, eyes, cheeks and jaw one by one.', 'Inhale for 4 counts, exhale for 6 counts.', 'Let your tongue rest and teeth part slightly.'], 90, '1.5 minutes', 'Reduces facial tension and stress.'),
];

export const FACE_EXERCISE_BY_ID: Record<string, FaceExercise> = Object.fromEntries(FACE_EXERCISES.map((e) => [e.id, e]));
export const FACE_CATEGORIES: FaceCategory[] = ['Face yoga', 'Jawline', 'Cheeks', 'Forehead', 'Neck', 'Relaxation'];

export const DEFAULT_FACE_ROUTINE = ['lion', 'smile-lift', 'jaw-release', 'cheek-lift', 'brow-lift', 'chin-tuck', 'facial-breath'];

export const FACE_DISCLAIMER =
  'Face exercises can help you relax and become more aware of your facial muscles. They are not proven to reduce facial fat or change the structure of your face. Stop if you feel pain and speak with a professional if you have jaw (TMJ) or neck problems.';
