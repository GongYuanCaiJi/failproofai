/** Skeleton loading UI for the projects page — audit-styled to match
 *  the dashed `.panel` chrome of the loaded state. */
export default function ProjectsLoading() {
  return (
    <main className="report">
      <section className="section" data-screen-label="projects">
        <div className="section-mast">
          <div className="section-label">
            <span className="glyph">━━</span> projects{" "}
            <span style={{ color: "var(--dim)" }}>·</span> agent SDK folders
          </div>
          <div className="section-meta">
            <span style={{ color: "var(--dim)" }}>○</span> loading…
          </div>
        </div>
        <h2 className="section-h">your agent footprint.</h2>
        <div className="panel" style={{ padding: 24 }}>
          <div className="bg-muted h-6 w-40 mb-5 animate-pulse" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-muted/50 h-10 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
