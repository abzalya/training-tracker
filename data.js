// Seed data — your training plan, baked in. Edit freely; nothing here is fetched.
// Muscle tags drive the "volume per muscle group" chart.

export const PROFILE = {
  name: "You",
  startDate: "2026-06-02", // Monday of week 1
  weightKg: 64,
  goal: "Sub-50 10k + hypertrophy",
  zone2: { low: 130, high: 144 },
  tempo: { low: 158, high: 168 },
};

// Weekly template. day = JS getDay() (0=Sun ... 6=Sat)
export const WEEK = {
  1: { type: "gym",  key: "push", label: "Day A — Push" },
  2: { type: "run",  key: "easy", label: "Easy run" },
  3: { type: "gym",  key: "pull", label: "Day B — Pull" },
  4: { type: "run",  key: "tempo", label: "Tempo run" },
  5: { type: "gym",  key: "legs", label: "Day C — Legs + Core" },
  6: { type: "run",  key: "long", label: "Long run" },
  0: { type: "rest", key: "rest", label: "Rest" },
};

export const GYM = {
  push: {
    label: "Day A — Push",
    exercises: [
      { name: "Incline barbell bench press", sets: 4, reps: "6–8",  rest: "2–3 min", muscles: ["chest","front delt"], note: "Primary compound. 2 sec descent." },
      { name: "Flat DB press",               sets: 3, reps: "8–10", rest: "90 sec",  muscles: ["chest","tricep"],     note: "Full pec stretch at bottom." },
      { name: "Pec deck",                    sets: 3, reps: "10–12",rest: "60 sec",  muscles: ["chest"],              note: "Squeeze 1 sec at peak contraction." },
      { name: "Seated DB shoulder press",    sets: 3, reps: "8–10", rest: "90 sec",  muscles: ["shoulder","tricep"],  note: "Stop just short of lockout." },
      { name: "Cable lateral raise",         sets: 3, reps: "12–15",rest: "60 sec",  muscles: ["side delt"],          note: "Lead with elbow, cable not DB." },
      { name: "Rope tricep pushdown",        sets: 3, reps: "10–12",rest: "60 sec",  muscles: ["tricep"],             note: "Pull rope apart at bottom." },
    ],
  },
  pull: {
    label: "Day B — Pull",
    exercises: [
      { name: "Weighted pull-up",            sets: 4, reps: "5–8",  rest: "2–3 min", muscles: ["lats","bicep"],       note: "Full dead hang. Assisted if needed." },
      { name: "Lat pulldown (wide grip)",    sets: 3, reps: "10–12",rest: "90 sec",  muscles: ["lats"],               note: "Pull to upper chest, drive elbows down." },
      { name: "Machine row",                 sets: 3, reps: "8–10", rest: "90 sec",  muscles: ["mid back"],           note: "Row to stomach not armpit. Pause at contraction." },
      { name: "Face pull (cable)",           sets: 3, reps: "12–15",rest: "60 sec",  muscles: ["rear delt"],          note: "Elbows high and wide. Shoulder health." },
      { name: "Incline DB curl",             sets: 3, reps: "10–12",rest: "60 sec",  muscles: ["bicep"],              note: "Arms hang behind torso — full stretch." },
      { name: "Hammer curl",                 sets: 3, reps: "10–12",rest: "60 sec",  muscles: ["bicep"],              note: "Neutral grip. Builds brachialis." },
    ],
  },
  legs: {
    label: "Day C — Legs + Core",
    warning: "Stop 1–2 reps short of failure on every set — long run is tomorrow.",
    exercises: [
      { name: "Barbell back squat",          sets: 4, reps: "6–8",  rest: "2–3 min", muscles: ["quads","glutes"],     note: "Depth to parallel. Brace hard." },
      { name: "Romanian deadlift",           sets: 3, reps: "8–10", rest: "2 min",   muscles: ["hamstrings","glutes"],note: "Use straps. Hip hinge. Feel hamstring load." },
      { name: "Leg press",                   sets: 3, reps: "10–12",rest: "90 sec",  muscles: ["quads","glutes"],     note: "High foot = more glute. Stop 1–2 short today." },
      { name: "Lying hamstring curl",        sets: 3, reps: "10–12",rest: "60 sec",  muscles: ["hamstrings"],         note: "3 sec eccentric. Injury prevention." },
      { name: "Bulgarian split squat",       sets: 2, reps: "10 ea",rest: "90 sec",  muscles: ["quads","glutes"],     note: "Rear foot on bench. Fixes imbalances." },
      { name: "Cable crunch",                sets: 3, reps: "12–15",rest: "60 sec",  muscles: ["core"],               note: "Round the spine — don't just hinge." },
      { name: "Dead bug",                    sets: 3, reps: "8–10 ea",rest:"45 sec", muscles: ["core"],               note: "Slow. Core stability for running posture." },
    ],
  },
};

export const RUNS = {
  easy:  { label: "Easy run — Zone 2 base", targetDist: 6,  hr: "130–144", pace: "7:15–7:30/km",
           desc: "Pure aerobic base. Watch HR not pace. Should feel embarrassingly easy." },
  tempo: { label: "Tempo — Threshold",      targetDist: 6,  hr: "158–168", pace: "6:00–6:20/km",
           desc: "1k warm-up / tempo block / 1k cool-down. Comfortably hard — a few words, not full sentences." },
  long:  { label: "Long run — Aerobic",     targetDist: 7,  hr: "130–144", pace: "7:15–7:45/km",
           desc: "Most important run of the week. Zone 2 throughout, no exceptions. Builds the base." },
};

// HR zones (chest-strap confirmed). Used to label runs.
export const HR_ZONES = [
  { z: 1, max: 129, label: "Z1 recovery" },
  { z: 2, max: 144, label: "Z2 base" },
  { z: 3, max: 157, label: "Z3 aerobic" },
  { z: 4, max: 168, label: "Z4 threshold" },
  { z: 5, max: 999, label: "Z5 max" },
];
