import { createContext, useContext, useEffect, useMemo, useState } from "react";
import en from "../i18n/en.json";
import am from "../i18n/am.json";
import om from "../i18n/om.json";

const catalogs = { en, am, om };
const I18nContext = createContext(null);

function lookup(tree, path) {
  return path.split(".").reduce((node, key) => (node == null ? null : node[key]), tree);
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem("mesob_lang") || "en");
  useEffect(() => {
    localStorage.setItem("mesob_lang", lang);
    document.documentElement.lang = lang === "am" ? "am" : lang === "om" ? "om" : "en";
  }, [lang]);
  const value = useMemo(
    () => ({
      lang,
      setLang,
      t(path) {
        return lookup(catalogs[lang], path) || lookup(en, path) || path;
      },
    }),
    [lang]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
