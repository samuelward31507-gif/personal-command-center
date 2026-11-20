"use client";

// One signature pad for the app and the customer pages: a job sign-off on the crew's phone, a quote approval on the customer's.
import { useEffect, useRef, useState } from "react";

/** A signature pad: finger or mouse, smooth enough to look like a signature, exported as a small PNG. */
export function SignaturePad({ onChange }: { onChange: (png: string) => void }) {
  const cv = useRef<HTMLCanvasElement>(null), last = useRef<{ x: number; y: number } | null>(null), ink = useRef(false), [inked, setInked] = useState(false);
  useEffect(() => { const c = cv.current!; const r = c.getBoundingClientRect(); c.width = Math.round(r.width * 2); c.height = Math.round(r.height * 2);
    const g = c.getContext("2d")!; g.scale(2, 2); g.lineWidth = 2.2; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#121417"; }, []);
  const at = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const done = () => { last.current = null; if (!ink.current) return; const c = cv.current!, out = document.createElement("canvas"); out.width = 600; out.height = Math.round(600 * c.height / c.width);
    out.getContext("2d")!.drawImage(c, 0, 0, out.width, out.height); onChange(out.toDataURL("image/png")); };
  return <div className="sigpad">
    <canvas ref={cv} aria-label="Sign here" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); last.current = at(e); }}
      onPointerMove={e => { if (!last.current) return; const p = at(e), g = cv.current!.getContext("2d")!; g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(p.x, p.y); g.stroke(); last.current = p; if (!ink.current) { ink.current = true; setInked(true); } }}
      onPointerUp={done} onPointerCancel={done} />
    <span className="sigline" aria-hidden="true">Sign here</span>
    {inked && <button type="button" className="link sigclear" onClick={() => { const c = cv.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); ink.current = false; setInked(false); onChange(""); }}>Clear</button>}
  </div>;
}

