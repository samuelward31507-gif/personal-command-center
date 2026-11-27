// The other thirteen build-page drawings, and the code that mounts all twenty-six.
(function () {
  var K = window.CinderBuilds; if (!K) return; var B = K.B, h = K.h, cl = h.cl, ez = h.ez, lerp = h.lerp, ink = h.ink, red = h.red, px = h.px, F = h.F, line = h.line, card = h.card, txt = h.txt, wrap = h.wrap, bz = h.bz, curve = h.curve, S = h.S, pulse = h.pulse, pill = h.pill, bubble = h.bubble, star = h.star, rnd = h.rnd, bars = h.bars, RED = h.RED;
  // 14 win-backs: a year of past customers, each written to when the moment comes round
  B['win-backs'] = ['L', function (c, W, H, p, t) {
    var cx = W * .34, cy = H * .5, R = Math.min(H * .34, W * .2), T = (t * .06) % 1, M = 'JFMAMJJASOND', back = 0;
    c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.strokeStyle = ink(.25); c.lineWidth = 1; c.stroke(); for (var i = 0; i < 12; i++) { var a = i / 12 * 6.2832 - 1.5708; txt(c, M[i], cx + Math.cos(a) * (R + 22 * 1), cy + Math.sin(a) * (R + 22), ink(.45), 'center', F('500', 11.5, 1)); line(c, cx + Math.cos(a) * (R - 5), cy + Math.sin(a) * (R - 5), cx + Math.cos(a) * (R + 5), cy + Math.sin(a) * (R + 5), ink(.4)) }
    for (i = 0; i < 16; i++) { var u = rnd(i + 3), a2 = u * 6.2832 - 1.5708, d = ((T - u) % 1 + 1) % 1, sent = d < .5, ret = i % 3 === 0, x = cx + Math.cos(a2) * R, y = cy + Math.sin(a2) * R; card(c, x - 5, y - 5, 10, 10, 3, ink(sent ? .95 : .4), sent ? ink(.95) : '#000');
      if (d < .12) { var k = d / .12; line(c, x, y, cx + Math.cos(a2) * (R + 30 * k + 8), cy + Math.sin(a2) * (R + 30 * k + 8), ink(1 - k)) } if (ret && d > .12 && d < .45) { var k2 = (d - .12) / .33; c.fillStyle = RED; c.fillRect(lerp(x, cx, ez(k2)) - 3, lerp(y, cy, ez(k2)) - 3, 6, 6) } if (ret && sent && d >= .45) back++ }
    var ha = T * 6.2832 - 1.5708; line(c, cx, cy, cx + Math.cos(ha) * R, cy + Math.sin(ha) * R, ink(.5)); card(c, cx - 30, cy - 30, 60, 60, 12, RED, '#0b0b0d'); txt(c, String(back), cx, cy - 4, ink(1), 'center', F('600', 22)); txt(c, 'back', cx, cy + 16, ink(.5), 'center', F('500', 10.5, 1));
    [['Past customers', ink(.95)], ['Written to this year', ink(.6)], ['Came back as a lead', RED]].forEach(function (q, i) { var y = H * (.32 + i * .16), x = W * .64; c.fillStyle = q[1]; c.fillRect(Math.round(x), Math.round(y - 4), 8, 8); txt(c, q[0], x + 20, y, ink(.9), 'left', F('500', 14.5)) })
  }];
  // 15 service reminders: the loop that brings repeat work round again
  B['maintenance-reminders'] = ['L', function (c, W, H, p, t) {
    var x0 = W * .14, x1 = W * .86, y0 = H * .24, y1 = H * .74, r = 40, T = (t * .1) % 1, ST = [[.0, 'Job finished', x0, y0], [.25, 'A year goes by', x1, y0], [.5, 'Reminder goes out', x1, y1], [.75, 'Visit booked', x0, y1]], per = 2 * (x1 - x0) + 2 * (y1 - y0);
    function at(u) { var d = (u % 1) * per, w = x1 - x0, hh = y1 - y0; if (d < w) return [x0 + d, y0]; d -= w; if (d < hh) return [x1, y0 + d]; d -= hh; if (d < w) return [x1 - d, y1]; return [x0, y1 - (d - w)] }
    c.setLineDash([2, 6]); h.card(c, x0, y0, x1 - x0, y1 - y0, r, ink(.3)); c.setLineDash([]);
    for (var i = 0; i < 26; i++) { var q = at(T - i * .006); c.fillStyle = ink(1 - i / 26); c.fillRect(q[0] - 2, q[1] - 2, 4, 4) } var hd = at(T); c.fillStyle = RED; c.fillRect(hd[0] - 5, hd[1] - 5, 10, 10);
    ST.forEach(function (s, i) { var d = ((T - s[0]) % 1 + 1) % 1, on = d < .22; pill(c, s[2], s[3], s[1], { dot: on ? RED : ink(.4), stroke: ink(on ? .9 : .28), fill: '#050506', w: on ? '600' : '500', s: 13.5, h: 34 }) });
    txt(c, 'Visit ' + (2 + Math.floor(t * .1)), W / 2, H * .47, ink(.95), 'center', F('600', 26)); txt(c, 'same customer', W / 2, H * .47 + 26, ink(.45), 'center', F('500', 12, 1))
  }];
  // 16 referrals: one happy customer, asked, becomes a street
  B['referrals'] = ['S', function (c, W, H, p, t) {
    var root = [W * .14, H * .5], L1 = [[W * .42, H * .2], [W * .42, H * .5], [W * .42, H * .8]], L2 = [[W * .72, H * .12], [W * .72, H * .34], [W * .72, H * .68], [W * .72, H * .9]], par = [0, 0, 2, 2];
    L1.forEach(function (q, i) { var k = ez(p * 2.6 - .3 - i * .25), P = S(root[0] + 70, root[1], q[0] - 46, q[1]); curve(c, P, 0, k, ink(.4)); if (k >= 1) { pulse(c, P, (t * .3 + i * .3) % 1.4); pill(c, q[0], q[1], 'Neighbor', { dot: ink(.95), s: 13, h: 32 }) } });
    L2.forEach(function (q, i) { var k = ez(p * 2.6 - 1.3 - i * .18), a = L1[par[i]], P = S(a[0] + 50, a[1], q[0] - 40, q[1]); curve(c, P, 0, k, ink(.3)); if (k >= 1) pill(c, q[0], q[1], i % 2 ? 'Quoted' : 'Booked', { dot: i % 2 ? ink(.5) : RED, s: 12.5, h: 30 }) });
    card(c, root[0] - 70, root[1] - 40, 140, 80, 14, ink(.6), '#0b0b0d'); txt(c, 'Happy customer', root[0], root[1] - 12, ink(.95), 'center', F('600', 13.5)); for (var i = 0; i < 5; i++)star(c, root[0] - 32 + i * 16, root[1] + 14, 6, ink(.95)); txt(c, 'Asked right after the review', root[0] - 70, root[1] + 62, ink(.5), 'left', F('500', 11, 1))
  }];
  // 17 campaigns: the right message to the right part of your own list
  B['campaigns'] = ['S', function (c, W, H, p, t) {
    var x0 = W * .06, lw = W * .4, rh = H * .066, y0 = H * .16, TAG = ['Fence', 'Deck', 'Stain', 'Gate'], k = ez(p * 2.2 - .5), k2 = ez(p * 2.2 - 1.1), n = 0;
    txt(c, 'Your customers', x0, H * .08, ink(.6), 'left', F('500', 12, 1)); pill(c, x0 + lw, H * .08, 'Stained 2+ years ago', { al: 'r', dot: RED, a: k, s: 12 });
    for (var i = 0; i < 11; i++) { var y = y0 + i * rh, tg = (i * 7 + 2) % 4, hit = tg === 2 || i === 4 || i === 9; card(c, x0, y, lw, rh - 6, 7, hit && k > 0 ? ink(.3 + .6 * k) : ink(.12), hit && k > .5 ? '#121215' : '#0a0a0c'); bars(c, x0 + 12, y + rh / 2 - 5, lw * .34, 1, hit ? .9 : .4 * (1 - k * .5) + .1); txt(c, TAG[tg], x0 + lw - 12, y + rh / 2 - 3, ink(hit ? .8 : .3), 'right', F('500', 11, 1));
      if (hit && k2 > 0) { var P = S(W * .58, H * .4, x0 + lw + 4, y + rh / 2 - 3); curve(c, P, 1 - k2, 1, ink(.3)); if (k2 >= 1) pulse(c, P, (t * .3 + i * .13) % 1.3, n % 3 ? null : RED); n++ } }
    var mx = W * .58, mw = W * .36; c.globalAlpha = ez(p * 2.2 - .2); card(c, mx, H * .26, mw, H * .3, 14, ink(.5), '#0b0b0d'); txt(c, 'Message', mx + 16, H * .31, ink(.5), 'left', F('500', 11.5, 1)); wrap(c, 'Time to restain? We have openings the week of the 14th.', F('500', 15), mw - 32).forEach(function (s, j) { txt(c, s, mx + 16, H * .385 + j * 22, ink(.95), 'left', F('500', 15)) }); c.globalAlpha = 1;
    if (k2 > .9) { pill(c, mx, H * .68, 'Sent to 5', { al: 'l', s: 12.5 }); pill(c, mx + 110, H * .68, '2 replied', { al: 'l', dot: RED, s: 12.5 }) } txt(c, 'No ad platform involved', mx, H * .82, ink(.45), 'left', F('500', 11.5, 1))
  }];
  // 18 local search: your profile, kept current
  B['local-search'] = ['S', function (c, W, H, p, t) {
    var cw = Math.min(W * .5, 430), cx = (W - cw) / 2, cy = H * .06, ch = H * .88, R = [['Hours and services', 'Correct'], ['Weekly post', 'This week'], ['New photos', '6 added'], ['Questions', 'All answered']];
    card(c, cx, cy, cw, ch, 16, ink(.45), '#0b0b0d'); txt(c, 'Your business', cx + 20, cy + 30, ink(1), 'left', F('600', 18)); for (var i = 0; i < 5; i++)star(c, cx + 28 + i * 19, cy + 58, 7, ink(.95)); txt(c, 'Google profile', cx + cw - 20, cy + 30, ink(.4), 'right', F('500', 11.5, 1));
    for (i = 0; i < 6; i++) { var k = ez(p * 2.4 - .3 - i * .12), tw = (cw - 40 - 5 * 8) / 6; c.globalAlpha = k; card(c, cx + 20 + i * (tw + 8), cy + 82 + (1 - k) * 10, tw, tw * .8, 6, ink(.22), 'rgba(255,255,255,' + (.04 + rnd(i) * .08) + ')'); c.globalAlpha = 1 }
    R.forEach(function (r, i) { var y = cy + ch * .5 + i * ch * .115, k = ez(p * 2.4 - .9 - i * .22); line(c, cx + 20, px(y - ch * .055), cx + cw - 20, px(y - ch * .055), ink(.1)); txt(c, r[0], cx + 20, y, ink(.9), 'left', F('500', 14)); if (k > 0) { c.globalAlpha = k; txt(c, r[1], cx + cw - 44, y, ink(.6), 'right', F('500', 12, 1)); card(c, cx + cw - 36, y - 8, 16, 16, 5, null, i === 1 ? RED : ink(.95)); c.globalAlpha = 1 } });
    [['Posts from real jobs', .3], ['Answered without you logging in', .62]].forEach(function (q, i) { if (W < 700) return; var y = cy + ch * q[1], left = i === 0, x = left ? cx : cx + cw, k = ez(p * 2.4 - 1 - i * .4), ex = x + (left ? -1 : 1) * W * .05 * k; line(c, x, px(y), ex, px(y), ink(.4)); c.globalAlpha = k; wrap(c, q[0], F('500', 13), W * .17).forEach(function (s, j) { txt(c, s, ex + (left ? -10 : 10), y + j * 18, ink(.9), left ? 'right' : 'left', F('500', 13)) }); c.globalAlpha = 1 })
  }];
  // 19 job photos to posts: one photo from the crew, three places it shows up
  B['job-photos'] = ['S', function (c, W, H, p, t) {
    var px0 = W * .07, pw = W * .32, py = H * .16, ph = H * .62, k = ez(p * 2.2), D = ['Google profile', 'Your site', 'Facebook and Instagram'];
    card(c, px0, py, pw, ph, 12, ink(.5), '#0a0a0c'); for (var i = 0; i < 9; i++) { var x = px0 + pw * (.1 + i * .1), hh = ph * (.34 + .06 * Math.sin(i * 1.3)) * cl(k * 9 - i); line(c, px(x), py + ph * .78, px(x), py + ph * .78 - hh, ink(.85), 3) } line(c, px0 + pw * .06, px(py + ph * .52), px0 + pw * .06 + pw * .88 * k, px(py + ph * .52), ink(.6), 2); line(c, px0 + pw * .06, px(py + ph * .68), px0 + pw * .06 + pw * .88 * k, px(py + ph * .68), ink(.6), 2);
    [[0, 0, 1, 1], [1, 0, -1, 1], [0, 1, 1, -1], [1, 1, -1, -1]].forEach(function (q) { var x = px0 + pw * q[0] + q[2] * 12, y = py + ph * q[1] + q[3] * 12; line(c, x, y, x + q[2] * 16, y, RED, 1.5); line(c, x, y, x, y + q[3] * 16, RED, 1.5) }); txt(c, 'From the crew, at the job', px0, py + ph + 24, ink(.5), 'left', F('500', 11.5, 1));
    D.forEach(function (s, i) { var a = ez(p * 2.2 - .8 - i * .3), x = W * .56, y = H * (.14 + i * .27), w = W * .38, hh = H * .21, P = S(px0 + pw, py + ph / 2, x, y + hh / 2); curve(c, P, 0, cl(a * 2), ink(.3)); if (a <= 0) return; c.globalAlpha = a; card(c, x, y, w, hh, 12, ink(.3), '#0b0b0d'); card(c, x + 12, y + 12, hh - 24, hh - 24, 6, ink(.3), 'rgba(255,255,255,.07)'); txt(c, s, x + hh + 4, y + 24, ink(.95), 'left', F('600', 13.5)); bars(c, x + hh + 4, y + 44, (w - hh - 24) * cl(a * 2 - .6), 2, .8); c.globalAlpha = 1 })
  }];
  // 20 hiring: applicants sorted before you pick up the phone
  B['hiring'] = ['L', function (c, W, H, p, t) {
    var COL = ['Applied', 'Screened', 'Call booked', 'Hired'], cw = W * .2, x0 = W * .06, gap = W * .027, T = (t * .1) % 1.3, END = [3, 1, 2, 1, 3, 2, 1], cnt = [0, 0, 0, 0], slot = [0, 0, 0, 0];
    COL.forEach(function (s, i) { var x = x0 + i * (cw + gap); card(c, x, H * .16, cw, H * .74, 12, ink(.14), '#08080a'); txt(c, s, x + 14, H * .1, ink(i === 3 ? 1 : .7), 'left', F('600', 13.5)) });
    END.forEach(function (e, n) { var prog = cl(T * 4 - n * .12), col = Math.min(e, prog * 3), ci = Math.floor(col), f = ez(col - ci), stop = col >= e, xa = x0 + ci * (cw + gap) + 10, xb = x0 + Math.min(3, ci + 1) * (cw + gap) + 10, x = lerp(xa, xb, f), si = stop ? e : ci, y = H * .2 + slot[si] * H * .105; slot[si]++; if (stop) cnt[e]++;
      var no = stop && e === 1; card(c, x, y, cw - 20, H * .085, 8, no ? ink(.14) : e === 3 && stop ? null : ink(.35), e === 3 && stop ? ink(.95) : '#0d0d0f'); c.fillStyle = e === 3 && stop ? '#0a0a0c' : ink(no ? .25 : .8); c.fillRect(Math.round(x + 10), Math.round(y + H * .0425 - 3), 6, 6); bars(c, x + 24, y + H * .0425 - 2, cw * .36, 1, no ? .25 : e === 3 && stop ? 0 : .8); if (no) txt(c, 'Not a fit', x + cw - 30, y + H * .0425, ink(.35), 'right', F('500', 10.5, 1)) });
    COL.forEach(function (s, i) { txt(c, String(i === 0 ? 7 : cnt[i] + (i < 3 ? 0 : 0)), x0 + i * (cw + gap) + cw - 14, H * .1, i === 3 ? RED : ink(.4), 'right', F('500', 12, 1)) })
  }];
  // 21 team assistant: a question from the job site, answered from your own playbook
  B['team-assistant'] = ['L', function (c, W, H, p, t) {
    var T = (t * .085) % 1.2, SRC = ['Price book', 'Procedures', 'Past jobs'], qx = W * .06, sx = W * .42, ax = W * .94, Q = 'What is our warranty on gates?', A = 'Two years on hardware, one year on labor.';
    txt(c, 'From the crew', qx, H * .14, ink(.5), 'left', F('500', 11.5, 1)); bubble(c, qx, H * .2, W * .3, Q, 0, T * 5, F('400', 14.5));
    SRC.forEach(function (s, i) { var y = H * (.26 + i * .22), hit = i === 1, k = ez((T - .22 - i * .05) * 6), P = S(qx + W * .28, H * .28, sx, y); curve(c, P, 0, k, ink(.3)); c.globalAlpha = .4 + .6 * k; card(c, sx, y - 26, W * .2, 52, 10, hit && T > .45 ? RED : ink(.3), hit && T > .45 ? 'rgba(224,25,58,.07)' : '#0b0b0d'); txt(c, s, sx + 14, y - 6, ink(.95), 'left', F('600', 13.5)); bars(c, sx + 14, y + 10, W * .12, 1, .5); c.globalAlpha = 1; if (hit && T > .5) { var P2 = S(sx + W * .2, y, ax - W * .28, H * .62); curve(c, P2, 0, ez((T - .5) * 6), red(.7)) } });
    if (T > .62) { txt(c, 'Answer', ax, H * .5, ink(.5), 'right', F('500', 11.5, 1)); var hgt = bubble(c, ax, H * .56, W * .3, A, 1, (T - .62) * 4, F('400', 14.5)); if (T > .9) pill(c, ax, H * .56 + hgt + 24, 'Source: Procedures', { al: 'r', dot: RED, s: 12 }) }
  }];
  // 22 field notes: a minute of talking becomes the job record
  B['field-notes'] = ['S', function (c, W, H, p, t) {
    var mx = W * .22, my = H * .5, k = ez(p * 2), SEC = [['Notes', 3], ['Materials', 2], ['Next steps', 2]], nx = W * .52, nw = W * .42, y = H * .12;
    for (var i = 0; i < 3; i++) { var r = 34 + i * 26 + ((t * 18) % 26); c.beginPath(); c.arc(mx, my, r, 0, 6.2832); c.strokeStyle = ink(.3 * (1 - (r - 34) / 80)); c.lineWidth = 1; c.stroke() } card(c, mx - 22, my - 34, 44, 68, 22, null, ink(.95)); line(c, mx, my + 34, mx, my + 54, ink(.9), 2); line(c, mx - 16, my + 54, mx + 16, my + 54, ink(.9), 2);
    for (i = 0; i < 28; i++) { var x = mx - 110 + i * 8, hh = (6 + 34 * Math.abs(Math.sin(i * .9 + t * 6)) * rnd(i)) * (1 - k * .7); if (Math.abs(x - mx) < 34) continue; c.fillStyle = ink(.5); c.fillRect(x, my + 86 - hh / 2, 3, hh) } txt(c, '0:' + ('0' + Math.round(58 * cl(p * 2.5))).slice(-2), mx, my + 128, ink(.6), 'center', F('500', 12.5, 1));
    curve(c, S(mx + 60, my, nx, my), 0, k, ink(.3)); card(c, nx, y, nw, H * .78, 14, ink(.4), '#0b0b0d'); txt(c, 'Job record', nx + 18, y + 26, ink(.95), 'left', F('600', 15)); var yy = y + 58, n = 0;
    SEC.forEach(function (s, i) { var a = ez(p * 2.4 - .7 - i * .35); c.globalAlpha = a; txt(c, s[0], nx + 18, yy, i === 2 ? RED : ink(.5), 'left', F('500', 11.5, 1)); yy += 20; for (var j = 0; j < s[1]; j++, n++) { c.fillStyle = ink(.8); c.fillRect(Math.round(nx + 18), Math.round(yy), 5, 5); c.fillStyle = ink(.4); c.fillRect(Math.round(nx + 32), Math.round(yy), Math.round((nw - 60) * (.5 + rnd(n) * .45) * cl(a * 2 - j * .3)), 5); yy += 20 } yy += 14; c.globalAlpha = 1 })
  }];
  // 23 reports: one page, every Monday
  B['reports'] = ['S', function (c, W, H, p, t) {
    var sw = Math.min(W * .8, 760), sx = (W - sw) / 2, sy = H * .06, sh = H * .88, T = [['Leads in', '23'], ['Jobs booked', '14'], ['Quotes open', '6'], ['Invoices owed', '3']], tw = (sw - 40 - 36) / 4;
    card(c, sx, sy, sw, sh, 14, ink(.4), '#0b0b0d'); txt(c, 'Monday report', sx + 20, sy + 28, ink(1), 'left', F('600', 16)); txt(c, 'Sample week', sx + sw - 20, sy + 28, ink(.4), 'right', F('500', 11.5, 1)); line(c, sx, px(sy + 50), sx + sw, px(sy + 50), ink(.14));
    T.forEach(function (q, i) { var x = sx + 20 + i * (tw + 12), y = sy + 68, k = ez(p * 2.4 - .2 - i * .2), th = sh * .36; card(c, x, y, tw, th, 10, ink(.2), '#0e0e11'); txt(c, q[0], x + 12, y + 20, ink(.55), 'left', F('500', 11.5, 1)); txt(c, String(Math.round(+q[1] * k)), x + 12, y + 52, i === 3 ? RED : ink(1), 'left', F('600', 28));
      c.beginPath(); for (var j = 0; j <= 20 * k; j++) { var X = x + 12 + j / 20 * (tw - 24), Y = y + th - 16 - (.2 + .7 * rnd(i * 9 + j) * (.4 + j / 34)) * th * .3; j ? c.lineTo(X, Y) : c.moveTo(X, Y) } c.strokeStyle = i === 3 ? RED : ink(.8); c.lineWidth = 1.25; c.stroke() });
    var ly = sy + 68 + sh * .36 + 34; txt(c, 'Needs you', sx + 20, ly, ink(.5), 'left', F('500', 11.5, 1)); ['Quote 1038 has had no answer for 9 days', 'Invoice 1027 is 16 days old'].forEach(function (s, i) { var k = ez(p * 2.4 - 1.3 - i * .3), y = ly + 28 + i * 34; c.globalAlpha = k; c.fillStyle = RED; c.fillRect(Math.round(sx + 20), Math.round(y - 3), 6, 6); txt(c, s, sx + 38, y, ink(.92), 'left', F('500', 14)); c.globalAlpha = 1 })
  }];
  // 24 call review: every call read, the moment that lost the job flagged
  B['call-review'] = ['S', function (c, W, H, p, t) {
    var x0 = W * .06, tw = W * .54, y = H * .2, L = [[0, .7], [1, .9], [0, .5], [1, .8, 1], [0, .6], [1, .4]], scan = ez(p * 1.3), sx = W * .66, sw = W * .29;
    line(c, x0, px(H * .1), x0 + tw, px(H * .1), ink(.2), 3); line(c, x0, px(H * .1), x0 + tw * scan, px(H * .1), ink(.9), 3); c.fillStyle = RED; c.fillRect(x0 + tw * .62 - 3, H * .1 - 8, 6, 16); txt(c, '4:12', x0 + tw, H * .1 - 16, ink(.45), 'right', F('500', 11, 1));
    L.forEach(function (r, i) { var k = ez(scan * 7.5 - i), yy = y + i * H * .11, flag = r[2] && scan > .6, w = tw * .78 * r[1]; if (k <= 0) return; c.globalAlpha = k; txt(c, r[0] ? 'Caller' : 'Office', x0, yy, ink(.45), 'left', F('500', 11, 1)); card(c, x0 + 64, yy - 13, w, 26, 8, flag ? RED : ink(.16), flag ? 'rgba(224,25,58,.1)' : '#0d0d0f'); if (flag) txt(c, '“What would something like that cost?”', x0 + 76, yy + .5, ink(.95), 'left', F('500', Math.min(13, w / 24))); else bars(c, x0 + 76, yy - 2, w - 28, 1, .6); c.globalAlpha = 1; if (flag) { line(c, x0 + 64 + w, px(yy), sx, px(yy), red(.6)) } });
    var a = ez(p * 2 - 1); c.globalAlpha = a; card(c, sx, H * .34, sw, H * .46, 14, RED, 'rgba(224,25,58,.05)'); txt(c, 'Lost here', sx + 16, H * .4, RED, 'left', F('600', 14.5)); [['Asked', 'A price'], ['Got', 'No range, a callback'], ['Result', 'No booking']].forEach(function (q, i) { var yy = H * (.49 + i * .09); txt(c, q[0], sx + 16, yy, ink(.45), 'left', F('500', 11.5, 1)); txt(c, q[1], sx + 76, yy, ink(.92), 'left', F('500', 13)) }); c.globalAlpha = 1
  }];
  // 25 custom agents: one job, done the way you do it, inside limits you set
  B['custom-agents'] = ['L', function (c, W, H, p, t) {
    var N = ['Trigger', 'Read', 'Decide', 'Act', 'Log'], y = H * .3, x0 = W * .1, x1 = W * .9, X = function (i) { return lerp(x0, x1, i / 4) }, T = (t * .14) % 1, at = T * 4.6, TOOL = [['Inbox', 1], ['Calendar', 3], ['Job software', 3]], ask = Math.floor(t * .14) % 2 === 1;
    line(c, x0, px(y), x1, px(y), ink(.2)); for (var i = 0; i < 14; i++) { var u = at - i * .05; if (u < 0 || u > 4) continue; if (ask && u > 3) continue; c.fillStyle = ink(1 - i / 14); c.fillRect(lerp(x0, x1, u / 4) - 2, y - 2, 4, 4) }
    N.forEach(function (s, i) { var on = Math.abs(at - i) < .5 && !(ask && i > 2 && at > 2.6); pill(c, X(i), y, s, { stroke: on ? ink(.95) : ink(.3), fill: on ? ink(.95) : '#050506', col: on ? '#0a0a0c' : ink(.9), w: '600', s: 13.5, h: 36 }) });
    TOOL.forEach(function (q, i) { var x = lerp(x0, x1, .2 + i * .3), yy = H * .74, on = Math.abs(at - q[1]) < .6 && !(ask && q[1] === 3); c.setLineDash([2, 5]); line(c, px(X(q[1]) + (i - 1) * 16), y + 20, px(x), yy - 18, on ? ink(.9) : ink(.25)); c.setLineDash([]); pill(c, x, yy, q[0], { dot: on ? ink(1) : ink(.3), s: 12.5, stroke: ink(on ? .7 : .2) }) });
    var gx = X(2.5), gy = y - H * .2; line(c, px(gx), y - 8, px(gx), gy + 16, ask && at > 2.4 ? RED : ink(.25)); pill(c, gx, gy, ask && at > 2.4 ? 'Asks you first' : 'Needs you? No', { dot: ask && at > 2.4 ? RED : ink(.4), s: 12.5, stroke: ask && at > 2.4 ? RED : ink(.28) });
    txt(c, ask ? 'Run 2: over your limit, so it stops and asks' : 'Run 1: inside your limits, so it finishes', W / 2, H * .92, ink(.5), 'center', F('500', 12, 1))
  }];
  // 26 custom builds: your process, as you describe it, turned into parts
  B['custom-builds'] = ['S', function (c, W, H, p, t) {
    var ST = ['Supplier emails a quote', 'Compare it to the last one', 'Order if it is under budget', 'Tell the crew the delivery day', 'Something only you do'], lx = W * .06, lw = W * .36, rx = W * .58, rh = H * .13, y0 = H * .14;
    txt(c, 'How you do it today', lx, H * .07, ink(.5), 'left', F('500', 11.5, 1)); txt(c, 'Built', rx, H * .07, ink(.95), 'left', F('500', 11.5, 1));
    ST.forEach(function (s, i) { var y = y0 + i * (rh + H * .03), k = i === 4 ? 0 : ez(p * 2.6 - .4 - i * .4); c.setLineDash([4, 5]); card(c, lx, y, lw, rh, 10, ink(.3 * (1 - k * .5) + .1)); c.setLineDash([]); txt(c, s, lx + 16, y + rh / 2, ink(.75 - .3 * k), 'left', F('500', 13.5));
      if (i === 4) { c.setLineDash([4, 5]); card(c, rx, y, lw, rh, 10, red(.5 + .4 * Math.sin(t * 2))); c.setLineDash([]); txt(c, '+', rx + 18, y + rh / 2, RED, 'left', F('500', 20)); txt(c, 'Yours next', rx + 40, y + rh / 2, ink(.6), 'left', F('500', 13.5)); return }
      if (k <= 0) return; var P = S(lx + lw, y + rh / 2, rx, y + rh / 2); curve(c, P, 0, cl(k * 2), ink(.4)); if (k >= 1) pulse(c, P, (t * .35 + i * .2) % 1.4); c.globalAlpha = cl(k * 2 - .8); card(c, rx + (1 - k) * 30, y, lw, rh, 10, ink(.9), '#101013'); c.fillStyle = ink(.95); c.fillRect(Math.round(rx + 16 + (1 - k) * 30), Math.round(y + rh / 2 - 3), 6, 6); txt(c, ['Reads the quote', 'Checks it against history', 'Places the order', 'Texts the crew'][i], rx + 34 + (1 - k) * 30, y + rh / 2, ink(.95), 'left', F('600', 13.5)); c.globalAlpha = 1; if (i < 3 && k >= 1) line(c, px(rx + 19), y + rh, px(rx + 19), y + rh + H * .03, ink(.5)) })
  }];
  // Software page: the same app on the phone and the desk, what needs you on top, the source on every lead, everything logged
  B['software-truck'] = ['L', function (c, W, H, p, t) {
    var T = (t * .11) % 1, k = ez(T * 5), done = ez((T - .55) * 5), px0 = W * .07, py = H * .1, pw = W * .27, ph = H * .56, dx = W * .43, dy = H * .13, dw = W * .5, dh = H * .43, SRC = ['Google', 'Web form', 'Call', 'Referral', 'Angi'], NAME = [.62, .5, .7, .44, .56];
    function screen(x, y, w, h, wide) {
      var rh = (h - 44) / 5.4, n = 0; txt(c, 'Needs you', x + 14, y + 22, ink(.95), 'left', F('600', 12.5)); txt(c, String(done > .5 ? 2 : 3), x + w - 14, y + 22, RED, 'right', F('600', 12.5)); line(c, x, px(y + 36), x + w, px(y + 36), ink(.14));
      for (var i = 0; i < 5; i++) { var isNew = i === 0, hot = i < 3 && !(i === 2 && done > .5), a = isNew ? k : 1, yy = y + 44 + i * rh + (isNew ? (1 - k) * -10 : 0), dim = i === 2 ? 1 - done * .6 : 1; if (a <= 0) continue; c.globalAlpha = a * (hot ? 1 : .45) * (i === 2 ? dim : 1);
        card(c, x + 8, yy, w - 16, rh - 6, 7, hot ? ink(isNew ? .95 : .4) : ink(.14), hot ? '#141417' : '#0b0b0d'); c.fillStyle = hot ? (isNew ? RED : ink(.9)) : ink(.4); c.fillRect(Math.round(x + 18), Math.round(yy + (rh - 6) / 2 - 3), 6, 6); bars(c, x + 32, yy + (rh - 6) / 2 - 2, (w - 60) * NAME[i] * (wide ? .5 : .8), 1, hot ? .9 : .5);
        if (wide) txt(c, SRC[i], x + w - 20, yy + (rh - 6) / 2, ink(hot ? .7 : .4), 'right', F('500', 10.5, 1)); c.globalAlpha = 1; n++ }
    }
    card(c, px0, py, pw, ph, 22, ink(.5), '#070708'); card(c, px0 + pw / 2 - 18, py + 8, 36, 5, 3, null, ink(.25)); screen(px0 + 4, py + 16, pw - 8, ph - 24, false);
    card(c, dx, dy, dw, dh, 12, ink(.5), '#070708'); screen(dx + 4, dy + 4, dw - 8, dh - 8, true); line(c, dx + dw * .42, dy + dh, dx + dw * .38, dy + dh + H * .05, ink(.4)); line(c, dx + dw * .58, dy + dh, dx + dw * .62, dy + dh + H * .05, ink(.4)); line(c, dx + dw * .3, px(dy + dh + H * .05), dx + dw * .7, px(dy + dh + H * .05), ink(.5));
    var P = S(px0 + pw, py + H * .14, dx, dy + H * .1); curve(c, P, 0, 1, ink(.3)); pulse(c, P, (T * 5) % 1.2, RED); pulse(c, P, 1 - ((T * 5 + .5) % 1.2));
    txt(c, 'In the truck', px0, py + ph + 22, ink(.5), 'left', F('500', 11.5, 1)); txt(c, 'At the desk', dx, dy + dh + H * .05 + 22, ink(.5), 'left', F('500', 11.5, 1)); txt(c, 'Same app, same numbers', (px0 + pw + dx) / 2, py - 14, ink(.6), 'center', F('500', 11.5, 1));
    if (W > 700) { line(c, dx + dw - 30, dy - 6, dx + dw - 30, dy - 22, ink(.4)); txt(c, 'Where each lead came from', dx + dw - 30, dy - 32, ink(.6), 'right', F('500', 11.5, 1)) }
    var ly = H * .86, lx0 = W * .07, lx1 = W * .93, EV = ['Reply sent', 'Estimate booked', 'Follow-up sent', 'Review asked'], np = Math.floor(t * .11); txt(c, 'Went out without you today', lx0, ly - 30, ink(.95), 'left', F('600', 13)); line(c, lx0, px(ly), lx1, px(ly), ink(.25));
    for (var j = 0; j < 4; j++) { var on = j < 3 || done > .5, x = lerp(lx0, lx1, (j + .5) / 4), a2 = j === 3 ? done : 1; c.globalAlpha = on ? a2 : 0; card(c, x - 5, ly - 5, 10, 10, 3, null, j === 3 ? RED : ink(.95)); txt(c, EV[(j + np) % 4], x, ly + 24, ink(.85), 'center', F('500', 12)); c.globalAlpha = 1 }
  }];
  // ---- mount: a virtual canvas 960 wide (620 on phones) so every drawing keeps its proportions
  [].forEach.call(document.querySelectorAll('[data-build]'), function (host) {
    var d = B[host.dataset.build]; if (!d) return; var mode = d[0], draw = d[1], cv = document.createElement('canvas'), c = cv.getContext('2d'), W = 1, H = 1, sc = 1, vis = false, raf = 0, sp = 0, s = 0, tIn = 0, last = performance.now(), m = { x: 0, y: 0, on: false }; cv.setAttribute('aria-hidden', 'true'); host.appendChild(cv);
    function size() { var r = host.getBoundingClientRect(), dp = Math.min(devicePixelRatio || 1, 2), nw = r.width < 620, VW = nw ? 620 : 960; sc = r.width / VW; W = VW; H = Math.max(1, r.height / sc); cv.width = Math.max(1, r.width * dp); cv.height = Math.max(1, r.height * dp); c.setTransform(dp * sc, 0, 0, dp * sc, 0, 0); host._z = nw ? 1.28 : 1; kick() }
    function prog() { var q = host.getBoundingClientRect(); sp = cl((innerHeight * .92 - q.top) / (innerHeight * .78)); kick() }
    function frame(now) { raf = 0; var dt = Math.min(.05, (now - last) / 1000); last = now; if (vis && !tIn) tIn = now; var intro = tIn ? ez((now - tIn) / 2400) : 0, p = mode === 'S' ? cl(sp * .62 + intro * .5) : intro; s += (p - s) * Math.min(1, dt * 8); h.setZ(host._z || 1); c.clearRect(0, 0, W, H); c.globalAlpha = 1; draw(c, W, H, s, tIn ? (now - tIn) / 1000 : 0, m); h.setZ(1); if (vis) raf = requestAnimationFrame(frame) }
    function kick() { if (!raf) raf = requestAnimationFrame(frame) }
    host.addEventListener('pointermove', function (e) { var r = host.getBoundingClientRect(); m.x = (e.clientX - r.left) / sc; m.y = (e.clientY - r.top) / sc; m.on = true }); host.addEventListener('pointerleave', function () { m.on = false });
    new ResizeObserver(size).observe(host); new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) { last = performance.now(); kick() } }).observe(host);
    addEventListener('scroll', prog, { passive: true }); addEventListener('resize', prog); if (document.fonts && document.fonts.ready) document.fonts.ready.then(kick); size(); prog()
  })
})();
