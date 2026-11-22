import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AdminLayout() {
  const { logout } = useAuth();
  return (
    <div className="app-shell">
      <aside className="side">
        <NavLink to="/admin/foods" className="side-brand" aria-label="Mesob admin"><strong>Mesob admin</strong></NavLink>
        <NavLink to="/admin/foods">Foods</NavLink>
        <NavLink to="/admin/rules">Rules</NavLink>
        <NavLink to="/admin/ramadan">Ramadan</NavLink>
        <button className="btn btn-ghost mt-auto" onClick={logout}>Log out</button>
      </aside>
      <main className="main-pane"><Outlet /></main>
    </div>
  );
}
