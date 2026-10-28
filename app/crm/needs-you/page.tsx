"use client";

import MyDayQueue from "../../my-day-queue";

/**
 * Needs You shows the same server-built queue as My Day (one source of truth),
 * with focus filters for sales, delivery and money/admin.
 */
export default function NeedsYouPage() {
  return <main className="cinder-page">
    <header className="cinder-page-header">
      <p className="cinder-eyebrow">CINDER / ATTENTION</p>
      <h1>Needs you<span className="cinder-dot">.</span></h1>
      <p className="cinder-lede">Everything waiting on you, ranked revenue first: follow-ups, new prospects, meeting prep, stalled deals, client delivery, money and AI-team approvals. Nothing is sent or dialed automatically.</p>
    </header>
    <MyDayQueue showFilters title="Action queue" />
  </main>;
}
