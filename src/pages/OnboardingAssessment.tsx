import Layout from "@/components/Layout";
import SectionWrapper from "@/components/SectionWrapper";
import { Check, Camera, Lightbulb, CalendarClock } from "lucide-react";

type Exercise = { n: number; name: string; desc: string };

const REQUIRED: Exercise[] = [
  { n: 1, name: "Max pull ups", desc: "Dead hang start, full range of motion, film the entire set." },
  { n: 2, name: "Max dips", desc: "Full lockout at top, full range of motion, film the entire set." },
  { n: 3, name: "Max push ups", desc: "Chest to floor, full lockout, film the entire set." },
  { n: 4, name: "Bodyweight squat", desc: "10 slow reps, side angle, heels stay on the floor." },
  { n: 5, name: "Hanging dead hang", desc: "Hold as long as possible. Say the time out loud or show a timer." },
  { n: 6, name: "Deep squat hold", desc: "Hold 30 seconds, heels on floor, film from front + side." },
  { n: 7, name: "Shoulder wall test", desc: "Stand with your back against a wall. Raise both arms until they touch the wall above your head — without arching your lower back. Film from the front." },
  { n: 8, name: "Pike stretch", desc: "Standing, legs straight, reach down towards the floor. Side angle. Say out loud how far from the floor your hands are." },
  { n: 9, name: "Front split — left leg", desc: "Best attempt, side angle." },
  { n: 10, name: "Front split — right leg", desc: "Best attempt, side angle." },
  { n: 11, name: "Side split", desc: "Best attempt, front angle." },
  { n: 12, name: "Pancake (seated, legs wide)", desc: "Sit on floor with legs wide, lean forward with chest towards the floor. Film from the front." },
];

const STRENGTH: Exercise[] = [
  { n: 13, name: "Pistol squat", desc: "3 reps each leg, side angle, full depth." },
  { n: 14, name: "Muscle up (bar)", desc: "1 clean rep, show the full transition." },
  { n: 15, name: "Ring muscle up", desc: "1 clean rep." },
  { n: 16, name: "Rope climb (arms only, no legs)", desc: "1 ascent." },
];

const GYMNASTICS: Exercise[] = [
  { n: 17, name: "Handstand (wall, back to wall)", desc: "Hold 10 seconds or more, side angle." },
  { n: 18, name: "Freestanding handstand", desc: "Best hold, front or side angle." },
  { n: 19, name: "Handstand push up", desc: "1 rep, full range of motion, side angle." },
  { n: 20, name: "L-sit", desc: "Hold 5 seconds or more, both legs straight." },
  { n: 21, name: "V-sit", desc: "Hold 3 seconds or more." },
  { n: 22, name: "Tuck front lever", desc: "Hold 3 seconds or more, on bar or rings." },
  { n: 23, name: "Advanced tuck front lever", desc: "Hold 3 seconds or more." },
  { n: 24, name: "Full front lever", desc: "Hold 3 seconds or more." },
  { n: 25, name: "Tuck planche", desc: "Hold 3 seconds or more." },
  { n: 26, name: "Straddle planche", desc: "Hold 3 seconds or more." },
  { n: 27, name: "Full planche", desc: "Hold 3 seconds or more." },
];

const MOBILITY: Exercise[] = [
  { n: 28, name: "Backbend", desc: "Best attempt, side angle." },
];

const ExerciseList = ({ items }: { items: Exercise[] }) => (
  <ol className="space-y-3">
    {items.map((e) => (
      <li
        key={e.n}
        className="bg-card border border-border rounded-xl p-4 flex gap-4"
      >
        <span className="shrink-0 w-8 h-8 rounded-full bg-accent/10 text-accent font-heading font-bold flex items-center justify-center text-sm">
          {e.n}
        </span>
        <div>
          <p className="font-heading font-bold uppercase tracking-wide text-sm mb-1">
            {e.name}
          </p>
          <p className="font-body text-sm text-muted-foreground leading-relaxed">
            {e.desc}
          </p>
        </div>
      </li>
    ))}
  </ol>
);

