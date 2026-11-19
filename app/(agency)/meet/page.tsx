"use client";

import { useEffect, useState } from "react";
import "./meet.css";

type Brand = { businessName: string; ownerFirstName: string; bookedVideo?: string; bookingLink?: string; contactEmail?: string };

/** A Loom share link as its embed address, or "" if it isn't one (any other video is linked, not embedded). */
const loomEmbed = (v: string) => { const m = /^https:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/([a-f0-9]{16,40})/i.exec(v.trim()); return m ? `https://www.loom.com/embed/${m[1]}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true` : ""; };
const clean = (v: string | null, n = 60) => (v ?? "").replace(/[<>]/g, "").trim().slice(0, n);

/**
 * Public "before our call" page, sent in the text right after someone books (cinderrevenue.com/meet?n=Mark&b=Ridge+Fence).
 * The video plus a one-page breakdown: what this is, how it works, what working together looks like, and exactly what
 * the call covers, so they show up warm instead of guarded.
 */
export default function MeetPage() {
  const [b, setB] = useState<Brand>({ businessName: "Cinder Revenue Company", ownerFirstName: "Sam", bookingLink: "https://cinderrevenue.com/book" });
  const [who, setWho] = useState({ first: "", company: "" });
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setWho({ first: clean(q.get("n"), 30), company: clean(q.get("b")) });
    void fetch("/api/workspace/public").then(r => (r.ok ? r.json() : null)).then(d => { if (d?.businessName) setB(d); }).catch(() => {});
  }, []);
  const embed = loomEmbed(b.bookedVideo ?? "");
  const theirs = who.company ? `${who.company}'s` : "your";

  return <main className="mt">
    <header className="mt-top"><span className="mt-brand">{b.businessName}</span></header>

    <section className="mt-hero">
      <h1>{who.first ? `${who.first}, here's what to expect on our call.` : "Here's what to expect on our call."}</h1>
      <p>Two minutes now saves you twenty on the call. Watch the video, skim the page, and you&apos;ll know exactly what we&apos;re doing and why.</p>
    </section>

    {b.bookedVideo ? <section className="mt-video">
      {embed ? <iframe src={embed} title="Before our call" allow="fullscreen" allowFullScreen /> : <a className="mt-btn" href={b.bookedVideo} target="_blank" rel="noopener">Watch the 2-minute video</a>}
    </section> : null}

    <section className="mt-sec">
      <h2>What this is</h2>
      <p>When you can&apos;t pick up, {theirs} customers get a text back from your business in about 10 seconds. It asks the questions you&apos;d ask, gives your price range, and books the estimate on your calendar. Every quote you send gets followed up until it&apos;s a yes or a no. I set it up and run it. You don&apos;t touch the tech.</p>
    </section>

    <section className="mt-sec">
      <h2>How it works</h2>
      <ol className="mt-steps">
        <li><b>A lead comes in.</b> A missed call, a website form, Facebook, Angi or Thumbtack.</li>
        <li><b>They hear back in seconds.</b> From your business, any hour, in English or Spanish.</li>
        <li><b>Your questions get asked.</b> Footage, height, gate and timing, or whatever you ask on the phone.</li>
        <li><b>The estimate is booked.</b> On your calendar, with reminders, so they show up.</li>
      </ol>
    </section>

    <section className="mt-sec">
      <h2>What working together looks like</h2>
      <ul className="mt-list">
        <li>Live within 21 business days of your checklist, or your setup fee back.</li>
        <li>You keep your business number and own all your data.</li>
        <li>No contract. The monthly fee starts the day your first booked appointment lands.</li>
        <li>A short text report every Monday: leads, replies, booked estimates.</li>
      </ul>
    </section>

    <section className="mt-sec mt-call">
      <h2>On our call</h2>
      <div className="mt-cols">
        <div><h3>What we&apos;ll cover</h3><p>How your leads are handled today, a live demo set up as {who.company || "your business"}, and what the missed ones are costing you.</p></div>
        <div><h3>Have these handy</h3><p>Roughly how many calls and form leads you get a week, your average job size, and how you follow up on quotes. Ballparks are fine.</p></div>
        <div><h3>If it&apos;s a fit</h3><p>You pick a plan, I send a short checklist, and you&apos;re live in about three weeks. If it&apos;s not a fit, I&apos;ll tell you.</p></div>
      </div>
    </section>

    <footer className="mt-foot">
      <p>Need a different time? {b.bookingLink ? <a href={b.bookingLink}>Pick another time</a> : null}{b.contactEmail ? <> or email <a href={`mailto:${b.contactEmail}`}>{b.contactEmail}</a></> : null}. Talk soon, {b.ownerFirstName}.</p>
    </footer>
  </main>;
}
