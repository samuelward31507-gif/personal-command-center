// The free audit on /audit: posts the form to /api/site-audit and shows what a homeowner runs into on the site,
// a monthly figure from the owner's own numbers, and what to fix first. Everything is written with textContent.
(function () {
  // Phone menu (same as the other pages).
  var mb = document.querySelector(".nav-menu"), sheet = document.getElementById("nav-sheet");
  if (mb && sheet) {
    var setMenu = function (open) { sheet.hidden = !open; mb.setAttribute("aria-expanded", open ? "true" : "false"); document.getElementById("nav").classList.toggle("is-open", open); };
    mb.addEventListener("click", function () { setMenu(sheet.hidden); });
    sheet.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  }

  var form = document.getElementById("aud-form"); if (!form) return;
  var go = document.getElementById("aud-go"), err = document.getElementById("aud-err");
  var empty = document.getElementById("aud-empty"), res = document.getElementById("aud-res");
  var $ = function (id) { return document.getElementById(id); };
  var usd = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };
  var q = new URLSearchParams(location.search), pre = function (k, v) { if (v && form.elements[k]) form.elements[k].value = String(v).replace(/[<>]/g, "").slice(0, 200); };
  pre("business", q.get("b")); pre("website", q.get("site"));

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fail(msg) { err.textContent = msg; err.hidden = false; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    err.hidden = true;
    var f = form.elements, body = {
      business: f.business.value, website: f.website.value, trade: f.trade.value, leads: f.leads.value,
      jobValue: f.jobValue.value, closeRate: f.closeRate.value, speed: f.speed.value, followsUp: f.followsUp.value, fax: f.fax.value,
    };
    if (!body.business.trim()) return fail("Enter your business name.");
    if (!body.website.trim()) return fail("Enter your website, like yourbusiness.com.");
    go.disabled = true; go.textContent = "Checking your site…";
    if (window.cinderTrack) window.cinderTrack("click", { label: "Audit: run" });
    fetch("/api/site-audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) return fail(x.j.error || "The audit didn't finish. Try again in a minute.");
        show(x.j, body);
      })
      .catch(function () { fail("Couldn't reach the audit. Check your connection and try again."); })
      .then(function () { go.disabled = false; go.textContent = "Run it again"; });
  });

  function show(d, body) {
    $("aud-site").textContent = d.business + " · " + d.website;
    $("aud-month").textContent = usd(d.money.month);
    $("aud-sub").textContent = usd(d.money.year) + " a year, about " + d.money.lostJobs + " " + (d.money.lostJobs === 1 ? "job" : "jobs") + " a month, from replies that come too late and quotes nobody chased.";
    var list = $("aud-checks"); list.textContent = "";
    if (!d.reached) {
      var li = el("li", "aud-chk is-unk"); li.appendChild(el("i", "aud-mark")); var s = el("span"); s.appendChild(el("b", null, "We couldn’t load your homepage.")); s.appendChild(document.createTextNode(" It may be blocking automated visits or the address may be off. We’ll check it by hand on the call.")); li.appendChild(s); list.appendChild(li);
    } else d.checks.forEach(function (c) {
      var li = el("li", "aud-chk " + (c.ok ? "is-ok" : "is-bad")); li.appendChild(el("i", "aud-mark"));
      var s = el("span"); s.appendChild(el("b", null, c.label)); s.appendChild(document.createTextNode(" " + c.detail)); li.appendChild(s); list.appendChild(li);
    });
    var fix = $("aud-fix"); fix.textContent = "";
    var items = (d.findings || []).slice();
    if (body.speed !== "5min") items.unshift("New leads hear back " + ({ hour: "within the hour", day: "the same day", next: "the next day or later" })[body.speed] + ". Most homeowners book whoever answers first.");
    if (body.followsUp !== "yes") items.push("Not every quote gets followed up twice, so some people who meant to say yes never hear from you again.");
    items.slice(0, 4).forEach(function (t) { fix.appendChild(el("li", null, t)); });
    $("aud-fixbox").hidden = !fix.children.length;
    empty.hidden = true; res.hidden = false;
    // Hand the audit to the booking so the call starts from it.
    window.cinderBookNotes = "Audit for " + d.business + " (" + d.website + "): about " + usd(d.money.month) + "/mo. " + body.leads + " leads/mo, " + usd(Number(String(body.jobValue).replace(/[^0-9]/g, ""))) + " avg job, " + body.closeRate + "% close.";
    if (window.cinderLoadCal) window.cinderLoadCal();
    if (window.cinderTrack) window.cinderTrack("click", { label: "Audit: result" });
    if (matchMedia("(max-width: 980px)").matches) res.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
  // Someone who scrolls to the calendar without running the audit still gets it.
  var bookBox = document.getElementById("cal-inline");
  if (bookBox && "IntersectionObserver" in window) { var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; }) && window.cinderLoadCal) { window.cinderLoadCal(); io.disconnect(); } }, { rootMargin: "200px 0px" }); io.observe(bookBox); }
})();
