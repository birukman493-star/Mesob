import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../api/client";
import PageState from "../components/PageState.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const PDF_SECTIONS = [
  ["patient", "Patient details", "Name, age, conditions, allergies"],
  ["targets", "Daily targets", "Energy, macros, fiber, sodium"],
  ["intake", "Average intake vs targets", "Table from logged foods"],
  ["weight", "Weight", "Weights saved in this period"],
  ["concerns", "Flagged intake concerns", "Days below the saved target"],
  ["notes", "Notes", "Latest assistant note"],
];

function statusOf(value, target) {
  if (!target) return "ok";
  const ratio = Number(value) / Number(target);
  if (ratio < 0.85) return "low";
  if (ratio > 1.15) return "high";
  return "ok";
}

function formatRange(days = []) {
  if (!days.length) return "";
  const start = new Date(`${days[0].date}T12:00:00`);
  const end = new Date(`${days[days.length - 1].date}T12:00:00`);
  const left = start.toLocaleDateString([], { day: "numeric", month: "short" });
  const right = end.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  return `${left} – ${right}`;
}

function dayLabel(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: "short", day: "numeric" });
}

export default function Reports() {
  const { me } = useAuth();
  const [weekly, setWeekly] = useState(null);
  const [guides, setGuides] = useState([]);
  const [foods, setFoods] = useState([]);
  const [dayLog, setDayLog] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [screen, setScreen] = useState("home");
  const [picked, setPicked] = useState(PDF_SECTIONS.map(([id]) => id));
  const [period, setPeriod] = useState("week");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pdfError, setPdfError] = useState("");

  function load() {
    setLoading(true);
    Promise.all([api.get("/reports/weekly"), api.get("/guidelines"), api.get("/foods")])
      .then(([week, docs, foodRes]) => {
        setWeekly(week.data);
        setGuides(docs.data.documents || []);
        setFoods(foodRes.data.foods || []);
        const last = week.data.days?.[week.data.days.length - 1]?.date;
        setSelectedDate((current) => current || last || "");
        setError("");
      })
      .catch((err) => setError(err.userMessage))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  useEffect(() => {
    if (!selectedDate) return undefined;
    let active = true;
    api.get("/logs", { params: { date: selectedDate } })
      .then((res) => active && setDayLog(res.data))
      .catch(() => active && setDayLog(null));
    return () => { active = false; };
  }, [selectedDate]);

  const targets = me?.targets || {};
  const days = weekly?.days || [];
  const loggedDays = days.filter((day) => Number(day.kcal) > 0);
  const rows = useMemo(() => {
    const fromApi = weekly?.rows || [];
    const sodiumTarget = Number(targets.sodium_mg || 0);
    if (!sodiumTarget || fromApi.some((row) => row.key === "sodium_mg")) return fromApi;
    const average = days.length
      ? Math.round((days.reduce((sum, day) => sum + Number(day.sodium_mg || 0), 0) / days.length) * 10) / 10
      : 0;
    return [...fromApi, { key: "sodium_mg", label: "Sodium", unit: "mg", average, target: sodiumTarget }];
  }, [weekly, targets.sodium_mg, days]);
  const rated = rows.map((row) => ({ ...row, status: statusOf(row.average, row.target) }));
  const counts = {
    ok: rated.filter((row) => row.status === "ok").length,
    low: rated.filter((row) => row.status === "low").length,
    high: rated.filter((row) => row.status === "high").length,
  };
  const inRange = rated.length ? Math.round((counts.ok / rated.length) * 100) : 0;
  const kcalRow = rated.find((row) => row.key === "kcal");
  const condition = (me?.profile?.conditions || [])[0];
  const ironFoods = [...foods].sort((a, b) => Number(b.iron_mg) - Number(a.iron_mg)).slice(0, 3);

  async function preview() {
    setPdfError("");
    try {
      const response = await api.get("/reports/health-summary.pdf", {
        params: { period, sections: picked.join(",") },
        responseType: "blob",
      });
      const next = URL.createObjectURL(response.data);
      setUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return next;
      });
      setScreen("pdf");
    } catch (err) {
      setPdfError(err.userMessage || "The PDF could not be created.");
    }
  }

  function toggle(section) {
    setPicked((current) => (current.includes(section) ? current.filter((item) => item !== section) : [...current, section]));
  }

  return (
    <PageState loading={loading} error={error} onRetry={load}>
      <section className="report-page">
        {screen === "home" && loggedDays.length < 3 && (
          <Empty loggedDays={loggedDays.length} hasWeight={Boolean(me?.profile?.weight_kg)} />
        )}
        {screen === "home" && loggedDays.length >= 3 && (
          <>
            <header className="consult-top">
              <div>
                <h1>Reports</h1>
                <p>{me?.user?.full_name}{condition ? ` · ${String(condition).replaceAll("_", " ")}` : ""}</p>
              </div>
            </header>
            <div className="week-switch">
              <span />
              <div><strong>{formatRange(days)}</strong><small>Last 7 days</small></div>
              <span />
            </div>
            <article className="consult-card score-card">
              <div className="ring-stat" aria-label={`${inRange} percent of tracked nutrients are in range`}>
                <strong>{inRange}</strong><small>in range</small>
              </div>
              <div>
                <strong>Nutrients in range</strong>
                <p>This is the share of tracked nutrients whose 7-day average is between 85% and 115% of your target. Empty days count as zero.</p>
                <div className="status-pills">
                  <em className="ok">{counts.ok} OK</em>
                  <em className="low">{counts.low} Low</em>
                  <em className="high">{counts.high} High</em>
                </div>
              </div>
            </article>
            <div className="stat-trio">
              <div><small>7-day avg</small><strong>{Math.round(kcalRow?.average || 0).toLocaleString()}</strong><small>kcal</small></div>
              <div><small>Days logged</small><strong>{loggedDays.length} / {days.length}</strong></div>
              <div><small>Weight</small><strong>{me?.profile?.weight_kg ? `${me.profile.weight_kg} kg` : "—"}</strong></div>
            </div>
            <div className="report-grid">
              <button type="button" onClick={() => setScreen("weekly")}><i className="bi bi-bar-chart" /><span><strong>Weekly analysis</strong><small>{counts.ok} OK · {counts.low} low · {counts.high} high</small></span></button>
              <button type="button" onClick={() => setScreen("daily")}><i className="bi bi-calendar3" /><span><strong>Daily report</strong><small>{dayLabel(selectedDate)} · {Math.round(dayLog?.totals?.kcal || 0).toLocaleString()} kcal</small></span></button>
              <button type="button" onClick={() => setScreen("calories")}><i className="bi bi-fire" /><span><strong>Calories</strong><small>Avg {Math.round(kcalRow?.average || 0).toLocaleString()} kcal</small></span></button>
              <button type="button" onClick={() => setScreen("macros")}><i className="bi bi-pie-chart" /><span><strong>Macros</strong><small>Protein, carbs, fat</small></span></button>
              <button type="button" onClick={() => setScreen("nutrients")}><i className="bi bi-shield" /><span><strong>Nutrient status</strong><small>{(weekly?.statements || [])[0] || "From logged foods"}</small></span></button>
              <button type="button" onClick={() => setScreen("weight")}><i className="bi bi-speedometer2" /><span><strong>Weight</strong><small>{me?.profile?.goal_weight_kg ? `Goal ${me.profile.goal_weight_kg} kg` : "Profile weight"}</small></span></button>
            </div>
            <article className="consult-card pdf-row">
              <i className="bi bi-file-earmark-text" />
              <span><strong>Health summary PDF</strong><small>Share with your doctor or dietitian</small></span>
              <button type="button" className="btn btn-primary" onClick={() => setScreen("summary")}>Export</button>
            </article>
            <button type="button" className="btn btn-ghost" onClick={() => setScreen("guides")}>Guidelines used for targets</button>
          </>
        )}

        {screen === "weekly" && (
          <Subpage title="Weekly analysis" subtitle={`${formatRange(days)} · 7-day average`} onBack={() => setScreen("home")}>
            <div className="status-pills">
              <em className="ok">{counts.ok} OK 85–115%</em>
              <em className="low">{counts.low} Low &lt; 85%</em>
              <em className="high">{counts.high} High &gt; 115%</em>
            </div>
            {rated.map((row) => (
              <NutrientBar key={row.key} row={row} priority={row.key === "carbs_g" && condition} />
            ))}
            <p className="info-box">{weekly?.label} Based on foods you logged. Days with no log count as zero.</p>
          </Subpage>
        )}

        {screen === "daily" && (
          <Subpage title="Daily report" subtitle={selectedDate ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }) : ""} onBack={() => setScreen("home")}>
            <div className="day-row">
              {days.map((day) => (
                <button key={day.date} type="button" className={day.date === selectedDate ? "on" : ""} onClick={() => setSelectedDate(day.date)}>
                  <small>{new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: "short" })}</small>
                  {new Date(`${day.date}T12:00:00`).getDate()}
                </button>
              ))}
            </div>
            <article className="consult-card daily-kcal">
              <div><strong>{Math.round(dayLog?.totals?.kcal || 0).toLocaleString()}</strong><small>of {Math.round(dayLog?.targets?.kcal || targets.kcal || 0).toLocaleString()} kcal</small></div>
              {["protein_g", "carbs_g", "fat_g"].map((key) => {
                const value = Number(dayLog?.totals?.[key] || 0);
                const target = Number(dayLog?.targets?.[key] || targets[key] || 0);
                const width = target ? Math.min(100, (value / target) * 100) : 0;
                return (
                  <div key={key} className="mb-2">
                    <div className="d-flex justify-content-between fine"><span>{key.replace("_g", "")}</span><span>{Math.round(value)} / {Math.round(target)} g</span></div>
                    <div className="macro-line"><span style={{ width: `${width}%` }} /></div>
                  </div>
                );
              })}
            </article>
            <div className="assistant-section-head"><h3>Logged foods</h3><span>{dayLog?.entries?.length || 0} logged</span></div>
            {(dayLog?.entries || []).length === 0 && <p className="fine">Nothing logged on this day.</p>}
            {(dayLog?.entries || []).map((entry) => (
              <article key={entry.id} className="log-row">
                <b>{entry.name_en.slice(0, 1)}</b>
                <span><strong>{entry.name_en}</strong><small>{entry.portions} portion · {entry.source}</small></span>
                <em>{Math.round(entry.nutrients.kcal)}<small>kcal</small></em>
              </article>
            ))}
            <div className="stat-trio">
              <div><small>Water</small><strong>{Math.round((dayLog?.water_ml || 0) / 100) / 10} L</strong></div>
              <div><small>Fiber</small><strong>{Math.round(dayLog?.totals?.fiber_g || 0)} g</strong></div>
              <div><small>Iron</small><strong>{dayLog?.totals?.iron_mg || 0} mg</strong></div>
            </div>
          </Subpage>
        )}

        {screen === "calories" && (
          <Subpage title="Calorie analysis" subtitle={formatRange(days)} onBack={() => setScreen("home")}>
            <p className="kcal-big">{Math.round(kcalRow?.average || 0).toLocaleString()}<small>kcal · 7-day average · target {Math.round(kcalRow?.target || 0).toLocaleString()}</small></p>
            <div className="panel p-2" style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days.map((day) => ({ ...day, label: dayLabel(day.date) }))}>
                  <XAxis dataKey="label" /><YAxis /><Tooltip />
                  <ReferenceLine y={Number(kcalRow?.target || 0)} stroke="#132a13" strokeDasharray="4 4" />
                  <Bar dataKey="kcal" radius={[6, 6, 0, 0]}>
                    {days.map((day) => <Cell key={day.date} fill={statusOf(day.kcal, kcalRow?.target) === "ok" ? "#4f772d" : "#c47b2b"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="fine">Green bars are 85–115% of the daily target. Other logged days are marked differently. A day with no food is zero.</p>
          </Subpage>
        )}

        {screen === "macros" && (
          <Subpage title="Macros" subtitle="7-day average versus your saved target" onBack={() => setScreen("home")}>
            {rated.filter((row) => ["protein_g", "carbs_g", "fat_g"].includes(row.key)).map((row) => <NutrientBar key={row.key} row={row} />)}
          </Subpage>
        )}

        {screen === "nutrients" && (
          <Subpage title="Nutrient intake status" subtitle={formatRange(days)} onBack={() => setScreen("home")}>
            <p className="sample-note">{weekly?.label} Based on foods you logged, not lab tests.</p>
            {(weekly?.statements || []).map((line) => <p key={line}>{line}</p>)}
            {["iron_mg", "calcium_mg", "fiber_g", "sodium_mg", "protein_g"].map((key) => {
              const row = rated.find((item) => item.key === key);
              if (!row) return null;
              return (
                <article key={key} className="consult-card">
                  <strong>{row.label}</strong>
                  <p className="fine">Avg {row.average} {row.unit} of {row.target} {row.unit}</p>
                  <div className="dot-row">
                    {days.map((day) => {
                      const logged = Number(day.kcal) > 0;
                      const mark = logged ? statusOf(day[key], row.target) : "empty";
                      return <i key={day.date} className={mark} title={day.date} />;
                    })}
                  </div>
                </article>
              );
            })}
            <h2 className="h6">Foods in the database with more iron</h2>
            <div className="iron-row">
              {ironFoods.map((food) => (
                <article key={food.id}><strong>{food.name_en}</strong><small>{food.iron_mg} mg / {food.portion_unit}</small></article>
              ))}
            </div>
          </Subpage>
        )}

        {screen === "weight" && (
          <Subpage title="Weight" subtitle="Saved on your profile" onBack={() => setScreen("home")}>
            <p className="kcal-big">{me?.profile?.weight_kg || "—"}<small>kg current</small></p>
            <div className="stat-trio">
              <div><small>Goal</small><strong>{me?.profile?.goal_weight_kg || "—"}</strong><small>kg</small></div>
              <div><small>To go</small><strong>{me?.profile?.weight_kg && me?.profile?.goal_weight_kg ? Math.round(Math.abs(me.profile.weight_kg - me.profile.goal_weight_kg) * 10) / 10 : "—"}</strong><small>kg</small></div>
            </div>
            <p className="info-box">A week-by-week chart needs saved weigh-ins. This screen only has the weight on your health profile. The PDF includes weigh-ins stored for the selected period.</p>
          </Subpage>
        )}

        {screen === "summary" && (
          <Subpage title="Health summary" subtitle={`Preview · ${formatRange(days)}`} onBack={() => setScreen("home")}>
            <SummaryCard title="Patient" text={`${me?.user?.full_name || ""} · ${me?.user?.age || "age not set"} · ${(me?.profile?.conditions || []).join(", ") || "no condition listed"} · allergies ${(me?.profile?.allergies || []).join(", ") || "none listed"}`} />
            <SummaryCard title="Daily targets" text={`${Math.round(targets.kcal || 0)} kcal · P ${targets.protein_g || 0} g · C ${targets.carbs_g || 0} g · F ${targets.fat_g || 0} g`} />
            <SummaryCard title="Average intake" text={rated.slice(0, 4).map((row) => `${row.label} ${row.target ? Math.round((row.average / row.target) * 100) : 0}%`).join(" · ")} />
            <SummaryCard title="Flagged concerns" text={(weekly?.statements || []).slice(0, 4).join(". ") || "No low days in this window."} />
            {pdfError && <p className="text-danger">{pdfError}</p>}
            <div className="pair-actions">
              <button type="button" onClick={() => setScreen("sections")}>Edit sections</button>
              <button type="button" className="btn btn-primary" onClick={preview}>Preview PDF</button>
            </div>
          </Subpage>
        )}

        {screen === "sections" && (
          <Subpage title="Health summary PDF" subtitle="Choose what to include" onBack={() => setScreen("summary")}>
            <div className="segment">
              <button type="button" className={period === "week" ? "on" : ""} onClick={() => setPeriod("week")}>Week</button>
              <button type="button" className={period === "month" ? "on" : ""} onClick={() => setPeriod("month")}>Month</button>
            </div>
            <p className="fine">{period === "week" ? formatRange(days) : "The last 30 days"}</p>
            {PDF_SECTIONS.map(([id, title, detail]) => (
              <button key={id} type="button" className="share-row" onClick={() => toggle(id)}>
                <span><strong>{title}</strong><small>{detail}</small></span>
                <em className={picked.includes(id) ? "on" : ""}>{picked.includes(id) ? "On" : "Off"}</em>
              </button>
            ))}
            <button type="button" className="btn btn-primary w-100 mt-3" disabled={!picked.length} onClick={preview}>Generate PDF</button>
          </Subpage>
        )}

        {screen === "pdf" && (
          <Subpage title="PDF preview" onBack={() => setScreen("summary")}>
            {url && <iframe title="Health summary preview" src={url} className="pdf-frame" />}
            {url && <a className="btn btn-primary mt-2" href={url} download="mesob-health-summary.pdf">Download PDF</a>}
          </Subpage>
        )}

        {screen === "guides" && (
          <Subpage title="Guidelines" subtitle="Used to set your targets" onBack={() => setScreen("home")}>
            <p className="sample-note">Showing saved guidelines for {me?.user?.full_name || "this profile"}{condition ? `, ${String(condition).replaceAll("_", " ")}` : ""}.</p>
            {guides.map((doc) => (
              <article key={doc.id} className="consult-card">
                <p className="fine mb-1">{doc.audience}</p>
                <h2 className="h6">{doc.title}</h2>
                <p>{doc.body}</p>
                <p className="fine mb-0">{doc.source}{String(doc.source || "").includes("TODO_VERIFY") ? " · Sample, pending review" : ""}</p>
              </article>
            ))}
            <p className="info-box">Sample entries are placeholders until a verified source replaces them.</p>
          </Subpage>
        )}
      </section>
    </PageState>
  );
}

