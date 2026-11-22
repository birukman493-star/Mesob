export default function PinBoxes({ id, label, value, onChange, hint }) {
  const cells = Array.from({ length: 6 }, (_, index) => value[index] || "");
  return (
    <div className="pin-field">
      <div className="d-flex justify-content-between">
        <label className="form-label" htmlFor={id}>{label}</label>
      </div>
      <div className="pin-row">
        {cells.map((digit, index) => (
          <span key={index} className={`pin-cell ${digit ? "filled" : ""} ${index === value.length ? "current" : ""}`} aria-hidden="true">
            {digit ? "•" : ""}
          </span>
        ))}
        <input
          id={id}
          className="pin-capture"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{4,6}"
          maxLength={6}
          value={value}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
          required
        />
      </div>
      {hint && <p id={`${id}-hint`} className="fine mt-2 mb-0">{hint}</p>}
    </div>
  );
}
