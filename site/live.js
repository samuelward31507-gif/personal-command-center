// Cinder homepage motion (v2). The product is always quietly working:
//   hero  · headline words blur in, the app runs a day, the phone plays a real iMessage thread with the 0:09 clock,
//           and the whole stage tilts flat as you scroll into it
//   page  · sections blur in, figures count up, bento cards each run their own small loop, cards light up under the cursor
// Loops pause off screen and in background tabs. With reduced motion everything shows its finished state.
(function () {
  var html = document.documentElement, motion = html.classList.contains("motion");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var el = function (tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var IO = "IntersectionObserver" in window;

  // Runs a loop only while its element is on screen and the tab is in front.
  function whenVisible(node, onShow, onHide) {
    var vis = !IO, front = !document.hidden;
    var set = function () { if (vis && front) onShow(); else onHide(); };
    if (IO) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; set(); }, { threshold: 0.12 }).observe(node);
    document.addEventListener("visibilitychange", function () { front = !document.hidden; set(); });
    set();
  }
  // A pausable loop: body(alive) checks alive() between steps and returns when it goes false.
  function loop(node, body) {
    var on = false, running = false;
    var alive = function () { return on; };
    var start = function () { if (running) return; running = true; body(alive).then(function () { running = false; if (on) start(); }); };
    whenVisible(node, function () { on = true; start(); }, function () { on = false; });
  }

  // ---------- Nav progress hairline ----------
  var nav = $("#nav");
  if (nav) {
    var bar = el("i", "nav-progress"); bar.setAttribute("aria-hidden", "true"); nav.appendChild(bar);
    var tk = false;
    addEventListener("scroll", function () { if (tk) return; tk = true; requestAnimationFrame(function () { tk = false; var h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, scrollY / h) : 0) + ")"; }); }, { passive: true });
  }

  // ---------- Headlines: split into words; the second sentence reads in grey ----------
  $$("main h2").forEach(function (h) { h.classList.add("split"); });
  $$(".split").forEach(function (h) {
    var text = h.textContent.trim(), words = text.split(/\s+/), dim = false;
    h.setAttribute("aria-label", text); h.textContent = "";
    words.forEach(function (w, i) {
      var s = el("span", "w" + (dim ? " dim" : ""), w); s.style.setProperty("--wi", i); s.setAttribute("aria-hidden", "true"); h.appendChild(s);
      if (/\.$/.test(w) && i < words.length - 1) { dim = true; h.appendChild(el("br", "br-l")); } else if (i < words.length - 1) h.appendChild(document.createTextNode(" "));
    });
  });

  // ---------- Reveals ----------
  function count(n) {
    var to = +n.dataset.count, suf = n.dataset.suffix || "", t0 = performance.now();
    (function f(now) { var p = Math.min(1, (now - t0) / 1400), k = 1 - Math.pow(1 - p, 4); n.textContent = Math.round(to * k) + suf; if (p < 1) requestAnimationFrame(f); })(t0);
  }
  if (motion && IO) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!e.isIntersecting) return; e.target.classList.add("in"); io.unobserve(e.target); if (e.target.matches("[data-count]")) count(e.target); });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    var groups = ".facts, .vs, .bento, .plans, .book-steps";
    $$("main > section:not(.hero) .wrap > *").forEach(function (n) {
      if (n.matches(".split")) { io.observe(n); return; }
      if (n.matches(".head-c, .center-head, .head, .book-in, .faq, .founder, .calc2")) {
        [].forEach.call(n.children, function (c, i) {
          if (c.matches(".split")) { io.observe(c); return; }
          var hs = $$(".split", c); hs.forEach(function (h) { io.observe(h); });
          c.classList.add("rv"); c.style.setProperty("--d", i + 1); io.observe(c);
        });
        return;
      }
      if (n.matches(groups)) { [].forEach.call(n.children, function (c, i) { c.classList.add("rv"); c.style.setProperty("--d", i); io.observe(c); }); return; }
      $$(".split", n).forEach(function (h) { io.observe(h); });
      n.classList.add("rv"); io.observe(n);
    });
    $$("[data-count]").forEach(function (n) { io.observe(n); });
    var h1 = $(".hero h1"); if (h1) setTimeout(function () { h1.classList.add("in"); }, 60);
  } else $$(".split").forEach(function (h) { h.classList.add("in"); });

  // ---------- Stage: tilted back, settles flat as it scrolls up ----------
  var stage = $("[data-stage]");
  if (stage && motion) {
    var ticking = false;
    var tilt = function () {
      ticking = false;
      var max = innerWidth < 900 ? 6 : 10, r = stage.getBoundingClientRect(), p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * .8)));
      p = 1 - Math.pow(1 - p, 2);
      stage.style.setProperty("--tilt", (max * (1 - p)).toFixed(2) + "deg");
      stage.style.setProperty("--sc", (0.97 + 0.03 * p).toFixed(4));
    };
    addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(tilt); } }, { passive: true });
    addEventListener("resize", tilt); tilt();
  }

  // ---------- Ambient lead field ----------
  var EVENTS = [["Missed call", "Aurora", "Texted in 8s", "ok"], ["Web form", "Vinyl, 80 ft", "Texted in 6s", "ok"], ["Facebook lead", "9:52 PM", "Texted in 9s", "ok"], ["Estimate", "Thu 8:00 AM", "Booked", "ok"],
    ["Angi", "Chain link, 200 ft", "Texted in 11s", "ok"], ["Quote", "$6,840 · cedar", "Approved", "ok"], ["Missed call", "Littleton", "Texted in 7s", "ok"], ["Invoice #1042", "$8,600", "Paid", "ok"],
    ["Follow-up", "Day 5 · Priya S.", "Replied", "ok"], ["Thumbtack", "Gate repair", "Texted in 10s", "ok"], ["Review", "Henderson", "5 stars", "ok"], ["Estimate", "Fri 1:00 PM", "Booked", "ok"],
    ["Web form", "Deck railing", "Texted in 5s", "ok"], ["Missed call", "Parker", "Texted in 9s", "ok"], ["Quote", "$12,300 · composite", "Sent", ""], ["Estimate", "Mon 3:30 PM", "Booked", "ok"]];
  var amb = $("[data-amb]");
  if (amb) {
    for (var c = 0; c < 6; c++) {
      var col = el("div", "amb-col"); col.style.setProperty("--dur", (64 + c * 9) + "s"); col.style.setProperty("--off", (-c * 11) + "s");
      var list = el("div", "amb-track");
      for (var rep = 0; rep < 2; rep++) for (var k = 0; k < 7; k++) {
        var e = EVENTS[(c * 5 + k * 3) % EVENTS.length], ac = el("div", "amb-card");
        ac.appendChild(el("b", null, e[0])); ac.appendChild(el("span", null, e[1])); ac.appendChild(el("em", e[3], e[2]));
        list.appendChild(ac);
      }
      col.appendChild(list); amb.appendChild(col);
    }
    if (motion) whenVisible(amb, function () { amb.classList.remove("paused"); }, function () { amb.classList.add("paused"); });
  }

  // ---------- Phone: a real iMessage thread, with the 0:09 clock ----------
  var thread = $("[data-imsg]"), clock = $("[data-clock]");
  var biz = (($(".p-biz") || {}).textContent || "Ridgeline Fence").trim();
  var SCRIPT = [
    ["meta", "Missed call · Today 2:14 PM"],
    ["clock"],
    ["out", "Hey Dana, it’s Mike with " + biz + ". Sorry I missed you, I’m on a job. What can I help with?"],
    ["dl", "Delivered"],
    ["typing", 1400], ["in", "Need a quote on about 120 ft of cedar privacy fence. The old one’s leaning bad"],
    ["typing", 1100], ["out", "Cedar privacy with tear-out usually runs $42–56 a foot. I can measure Thursday at 8 or Friday at 3. Which works?"],
    ["dl", "Read 2:15 PM"],
    ["typing", 900], ["in", "Thursday works 👍"],
    ["card", "Estimate booked", "Thu, 8:00 AM · on Mike’s calendar"]
  ];
  function trim() { while (thread.scrollHeight > thread.clientHeight + 2 && thread.children.length > 2) thread.removeChild(thread.firstElementChild); }
  function bubble(kind, text) {
    var prev = thread.lastElementChild; // the tail sits on the last bubble of a run, like Messages
    if (prev && prev.classList.contains(kind) && !prev.classList.contains("typing")) prev.classList.remove("tail");
    var b = el("div", "im " + kind + " tail", text); thread.appendChild(b); trim(); return b;
  }
  function card(s) { var cd = el("div", "im-card"); cd.appendChild(el("b", null, s[1])); cd.appendChild(el("span", null, s[2])); thread.appendChild(cd); trim(); }
  function clockDone() { $("[data-clock-t]", clock).textContent = "0:09"; $("[data-ring]", clock).style.strokeDashoffset = "0"; clock.classList.add("done"); $("[data-clock-l]", clock).textContent = "Texted back, before they call anyone else"; }
  function runClock(alive) {
    if (!clock) return Promise.resolve();
    var t = $("[data-clock-t]", clock), l = $("[data-clock-l]", clock), ring = $("[data-ring]", clock), t0 = performance.now();
    clock.classList.remove("done"); l.textContent = "Missed call · texting back";
    return new Promise(function (res) {
      (function f(now) {
        if (!alive()) return res();
        var s = Math.min(9, (now - t0) / 1000 * 3.2);
        t.textContent = "0:0" + Math.floor(s); ring.style.strokeDashoffset = String(94.25 * (1 - s / 9));
        if (s < 9) requestAnimationFrame(f); else { clockDone(); res(); }
      })(t0);
    });
  }
  if (thread) {
    if (!motion) {
      SCRIPT.forEach(function (s) { if (s[0] === "out" || s[0] === "in") bubble(s[0], s[1]); else if (s[0] === "meta") thread.appendChild(el("p", "im-meta", s[1])); else if (s[0] === "card") card(s); });
      if (clock) clockDone();
    } else loop($(".iph"), async function (alive) {
      while (alive()) {
        if (thread.children.length) { thread.classList.add("fading"); await sleep(420); }
        thread.innerHTML = ""; thread.classList.remove("fading");
        for (var i = 0; i < SCRIPT.length && alive(); i++) {
          var s = SCRIPT[i];
          if (s[0] === "meta") { thread.appendChild(el("p", "im-meta", s[1])); await sleep(500); }
          else if (s[0] === "clock") await runClock(alive);
          else if (s[0] === "typing") { var ty = el("div", "im in typing"); ty.innerHTML = "<i></i><i></i><i></i>"; thread.appendChild(ty); trim(); await sleep(s[1]); ty.remove(); }
          else if (s[0] === "in" || s[0] === "out") { $$(".im-dl", thread).forEach(function (n) { n.remove(); }); bubble(s[0], s[1]); await sleep(s[0] === "out" ? 900 : 700); }
          else if (s[0] === "dl") { thread.appendChild(el("p", "im-dl", s[1])); trim(); await sleep(700); }
          else if (s[0] === "card") card(s);
        }
        if (alive()) await sleep(5200);
      }
    });
  }

  // ---------- The app running a day ----------
  var win = $("[data-show]");
  if (win) {
    var feed = $("[data-feed]", win), cmd = $("[data-cmd]", win), q = $("[data-q]", win), toast = $("[data-toast]", win), slot = $("[data-slot]", win), steps = $$("[data-steps] li");
    var K = function (k) { return $('[data-k="' + k + '"]', win); };
    var money = function (n) { return "$" + n.toLocaleString("en-US"); };
    var step = function (i) { steps.forEach(function (s, j) { s.classList.toggle("on", i === j); }); };
    var row = function (kind, who, what, state, cls) {
      var li = el("li", "fr " + (cls || "")), t = el("div", "fr-t");
      t.appendChild(el("b", null, who)); t.appendChild(el("span", null, kind + " · " + what));
      li.appendChild(el("i", "fr-dot")); li.appendChild(t); li.appendChild(el("em", "fr-s", state));
      feed.insertBefore(li, feed.firstChild);
      while (feed.children.length > 6) feed.removeChild(feed.lastChild);
      requestAnimationFrame(function () { li.classList.add("in"); });
      return li;
    };
    var tick = function (node, from, to, ms, fmt) { return new Promise(function (res) { var t0 = performance.now(); (function f(now) { var p = Math.min(1, (now - t0) / ms), k = 1 - Math.pow(1 - p, 3); node.textContent = fmt(Math.round(from + (to - from) * k)); if (p < 1) requestAnimationFrame(f); else res(); })(t0); }); };
    var seed = function () { [["Missed call", "Jen Alvarez", "Parker", "Booked Wed 4:00"], ["Quote", "Ortiz", "$4,200 · gate", "Approved"], ["Facebook lead", "Kyle Moss", "9:52 PM", "Texted in 9s"]].forEach(function (r) { row(r[0], r[1], r[2], r[3], "done in"); }); };
    if (!motion) { seed(); steps.forEach(function (s) { s.classList.add("on"); }); }
    else loop(win, async function (alive) {
      var leads = 5, booked = 32450;
      while (alive()) {
        if (!feed.children.length) seed();
        step(0);
        var L = [["Missed call", "Tom Becker", "Littleton", 8], ["Web form", "Ana Torres", "Gate repair", 6]];
        for (var i = 0; i < L.length && alive(); i++) {
          var r = row(L[i][0], L[i][1], L[i][2], "Texting…", "wait"), s = r.querySelector(".fr-s");
          leads++; K("leads").textContent = leads; K("ans").textContent = (leads - 1) + " of " + leads; K("inbox").textContent = String(3 + i + 1);
          await tick(s, 1, L[i][3], L[i][3] * 260, function (n) { return n + "s"; });
          s.textContent = "Texted in " + L[i][3] + "s"; r.classList.remove("wait"); r.classList.add("done"); K("ans").textContent = leads + " of " + leads;
          await sleep(900);
        }
        if (!alive()) break;
        step(1); await sleep(400);
        var b = row("Web form", "Marcus Hill", "Vinyl, 80 ft", "Booking…", "wait"); await sleep(1500);
        b.querySelector(".fr-s").textContent = "Booked Fri 1:00"; b.classList.remove("wait"); b.classList.add("done");
        var ev = el("p", "ev new", "1:00 · Marcus Hill"); ev.appendChild(el("span", null, "Vinyl estimate")); slot.appendChild(ev);
        await sleep(1800); if (!alive()) break;
        step(2); cmd.classList.add("open"); q.textContent = ""; await sleep(500);
        var phrase = "send quote priya";
        for (var j = 0; j < phrase.length && alive(); j++) { q.textContent += phrase[j]; await sleep(55 + Math.random() * 45); }
        await sleep(700); cmd.classList.add("hit"); await sleep(380); cmd.classList.remove("open", "hit");
        toast.classList.add("show"); row("Quote", "Priya Shah", "$6,840 · cedar", "Sent · chase on", "done");
        await sleep(2200); toast.classList.remove("show"); if (!alive()) break;
        step(3); row("Invoice #1042", "Henderson", "$8,600", "Paid", "done paid");
        await tick(K("booked"), booked, booked + 8600, 1200, money); booked += 8600;
        await sleep(3200);
        win.classList.add("resetting"); await sleep(500);
        feed.innerHTML = ""; $$(".ev.new", slot).forEach(function (n) { n.remove(); });
        leads = 5; booked = 32450; K("leads").textContent = "5"; K("ans").textContent = "5 of 5"; K("inbox").textContent = "3"; K("booked").textContent = money(booked);
        win.classList.remove("resetting"); await sleep(400);
      }
    });
  }

  // ---------- Bento loops ----------
  var bx = function (k) { return $('[data-bx="' + k + '"]'); };
  var T = bx("timer");
  if (T) {
    var bc = $(".big-clock", T), bt = $("[data-bt]", T), bb = $("[data-bb]", T), bs = $("[data-bs]", T);
    var fin = function () { bt.textContent = "0:09"; bb.style.width = "100%"; bc.classList.add("done"); bs.textContent = "Texted back from your business number"; };
    if (!motion) fin();
    else loop(T, async function (alive) {
      while (alive()) {
        bc.classList.remove("done"); bs.textContent = "Missed call · 2:14 PM"; bb.style.width = "0";
        var t0 = performance.now();
        await new Promise(function (res) { (function f(now) { if (!alive()) return res(); var s = Math.min(9, (now - t0) / 1000 * 2.2); bt.textContent = "0:0" + Math.floor(s); bb.style.width = (s / 9 * 100) + "%"; if (s < 9) requestAnimationFrame(f); else res(); })(t0); });
        if (!alive()) break;
        fin(); await sleep(3200);
      }
    });
  }
  var Q = bx("qual");
  if (Q && motion) loop(Q, async function (alive) { var rows = $$(".q-list > div", Q); while (alive()) { rows.forEach(function (r) { r.classList.remove("lit"); }); await sleep(600); for (var i = 0; i < rows.length && alive(); i++) { rows[i].classList.add("lit"); await sleep(750); } await sleep(2600); } });
  var C = bx("cal");
  if (C && motion) loop(C, async function (alive) { var n = $("[data-bn]", C), note = $("[data-bnote]", C); while (alive()) { n.classList.remove("on"); note.textContent = "2 estimates"; await sleep(1600); n.classList.add("on"); note.textContent = "3 estimates"; await sleep(4200); } });
  var H = bx("chase");
  if (H) { var cds = $$("[data-cd]", H); if (!motion) cds.forEach(function (d) { d.classList.add("lit"); }); else loop(H, async function (alive) { while (alive()) { cds.forEach(function (d) { d.classList.remove("lit"); }); await sleep(500); for (var i = 0; i < cds.length && alive(); i++) { cds[i].classList.add("lit"); await sleep(900); } await sleep(2800); } }); }
  var S = bx("es");
  if (S && motion) loop(S, async function (alive) {
    var li = $("[data-li]", S), lo = $("[data-lo]", S), i = 0;
    var P = [["¿Cuánto cuesta una cerca de madera de 30 metros?", "Normalmente entre $4,200 y $5,400. ¿Le queda bien el jueves a las 8 para medir?"], ["How much for about 100 ft of wood fence?", "Usually $4,200 to $5,400. Does Thursday at 8 work to measure?"]];
    while (alive()) { li.style.opacity = lo.style.opacity = "0"; await sleep(400); li.textContent = P[i][0]; lo.textContent = P[i][1]; li.style.opacity = "1"; await sleep(900); lo.style.opacity = "1"; await sleep(3600); i = 1 - i; }
  });
  var R = bx("stars");
  if (R) { var stars = $$(".stars i", R); if (!motion) stars.forEach(function (s) { s.classList.add("on"); }); else loop(R, async function (alive) { while (alive()) { stars.forEach(function (s) { s.classList.remove("on"); }); await sleep(700); for (var i = 0; i < 5 && alive(); i++) { stars[i].classList.add("on"); await sleep(220); } await sleep(3000); } }); }

  // ---------- Cursor light on cards ----------
  $$(".bx").forEach(function (n) {
    n.addEventListener("pointermove", function (e) { var r = n.getBoundingClientRect(); n.style.setProperty("--mx", (e.clientX - r.left) + "px"); n.style.setProperty("--my", (e.clientY - r.top) + "px"); });
  });
})();

