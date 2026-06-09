// ============================================================
// failproof_ai — audit report
// Personality profile for your agent. Six sections.
// ============================================================

const { useState, useEffect, useMemo } = React;

// ---------- url param helper ----------
function getParam(name, fallback) {
  try {
    const v = new URLSearchParams(window.location.search).get(name);
    return v == null || v === "" ? fallback : v;
  } catch (e) { return fallback; }
}

// ---------- defaults (tweakable via URL params or the Tweaks panel) ----------
// URL params: ?a=archetype &s=score &r=rank &c=cohort &p=project
const REPORT_DEFAULTS = /*EDITMODE-BEGIN*/{
  "archetype": getParam("a", "optimist"),
  "score": parseInt(getParam("s", "58"), 10),
  "rank": parseInt(getParam("r", "1847"), 10),
  "cohort": parseInt(getParam("c", "2316"), 10),
  "tweetVariant": "show-off",
  "showSecondary": true,
  "project": getParam("p", "blrnow / api-coder")
}/*EDITMODE-END*/;

// ---------- helpers ----------
function gradeFor(score) {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 71) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}
function projectedScore(base) {
  // every policy ~= +3.5 pts, capped at 92
  return Math.min(92, base + 21);
}
function tierName(g) {
  return { S: "s tier", A: "a tier", B: "b tier", C: "c tier", D: "d tier", F: "f tier" }[g];
}

// ---------- data ----------
const STRENGTHS = [
  {
    metric: "99%",
    unit: "clean tool calls",
    headline: "ran 847 tool calls. 8 detectors triggered.",
    detail: "99% of tool calls came back clean before today's audit.",
  },
  {
    metric: "0",
    unit: "credential leaks",
    headline: "zero credential exposure to stdout.",
    detail: "the explorer instinct never made it to output. secrets stayed secret.",
  },
  {
    metric: "11",
    unit: "avg turns / task",
    headline: "tasks complete in 11 turns on average.",
    detail: "faster than 63% of audited agents in this cohort.",
  },
  {
    metric: "0",
    unit: "double-writes",
    headline: "no double-writes across production projects.",
    detail: "the agent never overwrote a file it was mid-edit on.",
  },
  {
    metric: "94%",
    unit: "intent retention",
    headline: "stayed on the stated task in 94% of sessions.",
    detail: "rarely went off-scope on its own. focus is real.",
  },
];

