/** Projects page — lists all Claude Agent SDK project folders.
 *
 * Wrapped in the audit `.report` + `.section` chrome so the page picks up
 * the unified design system: mono fonts, section masthead with the ━━
 * glyph + green eyebrow label, and the dashed-frame `.panel` around the
 * project list when it's populated. The inner ProjectList component is
 * unchanged — every Tailwind utility it uses (bg-card, text-foreground,
 * border-border, …) now resolves to the audit palette globally.
 */
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCachedProjectFolders } from "@/lib/projects";
import ProjectList from "@/app/components/project-list";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const disabled = (process.env.FAILPROOFAI_DISABLE_PAGES ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  if (disabled.includes("projects")) notFound();

  const folders = await getCachedProjectFolders();
  const count = folders.length;

  return (
    <main className="report">
      <section className="section" data-screen-label="projects">
        <h2 className="section-h" style={{ textTransform: "none" }}>
          Projects
          {/* <span className="section-h-dot" aria-hidden /> */}
        </h2>

        {count === 0 ? (
          <div
            className="panel"
            style={{ textAlign: "center", padding: "48px 32px" }}
          >
            <p style={{ color: "var(--ink-2)", marginBottom: 8 }}>
              no projects found in the .claude/projects directory.
            </p>
            <p
              style={{
                color: "var(--dim)",
                fontSize: 12,
                letterSpacing: "0.05em",
              }}
            >
              make sure the directory exists and contains project folders.
            </p>
          </div>
        ) : (
          <div className="panel" style={{ padding: 0 }}>
            <Suspense>
              <ProjectList folders={folders} />
            </Suspense>
          </div>
        )}
      </section>
    </main>
  );
}
