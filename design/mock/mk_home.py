#!/usr/bin/env python3
"""Builds design/mock/home-light.html: approved hero + tools grid + problem statement + first leak block."""
import json, math, random, re, sys

ROOT = '/home/claude/personal-command-center'  # repo root
import os
HERE = os.path.dirname(os.path.abspath(__file__))
tools = json.load(open(HERE + '/tools.json'))
fav = open(ROOT + '/site/assets/favicon.svg').read()
mark = re.sub(r'<style>.*?</style>', '', fav, flags=re.S).replace('class="m"', 'fill="currentColor"').replace('<svg ', '<svg class="mk" aria-hidden="true" ')

hero = open(ROOT + '/design/mock/hero-light.html').read()
hero_css = re.search(r'<style>(.*?)</style>', hero, re.S).group(1)
hero_body = re.search(r'(<section class="hero">.*?)</body>', hero, re.S).group(1)
CAL = 'href="https://cal.com/audit-call/15min" target="_blank" rel="noopener"'
hero_body = hero_body.replace('<a class="btn" href="#">Book your free audit</a>', '<a class="btn" %s>Book your free audit</a>' % CAL)
hero_body = hero_body.replace('<a class="btn q" href="#">See what we check</a>', '<a class="btn q" href="/free-audit">See what we check</a>')

# ---------- tools grid ----------
ORDER = ['Google Calendar', 'Jobber', 'Gmail', 'Housecall Pro', 'Instagram',
         'QuickBooks', 'Facebook Lead Ads', 'Angi', 'Google Business Profile', 'Thumbtack']
cells = ''.join('<li>%s<span>%s</span></li>' % (tools.get(n, ''), n) for n in ORDER)
TOOLS = ('<section class="tl" aria-label="Works alongside the tools you already use"><div class="w tl-g">'
         '<p class="tl-c">Works alongside the tools you already use</p><ul>%s</ul></div></section>' % cells)

# ---------- problem statement ----------
PROB = ('<section class="st"><div class="w st-i"><span class="lb">The problem</span>'
        '<p class="st-t">The jobs you lose, you never hear about. '
        '<span>The caller who got voicemail doesn&rsquo;t ring back. The quote that went quiet doesn&rsquo;t remind you. '
        'They hire someone else, and your month looks normal.</span></p></div></section>')

# ---------- the chart: calls by day and hour ----------
DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
H0, H1 = 6, 22
rnd = random.Random(11)
office_cells = [(d, 8 + i * .5) for d in range(5) for i in range(18)]
picked = rnd.sample(office_cells, 62)
missed_office = set(rnd.sample(range(62), 5))
dots = [(d, h + .25, i in missed_office, False) for i, (d, h) in enumerate(picked)]
AFTER = [(0, 18.5, 1), (1, 7.0, 0), (1, 19.0, 1), (2, 17.5, 0), (3, 20.0, 1), (4, 18.0, 0), (4, 19.5, 1),
         (5, 9.5, 1), (5, 11.0, 0), (5, 19.7, 1), (6, 10.0, 1), (6, 16.0, 1)]
dots += [(d, h, bool(m), (d, h) == (5, 19.7)) for d, h, m in AFTER]
assert sum(1 for x in dots if x[2]) == 13 and len(dots) == 74


def pos(d, h):
    return 'left:%.2f%%;top:%.2f%%' % ((h - H0) / (H1 - H0) * 100, (d + .5) / 7 * 100)


dothtml = ''.join('<i class="%s%s" style="%s"></i>' % ('m' if m else 'a', ' hot' if hot else '', pos(d, h)) for d, h, m, hot in dots)
ticks = ''.join('<span style="left:%.2f%%">%s</span>' % ((h - H0) / (H1 - H0) * 100, lab)
                for h, lab in [(6, '6 AM'), (9, '9'), (12, '12 PM'), (15, '3'), (18, '6'), (21, '9 PM')])
vlines = ''.join('<s style="left:%.2f%%"></s>' % ((h - H0) / (H1 - H0) * 100) for h in (9, 12, 15, 18, 21))
CHART = ('<div class="cd ch"><div class="ch-h"><div><b>Calls by day and hour</b><span>Ridgeline Fence, last 30 days</span></div>'
         '<em>Example business, sample data</em></div>'
         '<div class="ch-k"><span><i class="a"></i>Answered</span><span><i class="m"></i>Missed</span><span><i class="x"></i>After hours</span></div>'
         '<div class="ch-p"><div class="ch-d">%s</div><div class="ch-a"><div class="ch-o"><span>Office hours</span></div>%s%s'
         '<b class="ch-t" style="%s">Sat 7:42 PM</b></div><div class="ch-x">%s</div></div></div>'
         % (''.join('<span>%s</span>' % d for d in DAYS), vlines, dothtml, pos(5, 19.7), ticks))

TALLY = ('<div class="cd ta"><div class="fk">After hours, last 30 days</div><div class="ta-t">12 calls. 8 missed.</div>'
         '<div class="ta-b">%s%s</div>'
         '<dl><div><dt>Called back within the hour</dt><dd>0</dd></div><div><dt>From new numbers</dt><dd>3</dd></div>'
         '<div><dt>Share of all missed calls</dt><dd>62%%</dd></div></dl></div>' % ('<i class="a"></i>' * 4, '<i class="m"></i>' * 8))

PHONE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 2.2 3.6 2.6c-.6.2-1 .8-.9 1.4.5 4.7 4.6 8.8 9.3 9.3.6.1 1.2-.3 1.4-.9l.4-1.6-2.7-1.5-1.2 1.2c-1.4-.7-2.7-2-3.4-3.4l1.2-1.2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="m10.2 2.6 3.2 3.2m0-3.2-3.2 3.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>'
LOGROWS = [('New number', 'Sat 7:42 PM', 'No call back', 'r'), ('New number', 'Sun 10:03 AM', 'No call back', 'r'),
           ('Existing customer', 'Mon 6:31 PM', 'Called back Tue 9:10 AM', 'y'), ('New number', 'Thu 8:04 PM', 'No call back', 'r')]
LOG = ('<div class="cd lg"><div class="lg-h"><b>Missed calls</b><span>After hours</span></div>%s</div>'
       % ''.join('<div class="lg-r"><u>%s</u><div><b>%s</b><span>%s</span></div><em class="%s">%s</em></div>' % (PHONE, a, b, c, t) for a, b, t, c in LOGROWS))

SUM = None  # built below, once summ() exists

# ---------- shared pieces for the leak blocks ----------
SAMPLE = 'Example business, sample data'


def head(title, sub='Ridgeline Fence, last 30 days'):
    return '<div class="ch-h"><div><b>%s</b><span>%s</span></div><em>%s</em></div>' % (title, sub, SAMPLE)


def tally(kick, title, viz, rows):
    return ('<div class="cd ta"><div class="fk">%s</div><div class="ta-t">%s</div>%s<dl>%s</dl></div>'
            % (kick, title, viz, ''.join('<div><dt>%s</dt><dd>%s</dd></div>' % r for r in rows)))


def pills(*groups):
    n = sum(c for c, _ in groups)
    return '<div class="ta-b" style="grid-template-columns:repeat(%d,1fr)">%s</div>' % (n, ''.join('<i class="%s"></i>' % k * c for c, k in groups))


