/**
 * The seven slides of the app tour, drawn with the app's own components
 * and demo data (see mocks.ts). Dev only: open /tour.html to see them all,
 * /tour.html?s=3 for one slide at phone size, ready to capture.
 */
import { ReactNode, useEffect, useRef, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ClipboardList,
  Play,
  SkipForward,
  Trophy,
} from "lucide-react";
import { AuthProvider } from "@/contexts/AuthContext";
import ProgramItemCard, { ProgramItem } from "@/components/ProgramItemCard";
import {
  blockAccent,
  blockStatsLabel,
  groupTypeLabel,
} from "@/lib/programSections";
import { notificationCopy } from "@/lib/notification-copy";
import { TOUR_COPY } from "@/components/tour/tourCopy";
import { DEMO_ID, RUN_NOW } from "./mocks";

const TOTAL = 7;

const item = (
  id: string,
  custom_name: string,
  reps: string,
  notes: string | null,
  extra: Partial<ProgramItem> = {}
): ProgramItem => ({
  id,
  week_id: "tour-week",
  order_index: 0,
  custom_name,
  sets: 3,
  reps,
  rest_seconds: 90,
  notes,
  video_url: "https://example.com/demo.mp4",
  group_name: null,
  description: null,
  ...extra,
});

/** Clicks a button by its text once the slide has rendered, to show a
 *  panel open the way the client would see it after tapping. */
function useOpen(ref: React.RefObject<HTMLElement>, label: string) {
  useEffect(() => {
    const t = setTimeout(() => {
      const b = [...(ref.current?.querySelectorAll("button") ?? [])].find(
        (x) => x.textContent?.trim().startsWith(label)
      );
      b?.click();
    }, 300);
    return () => clearTimeout(t);
  }, [ref, label]);
}

/** A finger tapping the element to use, with a ring where it lands.
 *  Drawn over the slide rather than inside the zoomed preview, so the
 *  hand keeps the same size on every slide. The point is measured after
 *  render (and again while panels open), since the target sits inside
 *  real components. On a wide button the finger lands right of centre so
 *  it does not hide the label, and below centre on a small one. */
const HAND_PATHS = [
  "M22 14a8 8 0 0 1-8 8",
  "M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2",
  "M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1",
  "M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10",
  "M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15",
];
/** A small finger with a ring at the tip. Chosen by Maxime on 2026-11-12
 *  over a touch dot alone and a finger with tap lines; the first finger
 *  (46px) was too big. */
const HAND = 30;

const Finger = () => (
  <svg
    width={HAND}
    height={HAND}
    viewBox="0 0 24 24"
    className="absolute drop-shadow"
    style={{ left: -(8 / 24) * HAND, top: -(2 / 24) * HAND }}
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {HAND_PATHS.map((d) => (
      <path key={`w${d}`} d={d} stroke="white" strokeWidth={5.5} />
    ))}
    {HAND_PATHS.map((d) => (
      <path key={d} d={d} stroke="hsl(var(--foreground))" strokeWidth={2} />
    ))}
  </svg>
);

const Tap = ({ x, y }: { x: number; y: number }) => (
  <div className="absolute pointer-events-none" style={{ left: x, top: y }}>
    {/* White ring with a dark edge: visible on white, on orange and on
        the dark cards alike, and empty so the label shows through. */}
    <span className="absolute -left-[11px] -top-[11px] w-[22px] h-[22px] rounded-full border-2 border-white shadow-[0_0_0_1.5px_hsl(var(--foreground)/0.55)]" />
    <Finger />
  </div>
);

function useTapPoint(
  root: React.RefObject<HTMLElement>,
  selector: string | undefined
) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!selector) return;
    const measure = () => {
      const r = root.current;
      const el = r?.querySelector(selector);
      if (!r || !el) return;
      const a = r.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const wide = b.width > 120;
      // A small target (a pill, a box) is tapped at its lower right
      // corner, so its label stays readable.
      // data-tap-x / data-tap-y place it by hand where neither fits.
      const d = (el as HTMLElement).dataset;
      const fx = d.tapX ? Number(d.tapX) : wide ? 0.86 : 0.9;
      const fy = d.tapY ? Number(d.tapY) : wide ? 0.62 : 0.92;
      const x = b.left + b.width * fx;
      const y = b.top + b.height * fy;
      setPoint({ x: x - a.left, y: y - a.top });
    };
    const t = setInterval(measure, 150);
    const stop = setTimeout(() => clearInterval(t), 2500);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [root, selector]);
  return point;
}

