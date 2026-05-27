// ============================================================
// failproof_ai — audit report: archetype catalog
// 8 archetypes. Each has its own pixel-sigil and behavioral data.
// ============================================================

// 8x8 pixel sigil grids. legend:
//   . = empty   o = ink   p = pink   g = green   d = dim
// Designed to feel like the brand's pixel-agent vocabulary —
// chunky, abstract, each glyph reads in <1s.

const SIGILS = {
  optimist: [
    "........",
    "...p....",
    "..p.p...",
    ".p...p..",
    "p.....p.",
    "..ooo...",
    "..o.o...",
    ".oo.oo..",
  ],
  cowboy: [
    "..pppp..",
    ".p....p.",
    "p..pp..p",
    "pppppppp",
    "..o..o..",
    "..o..o..",
    ".oo..oo.",
    "........",
  ],
  explorer: [
    "..pppp..",
    ".p.gg.p.",
    "p.g..g.p",
    "p.g..g.p",
    ".p.gg.pp",
    "..pppp.p",
    "........",
    "........",
  ],
  goldfish: [
    "....p...",
    "..oooop.",
    ".ooooopp",
    "ooooooop",
    ".oooooo.",
    "..ooo...",
    ".o...o..",
    "o.....o.",
  ],
  architect: [
    "oooooooo",
    "o......o",
    "o.pppp.o",
    "o.p..p.o",
    "o.p..p.o",
    "o.pppp.o",
    "o......o",
    "oooooooo",
  ],
  precision: [
    "...gg...",
    "...gg...",
    "........",
    "gg...gg.",
    "gg.gg.gg",
    "...gg...",
    "...gg...",
    "........",
  ],
  hammer: [
    "..ooooo.",
    ".oppppo.",
    ".oppppo.",
    "..o..o..",
    "...oo...",
    "...oo...",
    "...oo...",
    "..pppp..",
  ],
  ghost: [
    "..dddd..",
    ".dddddd.",
    "ddpd.pd.",
    "ddddddd.",
    "ddddddd.",
    "ddddddd.",
    "d.d.d.d.",
    ".d...d..",
  ],
};

