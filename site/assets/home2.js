// Homepage, second pass. Three small pieces: the problem picker in the hero, the job told as a stack, the switchboard.
(function () {
  var N = { answering: 'Answering', 'phone-agent': 'Phone agent', 'website-chat': 'Website chat', 'social-messages': 'Messages and DMs', 'lead-vetting': 'Lead vetting', 'after-hours': 'After hours', booking: 'Booking', reminders: 'Reminders', dispatch: 'Scheduling and dispatch', 'job-updates': 'Job updates', estimates: 'Estimates', proposals: 'Proposals', 'follow-up': 'Follow-up', invoicing: 'Invoices', bookkeeping: 'Bookkeeping prep', reviews: 'Reviews', 'review-replies': 'Review replies', 'win-backs': 'Win-backs', 'maintenance-reminders': 'Service reminders', referrals: 'Referrals', campaigns: 'Email and text campaigns', websites: 'Websites', 'local-search': 'Local search', 'job-photos': 'Job photos to posts', hiring: 'Hiring', 'team-assistant': 'Team assistant', 'field-notes': 'Field notes', reports: 'Reports', 'call-review': 'Call review', integrations: 'Tool connections', 'custom-agents': 'Custom agents', 'custom-builds': 'Custom builds' };
  var rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ---- what we fix: diagrams driven by the scroll inside a pinned section. Two are drawn here, the rest come from the build drawings.
  var KB = window.CinderBuilds, DR = {};
  if (KB) (function () {
    var h = KB.h, cl = h.cl, ez = h.ez, lerp = h.lerp, ink = h.ink, px = h.px, F = h.F, line = h.line, card = h.card, txt = h.txt, curve = h.curve, S = h.S, pulse = h.pulse, pill = h.pill, bubble = h.bubble, bars = h.bars, RED = h.RED;
    // a quote chased: four sheets land on top of each other
    DR.stack = function (c, W, H, p, t) {
      var cx = W * .44, cy = H * .7, a = Math.min(W * .21, 210), b = a * .64, ux = .866, uy = .5, gap = Math.min(H * .15, 78), L = [['Quote sent', 'Day 0'], ['Check-in', 'Day 2'], ['Check-in', 'Day 5'], ['Signed', 'Day 5, 4:10 PM']], n = 0;
      function P(x, y, lift) { return [cx + (x - y) * ux, cy - lift + (x + y) * uy] }
      c.strokeStyle = ink(.12); c.lineWidth = 1; for (var g = -3; g <= 3; g++) { var q0 = P(g * a / 2.2, -b * 1.6, 0), q1 = P(g * a / 2.2, b * 1.6, 0); c.beginPath(); c.moveTo(q0[0], q0[1]); c.lineTo(q1[0], q1[1]); c.stroke(); q0 = P(-a * 1.5, g * b / 2, 0); q1 = P(a * 1.5, g * b / 2, 0); c.beginPath(); c.moveTo(q0[0], q0[1]); c.lineTo(q1[0], q1[1]); c.stroke() }
      for (var i = 0; i < 4; i++) {
        var e = ez(p * 4.25 - i * 1.02); if (e <= 0) continue; if (e >= 1) n++; var lift = i * gap + (1 - e) * H * .55, top = i === 3, A = P(-a, -b, lift), B = P(a, -b, lift), C = P(a, b, lift), D = P(-a, b, lift), th = 9;
        c.globalAlpha = e; c.fillStyle = '#08080a'; c.strokeStyle = ink(.45); c.beginPath(); c.moveTo(D[0], D[1]); c.lineTo(C[0], C[1]); c.lineTo(B[0], B[1]); c.lineTo(B[0], B[1] + th); c.lineTo(C[0], C[1] + th); c.lineTo(D[0], D[1] + th); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(C[0], C[1]); c.lineTo(C[0], C[1] + th); c.stroke();
        c.fillStyle = top ? '#f2f1ee' : '#111114'; c.strokeStyle = ink(top ? 1 : .7); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(C[0], C[1]); c.lineTo(D[0], D[1]); c.closePath(); c.fill(); c.stroke();
        c.save(); c.transform(ux, uy, -ux, uy, cx, cy - lift); var fg = top ? 'rgba(10,10,12,' : 'rgba(242,241,238,'; txt(c, L[i][0], -a + 22, -b + 32, fg + '.95)', 'left', F('600', 21)); txt(c, L[i][1], a - 22, -b + 32, fg + '.5)', 'right', F('500', 12, 1));
        c.fillStyle = fg + '.14)'; c.fillRect(-a + 22, -b + 52, a * 2 - 44, 1); for (var r = 0; r < 3; r++) { c.fillStyle = fg + (r ? '.3)' : '.6)'); c.fillRect(-a + 22, -b + 74 + r * 22, (a * 2 - 44) * [.72, .5, .6][r], 6) }
        if (top) { c.strokeStyle = RED; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-a + 26, b - 26); c.bezierCurveTo(-a + 60, b - 62, -a + 74, b - 2, -a + 104, b - 34); c.bezierCurveTo(-a + 120, b - 50, -a + 136, b - 20, -a + 170, b - 30); c.stroke(); c.fillStyle = RED; c.fillRect(a - 40, b - 38, 16, 16) } else { c.fillStyle = fg + '.9)'; c.fillRect(a - 34, b - 32, 10, 10) }
        c.restore(); c.globalAlpha = 1;
        if (e >= .98) { var k = cl((p * 4.25 - i * 1.02 - 1) * 3), lx = W * .76; line(c, B[0] + 8, px(B[1]), lerp(B[0] + 8, lx - 12, k), px(B[1]), ink(.4)); c.globalAlpha = k; c.fillStyle = top ? RED : ink(.95); c.fillRect(Math.round(lx - 4), Math.round(B[1] - 4), 8, 8); txt(c, L[i][0], lx + 14, B[1] - 8, ink(.95), 'left', F('600', 15)); txt(c, L[i][1], lx + 14, B[1] + 12, ink(.5), 'left', F('500', 11.5, 1)); c.globalAlpha = 1 }
      }
      txt(c, n + ' of 4', W * .06, H * .14, ink(.95), 'left', F('600', 26)); txt(c, n === 4 ? 'Answered. Follow-up stops.' : 'Still open. Follow-up continues.', W * .06, H * .14 + 26, n === 4 ? RED : ink(.5), 'left', F('500', 12, 1))
    };
    // an invoice paid: the sheet on the left, what happened to it on the right
    DR.invoice = function (c, W, H, p, t) {
      var a = ez(p * 3.7), b = ez(p * 3.7 - .9), d = ez(p * 3.7 - 1.6), e = ez(p * 3.7 - 2.5), x = W * .06, y = H * .12, w = W * .38, hh = H * .76, tx = W * .58, ty0 = H * .16, ty1 = H * .86, N = [[0, 'Job finished', 'Friday', a], [.22, 'Invoice sent', 'The same day', b], [.5, 'Reminder', 'Day 3', d], [.72, 'Paid', 'Day 4', e], [1, 'Reminder', 'Day 7', e]];
      c.globalAlpha = .3 + .7 * a; card(c, x, y, w, hh, 14, ink(.5), '#0b0b0d'); txt(c, 'Invoice 1042', x + 24, y + 38, ink(.95), 'left', F('600', 20)); txt(c, 'Example Fence Co.', x + 24, y + 62, ink(.5), 'left', F('500', 12, 1)); line(c, x, px(y + 84), x + w, px(y + 84), ink(.14));
      for (var i = 0; i < 3; i++) { var yy = y + 116 + i * 38; bars(c, x + 24, yy - 3, w * .44 * a, 1, .7); c.fillStyle = ink(.5); c.fillRect(x + w - 24 - 52 * a, yy - 3, 52 * a, 6); line(c, x + 24, px(yy + 19), x + w - 24, px(yy + 19), ink(.08)) }
      txt(c, 'Total due', x + 24, y + 116 + 3 * 38 + 6, ink(.95), 'left', F('600', 16)); c.fillStyle = ink(.95); c.fillRect(x + w - 24 - 84 * a, y + 116 + 3 * 38, 84 * a, 10); pill(c, x + 24, y + hh - 40, 'Pay now', { al: 'l', fill: ink(.95), col: '#0a0a0c', stroke: ink(.95), w: '600', s: 13.5, h: 36 }); c.globalAlpha = 1;
      if (e > 0) { c.save(); c.translate(x + w * .6, y + hh * .66); c.rotate(-.14); c.globalAlpha = e; c.strokeStyle = RED; c.lineWidth = 2; c.strokeRect(-84, -24 - (1 - e) * 14, 168, 48); txt(c, 'PAID, DAY 4', 0, 1 - (1 - e) * 14, RED, 'center', F('600', 18, 1)); c.restore() }
      line(c, px(tx), ty0, px(tx), ty1, ink(.14)); var head = lerp(ty0, lerp(ty0, ty1, .72), cl(p * 1.15)); line(c, px(tx), ty0, px(tx), head, ink(.95), 1.5); c.setLineDash([3, 6]); line(c, px(tx), lerp(ty0, ty1, .72), px(tx), ty1, ink(.25)); c.setLineDash([]);
      N.forEach(function (q, i) { var ny = lerp(ty0, ty1, q[0]), k = q[3], gone = i === 4; c.globalAlpha = .28 + .72 * k; card(c, tx - 5, ny - 5, 10, 10, 3, ink(.9), k > .5 && !gone ? (i === 3 ? RED : ink(.95)) : '#050506'); txt(c, q[1], tx + 24, ny - 7, ink(gone && e > .5 ? .4 : .95), 'left', F('600', 16)); txt(c, q[2], tx + 24, ny + 13, ink(.5), 'left', F('500', 11.5, 1)); c.globalAlpha = 1;
        if (gone && e > 0) { line(c, tx + 22, px(ny - 7), tx + 22 + 78 * e, px(ny - 7), ink(.6)); pill(c, tx + 118, ny - 6, 'Cancelled, not needed', { al: 'l', dot: RED, s: 12, a: e }) } });
      var P1 = S(x + w, y + hh * .26, tx - 10, lerp(ty0, ty1, .22)); curve(c, P1, 0, b, ink(.4)); if (b >= 1) pulse(c, P1, (t * .3) % 1.3);
      if (d > 0) bubble(c, tx + 24, lerp(ty0, ty1, .5) + 30, W * .3, 'Friendly reminder about invoice 1042. Pay here whenever you are ready.', 0, d * 3, F('400', 13.5))
    };
    // speed to lead: the same lead on two clocks
    DR.speed = function (c, W, H, p, t) {
      var x0 = W * .09, x1 = W * .93, yA = H * .54, yB = H * .8, k = cl(p * 1.12), brk = .58, hx = lerp(x0, x1, k), X = function (u) { return lerp(x0, x1, u) }, sec = function (s) { return X(s / 60 * (brk - .04)) };
      var clock = k < (brk - .04) * 59.4 / 60 ? '0:' + ('0' + Math.round(k / (brk - .04) * 60)).slice(-2) : k < brk + .06 ? '1:00' : Math.floor(lerp(1, 5.6, (k - brk - .06) / (1 - brk - .06))) + ' h ' + ('0' + (Math.round(lerp(0, 336, (k - brk - .06) / (1 - brk - .06))) % 60)).slice(-2) + ' min';
      txt(c, 'Since the lead came in', x0, H * .1, ink(.5), 'left', F('500', 12, 1)); txt(c, clock, x0, H * .1 + 58, ink(1), 'left', F('600', 60));
      ['Form', 'Message', 'Missed call'].forEach(function (s, i) { pill(c, x1, H * .09 + i * H * .058, s, { al: 'r', dot: i === 0 ? RED : ink(.5), s: 12.5 }) });
      [[0, '0:00'], [10, '0:10'], [30, '0:30'], [60, '1:00']].forEach(function (q) { var x = sec(q[0]); line(c, px(x), yA - H * .13, px(x), yB + 18, ink(.08)); txt(c, q[1], x, yA - H * .13 - 10, ink(.4), 'center', F('500', 11, 1)) });
      var bx = X(brk + .01); c.strokeStyle = ink(.4); c.lineWidth = 1; [0, 6].forEach(function (o) { c.beginPath(); c.moveTo(bx + o - 4, yA - H * .13 - 4); c.lineTo(bx + o + 4, yA - H * .13 - 18); c.stroke() }); txt(c, 'That evening', X(.86), yA - H * .13 - 10, ink(.4), 'center', F('500', 11, 1));
      function lane(y, name, ev, live) {
        txt(c, name, live ? x1 : x0 + 16, y - 16, ink(live ? .95 : .5), live ? 'right' : 'left', F('600', 14)); line(c, x0, px(y), x1, px(y), ink(.14)); line(c, x0, px(y), hx, px(y), ink(live ? .95 : .4), live ? 1.5 : 1);
        ev.forEach(function (q, i) { var e = ez((k - q[0]) * 16), x = X(q[0]); if (e <= 0) return; c.globalAlpha = e; card(c, x - 5, y - 5, 10, 10, 3, ink(.9), q[2] === 2 ? RED : live ? ink(.95) : '#050506'); pill(c, q[0] > .8 ? x + 8 : x, y + ((i % 2 ? 1 : -1) * (live ? 1 : -1)) * 34, q[1], { al: q[0] > .8 ? 'r' : null, dot: q[2] === 2 ? RED : null, s: 12.5, stroke: ink(live ? .5 : .22), col: ink(live ? .95 : .55), fill: '#050506' }); c.globalAlpha = 1 })
      }
      lane(yA, 'With it', [[9 / 60 * (brk - .04), 'Reply sent, 0:09', 1], [34 / 60 * (brk - .04), 'Time picked', 1], [brk - .04, 'Estimate booked', 2]], true);
      lane(yB, 'Without it', [[5 / 60 * (brk - .04), 'Voicemail', 0], [.74, 'They book someone else', 2], [.9, 'You call back, 7:40 PM', 0]], false);
      card(c, x0 - 5, yA - 5, 10, 10, 3, null, RED); card(c, x0 - 5, yB - 5, 10, 10, 3, null, RED); line(c, px(x0), yA, px(x0), yB, 'rgba(224,25,58,.6)'); c.setLineDash([2, 5]); line(c, px(hx), yA - H * .13, px(hx), yB + 18, ink(.5)); c.setLineDash([])
    };
    [].forEach.call(document.querySelectorAll('.px[data-scrub]'), function (sec) {
      var name = sec.dataset.scrub, span = +sec.dataset.span || 1, ent = DR[name] ? ['S', DR[name]] : KB.B[name]; if (!ent) return;
      var host = sec.querySelector('.px-host'), steps = [].slice.call(sec.querySelectorAll('.px-steps li')), cv = document.createElement('canvas'), c = cv.getContext('2d'), W = 1, H = 1, z = 1, s = 0, tgt = 0, vis = false, raf = 0, t0 = performance.now(), on = -1; host.appendChild(cv);
      function size() { var r = host.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2), nw = r.width < 780, VW = nw ? 620 : 960, sc = r.width / VW; W = VW; H = Math.max(1, r.height / sc); cv.width = Math.max(1, r.width * d); cv.height = Math.max(1, r.height * d); c.setTransform(d * sc, 0, 0, d * sc, 0, 0); z = nw ? 1.28 : 1; kick() }
      function prog() { var r = sec.getBoundingClientRect(); if (innerWidth <= 900) { var q = host.getBoundingClientRect(); tgt = cl((innerHeight * .95 - q.top) / (innerHeight * .9)) } else tgt = cl((-r.top + innerHeight * .12) / Math.max(1, r.height - innerHeight)); kick() }
      function frame(n) { raf = 0; s += (tgt - s) * (rm ? 1 : .12); h.setZ(z); c.clearRect(0, 0, W, H); c.globalAlpha = 1; if (ent[0] === 'L') ent[1](c, W, H, 1, s * span, { x: 0, y: 0, on: false }); else ent[1](c, W, H, s, (n - t0) / 1000, { x: 0, y: 0, on: false }); h.setZ(1);
        var a = Math.min(steps.length - 1, Math.floor(s * steps.length * .999)); if (a !== on) { on = a; steps.forEach(function (li, i) { li.classList.toggle('on', i <= a) }) } if (vis && !rm) raf = requestAnimationFrame(frame) }
      function kick() { if (!raf) raf = requestAnimationFrame(frame) }
      new ResizeObserver(size).observe(host); new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) kick() }).observe(sec); addEventListener('scroll', prog, { passive: true }); if (document.fonts && document.fonts.ready) document.fonts.ready.then(kick); size(); prog()
    })
  })();
  // ---- the calendar: starts close on the booking, pulls back to the week, and its notes come out of the sides
  [].forEach.call(document.querySelectorAll('.pz'), function (sec) {
    var fig = sec.querySelector('.pz-fig'), bs = [].slice.call(sec.querySelectorAll('.pz-b')), tk = false, ezz = function (x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x) };
    function up() { tk = false; if (innerWidth <= 900) { fig.style.removeProperty('--z'); bs.forEach(function (b) { b.classList.add('on') }); return } var r = sec.getBoundingClientRect(), p = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight))); fig.style.setProperty('--z', (1.75 - .75 * ezz(p / .42)).toFixed(4)); bs.forEach(function (b, i) { b.classList.toggle('on', p > .46 + i * .12) }) }
    addEventListener('scroll', function () { if (!tk) { tk = true; requestAnimationFrame(up) } }, { passive: true }); addEventListener('resize', up); setTimeout(up, 400)
  });
  // ---- product pieces: the scroll steps through a pinned section and each step switches parts of the piece on
  [].forEach.call(document.querySelectorAll('.ax'), function (sec) {
    var N = +sec.dataset.steps || 3, q = function (x) { return [].slice.call(sec.querySelectorAll(x)) }, parts = q('[data-at],[data-lit]'), lis = q('.px-steps li'), ones = q('[data-is]'), vals = q('[data-v]'), ws = q('[data-w]'), auto = sec.classList.contains('bone'), one = sec.classList.contains('one'), cur = -2, tk = false, cyc = 0;
    function pick(list, k) { return list[Math.max(0, Math.min(list.length - 1, k))] }
    function set(k) {
      if (k === cur) return; cur = k; var c = Math.max(0, k);
      parts.forEach(function (e) { e.classList.toggle('on', +(e.dataset.at || e.dataset.lit) <= k) });
      lis.forEach(function (li, i) { li.classList.toggle('on', i <= k); li.classList.toggle('cur', i === c) });
      ones.forEach(function (e) { e.classList.toggle('cur', +e.dataset.is === c) });
      vals.forEach(function (e) { e.textContent = pick(e.dataset.v.split('|'), k) });
      ws.forEach(function (e) { e.style.width = pick(e.dataset.w.split(','), k) });
    }
    function up() {
      tk = false; if (auto) return;
      if (innerWidth <= 900) { if (one && !rm) { if (!cyc) { set(0); cyc = setInterval(function () { var r = sec.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) set((cur + 1) % N) }, 2400) } } else set(N - 1); return }
      if (cyc) { clearInterval(cyc); cyc = 0 }
      var r = sec.getBoundingClientRect(), p = Math.max(0, Math.min(.999, (-r.top + innerHeight * .12) / Math.max(1, r.height - innerHeight)));
      set(r.top > innerHeight * .55 ? -1 : Math.floor(p * N));
    }
    if (auto) { if (rm || !('IntersectionObserver' in window)) set(N - 1); else new IntersectionObserver(function (e, o) { if (e[0].isIntersecting) { o.disconnect(); var k = 0; set(0); var t = setInterval(function () { k++; set(k); if (k >= N - 1) clearInterval(t) }, 1100) } }, { threshold: .45 }).observe(sec) }
    else { addEventListener('scroll', function () { if (!tk) { tk = true; requestAnimationFrame(up) } }, { passive: true }); addEventListener('resize', up); up() }
  });
  // ---- hero: pick a problem, get the fix in one line
  var hq = document.getElementById('hq');
  if (hq) {
    var Q = [['Missed calls', 'Answered on the first rings. The details are taken and the estimate is booked while you are still on the job.', ['phone-agent', 'answering']], ['Slow replies', 'Every form, message and lead-site lead hears back in seconds, with times to pick from.', ['answering', 'social-messages']], ['No-shows', 'Confirmations and reminders go out on their own, and a freed slot is offered to someone else.', ['reminders', 'booking']], ['Quotes go quiet', 'Each quote is followed up on a schedule until you get a yes or a no.', ['follow-up', 'estimates']], ['Getting paid', 'Invoices go out the day the job ends and are followed up until they are paid.', ['invoicing']], ['Not enough reviews', 'Every finished job is asked for a review, and every review gets a reply.', ['reviews', 'review-replies']], ['Too much office work', 'If it follows the same steps every time, it can run without you.', ['custom-agents', 'team-assistant']], ['Something else', 'If it does not need a person, we can probably build it. The audit is where we find out.', ['custom-builds']]];
    var chips = hq.querySelector('.hq-chips'), ans = hq.querySelector('.hq-ans p'), links = hq.querySelector('.hq-links'), cur = -1, timer = 0, auto = true;
    function pick(i, user) {
      cur = i; [].forEach.call(chips.children, function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false') });
      ans.textContent = ''; Q[i][1].split(' ').forEach(function (w, k) { var s = document.createElement('span'); s.textContent = w + ' '; s.style.animationDelay = (rm ? 0 : k * 22) + 'ms'; ans.appendChild(s) });
      [].forEach.call(hq.querySelectorAll('.hq-fig .st-fig'), function (f, k) { f.hidden = k !== i }); links.textContent = ''; Q[i][2].forEach(function (s) { var a = document.createElement('a'); a.href = '/' + s; a.textContent = N[s]; links.appendChild(a) });
      clearTimeout(timer); hq.classList.remove('auto'); if (user) auto = false; if (auto && !rm) { void hq.offsetWidth; hq.classList.add('auto'); timer = setTimeout(function () { pick((cur + 1) % Q.length) }, 4200) }
    }
    Q.forEach(function (q, i) { var b = document.createElement('button'); b.type = 'button'; b.textContent = q[0]; b.onclick = function () { pick(i, true) }; chips.appendChild(b) }); pick(0)
  }
  // ---- one job, start to finish: cards stack as you scroll
  var jl = document.querySelector('.jl');
  if (jl) {
    var cards = [].slice.call(jl.querySelectorAll('.jc')), steps = [].slice.call(jl.querySelectorAll('.jl-steps li')), tk = false;
    var ez = function (x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3) };
    function upd() {
      tk = false; if (innerWidth <= 900) return; var r = jl.getBoundingClientRect(), p = Math.max(0, Math.min(cards.length - .001, -r.top / (innerHeight * .62))), on = Math.min(cards.length - 1, Math.floor(p + .35));
      cards.forEach(function (c, i) { var d = p - i, e = ez(d + 1), depth = Math.max(0, d); c.style.transform = 'translateY(' + ((1 - e) * 78 - 0) + 'vh) translateY(' + (-depth * 20) + 'px) scale(' + (1 - Math.min(depth, 4) * .045) + ')'; c.style.opacity = d < -1 ? 0 : Math.max(0, 1 - Math.max(0, depth - .15) * .3); c.style.zIndex = 10 + i });
      steps.forEach(function (s, i) { s.classList.toggle('on', i === on) })
    }
    addEventListener('scroll', function () { if (!tk) { tk = true; requestAnimationFrame(upd) } }, { passive: true }); addEventListener('resize', upd); upd()
  }
  // ---- one job: a line diagram that draws itself as you scroll. Seven leaks, each sealed as the line reaches it.
  var jd = document.getElementById('jd');
  if (jd) (function () {
    var ST = [['The call', 'It rings while you are on a roof. It gets answered and the details are taken.', 'phone-agent', 'More on the phone agent'], ['The booking', 'They pick a time you are actually free. It lands on your calendar.', 'booking', 'More on booking'], ['The reminder', 'A confirmation, then a reminder the morning of. They show up.', 'reminders', 'More on reminders'], ['The estimate', 'Drafted from your price book the same day. You check it and send.', 'estimates', 'More on estimates'], ['The follow-up', 'Checked in on days 2 and 5. It stops the moment they answer.', 'follow-up', 'More on follow-up'], ['The invoice', 'Sent the day the job ends, and followed up until it is paid.', 'invoicing', 'More on invoices'], ['The review', 'Asked while the job is fresh, and the review gets a reply.', 'reviews', 'More on reviews']];
    var sec = jd.closest('.jd'), now = sec.querySelector('.jd-now'), cv = document.createElement('canvas'), c = cv.getContext('2d'), W = 1, H = 1, s = -1, tgt = 0, vis = false, raf = 0, t0 = performance.now(), act = -1, INK = '242,241,238', RED = '#e0193a';
    jd.appendChild(cv);
    var cl = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x }, ez = function (x) { x = cl(x); return x * x * (3 - 2 * x) }, lerp = function (a, b, k) { return a + (b - a) * k }, ink = function (a) { return 'rgba(' + INK + ',' + a + ')' }, px = function (v) { return Math.round(v) + .5 };
    function P(k, L, f) { if (k <= 0) return; c.save(); c.setLineDash([cl(k) * L, L]); c.beginPath(); f(); c.stroke(); c.restore() }
    function star(x, y, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .45 : r; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q) } c.closePath() }
    var G = [
      function (k) { for (var j = 0; j < 3; j++)P(k * 3 - j, 70, function () { c.arc(-16, 16, 13 + j * 11, -1.5, -.08) }); c.fillStyle = ink(cl(k * 3)); c.fillRect(-19, 13, 6, 6) },
      function (k) { P(k * 2, 200, function () { c.roundRect(-24, -20, 48, 44, 6) }); P(k * 2 - .5, 60, function () { c.moveTo(-24, -7); c.lineTo(24, -7) }); P(k * 2 - .7, 30, function () { c.moveTo(-12, -27); c.lineTo(-12, -15); c.moveTo(12, -27); c.lineTo(12, -15) }); for (var j = 0; j < 6; j++) { var a = cl(k * 4 - 1.6 - j * .2); c.fillStyle = j === 4 && k > .9 ? RED : ink(.55 * a); c.fillRect(-16 + (j % 3) * 13, 1 + Math.floor(j / 3) * 11, 6, 6) } },
      function (k) { P(k * 1.8, 150, function () { c.moveTo(-14, 14); c.bezierCurveTo(-14, -24, 14, -24, 14, 14) }); P(k * 1.8 - .5, 60, function () { c.moveTo(-20, 14); c.lineTo(20, 14) }); P(k * 2 - 1, 20, function () { c.moveTo(0, -18); c.lineTo(0, -25) }); c.fillStyle = k > .85 ? RED : ink(cl(k * 3 - 2)); c.beginPath(); c.arc(0, 21, 3.2, 0, 6.3); c.fill() },
      function (k) { P(k * 2, 260, function () { c.moveTo(-18, -26); c.lineTo(8, -26); c.lineTo(18, -16); c.lineTo(18, 26); c.lineTo(-18, 26); c.closePath() }); P(k * 2 - .8, 40, function () { c.moveTo(8, -26); c.lineTo(8, -16); c.lineTo(18, -16) }); for (var j = 0; j < 4; j++)P(k * 4 - 1.8 - j * .35, 30, function () { c.moveTo(-10, -6 + j * 8); c.lineTo(j === 3 ? 2 : 10, -6 + j * 8) }) },
      function (k) { P(k * 1.5, 130, function () { c.arc(0, 0, 21, -1.1, 3.7) }); P(k * 2 - 1.1, 30, function () { c.moveTo(3, -24); c.lineTo(10, -18.5); c.lineTo(2, -13) }); for (var j = 0; j < 3; j++) { c.fillStyle = j === 2 && k > .9 ? RED : ink(cl(k * 4 - 1.5 - j * .5)); c.fillRect(-11 + j * 9, -2.5, 5, 5) } },
      function (k) { P(k * 2, 240, function () { c.rect(-19, -26, 38, 52) }); P(k * 3 - 1, 30, function () { c.moveTo(-11, -15); c.lineTo(7, -15); c.moveTo(-11, -7); c.lineTo(11, -7) }); var a = cl(k * 4 - 2.6); if (a > 0) { c.save(); c.translate(1, 9); c.rotate(-.2); c.globalAlpha = a; c.strokeStyle = RED; c.fillStyle = RED; c.lineWidth = 1.4; c.strokeRect(-16, -8, 32, 16); c.font = '600 9.5px "Geist Mono",ui-monospace,monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PAID', 0, .5); c.restore() } },
      function (k) { for (var j = 0; j < 5; j++) { var a = cl(k * 5 - j * .8); if (a <= 0) continue; star(-26 + j * 13, 0, 6.2); c.globalAlpha = a; if (a >= 1) { c.fillStyle = ink(.95); c.fill() } c.stroke(); c.globalAlpha = 1 } }];
    function size() { var r = jd.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); W = Math.max(1, r.width); H = Math.max(1, r.height); cv.width = W * d; cv.height = H * d; c.setTransform(d, 0, 0, d, 0, 0); kick() }
    function prog() { var r = sec.getBoundingClientRect(); tgt = cl(-r.top / Math.max(1, r.height - innerHeight)) * 7.6 - .25; kick() }
    function frame(n) {
      raf = 0; s += (tgt - s) * .14; var t = (n - t0) / 1000, vert = W < 760, x0 = vert ? 34 : W * .06, x1 = vert ? 34 : W * .94, y0 = vert ? H * .07 : H * .52, y1 = vert ? H * .93 : H * .52, base = H * .9, hp = cl(s / 6), hx = lerp(x0, x1, hp), hy = lerp(y0, y1, hp), k7 = 0;
      c.clearRect(0, 0, W, H); c.lineWidth = 1; c.strokeStyle = ink(.16); c.beginPath(); c.moveTo(px(x0), px(y0)); c.lineTo(px(x1), px(y1)); c.stroke();
      if (!vert) { c.strokeStyle = ink(.1); c.beginPath(); c.moveTo(x0, px(base)); c.lineTo(x1, px(base)); c.stroke(); c.font = '500 11.5px "Geist Mono",ui-monospace,monospace'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = ink(.4); c.fillText('Where it slips', x0, base - 12) }
      for (var i = 0; i < 7; i++) {
        var x = lerp(x0, x1, i / 6), y = lerp(y0, y1, i / 6), g = cl((s - i + .45) / .9), e = ez(g); k7 += g >= 1 ? 1 : 0;
        if (!vert) { // the leak, and its seal
          c.save(); c.setLineDash([3, 6]); c.lineDashOffset = -t * 14; c.strokeStyle = 'rgba(224,25,58,' + (.75 * (1 - e)) + ')'; c.beginPath(); c.moveTo(px(x), y + 8); c.lineTo(px(x), base - 6); c.stroke(); c.restore();
          c.strokeStyle = 'rgba(224,25,58,' + (1 - e) + ')'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x - 4, base - 4); c.lineTo(x + 4, base + 4); c.moveTo(x + 4, base - 4); c.lineTo(x - 4, base + 4); c.stroke();
          c.strokeStyle = ink(e); P(g * 2 - 1, 16, function () { c.moveTo(x - 5, base); c.lineTo(x - 1.5, base + 4); c.lineTo(5.5 + x, base - 4) }); c.lineWidth = 1; P(g * 1.6, 24, function () { c.moveTo(x - 11, px(y + 13)); c.lineTo(x + 11, px(y + 13)) })
        }
        var gs = vert ? 1 : Math.max(1, Math.min(1.9, W / 760)); c.save(); c.translate(vert ? x + 62 : x, vert ? y : y - 52 * gs - 22); c.scale(gs, gs); c.strokeStyle = ink(.95); c.lineWidth = 1.5 / Math.sqrt(gs); c.lineJoin = 'round'; c.lineCap = 'round'; G[i](g); c.restore();
        c.fillStyle = g >= .5 ? ink(.95) : '#000'; c.strokeStyle = ink(g >= .5 ? .95 : .4); c.lineWidth = 1; c.fillRect(x - 4.5, y - 4.5, 9, 9); c.strokeRect(px(x - 5), px(y - 5), 9, 9);
        c.textAlign = vert ? 'left' : 'center'; c.textBaseline = 'alphabetic'; c.font = '500 11px "Geist Mono",ui-monospace,monospace'; c.fillStyle = Math.round(s) === i ? RED : ink(.35 + .3 * e); c.fillText('0' + (i + 1), vert ? x + 104 : x, vert ? y - 6 : y + 38);
        c.font = '600 ' + (W < 1100 ? 13 : 15) + 'px Inter,system-ui,sans-serif'; c.fillStyle = ink(.3 + .7 * e); c.fillText(ST[i][0], vert ? x + 104 : x, vert ? y + 13 : y + 58)
      }
      if (s > 0) { c.strokeStyle = ink(.95); c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, vert ? y0 : px(y0)); c.lineTo(vert ? px(hx) : hx, vert ? hy : px(hy)); c.stroke(); for (var u = 0; u < 3; u++) { var q = ((t * .16 + u / 3) % 1); c.fillStyle = ink(.9 * (1 - q)); c.fillRect(lerp(x0, hx, q) - 2, lerp(y0, hy, q) - 2, 4, 4) } c.fillStyle = RED; c.fillRect(hx - 5, hy - 5, 10, 10) }
      if (!vert) { c.font = '500 11.5px "Geist Mono",ui-monospace,monospace'; c.textAlign = 'right'; c.fillStyle = ink(.6); c.fillText(k7 + ' of 7 covered', x1, base - 12) }
      var a = Math.max(0, Math.min(6, Math.round(s))); if (a !== act) { act = a; now.children[0].textContent = '0' + (a + 1); now.children[1].textContent = ST[a][0]; now.children[2].textContent = ST[a][1]; now.children[3].textContent = ST[a][3]; now.children[3].href = '/' + ST[a][2] }
      if (vis && !rm) raf = requestAnimationFrame(frame)
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame) }
    new ResizeObserver(size).observe(jd); new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) kick() }).observe(jd); addEventListener('scroll', prog, { passive: true }); if (document.fonts && document.fonts.ready) document.fonts.ready.then(kick); size(); prog()
  })();
  // ---- switchboard: a problem lights the builds that fix it
  var sw = document.getElementById('sw');
  if (sw) {
    var M = [['Calls and messages go unanswered', ['answering', 'phone-agent', 'website-chat', 'social-messages', 'after-hours']], ['The calendar has holes in it', ['booking', 'reminders', 'dispatch', 'job-updates']], ['Quotes go out late, or go quiet', ['estimates', 'proposals', 'follow-up', 'lead-vetting']], ['Getting paid takes too long', ['invoicing', 'bookkeeping']], ['Past customers never come back', ['win-backs', 'maintenance-reminders', 'referrals', 'campaigns']], ['Nobody can find you', ['reviews', 'review-replies', 'local-search', 'job-photos', 'websites']], ['Everything runs through you', ['team-assistant', 'field-notes', 'reports', 'call-review', 'hiring']], ['Something only your business has', ['custom-agents', 'custom-builds', 'integrations']]];
    var pl = sw.querySelector('.sw-p'), bl = sw.querySelector('.sw-b'), svg = sw.querySelector('svg'), NS = 'http://www.w3.org/2000/svg', btn = [], A = {}, sel = 0, t2 = 0, au = true, seen = false;
    M.forEach(function (m, i) { var li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.textContent = m[0]; b.onclick = function () { au = false; go(i) }; b.onmouseenter = function () { if (innerWidth > 1000) { au = false; go(i) } }; li.appendChild(b); pl.appendChild(li); btn.push(b); m[1].forEach(function (s) { var a = document.createElement('a'); a.href = '/' + s; a.textContent = N[s]; bl.appendChild(a); A[s] = a }) });
    function go(i) {
      sel = i; btn.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false') }); Object.keys(A).forEach(function (s) { A[s].classList.toggle('on', M[i][1].indexOf(s) >= 0) });
      while (svg.firstChild) svg.removeChild(svg.firstChild); if (innerWidth <= 1000) return; var R = sw.getBoundingClientRect(), b = btn[i].getBoundingClientRect(), x0 = b.right - R.left, y0 = b.top + b.height / 2 - R.top;
      M[i][1].forEach(function (s, k) { var a = A[s].getBoundingClientRect(), x1 = a.left - R.left, y1 = a.top + a.height / 2 - R.top, mx = (x0 + x1) / 2, p = document.createElementNS(NS, 'path'); p.setAttribute('d', 'M' + x0 + ' ' + y0 + ' C' + mx + ' ' + y0 + ' ' + mx + ' ' + y1 + ' ' + x1 + ' ' + y1); svg.appendChild(p);
        if (!rm) { var L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.getBoundingClientRect(); p.style.transition = 'stroke-dashoffset .7s cubic-bezier(.16,1,.3,1) ' + (k * 60) + 'ms'; p.style.strokeDashoffset = 0; var c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 3); var an = document.createElementNS(NS, 'animateMotion'); an.setAttribute('dur', '2.4s'); an.setAttribute('begin', (k * .18) + 's'); an.setAttribute('repeatCount', 'indefinite'); an.setAttribute('path', p.getAttribute('d')); c.appendChild(an); svg.appendChild(c) } });
      clearTimeout(t2); if (au && !rm) t2 = setTimeout(function () { go((sel + 1) % M.length) }, 3200)
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { if (e[0].isIntersecting && !seen) { seen = true; go(0) } if (!e[0].isIntersecting) clearTimeout(t2); else if (seen && au) go(sel) }, { threshold: .25 }).observe(sw); else go(0);
    addEventListener('resize', function () { if (seen) go(sel) })
  }
})();
