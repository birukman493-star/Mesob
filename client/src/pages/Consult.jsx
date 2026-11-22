import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";

const REASONS = ["Fasting-day meals", "Blood sugar", "Weight loss", "Meal plan review", "Other"];
const SESSIONS = ["Video call · 30 min", "Phone call · 30 min", "Chat"];
const PARTS = ["Morning", "Afternoon", "Evening"];
const DAYS = [7, 30, 90];

function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "D";
}

function languageName(code) {
  if (code === "am") return "Amharic";
  if (code === "om") return "Afaan Oromo";
  return "English";
}

function whenLabel(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function dayChip(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return {
    key: date.toISOString().slice(0, 10),
    week: date.toLocaleDateString([], { weekday: "short" }),
    day: date.getDate(),
    label: date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }),
  };
}

function readNote(note = "") {
  const lines = String(note || "").split("\n");
  const pick = (label) => lines.find((line) => line.startsWith(`${label}:`))?.slice(label.length + 1).trim() || "";
  const summary = lines.filter((line) => !/^(Reason|When|Session):/.test(line)).join("\n").trim();
  return { reason: pick("Reason"), when: pick("When"), session: pick("Session"), summary };
}

function statusLabel(status) {
  if (status === "accepted") return "Accepted";
  if (status === "done") return "Completed";
  return "Requested";
}

function composeNote({ reason, when, session, summary }) {
  return [`Reason: ${reason}`, when ? `When: ${when}` : "", session ? `Session: ${session}` : "", summary].filter(Boolean).join("\n");
}

