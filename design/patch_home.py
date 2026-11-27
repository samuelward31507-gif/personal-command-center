"""Homepage, final structure. Rewrites site/index.html in place. Safe to run again.
Hero. 01 the problem. 02 how we work (the three 3D pieces). 03 what we fix (six diagrams, each built a different way). The call. Close."""
import re, pathlib
f = pathlib.Path(__file__).resolve().parent.parent / 'site' / 'index.html'; s = f.read_text()
s = re.sub(r'<!--h2-->.*?<!--/h2-->\n?', '', s, flags=re.S)
# the hero keeps its three steps under the buttons
if 'class="hs-steps"' not in s: s = s.replace('<a class="btn ghost" href="/audit">Check your site in 60 seconds</a></div>', '<a class="btn ghost" href="/audit">Check your site in 60 seconds</a></div>\n      <ol class="hs-steps"><li><b>We audit</b><span>Where jobs slip, and what each leak costs you.</span></li><li><b>We build</b><span>Only the fixes your audit calls for.</span></li><li><b>It runs</b><span>On its own, while you’re on the job.</span></li></ol>', 1)
CTA = '<a class="btn" href="https://cal.com/audit-call/15min" target="_blank" rel="noopener" data-cta>Book your free audit</a>'
def blk(sel):
    a = s.index(sel); return a, s.index('</section>', a) + 10
def move_before(sel, before):
    global s
    a, b = blk(sel); part = s[a:b]; s = s[:a] + s[b:]; k = s.index(before); s = s[:k] + part + '\n' + s[k:]
def ins(before, html):
    global s
    k = s.index(before); s = s[:k] + html + s[k:]
# The old 3D leak track, the six-layer render and the dial are retired. Their sections are rebuilt below as flat product pieces.
for old in ('<section id="leaks"', '<section id="inside"', '<section id="back"'):
    if old in s:
        a_, b_ = blk(old); s = s[:a_] + s[b_:]
s = s.replace('<script src="/assets/cinder-leaks.js" defer></script>\n', '').replace("when('#inside','/assets/cinder-unit.js',2600);", '')
s = s.replace("addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);update();\n})();", "if(bd&&bdHost){addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);update()}\n})();")
SMALL = '<small>Example business, sample data</small>'
BOOK = '<a class="inl" href="https://cal.com/audit-call/15min" target="_blank" rel="noopener" data-cta>Book your free audit</a>'
def ax(cls, n, chip, h, steps, link, vis, extra='', tag='h3', sid='', panel='', small=SMALL):
    ol = f'<ol class="px-steps">{"".join(f"<li>{x}</li>" for x in steps)}</ol>' if steps else ''
    lk = link if link.startswith('<') else '<a class="inl" href="{}">{}</a>'.format(*link.split('|'))
    return f'<section class="ax {cls}"{sid} data-steps="{n}"><div class="ax-in"><div class="ax-copy"><p class="px-k"><i></i>{chip}</p><{tag} class="ax-h">{h}</{tag}>{extra}{ol}{lk}</div><div class="ax-vis"><div class="axp {panel}">{vis}{small}</div></div></div></section>'
def row(av, b, d, right='', at=None):
    a = f' data-at="{at}"' if at is not None else ''
    return f'<div class="ap-row"{a}>{av}<div><b>{b}</b><span>{d}</span></div>{right}</div>'
AV = lambda x: f'<span class="ap-av">{x}</span>'; CK = '<span class="ap-ck"></span>'