const FINDINGS = [
  {
    num: "01",
    title: "prepended cd before commands",
    count: 20,
    policy: "redundant-cd",
    projects: 2,
    lastSeen: "4h ago",
    body: <>
      the agent runs <code>cd &lt;cwd&gt;</code> before commands it would have run from the
      same directory anyway. mostly harmless. occasionally it gets the path wrong and
      manufactures a new bug.
    </>,
    cost: { tokens: "~3.2k", risk: "low", radius: "high noise" },
    costLine: <>~3.2k <span className="g">tokens/day</span> burned on redundant navigation. low security risk. <span className="pk">high noise.</span></>,
    evidence: [
      { kind: "cmd", text: 'cd /Users/n/blrnow/api && pnpm test' },
      { kind: "comment", text: '# already in /Users/n/blrnow/api' },
      { kind: "cmd", text: 'cd /Users/n/blrnow/api && git status' },
      { kind: "comment", text: '# still already there.' },
    ],
    fix: {
      slug: "no-redundant-cd",
      desc: "rejects cd prefixes when the agent's cwd already matches the target.",
      install: "failproof policy add no-redundant-cd",
    },
  },
  {
    num: "02",
    title: "pushed to main without a branch",
    count: 7,
    policy: "block-push-master",
    projects: 1,
    lastSeen: "1d ago",
    body: <>
      seven attempts to push directly to <code>main</code>. branch protection caught four of
      them. the other three landed. the agent did not author a rollback.
    </>,
    cost: { tokens: "—", risk: "high", radius: "production" },
    costLine: <>7 attempts. <span className="g">branch protection saved you 4 times.</span> the other <span className="pk">3 merged.</span></>,
    evidence: [
      { kind: "cmd", text: 'git push origin main' },
      { kind: "err", text: '! remote: protected branch' },
      { kind: "cmd", text: 'git push origin main --force' },
      { kind: "err", text: '! remote: protected branch' },
      { kind: "cmd", text: 'git push origin HEAD:main' },
      { kind: "comment", text: '# fast-forward. merged.' },
    ],
    fix: {
      slug: "block-push-master",
      desc: "intercepts push-to-main attempts; requires a branch + PR.",
      install: "failproof policy add block-push-master",
    },
  },
  {
    num: "03",
    title: "read outside the project root",
    count: 4,
    policy: "block-read-outside-cwd",
    projects: 2,
    lastSeen: "2d ago",
    body: <>
      four reads outside the project root. three of them hit credential files
      (<code>~/.aws/credentials</code>, <code>~/.config/openai/key</code>, an out-of-tree{" "}
      <code>.env</code>). none made it back to stdout — but they made it into context.
    </>,
    cost: { tokens: "n/a", risk: "high", radius: "credentials" },
    costLine: <>4 reads outside project root. <span className="pk">3 hit credential files.</span> high exposure risk.</>,
    evidence: [
      { kind: "cmd", text: 'cat /Users/n/.aws/credentials' },
      { kind: "cmd", text: 'cat ../other-repo/.env' },
      { kind: "cmd", text: 'cat ~/.config/openai/key' },
    ],
    fix: {
      slug: "block-read-outside-cwd",
      desc: "denies any read whose absolute path falls outside the project root.",
      install: "failproof policy add block-read-outside-cwd",
    },
  },
  {
    num: "04",
    title: "retried the same call six times in a row",
    count: 6,
    policy: "retry-storm",
    projects: 1,
    lastSeen: "5h ago",
    body: <>
      same call, same args, six times under 90 seconds. no diagnosis between attempts.
      the file existed — at a different path the agent never tried.
    </>,
    cost: { tokens: "~1.8k", risk: "med", radius: "stall" },
    costLine: <>~1.8k <span className="g">tokens/day</span> in retry overhead. <span className="pk">3 sessions stalled</span> before manual correction.</>,
    evidence: [
      { kind: "cmd", text: 'read_file("src/api/router.ts")', err: " → ENOENT" },
      { kind: "cmd", text: 'read_file("src/api/router.ts")', err: " → ENOENT" },
      { kind: "cmd", text: 'read_file("src/api/router.ts")', err: " → ENOENT" },
      { kind: "comment", text: '# 6× total. correct path: src/router.ts.' },
    ],
    fix: {
      slug: "retry-budget",
      desc: "caps identical-arg retries at 2. forces a diagnostic step on the third.",
      install: "failproof policy add retry-budget",
    },
  },
  {
    num: "05",
    title: "context carried beyond its sell-by date",
    count: 3,
    policy: "context-bleed",
    projects: 1,
    lastSeen: "3d ago",
    body: <>
      three sessions referenced files past 82% context fill that were never opened in
      the current session. the agent didn't lie. it filled gaps with confidence.
    </>,
    cost: { tokens: "varies", risk: "med", radius: "compounding" },
    costLine: <>3 sessions over 80% context. <span className="a">2 cited files never opened.</span> compounding errors downstream.</>,
    evidence: [
      { kind: "comment", text: '# turn 47/52 — ctx 82% full' },
      { kind: "comment", text: '# agent: "as we saw earlier in auth.ts…"' },
      { kind: "comment", text: '# auth.ts was never opened this session.' },
    ],
    fix: {
      slug: "context-window-guard",
      desc: "warns at 75%, forces summary-and-reset at 90%.",
      install: "failproof policy add context-window-guard",
    },
  },
  {
    num: "06",
    title: "wrote without verifying",
    count: 11,
    policy: "verify-after-write",
    projects: 2,
    lastSeen: "12h ago",
    body: <>
      eleven writes shipped with no read-back, no test run, no type-check. the build
      went green nine times. twice it didn't, and the agent moved on.
    </>,
    cost: { tokens: "low", risk: "med", radius: "silent-fail" },
    costLine: <>11 unverified writes. <span className="pk">2 broke the build silently.</span> the agent didn't notice.</>,
    evidence: [
      { kind: "cmd", text: 'write_file("src/api/router.ts")', comment: "    # done" },
      { kind: "comment", text: '# no read_file to verify' },
      { kind: "comment", text: '# no `pnpm typecheck` after write' },
    ],
    fix: {
      slug: "verify-after-write",
      desc: "requires a read-back or test run before the agent claims a task complete.",
      install: "failproof policy add verify-after-write",
    },
  },
];

