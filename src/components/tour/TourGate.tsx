import { lazy, Suspense, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { sbPost } from "@/integrations/supabase/api";

// Loaded only when it opens: most visits never show it.
const AppTour = lazy(() => import("./AppTour"));

/** Records that this client has been through the tour. */
export const markTourSeen = () =>
  sbPost("rpc/mark_tour_seen", {}).catch(() => {});

/**
 * Opens the app tour by itself, once: the first time a client reaches the
 * dashboard with an active block. Before that the slides would describe
 * sessions they do not have yet; for a new client this is the visit right
 * before their first session, and for those who had the app before the
 * tour existed it is simply their next visit (decided with Maxime on
 * 2026-11-12, rather than a notification they might never tap).
 *
 * Seen is kept on the profile (tour_seen_at), not on the phone, so a new
 * phone or a reinstall does not bring it back. It can always be reopened
 * from Profile > How the app works.
 */
const TourGate = ({ hasActiveBlock }: { hasActiveBlock: boolean }) => {
  const { profile, refreshProfile } = useAuth();
  const [closed, setClosed] = useState(false);

  if (
    closed ||
    !hasActiveBlock ||
    profile?.role !== "client" ||
    profile.tour_seen_at
  ) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AppTour
        onClose={() => {
          setClosed(true);
          void markTourSeen().then(() => refreshProfile());
        }}
      />
    </Suspense>
  );
};

export default TourGate;
