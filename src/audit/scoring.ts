/**
 * Score derivation for the audit dashboard.
 *
 * Score is on 0-100, mapped to letter grades that anchor the leaderboard
 * + tier prose. The thresholds match the reference design (assets/audit):
 *
 *     ≥ 90  S    "s tier"
 *     ≥ 80  A    "a tier"
 *     ≥ 71  B    "b tier"
 *     ≥ 55  C    "c tier"
 *     ≥ 40  D    "d tier"
 *     <  40 F    "f tier"
 *
 * The "projected score" is the hypothetical score after enabling every
 * recommended unenabled-builtin policy — used by the prescription section
 * to motivate enabling them.
 */
import type { AuditResult } from "./types";

export type Grade = "S" | "A" | "B" | "C" | "D" | "F";

export function gradeFor(score: number): Grade {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 71) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

const TIER_NAME: Record<Grade, string> = {
  S: "s tier", A: "a tier", B: "b tier",
  C: "c tier", D: "d tier", F: "f tier",
};

export function tierName(g: Grade): string {
  return TIER_NAME[g];
}

/**
 * Heuristic score. Start at 100 and subtract per-hit penalties weighted by
 * severity. Hit-penalty ratios were tuned against the reference defaults
 * (58 → C for an agent with a moderate optimist + explorer footprint).
 *
 * Per-hit penalties:
 *   deny / block / warn-stop builtin (high severity)  -1.2 per hit, max -25
 *   instruct / warn builtin           (medium)         -0.7 per hit, max -15
 *   sanitize policies                                  -0.4 per hit, max -10
 *   audit-only detector hit                            -0.5 per hit, max -20
 *
 * Floor at 0, cap at 100. Sessions with zero scanned transcripts return 0
 * (no signal, no grade).
 */
export function deriveScore(result: AuditResult): number {
  if (result.transcripts.scanned === 0) return 0;

  let score = 100;
  let denyPenalty = 0;
  let instructPenalty = 0;
  let sanitizePenalty = 0;
  let detectorPenalty = 0;

  for (const row of result.results) {
    if (row.source === "audit-detector") {
      detectorPenalty += row.hits * 0.5;
      continue;
    }
    const sev = row.severity;
    if (sev === "deny") {
      denyPenalty += row.hits * 1.2;
    } else if (sev === "instruct" || sev === "warn") {
      instructPenalty += row.hits * 0.7;
    } else {
      // sanitize-* policies report as the underlying decision; treat
      // remaining categories (allow-with-reason from sanitize) gently.
      sanitizePenalty += row.hits * 0.4;
    }
  }

  score -= Math.min(denyPenalty, 25);
  score -= Math.min(instructPenalty, 15);
  score -= Math.min(sanitizePenalty, 10);
  score -= Math.min(detectorPenalty, 20);

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Projected score after enabling every unenabled builtin. Doesn't actually
 * re-run the audit — instead it credits back the hits the user would have
 * blocked by enabling those policies, applying the same weighted penalty
 * scheme used by `deriveScore`.
 *
 * Caps at 92 so the prescription never promises a guaranteed S — the user
 * still has to keep the policies on.
 */
export function projectedScore(result: AuditResult, currentScore: number): number {
  // Sum the penalty that would be lifted if every "slipping through" hit
  // (unenabled-builtin only — detectors don't have a real-time policy yet)
  // moved from `slipping` → `blocked`.
  let recoverable = 0;
  for (const row of result.results) {
    if (row.source !== "builtin") continue;
    if (row.enabledInConfig) continue;
    if (row.severity === "deny") recoverable += row.hits * 1.2;
    else if (row.severity === "instruct" || row.severity === "warn") recoverable += row.hits * 0.7;
    else recoverable += row.hits * 0.4;
  }
  // The caps applied in deriveScore mean recoverable points can't exceed
  // the same caps in aggregate. Approximation OK for a "projected" hint.
  const proj = Math.min(92, currentScore + Math.round(recoverable));
  return Math.max(currentScore, proj);
}

/**
 * Approximate global rank in the cohort. We don't have a real leaderboard
 * yet — this is a deterministic synthetic rank derived from the score so
 * the UI doesn't feel jittery as the user re-runs.
 *
 * Distribution roughly matches a bell-shape centered at 60. Cohort size
 * is fixed at 2316 to match the reference design.
 */
export const COHORT_SIZE = 2316;

export function syntheticRank(score: number): number {
  // Roughly: 100 → top of leaderboard, 0 → bottom. Use a smooth curve so
  // small score changes feel meaningful but not catastrophic.
  const percentile = scoreToPercentile(score);
  return Math.max(1, Math.min(COHORT_SIZE, Math.round((1 - percentile) * COHORT_SIZE)));
}

function scoreToPercentile(score: number): number {
  // Logistic mapping centered at 58 — agents below 58 fall into the long
  // tail, agents above climb steeply. Anchors the default demo (58 → ~p20).
  const z = (score - 58) / 14;
  const p = 1 / (1 + Math.exp(-z));
  return p;
}
