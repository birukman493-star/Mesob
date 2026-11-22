import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./Landing.css";

const IC =
  "data:image/jpeg;base64,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";

const PL =
  "data:image/jpeg;base64,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";

const D = ["M", "T", "W", "T", "F", "S", "S"];
const S = [
  [
    ["Breakfast", "Ful with egg", 420],
    ["Lunch", "Shiro & injera", 580],
    ["Dinner", "Misir wat & gomen", 440],
  ],
  [
    ["Breakfast", "Genfo & honey", 380],
    ["Lunch", "Atkilt wat & injera", 520],
    ["Dinner", "Beyaynetu", 610],
  ],
  [
    ["Breakfast", "Firfir with egg", 450],
    ["Lunch", "Lentil soup & bread", 470],
    ["Dinner", "Chicken stew & salad", 560],
  ],
];

const phrases = [
  { text: "ኢትዮጵያዊ ምግብ ይመገቡ።\nእያንዳንዱን ጉርሻ ይወቁ።", lang: "am" },
  { text: "Eat Ethiopian. Know every bite.", lang: "en" },
  { text: "Nyaata Itoophiyaa nyaadhu. Waan nyaattu hunda beeki.", lang: "om" },
];

export default function Landing() {
  const navigate = useNavigate();

  // Typewriter state
  const [typedText, setTypedText] = useState(phrases[0].text);
  const typingTimerRef = useRef(null);

  // Phone live calorie counter
  const [calories, setCalories] = useState("1,240");

  // Meal plan state
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [mealFade, setMealFade] = useState(false);

  // Chat animation state
  const [chatMessages, setChatMessages] = useState([]);
  const chatRef = useRef(null);
  const chatStartedRef = useRef(false);

  // Header scroll shadow state
  const [headerShadow, setHeaderShadow] = useState(false);
  const [activeNav, setActiveNav] = useState("home");

  // Steps animation state
  const [stepsIn, setStepsIn] = useState(false);
  const stepsRef = useRef(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("reg"); // 'reg' or 'in'
  const [modalDone, setModalDone] = useState(false);
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [okTitle, setOkTitle] = useState("");
  const [okDesc, setOkDesc] = useState("");

  const nameInputRef = useRef(null);

  // Typewriter loop
  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setTypedText(phrases[0].text);
      return;
    }

    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const tick = () => {
      const chars = Array.from(phrases[phraseIndex].text);
      setTypedText(chars.slice(0, charIndex).join(""));

      if (!deleting && charIndex < chars.length) {
        charIndex++;
        typingTimerRef.current = setTimeout(tick, 78);
      } else if (!deleting) {
        deleting = true;
        typingTimerRef.current = setTimeout(tick, 1900);
      } else if (charIndex > 0) {
        charIndex--;
        typingTimerRef.current = setTimeout(tick, 34);
      } else {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typingTimerRef.current = setTimeout(tick, 320);
      }
    };

    setTypedText("");
    typingTimerRef.current = setTimeout(tick, 200);

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  // Calorie ring counter loop
  useEffect(() => {
    let animId;
    const updateCalories = (t) => {
      const k = Math.min(1, (t % 6000) / 3600);
      const val = Math.round(1240 * (1 - Math.pow(1 - k, 3)));
      setCalories(val.toLocaleString("en-US"));
      animId = requestAnimationFrame(updateCalories);
    };
    animId = requestAnimationFrame(updateCalories);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Meal plan auto-rotator
  useEffect(() => {
    const timer = setInterval(() => {
      setMealFade(true);
      setTimeout(() => {
        setActiveDayIndex((prev) => (prev + 1) % 7);
        setMealFade(false);
      }, 250);
    }, 2200);

    return () => clearInterval(timer);
  }, []);

  // Chat simulation runner
  const runChat = useCallback(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    while (true) {
      setChatMessages([]);
      await sleep(600);

      // User message
      setChatMessages([
        { id: 1, type: "u", text: "Can I eat injera if I have diabetes?" },
      ]);
      await sleep(700);

      // Assistant thinking dots
      setChatMessages([
        { id: 1, type: "u", text: "Can I eat injera if I have diabetes?" },
        { id: 2, type: "a", dots: true, text: "" },
      ]);
      await sleep(1100);

      // Assistant stream words
      const full =
        "Yes, in moderation. Injera is made from teff, which has fiber. Keep to about one piece per meal and pair it with shiro and gomen.";
      const words = full.split(" ");
      let curr = "";

      for (const w of words) {
        curr = curr ? curr + " " + w : w;
        setChatMessages([
          { id: 1, type: "u", text: "Can I eat injera if I have diabetes?" },
          { id: 2, type: "a", dots: false, text: curr },
        ]);
        await sleep(60);
      }

      await sleep(4200);
    }
  }, []);

  // IntersectionObserver for chat and steps
  useEffect(() => {
    if (!chatRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !chatStartedRef.current) {
            chatStartedRef.current = true;
            runChat();
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(chatRef.current);
    return () => observer.disconnect();
  }, [runChat]);

  // Steps observer
  useEffect(() => {
    if (!stepsRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setStepsIn(true);
          }
        });
      },
      { threshold: 0.4 }
    );
    observer.observe(stepsRef.current);
    return () => observer.disconnect();
  }, []);

  // Scroll listener for sticky header and nav highlight
  useEffect(() => {
    const onScroll = () => {
      setHeaderShadow(window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const sections = ["home", "about", "features"];
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setActiveNav(e.target.id);
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) sectionObserver.observe(el);
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      sectionObserver.disconnect();
    };
  }, []);

  // Reveal elements on scroll
  useEffect(() => {
    const revealEls = document.querySelectorAll(".landing-rv");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
            setTimeout(() => e.target.classList.remove("landing-rv"), 1200);
          }
        });
      },
      { threshold: 0.15 }
    );

    revealEls.forEach((el, i) => {
      el.style.transitionDelay = (i % 3) * 90 + "ms";
      io.observe(el);
    });

    return () => io.disconnect();
  }, []);

  // Modal open / close handlers
  const openModal = (mode = "reg") => {
    setModalMode(mode);
    setModalDone(false);
    setErrorMsg("");
    setModalOpen(true);
    setTimeout(() => {
      if (nameInputRef.current) nameInputRef.current.focus();
    }, 50);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  // Close modal on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Form submit in modal
  const handleFormSubmit = (e) => {
    e.preventDefault();
    const n = fullName.trim();
    const a = parseInt(age, 10);
    const p = pin.trim();

    if (n.length < 2) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!(a >= 1 && a <= 120)) {
      setErrorMsg("Please enter a valid age.");
      return;
    }
    if (!/^\d{4,6}$/.test(p)) {
      setErrorMsg("Your PIN must be 4 to 6 digits.");
      return;
    }

    setErrorMsg("");
    const firstName = n.split(" ")[0];
    setOkTitle(
      (modalMode === "reg" ? "Welcome, " : "Welcome back, ") + firstName + "!"
    );
    setOkDesc(
      modalMode === "reg"
        ? "Your 15-day free trial has started. Let’s set up your profile."
        : "Good to see you again. Your day is ready."
    );
    setModalDone(true);
  };

  const handleContinue = () => {
    closeModal();
    if (modalMode === "reg") {
      navigate("/register");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="landing-page">
      {/* Pattern Ribbon */}
      <div className="landing-tb" aria-hidden="true"></div>

      {/* Sticky Header */}
      <header id="hd" className={`landing-header ${headerShadow ? "s" : ""}`}>
        <a className="landing-brand" href="#home">
          <img src={IC} alt="Mesob AI logo" />
          Mesob AI
        </a>
        <nav className="landing-nav" aria-label="Main">
          <a
            href="#home"
            className={activeNav === "home" ? "on" : ""}
            onClick={() => setActiveNav("home")}
          >
            Home
          </a>
          <a
            href="#about"
            className={activeNav === "about" ? "on" : ""}
            onClick={() => setActiveNav("about")}
          >
            About
          </a>
          <a
            href="#features"
            className={activeNav === "features" ? "on" : ""}
            onClick={() => setActiveNav("features")}
          >
            Features
          </a>
        </nav>
        <div className="landing-acts">
          <button
            className="landing-btn gh sm"
            onClick={() => openModal("in")}
          >
            Sign in
          </button>
          <button
            className="landing-btn sm"
            onClick={() => openModal("reg")}
          >
            Register now
          </button>
        </div>
      </header>

      <main className="landing-main">
        {/* HERO SECTION */}
        <section id="home" className="landing-hero">
          <div>
            <div className="landing-hl">
              <div
                className="landing-am landing-typewriter"
                id="heroTyping"
                aria-label="Eat Ethiopian. Know every bite."
              >
                {typedText}
              </div>
            </div>
            <p className="landing-sub">
              Personal meal plans, food scanning and an AI nutrition assistant,
              built around injera, shiro and the foods you love.
            </p>
            <div className="landing-cta">
              <button
                className="landing-btn lg"
                onClick={() => openModal("reg")}
              >
                Register now
              </button>
              <button
                className="landing-btn gh lg"
                onClick={() => openModal("in")}
              >
                Sign in
              </button>
            </div>
            <p className="landing-fine">
              15-day free trial · አማርኛ · English · Afaan Oromoo
            </p>
          </div>

          {/* Interactive Phone Mockup */}
          <div className="landing-stage" aria-label="Preview of the Mesob AI app">
            <div className="landing-phone">
              <div className="landing-pt">
                <b>Today</b>
                <span className="landing-pill">On track</span>
              </div>
              <div className="landing-pc">
                <div className="landing-rg">
                  <svg viewBox="0 0 120 120" aria-hidden="true">
                    <g transform="rotate(-90 60 60)">
                      <circle className="landing-trk" cx="60" cy="60" r="50" />
                      <circle
                        className="landing-ring"
                        pathLength="100"
                        cx="60"
                        cy="60"
                        r="50"
                      />
                    </g>
                  </svg>
                  <div>
                    <b id="pk">{calories}</b>
                    <small>of 1,850</small>
                  </div>
                </div>
                <div className="landing-mb">
                  <i style={{ "--w": "70%", "--c": "#31572c" }}></i>
                  <i style={{ "--w": "66%", "--c": "#4f772d" }}></i>
                  <i style={{ "--w": "45%", "--c": "#90a955" }}></i>
                </div>
              </div>

              <div className="landing-pimg">
                <img src={PL} alt="Misir wat on injera" />
                <span className="landing-sl"></span>
                <span className="landing-tg landing-g1">Misir wat · 97%</span>
                <span className="landing-tg landing-g2">Gomen · 91%</span>
              </div>

              <div className="landing-prow">
                <span>Dinner · Misir wat &amp; gomen</span>
                <b>440</b>
              </div>
            </div>

            {/* Floating Badges */}
            <div className="landing-fl landing-f1">
              <span className="landing-ck">✓</span>Dinner logged · 440 kcal
            </div>
            <div className="landing-fl landing-f2">
              Yes, in moderation. Keep to one injera per meal and add gomen.
            </div>
            <div className="landing-fl landing-f3">
              Water 1.5 / 2.5 L
              <div className="landing-wb">
                <i></i>
              </div>
            </div>
            <div className="landing-fl landing-f4">Fasting-friendly</div>
          </div>
        </section>

        {/* ABOUT SECTION */}
        <section id="about" className="landing-band">
          <div>
            <div className="landing-two">
              <div className="landing-rv">
                <h2>Nutrition that starts at the mesob</h2>
                <p style={{ marginTop: "14px", fontSize: "1.06rem" }}>
                  A mesob is the woven basket Ethiopian meals are shared from.
                  Mesob AI was built so the food on that table is understood,
                  from injera and shiro to doro wat and kitfo, not squeezed into
                  generic diet advice.
                </p>
                <div className="landing-vals">
                  <span>Made for Ethiopia</span>
                  <span>Three languages</span>
                  <span>Fasting-friendly</span>
                  <span>Works offline</span>
                </div>
              </div>

              <div
                className={`landing-steps landing-rv ${stepsIn ? "in" : ""}`}
                id="st"
                ref={stepsRef}
              >
                <div className="landing-step">
                  <h3>Snap your plate</h3>
                  <p>Take a photo or search from our list of local dishes.</p>
                </div>
                <div className="landing-step">
                  <h3>AI understands it</h3>
                  <p>
                    Mesob AI finds each dish and estimates portion, calories
                    and nutrients.
                  </p>
                </div>
                <div className="landing-step">
                  <h3>Eat with confidence</h3>
                  <p>
                    Get meal plans and answers that fit your health, budget
                    and fasting days.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES SECTION */}
        <section id="features">
          <div className="landing-rv" style={{ maxWidth: "640px" }}>
            <h2>Everything your plate needs</h2>
            <p style={{ marginTop: "12px", fontSize: "1.06rem" }}>
              One calm app for scanning, planning and understanding Ethiopian
              food.
            </p>
          </div>

          {/* Feature 1: Food scanner */}
          <div className="landing-fr landing-rv">
            <div>
              <small>Food scanner</small>
              <h2
                style={{
                  fontSize: "clamp(1.6rem,3vw,2.2rem)",
                  marginTop: "6px",
                }}
              >
                Point, snap, know
              </h2>
              <p>
                Photograph your meal and Mesob AI recognises the dishes on the
                plate in seconds, then logs calories, protein, carbs and fat for
                you.
              </p>
            </div>
            <div className="landing-shot">
              <div className="landing-pimg">
                <img src={PL} alt="Plate being scanned" />
                <span className="landing-sl"></span>
                <span className="landing-tg landing-g1">Misir wat · 97%</span>
                <span className="landing-tg landing-g2">Gomen · 91%</span>
              </div>
              <div className="landing-res">
                <span>
                  <b>Misir wat on injera</b> · 440 kcal
                </span>
                <i></i>
              </div>
            </div>
          </div>

          {/* Feature 2: Meal plans */}
          <div className="landing-fr landing-rev landing-rv">
            <div>
              <small>Meal plans</small>
              <h2
                style={{
                  fontSize: "clamp(1.6rem,3vw,2.2rem)",
                  marginTop: "6px",
                }}
              >
                A week of food you actually eat
              </h2>
              <p>
                Plans built around Ethiopian meals, your budget in birr,
                fasting days and dietary needs. Swap any meal with one tap.
              </p>
            </div>
            <div className="landing-shot">
              <div className="landing-wd" id="wd">
                {D.map((d, i) => (
                  <b
                    key={i}
                    className={i === activeDayIndex ? "on" : ""}
                    onClick={() => setActiveDayIndex(i)}
                  >
                    {d}
                  </b>
                ))}
              </div>
              <div className={`landing-ml ${mealFade ? "o" : ""}`} id="ml">
                {S[activeDayIndex % 3].map((r, idx) => (
                  <div key={idx}>
                    <span>
                      <small>{r[0]}</small>
                      <b>{r[1]}</b>
                    </span>
                    <b>{r[2]} kcal</b>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature 3: AI assistant */}
          <div className="landing-fr landing-rv">
            <div>
              <small>AI assistant</small>
              <h2
                style={{
                  fontSize: "clamp(1.6rem,3vw,2.2rem)",
                  marginTop: "6px",
                }}
              >
                Ask in your own language
              </h2>
              <p>
                Questions about injera and diabetes, fasting-day meals or
                dinner under 600 kcal. Get clear answers in Amharic, Afaan
                Oromo or English.
              </p>
            </div>
            <div className="landing-shot">
              <div className="landing-chat" id="ch" ref={chatRef}>
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`landing-bb ${msg.type}`}>
                    {msg.dots ? (
                      <div className="landing-dots">
                        <i></i>
                        <i></i>
                        <i></i>
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 6 Grid Cards */}
          <div className="landing-grid">
            <div className="landing-card landing-rv">
              <h3>Daily tracking</h3>
              <p>Calories, macros, water and weight in one clear view.</p>
            </div>
            <div className="landing-card landing-rv">
              <h3>Diabetes guidance</h3>
              <p>
                Food tips that help keep blood sugar steadier with local meals.
              </p>
            </div>
            <div className="landing-card landing-rv">
              <h3>Fasting support</h3>
              <p>
                Plant-based plans for Tsom days that still reach your protein.
              </p>
            </div>
            <div className="landing-card landing-rv">
              <h3>Budget meals</h3>
              <p>Balanced options that fit the birr you plan to spend.</p>
            </div>
            <div className="landing-card landing-rv">
              <h3>Allergies and diets</h3>
              <p>Tell us what to avoid and every suggestion respects it.</p>
            </div>
            <div className="landing-card landing-rv">
              <h3>Offline logging</h3>
              <p>Log meals without data. Everything syncs when you reconnect.</p>
            </div>
          </div>
        </section>

        {/* END CTA BANNER */}
        <section className="landing-end landing-rv">
          <h2>Eat well, the Ethiopian way</h2>
          <p>
            Start your 15-day free trial. No email needed, just your name, age
            and a PIN.
          </p>
          <div
            className="landing-cta"
            style={{ justifyContent: "center", opacity: 1, animation: "none" }}
          >
            <button
              className="landing-btn lg"
              onClick={() => openModal("reg")}
            >
              Register now
            </button>
            <button
              className="landing-btn gh lg"
              onClick={() => openModal("in")}
            >
              Sign in
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <span>© 2026 Mesob AI · መሶብ AI</span>
        <span>Mesob AI gives guidance, not a medical diagnosis.</span>
      </footer>

      {/* Bottom Pattern Ribbon */}
      <div className="landing-tb" aria-hidden="true"></div>

      {/* Auth Modal */}
      <div
        className={`landing-md ${modalOpen ? "on" : ""}`}
        id="md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mt"
        onClick={(e) => {
          if (e.target.id === "md") closeModal();
        }}
      >
        <div className={`landing-box ${modalDone ? "done" : ""}`} id="bx">
          <button
            className="landing-x"
            id="mx"
            aria-label="Close"
            onClick={closeModal}
          >
            ✕
          </button>
          <h2 id="mt" style={{ fontSize: "1.5rem" }}>
            {modalMode === "reg" ? "Create your account" : "Welcome back"}
          </h2>
          <p id="ms" style={{ marginTop: "4px", fontSize: "0.92rem" }}>
            {modalMode === "reg"
              ? "No email needed. Just your name, age and a PIN."
              : "Log in with your name, age and PIN."}
          </p>
          <div className="landing-tabs">
            <button
              className={modalMode === "reg" ? "on" : ""}
              onClick={() => {
                setModalMode("reg");
                setErrorMsg("");
              }}
            >
              Register
            </button>
            <button
              className={modalMode === "in" ? "on" : ""}
              onClick={() => {
                setModalMode("in");
                setErrorMsg("");
              }}
            >
              Sign in
            </button>
          </div>

          <form id="fm" noValidate onSubmit={handleFormSubmit}>
            <label className="landing-label" htmlFor="nm">
              Full name
            </label>
            <input
              id="nm"
              className="landing-input"
              ref={nameInputRef}
              autoComplete="name"
              placeholder="Hanna Tesfaye"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <div className="landing-row2">
              <div>
                <label className="landing-label" htmlFor="ag">
                  Age
                </label>
                <input
                  id="ag"
                  className="landing-input"
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="34"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
              <div>
                <label className="landing-label" htmlFor="pn">
                  4 to 6 digit PIN
                </label>
                <input
                  id="pn"
                  className="landing-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </div>
            </div>
            <div className="landing-err" id="er" role="alert">
              {errorMsg}
            </div>
            <button
              className="landing-btn"
              style={{ width: "100%", marginTop: "6px" }}
              id="sb"
              type="submit"
            >
              {modalMode === "reg" ? "Create account" : "Sign in"}
            </button>
          </form>

          {/* Success confirmation */}
          <div className="landing-okv">
            <svg viewBox="0 0 76 76">
              <circle pathLength="100" cx="38" cy="38" r="33" />
              <path pathLength="100" d="M24 39 L34 49 L53 28" />
            </svg>
            <h2 id="ot" style={{ fontSize: "1.4rem" }}>
              {okTitle}
            </h2>
            <p id="oc" style={{ margin: "6px 0 18px" }}>
              {okDesc}
            </p>
            <button
              className="landing-btn"
              id="oo"
              onClick={handleContinue}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
