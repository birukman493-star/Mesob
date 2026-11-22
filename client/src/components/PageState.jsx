import { useI18n } from "../context/I18nContext.jsx";

export default function PageState({ loading, error, empty, onRetry, children }) {
  const { t } = useI18n();
  if (loading) return <div className="state-box" role="status">{t("common.loading")}</div>;
  if (error) {
    return (
      <div className="state-box error" role="alert">
        <p>{error}</p>
        {onRetry && <button className="btn btn-primary" onClick={onRetry}>{t("common.retry")}</button>}
      </div>
    );
  }
  if (empty) return <div className="state-box">{empty}</div>;
  return children;
}
