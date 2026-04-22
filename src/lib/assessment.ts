// Shared assessment-video data: exercise list + rules for filtering the list
// based on a client's intake answers.

export type AssessmentSection =
  | "required"
  | "strength"
  | "gymnastics"
  | "mobility";

export type AssessmentExercise = {
  n: number;
  name: string;
  desc: string;
  section: AssessmentSection;
  /**
   * Optional intake-based gate.
   * - If the function returns true (or the exercise has no gate), the client
   *   is asked to film it.
   * - If false, we hide the slot because the client declared they cannot or
   *   do not perform this skill.
   *
   * Passing an undefined intake (no intake filled yet) defaults to showing
   * every slot so the reference page keeps its full list.
   */
  gate?: (intake: IntakeAnswers | undefined) => boolean;
  /**
   * Which intake field this video verifies. Used by the coach-side review
   * view to show declared value next to the video.
   */
  verifies?: keyof IntakeAnswers;
};

export type IntakeAnswers = {
  max_pull_ups?: string | null;
  max_dips?: string | null;
  max_push_ups?: string | null;
  deep_squat?: string | null;
  handstand?: string | null;
  muscle_up?: string | null;
  planche?: string | null;
  front_lever?: string | null;
  lsit_vsit?: string | null;
  hspu?: string | null;
  hamstrings?: string | null;
  splits?: string[] | null;
  front_split_left?: string | null;
  front_split_right?: string | null;
  middle_split?: string | null;
  shoulder_mobility?: string | null;
  squat_flat_heels?: string | null;
  backbend?: string | null;
  rope_climb?: string | null;
};

const is = (v: string | null | undefined, ...expected: string[]) =>
  !!v && expected.includes(v);
const includesWord = (v: string | null | undefined, needle: string) =>
  !!v && v.toLowerCase().includes(needle.toLowerCase());

