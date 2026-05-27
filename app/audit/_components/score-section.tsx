"use client";

/**
 * Section 03 — SCORE + LEADERBOARD.
 *
 * Two-column grid: a score card on the left (big grade letter + "X of 100"
 * + prose + distribution histogram) and a synthetic-but-stable leaderboard
 * on the right with the user's row highlighted in pink.
 *
 * The leaderboard rows other than yours are seeded from a fixed list of
 * plausible agent names so the page doesn't look empty in a fresh
 * install. Real cohort data lands later when we wire telemetry.
 */
import React, { useMemo } from "react";
import { ARCHETYPES, type ArchetypeKey } from "@/src/audit/archetypes";
import { gradeFor, tierName, type Grade } from "@/src/audit/scoring";

interface Props {
  score: number;
  grade: Grade;
  rank: number;
  cohort: number;
  archetypeKey: ArchetypeKey;
  /** Display name in the highlighted leaderboard row. */
  project: string;
}

interface DistBucket { h: number; you: boolean; label: string; }
interface LeaderboardRow {
  rank?: number;
  name?: string;
  arch?: string;
  grade?: Grade;
  score?: number;
  you?: boolean;
  divider?: boolean;
}

const TOP_AGENTS: { name: string; arch: string }[] = [
  { name: "anthropic / claude-code-internal", arch: "the precision builder" },
  { name: "openai / gpt-engineer-pro",        arch: "the precision builder" },
  { name: "vercel / v0-coder-v3",             arch: "the ghost" },
  { name: "supabase / db-migrator",           arch: "the paranoid architect" },
  { name: "stripe / payments-bot",            arch: "the paranoid architect" },
];

const NEAR_AGENTS_ABOVE: { name: string; arch: string }[] = [
  { name: "indie / weekend-coder-42", arch: "the cowboy" },
  { name: "n8n / workflow-agent",     arch: "the optimist" },
];
const NEAR_AGENTS_BELOW: { name: string; arch: string }[] = [
  { name: "acme / scratch-pad",       arch: "the hammer" },
  { name: "side-quest / cli-tool",    arch: "the goldfish" },
];

export function ScoreSection({
  score, grade, rank, cohort, archetypeKey, project,
}: Props) {
  const archetype = ARCHETYPES[archetypeKey];
  const pointsToB = Math.max(0, 71 - score);
  const distBars = useMemo(() => buildDistribution(score), [score]);
  const rows = useMemo(
    () => buildLeaderboard(rank, score, project, archetype.name),
    [rank, score, project, archetype.name],
  );

  return (
    <section className="section" data-screen-label="03 Score">
      <div className="section-mast">
        <div className="section-label">
          <span className="glyph">━━</span> leaderboard{" "}
          <span style={{ color: "var(--dim)" }}>·</span> cohort
        </div>
        <div className="section-meta">
          <span style={{ color: "var(--ink)" }}>{cohort.toLocaleString()}</span>{" "}
          agents
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
              <span className="hl">a B starts at 71.</span>{" "}
              you&apos;re <span className="pk">{pointsToB} points</span> away.
              <br />
              enable the prescribed policies and you&apos;ll get there this week.
            </p>
          ) : grade === "S" ? (
            <p className="score-prose">
              <span className="hl">s tier.</span> few make it here. fewer stay.
              <br />
              keep the policies live. revisit in 30 days.
            </p>
          ) : (
            <p className="score-prose">
              <span className="hl">{tierName(grade)}.</span>{" "}
              better than {Math.round((1 - rank / cohort) * 100)}% of audited agents.
              <br />
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
          {rows.map((r, i) =>
            r.divider ? (
              <div key={i} className="lb-row divider">
                <span>· · ·</span>
              </div>
            ) : (
              <div key={i} className={"lb-row" + (r.you ? " you" : "")}>
                <div className="lb-rank">#{r.rank!.toLocaleString()}</div>
                <div className="lb-agent">
                  <div className="name">
                    {r.name}
                    {r.you && <span className="you-mark">(you)</span>}
                  </div>
                  <div className="arch">{r.arch}</div>
                </div>
                <div className={"lb-grade g-" + r.grade}>{r.grade}</div>
                <div className="lb-score">{r.score}</div>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function buildDistribution(yourScore: number): DistBucket[] {
  // 20 buckets, 5pts each, 0-100. Bell-ish centered at 60.
  const buckets: DistBucket[] = [];
  for (let i = 0; i < 20; i++) {
    const center = i * 5 + 2.5;
    const dist = Math.abs(center - 60);
    const h = Math.max(8, 100 - dist * 2.2 + Math.sin(i * 1.3) * 6);
    const you = yourScore >= i * 5 && yourScore < (i + 1) * 5;
    buckets.push({ h, you, label: `${i * 5}-${(i + 1) * 5}` });
  }
  return buckets;
}

function buildLeaderboard(
  yourRank: number,
  yourScore: number,
  yourProject: string,
  yourArchetypeName: string,
): LeaderboardRow[] {
  const rows: LeaderboardRow[] = [];

  // Top 5 (synthetic but stable).
  rows.push({ rank: 1, name: TOP_AGENTS[0].name, arch: TOP_AGENTS[0].arch, grade: "S", score: 97 });
  rows.push({ rank: 2, name: TOP_AGENTS[1].name, arch: TOP_AGENTS[1].arch, grade: "S", score: 93 });
  rows.push({ rank: 3, name: TOP_AGENTS[2].name, arch: TOP_AGENTS[2].arch, grade: "A", score: 89 });
  rows.push({ rank: 4, name: TOP_AGENTS[3].name, arch: TOP_AGENTS[3].arch, grade: "A", score: 86 });
  rows.push({ rank: 5, name: TOP_AGENTS[4].name, arch: TOP_AGENTS[4].arch, grade: "A", score: 82 });

  // Skip to the user's neighborhood unless their rank is already in the
  // top 5 (then collapse the divider).
  if (yourRank > 7) rows.push({ divider: true });

  // Two ranked just above the user.
  if (yourRank > 2) {
    rows.push({
      rank: yourRank - 2,
      name: NEAR_AGENTS_ABOVE[0].name,
      arch: NEAR_AGENTS_ABOVE[0].arch,
      grade: gradeFor(yourScore + 2),
      score: yourScore + 2,
    });
  }
  if (yourRank > 1) {
    rows.push({
      rank: yourRank - 1,
      name: NEAR_AGENTS_ABOVE[1].name,
      arch: NEAR_AGENTS_ABOVE[1].arch,
      grade: gradeFor(yourScore + 1),
      score: yourScore + 1,
    });
  }

  // The user.
  rows.push({
    rank: yourRank,
    name: yourProject,
    arch: yourArchetypeName,
    grade: gradeFor(yourScore),
    score: yourScore,
    you: true,
  });

  // Two below.
  rows.push({
    rank: yourRank + 1,
    name: NEAR_AGENTS_BELOW[0].name,
    arch: NEAR_AGENTS_BELOW[0].arch,
    grade: gradeFor(Math.max(0, yourScore - 1)),
    score: Math.max(0, yourScore - 1),
  });
  rows.push({
    rank: yourRank + 2,
    name: NEAR_AGENTS_BELOW[1].name,
    arch: NEAR_AGENTS_BELOW[1].arch,
    grade: gradeFor(Math.max(0, yourScore - 2)),
    score: Math.max(0, yourScore - 2),
  });

  return rows;
}
