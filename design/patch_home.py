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
def ax(cls, n, chip, h, body, link, vis, mode='c', extra='', tag='h3', sid='', panel='', small=SMALL):
    """Three text layouts, mixed down the page.
    a: one statement. The headline and its sentence are a single two-tone paragraph beside the picture.
    b: headline, the picture full width, then short paragraphs side by side under it. body is [(lead, sentence, step or None)].
    c: few words. A headline and one sentence beside the picture."""
    lk = link if link.startswith('<') else '<a class="inl" href="{}">{}</a>'.format(*link.split('|'))
    pan = f'<div class="ax-vis"><div class="axp {panel}">{vis}{small}</div></div>'; k = f'<p class="px-k"><i></i>{chip}</p>'
    if mode == 'a':
        copy = f'{k}<{tag} class="ax-st"><b>{h}</b> {body}</{tag}>{extra}{lk}'
    elif mode == 'b':
        cols = ''.join(f'<div class="ax-c"{"" if at is None else f" data-lit=\"{at}\""}><b>{b_}</b><p>{d}</p></div>' for b_, d, at in body)
        return f'<section class="ax wide b {cls}"{sid} data-steps="{n}"><div class="ax-in"><div class="ax-copy">{k}<{tag} class="ax-h">{h}</{tag}>{lk}</div>{pan}<div class="ax-cols n{len(body)}">{cols}</div></div></section>'
    else:
        copy = f'{k}<{tag} class="ax-h">{h}</{tag}><p class="ax-s">{body}</p>{extra}{lk}'
    return f'<section class="ax {mode} {cls}"{sid} data-steps="{n}"><div class="ax-in"><div class="ax-copy">{copy}</div>{pan}</div></section>'
def row(av, b, d, right='', at=None):
    a = f' data-at="{at}"' if at is not None else ''
    return f'<div class="ap-row"{a}>{av}<div><b>{b}</b><span>{d}</span></div>{right}</div>'
AV = lambda x: f'<span class="ap-av">{x}</span>'; CK = '<span class="ap-ck"></span>'

# 1. where the jobs go: a funnel, with three lines leaving through its side
import sys; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); import home_art as ART
TOT = '$0|$2,400|$2,400|$5,500|$5,500|$6,400'
WHERE = ax('long', 6, 'The audit', 'Where the jobs go.', 'Most businesses lose them at the same few points. The audit finds yours and puts a dollar number on each.', BOOK, ART.funnel(), 'c',
  extra=f'<p class="ax-tot"><span>Leaking every month, example business</span><b data-v="{TOT}">$6,400</b></p>', tag='h2', sid=' id="leaks"', panel='ill', small='<small>Illustration. Sample findings; your audit uses your own numbers.</small>')

# 2. the audit: six layers, drawn as plain line geometry
LAYERS = [('Answering', 'What a new customer gets when they call or write after hours.'), ('Booking', 'How many steps sit between “I’m interested” and a time on your calendar.'), ('Quote follow-up', 'What happens to a quote after it’s sent, and how many went quiet.'), ('Invoices', 'How long a finished job takes to get paid, and what’s late.'), ('Reviews', 'How many finished jobs turned into a review.'), ('Website', 'Whether your site turns a visitor into a call, tested on a phone.')]
def stack():
    cx, a, b, th, gap, y0 = 236, 168, 84, 12, 70, 104; g = []
    for i in reversed(range(6)):
        cy = y0 + i * gap; ia, ib = a * .4, b * .4
        g.append(f'<g class="pl" data-is="{i}"><g class="pl-m"><path d="M{cx - a},{cy} L{cx},{cy + b} L{cx + a},{cy} v{th} L{cx},{cy + b + th} L{cx - a},{cy + th} Z"/><path d="M{cx},{cy - b} L{cx + a},{cy} L{cx},{cy + b} L{cx - a},{cy} Z"/><path d="M{cx},{cy + b} v{th}"/><path class="pl-i" d="M{cx},{cy - ib} L{cx + ia},{cy} L{cx},{cy + ib} L{cx - ia},{cy} Z"/></g><path class="pl-ld" d="M{cx + a + 10},{cy + 6} H{cx + a + 44}"/><text x="{cx + a + 56}" y="{cy + 10}">{i + 1:02d}  {LAYERS[i][0]}</text></g>')
    return '<svg class="lnv" viewBox="0 0 620 590" role="img" aria-label="Six layers of a service business drawn as a stack of outlined plates: answering, booking, quote follow-up, invoices, reviews and website. The audit pulls each one out in turn."><title>The six layers the audit checks</title>' + ''.join(g) + '</svg>'
AUDIT = ax('rev one long', 6, 'Step one', 'First, a free audit.', 'We go through your business layer by layer and find what is costing you jobs. You keep the plan, whether or not you work with us.', BOOK, stack(), 'a', tag='h2', sid=' id="inside"', panel='line', small='')

