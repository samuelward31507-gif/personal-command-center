// Drawings for /story. Each one is scrubbed by the scroll: nothing here is a still picture.
// channels: six sources into one person. day: when leads arrive against when anyone can answer.
// method: twelve steps are scanned, four are replaced, then work runs through all of them.
(function () {
  var INK = '242,241,238', RED = '#e0193a', MONO = '500 12px "Geist Mono",ui-monospace,monospace';
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v } function ez(x) { x = cl(x); return x * x * (3 - 2 * x) } function lerp(a, b, t) { return a + (b - a) * t }
  function ink(a) { return 'rgba(' + INK + ',' + cl(a).toFixed(3) + ')' } function red(a) { return 'rgba(224,25,58,' + cl(a).toFixed(3) + ')' }
  function seg(c, x0, y0, x1, y1, s, w) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = s; c.lineWidth = w || 1; c.stroke() }
  function sq(c, x, y, r, stroke, fill) { x = Math.round(x) + .5; y = Math.round(y) + .5; if (fill) { c.fillStyle = fill; c.fillRect(x - r, y - r, 2 * r, 2 * r) } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.strokeRect(x - r, y - r, 2 * r, 2 * r) } }
  function txt(c, s, x, y, a, al, f, col) { c.font = f || MONO; c.fillStyle = col || ink(a); c.textAlign = al || 'left'; c.textBaseline = 'middle'; c.fillText(s, x, y) }
  var D = {};
  D.channels = function (c, W, H, p, t) {
    var S = ['Calls', 'Texts', 'Web forms', 'Facebook', 'Google', 'Lead sites'], nw = W < 620, x0 = W * (nw ? .3 : .2), xk = W * .52, nx = W * (nw ? .84 : .8), ny = H * .5, over = ez((p - .5) / .3);
    S.forEach(function (s, i) {
      var y = H * (.16 + i * .136), k = cl(p * 2.4 - i * .2), lost = i % 2 === 1 || i === 4;
      txt(c, s, x0 - 16, y, .35 + .5 * k, 'right'); sq(c, x0, y, 3, null, ink(.3 + .7 * k)); if (k <= 0) return;
      var k1 = cl(k * 2), k2 = cl(k * 2 - 1); seg(c, x0, y, lerp(x0, xk, k1), y, ink(.38)); if (k2 > 0) seg(c, xk, y, lerp(xk, nx, k2), lerp(y, ny, k2), ink(.38));
      if (k < 1) return;
      for (var n = 0; n < 3; n++) { var m = (t * .16 + n / 3 + i * .17) % 1, d = lost ? over : 0, px, py; if (m < .62) { px = lerp(x0, xk, m / .62); py = y } else { var u = (m - .62) / .38; px = lerp(xk, nx, u); py = lerp(y, ny, u); if (d > 0 && u > .35) { var f = (u - .35) / .65; py += f * f * H * .34 * d; c.fillStyle = red((1 - f) * d + (1 - d)); c.fillRect(px - 2, py - 2, 4, 4); continue } }
        c.fillStyle = ink(.95); c.fillRect(px - 2, py - 2, 4, 4) }
    });
    var r = 26; c.strokeStyle = ink(.9); c.lineWidth = 1; c.strokeRect(Math.round(nx - r) + .5, Math.round(ny - r) + .5, 2 * r, 2 * r); sq(c, nx, ny, 5, null, ink(1)); txt(c, 'You', nx, ny - r - 16, .9, 'center', '600 14px Inter,system-ui,sans-serif');
    if (over > 0) { txt(c, 'on a job', nx, ny + r + 16, .5 * over, 'center'); txt(c, 'missed', lerp(xk, nx, .62), H * .9, over, 'center', MONO, RED); c.setLineDash([2, 4]); seg(c, xk + 10, H * .86, nx - 10, H * .86, red(.5 * over)); c.setLineDash([]) }
  };
  var LEADS = [6.6, 7.4, 8.3, 9.1, 9.7, 10.4, 11.2, 11.8, 12.2, 12.9, 13.6, 14.5, 15.2, 16.1, 17.2, 17.9, 18.7, 19.2, 19.8, 20.4, 21.0, 21.6];
  D.day = function (c, W, H, p, t) {
    var x0 = W * .06, x1 = W * .94, by = H * .68, X = function (h) { return lerp(x0, x1, (h - 6) / 16) }, scan = lerp(5.5, 22.5, ez(p * 1.15)), nw = W < 620;
    function busy(h) { return (h >= 8 && h < 12) || (h >= 12.6 && h < 17) || h >= 18.4 }
    // the hours nobody can pick up
    [[8, 12, 'On a job'], [12.6, 17, 'On a job'], [18.4, 22, 'After hours']].forEach(function (b) { if (scan < b[0]) return; var e = Math.min(scan, b[1]), xa = X(b[0]), xb = X(e); c.save(); c.beginPath(); c.rect(xa, by - H * .46, xb - xa, H * .46); c.clip(); c.strokeStyle = ink(.09); c.lineWidth = 1; for (var q = xa - H; q < xb; q += 9) { c.beginPath(); c.moveTo(q, by); c.lineTo(q + H * .46, by - H * .46); c.stroke() } c.restore(); seg(c, xa, by - H * .46, xa, by, ink(.22)); if (e >= b[1]) seg(c, xb, by - H * .46, xb, by, ink(.22)); if (scan > b[0] + 1.2) txt(c, b[2], xa + 10, by - H * .46 + 14, .5) });
    seg(c, x0, Math.round(by) + .5, x1, Math.round(by) + .5, ink(.5));
    for (var h = 6; h <= 22; h += 2) { var x = Math.round(X(h)) + .5; seg(c, x, by, x, by + 6, ink(.5)); if (!nw || h % 4 === 2) txt(c, (h > 12 ? h - 12 : h) + (h >= 12 ? ' PM' : ' AM'), x, by + 20, .5, 'center') }
    var got = 0, miss = 0; LEADS.forEach(function (h, i) { if (h > scan) return; var k = ez((scan - h) * 2.2), b = busy(h), x = Math.round(X(h)) + .5, top = by - (H * .16 + (i * 37 % 5) * H * .05) * k; seg(c, x, by, x, top, b ? red(.8) : ink(.8)); sq(c, x, top, 3.5, null, b ? RED : ink(1)); b ? miss++ : got++ });
    seg(c, X(scan), by - H * .5, X(scan), by + 6, ink(.25 * (1 - ez((p - .82) / .15))));
    txt(c, 'Picked up', x0 + 14, H * .1, .8); sq(c, x0 + 4, H * .1, 3.5, null, ink(1)); txt(c, String(got), x0 + 96, H * .1, .9, 'left', '600 13px Inter,system-ui,sans-serif');
    txt(c, 'Missed', x0 + 150, H * .1, .8); sq(c, x0 + 140, H * .1, 3.5, null, RED); txt(c, String(miss), x0 + 206, H * .1, 1, 'left', '600 13px Inter,system-ui,sans-serif', RED)
  };
  var STEPS = ['Call', 'Text', 'Form', 'Vet', 'Book', 'Remind', 'Estimate', 'Quote', 'Chase', 'Invoice', 'Review', 'Repeat'], WEAK = [1, 5, 8, 10], COST = [.55, .8, 1, .45];
  D.method = function (c, W, H, p, t, host) {
    var nw = W < 620, x0 = W * .05, x1 = W * .95, y = H * .56, n = STEPS.length, X = function (i) { return lerp(x0, x1, i / (n - 1)) }, a = cl(p / .34), b = cl((p - .34) / .33), r = cl((p - .67) / .33), step = p < .34 ? 0 : p < .67 ? 1 : 2, scan = lerp(x0 - 30, x1 + 30, ez(a * 1.08)), R = nw ? 7 : 11;
    var sec = host.closest('.st-method'); if (sec && sec.dataset.step !== String(step)) sec.dataset.step = step;
    txt(c, ['01  AUDIT', '02  BUILD', '03  RUN'][step], x0, H * .1, .9); txt(c, 'Example business', x1, H * .1, .4, 'right');
    seg(c, x0, Math.round(y) + .5, x1, Math.round(y) + .5, ink(.22 + .5 * r));
    STEPS.forEach(function (s, i) {
      var x = X(i), seen = scan > x, w = WEAK.indexOf(i), weak = w >= 0, fix = weak ? ez(b * 1.7 - w * .22) : 0;
      if (weak && seen && fix < 1) { var hgt = H * .26 * COST[w] * (1 - fix); c.fillStyle = red(.16); c.fillRect(Math.round(x - R), y - R - 10 - hgt, 2 * R, hgt); seg(c, x - R, Math.round(y - R - 10 - hgt) + .5, x + R, Math.round(y - R - 10 - hgt) + .5, RED) }
      if (weak && fix > 0) { var dy = (1 - fix) * H * .34; c.fillStyle = '#000'; c.fillRect(x - R - 1, y - R - 1, 2 * R + 2, 2 * R + 2); sq(c, x, y - dy, R, ink(.95), ink(.12 + .88 * ez(fix * 2 - 1))); if (fix < 1) seg(c, x, y - dy - R - 4, x, y - dy - R - 4 - 22 * (1 - fix), ink(.4)) }
      else { c.fillStyle = '#000'; c.fillRect(x - R - 1, y - R - 1, 2 * R + 2, 2 * R + 2); sq(c, x, y, R, weak && seen ? RED : ink(seen ? .85 : .25), weak && seen ? red(.14) : null); if (seen && !weak) sq(c, x, y, 2.5, null, ink(.9)) }
      if (!nw || (weak && seen) || ((i === 0 || i === n - 1) && !(scan > x0 && WEAK.indexOf(i === 0 ? 1 : n - 2) >= 0))) txt(c, s, x, y + R + 20, weak && seen && fix < 1 ? 1 : seen ? .7 : .3, 'center', MONO, weak && seen && fix < 1 ? RED : null)
    });
    if (a > 0 && a < 1) { seg(c, scan, H * .2, scan, H * .86, ink(.7)); c.fillStyle = ink(.05); c.fillRect(scan - 60, H * .2, 60, H * .66) }
    if (r > 0) for (var k = 0; k < 7; k++) { var m = (t * .11 + k / 7) % 1, px = lerp(x0, x1, m); if (m > r * 1.2) continue; c.fillStyle = k % 3 === 0 ? RED : ink(1); c.fillRect(px - 2.5, y - 2.5, 5, 5); c.fillStyle = ink(.25); c.fillRect(px - 16, y - .5, 13, 1) }
  };
  [].forEach.call(document.querySelectorAll('[data-story]'), function (host) {
    var draw = D[host.dataset.story]; if (!draw) return; var cv = document.createElement('canvas'), c = cv.getContext('2d'), W = 1, H = 1, vis = false, raf = 0, p = 0, s = 0, t0 = performance.now(), last = t0, pin = host.closest('.st-method'); cv.setAttribute('aria-hidden', 'true'); host.appendChild(cv);
    function size() { var r = host.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); W = Math.max(1, r.width); H = Math.max(1, r.height); cv.width = W * d; cv.height = H * d; c.setTransform(d, 0, 0, d, 0, 0); kick() }
    function prog() { var vh = innerHeight; if (pin) { var b = pin.getBoundingClientRect(); p = cl(-b.top / Math.max(1, b.height - vh)) } else { var q = host.getBoundingClientRect(); p = cl((vh * .92 - q.top) / (vh * .62)) } kick() }
    function frame(now) { raf = 0; var dt = Math.min(.05, (now - last) / 1000); last = now; s += (p - s) * Math.min(1, dt * 9); c.clearRect(0, 0, W, H); draw(c, W, H, s, (now - t0) / 1000, host); if (vis) raf = requestAnimationFrame(frame) }
    function kick() { if (!raf) raf = requestAnimationFrame(frame) }
    new ResizeObserver(size).observe(host); new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) { last = performance.now(); kick() } }).observe(host);
    addEventListener('scroll', prog, { passive: true }); addEventListener('resize', prog); size(); prog()
  })
})();
