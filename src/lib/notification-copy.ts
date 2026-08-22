/**
 * Every word a client reads in a notification.
 *
 * These used to be written inline in five different screens, so nobody
 * could see the set at once and the tone drifted. They are decided by
 * Maxime, not by whoever happens to be editing a component, which is why
 * they live here and not next to the code that sends them.
 *
 * The same text feeds both the phone notification and the in-app one:
 * one event should not read two different ways depending on where the
 * client happens to see it.
 *
 * Most carry no body on purpose. The title says what happened, the app
 * says the rest. It also keeps coaching feedback off a lock screen.
 *
 * One text is NOT here: the published-program notification, which is sent
 * from the `notify-program-published` edge function because it goes out
 * with the email in the same breath. A Deno function cannot import from
 * this bundle. If you change the wording below, change it there too.
 */

type Copy = { title: string; body?: string };

export const notificationCopy = {
  /** The coach replied on an exercise. The comment itself stays in the
   *  inbox: no preview on the lock screen. */
  comment: { title: "New feedback from Maxime" } as Copy,

  /** The coach locked the client's intake after reviewing it. */
  intakeValidated: {
    title: "Your intake has been validated by Maxime",
  } as Copy,

  /** A form check video was archived as a milestone. Named when the coach
   *  credited a skill, because "your Freestanding handstand" tells the
   *  client what they just unlocked and "one of your videos" does not. */
  milestone: (skill?: string): Copy => ({
    title: "New progress milestone",
    body: skill
      ? `Maxime saved your ${skill} as a milestone.`
      : "Maxime saved one of your videos as a milestone.",
  }),

  /** Sent by hand to a client who has stopped training. Reads as an
   *  invitation: they should not feel chased. */
  nudge: {
    title: "Your next session is waiting",
    body: "Whenever you are ready. Pick up where you left off.",
  } as Copy,
};
