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
BD = ('<section class="bd"><div class="w bd-h"><div class="bd-t"><span class="lb">After the audit</span>'
      '<p class="st-t">Then we build whatever fixes it. <span>Made for your business, not pulled from a template. No two audits turn up the same list, '
      'so no two builds are the same.</span></p><a class="btn g" href="/everything">See everything we build</a></div>'
      '<div class="bd-r"><div class="bd-x">%s<div class="bd-tabs"><span>Example audits</span><button type="button" class="on">Fence company</button>'
      '<button type="button">Plumber</button><button type="button">Roofer</button></div></div></div></div><div class="w bd-g">%s</div>'
      '<div class="w bd-e"><p>The one thing we don&rsquo;t do is run ads.</p></div></section>'
      % (WHEEL, ''.join('<a href="%s"><svg viewBox="0 0 24 24" aria-hidden="true">%s</svg><h3>%s.</h3><p>%s</p></a>' % (h, IC[k], n, t) for n, k, t, h, _ in PARTS)))

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
HW = ('<section class="hw"><div class="w hw-g"><div class="hw-t"><span class="lb">How it works</span>'
      '<p class="st-t">One call. Then a plan with numbers on it. <span>You decide what gets built.</span></p>'
      '<ol>%s</ol></div><div class="hw-r">%s</div></div></section>'
      % (''.join('<li><div><b>%s</b><span>%s</span></div></li>' % st for st in STEPS), '@@RUN@@'))
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
HERO = ('<section class="hs"><div class="w hs-g"><div class="hs-t"><span class="pill"><i></i>The free audit takes fifteen minutes</span>'
        '<h1>Find out what your business is losing.</h1>'
        '<p class="sub">We take your business apart, put a number on what&rsquo;s costing you jobs and hours, and build systems made for it. Nothing off the shelf.</p>'
        '<div class="cta"><a class="btn" %s>Book your free audit</a><a class="btn q" href="/free-audit">See what we check</a></div>'
        '<p class="hs-n">Free. Fifteen minutes. You keep what we find.</p></div>'
        '<div class="hs-p"><div class="card ac"><div class="rep-h"><span class="dot"></span><b>Free audit</b><span>Ridgeline Fence</span>'
        '<span class="tag">Example business, sample data</span></div><div class="ac-b"><i class="ac-l"><b></b></i>%s</div>'
        '<div class="ac-f"><div><b>$6,400</b>lost a month</div><div><b>$14,600</b>waiting to be paid</div><div><b>11 hours</b>by hand a week</div></div>'
        '</div></div></div></section>' % (CAL, rows))

RAN = [('8:00 AM', 'Four customers reminded', 'Tomorrow&rsquo;s visits, by text'),
       ('9:15 AM', 'Quote #1042 followed up', 'The day-two check-in'),
       ('2:30 PM', 'Invoice sent', 'Cedar fence, the day it finished'),
       ('5:00 PM', 'Review asked for', 'Gate repair, finished yesterday'),
       ('7:42 PM', 'Missed call texted back', 'Nine seconds after it rang out')]
TICK = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.25"/><path d="m4.9 8.2 2.1 2.1 4.1-4.4"/></svg>'
RUN = ('<div class="fd rn"><div class="fd-h"><span class="dot"></span><b>What ran today</b><span>Ridgeline Fence</span><span class="tag">Example business, sample data</span></div>%s'
       '<div class="rn-f"><span>Five things done. None of them by hand.</span><em>1 needs you</em></div></div>'
       % ''.join('<div class="rn-r"><time>%s</time>%s<b>%s</b><span>%s</span></div>' % (t, TICK, a_, b_) for t, a_, b_ in RAN))
FQ = ('<section class="fq"><div class="w fq-i"><blockquote>&ldquo;I build and watch every client&rsquo;s system myself, and I only take on a few businesses at a time. '
      'If it isn&rsquo;t a fit, I&rsquo;ll say so.&rdquo;</blockquote><p><b>Sam Ward</b>Founder, Cinder Revenue</p></div></section>')