# 1. where the jobs go: the audit's findings for one lead, as the report reads
LK = [('First call', '7:42 PM, on a job', None), ('Reply', 'After hours', ('Calls go to voicemail', '−$2,400/mo')), ('Booked', 'Same day', None), ('Quote', 'Sent once', ('No follow-up after day 2', '−$3,100/mo')), ('Paid', 'Invoice due', None), ('Review', 'Job done', ('Never asked', '−$900/mo'))]
TOT = '$0|$2,400|$2,400|$5,500|$5,500|$6,400'
def leakline():
    X = lambda i: 52 + i * 112; Y = 150; g = []
    for i, (n, d, lk) in enumerate(LK):
        x = X(i); drop = ''
        if lk:
            rx = min(x - 84, 664 - 169); cx = rx + 84
            drop = f'<g class="lk-drop"><path class="lk-dash" d="M{x},{Y + 9} V{Y + 86}"/><rect x="{rx}" y="{Y + 86}" width="168" height="70" rx="10"/><text class="lk-amt" x="{cx}" y="{Y + 116}" text-anchor="middle">{lk[1]}</text><text class="lk-why" x="{cx}" y="{Y + 138}" text-anchor="middle">{lk[0]}</text></g>'
        g.append(f'<g class="lkn{" leak" if lk else ""}" data-lit="{i}"><text class="lk-n" x="{x}" y="{Y - 44}" text-anchor="middle">{n}</text><text class="lk-d" x="{x}" y="{Y - 24}" text-anchor="middle">{d}</text><circle cx="{x}" cy="{Y}" r="7"/>{drop}</g>')
    return ('<svg class="lnv lkv" viewBox="0 0 664 470" role="img" aria-label="Example business: one lead drawn as a line from first call to review. Three leaks drop off it: after-hours calls go to voicemail, 2,400 dollars a month. No quote follow-up after day 2, 3,100 dollars a month. Reviews never asked for, 900 dollars a month. Total 6,400 dollars a month. Sample findings."><title>Where the jobs go</title>'
        f'<path class="lk-base" d="M{X(0)},{Y} H{X(5)}"/><path class="lk-fill" d="M{X(0)},{Y} H{X(5)}"/>' + ''.join(g)
        + f'<path class="lk-rule" d="M0,372 H664"/><text class="lk-tl" x="0" y="420">Leaking every month</text><text class="lk-tv" x="664" y="426" text-anchor="end" data-v="{TOT}">$6,400</text></svg>')
WHERE = ax('long', 6, 'The audit', 'Where the jobs go. <em>Most businesses lose them at the same few points.</em>', [], BOOK,
  leakline() + '<div class="ap ap-audit" aria-hidden="true"><div class="ap-hd"><div><b>One lead, followed end to end</b><span>Audit findings</span></div><span class="ap-pill r" data-v="0 leaks|1 leak|1 leak|2 leaks|2 leaks|3 leaks">3 leaks</span></div><div class="ap-bd">'
  + ''.join(f'<div class="au-row{" leak" if lk else ""}" data-lit="{i}"><i></i><div><b>{n}</b><span>{d}</span></div>' + (f'<div class="au-lk"><code>{lk[1]}</code><span>{lk[0]}</span></div>' if lk else '<span class="ap-pill">No leak</span>') + '</div>' for i, (n, d, lk) in enumerate(LK))
  + f'</div><div class="au-ft"><span>Leaking every month</span><code data-v="{TOT}">$6,400</code></div></div>',
  extra=f'<p class="ax-p">The audit follows one lead from the first call to the review, finds where yours slip, and puts a dollar number on each.</p><p class="ax-note">Example business, sample findings. Your audit uses your own numbers.</p>', tag='h2', sid=' id="leaks"', panel='lk', small='<small>Example business, sample findings</small>')

