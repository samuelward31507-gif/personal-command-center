// /watch: a 28-second sequence (two stats, the live demo, end card) rendered in the page.
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
    stage.style.visibility = "visible";
  }
  fit(); addEventListener("resize", fit);

  var SRC_HBR = "Source: Oldroyd, McElheran & Elkington, “The Short Life of Online Sales Leads,” Harvard Business Review, March 2011. Audit of 2,241 U.S. companies.";

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
  function count(id, dur) {
    return function () {
      var b = document.querySelector("#" + id + " [data-count]"); if (!b) return;
      counters.push({ el: b, to: +b.getAttribute("data-count"), start: now + 250, dur: dur, landed: false });
    };
  }

  // Fixed schedule (ms). Stats 0-6.5s, demo 6.5-24.5s (its six steps are timed inside film.js), end card to 28s.
  var P = window.__personal ? 2600 : 0, at = function (ms, fn) { cues.push({ t: ms, fn: fn }); };
  var DEMO = filmEl.film ? filmEl.film.D : 18000;
  // Plan demos (?story=quote|prequal|detail|reviews) skip the lead-response stats and open on their own headline.
  var Q = window.__skipStats ? 2500 : 6500;
  if (P) at(0, scene("s0"));
  if (!window.__skipStats) {
    at(P + 0, scene("s1")); at(P + 0, source(SRC_HBR)); at(P + 0, count("s1", 1100));
    at(P + 2500, scene("s2")); at(P + 2500, count("s2", 1000));
  }
  at(P + Q - 2000, scene("s3")); at(P + Q - 2000, source(""));
  at(P + Q, scene("s4")); at(P + Q, function () { if (filmEl.film) { filmEl.film.play(); log("film:start"); } });
  at(P + Q + DEMO, function () { if (filmEl.film) filmEl.film.pause(); scene("s6")(); });
  at(P + Q + DEMO + 3500, function () { log("end"); window.__watchDone = true; body.classList.add("done"); });
  filmEl.addEventListener("film:chapter", function (e) { log("chapter:" + e.detail); });

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
  var base = cues.slice();

  document.getElementById("replay").addEventListener("click", start);
  var go = function () { (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { window.__watchReady = true; if (!document.documentElement.classList.contains("render")) start(); }); };
  if (filmEl.film) go(); else filmEl.addEventListener("film:ready", go);
  window.__watchStart = start;
})();