def facts(title, tag, rows):
    """A small card of label/value rows; a row's third item is its tone (r, y, g or empty)."""
    return ('<div class="cd fc"><div class="lg-h"><b>%s</b><span>%s</span></div>%s</div>'
            % (title, tag, ''.join('<div class="fc-r"><span>%s</span><b class="%s">%s</b></div>' % (l, t, v) for l, v, t in rows)))


def summ(rows, total, tone='r'):
    op = any(x for _, _, x in rows)
    body = ''.join('<div class="sm-r"><span>%s%s</span><b>%s</b></div>' % (('<i>%s</i>' % ('&times;' if x else '')) if op else '', l, v) for l, v, x in rows)
    return '<div class="cd sm">%s<div class="sm-r t %s"><span>%s%s</span><b>%s</b></div></div>' % (body, tone, '<i></i>' if op else '', total[0], total[1])


def block(i, lead, rest, big, stat, how, howpic, cost, costpic):
    st = ('<div class="lk-f"><b>%s</b><p>%s</p><span>%s</span></div>' % stat) if stat else ''
    return ('<article class="lk-b" id="leak-%d"><div class="lk-s"><p class="bs">%s <span>%s</span></p></div>'
            '<div class="lk-p"><div class="lk-pi">%s</div></div>%s'
            '<div class="lk-2"><div><h3>How you&rsquo;d know.</h3><p>%s</p>%s</div>'
            '<div><h3>What it costs.</h3><p>%s</p>%s</div></div></article>' % (i, lead, rest, big, st, how, howpic, cost, costpic))


# ---------- 2: slow replies ----------
REPLIES = [('Website form', 4, 'Booked'), ('Facebook lead', 38, 'Booked'), ('Thumbtack', 65, 'Booked'), ('Website form', 192, 'Went cold'),
           ('Google message', 140, 'Booked'), ('Angi', 340, 'Went cold'), ('Facebook lead', 52, 'Booked'), ('Missed call', 1140, 'Went cold')]


