import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { TOUR_COPY } from "./tourCopy";
import tour1 from "@/assets/tour/tour-1.webp";
import tour2 from "@/assets/tour/tour-2.webp";
import tour3 from "@/assets/tour/tour-3.webp";
import tour4 from "@/assets/tour/tour-4.webp";
import tour5 from "@/assets/tour/tour-5.webp";
import tour6 from "@/assets/tour/tour-6.webp";
import tour7 from "@/assets/tour/tour-7.webp";

/** One picture per slide, in TOUR_COPY order. They are drawn from the
 *  app's own components with demo data (src/dev/tour, open /tour.html in
 *  dev) and exported with their rounded corners already cut, so they sit
 *  on a light or a dark screen alike. Redraw them there when a screen they
 *  show changes. */
const IMAGES = [tour1, tour2, tour3, tour4, tour5, tour6, tour7];

/**
 * The app tour: seven slides that explain the app, swiped like an
 * Instagram carousel. Full screen, over everything.
 *
 * Swiping is the browser's own horizontal scroll with snap points, so it
 * follows the finger natively on a phone; Next and the dots scroll it for
 * the same result. Skip tour, Let's train and Escape all close it.
 */
const AppTour = ({ onClose }: { onClose: () => void }) => {
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const total = TOUR_COPY.length;
  const last = index === total - 1;

  // The page behind must not scroll while the tour is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const goTo = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    const target = Math.max(0, Math.min(total - 1, i));
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goTo(index + 1);
      if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, onClose]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How the app works"
      className="fixed inset-0 z-[80] bg-background flex flex-col"
      style={{
        paddingTop: "calc(var(--safe-top) + 12px)",
        paddingBottom: "calc(var(--safe-bottom) + 20px)",
      }}
    >
      <div className="flex items-center justify-between px-6 h-8 shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/45">
          {index + 1} / {total}
        </span>
        {!last && (
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] text-foreground/55 hover:text-foreground py-1"
          >
            Skip tour
          </button>
        )}
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TOUR_COPY.map((c, i) => (
          <section
            key={c.title}
            aria-hidden={i !== index}
            className="w-full shrink-0 snap-center flex flex-col px-6 pt-3"
          >
            <h2 className="font-heading text-[28px] leading-[1.08] font-bold tracking-[-0.02em]">
              {c.title}
            </h2>
            <div className="text-[15px] leading-[1.55] text-foreground/60 mt-3 space-y-2">
              {c.text.map((t) => (
                <p key={t}>{t}</p>
              ))}
            </div>
            {/* The picture takes whatever height is left and shrinks to
                fit on a small phone, never stretched. */}
            <div className="relative flex-1 min-h-[160px] mt-5">
              <img
                src={IMAGES[i]}
                alt=""
                draggable={false}
                className="absolute inset-0 w-full h-full object-contain select-none"
              />
            </div>
          </section>
        ))}
      </div>

      <div className="px-6 mt-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          {TOUR_COPY.map((c, i) => (
            <button
              key={c.title}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => goTo(i)}
              className="py-2"
            >
              <span
                className={`block h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-foreground" : "w-1.5 bg-foreground/20"
                }`}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => (last ? onClose() : goTo(index + 1))}
          className="h-[46px] px-6 rounded-full bg-foreground text-background text-[15px] font-semibold inline-flex items-center gap-2 hover:bg-foreground/90"
        >
          {last ? "Let's train" : "Next"} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default AppTour;
