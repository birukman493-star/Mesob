function Ring({ label, value, target, unit, color }) {
  const safeTarget = Number(target) || 1;
  const ratio = Math.max(0, Math.min(value / safeTarget, 1));
  const radius = 32;
  const circ = 2 * Math.PI * radius;
  return (
    <div className="ring-card stat-card p-3">
      <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`${label} ${Math.round(value)} of ${Math.round(safeTarget)} ${unit}`}>
        <circle cx="44" cy="44" r={radius} fill="none" stroke="#e4ecd4" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${circ * ratio} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="48" textAnchor="middle" fontSize="12" fill="#132A13">{Math.round(ratio * 100)}%</text>
      </svg>
      <strong>{label}</strong>
      <span className="fine">{Math.round(value)} / {Math.round(safeTarget)} {unit}</span>
    </div>
  );
}

export default function ProgressRings({ totals = {}, targets = {} }) {
  const items = [
    ["Calories", totals.kcal, targets.kcal, "kcal", "#4F772D"],
    ["Protein", totals.protein_g, targets.protein_g, "g", "#31572C"],
    ["Carbs", totals.carbs_g, targets.carbs_g, "g", "#90A955"],
    ["Fat", totals.fat_g, targets.fat_g, "g", "#132A13"],
  ];
  return (
    <div className="rings">
      {items.map(([label, value, target, unit, color]) => (
        <Ring key={label} label={label} value={Number(value || 0)} target={target} unit={unit} color={color} />
      ))}
    </div>
  );
}