# 2. the audit: six layers, drawn as plain line geometry
LAYERS = [('Answering', 'What does a new customer get when they call, text or fill out your form after hours? We check.'), ('Booking', 'How many steps sit between “I’m interested” and a time on your calendar? We count them.'), ('Quote follow-up', 'What happens to a quote after it’s sent? We look at how many went quiet.'), ('Invoices', 'How long does a finished job take to get paid? We check what’s late and why.'), ('Reviews', 'How many finished jobs turned into a review? We compare the two numbers.'), ('Website', 'Does your site turn a visitor into a call? We test it on a phone.')]
def stack():
    cx, a, b, th, gap, y0 = 236, 168, 84, 12, 70, 104; g = []
    for i in reversed(range(6)):
        cy = y0 + i * gap; ia, ib = a * .4, b * .4
        g.append(f'<g class="pl" data-is="{i}"><g class="pl-m"><path d="M{cx - a},{cy} L{cx},{cy + b} L{cx + a},{cy} v{th} L{cx},{cy + b + th} L{cx - a},{cy + th} Z"/><path d="M{cx},{cy - b} L{cx + a},{cy} L{cx},{cy + b} L{cx - a},{cy} Z"/><path d="M{cx},{cy + b} v{th}"/><path class="pl-i" d="M{cx},{cy - ib} L{cx + ia},{cy} L{cx},{cy + ib} L{cx - ia},{cy} Z"/></g><path class="pl-ld" d="M{cx + a + 10},{cy + 6} H{cx + a + 44}"/><text x="{cx + a + 56}" y="{cy + 10}">{i + 1:02d}  {LAYERS[i][0]}</text></g>')
    return '<svg class="lnv" viewBox="0 0 620 590" role="img" aria-label="Six layers of a service business drawn as a stack of outlined plates: answering, booking, quote follow-up, invoices, reviews and website. The audit pulls each one out in turn."><title>The six layers the audit checks</title>' + ''.join(g) + '</svg>'
AUDIT = ax('rev one long', 6, 'Step one', 'First, a free audit. <em>We go through your business layer by layer and find what is costing you jobs.</em>', [n for n, _ in LAYERS], BOOK,
  stack() + '<div class="ln-caps">' + ''.join(f'<p data-is="{i}">{d}</p>' for i, (_, d) in enumerate(LAYERS)) + '</div>',
  extra='<p class="ax-p">You keep the plan, whether or not you work with us.</p>', tag='h2', sid=' id="inside"', panel='line', small='')

# 3. speed to lead: the conversation, as it sits in the inbox
SPEED = ax('', 4, 'Front desk', 'A new lead hears back in seconds. <em>By text, with times to pick from, while they are still looking.</em>', ['A lead writes in', 'A reply goes out in seconds', 'They pick a time', 'The estimate is booked'], '/answering|How answering works',
  '<div class="ap-pair"><div class="ap ap-thread"><div class="ap-hd">' + AV('TB') + '<div><b>Tom Becker</b><span>Web form, 2:14 PM</span></div><span class="ap-pill">New lead</span></div><div class="ap-bd"><p class="ap-meta" data-at="0">2:14:03 PM</p><div class="ap-msg" data-at="0">Do you install cedar privacy fences? Looking for a quote on about 120 feet.</div><p class="ap-meta r" data-at="1">Sent for you, <b>6 seconds later</b></p><div class="ap-msg me" data-at="1">Hi Tom, this is Ridgeline Fence. Yes, we do. I can get you a free estimate. Does Fri 8:00 AM, Mon 10:00 AM or Tue 2:00 PM work?</div><p class="ap-meta" data-at="2">2:16 PM</p><div class="ap-msg" data-at="2">Friday at 8 works.</div><div class="ap-sys" data-at="3">' + CK + '<span><b>Estimate booked.</b> Friday 8:00 AM, on your calendar.</span></div></div></div><div class="ap ap-stat" data-at="1"><span class="ap-l">First reply</span><strong>9s</strong><span>41 of 41 leads answered</span><i></i></div></div>')

# 4. the calendar screen
def col(jobs):
    return '<div class="cal-col">' + ''.join(f'<div class="cal-jb {c}" style="top:{a}%;height:{h}%">{x}</div>' for a, h, x, c in jobs) + '</div>'
