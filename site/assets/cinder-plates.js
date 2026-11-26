// Line-and-dot visuals, one per page. Canvas 2D, crisp 1px lines, white on black, crimson only where something happens.
// Each is a global with mount(host) and setStep(i), so scenes.js can drive it; [data-plate] hosts mount on their own.
(function () {
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches, RED = '#e0193a', INK = '242,241,238';
  var MONO = '500 10.5px "Geist Mono",ui-monospace,monospace', SANS = '500 13px Inter,system-ui,sans-serif';
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v } function lerp(a, b, t) { return a + (b - a) * t } function ez(x) { x = cl(x); return x * x * (3 - 2 * x) }
  function ink(a) { return 'rgba(' + INK + ',' + cl(a).toFixed(3) + ')' }
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
  function mk(draw) {
    var S = { step: 0, s: 0, t: 0, ts: 0 };
    return {
      setStep: function (i) { if (i !== S.step) { S.step = i; S.ts = S.t } if (S.kick) S.kick() }, setProgress: function () { },
      mount: function (host) {
        var cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; cv.setAttribute('aria-hidden', 'true');
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; host.appendChild(cv);
        var c = cv.getContext('2d'), W = 1, H = 1, vis = false, raf = 0, t0 = performance.now(), last = t0;
        function size() { var r = host.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); W = Math.max(1, r.width); H = Math.max(1, r.height); cv.width = W * d; cv.height = H * d; c.setTransform(d, 0, 0, d, 0, 0); kick() }
        function frame(now) {
          raf = 0; var dt = Math.min(.05, (now - last) / 1000); last = now; S.s += (S.step - S.s) * (RM ? 1 : Math.min(1, dt * 4.5)); S.t = RM ? 40 : Math.max(0, (now - t0) / 1000); S.since = RM ? 99 : S.t - S.ts;
          c.clearRect(0, 0, W, H); c.lineWidth = 1; c.lineJoin = 'round'; draw(c, W, H, S.s, S.t, S); if (vis && !RM) raf = requestAnimationFrame(frame)
        }
        function kick() { if (!raf) raf = requestAnimationFrame(frame) }
        new ResizeObserver(size).observe(host); new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) { last = performance.now(); kick() } }).observe(host); size(); S.kick = kick
      }
    }
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

  // ---- Homepage: what we build. A plate tilts, five plates stack, one frame closes around them.
  var LAY = [['CALLS', 'TEXTS', 'FORMS'], ['CALENDAR', 'REMINDERS'], ['QUOTES', 'INVOICES'], ['REVIEW REQUESTS'], ['PAGES', 'FORMS']], PINP = [[-.5, -.42], [.52, -.05], [-.05, .55]];
  function pat(i, x, z, t) {
    var r = Math.hypot(x, z);
    if (i === 0) { var w = Math.sin(r * 9 - t * 2.2); return { a: .2 + .8 * Math.pow(.5 + .5 * w, 3), dy: .05 * w * (1 - cl(r)) } }
    if (i === 1) { var fx = (x + 1) * 2.5, fz = (z + 1) * 2.5, gx = Math.floor(fx), gz = Math.floor(fz), on = rnd(gx * 7 + gz * 13 + Math.floor(t * .35 + rnd(gx + gz * 5) * 3)) > .55, e = Math.abs(fx % 1 - .5) > .4 || Math.abs(fz % 1 - .5) > .4; return { a: e ? .1 : on ? .95 : .26 } }
    if (i === 2) { var q = ((x + z + 2) / 4 * 3 - t * .45) % 1; if (q < 0) q += 1; return { a: .16 + .84 * Math.pow(1 - q, 5) } }
    if (i === 3) { var inside = r < starR(Math.atan2(z, x), .92, .4); return { a: inside ? .55 + .45 * Math.sin(t * 2 + x * 9 + z * 7) : .12 } }
    var b = (z < -.62) || (z > -.42 && z < .12 && Math.abs(x) < .8) || (z > .32 && z < .82 && Math.abs(((x + 1) * 1.5) % 1 - .5) < .38); return { a: b ? .85 : .1 }
  }
  window.CinderStack = mk(function (c, W, H, s, t) {
    var k = ez(s), u = Math.min(W * .3, H * .2) * lerp(1, .74, cl((s - 1) / 3)) * lerp(1, .88, ez(s - 5)), gap = .64, m = 1 + cl((s - 1) / 4) * 4, act = Math.round(s) - 1, P = iso(W / 2, H / 2 + u * .12, u, k);
    var ys = [], al = []; for (var i = 0; i < 5; i++) { ys[i] = ((m - 1) / 2 - i) * gap; al[i] = i === 0 ? 1 : ez(s - i) }
    var box = ez(s - 5); if (box > 0) { var top = ys[0] + .34, bot = ys[4] - .34, h = 1.16; [[-h, -h], [h, -h], [-h, h]].forEach(function (q) { seg(c, P(q[0], top, q[1]), P(q[0], bot, q[1]), ink(.22 * box)) }) ; poly(c, quad(P, bot, h), ink(.22 * box)) }
    for (i = 4; i >= 0; i--) { if (al[i] < .02) continue; var br = (s < .5 || i === act || box > .5) ? 1 : .34; (function (i) { plate(c, P, ys[i] - (1 - al[i]) * .5, 24, function (x, z) { return pat(i, x, z, t) }, al[i] * br, k) })(i) }
    if (box > 0) { top = ys[0] + .34; bot = ys[4] - .34; h = 1.16; poly(c, quad(P, top, h), ink(.3 * box)); seg(c, P(h, top, h), P(h, bot, h), ink(.3 * box)); pin(c, P(h, top, -h), 'ONE APP', box) }
    if (act >= 0 && act < 5 && box < .5) { var pa = cl(1 - Math.abs(s - Math.round(s)) * 3) * (s < .6 ? 0 : 1); LAY[act].forEach(function (l, j) { pin(c, P(PINP[j][0], ys[act], PINP[j][1]), l, pa) }) }
  });

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
      function upd() { tk = false; var vh = innerHeight, best = 0, bd = 1e9; steps.forEach(function (el, i) { var b = el.getBoundingClientRect(), d = Math.abs((innerWidth <= 900 ? b.bottom - 90 : b.top + b.height / 2) - vh * (innerWidth <= 900 ? .78 : .5)); if (d < bd) { bd = d; best = i } }); if (best !== last) { last = best; api.setStep(best); steps.forEach(function (el, i) { el.classList.toggle('on', i === best) }) } }
      addEventListener('scroll', function () { if (!tk) { tk = true; requestAnimationFrame(upd) } }, { passive: true }); addEventListener('resize', upd); upd()
    })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  dispatchEvent(new Event('cinder-visual'));
})();
