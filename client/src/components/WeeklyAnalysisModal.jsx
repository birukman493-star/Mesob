export default function WeeklyAnalysisModal({ data, onClose }) {
  return (
    <dialog className="mesob-dialog" open aria-modal="true" aria-labelledby="analysis-title">
      <div className="dialog-body">
        <div className="d-flex justify-content-between">
          <h2 id="analysis-title" className="h4">Weekly analysis</h2>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Close</button>
        </div>
        <p className="fine">{data?.note}</p>
        <ul className="list-unstyled">
          {(data?.nutrients || []).map((row) => (
            <li key={row.key} className="d-flex justify-content-between border-bottom py-2">
              <span>{row.priority ? "● " : ""}{row.label}</span>
              <span>{row.value} / {row.target} {row.unit} · {row.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
