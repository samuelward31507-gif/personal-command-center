// Living product visuals on the homepage, in the Raycast spirit: the product is always quietly working
// in the background. Three pieces:
//   1. Hero: a slow field of real-looking lead events drifting behind the headline, and the phone
//      conversation replaying on a loop.
//   2. Showcase: the Cinder app running a scripted day (leads answered, an estimate booked, a quote sent
//      from the command bar, an invoice paid), synced to four captions.
//   3. How it works: each card comes alive when it scrolls into view.
// Everything pauses off screen and in background tabs. With reduced motion the page shows the finished,
// static state of each piece.
(function () {
  var html = document.documentElement;
  var motion = html.classList.contains("motion");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var el = function (tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // Runs a looping scene only while it's visible and the tab is in front.
  function whenVisible(node, onShow, onHide) {
    var vis = false, front = !document.hidden;
    var set = function () { if (vis && front) onShow(); else onHide(); };
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; set(); }, { threshold: 0.15 }).observe(node);
    else { vis = true; }
    document.addEventListener("visibilitychange", function () { front = !document.hidden; set(); });
    set();
  }

  // ---------- 1. Hero ambient field ----------
  var EVENTS = [
    ["Missed call", "Aurora", "Texted in 8s", "ok"], ["Web form", "Vinyl, 80 ft", "Texted in 6s", "ok"],
    ["Facebook lead", "9:52 PM", "Texted in 9s", "ok"], ["Estimate", "Thu 8:00 AM", "Booked", "ok"],
    ["Angi", "Chain link, 200 ft", "Texted in 11s", "ok"], ["Quote", "$6,840 · cedar", "Approved", "ok"],
    ["Missed call", "Littleton", "Texted in 7s", "ok"], ["Invoice #1042", "$8,600", "Paid", "ok"],
    ["Follow-up", "Day 5 · Priya S.", "Replied", "ok"], ["Thumbtack", "Gate repair", "Texted in 10s", "ok"],
    ["Review", "Henderson", "5 stars", "ok"], ["Estimate", "Fri 1:00 PM", "Booked", "ok"],
    ["Web form", "Deck railing", "Texted in 5s", "ok"], ["Missed call", "Parker", "Texted in 9s", "ok"],
    ["Quote", "$12,300 · composite", "Sent", ""], ["Estimate", "Mon 3:30 PM", "Booked", "ok"]
  ];
  var amb = $("[data-amb]");
  if (amb) {
    for (var c = 0; c < 4; c++) {
      var col = el("div", "amb-col");
      col.style.setProperty("--dur", (58 + c * 11) + "s");
      col.style.setProperty("--off", (-c * 13) + "s");
      var list = el("div", "amb-track");
      for (var rep = 0; rep < 2; rep++) {
        for (var k = 0; k < 7; k++) {
          var e = EVENTS[(c * 5 + k * 3) % EVENTS.length];
          var card = el("div", "amb-card");
          card.appendChild(el("b", null, e[0]));
          card.appendChild(el("span", null, e[1]));
          card.appendChild(el("em", e[3], e[2]));
          if (rep) card.setAttribute("aria-hidden", "true");
          list.appendChild(card);
        }
      }
      col.appendChild(list);
      amb.appendChild(col);
    }
    if (motion) whenVisible(amb, function () { amb.classList.remove("paused"); }, function () { amb.classList.add("paused"); });
  }

  // ---------- Hero phone: replay the conversation ----------
  var thread = $(".hero .thread");
  if (thread && motion) {
    var loopT = null;
    var replay = function () {
      var fresh = thread.cloneNode(true);
      thread.parentNode.replaceChild(fresh, thread);
      thread = fresh;
    };
    whenVisible($(".hero-phone"), function () {
      if (loopT) return;
      loopT = setInterval(function () { thread.classList.add("fade"); setTimeout(replay, 600); }, 13000);
    }, function () { clearInterval(loopT); loopT = null; });
  }

  // ---------- 2. Showcase: the app running a day ----------
  var win = $("[data-show]");
  if (win) {
    var feed = $("[data-feed]", win), cmd = $("[data-cmd]", win), q = $("[data-q]", win), toast = $("[data-toast]", win);
    var slot = $("[data-slot]", win), steps = $$("[data-steps] li");
    var K = function (k) { return $('[data-k="' + k + '"]', win); };
    var money = function (n) { return "$" + n.toLocaleString("en-US"); };
    var step = function (i) { steps.forEach(function (s, j) { s.classList.toggle("on", i === j); }); };

    function row(kind, who, what, state, cls) {
      var li = el("li", "fr " + (cls || ""));
      var dot = el("i", "fr-dot");
      var t = el("div", "fr-t"); t.appendChild(el("b", null, who)); t.appendChild(el("span", null, kind + " · " + what));
      var s = el("em", "fr-s", state);
      li.appendChild(dot); li.appendChild(t); li.appendChild(s);
      feed.insertBefore(li, feed.firstChild);
      while (feed.children.length > 5) feed.removeChild(feed.lastChild);
      requestAnimationFrame(function () { li.classList.add("in"); });
      return li;
    }
    function tick(node, from, to, ms, fmt) {
      return new Promise(function (res) {
        var t0 = performance.now();
        (function f(now) { var p = Math.min(1, (now - t0) / ms), k = 1 - Math.pow(1 - p, 3); node.textContent = fmt(Math.round(from + (to - from) * k)); if (p < 1) requestAnimationFrame(f); else res(); })(t0);
      });
    }
    var leads = 5, booked = 32450, alive = false, running = false;

    function staticState() {
      [["Missed call", "Tom Becker", "Littleton", "Texted in 8s"], ["Web form", "Marcus Hill", "Vinyl, 80 ft", "Booked Fri 1:00"], ["Quote", "Priya Shah", "$6,840", "Sent · chase on"], ["Invoice #1042", "Henderson", "$8,600", "Paid"]]
        .forEach(function (r) { row(r[0], r[1], r[2], r[3], "done in"); });
      slot.appendChild(el("p", "ev new", "1:00 · Marcus Hill")).appendChild(el("span", null, "Vinyl estimate"));
    }

    async function scene() {
      running = true;
      while (alive) {
        if (!feed.children.length) [["Missed call", "Jen Alvarez", "Parker", "Booked Wed 4:00"], ["Quote", "Ortiz", "$4,200 · gate", "Approved"], ["Facebook lead", "Kyle Moss", "9:52 PM", "Texted in 9s"]]
          .forEach(function (r) { row(r[0], r[1], r[2], r[3], "done in"); });
        // Answer
        step(0);
        var leadsIn = [["Missed call", "Tom Becker", "Littleton", 8], ["Web form", "Ana Torres", "Gate repair", 6]];
        for (var i = 0; i < leadsIn.length && alive; i++) {
          var L = leadsIn[i], r = row(L[0], L[1], L[2], "Texting…", "wait");
          leads++; K("leads").textContent = leads; K("ans").textContent = (leads - 1) + " of " + leads; K("inbox").textContent = String(3 + i + 1);
          var s = r.querySelector(".fr-s");
          await tick(s, 1, L[3], L[3] * 260, function (n) { return n + "s"; });
          s.textContent = "Texted in " + L[3] + "s"; r.classList.remove("wait"); r.classList.add("done");
          K("ans").textContent = leads + " of " + leads;
          await sleep(900);
        }
        if (!alive) break;
        // Book
        step(1); await sleep(400);
        var b = row("Web form", "Marcus Hill", "Vinyl, 80 ft", "Booking…", "wait");
        await sleep(1500);
        b.querySelector(".fr-s").textContent = "Booked Fri 1:00"; b.classList.remove("wait"); b.classList.add("done");
        var ev = el("p", "ev new", "1:00 · Marcus Hill"); ev.appendChild(el("span", null, "Vinyl estimate")); slot.appendChild(ev);
        await sleep(1800);
        if (!alive) break;
        // Quote from the command bar
        step(2);
        cmd.classList.add("open"); q.textContent = ""; await sleep(500);
        var phrase = "send quote priya";
        for (var j = 0; j < phrase.length && alive; j++) { q.textContent += phrase[j]; await sleep(55 + Math.random() * 45); }
        await sleep(700); cmd.classList.add("hit"); await sleep(380);
        cmd.classList.remove("open", "hit");
        toast.classList.add("show");
        row("Quote", "Priya Shah", "$6,840 · cedar", "Sent · chase on", "done");
        await sleep(2200); toast.classList.remove("show");
        if (!alive) break;
        // Get paid
        step(3);
        row("Invoice #1042", "Henderson", "$8,600", "Paid", "done paid");
        await tick(K("booked"), booked, booked + 8600, 1200, money);
        booked += 8600;
        await sleep(3200);
        // Reset quietly for the next loop
        win.classList.add("resetting"); await sleep(500);
        feed.innerHTML = ""; slot.querySelectorAll(".ev").forEach(function (n) { n.remove(); });
        leads = 5; booked = 32450; K("leads").textContent = "5"; K("ans").textContent = "5 of 5"; K("inbox").textContent = "3"; K("booked").textContent = money(booked);
        win.classList.remove("resetting"); await sleep(400);
      }
      running = false;
    }

    if (!motion) { staticState(); step(-1); steps.forEach(function (s) { s.classList.add("on"); }); }
    else whenVisible(win, function () { alive = true; if (!running) scene(); }, function () { alive = false; });
  }

  // ---------- 3. How it works: cards come alive on scroll ----------
  if (motion && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var items = $$(".mini, .slot, .kv dt, .kv dd, .chase li", e.target);
        items.forEach(function (it, i) {
          setTimeout(function () {
            it.classList.add("lv-in");
            var ok = it.querySelector(".ok");
            if (ok) {
              var m = ok.textContent.match(/(\d+)/), n = m ? +m[1] : 0, pre = ok.textContent.slice(0, m ? m.index : 0), post = m ? ok.textContent.slice(m.index + m[1].length) : "";
              var t0 = performance.now();
              (function f(now) { var p = Math.min(1, (now - t0) / (n * 90)); ok.textContent = pre + Math.max(1, Math.round(n * p)) + post; if (p < 1) requestAnimationFrame(f); })(t0);
            }
          }, 180 + i * 140);
        });
      });
    }, { threshold: 0.35 });
    $$("#how .card").forEach(function (c) { c.classList.add("lv"); io.observe(c); });
  }
})();
