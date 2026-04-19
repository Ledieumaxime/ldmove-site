import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  children: React.ReactNode;
  requireRole?: "coach" | "client";
};

const ProtectedRoute = ({ children, requireRole }: Props) => {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand">
        <div className="text-muted-foreground">Chargement…</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/app/login" state={{ from: location }} replace />;
  }

  if (requireRole && profile && profile.role !== requireRole) {
    return <Navigate to="/app/home" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