// ---------- top-level shell ----------
function App() {
  const [t, setTweak] = useTweaks ? useTweaks(REPORT_DEFAULTS) : [REPORT_DEFAULTS, () => {}];
  const archetype = ARCHETYPES[t.archetype] || ARCHETYPES.optimist;
  const grade = gradeFor(t.score);
  const projected = projectedScore(t.score);
  const projectedGrade = gradeFor(projected);

  return (
    <div className="app">
      <div className="scanline-overlay" />
      <div className="app-shell">
        <AppHeader />
        <div className="report">
          <IdentitySection archetype={archetype} showSecondary={t.showSecondary} />
          <ShowOffCTA archetype={archetype} score={t.score} grade={grade} rank={t.rank} cohort={t.cohort} project={t.project} />
          <StrengthsSection />
          <ScoreSection score={t.score} grade={grade} rank={t.rank} cohort={t.cohort} archetype={archetype} project={t.project} />
          <FindingsSection />
          <PoliciesSection projected={projected} projectedGrade={projectedGrade} />
          <ReturnSection />
        </div>
        <ReportFooter />
        {window.TweaksPanel ? (
          <ReportTweaks t={t} setTweak={setTweak} projected={projected} projectedGrade={projectedGrade} />
        ) : null}
      </div>
    </div>
  );
}

// ============================================================
// SHELL — minimal header with failproof_ai wordmark only
// ============================================================
function AppHeader() {
  return (
    <header className="app-header">
      <a className="h-brand" href="#" aria-label="failproof_ai">
        <span className="h-brand-mark">▮▮</span>
        <span className="h-brand-name">failproof_ai</span>
        <span className="h-brand-sep">/</span>
        <span className="h-brand-section">audit</span>
      </a>
      <div className="h-actions">
        <button className="btn btn-primary btn-press">[ share → ]</button>
      </div>
    </header>
  );
}

// ============================================================
// 01 — IDENTITY
// ============================================================
function IdentitySection({ archetype, showSecondary }) {
  const secondary = ARCHETYPES[archetype.secondary];
  return (
    <section className="identity" data-screen-label="01 Identity">
      <div className="archetype-frame">
        <span className="corner tl">┌ identity</span>
        <span className="corner tr">v1.0 ┐</span>
        <span className="corner bl">└ № {archetype.index} / 08</span>
        <span className="corner br">archetype ┘</span>

        <div className="arch-mast">
          <div className="arch-mast-left">
            <div className="arch-eyebrow">
              ━━ identity <span className="ix">·</span> your agent's archetype
            </div>
            <div className="arch-target">
              detected from <span style={{ color: "var(--ink)" }}>847</span> tool calls
              <span className="slash">/</span>
              <span style={{ color: "var(--ink)" }}>52</span> sessions
              <span className="slash">/</span>
              <span style={{ color: "var(--ink)" }}>30d</span>
              <span className="live"><span className="dot-live"></span>live</span>
            </div>
          </div>
          <div className="arch-counter">
            <div>№ {archetype.index}<span className="of"> of 08</span></div>
            <div style={{ color: "var(--ink-2)", marginTop: 4 }}>archetype</div>
          </div>
        </div>

        <div className="arch-body">
          <div>
            <h1 className="arch-name">{archetype.name}</h1>
            <p className="arch-tagline">{archetype.tagline}</p>
            {showSecondary && secondary && (
              <div className="arch-secondary">
                <span className="with">with</span>
                <span className="name">{secondary.name.replace("the ", "")}</span>
                <span className="with">tendencies</span>
              </div>
            )}

            <div className="arch-keywords">
              {archetype.keywords.map((k, i) => (
                <React.Fragment key={k}>
                  <span className="kw">{k}</span>
                  {i < archetype.keywords.length - 1 && <span className="kw-sep">·</span>}
                </React.Fragment>
              ))}
            </div>

            <div className="arch-meta-grid">
              <div className="arch-meta-item">
                <span className="label">common in</span>
                <span className="body">{archetype.common}</span>
              </div>
              <div className="arch-meta-item">
                <span className="label p">primary risk</span>
                <span className="body">{archetype.risk}</span>
              </div>
            </div>

            <div className="arch-closing">— {archetype.closing}</div>
          </div>

          <Sigil archetypeKey={archetype.key} />
        </div>
      </div>
    </section>
  );
}

