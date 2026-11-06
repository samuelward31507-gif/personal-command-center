// Animated phone demo used by /watch (and the MP4 renders made from it).
// Plays a scripted lead conversation inside a drawn phone, with chapter captions outside it.
// Pauses off screen and in background tabs. Reduced motion: shows the finished conversation, paused.
(function () {
  var roots = [].slice.call(document.querySelectorAll("[data-film]"));
  if (!roots.length) return;


  var STORIES = {
    fence_co: {
      contact: { name: "Dana", sub: "New lead · fence", initial: "D" },
      opener: { kind: "call", time: "3:40", number: "(303) 555-0187", place: "Aurora, CO" },
      replyIn: "Replied in 6 sec",
      chapters: [
        ["The call", "3:40 PM. You're on a job when a new customer calls."],
        ["Missed", "You can't pick up. When nobody answers, most people call the next company on the list."],
        ["Texted back", "Seconds later, your business texts them back."],
        ["Qualified", "It asks the questions you'd ask on every job."],
        ["Booked", "Then it books the estimate on your calendar."],
        ["Your text", "You get one text with everything. They never called the next company."]
      ],
      thread: [
        ["ch", 2], ["out", "Hi, it's Summit Fence Co. Sorry we missed you, the crew is on a job! What can we help you with?"], ["in", "need a quote for a new fence in the backyard"],
        ["ch", 3], ["time", "3:41"], ["out", "Nice! Wood privacy, vinyl or something else? About how many feet?"], ["in", "wood privacy, maybe 150 ft, 1 gate"], ["out", "Perfect. What's the address so we can come measure?"], ["in", "4471 S Kittredge St"],
        ["ch", 4], ["time", "3:43"], ["out", "Thanks! I can have someone out:\n1) Tomorrow 9:00 AM\n2) Tomorrow 1:30 PM"], ["in", "9 please"], ["out", "You're booked for tomorrow at 9:00 AM. We'll text when we're on the way."]
      ],
      booked: { date: "Tuesday, November 4", time: "3:44", title: "Estimate booked: Dana", lines: ["Wed 9:00 AM", "Wood privacy ~150 ft, 1 gate"] }
    },
    general: {
      contact: { name: "Dana", sub: "New lead · website", initial: "D" },
      opener: { kind: "call", time: "3:40", number: "(303) 555-0187", place: "Aurora, CO" },
      replyIn: "Replied in 6 sec",
      chapters: [
        ["The call", "3:40 PM. You're on a job when a new customer calls."],
        ["Missed", "You can't pick up. When nobody answers, most people call the next company on the list."],
        ["Texted back", "Seconds later, your business texts them back."],
        ["Qualified", "It asks the questions you'd ask on every job."],
        ["Booked", "Then it books the estimate on your calendar."],
        ["Your text", "You get one text with everything. They never called the next company."]
      ],
      thread: [
        ["ch", 2], ["out", "Hi, it's Summit Home Services. Sorry we missed you, the crew is on a job! What can we help you with?"], ["in", "need a quote. we have water damage in an upstairs bedroom"],
        ["ch", 3], ["time", "3:41"], ["out", "Sorry to hear that. Is it still getting worse, or has it stopped for now?"], ["in", "stopped, but the ceiling is stained"], ["out", "Got it. What's the address so we can take a look?"], ["in", "4471 S Kittredge St"],
        ["ch", 4], ["time", "3:43"], ["out", "Thanks. I can have someone out:\n1) Tomorrow 9:00 AM\n2) Tomorrow 1:30 PM"], ["in", "9 please"], ["out", "You're booked for tomorrow at 9:00 AM ✓ We'll text when we're on the way."]
      ],
      booked: { date: "Tuesday, November 4", time: "3:44", title: "Estimate booked: Dana", lines: ["Wed 9:00 AM · 4471 S Kittredge St", "Water damage · upstairs bedroom", "Leak stopped · ceiling stained"] }
    },
  };

  roots.forEach(function (r) { mount(r, r.getAttribute("data-film"), false); });

  function mount(root, key, autoplay) {
  var story = STORIES[key];
  if (!story) return;
  // Personalization: replace the sample business name in the conversation (used by /watch?b=...).
  var biz = (root.getAttribute("data-biz") || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40);
  if (biz) story = Object.assign({}, story, { thread: story.thread.map(function (s) { return s.map(function (x) { return typeof x === "string" ? x.split("Summit Home Services").join(biz) : x; }); }) });
  var SPEED = parseFloat(root.getAttribute("data-film-speed")) || 1;
  var manual = root.hasAttribute("data-film-manual");

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var HANDSET = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>';
var LOCKFOOT = '<div class="fs-lockfoot"><i><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 2h8v4l-2 3v11a2 2 0 0 1-2 2 2 2 0 0 1-2-2V9L8 6V2zm4 9.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg></i><i><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 4h6l1.6 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.4L9 4zm3 4.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg></i></div>';
  var o = story.opener, b = story.booked, c = story.contact;

  var opener = o.kind === "call"
    ? '<div class="fs fs-call" data-s="call"><div class="fs-callhead"><span class="fs-ava fs-ava-lg"><i></i><i></i>?</span><small>Incoming call</small><b>' + esc(o.number) + '</b><span>' + esc(o.place) + '</span></div><div class="fs-callbtns"><span><i class="fs-dec">' + HANDSET + '</i>Decline</span><span><i class="fs-acc">' + HANDSET + '</i>Accept</span></div></div>' +
      '<div class="fs fs-missed" data-s="missed"><span class="fs-missicon">' + HANDSET + '</span><b>Missed call</b><span>' + esc(o.number) + ' · ' + esc(o.time) + ' PM</span><em>No voicemail</em></div>'
    : '<div class="fs fs-lock fs-night" data-s="call"><div class="fs-lockhead"><small>' + esc(o.date) + '</small><b>' + esc(o.time) + '</b></div><div class="fs-notif"><span class="fs-app fs-app-web"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></span><div><p><span>' + esc(o.app) + '</span><span>now</span></p><b>' + esc(o.title) + '</b><span>' + esc(o.body) + '</span></div></div><p class="fs-stale">No reply yet</p><div class="fs-zzz" aria-hidden="true"><i>z</i><i>z</i><i>z</i></div>' + LOCKFOOT + '</div>';

  root.innerHTML =
    '<div class="film-phone" aria-hidden="true"><div class="fs-island"></div>' +
      '<div class="fs-status"><b data-clock>' + esc(o.time) + '</b><span><svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".45"/><rect x="2.5" y="2.5" width="15" height="7" rx="2"/><rect x="24" y="4" width="2" height="4" rx="1" opacity=".45"/></svg></span></div>' +
      opener +
      '<div class="fs fs-thread" data-s="thread"><div class="fs-head"><span class="fs-ava">' + esc(c.initial) + '</span><b>' + esc(c.name) + '</b><small>' + esc(c.sub) + '</small><span class="fs-chip">' + esc(story.replyIn) + '</span></div><div class="fs-msgs" data-msgs></div><div class="fs-compose"><span>Text message</span></div></div>' +
      '<div class="fs fs-lock fs-done" data-s="booked"><div class="fs-lockhead"><small>' + esc(b.date) + '</small><b>' + esc(b.time) + '</b></div><div class="fs-notif fs-notif-cinder"><span class="fs-app fs-app-cinder"><i></i></span><div><p><span>Cinder</span><span>now</span></p><b>' + esc(b.title) + '</b>' + b.lines.map(function (l) { return "<span>" + esc(l) + "</span>"; }).join("") + '</div></div>' + LOCKFOOT + '</div>' +
      '<div class="fs-home"></div>' +
    '</div>' +
    '<div class="film-ui"><div class="film-bar"><button class="film-pp" type="button" aria-label="Pause demo"><svg class="i-pause" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx="1"/><rect x="9.5" y="2.5" width="3" height="11" rx="1"/></svg><svg class="i-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4c0 .5.6.9 1 .6l8-5.2c.4-.3.4-.9 0-1.2l-8-5.2c-.4-.3-1 .1-1 .6z"/></svg></button><div class="film-segs">' +
      story.chapters.map(function (ch, i) { return '<button type="button" class="film-seg" data-i="' + i + '" aria-label="Jump to: ' + esc(ch[0]) + '"><i></i></button>'; }).join("") +
    '</div></div><p class="film-cap"><span class="film-kick"></span><span class="film-txt"></span></p></div>' +
    '<p class="sr-only">' + esc(transcript()) + '</p>';

  function transcript() {
    var out = ["Example conversation."];
    story.chapters.forEach(function (ch) { out.push(ch[1]); });
    story.thread.forEach(function (s) { if (s[0] === "out") out.push("Business: " + s[1]); else if (s[0] === "in") out.push(c.name + ": " + s[1]); });
    out.push("Notification: " + b.title + ". " + b.lines.join(". ") + ".");
    return out.join(" ");
  }

  var $ = function (sel) { return root.querySelector(sel); };
  var phone = $(".film-phone"), msgs = $("[data-msgs]"), clock = $("[data-clock]"), chip = $(".fs-chip");
  var kick = $(".film-kick"), txt = $(".film-txt"), segs = [].slice.call(root.querySelectorAll(".film-seg")), pp = $(".film-pp");
  var screens = [].slice.call(root.querySelectorAll(".fs"));

  // ---- DOM actions (each takes `instant` so seeking can replay them without animation) ----
  function show(name) { return function () { screens.forEach(function (s) { s.classList.toggle("on", s.getAttribute("data-s") === name); }); phone.setAttribute("data-screen", name); }; }
  function setTime(t) { return function () { clock.textContent = t; }; }
  function setChip(on) { return function () { chip.classList.toggle("on", on); }; }
  function stale() { var s = root.querySelector(".fs-stale"); if (s) s.classList.add("on"); }
  var curCap = -1;
  function setCap(i) { return function (instant) { curCap = i; kick.textContent = (i + 1) + " / " + story.chapters.length; txt.textContent = story.chapters[i][1]; var cap = kick.parentNode; cap.classList.remove("in"); if (!instant) { void cap.offsetWidth; cap.classList.add("in"); } segs.forEach(function (s, j) { s.classList.toggle("is-on", j === i); }); if (!instant) root.dispatchEvent(new CustomEvent("film:chapter", { detail: i })); }; }

  function flip(mutate, instant) {
    if (instant) { mutate(); return; }
    var kids = [].slice.call(msgs.children), y = kids.map(function (k) { return k.getBoundingClientRect().top; });
    mutate();
    kids.forEach(function (k, i) { if (!k.isConnected) return; var d = y[i] - k.getBoundingClientRect().top; if (d) { k.style.transition = "none"; k.style.transform = "translateY(" + d + "px)"; } });
    void msgs.offsetHeight;
    kids.forEach(function (k) { k.style.transition = ""; k.style.transform = ""; });
  }
  function dropTyping() { var t = msgs.querySelector(".fb-typing"); if (t) t.remove(); }
  function typing(side) { return function (instant) { flip(function () { dropTyping(); var el = document.createElement("div"); el.className = "fb fb-" + side + " fb-typing"; el.innerHTML = "<i></i><i></i><i></i>"; msgs.appendChild(el); }, instant); }; }
  function bubble(side, html, extra) { return function (instant) { flip(function () { dropTyping(); var el = document.createElement("div"); el.className = "fb fb-" + side + (extra ? " " + extra : ""); el.innerHTML = html; msgs.appendChild(el); }, instant); }; }

  // ---- Build the timeline ----
  var T = [], chapAt = [], t = 0;
  var at = function (fn) { T.push({ t: t, fn: fn }); };
  var wait = function (ms) { t += ms; };
  var chap = function (i) { chapAt[i] = t; at(setCap(i)); };

  var durs = (root.getAttribute("data-film-durs") || "").split(",").map(Number).filter(function (n) { return n > 0; });
  if (durs.length === 6) {
    // Fixed-length cut: every chapter runs exactly its slot; messages land 0.6s apart.
    chap(0); at(show("call")); at(setTime(o.time)); wait(durs[0]);
    chap(1); if (o.kind === "call") at(show("missed")); else at(stale); wait(durs[1]);
    var firstOut = true, slotStart = t, slot = 2;
    story.thread.forEach(function (s) {
      var k = s[0];
      if (k === "ch") {
        if (s[1] > 2) { t = Math.max(t, slotStart + durs[slot]); }
        slot = s[1]; slotStart = t; chap(slot);
        if (slot === 2) { at(show("thread")); wait(300); }
      } else if (k === "time") at(setTime(s[1]));
      else {
        var side = k === "out" ? "out" : "in";
        at(typing(side)); wait(280);
        at(bubble(side, side === "out" ? esc(s[1]).replace(/\n/g, "<br>") : esc(s[1])));
        if (side === "out" && firstOut) { at(setChip(true)); firstOut = false; }
        wait(320);
      }
    });
    t = Math.max(t, slotStart + durs[slot]);
    chap(5); at(show("booked")); at(setTime(b.time)); wait(durs[5]);
  } else {
  chap(0); at(show("call")); at(setTime(o.time)); wait(3400);
  chap(1);
  if (o.kind === "call") at(show("missed")); else at(stale);
  wait(3600);
  var first = true;
  story.thread.forEach(function (s) {
    var k = s[0];
    if (k === "ch") { if (s[1] === 2) { at(show("thread")); wait(500); } chap(s[1]); }
    else if (k === "time") at(setTime(s[1]));
    else if (k === "out") {
      at(typing("out")); wait(first ? 900 : 1150);
      at(bubble("out", esc(s[1]).replace(/\n/g, "<br>")));
      if (first) { at(setChip(true)); first = false; }
      wait(900 + s[1].length * 22);
    } else if (k === "in") {
      wait(250); at(typing("in")); wait(1100);
      at(bubble("in", esc(s[1]))); wait(650 + s[1].length * 20);
    }
  });
  wait(600);
  chap(5); at(show("booked")); at(setTime(b.time));
  wait(5200);
  }
  var D = t;
  var chapEnd = chapAt.map(function (s, i) { return i + 1 < chapAt.length ? chapAt[i + 1] : D; });
  var threadDone = chapAt[5] - 1; // used for reduced motion: the full conversation

  // ---- Player ----
  var cur = 0, idx = 0, playing = false, userPaused = false, visible = false, raf = 0, last = 0;
  function reset() {
    msgs.innerHTML = ""; chip.classList.remove("on");
    var s = root.querySelector(".fs-stale"); if (s) s.classList.remove("on");
    idx = 0; cur = 0;
  }
  function fire(instant) { while (idx < T.length && T[idx].t <= cur) { T[idx].fn(instant); idx++; } }
  function paint() {
    segs.forEach(function (s, i) {
      var p = (cur - chapAt[i]) / (chapEnd[i] - chapAt[i]);
      s.firstChild.style.transform = "scaleX(" + Math.max(0, Math.min(1, p)) + ")";
    });
  }
  function seek(ms) {
    root.classList.add("instant");
    reset(); cur = ms; fire(true); paint();
    void root.offsetWidth;
    root.classList.remove("instant");
  }
  function frame(now) {
    if (!playing) return;
    var dt = Math.min(80, now - last); last = now; cur += dt * SPEED;
    if (cur >= D && manual) { cur = D; fire(false); paint(); playing = false; root.dispatchEvent(new CustomEvent("film:end")); return; }
    if (cur >= D) {
      playing = false; phone.classList.add("fade");
      setTimeout(function () { seek(0); phone.classList.remove("fade"); if (!userPaused && visible) play(); }, 450);
      return;
    }
    fire(false); paint();
    raf = requestAnimationFrame(frame);
  }
  function play() { if (playing) return; playing = true; root.classList.remove("paused"); pp.setAttribute("aria-label", "Pause demo"); last = performance.now(); raf = requestAnimationFrame(frame); }
  function pause() { playing = false; cancelAnimationFrame(raf); root.classList.add("paused"); pp.setAttribute("aria-label", "Play demo"); }

  pp.addEventListener("click", function () { if (playing) { userPaused = true; pause(); } else { userPaused = false; if (cur >= threadDone && !document.documentElement.classList.contains("motion")) seek(0); play(); } });
  segs.forEach(function (s) { s.addEventListener("click", function () { seek(chapAt[+s.getAttribute("data-i")]); userPaused = false; play(); }); });
  phone.addEventListener("click", function () { pp.click(); });
  var onVis = function () { if (document.hidden) pause(); else if (visible && !userPaused) play(); };
  document.addEventListener("visibilitychange", onVis);
  var io = null;
  function destroy() { pause(); document.removeEventListener("visibilitychange", onVis); if (io) io.disconnect(); }

  if (manual) {
    seek(0); pause();
    root.film = { play: function () { userPaused = false; play(); }, pause: pause, seek: seek, D: D, chapAt: chapAt.slice(), speed: SPEED };
    root.dispatchEvent(new CustomEvent("film:ready"));
    return;
  }
  var motion = document.documentElement.classList.contains("motion");
  if (!motion) { seek(threadDone); show("thread")(); userPaused = true; pause(); return; }
  seek(0); pause();
  if (autoplay) { visible = true; play(); }
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !userPaused) play(); else if (!visible) pause(); }, { threshold: 0.35 });
    io.observe(phone);
  } else { visible = true; play(); }
  }
})();