FT = ('<footer class="fo"><div class="w fo-g"><div class="fo-b"><a href="/" class="nav-b"><b>%s Cinder Revenue</b></a><p>We audit service businesses, then build what fixes them.</p></div>'
      '<div><h4>The audit</h4><a href="/free-audit">How it works</a><a href="/audit">Check your site</a><a %s>Book your free audit</a></div>'
      '<div><h4>What we build</h4><a href="/everything">Everything we build</a><a href="/websites">Websites</a><a href="/booking">Booking</a><a href="/estimates">Quotes</a><a href="/invoicing">Invoices</a><a href="/custom-builds">Custom builds</a></div>'
      '<div><h4>Company</h4><a href="/software">The app</a><a href="/trades">Trades</a><a href="/story">Our story</a><a href="/questions">Questions</a><a href="mailto:sam.cinderrevenue@gmail.com">Email Sam</a></div></div>'
      '<div class="w fo-l"><span>&copy; 2026 Cinder Revenue Company, Colorado</span><span>Pictures show an example business with sample data.</span>'
      '<span><a href="/privacy">Privacy</a><a href="/terms">Terms</a></span></div></footer>' % (mark, CAL))

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
if(matchMedia('(prefers-reduced-motion: reduce)').matches&&!/[?&]motion=on/.test(location.search))return;
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
var ck=document.querySelector('.ck'),top=document.querySelector('.top'),darks=document.querySelectorAll('.au,.hw,.bd,.cl,.fo');if(!ck)return;
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
if(document.querySelector('.ck'))return;var top=document.querySelector('.top'),darks=document.querySelectorAll('.hw,.cl,.fo,.sn,.jr,.dh,.sx.dk,.s-dk,.chp,.s3'),dk=false;if(!top)return;
function nav(){var d=false;for(var i=0;i<darks.length&&!d;i++){var r=darks[i].getBoundingClientRect();d=r.top<62&&r.bottom>34}if(d!==dk){dk=d;top.classList.toggle('dk',d)}}
addEventListener('scroll',nav,{passive:true});addEventListener('resize',nav);nav();
})();
(function(){
var els=[].slice.call(document.querySelectorAll('.t-exp'));if(!els.length)return;
if(matchMedia('(prefers-reduced-motion: reduce)').matches&&!/[?&]motion=on/.test(location.search))return;
var tick=false;function f(){tick=false;var vh=innerHeight;els.forEach(function(e){var r=e.getBoundingClientRect(),p=Math.max(0,Math.min(1,(vh-r.top)/(vh*.72)));e.style.setProperty('--p',p.toFixed(3))})}
function q(){if(!tick){tick=true;requestAnimationFrame(f)}}addEventListener('scroll',q,{passive:true});addEventListener('resize',q);f();
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

LINKS = [('/everything', 'What we build'), ('/free-audit', 'The free audit'), ('/software', 'The app'), ('/trades', 'Trades'), ('/story', 'Our story')]
NAV = ('<a class="skip" href="#main">Skip to content</a><header class="top"><div class="nav"><a href="/" class="nav-b" aria-label="Cinder Revenue Company, home"><b>%s Cinder Revenue</b></a>'
       '<ul>%s</ul><div class="nav-r"><a class="btn" %s>Book your free audit</a>'
       '<details class="mm"><summary aria-label="Menu"><i></i><i></i></summary><nav class="mm-p" aria-label="Menu">%s</nav></details></div></div></header>'
       % (mark, ''.join('<li><a href="%s">%s</a></li>' % l for l in LINKS), CAL, ''.join('<a href="%s">%s</a>' % l for l in LINKS + [('/questions', 'Questions')])))
HW = HW.replace('@@RUN@@', RUN)

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
ALLCSS = hero_css + CSS
VER = hashlib.sha1((ALLCSS + JS).encode()).hexdigest()[:8]
open(ROOT + '/site/assets/light.css', 'w').write(ALLCSS.strip() + '\n')
open(ROOT + '/site/assets/light.js', 'w').write(JS.strip() + '\n')


def page(title, desc, path, body, index=True, css=''):
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
            '<body>%(nav)s<main id="main">%(body)s</main>%(ft)s<script src="/assets/light.js?v=%(v)s" defer></script><script src="/assets/cinder-chat.js" defer></script></body></html>'
            % dict(t=title, d=desc, u=url, v=VER, nav=NAV, body=body, ft=FT, robots='' if index else '<meta name="robots" content="noindex">', css=('<link rel="stylesheet" href="/assets/%s">' % css) if css else ''))


HOME = HERO + TOOLS + FQ + WHAT + CK + HW + BD + PROB + LK + CL
DESC = 'A free fifteen-minute audit of your service business. We find what is costing you jobs and hours, put a number on it, and build systems made for the way you work.'
open(ROOT + '/site/index.html', 'w').write(page('Find out what your business is losing', DESC, '/', HOME))
open(ROOT + '/site/new.html', 'w').write(page('Find out what your business is losing', DESC, '/', HOME, index=False))
open(ROOT + '/site/free-audit.html', 'w').write(page('The free audit', 'A free fifteen-minute audit of your service business. We walk it from the first call to the last invoice, put a number on what it is costing you, and tell you what to fix first. You keep the plan.', '/free-audit', AUDIT))
print('ok', len(HOME), 'css', len(ALLCSS), 'js', len(JS), VER)
