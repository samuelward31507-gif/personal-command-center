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
# order: leaks, problem, inside, build, back, everything
if s.index('<section id="inside"') < s.index('<section id="leaks"'): move_before('<section id="inside"', '<section id="build"')
if s.index('<section id="back"') > s.index('<section id="everything"'): move_before('<section id="back"', '<section id="everything"')
def hb(n, kind, label, title, ribbon=None):
    return ''  # the chapter bands are off the page
    rb = f'<div class="backdrop" data-flow="wave" data-v="{ribbon}"></div>' if ribbon is not None else ''
    return f'<!--h2--><section class="hb hb-{kind}" aria-label="{label}"><div class="hb-l" aria-hidden="true">{n:02d}</div><div class="hb-r">{rb}<p>{label}</p><h2>{title}</h2></div></section><!--/h2-->\n'
def ins(before, html):
    global s
    k = s.index(before); s = s[:k] + html + s[k:]
ins('<section id="leaks"', hb(1, 'c', 'The problem', 'Jobs don’t vanish. They slip, in the same few places.', 3))
ins('<section id="inside"', hb(2, 'a', 'How we work', 'Audit first. Then we build only what it calls for.'))
def px(slug, span, cls, k, h3, p, steps, href, more, aria):
    return f'<section class="px {cls}" data-scrub="{slug}" data-span="{span}"><div class="px-in"><div class="px-copy"><p class="px-k"><i></i>{k}</p><h3>{h3}</h3><ol class="px-steps">{"".join(f"<li>{x}</li>" for x in steps)}</ol><a class="inl" href="{href}">{more}</a></div><div class="px-vis"><div class="px-host" role="img" aria-label="{aria}"></div></div></div></section>'
def pb(cls, fig, k, h3, p, href, more, aria, cap):
    return f'<section class="pb {cls}"><div class="wrap"><div class="pb-h"><div><p class="px-k"><i></i>{k}</p><h3>{h3}</h3></div><div><a class="inl" href="{href}">{more}</a></div></div><figure class="pb-f"><div class="hf" data-fig="{fig}" role="img" aria-label="{aria}"></div><figcaption><span>{cap}</span><span>Sample data</span></figcaption></figure></div></section>'
IT = [
 px('speed', 1, '', 'Front desk', 'A new lead hears back in seconds. <em>By text, with times to pick from, while they are still looking.</em>', 'A form, a message or a missed call. They get a reply by text while they are still looking, with times to pick from.', ['A lead comes in', 'A reply goes out in seconds', 'They pick a time before anyone else answers'], '/answering', 'How answering works', 'Two timelines from the moment a lead comes in. With it: a reply in nine seconds, a time picked, an estimate booked inside a minute. Without it: voicemail, and a call back that evening, after they booked someone else.'),
 '<section class="pz"><div class="pz-in"><div class="pz-h"><div><p class="px-k"><i></i>Calendar</p><h3>The estimate lands on your calendar. <em>The lead picks the time. You just show up.</em></h3></div><div><a class="inl" href="/booking">How booking works</a></div></div><div class="pz-stage"><figure class="pz-fig"><div class="hf" data-fig="week" role="img" aria-label="A working week on a calendar. Three open times are offered, one becomes a booked estimate, and two reminders are set for it."></div></figure>' + ''.join(f'<div class="pz-b pz-b{i + 1}"><span>{i + 1:02d}</span><b>{b}</b><p>{d}</p></div>' for i, (b, d) in enumerate([('Only your free times', 'It reads your calendar first, so nothing is offered that you cannot make.'), ('The lead picks', 'Three times to choose from, by text. No phone tag.'), ('It lands complete', 'The address and the job are on the booking when you open it.'), ('Reminders set themselves', 'One the day before and one the morning of, from the moment it books.')])) + '</div></div></section>',
 px('stack', 1, 'wide', 'Quotes', 'A quote gets chased until there is an answer. <em>Each check-in lands on the last, and it stops at yes or no.</em>', 'Each check-in lands on top of the last. It stops the moment they say yes or no.', ['Quote sent', 'Day 2 check-in', 'Day 5 check-in', 'Signed'], '/follow-up', 'How follow-up works', 'Four sheets stack on top of each other: the quote, a check-in on day 2, a check-in on day 5, and the signed quote on top.'),
 px('invoice', 1, 'rev', 'Money', 'The invoice gets paid. <em>Sent the day the job ends, followed up until it is settled.</em>', 'It goes out the day the job ends. Reminders run until it is settled, then stop on their own.', ['Sent the day the job ends', 'A reminder on day 3', 'Paid on day 4, reminders stop'], '/invoicing', 'How invoices work', 'An invoice on the left and a timeline on the right: sent the same day, one reminder on day 3, paid on day 4, and the day 7 reminder cancelled.'),
 pb('pop', 'ratings', 'After the job', 'Every finished job gets asked for a review. <em>Most happy customers never leave one, because nobody asks.</em>', 'Most happy customers never leave one, because nobody asks.', '/reviews', 'How reviews work', 'Five stars filling in above a grid of finished jobs. Each job is asked for a review and most of them leave one.', 'Asked once, at the right moment.'),
 px('custom-builds', 1, 'wide', 'Custom', 'Something only your business has. <em>Describe how you do it today and we build it, step by step.</em>', 'Describe how you do it today. We turn each step into a part, and leave room for the next one.', ['How you do it today', 'Built, step by step', 'Yours next'], '/custom-builds', 'How custom builds work', 'Four steps of a process, drawn as dashed boxes, each become a built module. A fifth slot is left open, marked yours next.'),
]
TK = '<div class="tk" aria-hidden="true"></div>'
W = lambda x: '<!--h2-->' + TK + x + '<!--/h2-->\n'
# 3D and diagrams take turns: audit (3D), a missed call (2D), the patch bay (3D), calendar and quote (2D), the dial (3D), invoice, reviews, custom (2D)
ins('<section id="build"', hb(3, 'b', 'What we fix', 'Whatever is slowing you down, there is a build for it.', 9) + W(IT[0]))
ins('<section id="back"', W(IT[1]) + W(IT[2]))
ins('<section id="everything"', W(IT[3]) + W(IT[4]) + W(IT[5]))
for sel in ('<section id="leaks"', '<section id="inside"', '<section id="build"', '<section id="back"', '<section id="everything"'): ins(sel, '<!--h2-->' + TK + '<!--/h2-->\n')
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
