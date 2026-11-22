import { useI18n } from "../context/I18nContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/client";

export default function LanguageSelect() {
  const { lang, setLang } = useI18n();
  const { me, refresh } = useAuth();
  async function change(event) {
    const next = event.target.value;
    setLang(next);
    if (me?.user) {
      await api.put("/me/language", { language: next }).catch(() => {});
      refresh().catch(() => {});
    }
  }
  return (
    <label className="d-flex align-items-center gap-2">
      <span className="visually-hidden">Language</span>
      <select className="lang-select" value={lang} onChange={change} aria-label="Language">
        <option value="en">English</option>
        <option value="am">አማርኛ</option>
        <option value="om">Afaan Oromoo</option>
      </select>
    </label>
  );
}