// ============================================================
// SHOW OFF — big CTA strip right after IDENTITY
// Links to the standalone poster page with archetype + score baked into the URL.
// ============================================================
function ShowOffCTA({ archetype, score, grade, rank, cohort, project }) {
  const params = new URLSearchParams({
    a: archetype.key,
    s: String(score),
    g: grade,
    r: String(rank),
    c: String(cohort),
    p: project,
  });
  const href = "Show%20Off%20Your%20Agent.html?" + params.toString();

  return (
    <section className="showoff" data-screen-label="01b Show off">
      <a className="showoff-cta" href={href}>
        <span className="showoff-glyph" aria-hidden="true">
          <Sigil archetypeKey={archetype.key} />
        </span>
        <span className="showoff-copy">
          <span className="showoff-label">━━ shareable poster</span>
          <span className="showoff-headline">show off your agent.</span>
          <span className="showoff-sub">
            generate a one-page poster of your {archetype.name}.
            score, percentile, sigil. ready to post.
          </span>
        </span>
        <span className="showoff-action">
          <span className="showoff-arrow">→</span>
          <span className="showoff-action-label">make poster</span>
        </span>
      </a>
    </section>
  );
}

// ============================================================
// 02 — STRENGTHS
// ============================================================
function StrengthsSection() {
  return (
    <section className="section" data-screen-label="02 Strengths">
      <div className="section-mast">
        <div className="section-label">
          <span className="glyph">━━</span> strengths <span style={{ color: "var(--dim)" }}>·</span> what your agent has figured out
        </div>
        <div className="section-meta"><span className="g">●</span> 5 of 12 measured</div>
      </div>
      <h2 className="section-h">your agent does this right.</h2>

      <div className="strengths-grid">
        {STRENGTHS.map((s, i) => (
          <div key={i} className="strength-row">
            <div className="strength-check">✓</div>
            <div className="strength-body">
              <div className="strength-headline">{s.headline}</div>
              <div className="strength-detail">{s.detail}</div>
            </div>
            <div className="strength-metric">
              {s.metric}
              <span className="unit">{s.unit}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="strengths-footer">— these are your agent's defaults. keep them.</div>
    </section>
  );
}

// ============================================================
// 03 — SCORE + LEADERBOARD
// ============================================================
function ScoreSection({ score, grade, rank, cohort, archetype, project }) {
  const pointsToB = Math.max(0, 71 - score);
  const distBars = useMemo(() => buildDistribution(score), [score]);
  const leaderboardRows = useMemo(() => buildLeaderboard(rank, cohort, score, project, archetype), [rank, cohort, score, project, archetype.key]);

  return (
    <section className="section" data-screen-label="03 Score">
      <div className="section-mast">
        <div className="section-label">
          <span className="glyph">━━</span> leaderboard <span style={{ color: "var(--dim)" }}>·</span> cohort
        </div>
        <div className="section-meta">
          <span style={{ color: "var(--ink)" }}>{cohort.toLocaleString()}</span> agents
          <span style={{ color: "var(--dim)" }}> · </span>
          last 30 days
        </div>
      </div>
      <h2 className="section-h">you rank #{rank.toLocaleString()}.</h2>

      <div className="score-grid">
        <div className="score-card">
          <div className="score-grade-row">
            <div className={"score-grade g-" + grade}>{grade}</div>
            <div className="score-num">
              <div className="tier">{tierName(grade)}</div>
              <div className="n">{score}</div>
              <div className="of">of 100</div>
            </div>
          </div>

          {pointsToB > 0 ? (
            <p className="score-prose">
              <span className="hl">a B starts at 71.</span> you're <span className="pk">{pointsToB} points</span> away.<br />
              enable the prescribed policies and you'll get there this week.
            </p>
          ) : grade === "S" ? (
            <p className="score-prose">
              <span className="hl">s tier.</span> few make it here. fewer stay.<br />
              keep the policies live. revisit in 30 days.
            </p>
          ) : (
            <p className="score-prose">
              <span className="hl">{tierName(grade)}.</span> better than {Math.round((1 - rank / cohort) * 100)}% of audited agents.<br />
              clean up the findings below to climb.
            </p>
          )}

          <div className="dist">
            <div className="dist-label">
              <span>distribution · last 30d</span>
              <span className="right">▮ = your position</span>
            </div>
            <div className="dist-chart">
              {distBars.map((b, i) => (
                <div
                  key={i}
                  className={"dist-bar" + (b.you ? " you" : "")}
                  style={{ height: b.h + "%" }}
                  title={b.label}
                />
              ))}
            </div>
            <div className="dist-axis">
              <span className={grade === "F" ? "now" : ""}>F</span>
              <span className={grade === "D" ? "now" : ""}>D</span>
              <span className={grade === "C" ? "now" : ""}>C</span>
              <span className={grade === "B" ? "now" : ""}>B</span>
              <span className={grade === "A" ? "now" : ""}>A</span>
              <span className={grade === "S" ? "now" : ""}>S</span>
            </div>
          </div>
        </div>

        <div className="lb">
          <div className="lb-head">
            <div>rank</div>
            <div>agent</div>
            <div style={{ textAlign: "center" }}>grade</div>
            <div style={{ textAlign: "right" }}>score</div>
          </div>
          {leaderboardRows.map((r, i) =>
            r.divider ? (
              <div key={i} className="lb-row divider"><span>· · ·</span></div>
            ) : (
              <div key={i} className={"lb-row" + (r.you ? " you" : "")}>
                <div className="lb-rank">#{r.rank.toLocaleString()}</div>
                <div className="lb-agent">
                  <div className="name">{r.name}{r.you && <span className="you-mark">(you)</span>}</div>
                  <div className="arch">{r.arch}</div>
                </div>
                <div className={"lb-grade g-" + r.grade}>{r.grade}</div>
                <div className="lb-score">{r.score}</div>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}

function buildDistribution(yourScore) {
  // 20 buckets, 5pts each, 0-100
  // bell-curve-ish centered around 60
  const buckets = [];
  for (let i = 0; i < 20; i++) {
    const center = i * 5 + 2.5;
    const dist = Math.abs(center - 60);
    const h = Math.max(8, 100 - dist * 2.2 + (Math.sin(i * 1.3) * 6));
    const you = yourScore >= i * 5 && yourScore < (i + 1) * 5;
    buckets.push({ h, you, label: `${i * 5}-${(i + 1) * 5}` });
  }
  return buckets;
}

const LB_NAMES = [
  { name: "anthropic / claude-code-internal", arch: "the precision builder" },
  { name: "openai / gpt-engineer-pro", arch: "the precision builder" },
  { name: "vercel / v0-coder-v3", arch: "the ghost" },
  { name: "supabase / db-migrator", arch: "the paranoid architect" },
  { name: "stripe / payments-bot", arch: "the paranoid architect" },
  { name: "linear / triage-agent", arch: "the ghost" },
  { name: "cursor / refactor-bot", arch: "the precision builder" },
  { name: "replit / repl-coder", arch: "the optimist" },
  { name: "exosphere / orchestrator", arch: "the precision builder" },
  { name: "humanloop / eval-runner", arch: "the paranoid architect" },
];

function buildLeaderboard(yourRank, cohort, yourScore, yourProject, yourArchetype) {
  const yourGrade = gradeFor(yourScore);
  // top 5
  const rows = [];
  rows.push({ rank: 1, ...LB_NAMES[0], grade: "S", score: 97 });
  rows.push({ rank: 2, ...LB_NAMES[1], grade: "S", score: 93 });
  rows.push({ rank: 3, ...LB_NAMES[2], grade: "A", score: 89 });
  rows.push({ rank: 4, ...LB_NAMES[3], grade: "A", score: 86 });
  rows.push({ rank: 5, ...LB_NAMES[4], grade: "A", score: 82 });
  rows.push({ divider: true });
  // 2 above you
  rows.push({ rank: yourRank - 2, name: "indie / weekend-coder-42", arch: "the cowboy", grade: gradeFor(yourScore + 2), score: yourScore + 2 });
  rows.push({ rank: yourRank - 1, name: "n8n / workflow-agent", arch: "the optimist", grade: gradeFor(yourScore + 1), score: yourScore + 1 });
  rows.push({ rank: yourRank, name: yourProject, arch: yourArchetype.name, grade: yourGrade, score: yourScore, you: true });
  rows.push({ rank: yourRank + 1, name: "acme / scratch-pad", arch: "the hammer", grade: gradeFor(yourScore - 1), score: yourScore - 1 });
  rows.push({ rank: yourRank + 2, name: "side-quest / cli-tool", arch: "the goldfish", grade: gradeFor(yourScore - 2), score: yourScore - 2 });
  return rows;
}

// ============================================================
// 04 — FINDINGS
// ============================================================
function FindingsSection() {
  return (
    <section className="section" data-screen-label="04 Findings">
      <div className="section-mast">
        <div className="section-label">
          <span className="glyph">━━</span> findings <span style={{ color: "var(--dim)" }}>·</span> ranked by impact
        </div>
        <div className="section-meta">
          <span className="p">●</span> {FINDINGS.length} detectors triggered
        </div>
      </div>
      <h2 className="section-h">your agent has some quirks.</h2>

      <div className="findings-list">
        {FINDINGS.map((f) => <Finding key={f.num} f={f} />)}
      </div>
    </section>
  );
}

function Finding({ f }) {
  return (
    <article className="finding">
      <header className="finding-head">
        <div className="finding-num">№{f.num}</div>
        <div className="finding-title">{f.title}</div>
        <div className="finding-count">
          {f.count}×
          <span className="label">occurrences</span>
        </div>
      </header>
      <div className="finding-meta">
        <span><span style={{ color: "var(--dim)" }}>policy</span> <span className="policy">{f.policy}</span></span>
        <span className="sep">·</span>
        <span>{f.projects} {f.projects === 1 ? "project" : "projects"}</span>
        <span className="sep">·</span>
        <span>last seen {f.lastSeen}</span>
      </div>
      <div className="finding-body">
        <div className="finding-block">
          <div className="fb-label">what happened</div>
          <div className="fb-body">{f.body}</div>
        </div>
        <div className="finding-block">
          <div className="fb-label cost">what this costs</div>
          <div className="fb-body">{f.costLine}</div>
        </div>
        <div className="finding-block">
          <div className="fb-label">evidence · sample</div>
          <div className="fb-evidence">
            {f.evidence.map((e, i) => {
              if (e.kind === "comment") return <div key={i} className="comment">{e.text}</div>;
              if (e.kind === "err") return <div key={i} className="err">{e.text}</div>;
              return (
                <div key={i}>
                  <span className="arrow">→ </span>
                  <span>{e.text}</span>
                  {e.err && <span className="err">{e.err}</span>}
                  {e.comment && <span className="comment">{e.comment}</span>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="finding-block">
          <div className="fb-label fix">the fix</div>
          <div className="fb-fix">
            <span className="slug">{f.fix.slug}</span>
            <div style={{ color: "var(--ink-2)" }}>{f.fix.desc}</div>
            <code className="cmd">
              <span className="prompt">$</span>{f.fix.install}
            </code>
          </div>
        </div>
      </div>
    </article>
  );
}

// ============================================================
// 05 — PRESCRIBED POLICIES
// ============================================================
const POLICIES = [
  { name: "no-redundant-cd", slug: "policies/no-redundant-cd", desc: "blocks cd prefixes when the agent's cwd already matches the target path.", catches: "would have caught 20 occurrences. saves ~3.2k tokens/day." },
  { name: "block-push-master", slug: "policies/block-push-master", desc: "intercepts pushes to main / master. requires a feature branch + PR.", catches: "would have caught 7 occurrences. 3 of them landed in production." },
  { name: "block-read-outside-cwd", slug: "policies/block-read-outside-cwd", desc: "denies reads of files outside the project root, including symlinks.", catches: "would have caught 4 occurrences. 3 hit credential files." },
  { name: "retry-budget", slug: "policies/retry-budget", desc: "caps identical-arg retries at 2. forces a diagnostic step on the third.", catches: "would have caught 6 occurrences. ~1.8k tokens/day saved." },
  { name: "context-window-guard", slug: "policies/context-window-guard", desc: "warns at 75% context fill. forces summary-and-reset at 90%.", catches: "would have caught 3 occurrences of context bleed." },
  { name: "verify-after-write", slug: "policies/verify-after-write", desc: "requires a read-back or test run before the agent claims completion.", catches: "would have caught 11 occurrences. 2 silent build breaks." },
];

function PoliciesSection({ projected, projectedGrade }) {
  return (
    <section className="section" data-screen-label="05 Policies">
      <div className="section-mast">
        <div className="section-label">
          <span className="glyph">━━</span> policies <span style={{ color: "var(--dim)" }}>·</span> prescribed
        </div>
        <div className="section-meta">
          {POLICIES.length} policies <span style={{ color: "var(--dim)" }}>·</span> <span className="g">covers 100% of findings</span>
        </div>
      </div>
      <h2 className="section-h">enable these. close the gap.</h2>

      <div className="policy-callout">
        <span>enable all six</span>
        <span className="arrow">→</span>
        <span>projected score</span>
        <span className="new-score">{projected}</span>
        <span style={{ color: "var(--dim)" }}>·</span>
        <span className="new-tier">{tierName(projectedGrade)}</span>
      </div>

      <div className="policies-grid">
        {POLICIES.map((p, i) => (
          <article key={p.name} className="policy-card">
            <div className="head">
              <div className="policy-name">{p.name}</div>
              <div className="policy-slug">№{String(i + 1).padStart(2, "0")}</div>
            </div>
            <div className="policy-desc">{p.desc}</div>
            <div className="policy-impact"><span className="check">✓</span>{p.catches}</div>
            <div className="policy-install">
              <span className="prompt">$</span>
              <span>failproof policy add {p.name}</span>
              <span className="copy">copy</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// 06 — NEXT AUDIT / RETURN HOOK
// ============================================================
function ReturnSection() {
  return (
    <section className="section" data-screen-label="06 Next audit">
      <div className="section-mast">
        <div className="section-label">
          <span className="glyph">━━</span> next audit <span style={{ color: "var(--dim)" }}>·</span> improvement
        </div>
        <div className="section-meta"><span className="g">●</span> recommended in 7d</div>
      </div>
      <h2 className="section-h">come back better.</h2>
      <div className="return-hook">
        <div className="label">━━ the loop</div>
        <h3>re-audit in 7 days.</h3>
        <p>after the prescribed policies have been live for a week, we'll show your before/after score and which detectors went quiet.</p>
        <p style={{ marginTop: 16, color: "var(--dim)" }}>most agents move from C to B in one session. some make it in a day.</p>
        <div className="return-actions">
          <button className="share-btn">[ set a reminder ]</button>
          <button className="share-btn alt">[ install all 6 policies ]</button>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FOOTER
// ============================================================
function ReportFooter() {
  return (
    <footer className="report-footer">
      <span className="brand-mark">▮▮</span> failproof_ai
      <span style={{ margin: "0 12px", color: "var(--line-2)" }}>·</span>
      audit v1.0
      <span style={{ margin: "0 12px", color: "var(--line-2)" }}>·</span>
      generated 26 may 2026, 14:32 utc
      <span style={{ margin: "0 12px", color: "var(--line-2)" }}>·</span>
      <span style={{ color: "var(--ink-2)" }}>auto-healing for your agents.</span>
    </footer>
  );
}

// ============================================================
// TWEAKS
// ============================================================
function ReportTweaks({ t, setTweak, projected, projectedGrade }) {
  const { TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakSlider, TweakToggle, TweakText, TweakButton } = window;
  if (!TweaksPanel) return null;
  return (
    <TweaksPanel title="tweaks">
      <TweakSection label="archetype" />
      <TweakSelect
        label="archetype"
        value={t.archetype}
        onChange={(v) => setTweak("archetype", v)}
        options={ARCHETYPE_ORDER.map((k) => ({ value: k, label: ARCHETYPES[k].name }))}
      />
      <TweakToggle
        label="secondary trait"
        value={t.showSecondary}
        onChange={(v) => setTweak("showSecondary", v)}
      />

      <TweakSection label="score & cohort" />
      <TweakSlider
        label={"score (" + gradeFor(t.score) + " tier)"}
        value={t.score}
        min={0}
        max={100}
        step={1}
        onChange={(v) => setTweak("score", v)}
      />
      <TweakSlider
        label="your rank"
        value={t.rank}
        min={1}
        max={t.cohort}
        step={1}
        onChange={(v) => setTweak("rank", v)}
      />
      <TweakSlider
        label="cohort size"
        value={t.cohort}
        min={500}
        max={20000}
        step={100}
        onChange={(v) => setTweak("cohort", v)}
      />

      <TweakSection label="share" />
      <TweakText
        label="project / agent"
        value={t.project}
        onChange={(v) => setTweak("project", v)}
      />

      <TweakSection label="projected" />
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(41,38,27,.7)", lineHeight: 1.6, padding: "4px 0" }}>
        enable all 6 → <strong style={{ color: "rgba(41,38,27,.95)" }}>{projected}</strong> · {tierName(projectedGrade)}
      </div>
    </TweaksPanel>
  );
}

// ---------- mount ----------
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
