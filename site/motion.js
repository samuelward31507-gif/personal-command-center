// Site-wide motion: scroll reveals with stagger, line draws, count-ups, smooth FAQ, nav progress, card spotlight.
// Everything here is progressive: without JS or with reduced motion, the page is fully visible and static.
(function () {
  var html = document.documentElement;
  var motion = html.classList.contains("motion");
  var EASE = "cubic-bezier(.16,1,.3,1)";

  // ---- Nav: scroll progress hairline ----
  var nav = document.getElementById("nav");
  if (nav) {
    var bar = document.createElement("i");
    bar.className = "nav-progress"; bar.setAttribute("aria-hidden", "true");
    nav.appendChild(bar);
    var ticking = false;
    var upd = function () {
      ticking = false;
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, scrollY / h) : 0) + ")";
    };
    addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }

  // ---- Smooth FAQ open/close ----
  [].forEach.call(document.querySelectorAll(".qa details, details.calc-how"), function (d) {
    var s = d.querySelector("summary"), anim = null, isClosing = false;
    if (!s || !motion || !d.animate) return;
    s.addEventListener("click", function (e) {
      e.preventDefault();
      var closing = d.open && !isClosing;
      var start = d.offsetHeight;
      if (anim) { anim.cancel(); anim = null; }
      var edge = d.offsetHeight - d.clientHeight, end;
      if (closing) end = s.offsetHeight + edge;
      else { d.open = true; d.style.height = ""; end = d.offsetHeight; }
      isClosing = closing;
      d.style.overflow = "hidden";
      anim = d.animate({ height: [start + "px", end + "px"] }, { duration: closing ? 260 : 380, easing: EASE });
      var body = d.querySelector("summary ~ *");
      if (body && !closing) body.animate({ opacity: [0, 1], transform: ["translateY(-4px)", "none"] }, { duration: 420, easing: EASE });
      anim.onfinish = function () { if (closing) d.open = false; isClosing = false; d.style.overflow = ""; anim = null; };
    });
  });

  if (!motion) return;

  // ---- Spotlight that follows the pointer on cards ----
  [].forEach.call(document.querySelectorAll(".plan, .calc-out, .guarantee, .book-cal"), function (el) {
    el.classList.add("spot");
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - r.left) + "px");
      el.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });

  // ---- Scroll reveals ----
  if (!("IntersectionObserver" in window)) return;
  var GROUPS = ".pipe, .desc, .inds, .plans, .terms, .qa, .book-steps, .demo-terms";
  var HEADS = ".split-head, .sec-head";
  var items = [];
  var fold = innerHeight * 0.92;
  function mark(el, i) {
    if (el.getBoundingClientRect().top < fold) return; // already on screen at load: never hide it
    el.classList.add("rv");
    el.style.setProperty("--d", Math.min(i, 8));
    items.push(el);
  }
  [].forEach.call(document.querySelectorAll("main > section:not(.hero) .wrap > *"), function (el) {
    if (el.matches(GROUPS) || el.matches(HEADS)) [].forEach.call(el.children, mark);
    else if (el.matches(".book-copy")) [].forEach.call(el.children, function (c, i) { if (c.matches(".book-steps")) [].forEach.call(c.children, function (li, j) { mark(li, i + j); }); else mark(c, i); });
    else {
      mark(el, 0);
      [].forEach.call(el.querySelectorAll(GROUPS), function (g) { [].forEach.call(g.children, mark); });
    }
  });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
      if (e.target.matches(".guarantee") || e.target.querySelector(".guarantee")) countUp(document.querySelector(".guarantee .big"));
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  items.forEach(function (el) { io.observe(el); });

  // ---- Count up the first number in an element ----
  function countUp(el) {
    if (!el || el.dataset.counted) return; el.dataset.counted = "1";
    var node = [].filter.call(el.childNodes, function (n) { return n.nodeType === 3 && /\d/.test(n.nodeValue); })[0];
    if (!node) return;
    var to = parseInt(node.nodeValue, 10), t0 = performance.now(), D = 1300;
    (function tick(now) {
      var p = Math.min(1, (now - t0) / D), k = 1 - Math.pow(1 - p, 4);
      node.nodeValue = String(Math.round(to * k));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
})();
