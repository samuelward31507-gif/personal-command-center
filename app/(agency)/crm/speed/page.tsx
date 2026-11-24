"use client";
// Speed: is every client's speed-to-lead system working right now? Sam only; clients never see this.
// Reads /api/speed every 60 seconds. A failed text emails Sam at once (client-runtime-run) and the morning email
// lists every client problem, so this screen is where he lands to fix it.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fmtSec, PROMISE_SEC, GUARANTEE_SEC, type ClientHealthRow, type Status } from "@/lib/speed";
import "./speed.css";

type LogLine = { clientId: string; at: string; name: string; level: "fail" | "in" | "ok"; what: string; sec: number | null };
type Data = {
  now: string;
  summary: { broken: number; watch: number; healthy: number; live: number; medianSec: number | null; p95Sec: number | null; leads24h: number; missed24h: number };
  clients: ClientHealthRow[];
  log: LogLine[];
};

const TZ = "America/Denver";
const STATUS: Record<Status, { label: string; cls: string }> = {
  broken: { label: "Broken", cls: "er" }, watch: { label: "Watch", cls: "wn" }, healthy: { label: "Healthy", cls: "ok" }, not_live: { label: "Not live", cls: "nl" },
};
const RANK: Record<Status, number> = { broken: 0, watch: 1, healthy: 2, not_live: 3 };
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const dayTime = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: TZ });
const ago = (iso: string | null, now: number) => {
  if (!iso) return "never";
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

function Spark({ values, status }: { values: number[]; status: Status }) {
  const w = 120, h = 26;
  if (values.length < 2) return <span className="sp-none">{values.length ? fmtSec(values[0]) : "No replies yet"}</span>;
  const max = Math.max(PROMISE_SEC * 1.5, ...values.map(v => Math.min(v, GUARANTEE_SEC)));
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - (Math.min(v, max) / max) * (h - 4)).toFixed(1)}`).join(" ");
  const promiseY = h - 2 - (PROMISE_SEC / max) * (h - 4);
  return (
    <svg className={`sp sp-${STATUS[status].cls}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Last ${values.length} first replies, from ${fmtSec(Math.min(...values))} to ${fmtSec(Math.max(...values))}`}>
      <line x1="0" x2={w} y1={promiseY} y2={promiseY} className="sp-promise" />
      <polyline points={pts} fill="none" />
    </svg>
  );
}

function ReplyChart({ values }: { values: number[] }) {
  const w = 328, h = 96;
  if (!values.length) return <p className="sd-empty">No first replies in the last 30 days.</p>;
  const capped = values.map(v => Math.min(v, GUARANTEE_SEC));
  const max = Math.max(PROMISE_SEC * 2, ...capped);
  const bw = Math.max(3, Math.min(10, (w - (values.length - 1) * 2) / values.length));
  const y = (v: number) => h - (v / max) * (h - 6);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="sd-chart" role="img"
      aria-label={`${values.length} first replies. ${values.filter(v => v <= PROMISE_SEC).length} within ${PROMISE_SEC} seconds.`}>
      <line x1="0" x2={w} y1={y(PROMISE_SEC)} y2={y(PROMISE_SEC)} className="sd-line" />
      {capped.map((v, i) => (
        <rect key={i} x={i * (bw + 2)} y={y(v)} width={bw} height={h - y(v)} rx="2" className={values[i] > PROMISE_SEC ? "sd-bar slow" : "sd-bar"} />
      ))}
    </svg>
  );
}

export default function SpeedPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/speed", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't load client health.");
      setData(j); setError(""); setNow(Date.now());
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load client health."); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  const clients = useMemo(() => [...(data?.clients ?? [])].sort((a, b) => RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name)), [data]);
  const current = clients.find(c => c.id === sel) ?? clients[0] ?? null;
  const log = useMemo(() => (data?.log ?? []).filter(l => l.clientId === current?.id).slice(0, 8), [data, current]);
  const s = data?.summary;
  const today = new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: TZ });

  const sub = !s ? "" : s.live === 0 ? "No client is live yet. Each one shows up here the day their texting number is set."
    : s.broken ? `${s.broken} client${s.broken === 1 ? " is" : "s are"} broken right now. Fix ${s.broken === 1 ? "it" : "them"} before the next lead comes in.`
    : s.watch ? `Every lead is getting answered. ${s.watch} client${s.watch === 1 ? " needs" : "s need"} a look.`
    : `All ${s.live} client${s.live === 1 ? "" : "s"} healthy. Every lead in the last 24 hours got a reply.`;

  return (
    <main className="sd">
      <div className="sd-hdr">
        <div>
          <p className="sd-date">{today}</p>
          <h1>Speed</h1>
          <p className="sd-sub">{data ? sub : error || "Checking every client…"}</p>
          <div className="sd-clock" aria-live="polite"><span className={`sd-pulse${s?.broken ? " er" : ""}`} aria-hidden="true" /><span className={s?.broken ? "er" : "ok"}>{s?.broken ? "Broken" : "Live"}</span><span>Updated {time(new Date(now).toISOString())} · checks every minute · emails you the moment a text fails</span></div>
        </div>
        <div className="sd-acts">
          <button type="button" className="sd-btn" onClick={load}>Check now</button>
          <Link href="/crm/client-success" className="sd-btn p">Connect a client</Link>
        </div>
      </div>

      {error && data && <p className="sd-err" role="alert">{error} <button type="button" className="sd-link" onClick={load}>Try again</button></p>}
      {!data && error && <div className="sd-state"><p>{error}</p><button type="button" className="sd-btn" onClick={load}>Try again</button></div>}
      {!data && !error && <div className="sd-skel" aria-hidden="true"><i /><i /><i /></div>}

      {data && s && <>
        <div className="sd-tele">
          <div><div className="k">Broken now</div><div className={`v${s.broken ? " er" : ""}`}>{s.broken}</div></div>
          <div><div className="k">Clients healthy</div><div className="v">{s.healthy}<small>of {s.live} live</small></div></div>
          <div><div className="k">Typical first reply</div><div className="v">{fmtSec(s.medianSec)}<small>30 days</small></div></div>
          <div><div className="k">Slowest 5%</div><div className="v">{fmtSec(s.p95Sec)}<small>promise {PROMISE_SEC}s</small></div></div>
          <div><div className="k">Leads, 24h</div><div className="v">{s.leads24h}<small>{s.missed24h} missed</small></div></div>
        </div>

        {clients.length === 0 ? (
          <div className="sd-state"><p>No clients yet. Your first one shows up here after setup is paid and their app is set up.</p></div>
        ) : <>
          <div className="sd-grid2">
            <section className="sd-pane" aria-label="Clients">
              <div className="sd-ph">Clients<span>{clients.length} set up · {s.live} live</span></div>
              <div className="sd-cr hd" aria-hidden="true"><span>Client</span><span>Status</span><span>Typical</span><span>First replies, 30 days</span><span className="r">Leads</span></div>
              {clients.map(c => (
                <button type="button" key={c.id} className={`sd-cr${current?.id === c.id ? " sel" : ""}`} onClick={() => setSel(c.id)} aria-pressed={current?.id === c.id}>
                  <b>{c.name}</b>
                  <span className={`sd-st ${STATUS[c.status].cls}`}><i aria-hidden="true" />{STATUS[c.status].label}</span>
                  <span className="num">{fmtSec(c.medianSec)}</span>
                  <Spark values={c.replies} status={c.status} />
                  <span className="num r">{c.leads30d}</span>
                </button>
              ))}
            </section>

            {current && <section className={`sd-alert ${STATUS[current.status].cls}`} aria-label={`${current.name} problems`}>
              {current.status === "not_live" ? <>
                <div className="h"><i aria-hidden="true" />{current.name} isn&apos;t live yet</div>
                <p>It goes live when their texting number is set and the project is active. Until then nothing is watched or alerted.</p>
                <ol><li>Finish setup in their Clients card</li><li>Set the texting number</li><li>Send a test lead from their app</li></ol>
              </> : current.problems.length === 0 ? <>
                <div className="h"><i aria-hidden="true" />{current.name} is healthy</div>
                <p>{current.answered30d} of {current.leads30d} leads in 30 days got a first reply, typically in {fmtSec(current.medianSec)}. Last lead {ago(current.lastLeadAt, now)}.</p>
              </> : <>
                <div className="h"><i aria-hidden="true" />{current.status === "broken" ? `${current.name} is broken` : `${current.name} needs a look`}</div>
                <div className="code">{current.problems.length} problem{current.problems.length === 1 ? "" : "s"} · fix the first one first</div>
                <ol>{current.problems.map((p, i) => <li key={i}><b>{p.text}.</b> {p.fix}</li>)}</ol>
              </>}
            </section>}
          </div>

          {current && <section className="sd-pane sd-flow-pane" aria-label={`How a lead moves for ${current.name}`}>
            <div className="sd-ph">{current.name} · how a lead moves<span>last 30 days</span></div>
            <div className="sd-flow">
              <div className="sd-srcs">
                {current.sources.length ? current.sources.map(src => (
                  <div key={src.source} className="sd-nd"><div className="t"><i className="ok" aria-hidden="true" />{src.source}</div><div className="m"><b>{src.count}</b> · last {ago(src.lastAt, now)}</div></div>
                )) : <div className="sd-nd wn"><div className="t"><i aria-hidden="true" />No leads yet</div><div className="m">Check forwarding and the form</div></div>}
              </div>
              <div className="sd-wire" aria-hidden="true" />
              <div className={`sd-nd ${current.leads30d ? "" : "wn"}`}><div className="t"><i aria-hidden="true" />Received</div><div className="m"><b>{current.leads30d}</b> leads</div></div>
              <div className="sd-wire" aria-hidden="true" />
              <div className={`sd-nd ${current.missed24h ? "er" : current.medianSec != null && current.medianSec > PROMISE_SEC ? "wn" : ""}`}><div className="t"><i aria-hidden="true" />First text sent</div><div className="m">typical <b>{fmtSec(current.medianSec)}</b> · {current.answered30d} of {current.leads30d}</div></div>
              <div className={`sd-wire${current.calendar ? "" : " broken"}`} aria-hidden="true" />
              <div className={`sd-nd ${current.calendar ? "" : "wn"}`}><div className="t"><i aria-hidden="true" />Books the estimate</div><div className="m">{current.calendar ? <>Calendar <b>connected</b></> : <b>Calendar not connected</b>}</div></div>
            </div>
          </section>}

          {current && <div className="sd-grid2">
            <section className="sd-pane" aria-label="Events">
              <div className="sd-ph">Events<span>{current.name}</span></div>
              <div className="sd-log">
                {log.length ? log.map((l, i) => (
                  <div key={i}><time>{dayTime(l.at)}</time><span className={`lv ${l.level}`}>{l.level === "fail" ? "FAIL" : l.level === "in" ? "IN" : "OK"}</span><span><b>{l.what}</b>{l.sec != null ? ` · ${fmtSec(l.sec)} after it came in` : ""}</span></div>
                )) : <p className="sd-empty">Nothing in the last 30 days.</p>}
              </div>
            </section>
            <section className="sd-pane" aria-label="First reply times">
              <div className="sd-ph">First reply · 30 days<span>Promise: under {PROMISE_SEC}s</span></div>
              <div className="sd-lat">
                <ReplyChart values={current.replies} />
                <div className="lrow"><span>{current.replies.filter(v => v <= PROMISE_SEC).length} of {current.replies.length} within {PROMISE_SEC}s</span><span>{current.over60} over {GUARANTEE_SEC}s</span></div>
              </div>
            </section>
          </div>}
        </>}
      </>}
    </main>
  );
}
