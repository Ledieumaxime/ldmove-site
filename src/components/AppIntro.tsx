import logo from "@/assets/logo-ldmove.png";

/**
 * The dark half of the front door.
 *
 * Opening the app is not instant: in the native shell the whole thing is
 * fetched from ldmove.com, the route chunk downloads, and the stored
 * session is checked against the auth server. That wait already existed.
 * It was filled with a spinner, then with the word "Loading…", which is
 * the least the product could say about itself at the exact moment
 * someone meets it.
 *
 * So the same panel covers the wait and then stays as the left half of
 * the sign-in screen on a wide display. Nothing is delayed to show it:
 * it occupies time that is already being spent, and on a warm start it
 * is gone before it registers.
 */
const AppIntro = ({ fullScreen = false }: { fullScreen?: boolean }) => (
  <div
    className={`bg-foreground text-white flex flex-col items-center justify-center px-8 text-center ${
      fullScreen ? "min-h-screen" : "h-full w-full"
    }`}
  >
    <img
      src={logo}
      alt=""
      aria-hidden
      className="h-24 w-24 mb-8 opacity-95 invert"
    />
    <p className="font-heading text-3xl md:text-4xl font-bold leading-tight">
      Move with
      <br />
      your coach.
    </p>
    <p className="text-white/60 mt-4 text-sm">
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
        className="mt-10 w-6 h-6 rounded-full border-2 border-white/20 border-t-accent animate-spin"
      />
    )}
  </div>
);

export default AppIntro;
