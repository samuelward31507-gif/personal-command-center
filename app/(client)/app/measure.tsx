"use client";
// Measure-to-quote for fence: draw the fence line on a satellite map (runs, gates, tear-out), see the feet as you go,
// then price it into the quote (one type, or good / better / best) and turn the material list into a draft order.
// The map is Google Maps, keyed by NEXT_PUBLIC_GOOGLE_MAPS_KEY; without a key the screen says so and nothing breaks.
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Sheet, Spinner, type Api, type Toast } from "./parts";
import { FENCE_STARTERS, cleanFenceTypes, measureOf, runFeet, staticMapUrl, takeoff, type Drawing, type FenceType, type LatLng } from "@/lib/fence";
import type { Card } from "@/lib/crm";
import { addBusinessDays, cleanPaperwork, digBlockers, locateLine, paperworkItems, type Paperwork } from "@/lib/paperwork";
import { photoSrc, shrink } from "./photos";
import type { Data } from "./types";

type Ctx = { d: Data; project: string; api: Api; toast: Toast; reload: () => Promise<void> };
const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });
const ft = (n: number) => `${Math.round(n).toLocaleString("en-US")} ft`;

/* eslint-disable @typescript-eslint/no-explicit-any -- the Google Maps script has no types installed here */
type GM = any;
let loading: Promise<GM> | null = null;
function loadMaps(): Promise<GM> {
  const w = window as unknown as { google?: GM; __cinderMaps?: () => void };
  if (w.google?.maps?.Map) return Promise.resolve(w.google);
  if (loading) return loading;
  loading = new Promise((ok, bad) => {
    w.__cinderMaps = () => ok(w.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&callback=__cinderMaps`;
    s.async = true; s.onerror = () => { loading = null; bad(new Error("The map didn't load. Check the connection and try again.")); };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * The fence line as a plan, drawn from the saved points: the picture when there's no satellite map on this account
 * (or no key yet). New runs solid, tear-out dashed, gates as gaps with a tick, each side labeled in feet.
 */
export function PlanView({ d, height = 260 }: { d: Drawing; height?: number }) {
  const pts = d.runs.flatMap(r => r.points);
  if (!pts.length) return null;
  const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length, k = Math.cos(lat0 * Math.PI / 180);
  const xy = (p: LatLng) => ({ x: p.lng * k, y: -p.lat });
  const all = pts.map(xy), minX = Math.min(...all.map(p => p.x)), maxX = Math.max(...all.map(p => p.x)), minY = Math.min(...all.map(p => p.y)), maxY = Math.max(...all.map(p => p.y));
  const W = 600, H = height, pad = 44, span = Math.max(maxX - minX, maxY - minY, 1e-6), sc = Math.min((W - pad * 2) / Math.max(maxX - minX, span * 0.25), (H - pad * 2) / Math.max(maxY - minY, span * 0.25));
  const ox = (W - (maxX - minX) * sc) / 2, oy = (H - (maxY - minY) * sc) / 2;
  const at = (p: LatLng) => { const q = xy(p); return { x: ox + (q.x - minX) * sc, y: oy + (q.y - minY) * sc }; };
  const segs = d.runs.flatMap(r => r.points.slice(1).map((p, i) => ({ id: r.id + i, kind: r.kind, a: at(r.points[i]), b: at(p), feet: runFeet({ points: [r.points[i], p] }) })));
  return <svg className="ms-plan" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Fence plan: ${segs.filter(s => s.kind === "new").map(s => Math.round(s.feet) + " ft").join(", ")}`}>
    {segs.map(s => { const mx = (s.a.x + s.b.x) / 2, my = (s.a.y + s.b.y) / 2, dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len * 16, ny = dx / len * 16;
      return <g key={s.id}><line x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke={s.kind === "new" ? "#1c1d1f" : "#8a919c"} strokeWidth={s.kind === "new" ? 3 : 2} strokeDasharray={s.kind === "new" ? undefined : "6 5"} strokeLinecap="round" />
        <text x={mx + nx} y={my + ny + 4} textAnchor="middle" fontSize="13" fontWeight="500" fill="#5d6674">{Math.round(s.feet)} ft</text></g>; })}
    {d.runs.filter(r => r.kind === "new").flatMap(r => r.points).map((p, i) => { const q = at(p); return <circle key={"p" + i} cx={q.x} cy={q.y} r={4} fill="#fff" stroke="#1c1d1f" strokeWidth={2} />; })}
    {d.gates.map(g => { const q = at(g.at); return <g key={g.id}><rect x={q.x - 9} y={q.y - 9} width={18} height={18} rx={4} fill="#fff" stroke="#1c1d1f" strokeWidth={2} /><text x={q.x} y={q.y + 26} textAnchor="middle" fontSize="12" fill="#5d6674">{g.type === "double" ? "Drive gate" : "Gate"}</text></g>; })}
  </svg>;
}

/** On the record: the fence line if there is one (a satellite picture, the feet), and the way in to measure. */
export function MeasureBox({ ctx, card, canEdit }: { ctx: Ctx; card: Card; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const d = card.measure && card.measure.runs?.length ? card.measure as Drawing : null;
  const m = d ? measureOf(d) : null, img = d ? staticMapUrl(d, KEY, "600x300") : "";
  if (!d && !canEdit) return null;
  return <section className="card"><div className="hd"><h2>Fence line</h2>{m && <small style={{ marginLeft: "auto" }}>{ft(m.newFeet)}{m.gates.single + m.gates.double ? `, ${m.gates.single + m.gates.double} ${m.gates.single + m.gates.double === 1 ? "gate" : "gates"}` : ""}{m.tearoutFeet ? `, ${ft(m.tearoutFeet)} out` : ""}</small>}</div>
    {img ? <img className="fence-img" src={img} alt={`The fence line, ${m ? ft(m.newFeet) : ""}`} loading="lazy" />
      : d ? <PlanView d={d} height={220} />
      : <p className="fine">Trace the fence on the satellite map: feet, gates and tear-out add up as you tap, and one tap prices it into the quote.</p>}
    {canEdit && <div className="acts-row end" style={{ marginTop: 6 }}><button type="button" className="btn sm" onClick={() => setOpen(true)}><Icon name="pin" size={13} />{d ? "Edit the line" : "Measure on the map"}</button></div>}
    {open && <MeasureSheet ctx={ctx} card={card} onClose={() => setOpen(false)} />}
  </section>;
}

type Mode = "fence" | "gate" | "tearout";
function MeasureSheet({ ctx, card, onClose }: { ctx: Ctx; card: Card; onClose: () => void }) {
  const types = useMemo(() => cleanFenceTypes(ctx.d.setup?.fence_types ?? "[]"), [ctx.d.setup?.fence_types]);
  const [draw, setDraw] = useState<Drawing>(() => (card.measure as Drawing | null) ?? { runs: [], gates: [] });
  const [mode, setMode] = useState<Mode>("fence"), [active, setActive] = useState<string | null>(null);
  const [gateType, setGateType] = useState<"single" | "double">("single");
  const [pick, setPick] = useState<string[]>(() => types.slice(0, 1).map(t => t.id)), [busy, setBusy] = useState(""), [mapErr, setMapErr] = useState("");
  const box = useRef<HTMLDivElement>(null), map = useRef<GM>(null), shapes = useRef<GM[]>([]), state = useRef({ draw, mode, active, gateType });
  state.current = { draw, mode, active, gateType };
  const address = String(card.details?.address ?? "");
  const m = measureOf(draw), chosen = pick.map(id => types.find(t => t.id === id)).filter((t): t is FenceType => !!t);
  const k = chosen[0] ? takeoff(draw, chosen[0]) : null;

  // The map: satellite, flat, one-finger panning (a thumb in a truck), centred on the saved drawing or the address.
  useEffect(() => {
    if (!KEY || !box.current) return;
    let gone = false;
    loadMaps().then(async g => {
      if (gone || !box.current) return;
      const mp = new g.maps.Map(box.current, { mapTypeId: "satellite", tilt: 0, zoom: draw.zoom ?? 20, center: draw.center ?? { lat: 39.74, lng: -104.99 },
        disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy", clickableIcons: false, keyboardShortcuts: false });
      map.current = mp;
      if (!draw.center && address) new g.maps.Geocoder().geocode({ address }, (res: GM[], status: string) => { if (status === "OK" && res[0]) { mp.setCenter(res[0].geometry.location); mp.setZoom(20); } });
      mp.addListener("click", (e: GM) => tap({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
      paint();
    }).catch(e => setMapErr(e instanceof Error ? e.message : "The map didn't load."));
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { paint(); }); // redraw the shapes after every change

  function paint() {
    const g = (window as unknown as { google?: GM }).google, mp = map.current;
    if (!g || !mp) return;
    for (const s of shapes.current) s.setMap(null);
    shapes.current = [];
    for (const r of state.current.draw.runs) {
      shapes.current.push(new g.maps.Polyline({ map: mp, path: r.points, strokeColor: r.kind === "new" ? "#ffffff" : "#c8ccd2", strokeOpacity: r.kind === "new" ? 1 : 0, strokeWeight: r.id === state.current.active ? 5 : 4,
        icons: r.kind === "tearout" ? [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: "#c8ccd2", scale: 3 }, offset: "0", repeat: "12px" }] : undefined, clickable: false }));
      for (const p of r.points) shapes.current.push(new g.maps.Marker({ map: mp, position: p, clickable: false, icon: { path: g.maps.SymbolPath.CIRCLE, scale: 3.5, fillColor: "#ffffff", fillOpacity: 1, strokeColor: "#1c1d1f", strokeWeight: 1 } }));
    }
    for (const gt of state.current.draw.gates) shapes.current.push(new g.maps.Marker({ map: mp, position: gt.at, clickable: false, label: { text: gt.type === "double" ? "D" : "G", color: "#fff", fontSize: "11px", fontWeight: "600" },
      icon: { path: g.maps.SymbolPath.CIRCLE, scale: 9, fillColor: "#d0663f", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } }));
  }

  function tap(p: LatLng) {
    const { draw: d, mode: md, active: a, gateType: gt } = state.current;
    if (md === "gate") {
      // A gate goes on the closest new run to the tap.
      let best: { run: string; dist: number } | null = null;
      for (const r of d.runs.filter(x => x.kind === "new")) for (const q of r.points) { const dist = Math.hypot(q.lat - p.lat, q.lng - p.lng); if (!best || dist < best.dist) best = { run: r.id, dist }; }
      if (!best) { ctx.toast("Draw the fence first, then drop the gates on it.", true); return; }
      setDraw({ ...d, gates: [...d.gates, { id: "g" + Date.now().toString(36), run: best.run, at: p, type: gt, width: gt === "double" ? 12 : 4 }] });
      return;
    }
    const kind = md === "tearout" ? "tearout" : "new";
    const cur = d.runs.find(r => r.id === a && r.kind === kind);
    if (cur) setDraw({ ...d, runs: d.runs.map(r => r === cur ? { ...r, points: [...r.points, p] } : r) });
    else { const id = "r" + Date.now().toString(36); setActive(id); setDraw({ ...d, runs: [...d.runs, { id, kind, points: [p] }] }); }
  }
  const undo = () => {
    if (mode === "gate" && draw.gates.length) { setDraw({ ...draw, gates: draw.gates.slice(0, -1) }); return; }
    const last = draw.runs.at(-1); if (!last) return;
    const runs = last.points.length > 1 ? draw.runs.map(r => r === last ? { ...r, points: r.points.slice(0, -1) } : r) : draw.runs.slice(0, -1);
    setDraw({ ...draw, runs, gates: draw.gates.filter(g => runs.some(r => r.id === g.run)) });
  };
  const view = () => { const mp = map.current; if (!mp) return {}; const c = mp.getCenter(); return { center: { lat: c.lat(), lng: c.lng() }, zoom: mp.getZoom() }; };
  async function save(then?: "quote" | "order") {
    setBusy(then ?? "save");
    try {
      await ctx.api("/api/app/act", { p: ctx.project, action: "measure", thread: card.id, input: { ...draw, ...view() } });
      if (then === "quote") { const r = await ctx.api<{ total?: number }>("/api/app/act", { p: ctx.project, action: "measurequote", thread: card.id, input: { types: pick } }); ctx.toast(`Quote built${r.total ? `: ${usd(r.total)}` : ""}${pick.length > 1 ? `, ${pick.length} options` : ""}. Open the quote to send it.`); }
      else if (then === "order") { await ctx.api("/api/app/act", { p: ctx.project, action: "measureorder", thread: card.id, input: { type: pick[0] } }); ctx.toast("Material order drafted. Pick the supplier on the job's Materials."); }
      else ctx.toast(`Saved: ${ft(m.newFeet)}.`);
      await ctx.reload(); onClose();
    } catch (e) { ctx.toast(e instanceof Error ? e.message : "Didn't save.", true); } finally { setBusy(""); }
  }
  const drawn = draw.runs.some(r => r.kind === "new" && r.points.length > 1);
  return <Sheet onClose={onClose} title="Measure the fence" sub={address || card.name} wide
    foot={<>{drawn && <button type="button" className="btn" disabled={!!busy || !pick.length} onClick={() => void save("order")}>{busy === "order" ? <Spinner /> : "Order materials"}</button>}
      <span style={{ flex: 1 }} /><button type="button" className="btn" disabled={!!busy} onClick={() => void save()}>{busy === "save" ? <Spinner /> : "Save"}</button>
      <button type="button" className="btn ink" disabled={!!busy || !drawn || !pick.length} onClick={() => void save("quote")}>{busy === "quote" ? <Spinner /> : pick.length > 1 ? `Build ${pick.length}-option quote` : "Build quote"}</button></>}>
    <div className="ms-bar" role="toolbar" aria-label="What a tap adds">
      <div className="seg" role="radiogroup">{([["fence", "Fence"], ["gate", "Gate"], ["tearout", "Tear-out"]] as const).map(([k2, l]) =>
        <button key={k2} type="button" role="radio" aria-checked={mode === k2} className={mode === k2 ? "on" : ""} onClick={() => { setMode(k2); setActive(null); }}>{l}</button>)}</div>
      {mode === "gate" && <select className="input sm" aria-label="Gate" value={gateType} onChange={e => setGateType(e.target.value as "single" | "double")}><option value="single">Walk gate, 4 ft</option><option value="double">Drive gate, 12 ft</option></select>}
      {mode !== "gate" && <button type="button" className="btn sm" onClick={() => setActive(null)} disabled={!active}>New run</button>}
      <button type="button" className="btn sm" onClick={undo} disabled={!draw.runs.length}>Undo</button>
      <button type="button" className="btn ghost sm" onClick={() => { if (confirm("Clear the whole drawing?")) { setDraw({ runs: [], gates: [] }); setActive(null); } }} disabled={!draw.runs.length}>Clear</button>
      <span className="ms-tot"><b>{ft(m.newFeet)}</b>{m.gates.single + m.gates.double ? `, ${m.gates.single + m.gates.double} ${m.gates.single + m.gates.double === 1 ? "gate" : "gates"}` : ""}{m.tearoutFeet ? `, ${ft(m.tearoutFeet)} out` : ""}</span>
    </div>
    {!KEY ? <div className="ms-map ms-off">{draw.runs.length ? <PlanView d={draw} height={320} /> : <p><b>Drawing on the satellite map turns on with your account.</b> Until then, type the feet on the job and the quote prices it the same way.</p>}</div>
      : mapErr ? <div className="ms-map ms-off"><p>{mapErr}</p></div>
      : <div ref={box} className="ms-map" aria-label="Satellite map. Tap along the property line to draw the fence." />}
    {draw.runs.length > 0 && <ul className="ms-runs">{draw.runs.map((r, i) => <li key={r.id} className={r.id === active ? "on" : ""}><button type="button" onClick={() => { setActive(r.id); setMode(r.kind === "tearout" ? "tearout" : "fence"); }}>
      <span>{r.kind === "tearout" ? "Tear-out" : `Run ${draw.runs.filter((x, j) => j <= i && x.kind === "new").length}`}</span><b>{ft(runFeet(r))}</b></button></li>)}</ul>}
    <p className="sec" style={{ marginTop: 12 }}>Fence types<small>pick one, or two or three for good / better / best</small></p>
    {!types.length ? <p className="fine">Set up your fence types once in Settings, Fence types: post spacing, rails, pickets, concrete, and your price per foot.</p>
      : <div className="ms-types">{types.map(t => { const on = pick.includes(t.id), tk = drawn ? takeoff(draw, t) : null;
        return <label key={t.id} className={"ms-type" + (on ? " on" : "")}><input type="checkbox" checked={on} disabled={!on && pick.length >= 3} onChange={() => setPick(p => on ? p.filter(x => x !== t.id) : [...p, t.id])} />
          <span><b>{t.name}, {t.height} ft</b><small>{t.price.perFoot ? `${usd(t.price.perFoot)}/ft` : "No price yet"}{tk && t.price.perFoot ? `, about ${usd(Math.round(tk.fenceFeet * t.price.perFoot + tk.gates.single * t.price.gateSingle + tk.gates.double * t.price.gateDouble))}` : ""}</small></span></label>; })}</div>}
    {k && drawn && <><p className="sec" style={{ marginTop: 12 }}>Materials for {chosen[0].name}<small>your cost, never on the quote</small></p>
      <table className="tbl flush"><tbody>{k.materials.map(x => <tr key={x.name}><td>{x.name}</td><td className="num">{x.qty} {x.unit}</td><td className="num mut">{x.cost ? usd(x.cost) : "–"}</td></tr>)}
        <tr><td><b>Materials</b></td><td /><td className="num"><b>{usd(k.materialCost)}</b></td></tr>{k.laborCost > 0 && <tr><td>Labor at your rate</td><td /><td className="num mut">{usd(k.laborCost)}</td></tr>}</tbody></table></>}
  </Sheet>;
}

/** Settings: the fence types an owner sells, each set once. Starts from common residential layouts with no prices. */
export function FenceTypesEditor({ ctx }: { ctx: Ctx }) {
  const saved = useMemo(() => cleanFenceTypes(ctx.d.setup?.fence_types ?? "[]"), [ctx.d.setup?.fence_types]);
  const [edit, setEdit] = useState<FenceType[] | null>(null), [busy, setBusy] = useState(false);
  const start = () => setEdit(saved.length ? saved.map(t => ({ ...t, cost: { ...t.cost }, price: { ...t.price } })) : FENCE_STARTERS.map((s, i) => ({ ...s, id: `t${i + 1}`,
    cost: { post: 0, gatePost: 0, rail: 0, picket: 0, concrete: 0, gateSingle: 0, gateDouble: 0, laborPerFoot: 0 }, price: { perFoot: 0, gateSingle: 0, gateDouble: 0, tearoutPerFoot: 0 } })));
  const save = async () => { if (!edit) return; setBusy(true);
    try { await ctx.api("/api/app/act", { p: ctx.project, action: "fencetypes", input: edit }); ctx.toast("Fence types saved."); await ctx.reload(); setEdit(null); }
    catch (e) { ctx.toast(e instanceof Error ? e.message : "Didn't save.", true); } finally { setBusy(false); } };
  const set = (i: number, p: (t: FenceType) => FenceType) => setEdit(e => e ? e.map((t, j) => j === i ? p(t) : t) : e);
  const n = (v: string) => Number(v.replace(/[^\d.]/g, "")) || 0;
  return <li style={{ height: "auto", padding: "8px 0", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
    <span>Fence types<small className="mut" style={{ display: "block" }}>{saved.length ? `${saved.length} set up: ${saved.map(t => t.name).join(", ")}.` : "For measure-to-quote: how each fence you sell is built and priced, set once."}</small></span>
    {!edit ? <span className="acts-row"><button type="button" className="btn sm" onClick={start}>{saved.length ? "Edit fence types" : "Set up fence types"}</button></span>
      : <div className="ft-edit">{edit.map((t, i) => <fieldset key={t.id} className="ft-row">
        <div className="ft-h"><input className="input sm" aria-label="Name" value={t.name} onChange={e => set(i, x => ({ ...x, name: e.target.value }))} />
          <label>Height <input className="input sm" inputMode="decimal" value={t.height} onChange={e => set(i, x => ({ ...x, height: n(e.target.value) }))} /> ft</label>
          <button type="button" className="btn ghost sm ic" aria-label={`Remove ${t.name}`} onClick={() => setEdit(e => e!.filter((_, j) => j !== i))}><Icon name="x" size={12} /></button></div>
        <div className="ft-grid">
          {([["Price per foot", "price", "perFoot"], ["Walk gate price", "price", "gateSingle"], ["Drive gate price", "price", "gateDouble"], ["Tear-out per foot", "price", "tearoutPerFoot"]] as const).map(([l, g, f]) =>
            <label key={f + g}>{l}<span className="inwrap"><i>$</i><input inputMode="decimal" value={t[g][f] || ""} onChange={e => set(i, x => ({ ...x, [g]: { ...x[g], [f]: n(e.target.value) } }))} /></span></label>)}
          <label>Posts every<input className="input sm" inputMode="decimal" value={t.postSpacing} onChange={e => set(i, x => ({ ...x, postSpacing: n(e.target.value) }))} /></label>
          <label>Rails a section<input className="input sm" inputMode="decimal" value={t.railsPerSection} onChange={e => set(i, x => ({ ...x, railsPerSection: n(e.target.value) }))} /></label>
          <label>{t.infill} per foot<input className="input sm" inputMode="decimal" value={t.picketsPerFoot} onChange={e => set(i, x => ({ ...x, picketsPerFoot: n(e.target.value) }))} /></label>
          <label>Concrete bags a post<input className="input sm" inputMode="decimal" value={t.concretePerPost} onChange={e => set(i, x => ({ ...x, concretePerPost: n(e.target.value) }))} /></label>
          {([["Post cost", "post"], ["Gate post cost", "gatePost"], ["Rail cost", "rail"], [`${t.infill} cost`, "picket"], ["Concrete bag cost", "concrete"], ["Walk gate kit cost", "gateSingle"], ["Drive gate kit cost", "gateDouble"], ["Labor cost per foot", "laborPerFoot"]] as const).map(([l, f]) =>
            <label key={f} className="mut">{l}<span className="inwrap"><i>$</i><input inputMode="decimal" value={t.cost[f] || ""} onChange={e => set(i, x => ({ ...x, cost: { ...x.cost, [f]: n(e.target.value) } }))} /></span></label>)}
        </div></fieldset>)}
        <span className="acts-row"><button type="button" className="btn ghost sm" onClick={() => setEdit(e => [...e!, { ...FENCE_STARTERS[0], name: "New fence type", id: "t" + Date.now().toString(36), cost: { post: 0, gatePost: 0, rail: 0, picket: 0, concrete: 0, gateSingle: 0, gateDouble: 0, laborPerFoot: 0 }, price: { perFoot: 0, gateSingle: 0, gateDouble: 0, tearoutPerFoot: 0 } }])} disabled={edit.length >= 12}><Icon name="plus" size={13} />Add a type</button>
          <span style={{ flex: 1 }} /><button type="button" className="btn ghost sm" onClick={() => setEdit(null)}>Cancel</button><button type="button" className="btn sm ink" disabled={busy} onClick={() => void save()}>{busy ? <Spinner /> : "Save fence types"}</button></span>
      </div>}
  </li>;
}

// ---------- Fence job paperwork ----------
/**
 * The paperwork a fence job needs before anyone digs: 811 locate, permit, HOA, the line or survey pins, and the
 * customer's sign-off on the line. The office fills it in; the crew sees it (ticket number and line photos) read-only.
 */
export function PaperworkBox({ ctx, card, canEdit }: { ctx: Ctx; card: Card; canEdit: boolean }) {
  const today = new Date().toLocaleDateString("en-CA");
  const saved = cleanPaperwork(card.paperwork ?? {});
  const [p, setP] = useState<Paperwork | null>(null), [busy, setBusy] = useState(false);
  const items = paperworkItems(saved, today), done = items.filter(i => i.done).length;
  const loc = locateLine(saved, today), blockers = digBlockers(saved, card.install);
  const linePhotos = (card.photos ?? []).filter(x => /locate|811|line|pin|survey|marks/i.test(x.caption));
  const save = async () => { if (!p) return; setBusy(true);
    try { await ctx.api("/api/app/act", { p: ctx.project, action: "paperwork", thread: card.id, input: p }); ctx.toast("Paperwork saved."); await ctx.reload(); setP(null); }
    catch (e) { ctx.toast(e instanceof Error ? e.message : "Didn't save.", true); } finally { setBusy(false); } };
  const addPhoto = async (f: File, caption: string) => { setBusy(true);
    try { await ctx.api("/api/app/act", { p: ctx.project, action: "photo", thread: card.id, kind: "during", caption, data: await shrink(f) }); ctx.toast("Photo added."); await ctx.reload(); }
    catch (e) { ctx.toast(e instanceof Error ? e.message : "That photo didn't go up.", true); } finally { setBusy(false); } };
  const set = <K extends keyof Paperwork>(k: K, v: Partial<Paperwork[K]>) => setP(x => x ? { ...x, [k]: { ...x[k], ...v } } : x);
  return <section className="card"><div className="hd"><h2>Paperwork</h2><small style={{ marginLeft: "auto" }} className={blockers.length ? "pw-warn" : ""}>{loc.text}</small></div>
    {!p ? <>
      <ul className="pw-list">{items.map(i => <li key={i.key} className={i.done ? "done" : ""}>{i.done ? <Icon name="check" size={13} /> : <i className="pw-open" aria-hidden="true" />}<span>{i.label}</span><small>{i.key === "locate" && saved.locate.ticket ? `#${saved.locate.ticket}, ${i.text.charAt(0).toLowerCase() + i.text.slice(1)}` : i.text}</small></li>)}</ul>
      {blockers.length > 0 && <p className="fine pw-warn" role="alert">Not clear to dig on {new Date(card.install + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}: {blockers.join(" ")}</p>}
      {linePhotos.length > 0 && <div className="pw-photos">{linePhotos.slice(0, 6).map(x => <a key={x.id} href={photoSrc(x.id)} target="_blank" rel="noreferrer"><img src={photoSrc(x.id)} alt={x.caption} loading="lazy" /><small>{x.caption}</small></a>)}</div>}
      <div className="acts-row end" style={{ marginTop: 6 }}>
        <label className={"btn sm" + (busy ? " busy" : "")}><Icon name="upload" size={13} />Photo of the marks<input type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void addPhoto(f, "Locate marks"); e.target.value = ""; }} /></label>
        {canEdit && <button type="button" className="btn sm" onClick={() => setP(saved)}>{done ? "Update" : "Fill in"}</button>}
      </div>
    </> : <div className="pw-form">
      <fieldset><legend>Utility locate (811)</legend>
        <label>Ticket number<input className="input sm" value={p.locate.ticket} maxLength={40} onChange={e => set("locate", { ticket: e.target.value })} placeholder="A2611170042" /></label>
        <label>Requested<input className="input sm" type="date" value={p.locate.requested ?? ""} onChange={e => set("locate", { requested: e.target.value || null, ...(e.target.value && !p.locate.clears ? { clears: addBusinessDays(e.target.value, 3) } : {}) })} /></label>
        <label>Clears on<input className="input sm" type="date" value={p.locate.clears ?? ""} onChange={e => set("locate", { clears: e.target.value || null })} /><small>3 business days after the call by default. Check your state&rsquo;s rule.</small></label></fieldset>
      <fieldset><legend>Permit</legend>
        <label>Needed?<select className="input sm" value={p.permit.needed} onChange={e => set("permit", { needed: e.target.value as Paperwork["permit"]["needed"] })}><option value="">Not checked</option><option value="yes">Yes</option><option value="no">No</option></select></label>
        {p.permit.needed === "yes" && <><label>Permit number<input className="input sm" value={p.permit.number} maxLength={40} onChange={e => set("permit", { number: e.target.value })} /></label>
          <label>Approved<input className="input sm" type="date" value={p.permit.approved ?? ""} onChange={e => set("permit", { approved: e.target.value || null })} /></label></>}</fieldset>
      <fieldset><legend>HOA</legend>
        <label>In an HOA?<select className="input sm" value={p.hoa.needed} onChange={e => set("hoa", { needed: e.target.value as Paperwork["hoa"]["needed"] })}><option value="">Not checked</option><option value="yes">Yes</option><option value="no">No</option></select></label>
        {p.hoa.needed === "yes" && <label>Approved<input className="input sm" type="date" value={p.hoa.approved ?? ""} onChange={e => set("hoa", { approved: e.target.value || null })} /></label>}</fieldset>
      <fieldset><legend>Property line</legend>
        <label>Pins or survey confirmed<input className="input sm" type="date" value={p.pins.confirmed ?? ""} onChange={e => set("pins", { confirmed: e.target.value || null })} /></label>
        <label>Note<input className="input sm" value={p.pins.note} maxLength={200} onChange={e => set("pins", { note: e.target.value })} placeholder="Pins found at both back corners" /></label>
        <label>Customer signed off on the line<input className="input sm" type="date" value={p.signoff.on ?? ""} onChange={e => set("signoff", { on: e.target.value || null })} /></label>
        <label>Signed by<input className="input sm" value={p.signoff.by} maxLength={80} onChange={e => set("signoff", { by: e.target.value })} placeholder={card.name} /></label></fieldset>
      <div className="acts-row end"><button type="button" className="btn ghost sm" onClick={() => setP(null)}>Cancel</button><button type="button" className="btn sm ink" disabled={busy} onClick={() => void save()}>{busy ? <Spinner /> : "Save paperwork"}</button></div>
    </div>}
  </section>;
}