export default function Consult() {
  const { me } = useAuth();
  const [dietitians, setDietitians] = useState([]);
  const [requests, setRequests] = useState([]);
  const [consents, setConsents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("home");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [summary, setSummary] = useState("");
  const [day, setDay] = useState(dayChip(2).key);
  const [part, setPart] = useState("Afternoon");
  const [session, setSession] = useState(SESSIONS[0]);
  const [sent, setSent] = useState(null);
  const [openRequest, setOpenRequest] = useState(null);
  const [filter, setFilter] = useState("all");
  const [shareProfile, setShareProfile] = useState(true);
  const [shareLogs, setShareLogs] = useState(true);
  const [shareDays, setShareDays] = useState(30);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const days = useMemo(() => [0, 1, 2, 3, 4].map(dayChip), []);

  function load() {
    setLoading(true);
    Promise.all([api.get("/consult/dietitians"), api.get("/consult/mine")])
      .then(([people, mine]) => {
        setDietitians(people.data.dietitians || []);
        setRequests(mine.data.requests || []);
        setConsents(mine.data.consents || []);
        setError("");
      })
      .catch((err) => setError(err.userMessage || "Consultations could not be loaded."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const active = requests.find((item) => item.status !== "done") || null;
  const activeConsent = consents.find((item) => item.dietitian_id === active?.dietitian_id);
  const matches = dietitians.filter((person) => person.full_name.toLowerCase().includes(query.trim().toLowerCase()));
  const history = requests.filter((item) => {
    if (filter === "upcoming") return item.status !== "done";
    if (filter === "past") return item.status === "done";
    return true;
  });

  function openDietitian(person) {
    setSelected(person);
    setScreen("profile");
  }

  function startRequest(person) {
    setSelected(person);
    setReason(REASONS[0]);
    setSummary("");
    setSession(SESSIONS[0]);
    setScreen("request");
  }

  async function sendRequest(event) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    const chosen = days.find((item) => item.key === day);
    const when = chosen ? `${chosen.label} · ${part}` : part;
    const note = composeNote({ reason, when, session, summary });
    try {
      const { data } = await api.post("/consult/request", { dietitian_id: selected.id, note });
      const created = {
        id: data.id,
        status: "requested",
        note,
        created_at: new Date().toISOString(),
        dietitian_id: selected.id,
        dietitian_name: selected.full_name,
        dietitian_language: selected.language,
      };
      setSent(created);
      setOpenRequest(created);
      setScreen("sent");
      load();
    } catch (err) {
      setError(err.userMessage || "The request could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function allowAccess() {
    const personId = openRequest?.dietitian_id || selected?.id;
    if (!personId) return;
    const scope = [shareProfile && "profile", shareLogs && "logs"].filter(Boolean);
    if (!scope.length) {
      setError("Choose profile or food logs before allowing access.");
      return;
    }
    setBusy(true);
    try {
      await api.put("/consent", { dietitian_id: personId, grant: true, scope, days: shareDays });
      setScreen("detail");
      setRevokeOpen(false);
      load();
    } catch (err) {
      setError(err.userMessage || "Consent could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    const personId = openRequest?.dietitian_id || active?.dietitian_id;
    if (!personId) return;
    setBusy(true);
    try {
      await api.put("/consent", { dietitian_id: personId, grant: false });
      setRevokeOpen(false);
      load();
    } catch (err) {
      setError(err.userMessage || "Access could not be revoked.");
    } finally {
      setBusy(false);
    }
  }

  const person = selected || dietitians.find((item) => item.id === openRequest?.dietitian_id) || null;
  const consentForOpen = consents.find((item) => item.dietitian_id === openRequest?.dietitian_id);

  return (
    <section className="consult-page">
      {error && <p className="text-danger" role="alert">{error}</p>}
      {loading && <p className="fine">Loading…</p>}

      {screen === "home" && !loading && (
        <>
          <header className="consult-top">
            <div>
              <h1>Dietitian</h1>
              <p>A dietitian sees your record only after you allow it.</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => setScreen("history")} aria-label="Consultation history"><i className="bi bi-clock" /></button>
          </header>

          {requests.length === 0 ? (
            <Empty onFind={() => setScreen("directory")} />
          ) : (
            <>
              {active && (
                <article className="consult-card">
                  <div className="consult-card-head">
                    <span>Active consultation</span>
                    <em className={active.status}>{statusLabel(active.status)}</em>
                  </div>
                  <button type="button" className="person-row" onClick={() => openDietitian({ id: active.dietitian_id, full_name: active.dietitian_name, language: active.dietitian_language })}>
                    <b>{initials(active.dietitian_name)}</b>
                    <span>
                      <strong>{active.dietitian_name || "Dietitian"}</strong>
                      <small>{languageName(active.dietitian_language)}</small>
                    </span>
                  </button>
                  <div className="when-box">
                    <i className="bi bi-camera-video" />
                    <span>
                      <strong>{readNote(active.note).when || "Time not chosen yet"}</strong>
                      <small>{readNote(active.note).session || "Preferred session is saved with the request"}</small>
                    </span>
                  </div>
                  <p className="share-line">
                    <i className="bi bi-shield-check" />
                    {activeConsent
                      ? `Sharing ${scopeText(activeConsent.scope)} until ${whenLabel(activeConsent.expires_at) || "you revoke it"}.`
                      : "Not sharing records yet. The dietitian cannot open them."}
                  </p>
                  <div className="pair-actions">
                    <button type="button" onClick={() => startRequest({ id: active.dietitian_id, full_name: active.dietitian_name, language: active.dietitian_language })}><i className="bi bi-chat" /> Message</button>
                    <button type="button" className="soft" onClick={() => { setOpenRequest(active); setScreen("detail"); }}>View details</button>
                  </div>
                </article>
              )}
              <Directory
                title="Find a dietitian"
                people={matches.slice(0, 3)}
                query={query}
                onQuery={setQuery}
                onOpen={openDietitian}
                onSeeAll={() => setScreen("directory")}
              />
              <How />
            </>
          )}
        </>
      )}

      {screen === "directory" && (
        <Subpage title="Find a dietitian" onBack={() => setScreen("home")}>
          <Directory people={matches} query={query} onQuery={setQuery} onOpen={openDietitian} />
          {matches.length === 0 && <p className="fine">No dietitian matches that name.</p>}
        </Subpage>
      )}

      {screen === "profile" && person && (
        <Subpage title="" onBack={() => setScreen("home")}>
          <div className="diet-hero"><b>{initials(person.full_name)}</b></div>
          <h2>{person.full_name}</h2>
          <p className="fine">Mesob dietitian · {languageName(person.language)}</p>
          <p>This person can receive consultation requests. They can read your profile and recent food logs only while consent is active. Years of experience, ratings, and clinic names are not stored.</p>
          <p className="group-label">Language</p>
          <span className="chip sage">{languageName(person.language)}</span>
          <button type="button" className="btn btn-primary w-100 mt-4" onClick={() => startRequest(person)}>
            <i className="bi bi-calendar-plus" /> Request consultation
          </button>
        </Subpage>
      )}

      {screen === "request" && person && (
        <form className="subpage" onSubmit={sendRequest}>
          <header className="consult-top">
            <button type="button" className="icon-btn" onClick={() => setScreen("profile")} aria-label="Close"><i className="bi bi-x-lg" /></button>
            <h1>Request consultation</h1>
          </header>
          <article className="person-row static">
            <b>{initials(person.full_name)}</b>
            <span><strong>{person.full_name}</strong><small>They confirm the time after accepting.</small></span>
            <button type="button" onClick={() => setScreen("directory")}>Change</button>
          </article>
          <p className="group-label">Reason</p>
          <div className="reason-row">
            {REASONS.map((item) => (
              <button key={item} type="button" className={reason === item ? "on" : ""} onClick={() => setReason(item)}>{item}</button>
            ))}
          </div>
          <textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What would you like help with?" maxLength={800} />
          <p className="group-label">Preferred time</p>
          <div className="day-row">
            {days.map((item) => (
              <button key={item.key} type="button" className={day === item.key ? "on" : ""} onClick={() => setDay(item.key)}>
                <small>{item.week}</small>{item.day}
              </button>
            ))}
          </div>
          <div className="segment">
            {PARTS.map((item) => (
              <button key={item} type="button" className={part === item ? "on" : ""} onClick={() => setPart(item)}>{item}</button>
            ))}
          </div>
          <p className="group-label">Session type</p>
          <div className="reason-row">
            {SESSIONS.map((item) => (
              <button key={item} type="button" className={session === item ? "on" : ""} onClick={() => setSession(item)}>{item}</button>
            ))}
          </div>
          <p className="info-box"><i className="bi bi-shield-lock" /> {person.full_name.split(" ")[0]} can read your data only after you give consent in the next step. This saves a preference, not a confirmed appointment.</p>
          <button className="btn btn-primary w-100" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
        </form>
      )}

      {screen === "sent" && sent && (
        <div className="subpage sent">
          <button type="button" className="icon-btn" onClick={() => setScreen("home")} aria-label="Close"><i className="bi bi-x-lg" /></button>
          <div className="sent-mark"><i className="bi bi-send" /></div>
          <h2>Request sent</h2>
          <p>{sent.dietitian_name} will confirm the time after they accept the request.</p>
          <article className="consult-card">
            <div className="person-row static">
              <b>{initials(sent.dietitian_name)}</b>
              <span><strong>{sent.dietitian_name}</strong><small>Request #{sent.id}</small></span>
              <em className="requested">Requested</em>
            </div>
            <dl>
              <div><dt>Preferred time</dt><dd>{readNote(sent.note).when}</dd></div>
              <div><dt>Reason</dt><dd>{readNote(sent.note).reason}</dd></div>
              <div><dt>Session</dt><dd>{readNote(sent.note).session}</dd></div>
            </dl>
          </article>
          <ol className="steps">
            <li className="done"><strong>Request sent</strong><small>{whenLabel(sent.created_at)}</small></li>
            <li><strong>Dietitian confirms time</strong><small>The status changes when they accept.</small></li>
            <li><strong>You approve data sharing</strong><small>Before they can open your record.</small></li>
          </ol>
          <button type="button" className="btn btn-primary w-100" onClick={() => { setOpenRequest(sent); setScreen("consent"); }}>Share data</button>
          <button type="button" className="btn btn-ghost w-100 mt-2" onClick={() => { setOpenRequest(sent); setScreen("detail"); }}>View request</button>
        </div>
      )}

      {screen === "history" && (
        <Subpage title="My consultations" onBack={() => setScreen("home")}>
          <div className="segment">
            {[["all", `All ${requests.length}`], ["upcoming", `Upcoming ${requests.filter((item) => item.status !== "done").length}`], ["past", `Past ${requests.filter((item) => item.status === "done").length}`]].map(([id, label]) => (
              <button key={id} type="button" className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
          {history.length === 0 && <p className="fine">Nothing in this list.</p>}
          {history.map((item) => {
            const parsed = readNote(item.note);
            return (
              <button key={item.id} type="button" className="history-consult" onClick={() => { setOpenRequest(item); setScreen("detail"); }}>
                <em className={item.status}>{statusLabel(item.status)}</em>
                <time>{whenLabel(item.created_at)}</time>
                <strong>{parsed.reason || parsed.summary || "Consultation"}</strong>
                <small>{parsed.when || item.dietitian_name}</small>
              </button>
            );
          })}
          <button type="button" className="btn btn-primary w-100" onClick={() => setScreen("directory")}>Find a dietitian</button>
        </Subpage>
      )}

      {screen === "detail" && openRequest && (
        <Subpage title={`Consultation #${openRequest.id}`} onBack={() => setScreen("home")}>
          <div className="person-row static">
            <b>{initials(openRequest.dietitian_name)}</b>
            <span>
              <strong>{readNote(openRequest.note).reason || "Consultation"}</strong>
              <small>{openRequest.dietitian_name} · {whenLabel(openRequest.created_at)}</small>
            </span>
            <em className={openRequest.status}>{statusLabel(openRequest.status)}</em>
          </div>
          <article className="consult-card">
            <h2>Timeline</h2>
            <ol className="steps">
              <li className="done"><strong>Requested</strong><small>{readNote(openRequest.note).summary || readNote(openRequest.note).reason}</small><time>{whenLabel(openRequest.created_at)}</time></li>
              <li className={openRequest.status !== "requested" ? "done" : ""}><strong>Accepted</strong><small>{openRequest.status === "requested" ? "Waiting for the dietitian." : "The dietitian accepted this request."}</small></li>
              <li className={consentForOpen ? "done" : ""}><strong>Consent</strong><small>{consentForOpen ? `Sharing ${scopeText(consentForOpen.scope)} until ${whenLabel(consentForOpen.expires_at)}.` : "Not granted."}</small></li>
              <li className={openRequest.status === "done" ? "done" : ""}><strong>Completed</strong><small>{openRequest.status === "done" ? "Marked done by the dietitian." : "Not completed yet."}</small></li>
            </ol>
          </article>
          {readNote(openRequest.note).summary && <article className="consult-card"><h2>Your note</h2><p>{readNote(openRequest.note).summary}</p></article>}
          {consentForOpen ? (
            <button type="button" className="btn btn-ghost w-100" onClick={() => setRevokeOpen(true)}>Revoke access</button>
          ) : (
            <button type="button" className="btn btn-primary w-100" onClick={() => setScreen("consent")}>Share data</button>
          )}
        </Subpage>
      )}

      {screen === "consent" && (openRequest || person) && (
        <Subpage title="Data sharing consent" subtitle="Required before the dietitian can open your record." onBack={() => setScreen(openRequest ? "detail" : "home")}>
          <article className="person-row static">
            <b>{initials(openRequest?.dietitian_name || person?.full_name)}</b>
            <span>
              <strong>{openRequest?.dietitian_name || person?.full_name}</strong>
              <small>{languageName(openRequest?.dietitian_language || person?.language)}</small>
            </span>
          </article>
          <p className="info-box"><i className="bi bi-lock" /> Dietitians can read your data only while consent is active. They cannot edit your logs.</p>
          <p className="group-label">What they can see</p>
          <div className="share-list">
            <ShareRow icon="bi-person" title="Profile and health conditions" detail={profileDetail(me)} on={shareProfile} onToggle={() => setShareProfile((value) => !value)} />
            <ShareRow icon="bi-egg-fried" title="Food logs" detail="Recent meals, portions and calories" on={shareLogs} onToggle={() => setShareLogs((value) => !value)} />
            <ShareRow icon="bi-speedometer2" title="Weight history" detail="Only the current weight on your profile is stored." disabled />
            <ShareRow icon="bi-file-earmark" title="Reports and PDFs" detail="Not shared from this screen. Download a report yourself." disabled />
            <ShareRow icon="bi-stars" title="AI assistant chats" detail="Not shared." disabled />
          </div>
          <p className="group-label">For how long</p>
          <div className="segment">
            {DAYS.map((item) => (
              <button key={item} type="button" className={shareDays === item ? "on" : ""} onClick={() => setShareDays(item)}>{item} days</button>
            ))}
          </div>
          <p className="fine"><i className="bi bi-arrow-counterclockwise" /> You can revoke access from the consultation details.</p>
          <button type="button" className="btn btn-primary w-100" disabled={busy} onClick={allowAccess}>Allow access for {shareDays} days</button>
          <button type="button" className="btn btn-ghost w-100 mt-2" onClick={() => setScreen("detail")}>Not now</button>
        </Subpage>
      )}

      {revokeOpen && (
        <div className="assistant-modal-back" role="dialog" aria-labelledby="revoke-title">
          <article className="assistant-modal">
            <div className="deny-mark"><i className="bi bi-shield-slash" /></div>
            <h2 id="revoke-title">Revoke access?</h2>
            <p>They will stop seeing your profile and recent food logs right away. The consultation request stays in your history.</p>
            <button type="button" className="btn btn-danger w-100" disabled={busy} onClick={revoke}>Revoke access</button>
            <button type="button" className="btn btn-ghost w-100 mt-2" onClick={() => setRevokeOpen(false)}>Keep sharing</button>
          </article>
        </div>
      )}

      <p className="fine mt-3">Subscription checkout is on the <Link to="/pricing">pricing page</Link>. It does not book a video call.</p>
    </section>
  );
}

function scopeText(scope) {
  const list = Array.isArray(scope) ? scope : safeJson(scope);
  const names = list.map((item) => (item === "logs" ? "food logs" : item));
  return names.join(" and ") || "the allowed record";
}

function safeJson(value) {
  if (!value) return [];
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return []; }
}

function profileDetail(me) {
  const conditions = me?.profile?.conditions || [];
  const allergies = me?.profile?.allergies || [];
  const bits = [me?.user?.age ? `Age ${me.user.age}` : "", conditions[0], allergies[0] ? `${allergies[0]} allergy` : ""].filter(Boolean);
  return bits.join(", ") || "Age, category and the health profile you saved";
}

function Empty({ onFind }) {
  return (
    <div className="consult-empty">
      <div className="empty-mark"><i className="bi bi-heart-pulse" /></div>
      <h2>No consultations yet</h2>
      <p>Get personal advice on Ethiopian meals from a dietitian registered on Mesob.</p>
      <ul>
        <li><i className="bi bi-calendar-plus" /> Request a video, phone or chat preference</li>
        <li><i className="bi bi-file-earmark" /> Choose whether they can see your profile and food logs</li>
        <li><i className="bi bi-shield-check" /> You control what they can see</li>
      </ul>
      <button type="button" className="btn btn-primary w-100" onClick={onFind}><i className="bi bi-search" /> Find a dietitian</button>
    </div>
  );
}

function Directory({ title, people, query, onQuery, onOpen, onSeeAll }) {
  return (
    <div>
      {title && (
        <div className="assistant-section-head">
          <h3>{title}</h3>
          {onSeeAll && <button type="button" onClick={onSeeAll}>See all</button>}
        </div>
      )}
      <label className="search-line">
        <i className="bi bi-search" />
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search by name" />
      </label>
      {people.map((person) => (
        <button key={person.id} type="button" className="person-row" onClick={() => onOpen(person)}>
          <b>{initials(person.full_name)}</b>
          <span>
            <strong>{person.full_name}</strong>
            <small>{languageName(person.language)}</small>
          </span>
          <em className="accepted">Available</em>
          <i className="bi bi-chevron-right" />
        </button>
      ))}
    </div>
  );
}

function How() {
  const steps = [
    ["bi-send", "1. Request", "Pick a reason and a preferred time"],
    ["bi-shield-check", "2. Share data", "You choose what they see"],
    ["bi-chat", "3. Meet", "They accept, then follow up"],
  ];
  return (
    <article className="consult-card">
      <h2>How it works</h2>
      <div className="how-row">
        {steps.map(([icon, title, text]) => (
          <div key={title}><i className={`bi ${icon}`} /><strong>{title}</strong><small>{text}</small></div>
        ))}
      </div>
    </article>
  );
}

function Subpage({ title, subtitle, onBack, children }) {
  return (
    <div className="subpage">
      <header className="consult-top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back"><i className="bi bi-arrow-left" /></button>
        <div>
          {title && <h1>{title}</h1>}
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      {children}
    </div>
  );
}

function ShareRow({ icon, title, detail, on, onToggle, disabled }) {
  return (
    <button type="button" className="share-row" disabled={disabled} onClick={onToggle}>
      <i className={`bi ${icon}`} />
      <span><strong>{title}</strong><small>{detail}</small></span>
      <em className={on && !disabled ? "on" : ""}>{disabled ? "" : on ? "On" : "Off"}</em>
    </button>
  );
}