const OnboardingAssessmentPage = () => {
  return (
    <Layout>
      <SectionWrapper className="bg-background pt-28 md:pt-36">
        <div className="max-w-3xl mx-auto">
          <p className="font-body text-accent font-semibold text-sm uppercase tracking-widest mb-3">
            Onboarding · Step 2
          </p>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-6">
            Your assessment videos
          </h1>
          <p className="font-body text-muted-foreground text-lg leading-relaxed mb-4">
            Before we start building your program, I need to assess your current
            level. Please film the exercises below and send me the video links
            (Google Drive, YouTube unlisted, or iCloud).
          </p>
          <p className="font-body text-muted-foreground leading-relaxed">
            Read carefully — some exercises are required for everyone, others
            only if you can already do them.
          </p>
        </div>
      </SectionWrapper>

      <SectionWrapper className="bg-sand">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
              <Check size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-widest">
                Required — everyone
              </p>
              <h2 className="font-heading text-2xl font-bold">Film these 12 exercises</h2>
            </div>
          </div>
          <ExerciseList items={REQUIRED} />
        </div>
      </SectionWrapper>

      <SectionWrapper className="bg-background">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <Camera size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest">
                Optional — only if you can do it
              </p>
              <h2 className="font-heading text-2xl font-bold">
                Skip anything you can't do yet
              </h2>
            </div>
          </div>

          <h3 className="font-heading text-lg font-bold uppercase tracking-wider text-muted-foreground mt-8 mb-3">
            Strength skills
          </h3>
          <ExerciseList items={STRENGTH} />

          <h3 className="font-heading text-lg font-bold uppercase tracking-wider text-muted-foreground mt-8 mb-3">
            Gymnastics skills
          </h3>
          <ExerciseList items={GYMNASTICS} />

          <h3 className="font-heading text-lg font-bold uppercase tracking-wider text-muted-foreground mt-8 mb-3">
            Mobility
          </h3>
          <ExerciseList items={MOBILITY} />
        </div>
      </SectionWrapper>

      <SectionWrapper className="bg-sand">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
              <Lightbulb size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-sky-700 uppercase tracking-widest">
                Tips
              </p>
              <h2 className="font-heading text-2xl font-bold">How to film it right</h2>
            </div>
          </div>
          <ul className="space-y-3 font-body text-muted-foreground leading-relaxed">
            <li className="bg-card border border-border rounded-xl p-4">
              Film in good lighting so I can see your full body clearly.
            </li>
            <li className="bg-card border border-border rounded-xl p-4">
              Use a side angle for most exercises unless specified otherwise.
            </li>
            <li className="bg-card border border-border rounded-xl p-4">
              One video per exercise is fine — no need to do multiple takes.
            </li>
            <li className="bg-card border border-border rounded-xl p-4">
              You can group all your videos in a single Google Drive folder and send
              me the link.
            </li>
          </ul>
        </div>
      </SectionWrapper>

      <SectionWrapper className="bg-background">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center">
              <CalendarClock size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-accent uppercase tracking-widest">
                Good to know
              </p>
              <h2 className="font-heading text-2xl font-bold">How we work together</h2>
            </div>
          </div>
          <div className="space-y-4 font-body text-muted-foreground leading-relaxed">
            <p>
              Take your time with this — there's no rush. These videos are your
              starting point. I'll use them to build a program that's made exactly
              for where you are right now.
            </p>
            <p>
              Every 3 programs (roughly every 3 months), we'll do a short check-in
              assessment. Not the full list — just the exercises that matter most
              for your goals at that point.
            </p>
            <p>
              This keeps your program accurate and makes sure we're always training
              the right things based on where you actually are, not where you were
              3 months ago. I'll reach out when it's time. It takes about 10–15
              minutes to film.
            </p>
            <p className="pt-4 font-heading text-foreground">
              Talk soon,<br />
              Maxime
            </p>
          </div>
        </div>
      </SectionWrapper>
    </Layout>
  );
};

export default OnboardingAssessmentPage;
