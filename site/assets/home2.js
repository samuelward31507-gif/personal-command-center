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
      links.textContent = ''; Q[i][2].forEach(function (s) { var a = document.createElement('a'); a.href = '/' + s; a.textContent = N[s]; links.appendChild(a) });
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
