// Drawings for /story. Line work only, built by the scroll: nothing here is a still picture.
// channels: six sources feed one person; past two at a time, the rest divert into a tray of missed leads.
// day: a working day plays out under a playhead; leads that land on a busy hour are lost.
// method: twelve steps are scanned, the weak ones are replaced, then work runs through all of them.
(function () {
  var INK = '242,241,238', RED = '#e0193a', SANS = 'Inter,system-ui,sans-serif', MONO = '"Geist Mono",ui-monospace,monospace';
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v } function ez(x) { x = cl(x); return x * x * (3 - 2 * x) } function lerp(a, b, t) { return a + (b - a) * t }
  function ink(a) { return 'rgba(' + INK + ',' + cl(a).toFixed(3) + ')' } function red(a) { return 'rgba(224,25,58,' + cl(a).toFixed(3) + ')' }
  function px(v) { return Math.round(v) + .5 }
  function line(c, x0, y0, x1, y1, s, w) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = s; c.lineWidth = w || 1; c.stroke() }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath() }
  function card(c, x, y, w, h, r, stroke, fill) { rr(c, px(x), px(y), Math.round(w), Math.round(h), r); c.fillStyle = fill || '#0a0a0c'; c.fill(); c.strokeStyle = stroke; c.lineWidth = 1; c.stroke() }
  function txt(c, s, x, y, col, al, f) { c.font = f; c.fillStyle = col; c.textAlign = al || 'left'; c.textBaseline = 'middle'; c.fillText(s, x, y) }
  function bz(P, t) { var u = 1 - t; return [u * u * u * P[0] + 3 * u * u * t * P[2] + 3 * u * t * t * P[4] + t * t * t * P[6], u * u * u * P[1] + 3 * u * u * t * P[3] + 3 * u * t * t * P[5] + t * t * t * P[7]] }
  function curve(c, P, a, b, stroke, w) { if (b <= a) return; c.beginPath(); for (var i = 0; i <= 36; i++) { var q = bz(P, lerp(a, b, i / 36)); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]) } c.strokeStyle = stroke; c.lineWidth = w || 1; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt' }
  // a short bright run with a fading tail, travelling along a curve
  function streak(c, P, m, len, rgb) { for (var i = 0; i < 9; i++) { var a = m - len * (1 - i / 9), b = m - len * (1 - (i + 1) / 9); if (b <= 0 || a >= 1) continue; curve(c, P, cl(a), cl(b), 'rgba(' + rgb + ',' + ((i + 1) / 9 * .95).toFixed(3) + ')', 1.6) } var h = bz(P, cl(m)); c.fillStyle = 'rgb(' + rgb + ')'; c.fillRect(h[0] - 2, h[1] - 2, 4, 4) }
  var D = {};
  D.channels = function (c, W, H, p, t) {
    var S = ['Calls', 'Texts', 'Web forms', 'Facebook', 'Google', 'Lead sites'], nw = W < 620, cw = nw ? 92 : 138, ch = nw ? 32 : 40, cx = nw ? W * .17 : W * .15, kw = nw ? 112 : 196, kh = nw ? 150 : 214, kx = W * (nw ? .78 : .79), ky = H * .36, ty = H * .82, th = nw ? 50 : 62, over = ez((p - .48) / .3), fs = nw ? 11.5 : 13.5;
    var L = kx - kw / 2, missed = Math.round(over * 9 + (over > .99 ? (t * .6) % 1 : 0));
    S.forEach(function (s, i) {
      var y = H * (.115 + i * .154), k = ez(p * 2.6 - i * .22), lost = i > 1, x0 = cx + cw / 2, A = [x0, y, lerp(x0, L, .55), y, lerp(x0, L, .45), ky - kh / 2 + 46 + i * (nw ? 15 : 22), L, ky - kh / 2 + 46 + i * (nw ? 15 : 22)], B = [x0, y, lerp(x0, L, .6), y, lerp(x0, L, .52), ty, L, ty];
      if (k > 0) { var d = lost ? over : 0; if (d < 1) curve(c, A, 0, k, ink(.34 * (1 - d))); if (d > 0) { curve(c, B, 0, .5, ink(.34 * d)); curve(c, B, .5, 1, red(.75 * d)) }
        if (k >= 1) for (var n = 0; n < 2; n++) { var m = ((t * .2 + n / 2 + i * .137) % 1) * 1.25; streak(c, d > .5 ? B : A, m, .16, d > .5 && m > .5 ? '224,25,58' : INK) } }
      c.globalAlpha = .3 + .7 * k; card(c, cx - cw / 2, y - ch / 2, cw, ch, 9, ink(.2 + .2 * k)); c.fillStyle = lost && over > .5 ? RED : ink(k); c.fillRect(Math.round(cx - cw / 2 + 12), Math.round(y - 2.5), 5, 5); txt(c, s, cx - cw / 2 + 26, y + .5, ink(.92), 'left', '500 ' + fs + 'px ' + SANS); c.globalAlpha = 1
    });
    // the one person
    card(c, L, ky - kh / 2, kw, kh, 14, ink(.5), '#0b0b0d'); txt(c, 'You', L + 18, ky - kh / 2 + 24, ink(1), 'left', '600 ' + (nw ? 14 : 17) + 'px ' + SANS);
    var busy = over > .5; c.fillStyle = busy ? RED : ink(.9); c.fillRect(Math.round(kx + kw / 2 - 24), Math.round(ky - kh / 2 + 21), 6, 6);
    for (var i = 0; i < 6; i++) { var yy = ky - kh / 2 + 46 + i * (nw ? 15 : 22), on = i < 2 && p * 2.6 - i * .22 >= 1; line(c, L, px(yy), L + 10, px(yy), ink(.4)); rr(c, px(L + 18), px(yy - (nw ? 4 : 6)), Math.round(kw - 36), nw ? 8 : 12, 3); c.fillStyle = on ? ink(.92) : 'rgba(255,255,255,.03)'; c.fill(); c.strokeStyle = ink(on ? 0 : .14); c.stroke() }
    txt(c, busy ? 'On a job' : 'Answering', L + 18, ky + kh / 2 - 20, ink(.6), 'left', '500 ' + (nw ? 10.5 : 12) + 'px ' + MONO); if (!nw) txt(c, '2 at a time', kx + kw / 2 - 16, ky + kh / 2 - 20, ink(.36), 'right', '500 ' + (nw ? 10.5 : 12) + 'px ' + MONO);
    // where the rest end up
    if (over > 0) { c.globalAlpha = over; card(c, L, ty - th / 2, kw, th, 12, red(.7), 'rgba(224,25,58,.06)'); txt(c, 'Missed', L + 18, ty - (nw ? 10 : 12), RED, 'left', '600 ' + (nw ? 12 : 14) + 'px ' + SANS);
      for (var j = 0; j < 12; j++) { c.fillStyle = j < missed ? RED : 'rgba(224,25,58,.18)'; c.fillRect(Math.round(L + 18 + j * (nw ? 7 : 11)), Math.round(ty + (nw ? 6 : 8)), nw ? 4 : 6, nw ? 4 : 6) } c.globalAlpha = 1 }
  };
  var LEADS = [6.6, 7.4, 8.3, 9.1, 9.7, 10.4, 11.2, 11.8, 12.2, 12.9, 13.6, 14.5, 15.2, 16.1, 17.2, 17.9, 18.7, 19.2, 19.8, 20.4, 21.0, 21.6], BLOCKS = [[6, 8, 0, 'Free'], [8, 12, 1, 'On a job'], [12, 12.6, 0, ''], [12.6, 17, 1, 'On a job'], [17, 18.4, 0, 'Free'], [18.4, 22, 1, 'After hours']];
  D.day = function (c, W, H, p, t) {
    var nw = W < 620, x0 = W * (nw ? .05 : .06), x1 = W * (nw ? .95 : .94), ay = H * .2, ah = nw ? 26 : 34, by = H * .82, X = function (h) { return lerp(x0, x1, (h - 6) / 16) }, now = lerp(6, 22, ez(p * 1.12)), got = 0, miss = 0, fs = nw ? 10.5 : 12;
    function busy(h) { for (var i = 0; i < BLOCKS.length; i++)if (h >= BLOCKS[i][0] && h < BLOCKS[i][1]) return BLOCKS[i][2]; return 1 }
    txt(c, 'You', x0, ay - 20, ink(.5), 'left', '500 ' + fs + 'px ' + MONO); txt(c, 'Leads', x0, ay + ah + 26, ink(.5), 'left', '500 ' + fs + 'px ' + MONO);
    BLOCKS.forEach(function (b) { var xa = X(b[0]) + 2, xb = X(Math.min(b[1], Math.max(b[0], now))) - 2, full = X(b[1]) - 2; rr(c, px(xa), px(ay), Math.round(full - xa), ah, 6); c.strokeStyle = ink(.1); c.lineWidth = 1; c.stroke(); if (xb - xa < 4) return;
      c.save(); rr(c, px(xa), px(ay), Math.round(xb - xa), ah, 6); c.clip(); c.fillStyle = b[2] ? '#0d0d0f' : ink(.92); c.fillRect(xa, ay, xb - xa, ah + 1); if (b[2]) { c.strokeStyle = ink(.16); for (var q = xa - ah; q < xb; q += 7) { c.beginPath(); c.moveTo(q, ay + ah + 1); c.lineTo(q + ah, ay); c.stroke() } } c.restore(); rr(c, px(xa), px(ay), Math.round(xb - xa), ah, 6); c.strokeStyle = ink(b[2] ? .3 : 0); c.stroke();
      if (b[3] && xb - xa > (nw ? 58 : 84)) txt(c, b[3], xa + 12, ay + ah / 2 + .5, b[2] ? ink(.7) : '#0a0a0c', 'left', '500 ' + (nw ? 10.5 : 12.5) + 'px ' + SANS) });
    line(c, x0, px(by), x1, px(by), ink(.45));
    for (var h = 6; h <= 22; h += .5) { var x = px(X(h)), maj = h % 2 === 0; line(c, x, by, x, by + (maj ? 8 : h % 1 ? 3 : 5), ink(maj ? .5 : .22)); if (maj && (!nw || h % 4 === 2)) txt(c, (h > 12 ? h - 12 : h) + (h >= 12 ? ' PM' : ' AM'), h === 22 ? x1 : h === 6 ? x0 : x, by + 22, ink(.5), h === 22 ? 'right' : h === 6 ? 'left' : 'center', '500 ' + fs + 'px ' + MONO) }
    LEADS.forEach(function (h, i) { if (h > now) return; var k = ez((now - h) * 2.4), b = busy(h), x = px(X(h)), top = by - (H * .14 + (i * 37 % 5) * H * .052) * k; line(c, x, by, x, top, b ? red(.85) : ink(.85), 1.4); c.fillStyle = b ? RED : ink(1); c.fillRect(x - 4.5, Math.round(top) - 4, 8, 8); if (b) { c.strokeStyle = red(.35 * (1 - k * .6)); c.lineWidth = 1; c.strokeRect(x - 8.5, Math.round(top) - 8 + .5, 16, 16) } b ? miss++ : got++ });
    // the playhead, with the time it is showing
    if (p < .96) { var nx = px(X(now)), hh = Math.floor(now), mm = Math.floor((now - hh) * 60), lab = ((hh + 11) % 12 + 1) + ':' + (mm < 10 ? '0' : '') + mm + (hh >= 12 ? ' PM' : ' AM'); line(c, nx, ay - 8, nx, by, ink(.55)); c.font = '500 ' + fs + 'px ' + MONO; var lw = c.measureText(lab).width + 16, lx = Math.max(x0, Math.min(x1 - lw, nx - lw / 2)); card(c, lx, ay - 34, lw, 22, 6, ink(.5), '#000'); txt(c, lab, lx + lw / 2, ay - 22.5, ink(1), 'center', '500 ' + fs + 'px ' + MONO) }
    var rx = x1; txt(c, String(miss), rx, ay + ah + 26, RED, 'right', '600 ' + (nw ? 13 : 15) + 'px ' + SANS); var w1 = c.measureText(String(miss)).width; txt(c, 'Missed', rx - w1 - 8, ay + ah + 26, ink(.6), 'right', '500 ' + fs + 'px ' + MONO); var w2 = c.measureText('Missed').width; c.fillStyle = RED; c.fillRect(rx - w1 - w2 - 24, ay + ah + 22, 7, 7);
    var r2 = rx - w1 - w2 - 48; txt(c, String(got), r2, ay + ah + 26, ink(1), 'right', '600 ' + (nw ? 13 : 15) + 'px ' + SANS); var w3 = c.measureText(String(got)).width; txt(c, 'Picked up', r2 - w3 - 8, ay + ah + 26, ink(.6), 'right', '500 ' + fs + 'px ' + MONO); var w4 = c.measureText('Picked up').width; c.fillStyle = ink(1); c.fillRect(r2 - w3 - w4 - 24, ay + ah + 22, 7, 7)
  };
  var STEPS = ['Call', 'Text', 'Form', 'Vet', 'Book', 'Remind', 'Estimate', 'Quote', 'Chase', 'Invoice', 'Review', 'Repeat'], WEAK = [1, 5, 8, 10], COST = [.55, .8, 1, .45];
  D.method = function (c, W, H, p, t, host) {
    var nw = W < 620, x0 = W * (nw ? .07 : .07), x1 = W * (nw ? .93 : .93), y = H * .6, n = STEPS.length, gap = (x1 - x0) / (n - 1), R = Math.min(24, gap * .32), X = function (i) { return x0 + gap * i }, a = cl(p / .34), b = cl((p - .34) / .33), r = cl((p - .67) / .33), step = p < .34 ? 0 : p < .67 ? 1 : 2, scan = lerp(x0 - R - 40, x1 + R + 40, ez(a * 1.06)), fs = nw ? 10 : 12;
    var sec = host.closest('.st-method'); if (sec && sec.dataset.step !== String(step)) sec.dataset.step = step;
    // three stages, the current one filling as it plays
    ['Audit', 'Build', 'Run'].forEach(function (s, i) { var w = nw ? 64 : 96, sx = x0 - R + i * (w + 10), k = i < step ? 1 : i === step ? [a, b, r][i] : 0; line(c, sx, px(H * .1 + 14), sx + w, px(H * .1 + 14), ink(.16), 2); if (k > 0) line(c, sx, px(H * .1 + 14), sx + w * k, px(H * .1 + 14), i === step ? RED : ink(.8), 2); txt(c, '0' + (i + 1) + '  ' + s, sx, H * .1, ink(i === step ? 1 : .4), 'left', '500 ' + fs + 'px ' + MONO) });
    txt(c, 'Example business', x1 + R, H * .1, ink(.36), 'right', '500 ' + fs + 'px ' + MONO);
    line(c, x0 - R, px(y), x1 + R, px(y), ink(.2 + .25 * r));
    if (a > 0 && a < 1) { var g = c.createLinearGradient(scan - 90, 0, scan, 0); g.addColorStop(0, 'rgba(' + INK + ',0)'); g.addColorStop(1, 'rgba(' + INK + ',.09)'); c.fillStyle = g; c.fillRect(scan - 90, H * .2, 90, H * .62); line(c, px(scan), H * .2, px(scan), H * .82, ink(.8)) }
    var run = []; if (r > 0) for (var q = 0; q < 6; q++) { var m = (t * .1 + q / 6) % 1; if (m < r * 1.15) run.push([lerp(x0 - R, x1 + R, m), q % 3 === 0]) }
    run.forEach(function (u) { var g2 = c.createLinearGradient(u[0] - 46, 0, u[0], 0), rgb = u[1] ? '224,25,58' : INK; g2.addColorStop(0, 'rgba(' + rgb + ',0)'); g2.addColorStop(1, 'rgba(' + rgb + ',.95)'); c.fillStyle = g2; c.fillRect(u[0] - 46, y - 1, 46, 2); c.fillStyle = 'rgb(' + rgb + ')'; c.fillRect(u[0] - 2.5, y - 2.5, 5, 5) })
    STEPS.forEach(function (s, i) {
      var x = X(i), seen = scan > x, w = WEAK.indexOf(i), weak = w >= 0, fix = weak ? ez(b * 1.75 - w * .24) : 0, flagged = weak && seen && fix < 1, near = 0; run.forEach(function (u) { near = Math.max(near, 1 - Math.abs(u[0] - x) / (gap * .7)) });
      if (flagged) { var hgt = H * .25 * COST[w] * (1 - fix) * ez((scan - x) / 60), top = y - R - 12 - hgt; c.fillStyle = red(.14); c.fillRect(Math.round(x - R), top, 2 * Math.round(R), hgt); line(c, x - R, px(top), x + R, px(top), RED, 1.5); for (var k = 1; k < 4; k++)line(c, x - R, px(y - R - 12 - H * .0625 * k), x - R + 5, px(y - R - 12 - H * .0625 * k), red(.5)) }
      var ny = y; if (weak && fix > 0 && fix < 1) { ny = y - (1 - fix) * H * .36; c.setLineDash([2, 4]); line(c, px(x), ny + R, px(x), y - R, ink(.3)); c.setLineDash([]); card(c, x - R, y - R, 2 * R, 2 * R, 7, red(.5 * (1 - fix)), '#000') }
      var solid = weak && fix > 0, fill = solid ? 'rgba(' + INK + ',' + (.1 + .86 * ez(fix * 2.2 - 1.1)).toFixed(3) + ')' : '#0a0a0c';
      var old = flagged && !solid; card(c, x - R, ny - R, 2 * R, 2 * R, 7, old ? RED : ink(solid ? .95 : seen ? .5 + .4 * near : .16), old ? 'rgba(224,25,58,.1)' : fill);
      txt(c, (i < 9 ? '0' : '') + (i + 1), x, ny + .5, solid && fix > .7 ? '#0a0a0c' : old ? RED : ink(seen ? .85 : .3), 'center', '500 ' + (nw ? 9 : 11) + 'px ' + MONO);
      if (!nw || flagged || (solid && fix < 1) || i === 0) txt(c, s, x, y + R + 20, flagged ? RED : ink(seen ? .72 : .3), 'center', '500 ' + (nw ? 10.5 : 12.5) + 'px ' + SANS)
    });
  };
  [].forEach.call(document.querySelectorAll('[data-story]'), function (host) {
    var draw = D[host.dataset.story]; if (!draw) return; var cv = document.createElement('canvas'), c = cv.getContext('2d'), W = 1, H = 1, vis = false, raf = 0, p = 0, s = 0, t0 = performance.now(), last = t0, pin = host.closest('.st-method'); cv.setAttribute('aria-hidden', 'true'); host.appendChild(cv);
    function size() { var r = host.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); W = Math.max(1, r.width); H = Math.max(1, r.height); cv.width = W * d; cv.height = H * d; c.setTransform(d, 0, 0, d, 0, 0); kick() }
    function prog() { var vh = innerHeight; if (pin) { var b = pin.getBoundingClientRect(); p = cl(-b.top / Math.max(1, b.height - vh)) } else { var q = host.getBoundingClientRect(); p = cl((vh * .95 - q.top) / (vh * .7)) } kick() }
    function frame(now) { raf = 0; var dt = Math.min(.05, (now - last) / 1000); last = now; s += (p - s) * Math.min(1, dt * 9); c.clearRect(0, 0, W, H); draw(c, W, H, s, (now - t0) / 1000, host); if (vis) raf = requestAnimationFrame(frame) }
    function kick() { if (!raf) raf = requestAnimationFrame(frame) }
    new ResizeObserver(size).observe(host); new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) { last = performance.now(); kick() } }).observe(host);
    addEventListener('scroll', prog, { passive: true }); addEventListener('resize', prog); if (document.fonts && document.fonts.ready) document.fonts.ready.then(kick); size(); prog()
  })
})();
