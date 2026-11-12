/**
 * The words of the app tour, one entry per slide, in order. Shared by the
 * tour itself (AppTour) and by the dev page that draws its pictures
 * (src/dev/tour), so a change of wording is made once.
 *
 * Validated by Maxime on 2026-11-12. Slide 2 says on purpose that skipping
 * is for a day the session really cannot be done.
 */
export type TourCopy = { title: string; text: string[] };

export const TOUR_COPY: TourCopy[] = [
  {
    title: "Your next session",
    text: [
      "Your block is a series of sessions done in order. Tap Start Session to open the next one.",
      "After the last session, the block starts again from session 1, until your coach sends you a new one.",
    ],
  },
  {
    title: "Skip a session only if you must",
    text: [
      "Skip session is for days when today's session really can't be done: no equipment, a sore spot, not enough time. Pick another one instead.",
      "The session you skip is not lost. It comes back, and you still do it before the block starts again.",
    ],
  },
  {
    title: "Read your session",
    text: [
      "A session runs top to bottom: warm-up, exercises, mobility. Exercises in a coloured frame are done back to back, with the sets and rest written on top. Tap Video to see how it's done.",
    ],
  },
  {
    title: "Log your numbers",
    text: [
      "Under each set, type what you did: reps, seconds or tries. The set turns green. Next time you'll see your last and best, and your coach sees every number.",
    ],
  },
  {
    title: "Send your videos",
    text: [
      "Film a set and send it from the exercise, so your coach can correct your form.",
      "When a video shows real progress, your coach keeps it in My videos, next to your first assessment.",
    ],
  },
  {
    title: "Talk to your coach",
    text: [
      "Ask a question under any exercise, with photos if it helps. When your coach replies, your phone tells you, and the answer shows under the exercise and in your Inbox.",
    ],
  },
  {
    title: "Finish your session",
    text: [
      "Done? Tap Complete workout. Your numbers are saved and the next session is ready on your home screen. If some sets have no number, the app reminds you first.",
    ],
  },
];
