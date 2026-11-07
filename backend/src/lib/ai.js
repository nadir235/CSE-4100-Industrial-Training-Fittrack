'use strict';
/**
 * AI coach: Gemini -> Hugging Face -> built-in rule-based coach.
 * API keys stay on the server; the app only ever calls POST /ai/chat.
 */

const SYSTEM_PROMPT = `You are FitTrack's AI fitness coach inside a gym membership app.
Help with: workout recommendations and weekly schedules, fitness goals, exercise explanations and alternatives, general nutrition guidance and meal ideas, recovery and rest, and reading the member's logged progress.
Rules:
- Use the MEMBER DATA below to personalise answers (fitness level, goal, available time, recent workouts, weight trend). If data is missing, say so briefly and give a sensible general answer.
- You are NOT a doctor. Never diagnose, never give medical advice, never recommend medication or supplements as treatment. For pain, injury, dizziness, chest pain, pregnancy, eating disorders, diabetes or other medical conditions, tell the member to consult a qualified healthcare professional.
- Never encourage crash diets, extreme calorie restriction, or training through pain. Keep calorie advice at a general level.
- Be concise, friendly and practical. Use short paragraphs and "-" bullet lists. Use **bold** sparingly for headings.
- Stay on topic (fitness, health habits, gym). Politely decline unrelated requests.`;

function fmtDate(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Builds a compact, non-identifying summary of the member's data for the model. */
async function buildContext(db, uid) {
  const userRef = db.collection('users').doc(uid);
  const [profileSnap, logs, weights, runs, water, fasts] = await Promise.all([
    userRef.get(),
    userRef.collection('workoutLogs').orderBy('at', 'desc').limit(10).get(),
    userRef.collection('weights').orderBy('at', 'desc').limit(6).get(),
    userRef.collection('running').orderBy('at', 'desc').limit(5).get(),
    userRef.collection('water').where('at', '>=', Date.now() - 7 * 86_400_000).get(),
    userRef.collection('fasting').orderBy('startedAt', 'desc').limit(3).get(),
  ]);
  const p = profileSnap.exists ? profileSnap.data() : {};
  const w = weights.docs.map((d) => d.data());
  const l = logs.docs.map((d) => d.data());
  const r = runs.docs.map((d) => d.data());
  const waterTotal = water.docs.reduce((s, d) => s + (d.data().ml || 0), 0);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const ctx = {
    level: p.fitnessLevel || 'beginner',
    goal: p.goal || null,
    age: p.age || null,
    sex: p.sex || null,
    heightCm: p.heightCm || null,
    weightKg: w[0]?.kg || p.weightKg || null,
    availableMinutes: p.availableMinutes || null,
    workoutsLast7Days: l.filter((x) => x.at >= weekAgo).length,
    recentWorkouts: l.slice(0, 5).map((x) => `${fmtDate(x.at)} ${x.title} (${x.durationMin} min)`),
    weightTrend: w.length > 1 ? `${w[w.length - 1].kg} kg (${fmtDate(w[w.length - 1].at)}) -> ${w[0].kg} kg (${fmtDate(w[0].at)})` : null,
    recentRuns: r.slice(0, 3).map((x) => `${fmtDate(x.at)} ${x.distanceKm} km in ${Math.round(x.durationSec / 60)} min`),
    avgWaterMlPerDay7d: Math.round(waterTotal / 7),
    waterGoalMl: p.waterGoalMl || null,
    lastFast: fasts.docs[0] ? `${fasts.docs[0].data().label} (${fasts.docs[0].data().status})` : null,
  };
  return ctx;
}

function contextText(ctx) {
  const lines = [
    `Fitness level: ${ctx.level}`,
    ctx.goal ? `Goal: ${ctx.goal}` : 'Goal: not set',
    ctx.age ? `Age: ${ctx.age}` : null,
    ctx.sex ? `Sex: ${ctx.sex}` : null,
    ctx.heightCm ? `Height: ${ctx.heightCm} cm` : null,
    ctx.weightKg ? `Weight: ${ctx.weightKg} kg` : null,
    ctx.availableMinutes ? `Time available per workout: ${ctx.availableMinutes} min` : null,
    `Workouts in the last 7 days: ${ctx.workoutsLast7Days}`,
    ctx.recentWorkouts.length ? `Recent workouts: ${ctx.recentWorkouts.join('; ')}` : 'Recent workouts: none logged',
    ctx.weightTrend ? `Weight trend: ${ctx.weightTrend}` : null,
    ctx.recentRuns.length ? `Recent runs: ${ctx.recentRuns.join('; ')}` : null,
    `Average water (7 days): ${ctx.avgWaterMlPerDay7d} ml/day${ctx.waterGoalMl ? ` (goal ${ctx.waterGoalMl})` : ''}`,
    ctx.lastFast ? `Last fast: ${ctx.lastFast}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

async function fetchJson(url, init, timeoutMs = 25_000, fetchImpl = fetch) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    if (!res.ok) {
      const msg = json?.error?.message || json?.error || text.slice(0, 200);
      throw new Error(`HTTP ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

async function askGemini({ system, history, message, env, fetchImpl }) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const model = env.GEMINI_MODEL || 'gemini-flash-latest';
  const contents = [
    ...history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] })),
    { role: 'user', parts: [{ text: message }] },
  ];
  const json = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.6, maxOutputTokens: 900 },
      }),
    },
    25_000,
    fetchImpl,
  );
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
  if (!text) throw new Error(`Gemini returned no text${json?.promptFeedback?.blockReason ? ` (blocked: ${json.promptFeedback.blockReason})` : ''}`);
  return text;
}