CAL = '<section class="pz"><div class="pz-in"><div class="pz-h"><div><p class="px-k"><i></i>Calendar</p><h3>The estimate lands on your calendar. <em>The lead picks the time. You just show up.</em></h3></div><div><a class="inl" href="/booking">How booking works</a></div></div><div class="pz-stage"><figure class="pz-fig" style="transform-origin:88% 20%"><div class="ap ap-cal" role="img" aria-label="The calendar screen in the app for one week. A new estimate with Dana Ruiz sits on Friday at 8:00 AM. Two other times that were offered are shown as open. Sample data."><div class="cal-hd"><p class="ap-t">Calendar<span>This week</span></p><span class="ap-l">Ridgeline Fence, example</span></div><div class="cal-gr"><span class="cal-dy"></span>' + ''.join(f'<span class="cal-dy{" td" if d == "Fri" else ""}">{d}</span>' for d in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri')) + '<div class="cal-hr">' + ''.join(f'<span>{h}</span>' for h in ('8 AM', '9', '10', '11', '12 PM', '1', '2', '3')) + '</div>' + col([(1.5, 34, 'Install, Alder St', ''), (26, 10.5, 'Offered, 10:00 AM', 'open')]) + col([(13.5, 46, 'Install, Birch Ct', ''), (76, 10.5, 'Offered, 2:00 PM', 'open')]) + col([(1.5, 22, 'Estimate', ''), (38.5, 36, 'Repair, Oak Ln', '')]) + col([(26, 46, 'Install, Pine Rd', '')]) + col([(1.5, 21, '<b>Estimate, Dana Ruiz</b>8:00 AM, 214 Alder St', 'new'), (38.5, 36, 'Install, Elm St', '')]) + '</div></div></figure>' + ''.join(f'<div class="pz-b pz-b{i + 1}"><span>[{i + 1:02d}]</span><b>{b}</b><p>{d}</p></div>' for i, (b, d) in enumerate([('Only your free times', 'It reads your calendar first, so nothing is offered that you cannot make.'), ('The lead picks', 'Three times to choose from, by text. No phone tag.'), ('It lands complete', 'The address and the job are on the booking when you open it.'), ('Reminders set themselves', 'One the day before and one the morning of, from the moment it books.')])) + '</div></div></section>'

# 5. the quote and its follow-up
QS = [('Sent', 'Monday', '<div class="ap-msg me">Here is your quote, Kyle. $7,800 for 120 ft of cedar.</div>'), ('Check-in', 'Day 2', '<div class="ap-msg me">Any questions on the quote? Happy to walk through it.</div>'), ('Check-in', 'Day 5', '<div class="ap-msg me">Still want this on the schedule for this month?</div>'), ('Signed', 'Day 5, 4:10 PM', '<div class="ap-msg ok">' + CK + 'Follow-up stopped on its own.</div>')]
QUOTE = ax('wide', 4, 'Quotes', 'A quote gets chased until there is an answer. <em>It stops the moment they say yes or no.</em>', [], '/follow-up|How follow-up works',
  '<div class="ap ap-quote"><div class="ap-row">' + AV('KB') + '<div><b>Kyle Brandt</b><span>Cedar privacy fence, 120 ft</span></div><code>$7,800</code><span class="ap-pill" data-v="Sent|Waiting|Waiting|Signed">Signed</span></div><div class="ap-tl"><u data-w="0%,25%,50%,75%"></u>' + ''.join(f'<div data-lit="{i}"><i></i><b>{b}</b><span>{d}</span>{m}</div>' for i, (b, d, m) in enumerate(QS)) + '</div></div>')

# 6. the invoice
INVOICE = ax('rev', 3, 'Money', 'The invoice gets paid. <em>Sent the day the job ends, followed up until it is settled.</em>', ['Sent the day the job ends', 'A reminder on day 3', 'Paid on day 4, reminders stop'], '/invoicing|How invoices work',
  '<div class="ap ap-money"><span class="ap-l">Owed to you</span><strong data-v="$10,700|$10,700|$4,600">$4,600</strong><div class="ap-bar"><i data-w="0%,0%,57%"></i></div><span class="ap-l">Henderson family, invoice #1042</span>' + row(AV('HF'), 'Invoice sent', 'The day the job ended', '<code>$6,100</code>', 0) + row(AV('HF'), 'Reminder sent', 'Day 3, a friendly nudge', '<span class="ap-pill r">3 days late</span>', 1) + row(CK, 'Paid in full', 'Day 4. Reminders stopped.', '<span class="ap-pill k">Paid</span>', 2) + '</div>')

# 7. the review, on the one bone chapter
REVIEW = ax('bone', 3, 'After the job', 'Every finished job gets asked for a review. <em>Most happy customers never leave one, because nobody asks.</em>', ['Asked the day after the job', 'The review comes in', 'It gets a reply the same day'], '/reviews|How reviews work',
  '<div class="ap ap-thread"><div class="ap-hd">' + AV('BT') + '<div><b>Bill Turner</b><span>Job paid in full</span></div><span class="ap-pill">Finished</span></div><div class="ap-bd"><p class="ap-meta r" data-at="0">Sent for you, the day after</p><div class="ap-msg me" data-at="0">Thanks for choosing Ridgeline, Bill. Would you leave us a quick review? It takes a minute.</div><div class="ap-rv" data-at="1"><div class="ap-stars"><i></i><i></i><i></i><i></i><i></i></div><p>“On time, clean work, fair price.”</p><span class="ap-l">Bill Turner, on Google</span></div><p class="ap-meta r" data-at="2">Replied for you, the same day</p><div class="ap-msg me" data-at="2">Thank you, Bill. Enjoy the new fence.</div></div></div>', small='<small>Example business. The review is an illustration.</small>')

# 8. something only your business has: one custom build, as its steps
WF = [('When', 'A permit is approved', 'The city’s email arrives'), ('Check', 'Are the materials ordered?', 'If not, the office gets a reminder'), ('Then', 'Text the crew lead', '“Permit is in for 214 Alder St.”'), ('Then', 'Put the install on the calendar', 'First open day for that crew')]
CUSTOM = ax('', 4, 'Custom', 'Something only your business has. <em>Describe how you do it today and we build it, step by step.</em>', ['How you do it today', 'What it should check', 'What happens next', 'And the step after that'], '/custom-builds|How custom builds work',
  '<div class="wf" role="img" aria-label="An example custom build drawn as four steps. When a permit is approved, check that materials are ordered, text the crew lead, then put the install on the calendar. A fifth slot is open for the next step.">' + ''.join(f'<div class="ap wf-n" data-at="{i}"><div><span class="ap-l">{k}</span><b>{b}</b><span>{d}</span></div>{CK}</div>' for i, (k, b, d) in enumerate(WF)) + '<div class="wf-n open"><b>Your next step</b></div></div>', small='<small>An example build</small>')

# 9. what you get back: the Today screen, filling in
BACK = ax('wide', 5, 'What you get back', 'Open the app and most of the day is already done. <em>You only see what needs you.</em>', [], '/software|See the software',
  '<div class="ap-two"><div class="ap"><p class="ap-t">Needs you<span>most urgent first</span></p>' + row(AV('TB'), 'Tom Becker', 'Asked about financing', '<code>$9,400</code><span class="ap-btn">Reply</span>') + row(AV('LO'), 'Lena Ortiz', 'Opened her quote 3 times', '<code>$7,800</code><span class="ap-btn o">Nudge</span>') + row(AV('PS'), 'Priya Shah', 'Estimate done, quote not written', '<code>$6,200</code><span class="ap-btn o">Write quote</span>') + row(AV('HF'), 'Henderson family', 'Invoice 3 days late', '<code>$6,100</code><span class="ap-btn o">Call</span>') + row(AV('JP'), 'Jen Park', 'Quote written, not sent', '<code>$4,650</code><span class="ap-btn o">Send</span>') + '</div><div class="ap"><p class="ap-t">Handled for you<span data-v="0 today|1 today|2 today|3 today|4 today|5 today">5 today</span></p>' + ''.join(row(CK, b, d, '', i) for i, (b, d) in enumerate([('Replied to Tom Becker', '6 seconds after he wrote in'), ('Booked Dana Ruiz', 'Estimate, Friday 8:00 AM'), ('Followed up with Kyle Brandt', 'Quote, day 5'), ('Reminded the Hendersons', 'Invoice #1042'), ('Asked Bill Turner for a review', 'Job paid in full')])) + '</div></div>', sid=' id="back"')

TK = '<div class="tk" aria-hidden="true"></div>'
W = lambda x: '<!--h2-->' + TK + x + '<!--/h2-->\n'
ins('<section id="problem"', W(WHERE))
ins('<section id="build"', W(AUDIT) + '<!--h2-->' + TK + '<!--/h2-->\n')
ins('<section id="everything"', W(SPEED) + W(CAL) + W(QUOTE) + W(INVOICE) + W(REVIEW) + W(CUSTOM) + W(BACK) + '<!--h2-->' + TK + '<!--/h2-->\n')
# the numbers: say what the audit checks against each one
a_, b_ = blk('<section id="problem"'); P = s[a_:b_].split('</a></li>')
for i, x in enumerate(['We count the calls you missed last month.', 'We time how long a new lead waits for a first reply.', 'We check how many missed calls got a call back.']):
    P[i] += f'</a><!--h2--><p class="ov-a"><span>In your audit</span>{x}</p><!--/h2--></li>' if i < len(P) - 1 else ''
s = s[:a_] + ''.join(P[:3]) + ''.join(P[3:]) + s[b_:]
G8 = [('Front desk', 'Every call, form and message gets an answer.'), ('Calendar', 'Estimates booked, reminded and kept.'), ('Quotes', 'Out the same day, and chased until answered.'), ('Money', 'Invoices sent and followed up until paid.'), ('After the job', 'Reviews, repeat work and referrals.'), ('Getting found', 'Your site and your Google profile, kept working.'), ('Team and office', 'Hiring, notes, reports and answers for the crew.'), ('Custom', 'Anything else that does not need a person.')]
# everything: one line and a link, the full list lives on its own page
s = re.sub(r'<section id="everything" class="ixs(?: min)?"', '<section id="everything" class="ixs min"', s, count=1)
k = s.index('</div>', s.index('class="ixs-h"', s.index('<section id="everything"'))) + 6
s = s[:k] + '<!--h2--><div class="g8">' + ''.join(f'<a href="/everything"><span>[{i + 1:02d}]</span><b>{n}</b><p>{d}</p></a>' for i, (n, d) in enumerate(G8)) + '</div><p class="sw-n"><span>Thirty-two builds so far. If yours is not on the list and it does not need a person, we can probably build it.</span><a class="btn ghost" href="/everything">See everything we build</a>' + CTA + '</p><!--/h2-->' + s[k:]
AC = '<!--h2--><section class="ac" id="call" aria-labelledby="h-call"><div class="wrap"><p class="h2x-tag"><b>04 The free audit call</b></p><h2 id="h-call">Fifteen minutes. You leave with a plan.</h2><p class="sub">We can fix it. First we have to know what it is, and that is what the call is for.</p><div class="ac-t" aria-hidden="true"><u></u><b></b></div><div class="ac-g"><div><span>First</span><b>You tell us where it hurts.</b><p>Missed calls, slow weeks, quotes that vanish. Whatever is costing you.</p></div><div><span>Then</span><b>We walk a job with you.</b><p>From the first call to the review, looking for where jobs slip and what each leak is worth.</p></div><div><span>Before you hang up</span><b>You get the plan.</b><p>What to fix first, in order. It is yours to keep, whether or not you work with us.</p></div></div><div class="ac-f"><p><b>Bring rough numbers.</b> Leads a month, your average job, and how many quotes you close.</p>' + CTA + '</div></div></section><!--/h2-->\n'
ins('<section class="closing"', AC)
if 'home2.css' not in s: s = s.replace('</head>', '<link rel="stylesheet" href="/assets/home2.css">\n</head>', 1)
for tag in ('<script src="/assets/cinder-builds.js" defer></script>\n', '<script src="/assets/cinder-builds2.js" defer></script>\n', '<script src="/assets/cinder-figs.js" defer></script>\n', '<script src="/assets/home2.js" defer></script>\n'): s = s.replace(tag, '')
s = s.replace('<script src="/assets/cinder-chat.js" defer></script>', '<script src="/assets/cinder-builds.js" defer></script>\n<script src="/assets/cinder-builds2.js" defer></script>\n<script src="/assets/cinder-figs.js" defer></script>\n<script src="/assets/home2.js" defer></script>\n<script src="/assets/cinder-chat.js" defer></script>', 1)
f.write_text(s); print('home:', ' > '.join(a or b.split()[0] + ('.' + b.split()[1] if len(b.split()) > 1 else '') for a, b in re.findall(r'<section (?:id="([a-z]+)"|class="([a-z0-9 -]+)")', s)))
