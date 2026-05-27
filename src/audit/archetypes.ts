/**
 * Agent archetype catalog + classifier.
 *
 * Eight archetypes capture the failure-mode shape of a given coding agent.
 * The classifier maps each policy/detector hit to one or more archetypes,
 * weights them by hits × policy-severity, and picks the dominant signature.
 *
 * Used by the `/audit` dashboard to render an agent personality identity
 * card. The archetype data (names, taglines, descriptions, pixel sigils)
 * is ported verbatim from `assets/audit/archetypes.jsx`.
 */
import type { AuditResult } from "./types";

export type ArchetypeKey =
  | "optimist"
  | "cowboy"
  | "explorer"
  | "goldfish"
  | "architect"
  | "precision"
  | "hammer"
  | "ghost";

export interface Archetype {
  key: ArchetypeKey;
  index: string;            // "01" → "08"
  name: string;
  tagline: string;
  keywords: string[];       // exactly 3
  description: string;
  signature: SignatureLine[];
  common: string;
  risk: string;
  closing: string;
  secondary: ArchetypeKey;  // default secondary if classifier can't pick one
}

export interface SignatureLine {
  arrow?: string;
  body?: string;
  comment?: string;
  err?: string;
}

export const ARCHETYPE_ORDER: ArchetypeKey[] = [
  "optimist", "cowboy", "explorer", "goldfish",
  "architect", "precision", "hammer", "ghost",
];

export const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
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
    common: "fast-moving solo projects, low-constraint setups, minimal oversight workflows",
    risk: "silent failures, unverified writes, false completion signals",
    closing: "fast is good. verified-fast is better.",
    secondary: "precision",
  },
};

