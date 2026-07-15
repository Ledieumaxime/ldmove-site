// Shown while a lazy route chunk downloads. Kept text-free so it works
// for every locale and never flashes copy on fast connections.
const RouteFallback = ({ fullScreen = false }: { fullScreen?: boolean }) => (
  <div
    className={`flex items-center justify-center ${
      fullScreen ? "min-h-screen bg-sand" : "py-24"
    }`}
  >
    <div className="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin" />
  </div>
);

export default RouteFallback;
