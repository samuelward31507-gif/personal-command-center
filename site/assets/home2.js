// Homepage, second pass. Three small pieces: the problem picker in the hero, the job told as a stack, the switchboard.
(function () {
  var N = { answering: 'Answering', 'phone-agent': 'Phone agent', 'website-chat': 'Website chat', 'social-messages': 'Messages and DMs', 'lead-vetting': 'Lead vetting', 'after-hours': 'After hours', booking: 'Booking', reminders: 'Reminders', dispatch: 'Scheduling and dispatch', 'job-updates': 'Job updates', estimates: 'Estimates', proposals: 'Proposals', 'follow-up': 'Follow-up', invoicing: 'Invoices', bookkeeping: 'Bookkeeping prep', reviews: 'Reviews', 'review-replies': 'Review replies', 'win-backs': 'Win-backs', 'maintenance-reminders': 'Service reminders', referrals: 'Referrals', campaigns: 'Email and text campaigns', websites: 'Websites', 'local-search': 'Local search', 'job-photos': 'Job photos to posts', hiring: 'Hiring', 'team-assistant': 'Team assistant', 'field-notes': 'Field notes', reports: 'Reports', 'call-review': 'Call review', integrations: 'Tool connections', 'custom-agents': 'Custom agents', 'custom-builds': 'Custom builds' };
  var rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