function NutrientBar({ row, priority }) {
  const width = row.target ? Math.min(140, (row.average / row.target) * 100) : 0;
  return (
    <article className="nutrient-bar">
      <div><strong>{row.label}</strong>{priority && <em>Priority</em>}<span>{row.average} / {row.target} {row.unit}</span></div>
      <i className={row.status}><b style={{ width: `${Math.min(width, 100)}%` }} /></i>
      <small className={row.status}>{row.target ? `${Math.round((row.average / row.target) * 100)}%` : "—"} {row.status}</small>
    </article>
  );
}

function SummaryCard({ title, text }) {
  return <article className="consult-card"><h2 className="h6">{title}</h2><p className="mb-0">{text}</p></article>;
}

function Subpage({ title, subtitle, onBack, children }) {
  return (
    <div>
      <header className="consult-top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back"><i className="bi bi-arrow-left" /></button>
        <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      </header>
      {children}
    </div>
  );
}

function Empty({ loggedDays, hasWeight }) {
  const done = loggedDays > 0 ? 1 : 0;
  return (
    <div className="consult-empty">
      <h1>Reports</h1>
      <div className="empty-mark"><i className="bi bi-bar-chart" /></div>
      <h2>No reports yet</h2>
      <p>Log meals on at least 3 days and the weekly analysis can be built from those foods.</p>
      <article className="consult-card text-start">
        <div className="d-flex justify-content-between"><strong>Your progress</strong><span>{Math.min(loggedDays, 3)} of 3 days</span></div>
        <div className="macro-line my-2"><span style={{ width: `${(Math.min(loggedDays, 3) / 3) * 100}%` }} /></div>
        <p>{done ? "Today has a logged meal." : "Log today's meals."}</p>
        <p>{hasWeight ? "A weight is saved on your profile." : "Add a weight on your profile."}</p>
        <p>Keep logging until 3 different days have food.</p>
      </article>
      <Link className="btn btn-primary w-100" to="/scan">Log a meal</Link>
      <Link className="btn btn-ghost w-100 mt-2" to="/scan">Scan my plate</Link>
    </div>
  );
}
