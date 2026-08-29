import { useState } from "react";
import { PlayCircle } from "lucide-react";

/**
 * A video that is only mounted once someone asks to watch it.
 *
 * `preload="metadata"` reads as the cautious choice, and on a phone it
 * is free: mobile browsers ignore preload entirely and fetch nothing
 * until you tap. Desktop browsers honour it, one connection per element
 * — so a page listing every pending form check opened dozens of
 * simultaneous fetches, all sharing the same pipe as the one clip the
 * coach was actually trying to watch. The inbox flew on a phone and
 * crawled on a laptop, which is exactly backwards.
 *
 * Rendering the placeholder until the click means one video at a time,
 * with the whole connection to itself.
 */
const LazyVideo = ({
  src,
  className = "",
  label = "Play video",
}: {
  src: string;
  /** Applied to the real <video>; the placeholder keeps a 16:9 box so
   *  the list does not jump when it is replaced. */
  className?: string;
  label?: string;
}) => {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <video src={src} controls autoPlay preload="auto" className={className} />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="w-full aspect-video rounded-lg bg-foreground/5 border border-border hover:bg-foreground/10 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground"
    >
      <PlayCircle size={32} />
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
};

export default LazyVideo;
