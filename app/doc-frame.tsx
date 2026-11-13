"use client";

import { useEffect, useRef, useState } from "react";

/** Shows a generated document (agreement, proposal) exactly as it prints, isolated in its own frame. Long documents scroll inside it instead of stretching the page. */
export function DocFrame({ html, title, className }: { html: string; title: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(1200);
  useEffect(() => {
    const f = ref.current;
    if (!f) return;
    const fit = () => { const d = f.contentDocument; if (d?.body) setH(Math.min(d.documentElement.scrollHeight + 4, 1150)); };
    f.addEventListener("load", fit);
    const t = setInterval(fit, 700);
    return () => { f.removeEventListener("load", fit); clearInterval(t); };
  }, [html]);
  return <iframe ref={ref} title={title} srcDoc={html} className={className} style={{ width: "100%", height: h, border: 0, display: "block", borderRadius: 12, background: "#e7e6e2" }} />;
}
