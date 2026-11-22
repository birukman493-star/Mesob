import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

const SIZES = [
  ["S", 0.5],
  ["M", 1],
  ["L", 1.5],
];
const MEALS = ["breakfast", "lunch", "snack", "dinner"];

function fileFromCanvas(name) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const pen = canvas.getContext("2d");
  pen.fillStyle = name.includes("injera") ? "#c46b3a" : "#8aa15a";
  pen.fillRect(0, 0, 64, 64);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(new File([blob], name, { type: "image/png" })), "image/png"));
}

function todayKey() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function clock(value) {
  const date = value ? new Date(String(value).replace(" ", "T")) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fileSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function Scanner() {
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [screen, setScreen] = useState("home");
  const [sheet, setSheet] = useState(false);
  const [preview, setPreview] = useState(null);
  const [problem, setProblem] = useState(null);
  const [guesses, setGuesses] = useState([]);
  const [details, setDetails] = useState({});
  const [low, setLow] = useState(false);
  const [picked, setPicked] = useState(null);
  const [portions, setPortions] = useState(1);
  const [extraOn, setExtraOn] = useState(false);
  const [meal, setMeal] = useState("lunch");
  const [popup, setPopup] = useState(null);
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [results, setResults] = useState([]);
  const [logs, setLogs] = useState(null);
  const [logged, setLogged] = useState(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  function loadLogs() {
    api.get("/logs", { params: { date: todayKey() } }).then((res) => setLogs(res.data)).catch(() => {});
  }
  useEffect(loadLogs, []);

  useEffect(() => {
    if (screen === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [screen]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function rejectFile(file) {
    const typeOk = ["image/jpeg", "image/png"].includes(file.type);
    const sizeOk = file.size <= 5 * 1024 * 1024;
    if (typeOk && sizeOk) return false;
    setProblem({
      name: file.name || "photo",
      size: file.size,
      reason: !typeOk ? "Unsupported" : "Too large",
      detail: !typeOk ? `${file.type || "This format"} is not supported` : `${fileSize(file.size)} of 5 MB max`,
    });
    setScreen("error");
    return true;
  }

  function stageFile(file) {
    if (!file || rejectFile(file)) return;
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview({ file, url: URL.createObjectURL(file) });
    setSheet(false);
    setScreen("preview");
  }

  async function openCamera() {
    setSheet(false);
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setScreen("denied");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScreen("camera");
    } catch {
      setScreen("denied");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      stopCamera();
      if (!blob) return;
      stageFile(new File([blob], "plate.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.85);
  }

  async function recognize(file) {
    setScreen("analyzing");
    setStep(0);
    setError("");
    const timer = setInterval(() => setStep((value) => Math.min(value + 1, 2)), 500);
    try {
      const body = new FormData();
      body.append("image", file);
      const { data } = await api.post("/scan", body);
      const cards = {};
      await Promise.all((data.guesses || []).map(async (guess) => {
        const popupRes = await api.get(`/foods/${guess.food_id}/popup`, { params: { portions: 1 } });
        cards[guess.food_id] = popupRes.data;
      }));
      setGuesses(data.guesses || []);
      setDetails(cards);
      setLow(Boolean(data.low_confidence));
      setPicked(data.low_confidence ? null : data.guesses?.[0] || null);
      setPortions(1);
      setExtraOn(false);
      setScreen(data.low_confidence ? "low" : "results");
    } catch (err) {
      setError(err.userMessage || "The photo could not be recognized.");
      setScreen("home");
    } finally {
      clearInterval(timer);
    }
  }

  async function searchFoods(event) {
    event?.preventDefault();
    const { data } = await api.get("/foods", { params: { q: query } });
    setResults(data.foods || []);
  }

  function chooseFood(food, confidence) {
    setPicked({ food_id: food.id || food.food_id, name: food.name_en || food.name, confidence });
    setPortions(1);
    setExtraOn(false);
    setScreen("portion");
  }

  useEffect(() => {
    if (!picked || !["portion", "confirm", "nutrition"].includes(screen)) return undefined;
    let active = true;
    api.get(`/foods/${picked.food_id}/popup`, { params: { portions } })
      .then((res) => active && setPopup(res.data))
      .catch((err) => active && setError(err.userMessage));
    return () => { active = false; };
  }, [picked, portions, screen]);

  async function confirmLog() {
    const first = await api.post("/logs", { food_id: picked.food_id, portions, source: "scan" });
    let day = first.data;
    if (extraOn && guesses[1]) {
      const second = await api.post("/logs", { food_id: guesses[1].food_id, portions: 1, source: "scan" });
      day = second.data;
    }
    setLogged({ meal, food: picked.name, kcal: popup?.nutrients?.kcal, day });
    setLogs(day);
    setScreen("success");
  }

  const selectedDetail = picked ? details[picked.food_id] : null;
  const extra = guesses[1] ? details[guesses[1].food_id] : null;
  const shownLogs = showAll ? logs?.entries || [] : (logs?.entries || []).slice(-3).reverse();
  const visibleFoods = results.filter((food) => {
    if (filter === "fasting") return food.is_fasting_ok;
    if (filter === "low") return food.glycemic_level === "low";
    if (filter === "lunch") return (food.meal_types || []).includes("lunch");
    return true;
  });

  return (
    <section className="scan-page">
      {error && screen === "home" && <p className="text-danger" role="alert">{error}</p>}

      {screen === "home" && (
        <>
          <header className="consult-top">
            <div>
              <h1>Food scanner</h1>
              <p>Recognize Ethiopian dishes from a photo</p>
            </div>
          </header>
          <article className="plate-hero">
            {preview?.url ? <img src={preview.url} alt="Last plate" /> : <div className="plate-art" aria-hidden="true" />}
            <span className="ai-pill"><i className="bi bi-stars" /> AI recognition</span>
            {logs?.entries?.length > 0 && <span className="match-pill">{logs.entries[logs.entries.length - 1].name_en}</span>}
            <div className="plate-copy">
              <h2>Know what's on your plate</h2>
              <p>Snap a meal, confirm the dish, and log calories from the food database.</p>
              <div className="step-pills"><i className="bi bi-camera" /> Snap <span /><i className="bi bi-magic" /> Recognize <span /><i className="bi bi-check-circle" /> Log</div>
            </div>
          </article>
          <button type="button" className="btn btn-primary w-100" onClick={() => setSheet(true)}><i className="bi bi-camera" /> Scan your plate</button>
          <p className="scan-note">Recognition matches the file name to foods already in the database. A photo of a new dish still needs you to confirm it.</p>
          <div className="assistant-section-head">
            <h3>Logged today</h3>
            {(logs?.entries || []).length > 3 && <button type="button" onClick={() => setShowAll((value) => !value)}>{showAll ? "Show less" : "See all"}</button>}
          </div>
          {shownLogs.length === 0 && <p className="fine">No foods logged today.</p>}
          {shownLogs.map((entry) => (
            <article key={entry.id} className="log-row">
              <b>{entry.name_en.slice(0, 1)}</b>
              <span><strong>{entry.name_en}</strong><small>{entry.source} · {clock(entry.logged_at)}</small></span>
              <em>{entry.nutrients.kcal}<small>kcal</small></em>
            </article>
          ))}
        </>
      )}

      {screen === "camera" && (
        <div className="camera-screen">
          <header>
            <button type="button" className="icon-btn" onClick={() => { stopCamera(); setScreen("home"); }} aria-label="Close"><i className="bi bi-x-lg" /></button>
            <strong>Scan food</strong>
            <span />
          </header>
          <video ref={videoRef} autoPlay playsInline muted />
          <button type="button" className="shutter" onClick={capture} aria-label="Take photo" />
        </div>
      )}

      {screen === "denied" && (
        <div className="subpage">
          <button type="button" className="icon-btn" onClick={() => setScreen("home")} aria-label="Close"><i className="bi bi-x-lg" /></button>
          <div className="deny-mark"><i className="bi bi-camera-video-off" /></div>
          <h2>Camera access is off</h2>
          <p>Mesob needs the camera to take a plate photo. The picture is sent only to recognize a food already in the database.</p>
          <ol>
            <li>Click the lock icon in the address bar</li>
            <li>Camera → Allow</li>
            <li>Try the camera again, or choose a photo instead</li>
          </ol>
          <button type="button" className="btn btn-lime w-100" onClick={() => fileRef.current?.click()}><i className="bi bi-image" /> Choose from gallery instead</button>
          <button type="button" className="btn btn-ghost w-100 mt-2" onClick={openCamera}>Try the camera again</button>
        </div>
      )}

      {screen === "preview" && preview && (
        <div className="preview-screen">
          <header>
            <button type="button" className="icon-btn" onClick={() => setScreen("home")} aria-label="Close"><i className="bi bi-x-lg" /></button>
            <div><strong>Preview</strong><small>{preview.file.name} · {fileSize(preview.file.size)}</small></div>
          </header>
          <img src={preview.url} alt="Plate preview" />
          <div className="check-row">
            <span>JPEG or PNG</span>
            <span>Under 5 MB</span>
          </div>
          <p>Make sure the whole plate is visible and in focus. The recognizer uses the file name in this demo.</p>
          <div className="pair-actions">
            <button type="button" onClick={() => fileRef.current?.click()}><i className="bi bi-arrow-counterclockwise" /> Retake</button>
            <button type="button" className="soft" onClick={() => recognize(preview.file)}><i className="bi bi-check-lg" /> Use photo</button>
          </div>
        </div>
      )}

      {screen === "analyzing" && (
        <div className="preview-screen">
          <header><strong>Analyzing your plate</strong></header>
          {preview?.url && <img src={preview.url} alt="" />}
          <article className="consult-card">
            <div className="d-flex justify-content-between"><strong>Recognizing food…</strong></div>
            <p className="fine">Checking the photo against foods already stored.</p>
            {["Photo ready", "Matching the food database", "Reading the saved portion"].map((label, index) => (
              <p key={label} className={index <= step ? "done-step" : "wait-step"}><i className={`bi ${index < step ? "bi-check-circle-fill" : "bi-circle"}`} /> {label}</p>
            ))}
          </article>
        </div>
      )}

      {(screen === "results" || screen === "low") && (
        <div>
          <header className="consult-top">
            <button type="button" className="icon-btn" onClick={() => setScreen("home")} aria-label="Back"><i className="bi bi-arrow-left" /></button>
            <h1>Scan results</h1>
            <button type="button" className="icon-btn" onClick={() => preview && recognize(preview.file)} aria-label="Recognize again"><i className="bi bi-arrow-clockwise" /></button>
          </header>
          {screen === "low" && (
            <article className="safety-card">
              <strong>We're not sure about this one</strong>
              <p>Top match is {Math.round((guesses[0]?.confidence || 0) * 100)}%. Below 60% you confirm the food yourself.</p>
            </article>
          )}
          {preview?.url && screen === "results" && <img className="result-photo" src={preview.url} alt="Scanned plate" />}
          <p className="group-label">{screen === "low" ? "Best guesses" : "Is this your meal?"}</p>
          {guesses.map((guess, index) => {
            const card = details[guess.food_id];
            const percent = Math.round(guess.confidence * 100);
            return (
              <button key={guess.food_id} type="button" className={`guess-card ${picked?.food_id === guess.food_id ? "on" : ""}`} onClick={() => setPicked(guess)}>
                <b>{index + 1}</b>
                <span>
                  <strong>{guess.name} {index === 0 && !low && <em>Best</em>}</strong>
                  <small>{card?.food?.name_am} · {card?.nutrients?.kcal} kcal · 1 {card?.food?.portion_unit}</small>
                  <i style={{ width: `${percent}%` }} />
                </span>
                <em>{percent}%</em>
              </button>
            );
          })}
          {selectedDetail && (
            <button type="button" className="macro-link" onClick={() => setNutritionOpen(true)}>
              {selectedDetail.nutrients.kcal} kcal · P {selectedDetail.nutrients.protein_g} g · C {selectedDetail.nutrients.carbs_g} g · F {selectedDetail.nutrients.fat_g} g
              <span>Nutrition</span>
            </button>
          )}
          {screen === "results" && picked && (
            <button type="button" className="btn btn-primary w-100" onClick={() => setScreen("portion")}>Continue with {picked.name}</button>
          )}
          <button type="button" className={screen === "low" ? "btn btn-primary w-100" : "btn btn-ghost w-100 mt-2"} onClick={() => { setScreen("search"); searchFoods(); }}>
            <i className="bi bi-search" /> {screen === "low" ? "Search food manually" : "Not right? Search manually"}
          </button>
          {screen === "low" && (
            <div className="pair-actions mt-2">
              <button type="button" onClick={() => setSheet(true)}><i className="bi bi-camera" /> Retake photo</button>
              <button type="button" className="soft" disabled={!guesses[0]} onClick={() => guesses[0] && chooseFood(guesses[0], guesses[0].confidence)}>Use {guesses[0]?.name}</button>
            </div>
          )}
          <p className="fine">Confidence threshold for an automatic match: 60%.</p>
        </div>
      )}

      {screen === "search" && (
        <form onSubmit={searchFoods}>
          <header className="consult-top">
            <button type="button" className="icon-btn" onClick={() => setScreen(low ? "low" : "results")} aria-label="Back"><i className="bi bi-arrow-left" /></button>
            <div><h1>Search food</h1><p>Mesob food database</p></div>
          </header>
          <label className="search-line">
            <i className="bi bi-search" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search injera, shiro, misir" />
          </label>
          <div className="reason-row">
            {[["all", "All"], ["fasting", "Fasting"], ["low", "Low glycemic"], ["lunch", "Lunch"]].map(([id, label]) => (
              <button key={id} type="button" className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
          {guesses[0] && <p className="sample-note">From your photo: {guesses.slice(0, 2).map((guess) => `${guess.name} ${Math.round(guess.confidence * 100)}%`).join(", ")}</p>}
          <p className="group-label">{visibleFoods.length} results{query ? ` for “${query}”` : ""}</p>
          {visibleFoods.map((food) => (
            <article key={food.id} className="log-row">
              <b>{food.name_en.slice(0, 1)}</b>
              <span>
                <strong>{food.name_en} {food.is_fasting_ok && <em className="fast-tag">Fasting</em>}</strong>
                <small>{food.name_am} · 1 {food.portion_unit} · {food.cost_birr} Br</small>
              </span>
              <button type="button" className="kcal-add" onClick={() => chooseFood(food, null)}>{food.kcal}<small>kcal</small></button>
            </article>
          ))}
          <p className="fine">Only foods already in the database can be logged.</p>
        </form>
      )}

      {screen === "portion" && picked && (
        <div>
          <header className="consult-top">
            <button type="button" className="icon-btn" onClick={() => setScreen(low ? "low" : "results")} aria-label="Back"><i className="bi bi-arrow-left" /></button>
            <h1>Portion size</h1>
          </header>
          <article className="log-row">
            <b>{picked.name.slice(0, 1)}</b>
            <span><strong>{picked.name}</strong><small>{popup?.food?.name_am} · 1 {popup?.food?.portion_unit}</small></span>
            {picked.confidence != null && <em className="fast-tag">{Math.round(picked.confidence * 100)}% match</em>}
          </article>
          <div className="size-row">
            {SIZES.map(([label, value]) => (
              <button key={label} type="button" className={portions === value ? "on" : ""} onClick={() => setPortions(value)}>
                <strong>{label}</strong>
                <small>{value}×</small>
                <em>{popup ? Math.round(Number(popup.food.kcal) * value) : ""} kcal</em>
              </button>
            ))}
          </div>
          {popup?.suitability && <p className="sample-note">{popup.suitability}</p>}
          {extra && (
            <label className="extra-row">
              <span><strong>Also log {guesses[1].name}</strong><small>1 {extra.food.portion_unit} · {extra.nutrients.kcal} kcal</small></span>
              <input type="checkbox" checked={extraOn} onChange={(event) => setExtraOn(event.target.checked)} />
            </label>
          )}
          {popup && (
            <article className="total-card">
              <span>Total for this meal</span>
              <strong>{Math.round(popup.nutrients.kcal + (extraOn && extra ? extra.nutrients.kcal : 0))}</strong>
              <small>kcal · {picked.name}{extraOn && extra ? ` + ${guesses[1].name}` : ""}</small>
              <div>
                <em>Protein<b>{popup.nutrients.protein_g} g</b></em>
                <em>Carbs<b>{popup.nutrients.carbs_g} g</b></em>
                <em>Fat<b>{popup.nutrients.fat_g} g</b></em>
              </div>
            </article>
          )}
          <button type="button" className="btn btn-primary w-100" disabled={!popup} onClick={() => setScreen("confirm")}>Continue</button>
        </div>
      )}

      {screen === "confirm" && popup && (
        <div>
          <header className="consult-top">
            <button type="button" className="icon-btn" onClick={() => setScreen("portion")} aria-label="Back"><i className="bi bi-arrow-left" /></button>
            <h1>Confirm and log</h1>
          </header>
          <article className="consult-card">
            <strong>{picked.name}</strong>
            <p className="fine mb-0">{portions} × {popup.food.portion_unit} · {popup.nutrients.kcal} kcal · {popup.food.glycemic_level} glycemic</p>
          </article>
          <p className="group-label">Meal label</p>
          <div className="reason-row">
            {MEALS.map((item) => (
              <button key={item} type="button" className={meal === item ? "on" : ""} onClick={() => setMeal(item)}>{item}</button>
            ))}
          </div>
          <p className="fine">The log is saved at the current time. The meal label is for this screen only.</p>
          {logs?.targets && (
            <article className="consult-card">
              <h2>Today after logging</h2>
              <p>Eaten so far {Math.round(logs.totals?.kcal || 0)} kcal</p>
              <p>This meal +{popup.nutrients.kcal} kcal</p>
              <p>Remaining {Math.max(0, Math.round((logs.targets.kcal || 0) - (logs.totals?.kcal || 0) - popup.nutrients.kcal))} of {Math.round(logs.targets.kcal)} kcal</p>
            </article>
          )}
          <button type="button" className="btn btn-primary w-100" onClick={confirmLog}>Log {meal} · {popup.nutrients.kcal} kcal</button>
        </div>
      )}

      {screen === "success" && logged && (
        <div className="sent">
          <button type="button" className="icon-btn" onClick={() => setScreen("home")} aria-label="Close"><i className="bi bi-x-lg" /></button>
          <div className="sent-mark"><i className="bi bi-check-lg" /></div>
          <h2>{logged.meal[0].toUpperCase()}{logged.meal.slice(1)} logged</h2>
          <p>{logged.food} · {logged.kcal} kcal added at {clock()}</p>
          <article className="consult-card today-after">
            <div className="d-flex justify-content-between"><strong>Today</strong><Link to="/dashboard">Dashboard</Link></div>
            <p className="kcal-big">{Math.round(logged.day.totals.kcal)}<small>of {Math.round(logged.day.targets.kcal)} kcal</small></p>
            {["protein_g", "carbs_g", "fat_g"].map((key) => {
              const label = key.replace("_g", "");
              const width = logged.day.targets[key] ? Math.min(100, (logged.day.totals[key] / logged.day.targets[key]) * 100) : 0;
              return (
                <div key={key} className="mb-2">
                  <div className="d-flex justify-content-between fine"><span>{label}</span><span>{Math.round(logged.day.totals[key])} / {Math.round(logged.day.targets[key])} g</span></div>
                  <div className="macro-line"><span style={{ width: `${width}%` }} /></div>
                </div>
              );
            })}
            <p className="fine mb-0">{Math.max(0, Math.round(logged.day.targets.kcal - logged.day.totals.kcal))} kcal left today.</p>
          </article>
          <div className="pair-actions">
            <button type="button" onClick={() => setSheet(true)}>Scan another</button>
            <button type="button" className="btn btn-primary" onClick={() => setScreen("home")}>Done</button>
          </div>
        </div>
      )}

      {screen === "error" && problem && (
        <div className="subpage">
          <button type="button" className="icon-btn" onClick={() => setScreen("home")} aria-label="Close"><i className="bi bi-x-lg" /></button>
          <div className="deny-mark"><i className="bi bi-file-earmark-x" /></div>
          <h2>We couldn't use this file</h2>
          <p>Photos must be JPEG or PNG and 5 MB or smaller.</p>
          <article className="consult-card">
            <strong>{problem.name}</strong>
            <p>{problem.detail}</p>
            <em className="fast-tag">{problem.reason}</em>
          </article>
          <button type="button" className="btn btn-primary w-100" onClick={() => fileRef.current?.click()}>Choose another photo</button>
          <button type="button" className="btn btn-ghost w-100 mt-2" onClick={openCamera}>Take a photo</button>
        </div>
      )}

      {sheet && (
        <div className="sheet-back" role="dialog" aria-label="Add a photo">
          <article>
            <header><h2>Add a photo of your meal</h2><button type="button" onClick={() => setSheet(false)} aria-label="Close"><i className="bi bi-x-lg" /></button></header>
            <p className="fine">We'll match it to a dish in the food database. You confirm the food before it is logged.</p>
            <button type="button" className="choice" onClick={openCamera}><i className="bi bi-camera" /><span><strong>Take a photo</strong><small>Use your camera</small></span></button>
            <button type="button" className="choice" onClick={() => fileRef.current?.click()}><i className="bi bi-image" /><span><strong>Choose from gallery</strong><small>JPEG or PNG, up to 5 MB</small></span></button>
            <button type="button" className="btn btn-ghost w-100" onClick={async () => { setSheet(false); recognize(await fileFromCanvas("injera.png")); }}>Demo: injera.png</button>
            <button type="button" className="btn btn-ghost w-100 mt-2" onClick={async () => { setSheet(false); recognize(await fileFromCanvas("unknown-photo.png")); }}>Demo: uncertain photo</button>
          </article>
        </div>
      )}

      {nutritionOpen && selectedDetail && (
        <div className="sheet-back" role="dialog" aria-label="Nutrition">
          <article>
            <header>
              <div><strong>{selectedDetail.food.name_en}</strong><small>{selectedDetail.food.name_am} · 1 {selectedDetail.food.portion_unit}</small></div>
              <em>{selectedDetail.nutrients.kcal}<small>kcal</small></em>
            </header>
            <div className="macro-pills">
              <span>Protein<b>{selectedDetail.nutrients.protein_g} g</b></span>
              <span>Carbs<b>{selectedDetail.nutrients.carbs_g} g</b></span>
              <span>Fat<b>{selectedDetail.nutrients.fat_g} g</b></span>
              <span>Cost<b>{selectedDetail.food.cost_birr} Br</b></span>
            </div>
            <p>Glycemic level: {selectedDetail.food.glycemic_level || "not set"}.</p>
            {selectedDetail.food.ingredients?.length > 0 && <p>Ingredients: {selectedDetail.food.ingredients.join(", ")}.</p>}
            {selectedDetail.suitability && <p className="sample-note">{selectedDetail.suitability}</p>}
            <p className="fine">{selectedDetail.impact}</p>
            <div className="pair-actions">
              <button type="button" onClick={() => setNutritionOpen(false)}>Close</button>
              <button type="button" className="btn btn-primary" onClick={() => { setNutritionOpen(false); setScreen("portion"); }}>Log this meal</button>
            </div>
          </article>
        </div>
      )}

      <input ref={fileRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/heic,image/*" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) stageFile(file); }} />
    </section>
  );
}
