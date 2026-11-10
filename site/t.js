/* Cinder site analytics: anonymous, no cookies. A random visitor id (this browser) and session id (this tab),
   page views, time on page, booking clicks, demo plays and calculator use, sent to /api/t. Never blocks the page. */
(function () {
  try {
    var rid = function () { return (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 20); };
    var get = function (s, k) { try { return s.getItem(k); } catch (e) { return null; } };
    var set = function (s, k, v) { try { s.setItem(k, v); } catch (e) { /* private mode */ } };
    var vid = get(localStorage, "cinder.vid") || rid(); set(localStorage, "cinder.vid", vid);
    var sid = get(sessionStorage, "cinder.sid") || rid(); set(sessionStorage, "cinder.sid", sid);
    var q = new URLSearchParams(location.search);
    // Personal demo links (watch?n=Mark&b=JC+Fence) tell Cinder which prospect is looking. Kept for the session.
    if (q.get("b")) { set(sessionStorage, "cinder.b", q.get("b")); set(sessionStorage, "cinder.n", q.get("n") || ""); }
    var who = { n: get(sessionStorage, "cinder.n") || "", b: get(sessionStorage, "cinder.b") || "" };
    var utm = { source: q.get("utm_source") || "", medium: q.get("utm_medium") || "", campaign: q.get("utm_campaign") || "" };
    var mobile = matchMedia("(max-width: 700px)").matches;
    var send = function (type, extra) {
      var body = JSON.stringify(Object.assign({ type: type, vid: vid, sid: sid, path: location.pathname, ref: document.referrer, utm: utm, n: who.n, b: who.b, mobile: mobile }, extra || {}));
      if (navigator.sendBeacon && navigator.sendBeacon("/api/t", new Blob([body], { type: "text/plain" }))) return;
      fetch("/api/t", { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(function () {});
    };
    send("view");
    var shown = Date.now(), visible = 0, left = false;
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") { visible += Date.now() - shown; if (!left) { left = true; send("leave", { ms: visible }); } }
      else { shown = Date.now(); left = false; }
    });
    addEventListener("pagehide", function () { if (!left) { left = true; send("leave", { ms: visible + Date.now() - shown }); } });
    document.addEventListener("click", function (e) {
      var el = e.target && e.target.closest ? e.target.closest("a,button,[data-track]") : null;
      if (!el) return;
      var href = el.getAttribute("href") || "", text = (el.textContent || "").trim().slice(0, 60);
      var label = el.getAttribute("data-track") || (/cal\.com/.test(href) ? "Book: cal.com" : href === "#book" || /book/i.test(text) ? "Book: " + text : /watch|demo|play/i.test(href + " " + text) ? "Demo: " + text : "");
      if (label) send("click", { label: label });
    }, true);
    document.addEventListener("play", function (e) { var v = e.target; if (v && v.tagName === "VIDEO") send("play", { label: (v.currentSrc || "").split("/").pop() }); }, true);
    var calcSent = false;
    document.addEventListener("input", function (e) { if (calcSent) return; var t = e.target; if (t && t.closest && t.closest("[class*=calc], #calc, [data-calc]")) { calcSent = true; send("calc", { label: "calculator" }); } }, true);
    window.cinderTrack = send;
  } catch (e) { /* never break the site */ }
})();