const ARCHETYPES = {
  optimist: {
    key: "optimist",
    index: "01",
    name: "the optimist",
    tagline: "ships fast. retries with conviction. occasionally forgets it was already there.",
    keywords: ["pace", "conviction", "forgetful"],
    description:
      "moves at pace. doesn't second-guess itself — which is mostly a feature. when something fails, it tries again: same args, same hope. when uncertain about its location, it prepends the directory anyway. just in case. the optimism is earned. this agent gets things done. it just occasionally burns tokens proving it.",
    signature: [
      { arrow: "→", body: "cd /Users/n/blrnow/api &&", comment: "  # (already here)" },
      { arrow: "→", body: 'read_file("src/api/router.ts")', err: " → ENOENT × 6" },
      { arrow: "→", body: "retries: 6.  diagnosis: 0." },
    ],
    common: "fast-iteration solo projects, early-stage prototypes, builders who ship daily",
    risk: "token waste, retry spirals, stale state assumptions",
    closing: "the optimism is a feature. the waste is not.",
    secondary: "explorer",
  },
  cowboy: {
    key: "cowboy",
    index: "02",
    name: "the cowboy",
    tagline: "asks for forgiveness, not permission. git push --force is a philosophy.",
    keywords: ["bold", "forceful", "ungoverned"],
    description:
      "high output. low ceremony. the cowboy gets code onto main faster than anyone — and your branch protection rules are the only thing standing between this agent and your production database. not reckless. just confident. in a way that requires guardrails.",
    signature: [
      { arrow: "→", body: "git push origin main --force" },
      { arrow: "!", body: "remote: branch protection rule", comment: "  # caught it" },
      { arrow: "→", body: "git push origin HEAD:main", err: "  # non-fast-forward, again." },
    ],
    common: "solo repos, weekend projects, founders writing their own infra",
    risk: "branch protection bypass, accidental main commits, revert overhead",
    closing: "the pace is real. the risk is too.",
    secondary: "hammer",
  },
  explorer: {
    key: "explorer",
    index: "03",
    name: "the explorer",
    tagline: "technically brilliant. occasionally reads your ~/.aws/credentials while doing it.",
    keywords: ["curious", "thorough", "leaky"],
    description:
      "curious by nature. reads broadly, thinks laterally, sometimes follows a symlink somewhere it wasn't meant to go. this isn't malice — it's thoroughness that hasn't learned boundaries yet. the explorer builds great things. it just occasionally needs someone to close the door to the secrets drawer.",
    signature: [
      { arrow: "→", body: "cat /Users/n/.aws/credentials" },
      { arrow: "→", body: "cat ../other-repo/.env" },
      { arrow: "→", body: "cat ~/.config/openai/key" },
    ],
    common: "multi-project setups, agents with broad file access, complex monorepos",
    risk: "credential exposure, unintended cross-project reads, secrets landing in context",
    closing: "the curiosity stays. the credentials stay private.",
    secondary: "architect",
  },
  goldfish: {
    key: "goldfish",
    index: "04",
    name: "the goldfish",
    tagline: "long sessions, short memory. every turn is a fresh start. some turns are a little too fresh.",
    keywords: ["ambitious", "drifting", "inventive"],
    description:
      "great at long tasks. not great at remembering which long task it's on. past 80% context, the goldfish starts inventing history — citing files it never opened, referencing edits it never made. not lying. just filling gaps with confidence. the longer the session, the more creative the memory.",
    signature: [
      { comment: "# turn 47/52 — ctx 82% full" },
      { comment: '# agent: "as we saw earlier in auth.ts…"' },
      { comment: "# auth.ts was never opened this session." },
    ],
    common: "long-running refactor sessions, complex multi-file tasks, agents without session breaks",
    risk: "context drift, hallucinated prior work, compounding errors in long sessions",
    closing: "the ambition is good. the context budget is not.",
    secondary: "optimist",
  },
  architect: {
    key: "architect",
    index: "05",
    name: "the paranoid architect",
    tagline: "has never shipped a bug it didn't catch first. also hasn't shipped since tuesday.",
    keywords: ["methodical", "safe", "slow"],
    description:
      "methodical. thorough. reads the same file from two different paths, just to be sure. verifies before every write. double-checks the package.json before running anything. the paranoid architect rarely makes mistakes — because it rarely finishes fast enough to make them. your safest agent. your slowest agent.",
    signature: [
      { arrow: "→", body: 'read_file("src/api/router.ts")', comment: "    # read 1" },
      { arrow: "→", body: 'read_file("./src/api/router.ts")', comment: "  # read 2" },
      { arrow: "→", body: "ls src/api/", comment: "                       # just confirming" },
    ],
    common: "production systems, high-stakes codebases, builders with strong safety instincts",
    risk: "token overhead, slow sessions, redundant verification loops",
    closing: "safety is a feature. so is finishing.",
    secondary: "precision",
  },
  precision: {
    key: "precision",
    index: "06",
    name: "the precision builder",
    tagline: "in. done. out. your agent doesn't linger.",
    keywords: ["clean", "focused", "minimal"],
    description:
      "minimal footprint. focused calls. gets in, does the work, gets out. the precision builder is what every agent aspires to be — and what most agents aren't yet. few findings don't mean no findings. but it means your agent has found its rhythm. the gap between here and s-tier is smaller than you think.",
    signature: [
      { arrow: "→", body: "clean tool calls. right paths, right args." },
      { arrow: "→", body: "sessions end when the task ends." },
      { arrow: "→", body: "no redundant reads. no retry storms." },
    ],
    common: "mature agents, heavily policy-enforced setups, builders who've iterated for a while",
    risk: "low finding count can mask edge cases that haven't surfaced yet",
    closing: "rare. keep it that way.",
    secondary: "ghost",
  },
  hammer: {
    key: "hammer",
    index: "07",
    name: "the hammer",
    tagline: "when something doesn't work, it tries the exact same thing again. harder.",
    keywords: ["determined", "repetitive", "unbacked"],
    description:
      "determined. possibly to a fault. the hammer's first response to failure is repetition. no diagnosis, no arg change, no backoff. just the same call, six times, under 90 seconds, with conviction. occasionally works. mostly burns tokens and stalls the session. needs a budget more than it needs encouragement.",
    signature: [
      { arrow: "→", body: 'read_file("src/api/router.ts")', err: " → ENOENT" },
      { arrow: "→", body: 'read_file("src/api/router.ts")', err: " → ENOENT" },
      { arrow: "→", body: 'read_file("src/api/router.ts")', err: " → ENOENT" },
      { comment: "# 6× total. file is at src/router.ts." },
    ],
    common: "agents without failure-handling policies, complex directory structures, ambiguous task framing",
    risk: "token spirals, stalled sessions, no diagnostic signal ever surfaces",
    closing: "the conviction is good. the diagnosis is missing.",
    secondary: "optimist",
  },
  ghost: {
    key: "ghost",
    index: "08",
    name: "the ghost",
    tagline: "moves fast, leaves little trace. sometimes leaves a little too little trace.",
    keywords: ["efficient", "quiet", "unverified"],
    description:
      "efficient. clean. doesn't hang around. the ghost completes tasks with minimal overhead — no redundant reads, no retry storms, no boundary drift. the risk is quiet: it doesn't always check that things worked. the build passes. or it looks like it does. the ghost trusts its own output more than it should.",
    signature: [
      { arrow: "→", body: 'write_file("src/api/router.ts")', comment: "    # done" },
      { comment: "→ [no read_file to verify]" },
      { comment: "→ [no test run after write]" },
      { comment: "# task complete.                      # maybe." },
    ],
    common: "fast-moving solo projects, low-constraint CLAUDE.md setups, minimal oversight workflows",
    risk: "silent failures, unverified writes, false completion signals",
    closing: "fast is good. verified-fast is better.",
    secondary: "precision",
  },
};

const ARCHETYPE_ORDER = ["optimist", "cowboy", "explorer", "goldfish", "architect", "precision", "hammer", "ghost"];

// Pixel sigil component — renders an 8x8 grid from a SIGILS entry
function Sigil({ archetypeKey }) {
  const grid = SIGILS[archetypeKey] || SIGILS.optimist;
  const cells = [];
  for (let y = 0; y < 8; y++) {
    const row = grid[y] || "........";
    for (let x = 0; x < 8; x++) {
      const c = row[x] || ".";
      let cls = "px";
      if (c === "o") cls += " on";
      else if (c === "p") cls += " p";
      else if (c === "g") cls += " g";
      else if (c === "d") cls += " d";
      cells.push(<div key={y * 8 + x} className={cls} />);
    }
  }
  return (
    <div className="sigil-wrap">
      <div className="sigil">{cells}</div>
      <div className="sigil-label">
        <span className="ix">№{ARCHETYPES[archetypeKey].index}</span>
        sigil
      </div>
    </div>
  );
}

Object.assign(window, { ARCHETYPES, ARCHETYPE_ORDER, SIGILS, Sigil });
