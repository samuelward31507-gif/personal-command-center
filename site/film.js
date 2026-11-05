// Animated phone demo for /fence-demo and /pool-demo.
// Plays a scripted lead conversation inside a drawn phone, with chapter captions outside it.
// Pauses off screen and in background tabs. Reduced motion: shows the finished conversation, paused.
(function () {
  var roots = [].slice.call(document.querySelectorAll("[data-film]"));
  if (!roots.length) return;

  var PHOTO = '<svg viewBox="0 0 200 140" aria-hidden="true"><defs><linearGradient id="fsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb8de"/><stop offset="1" stop-color="#d6e6f2"/></linearGradient><linearGradient id="fwood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6a3c"/><stop offset="1" stop-color="#6e4724"/></linearGradient></defs><rect width="200" height="140" fill="url(#fsky)"/><circle cx="150" cy="58" r="34" fill="#4d7a35"/><circle cx="128" cy="70" r="24" fill="#5b8a3e"/><rect x="146" y="78" width="6" height="30" fill="#5a3d22"/><rect y="104" width="200" height="36" fill="#6f9442"/><rect y="104" width="200" height="6" fill="#5f8338"/><g fill="url(#fwood)"><rect x="0" y="66" width="200" height="6" opacity=".9"/><rect x="0" y="92" width="200" height="6" opacity=".9"/><rect x="4" y="58" width="13" height="52"/><rect x="19" y="60" width="13" height="50"/><rect x="34" y="57" width="13" height="53"/><rect x="49" y="62" width="13" height="48" transform="rotate(4 55 110)"/><rect x="66" y="59" width="13" height="51"/><rect x="96" y="58" width="13" height="52"/><rect x="111" y="61" width="13" height="49"/><rect x="126" y="57" width="13" height="53"/><rect x="141" y="64" width="13" height="46" transform="rotate(-6 147 110)"/><rect x="158" y="58" width="13" height="52"/><rect x="173" y="60" width="13" height="50"/><rect x="188" y="58" width="13" height="52"/></g><g fill="#3d2814" opacity=".35"><rect x="10" y="58" width="1.5" height="52"/><rect x="40" y="57" width="1.5" height="53"/><rect x="117" y="61" width="1.5" height="49"/><rect x="164" y="58" width="1.5" height="52"/></g></svg>';

  var STORIES = {
    roofing: {
      contact: { name: "Dana", sub: "New lead · roofing", initial: "D" },
      opener: { kind: "call", time: "3:40", number: "(303) 555-0187", place: "Aurora, CO" },
      replyIn: "Replied in 6 sec",
      chapters: [
        ["The call", "3:40 PM. You're on a tear-off when a homeowner with a leaking roof calls."],
        ["Missed", "You can't pick up. When nobody answers, most people call the next roofer on the list."],
        ["Texted back", "6 seconds later, your business texts them back."],
        ["Qualified", "It finds out what they need and whether insurance is involved."],
        ["Booked", "Then it books the inspection on your calendar."],
        ["Your text", "You get one text with everything. They never called the next roofer."]
      ],
      thread: [
        ["ch", 2], ["out", "Hi, it's Summit Roofing. Sorry we missed you, the crew is up on a roof! Is this a leak, storm damage or a full replacement?"], ["in", "leak in the upstairs bedroom after the hail last week"],
        ["ch", 3], ["time", "3:41"], ["out", "Sorry to hear that. Are you going through insurance, or paying out of pocket?"], ["in", "insurance, already have a claim number"], ["out", "Perfect, we work with insurance all the time. What's the address?"], ["in", "4471 S Kittredge St"],
        ["ch", 4], ["time", "3:43"], ["out", "Got it. I can have an inspector out:\n1) Tomorrow 9:00 AM\n2) Tomorrow 1:30 PM"], ["in", "9 please"], ["out", "You're booked for tomorrow at 9:00 AM ✓ We'll text when we're on the way."]
      ],
      booked: { date: "Tuesday, November 4", time: "3:44", title: "Inspection booked: Dana", lines: ["Wed 9:00 AM · 4471 S Kittredge St", "Hail leak · insurance claim open", "Upstairs bedroom"] }
    },
    hvac: {
      contact: { name: "Chris", sub: "New lead · HVAC", initial: "C" },
      opener: { kind: "form", date: "Saturday, July 12", time: "10:47", app: "Website", title: "New service request", body: "AC not cooling · Chris" },
      replyIn: "Replied in 9 sec",
      chapters: [
        ["The form", "10:47 PM on a Saturday in July. A family's AC just quit."],
        ["Waiting", "Most shops reply Monday. By then they've hired whoever answered tonight."],
        ["Texted back", "9 seconds later, your business texts them back."],
        ["Sorted", "It tells the emergency from the tune-up."],
        ["Booked", "And books the first slot in the morning."],
        ["Your text", "You start Sunday with an urgent call already on the board."]
      ],
      thread: [
        ["ch", 2], ["out", "Hi Chris, it's Peak Air. Sorry your AC is out. Is it blowing warm air, or not turning on at all?"], ["in", "blowing warm. house is 84 and we have a baby"],
        ["ch", 3], ["time", "10:48"], ["out", "Understood, we'll treat this as urgent. Roughly how old is the system?"], ["in", "maybe 12 years"],
        ["ch", 4], ["time", "10:49"], ["out", "Thanks. Our first openings tomorrow:\n1) 8:00 AM\n2) 10:30 AM"], ["in", "8am please!!"], ["out", "You're booked for 8:00 AM ✓ Your tech will text when they're on the way."]
      ],
      booked: { date: "Sunday, July 13", time: "6:15", title: "Urgent service booked: Chris", lines: ["Today 8:00 AM · AC blowing warm", "~12-year system · infant at home", "Marked urgent"] }
    },
    fence: {
      contact: { name: "Jen", sub: "New lead · fence", initial: "J" },
      opener: { kind: "call", time: "2:14", number: "(720) 555-0143", place: "Denver, CO" },
      replyIn: "Replied in 8 sec",
      chapters: [
        ["The call", "2:14 PM. You're up on a roof when a $9,000 fence lead calls."],
        ["Missed", "You can't pick up. Most companies call back tonight, after the lead has hired someone else."],
        ["Texted back", "8 seconds later, your business texts them back."],
        ["Qualified", "It asks the questions you'd ask on every estimate."],
        ["Booked", "It gives your ballpark and books the estimate."],
        ["Your text", "You climb down. The job is already on your calendar."]
      ],
      thread: [
        ["ch", 2], ["out", "Sorry we missed you, the crew's on a job! I can help right here. New fence or a repair?"], ["in", "new fence. backyard, wood privacy"],
        ["ch", 3], ["time", "2:15"], ["out", "Nice! Roughly how much fence? A guess is fine. Any gates?"], ["in", "maybe 150 ft, 1 gate"], ["out", "Perfect. Can you snap a photo of the yard?"], ["photo"],
        ["ch", 4], ["time", "2:17"], ["out", "Thanks! Most jobs like this run $7,800–9,600. I can have someone out:\n1) Thu 2:30 PM\n2) Fri 8:00 AM"], ["in", "1"], ["out", "You're booked for Thu 2:30 PM ✓ What's the address?"], ["in", "2290 Elm St"]
      ],
      booked: { date: "Tuesday, November 4", time: "2:19", title: "New estimate booked: Jen", lines: ["Thu 2:30 PM · 2290 Elm St", "Wood privacy · ~150 ft · 1 gate · photo", "Ballpark given: $7,800–9,600"] }
    },
    pool: {
      contact: { name: "Marcus", sub: "New lead · pool", initial: "M" },
      opener: { kind: "form", date: "Tuesday, November 4", time: "9:12", app: "Website", title: "New form submission", body: "Inground pool · Marcus" },
      replyIn: "Replied in 11 sec",
      chapters: [
        ["The form", "9:12 PM. You're off for the night when someone asks about a $70,000 pool."],
        ["Waiting", "Most builders call back at 10 AM. By then the buyer has reached out to two more."],
        ["Texted back", "11 seconds later, your business texts them back."],
        ["Screened", "It screens the budget and checks the yard."],
        ["Booked", "Then it books the design consultation."],
        ["Your text", "You wake up to a qualified buyer on your calendar."]
      ],
      thread: [
        ["ch", 2], ["out", "Hi Marcus, it's Bluewater Pools! Thanks for reaching out. New pool or a remodel?"], ["in", "new. just bought the house"],
        ["ch", 3], ["time", "9:13"], ["out", "Congrats! Most of our pools land between $65k and $110k, and financing is available. Does that range work?"], ["in", "yeah around 80"], ["out", "Great. Is there 8–10 ft of side access for an excavator? Any HOA?"], ["in", "10 ft gate. HOA yes"],
        ["ch", 4], ["time", "9:15"], ["out", "Perfect. Let's get you a 15-min video call with our designer tomorrow:\n1) 12:30 PM\n2) 5:00 PM"], ["in", "5 works. my wife will join"], ["out", "You're booked for tomorrow at 5:00 PM ✓ The link is on its way."]
      ],
      booked: { date: "Wednesday, November 5", time: "6:40", title: "Design consultation booked: Marcus", lines: ["Today 5:00 PM · video call", "Budget ~$80k · 10 ft access · HOA yes", "Spouse joining"] }
    }
  };

  var LABELS = { roofing: "Roofing", hvac: "HVAC", fence: "Fence", pool: "Pools" };
  roots.forEach(function (r) { mount(r, r.getAttribute("data-film"), false); });

  function mount(root, key, autoplay) {
  var story = STORIES[key];
  if (!story) return;
  var tabKeys = (root.getAttribute("data-film-tabs") || "").split(",").filter(function (k) { return STORIES[k]; });

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var HANDSET = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>';
var LOCKFOOT = '<div class="fs-lockfoot"><i><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 2h8v4l-2 3v11a2 2 0 0 1-2 2 2 2 0 0 1-2-2V9L8 6V2zm4 9.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg></i><i><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 4h6l1.6 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.4L9 4zm3 4.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg></i></div>';
  var o = story.opener, b = story.booked, c = story.contact;

  var opener = o.kind === "call"
    ? '<div class="fs fs-call" data-s="call"><div class="fs-callhead"><span class="fs-ava fs-ava-lg"><i></i><i></i>?</span><small>Incoming call</small><b>' + esc(o.number) + '</b><span>' + esc(o.place) + '</span></div><div class="fs-callbtns"><span><i class="fs-dec">' + HANDSET + '</i>Decline</span><span><i class="fs-acc">' + HANDSET + '</i>Accept</span></div></div>' +
      '<div class="fs fs-missed" data-s="missed"><span class="fs-missicon">' + HANDSET + '</span><b>Missed call</b><span>' + esc(o.number) + ' · ' + esc(o.time) + ' PM</span><em>No voicemail</em></div>'
    : '<div class="fs fs-lock fs-night" data-s="call"><div class="fs-lockhead"><small>' + esc(o.date) + '</small><b>' + esc(o.time) + '</b></div><div class="fs-notif"><span class="fs-app fs-app-web"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></span><div><p><span>' + esc(o.app) + '</span><span>now</span></p><b>' + esc(o.title) + '</b><span>' + esc(o.body) + '</span></div></div><p class="fs-stale">No reply yet</p><div class="fs-zzz" aria-hidden="true"><i>z</i><i>z</i><i>z</i></div>' + LOCKFOOT + '</div>';

  root.innerHTML = (tabKeys.length ? '<div class="film-tabs" role="group" aria-label="Pick a business">' + tabKeys.map(function (k) { return '<button type="button" class="film-tab' + (k === key ? ' is-on' : '') + '" data-k="' + k + '" aria-pressed="' + (k === key) + '">' + LABELS[k] + '</button>'; }).join('') + '</div>' : '') +
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
    story.thread.forEach(function (s) { if (s[0] === "out") out.push("Business: " + s[1]); else if (s[0] === "in") out.push(c.name + ": " + s[1]); else if (s[0] === "photo") out.push(c.name + " sends a photo of the yard."); });
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
  function setCap(i) { return function (instant) { curCap = i; kick.textContent = (i + 1) + " / " + story.chapters.length; txt.textContent = story.chapters[i][1]; var cap = kick.parentNode; cap.classList.remove("in"); if (!instant) { void cap.offsetWidth; cap.classList.add("in"); } segs.forEach(function (s, j) { s.classList.toggle("is-on", j === i); }); }; }

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
    } else if (k === "photo") {
      wait(250); at(typing("in")); wait(1300);
      at(bubble("in", PHOTO, "fb-photo")); wait(1500);
    }
  });
  wait(600);
  chap(5); at(show("booked")); at(setTime(b.time));
  wait(5200);
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
    var dt = Math.min(80, now - last); last = now; cur += dt;
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
  [].forEach.call(root.querySelectorAll(".film-tab"), function (b) {
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-k"); if (k === key) return;
      destroy(); mount(root, k, true);
      var nb = root.querySelector('.film-tab[data-k="' + k + '"]'); if (nb) nb.focus({ preventScroll: true });
    });
  });

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
