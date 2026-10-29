"use client";

import MyDayQueue from "../../my-day-queue";

/** Needs You shows the same server-built queue as My Day (one source of truth), with focus filters. */
export default function NeedsYouPage() {
  return <main style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 22px 60px", color: "#f4f4f5" }}>
    <header style={{ marginBottom: 22 }}>
      <p style={{ margin: 0, fontSize: 10, letterSpacing: 2, color: "#d6a98c" }}>CINDER / ATTENTION</p>
      <h1 style={{ fontSize: "clamp(32px,5vw,46px)", letterSpacing: "-1.6px", margin: "8px 0", color: "#f4f4f5" }}>Needs you<span style={{ color: "#d6a98c" }}>.</span></h1>
      <p style={{ maxWidth: 720, color: "#a1a1aa", lineHeight: 1.65, margin: 0 }}>Everything waiting on you, ranked revenue first: follow-ups, new prospects, meeting prep, stalled deals, client delivery, money and AI-team approvals. Nothing is sent or dialed automatically.</p>
    </header>
    <MyDayQueue showFilters title="Action queue" />
  </main>;
}
