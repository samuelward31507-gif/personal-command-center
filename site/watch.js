// /watch: a 40-second sequence (stats, live demo, stat, end card) rendered in the page.
// The same page is captured frame by frame to produce the MP4s, so all timing runs off
// requestAnimationFrame + performance.now and every moment is logged to window.__events.
(function () {
  var stage = document.getElementById("stage");
  var filmEl = document.getElementById("film");
  var src = document.getElementById("src");
  var body = document.body;
  var V = stage.getAttribute("data-l") === "v";
  var W = V ? 1080 : 1920, H = V ? 1920 : 1080;

  function fit() {
    var s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = "scale(" + s + ")";
    stage.style.left = Math.round((innerWidth - W * s) / 2) + "px";
    stage.style.top = Math.round((innerHeight - H * s) / 2) + "px";
  }
  fit(); addEventListener("resize", fit);

  var SRC_HBR = "Source: Oldroyd, McElheran & Elkington, “The Short Life of Online Sales Leads,” Harvard Business Review, March 2011. Audit of 2,241 U.S. companies.";
  var SRC_MIT = "Source: Oldroyd, Lead Response Management Study, MIT & InsideSales.com, 2007. 15,000+ leads across six companies.";

  var events = window.__events = [];
  var t0 = 0, now = 0, raf = 0, cues = [], ci = 0, counters = [];
  var log = function (name) { events.push([+(now / 1000).toFixed(3), name]); };

  function scene(id) {
    return function () {
      [].forEach.call(stage.querySelectorAll(".sc"), function (s) { s.classList.toggle("on", s.id === id); });
      log("scene:" + id);
    };
  }
  function source(text) { return function () { if (text) src.textContent = text; src.classList.toggle("on", !!text); }; }
  function count(id) {
    return function () {
      var b = document.querySelector("#" + id + " [data-count]"); if (!b) return;
      counters.push({ el: b, to: +b.getAttribute("data-count"), start: now + 250, dur: 1100, landed: false });
    };
  }

  // Build cues relative to t=0 (ms). The demo's end is event-driven, so later cues are added when it books.
  var P = window.__personal ? 2900 : 0, at = function (ms, fn) { cues.push({ t: ms, fn: fn }); };
  if (P) at(0, scene("s0"));
  at(P + 0, scene("s1")); at(P + 0, source(SRC_HBR)); at(P + 0, count("s1"));
  at(P + 3600, scene("s2")); at(P + 3600, count("s2"));
  at(P + 6400, scene("s3")); at(P + 6400, source(""));
  at(P + 9200, scene("s4")); at(P + 9500, function () { if (filmEl.film) { filmEl.film.play(); log("film:start"); } });

  filmEl.addEventListener("film:chapter", function (e) {
    log("chapter:" + e.detail);
    if (e.detail === 5) { // the booked notification just landed
      var b = now;
      cues.push({ t: b + 3000, fn: function () { if (filmEl.film) filmEl.film.pause(); scene("s5")(); source(SRC_MIT)(); count("s5")(); } });
      cues.push({ t: b + 7100, fn: function () { scene("s6")(); source("")(); } });
      cues.push({ t: b + 11800, fn: function () { log("end"); window.__watchDone = true; body.classList.add("done"); } });
      cues.sort(function (a, c) { return a.t - c.t; });
    }
  });

  function tick() {
    now = performance.now() - t0;
    while (ci < cues.length && cues[ci].t <= now) { cues[ci].fn(); ci++; }
    counters.forEach(function (c) {
      var p = Math.max(0, Math.min(1, (now - c.start) / c.dur)), k = 1 - Math.pow(1 - p, 4);
      c.el.textContent = String(Math.round(c.to * k));
      if (p >= 1 && !c.landed) { c.landed = true; log("land"); }
    });
    if (!window.__watchDone) raf = requestAnimationFrame(tick);
  }

  function start() {
    cancelAnimationFrame(raf);
    body.classList.remove("done"); window.__watchDone = false;
    [].forEach.call(stage.querySelectorAll("[data-count]"), function (b) { b.textContent = "0"; });
    if (filmEl.film) { filmEl.film.pause(); filmEl.film.seek(0); }
    cues = base.slice(); ci = 0; counters = []; events.length = 0;
    t0 = performance.now(); now = 0;
    raf = requestAnimationFrame(tick);
  }
  var base = cues.slice(); // the demo adds its own cues each run; a replay starts from these

  document.getElementById("replay").addEventListener("click", start);
  var go = function () { (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { window.__watchReady = true; if (!document.documentElement.classList.contains("render")) start(); }); };
  if (filmEl.film) go(); else filmEl.addEventListener("film:ready", go);
  window.__watchStart = start;
})();