async function askHuggingFace({ system, history, message, env, fetchImpl }) {
  const token = env.HF_API_TOKEN;
  if (!token) throw new Error('HF_API_TOKEN not set');
  const model = env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct';
  const json = await fetchJson(
    'https://router.huggingface.co/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, ...history.map((m) => ({ role: m.role, content: m.text })), { role: 'user', content: message }],
        max_tokens: 800,
        temperature: 0.6,
      }),
    },
    30_000,
    fetchImpl,
  );
  const text = json?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Hugging Face returned no text');
  return text;
}

// ---------------------------------------------------------------- rule-based fallback

const PLANS = {
  beginner: {
    split: ['Mon: Full body (First Steps Full Body)', 'Wed: Light cardio (Light Cardio Starter)', 'Fri: Core & mobility basics', 'Sat or Sun: 30–40 min easy walk'],
    note: 'Start with 2–3 sessions a week and add a 4th only when the first weeks feel easy.',
  },
  intermediate: {
    split: ['Mon: Upper body builder', 'Tue: Easy run or cardio circuit', 'Thu: Lower body strength', 'Fri: Core strength builder', 'Sat: Endurance circuit'],
    note: 'Aim to add a little weight or one extra rep each week (progressive overload).',
  },
  advanced: {
    split: ['Mon: Heavy legs & power', 'Tue: Advanced push/pull', 'Wed: Easy cardio or mobility', 'Thu: HIIT performance', 'Fri: Heavy legs/strength', 'Sat: Athlete conditioning', 'Sun: Full rest'],
    note: 'Plan a lighter "deload" week every 4–6 weeks to recover.',
  },
};

