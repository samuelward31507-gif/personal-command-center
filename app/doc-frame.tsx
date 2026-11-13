"use client";

import { useEffect, useRef, useState } from "react";

/** Shows a generated document (agreement, proposal) exactly as it prints: its own styles, isolated in a frame that grows to fit. */
export function DocFrame({ html, title, className }: { html: string; title: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(1200);
  useEffect(() => {
    const f = ref.current;
    if (!f) return;
    const fit = () => { const d = f.contentDocument; if (d?.body) setH(d.documentElement.scrollHeight + 4); };
    f.addEventListener("load", fit);
    const t = setInterval(fit, 700);
    return () => { f.removeEventListener("load", fit); clearInterval(t); };
  }, [html]);
  return <iframe ref={ref} title={title} srcDoc={html} className={className} style={{ width: "100%", height: h, border: 0, display: "block", borderRadius: 12, background: "#e7e6e2" }} />;
}
