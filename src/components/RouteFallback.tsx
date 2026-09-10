import AppIntro from "@/components/AppIntro";

/**
 * Shown while a lazy route chunk downloads.
 *
 * `fullScreen` means the app itself is opening and nothing is on screen
 * yet, so it shows the intro panel: that wait is the first thing anyone
 * sees of LD Move and a bare spinner wasted it. Inside an app that is
 * already open, a chunk loading is a detail and stays a small spinner.
 */
const RouteFallback = ({ fullScreen = false }: { fullScreen?: boolean }) => {
  if (fullScreen) return <AppIntro fullScreen />;
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin" />
    </div>
  );
};

export default RouteFallback;
