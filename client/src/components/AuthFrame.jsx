import { Link } from "react-router-dom";
import Logo from "./Logo.jsx";

export default function AuthFrame({ children }) {
  return (
    <div className="auth-stage">
      <aside className="auth-aside">
        <Link to="/" className="auth-mark" aria-label="Mesob home"><Logo /></Link>
        <div>
          <p className="auth-kicker">Mesob AI</p>
          <h2>Eat well, the Ethiopian way.</h2>
          <p>Plans, scanning, and answers built around injera, stews, and the foods you already cook.</p>
        </div>
        <p className="auth-foot">English · አማርኛ · Afaan Oromoo</p>
      </aside>
      <main className="auth-panel">{children}</main>
    </div>
  );
}
