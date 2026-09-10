import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppIntro from "@/components/AppIntro";

type Props = {
  children: React.ReactNode;
  requireRole?: "coach" | "client";
};

const ProtectedRoute = ({ children, requireRole }: Props) => {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  // Restoring the stored session is a round trip to the auth server.
  // Same wait as a cold boot, so it gets the same panel rather than the
  // word "Loading…".
  if (loading) return <AppIntro fullScreen />;

  if (!session) {
    return <Navigate to="/app/login" state={{ from: location }} replace />;
  }

  if (requireRole && profile && profile.role !== requireRole) {
    return <Navigate to="/app/home" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
