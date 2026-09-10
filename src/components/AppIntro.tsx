import logo from "@/assets/logo-ldmove.png";

/**
 * The front door.
 *
 * Opening the app is not instant: in the native shell the whole thing is
 * fetched from ldmove.com, the route chunk downloads, and the stored
 * session is checked against the auth server. That wait already existed.
 * It was filled with a spinner, then with the word "Loading…", which is
 * the least the product could say about itself at the exact moment
 * someone meets it.
 *
 * It changes colour with the screen it is about to become, which is the
 * whole trick. On a phone it becomes the white sign-in page, so it is
 * white: nothing jumps, the content simply swaps. On a wide display it
 * becomes the dark left half of the split sign-in screen, so it is dark
 * and that half never moves, the form just arrives beside it.
 */
const AppIntro = ({ fullScreen = false }: { fullScreen?: boolean }) => (
  <div
    className={`bg-white text-foreground md:bg-foreground md:text-white flex flex-col items-center justify-center px-8 text-center ${
      fullScreen ? "min-h-screen" : "h-full w-full"
    }`}
  >
    <img
      src={logo}
      alt=""
      aria-hidden
      className="h-24 w-24 mb-8 md:opacity-95 md:invert"
    />
    <p className="font-heading text-3xl md:text-4xl font-bold leading-tight">
      Move with
      <br />
      your coach.
    </p>
    <p className="text-muted-foreground md:text-white/60 mt-4 text-sm">
      Your program, your sessions, your form checks.
    </p>

    {/* Only while something is actually loading. On a wide sign-in
        screen this same panel stays as the left half, and a ring
        spinning next to a form that is ready to be filled would be
        saying something untrue. */}
    {fullScreen && (
      <div
        role="status"
        aria-label="Loading"
        className="mt-10 w-6 h-6 rounded-full border-2 border-border md:border-white/20 border-t-accent md:border-t-accent animate-spin"
      />
    )}
  </div>
);

export default AppIntro;