export const ASSESSMENT_EXERCISES: AssessmentExercise[] = [
  // Always required (9)
  { n: 1, name: "Max pull-ups", desc: "Dead hang start, full range of motion, film the entire set.", section: "required",
    verifies: "max_pull_ups",
    gate: (i) => !i || !is(i.max_pull_ups, "0") },
  { n: 2, name: "Max dips", desc: "Full lockout at top, full range of motion, film the entire set.", section: "required",
    verifies: "max_dips",
    gate: (i) => !i || !is(i.max_dips, "0") },
  { n: 3, name: "Max push-ups", desc: "Chest to floor, full lockout, film the entire set.", section: "required",
    verifies: "max_push_ups" },
  { n: 4, name: "Bodyweight squat", desc: "10 slow reps, side angle, heels stay on the floor.", section: "required" },
  { n: 5, name: "Hanging dead hang", desc: "Hold as long as possible. Say the time out loud or show a timer.", section: "required" },
  { n: 6, name: "Deep squat hold", desc: "Hold 30 seconds, heels on floor, film from front + side.", section: "required",
    verifies: "deep_squat",
    gate: (i) => !i || !is(i.deep_squat, "No, not yet") },
  { n: 7, name: "Shoulder wall test", desc: "Stand with your back against a wall. Raise both arms until they touch the wall above your head — without arching your lower back. Film from the front.", section: "required",
    verifies: "shoulder_mobility" },
  { n: 8, name: "Pike stretch", desc: "Standing, legs straight, reach down towards the floor. Side angle. Say out loud how far from the floor your hands are.", section: "required",
    verifies: "hamstrings" },
  { n: 9, name: "Front split", desc: "Best attempt on each leg. One video, film both sides.", section: "required" },
  { n: 11, name: "Middle split", desc: "Best attempt, front angle.", section: "required" },
  { n: 12, name: "Pancake (seated, legs wide)", desc: "Sit on floor with legs wide, lean forward with chest towards the floor. Film from the front.", section: "required" },

  // Strength skills (optional)
  { n: 13, name: "Pistol squat", desc: "3 reps each leg, side angle, full depth.", section: "strength",
    gate: (i) => !i || is(i.deep_squat, "Yes easily") },
  { n: 14, name: "Muscle up (bar)", desc: "1 clean rep, show the full transition.", section: "strength",
    verifies: "muscle_up",
    gate: (i) => !i || !is(i.muscle_up, "Never / still learning") },
  { n: 15, name: "Ring muscle up", desc: "1 clean rep.", section: "strength",
    gate: (i) => !i || is(i.muscle_up, "Yes strict (rings)") },
  { n: 16, name: "Rope climb (arms only, no legs)", desc: "1 ascent.", section: "strength",
    verifies: "rope_climb",
    gate: (i) => !i || !is(i.rope_climb, "Never tried", "With legs only") },

  // Gymnastics skills (optional)
  { n: 17, name: "Handstand (wall, back to wall)", desc: "Hold 10 seconds or more, side angle.", section: "gymnastics",
    verifies: "handstand",
    gate: (i) => !i || !is(i.handstand, "Never tried") },
  { n: 18, name: "Freestanding handstand", desc: "Best hold, front or side angle.", section: "gymnastics",
    gate: (i) => !i || includesWord(i.handstand, "Freestanding") },
  { n: 19, name: "Handstand push-up", desc: "1 rep, full range of motion, side angle.", section: "gymnastics",
    verifies: "hspu",
    gate: (i) => !i || is(i.hspu, "1 – 3 strict reps", "5+ strict reps", "90° HSPU or rings") },
  { n: 20, name: "L-sit", desc: "Hold 5 seconds or more, both legs straight.", section: "gymnastics",
    verifies: "lsit_vsit",
    gate: (i) => !i || !is(i.lsit_vsit, "None yet") },
  { n: 21, name: "V-sit", desc: "Hold 3 seconds or more.", section: "gymnastics",
    gate: (i) => !i || is(i.lsit_vsit, "V-sit") },
  { n: 22, name: "Tuck front lever", desc: "Hold 3 seconds or more, on bar or rings.", section: "gymnastics",
    verifies: "front_lever",
    gate: (i) => !i || !is(i.front_lever, "Never tried") },
  { n: 23, name: "Advanced tuck front lever", desc: "Hold 3 seconds or more.", section: "gymnastics",
    gate: (i) => !i || is(i.front_lever, "Straddle", "One leg extended", "Full") },
  { n: 24, name: "Full front lever", desc: "Hold 3 seconds or more.", section: "gymnastics",
    gate: (i) => !i || is(i.front_lever, "Full") },
  { n: 25, name: "Tuck planche", desc: "Hold 3 seconds or more.", section: "gymnastics",
    verifies: "planche",
    gate: (i) => !i || (!is(i.planche, "Never tried", "Planche lean only")) },
  { n: 26, name: "Straddle planche", desc: "Hold 3 seconds or more.", section: "gymnastics",
    gate: (i) => !i || is(i.planche, "Straddle planche", "Full planche") },
  { n: 27, name: "Full planche", desc: "Hold 3 seconds or more.", section: "gymnastics",
    gate: (i) => !i || is(i.planche, "Full planche") },

  // Mobility (optional extras)
  { n: 28, name: "Backbend", desc: "Best attempt, side angle.", section: "mobility",
    verifies: "backbend",
    gate: (i) => !i || !is(i.backbend, "Never tried / stiff") },
];

export const visibleExercises = (
  intake: IntakeAnswers | undefined
): AssessmentExercise[] =>
  ASSESSMENT_EXERCISES.filter((e) => !e.gate || e.gate(intake));

export const SECTION_LABEL: Record<AssessmentSection, string> = {
  required: "Required — everyone",
  strength: "Strength skills",
  gymnastics: "Gymnastics skills",
  mobility: "Mobility",
};
