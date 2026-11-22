import { Link, NavLink, Outlet } from "react-router-dom";
import Logo from "./Logo.jsx";
import LanguageSelect from "./LanguageSelect.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";

const links = [
  ["/dashboard", "nav.dashboard", "bi-house"],
  ["/plan", "nav.plan", "bi-calendar3"],
  ["/scan", "nav.scan", "bi-camera"],
  ["/assistant", "nav.assistant", "bi-stars"],
  ["/reports", "nav.reports", "bi-bar-chart"],
  ["/consult", "nav.consult", "bi-person-heart"],
  ["/pricing", "nav.pricing", "bi-credit-card"],
  ["/account", "nav.account", "bi-person"],
];

export default function AppShell() {
  const { logout, me } = useAuth();
  const { t } = useI18n();
  return (
    <div className="app-shell">
      <aside className="side">
        <Link to="/dashboard" className="side-brand" aria-label="Mesob home"><Logo /></Link>
        <nav className="side-links" aria-label="Primary">
          {links.map(([to, key, icon]) => (
            <NavLink key={to} to={to}><i className={`bi ${icon}`} /> {t(key)}</NavLink>
          ))}
        </nav>
        <button className="btn btn-ghost mt-auto" onClick={logout}>{t("nav.logout")}</button>
      </aside>
      <div className="shell-column">
        <header className="shell-head">
          <span className="fine">{me?.user?.full_name}</span>
          <LanguageSelect />
        </header>
        <main className="main-pane"><Outlet /></main>
      </div>
    </div>
  );
}
