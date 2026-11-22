import { Navigate, Outlet } from "react-router-dom";
import { homeFor, useAuth } from "../context/AuthContext.jsx";
import PageState from "./PageState.jsx";

export default function ProtectedRoute({ roles, requireProfile = false }) {
  const { me, loading } = useAuth();
  if (loading) return <PageState loading />;
  if (!me?.user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(me.user.role)) {
    return (
      <main className="section">
        <h1>This area is restricted</h1>
        <p>Your account cannot open this dashboard.</p>
        <a className="btn btn-primary" href={homeFor(me)}>Back</a>
      </main>
    );
  }
  if (requireProfile) {
    if (!me.user.category) return <Navigate to="/category" replace />;
    if (!me.profile_complete) return <Navigate to="/profile" replace />;
  }
  return <Outlet />;
}
