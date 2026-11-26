// Line-and-dot visuals, one per page. Canvas 2D, crisp 1px lines, white on black, crimson only where something happens.
// Each is a global with mount(host) and setStep(i), so scenes.js can drive it; [data-plate] hosts mount on their own.
(function () {
  var RM = false, RED = '#e0193a', INK = '242,241,238';
  var MONO = '500 10.5px "Geist Mono",ui-monospace,monospace', SANS = '500 13px Inter,system-ui,sans-serif';
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v } function lerp(a, b, t) { return a + (b - a) * t } function ez(x) { x = cl(x); return x * x * (3 - 2 * x) }
  function ink(a) { return 'rgba(' + INK + ',' + cl(a).toFixed(3) + ')' }
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
  function mk(draw, scrub) {
    var S = { step: 0, s: 0, t: 0, ts: 0 };
    var api = {
      setStep: function (i) { if (i !== S.step) { S.step = i; S.ts = S.t } if (S.kick) S.kick() }, setProgress: function () { },
      mount: function (host) {
        var cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .9s cubic-bezier(.2,.8,.2,1)'; cv.setAttribute('aria-hidden', 'true');
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; host.appendChild(cv);
        var c = cv.getContext('2d'), W = 1, H = 1, vis = false, raf = 0, t0 = performance.now(), last = t0;
        function size() { var r = host.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); W = Math.max(1, r.width); H = Math.max(1, r.height); cv.width = W * d; cv.height = H * d; c.setTransform(d, 0, 0, d, 0, 0); kick() }
        function frame(now) {
          raf = 0; var dt = Math.min(.05, (now - last) / 1000); last = now; S.s += (S.step - S.s) * (RM ? 1 : Math.min(1, dt * (S.rate || 4.5))); S.t = RM ? 40 : Math.max(0, (now - t0) / 1000); S.since = RM ? 99 : S.t - S.ts;
          if (vis || RM) cv.style.opacity = 1; c.clearRect(0, 0, W, H); c.lineWidth = 1; c.lineJoin = 'round'; draw(c, W, H, S.s, S.t, S); if (vis && !RM) raf = requestAnimationFrame(frame)
        }
        function kick() { if (!raf) raf = requestAnimationFrame(frame) }
        new ResizeObserver(size).observe(host); new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) { last = performance.now(); kick() } }).observe(host); size(); S.kick = kick
      }
    };
    // scrub: the scroll position is the timeline. Every part arrives and leaves with the scroll, in both directions.
    if (scrub) { S.rate = 10; delete api.setStep; api.setProgress = function (v) { S.step = v * scrub; if (S.kick) S.kick() } }
    return api
  }
  // isometric projection; k = 0 looks straight down, k = 1 is full iso
  function iso(cx, cy, u, k) { k = k == null ? 1 : k; return function (x, y, z) { return [cx + lerp(x, (x - z) * .866, k) * u, cy + lerp(z, (x + z) * .5, k) * u - (y || 0) * u * k] } }
  function poly(c, pts, stroke, fill) { c.beginPath(); pts.forEach(function (p, i) { i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]) }); c.closePath(); if (fill) { c.fillStyle = fill; c.fill() } if (stroke) { c.strokeStyle = stroke; c.stroke() } }
  function seg(c, a, b, stroke, w) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.strokeStyle = stroke; c.lineWidth = w || 1; c.stroke(); c.lineWidth = 1 }
  function dot(c, p, r, fill) { c.beginPath(); c.arc(p[0], p[1], r, 0, 6.2832); c.fillStyle = fill; c.fill() }
  function ring(c, p, r, stroke, w) { c.beginPath(); c.arc(p[0], p[1], r, 0, 6.2832); c.strokeStyle = stroke; c.lineWidth = w || 1; c.stroke(); c.lineWidth = 1 }
  function quad(P, y, h, hz) { hz = hz == null ? h : hz; return [P(-h, y, -hz), P(h, y, -hz), P(h, y, hz), P(-h, y, hz)] }
  function plate(c, P, y, n, fn, a, k) {
    var th = .07 * (k == null ? 1 : k); poly(c, quad(P, y - th, 1), ink(.28 * a), 'rgba(0,0,0,.92)'); poly(c, quad(P, y, 1), ink(.6 * a), 'rgba(0,0,0,.92)');
    [[1, -1], [1, 1], [-1, 1]].forEach(function (q) { seg(c, P(q[0], y, q[1]), P(q[0], y - th, q[1]), ink(.4 * a)) });
    for (var i = 0; i < n; i++)for (var j = 0; j < n; j++) { var x = -1 + 2 * (i + .5) / n, z = -1 + 2 * (j + .5) / n, v = fn(x, z, i, j); if (v.a < .03) continue; var p = P(x * .93, y + (v.dy || 0), z * .93); c.fillStyle = v.red ? RED : ink(v.a * a); c.fillRect(p[0] - .8, p[1] - .8, 1.7, 1.7) }
  }
  function label(c, x, y, txt, a, align) { c.font = MONO; var w = c.measureText(txt).width + 14, lx = align === 'l' ? x : align === 'r' ? x - w : x - w / 2; lx = Math.round(lx) + .5; y = Math.round(y) + .5; c.fillStyle = 'rgba(8,8,9,' + (.92 * a) + ')'; c.fillRect(lx, y - 10, w, 20); c.strokeStyle = ink(.75 * a); c.strokeRect(lx, y - 10, w, 20); c.fillStyle = ink(a); c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(txt, lx + 7, y + .5) }
  function pin(c, p, txt, a, red) { if (a < .02) return; seg(c, [p[0], p[1] - 7], [p[0], p[1] - 30], ink(.7 * a)); ring(c, p, 7, red ? RED : ink(.9 * a), 1.2); dot(c, p, 2.6, red ? RED : ink(a)); label(c, p[0], p[1] - 40, txt, a) }
  function text(c, x, y, txt, a, font, align) { c.font = font || MONO; c.fillStyle = ink(a); c.textAlign = align || 'left'; c.textBaseline = 'middle'; c.fillText(txt, x, y) }
  function starR(th, Ro, Ri) { var w = Math.PI * 2 / 5, m = ((th + Math.PI / 2) % w + w) % w; m = Math.abs(m - w / 2); m = w / 2 - m; return Ro * Ri * Math.sin(w / 2) / (Ro * Math.sin(m) + Ri * Math.sin(w / 2 - m)) }

  // ---- Homepage: what we build. Five empty slots. Scroll and each one is filled by a solid layer with its own
  // working drawing on top: answering, booking, follow-up, reviews, website. Then one frame closes around the stack.
  var LAYN = ['Answering', 'Booking', 'Follow-up', 'Reviews', 'Website'], LAYS = ['Calls, texts, forms', 'Calendar, reminders', 'Quotes, invoices', 'Review requests', 'Pages that book'];
  function part(c, A, B, k, stroke, w) { if (k <= 0) return; seg(c, A, [lerp(A[0], B[0], cl(k)), lerp(A[1], B[1], cl(k))], stroke, w) }
  function oval(c, G, x, z, r, stroke, fill, w) { c.beginPath(); for (var i = 0; i <= 40; i++) { var a = i / 40 * 6.2832, p = G(x + Math.cos(a) * r, z + Math.sin(a) * r); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]) } if (fill) { c.fillStyle = fill; c.fill() } if (stroke) { c.strokeStyle = stroke; c.lineWidth = w || 1; c.stroke(); c.lineWidth = 1 } }
  function red(a) { return 'rgba(224,25,58,' + cl(a).toFixed(3) + ')' }
  var GLYPH = [
    function (c, G, g, t, a) { // answering: three lines in, one reply out
      var C = [.18, .18], S = [[-.78, -.12], [-.12, -.78], [.74, -.52]];
      S.forEach(function (q, i) { var k = cl(g * 1.7 - i * .22); if (k <= 0) return; var A = G(q[0], q[1]), B = G(C[0], C[1]); part(c, A, B, k, ink(.62 * a)); oval(c, G, q[0], q[1], .05, null, ink(.95 * a)); if (k >= 1) { var m = (t * .5 + i * .33) % 1; dot(c, [lerp(A[0], B[0], m), lerp(A[1], B[1], m)], 2.1, ink(a)) } });
      var k2 = cl(g * 2.2 - 1.2); if (k2 > 0) { var w = (t * .55) % 1; oval(c, G, C[0], C[1], .17 + .34 * w, red((1 - w) * .75 * a * k2)); oval(c, G, C[0], C[1], .17, ink(.9 * a * k2), '#0a0a0c', 1.2); oval(c, G, C[0], C[1], .07, null, red(a * k2)) }
    },
    function (c, G, g, t, a) { // booking: a week fills, one slot is new
      var on = [1, 3, 6, 9, 12, 13], n = 0; for (var r = 0; r < 3; r++)for (var q = 0; q < 5; q++, n++) { var x = -.76 + q * .31, z = -.46 + r * .33, k = cl(g * 2.4 - n * .08); if (k <= 0) continue; var f = on.indexOf(n) >= 0 ? cl(g * 2.6 - 1.1 - n * .04) : 0, h = n === 7 ? cl(g * 3.2 - 2.2) : 0; poly(c, [G(x, z), G(x + .25, z), G(x + .25, z + .25), G(x, z + .25)], h > 0 ? red(a) : ink(.42 * a * k), h > 0 ? red(h * a) : f > 0 ? ink(.86 * f * a) : null) }
    },
    function (c, G, g, t, a) { // follow-up: day 1, day 2, day 5, settled
      var X = [-.72, -.24, .24, .72]; part(c, G(X[0], .12), G(X[3], .12), g * 1.4, ink(.3 * a));
      for (var i = 0; i < 3; i++) { var k = cl(g * 3.4 - i - .3); if (k <= 0) continue; c.beginPath(); for (var j = 0; j <= 18 * k; j++) { var m = j / 18, p = G(lerp(X[i], X[i + 1], m), .12, Math.sin(m * Math.PI) * .3); j ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]) } c.strokeStyle = ink(.75 * a); c.stroke() }
      X.forEach(function (x, i) { var k = cl(g * 3.4 - i + .5); if (k <= 0) return; var last = i === 3 && g > .96; oval(c, G, x, .12, .085, last ? red(a) : ink(.9 * a * k), last ? red(a) : '#0a0a0c', 1.2); if (!last) oval(c, G, x, .12, .03, null, ink(a * k)) })
    },
    function (c, G, g, t, a) { // reviews: five stars, filled one at a time
      for (var i = 0; i < 5; i++) { var k = cl(g * 2.2 - i * .12), f = cl(g * 5.4 - 1.6 - i * .7); if (k <= 0) continue; var cx = -.66 + i * .33, pts = []; for (var j = 0; j < 10; j++) { var a2 = -Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? .062 : .15; pts.push(G(cx + Math.cos(a2) * r, .05 + Math.sin(a2) * r)) } poly(c, pts, f >= 1 && i === 4 ? red(a) : ink(.8 * a * k), f > 0 ? (i === 4 ? red(f * a) : ink(.9 * f * a)) : null) }
    },
    function (c, G, g, t, a) { // website: a page with one button that books
      var x0 = -.74, x1 = .74, z0 = -.54, z1 = .54, R = [G(x0, z0), G(x1, z0), G(x1, z1), G(x0, z1)]; for (var i = 0; i < 4; i++)part(c, R[i], R[(i + 1) % 4], g * 4 - i, ink(.6 * a));
      var k = cl(g * 2.4 - 1); if (k <= 0) return; part(c, G(x0, -.36), G(x1, -.36), k * 1.5, ink(.4 * a)); [0, 1, 2].forEach(function (i) { oval(c, G, x0 + .1 + i * .09, -.45, .022, null, ink(.7 * a * k)) });
      poly(c, [G(-.6, -.2), G(.25, -.2), G(.25, -.08), G(-.6, -.08)], null, ink(.85 * a * k)); poly(c, [G(-.6, .02), G(.5, .02), G(.5, .08), G(-.6, .08)], null, ink(.3 * a * k)); poly(c, [G(-.6, .14), G(.1, .14), G(.1, .2), G(-.6, .2)], null, ink(.3 * a * k));
      var b = cl(g * 3.4 - 2.4); if (b > 0) poly(c, [G(-.6, .3), G(-.14, .3), G(-.14, .43), G(-.6, .43)], red(a), red(b * a))
    }];
  window.CinderStack = mk(function (c, W, H, s, t) {
    var nw = W < 520, u = Math.min(W * (nw ? .27 : .235), H * .158), gap = lerp(.86, .5, ez(s * 1.2)), th = .13, cx = W * (nw ? .5 : .39), P = iso(cx, H / 2 + u * .1, u, 1), box = ez((s - 5.2) / .7), act = Math.round(s) - 1, ys = [], i;
    for (i = 0; i < 5; i++)ys[i] = (i - 2) * gap;
    function face(y, h) { return quad(P, y, h == null ? 1 : h) }
    // the frame, back half first
    if (box > 0) { var top = ys[4] + .3, bot = ys[0] - th - .2, h = 1.2; part(c, P(-h, bot, -h), P(-h, top, -h), box * 1.6, ink(.22)); part(c, P(-h, bot, -h), P(h, bot, -h), box * 2, ink(.22)); part(c, P(-h, bot, -h), P(-h, bot, h), box * 2, ink(.22)) }
    for (i = 0; i < 5; i++) {
      var a = ez((s - (i + .22)) / .5), y = ys[i] + (1 - a) * 1.15, hot = i === act && box < .5, lvl = box > .5 ? 1 : hot ? 1 : .5, T = face(y);
      if (a < 1) poly(c, face(ys[i]), ink(.24 * (1 - a))); // the empty slot
      if (a <= .01) continue;
      var gr = c.createLinearGradient(T[0][0], T[0][1], T[2][0], T[2][1]); gr.addColorStop(0, 'rgba(27,27,31,' + a + ')'); gr.addColorStop(1, 'rgba(10,10,12,' + a + ')');
      poly(c, [P(-1, y, 1), P(1, y, 1), P(1, y - th, 1), P(-1, y - th, 1)], ink(.36 * a * lvl), 'rgba(5,5,6,' + a + ')');
      poly(c, [P(1, y, -1), P(1, y, 1), P(1, y - th, 1), P(1, y - th, -1)], ink(.36 * a * lvl), 'rgba(15,15,18,' + a + ')');
      poly(c, T, ink((hot ? .95 : .55) * a * (box > .5 ? 1 : lvl + .25)), gr); poly(c, face(y, .9), ink(.1 * a));
      (function (i, y) { GLYPH[i](c, function (x, z, up) { return P(x * .9, y + (up || 0), z * .9) }, cl((s - (i + .5)) / .46), t, a * (i < 4 ? 1 - ez((s - (i + 1.22)) / .4) : 1)) })(i, y);
      // name plate on the right, a hairline back to the layer
      if (!nw) { var e = P(1, y - th / 2, -1), lx = cx + 1.732 * u + 34, la = a * (box > .5 ? .92 : hot ? 1 : .42); seg(c, [e[0] + 6, Math.round(e[1]) + .5], [lx - 10, Math.round(e[1]) + .5], ink(.3 * la)); dot(c, [e[0] + 5, e[1]], 1.8, hot ? RED : ink(.8 * la));
        text(c, lx, e[1] - (hot ? 8 : 0), '0' + (i + 1), .5 * la); text(c, lx + 24, e[1] - (hot ? 8 : 0), LAYN[i], la, '600 14px Inter,system-ui,sans-serif'); if (hot) text(c, lx + 24, e[1] + 11, LAYS[i], .55 * a, '400 12px Inter,system-ui,sans-serif') }
    }
    if (nw && act >= 0 && act < 5 && box < .5) { var ta = cl(1 - Math.abs(s - Math.round(s)) * 2.4); text(c, 2, 14, '0' + (act + 1), .5 * ta); text(c, 26, 14, LAYN[act], ta, '600 13px Inter,system-ui,sans-serif'); text(c, 26, 32, LAYS[act], .55 * ta, '400 11.5px Inter,system-ui,sans-serif') }
    if (box > 0) { top = ys[4] + .3; bot = ys[0] - th - .2; h = 1.2; var C = [[h, -h], [h, h], [-h, h]]; C.forEach(function (q, k) { part(c, P(q[0], bot, q[1]), P(q[0], top, q[1]), box * 1.6 - k * .12, ink(k === 1 ? .7 : .4)) });
      part(c, P(-h, bot, h), P(h, bot, h), box * 2, ink(.4)); part(c, P(h, bot, h), P(h, bot, -h), box * 2, ink(.4)); var tk = cl(box * 2.4 - 1.3), F = face(top, h); for (i = 0; i < 4; i++)part(c, F[i], F[(i + 1) % 4], tk * 4 - i, ink(.6));
      // one line up the front corner ties every layer together
      var rk = cl(box * 2 - .8); part(c, P(1, ys[0] - th, 1), P(1, ys[4], 1), rk, RED, 1.6); for (i = 0; i < 5; i++)if (rk > i / 5) { var q2 = P(1, ys[i] - th / 2, 1); c.fillStyle = RED; c.fillRect(Math.round(q2[0]) - 3, Math.round(q2[1]) - 3, 6, 6) }
      if (!nw && tk > .4) { var tp = P(h, top, -h); text(c, tp[0] + 14, tp[1] - 2, 'One app', cl(tk * 2 - .8), '600 14px Inter,system-ui,sans-serif') } }
  }, 6);

  // ---- Homepage: what we build. A board of sixteen builds, not a fixed package. Scroll and one group at a time
  // stands up out of the board with its names on pins; the rest sit back. Then empty places open for whatever
  // else the business needs, and one line is traced through every tile: it all runs in one app.
  var BT = ['Calls', 'Texts', 'Forms', 'Lead vetting', 'Booking', 'Reminders', 'Estimates', 'Quote follow-up', 'Invoices', 'Reviews', 'Old customers', 'Quiet quotes', 'Job updates', 'Crew schedule', 'Reports', 'Website'], BG = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5];
  function arc(c, G, x, z, r, a0, a1, stroke) { c.beginPath(); for (var i = 0; i <= 16; i++) { var a = lerp(a0, a1, i / 16), q = G(x + Math.cos(a) * r, z + Math.sin(a) * r); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]) } c.strokeStyle = stroke; c.stroke() }
  function bx(G, x0, z0, x1, z1) { return [G(x0, z0), G(x1, z0), G(x1, z1), G(x0, z1)] }
  var BGL = [
    function (c, G, k) { [.3, .6, .9].forEach(function (r) { arc(c, G, -.55, .55, r, -1.5708, 0, k) }); oval(c, G, -.55, .55, .1, null, k) },
    function (c, G, k) { poly(c, [G(-.62, -.5), G(.62, -.5), G(.62, .2), G(-.08, .2), G(-.42, .62), G(-.36, .2), G(-.62, .2)], k) },
    function (c, G, k) { [-.42, 0].forEach(function (z) { poly(c, bx(G, -.62, z - .13, .62, z + .13), k) }); poly(c, bx(G, -.62, .34, -.1, .6), null, k) },
    function (c, G, k) { poly(c, [G(-.66, -.52), G(.66, -.52), G(.14, .04), G(.14, .62), G(-.14, .62), G(-.14, .04)], k) },
    function (c, G, k) { [[-.6, -.6], [.06, -.6], [-.6, .06], [.06, .06]].forEach(function (q, i) { poly(c, bx(G, q[0], q[1], q[0] + .54, q[1] + .54), k, i === 1 ? k : null) }) },
    function (c, G, k) { oval(c, G, 0, 0, .62, k); seg(c, G(0, 0), G(0, -.42), k); seg(c, G(0, 0), G(.3, .12), k) },
    function (c, G, k) { poly(c, bx(G, -.66, -.2, .66, .2), k); for (var i = -2; i <= 2; i++)seg(c, G(i * .24, -.2), G(i * .24, i % 2 ? -.02 : .06), k) },
    function (c, G, k) { seg(c, G(-.6, .3), G(.6, .3), k); [-.6, 0, .6].forEach(function (x, i) { oval(c, G, x, .3, .1 + i * .05, null, k) }); arc(c, G, -.3, .3, .3, Math.PI, 2 * Math.PI, k); arc(c, G, .3, .3, .3, Math.PI, 2 * Math.PI, k) },
    function (c, G, k) { poly(c, bx(G, -.46, -.62, .46, .62), k); seg(c, G(-.26, -.3), G(.26, -.3), k); seg(c, G(-.26, -.04), G(.26, -.04), k); poly(c, bx(G, .02, .22, .28, .44), null, k) },
    function (c, G, k) { var pts = []; for (var j = 0; j < 10; j++) { var a = -Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? .28 : .7; pts.push(G(Math.cos(a) * r, .04 + Math.sin(a) * r)) } poly(c, pts, k) },
    function (c, G, k) { arc(c, G, 0, 0, .56, -.6, 4.4, k); poly(c, [G(.3, -.62), G(.66, -.36), G(.3, -.12)], null, k) },
    function (c, G, k) { poly(c, bx(G, -.62, -.32, .3, .62), k); poly(c, bx(G, -.3, -.62, .62, .32), k) },
    function (c, G, k) { [-.42, .08].forEach(function (x) { c.beginPath(); var a = G(x, -.5), b = G(x + .42, 0), d = G(x, .5); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.strokeStyle = k; c.stroke() }) },
    function (c, G, k) { [[0, -.38], [-.42, .32], [.42, .32]].forEach(function (q) { oval(c, G, q[0], q[1], .24, k) }) },
    function (c, G, k) { [[-.6, .1], [-.16, -.24], [.28, -.6]].forEach(function (q) { poly(c, bx(G, q[0], q[1], q[0] + .3, .62), null, k) }) },
    function (c, G, k) { poly(c, bx(G, -.64, -.56, .64, .56), k); seg(c, G(-.64, -.26), G(.64, -.26), k); poly(c, bx(G, -.42, .0, .1, .26), null, k) }];
  window.CinderBoard = mk(function (c, W, H, s, t) {
    var nw = W < 520, u = Math.min(W * (nw ? .27 : .285), H * (nw ? .27 : .3)), pit = .5, hs = .2, P = iso(W * .5, H / 2 + u * .22, u, 1), act = Math.round(s) - 1, one = ez((s - 7.25) / .6), any = ez((s - 6.3) / .5), pins = [], i;
    function tile(x, z, h, a, hot, g, n) {
      var T = [P(x - hs, h, z - hs), P(x + hs, h, z - hs), P(x + hs, h, z + hs), P(x - hs, h, z + hs)], gr = c.createLinearGradient(T[0][0], T[0][1], T[2][0], T[2][1]); gr.addColorStop(0, 'rgb(30,30,34)'); gr.addColorStop(1, 'rgb(11,11,13)');
      poly(c, [T[3], T[2], P(x + hs, 0, z + hs), P(x - hs, 0, z + hs)], ink(.34 * a), 'rgb(5,5,6)'); poly(c, [T[1], T[2], P(x + hs, 0, z + hs), P(x + hs, 0, z - hs)], ink(.34 * a), 'rgb(16,16,19)'); poly(c, T, hot > .5 ? red(.55 + .45 * hot) : ink(.62 * a), gr);
      if (g > .02) { c.lineWidth = hot > .5 ? 1.25 : 1; BGL[n](c, function (gx, gz) { return P(x + gx * hs * .62, h, z + gz * hs * .62) }, ink((.5 + .5 * hot) * a * g)); c.lineWidth = 1 }
    }
    // back to front, so nearer tiles cover the ones behind
    var order = []; for (i = 0; i < 16; i++)order.push(i); order.sort(function (a, b) { return (a % 4 + (a >> 2)) - (b % 4 + (b >> 2)) });
    order.forEach(function (n) {
      var col = n % 4, row = n >> 2, x = (col - 1.5) * pit, z = (row - 2) * pit, wave = ez((s * 1.5 - (col + row) / 6 * .9) / .4), hot = ez(cl(1.4 - Math.abs(s - (BG[n] + 1)) * 1.8)) * (1 - one), h = .028 + .03 * wave + .2 * hot + .035 * one, a = lerp(.42, .62, wave) + .38 * Math.max(hot, one);
      tile(x, z, h, a, hot, wave, n); if (hot > .05) pins.push([P(x, h, z), n, hot])
    });
    // the places still open: whatever else the business needs
    if (any > 0) for (i = 0; i < 4; i++) { var gx = (i - 1.5) * pit, k = ez(any * 1.6 - i * .2), q = [P(gx - hs, 0, 1 - hs), P(gx + hs, 0, 1 - hs), P(gx + hs, 0, 1 + hs), P(gx - hs, 0, 1 + hs)]; if (k <= 0) continue; c.setLineDash([3, 4]); poly(c, q, ink(.5 * k)); c.setLineDash([]); var m = P(gx, 0, 1), on = Math.abs(s - 7) < .5; seg(c, [m[0] - 5, m[1]], [m[0] + 5, m[1]], on ? RED : ink(.6 * k)); seg(c, [m[0], m[1] - 5], [m[0], m[1] + 5], on ? RED : ink(.6 * k)) }
    // one app: a single line is traced through every tile, then a frame closes round the board
    if (one > 0) { var path = [], r2, c2; for (r2 = 0; r2 < 4; r2++)for (c2 = 0; c2 < 4; c2++) { var cc = r2 % 2 ? 3 - c2 : c2; path.push(P((cc - 1.5) * pit, .064, (r2 - 2) * pit)) } var L = one * 1.5 * (path.length - 1); c.beginPath(); c.moveTo(path[0][0], path[0][1]); for (i = 1; i < path.length && i - 1 < L; i++) { var f = cl(L - (i - 1)); c.lineTo(lerp(path[i - 1][0], path[i][0], f), lerp(path[i - 1][1], path[i][1], f)) } c.strokeStyle = RED; c.lineWidth = 1.6; c.stroke(); c.lineWidth = 1;
      var e = 1.06, F = [P(-e, 0, -1 - .3), P(e, 0, -1 - .3), P(e, 0, 1 + .3), P(-e, 0, 1 + .3)], fk = cl(one * 2.2 - 1.1); for (i = 0; i < 4; i++)part(c, F[i], F[(i + 1) % 4], fk * 4 - i, ink(.55)) }
    // names on pins of stepped heights, so neighbours never collide
    pins.sort(function (a, b) { return a[0][0] - b[0][0] }); var top0 = 1e9; pins.forEach(function (q) { top0 = Math.min(top0, q[0][1]) }); pins.forEach(function (pn, j) {
      var p0 = pn[0], a = pn[2], stp = Math.min(25, pins.length > 1 ? (top0 - 42) / (pins.length - 1) : 25), y = lerp(p0[1] - 8, top0 - 16 - (pins.length - 1 - j) * stp, a); seg(c, [Math.round(p0[0]) + .5, p0[1] - 4], [Math.round(p0[0]) + .5, y], ink(.6 * a)); dot(c, [p0[0], p0[1] - 3], 2, RED);
      c.font = '600 ' + (nw ? 11.5 : 13) + 'px Inter,system-ui,sans-serif'; var w = c.measureText(BT[pn[1]]).width + 16, lx = Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, p0[0])); c.fillStyle = 'rgba(8,8,9,' + (.94 * a) + ')'; c.fillRect(Math.round(lx - w / 2), Math.round(y - 22), Math.round(w), 22); c.strokeStyle = ink(.3 * a); c.strokeRect(Math.round(lx - w / 2) + .5, Math.round(y - 22) + .5, Math.round(w), 22); text(c, lx, y - 10.5, BT[pn[1]], a, c.font, 'center') });
    if (any > 0 && Math.abs(s - 7) < .6) { var ya = ez(cl(1.4 - Math.abs(s - 7) * 1.8)), g0 = P(.25, 0, 1.22); text(c, g0[0], g0[1] + 26, 'Yours', ya, '600 ' + (nw ? 11.5 : 13) + 'px Inter,system-ui,sans-serif', 'center') }
  }, 8);

  // ---- Homepage: the audit sheet. Booked, walked, ranked, scoped.
  var ROWS = [['CALLS', '4 of 10 missed after 5 PM'], ['FORMS', 'Reply goes out next day'], ['ESTIMATES', 'Booked by phone tag'], ['QUOTES', 'No follow-up after day 2'], ['INVOICES', '2 late, no reminder'], ['REVIEWS', 'Never asked']], RANK = [1, 4, 5, 2, 6, 3], PICK = [0, 3, 5];
  window.CinderReport = mk(function (c, W, H, s, t, S) {
    var nw = W < 420, w = Math.min(W * (nw ? .96 : .9), 520), h = Math.min(H * .86, w * (nw ? 1 : 1.2)), LX = nw ? 50 : 56, FX = nw ? 128 : 150, x = Math.round((W - w) / 2) + .5, y = Math.round((H - h) / 2) + .5, st = S.step, sn = S.since, rh = (h - 120) / 6;
    c.fillStyle = '#060607'; c.fillRect(x, y, w, h); c.strokeStyle = ink(.5); c.strokeRect(x, y, w, h); c.strokeStyle = ink(.14); c.strokeRect(x + 6, y + 6, w - 12, h - 12);
    text(c, x + 24, y + 30, 'AUDIT', .9); text(c, x + w - 24, y + 30, st < 1 ? 'THU 2:00 PM · BOOKED' : 'EXAMPLE BUSINESS', .5, MONO, 'right'); seg(c, [x + 24, y + 50.5], [x + w - 24, y + 50.5], ink(.3));
    if (st < 1) { var bl = Math.floor(t * 1.6) % 2; dot(c, [x + w - 24 - c.measureText('THU 2:00 PM · BOOKED').width - 12, y + 30], 3, bl ? RED : 'rgba(224,25,58,.35)') }
    var scanY = st === 1 ? y + 56 + cl(sn / 2.6) * (rh * 6) : -1;
    ROWS.forEach(function (r, i) {
      var ry = y + 56 + rh * i, mid = ry + rh / 2, shown = st > 1 ? 1 : st === 1 ? cl((sn - i * .42) * 3) : 0, picked = st >= 3 && PICK.indexOf(i) >= 0, dim = st >= 3 && !picked ? .3 : 1;
      seg(c, [x + 24, Math.round(ry + rh) + .5], [x + w - 24, Math.round(ry + rh) + .5], ink(.12));
      if (!shown) { c.fillStyle = ink(.07); c.fillRect(x + LX, mid - 4, 60, 8); c.fillRect(x + FX, mid - 4, w * .36, 8); return }
      var bx = x + 24, a = shown * dim; c.strokeStyle = picked ? RED : ink(.5 * a); c.strokeRect(Math.round(bx) + .5, Math.round(mid - 9) + .5, 18, 18); if (picked) { c.fillStyle = RED; c.fillRect(bx + 4.5, mid - 4.5, 10, 10) } else if (st >= 2) text(c, bx + 9.5, mid + 1, String(RANK[i]), a * cl((sn - RANK[i] * .12) * 4 + (st > 2 ? 9 : 0)), MONO, 'center');
      text(c, x + LX, mid, r[0], .55 * a); text(c, x + FX, mid, r[1], a, nw ? '500 12px Inter,system-ui,sans-serif' : SANS)
    });
    if (scanY > 0 && sn < 2.7) { seg(c, [x + 8, scanY], [x + w - 8, scanY], RED, 1.5) }
    var fy = y + h - 30; seg(c, [x + 24, y + h - 56.5], [x + w - 24, y + h - 56.5], ink(.3));
    if (!(nw && st === 2)) text(c, x + 24, fy, st >= 3 ? (nw ? 'YOUR PICKS' : 'BUILD ONLY WHAT YOU PICK') : st === 2 ? 'RANKED BY WHAT IT COSTS YOU' : st === 1 ? 'WALKING THE BUSINESS' : 'FIRST CALL TO THE REVIEW', .6);
    if (st >= 2) text(c, x + w - 24, fy, 'YOURS TO KEEP', .95 * cl(sn * 2 + (st > 2 ? 1 : 0)), MONO, 'right')
  });

  // ---- Homepage: the day, as a dial.
  window.CinderDay = mk(function (c, W, H, s, t, S) {
    var cx = W / 2, cy = H / 2, R = Math.min(W, H) * (W < 420 ? .29 : .36), st = S.step; function ang(h) { return ((h - 12) / 24) * 6.2832 - 1.5708 } function pt(h, r) { var a = ang(h); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] }
    function arc(h0, h1, r, stroke, w, dash) { c.beginPath(); c.arc(cx, cy, r, ang(h0), ang(h1)); c.strokeStyle = stroke; c.lineWidth = w; c.setLineDash(dash || []); c.stroke(); c.setLineDash([]); c.lineWidth = 1 }
    for (var h = 0; h < 24; h++) { var big = h % 6 === 0; seg(c, pt(h, R + 10), pt(h, R + (big ? 22 : 15)), ink(big ? .7 : .25)) }
    [[0, 'MIDNIGHT'], [6, '6 AM'], [12, 'NOON'], [18, '6 PM']].forEach(function (q) { var p = pt(q[0], R + 40); text(c, p[0], p[1], q[1], .5, MONO, 'center') });
    ring(c, [cx, cy], R, ink(.14)); ring(c, [cx, cy], R - 26, ink(.07));
    arc(7, 17, R, ink(.95), 3);
    var jobs = [8, 10, 13, 15], extra = [11.5, 16.2], je = cl(s < 1 ? S.since * .9 : 1); jobs.forEach(function (j) { var p = pt(j, R); c.fillStyle = '#000'; c.fillRect(p[0] - 5, p[1] - 5, 10, 10); c.strokeStyle = ink(1); c.strokeRect(p[0] - 4.5, p[1] - 4.5, 9, 9) });
    extra.forEach(function (j, i) { var a = cl(je * 2 - i * .8); if (a <= 0) return; var p = pt(j, R), z = 5 * (1 + (1 - a)); c.fillStyle = RED; c.globalAlpha = a; c.fillRect(p[0] - z, p[1] - z, z * 2, z * 2); c.globalAlpha = 1 });
    var ph = cl(s - 0), handled = ez(s - .5), eve = ez(s - 1.5);
    arc(12, 12.7, R - 26, ink(lerp(.8, .22, handled)), 3, handled > .5 ? [1, 5] : []); arc(17, 21, R - 26, ink(lerp(.8, .22, handled)), 3, handled > .5 ? [1, 5] : []);
    var lp = pt(19, R - 62); text(c, lp[0], lp[1], handled > .5 ? 'HANDLED' : 'ON THE PHONE', .7, MONO, 'center');
    if (eve > 0) { arc(17, 22, R, ink(.95 * eve), 3); var ep = pt(20.5, R + 46); label(c, ep[0], ep[1], 'YOURS', eve, 'l') }
    var jp = pt(12, R + 72); label(c, jp[0], jp[1], st === 0 ? 'ON THE JOB · 2 MORE BOOKED' : 'ON THE JOB', 1);
    var hand = ang((t * .35) % 24); seg(c, [cx, cy], [cx + Math.cos(hand) * (R - 34), cy + Math.sin(hand) * (R - 34)], ink(.25)); dot(c, [cx + Math.cos(hand) * (R - 34), cy + Math.sin(hand) * (R - 34)], 2.5, RED);
    var one = ez(s - 2.5); c.font = '600 ' + Math.round(R * .5) + 'px Inter,system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ink(lerp(.16, 1, one)); c.fillText(one > .5 ? '6' : '24', cx, cy - 6); text(c, cx, cy + R * .3, one > .5 ? 'THINGS NEED YOU' : 'HOURS', lerp(.3, .7, one), MONO, 'center')
  });

  // ---- Answering: every call that lands gets a reply.
  var KIND = ['MISSED CALL', 'TEXT', 'WEB FORM', 'LEAD SITE'];
  window.CinderAnswer = mk(function (c, W, H, s, t) {
    var u = Math.min(W * .24, H * .26), P = iso(W / 2, H / 2 + u * .5, u), hub = P(0, 1.5, 0);
    plate(c, P, 0, 22, function (x, z) { return { a: .14 + .1 * Math.sin(x * 6 + z * 4 + t) } }, 1);
    for (var e = 0; e < 4; e++) {
      var T = 3.2, ph = (t + e * .8) / T, n = Math.floor(ph), f = ph - n, x = (rnd(n * 4 + e) - .5) * 1.5, z = (rnd(n * 4 + e + 9) - .5) * 1.5, p = P(x, 0, z);
      for (var q = 0; q < 2; q++) { var rr = cl(f * 2.2 - q * .25); if (rr > 0 && rr < 1) { c.beginPath(); for (var a = 0; a <= 32; a++) { var th = a / 32 * 6.2832, pp = P(x + Math.cos(th) * rr * .42, 0, z + Math.sin(th) * rr * .42); a ? c.lineTo(pp[0], pp[1]) : c.moveTo(pp[0], pp[1]) } c.strokeStyle = ink(.8 * (1 - rr)); c.stroke() } }
      var g = cl((f - .22) * 3.2), out = 1 - cl((f - .8) * 5); if (g > 0) { var m = [lerp(p[0], hub[0], g), lerp(p[1], hub[1], g)]; seg(c, p, m, ink(.5 * out)); dot(c, m, 3, RED) }
      dot(c, p, 3, f > .5 ? RED : ink(.95)); if (e === 0 && f < .8) label(c, p[0], p[1] + 24, KIND[n % 4] + (f > .5 ? ' · ANSWERED' : ''), cl(f * 6) * out)
    }
    ring(c, hub, 12, ink(.9), 1.2); dot(c, hub, 4, ink(1)); label(c, hub[0], hub[1] - 30, 'REPLY IN SECONDS', 1)
  });

  // ---- Booking: a week of slots filling.
  window.CinderBook = mk(function (c, W, H, s, t) {
    var u = Math.min(W * .2, H * .24), P = iso(W / 2, H / 2 + u * .2, u), D = ['MON', 'TUE', 'WED', 'THU', 'FRI'], order = [7, 2, 13, 16, 9, 4, 18, 11], cyc = 2.1, n = Math.floor(t / cyc) % (order.length + 2), f = (t / cyc) % 1;
    for (var d = 0; d < 5; d++)for (var r = 0; r < 4; r++) {
      var id = d * 4 + r, idx = order.indexOf(id), x0 = -1.5 + d * .62, z0 = -1 + r * .52, booked = idx >= 0 && idx < n, now = idx === n, y = booked ? .14 : 0, drop = now ? lerp(1.3, .14, ez(f * 1.6)) : y;
      function q(yy) { return [P(x0, yy, z0), P(x0 + .54, yy, z0), P(x0 + .54, yy, z0 + .44), P(x0, yy, z0 + .44)] }
      poly(c, q(0), ink(.2)); if (booked) { poly(c, q(y), ink(.9), 'rgba(242,241,238,.12)'); seg(c, P(x0 + .54, y, z0 + .44), P(x0 + .54, 0, z0 + .44), ink(.5)) }
      if (now) { poly(c, q(drop), RED, 'rgba(224,25,58,' + (.25 + .5 * cl(1 - f * 1.6)) + ')'); if (f > .62) label(c, P(x0 + .27, drop, z0 + .22)[0], P(x0 + .27, drop, z0 + .22)[1] - 26, 'ESTIMATE BOOKED', cl((f - .62) * 6)) }
    }
    D.forEach(function (l, i) { var p = P(-1.5 + i * .62 + .27, 0, 1.28); text(c, p[0], p[1] + 8, l, .5, MONO, 'center') })
  });

  // ---- Follow-up: one quote, chased until it's answered.
  window.CinderChase = mk(function (c, W, H, s, t) {
    var u = Math.min(W * .26, H * .3), P = iso(W / 2, H / 2 + u * .35, u), X = [-1.5, -.75, 0, .75, 1.5], L = ['SENT', 'DAY 2', 'DAY 5', 'DAY 10', 'ANSWERED'], T = 7, f = (t % T) / T, pos = f * 4.6;
    seg(c, P(-1.7, 0, 0), P(1.7, 0, 0), ink(.5)); seg(c, P(-1.7, 0, .12), P(1.7, 0, .12), ink(.16));
    for (var i = 0; i < 4; i++) { var g = cl(pos - i); c.beginPath(); for (var a = 0; a <= 30 * g; a++) { var m = a / 30, p = P(lerp(X[i], X[i + 1], m), Math.sin(m * Math.PI) * .7, 0); a ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]) } c.strokeStyle = ink(g >= 1 ? .35 : .9); c.stroke(); if (g > 0 && g < 1) { var hp = P(lerp(X[i], X[i + 1], g), Math.sin(g * Math.PI) * .7, 0); dot(c, hp, 3.5, RED) } }
    X.forEach(function (x, i) { var p = P(x, 0, 0), on = pos >= i; seg(c, P(x, 0, -.1), P(x, 0, .22), ink(.6)); if (i === 4 && on) { ring(c, p, 9, RED, 1.4); dot(c, p, 3.5, RED) } else { ring(c, p, 6, ink(on ? .95 : .35), 1.2); if (on) dot(c, p, 2.4, ink(1)) } var lp = P(x, 0, .5); text(c, lp[0], lp[1] + 6, L[i], on ? .85 : .35, MONO, 'center') });
    if (pos > 4) label(c, P(1.5, 0, 0)[0], P(1.5, 0, 0)[1] - 34, 'FOLLOW-UPS STOP', cl((pos - 4) * 4))
  });

  // ---- Reviews: a star traced as the requests come in.
  window.CinderStars = mk(function (c, W, H, s, t) {
    var cx = W / 2, cy = H / 2, R = Math.min(W, H) * .3, pts = [], i; for (i = 0; i <= 10; i++) { var a = -1.5708 + i * Math.PI / 5, r = i % 2 ? R * .42 : R; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]) }
    for (var gx = -14; gx <= 14; gx++)for (var gy = -14; gy <= 14; gy++) { var x = gx / 14, y = gy / 14, rr = Math.hypot(x, y); if (rr > 1.05) continue; var inside = rr < starR(Math.atan2(y, x), 1, .42); c.fillStyle = ink(inside ? .35 + .5 * Math.pow(.5 + .5 * Math.sin(t * 1.6 + gx * .9 + gy * 1.7), 2) : .08); c.fillRect(cx + x * R - .8, cy + y * R - .8, 1.7, 1.7) }
    poly(c, pts.slice(0, 10), ink(.3)); var f = (t * .11) % 1, len = 10 * f, k = Math.floor(len), m = len - k; c.beginPath(); for (i = 0; i <= k; i++) { i ? c.lineTo(pts[i][0], pts[i][1]) : c.moveTo(pts[0][0], pts[0][1]) } var hd = [lerp(pts[k][0], pts[k + 1][0], m), lerp(pts[k][1], pts[k + 1][1], m)]; c.lineTo(hd[0], hd[1]); c.strokeStyle = ink(.95); c.lineWidth = 1.6; c.stroke(); c.lineWidth = 1; dot(c, hd, 3.5, RED);
    for (i = 0; i < 5; i++) { var q = ((t * .28 + i * .2) % 1), tip = pts[i * 2], a2 = -1.5708 + i * Math.PI * 2 / 5, far = [cx + Math.cos(a2) * R * 1.7, cy + Math.sin(a2) * R * 1.7], p = [lerp(far[0], tip[0], q), lerp(far[1], tip[1], q)]; seg(c, far, tip, ink(.08)); dot(c, p, 2.2, ink(.9 * (1 - q * .3))); ring(c, tip, 5 + 8 * cl(q * 4 - 3), ink(.6 * cl(q * 4 - 3) * (1 - cl(q * 4 - 3) * .0)), 1) }
    label(c, pts[0][0], pts[0][1] - 30, 'ASKED AFTER EVERY JOB', 1)
  });

  // ---- Websites: a page, pulled apart into its layers.
  window.CinderSite = mk(function (c, W, H, s, t) {
    var u = Math.min(W * .22, H * .2), P = iso(W / 2, H / 2 + u * .7, u), e = .34 + .16 * Math.sin(t * .7);
    function rect(x0, z0, x1, z1, y, stroke, fill) { poly(c, [P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)], stroke, fill) }
    rect(-1, -1.4, 1, 1.4, 0, ink(.5), 'rgba(0,0,0,.9)'); for (var i = 0; i < 5; i++)seg(c, P(-.8, 0, -1 + i * .5), P(.8 - rnd(i) * .7, 0, -1 + i * .5), ink(.12));
    var L = [['NAV', -.9, -1.3, .9, -1.1, 1], ['HEADLINE', -.9, -.95, .9, -.2, 2], ['PHOTOS', -.9, -.05, .2, .6, 3], ['QUOTE FORM', .32, -.05, .9, 1.25, 4]];
    L.forEach(function (l, i) { var y = e * .62 * l[5], red = i === 3; seg(c, P(l[1], 0, l[2]), P(l[1], y, l[2]), ink(.14)); seg(c, P(l[3], 0, l[4]), P(l[3], y, l[4]), ink(.14)); rect(l[1], l[2], l[3], l[4], y, red ? RED : ink(.85), red ? 'rgba(224,25,58,.1)' : 'rgba(242,241,238,.05)'); if (i === 1) { seg(c, P(-.7, y, -.72), P(.5, y, -.72), ink(.9), 2); seg(c, P(-.7, y, -.5), P(.1, y, -.5), ink(.5)) } if (red) { for (var q = 0; q < 3; q++)rect(.42, .1 + q * .3, .8, .28 + q * .3, y, ink(.5)); rect(.42, 1, .8, 1.16, y, RED, RED) } });
    var fp = P(.9, e * 2.48, .6); label(c, fp[0] + 12, fp[1], 'VISITOR BECOMES A LEAD', 1, 'l'); var b = (t * .5) % 1; dot(c, P(lerp(-.6, .6, b), e * 2.48, lerp(-.6, 1.08, b)), 3, RED)
  });

  // ---- Free audit: a scan that finds the leaks.
  var LEAK = [[-.45, -.3, 'CALLS AFTER HOURS'], [.4, .1, 'QUOTES NOT CHASED'], [-.1, .6, 'REVIEWS NOT ASKED']];
  window.CinderScan = mk(function (c, W, H, s, t) {
    var u = Math.min(W * .26, H * .28), P = iso(W / 2, H / 2 + u * .35, u), T = 6, f = (t % T) / T, sx = -1.1 + cl(f * 1.5) * 2.2;
    plate(c, P, 0, 26, function (x, z) { var d = Math.abs(x - sx), behind = x < sx; for (var i = 0; i < 3; i++)if (behind && Math.hypot(x - LEAK[i][0], z - LEAK[i][1]) < .16) return { a: 1, red: 1 }; return { a: d < .07 ? 1 : behind ? .34 : .12 } }, 1);
    if (f < .67) { seg(c, P(sx, 0, -1), P(sx, 0, 1), RED, 1.5); seg(c, P(sx, 0, -1), P(sx, .7, -1), ink(.4)); seg(c, P(sx, 0, 1), P(sx, .7, 1), ink(.4)); seg(c, P(sx, .7, -1), P(sx, .7, 1), ink(.4)) }
    LEAK.forEach(function (l) { if (sx > l[0]) pin(c, P(l[0], 0, l[1]), l[2], cl((sx - l[0]) * 5), 1) })
  });

  // ---- Integrations: everything plugs into one place.
  var HUB = ['GOOGLE CALENDAR', 'JOBBER', 'QUICKBOOKS', 'WEBSITE FORMS', 'ANGI', 'THUMBTACK', 'ZAPIER', 'YOUR PAY LINK'];
  window.CinderHub = mk(function (c, W, H, s, t) {
    var cx = W / 2, cy = H / 2, R = Math.min(W * .3, H * .36), n = HUB.length; c.setLineDash([1, 6]); ring(c, [cx, cy], R * 1.22, ink(.3)); c.setLineDash([]); ring(c, [cx, cy], R * .5, ink(.1));
    HUB.forEach(function (l, i) { var a = -1.5708 + i / n * 6.2832 + .39, p = [cx + Math.cos(a) * R, cy + Math.sin(a) * R * .82], inb = i > 2 && i < 7, q = (t * .4 + i * .37) % 1, g = inb ? q : 1 - q; seg(c, p, [cx, cy], ink(.22)); dot(c, [lerp(p[0], cx, g), lerp(p[1], cy, g)], 2.6, i % 3 === 0 ? RED : ink(.95)); c.fillStyle = '#000'; c.fillRect(p[0] - 5, p[1] - 5, 10, 10); c.strokeStyle = ink(.9); c.strokeRect(Math.round(p[0] - 5) + .5, Math.round(p[1] - 5) + .5, 9, 9); var right = Math.cos(a) > .1, left = Math.cos(a) < -.1; text(c, p[0] + (right ? 14 : left ? -14 : 0), p[1] + (right || left ? 0 : Math.sin(a) > 0 ? 20 : -20), l, .75, MONO, right ? 'left' : left ? 'right' : 'center') });
    dot(c, [cx, cy], 26, '#000'); ring(c, [cx, cy], 26, ink(.95), 1.3); ring(c, [cx, cy], 26 + 10 * ((t * .5) % 1), ink(.5 * (1 - (t * .5) % 1))); text(c, cx, cy + 1, 'CINDER', 1, MONO, 'center')
  });

  // ---- What's new: the shipping log as a graph.
  var LOG = [['NOV 16', 6], ['NOV 17', 3], ['NOV 19', 3], ['NOV 20', 1], ['NOV 24', 5]];
  window.CinderLog = mk(function (c, W, H, s, t) {
    var cw = Math.min(88, (W - 40) / 5), x0 = W / 2 - cw * 2.5, base = Math.round(H * .74) + .5, sq = Math.min(26, cw * .34), T = 8, f = cl(((t % T) / T) * 1.7), tot = 18, done = f * tot, cnt = 0;
    seg(c, [x0 - 10, base], [x0 + cw * 5 + 10, base], ink(.5)); LOG.forEach(function (l, i) { var cx = x0 + cw * i + cw / 2; text(c, cx, base + 20, l[0], .55, MONO, 'center'); for (var k = 0; k < l[1]; k++) { var a = cl(done - cnt); cnt++; var y = base - 10 - (k + 1) * (sq + 6), last = i === 4 && k === l[1] - 1; c.strokeStyle = ink(.18); c.strokeRect(Math.round(cx - sq / 2) + .5, Math.round(y) + .5, sq, sq); if (a > 0) { c.fillStyle = last ? RED : ink(.9 * a); var z = sq * (.5 + .5 * a); c.fillRect(cx - z / 2, y + (sq - z) / 2, z, z) } } });
    text(c, x0 + cw * 5 + 10, base - 10 - 6 * (sq + 6) - 16, Math.min(tot, Math.floor(done)) + ' UPDATES SHIPPED', .8, MONO, 'right')
  });

  // ---- Trades: a fence line going up.
  window.CinderFence = mk(function (c, W, H, s, t) {
    var u = Math.min(W * .2, H * .34), P = iso(W / 2, H / 2 + u * .4, u), T = 9, f = (t % T) / T, g = cl(f * 1.35), fade = 1 - cl((f - .9) * 10), x0 = -2, x1 = 2, end = lerp(x0, x1, g), ht = .8;
    seg(c, P(x0 - .2, 0, 0), P(x1 + .2, 0, 0), ink(.2)); seg(c, P(x0, 0, .5), P(x1, 0, .5), ink(.3)); for (var m = 0; m <= 8; m++)seg(c, P(x0 + m * .5, 0, .44), P(x0 + m * .5, 0, .56), ink(.4));
    for (var x = x0; x <= end + .001; x += .1) { var post = Math.abs((x - x0) / .5 - Math.round((x - x0) / .5)) < .01, rise = cl((end - x) * 4); if (post) { seg(c, P(x, 0, 0), P(x, (ht + .12) * rise, 0), ink(.95 * fade), 2); if (rise >= 1) poly(c, [P(x - .03, ht + .12, 0), P(x + .03, ht + .12, 0), P(x, ht + .2, 0)], ink(.9 * fade)) } else seg(c, P(x, .06, 0), P(x, ht * rise, 0), ink(.5 * fade)) }
    [.22, .62].forEach(function (y) { seg(c, P(x0, y, 0), P(end, y, 0), ink(.75 * fade), 1.4) }); if (g < 1) dot(c, P(end, ht, 0), 3.5, RED);
    var mp = P(end, 0, .5); seg(c, P(x0, 0, .5), mp, RED, 1.4); label(c, mp[0], mp[1] + 24, Math.round(g * 140) + ' FT · QUOTE BUILDS ITSELF', fade)
  });

  // ---- About: one founder, a few clients at a time.
  window.CinderOne = mk(function (c, W, H, s, t) {
    var cx = W / 2, cy = H / 2, R = Math.min(W * .34, H * .4), O = [[.42, .5, 0], [.62, .33, 2.1], [.82, .24, 4.2], [1, .18, 1.1]];
    O.forEach(function (o, i) { c.beginPath(); c.ellipse(cx, cy, R * o[0], R * o[0] * .42, 0, 0, 6.2832); c.strokeStyle = ink(.2); c.stroke(); var a = t * o[1] + o[2]; for (var k = 12; k >= 0; k--) { var b = a - k * .035, p = [cx + Math.cos(b) * R * o[0], cy + Math.sin(b) * R * o[0] * .42]; dot(c, p, k ? 1.2 : 4, k ? ink(.5 * (1 - k / 12)) : ink(1)) } var hp = [cx + Math.cos(a) * R * o[0], cy + Math.sin(a) * R * o[0] * .42]; seg(c, hp, [cx, cy], ink(.07)); if (i === 3) label(c, hp[0], hp[1] - 22, 'A CLIENT', .8) });
    dot(c, [cx, cy], 9, '#000'); ring(c, [cx, cy], 9, RED, 1.4); dot(c, [cx, cy], 3.5, RED); label(c, cx, cy + 34, 'ONE FOUNDER', 1)
  });

  // mount [data-plate] hosts; a host inside .hx gets its step from the .hx-step nearest the middle of the screen
  function boot() {
    [].slice.call(document.querySelectorAll('[data-plate]')).forEach(function (host) {
      var api = window[host.dataset.plate]; if (!api || host.dataset.on) return; host.dataset.on = 1; api.mount(host);
      var sec = host.closest('.hx'); if (!sec) return; var steps = [].slice.call(sec.querySelectorAll('.hx-step')), last = -1, tk = false;
      function upd() { tk = false; var vh = innerHeight, best = 0, bd = 1e9; steps.forEach(function (el, i) { var b = el.getBoundingClientRect(), d = Math.abs((innerWidth <= 900 ? b.bottom - 90 : b.top + b.height / 2) - vh * (innerWidth <= 900 ? .78 : .5)); if (d < bd) { bd = d; best = i } }); if (best !== last) { last = best; if (api.setStep) api.setStep(best); steps.forEach(function (el, i) { el.classList.toggle('on', i === best) }) }
        if (!api.setStep && api.setProgress) { var a = steps[0].getBoundingClientRect(), z = steps[steps.length - 1].getBoundingClientRect(), c0 = a.top + a.height / 2, c1 = z.top + z.height / 2; api.setProgress(Math.max(0, Math.min(1, (vh * (innerWidth <= 900 ? .7 : .5) - c0) / ((c1 - c0) || 1)))) } }
      addEventListener('scroll', function () { if (!tk) { tk = true; requestAnimationFrame(upd) } }, { passive: true }); addEventListener('resize', upd); upd()
    })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  addEventListener('cinder-plate', boot); addEventListener('load', boot);
  dispatchEvent(new Event('cinder-visual'));
})();
