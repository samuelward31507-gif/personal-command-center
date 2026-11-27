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
CAL = 'href="https://cal.com/audit-call/15min" target="_blank" rel="noopener" data-cta'
hero_body = hero_body.replace('<a class="btn" href="#">Book your free audit</a>', '<a class="btn" %s>Book your free audit</a>' % CAL)
hero_body = hero_body.replace('<a class="btn q" href="#">See what we check</a>', '<a class="btn q" href="/free-audit">See what we check</a>')
for _a, _b in [
    ('Most lost jobs are lost after the lead comes in. We find where yours go, put a number on each leak, and build what stops it.',
     'We audit your business for free, find what&rsquo;s costing you jobs and hours, and build the systems that fix it.'),
    ('<tr><th>Leak</th><th>Lost a month</th><th>What stops it</th></tr>', '<tr><th>Finding</th><th>Costing you</th><th>What fixes it</th></tr>'),
    ('<td class="n">$2,400</td>', '<td class="n">$2,400 a month</td>'), ('<td class="n">$3,100</td>', '<td class="n">$3,100 a month</td>'),
    ('<td class="n">$900</td><td><span class="fix">A request the day after</span></td></tr>',
     '<td class="n">$900 a month</td><td><span class="fix">A request the day after</span></td></tr>'
     '<tr><td><i class="h"></i>Scheduling and reminders done by hand</td><td class="n h">11 hours a week</td><td><span class="fix">Booking that runs itself</span></td></tr>'),
    ('<h2>Where the jobs went</h2>', '<h2>Where the jobs and hours went</h2>'),
]:
    assert _a in hero_body, _a[:50]
    hero_body = hero_body.replace(_a, _b)

# ---------- tools grid ----------
ORDER = ['Google Calendar', 'Jobber', 'Gmail', 'Housecall Pro', 'Instagram',
         'QuickBooks', 'Facebook Lead Ads', 'Angi', 'Google Business Profile', 'Thumbtack']
cells = ''.join('<li>%s<span>%s</span></li>' % (tools.get(n, ''), n) for n in ORDER)
TOOLS = ('<section class="tl" aria-label="Works alongside the tools you already use"><div class="w tl-g">'
         '<p class="tl-c">Works alongside the tools you already use</p><ul>%s</ul></div></section>' % cells)

# ---------- problem statement ----------
WHAT = ('<section class="st"><div class="w st-i"><span class="lb">What we do</span>'
        '<p class="st-t">We take your business apart and fix what&rsquo;s costing you. '
        '<span>Not one product, and not a template. We look at how you run, find where the jobs and the hours go, '
        'and build systems made for the way you work. If a task repeats, AI should be doing it.</span></p></div></section>')
PROB = ('<section class="st st2"><div class="w st-i"><span class="lb">What an audit finds</span>'
        '<p class="st-t">The jobs and hours you lose, you never hear about. '
        '<span>The caller who got voicemail doesn&rsquo;t ring back. The quote that went quiet doesn&rsquo;t remind you. '
        'Here are three places we look.</span></p></div></section>')

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

# ---------- 6: work done by hand ----------
TASKS = [('Scheduling and rescheduling', 3), ('Writing up estimates', 2.5), ('Appointment reminders', 2), ('Typing leads into the calendar', 2), ('Invoices and payment reminders', 1.5)]
WK = ('<div class="cd ch wk">%s<div class="wk-b">%s</div></div>'
      % (head('A week of repeat work', 'Ridgeline Fence, one week'),
         ''.join('<div class="wk-r"><span>%s</span><div><u style="width:%d%%"></u></div><b>%s h</b></div>' % (n, round(h / 3 * 100), ('%g' % h)) for n, h in TASKS)))
WK_T = tally('By hand, one week', '11 hours. Five tasks.',
             '<div class="ta-s">%s</div>' % ''.join('<i class="y" style="flex:%g"></i>' % h for _, h in TASKS),
             [('Done every working day', '3 of 5'), ('Could run on their own', '5 of 5'), ('Across a year', 'About 550 hours')])
WK_A = facts('One Tuesday', 'By hand', [('Reminder texts sent', '9', ''), ('Bookings typed into the calendar', '6', ''), ('Invoices written up', '3', 'y')])
WK_B = summ([('Hours a week by hand', '11', False), ('Working weeks a year', '50', True)], ('Hours a year', 'About 550'), 'y')

SUM = summ([('New callers who got no answer', '3', False), ('Leads that become jobs', '1 in 3', True), ('Average job', '$2,400', True)], ('Lost a month', '$2,400'))
LEAKS = ['Calls nobody answered', 'Work that isn&rsquo;t paid', 'Hours done by hand']
KEEP = [0, 3, 5]  # of the six blocks built below; the other three stay here for the inner pages
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
    block(6, 'The hours nobody counts.', 'Every booking typed in twice, every reminder sent by hand, every Friday night spent on invoices. Most of it doesn&rsquo;t need a person.',
          WK + WK_T, None,
          'For one week, write down every task you do by hand more than twice. That list is where the audit starts.', WK_A,
          'It doesn&rsquo;t show up as a lost job. It shows up as your evenings. The audit adds up the hours and marks which ones can run on their own.', WK_B),
]
BLOCKS = [re.sub(r'id="leak-\d+"', 'id="leak-%d"' % (n + 1), BLOCKS[k]) for n, k in enumerate(KEEP)]
LK = ('<section class="lk"><div class="w lk-g"><aside class="lk-n"><ul>%s</ul></aside><div class="lk-m">%s</div></div>'
      '</section>'
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
      '<p class="st-t">Fifteen minutes, one call. <span>We go through how your business runs, part by part, and put a number on what it&rsquo;s costing you.</span></p>'
      '<a class="btn" %s>Book your free audit</a></div>'
      '<div class="ck-dark">%s<div class="ck-count">15:00</div>'
      '<div class="ck-title"><span>It starts with</span><h2>The free audit</h2></div></div></div></section>' % (CAL, FACE))

IC = {
 'find': '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
 'call': '<path d="M7.6 3.6 5.4 4.2c-.8.2-1.3 1-1.2 1.8.7 6.3 6.2 11.7 12.4 12.4.9.1 1.6-.4 1.9-1.2l.6-2.2-3.7-2-1.6 1.6c-1.9-1-3.6-2.7-4.6-4.6l1.6-1.6z"/><path d="m15 4 4.5 4.5m0-4.5L15 8.5"/>',
 'time': '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.6 1.7M9.5 2.8h5"/>',
 'quote': '<path d="M6.5 3.5h8l3.5 3.5v13.5h-11.5z"/><path d="M14.5 3.5V7H18M9.5 11.5h5.5M9.5 15h3.5"/>',
 'money': '<rect x="3.5" y="6" width="17" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
 'star': '<path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',
}
PTS = [('call', 'Calls and messages.', 'Who answers, how fast, and what gets missed.'),
       ('quote', 'Quotes and booking.', 'How a lead becomes a job on the calendar.'),
       ('money', 'Getting paid.', 'When invoices go out and how long they wait.'),
       ('time', 'Work done by hand.', 'Every task someone repeats that could run itself.'),
       ('find', 'Getting found.', 'What your website and your Google listing bring in.')]
AU = ('<section class="au"><div class="w au-g">%s</div><div class="w au-e"></div></section>'
      % ''.join('<div><svg viewBox="0 0 24 24" aria-hidden="true">%s</svg><h3>%s</h3><p>%s</p></div>' % (IC[k], t, p) for k, t, p in PTS))

# ---------- what we build: eight parts of the business ----------
PARTS = [('Getting found', 'find', 'A website and a Google listing that turn searches into calls.', '/websites', False),
         ('Front desk', 'chat', 'Every call, form and message answered, day or night.', '/answering', True),
         ('Calendar', 'cal', 'Estimates booked, crews scheduled, customers reminded.', '/booking', True),
         ('Quotes', 'quote', 'Sent the same day and followed up until there is an answer.', '/estimates', True),
         ('Money', 'money', 'Invoices out the day the job ends, and chased until paid.', '/invoicing', True),
         ('After the job', 'star', 'Reviews, referrals and repeat work asked for every time.', '/reviews', True),
         ('Team and office', 'team', 'Hiring, reports and the paperwork nobody has time for.', '/reports', False),
         ('Custom', 'plus', 'If it is not on this list, we build it anyway.', '/custom-builds', False)]
IC.update({
 'find': '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
 'chat': '<path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5V16.5a2 2 0 0 1-2-2z"/>',
 'cal': '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
 'team': '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19.5c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5"/><circle cx="17" cy="8" r="2.4"/><path d="M16.5 13.2c2.200 .2 3.700 1.500 4.200 3.800"/>'.replace('00 ', ' '),
 'plus': '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8.5v7M8.5 12h7"/>',
})
CX, CY, RR = 260, 206, 128
ring = ''.join('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (CX + (RR - (9 if i % 5 == 0 else 5)) * math.sin(math.radians(i * 6)), CY - (RR - (9 if i % 5 == 0 else 5)) * math.cos(math.radians(i * 6)),
                                                                   CX + RR * math.sin(math.radians(i * 6)), CY - RR * math.cos(math.radians(i * 6))) for i in range(60))
spokes = nodes = labels = ''
for i, (name, _, _, _, lit) in enumerate(PARTS):
    a = math.radians(i * 45)
    x, y = CX + (RR + 16) * math.sin(a), CY - (RR + 16) * math.cos(a)
    lx, ly = CX + (RR + 34) * math.sin(a), CY - (RR + 34) * math.cos(a)
    anchor = 'middle' if i in (0, 4) else ('start' if i < 4 else 'end')
    dy = -4 if i == 0 else (14 if i == 4 else 4.5)
    spokes += '<path class="bd-sp%s" pathLength="1" d="M%.1f %.1fL%.1f %.1f"/>' % (' lit' if lit else '', CX + 52 * math.sin(a), CY - 52 * math.cos(a), x, y)
    nodes += '<circle class="bd-n%s" cx="%.1f" cy="%.1f" r="5"/>' % (' lit' if lit else '', x, y)
    labels += '<text class="bd-l%s" x="%.1f" y="%.1f" text-anchor="%s">%s</text>' % (' lit' if lit else '', lx, ly + dy, anchor, name)
WHEEL = ('<svg class="bd-w" viewBox="0 0 520 412" role="img" aria-label="Eight parts of a business in a ring. Example audits light different parts for different businesses.">'
         '<g class="bd-k">%s</g>%s%s%s<text class="bd-c1" x="%d" y="%d" text-anchor="middle">Example audit</text>'
         '<text class="bd-c2" x="%d" y="%d" text-anchor="middle">5 of 8</text></svg>' % (ring, spokes, nodes, labels, CX, CY - 8, CX, CY + 20))
def _pv_stack():
    # eight plates, one per part of the business. Each is drawn as a flat square with its own pattern and laid over by a CSS matrix,
    # so the first one can start face-on as a dotted panel and tip into place, and the rest set down above it.
    def inner(k):
        t = k % 4
        if t == 0:
            return ''.join('<circle class="dt" cx="%d" cy="%d" r="1.7"/>' % (x, y) for x in range(-90, 91, 30) for y in range(-90, 91, 30))
        if t == 1:
            return '<circle r="30"/><circle r="60"/><circle class="ds" r="90"/><rect class="q" x="-4" y="-4" width="8" height="8"/>'
        if t == 2:
            return ''.join('<path class="%s" d="M-90 %d H90"/>' % ('ds' if n % 2 else '', y) for n, y in enumerate(range(-90, 91, 30)))
        return ('<path d="M-60 -50 L40 -66 L58 44 L-44 62 Z"/>' + ''.join('<circle class="nb" cx="%d" cy="%d" r="9"/><circle class="dt" cx="%d" cy="%d" r="2.4"/>' % (x, y, x, y) for x, y in ((-60, -50), (40, -66), (58, 44), (-44, 62))))
    ys = [476 - k * 52 for k in range(8)]
    guides = ''.join('<path class="gd" d="M%d %d V%d"/>' % (x, ys[-1], ys[0]) for x in (68, 372)) + '<path class="gd" d="M220 %d V%d"/>' % (ys[-1] - 30, ys[0] + 30)
    plates = ''.join('<g class="pt8" style="--i:%d;--y:%d"><rect class="pl" x="-108" y="-108" width="216" height="216"/>%s</g>' % (k, y, inner(k)) for k, y in enumerate(ys))
    labels = ''.join('<text style="--i:%d" x="386" y="%d">%s</text>' % (k, y + 4, n.upper()) for k, (y, (n, _, _, _, _)) in enumerate(zip(ys, PARTS)))
    return '<svg class="pv-d" viewBox="0 0 520 600" aria-hidden="true">%s%s%s</svg>' % (guides, plates, labels)


BD = ('<section class="pv"><div class="pv-o"><p>Then we build whatever fixes it.</p></div>'
      '<div class="pv-p" data-sp><div class="w pv-g"><div class="pv-w">%s</div><div class="pv-a">%s</div></div></div>'
      '<div class="w rsp" aria-hidden="true"></div><div class="w pv-e"><a class="btn g" href="/everything">See everything we build</a><p>The one thing we don&rsquo;t do is run ads.</p></div></section>'
      % (''.join('<a class="pv-x" style="--i:%d" href="%s"><b>%s<sup>[0%d]</sup></b><span>%s</span></a>' % (k, h, n, k + 1, t) for k, (n, _, t, h, _) in enumerate(PARTS)), _pv_stack()))

# ---------- how it works: the call, the findings, the build, it runs ----------
STEPS = [('The call.', 'Fifteen minutes, part by part: how work comes in, gets quoted, gets done and gets paid.'),
         ('The findings.', 'A short report of what&rsquo;s costing you, in dollars a month and hours a week. It&rsquo;s yours to keep.'),
         ('The build.', 'Made for your business: your tools, your wording, your way of working. Only the fixes you choose.'),
         ('It runs.', 'The systems do the repeat work. You see what they did in one app on your phone.')]
FIND = [('Front desk', '8 calls missed after hours', '$2,400 a month', 'r', 'A text back in seconds'),
        ('Quotes', '13 quotes never followed up', '$3,100 a month', 'r', 'Check-ins on day two and five'),
        ('After the job', '29 finished jobs never asked for a review', '$900 a month', 'r', 'A request the day after'),
        ('Money', 'Invoices go out six days late', '$14,600 waiting', 'y', 'An invoice the day the job ends'),
        ('Calendar', 'Scheduling and reminders done by hand', '11 hours a week', 'y', 'Booking and reminders that run themselves')]
FD = ('<div class="fd"><div class="fd-h"><span class="dot"></span><b>Audit findings</b><span>Ridgeline Fence</span><span class="tag">Example business, sample data</span></div>%s'
      '<div class="fd-f"><div><b>$6,400</b>lost a month</div><div><b>$14,600</b>waiting to be paid</div><div><b>11 hours</b>by hand a week</div></div></div>'
      % ''.join('<div class="fd-r"><small>%s</small><b>%s</b><em class="%s">%s</em><span><i></i>%s</span></div>' % (p, f, t, c, b) for p, f, c, t, b in FIND))
