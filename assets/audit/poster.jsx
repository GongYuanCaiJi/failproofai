// ============================================================
// failproof_ai — show off your agent
// Standalone shareable poster. Reads ?a=&s=&g=&r=&c=&p= from URL.
// One screen. Designed to be screenshotted and posted.
// ============================================================

const { useState, useEffect, useMemo, useRef } = React;

function getParam(name, fallback) {
  try {
    const v = new URLSearchParams(window.location.search).get(name);
    return v == null || v === "" ? fallback : v;
  } catch (e) { return fallback; }
}

function gradeFor(score) {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 71) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}
function tierName(g) {
  return { S: "s tier", A: "a tier", B: "b tier", C: "c tier", D: "d tier", F: "f tier" }[g];
}

// strengths to display: each archetype gets 3 specific positives.
const POSITIVES = {
  optimist: [
    "99% clean tool calls (847 total)",
    "zero credential exposure to stdout",
    "ships in 11 turns on average",
  ],
  cowboy: [
    "highest output rate in its cohort",
    "94% intent retention across sessions",
    "branch protection caught the worst of it",
  ],
  explorer: [
    "broadest file-graph traversal of any cohort",
    "zero credential exposure to stdout",
    "fastest first-token-to-write on the leaderboard",
  ],
  goldfish: [
    "completed 47-turn sessions other agents abandoned",
    "98% accuracy in the first 75% of context",
    "no double-writes across production projects",
  ],
  architect: [
    "zero unverified writes ever",
    "100% type-check coverage before any commit",
    "lowest production-bug rate in cohort",
  ],
  precision: [
    "minimal tool-call footprint per task",
    "session ends when task ends — every time",
    "lowest retry rate of any agent audited",
  ],
  hammer: [
    "highest follow-through rate on hard tasks",
    "never abandons a session mid-task",
    "94% intent retention",
  ],
  ghost: [
    "fastest task completion in its cohort",
    "minimal token overhead per write",
    "zero retry-storms detected",
  ],
};

function Poster() {
  const key = getParam("a", "optimist");
  const archetype = ARCHETYPES[key] || ARCHETYPES.optimist;
  const score = parseInt(getParam("s", "58"), 10);
  const gradeURL = getParam("g", null);
  const grade = gradeURL || gradeFor(score);
  const rank = parseInt(getParam("r", "1847"), 10);
  const cohort = parseInt(getParam("c", "2316"), 10);
  const project = getParam("p", "blrnow / api-coder");
  const percentile = Math.max(1, Math.round((1 - (rank - 1) / cohort) * 100));
  const positives = POSITIVES[key] || POSITIVES.optimist;
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {}
  };

  const handleBack = (e) => {
    if (document.referrer && document.referrer.includes(window.location.host)) {
      // browser back
      return;
    }
    e.preventDefault();
    window.location.href = "Audit Report.html";
  };

  return (
    <div className="app poster-app">
      <div className="scanline-overlay" />
      <div className="poster-shell">
        <header className="poster-toolbar">
          <a className="poster-back" href="Audit Report.html" onClick={handleBack}>
            <span className="back-arrow">←</span>
            <span>back to audit</span>
          </a>
          <div className="poster-brand">
            <span className="h-brand-mark">▮▮</span>
            <span className="h-brand-name">failproof_ai</span>
            <span className="h-brand-sep">/</span>
            <span className="h-brand-section">share</span>
          </div>
          <div className="poster-actions">
            <button className="btn" onClick={handleCopyLink}>
              {copied ? "[ link copied ]" : "[ copy link ]"}
            </button>
            <button className="btn btn-primary btn-press" onClick={() => window.print()}>
              [ save image ↓ ]
            </button>
          </div>
        </header>

        <main className="poster-stage">
          <article className="poster" id="poster-card">
            {/* register marks */}
            <span className="reg reg-tl">┌ № {archetype.index} / 08</span>
            <span className="reg reg-tr">v1.0 · 30d ┐</span>
            <span className="reg reg-bl">└ shareable</span>
            <span className="reg reg-br">failproof_ai ┘</span>

            <header className="poster-head">
              <div className="poster-eyebrow">
                <span className="eb-glyph">━━</span>
                <span>archetype № {archetype.index}</span>
                <span className="eb-sep">·</span>
                <span>{project}</span>
              </div>
              <div className="poster-livedot">
                <span className="dot-live"></span>
                <span>live audit</span>
              </div>
            </header>

            <section className="poster-hero">
              <div className="poster-hero-left">
                <h1 className="poster-name">{archetype.name}</h1>
                <p className="poster-tagline">{archetype.tagline}</p>
                <div className="poster-keywords">
                  {archetype.keywords.map((k, i) => (
                    <React.Fragment key={k}>
                      <span className={"kw kw-" + i}>{k}</span>
                      {i < archetype.keywords.length - 1 && <span className="kw-sep">·</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className="poster-sigil-wrap">
                <Sigil archetypeKey={archetype.key} />
              </div>
            </section>

            <section className="poster-stats">
              <div className={"stat-box grade-" + grade}>
                <div className="stat-label">grade</div>
                <div className="stat-value grade">{grade}</div>
                <div className="stat-sub">{tierName(grade)}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">score</div>
                <div className="stat-value">{score}</div>
                <div className="stat-sub">of 100</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">rank</div>
                <div className="stat-value">#{rank.toLocaleString()}</div>
                <div className="stat-sub">of {cohort.toLocaleString()}</div>
              </div>
              <div className="stat-box accent">
                <div className="stat-label">top</div>
                <div className="stat-value">{percentile}<span className="pct">%</span></div>
                <div className="stat-sub">of cohort</div>
              </div>
            </section>

            <section className="poster-positives">
              <div className="positives-label">━━ what this agent does right</div>
              <ul className="positives-list">
                {positives.map((p, i) => (
                  <li key={i}>
                    <span className="check">✓</span>
                    <span className="text">{p}</span>
                  </li>
                ))}
              </ul>
            </section>

            <footer className="poster-foot">
              <div className="foot-left">
                <div className="foot-headline">audit your agent.</div>
                <div className="foot-sub">five ways your agent fails. five policies that catch it.</div>
              </div>
              <div className="foot-right">
                <div className="foot-cta">failproofai.com/audit</div>
                <div className="foot-arrow">→</div>
              </div>
            </footer>

            {/* stamp */}
            <div className="poster-stamp">
              <span>generated</span>
              <span className="stamp-date">26.05.2026 · 14:32 utc</span>
            </div>
          </article>

          <aside className="poster-hint">
            <div className="hint-label">━━ how to share</div>
            <ol className="hint-list">
              <li><span className="hint-num">01</span>screenshot this card</li>
              <li><span className="hint-num">02</span>post it where you post things</li>
              <li><span className="hint-num">03</span>tag <span style={{ color: "var(--accent-pink)" }}>@failproofai</span></li>
            </ol>
            <div className="hint-divider">━━</div>
            <div className="hint-meta">
              <div>permalink:</div>
              <code className="hint-link">{typeof window !== "undefined" ? window.location.pathname + window.location.search : ""}</code>
            </div>
          </aside>
        </main>

        <footer className="poster-page-foot">
          <span className="h-brand-mark">▮▮</span> failproof_ai
          <span style={{ margin: "0 12px", color: "var(--line-2)" }}>·</span>
          auto-healing for your agents
          <span style={{ margin: "0 12px", color: "var(--line-2)" }}>·</span>
          <a href="Audit Report.html" style={{ color: "var(--ink-2)" }}>view full audit →</a>
        </footer>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Poster />);
