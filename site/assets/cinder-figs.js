// One drawing per system page, each a different kind of picture, each built by the scroll.
// thread: a conversation. week: a calendar. cadence: lanes on a day axis. ratings: glyphs over a dot matrix.
// page: an annotated wireframe. All sample data.
(function () {
  var INK = '242,241,238', RED = '#e0193a', SANS = 'Inter,system-ui,sans-serif', MONO = '"Geist Mono",ui-monospace,monospace';
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v } function ez(x) { x = cl(x); return x * x * (3 - 2 * x) } function lerp(a, b, t) { return a + (b - a) * t }
  function ink(a) { return 'rgba(' + INK + ',' + cl(a).toFixed(3) + ')' } function red(a) { return 'rgba(224,25,58,' + cl(a).toFixed(3) + ')' } function px(v) { return Math.round(v) + .5 }
  function line(c, x0, y0, x1, y1, s, w) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = s; c.lineWidth = w || 1; c.stroke() }
  function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath() }
  function card(c, x, y, w, h, r, stroke, fill) { rr(c, px(x), px(y), Math.round(w), Math.round(h), r); if (fill) { c.fillStyle = fill; c.fill() } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke() } }
  function txt(c, s, x, y, col, al, f) { c.font = f; c.fillStyle = col; c.textAlign = al || 'left'; c.textBaseline = 'middle'; c.fillText(s, x, y) }
  function wrap(c, s, f, max) { c.font = f; var out = [], cur = ''; s.split(' ').forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > max && cur) { out.push(cur); cur = w } else cur = t }); out.push(cur); return out }
  var D = {};
  // ---- Answering: the thread itself
  var TH = [['sys', 'Missed call, 7:42 PM'], ['out', 'Sorry we missed you. Looking for a quote? Pick a time that works: Tue 9 AM, Wed 2 PM or Thu 11 AM.', 'Sent'], ['in', 'Wed 2 works'], ['out', 'You are booked for Wed at 2 PM. See you then.', 'Booked'], ['sys', 'On your calendar']];
  D.thread = function (c, W, H, p) {
    var nw = W < 620, cw = Math.min(nw ? W * .78 : 470, W * .8), xl = (W - cw) / 2, fs = nw ? 12.5 : 15, f = '400 ' + fs + 'px ' + SANS, lh = fs * 1.42, gx = xl - (nw ? 12 : 44), tot = 0;
    TH.forEach(function (m) { tot += m[0] === 'sys' ? 36 : wrap(c, m[1], f, cw * .76 - 30).length * lh + 36 }); var y = Math.max(H * .05, (H - tot) / 2);
    line(c, px(gx), H * .06, px(gx), H * .94, ink(.14));
    TH.forEach(function (m, i) {
      var k = ez(p * 5.6 - i * 1.05), dy = (1 - k) * 14; c.globalAlpha = k;
      if (m[0] === 'sys') { txt(c, m[1], W / 2, y + 10 + dy, i ? ink(.9) : RED, 'center', '500 ' + (nw ? 10.5 : 12) + 'px ' + MONO); c.fillStyle = i ? ink(.9) : RED; c.fillRect(Math.round(gx) - 3, Math.round(y + 7 + dy), 6, 6); y += 36 }
      else { var mw = cw * .76, L = wrap(c, m[1], f, mw - 30), bw = 30, h = L.length * lh + 22; L.forEach(function (s) { bw = Math.max(bw, c.measureText(s).width + 30) }); var out = m[0] === 'out', bx = out ? xl + cw - bw : xl;
        card(c, bx, y + dy, bw, h, 15, out ? null : ink(.22), out ? ink(.95) : '#0d0d0f'); L.forEach(function (s, j) { txt(c, s, bx + 15, y + dy + 11 + lh * (j + .5), out ? '#0a0a0c' : ink(.95), 'left', f) });
        if (m[2] && !nw) txt(c, m[2], xl + cw + 16, y + dy + h - 12, m[2] === 'Booked' ? RED : ink(.45), 'left', '500 12px ' + MONO); line(c, gx, px(y + dy + h / 2), gx + (nw ? 6 : 14), px(y + dy + h / 2), ink(.3)); y += h + 14 }
      c.globalAlpha = 1
    })
  };
  // ---- Booking: a week, a slot offered, a slot taken, reminders set
  var JOBS = [[0, 0, 3], [0, 5, 2], [1, 2, 4], [2, 0, 3], [3, 3, 3], [4, 1, 2], [4, 6, 2]], OFFER = [[1, 0], [2, 5], [3, 0]];
  D.week = function (c, W, H, p) {
    var nw = W < 620, x0 = W * (nw ? .14 : .1), x1 = W * .96, y0 = H * .15, y1 = H * .95, cwd = (x1 - x0) / 5, rh = (y1 - y0) / 9, a = ez(p * 3.2 - .5), b = ez(p * 3.2 - 1.5), r = ez(p * 3.2 - 2.2), fs = nw ? 10 : 12;
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(function (d, i) { txt(c, d, x0 + cwd * (i + .5), y0 - 16, ink(.6), 'center', '500 ' + fs + 'px ' + MONO); line(c, px(x0 + cwd * i), y0, px(x0 + cwd * i), y1, ink(.09)) }); line(c, px(x1), y0, px(x1), y1, ink(.09));
    for (var h = 0; h <= 9; h++) { line(c, x0, px(y0 + rh * h), x1, px(y0 + rh * h), ink(h % 9 ? .06 : .14)); if (h < 9 && (!nw || h % 2 === 0)) txt(c, ((h + 7) % 12 + 1) + (h + 8 >= 12 ? ' PM' : ' AM'), x0 - 10, y0 + rh * h + 1, ink(.4), 'right', '500 ' + (fs - 1) + 'px ' + MONO) }
    JOBS.forEach(function (j, i) { var k = ez(p * 4 - i * .12); if (k <= 0) return; c.globalAlpha = k; card(c, x0 + cwd * j[0] + 4, y0 + rh * j[1] + 3, cwd - 8, rh * j[2] - 6, 7, ink(.16), '#101013'); if (!nw) txt(c, 'Job', x0 + cwd * j[0] + 16, y0 + rh * j[1] + 18, ink(.4), 'left', '500 12px ' + SANS); c.globalAlpha = 1 });
    OFFER.forEach(function (o, i) { var mine = i === 1, x = x0 + cwd * o[0] + 4, y = y0 + rh * o[1] + 3, w = cwd - 8, hgt = rh * 2 - 6, k = a * (mine ? 1 : 1 - b); if (k <= 0) return;
      if (mine && b > 0) { card(c, x, y, w, hgt, 7, null, ink(.12 + .84 * b)); txt(c, 'Estimate', x + 12, y + 16, b > .5 ? '#0a0a0c' : ink(.9), 'left', '600 ' + (nw ? 11 : 13.5) + 'px ' + SANS); if (!nw) txt(c, 'Wed 1:00 PM', x + 12, y + 35, b > .5 ? 'rgba(10,10,12,.6)' : ink(.5), 'left', '500 11.5px ' + MONO) }
      else { c.setLineDash([4, 4]); card(c, x, y, w, hgt, 7, red(.9 * k)); c.setLineDash([]); if (!nw) txt(c, 'Open', x + 12, y + 16, red(k), 'left', '500 12px ' + MONO) } });
    if (r > 0) [['Reminder, day before', 1, 8], ['Reminder, morning of', 3, 8]].forEach(function (q, i) { var k = ez(r * 1.8 - i * .5); if (k <= 0) return; var tx = x0 + cwd * q[1] + cwd / 2, ty = y0 + rh * q[2], ex = x0 + cwd * 2 + cwd * (i ? .78 : .22), ey = y0 + rh * 7 - 3; c.globalAlpha = k; line(c, px(ex), ey, px(ex), ty, ink(.4)); line(c, ex, px(ty), tx, px(ty), ink(.4)); c.font = '500 ' + (nw ? 10 : 12) + 'px ' + SANS; var w = c.measureText(nw ? 'Reminder' : q[0]).width + 30; card(c, tx - w / 2, ty - 13, w, 26, 13, ink(.5), '#000'); c.fillStyle = RED; c.fillRect(Math.round(tx - w / 2 + 10), Math.round(ty - 3), 5, 5); txt(c, nw ? 'Reminder' : q[0], tx - w / 2 + 21, ty + .5, ink(.95), 'left', c.font); c.globalAlpha = 1 })
  };
  // ---- Follow-up: every open quote on its own lane, touched on a schedule until it has an answer
  var LANES = [['Fence, 180 ft', [2], 3, 'Signed'], ['Deck repair', [2, 5, 9], 10, 'Signed'], ['Gate and posts', [2, 5], 6, 'Declined'], ['Privacy fence', [2, 5, 9, 13], 99, '']];
  D.cadence = function (c, W, H, p) {
    var nw = W < 620, x0 = W * (nw ? .08 : .25), x1 = W * (nw ? .8 : .86), top = H * .2, gap = H * .185, day = lerp(0, 14, ez(p * 1.12)), X = function (d) { return lerp(x0, x1, d / 14) }, fs = nw ? 10 : 12;
    for (var d = 0; d <= 14; d++) { var x = px(X(d)); line(c, x, top - 26, x, top - (d % 7 ? 21 : 16), ink(d % 7 ? .22 : .5)); if (d % 7 === 0 || d === 2 || d === 5 || d === 9) txt(c, 'Day ' + d, x, top - 40, ink(d % 7 ? .34 : .6), 'center', '500 ' + (fs - 1) + 'px ' + MONO) }
    LANES.forEach(function (L, i) { var y = top + gap * i + 8, end = Math.min(L[2], 14), done = day >= L[2], reach = Math.min(day, end);
      if (nw) txt(c, L[0], x0, y - 18, ink(.7), 'left', '500 11px ' + SANS); else txt(c, L[0], x0 - 22, y, ink(.85), 'right', '500 14px ' + SANS);
      line(c, x0, px(y), x1, px(y), ink(.1)); line(c, x0, px(y), X(reach), px(y), ink(done && L[3] === 'Declined' ? .35 : .9), 1.5); c.fillStyle = ink(.9); c.fillRect(Math.round(x0) - 3, Math.round(y) - 3, 6, 6);
      L[1].forEach(function (t) { if (t > reach) return; var k = ez((day - t) * 1.6), tx = px(X(t)); line(c, tx, y - 9 * k, tx, y + 9 * k, ink(.9), 1.5); card(c, tx - 5, y - 20 * k - 5, 10, 10, 2.5, ink(.9), '#000') });
      if (done && L[3]) { var k2 = ez((day - L[2]) * 1.4), ok = L[3] === 'Signed', ex = X(L[2]); c.globalAlpha = k2; c.font = '600 ' + (nw ? 10.5 : 12.5) + 'px ' + SANS; var w = c.measureText(L[3]).width + 22; card(c, ex + 8, y - 13, w, 26, 13, ok ? null : ink(.35), ok ? ink(.95) : '#000'); txt(c, L[3], ex + 19, y + .5, ok ? '#0a0a0c' : ink(.6), 'left', c.font); c.globalAlpha = 1 }
      else if (!done && day > 13.5 && !nw) txt(c, 'Still open', X(14) + 12, y, ink(.5), 'left', '500 12px ' + MONO) });
    if (p < .97) { var nx = px(X(day)); line(c, nx, top - 14, nx, top + gap * 3.5, RED) }
  };
  // ---- Reviews: five glyphs that fill, over every finished job
  D.ratings = function (c, W, H, p) {
    var nw = W < 620, R = Math.min(W * .075, H * .15), cy = H * .32, sp = R * 2.55, f = p * 5.4, cols = nw ? 9 : 14, rows = 3, n = cols * rows, g = Math.min(34, (W * .78) / cols), gx = (W - g * (cols - 1)) / 2, gy = H * .66, asked = 0, got = 0, i, j;
    for (i = 0; i < 5; i++) { var x = W / 2 + (i - 2) * sp, k = cl(f - i), pts = []; for (j = 0; j < 10; j++) { var a = -Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? R * .42 : R; pts.push([x + Math.cos(a) * r, cy + Math.sin(a) * r]) }
      function path() { c.beginPath(); pts.forEach(function (q, m) { m ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]) }); c.closePath() }
      if (k > 0) { c.save(); c.beginPath(); c.rect(x - R, cy - R, 2 * R * ez(k), 2 * R); c.clip(); path(); c.fillStyle = ink(.95); c.fill(); c.restore() } path(); c.strokeStyle = ink(.5 + .45 * cl(f - i + .4)); c.lineWidth = 1.25; c.lineJoin = 'round'; c.stroke() }
    for (i = 0; i < n; i++) { var x2 = gx + (i % cols) * g, y2 = gy + Math.floor(i / cols) * g, k1 = ez(p * 1.9 - i / n * 1.1), rev = i % 3 !== 1, k2 = rev ? ez(p * 1.9 - .35 - i / n * 1.1) : 0; if (k1 > .5) asked++; if (k2 > .5) got++;
      card(c, x2 - 6, y2 - 6, 12, 12, 3, k2 > 0 ? null : ink(.2 + .5 * k1), k2 > 0 ? ink(.2 + .75 * k2) : k1 > 0 ? 'rgba(255,255,255,.04)' : null); if (k1 > 0 && k1 < 1) { c.strokeStyle = red(1 - k1); c.strokeRect(px(x2 - 6 - 6 * k1), px(y2 - 6 - 6 * k1), 12 + 12 * k1, 12 + 12 * k1) } }
    var ly = gy - g * .95, fs = nw ? 10.5 : 12; txt(c, 'Finished jobs  ' + n, gx - 6, ly, ink(.5), 'left', '500 ' + fs + 'px ' + MONO); txt(c, 'Reviewed  ' + got, gx + g * (cols - 1) + 6, ly, ink(.95), 'right', '500 ' + fs + 'px ' + MONO); c.font = '500 ' + fs + 'px ' + MONO; var w = c.measureText('Reviewed  ' + got).width; txt(c, 'Asked  ' + asked, gx + g * (cols - 1) - w - 16, ly, ink(.6), 'right', '500 ' + fs + 'px ' + MONO)
  };
  // ---- Websites: a page drawn block by block, with the three things that make it book
  D.page = function (c, W, H, p) {
    var nw = W < 620, fw = Math.min(W * (nw ? .7 : .46), 470), fh = H * .86, fx = (W - fw) / 2 - (nw ? 0 : 26), fy = H * .07, k = function (i) { return ez(p * 3.4 - i * .32) }, b = ez(p * 3.4 - 2.3), pad = fw * .07, fs = nw ? 10.5 : 13;
    card(c, fx, fy, fw, fh, 12, ink(.5), '#070708'); line(c, fx, px(fy + 30), fx + fw, px(fy + 30), ink(.2)); [0, 1, 2].forEach(function (i) { c.fillStyle = ink(.35); c.fillRect(Math.round(fx + 14 + i * 12), Math.round(fy + 12), 6, 6) });
    function block(i, x, y, w, h, fill, stroke, from) { var q = k(i); if (q <= 0) return; c.globalAlpha = q; card(c, fx + x + (from || 0) * (1 - q) * 40, fy + y + (from ? 0 : (1 - q) * 18), w, h, 5, stroke, fill); c.globalAlpha = 1 }
    block(0, pad, 46, fw * .2, 9, ink(.9)); block(0, fw - pad - fw * .26, 46, fw * .26, 9, ink(.22));
    block(1, pad, fh * .22, fw * .52, fh * .055, ink(.92), null, -1); block(1, pad, fh * .3, fw * .4, fh * .055, ink(.92), null, -1); block(2, pad, fh * .4, fw * .46, 8, ink(.3)); block(2, pad, fh * .44, fw * .36, 8, ink(.3));
    block(3, fw * .62, fh * .2, fw * .31, fh * .36, 'rgba(255,255,255,.04)', ink(.22), 1); var bw = fw * .4, bx = pad, by = fh * .52, bh = fh * .075;
    if (k(4) > 0) { c.globalAlpha = k(4); card(c, fx + bx, fy + by, bw, bh, 7, RED, red(.12 + .88 * b)); txt(c, 'Book an estimate', fx + bx + bw / 2, fy + by + bh / 2 + .5, b > .5 ? '#fff' : RED, 'center', '600 ' + (nw ? 9 : 12) + 'px ' + SANS); c.globalAlpha = 1 }
    [0, 1, 2].forEach(function (i) { block(5, pad + i * (fw * .295), fh * .68, fw * .27, fh * .2, 'rgba(255,255,255,.03)', ink(.16)) });
    // three callouts
    [['Loads fast on a phone', fx, fy + 15, -1, 5], ['One clear button', fx, fy + by + bh / 2, -1, 4], ['Straight onto your calendar', fx + fw, fy + 57, 1, 6]].forEach(function (q, i) { var a = ez(p * 3.4 - q[4] * .32 - .5); if (a <= 0 || (nw && i !== 1)) return; var ex = q[1] + q[3] * (nw ? 14 : fw * .12) * a, lab = nw ? 'One button' : q[0]; line(c, q[1], px(q[2]), ex, px(q[2]), ink(.5)); c.fillStyle = i === 2 && b > .5 ? RED : ink(.95); c.fillRect(Math.round(q[1]) - 3, Math.round(q[2]) - 3, 6, 6); c.globalAlpha = a; txt(c, lab, ex + q[3] * 10, q[2] + .5, ink(.92), q[3] > 0 ? 'left' : 'right', '500 ' + fs + 'px ' + SANS); c.globalAlpha = 1 });
    if (b > 0 && !nw) { c.globalAlpha = b; var tw = 168, tx = fx + fw - tw - 12, ty = fy + 40 + (1 - b) * -10; card(c, tx, ty, tw, 34, 9, ink(.4), '#000'); c.fillStyle = RED; c.fillRect(Math.round(tx + 12), Math.round(ty + 14), 6, 6); txt(c, 'Estimate booked', tx + 26, ty + 17.5, ink(.95), 'left', '500 12.5px ' + SANS); c.globalAlpha = 1 }
  };
  [].forEach.call(document.querySelectorAll('[data-fig]'), function (host) {
    var draw = D[host.dataset.fig]; if (!draw) return; var cv = document.createElement('canvas'), c = cv.getContext('2d'), W = 1, H = 1, vis = false, raf = 0, sp = 0, s = 0, tIn = 0, last = performance.now(); cv.setAttribute('aria-hidden', 'true'); host.appendChild(cv);
    function size() { var r = host.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); W = Math.max(1, r.width); H = Math.max(1, r.height); cv.width = W * d; cv.height = H * d; c.setTransform(d, 0, 0, d, 0, 0); kick() }
    function prog() { var q = host.getBoundingClientRect(); sp = cl((innerHeight * .92 - q.top) / (innerHeight * .78)); kick() }
    // it starts drawing when it is first seen, and the scroll finishes it
    function frame(now) { raf = 0; var dt = Math.min(.05, (now - last) / 1000); last = now; if (vis && !tIn) tIn = now; var p = cl(sp * .62 + (tIn ? ez((now - tIn) / 2600) * .5 : 0)); s += (p - s) * Math.min(1, dt * 8); c.clearRect(0, 0, W, H); draw(c, W, H, s); if (vis && (Math.abs(p - s) > .001 || now - tIn < 2800)) raf = requestAnimationFrame(frame) }
    function kick() { if (!raf) raf = requestAnimationFrame(frame) }
    new ResizeObserver(size).observe(host); new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) { last = performance.now(); kick() } }).observe(host);
    addEventListener('scroll', prog, { passive: true }); addEventListener('resize', prog); if (document.fonts && document.fonts.ready) document.fonts.ready.then(kick); size(); prog()
  })
})();