def _hq_tile(k):
    # twenty-five small squares: scattered in the first tile, in order by the last
    rr = random.Random(7); out_ = ''
    for n in range(25):
        gx, gy = 22 + (n % 5) * 19, 22 + (n // 5) * 19; f = 1 - k / 3.0
        x = gx + (rr.random() - .5) * 46 * f; y = gy + (rr.random() - .5) * 46 * f; a = (rr.random() - .5) * 170 * f
        out_ += '<rect x="%.1f" y="%.1f" width="9" height="9" transform="rotate(%.0f %.1f %.1f)"/>' % (x - 4.5, y - 4.5, a, x, y)
    return '<svg viewBox="0 0 120 120" aria-hidden="true">%s%s</svg>' % ('<rect class="fr" x="6" y="6" width="108" height="108"/>' if k == 3 else '', out_)


HW = ('<section class="hq"><div class="w hq-i"><div class="hq-t"><span class="lb">How it works</span>'
      '<p class="st-t">One call. Then a plan with numbers on it. <span>You decide what gets built.</span></p></div>'
      '<div class="hq-g" data-in>%s</div></div></section>'
      % ''.join('<div class="%s" style="--i:%d"><em>[Step 0%d]</em>%s<b>%s</b><span>%s</span></div>' % ('on' if k == 3 else '', k, k + 1, _hq_tile(k), a, b) for k, (a, b) in enumerate(STEPS)))
CL = ('<section class="cl"><div class="w cl-i"><h2>Find out what you&rsquo;re missing.</h2><p>A free audit of your business. You keep what we find.</p>'
      '<div><a class="btn" %s>Book your free audit</a><a class="btn g" href="/free-audit">See what we check</a></div></div></section>' % CAL)

# ---------- hero: the path of a job through the business, with the findings on it ----------
IC['tool'] = '<path d="M14.6 5.3a4.2 4.2 0 0 0-5.3 5.3L4 15.9 8.1 20l5.3-5.3a4.2 4.2 0 0 0 5.3-5.3l-2.6 2.6-2.4-.6-.6-2.4z"/>'
# (part, icon, finding, cost, tone, fix, card goes up or down)
PATH = [('Getting found', 'find', None, None, None, None, None),
        ('Front desk', 'chat', '8 calls missed after hours', '$2,400 a month', 'r', 'A text back in seconds', 'up'),
        ('Calendar', 'cal', 'Scheduling and reminders by hand', '11 hours a week', 'y', 'Booking that runs itself', 'dn'),
        ('Quotes', 'quote', '13 quotes never followed up', '$3,100 a month', 'r', 'Check-ins on day two and five', 'up'),
        ('The work', 'tool', None, None, None, None, None),
        ('Money', 'money', 'Invoices go out six days late', '$14,600 waiting', 'y', 'An invoice the day the job ends', 'dn'),
        ('After the job', 'star', 'No review request on 29 jobs', '$900 a month', 'r', 'A request the day after', 'up')]
MW, CW = 1000, 222
UP = {1, 3, 5}
steps = ''
for i, (part, ic, find, cost, tone, fix, _) in enumerate(PATH):
    x = 62 + i * (MW - 124) / 6
    cl = (min(max(x - CW / 2, 18), MW + 46 - CW) - x) if i != 2 else -CW / 2
    card = ('<div class="mp-c %s %s" style="--cl:%.1fpx;--cx:%.1fpx;--d:%d"><b>%s</b><em>%s</em><span>%s</span></div>'
            % ('up' if i in UP else 'dn', tone, cl, -cl, i, find, cost, fix)) if find else '<span class="mp-ok">Fine as it is</span>'
    steps += ('<div class="mp-s%s" style="--x:%.1fpx;--i:%d"><div class="mp-t"><svg viewBox="0 0 24 24" aria-hidden="true">%s</svg></div><div class="mp-lb">%s</div>%s</div>'
              % (' f-' + tone if find else ' ok', x, i, IC[ic], part, card))
TOTAL = ('<div class="mp-tot"><div class="fk">What it adds up to</div><b>$6,400</b><span>lost every month</span>'
         '<dl><div><dt>Waiting to be paid</dt><dd>$14,600</dd></div><div><dt>By hand, every week</dt><dd>11 hours</dd></div></dl>'
         '<p>Five findings. Two parts fine as they are.</p></div>')
rows = ''
for i, (part, ic, find, cost, tone, fix, _) in enumerate(PATH):
    tile = '<i class="ac-i"><svg viewBox="0 0 24 24" aria-hidden="true">%s</svg></i>' % IC[ic]
    if find:
        rows += '<div class="ac-r" style="--d:%d">%s<b>%s</b><span>%s</span><em>%s</em><small>%s</small></div>' % (i, tile, part, find, cost, fix)
    else:
        rows += '<div class="ac-r ok" style="--d:%d">%s<b>%s</b><em>Fine as it is</em></div>' % (i, tile, part)
RAN = [('8:00 AM', 'Four customers reminded', 'Tomorrow&rsquo;s visits, by text'),
       ('9:15 AM', 'Quote #1042 followed up', 'The day-two check-in'),
       ('2:30 PM', 'Invoice sent', 'Cedar fence, the day it finished'),
       ('5:00 PM', 'Review asked for', 'Gate repair, finished yesterday'),
       ('7:42 PM', 'Missed call texted back', 'Nine seconds after it rang out')]
def _sc(n, items):
    return '<div data-sc="%d">%s</div>' % (n, ''.join(items))
_b = lambda at, who, text: '<p class="hb %s" data-at="%d">%s</p>' % (who, at, text)          # a text bubble: o = the business, c = the customer
_n = lambda at, title, text: '<p class="hn" data-at="%d"><b>%s</b>%s</p>' % (at, title, text)   # a notification on the owner's phone
_l = lambda at, t, text: '<p class="hl" data-at="%d"><time>%s</time>%s</p>' % (at, t, text)     # a line in the log
_HM_SAT = (   # three windows beside the app, each running in step with the screen it is showing
    '<div class="hx hx-p" aria-hidden="true"><i class="hx-nc"></i><p class="hx-k">Customer&rsquo;s phone</p><div class="hx-b">%s</div></div>'
    '<div class="hx hx-n" aria-hidden="true"><p class="hx-k">Your phone</p><div class="hx-b">%s</div></div>'
    '<div class="hx hx-l" aria-hidden="true"><p class="hx-k">&gt; What ran</p><div class="hx-b">%s</div></div>'
    % (_sc(0, ['<p class="hx-e">No new messages</p>'])
       + _sc(1, [_b(1, 'c', '<b>Missed call</b>Sat 7:42 PM'), _b(2, 'o', 'Sorry we missed you, this is Ridgeline Fence. Want a time for an estimate?'), _b(3, 'c', 'Yes. Thursday afternoon?'), _b(4, 'o', 'Thursday 2 PM is yours.')])
       + _sc(2, [_b(1, 'o', 'Reminder: your estimate is tomorrow at 2 PM. Reply C to confirm.'), _b(3, 'c', 'C'), _b(4, 'o', 'Confirmed. See you then.')])
       + _sc(3, [_b(1, 'o', 'Any questions on your quote? Happy to walk through it.'), _b(3, 'o', 'Checking in on the cedar fence quote.'), _b(4, 'c', 'Looks good. Let&rsquo;s do it.')])
       + _sc(4, [_b(1, 'o', 'Your invoice from Ridgeline Fence is ready. Pay here.'), _b(3, 'o', 'A reminder: your invoice is still open.'), _b(4, 'c', 'Paid. Thanks.')]),
       _sc(0, [_n(1, 'Audit complete', 'Three things to fix first')])
       + _sc(1, [_n(2, 'Missed call texted back', 'New number, Sat 7:42 PM'), _n(5, 'Estimate booked', 'Thu 2 PM')])
       + _sc(2, [_n(1, 'Reminder sent', 'Estimate, Thu 2 PM'), _n(4, 'Confirmed', 'No call needed')])
       + _sc(3, [_n(1, 'Check-in sent', 'Quote #1042, day 2'), _n(5, 'Quote signed', '$4,800')])
       + _sc(4, [_n(1, 'Invoice sent', 'The day the job ended'), _n(5, 'Invoice paid', 'Cedar fence, 120 ft')]),
       _sc(0, [_l(1, 'Audit', 'Seven parts checked'), _l(2, 'Audit', 'Three fixes ranked')])
       + _sc(1, [_l(1, '7:42 PM', 'Call missed'), _l(2, '7:42 PM', 'Text back sent'), _l(4, '7:44 PM', 'Time offered'), _l(5, '7:44 PM', 'Estimate booked')])
       + _sc(2, [_l(1, 'Wed 2 PM', 'Reminder sent'), _l(3, 'Wed 2 PM', 'Customer confirmed'), _l(4, 'Wed 2 PM', 'Calendar updated')])
       + _sc(3, [_l(0, 'Mon', 'Quote sent'), _l(1, 'Day 2', 'Check-in sent'), _l(3, 'Day 5', 'Check-in sent'), _l(5, 'Day 5', 'Quote signed')])
       + _sc(4, [_l(0, 'Fri', 'Job finished'), _l(1, 'Fri', 'Invoice sent'), _l(3, 'Day 3', 'Reminder sent'), _l(5, 'Day 3', 'Paid')])))

def _hm_chart():
    # where 100 leads went, as one clean line: the sample audit's own numbers
    v = [100, 71, 58, 39, 34]; xs = [0, 25, 50, 75, 100]; yv = lambda a: 100 - a * .86
    pts = [(x, yv(a)) for x, a in zip(xs, v)]
    def seg(p0, p1, n=16):
        out_ = []
        for k in range(n):
            t = k / n; e = t * t * (3 - 2 * t); out_.append((p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * e))
        return out_
    line = sum((seg(a, b) for a, b in zip(pts, pts[1:])), []) + [pts[-1]]
    d = 'M' + ' L'.join('%.2f %.2f' % q for q in line)
    drops = ''.join('<line class="dr" x1="%d" y1="%.1f" x2="%d" y2="100"/>' % (x, y, x) for x, y in pts[1:-1])
    nodes = ''.join('<i class="nd%s" style="left:%d%%;top:%.1f%%;--k:%d"></i>' % (' r' if k == 3 else '', x, y, k) for k, (x, y) in enumerate(pts))
    hz = ('<i class="hz" style="left:50%%;top:%.1f%%;width:25%%;height:%.1f%%;--k:3"></i><i class="hz h2" style="left:0;top:%.1f%%;width:25%%;height:%.1f%%;--k:1"></i>'
          % (yv(58), yv(39) - yv(58), yv(100), yv(71) - yv(100)))
    tags = ('<b class="tg" style="left:62.5%%;top:%.1f%%;--k:3">[19 quotes went quiet]</b><b class="tg g" style="left:12.5%%;top:%.1f%%;--k:1">[29 got no answer]</b>' % ((yv(58) + yv(39)) / 2, (yv(100) + yv(71)) / 2))
    ticks = ''.join('<span class="tk%s" style="left:%d%%"><b>%d</b>%s</span>' % (' a' if k == 0 else (' z' if k == 4 else ''), x, a, t) for k, (x, a, t) in enumerate(zip(xs, v, ['Leads in', 'Got an answer', 'Booked', 'Quote signed', 'Paid'])))
    return ('<div class="hm-c" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path class="ax" d="M0 0 V100 H100"/><path class="l2" d="M0 %.1f H25"/><path class="l2" d="M50 %.1f H75"/>%s</svg>'
            '<div class="hm-cw"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path class="ln" d="%s"/></svg></div>%s%s%s%s</div>' % (yv(100), yv(58), drops, d, hz, nodes, tags, ticks))


_HM_SIDE = [('Getting found', 'Fine', 0), ('Front desk', '$2,400 a month', 0), ('Calendar', '11 hours a week', 0), ('Quotes', '$3,100 a month', 1), ('The work', 'Fine', 0), ('Money', '$14,600 waiting', 0), ('After the job', '$900 a month', 0)]
_HM_FIND = [('Quotes', '13 quotes never followed up', '$3,100 a month', 'Check-ins on day two and five'), ('Front desk', '8 calls missed after hours', '$2,400 a month', 'A text back in seconds'),
            ('Calendar', 'Scheduling and reminders by hand', '11 hours a week', 'Booking that runs itself')]
HERO = ('<section class="hm"><div class="w hm-t"><a class="hm-p" href="/free-audit">The free audit takes fifteen minutes<i></i></a>'
        '<h1>Find out what your business is losing.</h1>'
        '<p class="sub">We take your business apart, put a number on what&rsquo;s costing you jobs and hours, and build systems made for it.</p>'
        '<div class="cta"><a class="btn q" href="/free-audit">See what we check</a><a class="btn" %s>Book your free audit</a></div></div>'
        '<div class="hm-x" data-sp><div class="hm-y"><div class="w hm-s"><div class="hm-w"><div class="hm-b"><i></i><i></i><i></i>@@MARK@@<b>Cinder Revenue</b><em>Example business, sample data</em></div>'
        '<div class="hm-g"><div class="hm-l"><p>Seven parts of the business</p>%s</div>'
        '<div class="hm-m"><div class="hm-v on" data-sc="0" data-s="-1" data-f="-1"><div class="hm-h"><div><h2>Where the jobs went</h2><p>100 leads in the last 30 days. 34 became paid jobs.</p></div><span>[Audit complete]</span></div>%s</div>@@VIEWS@@</div>'
        '<div class="hm-r"><p>Fix first</p>%s</div></div>'
        '</div></div>@@SAT@@</div></div></section>'
        % (CAL, ''.join('<div class="%s" style="--k:%d"><span>%s</span><b class="%s">%s</b></div>' % ('on' if on else '', k, a, 'f' if b == 'Fine' else '', b) for k, (a, b, on) in enumerate(_HM_SIDE)),
           _hm_chart(), ''.join('<div style="--k:%d"><span>%s</span><b>%s</b><em>%s</em><u>%s</u></div>' % (k, a, c, b, d) for k, (a, b, c, d) in enumerate(_HM_FIND))))
HERO = HERO.replace('@@SAT@@', _HM_SAT)
HERO = HERO.replace('@@MARK@@', mark)
# the window walks through the fixes on its own: each screen shows the leak the audit found, then the system handling it, step by step
def _hm_view(n, side, find, tag, title, figure, body, fix):
    return ('<div class="hm-v" data-sc="%d" data-s="%d" data-f="%d"><div class="hm-h"><div><h2 data-ty="%s">%s</h2><p>%s</p></div><span>[%s]</span></div>%s'
            '<p class="vf" data-at="1"><b>[Fix]</b><span data-ty="%s">%s</span></p></div>' % (n, side, find, title, title, figure, tag, body, fix, fix))
_cp = lambda text, at, to=None, cls='': '<em class="cp %s" data-at="%d"%s>%s</em>' % (cls, at, '' if to is None else ' data-to="%d"' % to, text)
_st = lambda at, a, b, cls='': '<div class="vr vs %s" data-at="%d"><i></i><b>%s</b><span>%s</span></div>' % (cls, at, a, b)
_HM_VIEWS = (
    _hm_view(1, 1, 1, 'Front desk', '8 calls missed after hours', '$2,400 a month',
             '<div class="hm-vb"><div class="vr lv"><b>New number</b><span>Sat 7:42 PM</span>%s%s%s</div>%s</div>'
             % (_cp('No call back', 0, 2, 'r'), _cp('Texted back in seconds', 2, 5), _cp('Booked Thu 2 PM', 5, None, 'k'),
                ''.join('<div class="vr old"><b>%s</b><span>%s</span><em class="%s">%s</em></div>' % (a, b, d, c) for a, b, c, d in LOGROWS[1:])),
             'A text back in seconds')
    + _hm_view(2, 2, 2, 'Calendar', 'Scheduling and reminders by hand', '11 hours a week',
               '<div class="hm-vb">%s</div>' % ''.join('<div class="vr vt"><b>%s</b>%s%s<u><i style="width:%d%%"></i></u></div>'
                                                      % (a, _cp('Runs itself', k + 1, None, 'k'), _cp('%g h' % h, 0, k + 1, 'h'), h / 3 * 100) for k, (a, h) in enumerate(TASKS)),
               'Booking that runs itself')
    + _hm_view(3, 3, 0, 'Quotes', '13 quotes never followed up', '$3,100 a month',
               '<div class="vq">%s</div><div class="hm-vb">%s</div>' % (''.join('<i class="%s"></i>' % ('on' if k == 4 else '') for k in range(13)),
                                                                     _st(0, 'Quote #1042 sent', 'Monday') + _st(1, 'Check-in', 'Day 2') + _st(3, 'Check-in', 'Day 5') + _st(5, 'Signed', '$4,800', 'k')),
               'Check-ins on day two and five')
    + _hm_view(4, 5, -1, 'Money', 'Invoices go out six days late', '$14,600 waiting',
               '<div class="hm-vb">%s</div>' % (_st(0, 'Job finished', 'Friday') + _st(1, 'Invoice sent', 'Friday') + _st(3, 'Reminder', 'Day 3') + _st(5, 'Paid', 'Cedar fence, 120 ft', 'k')),
               'An invoice the day the job ends'))
HERO = HERO.replace('@@VIEWS@@', _HM_VIEWS)


TICK = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.25"/><path d="m4.9 8.2 2.1 2.1 4.1-4.4"/></svg>'
RUN = ('<div class="tml" data-in><p class="tml-k">[What ran today]<em>Example business, sample data</em></p><div class="tml-l">%s</div><p class="tml-f">Five things done. None of them by hand.</p></div>'
       % ''.join('<div class="tml-r" style="--i:%d"><time>%s</time><i></i><b>%s</b><span>%s</span></div>' % (k, t, a_, b_) for k, (t, a_, b_) in enumerate(RAN)))
FQ = ('<section class="fq"><div class="w fq-i"><blockquote>&ldquo;I build and watch every client&rsquo;s system myself, and I only take on a few businesses at a time. '
      'If it isn&rsquo;t a fit, I&rsquo;ll say so.&rdquo;</blockquote><p><b>Sam Ward</b>Founder, Cinder Revenue</p></div></section>')
FT = ('<footer class="fo"><div class="w fo-g"><div class="fo-b"><a href="/" class="nav-b"><b>%s Cinder Revenue</b></a><p>We audit service businesses, then build what fixes them.</p></div>'
      '<div><h4>The audit</h4><a href="/free-audit">How it works</a><a href="/audit">Check your site</a><a %s>Book your free audit</a></div>'
      '<div><h4>What we build</h4><a href="/everything">Everything we build</a><a href="/websites">Websites</a><a href="/booking">Booking</a><a href="/estimates">Quotes</a><a href="/invoicing">Invoices</a><a href="/custom-builds">Custom builds</a></div>'
      '<div><h4>Company</h4><a href="/software">The app</a><a href="/who-its-for">Who it&rsquo;s for</a><a href="/story">Our story</a><a href="/questions">Questions</a><a href="mailto:sam.cinderrevenue@gmail.com">Email Sam</a></div></div>'
      '<div class="w fo-l"><span>&copy; 2026 Cinder Revenue Company, Colorado</span><span>Pictures show an example business with sample data.</span>'
      '<span><a href="/privacy">Privacy</a></span></div></footer>' % (mark, CAL))

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
var qs=[].slice.call(document.querySelectorAll('.fq blockquote,.fq .cq-t'));if(!qs.length)return;
if(/[?&]motion=off/.test(location.search))return;
qs.forEach(function(q){
var words=q.textContent.split(' ');q.innerHTML=words.map(function(w){return '<span>'+w+'</span>'}).join(' ');q.classList.add('fill');
var sp=q.querySelectorAll('span'),last=-1,tick=false;
function paint(){tick=false;var r=q.getBoundingClientRect(),vh=innerHeight,p=(vh*.86-r.top)/(vh*.5),n=Math.round(Math.max(0,Math.min(1,p))*sp.length);
if(n===last)return;last=n;for(var i=0;i<sp.length;i++)sp[i].classList.toggle('on',i<n)}
addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(paint)}},{passive:true});addEventListener('resize',paint);paint();
});
})();

(function(){
var bd=document.querySelector('.bd');if(!bd)return;
var sets=[[1,2,3,4,5],[0,1,2],[0,3,5,7]],sp=bd.querySelectorAll('.bd-sp'),nd=bd.querySelectorAll('.bd-n'),lb=bd.querySelectorAll('.bd-l'),c2=bd.querySelector('.bd-c2'),tabs=bd.querySelectorAll('.bd-tabs button'),at=0,timer=0;
function show(k){at=k;for(var i=0;i<8;i++){var on=sets[k].indexOf(i)>-1;sp[i].classList.toggle('lit',on);nd[i].classList.toggle('lit',on);lb[i].classList.toggle('lit',on)}
c2.textContent=sets[k].length+' of 8';for(var j=0;j<tabs.length;j++)tabs[j].classList.toggle('on',j===k)}
[].forEach.call(tabs,function(t,k){t.addEventListener('click',function(){clearInterval(timer);timer=-1;show(k)})});
if(!('IntersectionObserver' in window))return;
if(matchMedia('(prefers-reduced-motion: reduce)').matches&&!/[?&]motion=on/.test(location.search))return;
bd.classList.add('pre');
new IntersectionObserver(function(e){if(e[0].isIntersecting){bd.classList.remove('pre');if(!timer)timer=setInterval(function(){show((at+1)%3)},3600)}else if(timer>0){clearInterval(timer);timer=0}},{threshold:.45}).observe(bd.querySelector('.bd-w'));
})();