# 3. speed to lead
SPEED = ax('', 4, 'Front desk', 'New leads hear back in seconds.', [('A reply in seconds.', 'A form, a text or a missed call gets an answer by text, in your business’s name.', 1), ('They pick the time.', 'The reply offers openings from your real calendar. No phone tag.', 2), ('It lands booked.', 'The estimate is on your calendar with the address and the job on it.', 3)], '/answering|How answering works', ART.reply(), 'b', panel='ill', small='')

# 4. the calendar screen
def col(jobs):
    return '<div class="cal-col">' + ''.join(f'<div class="cal-jb {c}" style="top:{a}%;height:{h}%">{x}</div>' for a, h, x, c in jobs) + '</div>'
# The calendar screen, with pieces of the app popping out of its edges instead of plain notes.
SIDE = '<aside class="cal-sb"><p class="cal-br">Cinder Revenue</p><p class="cal-bz">Ridgeline Fence<span>Example</span></p>' + ''.join(f'<span class="cal-nv{" on" if n == "Calendar" else ""}">{n}{f"<i>{c}</i>" if c else ""}</span>' for n, c in (('Today', ''), ('Inbox', '2'), ('Calendar', ''), ('Quotes', ''), ('Money', '2'))) + '<p class="cal-sd">Sample data</p></aside>'
POPS = [
  ('<p class="pp-l">Offered from your calendar</p><div class="pp-ch"><span class="k">Fri 8:00 AM</span><span>Mon 10:00 AM</span><span>Tue 2:00 PM</span></div>', 'Only your free times', 'It reads your calendar first, so nothing is offered that you cannot make.'),
  ('<p class="pp-l">Text, Dana Ruiz</p><div class="pp-m me">I can get you a free estimate. Fri 8:00 AM, Mon 10:00 AM or Tue 2:00 PM?</div><div class="pp-m">Friday at 8 works.</div>', 'The lead picks', 'Three times to choose from, by text. No phone tag.'),
  ('<div class="pp-r"><span class="pp-ck"></span><div><b>Estimate booked</b><span>Friday, 8:00 AM</span></div></div><div class="pp-kv"><span>Who</span><b>Dana Ruiz</b><span>Where</span><b>214 Alder St</b><span>Job</span><b>Cedar privacy fence, 120 ft</b></div>', 'It lands complete', 'The address and the job are on the booking when you open it.'),
  ('<p class="pp-l">Reminders, set when it booked</p><div class="pp-r"><span class="pp-dt"></span><div><b>The day before</b><span>Thursday, by text</span></div></div><div class="pp-r"><span class="pp-dt"></span><div><b>The morning of</b><span>Friday, by text</span></div></div>', 'Reminders set themselves', 'One the day before and one the morning of, from the moment it books.')]
