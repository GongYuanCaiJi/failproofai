/** Suspense fallback for /audit while the server component reads the cache.
 *  Renders a minimal skeleton — the cache read itself is cheap so this
 *  rarely flashes, but Next.js requires loading.tsx for route Suspense to
 *  work cleanly. */
export default function AuditLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto p-8 max-w-7xl">
        <div className="h-9 w-32 rounded bg-muted/40 animate-pulse mb-2" />
        <div className="h-4 w-72 rounded bg-muted/30 animate-pulse mb-8" />
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
        <div className="h-20 rounded-lg bg-card border border-border animate-pulse mb-6" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-96 rounded-lg bg-card border border-border animate-pulse" />
          <div className="h-96 rounded-lg bg-card border border-border animate-pulse" />
        </div>
      </div>
    </main>
  );
}