(function(){
var ck=document.querySelector('.ck'),top=document.querySelector('.top'),darks=document.querySelectorAll('.au,.hw,.pv,.cl,.fo');if(!ck)return;
var q=location.search,force=/[?&]motion=on/.test(q),snap=/[?&]snap=1/.test(q),band=ck.querySelector('.ck-dark'),cur=-1,dk=false;
if(/[?&]motion=off/.test(q)){onscroll=nav;nav();return}
ck.classList.add('on');
var pin=ck.querySelector('.ck-pin'),txt=ck.querySelector('.ck-top'),inner=ck.querySelector('.ck-i'),hands=ck.querySelector('.ck-h'),
wedge=ck.querySelector('.ck-w'),arc=ck.querySelector('.ck-a'),needle=ck.querySelector('.ck-n'),count=ck.querySelector('.ck-count'),title=ck.querySelector('.ck-title');
var vw,vh,R0,R1;
function cl(x){return x<0?0:x>1?1:x}
function ez(x){return x*x*(3-2*x)}
function measure(){vw=document.documentElement.clientWidth;vh=innerHeight;R0=Math.min(vh*.22,vw*.36,240);R1=Math.hypot(vw/2,vh/2)*1.03;
inner.setAttribute('transform','scale('+Math.min(.8,.44*vh/R1).toFixed(4)+')');cur=-1}
function target(){var r=ck.getBoundingClientRect();return cl((vh*.85-r.top)/(vh*.85))+cl(-r.top/(r.height-vh))}
function nav(){var c=ck.getBoundingClientRect(),o=ck.classList.contains('on'),k=band.getBoundingClientRect(),d=(o&&cur>1.8&&c.bottom>34)||(!o&&k.top<34&&k.bottom>34);
for(var i=0;i<darks.length&&!d;i++){var r=darks[i].getBoundingClientRect();d=r.top<34&&r.bottom>34}
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
(function(){
if(document.querySelector('.ck'))return;var top=document.querySelector('.top'),darks=document.querySelectorAll('.hw,.cl,.fo,.sn,.jr,.dh,.sx.dk,.s-dk,.chp,.s3,.sg2,.yw0,.sc,.dsn.dk'),dk=false;if(!top)return;
function nav(){var d=false;for(var i=0;i<darks.length&&!d;i++){var r=darks[i].getBoundingClientRect();d=r.top<62&&r.bottom>34}if(d!==dk){dk=d;top.classList.toggle('dk',d)}}
addEventListener('scroll',nav,{passive:true});addEventListener('resize',function(){dk=top.classList.contains('dk');nav()});nav();
})();
(function(){
var root=document.querySelector('.dayp');if(!root)return;
var ch=[].slice.call(root.querySelectorAll('.dch')),top=document.querySelector('.top'),cur='',tick=false;
var still=innerWidth<861||(/[?&]motion=off/.test(location.search));
var items=ch.map(function(c){var it=[].slice.call(c.querySelectorAll('.tr-e,.tr-f,.qo-t,.qo-r,.inv-p,.gt-r,.gt-f,.ng-x,.ng-g>div,.mr p,.pop'));if(!still)it.forEach(function(x){x.classList.add('bi')});return it});
if(!still)root.classList.add('live');
function f(){tick=false;var vh=innerHeight,best=0,bd=1e9,total=document.documentElement.scrollHeight-vh;
ch.forEach(function(c,i){var r=c.getBoundingClientRect(),d=Math.abs(r.top+r.height/2-vh/2);if(d<bd){bd=d;best=i}
if(!still){var p=Math.max(0,Math.min(1,-r.top/Math.max(1,r.height-vh)));c.style.setProperty('--p',p.toFixed(3));var k=Math.ceil(Math.min(1,Math.max(0,(p-.12)/.45))*items[i].length);items[i].forEach(function(e,j){e.classList.toggle('in',j<k)})}});
var t=ch[best].getAttribute('data-t');if(t!==cur){cur=t;root.setAttribute('data-sky',t)}
if(top&&root.getBoundingClientRect().bottom>60)top.classList.toggle('dk',cur==='dusk'||cur==='night');
root.style.setProperty('--s',Math.max(0,Math.min(1,scrollY/Math.max(1,root.offsetHeight-vh))).toFixed(4))}
addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(f)}},{passive:true});addEventListener('resize',f);f();
})();
(function(){
var els=[].slice.call(document.querySelectorAll('[data-sp]'));if(!els.length)return;
if(/[?&]motion=off/.test(location.search))return;
if(innerWidth<861)els=els.filter(function(e){return e.classList.contains('pt')});if(!els.length)return;
var top=document.querySelector('.top'),mine=false,run=false,snap=/[?&]snap=1/.test(location.search);
var st=els.map(function(e){e.classList.add('sp-live');var n=e.querySelector('.pt-n');return {e:e,pt:e.classList.contains('pt'),cv:e.hasAttribute('data-cv'),c:-1,n:n,to:n?+n.getAttribute('data-to'):0,fmt:n?n.getAttribute('data-fmt'):'',last:-1}});
function cl(x){return x<0?0:x>1?1:x}function ez(x){return x*x*(3-2*x)}
function f(){var vh=innerHeight,pin=null,more=false;st.forEach(function(s){var r=s.e.getBoundingClientRect(),t=cl(-r.top/Math.max(1,r.height-vh-(s.cv?vh*.7:0)));
if(!s.pt){s.e.style.setProperty('--p',t.toFixed(4));return}
if(s.c<0||snap)s.c=t;else{s.c+=(t-s.c)*.16;if(Math.abs(t-s.c)<.0005)s.c=t;else more=true}
var p=s.c,a=ez(cl(p/.42)),g=cl((p-.46)/.36),k=g>=1?1:(Math.pow(40,g)-1)/39,y=s.e.style;
y.setProperty('--p',p.toFixed(4));y.setProperty('--a',a.toFixed(4));y.setProperty('--g',k.toFixed(4));y.setProperty('--f',(1-cl((p-.44)/.12)).toFixed(3));y.setProperty('--t',ez(cl((p-.76)/.2)).toFixed(3));
if(s.n){var v=Math.round(a*s.to);if(v!==s.last){s.last=v;s.n.textContent=s.fmt.replace('#',v.toLocaleString('en-US'))}}
if(r.top<=0&&r.bottom>60)pin=k});
if(top){if(pin!==null){mine=true;top.classList.toggle('dk',pin>.6)}else if(mine){mine=false;top.classList.remove('dk');dispatchEvent(new Event('resize'))}}
run=more;if(more)requestAnimationFrame(f)}
function q(){if(!run){run=true;requestAnimationFrame(f)}}
addEventListener('scroll',q,{passive:true});addEventListener('resize',q);f();
})();
(function(){
var sc=[].slice.call(document.querySelectorAll('.sc'));if(!sc.length)return;
if(innerWidth<981||(/[?&]motion=off/.test(location.search)))return;
sc.forEach(function(el){el.classList.add('live');
var ss=[].slice.call(el.querySelectorAll('.sc-s')),cs=[].slice.call(el.querySelectorAll('.sc-c')),n=ss.length,bar=el.querySelector('.sc-b i'),last=-1,lastk=-1,tick=false;
var items=ss.map(function(s){var it=[].slice.call(s.querySelectorAll('.tr-e,.tr-f,.qo-t,.qo-r,.inv-p,.fl-r,.rn-f,.oq-r,.wkc-g i,.ag-g>div,.pk-f,.rvw>*,.rpt>div,.rpt>p'));it.forEach(function(x){x.classList.add('bi')});return it});
function f(){tick=false;var r=el.getBoundingClientRect(),p=Math.max(0,Math.min(.9999,-r.top/(r.height-innerHeight))),x=p*n,i=Math.floor(x),q=Math.min(1,(x-i)/.62),k=Math.ceil(q*items[i].length);
if(bar)bar.style.transform='scaleY('+p.toFixed(3)+')';
if(i!==last){last=i;lastk=-1;ss.forEach(function(s,j){s.classList.toggle('on',j===i);s.classList.toggle('past',j<i)});cs.forEach(function(c,j){c.classList.toggle('on',j===i)})}
if(k!==lastk){lastk=k;items[i].forEach(function(e,j){e.classList.toggle('in',j<k)})}}
addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(f)}},{passive:true});addEventListener('resize',f);f();
cs.forEach(function(c,j){c.addEventListener('click',function(e){if(e.target.closest('a'))return;var r=el.getBoundingClientRect();scrollTo({top:scrollY+r.top+(r.height-innerHeight)*((j+.5)/n),behavior:'smooth'})})});
});
})();
(function(){
var els=[].slice.call(document.querySelectorAll('.t-exp,.t-wipe,.t-door,[data-in]'));if(!els.length)return;
if(/[?&]motion=off/.test(location.search))return;
var tick=false;function f(){tick=false;var vh=innerHeight;els.forEach(function(e){var r=e.getBoundingClientRect(),p=Math.max(0,Math.min(1,(vh-r.top)/(vh*.72)));e.style.setProperty('--p',p.toFixed(3))})}
function q(){if(!tick){tick=true;requestAnimationFrame(f)}}addEventListener('scroll',q,{passive:true});addEventListener('resize',q);f();
})();
(function(){
var bar=document.querySelector('.chb');if(!bar)return;
var secs=[].slice.call(document.querySelectorAll('[data-ch]')),cells=[].slice.call(bar.querySelectorAll('a')),cur=-2,dk=null,tick=false;
var calm=/[?&]motion=off/.test(location.search),hero=document.querySelector('.dhero');
function f(){tick=false;var mid=innerHeight/2,low=innerHeight-40,at=-1,d=false;if(hero&&!calm)hero.style.setProperty('--h',Math.max(0,Math.min(1,scrollY/(hero.offsetHeight*.7))).toFixed(4));secs.forEach(function(s){var r=s.getBoundingClientRect();if(r.top<=mid&&r.bottom>mid)at=+s.getAttribute('data-ch');
if(r.top<=low&&r.bottom>low)d=s.classList.contains('dk')||(s.classList.contains('pt')&&(!s.classList.contains('sp-live')||parseFloat(s.style.getPropertyValue('--g'))>.5))});
if(at!==cur){cur=at;bar.classList.toggle('on',at>=0);cells.forEach(function(c,i){c.classList.toggle('on',i===at)})}
if(d!==dk){dk=d;bar.classList.toggle('dk',d)}}
function q(){if(!tick){tick=true;requestAnimationFrame(f)}}addEventListener('scroll',q,{passive:true});addEventListener('resize',q);f();
cells.forEach(function(c,i){c.addEventListener('click',function(e){e.preventDefault();var s=secs.filter(function(x){return +x.getAttribute('data-ch')===i})[0];
if(s)scrollTo({top:s.getBoundingClientRect().top+scrollY+4,behavior:calm?'auto':'smooth'})})});
})();
"""

CSS = r'''
/* ---- homepage top: one centred statement over the audit itself, drawn in hairlines ---- */
.hm{position:relative;overflow:hidden;background:radial-gradient(46% 38% at 0 100%,#e2e6f2 0,rgba(226,230,242,0) 72%),radial-gradient(46% 38% at 100% 100%,#e6e4f0 0,rgba(230,228,240,0) 72%),#fff;border-bottom:1px solid var(--ln)}
.hm-t{text-align:center;padding:clamp(72px,9.5vh,132px) 0 clamp(44px,5.4vh,72px)}.hm-x.sp-live{margin-top:calc(clamp(84px,12vh,130px)*-1)}
.hm-p{display:inline-flex;align-items:center;gap:8px;padding:7px 12px 7px 14px;border-radius:10px;box-shadow:0 0 0 1px var(--ln);font-size:14.5px;font-weight:500;color:var(--ink);background:#fff}
.hm-p i{width:6px;height:6px;border-top:1.5px solid currentColor;border-right:1.5px solid currentColor;transform:rotate(45deg);opacity:.6}
.hm h1{margin:clamp(26px,3.4vh,44px) auto 0;max-width:12.5em;font-size:clamp(44px,5.5vw,104px);line-height:.98;letter-spacing:-.052em;font-weight:600;text-wrap:balance}
.hm .sub{margin:clamp(20px,2.6vh,32px) auto 0;max-width:27em;font-size:clamp(17px,1.25vw,23px);line-height:1.35;color:var(--g2);text-wrap:balance}
.hm .cta{margin-top:clamp(24px,3vh,38px);justify-content:center}
.hm-s{padding-bottom:clamp(56px,6vw,104px)}
.hm-w{border-radius:18px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.1),0 40px 80px -40px rgba(30,36,70,.28);overflow:hidden;animation:hmup .9s cubic-bezier(.2,.7,.2,1) both}
@keyframes hmup{from{opacity:0;transform:translateY(34px)}}@keyframes hmin{from{opacity:0;transform:translateY(8px)}}@keyframes hmwipe{from{clip-path:inset(-14px 100% -14px -14px)}to{clip-path:inset(-14px -14px -14px -14px)}}@keyframes hmfade{from{opacity:0}}
.hm-b{display:flex;align-items:center;gap:8px;height:46px;padding:0 18px;border-bottom:1px solid var(--ln);background:#fafafa;font-size:13.5px}
.hm-b i{width:11px;height:11px;border-radius:50%;background:#ff5f57}.hm-b i:nth-child(2){background:#febc2e}.hm-b i:nth-child(3){background:#28c840}.hm-b i:nth-child(3){margin-right:10px}.hm-b b{font-weight:600;white-space:nowrap}.hm-b .mk{width:17px;height:17px;flex:none}.hm-b span{color:var(--g2)}
.hm-b em{margin-left:auto;font:500 11px/1 "Geist Mono",monospace;font-style:normal;color:var(--g2)}
.hm-g{display:grid;grid-template-columns:clamp(230px,18vw,280px) minmax(0,1fr) clamp(270px,22vw,340px)}
.hm-l{padding:22px 12px;border-right:1px solid var(--ln);background:#fafafa}.hm-l p,.hm-r>p{margin:0 10px 12px;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--g2)}
.hm-l div{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:10px 10px;border-radius:8px;font-size:14.5px;animation:hmin .5s calc(.5s + var(--k)*.07s) both}
.hm-l div.on{background:#fff;box-shadow:0 0 0 1px var(--ln)}.hm-l b{font-weight:500;font-size:13px;white-space:nowrap}.hm-l b.f{color:var(--g3);font-weight:400}
.hm-m{padding:26px clamp(22px,2.4vw,40px) 30px;min-width:0}
.hm-h{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.hm-h h2{margin:0;font:400 clamp(24px,1.9vw,34px)/1.1 Georgia,"Times New Roman",serif;letter-spacing:-.018em}
.hm-h p{margin:8px 0 0;font-size:14.5px;color:var(--g2)}.hm-h span{flex:none;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--g2);padding-top:8px}
.hm-c{position:relative;height:clamp(240px,31vh,330px);margin:34px 0 52px}
.hm-c svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.hm-c svg *{fill:none;vector-effect:non-scaling-stroke}
.hm-c .ax{stroke:var(--ink);stroke-width:1}.hm-c .ln{stroke:var(--ink);stroke-width:1.3}.hm-c .l2{stroke:#9a9da5;stroke-width:1;stroke-dasharray:5 4;animation:hmfade .6s 1.5s both}
.hm-c .dr{stroke:#a3a6ad;stroke-width:1;stroke-dasharray:1.5 3.5;animation:hmfade .5s 1.7s both}
.hm-cw{position:absolute;inset:0;animation:hmwipe 1.5s .7s cubic-bezier(.45,.05,.3,1) both}
.hm-c .nd{position:absolute;width:5px;height:5px;margin:-2.5px 0 0 -2.5px;background:var(--ink);animation:hmfade .3s calc(.8s + var(--k)*.33s) both}
.hm-c .nd.r{width:13px;height:13px;margin:-6.5px 0 0 -6.5px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 1.5px var(--ink)}.hm-c .nd.r::after{content:"";position:absolute;inset:4.5px;border-radius:50%;background:var(--ink)}
.hm-c .hz{position:absolute;background:repeating-linear-gradient(135deg,transparent 0 5px,rgba(23,24,26,.2) 5px 6px);animation:hmfade .6s calc(1s + var(--k)*.33s) both}.hm-c .hz.h2{background:repeating-linear-gradient(45deg,transparent 0 8px,rgba(23,24,26,.13) 8px 9px)}
.hm-c .tg{position:absolute;transform:translate(-50%,-50%);padding:4px 6px 3px;border-radius:3px;background:var(--ink);color:#fff;font:500 9.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;animation:hmfade .5s calc(1.2s + var(--k)*.33s) both}
.hm-c .tg.g{background:#eceef2;color:var(--ink)}
.hm-c .tk{position:absolute;top:calc(100% + 12px);transform:translateX(-50%);text-align:center;font:500 10.5px/1.3 "Geist Mono",monospace;color:var(--g2);white-space:nowrap}
.hm-c .tk b{display:block;font:540 15px/1.2 Inter,system-ui,sans-serif;letter-spacing:-.01em;color:var(--ink)}.hm-c .tk.a{transform:none;text-align:left}.hm-c .tk.z{transform:translateX(-100%);text-align:right}
.hm-r{padding:22px 16px;border-left:1px solid var(--ln)}.hm-r>p{margin-left:6px}
.hm-r div{display:grid;grid-template-columns:1fr auto;gap:3px 10px;padding:14px 12px;border-radius:10px;box-shadow:0 0 0 1px var(--ln);animation:hmin .55s calc(1.9s + var(--k)*.16s) both}.hm-r div+div{margin-top:8px}
.hm-r span{font-size:14.5px;font-weight:540}.hm-r b{font-size:14px;font-weight:540;white-space:nowrap}.hm-r em{grid-column:1/-1;font-style:normal;font-size:13px;color:var(--g2)}
.hm-r u{grid-column:1/-1;margin-top:8px;padding-top:9px;border-top:1px dashed var(--ln);text-decoration:none;font:500 10.5px/1.3 "Geist Mono",monospace;color:var(--ink)}
.hm-f{display:grid;grid-template-columns:repeat(3,1fr);background:var(--dk);color:#8f9197;font-size:13.5px}.hm-f div{padding:20px clamp(18px,2vw,34px)}.hm-f div+div{border-left:1px solid var(--dl)}
.hm-f b{display:block;margin-bottom:4px;color:#fff;font-size:clamp(22px,1.7vw,30px);font-weight:540;letter-spacing:-.03em}
@media(max-width:1180px){.hm-g{grid-template-columns:minmax(0,1fr) 290px}.hm-l{display:none}}
@media(max-width:860px){.hm-t{padding:56px 0 36px}.hm h1{font-size:40px}.hm-g{grid-template-columns:minmax(0,1fr)}.hm-r{border-left:0;border-top:1px solid var(--ln)}.hm-b span,.hm-h span{display:none}.hm-c{height:220px}.hm-c .tk{font-size:8.5px;white-space:normal;width:4.6em}.hm-c .tk b{font-size:13px}
.hm-c .tg{font-size:8px;letter-spacing:0}.hm-f{font-size:11.5px}.hm-f div{padding:14px 12px}.hm-f b{font-size:18px}.hm .cta{flex-wrap:wrap}}
/* ---- dark sections on the homepage, redrawn in hairlines with no colour ---- */
.hw .hw-t .lb,.pb .pb-t .lb{background:rgba(255,255,255,.09);color:#c9cbd0}
.tml{--d:clamp(0,calc((var(--p,1) - .25)*1.6),1);width:min(520px,100%);margin:0 auto;color:#fff}
.tml-k{display:flex;justify-content:space-between;gap:12px;margin:0 0 26px;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#8f9197}.tml-k em{font-style:normal;text-transform:none;letter-spacing:0}
.tml-l{position:relative;list-style:none;margin:0;padding:0}
.tml-l::before{content:"";position:absolute;left:92px;top:8px;bottom:8px;border-left:1px solid #fff;transform-origin:top;transform:scaleY(var(--d))}
.tml-l::after{content:"";position:absolute;left:92px;top:8px;bottom:8px;border-left:1px dashed rgba(255,255,255,.22)}
.tml-r{--q:clamp(0,calc(var(--d)*5.6 - var(--i) - .2),1);position:relative;display:grid;grid-template-columns:72px minmax(0,1fr);column-gap:44px;row-gap:5px;padding:0 0 30px;opacity:calc(.25 + var(--q)*.75)}
.tml-r:last-child{padding-bottom:0}
.tml time{grid-row:1/3;padding-top:4px;font:500 11.5px/1 "Geist Mono",monospace;color:#8f9197;white-space:nowrap}
.tml-r i{position:absolute;left:89px;top:5px;width:7px;height:7px;background:#fff;transform:scale(var(--q))}
.tml b{font-size:clamp(16px,1.15vw,19px);font-weight:500;letter-spacing:-.014em}.tml-r span{grid-column:2;font-size:14px;color:#8f9197}
.tml-f{margin:34px 0 0;padding-top:18px;border-top:1px solid var(--dl);font-size:14px;color:#a3a5aa}
.pb{background:var(--dk);color:#fff}
.pb-g{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(32px,5vw,96px);align-items:center;border-left:1px solid var(--dl);border-right:1px solid var(--dl);padding:clamp(72px,6vw,120px) var(--pad);box-sizing:border-box}
.pb .st-t{color:#fff;margin-top:18px}.pb .st-t span{color:#8f9197}.pb .btn{margin-top:clamp(22px,2vw,34px)}.pb-n{margin:clamp(28px,3vw,48px) 0 0;font-size:14.5px;color:#8f9197}
.pb ol{list-style:none;margin:0;padding:0;border-top:1px solid var(--dl)}
.pb li{--x:calc(var(--p,1)*8.3 - var(--i));--lit:clamp(.26,calc(var(--x)*3),1);--act:clamp(0,calc(min(var(--x),1.12 - var(--x))*6),1);border-bottom:1px solid var(--dl)}
.pb li.z{--act:clamp(0,calc(var(--x)*6),1)}
.pb li a{display:grid;grid-template-columns:44px minmax(0,1fr);align-items:baseline;padding:clamp(11px,1.5vh,17px) 0;color:#fff;opacity:var(--lit)}
.pb li i{font:500 11px/1 "Geist Mono",monospace;font-style:normal;color:#8f9197}
.pb li b{font:400 clamp(24px,2.5vw,44px)/1.1 Georgia,"Times New Roman",serif;letter-spacing:-.02em}
.pb li span{grid-column:2;overflow:hidden;max-height:calc(var(--act)*3.2em);opacity:var(--act);font-size:clamp(14.5px,1.02vw,18px);line-height:1.45;color:#a3a5aa}
.pb li span::before{content:"";display:block;height:8px}
.pb.sp-live{height:440vh}.pb.sp-live .pb-s{position:sticky;top:0;height:100vh;display:flex;align-items:center}.pb.sp-live .pb-g{height:100%;padding-top:84px;padding-bottom:40px}
.pb:not(.sp-live) li{--lit:1;--act:1}
@media(max-width:860px){.pb-g{grid-template-columns:minmax(0,1fr);padding:56px var(--pad)}.pb li b{font-size:26px}.tml-r{grid-template-columns:62px minmax(0,1fr);column-gap:36px}.tml-l::before,.tml-l::after{left:78px}.tml-r i{left:75px}}
/* ---- how it works: four tiles that go from scattered to in order ---- */
.hq{background:#fff;border-top:1px solid var(--ln)}
.hq-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(96px,9vw,180px) var(--pad);box-sizing:border-box}
.hq-t{display:grid;grid-template-columns:minmax(0,.42fr) minmax(0,1fr);gap:24px;align-items:start}.hq .st-t{margin:0;max-width:17em}.hq .lb{justify-self:start}
.hq-g{--d:clamp(0,calc((var(--p,1) - .15)*1.5),1);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:clamp(20px,3vw,56px);margin-top:clamp(72px,8vw,150px)}
.hq-g div{--q:clamp(0,calc(var(--d)*4.4 - var(--i) - .1),1);opacity:var(--q);transform:translateY(calc((1 - var(--q))*22px))}
.hq-g em{display:table;margin:0 auto;padding:4px 6px 3px;border-radius:3px;background:#eceef2;font:500 9.5px/1 "Geist Mono",monospace;font-style:normal;letter-spacing:.05em;text-transform:uppercase;color:var(--ink)}
.hq-g .on em{background:var(--ink);color:#fff}
.hq-g svg{display:block;width:min(210px,72%);margin:22px auto 0;overflow:visible}.hq-g rect{fill:#c9ccd3}.hq-g .on rect{fill:var(--ink)}.hq-g .fr{fill:none!important;stroke:var(--ink);stroke-width:1}
.hq-g b{display:block;margin-top:clamp(28px,3vw,48px);font:400 clamp(24px,2.1vw,38px)/1.1 Georgia,"Times New Roman",serif;letter-spacing:-.02em}
.hq-g span{display:block;margin-top:12px;max-width:19em;font-size:clamp(14.5px,1vw,17px);line-height:1.5;color:var(--g2)}
/* ---- what gets built: a statement on its own, then the words scroll past a drawing that builds in plates ---- */
.pv{background:var(--dk);color:#fff}
.pv-o{display:grid;place-items:center;min-height:92vh;padding:0 24px;text-align:center}
.pv-o p{margin:0;max-width:14em;font:400 clamp(32px,3.6vw,66px)/1.1 Georgia,"Times New Roman",serif;letter-spacing:-.022em;text-wrap:balance}
.pv-g{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start;gap:clamp(32px,5vw,96px);padding:0 var(--pad);box-sizing:border-box}
.pv-w{padding:26vh 0 30vh}
.pv-x{display:block;min-height:84vh;color:#fff}
.pv-x b{display:block;font:400 clamp(46px,6.2vw,112px)/1 Georgia,"Times New Roman",serif;letter-spacing:-.03em}
.pv-x sup{margin-left:10px;font:500 11px/1 "Geist Mono",monospace;letter-spacing:.04em;color:#8f9197;vertical-align:top;position:relative;top:.9em}
.pv-x span{display:block;margin-top:24vh;max-width:17em;font-size:clamp(18px,1.55vw,27px);line-height:1.28;font-weight:500;letter-spacing:-.015em;color:#fff}
.pv-a{position:sticky;top:0;height:100vh;display:flex;align-items:center;justify-content:center}
.pv-d{width:min(620px,100%);height:auto;max-height:78vh;overflow:visible}
.pv-d *{fill:none;stroke:#fff;stroke-width:1;vector-effect:non-scaling-stroke}.pv-d .gd{stroke:#3a3b40;stroke-dasharray:1.5 5}
.pv-d .pt8{--c:calc(var(--p,1) - var(--i)*.126 + .03);--q:clamp(0,calc(var(--c)*13),1);--n:clamp(0,calc(1 - max(var(--c) - .06,.06 - var(--c))*9),1);--t:1;opacity:var(--q);
transform:matrix(calc(1 - .296*var(--t)),calc(.278*var(--t)),calc(-.704*var(--t)),calc(1 - .722*var(--t)),220,calc(var(--y) - (1 - var(--q))*60))}
.pv-d .pt8:first-of-type{--t:clamp(0,calc(var(--p,1)*16 - .15),1);opacity:1;transform:matrix(calc(1 - .296*var(--t)),calc(.278*var(--t)),calc(-.704*var(--t)),calc(1 - .722*var(--t)),220,calc(290 + (var(--y) - 290)*var(--t)))}
.pv-d .pt8>*{stroke-opacity:calc(.2 + var(--n)*.5)}.pv-d .pl{fill:rgba(16,16,16,.93);stroke-opacity:calc(.34 + var(--n)*.66)}
.pv-d .dt{fill:#fff;stroke:none;fill-opacity:calc(.3 + var(--n)*.6)}.pv-d .q{fill:#fff;stroke:none;fill-opacity:calc(.4 + var(--n)*.6)}.pv-d .ds{stroke-dasharray:2 5}.pv-d .nb{fill:#101010}
.pv-d text{--c:calc(var(--p,1) - var(--i)*.126 + .03);fill:#fff;stroke:none;font:500 9.5px "Geist Mono",monospace;letter-spacing:.06em;opacity:clamp(0,calc(1 - max(var(--c) - .06,.06 - var(--c))*14),1)}
.pv-d text:first-of-type{opacity:calc(clamp(0,calc(var(--p,1)*16 - .6),1)*clamp(0,calc(1 - max(var(--c) - .06,.06 - var(--c))*14),1))}
.pv-e{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;padding:clamp(56px,6vw,110px) var(--pad) clamp(90px,9vw,170px);box-sizing:border-box}.pv-e p{margin:0;font-size:14.5px;color:#7f8187}
@media(max-width:860px){.hq-i{padding:64px var(--pad)}.hq-t{grid-template-columns:minmax(0,1fr)}.hq-g{grid-template-columns:repeat(2,minmax(0,1fr));gap:40px 20px;margin-top:48px}.pv-o{min-height:60vh}
.pv-g{grid-template-columns:minmax(0,1fr)}.pv-a{position:static;height:auto;order:-1;padding-top:8px}.pv-d{width:260px}.pv-d text{display:none}.pv-w{padding:36px 0 48px}.pv-x{min-height:0;padding:22px 0;border-top:1px solid var(--dl)}.pv-x b{font-size:34px}.pv-x span{margin-top:10px;font-size:16px;font-weight:400;color:#a3a5aa}.pv-e{padding:40px var(--pad) 72px}}
/* fine vertical lines along the top and bottom of the dark section, inside the frame; side rules; a ruled strip with nodes */
.pv{position:relative;border-top:1px solid var(--dl)}
.pv::before,.pv::after{content:"";position:absolute;left:max(100px,calc((100vw - 1390px)/2));right:max(100px,calc((100vw - 1390px)/2));height:240px;pointer-events:none;background:repeating-linear-gradient(90deg,rgba(255,255,255,.075) 0 1px,transparent 1px 7px)}
.pv::before{top:0;-webkit-mask-image:linear-gradient(180deg,#000,transparent);mask-image:linear-gradient(180deg,#000,transparent)}
.pv::after{bottom:0;-webkit-mask-image:linear-gradient(0deg,#000,transparent);mask-image:linear-gradient(0deg,#000,transparent)}
.pv-o,.pv-g,.pv-e{position:relative;z-index:1}
.pv-g,.pv-e{border-left:1px solid var(--dl);border-right:1px solid var(--dl)}.pv-e{border-bottom:1px solid var(--dl)}
.rsp{position:relative;z-index:1;height:58px;box-sizing:border-box;border:1px solid var(--dl);background:repeating-linear-gradient(90deg,var(--dl) 0 1px,transparent 1px 58px)}
.rsp::before,.rsp::after{content:"";position:absolute;top:-3px;width:5px;height:5px;background:#55575d;box-shadow:0 58px 0 #55575d}.rsp::before{left:-3px}.rsp::after{right:-3px}
@media(max-width:860px){.pv::before,.pv::after{left:var(--pad);right:var(--pad)}}
/* past the top, the audit window steps back and three small windows come out from behind it, each filling in as you scroll */
.hm{overflow:visible;overflow-x:clip}
.hm-q{display:none}
.hm-x.sp-live{height:155vh}.hm-x.sp-live .hm-y{position:sticky;top:0;height:100vh;display:flex;align-items:flex-start;justify-content:center;padding-top:clamp(84px,12vh,130px);box-sizing:border-box}
.hm-x.sp-live .hm-s{padding-bottom:0}.hm-x.sp-live .hm-w{transform:scale(calc(1 - min(var(--p,0)*2,1)*.2));transform-origin:50% 45%}
.hm-x.sp-live .hm-q{--e:clamp(0,calc((var(--p,0) - var(--s))*5),1);display:block;position:absolute;z-index:3;width:clamp(230px,17.5vw,300px);border-radius:4px;background:#fff;box-shadow:0 0 0 1px var(--ink);opacity:var(--e);font-size:13px}
.hm-q.q1{--s:.04;left:max(24px,calc(50% - 800px));top:15vh;transform:translate(calc((1 - var(--e))*140px),calc((1 - var(--e))*40px))}
.hm-q.q2{--s:.2;left:max(40px,calc(50% - 760px));top:50vh;transform:translate(calc((1 - var(--e))*140px),calc((1 - var(--e))*-40px))}
.hm-q.q3{--s:.12;right:max(24px,calc(50% - 800px));top:24vh;transform:translate(calc((1 - var(--e))*-140px),calc((1 - var(--e))*30px))}
.hm-qb{display:flex;justify-content:space-between;align-items:baseline;margin:0;padding:11px 12px 10px;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--g2)}.hm-qb b{font:540 13.5px/1 Inter,system-ui,sans-serif;letter-spacing:-.01em;text-transform:none;color:var(--ink)}
.hm-ld{--l:calc(var(--e)*clamp(70px,9vw,170px));position:absolute;top:58%;left:100%;width:var(--l);border-top:1px solid var(--ink)}.hm-ld::after{content:"";position:absolute;right:-4px;top:-4px;width:7px;height:7px;background:var(--ink);box-shadow:0 0 0 3px #fff}
.hm-q.q3 .hm-ld{left:auto;right:100%}.hm-q.q3 .hm-ld::after{right:auto;left:-4px}.hm-q.q2 .hm-ld{top:30%}
.hm-qc{margin:0;padding:12px;border-top:1px solid var(--ln);background:#fafafa}.hm-qc p{margin:0}
.hm-qc p[style]{--v:clamp(0,calc((var(--p,0) - var(--s) - .12 - var(--j)*.06)*14),1);opacity:var(--v);transform:translateY(calc((1 - var(--v))*8px))}
.hm-q .qk{font:500 10.5px/1.3 "Geist Mono",monospace;color:var(--g2);margin-bottom:10px}
.hm-q .qm{max-width:88%;margin-top:7px;padding:8px 10px;border-radius:10px 10px 10px 3px;background:#eceef2;line-height:1.35}.hm-q .qm b{display:block;font-weight:600}
.hm-q .qm.o{margin-left:auto;border-radius:10px 10px 3px 10px;background:var(--ink);color:#fff}
.hm-q .qr{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--ln);color:var(--g2)}.hm-q .qr b{font-weight:540;color:var(--ink)}.hm-q .qr.t b{font-size:16px}
.hm-x.sp-live .hm-q.dk{background:#17181a}.hm-q.dk .hm-qb{color:#8f9197}.hm-q.dk .hm-qb b{color:#fff}.hm-q.dk .hm-qc{background:#101010;border-top-color:#2c2d31;color:#e3e4e7;font:500 11px/1.5 "Geist Mono",monospace}.hm-q.dk .qk{color:#fff}
.hm-q .ql{display:flex;gap:10px;margin-top:5px}.hm-q .ql time{flex:none;width:4.6em;color:#7f8187}.hm-q .qf{margin-top:12px;padding-top:10px;border-top:1px solid #2c2d31;color:#8f9197}
/* moving between pages: the old page fades down a touch, the new one rises in */
@view-transition{navigation:auto}
::view-transition-old(root){animation:vt-out .22s cubic-bezier(.4,0,1,1) both}::view-transition-new(root){animation:vt-in .42s cubic-bezier(.2,.7,.2,1) both}
@keyframes vt-out{to{opacity:0;transform:translateY(-10px)}}@keyframes vt-in{from{opacity:0;transform:translateY(18px)}}
/* the three leaks keep their colours (Sam, 27 Nov: "I liked the colors here"): blue went right, red went wrong, amber is waiting */
.lk{--blue:#266df1;--red:#e5484e;--amber:#f0a001}
/* every build under "What we build": a full-width panel on hover or focus, a folding list in the phone menu */
.nav ul li.mg{position:static}.mg>a{display:inline-flex;align-items:center;gap:7px}
.mg>a i{width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:translateY(-2px) rotate(45deg);opacity:.55;transition:transform .2s}
.mg:hover>a i,.mg:focus-within>a i{transform:translateY(1px) rotate(225deg)}
.mg-p{position:absolute;left:0;right:0;top:100%;background:#fff;color:var(--ink);border-bottom:1px solid var(--ln);box-shadow:0 40px 60px -40px rgba(23,24,26,.28);opacity:0;visibility:hidden;transform:translateY(-6px);transition:opacity .18s,transform .18s,visibility 0s .18s}
.mg:hover .mg-p,.mg:focus-within .mg-p{opacity:1;visibility:visible;transform:none;transition:opacity .18s,transform .18s}
.mg-g{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:0;width:min(1390px,calc(100vw - 200px));margin:0 auto;border-left:1px solid var(--ln)}
.mg-g div{padding:26px 18px 28px;border-right:1px solid var(--ln)}
.mg-g p{margin:0 0 14px;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--g2)}
.mg-g a{display:block;padding:6px 0;font-size:14.5px;font-weight:500;letter-spacing:-.01em;color:var(--ink)}.mg-g a:hover{color:var(--g2)}
.mg-f{display:flex;gap:28px;width:min(1390px,calc(100vw - 200px));margin:0 auto;padding:16px 18px;box-sizing:border-box;border-top:1px solid var(--ln);border-left:1px solid var(--ln);border-right:1px solid var(--ln);font-size:14px;color:var(--g2)}
.mg-f a:first-child{color:var(--ink);font-weight:540}.mg-f a:hover{color:var(--ink)}
.mm-b{border-bottom:1px solid var(--ln)}.mm-b summary{display:flex;align-items:center;height:50px;font-size:17px;font-weight:520;letter-spacing:-.012em;cursor:pointer;list-style:none}.mm-b summary::-webkit-details-marker{display:none}
.mm-b summary::after{content:"";margin-left:auto;width:7px;height:7px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg)}.mm-b[open] summary::after{transform:rotate(225deg)}
.mm-b div{padding:4px 0 10px}.mm-b p{margin:10px 0 2px;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--g2)}
.mm-p .mm-b a{height:40px;font-size:15.5px;font-weight:480;border-bottom:0}
.mm-p{max-height:calc(100vh - 70px);overflow:auto}
@media(max-width:1180px){.mg-p{display:none}}
.tl.tl2{border-top:0}.tl.tl2 ul{grid-template-columns:repeat(7,minmax(0,1fr))}.tl2 li a{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:inherit}
@media(min-width:861px){.tl.tl2 li{border-right:1px solid var(--ln);border-bottom:0}.tl.tl2 li:last-child{border-right:0}}
@media(max-width:860px){.tl.tl2 ul{grid-template-columns:repeat(2,minmax(0,1fr))}.tl.tl2 li:nth-last-child(2){border-bottom:1px solid var(--ln)!important}}
/* fine vertical lines along the top and bottom of the closing block on every page */
.cl{background-image:linear-gradient(180deg,rgba(16,16,16,0) 0,var(--dk) 200px,var(--dk) calc(100% - 200px),rgba(16,16,16,0) 100%),repeating-linear-gradient(90deg,rgba(255,255,255,.075) 0 1px,transparent 1px 7px)}
/* the hero window walks through the fixes on its own; three windows beside it run in step */
.hm-m{display:grid}.hm-v{grid-area:1/1;min-width:0;opacity:0;visibility:hidden;transition:opacity .35s,visibility 0s .35s}.hm-v.on{opacity:1;visibility:visible;transition:opacity .45s .14s}
.hm-l div,.hm-r div{transition:background .3s,box-shadow .3s}.hm-r div.hi{box-shadow:0 0 0 1px var(--ink)}
.live [data-at]:not(.in){display:none}.live [data-at].in{animation:hmin .45s both}.live [data-hd]:not(.in){opacity:0}.live [data-hd].in{animation:hmin .45s both}
.hm-vb{margin-top:24px}.vr{display:flex;align-items:center;gap:14px;padding:13px 0;border-top:1px solid var(--ln);font-size:14.5px}.vr b{font-weight:520;flex:1}.vr span{font-size:13px;color:var(--g2);white-space:nowrap}
.vr em{font-style:normal;font-size:12px;font-weight:500;padding:4px 8px;border-radius:6px;background:#eeeef0;white-space:nowrap}.vr em.r{background:#fff;box-shadow:inset 0 0 0 1px var(--ink)}.vr em.k{background:var(--ink);color:#fff}
.vr.old{opacity:.5}.vr.lv{padding:16px 14px;margin:0 -14px 6px;border:1px solid var(--ink);border-radius:10px}
.vr.vt b{flex:0 0 44%}.vr.vt u{flex:1;order:2;height:6px;border-radius:3px;background:#eeeef0;overflow:hidden}.vr.vt u i{display:block;height:100%;background:var(--ink);border-radius:3px;transform-origin:left;transition:transform .6s cubic-bezier(.2,.7,.2,1)}
.vr.vt em{order:3;flex:0 0 6.4em;text-align:center}.vr.vt em.h{background:none;color:var(--g2);text-align:right;padding-right:0}.vr.vt em.k.in~u i{transform:scaleX(0)}
.vr.vs i{flex:none;width:7px;height:7px;background:var(--ink)}.vr.vs.k{font-weight:560}.vr.vs.k span{font-size:14.5px;font-weight:560;color:var(--ink)}
.vq{display:grid;grid-template-columns:repeat(13,minmax(0,1fr));gap:clamp(5px,.6vw,10px);margin-top:26px}
.vq i{aspect-ratio:.74;border:1px solid #c3c6cd;border-radius:3px;background:linear-gradient(#c3c6cd,#c3c6cd) 50% 30%/56% 1px no-repeat,linear-gradient(#c3c6cd,#c3c6cd) 50% 48%/56% 1px no-repeat,linear-gradient(#c3c6cd,#c3c6cd) 30% 66%/36% 1px no-repeat}
.vq i.on{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}.vq+.hm-vb{margin-top:16px}
.vf{margin:18px 0 0;display:flex;gap:10px;align-items:center;font:500 11.5px/1.3 "Geist Mono",monospace;letter-spacing:.02em}.vf b{color:var(--g2);font-weight:500}
.vf span::after{content:"";display:inline-block;width:6px;height:12px;margin-left:4px;vertical-align:-2px;background:var(--ink);animation:vcar 1s steps(1) infinite}@keyframes vcar{50%{opacity:0}}
.hx{display:none}
@media(min-width:861px){
.hm-x.sp-live{--dn:calc(min(var(--p,0)*2.4,1)*9vh)}.hm-x.sp-live .hm-w{transform:translateY(var(--dn)) scale(calc(1 - min(var(--p,0)*2.4,1)*.25));transform-origin:50% 42%}
.hm-x.sp-live .hx{--e:clamp(0,calc((var(--p,0) - var(--s))*5),1);display:block;position:absolute;z-index:3;width:clamp(180px,16.6vw,262px);opacity:var(--e);background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.16),0 30px 60px -34px rgba(38,38,40,.4);font-size:13px}
.hx-p{--s:.03;left:max(18px,calc(50% - 790px));top:calc(clamp(84px,12vh,130px) + 3vh + var(--dn));height:min(56vh,520px);border-radius:28px;padding:30px 12px 14px;box-sizing:border-box;transform:translateX(calc((1 - var(--e))*150px))}
.hx-nc{position:absolute;left:50%;top:10px;width:64px;height:7px;margin-left:-32px;border-radius:4px;background:var(--ink)}
.hx-n{--s:.1;right:max(18px,calc(50% - 790px));top:calc(clamp(84px,12vh,130px) + 3vh + var(--dn));border-radius:14px;padding:12px;min-height:150px;box-sizing:border-box;transform:translateX(calc((1 - var(--e))*-150px))}
.hx-l{--s:.17;right:max(18px,calc(50% - 790px));top:calc(clamp(84px,12vh,130px) + 3vh + 174px + var(--dn));border-radius:10px;padding:12px;min-height:min(30vh,250px);box-sizing:border-box;transform:translateX(calc((1 - var(--e))*-150px))}
.hm-x.sp-live .hx-l{background:#17181a;color:#e3e4e7;box-shadow:0 30px 60px -34px rgba(38,38,40,.5)}}
.hx-k{margin:0 0 12px;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--g2)}.hx-p .hx-k{text-align:center}.hx-l .hx-k{color:#fff}
.hx [data-sc]{display:none}.hx [data-sc].on{display:block}
.hx-e{margin:30% 0 0;text-align:center;color:var(--g3);font-size:12.5px}
.hb{max-width:86%;width:fit-content;margin:8px 0 0;padding:8px 10px;border-radius:12px 12px 12px 3px;background:#eceef2;line-height:1.35}.hb b{display:block;font-weight:600}
.hb.o{margin-left:auto;border-radius:12px 12px 3px 12px;background:var(--ink);color:#fff}
.hn{margin:0 0 8px;padding:10px 11px;border-radius:10px;background:#f4f5f7;line-height:1.35;color:var(--g2)}.hn b{display:block;font-weight:580;color:var(--ink)}
.hl{display:flex;gap:10px;margin:6px 0 0;font:500 11px/1.5 "Geist Mono",monospace}.hl time{flex:none;width:5.6em;color:#7f8187}
@media(max-width:860px){.vq{grid-template-columns:repeat(7,minmax(0,1fr))}.vr.vt b{flex-basis:50%}.vr.lv{margin:0 0 6px}}
.ph2{position:relative;flex:none;width:clamp(210px,17vw,250px);min-height:400px;border-radius:30px;padding:32px 12px 16px;box-sizing:border-box;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.16),0 30px 60px -34px rgba(38,38,40,.4);font-size:13px;text-align:left}
.ph2::before{content:"";position:absolute;left:50%;top:11px;width:64px;height:7px;margin-left:-32px;border-radius:4px;background:var(--ink)}
.ph2>p:first-child{margin:0 0 12px;text-align:center;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--g2)}
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

/* ---- what we build: the wheel and the eight parts ---- */
.au-e{display:none}
.bd{background:var(--dk);color:#fff}
.bd .lb{background:rgba(109,155,255,.16);color:#a9c4ff}
.btn.g{background:transparent;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.24)}
.bd-h{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);align-items:center;border-left:1px solid var(--dl);border-right:1px solid var(--dl)}
.bd-t{padding:clamp(96px,8vw,152px) var(--pad) clamp(88px,7.4vw,140px)}
.bd-t .st-t{color:#fff;max-width:17.5em;font-size:clamp(27px,1.95vw,37px)}.bd-t .st-t span{color:#8f9197}
.bd-t .btn{margin-top:clamp(24px,1.9vw,36px)}
.bd-r{padding:clamp(40px,3.4vw,64px) clamp(16px,2vw,38px);border-left:1px solid var(--dl);align-self:stretch;display:flex;align-items:center}
.bd-w{width:100%;height:auto;max-height:min(520px,60vh);overflow:visible}
.bd-k line{stroke:rgba(255,255,255,.22);stroke-width:1}.bd-k line:nth-child(5n+1){stroke:rgba(255,255,255,.5)}
.bd-sp{fill:none;stroke:#5d90fb;stroke-width:1.2;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1)}.bd-sp.lit{stroke-dashoffset:0}
.bd-n{fill:var(--dk);stroke:rgba(255,255,255,.4);stroke-width:1.3;transition:fill .35s,stroke .35s}
.bd-n.lit{fill:#5d90fb;stroke:#5d90fb;filter:drop-shadow(0 0 0 rgba(0,0,0,0))}
.bd-l{font:500 13.5px Inter,sans-serif;fill:#7f8187;letter-spacing:-.005em;transition:fill .35s}.bd-l.lit{fill:#fff}
.bd-c1{font:500 11px "Geist Mono",monospace;fill:#7f8187}.bd-c2{font:600 26px Inter,sans-serif;fill:#fff;letter-spacing:-.03em;transition:opacity .4s}
.bd.pre .bd-sp.lit{stroke-dashoffset:1}.bd.pre .bd-n.lit{fill:var(--dk);stroke:rgba(255,255,255,.4)}.bd.pre .bd-l.lit{fill:#7f8187}.bd.pre .bd-c2{opacity:.25}

.bd-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid var(--dl);border-bottom:0}
.bd-g a{display:block;padding:clamp(22px,1.5vw,28px) clamp(20px,1.42vw,27px) clamp(28px,2.1vw,40px);min-height:clamp(170px,10.6vw,202px);border-bottom:1px solid var(--dl);border-left:1px solid var(--dl);transition:background .2s}
.bd-g a:nth-child(4n+1){border-left:0}.bd-g a:hover{background:rgba(255,255,255,.035)}
.bd-g svg{display:block;width:clamp(20px,1.26vw,24px);height:clamp(20px,1.26vw,24px);fill:none;stroke:#a9abb0;stroke-width:1.4;stroke-linejoin:round;stroke-linecap:round}
.bd-g h3{margin:clamp(36px,2.9vw,56px) 0 0;font-size:clamp(15px,.92vw,17.5px);font-weight:560;letter-spacing:-.012em}
.bd-g p{margin:6px 0 0;font-size:clamp(14px,.84vw,16px);line-height:1.3;color:#8f9197;max-width:17em}
.bd-e{border-left:1px solid var(--dl);border-right:1px solid var(--dl);padding:clamp(40px,3.4vw,64px) var(--pad) clamp(88px,7vw,132px)}
.bd-e p{margin:0;font-size:clamp(15px,.92vw,17.5px);color:#8f9197}

/* ---- re-ordered page: audit first ---- */

td i.h{background:var(--amber)}td.n.h{color:#a86a00}td.n{white-space:nowrap}
.st2{border-top:0}
.hw{background:var(--dk);color:#fff}
.hw .lb,.cl .lb{background:rgba(109,155,255,.16);color:#a9c4ff}
.hw-g{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.06fr);border-left:1px solid var(--dl);border-right:1px solid var(--dl);border-bottom:1px solid var(--dl)}
.hw-t{padding:clamp(88px,7.4vw,140px) var(--pad) clamp(72px,6vw,112px)}
.hw-t .st-t{color:#fff;max-width:14em;font-size:clamp(27px,1.95vw,37px)}.hw-t .st-t span{color:#8f9197}
.hw ol{list-style:none;margin:clamp(36px,3vw,56px) 0 0;padding:0;counter-reset:s;max-width:34em}
.hw li{display:grid;grid-template-columns:clamp(30px,2.1vw,40px) 1fr;padding:clamp(14px,1.05vw,20px) 0;border-top:1px solid var(--dl)}
.hw li::before{counter-increment:s;content:counter(s);font:500 12px/1 "Geist Mono",monospace;color:#7f8187;padding-top:5px}
.hw li b{display:block;font-size:clamp(15px,.92vw,17.5px);font-weight:560;letter-spacing:-.012em}
.hw li span{display:block;margin-top:3px;font-size:clamp(14px,.84vw,16px);line-height:1.35;color:#8f9197}
.hw-r{border-left:1px solid var(--dl);padding:clamp(40px,3.4vw,64px) clamp(24px,2.6vw,50px);display:flex;align-items:center;justify-content:center}
.fd{width:100%;max-width:580px;background:#17181a;border-radius:12px;box-shadow:0 0 0 1px rgba(255,255,255,.09),0 40px 70px -36px rgba(0,0,0,.9)}
.fd-h{display:flex;align-items:center;gap:10px;height:46px;padding:0 18px;border-bottom:1px solid var(--dl);font-size:13px;color:#8f9197}
.fd-h b{color:#fff;font-weight:600}.fd-h .tag{margin-left:auto;font:500 11px/1 "Geist Mono",monospace;color:#7f8187}.fd-h .dot{width:9px;height:9px;border-radius:3px;background:#5d90fb}
.fd-r{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 16px;padding:13px 18px 14px;border-bottom:1px solid var(--dl)}
.fd-r small{grid-column:1/-1;font:500 11px/1 "Geist Mono",monospace;color:#7f8187}
.fd-r b{font-size:14px;font-weight:540;letter-spacing:-.008em}
.fd-r em{font-style:normal;font-size:14px;font-weight:560;font-variant-numeric:tabular-nums;white-space:nowrap;color:#ff8a8e}.fd-r em.r,.fd-r em.y{background:none}.fd-r em.r{color:#ff8a8e}.fd-r em.y{color:#f5b83d}
.fd-r span{grid-column:1/-1;display:flex;align-items:center;gap:8px;font-size:12.5px;color:#8f9197}.fd-r span i{width:6px;height:6px;border-radius:50%;background:#5d90fb;flex:none}
.fd-f{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:15px 18px 17px;font-size:12px;color:#8f9197}
.fd-f b{display:block;margin-bottom:2px;color:#fff;font-size:18px;font-weight:600;letter-spacing:-.025em;font-variant-numeric:tabular-nums}
@media(min-width:1700px){.fd{zoom:1.1}}
.wk{width:596px}.wk-b{margin-top:16px;padding-top:8px;border-top:1px solid var(--line)}
.wk-r{display:grid;grid-template-columns:204px 1fr 46px;align-items:center;gap:12px;height:42px;font-size:12.5px;color:var(--t2)}
.wk-r div{height:10px;border-radius:5px;background:#f1f2f5}.wk-r u{display:block;height:100%;border-radius:5px;background:var(--amber)}
.wk-r b{text-align:right;font-weight:540;color:var(--ink);font-variant-numeric:tabular-nums}
.cl{background:var(--dk);color:#fff;text-align:center}
.cl-i{border-left:1px solid var(--dl);border-right:1px solid var(--dl);padding:clamp(112px,9.5vw,180px) 24px clamp(120px,10vw,190px)}
.cl h2{margin:0;font-size:clamp(34px,2.95vw,56px);line-height:1.04;font-weight:600;letter-spacing:-.04em}
.cl p{margin:clamp(12px,.95vw,18px) 0 0;font-size:clamp(16px,1vw,19px);color:#8f9197}
.cl-i div{margin-top:clamp(24px,1.9vw,36px);display:flex;gap:8px;justify-content:center}.cl .btn:not(.g){background:#fff;color:var(--ink)}

/* ---- hero: the business laid out ---- */
.ground{height:654px}
.mp{position:relative;left:auto;top:6px;width:1000px;margin:0 auto}
.mp-b{position:relative;height:462px}
.mp-l{position:absolute;left:62px;right:62px;top:231px;height:0;border-top:1.5px dashed #cfd3dc;transform-origin:0 50%;animation:mpl .9s cubic-bezier(.2,.7,.2,1) both}
.mp-s{position:absolute;left:var(--x);top:209px;width:0}
.mp-t{position:absolute;left:-22px;top:0;width:44px;height:44px;border-radius:12px;background:#fff;display:grid;place-items:center;box-shadow:0 0 0 1px rgba(23,24,26,.1),0 2px 5px rgba(23,24,26,.06);color:var(--ink)}
.mp-t svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linejoin:round;stroke-linecap:round}
.mp-t::after{content:"";position:absolute;right:-4px;top:-4px;width:11px;height:11px;border-radius:50%;box-shadow:0 0 0 2px #fff}
.f-r .mp-t::after{background:var(--red)}.f-y .mp-t::after{background:var(--amber)}.ok .mp-t::after{background:#2a9d5c}
.mp-lb{position:absolute;left:0;top:53px;transform:translateX(-50%);white-space:nowrap;font-size:13px;font-weight:540;letter-spacing:-.008em;background:#fff;padding:0 6px}
.mp-ok{position:absolute;left:0;top:79px;transform:translateX(-50%);white-space:nowrap;display:inline-flex;align-items:center;height:21px;padding:0 8px;border-radius:999px;background:#e7f6ec;color:#1c7a43;font-size:11.5px;font-weight:520}
.mp-c{position:absolute;left:var(--cl);width:214px;padding:12px 13px 12px;border-radius:10px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.08),0 2px 4px rgba(23,24,26,.04),0 16px 30px -18px rgba(30,40,90,.3);animation:mpc .55s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(.35s + var(--d)*.13s)}
.mp-c.up{bottom:52px}.mp-c.dn{top:104px}
.mp-c::after{content:"";position:absolute;left:var(--cx);width:0;border-left:1.5px solid #cfd3dc}
.mp-c.up::after{top:100%;height:52px}.mp-c.dn::after{bottom:100%;height:24px}
.mp-c b{display:block;font-size:13.5px;font-weight:560;letter-spacing:-.01em;line-height:1.25}
.mp-c em{display:block;margin-top:5px;font-style:normal;font-size:15px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;background:none}
.mp-c em.r{color:var(--red);background:none}.mp-c em.y{color:#a86a00;background:none}
.mp-c span{display:flex;align-items:center;gap:7px;margin-top:9px;padding-top:9px;border-top:1px solid var(--line);font-size:12px;color:var(--t2)}
.mp-c span i{width:6px;height:6px;border-radius:50%;background:var(--blue);flex:none}
.mp-f{display:flex;align-items:flex-end;gap:44px;height:72px;padding:0 22px 16px;border-top:1px solid var(--line);font-size:12.5px;color:var(--t3)}
.mp-f b{display:block;color:var(--ink);font-size:19px;font-weight:600;letter-spacing:-.025em;font-variant-numeric:tabular-nums}
.mp-f p{margin:0 0 0 auto;font-size:12.5px;color:var(--t2)}
@keyframes mpc{from{opacity:0;transform:translateY(8px)}}@keyframes mpl{from{transform:scaleX(0)}}
@media(prefers-reduced-motion:reduce){.mp-c,.mp-l{animation:none}}
@media(max-width:1100px){.mp{zoom:.84}.ground{height:560px}}
/* ---- tools: the moving strip ---- */
.tm{border-top:1px solid var(--ln);border-bottom:1px solid var(--ln);padding:clamp(26px,2.1vw,40px) 0 clamp(30px,2.4vw,46px);text-align:center}
.tm p{margin:0 0 clamp(18px,1.5vw,28px);font-size:clamp(13px,.8vw,15px);color:var(--g2)}
.tm-v{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent);mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent)}
.tm ul{display:flex;width:max-content;list-style:none;margin:0;padding:0;animation:tm 52s linear infinite}
.tm:hover ul{animation-play-state:paused}
.tm li{display:flex;align-items:center;gap:10px;margin-right:clamp(44px,3.9vw,74px);font-weight:600;font-size:clamp(15px,1.03vw,19.5px);letter-spacing:-.015em;color:var(--ink);white-space:nowrap}
.tm li svg{width:clamp(20px,1.3vw,24px);height:clamp(20px,1.3vw,24px);flex:none}
@keyframes tm{to{transform:translateX(-50%)}}
@media(prefers-reduced-motion:reduce){.tm ul{animation:none}}
/* ---- the wheel's example tabs ---- */
.bd-x{width:100%}
.bd-tabs{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:clamp(14px,1.4vw,26px);flex-wrap:wrap}
.bd-tabs span{font:500 11px/1 "Geist Mono",monospace;color:#7f8187;margin-right:8px}
.bd-tabs button{appearance:none;border:0;cursor:pointer;height:30px;padding:0 12px;border-radius:999px;background:transparent;color:#8f9197;font:500 13px/1 Inter,sans-serif;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);transition:background .25s,color .25s}
.bd-tabs button.on{background:#fff;color:var(--ink);box-shadow:none}.bd-tabs button:focus-visible{outline:2px solid #5d90fb;outline-offset:2px}

/* ---- hero, louder: colour on the path, a job moving along it, a dark total ---- */
.stage{background:linear-gradient(rgba(255,255,255,0),#edf0ff 34%,#c9d3fb 100%)}
.stage::before{content:"";position:absolute;inset:0;background:radial-gradient(rgba(38,80,200,.2) 1px,transparent 1.4px) 0 0/22px 22px;-webkit-mask-image:linear-gradient(transparent 12%,#000 70%);mask-image:linear-gradient(transparent 12%,#000 70%);pointer-events:none}
.ground{height:706px;overflow:visible}
.mp{box-shadow:0 0 0 1px rgba(23,24,26,.07),0 2px 4px rgba(23,24,26,.04),0 40px 80px -30px rgba(40,60,150,.45)}
.mp-b{height:500px}
.mp-l{top:239px;border-top:2px dashed #c3c9d6}
.mp-l i{position:absolute;top:-6.5px;left:0;width:11px;height:11px;margin-left:-5.5px;border-radius:50%;background:var(--blue);box-shadow:0 0 0 4px rgba(38,109,240,.18);animation:mpd 8s linear infinite}
.mp-s{top:213px}
.mp-t{left:-26px;width:52px;height:52px;border-radius:14px}.mp-t svg{width:23px;height:23px;stroke-width:1.6}
.mp-t::after{display:none}
.mp-t::before{content:"";position:absolute;inset:-1px;border-radius:15px;border:2px solid currentColor;opacity:0;animation:mpp 8s linear infinite;animation-delay:calc(var(--i)*1.333s)}
.f-r .mp-t{background:#fdeceb;color:#cf3a3f;box-shadow:0 0 0 1px rgba(229,72,77,.3),0 3px 8px rgba(229,72,77,.14)}
.f-y .mp-t{background:#fff3d2;color:#a86a00;box-shadow:0 0 0 1px rgba(240,160,0,.38),0 3px 8px rgba(240,160,0,.14)}
.ok .mp-t{background:#e7f6ec;color:#1c7a43;box-shadow:0 0 0 1px rgba(42,157,92,.3)}
.mp-lb{top:62px;font-size:13.5px;font-weight:560}.mp-ok{top:89px}
.mp-c{width:222px;padding:14px 15px 13px;border-radius:12px;box-shadow:0 0 0 1px rgba(23,24,26,.08),0 2px 4px rgba(23,24,26,.05),0 22px 36px -18px rgba(30,40,110,.42)}
.mp-c::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0}
.mp-c.r::before{background:var(--red)}.mp-c.y::before{background:var(--amber)}
.mp-c.up{bottom:54px}.mp-c.dn{top:114px}.mp-c.up::after{height:54px}.mp-c.dn::after{height:26px}
.mp-c::after{border-left:2px solid #c3c9d6}
.mp-c b{font-size:13.5px}
.mp-c em{margin-top:4px;font-size:21px;font-weight:620;letter-spacing:-.035em;line-height:1.15}
.mp-c.r em{color:var(--red)}.mp-c.y em{color:#b87400}
.mp-c span{display:inline-flex;margin-top:10px;padding:0 9px;height:23px;border-top:0;border-radius:999px;background:#e7f6ec;color:#1c7a43;font-size:12px;font-weight:520;white-space:nowrap}
.mp-tot{position:absolute;z-index:2;left:-64px;bottom:-92px;width:258px;padding:18px 20px 16px;border-radius:14px;background:#101113;color:#fff;text-align:left;box-shadow:0 30px 60px -22px rgba(16,17,19,.7);animation:mpc .6s cubic-bezier(.2,.7,.2,1) 1.25s both}
.mp-tot .fk{color:#8f9197}
.mp-tot b{display:block;margin-top:12px;font-size:40px;line-height:1;font-weight:620;letter-spacing:-.045em;font-variant-numeric:tabular-nums}
.mp-tot>span{display:block;margin-top:5px;font-size:13px;color:#ff8a8e}
.mp-tot dl{margin:15px 0 0}.mp-tot dl div{display:flex;justify-content:space-between;align-items:center;height:34px;border-top:1px solid rgba(255,255,255,.1);font-size:12.5px}
.mp-tot dt{color:#a3a5aa}.mp-tot dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums;color:#f5b83d}
.mp-tot p{margin:10px 0 0;font-size:12px;color:#8f9197}
@keyframes mpd{0%{left:0;opacity:0}3%{opacity:1}97%{opacity:1}100%{left:100%;opacity:0}}
@keyframes mpp{0%{opacity:0;transform:scale(1)}1.5%{opacity:.7;transform:scale(1)}9%{opacity:0;transform:scale(1.42)}100%{opacity:0;transform:scale(1.42)}}
@media(prefers-reduced-motion:reduce){.mp-l i,.mp-t::before{animation:none;opacity:0}.mp-tot{animation:none}}
@media(max-width:1100px){.ground{height:610px}.mp-tot{left:-34px;width:236px}}

/* ---- hero, split: the words on the left, one audit on the right. Ink, grey and one blue. ---- */
.hs{background:#fff;border-bottom:1px solid var(--ln)}
.hs-g{display:grid;grid-template-columns:minmax(0,.94fr) minmax(0,1.06fr);border-left:1px solid var(--ln);border-right:1px solid var(--ln);min-height:min(860px,calc(100vh - clamp(60px,3.6vw,68px)))}
.hs-t{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:clamp(56px,5vw,96px) var(--pad)}
.hs h1{margin:clamp(20px,1.6vw,30px) 0 0;text-align:left;white-space:normal;max-width:9.6em;font-size:clamp(42px,3.75vw,70px);line-height:1.02;letter-spacing:-.042em;text-wrap:balance}
.hs .sub{margin:clamp(16px,1.3vw,24px) 0 0;text-align:left;max-width:26em}
.hs .cta{justify-content:flex-start;margin-top:clamp(24px,1.9vw,36px)}
.hs-n{margin:clamp(16px,1.2vw,22px) 0 0;font-size:clamp(13px,.76vw,14.5px);color:var(--t3)}
.hs-p{border-left:1px solid var(--ln);background:linear-gradient(180deg,#f6f8ff,#e6ebfd);display:flex;align-items:center;justify-content:center;padding:clamp(36px,3.4vw,64px) clamp(24px,3vw,56px);overflow:hidden}
.ac{position:relative;left:auto;top:auto;width:100%;max-width:540px;box-shadow:0 0 0 1px rgba(23,24,26,.07),0 2px 4px rgba(23,24,26,.04),0 36px 70px -32px rgba(40,60,150,.4)}
.ac .rep-h{height:auto;min-height:46px;flex-wrap:wrap;gap:4px 10px;padding:10px 18px}.ac .rep-h b,.ac .rep-h span{white-space:nowrap}
.ac-b{position:relative;padding:6px 0}
.ac-l{position:absolute;left:37.25px;top:36px;bottom:36px;border-left:1.5px dashed #cfd3dc}
.ac-l b{position:absolute;left:-6px;top:0;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:var(--blue);box-shadow:0 0 0 4px rgba(38,109,240,.16);animation:acd 7s linear infinite}
.ac-r{position:relative;display:grid;grid-template-columns:38px minmax(0,1fr) auto;column-gap:14px;row-gap:1px;align-items:center;padding:10px 20px;min-height:58px;animation:mpc .5s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(.15s + var(--d)*.07s)}
.ac-r+.ac-r::before{content:"";position:absolute;left:72px;right:20px;top:0;border-top:1px solid var(--line)}
.ac-i{grid-row:1/3;position:relative;z-index:1;width:38px;height:38px;border-radius:10px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.11),0 1px 2px rgba(23,24,26,.05);display:grid;place-items:center;color:var(--ink)}
.ac-i svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linejoin:round;stroke-linecap:round}
.ac-r>b{grid-column:2;align-self:end;font-size:14px;font-weight:560;letter-spacing:-.01em}
.ac-r>span{grid-column:2;align-self:start;font-size:12.5px;color:var(--t2)}
.ac-r>em{grid-column:3;grid-row:1;align-self:end;text-align:right;font-style:normal;font-size:14.5px;font-weight:600;letter-spacing:-.015em;font-variant-numeric:tabular-nums;white-space:nowrap;background:none;color:var(--ink)}
.ac-r>small{grid-column:3;grid-row:2;align-self:start;text-align:right;font-size:12px;color:var(--blue);white-space:nowrap}
.ac-r.ok>b{grid-row:1/3;align-self:center;font-weight:500;color:var(--t2)}.ac-r.ok>em{grid-row:1/3;align-self:center;font-size:12.5px;font-weight:500;color:var(--t3)}
.ac-r.ok .ac-i{color:var(--t3)}
.ac-f{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:17px 20px 18px;border-radius:0 0 12px 12px;background:#101113;color:#8f9197;font-size:12px}
.ac-f b{display:block;margin-bottom:3px;color:#fff;font-size:21px;font-weight:600;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
@keyframes acd{0%{top:0;opacity:0}4%{opacity:1}96%{opacity:1}100%{top:100%;opacity:0}}
@media(prefers-reduced-motion:reduce){.ac-l b{animation:none;opacity:0}.ac-r{animation:none}}
@media(min-width:1700px){.ac{zoom:1.16}}
@media(max-width:1180px){.hs h1{font-size:40px}.ac-r>small{display:none}}

/* ---- the finished page: what ran today, the ask after the findings, the quote, the footer ---- */
.rn-r{display:grid;grid-template-columns:62px 18px minmax(0,1fr);column-gap:12px;row-gap:2px;align-items:center;padding:13px 18px 14px;border-bottom:1px solid var(--dl)}
.rn-r time{grid-row:1/3;align-self:start;padding-top:3px;font:500 11.5px/1.2 "Geist Mono",monospace;color:#7f8187;white-space:nowrap}
.rn-r svg{grid-row:1/3;align-self:start;margin-top:1px;width:18px;height:18px;fill:none;stroke:#5d90fb;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.rn-r svg circle{fill:rgba(93,144,251,.14)}
.rn-r b{font-size:14px;font-weight:540;letter-spacing:-.008em}.rn-r span{grid-column:3;font-size:12.5px;color:#8f9197}
.rn-f{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 18px 15px;font-size:12.5px;color:#a3a5aa}
.rn-f em{font-style:normal;display:inline-flex;align-items:center;height:23px;padding:0 10px;border-radius:999px;background:rgba(109,155,255,.16);color:#a9c4ff;font-size:12px;font-weight:520;white-space:nowrap}
.lk-c{display:flex;align-items:center;justify-content:space-between;gap:24px;border:1px solid var(--ln);border-bottom:0;padding:clamp(36px,3vw,56px) var(--pad)}
.lk-c .bs{max-width:none}
.fq{border-bottom:1px solid var(--ln);background:#fff}
.fq-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(104px,9vw,172px) 24px clamp(100px,8.6vw,164px);text-align:center}
.fq blockquote{margin:0 auto;max-width:21em;font:400 clamp(27px,2.35vw,45px)/1.2 Georgia,"Times New Roman",serif;letter-spacing:-.018em;color:var(--ink);text-wrap:balance}
.fq blockquote.fill span{color:#c9cbd0;transition:color .25s}.fq blockquote.fill span.on{color:var(--ink)}
.fq p{margin:clamp(26px,2.2vw,42px) 0 0;font-size:clamp(13.5px,.82vw,15.5px);color:var(--t3)}.fq p b{display:block;color:var(--ink);font-weight:560}
.fo{background:var(--dk);color:#8f9197;border-top:1px solid var(--dl);font-size:clamp(13.5px,.82vw,15.5px)}
.fo-g{display:grid;grid-template-columns:minmax(0,1.7fr) repeat(3,minmax(0,1fr));gap:32px;border-left:1px solid var(--dl);border-right:1px solid var(--dl);padding:clamp(56px,4.6vw,88px) var(--pad) clamp(48px,4vw,76px)}
.fo .nav-b b{display:flex;align-items:center;gap:8px;color:#fff;font-weight:600;font-size:clamp(15px,.95vw,18px)}.fo .mk{color:#fff}
.fo-b p{margin:14px 0 0;max-width:19em;line-height:1.4}
.fo h4{margin:0 0 12px;font-size:inherit;font-weight:560;color:#fff}
.fo-g>div>a:not(.nav-b){display:block;padding:5px 0;transition:color .2s}.fo a:hover{color:#fff}
.fo-l{display:flex;flex-wrap:wrap;gap:8px 28px;align-items:center;border:1px solid var(--dl);border-bottom:0;padding:18px var(--pad) 22px;font-size:clamp(12.5px,.74vw,14px);color:#7f8187}
.fo-l span:last-child{margin-left:auto;display:flex;gap:20px}

/* ---- nav on every page: skip link, the right-hand group, the phone menu ---- */
.btn{white-space:nowrap}
.skip{position:absolute;left:12px;top:-60px;z-index:50;height:36px;padding:0 14px;display:flex;align-items:center;border-radius:9px;background:var(--ink);color:#fff;font-size:14px;font-weight:560;transition:top .15s}.skip:focus{top:12px}
.nav-r{display:flex;align-items:center;gap:8px}
.mm{display:none;position:relative}
.mm summary{list-style:none;width:clamp(34px,2.1vw,40px);height:clamp(34px,2.1vw,40px);display:grid;place-content:center;gap:5px;cursor:pointer;border-radius:9px;box-shadow:inset 0 0 0 1px rgba(23,24,26,.14)}
.mm summary::-webkit-details-marker{display:none}.mm summary i{display:block;width:15px;height:1.5px;border-radius:1px;background:var(--ink);transition:transform .2s}
.mm[open] summary i:first-child{transform:translateY(3.25px) rotate(45deg)}.mm[open] summary i:last-child{transform:translateY(-3.25px) rotate(-45deg)}
.mm-p{position:fixed;left:0;right:0;top:clamp(60px,3.6vw,68px);background:#fff;border-bottom:1px solid var(--ln);box-shadow:0 30px 50px -30px rgba(23,24,26,.25);padding:8px 16px 16px;display:grid}
.mm-p a{display:flex;align-items:center;height:50px;font-size:17px;font-weight:520;letter-spacing:-.012em;color:var(--ink);border-bottom:1px solid var(--ln)}.mm-p a:last-child{border-bottom:0}
.top.dk .mm summary{box-shadow:inset 0 0 0 1px rgba(255,255,255,.24)}.top.dk .mm summary i{background:#fff}
@media(max-width:1180px){.mm{display:block}}
a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--blue);outline-offset:2px;border-radius:6px}
/* the chat button, restyled for the light pages (its own script is shared with the older pages) */
.cc-l{background:#fff!important;color:var(--ink)!important;box-shadow:0 0 0 1px rgba(23,24,26,.1),0 14px 34px -14px rgba(30,40,90,.4)!important}.cc-l i{background:var(--blue)!important;border-radius:50%!important}

/* ============ inner pages ============ */
.ih{background:#fff;border-bottom:1px solid var(--ln)}
.ih-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);text-align:center;padding:clamp(72px,6.4vw,122px) 24px clamp(48px,4vw,76px)}
.ih h1{margin:clamp(18px,1.5vw,28px) auto 0;white-space:normal;max-width:14em;font-size:clamp(38px,3.2vw,60px);line-height:1.05;letter-spacing:-.04em;text-wrap:balance}
.ih .sub{margin:clamp(14px,1.2vw,22px) auto 0;max-width:33em}
.ih-p{background:linear-gradient(180deg,#fff,#f1f4ff 46%,#e2e8fd)}
.ih-pi{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:0 0 clamp(48px,4.4vw,84px);display:flex;justify-content:center;overflow:hidden}
@media(min-width:1700px){.ih-pi .mp{zoom:1.14}}
/* the audit map in ink, grey and one blue */
.mp.q{top:0}.mp.q .mp-b{height:470px}
.mp.q .mp-t,.mp.q .f-r .mp-t,.mp.q .f-y .mp-t,.mp.q .ok .mp-t{background:#fff;color:var(--ink);box-shadow:0 0 0 1px rgba(23,24,26,.11),0 2px 5px rgba(23,24,26,.06)}
.mp.q .ok .mp-t{color:var(--t3)}.mp.q .ok .mp-lb{color:var(--t2);font-weight:500}
.mp.q .mp-ok{background:none;color:var(--t3);padding:0;height:auto;font-weight:500}
.mp.q .mp-t::before{border-color:var(--blue)}
.mp.q .mp-c::before{display:none}
.mp.q .mp-c em,.mp.q .mp-c.r em,.mp.q .mp-c.y em{color:var(--ink);font-size:19px}
.mp.q .mp-c span{background:none;color:var(--blue);padding:0;height:auto;border-radius:0;font-weight:500;white-space:normal}
/* a hairline grid of short points */
.pg{border-top:1px solid var(--ln)}
.pg-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.pg-3 .pg-g{grid-template-columns:repeat(3,minmax(0,1fr))}
.pg-g>div{padding:clamp(22px,1.5vw,28px) clamp(20px,1.42vw,27px) clamp(30px,2.3vw,44px);min-height:clamp(168px,10.6vw,202px);border-bottom:1px solid var(--ln);border-left:1px solid var(--ln)}
.pg-4 .pg-g>div:nth-child(4n+1),.pg-3 .pg-g>div:nth-child(3n+1){border-left:0}
.pg-g svg{display:block;width:clamp(20px,1.26vw,24px);height:clamp(20px,1.26vw,24px);fill:none;stroke:var(--t2);stroke-width:1.4;stroke-linejoin:round;stroke-linecap:round}
.pg-g i{display:block;font:500 12px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3);height:clamp(20px,1.26vw,24px);padding-top:5px}
.pg-g h3{margin:clamp(36px,2.9vw,56px) 0 0;font-size:clamp(15px,.92vw,17.5px);font-weight:560;letter-spacing:-.012em}
.pg-g p{margin:6px 0 0;font-size:clamp(14px,.84vw,16px);line-height:1.34;color:var(--g2);max-width:19em}
.pg-n .pg-g h3{margin-top:clamp(28px,2.2vw,42px)}
/* a statement beside a picture */
.sp{border-top:1px solid var(--ln)}
.sp-g{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.sp-t{padding:clamp(88px,7.4vw,140px) var(--pad);align-self:center}.sp-t .st-t{max-width:15em;font-size:clamp(27px,1.95vw,37px)}
.sp-p{border-left:1px solid var(--ln);background:var(--pn);padding:clamp(48px,4vw,76px) clamp(24px,3vw,56px);display:flex;flex-direction:column;align-items:center;justify-content:center}
.sp-p .fc{margin:0;width:100%;max-width:440px}.sd-n{margin:14px 0 0;width:100%;max-width:440px;font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}
/* questions */
.fa{border-top:1px solid var(--ln)}
.fa-g{display:grid;grid-template-columns:24.9% minmax(0,1fr);border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.fa-t{padding:clamp(72px,6vw,112px) var(--pad);border-right:1px solid var(--ln)}.fa-t .st-t{margin:0;font-size:clamp(27px,1.95vw,37px)}
.fa dl{margin:0;padding:clamp(56px,4.8vw,92px) var(--pad)}
.fa dl div{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:8px 32px;padding:clamp(16px,1.3vw,24px) 0;border-top:1px solid var(--ln)}.fa dl div:first-child{border-top:0}
.fa dt{font-size:clamp(15.5px,.95vw,18px);font-weight:540;letter-spacing:-.012em}.fa dd{margin:0;font-size:clamp(15px,.9vw,17px);line-height:1.4;color:var(--g2)}
.fa dd a{color:var(--ink);text-decoration:underline;text-decoration-color:var(--g3);text-underline-offset:3px}
/* the booking calendar */
.bk2{border-top:1px solid var(--ln);background:#fff}
.bk2-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(72px,6vw,112px) var(--pad) clamp(64px,5.4vw,104px)}
.bk2 .st-t{margin:0 0 clamp(28px,2.4vw,44px);font-size:clamp(27px,1.95vw,37px)}
.bk2 iframe{display:block;width:100%;height:clamp(640px,52vw,760px);border:0;border-radius:12px;background:var(--g);box-shadow:0 0 0 1px var(--ln)}
/* a quiet ask */
.as{border-top:1px solid var(--ln)}
.as-i{display:flex;align-items:center;justify-content:space-between;gap:24px;border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(36px,3vw,56px) var(--pad)}.as .bs{max-width:none}

/* ---- narrower screens ---- */
html,body{overflow-x:clip}
@media(max-width:1180px){.pg-4 .pg-g{grid-template-columns:repeat(2,minmax(0,1fr))}.pg-4 .pg-g>div:nth-child(4n+1){border-left:1px solid var(--ln)}.pg-4 .pg-g>div:nth-child(2n+1){border-left:0}.bd-g{grid-template-columns:repeat(2,minmax(0,1fr))}.bd-g a:nth-child(4n+1){border-left:1px solid var(--dl)}.bd-g a:nth-child(2n+1){border-left:0}}
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
.bd-h{grid-template-columns:minmax(0,1fr)}.bd-t{padding:72px var(--pad) 28px}.bd-t .st-t{font-size:25px}
.bd-r{border-left:0;padding:8px 6px 40px}.bd-l{font-size:15px}
.bd-g{grid-template-columns:minmax(0,1fr)}.bd-g a{min-height:0;display:grid;grid-template-columns:24px 1fr;column-gap:14px;padding:20px;border-left:0}
.bd-g svg{grid-row:1/3;margin:2px 0 0}.bd-g h3{margin:0}.bd-g p{max-width:none}.bd-e{padding:32px var(--pad) 72px}
.hw-g{grid-template-columns:minmax(0,1fr)}.hw-t{padding:72px var(--pad) 32px}.hw-t .st-t{font-size:25px}
.hw-r{border-left:0;padding:8px 16px 56px}.fd-h{height:auto;flex-wrap:wrap;gap:6px 10px;padding:12px 14px}.fd-h .tag{margin-left:0;width:100%}
.fd-r{padding:12px 14px 13px;gap:5px 10px}.fd-r b,.fd-r em{font-size:13px}.fd-f{padding:14px;gap:8px}.fd-f b{font-size:16px}
.wk{width:100%}.wk-r{grid-template-columns:128px 1fr 40px;gap:8px;height:46px;font-size:12px;line-height:1.25}
.cl-i{padding:88px 20px 96px}.cl-i div{flex-wrap:wrap}
.ground{height:auto!important}.mp{zoom:1;width:100%;top:0}.mp-b{height:auto;padding:4px 14px 6px}.mp-l{display:none}
.mp-s{position:relative;left:auto;top:auto;width:auto;display:grid;grid-template-columns:44px minmax(0,1fr);column-gap:12px;row-gap:8px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}.mp-s:first-of-type{border-top:0}
.mp-t{position:relative;left:auto;top:auto}.mp-lb{position:static;transform:none;background:none;padding:0;font-size:14px}
.mp-ok{position:static;transform:none;grid-column:2;justify-self:start}.mp-s.ok{grid-template-columns:44px auto 1fr}.mp-s.ok .mp-ok{grid-column:3;justify-self:end}
.mp-c{position:static;width:auto;grid-column:1/-1;animation:none}.mp-c::after{display:none}
.mp-f{height:auto;flex-wrap:wrap;gap:12px 22px;padding:14px;align-items:flex-start}.mp-f b{font-size:17px}.mp-f p{margin:0;width:100%}
.tm li{font-size:14.5px;margin-right:40px}
.stage::before{display:none}.mp-b{height:auto}.mp-t{left:auto;width:44px;height:44px;border-radius:12px}.mp-t::before,.mp-l i{display:none}
.mp-c{width:auto;padding:12px 14px}.mp-c em{font-size:19px}.mp-s{top:auto}
.mp-tot{position:static;width:auto;margin:6px 14px 14px;animation:none}.mp-tot b{font-size:34px}
.hs-g{grid-template-columns:minmax(0,1fr);min-height:0}.hs-t{padding:44px 20px 36px}.hs h1{font-size:37px;max-width:none}
.hs-p{border-left:0;border-top:1px solid var(--ln);padding:20px 14px 28px}.ac-r{padding:10px 14px;column-gap:12px}.ac-l{left:31.25px}.ac-r+.ac-r::before{left:64px;right:14px}
.ac-r>em{font-size:13.5px}.ac-r>small{display:block;grid-column:2;grid-row:3;text-align:left;white-space:normal}.ac-f{padding:15px 14px;gap:8px}.ac-f b{font-size:18px}
.rn-r{grid-template-columns:56px 18px minmax(0,1fr);padding:12px 14px 13px}.rn-f{padding:13px 14px;flex-wrap:wrap}
.lk-c{flex-direction:column;align-items:flex-start;padding:32px var(--pad)}
.fq-i{padding:80px 20px 76px}.fq blockquote{font-size:25px}
.fo-g{grid-template-columns:1fr 1fr;gap:32px 20px;padding:48px var(--pad) 40px}.fo-b{grid-column:1/-1}.fo-l span:last-child{margin-left:0}
.ih-i{padding:52px 20px 36px}.ih h1{font-size:34px}.ih-pi{padding:0 14px 28px;border:0}.mp.q .mp-b{height:auto}.mp.q .mp-c em{font-size:17px}
.pg-g,.pg-3 .pg-g,.pg-4 .pg-g{grid-template-columns:minmax(0,1fr)}.cta{flex-wrap:wrap}.pg-g>div{min-height:0;display:grid;grid-template-columns:24px 1fr;column-gap:14px;padding:20px;border-left:0!important}
.pg-g svg,.pg-g i{grid-row:1/3;margin:2px 0 0}.pg-g h3,.pg-n .pg-g h3{margin:0}.pg-g p{max-width:none}
.sp-g{grid-template-columns:minmax(0,1fr)}.sp-t{padding:64px var(--pad) 36px}.sp-t .st-t{font-size:25px}.sp-p{border-left:0;border-top:1px solid var(--ln);padding:24px 16px 32px}
.fa-g{grid-template-columns:minmax(0,1fr)}.fa-t{border-right:0;padding:56px var(--pad) 8px}.fa dl{padding:16px var(--pad) 48px}.fa dl div{grid-template-columns:minmax(0,1fr)}
.as-i{flex-direction:column;align-items:flex-start}
.bk2-i{padding:56px var(--pad) 48px}.bk2 iframe{height:680px}
.lg-r{gap:9px;padding:0 12px}.lg-r em{font-size:11.5px;padding:0 7px}
}
'''

LINKS = [('/everything', 'What we build'), ('/free-audit', 'The free audit'), ('/software', 'The app'), ('/who-its-for', 'Who it&rsquo;s for'), ('/story', 'Our story')]
# every build page, grouped, read from the old generator's data without running it; used for the menu under "What we build"
_bs = open(ROOT + '/design/build_services.py').read().split('\nBY = ')[0]
_bn = {'__file__': ROOT + '/design/build_services.py'}
exec(_bs, _bn)
_BY = {p['slug']: p for p in _bn['ALL']}
MEGA = ''.join('<div><p>%s</p>%s</div>' % (gname, ''.join('<a href="/%s">%s</a>' % (sl, _BY[sl]['name']) for sl in _bn['ORDER'][g])) for g, gname in _bn['GROUPS'])
NAV = ('<a class="skip" href="#main">Skip to content</a><header class="top"><div class="nav"><a href="/" class="nav-b" aria-label="Cinder Revenue Company, home"><b>%s Cinder Revenue</b></a>'
       '<ul><li class="mg"><a href="/everything" aria-haspopup="true">What we build<i></i></a><div class="mg-p"><div class="mg-g">%s</div>'
       '<div class="mg-f"><a href="/everything">See everything we build</a><a href="/day">One day with it running</a><a href="/audit">Check your site</a><a href="/questions">Questions</a></div></div></li>%s</ul>'
       '<div class="nav-r"><a class="btn" %s>Book your free audit</a>'
       '<details class="mm"><summary aria-label="Menu"><i></i><i></i></summary><nav class="mm-p" aria-label="Menu">%s<details class="mm-b"><summary>All 32 builds</summary>%s</details></nav></details></div></div></header>'
       % (mark, MEGA, ''.join('<li><a href="%s">%s</a></li>' % l for l in LINKS[1:]), CAL, ''.join('<a href="%s">%s</a>' % l for l in LINKS + [('/questions', 'Questions')]), MEGA))


# =====================================================================================
# Inner pages. Each one is built from the same pieces as the homepage and wrapped by page().
# =====================================================================================
def inner_hero(label, title, sub, buttons, picture=''):
    return ('<section class="ih"><div class="w ih-i"><span class="lb">%s</span><h1>%s</h1><p class="sub">%s</p><div class="cta">%s</div></div>%s</section>'
            % (label, title, sub, buttons, ('<div class="ih-p"><div class="w ih-pi">%s</div></div>' % picture) if picture else ''))


def cells(items, cls=''):
    """A hairline grid of short points: (icon key or number, title, text)."""
    out = ''
    for k, t, d in items:
        mark_ = ('<svg viewBox="0 0 24 24" aria-hidden="true">%s</svg>' % IC[k]) if k in IC else '<i>%s</i>' % k
        out += '<div>%s<h3>%s</h3><p>%s</p></div>' % (mark_, t, d)
    return '<section class="pg %s"><div class="w pg-g">%s</div></section>' % (cls, out)


def statement(label, lead, rest, cls=''):
    return ('<section class="st %s"><div class="w st-i"><span class="lb">%s</span><p class="st-t">%s <span>%s</span></p></div></section>' % (cls, label, lead, rest))


def split(label, lead, rest, picture, extra=''):
    return ('<section class="sp"><div class="w sp-g"><div class="sp-t"><span class="lb">%s</span><p class="st-t">%s <span>%s</span></p>%s</div>'
            '<div class="sp-p">%s</div></div></section>' % (label, lead, rest, extra, picture))


def faq(title, qa):
    return ('<section class="fa"><div class="w fa-g"><div class="fa-t"><p class="st-t">%s</p></div><dl>%s</dl></div></section>'
            % (title, ''.join('<div><dt>%s</dt><dd>%s</dd></div>' % x for x in qa)))


def ask(lead, rest, label, href):
    return ('<section class="as"><div class="w as-i"><p class="bs">%s <span>%s</span></p><a class="btn q" href="%s">%s</a></div></section>' % (lead, rest, href, label))


BOOK = '<a class="btn" %s>Book your free audit</a>' % CAL

# ---------- /free-audit ----------
MAP = ('<div class="card mp q"><div class="rep-h"><span class="dot"></span><b>Free audit</b><span>Ridgeline Fence</span><span class="tag">Example business, sample data</span></div>'
       '<div class="mp-b"><div class="mp-l"><i></i></div>%s</div></div>' % steps)
AUDIT = (
    inner_hero('The free audit', 'A full audit of your business, free.',
               'We walk your business from the first call to the last invoice and show you what it&rsquo;s costing you, in dollars a month and hours a week, and what to fix first.',
               BOOK + '<a class="btn q" href="/audit">Check your site in 60 seconds</a>', MAP)
    + statement('How it works', 'Fifteen minutes, then it&rsquo;s yours.', 'No slides and no pitch deck. One call about how your business runs, and a short report you keep whether or not you work with us.')
    + cells([('1', 'Book a time.', 'Pick a slot. Bring rough numbers: leads a month, your average job, how many quotes you close.'),
             ('2', 'We walk your business.', 'Calls, forms, texts, estimates, quotes, invoices, reviews and the work done by hand, including after hours.'),
             ('3', 'You keep the plan.', 'What it&rsquo;s costing you, a number on each finding, and what to fix first.')], 'pg-3 pg-n')
    + ('<section class="hw"><div class="w hw-g"><div class="hw-t"><span class="lb">What you leave with</span>'
       '<p class="st-t">A short report with a number on everything. <span>Made from your business, not from a template.</span></p>'
       '<ol>%s</ol></div><div class="hw-r">%s</div></div></section>'
       % (''.join('<li><div><b>%s</b><span>%s</span></div></li>' % x for x in [
           ('Every finding, mapped.', 'Each place a job or an hour can slip, checked against how you run today.'),
           ('A figure on each.', 'Worked out from your own numbers: leads a month, average job, how many quotes you close.'),
           ('The order to fix them.', 'Ranked by what each one costs you, so the first fix is the one that pays most.'),
           ('A plan that&rsquo;s yours.', 'Take it to anyone, or build it yourself.')]), FD))
    + statement('What we look at', 'The whole business, part by part.', 'Not only how fast you answer the phone. Eight places where jobs, money or hours go missing.', 'st2')
    + cells([('find', 'Getting found.', 'What your website and your Google listing bring in, and what they lose.'),
             ('call', 'How leads come in.', 'Calls, forms, Facebook, Angi, Thumbtack. Where each one lands and who sees it.'),
             ('time', 'How they get answered.', 'How long a new lead waits to hear back, including after hours.'),
             ('cal', 'How estimates get booked.', 'Whether serious leads end up on your calendar and show up.'),
             ('quote', 'How quotes get followed up.', 'Quotes sent and never chased.'),
             ('money', 'How you get paid.', 'When invoices go out, how long they wait, and who reminds anyone.'),
             ('star', 'What happens after the job.', 'Finished jobs with no review request, no referral ask and no repeat work.'),
             ('team', 'What&rsquo;s done by hand.', 'Every task someone repeats each week that could run on its own.')], 'pg-4')
    + split('What to bring', 'Rough numbers are fine.', 'You don&rsquo;t need a spreadsheet. If you know roughly these four things, we can do the rest on the call.',
            facts('Bring these', 'Rough is fine', [('Leads a month', 'About 100', ''), ('Your average job', 'About $2,400', ''), ('Quotes you close', 'About 1 in 3', ''), ('Where leads come from', 'Google, Facebook, referrals', '')])
            + '<p class="sd-n">Sample answers</p>')
    + faq('Questions.', [('Is it really free?', 'Yes. You keep the plan whether or not you work with us.'),
                         ('How long is the call?', 'Fifteen minutes.'),
                         ('Do I need to prepare?', 'Just rough numbers. We do the rest.'),
                         ('What happens after?', 'If you want the fixes, we build them for your business and price them to it. If not, you keep everything we found.'),
                         ('Rather write?', 'Email <a href="mailto:sam.cinderrevenue@gmail.com">sam.cinderrevenue@gmail.com</a>.')])
    + ask('Start with your website.', 'A free check of your site in 60 seconds, before the call.', 'Check your site', '/audit')
    + ('<section class="bk2" id="book"><div class="w bk2-i"><p class="st-t">Pick a time. <span>Fifteen minutes, on the phone or on video.</span></p>'
       '<iframe src="https://cal.com/audit-call/15min?embed=true&amp;theme=light" title="Book your free audit" loading="lazy"></iframe></div></section>')
    + CL)

import hashlib
# Sam, 27 Nov: black, white and grey across the site. Every coloured value in the stylesheets and the pages is turned into the grey of
# the same lightness on the way out. Kept as they are: the three Mac window buttons and the cool wash of the chapter bands.
_KEEP = {'#e4ebfe', '#1f4fbe', '#266df1', '#e5484e', '#f0a001', '#ff5f57', '#febc2e', '#28c840', '#c3ccdb', '#aab6cc', '#8f9bb8', '#a7a9c4', '#b4c0d2', '#e2e6f2', '#e6e4f0'}
_KEEP_RGB = {(170, 182, 204), (143, 155, 184), (195, 204, 219), (167, 169, 196), (180, 192, 210), (226, 230, 242), (230, 228, 240)}
def _grey(r, g, b):
    if max(r, g, b) - min(r, g, b) < 22:
        return None
    y = .299 * r + .587 * g + .114 * b
    if y < 120 and max(r, g, b) - min(r, g, b) > 90:
        y *= .55   # a strong accent becomes near-ink, not a muddy mid grey
    y = int(round(max(0, min(255, y))))
    return y, y, min(255, y + 2)
def mono(text):
    def hx(m):
        h = m.group(0).lower()
        if h in _KEEP:
            return m.group(0)
        q = _grey(int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))
        return m.group(0) if q is None else '#%02x%02x%02x' % q
    def rg(m):
        r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if (r, g, b) in _KEEP_RGB:
            return m.group(0)
        q = _grey(r, g, b)
        return m.group(0) if q is None else 'rgba(%d,%d,%d,' % q
    return re.sub(r'rgba\((\d+),\s*(\d+),\s*(\d+),', rg, re.sub(r'#[0-9a-fA-F]{6}\b', hx, text))


JS += r"""
[].forEach.call(document.querySelectorAll('.hm-x,[data-live]'),function(x){
var gr=[].slice.call(x.querySelectorAll('[data-sc]')),at=[].slice.call(x.querySelectorAll('[data-at],[data-hd]'));if(!at.length)return;
var vs=[].slice.call(x.querySelectorAll('.hm-v')),sd=[].slice.call(x.querySelectorAll('.hm-l div')),fr=[].slice.call(x.querySelectorAll('.hm-r div')),sc=0,st=0,vis=true,n=1;
var len=(x.getAttribute('data-live')||'4,7,7,7,7').split(',').map(Number);
gr.forEach(function(g){n=Math.max(n,+g.getAttribute('data-sc')+1)});
at.forEach(function(e){var g=e.closest('[data-sc]');e._s=g?+g.getAttribute('data-sc'):-1;e._a=+(e.getAttribute('data-at')||e.getAttribute('data-hd'));e._z=e.hasAttribute('data-to')?+e.getAttribute('data-to'):99});
function type(el){var t=el.getAttribute('data-ty'),k=0;clearTimeout(el._t);el.textContent='';(function f(){k+=2;el.textContent=t.slice(0,k);if(k<t.length)el._t=setTimeout(f,22)})()}
function draw(fresh){gr.forEach(function(g){g.classList.toggle('on',+g.getAttribute('data-sc')===sc)});
at.forEach(function(e){var on=(e._s<0||e._s===sc)&&st>=e._a&&st<e._z,was=e.classList.contains('in');e.classList.toggle('in',on);if(on&&!was){var t=e.hasAttribute('data-ty')?e:e.querySelector('[data-ty]');if(t)type(t)}});
if(fresh&&vs.length){var v=vs[sc],s=+v.getAttribute('data-s'),f=+v.getAttribute('data-f');sd.forEach(function(d,j){d.classList.toggle('on',j===s)});fr.forEach(function(d,j){d.classList.toggle('hi',j===f)});
var h=v.querySelector('h2[data-ty]');if(h)type(h)}}
x.classList.add('live');
var q=/[?&]view=(\d)(?:&step=(\d))?/.exec(location.search);if(q){sc=Math.min(+q[1],n-1);st=q[2]?+q[2]:9;draw(true);return}
draw(true);if('IntersectionObserver' in window)new IntersectionObserver(function(e){vis=e[0].isIntersecting}).observe(x);
setInterval(function(){if(!vis||document.hidden)return;st++;if(st>(len[sc]||len[len.length-1])){sc=(sc+1)%n;st=0;draw(true)}else draw(false)},1050)});
"""
ALLCSS = mono(hero_css + CSS)
VER = hashlib.sha1((ALLCSS + JS).encode()).hexdigest()[:8]
open(ROOT + '/site/assets/light.css', 'w').write(ALLCSS.strip() + '\n')
open(ROOT + '/site/assets/light.js', 'w').write(JS.strip() + '\n')


# Sam, 27 Nov: nothing on the site is tailored to one trade. The example business and every sample job, message and line item
# are made general on the way out, so the page builders can keep their own wording. Longest phrases first.
_DT = [
    ('&ldquo;180 feet of cedar privacy, six foot. Two gates. Old chain link comes out.&rdquo;', '&ldquo;Full install, standard size. Two add-ons. The old one comes out.&rdquo;'),
    ('180 ft of cedar privacy, two gates.', 'Full install, two add-ons.'),
    ('Can I get a quote on a new water heater?', 'Can I get a quote on a replacement?'), ('Question about a water heater', 'Question about a replacement'),
    ('and the fence looks great', 'and the work looks great'), ('Gate started sagging after a month.', 'It started acting up after a month.'),
    ('How do we price a double drive gate?', 'How do we price a rush job?'),
    ('Double drive gate: priced per opening, plus hardware. See the gate page for the current rates.', 'Rush jobs: priced per visit, plus materials. See the pricing page for the current rates.'),
    ('These are the fence people we used.', 'These are the people we used.'),
    ('6 ft, cedar on steel posts', 'Premium materials'), ('6 ft, cedar pickets and rails', 'Upgraded materials'), ('6 ft, dog-ear pickets', 'Standard materials'),
    ('6 years, wood and vinyl', '6 years, installs and repairs'), ('Six, wood and vinyl', 'Six'), ('719 number, wanted gate, never replied', '719 number, wanted a repair, never replied'),
    ('A burst pipe. The on-call phone rang.', 'An emergency. The on-call phone rang.'), ('The burst pipe at 2 AM', 'The emergency at 2 AM'), ('Burst pipe', 'Emergency call'),
    ('A fence you built needs staining in two years.', 'The job you finished needs service in two years.'), ('Actually the gate is sagging', 'Actually, something needs a look'),
    ('someone who is on a roof', 'someone who is on a job'), ('Can we go 7 ft on a back fence in Monument?', 'Do we need a permit for this in Monument?'),
    ('Another one done. Cedar privacy fence in Monument.', 'Another one done. Full install in Monument.'), ('Cedar privacy fence finished in Monument.', 'Full install finished in Monument.'),
    ('New cedar privacy fence, finished today in Monument.', 'New install, finished today in Monument.'), ('Cedar privacy fence, 180 ft. Monument.', 'Full install. Monument.'),
    ('Cedar privacy fence, 6 ft', 'Main install'), ('Cedar fence, 120 ft', 'Full install'), ('cedar fence 120 ft', 'full install'), ('Cedar fence, 2023', 'Install, 2023'), ('Cedar fence, Split Rail Dr', 'Install, Split Rail Dr'),
    ('Privacy fence, Split Rail Dr', 'Install, Split Rail Dr'), ('Cedar pickets, 6 ft', 'Materials'), ('Cedar, 6 ft', 'Materials'), ('per ft', 'per unit'),
    ('Cedar, vinyl, chain link, gates, repairs', 'Installs, replacements, repairs'), ('Chain link, 300 ft', 'Large install'),
    ('Checking in on the cedar fence quote.', 'Checking in on your quote.'), ('Do you build cedar fences in Monument?', 'Do you work in Monument?'),
    ('Yes. Cedar privacy and picket, and Monument is in our service area.', 'Yes, Monument is in our service area.'), ('Do you do gate repairs?', 'Do you do repairs?'),
    ('Yes, fence and gate repairs.', 'Yes, we do repairs.'), ('Yes. Fence and gate repairs across', 'Yes. Repairs across'), ('Do you do vinyl fencing?', 'Do you cover my area?'), ('Do you do vinyl?', 'Do you do repairs?'),
    ('sorry about the gate', 'sorry about that'), ('while you were on the roof', 'while you were on a job'), ('While you were on the roof', 'While you were on a job'),
    ('you&rsquo;re off the roof', 'you&rsquo;re off the job'), ('you&rsquo;re on a roof', 'you&rsquo;re on a job'), ('Estimate, new fence', 'Estimate, new install'),
    ('Example plumber, sample data', 'Example business, sample data'), ('Fence contractor. Open now.', 'Service company. Open now.'), ('Open now. Fences, gates, repairs.', 'Open now. Installs, repairs, service.'),
    ('Fence line done on the north and east sides. Gate drags at the bottom and needs a rehang.', 'Main work done on the north and east sides. One part needs a second visit.'),
    ('Fences built right.', 'Work done right.'), ('Fences, roofs, wiring, drains. The thing', 'The work itself. The thing'), ('Five years on posts and rails, two on gates.', 'Five years on installs, two on repairs.'),
    ('For fence: measure the run on site and the quote builds itself.', 'Measure on site and the quote builds itself.'), ('Gate stuck open, customer waiting', 'Urgent repair, customer waiting'),
    ('Glad the gate is swinging right again.', 'Glad it&rsquo;s working right again.'), ('happy with the fence', 'happy with the work'), ('Had a wood fence built', 'Had work done'),
    ('questions on the fence quote', 'questions on the quote'), ('since your fence went in', 'since we finished your job'), ('invoice for your gate install', 'invoice for your job'),
    ('invoice for the gate install', 'invoice for the job'), ('photos of your new gate', 'photos of the finished job'), ('Your gate install now starts', 'Your job now starts'),
    ('How many years installing fence?', 'How many years doing this work?'), ('How much for a gate repair?', 'How much for a repair?'), ('How much would it be to fix a sagging gate?', 'How much would a repair cost?'),
    ('I need a quote on a privacy fence.', 'I need a quote on a new install.'), ('Lumber yard', 'Supplier'), ('New caller, gate repair', 'New caller, repair'), ('New caller, privacy fence', 'New caller, new install'),
    ('New cedar privacy fence', 'New install'), ('New fence, 180 ft', 'New install'), ('New fence', 'New install'), ('Old fence removed, stain included', 'Old one removed, finish included'), ('Old fence removed', 'Old one removed'),
    ('Two walk gates, one drive gate', 'Three add-ons'), ('Two walk gates', 'Two add-ons'), ('One walk gate', 'One add-on'), ('Walk gates', 'Add-ons'), ('Walk gate', 'Add-on'),
    ('One year since the gate went in.', 'One year since the job.'), ('Order two posts. Come back Thursday for the gate.', 'Order two parts. Come back Thursday to finish.'),
    ('Pickets, rails, posts, concrete, two gate kits.', 'Materials, fittings and two add-on kits.'), ('Privacy fence, about 180 ft', 'Full install'), ('Privacy fence, 180 ft', 'Full install'),
    ('Ranch fencing', 'Large project'), ('Remove old chain link', 'Remove the old one'), ('Split Rail Dr, cedar, paid', 'Split Rail Dr, install, paid'), ('for your fence estimate', 'for your estimate'),
    ('Standby generators', 'Larger installs'), ('That cedar line along the back was a fun one to build. Enjoy the yard.', 'That was a good one to work on. Enjoy it.'),
    ('The documents a fence job needs', 'The documents a job needs'), ('Tue 11:05, gate repair', 'Tue 11:05, repair'),
    ('Two posts short. Gate drags at the bottom. Back on Thursday.', 'Two parts short. One item needs a second visit. Back on Thursday.'), ('Two posts short. One bag of concrete left over.', 'Two parts short. One box of materials left over.'),
    ('Vinyl fence, 120 ft', 'Replacement'), ('Wants cedar', 'Wants the upgrade'), ('openings for fence staining', 'openings for service visits'), ('adds a gate on site', 'adds work on site'),
    ('What kind of fence, and roughly how long?', 'What do you need done, and how big is the job?'), ('warranty on cedar posts', 'warranty on parts'),
    ('Your cedar fence is two years old this month, which is when it should be stained.', 'Your install is two years old this month, which is when it&rsquo;s due for service.'),
    ('fence company near me', 'service company near me'), ('fence job - dave', 'job - dave'), ('Fence estimate, 7:40 AM', 'Estimate request, 7:40 AM'), ('Ridgeline Fence', 'Ridgeline Services'),
    ('Cedar with steel posts', 'Premium'), ('Cedar privacy fence', 'Upgraded'), ('Pine privacy fence', 'Standard'), ('Privacy fence', 'Full install'), ('Vinyl fence', 'Replacement'),
    ('Fence installer', 'Installer'), ('Fence install', 'Install'), ('Fence company', 'Service company'), ('Gate install', 'Small install'), ('Gate repair', 'Repair'), ('Gate quote', 'Repair quote'),
    ('Stain due in spring', 'Service due in spring'), ('Stain due', 'Service due'), ('>Stain<', '>Service<'), ('Matching the old stain took a few tries', 'Getting it to match took a few tries'),
    ('Time to stain.', 'Time for service.'), ('Staining, servicing, seasonal checks.', 'Servicing, seasonal checks, inspections.'), ('servicing, sealing, staining or inspections', 'servicing, seasonal checks or inspections'),
    ('About 180 ft', 'A full job'), ('>180 ft<', '>1<'), ('>Chain link<', '>Basic<'), ('>Gate<', '>Repair<'), ('>Fence<', '>Install<'),
]
_DT_LEFT = re.compile(r"fenc|\bgates?\b|cedar|vinyl|chain.link|picket|\broof|hvac|plumb|landscap|hardscap|\bconcrete|\bpaint|generator|water heater|burst pipe|\bft\b|lumber|\bstain", re.I)
def detrade(doc, path=''):
    for a, b in _DT:
        doc = doc.replace(a, b)
    left = set(t.strip()[:90] for t in re.findall(r'>([^<>]{2,})<', re.sub(r'<script.*?</script>|<nav.*?</nav>|<footer.*?</footer>', '', doc, flags=re.S)) if _DT_LEFT.search(t))
    if left:
        print('TRADE WORDS LEFT', path, sorted(left)[:8])
    return doc


def page(title, desc, path, body, index=True, css=''):
    return detrade(_page(title, desc, path, body, index, css), path)


def _page(title, desc, path, body, index=True, css=''):
    """One page of the light site: the shared head, nav, footer, stylesheet and script around its own sections."""
    url = 'https://cinderrevenue.com' + path
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            '<title>%(t)s | Cinder Revenue Company</title><meta name="description" content="%(d)s">%(robots)s<meta name="theme-color" content="#ffffff">'
            '<link rel="canonical" href="%(u)s"><meta property="og:title" content="%(t)s | Cinder Revenue Company"><meta property="og:description" content="%(d)s">'
            '<meta property="og:type" content="website"><meta property="og:url" content="%(u)s"><meta property="og:image" content="https://cinderrevenue.com/og.jpg">'
            '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:site_name" content="Cinder Revenue Company">'
            '<meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="any">'
            '<link rel="apple-touch-icon" href="/icon/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">'
            '<link rel="preload" href="/assets/fonts/InterVariable.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/assets/light.css?v=%(v)s">%(css)s</head>'
            '<body>%(nav)s<main id="main">%(body)s</main>%(ft)s<script src="/assets/light.js?v=%(v)s" defer></script><script src="/assets/cinder-chat.js" defer></script><script src="/t.js" defer></script></body></html>'
            % dict(t=title, d=desc, u=url, v=VER, nav=NAV, body=mono(body), ft=FT, robots='' if index else '<meta name="robots" content="noindex">', css=('<link rel="stylesheet" href="/assets/%s">' % css) if css else ''))


HOME = HERO + TOOLS + PROB + LK + WHAT + HW + CK + BD + FQ + CL   # promise, fits your tools, the problem, what we do, how it starts, how it works, what gets built, who is behind it, ask
DESC = 'A free fifteen-minute audit of your service business. We find what is costing you jobs and hours, put a number on it, and build systems made for the way you work.'
open(ROOT + '/site/index.html', 'w').write(page('Find out what your business is losing', DESC, '/', HOME))
open(ROOT + '/site/free-audit.html', 'w').write(page('The free audit', 'A free fifteen-minute audit of your service business. We walk it from the first call to the last invoice, put a number on what it is costing you, and tell you what to fix first. You keep the plan.', '/free-audit', AUDIT))
print('ok', len(HOME), 'css', len(ALLCSS), 'js', len(JS), VER)