/** ?panel=1 draws only the picture of a slide, at the size the app
 *  tour shows it (PANEL_W x PANEL_H), for export to src/assets/tour. */
const PANEL_ONLY = new URLSearchParams(window.location.search).get("panel") === "1";
export const PANEL_W = 327;
export const PANEL_H = 440;

const Slide = ({
  n,
  children,
  zoom = 1,
  tap,
}: {
  n: number;
  children: ReactNode;
  zoom?: number;
  /** CSS selector of the element the finger taps. */
  tap?: string;
}) => {
  const root = useRef<HTMLDivElement>(null);
  const point = useTapPoint(root, tap);
  const { title, text } = TOUR_COPY[n - 1];
  if (PANEL_ONLY) {
    return (
      <div
        ref={root}
        className="relative bg-white overflow-hidden"
        style={{ width: PANEL_W, height: PANEL_H }}
      >
        <div className="absolute inset-0 bg-muted/60 p-4 flex flex-col justify-center overflow-hidden">
          <div style={{ zoom }}>{children}</div>
        </div>
        {point && <Tap x={point.x} y={point.y} />}
      </div>
    );
  }
  return (
  <div ref={root} className="relative w-[375px] h-[812px] bg-white flex flex-col px-6 pt-12 pb-8 overflow-hidden shrink-0">
    <div className="flex items-center justify-between h-5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/45">
        {n} / {TOTAL}
      </span>
    </div>
    <h1 className="font-heading text-[30px] leading-[1.08] font-bold tracking-[-0.02em] mt-4">
      {title}
    </h1>
    <div className="text-[15px] leading-[1.55] text-foreground/60 mt-3 space-y-2">
      {text.map((t) => (
        <p key={t}>{t}</p>
      ))}
    </div>
    <div className="flex-1 min-h-0 mt-6 rounded-[28px] bg-muted/60 p-4 flex flex-col justify-center overflow-hidden">
      <div style={{ zoom }}>{children}</div>
    </div>
    <div className="mt-6 flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: TOTAL }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full ${
              i + 1 === n ? "w-5 bg-foreground" : "w-1.5 bg-foreground/20"
            }`}
          />
        ))}
      </div>
      <span className="h-[46px] px-6 rounded-full bg-foreground text-white text-[15px] font-semibold inline-flex items-center gap-2">
        {n < TOTAL ? "Next" : "Let's train"} <ArrowRight size={16} />
      </span>
    </div>
    {point && <Tap x={point.x} y={point.y} />}
  </div>
  );
};

/** The block card of the session screen (Today.tsx), same markup. */
const BlockCard = ({
  index,
  section,
  groupName = null,
  sets,
  rest,
  items,
  render,
}: {
  index: number;
  section: string;
  groupName?: string | null;
  sets: number | null;
  rest: number | null;
  items: ProgramItem[];
  render: (it: ProgramItem, isGroup: boolean) => ReactNode;
}) => {
  const isGroup = !!groupName;
  const accent = blockAccent(section, groupName);
  const kind = isGroup ? groupTypeLabel(groupName) : "Set";
  const stats = blockStatsLabel(groupName, sets, rest);
  return (
    <div
      className="rounded-2xl border border-foreground/10 bg-surface px-4 pt-4 pb-1"
      style={accent.chained ? { borderLeft: `3px solid ${accent.chain}` } : undefined}
    >
      <div className="flex items-center gap-[9px] flex-wrap">
        <span
          className="font-heading text-[15px] font-bold shrink-0 tabular-nums"
          style={{ color: accent.label }}
        >
          {index}
        </span>
        <span
          aria-hidden
          className="w-px h-[13px] shrink-0"
          style={{ background: accent.tick }}
        />
        <span
          className="text-[11.5px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: accent.label }}
        >
          {kind}
        </span>
        {stats && <span className="text-[12.5px] text-foreground/45">{stats}</span>}
      </div>
      {accent.note && (
        <p className="italic text-[13.5px] leading-[1.5] text-foreground/55 mt-2 pl-3">
          {accent.note}
        </p>
      )}
      <div className="mt-1">
        {items.map((it, i) => (
          <div
            key={it.id}
            className={`flex items-start gap-3 py-4 ${
              i < items.length - 1 ? "border-b border-foreground/10" : ""
            }`}
          >
            {isGroup && (
              <span
                className="font-heading text-[13px] font-semibold w-4 shrink-0 pt-1 tabular-nums"
                style={{ color: accent.label }}
              >
                {i + 1}
              </span>
            )}
            <div className="flex-1 min-w-0">{render(it, isGroup)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* 1. Next session: the dashboard's "up next" card. */
const SlideNext = () => (
  <Slide
    n={1}
    tap='[data-tap="start"]'
  >
    <div className="bg-foreground text-background rounded-2xl p-5">
      <h2 className="font-heading text-2xl font-bold mb-1">Handstand 1</h2>
      <p className="text-sm opacity-70 inline-flex items-center gap-1.5">
        <ClipboardList size={14} /> 11 exercises
      </p>
      <div className="flex items-center gap-4 flex-wrap mt-4">
        <span className="inline-flex items-center justify-center gap-2 bg-accent text-white font-semibold rounded-full px-5 py-3 text-sm w-full" data-tap="start">
          Start Session 5
          <ArrowRight size={16} />
        </span>
        <span className="text-xs opacity-60 underline underline-offset-4">
          Preview program
        </span>
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs opacity-60 underline underline-offset-4 mt-3">
        <SkipForward size={12} /> Skip session
      </span>
    </div>
  </Slide>
);

/* 2. Skip session: the dashboard's skip dialog. */
const SlideSkip = () => (
  <Slide
    n={2}
    tap='[data-tap="option"]'
    zoom={0.8}
  >
    <div className="bg-surface border border-border rounded-2xl shadow-xl p-5 space-y-4">
      <div>
        <h2 className="font-heading text-lg font-bold">Skip session</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Your block is built in a set order: the sessions balance each other
          across the week, and following that order is what makes it work.
          Skipping now and then is fine when life gets in the way. Making a
          habit of it is not, and your coach will see it.
        </p>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Whatever you skip is not lost. It comes back and you still have to do
          it before this block loops.
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Train this instead
        </p>
        <ul className="border border-border rounded-xl divide-y divide-border overflow-hidden">
          {[
            ["2.", "Mobility + Strength", 21],
            ["3.", "Handstand 2", 19],
            ["4.", "Handstand (press focus)", 20],
          ].map(([num, label, count]) => (
            <li key={label as string}>
              <span
                className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2"
                data-tap={num === "3." ? "option" : undefined}
                data-tap-x="0.66"
                data-tap-y="0.55"
              >
                <span className="text-sm font-semibold">
                  <span className="text-muted-foreground mr-1.5">{num}</span>
                  {label}
                </span>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {count} exercises
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex justify-end">
        <span className="text-xs font-semibold border border-border rounded-full px-4 py-2">
          Keep Handstand 1
        </span>
      </div>
    </div>
  </Slide>
);

/* 3. Reading a session: a section heading and a superset, as on Today. */
const SlideRead = () => {
  const section = "WORKOUT";
  const accent = blockAccent(section, null);
  return (
    <Slide
      n={3}
      tap=".py-4:first-child button"
      zoom={0.86}
    >
      <div data-tour="read">
        <div className="flex items-baseline justify-between pb-2 mb-4 border-b border-foreground/20">
          <b
            className="font-heading text-[13px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: accent.label }}
          >
            {section}
          </b>
          <span className="text-[12.5px] text-foreground/45">6 exercises</span>
        </div>
        <BlockCard
          index={2}
          section={section}
          groupName="Superset 1"
          sets={3}
          rest={90}
          items={[
            item("tour-read-1", "[WORKOUT] Chest to wall handstand", "30s", "Load: BW | Stack your hips over your shoulders."),
            item("tour-read-2", "[WORKOUT] Pike push up", "8", "Tempo: 3-1-1 | Load: BW"),
          ]}
          render={(it) => (
            <ProgramItemCard
              item={it}
              compact
              inSuperset
              canComment={false}
              flush
              noPadding
            />
          )}
        />
      </div>
    </Slide>
  );
};

/* 4. The tracker: the real logger, two sets in, last and best above. */
const SlideLog = () => {
  return (
    <Slide
      n={4}
      tap='input[aria-label="Set 3 reps"]'
    >
      <div data-tour="log">
        <BlockCard
          index={3}
          section="WORKOUT"
          sets={3}
          rest={90}
          items={[item("tour-pike", "[WORKOUT] Pike push up", "8", "Tempo: 3-1-1 | Load: BW")]}
          render={(it) => (
            <ProgramItemCard
              item={it}
              canComment={false}
              loggerClientId={DEMO_ID}
              loggerReadOnly={false}
              sessionRunId={RUN_NOW}
              flush
              noPadding
            />
          )}
        />
      </div>
    </Slide>
  );
};

/* 5. Videos: the form check panel opened, and a saved achievement. */
const SlideVideos = () => {
  const ref = useRef<HTMLDivElement>(null);
  useOpen(ref, "Send a form check");
  return (
    <Slide
      n={5}
      tap=".grid > button"
      zoom={0.74}
    >
      <div ref={ref} data-tour="videos" className="space-y-3">
        <BlockCard
          index={1}
          section="WORKOUT"
          sets={3}
          rest={60}
          items={[item("tour-fc", "[WORKOUT] Chest to wall handstand", "30s", "Load: BW")]}
          render={(it) => (
            <ProgramItemCard
              item={it}
              canComment={false}
              canUploadFormCheck
              flush
              noPadding
            />
          )}
        />
        <section className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="w-full flex items-center gap-3 px-5 py-4">
            <Trophy size={18} className="text-amber-700" />
            <span className="font-heading text-xl font-bold flex-1 text-left">
              Skill achievements
            </span>
            <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 font-semibold">
              1
            </span>
            <ChevronDown size={18} className="text-muted-foreground" />
          </div>
          <div className="px-5 pb-5 border-t border-border pt-4">
            <div className="bg-muted/30 border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-heading font-bold text-sm">
                  First 5s freestanding handstand
                </p>
                <span className="text-[11px] text-muted-foreground">Nov 3, 2026</span>
              </div>
              <div className="w-full rounded-lg bg-black h-[72px] flex items-center justify-center">
                <span className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
                  <Play size={16} className="fill-current text-black ml-0.5" />
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Slide>
  );
};

/* 6. Coach: the dashboard notification and the exercise thread. */
const SlideCoach = () => {
  const ref = useRef<HTMLDivElement>(null);
  useOpen(ref, "Add a comment");
  return (
    <Slide
      n={6}
      tap="textarea"
      zoom={0.82}
    >
      <div ref={ref} className="space-y-3">
        {/* On white like the dashboard, so the tint reads the same. */}
        <div className="bg-white rounded-xl">
          <div className="w-full text-left bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center shrink-0">
              <Bell size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-sm">
                {notificationCopy.comment.title}
              </p>
            </div>
            <ArrowRight size={16} className="text-accent mt-1 shrink-0" />
          </div>
        </div>
        <BlockCard
          index={1}
          section="WORKOUT"
          sets={5}
          rest={60}
          items={[item("tour-question", "[WORKOUT] Kick up to handstand", "5", null)]}
          render={(it) => (
            <ProgramItemCard item={it} canComment flush noPadding />
          )}
        />
      </div>
    </Slide>
  );
};

/* 7. Complete: every set green, then the button at the foot of Today. */
const SlideComplete = () => {
  return (
    <Slide
      n={7}
      tap='[data-tap="complete"]'
      zoom={0.9}
    >
      <div className="space-y-5">
        <BlockCard
          index={6}
          section="WORKOUT"
          sets={3}
          rest={60}
          items={[item("tour-done", "[WORKOUT] Hanging leg raise", "10", null, { video_url: null })]}
          render={(it) => (
            <ProgramItemCard
              item={it}
              canComment={false}
              loggerClientId={DEMO_ID}
              loggerReadOnly={false}
              sessionRunId={RUN_NOW}
              flush
              noPadding
            />
          )}
        />
        <div>
          <span className="w-full h-[50px] rounded-full gap-2 bg-foreground text-white text-base font-semibold inline-flex items-center justify-center" data-tap="complete">
            <Trophy size={16} />
            Complete workout
          </span>
          <p className="text-center text-[12.5px] text-foreground/45 mt-2">
            Locks your numbers and unlocks the next session.
          </p>
        </div>
      </div>
    </Slide>
  );
};

const SLIDES = [SlideNext, SlideSkip, SlideRead, SlideLog, SlideVideos, SlideCoach, SlideComplete];

const TourSlides = () => {
  const s = Number(new URLSearchParams(window.location.search).get("s"));
  const only = s >= 1 && s <= TOTAL ? SLIDES[s - 1] : null;
  return (
    <MemoryRouter>
      <AuthProvider>
        {only ? (
          (() => {
            const One = only;
            return <One />;
          })()
        ) : (
          <div className="flex flex-wrap gap-6 p-6 bg-neutral-200">
            {SLIDES.map((S, i) => (
              <div key={i} className="shadow-lg">
                <S />
              </div>
            ))}
          </div>
        )}
      </AuthProvider>
    </MemoryRouter>
  );
};

export default TourSlides;
