"use client";

// Partners: businesses that already sell to your buyers. Find them, pitch them, track who sends referrals.
import { useEffect, useState } from "react";
import { PARTNER_KINDS, PARTNER_STATUSES, PARTNER_FEE, pitchFor, mapsSearch, kindOf } from "@/lib/partners";
import "./partners.css";

type Partner = { id: string; kind: string; name: string; contact_name: string; phone: string; email: string; city: string; status: string; referrals: number; notes: string; last_touch_at: string | null };
const blank = { kind: "supply", name: "", contact_name: "", phone: "", email: "", city: "", notes: "" };

export default function PartnersPage() {
  const [list, setList] = useState<Partner[]>([]);
  const [city, setCity] = useState("Denver");
  const [form, setForm] = useState<typeof blank | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const load = () => fetch("/api/partners", { cache: "no-store" }).then(r => r.json()).then(d => setList(d.partners ?? [])).catch(() => setFlash({ ok: false, text: "Couldn't load partners." }));
  useEffect(() => { load(); }, []);

  const save = async (p: Record<string, unknown>) => {
    const r = await fetch("/api/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setFlash({ ok: false, text: d.error || "Couldn't save." }); return false; }
    await load(); return true;
  };
  const copy = async (key: string) => { await navigator.clipboard.writeText(pitchFor(key)).catch(() => {}); setFlash({ ok: true, text: "Pitch copied." }); };
  const active = list.filter(p => p.status === "active").length, sent = list.reduce((n, p) => n + p.referrals, 0);

  return <div className="u-page pt-page" role="region" aria-label="Partners">
    <div className="u-head">
      <h1 className="u-title">Partners</h1>
      <div className="u-head-actions"><button type="button" className="u-btn" onClick={() => setForm({ ...blank })}>Add partner</button></div>
    </div>
    {flash && <p className={`u-flash ${flash.ok ? "" : "is-bad"}`} role="status">{flash.text}</p>}
    <div className="u-figs">
      <div className="u-fig"><span className="u-fig-k">Partners</span><b className="u-fig-v">{list.length}</b></div>
      <div className="u-fig"><span className="u-fig-k">Sending referrals</span><b className="u-fig-v">{active}</b></div>
      <div className="u-fig"><span className="u-fig-k">Referrals in</span><b className="u-fig-v">{sent}</b></div>
    </div>
    <p className="u-note">They get ${PARTNER_FEE} for every shop they send that signs. One supply yard that likes you is worth a week of dials. Walk in, don&apos;t email.</p>

    <h2 className="pt-h">Who to go after</h2>
    <label className="u-field pt-city"><span className="u-lab">Your city</span><input value={city} onChange={e => setCity(e.target.value)} /></label>
    <div className="pt-kinds">{PARTNER_KINDS.map(k => <article key={k.key} className="pt-kind">
      <h3>{k.label}</h3>
      <p>{k.why}</p>
      <details><summary>What to say</summary><p className="pt-pitch">{pitchFor(k.key)}</p></details>
      <div className="pt-acts">
        <a className="u-btn" href={mapsSearch(k.key, city)} target="_blank" rel="noreferrer">Find them on Maps</a>
        <button type="button" className="u-quiet" onClick={() => copy(k.key)}>Copy pitch</button>
        <button type="button" className="u-quiet" onClick={() => setForm({ ...blank, kind: k.key, city })}>Add one</button>
      </div>
    </article>)}</div>

    {form && <form className="pt-form" onSubmit={async e => { e.preventDefault(); if (await save(form)) { setForm(null); setFlash({ ok: true, text: "Partner added." }); } }}>
      <label className="u-field"><span className="u-lab">Type</span><select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>{PARTNER_KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}</select></label>
      <label className="u-field"><span className="u-lab">Business</span><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label className="u-field"><span className="u-lab">Person</span><input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></label>
      <label className="u-field"><span className="u-lab">Phone</span><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
      <label className="u-field"><span className="u-lab">Email</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <label className="u-field"><span className="u-lab">City</span><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></label>
      <label className="u-field pt-wide"><span className="u-lab">Notes</span><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
      <div className="pt-acts"><button className="u-btn" type="submit">Save partner</button><button type="button" className="u-quiet" onClick={() => setForm(null)}>Cancel</button></div>
    </form>}

    <h2 className="pt-h">Your partners</h2>
    {!list.length ? <p className="u-void">No partners yet. Pick a type above, find three on Maps, and visit them this week.</p>
      : <ul className="pt-list">{list.map(p => <li key={p.id} className={p.status === "no" ? "is-off" : ""}>
        <div className="pt-who"><b>{p.name}</b><span>{[kindOf(p.kind)?.label, p.contact_name, p.city].filter(Boolean).join(", ")}</span>
          {p.notes && <span className="pt-notes">{p.notes}</span>}
          {p.last_touch_at && <span className="pt-notes">Last contact {new Date(p.last_touch_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}</div>
        <div className="pt-acts">
          {p.phone && <a className="u-quiet" href={`tel:${p.phone}`} onClick={() => save({ ...p, touch: true })}>Call</a>}
          {p.email && <a className="u-quiet" href={`mailto:${p.email}?body=${encodeURIComponent(pitchFor(p.kind))}`} onClick={() => save({ ...p, touch: true })}>Email</a>}
          <select aria-label="Status" value={p.status} onChange={e => save({ ...p, status: e.target.value, touch: true })}>{PARTNER_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <button type="button" className="u-quiet" onClick={() => save({ ...p, referrals: p.referrals + 1, status: "active" })}>+ Referral ({p.referrals})</button>
        </div>
      </li>)}</ul>}
  </div>;
}