// ---------- Try it on your business: a real conversation with /api/demo-reply, on the homeowner's phone ----------
(function () {
  var f = document.getElementById("demo"); if (!f) return;
  var t = document.getElementById("demo-thread"), clk = document.getElementById("demo-clock"), note = document.getElementById("demo-note"), go = document.getElementById("demo-go");
  var biz = document.getElementById("demo-biz"), av = document.getElementById("demo-av"), chat = document.getElementById("demo-chat"), say = document.getElementById("demo-say"), send = document.getElementById("demo-send");
  var ex = { Fence: ["Summit Fence Co.", "Need a quote for about 150 ft of cedar privacy fence in the backyard. We have a dog so need a gate too."],
    Roofing: ["Summit Roofing", "Our roof is leaking in two spots after the storm. Two-story house, about 15 years old. Can someone come look?"],
    Pool: ["Blue Ridge Pools", "Thinking about putting in an inground pool next spring. Backyard is about 40x60. What's the process?"],
    Other: ["Your Business", "Hi, I saw your website and I'd like to get a quote. When could someone come out?"] };
  var history = [], busy = false, done = false, MAX = 6, mine = 0;
  var initials = function (n) { return (n.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("") || "C").toUpperCase(); };
  var name = function () { return f.business.value.trim() || f.business.placeholder; };
  var setName = function () { biz.textContent = name(); av.textContent = initials(name()); };
  f.addEventListener("change", function (e) { if (e.target.name !== "trade") return; var v = ex[e.target.value] || ex.Other; if (!f.request.dataset.edited) f.request.value = v[1]; f.business.placeholder = v[0]; setName(); });
  f.request.addEventListener("input", function () { f.request.dataset.edited = "1"; });
  f.business.addEventListener("input", setName);
  var trim = function () { while (t.scrollHeight > t.clientHeight + 2 && t.children.length > 2) t.removeChild(t.firstElementChild); };
  var add = function (cls, text) {
    var prev = t.lastElementChild; if (prev && prev.classList.contains("im") && prev.classList.contains(cls)) prev.classList.remove("tail");
    var d = document.createElement("div"); d.className = "im " + cls + " tail"; d.textContent = text; t.appendChild(d); trim(); return d;
  };
  var meta = function (text, cls) { var p = document.createElement("p"); p.className = cls || "im-meta"; p.textContent = text; t.appendChild(p); trim(); };
  var live = function (on) { say.disabled = !on; send.disabled = !on; chat.classList.toggle("on", on); if (on) say.focus({ preventScroll: true }); };
  var finish = function (alert) {
    done = true; live(false); say.placeholder = "Conversation finished";
    var c = document.createElement("div"); c.className = "im-card"; var b = document.createElement("b"); b.textContent = alert ? "Estimate booked" : "That’s the flow"; var sp = document.createElement("span"); sp.textContent = alert || "On a real lead it keeps going until the estimate is booked."; c.appendChild(b); c.appendChild(sp); t.appendChild(c); trim();
    note.textContent = "That’s what your customers get, in your wording. Nothing was texted or saved.";
  };
  // The homeowner's side is blue (they are holding the phone); the business replies in grey.
  function turn(text, first) {
    if (busy || done) return; busy = true; mine++;
    add("out", text);
    var ty = document.createElement("div"); ty.className = "im in typing"; ty.innerHTML = "<i></i><i></i><i></i>"; t.appendChild(ty); trim();
    live(false); go.disabled = true; if (first) { go.textContent = "Replying…"; note.textContent = "Writing the reply…"; }
    var t0 = performance.now(), tick = first ? setInterval(function () { var s = Math.floor((performance.now() - t0) / 1000); clk.textContent = "0:" + (s < 10 ? "0" : "") + s; }, 200) : 0;
    var body = { trade: f.trade.value, business: name(), customer: "Dana", request: text, website: f.website.value };
    if (!first) body.history = history.slice();
    fetch("/api/demo-reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "That didn't go through. Try again."); return d; }); })
      .then(function (d) {
        ty.remove(); add("in", d.reply);
        history.push({ from: "them", text: text }, { from: "us", text: d.reply });
        if (first) { var s = Math.max(1, Math.round((performance.now() - t0) / 1000)); clk.textContent = "0:" + (s < 10 ? "0" : "") + s; note.textContent = "First reply in " + s + " second" + (s === 1 ? "" : "s") + ". Now answer it on the phone, like the homeowner would."; }
        if (d.booked) finish(d.ownerAlert || "On the owner’s calendar, with the job details texted to them.");
        else if (mine >= MAX) finish("");
        else live(true);
      })
      .catch(function (err) { ty.remove(); mine--; meta(err.message, "im-dl"); if (!first && !done) live(true); if (first) note.textContent = err.message; })
      .finally(function () { clearInterval(tick); busy = false; go.disabled = false; go.textContent = history.length ? "Start over" : "Start the conversation"; });
  }
  f.addEventListener("submit", function (e) {
    e.preventDefault(); if (busy) return; setName();
    history = []; done = false; mine = 0; t.innerHTML = ""; say.placeholder = "Type a reply"; say.value = "";
    meta("Website form · " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    turn(f.request.value.trim(), true);
  });
  chat.addEventListener("submit", function (e) { e.preventDefault(); var v = say.value.trim(); if (!v) return; say.value = ""; turn(v, false); });
})();
