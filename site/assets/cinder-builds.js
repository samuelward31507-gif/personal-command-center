// One drawing per build page. Twenty-six different pictures: wave, widget, inbox, sieve, dial, countdown, map,
// tracker, takeoff, options, aging, sorting, reply, year ring, cycle, tree, segments, profile, photo, pipeline,
// ask, dictation, report, transcript, agent loop, blueprint. Some play on their own, some follow the scroll,
// one follows the pointer. All sample data.
(function () {
  var INK = '242,241,238', RED = '#e0193a', SANS = 'Inter,system-ui,sans-serif', MONO = '"Geist Mono",ui-monospace,monospace', Z = 1;
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v } function ez(x) { x = cl(x); return x * x * (3 - 2 * x) } function lerp(a, b, t) { return a + (b - a) * t }
  function ink(a) { return 'rgba(' + INK + ',' + cl(a).toFixed(3) + ')' } function red(a) { return 'rgba(224,25,58,' + cl(a).toFixed(3) + ')' } function px(v) { return Math.round(v) + .5 }
  function F(w, s, mono) { return w + ' ' + (s * Z).toFixed(1) + 'px ' + (mono ? MONO : SANS) }
  function line(c, x0, y0, x1, y1, s, w) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = s; c.lineWidth = w || 1; c.stroke() }
  function rr(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath() }
  function card(c, x, y, w, h, r, stroke, fill) { if (w < 1 || h < 1) return; rr(c, px(x), px(y), Math.round(w), Math.round(h), r); if (fill) { c.fillStyle = fill; c.fill() } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke() } }
  function txt(c, s, x, y, col, al, f) { c.font = f; c.fillStyle = col; c.textAlign = al || 'left'; c.textBaseline = 'middle'; c.fillText(s, x, y) }
  function wrap(c, s, f, max) { c.font = f; var out = [], cur = ''; s.split(' ').forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > max && cur) { out.push(cur); cur = w } else cur = t }); out.push(cur); return out }
  function bz(P, t) { var u = 1 - t; return [u * u * u * P[0] + 3 * u * u * t * P[2] + 3 * u * t * t * P[4] + t * t * t * P[6], u * u * u * P[1] + 3 * u * u * t * P[3] + 3 * u * t * t * P[5] + t * t * t * P[7]] }
  function curve(c, P, a, b, stroke, w) { if (b <= a) return; c.beginPath(); for (var i = 0; i <= 30; i++) { var q = bz(P, lerp(a, b, i / 30)); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]) } c.strokeStyle = stroke; c.lineWidth = w || 1; c.stroke() }
  function S(x0, y0, x1, y1) { return [x0, y0, lerp(x0, x1, .5), y0, lerp(x0, x1, .5), y1, x1, y1] }
  function pulse(c, P, m, col) { var q = bz(P, cl(m)); c.fillStyle = col || ink(1); c.fillRect(q[0] - 2.5, q[1] - 2.5, 5, 5) }
  // a rounded label that sizes itself; returns its width
  function pill(c, x, y, s, o) { o = o || {}; var f = F(o.w || '500', o.s || 13, o.mono); c.font = f; var w = c.measureText(s).width + (o.dot ? 34 : 24) * Z, h = (o.h || 28) * Z, x0 = o.al === 'l' ? x : o.al === 'r' ? x - w : x - w / 2; c.globalAlpha *= o.a == null ? 1 : o.a; card(c, x0, y - h / 2, w, h, h / 2, o.stroke === undefined ? ink(.28) : o.stroke, o.fill || '#0b0b0d'); if (o.dot) { c.fillStyle = o.dot; c.fillRect(Math.round(x0 + 12 * Z), Math.round(y - 2.5), 5, 5) } txt(c, s, x0 + (o.dot ? 24 : 12) * Z, y + .5, o.col || ink(.95), 'left', f); if (o.a != null) c.globalAlpha /= o.a || 1; return w }
  function bubble(c, x, y, w, s, out, k, f) { f = f || F('400', 14); var L = wrap(c, s, f, w - 28), lh = 20 * Z, h = L.length * lh + 20, bw = 28; L.forEach(function (q) { bw = Math.max(bw, c.measureText(q).width + 28) }); var show = Math.round(s.length * cl(k)), bx = out ? x - bw : x; card(c, bx, y, bw, h, 14, out ? null : ink(.24), out ? ink(.95) : '#0d0d0f'); var n = 0; L.forEach(function (q, j) { var part = q.slice(0, Math.max(0, show - n)); n += q.length + 1; txt(c, part, bx + 14, y + 10 + lh * (j + .5), out ? '#0a0a0c' : ink(.95), 'left', f) }); return h }
  function star(c, x, y, R, fill, stroke) { c.beginPath(); for (var j = 0; j < 10; j++) { var a = -Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? R * .42 : R; j ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r) } c.closePath(); if (fill) { c.fillStyle = fill; c.fill() } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke() } }
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
  function bars(c, x, y, w, n, a) { for (var i = 0; i < n; i++) { c.fillStyle = ink(a * (i ? .32 : .7)); c.fillRect(Math.round(x), Math.round(y + i * 11 * Z), Math.round(w * (i === n - 1 ? .6 : 1 - i * .12)), Math.round(4 * Z)) } }
  var B = {};
  // 1 phone agent: the call as sound, the details it pulled out
  B['phone-agent'] = ['L', function (c, W, H, p, t) {
    var SEG = [[0, .24, 0, 'Hi, I need a quote for a fence.'], [.26, .5, 1, 'Happy to help. What is the address?'], [.52, .72, 0, '214 Alder Street. This week if you can.'], [.74, 1, 1, 'Thursday at 9 works. You are booked.']], x0 = W * .07, x1 = W * .93, y = H * .3, n = 84, bw = (x1 - x0) / n, T = (t * .085) % 1.12, cur = null;
    SEG.forEach(function (s) { var xa = lerp(x0, x1, s[0]), xb = lerp(x0, x1, s[1]); txt(c, s[2] ? 'Assistant' : 'Caller', xa, y - H * .17, ink(T > s[0] ? .9 : .35), 'left', F('500', 12, 1)); line(c, xa, px(y - H * .13), xb, px(y - H * .13), s[2] ? ink(T > s[0] ? .9 : .2) : ink(.2), s[2] ? 2 : 1); if (T >= s[0]) cur = s });
    for (var i = 0; i < n; i++) { var u = (i + .5) / n, s = null; SEG.forEach(function (q) { if (u >= q[0] && u <= q[1]) s = q }); if (!s) continue; var on = u < T, h = (8 + H * .16 * rnd(i) * (.4 + .6 * Math.sin((u - s[0]) / (s[1] - s[0]) * Math.PI))) * p * (on ? 1 : .35); if (on && Math.abs(u - T) < .03) h *= 1 + .4 * Math.sin(t * 30 + i); c.fillStyle = s[2] ? ink(on ? .95 : .2) : null; if (s[2]) c.fillRect(Math.round(x0 + i * bw + 1), Math.round(y - h / 2), Math.max(2, Math.round(bw - 3)), Math.round(h)); else { c.strokeStyle = ink(on ? .9 : .25); c.lineWidth = 1; c.strokeRect(px(x0 + i * bw + 1), px(y - h / 2), Math.max(2, Math.round(bw - 3)), Math.round(h)) } }
    if (T < 1) line(c, px(lerp(x0, x1, T)), y - H * .2, px(lerp(x0, x1, T)), y + H * .16, RED);
    if (cur) txt(c, '“' + cur[3].slice(0, Math.round(cur[3].length * cl((T - cur[0]) / (cur[1] - cur[0]) * 1.3))) + '”', W / 2, H * .58, ink(.92), 'center', F('500', W < 700 ? 15 : 19));
    var FL = [['Name', .2], ['Job: fence', .24], ['214 Alder St', .72], ['This week', .72], ['Booked Thu 9:00', 1]], x = x0; FL.forEach(function (f, i) { var on = T >= f[1]; x += pill(c, x, H * .8, f[0], { al: 'l', dot: i === 4 ? (on ? RED : red(.3)) : ink(on ? 1 : .2), col: ink(on ? .95 : .3), stroke: ink(on ? .4 : .12), s: W < 700 ? 11.5 : 13 }) + 8 })
  }];
  // 2 website chat: a visitor asks on the page and leaves with a time
  B['website-chat'] = ['L', function (c, W, H, p, t) {
    var fw = W * .6, fx = W * .06, fy = H * .08, fh = H * .84, T = (t * .1) % 1.15, ww = Math.min(270 * Z, fw * .62), wh = fh * .78, wx = fx + fw - ww - 16, wy = fy + fh - wh - 14, y = wy + 46 * Z;
    card(c, fx, fy, fw, fh, 12, ink(.3), '#070708'); line(c, fx, px(fy + 28), fx + fw, px(fy + 28), ink(.16)); bars(c, fx + 24, fy + 56, fw * .3, 1, 1); bars(c, fx + 24, fy + 96, fw * .26, 4, .8); card(c, fx + 24, fy + 170, fw * .26, fh * .3, 6, ink(.12), 'rgba(255,255,255,.02)');
    card(c, wx, wy, ww, wh, 14, ink(.5), '#0b0b0d'); txt(c, 'Ask us anything', wx + 16, wy + 21 * Z, ink(.95), 'left', F('600', 13)); c.fillStyle = RED; c.fillRect(Math.round(wx + ww - 22), Math.round(wy + 18 * Z), 6, 6); line(c, wx, px(wy + 38 * Z), wx + ww, px(wy + 38 * Z), ink(.14));
    if (T > .04) y += bubble(c, wx + ww - 12, y, ww * .8, 'Do you service Arvada?', 1, (T - .04) * 6, F('400', 12.5)) + 8;
    if (T > .26) y += bubble(c, wx + 12, y, ww * .84, 'Yes, we do. Want a time for a free estimate?', 0, (T - .26) * 5, F('400', 12.5)) + 10;
    if (T > .5) { var x = wx + 12; ['Tue 9', 'Wed 2', 'Thu 11'].forEach(function (s, i) { var pick = i === 1 && T > .68; x += pill(c, x, y + 14 * Z, s, { al: 'l', s: 11.5, h: 26, stroke: pick ? null : ink(.3), fill: pick ? ink(.95) : '#0b0b0d', col: pick ? '#0a0a0c' : ink(.9), a: ez((T - .5 - i * .03) * 12) }) + 6 }); y += 38 * Z }
    if (T > .8) pill(c, wx + 12, y + 14 * Z, 'Booked for Wed at 2', { al: 'l', s: 11.5, h: 26, dot: RED, a: ez((T - .8) * 10) });
    [['Answers from your own information', .26], ['Offers a time, not a phone number', .5], ['Hands off when it is not sure', .8]].forEach(function (q, i) { var on = T > q[1], yy = H * (.3 + i * .16), xx = fx + fw + W * .04; c.fillStyle = on ? ink(.95) : ink(.2); c.fillRect(Math.round(xx), Math.round(yy - 3), 6, 6); wrap(c, q[0], F('500', 13.5), W - xx - 24 - W * .03).forEach(function (s, j) { txt(c, s, xx + 18, yy + j * 19 * Z, ink(on ? .92 : .34), 'left', F('500', 13.5)) }) })
  }];
  // 3 messages and DMs: three channels, one inbox
  B['social-messages'] = ['S', function (c, W, H, p, t) {
    var CH = ['Facebook', 'Instagram', 'Google'], lx = W * .07, cw = W * .25, ix = W * .62, iw = W * .32, rows = 6, rh = H * .11, iy = H * .14;
    card(c, ix, iy - 14, iw, rows * rh + 46 * Z, 14, ink(.45), '#0b0b0d'); txt(c, 'One inbox', ix + 16, iy + 8 * Z, ink(.95), 'left', F('600', 14));
    CH.forEach(function (s, i) { var y = H * (.2 + i * .28); txt(c, s, lx, y - 26 * Z, ink(.6), 'left', F('500', 12, 1)); for (var j = 0; j < 2; j++) { var n = i * 2 + j, k = ez(p * 2.6 - n * .2), yy = y + j * 40 * Z, ty = iy + 34 * Z + n * rh + rh * .4; card(c, lx, yy - 14 * Z, cw, 30 * Z, 8, ink(.14 + .2 * k), '#0b0b0d'); bars(c, lx + 12, yy - 2, cw * .6, 1, .5 + .4 * k); if (k <= 0) continue; var P = S(lx + cw, yy, ix, ty); curve(c, P, 0, k, ink(.34)); if (k >= 1) pulse(c, P, (t * .25 + n * .19) % 1.3);
        var k2 = ez(p * 2.6 - n * .2 - .7); if (k2 > 0) { c.globalAlpha = k2; card(c, ix + 10, ty - rh * .36, iw - 20, rh * .72, 8, ink(.2), '#101013'); c.fillStyle = ink(.9); c.fillRect(Math.round(ix + 20), Math.round(ty - 3), 6, 6); bars(c, ix + 36, ty - 2, iw * .4, 1, .9); var done = p * 2.6 - n * .2 > 1.5; txt(c, done ? 'Replied' : 'New', ix + iw - 20, ty, done ? ink(.5) : RED, 'right', F('500', 11, 1)); c.globalAlpha = 1 } } })
  }];
  // 4 lead vetting: your questions, asked before anyone drives out
  B['lead-vetting'] = ['L', function (c, W, H, p, t) {
    var G = ['Job type', 'In your area', 'Budget', 'Timing'], x0 = W * .06, x1 = W * .8, y = H * .4, gx = function (i) { return lerp(x0, x1, (i + 1) / 5) }, got = 0, no = 0;
    line(c, x0, px(y), x1, px(y), ink(.16)); G.forEach(function (s, i) { var x = px(gx(i)); line(c, x, y - H * .16, x, y + H * .16, ink(.5)); pill(c, x, y - H * .23, s, { s: W < 700 ? 11 : 12.5 }) });
    card(c, W * .83, y - H * .16, W * .13, H * .32, 12, null, ink(.95)); txt(c, 'Booked', W * .895, y - 12 * Z, '#0a0a0c', 'center', F('600', 14)); card(c, x0, H * .76, x1 - x0, H * .13, 10, ink(.16), '#0a0a0c'); txt(c, 'A polite no', x0 + 16, H * .825, ink(.5), 'left', F('500', 12.5));
    for (var n = 0; n < 12; n++) { var u = (t * .09 + n / 12) % 1, id = Math.floor(t * .09 + n / 12) * 12 + n, fail = [9, 1, 9, 2, 9, 9, 0, 9, 3, 9, 9, 1][n], cyc = Math.floor(t * .09 + n / 12), xx = lerp(x0, W * .86, u), fx = fail < 4 ? gx(fail) : 1e9;
      if (xx < fx - 4) { c.fillStyle = ink(.95); c.fillRect(xx - 4, y - 4, 8, 8); if (fail === 9 && u > .9) got++ } else { var d = cl((xx - fx) / (W * .16)), yy = lerp(y, H * .825, ez(d)); c.fillStyle = ink(.5 - .2 * d); c.fillRect(fx + d * 26 - 4, yy - 4, 8, 8) } }
    txt(c, String(7 + Math.floor(t * .09 * 7)), W * .895, y + 14 * Z, '#0a0a0c', 'center', F('600', 22))
  }];
  // 5 after hours: the night, sorted into what can wait and what cannot
  B['after-hours'] = ['L', function (c, W, H, p, t) {
    var cx = W * .3, cy = H * .5, R = Math.min(H * .36, W * .22), T = (t * .07) % 1, hr = 18 + T * 13, EV = [[19.5, 0, 'Quote request'], [22.2, 1, 'Burst pipe'], [26, 1, 'No heat'], [29.2, 0, 'Estimate']], ang = function (h) { return (h % 24) / 24 * 6.2832 - 1.5708 };
    c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.strokeStyle = ink(.2); c.lineWidth = 1; c.stroke(); c.beginPath(); c.arc(cx, cy, R, ang(18), ang(31)); c.strokeStyle = ink(.8); c.lineWidth = 3; c.stroke();
    for (var h = 0; h < 24; h++) { var a = ang(h), r0 = R + 8, r1 = R + (h % 6 ? 12 : 18); line(c, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, ink(h % 6 ? .25 : .6)); if (h % 6 === 0) txt(c, ['12 AM', '6 AM', '12 PM', '6 PM'][h / 6], cx + Math.cos(a) * (R + 40 * Z), cy + Math.sin(a) * (R + 30 * Z), ink(.5), 'center', F('500', 11, 1)) }
    var ha = ang(hr); line(c, cx, cy, cx + Math.cos(ha) * (R - 6), cy + Math.sin(ha) * (R - 6), ink(.9), 1.5); c.fillStyle = ink(1); c.fillRect(cx - 3, cy - 3, 6, 6); txt(c, 'Closed', cx, cy + R * .45, ink(.4), 'center', F('500', 11.5, 1));
    EV.forEach(function (e, i) { var a = ang(e[0]), ex = cx + Math.cos(a) * R, ey = cy + Math.sin(a) * R, on = hr >= e[0], k = ez((hr - e[0]) * 1.4), ry = H * (.2 + i * .2), rx = W * .6; c.fillStyle = on ? (e[1] ? RED : ink(1)) : ink(.25); c.fillRect(ex - 4, ey - 4, 8, 8);
      card(c, rx, ry - 22 * Z, W * .34, 44 * Z, 10, on ? (e[1] ? RED : ink(.4)) : ink(.12), on && e[1] ? 'rgba(224,25,58,.07)' : '#0b0b0d'); txt(c, e[2], rx + 14, ry - 7 * Z, ink(on ? .95 : .3), 'left', F('600', 13)); txt(c, on ? (e[1] ? 'Rings whoever is on call' : 'Booked for the morning') : 'Waiting', rx + 14, ry + 9 * Z, on ? (e[1] ? RED : ink(.55)) : ink(.25), 'left', F('500', 11.5, 1)); if (k > 0) curve(c, S(ex, ey, rx, ry), 0, k, e[1] ? red(.7) : ink(.3)) })
  }];
  // 6 reminders: from booked to the knock on the door
  B['reminders'] = ['S', function (c, W, H, p, t) {
    var x0 = W * .09, x1 = W * .91, y = H * .34, M = [[0, 'Booked', 'Confirmed: Thu 9 AM at 214 Alder St'], [.42, 'Day before', 'Reminder: we will see you tomorrow at 9'], [.78, 'Morning of', 'Still good for 9 today? Reply YES'], [1, 'Appointment', '']], now = ez(p * 1.15);
    line(c, x0, px(y), x1, px(y), ink(.16)); line(c, x0, px(y), lerp(x0, x1, now), px(y), ink(.95), 1.5);
    M.forEach(function (m, i) { var x = lerp(x0, x1, m[0]), on = now >= m[0] - .001, k = ez((now - m[0]) * 6 + (i ? 0 : 1)); card(c, x - 7, y - 7, 14, 14, 4, on ? null : ink(.3), on ? (i === 3 ? RED : ink(.95)) : '#000'); txt(c, m[1], x, y - 26 * Z, ink(on ? .95 : .4), i === 0 ? 'left' : i === 3 ? 'right' : 'center', F('600', 13.5));
      if (!m[2] || k <= 0) return; var cw = Math.min(W * .27, 250 * Z), cx = cl((x - cw / 2 - x0) / (x1 - x0 - cw)) * (x1 - x0 - cw) + x0, cy = y + H * (.14 + (i % 2) * .22); c.globalAlpha = k; line(c, px(x), y + 8, px(x), cy, ink(.3)); var L = wrap(c, m[2], F('400', 13), cw - 26); card(c, cx, cy, cw, L.length * 19 * Z + 20, 12, ink(.3), '#0d0d0f'); L.forEach(function (s, j) { txt(c, s, cx + 13, cy + 10 + 19 * Z * (j + .5), ink(.92), 'left', F('400', 13)) }); c.globalAlpha = 1 });
    var yk = ez((now - .86) * 8); if (yk > 0) pill(c, lerp(x0, x1, .9), y + H * .52, 'YES', { dot: RED, fill: ink(.95), col: '#0a0a0c', stroke: null, w: '600', a: yk })
  }];
  // 7 scheduling and dispatch: three crews, one day, rebuilt when a job runs long
  B['dispatch'] = ['L', function (c, W, H, p, t) {
    var P = function (x, y) { return [W * (.05 + x * .62), H * (.1 + y * .8)] }, k = ez(Math.sin(t * .5) * 2 + .5), D = P(.08, .5), R = [[[.3, .16], [.58, .1], [.86, .22]], [[.34, .52], [.62, .44], [.9, .56]], [[.26, .86], [.55, .8], [.84, .9]]], moved = P(.62, .44);
    [[0, .3, 1, .26], [0, .68, 1, .74], [.2, 0, .24, 1], [.72, 0, .68, 1]].forEach(function (r) { var a = P(r[0], r[1]), b = P(r[2], r[3]); line(c, a[0], a[1], b[0], b[1], ink(.07), 9); line(c, a[0], a[1], b[0], b[1], '#050506', 7) });
    R.forEach(function (stops, i) { var pts = [D].concat(stops.map(function (s) { return P(s[0], s[1]) })); if (i === 1) pts = [D, pts[1], pts[3]]; if (i === 2) pts = pts.concat([[lerp(P(.84, .9)[0], moved[0], k), lerp(P(.84, .9)[1], moved[1], k)]]);
      c.beginPath(); pts.forEach(function (q, j) { j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]) }); c.strokeStyle = ink(.5); c.lineWidth = 1.25; c.setLineDash(i === 2 ? [] : []); c.stroke();
      var u = (t * .12 + i * .3) % 1 * (pts.length - 1), j = Math.min(pts.length - 2, Math.floor(u)), f = u - j; c.fillStyle = ink(1); c.fillRect(lerp(pts[j][0], pts[j + 1][0], f) - 4, lerp(pts[j][1], pts[j + 1][1], f) - 4, 8, 8);
      stops.forEach(function (s) { var q = P(s[0], s[1]); card(c, q[0] - 6, q[1] - 6, 12, 12, 3, ink(.9), '#000') }) });
    card(c, moved[0] - 6, moved[1] - 6, 12, 12, 3, RED, 'rgba(224,25,58,.3)'); card(c, D[0] - 9, D[1] - 9, 18, 18, 4, null, ink(.95)); txt(c, 'Yard', D[0], D[1] + 22 * Z, ink(.6), 'center', F('500', 11, 1));
    var a2 = P(.34, .52); c.strokeStyle = RED; c.strokeRect(px(a2[0] - 11), px(a2[1] - 11), 22, 22); txt(c, 'Running long', a2[0], a2[1] - 22 * Z, RED, 'center', F('500', 11.5, 1));
    ['Crew 1', 'Crew 2', 'Crew 3'].forEach(function (s, i) { var y = H * (.26 + i * .2), x = W * .74; card(c, x, y - 24 * Z, W * .21, 48 * Z, 10, ink(.22), '#0b0b0d'); txt(c, s, x + 14, y - 7 * Z, ink(.95), 'left', F('600', 13)); txt(c, i === 1 ? (k > .5 ? '2 stops, one moved' : '3 stops, behind') : i === 2 ? (k > .5 ? '4 stops' : '3 stops') : '3 stops', x + 14, y + 10 * Z, i === 1 && k < .5 ? RED : ink(.5), 'left', F('500', 11.5, 1)) })
  }];
  // 8 job updates: the customer is told at every step
  B['job-updates'] = ['L', function (c, W, H, p, t) {
    var ST = [['On our way', 'Your crew is on the way. About 20 minutes.'], ['Arrived', 'We are here and getting set up.'], ['Halfway', 'Halfway through. All going to plan.'], ['Done', 'All finished. Photos attached.']], x = W * .12, y0 = H * .14, y1 = H * .86, T = (t * .08) % 1.2, now = cl(T) * 3.4;
    line(c, px(x), y0, px(x), y1, ink(.16)); line(c, px(x), y0, px(x), lerp(y0, y1, cl(now / 3)), ink(.95), 1.5);
    ST.forEach(function (s, i) { var y = lerp(y0, y1, i / 3), on = now >= i, k = ez((now - i) * 2.2); card(c, x - 8, y - 8, 16, 16, 5, on ? null : ink(.3), on ? (i === 3 ? RED : ink(.95)) : '#000'); txt(c, s[0], x + 24, y, ink(on ? .95 : .4), 'left', F('600', 15));
      if (k <= 0) return; var cw = W * .46, cx = W * .46 + (1 - k) * 24, f = F('400', 13.5), L = wrap(c, s[1], f, cw - 30), h = L.length * 20 * Z + 22 + (i === 3 ? 44 * Z : 0); c.globalAlpha = k; curve(c, S(x + 130 * Z, y, cx, y), 0, 1, ink(.2)); card(c, cx, y - h / 2, cw, h, 13, ink(.3), '#0d0d0f'); L.forEach(function (q, j) { txt(c, q, cx + 15, y - h / 2 + 11 + 20 * Z * (j + .5), ink(.92), 'left', f) }); if (i === 3) for (var j = 0; j < 3; j++)card(c, cx + 15 + j * 46 * Z, y + h / 2 - 46 * Z, 38 * Z, 34 * Z, 5, ink(.2), 'rgba(255,255,255,.05)'); c.globalAlpha = 1 })
  }];
  // 9 estimates: measurements in, a draft out
  B['estimates'] = ['S', function (c, W, H, p, t) {
    var a = [W * .08, H * .24], b = [W * .46, H * .24], d = [W * .46, H * .78], k1 = ez(p * 2.4), k2 = ez(p * 2.4 - .7), IT = [['Panels', '22'], ['Posts', '24'], ['Gate, 4 ft', '1'], ['Concrete', '24 bags'], ['Labor', '2 days']];
    line(c, a[0], a[1], lerp(a[0], b[0], cl(k1 * 2)), a[1], ink(.95), 2); if (k1 > .5) line(c, b[0], b[1], b[0], lerp(b[1], d[1], cl(k1 * 2 - 1)), ink(.95), 2);
    for (var i = 0; i <= 12; i++) { var x = lerp(a[0], b[0], i / 12); if (x <= lerp(a[0], b[0], cl(k1 * 2))) card(c, x - 4, a[1] - 4, 8, 8, 2, ink(.95), '#000') } for (i = 1; i <= 6; i++) { var y = lerp(b[1], d[1], i / 6); if (k1 > .5 && y <= lerp(b[1], d[1], cl(k1 * 2 - 1))) card(c, b[0] - 4, y - 4, 8, 8, 2, ink(.95), '#000') }
    if (k2 > 0) { c.globalAlpha = k2; var dy = a[1] - 34 * Z, dx = b[0] + 34 * Z; line(c, a[0], px(dy), b[0], px(dy), ink(.5)); line(c, px(a[0]), dy - 6, px(a[0]), dy + 6, ink(.5)); line(c, px(b[0]), dy - 6, px(b[0]), dy + 6, ink(.5)); txt(c, '120 ft', (a[0] + b[0]) / 2, dy - 12 * Z, ink(.9), 'center', F('500', 12.5, 1)); line(c, px(dx), b[1], px(dx), d[1], ink(.5)); line(c, dx - 6, px(b[1]), dx + 6, px(b[1]), ink(.5)); line(c, dx - 6, px(d[1]), dx + 6, px(d[1]), ink(.5)); txt(c, '60 ft', dx + 10, (b[1] + d[1]) / 2, ink(.9), 'left', F('500', 12.5, 1));
      var gx = lerp(a[0], b[0], .58); c.beginPath(); c.arc(gx, a[1], 26 * Z, 0, 1.5708); c.strokeStyle = RED; c.stroke(); line(c, gx, a[1], gx, a[1] + 26 * Z, RED, 1.5); txt(c, 'Gate', gx + 4, a[1] + 42 * Z, RED, 'left', F('500', 11.5, 1)); c.globalAlpha = 1 }
    var tx = W * .62, tw = W * .32; txt(c, 'Draft estimate', tx, H * .14, ink(.95), 'left', F('600', 15)); IT.forEach(function (r, i) { var k = ez(p * 2.4 - 1 - i * .16), y = H * (.25 + i * .105); line(c, tx, px(y + H * .05), tx + tw, px(y + H * .05), ink(.1)); if (k <= 0) return; c.globalAlpha = k; txt(c, r[0], tx, y, ink(.9), 'left', F('500', 14)); txt(c, r[1], tx + tw, y, ink(.95), 'right', F('500', 13, 1)); c.globalAlpha = 1 });
    pill(c, tx, H * .86, 'Ready for you to check', { al: 'l', dot: RED, a: ez(p * 2.4 - 1.9) })
  }];
  // 10 proposals: three options, one yes. Move the pointer across them.
  B['proposals'] = ['H', function (c, W, H, p, t, m) {
    var N = ['Good', 'Better', 'Best'], cw = W * .24, gap = W * .04, x0 = (W - cw * 3 - gap * 2) / 2, sel = m.on ? Math.max(0, Math.min(2, Math.floor((m.x - x0 + gap / 2) / (cw + gap)))) : Math.floor(t * .35) % 3;
    N.forEach(function (s, i) { var on = i === sel, x = x0 + i * (cw + gap), h = H * (.5 + i * .07), y = H * .8 - h - (on ? 10 : 0), k = ez(p * 2.2 - i * .25); if (k <= 0) return; c.globalAlpha = k; card(c, x, y, cw, h, 14, on ? ink(.95) : ink(.2), on ? '#101013' : '#0a0a0c'); txt(c, s, x + 18, y + 26 * Z, ink(on ? 1 : .6), 'left', F('600', 17)); line(c, x + 18, px(y + 48 * Z), x + cw - 18, px(y + 48 * Z), ink(.12));
      for (var j = 0; j < 3 + i; j++) { c.fillStyle = on ? ink(.95) : ink(.3); c.fillRect(Math.round(x + 18), Math.round(y + 68 * Z + j * 24 * Z), 5, 5); c.fillStyle = ink(on ? .5 : .16); c.fillRect(Math.round(x + 32), Math.round(y + 69 * Z + j * 24 * Z), Math.round((cw - 56) * (.9 - rnd(i * 5 + j) * .4)), Math.round(4 * Z)) }
      if (on) { var sy = y + h - 30 * Z, sx = x + 18, u = cl((t * .7) % 2.4); line(c, sx, px(sy + 12), x + cw - 18, px(sy + 12), ink(.3)); c.beginPath(); for (var q = 0; q <= 40 * u; q++) { var f = q / 40, X = sx + f * (cw - 80), Y = sy + Math.sin(f * 14) * 7 * (1 - f * .5) - f * 5; q ? c.lineTo(X, Y) : c.moveTo(X, Y) } c.strokeStyle = ink(.95); c.lineWidth = 1.5; c.stroke(); if (u >= 1) pill(c, x + cw / 2, y - 22 * Z, 'Accepted', { dot: RED, fill: ink(.95), col: '#0a0a0c', stroke: null, w: '600', s: 12.5 }) } c.globalAlpha = 1 })
  }];
  // 11 invoices: what is owed, by age, emptying as reminders go out
  B['invoicing'] = ['S', function (c, W, H, p, t) {
    var NW = W < 700, COL = [['This week', 4, 0], [NW ? '8 to 14' : '8 to 14 days', 3, .25], [NW ? '15 to 30' : '15 to 30 days', 3, .5], [NW ? '30+' : 'Over 30 days', 2, .75]], cw = W * .15, x0 = W * .06, base = H * .82, paid = 0;
    COL.forEach(function (q, i) { var x = x0 + i * (cw + W * .025), gone = Math.round(q[1] * ez(p * 1.9 - q[2] * .9 - .15)); paid += gone; txt(c, q[0], x, H * .12, ink(.6), 'left', F('500', 12, 1)); line(c, x, px(base + 8), x + cw, px(base + 8), ink(.3));
      for (var j = 0; j < q[1]; j++) { var y = base - (j + 1) * 46 * Z, out = j >= q[1] - gone; card(c, x, y, cw, 38 * Z, 8, out ? ink(.1) : i > 1 ? red(.7) : ink(.4), out ? null : i > 1 ? 'rgba(224,25,58,.07)' : '#0d0d0f'); if (!out) { bars(c, x + 12, y + 14 * Z, cw * .5, 1, .8); txt(c, 'Reminder ' + (i + 1), x + cw - 10, y + 19 * Z, i > 1 ? RED : ink(.4), 'right', F('500', 10.5, 1)) } } });
    var px0 = W * .78, pw = W * .16; txt(c, 'Paid', px0, H * .12, ink(.95), 'left', F('600', 14)); line(c, px0, px(base + 8), px0 + pw, px(base + 8), ink(.6)); for (var j = 0; j < paid; j++) { var y = base - (j % 8 + 1) * 30 * Z; card(c, px0 + Math.floor(j / 8) * (pw / 2 + 4), y, pw / 2 - 4, 24 * Z, 6, null, ink(.92)) } txt(c, String(paid), px0 + pw, H * .12, ink(.95), 'right', F('600', 14))
  }];
  // 12 bookkeeping prep: every receipt read and filed against its job
  B['bookkeeping'] = ['L', function (c, W, H, p, t) {
    var BIN = ['Materials', 'Fuel', 'Tools', 'Subs'], bw = W * .19, x0 = W * .07, by = H * .66, sx = W * .5, sy = H * .1;
    card(c, sx - 60 * Z, sy - 4, 120 * Z, 40 * Z, 10, ink(.4), '#0b0b0d'); txt(c, 'Receipts in', sx, sy + 16 * Z, ink(.9), 'center', F('500', 12.5));
    BIN.forEach(function (s, i) { var x = x0 + i * (bw + W * .033), n = 2 + Math.floor((t * .22 + i * .6) % 6); card(c, x, by, bw, H * .24, 12, ink(.3), '#0b0b0d'); txt(c, s, x + 14, by + 22 * Z, ink(.95), 'left', F('600', 14)); txt(c, String(n), x + bw - 14, by + 22 * Z, ink(.6), 'right', F('500', 12.5, 1)); for (var j = 0; j < 8; j++) { c.fillStyle = j < n ? ink(.85) : ink(.1); c.fillRect(Math.round(x + 14 + j * (bw - 28) / 8), Math.round(by + H * .16), Math.round((bw - 28) / 8 - 3), Math.round(10 * Z)) }
      var u = (t * .22 + i * .6) % 1, P = S(sx, sy + 40 * Z, x + bw / 2, by); P[2] = sx; P[3] = lerp(sy, by, .5); P[4] = x + bw / 2; P[5] = lerp(sy, by, .5); curve(c, P, 0, 1, ink(.12)); var q = bz(P, ez(u)); c.save(); c.translate(q[0], q[1]); c.rotate((u - .5) * .5); card(c, -12 * Z, -16 * Z, 24 * Z, 32 * Z, 3, ink(.9), '#0d0d0f'); for (var r = 0; r < 3; r++) { c.fillStyle = ink(.6); c.fillRect(-7 * Z, -9 * Z + r * 8 * Z, (r === 2 ? 8 : 14) * Z, 2) } c.restore() })
  }];
  // 13 review replies: good ones answered, bad ones to you first
  B['review-replies'] = ['L', function (c, W, H, p, t) {
    var T = (t * .09) % 1.15, cw = W * .4, x1 = W * .06, x2 = W * .54, y = H * .12, R1 = 'Thank you, Dana. Glad the new gate is working out. We will see you in the spring for the stain.';
    function rev(x, n, bad) { card(c, x, y, cw, H * .32, 14, bad ? red(.8) : ink(.3), bad ? 'rgba(224,25,58,.05)' : '#0b0b0d'); for (var i = 0; i < 5; i++)star(c, x + 26 * Z + i * 24 * Z, y + 28 * Z, 9 * Z, i < n ? (bad ? RED : ink(.95)) : null, i < n ? null : ink(.3)); bars(c, x + 18, y + 54 * Z, cw - 36, 3, .9) }
    rev(x1, 5, 0); rev(x2, 2, 1); txt(c, 'Posted', x1, y + H * .4, ink(.5), 'left', F('500', 11.5, 1)); var L = wrap(c, R1, F('400', 13.5), cw - 20), n = Math.round(R1.length * cl(T * 1.6)), k = 0; L.forEach(function (s, j) { txt(c, s.slice(0, Math.max(0, n - k)), x1, y + H * .47 + j * 21 * Z, ink(.92), 'left', F('400', 13.5)); k += s.length + 1 });
    var a = ez((T - .5) * 5); if (a > 0) { c.globalAlpha = a; line(c, px(x2 + cw / 2), y + H * .32, px(x2 + cw / 2), y + H * .42, RED); pill(c, x2 + cw / 2, y + H * .47, 'Sent to you first', { dot: RED }); card(c, x2, y + H * .55, cw, H * .2, 12, ink(.22), '#0b0b0d'); txt(c, 'Suggested reply', x2 + 16, y + H * .6, ink(.5), 'left', F('500', 11.5, 1)); bars(c, x2 + 16, y + H * .65, cw - 32, 3, .7); c.globalAlpha = 1 }
  }];
  B.mount = function () { };
  window.CinderBuilds = { B: B, h: { cl: cl, ez: ez, lerp: lerp, ink: ink, red: red, px: px, F: F, line: line, card: card, txt: txt, wrap: wrap, bz: bz, curve: curve, S: S, pulse: pulse, pill: pill, bubble: bubble, star: star, rnd: rnd, bars: bars, RED: RED, setZ: function (v) { Z = v } } };
})();
