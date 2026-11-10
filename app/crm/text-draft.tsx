"use client";
// Drafted voicemail / info text after a call outcome. Cinder never sends it:
// Sam edits it, copies it or opens his Messages app, then taps Mark sent so it's logged.
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useWorkspace } from "../use-workspace";
import { voicemailText, infoText, callTimeText, smsHref, quietHoursWarning, pickDemoLink, TEMPLATE_LABEL, type TextTemplate } from "@/lib/sms-templates";

export type TextContext = {
  template: TextTemplate | null; notice: string | null;
  firstName: string; timeZone: string | null; callAt: string; demoLink: string; phone: string; slots: string[]; niche?: string;
  tasks?: { title: string; due: string }[]; closed?: boolean;
};

const box: CSSProperties = { marginTop: 12, padding: 16, border: "1px solid var(--u-line, #e7e7e4)", borderRadius: 14, background: "var(--u-sheet, #ffffff)" };
const field: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--u-line, #e7e7e4)", background: "var(--u-bg, #f6f6f4)", color: "var(--u-text, #121417)", font: "inherit", fontSize: 14, lineHeight: 1.45, resize: "vertical" };
const btn: CSSProperties = { justifyContent: "center", fontSize: 13, padding: "9px 12px" };
const warn: CSSProperties = { margin: "8px 0 0", fontSize: 12.5, color: "#c69619" };

function dueLabel(iso: string, tz: string | null) {
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz ?? "America/Denver", timeZoneName: "short" });
}

export default function TextDraft({ ctx, contactId, who, onDone, primaryClass = "crm-btn crm-btn-primary", quietClass = "crm-btn crm-btn-quiet" }: {
  ctx: TextContext; contactId: string; who: string; onDone?: () => void; primaryClass?: string; quietClass?: string;
}) {
  const ws = useWorkspace();
  // A demo link set in Settings (an overview Loom) wins; otherwise the trade's default the server picked.
  const demo = pickDemoLink("", ws.demoLink) === pickDemoLink("", "") ? ctx.demoLink : pickDemoLink("", ws.demoLink);
  const [slot1, setSlot1] = useState(ctx.slots[0] ?? "10am");
  const [slot2, setSlot2] = useState(ctx.slots[1] ?? "2pm");
  const generated = useMemo(() => {
    if (ctx.template === "T-VM") return voicemailText({ firstName: ctx.firstName, callTime: callTimeText(new Date(ctx.callAt), ctx.timeZone), demoLink: demo, niche: ctx.niche });
    if (ctx.template === "T-INFO") return infoText({ firstName: ctx.firstName, demoLink: demo, slot1, slot2, niche: ctx.niche });
    return "";
  }, [ctx, slot1, slot2, demo]);
  const [body, setBody] = useState(generated);
  const [edited, setEdited] = useState(false);
  useEffect(() => { if (!edited) setBody(generated); }, [generated, edited]);
  const [state, setState] = useState<"idle" | "copied" | "saving" | "sent" | "skipped">("idle");
  const [error, setError] = useState<string | null>(null);

  const tasks = ctx.tasks ?? [];
  const taskLine = tasks.length ? <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#515862" }}>Added to Tasks: {tasks.map(t => `${t.title} · ${dueLabel(t.due, ctx.timeZone)}`).join("; ")}</p>
    : ctx.closed ? <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#515862" }}>No answer after both redials. Closed out, no more reminders.</p> : null;

  if (state === "sent" || state === "skipped") return <div style={box} role="status"><p style={{ margin: 0, fontSize: 13.5, color: "#25282d" }}>{state === "sent" ? `Logged: text sent to ${who}.` : "Skipped. Nothing was logged."}</p>{taskLine}</div>;
  if (!ctx.template) return ctx.notice || taskLine ? <div style={box}>{ctx.notice && <p style={{ margin: 0, fontSize: 13.5, color: ctx.notice.startsWith("No texts") ? "#a31414" : "#c69619" }}>{ctx.notice}</p>}{taskLine}</div> : null;

  const quiet = quietHoursWarning(new Date(), ctx.timeZone);
  const needsName = ctx.template === "T-INFO" && !ctx.firstName.trim();

  async function copy() {
    try { await navigator.clipboard.writeText(body); setState("copied"); } catch { setError("Couldn't copy. Select the text and copy it by hand."); }
  }
  async function markSent() {
    setState("saving"); setError(null);
    try {
      const r = await fetch("/api/contacts/texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId, direction: "outbound", template: ctx.template, body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't log it.");
      setState("sent"); onDone?.();
    } catch (e) { setState("idle"); setError(e instanceof Error ? e.message : "Couldn't log it."); }
  }

  return (
    <div style={box}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <b style={{ fontSize: 14 }}>{TEMPLATE_LABEL[ctx.template]} for {who}</b>
        <span style={{ fontSize: 12, color: "#515862" }}>Nothing sends from Cinder. You send it from your phone.</span>
      </div>
      {needsName && <p style={warn}>No first name on this contact. Add one, or edit the greeting before you send.</p>}
      {quiet && <p style={warn}>{quiet}</p>}
      {ctx.template === "T-INFO" && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", fontSize: 12.5, color: "#515862" }}>
          Times (their time):
          <input value={slot1} onChange={e => setSlot1(e.target.value.slice(0, 20))} aria-label="First time option" style={{ ...field, width: 90, padding: "6px 8px", fontSize: 13 }} />
          <input value={slot2} onChange={e => setSlot2(e.target.value.slice(0, 20))} aria-label="Second time option" style={{ ...field, width: 90, padding: "6px 8px", fontSize: 13 }} />
        </div>
      )}
      <textarea rows={7} value={body} onChange={e => { setBody(e.target.value); setEdited(true); }} aria-label="Text draft" style={{ ...field, marginTop: 10 }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: body.length > 320 ? "#c69619" : "#828891", marginTop: 4 }}>
        <span>{edited ? <button type="button" onClick={() => { setEdited(false); setBody(generated); }} style={{ background: "none", border: 0, color: "#515862", padding: 0, cursor: "pointer", fontSize: 12 }}>Reset to template</button> : "Edit anything before you send."}</span>
        <span>{body.length} characters{body.length > 160 ? ` · ${Math.ceil(body.length / 153)} SMS segments` : ""}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 6, marginTop: 10 }}>
        <button type="button" className={primaryClass} data-variant="primary" style={btn} onClick={() => void copy()}>{state === "copied" ? "Copied ✓" : "Copy"}</button>
        {ctx.phone ? <a className={quietClass} data-variant="primary" style={{ ...btn, textDecoration: "none", display: "inline-flex", alignItems: "center" }} href={smsHref(ctx.phone, body)} onClick={() => { void markSent(); }}>Open in Messages</a>
          : <button type="button" className={quietClass} data-variant="primary" style={btn} disabled title="No phone number on this contact">Open in Messages</button>}
        <button type="button" className={quietClass} data-variant="primary" style={btn} disabled={state === "saving" || !body.trim()} onClick={() => void markSent()}>{state === "saving" ? "Logging…" : "Mark sent"}</button>
        <button type="button" className={quietClass} data-variant="primary" style={btn} onClick={() => setState("skipped")}>Skip</button>
      </div>
      {error && <p style={{ ...warn, color: "#a31414" }} role="alert">{error}</p>}
      {taskLine}
    </div>
  );
}
