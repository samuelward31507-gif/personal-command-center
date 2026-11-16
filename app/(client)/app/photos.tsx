"use client";

// Job photos on a customer's record: taken on the phone, shrunk there before upload, tagged Before or After.
// Private to the business. Tap one to see it large or remove it.
import { useState } from "react";
import type { Photo } from "@/lib/crm";
import { Icon, Spinner, dateLabel, type Api, type Toast } from "./parts";

const KIND: Record<Photo["kind"], string> = { before: "Before", during: "During", after: "After", other: "Photo" };
/** Demo photos carry their image in the id; real ones load from the app. */
export const photoSrc = (id: string) => (id.startsWith("data:") ? id : `/api/app/photo?id=${id}`);

/** Resize to at most 1600px on the long side and keep the file under ~850KB: a phone photo becomes ~300KB. */
export async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
  cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height);
  for (const q of [0.82, 0.7, 0.55, 0.4]) { const url = cv.toDataURL("image/jpeg", q); if (url.length * 0.75 < 850_000) return url; }
  throw new Error("That photo is too large.");
}

export function Photos({ thread, photos, stage, project, api, toast, reload }: { thread: string; photos: Photo[]; stage: string; project: string; api: Api; toast: Toast; reload: () => Promise<void> }) {
  const [kind, setKind] = useState<"before" | "after">(stage === "won" ? "after" : "before");
  const [busy, setBusy] = useState(0), [big, setBig] = useState<Photo | null>(null), [arm, setArm] = useState(false);
  async function add(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].filter(f => f.type.startsWith("image/")).slice(0, 12);
    setBusy(list.length); let done = 0;
    for (const f of list) {
      try { await api("/api/app/act", { p: project, action: "photo", thread, kind, data: await shrink(f) }); done++; }
      catch (e) { toast(e instanceof Error ? e.message : "A photo didn't upload.", true); }
      setBusy(n => n - 1);
    }
    if (done) { toast(`${done} ${done === 1 ? "photo" : "photos"} added.`); await reload(); }
  }
  async function remove(p: Photo) {
    try { await api("/api/app/act", { p: project, action: "photodelete", photo: p.id }); toast("Photo removed."); setBig(null); setArm(false); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "Didn't remove it.", true); }
  }
  return <section className="photos-sec">
    <p className="sec">Photos<small>{photos.length ? `${photos.length}` : ""}</small></p>
    {photos.length > 0 && <div className="pgrid">{photos.map(p => <button key={p.id} type="button" className="pth" onClick={() => setBig(p)} aria-label={`${KIND[p.kind]} photo, ${dateLabel(p.at)}`}>
      <img src={photoSrc(p.id)} alt="" loading="lazy" /><span>{KIND[p.kind]}</span></button>)}</div>}
    <div className="acts-row">
      <div className="seg" role="radiogroup" aria-label="Tag new photos as">{(["before", "after"] as const).map(k => <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{KIND[k]}</button>)}</div>
      <label className="btn sm"><input type="file" accept="image/*" multiple hidden onChange={e => { void add(e.target.files); e.target.value = ""; }} />{busy ? <><Spinner />{busy} left</> : <><Icon name="upload" size={13} />Add photos</>}</label>
      {photos.some(p => p.kind === "after") && <button type="button" className="btn sm ghost" title="Text the customer their finished-job photos" onClick={async () => { try { await api("/api/app/act", { p: project, action: "photoreport", thread }); toast("Photo report sent."); } catch (e) { toast(e instanceof Error ? e.message : "Didn't send.", true); } }}>Send photo report</button>}
    </div>
    {big && <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) { setBig(null); setArm(false); } }}>
      <div className="lightbox" role="dialog" aria-label="Photo">
        <img src={photoSrc(big.id)} alt={`${KIND[big.kind]} photo`} />
        <div className="lb-foot"><span>{KIND[big.kind]}, {dateLabel(big.at)}</span><span style={{ flex: 1 }} />
          <a className="btn sm" href={photoSrc(big.id)} target="_blank" rel="noreferrer">Open full size</a>
          <button type="button" className="btn sm danger" onClick={() => arm ? void remove(big) : setArm(true)}>{arm ? "Tap again to remove" : "Remove"}</button>
          <button type="button" className="btn sm" onClick={() => { setBig(null); setArm(false); }}>Close</button></div>
      </div>
    </div>}
  </section>;
}
