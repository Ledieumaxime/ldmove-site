import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
 * The app tour: seven slides that explain the app. Full screen, over
 * everything.
 *
 * Next is the only way through, one slide at a time, and Let's train on
 * the last one closes it. The first version also let the client swipe and
 * had a Skip tour link: Maxime found the swipe went by too fast to read,
 * and skipping a tour meant to be seen once made no sense (2026-11-12).
 */
const AppTour = ({ onClose }: { onClose: () => void }) => {
  const [index, setIndex] = useState(0);
  const total = TOUR_COPY.length;
  const last = index === total - 1;
  const slide = TOUR_COPY[index];

  // The page behind must not scroll while the tour is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // The next picture is fetched while this slide is being read, so Next
  // never shows an empty frame on a slow connection.
  useEffect(() => {
    if (index + 1 < total) new Image().src = IMAGES[index + 1];
  }, [index, total]);

  // Rendered straight into <body>: opened from inside a page, it took
  // that page's spacing (Profile's list gave it a 24px top margin) and a
  // strip of the page showed above it on the phone.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How the app works"
      className="fixed inset-0 z-[80] bg-surface flex flex-col"
      style={{
        paddingTop: "calc(var(--safe-top) + 12px)",
        paddingBottom: "calc(var(--safe-bottom) + 20px)",
      }}
    >
      <div className="flex items-center px-6 h-8 shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/45">
          {index + 1} / {total}
        </span>
      </div>

      {/* Keyed on the slide so each one fades in on Next. */}
      <section
        key={index}
        className="flex-1 min-h-0 flex flex-col px-6 pt-3 animate-in fade-in duration-300"
      >
        <h2 className="font-heading text-[28px] leading-[1.08] font-bold tracking-[-0.02em]">
          {slide.title}
        </h2>
        <div className="text-[15px] leading-[1.55] text-foreground/60 mt-3 space-y-2">
          {slide.text.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </div>
        {/* The picture takes whatever height is left and shrinks to fit
            on a small phone, never stretched. */}
        <div className="relative flex-1 min-h-[160px] mt-5">
          <img
            src={IMAGES[index]}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain select-none"
          />
        </div>
      </section>

      <div className="px-6 mt-5 flex items-center justify-between shrink-0">
        {/* Where you are, not a way to jump: Next is the only control. */}
        <div className="flex items-center gap-1.5" aria-hidden>
          {TOUR_COPY.map((c, i) => (
            <span
              key={c.title}
              className={`block h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-foreground" : "w-1.5 bg-foreground/20"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => (last ? onClose() : setIndex(index + 1))}
          className="h-[46px] px-6 rounded-full bg-foreground text-background text-[15px] font-semibold inline-flex items-center gap-2 hover:bg-foreground/90"
        >
          {last ? "Let's train" : "Next"} <ArrowRight size={16} />
        </button>
      </div>
    </div>,
    document.body
  );
};

export default AppTour;