function ruleBasedReply(message, ctx) {
  const q = message.toLowerCase();
  const level = ctx.level;
  const has = (...w) => w.some((x) => q.includes(x));
  const plan = PLANS[level] || PLANS.beginner;
  const timeLine = ctx.availableMinutes ? `You told me you have about ${ctx.availableMinutes} minutes per session, so I'll keep sessions around that.` : 'Tell me how many minutes you have per session in your Profile and I can tailor this further.';

  if (has('emergency', 'chest pain', 'faint', 'dizzy', 'injur', 'pain', 'doctor', 'diabet', 'pregnan', 'eating disorder')) {
    return `I can't give medical advice. If you have pain, an injury, dizziness, chest discomfort or a medical condition, please stop training and speak with a qualified healthcare professional before continuing.\n\nOnce you're cleared, I'm happy to help you plan gentle, suitable workouts.`;
  }
  if (has('plan', 'schedule', 'routine', 'week', 'program')) {
    return `**Suggested weekly plan (${level})**\n${plan.split.map((s) => `- ${s}`).join('\n')}\n\n${plan.note}\n${timeLine}\nYou can also build your own routine in Workouts > My routines.`;
  }
  if (has('eat', 'meal', 'food', 'diet', 'nutrition', 'protein', 'calorie', 'breakfast', 'lunch', 'dinner')) {
    return `**General nutrition ideas**\n- Build meals around a protein source (eggs, fish, chicken, lentils/dal, yogurt, tofu), a high-fibre carb (rice or roti in sensible portions, oats, fruit) and vegetables.\n- Before training: a small carb-rich snack (banana, toast) 1–2 hours before.\n- After training: protein plus carbs (for example eggs with rice, or yogurt with fruit).\n- Drink water through the day${ctx.waterGoalMl ? ` — your goal is ${ctx.waterGoalMl} ml` : ''}.\nUse the Daily Calories and Macronutrient calculators for estimates. This is general guidance, not a personal diet prescription.`;
  }
  if (has('rest', 'recover', 'sleep', 'sore', 'overtrain')) {
    return `**Recovery basics**\n- Sleep 7–9 hours; it's when most recovery happens.\n- Leave at least one full rest day each week${level === 'advanced' ? ' and plan a deload week every 4–6 weeks' : ''}.\n- Mild soreness (24–48 h) is normal; sharp or lasting pain isn't — stop and consult a professional.\n- Light walking, stretching and good hydration help.\nYou've logged ${ctx.workoutsLast7Days} workout${ctx.workoutsLast7Days === 1 ? '' : 's'} in the last 7 days.`;
  }
  if (has('progress', 'analy', 'how am i', 'doing')) {
    const lines = [`**Your progress snapshot**`, `- Workouts in the last 7 days: ${ctx.workoutsLast7Days}`];
    if (ctx.weightTrend) lines.push(`- Weight trend: ${ctx.weightTrend}`);
    if (ctx.recentRuns.length) lines.push(`- Latest run: ${ctx.recentRuns[0]}`);
    lines.push(`- Average water: ${ctx.avgWaterMlPerDay7d} ml/day`);
    lines.push(ctx.workoutsLast7Days >= 3 ? 'Nice consistency — keep it going and make sure you schedule rest days.' : 'Try to build up to 3 sessions a week; consistency matters more than intensity.');
    return lines.join('\n');
  }
  if (has('alternative', 'instead of', 'replace', 'substitute', 'push-up', 'pushup', 'squat', 'plank')) {
    return `**Easier / alternative options**\n- Push-ups → wall or knee push-ups, or incline push-ups on a bench.\n- Squats → box squats to a chair, or goblet squats with a light weight.\n- Plank → knee plank or dead bug.\n- Running → brisk walking or cycling.\nTell me which exercise and what's limiting you (equipment, joints, difficulty) and I'll suggest something specific. For pain, please see a professional.`;
  }
  if (has('goal', 'lose weight', 'build muscle', 'weight loss', 'muscle')) {
    return `**Setting a goal**\n- Pick one main goal for the next 8–12 weeks (for example: 3 workouts a week, or lose ~0.25–0.5 kg per week).\n- Track weight weekly in Progress and workouts in Workouts.\n- Use the Calorie Deficit calculator to check that your pace is realistic.\nYour current goal: ${ctx.goal || 'not set yet — add one in Profile'}.`;
  }
  return `I'm your FitTrack coach. I can build a weekly plan, explain exercises, suggest alternatives, give general nutrition ideas, and review your progress.\n\nYou're on the **${level}** level and logged ${ctx.workoutsLast7Days} workout${ctx.workoutsLast7Days === 1 ? '' : 's'} this week. Try asking: "Create a weekly plan for me" or "What should I eat after training?".`;
}

/** Main entry. providers can be injected for tests. */
async function answer({ db, uid, message, history, env = process.env, fetchImpl = fetch, logger = console }) {
  const ctx = await buildContext(db, uid);
  const system = `${SYSTEM_PROMPT}\n\nMEMBER DATA:\n${contextText(ctx)}`;
  const args = { system, history, message, env, fetchImpl };

  const chain = [
    ['gemini', askGemini],
    ['huggingface', askHuggingFace],
  ];
  for (const [name, fn] of chain) {
    try {
      const text = await fn(args);
      return { text, provider: name };
    } catch (e) {
      logger.warn?.(`[ai] ${name} failed: ${e.message}`);
    }
  }
  return { text: ruleBasedReply(message, ctx), provider: 'built-in coach' };
}

module.exports = { answer, buildContext, ruleBasedReply, SYSTEM_PROMPT };