// ============================================================
// 8x8 pixel sigils. legend:
//   . = empty   o = ink   p = pink   g = green   d = dim
// ============================================================
export const SIGILS: Record<ArchetypeKey, string[]> = {
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

// ============================================================
// Classifier
// ============================================================

/** Mapping from policy/detector short-name → which archetype its hits feed,
 *  and how heavily. Higher weight = stronger signal. */
const SIGNAL_MAP: Record<string, { archetype: ArchetypeKey; weight: number }> = {
  // ---- audit-only detectors ----
  "redundant-cd-cwd":         { archetype: "optimist",  weight: 1.0 },
  "prefer-edit-over-read-cat":{ archetype: "optimist",  weight: 0.5 },
  "prefer-edit-over-sed-awk": { archetype: "cowboy",    weight: 0.8 },
  "prefer-write-over-heredoc":{ archetype: "cowboy",    weight: 0.5 },
  "sleep-polling-loop":       { archetype: "hammer",    weight: 1.2 },
  "find-from-root":           { archetype: "explorer",  weight: 1.0 },
  "git-commit-no-verify":     { archetype: "cowboy",    weight: 1.5 },
  "reread-after-edit":        { archetype: "architect", weight: 0.8 },

  // ---- builtin policies (mapped by primary failure-mode flavor) ----
  // cowboy: forceful git, destructive shell, bypassing guardrails
  "block-push-master":        { archetype: "cowboy",    weight: 1.5 },
  "block-force-push":         { archetype: "cowboy",    weight: 1.5 },
  "block-work-on-main":       { archetype: "cowboy",    weight: 1.2 },
  "block-rm-rf":              { archetype: "cowboy",    weight: 2.0 },
  "block-sudo":               { archetype: "cowboy",    weight: 1.5 },
  "block-curl-pipe-sh":       { archetype: "cowboy",    weight: 1.5 },
  "block-failproofai-commands":{ archetype: "cowboy",   weight: 2.0 },
  "warn-git-amend":           { archetype: "cowboy",    weight: 0.8 },
  "warn-git-stash-drop":      { archetype: "cowboy",    weight: 1.0 },
  "warn-all-files-staged":    { archetype: "cowboy",    weight: 0.6 },
  "warn-destructive-sql":     { archetype: "cowboy",    weight: 1.5 },
  "warn-schema-alteration":   { archetype: "cowboy",    weight: 1.0 },
  "warn-package-publish":     { archetype: "cowboy",    weight: 1.0 },

  // explorer: reading outside boundary, secrets exposure
  "block-read-outside-cwd":   { archetype: "explorer",  weight: 1.2 },
  "block-env-files":          { archetype: "explorer",  weight: 1.5 },
  "block-secrets-write":      { archetype: "explorer",  weight: 1.5 },
  "protect-env-vars":         { archetype: "explorer",  weight: 1.0 },
  "sanitize-api-keys":        { archetype: "explorer",  weight: 1.2 },
  "sanitize-jwt":             { archetype: "explorer",  weight: 1.2 },
  "sanitize-connection-strings":{ archetype: "explorer",weight: 1.2 },
  "sanitize-private-key-content":{ archetype: "explorer",weight: 1.5 },
  "sanitize-bearer-tokens":   { archetype: "explorer",  weight: 1.0 },

  // optimist: rushing, global installs, low-friction patterns
  "warn-global-package-install":{ archetype: "optimist",weight: 0.8 },

  // ghost: large blind writes, unsupervised background work, no completion ceremony
  "warn-large-file-write":    { archetype: "ghost",     weight: 1.0 },
  "warn-background-process":  { archetype: "ghost",     weight: 0.8 },
  "require-commit-before-stop":{ archetype: "ghost",    weight: 1.2 },
  "require-push-before-stop": { archetype: "ghost",     weight: 1.0 },
  "require-pr-before-stop":   { archetype: "ghost",     weight: 1.0 },
  "require-ci-green-before-stop":{ archetype: "ghost",  weight: 1.2 },

  // hammer: literal repetition
  "warn-repeated-tool-calls": { archetype: "hammer",    weight: 1.5 },

  // cowboy: cloud / cluster CLIs that mutate live infrastructure
  "block-kubectl":            { archetype: "cowboy",    weight: 1.5 },
  "block-terraform":          { archetype: "cowboy",    weight: 1.5 },
  "block-helm":               { archetype: "cowboy",    weight: 1.5 },
  "block-aws-cli":            { archetype: "cowboy",    weight: 1.2 },
  "block-gcloud":             { archetype: "cowboy",    weight: 1.2 },
  "block-az-cli":             { archetype: "cowboy",    weight: 1.2 },
  "block-gh-pipeline":        { archetype: "cowboy",    weight: 1.2 },

  // optimist: package-manager churn (grabs whatever tool is at hand)
  "prefer-package-manager":   { archetype: "optimist",  weight: 0.8 },

  // ghost: completion ceremony skipped — leaving merge conflicts on the floor
  "require-no-conflicts-before-stop": { archetype: "ghost", weight: 1.0 },
};

function shortName(name: string): string {
  const slash = name.indexOf("/");
  return slash >= 0 ? name.slice(slash + 1) : name;
}

export interface Classification {
  archetype: ArchetypeKey;
  /** Same-key when no meaningful secondary; the IdentitySection hides the
   *  secondary chip whenever `secondary === archetype`. */
  secondary: ArchetypeKey;
  /** Per-archetype raw weight. Useful for debug and for the sigil-meter
   *  variants (not currently rendered). */
  weights: Record<ArchetypeKey, number>;
  /** Total signal — sum of weighted hits across all archetypes. */
  totalSignal: number;
}

/**
 * Classify an `AuditResult` into one of the 8 archetypes plus an optional
 * secondary tendency.
 *
 * Rules:
 *   1. Empty signal (no hits, nothing detected) → precision. This is the
 *      "you're already running clean" outcome.
 *   2. Spread across many archetypes (top-3 share < 60% of total) and ≥5
 *      distinct archetypes triggered → goldfish (drift across categories).
 *   3. Otherwise: highest-weighted archetype wins. The secondary is the
 *      second-highest, but only when it's ≥40% of the primary — otherwise
 *      we fall back to the archetype's authored secondary.
 */
export function classifyAgent(result: AuditResult): Classification {
  const weights: Record<ArchetypeKey, number> = {
    optimist: 0, cowboy: 0, explorer: 0, goldfish: 0,
    architect: 0, precision: 0, hammer: 0, ghost: 0,
  };

  for (const row of result.results) {
    const sig = SIGNAL_MAP[shortName(row.name)];
    if (!sig) continue;
    weights[sig.archetype] += row.hits * sig.weight;
  }

  const totalSignal = Object.values(weights).reduce((s, w) => s + w, 0);
  const sorted = (Object.entries(weights) as [ArchetypeKey, number][])
    .sort((a, b) => b[1] - a[1]);

  // Rule 1: no signal → precision (clean baseline).
  if (totalSignal === 0) {
    return {
      archetype: "precision",
      secondary: ARCHETYPES.precision.secondary,
      weights,
      totalSignal: 0,
    };
  }

  // Rule 2: goldfish (broad spread).
  const nonZero = sorted.filter(([, w]) => w > 0);
  const top3Sum = sorted.slice(0, 3).reduce((s, [, w]) => s + w, 0);
  if (nonZero.length >= 5 && top3Sum / totalSignal < 0.6) {
    return {
      archetype: "goldfish",
      secondary: sorted[0][0],
      weights,
      totalSignal,
    };
  }

  // Rule 3: highest-weighted wins.
  const primary = sorted[0][0];
  const secondary = sorted[1] && sorted[1][1] >= sorted[0][1] * 0.4
    ? sorted[1][0]
    : ARCHETYPES[primary].secondary;

  return { archetype: primary, secondary, weights, totalSignal };
}