CAL = ('<section class="pz"><div class="pz-in"><div class="pz-h"><div><p class="px-k"><i></i>Calendar</p><h3>The estimate lands on your calendar.</h3><p class="ax-s">The lead picks the time. You just show up.</p></div><div><a class="inl" href="/booking">How booking works</a></div></div><div class="pz-stage"><figure class="pz-fig" style="transform-origin:90% 22%"><div class="ap ap-cal" role="img" aria-label="The calendar screen in the app for one week. A new estimate with Dana Ruiz sits on Friday at 8:00 AM. Two other times that were offered are shown as open. Sample data.">' + SIDE + '<div class="cal-mn"><div class="cal-hd"><p class="ap-t">Calendar<span>This week</span></p><span class="ap-l">5 booked, 1 new</span></div><div class="cal-gr"><span class="cal-dy"></span>'
  + ''.join(f'<span class="cal-dy{" td" if d == "Fri" else ""}">{d}</span>' for d in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri')) + '<div class="cal-hr">' + ''.join(f'<span>{h}</span>' for h in ('8 AM', '9', '10', '11', '12 PM', '1', '2', '3')) + '</div>'
  + col([(1.5, 34, 'Install, Alder St', ''), (26, 10.5, 'Offered, 10:00 AM', 'open')]) + col([(13.5, 46, 'Install, Birch Ct', ''), (76, 10.5, 'Offered, 2:00 PM', 'open')]) + col([(1.5, 22, 'Estimate', ''), (38.5, 36, 'Repair, Oak Ln', '')]) + col([(26, 46, 'Install, Pine Rd', '')]) + col([(1.5, 21, '<b>Estimate, Dana Ruiz</b>8:00 AM, 214 Alder St', 'new'), (38.5, 36, 'Install, Elm St', '')])
  + '</div></div></div></figure>' + ''.join(f'<div class="pz-b pz-b{i + 1}"><div class="pp">{card}</div><b>{b}</b><p>{d}</p></div>' for i, (card, b, d) in enumerate(POPS)) + '</div></div></section>')

# 5. the quote and its follow-up
QUOTE = ax('rev', 4, 'Quotes', 'No quote goes quiet.', 'Each one gets a check-in on day two and another on day five, and it stops the moment they say yes or no.', '/follow-up|How follow-up works', ART.quote(), 'a', panel='ill', small='')
# 6. the invoice
INVOICE = ax('', 3, 'Money', 'The invoice gets paid.', 'Sent the day the job ends and followed up until it is settled.', '/invoicing|How invoices work', ART.invoice(), 'c', panel='ill', small='')
# 7. the review
REVIEW = ax('', 3, 'After the job', 'Every job ends with a review request.', [('Asked the day after.', 'While the job is still fresh, not three weeks later.', 0), ('The review comes in.', 'On your Google profile, where the next customer looks.', 1), ('It gets a reply.', 'The same day, in your name.', 2)], '/reviews|How reviews work', ART.review(), 'b', panel='ill', small='')
# 8. something only your business has
CUSTOM = ax('', 4, 'Custom', 'Built around how you already work.', 'Tell us how the job gets done today and we build it step by step, with room for the next piece.', '/custom-builds|How custom builds work', ART.blocks(), 'a', panel='ill', small='')
# 9. what you get back: the day's work, stacking up
BACK = ax('', 5, 'What you get back', 'Most of the day is already done.', [('Answered.', 'New leads got a reply while you were on a job.', 0), ('Booked and followed up.', 'Estimates are on the calendar. Open quotes got their check-in.', 2), ('Reminded and asked.', 'Late invoices were nudged. Finished jobs were asked for a review.', 4), ('What’s left is yours.', 'The few things that need a person.', None)], '/software|See the software', ART.tower(), 'b', sid=' id="back"', panel='ill', small='')


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
ICONS = ART.icons()
G8 = [('Front desk', 'Every call, form and message gets an answer.'), ('Calendar', 'Estimates booked, reminded and kept.'), ('Quotes', 'Out the same day, and chased until answered.'), ('Money', 'Invoices sent and followed up until paid.'), ('After the job', 'Reviews, repeat work and referrals.'), ('Getting found', 'Your site and your Google profile, kept working.'), ('Team and office', 'Hiring, notes, reports and answers for the crew.'), ('Custom', 'Anything else that does not need a person.')]
# everything: one line and a link, the full list lives on its own page
s = re.sub(r'<section id="everything" class="ixs(?: min)?"', '<section id="everything" class="ixs min"', s, count=1)
k = s.index('</div>', s.index('class="ixs-h"', s.index('<section id="everything"'))) + 6
s = s[:k] + '<!--h2--><div class="g8">' + ''.join(f'<a href="/everything"><span>[{i + 1:02d}]</span><i class="g8-i">{ICONS[i]}</i><b>{n}</b><p>{d}</p></a>' for i, (n, d) in enumerate(G8)) + '</div><p class="sw-n"><span>Thirty-two builds so far. If yours is not on the list and it does not need a person, we can probably build it.</span><a class="btn ghost" href="/everything">See everything we build</a>' + CTA + '</p><!--/h2-->' + s[k:]
AC = '<!--h2--><section class="ac" id="call" aria-labelledby="h-call"><div class="wrap"><p class="px-k"><i></i>The free audit call</p><h2 id="h-call">Fifteen minutes. You leave with a plan.</h2><p class="sub">We can fix it. First we have to know what it is, and that is what the call is for.</p><div class="ac-t" aria-hidden="true"><u></u><b></b></div><div class="ac-g"><div><span>First</span><b>You tell us where it hurts.</b><p>Missed calls, slow weeks, quotes that vanish. Whatever is costing you.</p></div><div><span>Then</span><b>We walk a job with you.</b><p>From the first call to the review, looking for where jobs slip and what each leak is worth.</p></div><div><span>Before you hang up</span><b>You get the plan.</b><p>What to fix first, in order. It is yours to keep, whether or not you work with us.</p></div></div><div class="ac-f"><p><b>Bring rough numbers.</b> Leads a month, your average job, and how many quotes you close.</p>' + CTA + '</div></div></section><!--/h2-->\n'
ins('<section class="closing"', AC)
if 'home2.css' not in s: s = s.replace('</head>', '<link rel="stylesheet" href="/assets/home2.css">\n</head>', 1)
for tag in ('<script src="/assets/cinder-builds.js" defer></script>\n', '<script src="/assets/cinder-builds2.js" defer></script>\n', '<script src="/assets/cinder-figs.js" defer></script>\n', '<script src="/assets/home2.js" defer></script>\n'): s = s.replace(tag, '')
s = s.replace('<script src="/assets/cinder-chat.js" defer></script>', '<script src="/assets/cinder-builds.js" defer></script>\n<script src="/assets/cinder-builds2.js" defer></script>\n<script src="/assets/cinder-figs.js" defer></script>\n<script src="/assets/home2.js" defer></script>\n<script src="/assets/cinder-chat.js" defer></script>', 1)
f.write_text(s); print('home:', ' > '.join(a or b.split()[0] + ('.' + b.split()[1] if len(b.split()) > 1 else '') for a, b in re.findall(r'<section (?:id="([a-z]+)"|class="([a-z0-9 -]+)")', s)))
