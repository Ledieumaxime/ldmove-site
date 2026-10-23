import { Capacitor } from "@capacitor/core";

const APP_STORE_URL = "https://apps.apple.com/app/ld-move/id6823914074";
const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.ldmove.app";

/** True on the website, false inside the iPhone or Android app. The
 *  badges are for browsers only: someone who sees them in the app
 *  already has it, and Apple rejects an iPhone app that shows a
 *  Google Play button. */
export const showStoreBadges = () => !Capacitor.isNativePlatform();

/** The official App Store and Google Play badges, each linking to LD
 *  Move on its store. The files are Apple's and Google's own artwork,
 *  served from the site rather than from their servers, so a visit does
 *  not hand the visitor's address to either (same reason as the fonts).
 *  Both render 40px tall: Google ships its badge with transparent padding
 *  built in, so it is drawn larger and pulled back by the same amount. */
const StoreBadges = ({
  stacked = false,
  className = "",
}: {
  stacked?: boolean;
  className?: string;
}) => (
  <div
    className={`${
      stacked ? "flex flex-col items-start" : "flex flex-wrap items-center"
    } gap-3 ${className}`}
  >
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download LD Move on the App Store"
    >
      <img
        src="/badges/app-store.svg"
        alt="Download on the App Store"
        className="h-10 w-auto"
      />
    </a>
    <a
      href={GOOGLE_PLAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Get LD Move on Google Play"
    >
      <img
        src="/badges/google-play.png"
        alt="Get it on Google Play"
        className="h-[60px] w-auto -m-[10px]"
      />
    </a>
  </div>
);

export default StoreBadges;
