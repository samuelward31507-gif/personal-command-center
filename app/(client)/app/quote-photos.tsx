"use client";
// Photos on a quote: one picture on each option (a past install of that fence), or on the main lines of a plain quote.
// Picked from this job's photos and the after photos of past jobs, or uploaded here. The customer sees them on the quote.
import { useRef, useState } from "react";
import { tiersOf, type Item } from "@/lib/billing";
import { quotePhotoSrc } from "@/lib/quote-photo";
import type { Card } from "@/lib/crm";
import { Icon, Sheet, Spinner, type Api, type Toast } from "./parts";
import { shrink } from "./photos";
import type { Data } from "./types";

const SAMPLES: [string, string][] = [["demo:pine", "Pine privacy"], ["demo:cedar", "Cedar privacy"], ["demo:cedar-cap", "Cedar with cap and trim"], ["demo:horizontal", "Horizontal cedar"],
  ["demo:vinyl-white", "White vinyl"], ["demo:vinyl-lattice", "Vinyl with lattice"], ["demo:vinyl-tan", "Tan vinyl"], ["demo:chain", "Chain link"], ["demo:ranch", "Ranch rail"]];

/** Which lines carry a photo: the first line of each option, else the first few lines that aren't add-ons. */
function slots(items: Item[]): { k: number; label: string }[] {
  const tiers = tiersOf(items);
  if (tiers.length) return tiers.map(tr => { const k = items.findIndex(i => i.tier === tr); return { k, label: `${tr}: ${items[k].name}` }; });
  return items.map((i, k) => ({ i, k })).filter(({ i }) => i.name.trim() && !i.opt).slice(0, 4).map(({ i, k }) => ({ k, label: i.name }));
}

export function QuotePhotos({ items, setItems, card, d, api, project, toast }: { items: Item[]; setItems: (f: (x: Item[]) => Item[]) => void; card: Card; d: Data; api: Api; project: string; toast: Toast }) {
  const [picking, setPicking] = useState<number | null>(null);
  const list = slots(items);
  if (!list.length) return null;
  const put = (k: number, photo: string | undefined) => setItems(x => x.map((it, j) => j === k ? { ...it, photo } : it));
  return <section><p className="sec">Photos they&rsquo;ll see<small>a past install sells the fence better than words</small></p>
    <div className="qp-grid">{list.map(({ k, label }) => { const src = quotePhotoSrc(items[k]?.photo);
      return <div key={k} className="qp-slot">
        {src ? <button type="button" className="qp-img" onClick={() => setPicking(k)} aria-label={`Change the photo for ${label}`}><img src={src} alt="" /></button>
          : <button type="button" className="qp-add" onClick={() => setPicking(k)}><Icon name="plus" size={14} />Add a photo</button>}
        <span className="qp-l">{label}</span>
        {src && <button type="button" className="link qp-x" onClick={() => put(k, undefined)}>Remove</button>}
      </div>; })}</div>
    {picking !== null && <PhotoPicker card={card} d={d} api={api} project={project} toast={toast} onClose={() => setPicking(null)} onPick={id => { put(picking, id); setPicking(null); }} />}
  </section>;
}

function PhotoPicker({ card, d, api, project, toast, onClose, onPick }: { card: Card; d: Data; api: Api; project: string; toast: Toast; onClose: () => void; onPick: (id: string) => void }) {
  const file = useRef<HTMLInputElement>(null), [busy, setBusy] = useState(false);
  // This job's photos first, then after photos from other jobs: the owner's own past installs.
  const mine = (card.photos ?? []).map(p => ({ id: p.id, who: "This job" }));
  const past = (d.board ?? []).filter(c => c.id !== card.id).flatMap(c => (c.photos ?? []).filter(p => p.kind === "after").map(p => ({ id: p.id, who: c.name || "Past job" })));
  const all = [...mine, ...past].filter((p, i, a) => a.findIndex(x => x.id === p.id) === i).slice(0, 30);
  const upload = async (f: File | undefined) => {
    if (!f) return; setBusy(true);
    try { const data = await shrink(f); const r = await api<{ id: string }>("/api/app/act", { p: project, thread: card.id, action: "photo", kind: "other", data }); onPick(r.id); }
    catch (e) { toast(e instanceof Error ? e.message : "That photo didn't upload.", true); } finally { setBusy(false); }
  };
  return <Sheet title="Pick a photo" sub="Shown on the quote, next to this option" onClose={onClose}
    foot={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn ink" disabled={busy} onClick={() => file.current?.click()}>{busy ? <Spinner /> : <Icon name="upload" size={14} />}Upload a photo</button>
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => void upload(e.target.files?.[0])} /></>}>
    {all.length ? <div className="qp-pick">{all.map(p => <button key={p.id} type="button" onClick={() => onPick(p.id)}><img src={quotePhotoSrc(p.id)} alt="" /><span>{p.who}</span></button>)}</div>
      : <p className="fine">No job photos yet. Upload one of a fence you&rsquo;ve put in, or add after photos to your finished jobs and they show up here.</p>}
    {d.project === "demo" && <><p className="sec" style={{ marginTop: 16 }}>Sample drawings<small>the example business only</small></p>
      <div className="qp-pick">{SAMPLES.map(([id, l]) => <button key={id} type="button" onClick={() => onPick(id)}><img src={quotePhotoSrc(id)} alt="" /><span>{l}</span></button>)}</div></>}
  </Sheet>;
}
