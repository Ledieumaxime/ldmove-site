// Shared option lists for the intake form. The coach-side review UI reuses
// these so any override is constrained to the exact same vocabulary the
// client picked from.

export const INTAKE_OPTIONS = {
  max_pull_ups: ["0", "1 – 3", "4 – 6", "7 – 10", "11 – 15", "15+"],
  max_dips: ["0", "1 – 3", "4 – 6", "7 – 10", "10 – 15", "15+"],
  max_push_ups: ["0 – 5", "6 – 15", "16 – 30", "30+"],
  deep_squat: ["Yes easily", "With effort / compensation", "No, not yet"],

  handstand: [
    "Never tried",
    "Wall only",
    "Freestanding — a few seconds",
    "Freestanding — 5 to 15 seconds",
    "Freestanding — 15+ seconds",
  ],
  muscle_up: [
    "Never / still learning",
    "Yes with momentum",
    "Yes strict (bar)",
    "Yes strict (rings)",
  ],
  planche: [
    "Never tried",
    "Planche lean only",
    "Tuck planche",
    "Straddle planche",
    "Full planche",
  ],
  front_lever: ["Never tried", "Tucked", "Straddle", "One leg extended", "Full"],
  lsit_vsit: ["None yet", "L-sit — few seconds", "L-sit — 10+ seconds", "V-sit"],
  hspu: [
    "Never tried",
    "Pike push-up",
    "1 – 3 strict reps",
    "5+ strict reps",
    "90° HSPU or rings",
  ],
  rope_climb: [
    "Never tried",
    "With legs only",
    "Yes, arms only (short distance)",
    "Yes, arms only (5 m+)",
  ],

  hamstrings: [
    "Palms flat on the floor",
    "Fingertips touch the floor",
    "Below my knees but not the floor",
    "I can't reach my knees",
  ],
  shoulder_mobility: [
    "Both hands touch the wall easily",
    "Only one side touches / I need to arch to do it",
    "I can't touch the wall",
  ],
  squat_flat_heels: ["Yes easily", "With effort", "No"],
  backbend: [
    "Never tried / stiff",
    "Bridge from floor",
    "Bridge from standing",
  ],
} as const;

export const VERIFIABLE_FIELDS: Array<{
  field: keyof typeof INTAKE_OPTIONS;
  label: string;
  section: "strength" | "skills" | "mobility";
  /** The assessment video exercise number that provides visual evidence. */
  exerciseN?: number;
}> = [
  { field: "max_pull_ups", label: "Max pull-ups", section: "strength", exerciseN: 1 },
  { field: "max_dips", label: "Max dips", section: "strength", exerciseN: 2 },
  { field: "max_push_ups", label: "Max push-ups", section: "strength", exerciseN: 3 },
  { field: "deep_squat", label: "Deep squat capability", section: "strength", exerciseN: 6 },

  { field: "handstand", label: "Handstand", section: "skills", exerciseN: 17 },
  { field: "muscle_up", label: "Muscle up", section: "skills", exerciseN: 14 },
  { field: "planche", label: "Planche", section: "skills", exerciseN: 25 },
  { field: "front_lever", label: "Front lever", section: "skills", exerciseN: 22 },
  { field: "lsit_vsit", label: "L-sit / V-sit", section: "skills", exerciseN: 20 },
  { field: "hspu", label: "HSPU", section: "skills", exerciseN: 19 },
  { field: "rope_climb", label: "Rope climb (arms only)", section: "skills", exerciseN: 16 },

  { field: "hamstrings", label: "Pike stretch — standing toe touch", section: "mobility", exerciseN: 8 },
  { field: "shoulder_mobility", label: "Shoulder wall test — arms overhead", section: "mobility", exerciseN: 7 },
  { field: "squat_flat_heels", label: "Deep squat (flat heels)", section: "mobility", exerciseN: 4 },
  { field: "backbend", label: "Backbend flexibility", section: "mobility", exerciseN: 28 },
];

export const STATUS_LABELS = {
  confirmed: { short: "Confirmed", emoji: "✅" },
  partial: { short: "Partial", emoji: "⚠️" },
  overestimated: { short: "Overestimated", emoji: "⬇️" },
  underestimated: { short: "Underestimated", emoji: "⬆️" },
} as const;

export type AssessmentStatus = keyof typeof STATUS_LABELS;
