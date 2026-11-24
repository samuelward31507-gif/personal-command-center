// Booking: inline Cal.com calendar in #book (loaded when it nears the screen) and a sticky phone CTA.
(function () {
  var CAL = "audit-call/15min";
  var box = document.getElementById("cal-inline");
  var loaded = false;
  var theme = (box && box.getAttribute("data-theme")) || "dark";
  function loadCal() {
    if (loaded || !box) return;
    loaded = true;
    (function (C, A, L) {
      var p = function (a, ar) { a.q.push(ar); };
      var d = C.document;
      C.Cal = C.Cal || function () {
        var cal = C.Cal, ar = arguments;
        if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; }
        if (ar[0] === L) {
          var api = function () { p(api, arguments); };
          var ns = ar[1]; api.q = api.q || [];
          if (typeof ns === "string") { cal.ns[ns] = cal.ns[ns] || api; p(cal.ns[ns], ar); p(cal, ["initNamespace", ns]); } else p(cal, ar);
          return;
        }
        p(cal, ar);
      };
    })(window, "https://app.cal.com/embed/embed.js", "init");
    window.Cal("init", "book", { origin: "https://cal.com" });
    window.Cal.ns.book("inline", { elementOrSelector: "#cal-inline", calLink: CAL, config: Object.assign({ layout: "month_view", theme: theme }, window.cinderBookNotes ? { notes: String(window.cinderBookNotes).slice(0, 900) } : {}) });
    window.Cal.ns.book("on", { action: "bookingSuccessful", callback: function () { if (window.cinderTrack) window.cinderTrack("click", { label: "Book: booked on site" }); } });
    window.Cal.ns.book("ui", { theme: theme, hideEventTypeDetails: true, layout: "month_view", cssVarsPerTheme: { dark: { "cal-brand": "#ededed" }, light: { "cal-brand": "#121417" } } });
    // The moment the calendar's frame arrives, the placeholder goes away.
    if ("MutationObserver" in window) { var mo = new MutationObserver(function () { if (box.querySelector("iframe")) { box.classList.add("is-ready"); var l = box.querySelector(".cal-loading"), f = box.querySelector(".cal-fallback"); if (l) l.remove(); if (f) f.remove(); mo.disconnect(); } }); mo.observe(box, { childList: true, subtree: true }); }
    // If the calendar hasn't drawn after 8s (blocked script, slow network), show the plain link prominently.
    setTimeout(function () { if (!box.querySelector("iframe")) box.classList.add("is-fallback"); }, 8000);
  }
  window.cinderLoadCal = loadCal; // the audit page loads the calendar once results (and booking notes) are ready
  if (box) {
    if (box.hasAttribute("data-wait")) { /* loaded by the page, or by a book click below */ }
    else if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { loadCal(); io.disconnect(); } }, { rootMargin: "900px 0px" });
      io.observe(box);
    } else loadCal();
    // Clicking any "book" button starts loading right away so the calendar is ready on arrival.
    document.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest('a[href$="#book"]'); if (a) loadCal(); });
  }

  // Sticky CTA on phones: shows after the hero, hides while the booking section is on screen.
  var bar = document.getElementById("stickybook");
  var hero = document.querySelector(".hero");
  var book = document.getElementById("book");
  if (bar && "IntersectionObserver" in window) {
    var pastHero = false, atBook = false;
    var sync = function () { bar.classList.toggle("on", pastHero && !atBook); };
    if (hero) new IntersectionObserver(function (es) { pastHero = !es[0].isIntersecting; sync(); }).observe(hero);
    if (book) new IntersectionObserver(function (es) { atBook = es[0].isIntersecting; sync(); }).observe(book);
  }
})();
