import { Navigate } from "react-router-dom";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
  requireRole?: AppRole;
}

export function ProtectedRoute({ children, requireRole }: Props) {
  const { loading, user, hasRole, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (requireRole && !hasRole(requireRole) && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
