"use client";

// Something on a screen threw. Say so plainly and offer a reload; the data is safe on the server.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 24 }}>
    <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 10 }}>
      <b style={{ fontSize: 16 }}>This screen hit a problem.</b>
      <p style={{ margin: 0, color: "#505967", fontSize: 13.5, lineHeight: 1.5 }}>Nothing you saved is lost. Try again, and if it keeps happening, reload the app.{error.digest ? ` Reference ${error.digest}.` : ""}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn ink" onClick={() => retry()}>Try again</button>
        <button type="button" className="btn" onClick={() => location.reload()}>Reload</button>
      </div>
    </div>
  </div>;
}