def dur(m):
    return '%d min' % m if m < 60 else ('%d h' % (m // 60) if m % 60 == 0 else '%d h %02d min' % (m // 60, m % 60))


rp_rows = ''.join('<div class="rp-r%s"><span>%s</span><div class="rp-t"><u class="%s%s" style="width:%.1f%%"></u></div><b>%s</b><em class="%s">%s</em></div>'
                  % (' hot' if m == 192 else '', src, 'c' if out != 'Booked' else 'b', ' over' if m > 360 else '', min(100, m / 360 * 100), dur(m),
                     'r' if out != 'Booked' else 'g', out) for src, m, out in REPLIES)
RP = ('<div class="cd ch rp">%s<div class="ch-k"><span><i class="a"></i>Booked</span><span><i class="m"></i>Went cold</span><span><i class="five"></i>Five minutes</span></div>'
      '<div class="rp-b"><div class="rp-five"><span>5 min</span></div>%s</div>'
      '<div class="rp-x"><span>0</span><span>2 h</span><span>4 h</span><span>6 h+</span></div></div>' % (head('Time to first reply'), rp_rows))
RP_T = tally('First replies, last 30 days', '71 replies. 12 inside five minutes.',
             '<div class="ta-s"><i class="a" style="flex:12"></i><i class="l" style="flex:27"></i><i class="y" style="flex:32"></i></div>',
             [('Under five minutes', '12'), ('Under an hour', '27'), ('Over an hour', '32')])
RP_A = facts('Website form', 'Tuesday', [('Form received', '10:14 AM', ''), ('First reply', '1:26 PM', ''), ('Waited', '3 h 12 min', 'y')])
RP_B = ('<div class="cd bk"><div class="lg-h"><b>Booked, by reply time</b><span>71 leads</span></div>%s</div>'
        % ''.join('<div class="bk-r"><span>%s</span><div><u style="width:%d%%"></u></div><b>%d of %d</b></div>' % (l, round(a_ / n * 100), a_, n)
                  for l, a_, n in [('Under five minutes', 11, 12), ('Under an hour', 23, 27), ('Over an hour', 24, 32)]))

# ---------- 3: quotes that go quiet ----------
# (number, job, last day shown, opened on days, follow-ups on days, signed)
QUOTES = [('#1038', 'Chain link, 80 ft', 3, [1], [2], True), ('#1039', 'Gate repair', 6, [0], [2, 5], True),
          ('#1040', 'Vinyl privacy, 150 ft', 12, [1, 4], [], False), ('#1041', 'Cedar picket', 11, [], [], False),
          ('#1042', 'Cedar fence, 120 ft', 9, [1, 3], [], False), ('#1043', 'Pool fence', 2, [0], [1], True),
          ('#1044', 'Farm fence, 400 ft', 6, [2], [], False)]


def qx(d):
    return '%.2f%%' % (d / 14 * 100)


def qrow(n, job, last, opens, fups, signed):
    marks = '<i class="s" style="left:0"></i>' + ''.join('<i class="o" style="left:%s"></i>' % qx(d + .35) for d in opens)
    marks += ''.join('<i class="f" style="left:%s"></i>' % qx(d) for d in fups)
    marks += '<i class="%s" style="left:%s"></i>' % ('g' if signed else 'e', qx(last))
    tag = ('g', 'Signed') if signed else (('r', 'Going cold') if last >= 9 else ('y', 'No follow-up'))
    return ('<div class="qt-r%s"><span><b>%s</b>%s</span><div class="qt-t"><u class="%s" style="width:%s"></u>%s</div><em class="%s">%s</em></div>'
            % (' hot' if n == '#1042' else '', n, job, 'ok' if signed else 'no', qx(last), marks, tag[0], tag[1]))


QT = ('<div class="cd ch qt">%s<div class="ch-k"><span><i class="s"></i>Sent</span><span><i class="o"></i>Opened</span><span><i class="f"></i>Follow-up</span><span><i class="g"></i>Signed</span></div>'
      '<div class="qt-b">%s</div><div class="qt-x"><span>Sent</span><span>Day 4</span><span>Day 8</span><span>Day 12</span></div></div>'
      % (head('Quotes since they were sent'), ''.join(qrow(*q) for q in QUOTES)))
QT_T = tally('Quotes, last 30 days', '19 not signed. 13 never chased.', pills((6, 'a'), (13, 'y')),
             [('Opened at least once', '9 of 13'), ('Average age', '8 days'), ('Worth', '$31,000')])
QT_A = facts('Quote #1042', 'Cedar fence, 120 ft', [('Sent', 'Nine days ago', ''), ('Opened', 'Twice', ''), ('Follow-ups', 'None', 'y')])
QT_B = summ([('Quotes with no follow-up', '13', False), ('Worth', '$31,000', False), ('Come back with a check-in', '1 in 10', True)], ('Lost a month', '$3,100'))

# ---------- 4: late invoices ----------
AGE = [('Not invoiced yet', 2100, '1 job', 'x'), ('Under 2 weeks', 5400, '3 jobs', 'a'),
       ('2 to 4 weeks', 3100, '1 job', 'y'), ('Over 30 days', 4000, '2 jobs', 'm')]
IV = ('<div class="cd ch iv">%s<div class="iv-b">%s</div></div>'
      % (head('Finished and unpaid', 'Ridgeline Fence, by how long it has waited'),
         ''.join('<div><div class="iv-c"><u class="%s" style="height:%d%%"><b>$%s</b></u></div><span>%s</span><em>%s</em></div>'
                 % (k, round(v / 5400 * 100), format(v, ','), l, j) for l, v, j, k in AGE)))
IV_T = tally('Money owed to you, today', '$14,600 waiting.', pills((1, 'x'), (3, 'a'), (1, 'y'), (2, 'm')),
             [('Days from finished to invoiced', '6'), ('Reminders sent', '0'), ('Oldest invoice', '41 days')])
IV_A = facts('Cedar fence, 120 ft', 'One job', [('Finished', 'Fri, Oct 9', ''), ('Invoice sent', 'Thu, Oct 15', ''), ('Paid', 'Not yet, 27 days', 'y')])
IV_B = summ([('Finished, not invoiced', '$2,100', False), ('Invoiced, not paid', '$12,500', False)], ('Waiting on money', '$14,600'), 'y')

# ---------- 5: no reviews ----------
STAR = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m6 1.2 1.45 3 3.3.45-2.4 2.3.6 3.25L6 8.65 3.05 10.2l.6-3.25-2.4-2.3 3.3-.45z" fill="currentColor"/></svg>'
tiles = ''.join('<i class="%s">%s</i>' % (('v', STAR) if j in (4, 13, 27) else (('k', '') if j in (9, 22) else ('', ''))) for j in range(34))
RV = ('<div class="cd ch rv">%s<div class="ch-k"><span><i class="v"></i>Left a review</span><span><i class="k"></i>Asked, no review</span><span><i class="n"></i>Never asked</span></div>'
      '<div class="rv-g">%s</div><div class="rv-c"><div class="fk">Search: fence company near me</div>'
      '<div class="rv-r"><span>Top result</span><div><u style="width:100%%"></u></div><b>212 reviews</b></div>'
      '<div class="rv-r you"><span>Ridgeline Fence</span><div><u style="width:18%%"></u></div><b>38 reviews</b></div></div></div>'
      % (head('Finished jobs and reviews'), tiles))
RV_T = tally('Reviews, last 30 days', '34 jobs. 3 reviews.',
             '<div class="ta-s"><i class="a" style="flex:3"></i><i class="l" style="flex:2"></i><i class="x" style="flex:29"></i></div>',
             [('Asked for a review', '5'), ('Never asked', '29'), ('Left one when asked', '3 of 5')])
RV_A = facts('Last month', 'Your count', [('Jobs finished', '34', ''), ('Asked for a review', '5', ''), ('Reviews received', '3', 'y')])
RV_B = summ([('Finished jobs never asked', '29', False), ('Leave one when asked', '3 in 5', True)], ('Reviews missed a month', 'About 17'), 'y')

SUM = summ([('New callers who got no answer', '3', False), ('Leads that become jobs', '1 in 3', True), ('Average job', '$2,400', True)], ('Lost a month', '$2,400'))
LEAKS = ['After-hours calls', 'Slow replies', 'Quotes that go quiet', 'Late invoices', 'No reviews']
BLOCKS = [
    block(1, 'The call you never knew about.', 'Saturday, 7:42 PM: a homeowner gets your voicemail and calls the next company on the list.',
          CHART + TALLY, ('78%', 'of people have taken their business elsewhere after a company didn&rsquo;t pick up.', 'CallRail survey of 1,000 consumers, 2025'),
          'Open your call log and count the calls after five and on weekends. Then count how many got a call back within the hour.', LOG,
          'New callers who got no answer, times how often you win the job, times what a job is worth. The audit runs it on your numbers.', SUM),
    block(2, 'The lead that waited three hours.', 'A form comes in at 10:14. You&rsquo;re on a job until one. By then someone else has already replied.',
          RP + RP_T, ('21&times;', 'more likely to qualify a lead when you reach them within 5 minutes instead of 30.', 'MIT / InsideSales lead response study'),
          'Take last week&rsquo;s leads. Write down when each one came in and when someone first replied. The gap is your number.', RP_A,
          'Leads that wait book less often. The audit splits yours by how fast they heard back and shows the booking rate for each.', RP_B),
    block(3, 'The quote nobody chased.', 'It went out nine days ago and they&rsquo;ve opened it twice. Nobody checked in, so it&rsquo;s still sitting there.',
          QT + QT_T, None,
          'Open the quotes you sent last month. Count the ones with no answer from them and no follow-up from you.', QT_A,
          'Add up what those quotes are worth, then take the share a simple check-in would bring back. The audit does both.', QT_B),
    block(4, 'The job that&rsquo;s done and not paid.', 'The work finished on a Friday. The invoice went out the next Thursday, and nobody has brought it up since.',
          IV + IV_T, None,
          'List the jobs you finished last month. Next to each, write the day the invoice went out and the day the money arrived.', IV_A,
          'This one isn&rsquo;t lost, it&rsquo;s late. It&rsquo;s your money sitting in someone else&rsquo;s account while you pay for materials.', IV_B),
    block(5, 'The happy customer nobody asked.', 'They said it looked great at the gate. Nobody sent the link, so Google never heard about it.',
          RV + RV_T, None,
          'Count the jobs you finished last month and the reviews you got. Then search your trade and town and count theirs.', RV_A,
          'A homeowner choosing between two companies sees the review counts side by side. The audit works out how many you missed.', RV_B),
]
LK = ('<section class="lk"><div class="w lk-g"><aside class="lk-n"><ul>%s</ul></aside><div class="lk-m">%s</div></div></section>'
      % (''.join('<li%s><a href="#leak-%d">%s</a></li>' % (' class="on"' if i == 0 else '', i + 1, n) for i, n in enumerate(LEAKS)), ''.join(BLOCKS)))

# ---------- the clock: light to dark through the dial ----------
def tick(i, r0, r1, col):
    a = math.radians(i * 6)
    return '<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f" stroke="%s"/>' % (r0 * math.sin(a), -r0 * math.cos(a), r1 * math.sin(a), -r1 * math.cos(a), col)


outer = ''.join(tick(i, 86 if i % 5 == 0 else 91, 95, 'rgba(255,255,255,.82)' if i % 5 == 0 else 'rgba(255,255,255,.3)') for i in range(60))
inner = ''.join(tick(i, 93 if i % 5 == 0 else 96.5, 100,
                     ('#6d9bff' if i % 5 == 0 else 'rgba(109,155,255,.75)') if i <= 15 else ('rgba(255,255,255,.62)' if i % 5 == 0 else 'rgba(255,255,255,.28)'))
                for i in range(60))
FACE = ('<svg class="ck-face" viewBox="-100 -100 200 200" aria-hidden="true"><g class="ck-o">%s</g><g class="ck-i" transform="scale(.42)">%s</g>'
        '<g class="ck-h"><path class="ck-w" d="M0 0L0 -80A80 80 0 0 1 80 0Z"/><path class="ck-a" d="M0 -80A80 80 0 0 1 80 0"/>'
        '<line class="ck-n" x1="0" y1="0" x2="0" y2="-80" transform="rotate(90)"/><circle r="1.9" fill="#fff"/></g></svg>' % (outer, inner))
CK = ('<section class="ck"><div class="ck-pin"><div class="ck-top"><span class="lb">Where to start</span>'
      '<p class="st-t">Fifteen minutes to find yours. <span>One call. We ask how leads reach you and what happens after, then put a number on each leak.</span></p>'
      '<a class="btn" %s>Book your free audit</a></div>'
      '<div class="ck-dark">%s<div class="ck-count">15:00</div>'
      '<div class="ck-title"><span>It starts with</span><h2>The free audit</h2></div></div></div></section>' % (CAL, FACE))

IC = {
 'call': '<path d="M7.6 3.6 5.4 4.2c-.8.2-1.3 1-1.2 1.8.7 6.3 6.2 11.7 12.4 12.4.9.1 1.6-.4 1.9-1.2l.6-2.2-3.7-2-1.6 1.6c-1.9-1-3.6-2.7-4.6-4.6l1.6-1.6z"/><path d="m15 4 4.5 4.5m0-4.5L15 8.5"/>',
 'time': '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.6 1.7M9.5 2.8h5"/>',
 'quote': '<path d="M6.5 3.5h8l3.5 3.5v13.5h-11.5z"/><path d="M14.5 3.5V7H18M9.5 11.5h5.5M9.5 15h3.5"/>',
 'money': '<rect x="3.5" y="6" width="17" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
 'star': '<path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',
}
PTS = [('call', 'Missed calls.', 'We count the calls nobody answered last month.'),
       ('time', 'First replies.', 'We time how long a new lead waits to hear back.'),
       ('quote', 'Open quotes.', 'We count the quotes that never got a follow-up.'),
       ('money', 'Unpaid work.', 'We total the finished jobs still waiting on money.'),
       ('star', 'Reviews.', 'We compare jobs finished with reviews asked for.')]
AU = ('<section class="au"><div class="w au-g">%s</div><div class="w au-e"></div></section>'
      % ''.join('<div><svg viewBox="0 0 24 24" aria-hidden="true">%s</svg><h3>%s</h3><p>%s</p></div>' % (IC[k], t, p) for k, t, p in PTS))

JS = r"""
(function(){
var items=[].slice.call(document.querySelectorAll('.lk-n li')),blocks=[].slice.call(document.querySelectorAll('.lk-b')),strip=document.querySelector('.lk-n ul'),at=0,tick=false;
if(!items.length)return;
function pick(){tick=false;var line=innerHeight*.42,n=0;for(var i=0;i<blocks.length;i++){if(blocks[i].getBoundingClientRect().top<=line)n=i}
if(n===at)return;items[at].classList.remove('on');items[n].classList.add('on');at=n;
if(strip.scrollWidth>strip.clientWidth+4){var el=items[n];strip.scrollTo({left:el.offsetLeft-20,behavior:'smooth'})}}
addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(pick)}},{passive:true});addEventListener('resize',pick);pick();
})();

(function(){
var ck=document.querySelector('.ck'),top=document.querySelector('.top'),au=document.querySelector('.au');if(!ck)return;
var q=location.search,force=/[?&]motion=on/.test(q),snap=/[?&]snap=1/.test(q),band=ck.querySelector('.ck-dark'),cur=-1,dk=false;
if(matchMedia('(prefers-reduced-motion: reduce)').matches&&!force){onscroll=nav;nav();return}
ck.classList.add('on');
var pin=ck.querySelector('.ck-pin'),txt=ck.querySelector('.ck-top'),inner=ck.querySelector('.ck-i'),hands=ck.querySelector('.ck-h'),
wedge=ck.querySelector('.ck-w'),arc=ck.querySelector('.ck-a'),needle=ck.querySelector('.ck-n'),count=ck.querySelector('.ck-count'),title=ck.querySelector('.ck-title');
var vw,vh,R0,R1;
function cl(x){return x<0?0:x>1?1:x}
function ez(x){return x*x*(3-2*x)}
function measure(){vw=document.documentElement.clientWidth;vh=innerHeight;R0=Math.min(vh*.22,vw*.36,240);R1=Math.hypot(vw/2,vh/2)*1.03;
inner.setAttribute('transform','scale('+Math.min(.8,.44*vh/R1).toFixed(4)+')');cur=-1}
function target(){var r=ck.getBoundingClientRect();return cl((vh*.85-r.top)/(vh*.85))+cl(-r.top/(r.height-vh))}
function nav(){var a=au.getBoundingClientRect(),c=ck.getBoundingClientRect(),o=ck.classList.contains('on'),k=band.getBoundingClientRect(),d=(a.top<34&&a.bottom>34)||(o&&cur>1.8&&c.bottom>34)||(!o&&k.top<34&&k.bottom>34);
if(d!==dk){dk=d;top.classList.toggle('dk',d)}}
function draw(v){var a=ez(cl(v)),p=cl(v-1),th=a*Math.PI/2,x=(80*Math.sin(th)).toFixed(2),y=(-80*Math.cos(th)).toFixed(2);
needle.setAttribute('transform','rotate('+(a*90).toFixed(2)+')');
if(a>.004){wedge.setAttribute('d','M0 0L0 -80A80 80 0 0 1 '+x+' '+y+'Z');arc.setAttribute('d','M0 -80A80 80 0 0 1 '+x+' '+y)}
wedge.style.opacity=arc.style.opacity=a>.004?1:0;
var sec=Math.round(a*900),m=Math.floor(sec/60),s2=sec%60;count.textContent=(m<10?'0':'')+m+':'+(s2<10?'0':'')+s2;
var g=cl(p/.86),e=Math.pow(g,1.5),r=R0*Math.pow(R1/R0,e),cy=(.66-.16*ez(cl(p/.5)))*vh;
if(g>=1)r=R1*1.02;
pin.style.setProperty('--r',r.toFixed(1)+'px');pin.style.setProperty('--cy',cy.toFixed(1)+'px');
txt.style.transform='translate3d(0,'+(-p*vh*.9).toFixed(1)+'px,0)';txt.style.opacity=(1-cl(p/.3)).toFixed(3);
var f=(1-cl((p-.04)/.26)).toFixed(3);hands.style.opacity=f;count.style.opacity=f;
var t=ez(cl((p-.58)/.26));title.style.opacity=t.toFixed(3);title.style.transform='translate3d(0,calc(-50% + '+((1-t)*44).toFixed(1)+'px),0)'}
function loop(){var t=target();if(cur<0||snap)cur=t;else cur+=(t-cur)*.17;if(Math.abs(t-cur)<.0004)cur=t;draw(cur);nav();requestAnimationFrame(loop)}
addEventListener('resize',measure);measure();loop();
})();
"""

CSS = r'''
/* ---- shared page frame ---- */
:root{--g:#fafafa;--ln:#e6e6e6;--pn:#f1f2f5;--g2:#6f7279;--g3:#c9cbd0;--pad:clamp(36px,3.05vw,58px)}
body{background:var(--g)}
.w{width:min(1390px,calc(100vw - 200px));margin:0 auto}
.mk{width:20px;height:20px;color:var(--ink)}
.top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.92);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid var(--ln)}
.nav{max-width:none;width:min(1390px,calc(100vw - 200px));padding:0 4px;height:clamp(60px,3.6vw,68px)}
.nav b{font-size:clamp(15px,.95vw,18px);gap:8px}.nav ul{font-size:clamp(14px,.84vw,16px);gap:clamp(26px,1.7vw,32px);color:var(--ink)}
.btn{height:clamp(34px,2.1vw,40px);font-size:clamp(13.5px,.84vw,16px);border-radius:clamp(9px,.55vw,11px);padding:0 clamp(13px,.74vw,14px)}
.heroband{background:#fff}
h1{font-size:clamp(40px,3.334vw,60px)}.sub{font-size:clamp(16px,1.05vw,19px)}
.hero{padding-top:clamp(76px,5.6vw,104px)}
@media(min-width:1700px){.ground{zoom:1.16}}
.lb{display:inline-flex;align-items:center;height:clamp(21px,1.22vw,23px);padding:0 7px;border-radius:6px;background:#e9eeff;color:#2a4ea8;font-size:clamp(12.5px,.76vw,14.5px);font-weight:500}
.cd{background:#fff;border-radius:12px;box-shadow:0 0 0 1px rgba(23,24,26,.06),0 1px 2px rgba(23,24,26,.04),0 14px 34px -22px rgba(30,40,80,.28)}
.fk{font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}

/* ---- tools grid ---- */
.tl{border-top:1px solid var(--ln);border-bottom:1px solid var(--ln)}
.tl-g{border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.tl-c{margin:0;padding:0 var(--pad);height:clamp(40px,2.75vw,52px);display:flex;align-items:center;font-size:clamp(13px,.8vw,15px);color:var(--g2);border-bottom:1px solid var(--ln)}
.tl ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,1fr)}
.tl li{height:clamp(74px,5.05vw,96px);display:flex;align-items:center;justify-content:center;gap:clamp(8px,.58vw,11px);font-weight:600;font-size:clamp(15px,1.03vw,19.5px);letter-spacing:-.015em;color:var(--ink);border-right:1px solid var(--ln);border-bottom:1px solid var(--ln)}
.tl li:nth-child(5n){border-right:0}.tl li:nth-child(n+6){border-bottom:0}
.tl li svg{width:clamp(18px,1.2vw,23px);height:clamp(18px,1.2vw,23px);flex:none}.tl li svg *{fill:currentColor}

/* ---- two-tone statement ---- */
.st-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(112px,8.4vw,160px) var(--pad) clamp(60px,4.3vw,82px)}
.st-t{margin:clamp(20px,1.5vw,28px) 0 0;max-width:21.6em;font-size:clamp(29px,2.08vw,39.5px);line-height:1.115;letter-spacing:-.028em;font-weight:500;color:var(--ink);text-wrap:pretty}
.st-t span{color:var(--g2)}

/* ---- the leaks: fixed list + blocks ---- */
.lk{border-top:1px solid var(--ln)}
.lk-g{display:grid;grid-template-columns:24.9% minmax(0,1fr);border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.lk-n{border-right:1px solid var(--ln)}
.lk-n ul{position:sticky;top:clamp(150px,11vw,210px);list-style:none;margin:clamp(84px,5.9vw,112px) 0 clamp(84px,5.9vw,112px);padding:0}
.lk-n li{position:relative;padding:0 var(--pad);height:clamp(31px,2vw,38px);display:flex;align-items:center;font-size:clamp(15px,.95vw,18px);font-weight:500;letter-spacing:-.012em;color:var(--g3)}
.lk-n li.on{color:var(--ink)}
.lk-s{padding:clamp(84px,5.9vw,112px) var(--pad) clamp(70px,4.9vw,94px)}
.bs{margin:0;max-width:20.5em;font-size:clamp(19px,1.265vw,24px);line-height:1.16;letter-spacing:-.02em;font-weight:500;color:var(--ink);text-wrap:pretty}
.bs span{color:var(--g2)}
.lk-p{background:var(--pn);border-top:1px solid var(--ln);border-bottom:1px solid var(--ln);padding:clamp(52px,3.9vw,74px) 0;display:flex;justify-content:center}
.lk-pi{position:relative;width:812px}
@media(min-width:1700px){.lk-pi,.lg,.sm,.fc,.bk{zoom:1.1}}
@media(max-width:1300px){.lk-pi{zoom:.86}}

.ch{width:640px;padding:18px 22px 16px}
.ch-h{display:flex;justify-content:space-between;align-items:flex-start}
.ch-h b{display:block;font-size:15px;font-weight:600;letter-spacing:-.015em}.ch-h span{display:block;margin-top:2px;font-size:12.5px;color:var(--t3)}
.ch-h em{font:500 11px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3);padding-top:4px}
.ch-k{display:flex;gap:16px;margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:12.5px;color:var(--t2)}
.ch-k span{display:flex;align-items:center;gap:7px}.ch-k i{width:8px;height:8px;border-radius:50%}.ch-k .a{background:var(--blue)}.ch-k .m{background:var(--red)}
.ch-k .x{width:14px;height:10px;border-radius:3px;background:repeating-linear-gradient(135deg,#e4e6eb 0 2px,#f4f5f7 2px 5px)}
.ch-p{display:grid;grid-template-columns:40px 1fr;margin-top:14px}
.ch-d{display:grid;grid-template-rows:repeat(7,1fr);font-size:12px;color:var(--t3)}.ch-d span{display:flex;align-items:center}
.ch-a{position:relative;height:266px;border-radius:9px;background:repeating-linear-gradient(135deg,#eceef2 0 2px,#f7f8fa 2px 6px);box-shadow:inset 0 0 0 1px rgba(23,24,26,.05)}
.ch-o{position:absolute;left:12.5%;width:56.25%;top:0;height:71.43%;background:#fff;border-radius:9px 9px 8px 8px;box-shadow:0 0 0 1px rgba(23,24,26,.08)}
.ch-o span{position:absolute;left:9px;top:-19px;font-size:11.5px;color:var(--t3);display:none}
.ch-a s{position:absolute;top:0;bottom:0;width:1px;background:rgba(23,24,26,.045)}
.ch-a i{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%}
.ch-a i.a{background:var(--blue)}.ch-a i.m{background:var(--red)}
.ch-a i.hot{box-shadow:0 0 0 4px rgba(229,72,77,.18),0 0 0 9px rgba(229,72,77,.08)}
.ch-t{position:absolute;transform:translate(-50%,13px);height:22px;padding:0 8px;display:flex;align-items:center;border-radius:6px;background:var(--ink);color:#fff;font-size:11.5px;font-weight:520;white-space:nowrap}
.ch-t::after{content:"";position:absolute;left:50%;top:-3px;width:7px;height:7px;margin-left:-3.5px;background:var(--ink);transform:rotate(45deg);border-radius:1px}
.ch-x{grid-column:2;position:relative;height:22px;font-size:11.5px;color:var(--t3)}.ch-x span{position:absolute;top:8px;transform:translateX(-50%);white-space:nowrap}.ch-x span:first-child{transform:none}

.ta{position:absolute;right:0;top:92px;width:226px;padding:15px 16px 6px;box-shadow:0 0 0 1px rgba(23,24,26,.07),0 2px 4px rgba(23,24,26,.04),0 26px 50px -22px rgba(30,40,90,.38)}
.ta-t{margin-top:9px;font-size:16px;font-weight:600;letter-spacing:-.018em}
.ta-b{display:grid;grid-template-columns:repeat(12,1fr);gap:3px;margin-top:12px}.ta-b i{height:18px;border-radius:3px}.ta-b .a{background:var(--blue)}.ta-b .m{background:var(--red)}
.ta dl{margin:12px 0 0}.ta dl div{display:flex;justify-content:space-between;align-items:center;height:34px;border-top:1px solid var(--line);font-size:12.5px}
.ta dt{color:var(--t2)}.ta dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums}

.lk-f{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:clamp(16px,1.3vw,24px);padding:clamp(20px,1.5vw,28px) var(--pad);border-bottom:1px solid var(--ln)}
.lk-f b{font-size:clamp(26px,1.9vw,36px);font-weight:560;letter-spacing:-.035em;line-height:1}
.lk-f p{margin:0;max-width:27em;font-size:clamp(14.5px,.93vw,17.5px);line-height:1.3;color:var(--g2)}
.lk-f span{font:500 clamp(11px,.66vw,12.5px)/1.3 "Geist Mono",monospace;color:var(--t3);text-align:right}

.lk-2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.lk-2>div{padding:clamp(42px,2.95vw,56px) clamp(24px,1.6vw,30px) clamp(60px,4.4vw,84px)}
.lk-2>div+div{border-left:1px solid var(--ln)}
.lk-2>div{position:relative}.lk-2>div::after{content:"Sample data";position:absolute;left:clamp(24px,1.6vw,30px);bottom:clamp(20px,1.6vw,30px);font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}
.lk-2 h3{margin:0;font-size:clamp(15.5px,.95vw,18px);font-weight:500;letter-spacing:-.012em}
.lk-2 p{margin:4px 0 0;max-width:23em;font-size:clamp(15px,.9vw,17px);line-height:1.3;color:#8a8c92}
.lg,.sm{margin:clamp(32px,2.6vw,50px) auto 0;width:392px;max-width:100%}
.lg-h{display:flex;justify-content:space-between;align-items:center;height:42px;padding:0 15px;border-bottom:1px solid var(--line);font-size:13px}.lg-h b{font-weight:600}.lg-h span{color:var(--t3);font-size:12.5px}
.lg-r{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:11px;padding:0 15px;height:52px;border-bottom:1px solid var(--line)}.lg-r:last-child{border-bottom:0}
.lg-r u{width:28px;height:28px;border-radius:8px;background:#fdeceb;color:#d13c41;display:grid;place-items:center;text-decoration:none}.lg-r u svg{width:15px;height:15px}
.lg-r b{display:block;font-size:13.5px;font-weight:540;letter-spacing:-.008em}.lg-r span{display:block;font-size:12px;color:var(--t3)}
.lg-r em{font-style:normal;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;font-size:12px;font-weight:520;white-space:nowrap}
.lg-r em.r{background:#fdeaea;color:#c23b3f}.lg-r em.y{background:#fff4d6;color:#a86a00}
.sm{padding:4px 16px}
.sm-r{display:flex;justify-content:space-between;align-items:center;height:46px;border-bottom:1px solid var(--line);font-size:13.5px;color:var(--t2)}
.sm-r i{font-style:normal;display:inline-block;width:18px;color:var(--t3)}
.sm-r b{font-weight:560;color:var(--ink);font-variant-numeric:tabular-nums}
.sm-r.t{border-bottom:0;height:54px;color:var(--ink);font-weight:560}.sm-r.t b{font-size:19px;letter-spacing:-.02em;color:var(--red);font-weight:600}

/* ---- pieces shared by the leak pictures ---- */
html{scroll-behavior:smooth}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
.lk-b{scroll-margin-top:clamp(60px,3.6vw,68px)}.lk-b+.lk-b{border-top:1px solid var(--ln)}
.lk-n li a{display:flex;align-items:center;height:100%;transition:color .2s}.lk-n li:not(.on) a:hover{color:#8a8d93}
.lk-n li{transition:color .25s}.lk-n li::before{content:"";position:absolute;left:-1px;top:3px;bottom:3px;width:2px;background:var(--blue);opacity:0;transition:opacity .25s}.lk-n li.on::before{opacity:1}
.ta-b .y,.ta-s .y{background:var(--amber)}.ta-b .x{background:#d9dbe0}.ta-b .l,.ta-s .l{background:#a9c3f9}.ta-s .a{background:var(--blue)}.ta-s .x{background:#d9dbe0}
.ta-s{display:flex;gap:3px;margin-top:12px}.ta-s i{height:18px;border-radius:3px}
em.g,.tg-g{background:#e7f6ec;color:#1c7a43}em.r{background:#fdeaea;color:#c23b3f}em.y{background:#fff4d6;color:#a86a00}
.ch em.g,.ch em.r,.ch em.y{font-style:normal;display:inline-flex;align-items:center;justify-content:center;height:21px;padding:0 8px;border-radius:999px;font-size:11.5px;font-weight:520;white-space:nowrap;justify-self:end}
.fc,.bk{margin:clamp(32px,2.6vw,50px) auto 0;width:392px;max-width:100%}
.fc-r{display:flex;justify-content:space-between;align-items:center;height:46px;padding:0 15px;border-bottom:1px solid var(--line);font-size:13.5px;color:var(--t2)}.fc-r:last-child{border-bottom:0}
.fc-r b{font-weight:560;color:var(--ink);font-variant-numeric:tabular-nums}.fc-r b.y{color:#a86a00}.fc-r b.r{color:var(--red)}
.sm-r.t.y b{color:#a86a00}
.bk-r{display:grid;grid-template-columns:128px 1fr 62px;align-items:center;gap:12px;height:46px;padding:0 15px;border-bottom:1px solid var(--line);font-size:13px;color:var(--t2)}.bk-r:last-child{border-bottom:0}
.bk-r div{height:8px;border-radius:4px;background:#eef0f4;overflow:hidden}.bk-r u{display:block;height:100%;border-radius:4px;background:var(--blue)}
.bk-r b{text-align:right;font-weight:560;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
/* the four later charts leave room for the card beside them */
.rp,.qt,.iv,.rv{width:596px}
/* 2: time to first reply */
.ch-k .five{width:0;height:12px;border-radius:0;border-left:1.5px dashed var(--blue)}
.rp-b{position:relative;margin-top:14px;--c1:118px;--c3:82px;--c4:78px}
.rp-r{display:grid;grid-template-columns:var(--c1) 1fr var(--c3) var(--c4);align-items:center;height:33px;font-size:12.5px;color:var(--t2);border-radius:7px}
.rp-r.hot{background:#f6f7f9;box-shadow:0 0 0 6px #f6f7f9}
.rp-r>b{text-align:right;font-weight:540;color:var(--ink);font-variant-numeric:tabular-nums;padding-right:10px;white-space:nowrap}
.rp-t{height:10px;border-radius:5px;background:#f1f2f5}.rp-t u{display:block;min-width:7px;height:100%;border-radius:5px}.rp-t u.b{background:var(--blue)}.rp-t u.c{background:var(--red)}
.rp-t u.over{border-radius:5px 0 0 5px;-webkit-mask-image:linear-gradient(90deg,#000 86%,transparent);mask-image:linear-gradient(90deg,#000 86%,transparent)}
.rp-five{position:absolute;top:-4px;bottom:-4px;left:calc(var(--c1) + (100% - var(--c1) - var(--c3) - var(--c4))*.0139);border-left:1.5px dashed var(--blue);z-index:1}
.rp-five span{position:absolute;left:7px;top:-13px;font-size:11px;font-weight:540;color:var(--blue);white-space:nowrap;background:#fff;padding:0 3px;display:none}
.rp-x{position:relative;height:16px;margin:8px 160px 0 118px;font-size:11.5px;color:var(--t3)}.rp-x span{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap}.rp-x span:nth-child(1){left:0;transform:none}.rp-x span:nth-child(2){left:33.33%}.rp-x span:nth-child(3){left:66.67%}.rp-x span:nth-child(4){left:auto;right:0;transform:none}
/* 3: quotes since they were sent */
.ch-k .s{background:var(--ink)}.ch-k .o{background:#fff;box-shadow:inset 0 0 0 1.6px var(--amber)}.ch-k .f{background:var(--blue)}.ch-k .g{background:#2a9d5c}
.qt-b{margin-top:14px}
.qt-r{display:grid;grid-template-columns:170px 1fr 92px;align-items:center;height:37px;font-size:12.5px;color:var(--t2);border-radius:7px}
.qt-r.hot{background:#f6f7f9;box-shadow:0 0 0 6px #f6f7f9}
.qt-r>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qt-r>span b{font:500 11.5px/1 "Geist Mono",monospace;color:var(--t3);margin-right:8px}
.qt-t{position:relative;height:100%;margin:0 14px 0 6px}
.qt-t::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:repeating-linear-gradient(90deg,rgba(23,24,26,.1) 0 2px,transparent 2px 6px)}
.qt-t u{position:absolute;left:0;top:50%;height:2px;margin-top:-1px;border-radius:1px}.qt-t u.ok{background:#9bc6ad}.qt-t u.no{background:#f3cf7e}
.qt-t i{position:absolute;top:50%;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%}
.qt-t .s{background:var(--ink)}.qt-t .o{background:#fff;box-shadow:inset 0 0 0 1.6px var(--amber)}.qt-t .f{background:var(--blue);box-shadow:0 0 0 2px #fff}
.qt-t .g{width:15px;height:15px;margin:-7.5px 0 0 -7.5px;background:#2a9d5c url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 15 15'%3E%3Cpath d='m4.3 7.7 2.1 2.1 4.3-4.6' fill='none' stroke='%23fff' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/15px;box-shadow:0 0 0 2px #fff}
.qt-t .e{width:2px;height:11px;margin:-5.5px 0 0 -1px;border-radius:1px;background:var(--amber)}
.qt-x{display:grid;grid-template-columns:4fr 4fr 4fr 2fr;margin:6px 106px 0 176px;font-size:11.5px;color:var(--t3)}.qt-x span{white-space:nowrap}
/* 4: finished and unpaid */
.iv-b{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:20px;padding-top:16px;border-top:1px solid var(--line)}
.iv-c{height:196px;display:flex;align-items:flex-end;border-radius:9px;background:#f6f7f9}
.iv-c u{position:relative;display:block;width:100%;border-radius:9px;text-decoration:none}
.iv-c u.x{background:repeating-linear-gradient(135deg,#dfe2e8 0 2px,#eef0f4 2px 6px)}.iv-c u.a{background:var(--blue)}.iv-c u.y{background:var(--amber)}.iv-c u.m{background:var(--red)}
.iv-c u b{position:absolute;left:11px;top:10px;font-size:15px;font-weight:600;letter-spacing:-.02em;color:#fff;font-variant-numeric:tabular-nums}.iv-c u.x b{color:var(--ink)}
.iv-b span{display:block;margin-top:10px;font-size:12.5px;line-height:1.3;color:var(--ink);font-weight:520}.iv-b em{display:block;font-style:normal;font-size:12px;color:var(--t3)}
/* 5: finished jobs and reviews */
.ch-k .v{background:var(--blue)}.ch-k .k{background:#fff;box-shadow:inset 0 0 0 1.6px var(--blue)}.ch-k .n{background:#e3e5ea}
.rv-g{display:grid;grid-template-columns:repeat(17,1fr);gap:7px;margin-top:16px}
.rv-g i{aspect-ratio:1;border-radius:6px;background:#eceef2;display:grid;place-items:center;color:#fff}
.rv-g i.v{background:var(--blue)}.rv-g i.k{background:#fff;box-shadow:inset 0 0 0 1.6px var(--blue)}.rv-g svg{width:56%;height:56%}
.rv-c{margin-top:20px;padding-top:16px;border-top:1px solid var(--line)}
.rv-r{display:grid;grid-template-columns:118px 1fr 88px;align-items:center;gap:12px;height:32px;margin-top:6px;font-size:12.5px;color:var(--t2)}
.rv-r div{height:10px;border-radius:5px;background:#f1f2f5}.rv-r u{display:block;height:100%;border-radius:5px;background:#c9ccd3}.rv-r.you u{background:var(--blue)}
.rv-r b{text-align:right;font-weight:540;color:var(--ink);font-variant-numeric:tabular-nums}.rv-r.you span{color:var(--ink);font-weight:520}

/* ---- the clock: the page turns dark through the dial ---- */
:root{--dk:#101010;--dl:rgba(255,255,255,.1)}
.top{transition:background .3s,border-color .3s}.top .nav b,.top .nav ul,.top .mk,.top .btn{transition:color .3s,background .3s}
.top.dk{background:rgba(16,16,16,.9);border-color:var(--dl)}.top.dk .nav b,.top.dk .nav ul,.top.dk .mk{color:#fff}.top.dk .btn{background:#fff;color:var(--ink)}
.ck{position:relative;border-top:1px solid var(--ln)}
.ck-top{text-align:center;padding:clamp(88px,7.2vw,136px) 24px clamp(40px,3vw,56px)}
.ck-top .st-t{margin-left:auto;margin-right:auto;max-width:21em;font-size:clamp(26px,1.9vw,36px);text-wrap:balance}
.ck-top .btn{margin-top:clamp(22px,1.7vw,32px)}
.ck-dark{position:relative;background:var(--dk);color:#fff;text-align:center;padding:72px 0 88px}
.ck-face{display:block;width:300px;height:300px;margin:0 auto;overflow:visible}
.ck-face line,.ck-face path{vector-effect:non-scaling-stroke;stroke-width:1.1;fill:none}
.ck-face .ck-w{fill:rgba(77,134,247,.3);stroke:none}.ck-face .ck-a{stroke:#6d9bff;stroke-width:1.8}.ck-face .ck-n{stroke:#fff;stroke-width:1.5;stroke-linecap:round}
.ck-count{margin-top:-96px;height:96px;font:500 13px/1 "Geist Mono",monospace;letter-spacing:.02em;color:rgba(255,255,255,.72)}
.ck-title span{display:block;font-size:clamp(15px,.92vw,17.5px);color:#8f9197}
.ck-title h2{margin:clamp(6px,.5vw,10px) 0 0;font-size:clamp(46px,5.05vw,96px);line-height:1;font-weight:600;letter-spacing:-.045em}
.ck.on{height:235vh;height:calc(100svh + 135vh)}
.ck.on .ck-pin{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;--r:200px;--cy:66vh}
.ck.on .ck-pin::before,.ck.on .ck-dark::before{content:"";position:absolute;top:0;bottom:0;left:50%;width:min(1390px,calc(100vw - 200px));transform:translateX(-50%);border-left:1px solid var(--ln);border-right:1px solid var(--ln);pointer-events:none}
.ck.on .ck-dark::before{border-color:var(--dl)}
.ck.on .ck-top{position:absolute;left:0;right:0;top:0;padding-top:clamp(104px,14.5vh,170px);will-change:transform,opacity}
.ck.on .ck-dark{position:absolute;inset:0;padding:0;clip-path:circle(var(--r) at 50% var(--cy))}
.ck.on .ck-face{position:absolute;left:50%;top:var(--cy);width:calc(var(--r)*2);height:calc(var(--r)*2);margin:calc(var(--r)*-1) 0 0 calc(var(--r)*-1)}
.ck.on .ck-count{position:absolute;left:0;right:0;top:calc(var(--cy) + var(--r)*.5);margin:0;height:auto}
.ck.on .ck-title{position:absolute;left:0;right:0;top:50%;opacity:0;will-change:transform,opacity}
/* ---- the dark stretch: what the audit checks ---- */
.au{background:var(--dk);color:#fff;border-top:1px solid var(--dl)}
.au-g{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-left:1px solid var(--dl);border-right:1px solid var(--dl);border-bottom:1px solid var(--dl)}
.au-g>div{padding:clamp(22px,1.5vw,28px) clamp(20px,1.42vw,27px) clamp(30px,2.2vw,42px);min-height:clamp(180px,11.7vw,222px)}
.au-g>div+div{border-left:1px solid var(--dl)}
.au-g svg{width:clamp(20px,1.26vw,24px);height:clamp(20px,1.26vw,24px);fill:none;stroke:#a9abb0;stroke-width:1.4;stroke-linejoin:round;stroke-linecap:round;display:block}
.au-g h3{margin:clamp(44px,3.5vw,66px) 0 0;font-size:clamp(15px,.92vw,17.5px);font-weight:560;letter-spacing:-.012em}
.au-g p{margin:6px 0 0;font-size:clamp(14px,.84vw,16px);line-height:1.3;color:#8f9197;max-width:15em}
.au-e{height:clamp(120px,10vw,190px);border-left:1px solid var(--dl);border-right:1px solid var(--dl)}

/* ---- narrower screens ---- */
html,body{overflow-x:clip}
@media(max-width:1300px){.lk-f{grid-template-columns:auto minmax(0,1fr)}.lk-f span{grid-column:2;text-align:left}.lg,.sm,.fc,.bk{zoom:.9}}
@media(max-width:1180px){.w,.nav{width:calc(100vw - 64px)}.ck.on .ck-pin::before,.ck.on .ck-dark::before{width:calc(100vw - 64px)}.nav ul{display:none}}
@media(max-width:860px){
.w,.nav{width:calc(100vw - 32px)}:root{--pad:20px}
.hero{padding:52px 20px 0}h1{white-space:normal;font-size:35px;line-height:1.06;text-wrap:balance}.sub{font-size:16px}.stage{margin-top:36px}
.ground{height:auto;overflow:visible;padding:0 16px 28px}
.rep{position:relative;left:auto;top:auto;margin:0;width:100%;height:auto}
.rep-h{height:auto;flex-wrap:wrap;gap:6px 10px;padding:12px 14px}.rep-h .tag{margin-left:0;width:100%}
.rep-b{padding:16px 14px 8px}.rep-t{display:block}.tot{text-align:left;margin-top:14px}
.bars{gap:6px;height:132px;margin-top:18px}.bar{border-radius:6px}.bar u{border-radius:6px 6px 0 0}.bar em{left:5px;top:7px;font-size:9.5px}
.lab{gap:6px}.lab div{font-size:10.5px;line-height:1.25}.lab b{font-size:15px}
table{font-size:13px}th:nth-child(3),td:nth-child(3){display:none}td.n,th:nth-child(2){text-align:right}
.f1,.f2{position:relative;left:auto;right:auto;top:auto;width:100%;margin-top:12px}
.tl ul{grid-template-columns:1fr 1fr}.tl li{height:60px;font-size:14px;border-right:1px solid var(--ln)!important;border-bottom:1px solid var(--ln)!important}
.tl li:nth-child(2n){border-right:0!important}.tl li:nth-last-child(-n+2){border-bottom:0!important}
.st-i{padding:72px var(--pad) 48px}.st-t{font-size:26px;line-height:1.14}
.lk-g{grid-template-columns:minmax(0,1fr)}.lk-n{border-right:0;border-bottom:1px solid var(--ln);position:sticky;top:60px;z-index:5;background:rgba(250,250,250,.94);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.lk-n ul{position:static;margin:0;display:flex;gap:22px;overflow-x:auto;padding:0 var(--pad);scrollbar-width:none}.lk-n li{padding:0;height:46px;white-space:nowrap;flex:none}
.lk-s{padding:52px var(--pad) 44px}.bs{font-size:20px}
.lk-p{padding:20px 16px}.lk-pi{width:100%;zoom:1}.ch{width:100%;padding:16px 14px 12px}.ch-h{display:block}.ch-h em{display:block;padding-top:8px}
.ch-p{grid-template-columns:32px 1fr}.ch-a{height:210px}.ch-a i{width:6px;height:6px;margin:-3px 0 0 -3px}.ch-k{gap:12px}
.ta{position:static;width:100%;margin-top:12px}.ch-t{transform:translate(-82%,13px)}.ch-t::after{left:82%}
.lk-f{grid-template-columns:auto 1fr;padding:22px var(--pad)}.lk-f span{grid-column:1/-1;text-align:left}
.lk-2{grid-template-columns:minmax(0,1fr)}.lk-2>div{padding:36px var(--pad) 44px}.lk-2>div+div{border-left:0;border-top:1px solid var(--ln)}.lg,.sm{zoom:1;margin-top:24px}
.ck.on .ck-pin::before,.ck.on .ck-dark::before{width:calc(100vw - 32px)}
.ck-top .st-t{font-size:24px}.ck.on .ck-top{padding-top:96px}
.au-g{grid-template-columns:minmax(0,1fr)}.au-g>div{min-height:0;display:grid;grid-template-columns:24px 1fr;column-gap:14px;padding:20px}.au-g>div+div{border-left:0;border-top:1px solid var(--dl)}
.au-g svg{grid-row:1/3;margin:2px 0 0}.au-g h3{margin:0}.au-g p{max-width:none}
.lk-n li a{height:46px}.lk-n li::before{left:0;right:0;top:auto;bottom:-1px;width:auto;height:2px}
.fc,.bk{zoom:1;margin-top:24px}
.rp-b{--c1:92px;--c3:70px;--c4:0px}.rp-r{font-size:12px}.rp-r>em{display:none!important}.rp-r>b{padding-right:0}.rp-x{margin:8px 70px 0 92px}
.qt-r{grid-template-columns:104px 1fr 0}.qt-r>span b{display:block;margin:0 0 3px}.qt-r>em{display:none!important}.qt-t{margin:0 8px 0 6px}.qt-r{height:44px}.qt-x{margin:6px 8px 0 110px}
.iv-b{gap:8px}.iv-c{height:150px}.iv-c u b{left:7px;top:8px;font-size:12.5px}.iv-b span{font-size:11.5px}
.rv-g{gap:4px}.rv-g i{border-radius:4px}.rv-r{grid-template-columns:96px 1fr 78px;gap:8px}
.lg-r{gap:9px;padding:0 12px}.lg-r em{font-size:11.5px;padding:0 7px}
}
'''

NAV = ('<header class="top"><div class="nav"><a href="/" class="nav-b"><b>%s Cinder Revenue</b></a><ul><li><a href="/everything">What we fix</a></li><li><a href="/free-audit">The free audit</a></li><li><a href="/software">The app</a></li><li><a href="/trades">Trades</a></li><li><a href="/story">Our story</a></li></ul>'
       '<a class="btn" %s>Book your free audit</a></div></header>' % (mark, CAL))
html = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>More jobs from the leads you already get | Cinder Revenue</title><meta name="robots" content="noindex"><link rel="icon" href="/assets/favicon.svg"><style>%s%s</style></head><body>%s<div class="heroband">%s</div>%s%s%s%s%s<script>%s</script></body></html>'
        % (hero_css, CSS, NAV, hero_body, TOOLS, PROB, LK, CK, AU, JS))
for p in (ROOT + '/design/mock/home-light.html', ROOT + '/site/new.html'):
    open(p, 'w').write(html)
print('ok', len(html))
