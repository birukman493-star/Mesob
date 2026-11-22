export default function Logo({ stacked = false }) {
  return (
    <span className={`brand-lockup ${stacked ? "stacked" : ""}`}>
      <img src="/mesob-logo.png" alt="Mesob AI" />
    </span>
  );
}
