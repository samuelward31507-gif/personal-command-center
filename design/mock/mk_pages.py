#!/usr/bin/env python3
"""The inner pages of the light site. Every page shares the theme (nav, footer, type, colours) from mk_home.py
and gets its own picture, its own layout and one thing no other page has. Run after mk_home.py; it imports it."""
import hashlib, pathlib, re, sys
import mk_home as H
from mk_home import IC, CAL, BOOK, CL, ROOT, inner_hero, statement, cells, faq, ask, page

# ---- the builds, as data, read from the old generator without running it ----
_src = (pathlib.Path(ROOT) / 'design/build_services.py').read_text().split('\nBY = ')[0]
_ns = {'__file__': str(pathlib.Path(ROOT) / 'design/build_services.py')}
exec(_src, _ns)
GROUPS, ALL, ORDER = _ns['GROUPS'], _ns['ALL'], _ns['ORDER']
BY = {p['slug']: p for p in ALL}
ap = lambda t: t.replace("'", '&rsquo;')
GICON = {'desk': 'chat', 'cal': 'cal', 'sales': 'quote', 'money': 'money', 'after': 'star', 'seen': 'find', 'team': 'team', 'custom': 'plus'}
GLINE = {'desk': 'Every call, form and message answered, day or night.', 'cal': 'Estimates booked, crews scheduled, customers reminded.',
         'sales': 'Sent the same day and followed up until there is an answer.', 'money': 'Invoices out the day the job ends, and chased until paid.',
         'after': 'Reviews, referrals and repeat work asked for every time.', 'seen': 'A website and a Google listing that turn searches into calls.',
         'team': 'Hiring, reports and the paperwork nobody has time for.', 'custom': 'If it is not on this list, we build it anyway.'}
ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg>'
TICK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.6 8.4 2.8 2.8 6-6.4"/></svg>'
CROSS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7"/></svg>'


def fq(text):
    """Sam's own words, set like the quote on the homepage."""
    return ('<section class="fq fq-t"><div class="w fq-i"><blockquote>&ldquo;%s&rdquo;</blockquote><p><b>Sam Ward</b>Founder, Cinder Revenue</p></div></section>' % text)


def dark_split(label, lead, rest, steps, picture):
    return ('<section class="hw"><div class="w hw-g"><div class="hw-t"><span class="lb">%s</span><p class="st-t">%s <span>%s</span></p><ol>%s</ol></div>'
            '<div class="hw-r">%s</div></div></section>' % (label, lead, rest, ''.join('<li><div><b>%s</b><span>%s</span></div></li>' % x for x in steps), picture))


def svg(key):
    return '<svg viewBox="0 0 24 24" aria-hidden="true">%s</svg>' % IC[key]


# =====================================================================================
# /everything : the catalogue as a board, one audit picking four of them, then each part drawn
# =====================================================================================
cols = ''
for g, gname in GROUPS:
    chips = ''.join('<a href="/%s">%s</a>' % (s, BY[s]['name']) for s in ORDER[g])
    if g == 'custom':
        chips += '<a class="yours" href="/custom-builds">Yours</a>'
    cols += '<div class="bo-c"><div class="bo-h">%s<b>%s</b><i>%d</i></div>%s</div>' % (svg(GICON[g]), gname, len(ORDER[g]), chips)
BOARD = '<div class="cd bo"><div class="rep-h"><span class="dot"></span><b>Everything we build</b><span>%d builds, eight parts</span><span class="tag">Every one made to fit</span></div><div class="bo-b">%s</div></div>' % (len(ALL), cols)

LIT = ('answering', 'follow-up', 'invoicing', 'reviews')
assert all(x in BY for x in LIT), [x for x in LIT if x not in BY]
PICK = ('<div class="cd pk"><div class="rep-h"><span class="dot"></span><b>One audit</b><span>Ridgeline Fence</span><span class="tag">Example business, sample data</span></div><div class="pk-b">%s</div>'
        '<div class="pk-f"><b>%d of %d</b><span>built for this business. The rest left alone.</span></div></div>'
        % (''.join('<div class="pk-r"><span>%s</span><div>%s</div></div>' % (gn, ''.join('<i class="on">%s</i>' % BY[s]['name'] if s in LIT else '<i></i>' for s in ORDER[g])) for g, gn in GROUPS),
           len(LIT), len(ALL)))

MINI = {
    'desk': '<div class="mi mi-th"><p>Missed call, 7:42 PM</p><p class="me">Sorry we missed you. Looking for a quote? Pick a time that works.</p><em>Replied in 9 seconds</em></div>',
    'cal': '<div class="mi mi-wk">%s</div>' % ''.join('<div><b>%s</b>%s</div>' % (d, ''.join('<i class="%s">%s</i>' % x for x in sl)) for d, sl in [
        ('Mon', [('j', 'Job'), ('', ''), ('e', 'Estimate')]), ('Tue', [('e', 'Estimate'), ('j', 'Job'), ('', '')]), ('Wed', [('j', 'Job'), ('e', 'Estimate'), ('j', 'Job')]),
        ('Thu', [('', ''), ('j', 'Job'), ('e', 'Estimate')]), ('Fri', [('j', 'Job'), ('j', 'Job'), ('', '')])]),
    'sales': '<div class="mi mi-doc"><b>Estimate, new fence</b><u></u><u></u><u class="s"></u><div><span class="on">Sent</span><span class="on">Opened</span><span class="on">Followed up</span><span>Signed</span></div></div>',
    'money': '<div class="mi mi-inv"><div><b>Invoice sent</b><span>The day the job ends</span><em class="g">Paid</em></div><div><b>Invoice sent</b><span>Reminder went out on day 3</span><em class="y">Chasing</em></div></div>',
    'after': '<div class="mi mi-rv"><div>%s</div><p class="me">Thanks for choosing us. Mind leaving a quick review?</p></div>' % ('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>' * 5),
    'seen': '<div class="mi mi-se"><div class="q">%sfence company near me</div><div class="r"><b>Ridgeline Fence</b><span>Open now. Fences, gates, repairs.</span><em>Book online</em></div></div>' % svg('find'),
    'team': '<div class="mi mi-rp"><b>Monday report</b><div>%s</div><span>Every lead, quote and invoice, in one text.</span></div>' % ''.join('<i style="height:%d%%"></i>' % h for h in (42, 64, 50, 78, 58, 90, 70)),
    'custom': '<div class="mi mi-cu">%s<b>Your process here</b></div>' % svg('plus'),
}
BENTO = ('<section class="bn"><div class="w"><p class="bn-h">Eight parts of a business. <span>This is what each one looks like once it runs on its own.</span></p><div class="bn-g">%s</div></div></section>'
         % ''.join('<article class="bn-c bn-%s"><header>%s<b>%s</b><i>%d builds</i></header><p>%s</p><div class="bn-p">%s</div><nav>%s</nav></article>'
                   % (g, svg(GICON[g]), gn, len(ORDER[g]), GLINE[g], MINI[g], ''.join('<a href="/%s">%s</a>' % (s, BY[s]['name']) for s in ORDER[g]))
                   for g, gn in GROUPS))
EVERYTHING = (inner_hero('What we build', 'If AI can do it, we build it.',
                         '%d builds today, in eight parts of your business, and room for whatever yours needs next. Each one is made for the business it goes into. The one thing we don&rsquo;t do is run ads.' % len(ALL),
                         BOOK + '<a class="btn q" href="/free-audit">How the audit works</a>', BOARD)
              + H.split('How to read this', 'You don&rsquo;t pick from this list. Your audit does.', 'It finds what is costing you, and we build only those. Most businesses need three or four of these, not thirty-two.', PICK)
              + BENTO
              + fq('If it can be automated, it should be automated. If it&rsquo;s a repetitive task, it should be automated.')
              + ask('Not on the list?', 'If it repeats in your business, it can probably run on its own.', 'Custom builds', '/custom-builds')
              + CL)

# =====================================================================================
# /websites : two phones side by side, most sites against yours; one visit drawn step by step; a field that checks your site
# =====================================================================================
GOOD = ('<div class="ph"><div class="ph-s"><div class="ph-n"><b>Ridgeline Fence</b><span>Menu</span></div>'
        '<div class="ph-h">Fences built right.<br>Get a price today.</div>'
        '<div class="ph-f"><label>What do you need?<u>New fence</u></label><label>Zip code<u>80920</u></label><em>See open times</em>'
        '<div class="ph-t"><span>Tue 9 AM</span><span class="on">Wed 2 PM</span><span>Thu 11 AM</span></div></div>'
        '<div class="ph-w"><i></i><i></i><i></i></div></div></div>')
BAD = ('<div class="ph bad"><div class="ph-s"><div class="ph-n"><b>Fence company</b><span>Menu</span></div>'
       '<div class="sl-l"><i></i>Loading</div><div class="ph-h">Quality service you can trust.</div>'
       '<div class="sl-x"><u></u><u></u><u></u><u></u><u class="s"></u></div>'
       '<div class="ph-f"><label>Name<u></u></label><label>Email<u></u></label><label>Message<u class="t"></u></label><em>Submit</em></div></div></div>')
PHONE = (GOOD + '<div class="ph-c c1"><b>Loads fast</b><span>Most visitors are on a phone.</span></div>'
         '<div class="ph-c c2"><b>One clear button</b><span>No hunting for a number.</span></div>'
         '<div class="ph-c c3"><b>The button books</b><span>A time on your calendar.</span></div>'
         '<p class="ph-k">Example. Sample data.</p>')
VS = ('<section class="vs"><div class="w vs-i"><p class="vs-t">What most contractor sites get wrong.</p><div class="vs-g">'
      '<div class="vs-c x"><ul>%s</ul><figure><figcaption>Most sites</figcaption>%s</figure></div>'
      '<div class="vs-c v"><figure><figcaption>Yours</figcaption>%s</figure><ul>%s</ul></div></div></div></section>'
      % (''.join('<li>%s<span>%s</span></li>' % (CROSS, t) for t in ['Slow on a phone.', 'Says &ldquo;quality service&rdquo;.', 'A contact form that goes to an inbox.', 'Hard to find nearby.']),
         BAD, GOOD,
         ''.join('<li>%s<span>%s</span></li>' % (TICK, t) for t in ['Loads before they give up.', 'Says what you do, where, and how to book.', 'A reply in seconds and a time on your calendar.', 'Set up for local search.'])))
JMINI = ['<div class="jm jm-q">%sfence company near me</div>' % svg('find'),
         '<div class="jm jm-p"><u></u><u class="s"></u><em></em></div>',
         '<div class="jm jm-t"><span>Tue 9 AM</span><span class="on">Wed 2 PM</span><span>Thu 11 AM</span></div>',
         '<div class="jm jm-c"><b>Wed, 2:00 PM</b><span>Estimate, new fence, 80920</span></div>']
JOURNEY = ('<section class="jr"><div class="w jr-i"><div class="jr-h"><span class="lb">What you get</span><p class="st-t">Your site should book jobs while you&rsquo;re on one.</p>'
           '<span class="tag">One visit. Example, sample data.</span></div><ol>%s</ol></div></section>'
           % ''.join('<li><div class="jr-p">%s</div><b>%s</b><span>%s</span></li>' % (JMINI[i], a, b) for i, (a, b) in enumerate([
               ('They search.', 'Built so the people near you can find you.'),
               ('The page loads.', 'Most visitors are on a phone. It loads before they give up.'),
               ('They pick a time.', 'Right from the page, from your open slots.'),
               ('It&rsquo;s on your calendar.', 'With the job, the address and the zip code.')])))
CHECK = ('<section class="uc"><div class="w uc-i"><p class="st-t">Check your site first. <span>A free check, done in 60 seconds.</span></p>'
         '<a class="uc-f" href="/audit"><span>yourbusiness.com</span><em>Check my site</em></a></div></section>')
WEBSITES = ('<section class="hs hs-r"><div class="w hs-g"><div class="hs-p ph-p">%s</div><div class="hs-t"><span class="pill"><i></i>Getting found</span>'
            '<h1>A site that books jobs.</h1><p class="sub">Fast on a phone, clear about what you do, and built to turn visitors into booked estimates. Written and built for your business, not from a theme.</p>'
            '<div class="cta">%s<a class="btn q" href="/audit">Check your site in 60 seconds</a></div>'
            '<p class="hs-n">Three things do most of the work: it loads fast, it has one clear button, and the button books.</p></div></div></section>' % (PHONE, BOOK)
            + statement('The problem', 'Most contractor sites lose the visitor on the first screen.', 'Slow on a phone, no clear next step, and a contact form that goes nowhere. The visitor wanted a price and a time. They leave with neither.')
            + VS + JOURNEY
            + fq('Everything is custom. It&rsquo;s custom to you. It&rsquo;s custom to your problem. It&rsquo;s not a template.')
            + CHECK
            + faq('Questions.', [('Do I need a new site?', 'Not always. The free audit tells you if yours is costing you jobs.'),
                                 ('Who writes it?', 'We do, from what you tell us on the call.'),
                                 ('Can it work with my current setup?', 'Yes. It plugs into your calendar and everything else we set up.')])
            + CL)

# =====================================================================================
# /answering : one missed call timed to the second; one day charted hour by hour; the questions answered as a text thread
# =====================================================================================
THREAD = ('<div class="cd tr"><div class="rep-h"><span class="dot"></span><b>Missed call</b><span>Ridgeline Fence</span><span class="tag">Example, sample data</span></div>'
          '<div class="tr-b"><div class="tr-e"><time>7:42:10 PM</time><p class="in">Missed call from a new number. No voicemail.</p></div>'
          '<div class="tr-e me"><time>7:42:19 PM</time><p>Sorry we missed you. Looking for a quote? Pick a time that works: Tue 9 AM, Wed 2 PM or Thu 11 AM.</p></div>'
          '<div class="tr-e"><time>7:44:02 PM</time><p class="in">Wed 2 works</p></div>'
          '<div class="tr-e me"><time>7:44:05 PM</time><p>Booked. See you Wednesday at 2. We&rsquo;ll text a reminder that morning.</p></div></div>'
          '<div class="tr-f"><div><b>9 seconds</b>from missed call to reply</div><div><b>2 minutes</b>from missed call to booked</div></div></div>')
INBOX = ('<div class="fl"><div class="fd-h"><span class="dot"></span><b>In your app</b><span>Tonight</span><span class="tag">Example, sample data</span></div>%s'
         '<div class="rn-f"><span>Three leads answered while you were off.</span><em>0 waiting</em></div></div>'
         % ''.join('<div class="fl-r"><i>%s</i><b>%s</b><span>%s</span></div>' % x for x in [
             ('7:42', 'Missed call, new number', 'Replied in 9 seconds. Booked Wed 2 PM.'),
             ('8:15', 'Website form', 'Replied in 6 seconds. Asked for photos.'),
             ('9:03', 'Facebook lead', 'Replied in 8 seconds. Picking a time.')]))
span = lambda a, b: '<i style="left:%.2f%%;width:%.2f%%"></i>' % (a / 24 * 100, (b - a) / 24 * 100)
LANES = [('On a job site.', 'Your hands are full and the phone rings out.', span(8, 16)),
         ('On another call.', 'The second caller hangs up and tries the next name on the list.', ''.join('<i class="d b" style="left:%.1f%%"></i>' % (h / 24 * 100) for h in (9.6, 11.3, 14.8))),
         ('After hours and weekends.', 'The form comes in at 9 PM. By morning they&rsquo;ve called someone else.', span(0, 7) + span(18, 24)),
         ('Lead sites.', 'Facebook, Angi and Thumbtack leads go to whoever answers first.', ''.join('<i class="d" style="left:%.1f%%"></i>' % (h / 24 * 100) for h in (1.5, 6.6, 8.2, 9.9, 11.4, 12.7, 14.1, 15.8, 17.2, 18.9, 20.3, 21.6, 23)))]
DAY = ('<section class="dy"><div class="w dy-i"><p class="dy-t">Where jobs get missed, across one day.</p><div class="cd dc">'
       '<div class="rep-h"><span class="dot"></span><b>One day</b><span>Ridgeline Fence</span><span class="tag">Example business, sample data</span></div>'
       '<div class="dc-r dc-x"><div></div><div><i>12 AM</i><i>6 AM</i><i>Noon</i><i>6 PM</i><i>12 AM</i></div></div>%s'
       '<div class="dc-r ok"><div><b>With it.</b><span>Every one of them gets a reply in seconds.</span></div><div class="dc-k"><i style="left:0;width:100%%"></i></div></div></div></div></section>'
       % ''.join('<div class="dc-r"><div><b>%s</b><span>%s</span></div><div class="dc-k">%s</div></div>' % x for x in LANES))
REPORT = ('<div class="cd mr"><div class="rep-h"><span class="dot"></span><b>Monday report</b><span class="tag">Example, sample data</span></div>'
          '<p>Last week: 14 new leads. All 14 got a reply in seconds. 9 booked an estimate, 2 are picking a time, 3 went quiet after three follow-ups.</p></div>')
INCLUDED = ('<section class="ic"><div class="w ic-g"><div class="ic-t"><span class="lb">What&rsquo;s included</span><p class="st-t">Set up around the number you already use.</p>%s</div><ul>%s</ul></div></section>'
            % (REPORT, ''.join('<li>%s<span>%s</span></li>' % (TICK, t) for t in [
                'Missed calls get a text back from your business.', 'Web forms, Facebook, Angi and Thumbtack leads answered by text.',
                'Your questions and your price range before anything books.', 'No reply? Up to 3 friendly follow-ups so the lead doesn&rsquo;t go cold.',
                'English and Spanish.', 'A Monday text report of every lead and reply.'])))
TALK = ('<section class="cv"><div class="w cv-g"><div class="cv-t"><p class="st-t">Questions.</p></div><dl>%s</dl></div></section>'
        % ''.join('<dt><span>%s</span></dt><dd><span>%s</span></dd>' % x for x in [
            ('Which leads does it cover?', 'Missed calls, texts, website forms, and requests from Facebook, Angi and Thumbtack.'),
            ('What if the lead isn&rsquo;t a fit?', 'Your questions and your price range come before anything books, so you only see the serious ones.'),
            ('What if they don&rsquo;t reply?', 'Up to 3 friendly follow-ups go out, then it stops.'),
            ('Do I have to change how I work?', 'No. You answer the calls you can. Everything you miss gets handled.'),
            ('Where do I see it?', 'Every thread lands in your app, and a text report comes every Monday.')]))
CHAIN = ('<section class="nx"><div class="w nx-i"><p class="nx-t">What happens after the reply.</p><div class="nx-g"><div class="on"><b>Answering</b><span>%s</span></div>%s</div></div></section>'
         % (ap(BY['answering']['short']), ''.join('<a href="/%s"><b>%s</b><span>%s</span></a>' % (s, BY[s]['name'], ap(BY[s]['short'])) for s in ('booking', 'follow-up', 'reviews'))))
ANSWERING = (inner_hero('Front desk', 'Every call gets an answer.',
                        'Missed calls and new leads get a text back in seconds, even after hours and while you&rsquo;re on a job.',
                        BOOK + '<a class="btn q" href="/free-audit">How the audit works</a>', THREAD)
             + statement('The problem', 'Most leads go to whoever answers first.', 'A missed call, a web form, a message on a lead site. Each one is a person ready to hire, and each one is also contacting someone else. The reply that arrives tonight is usually too late.')
             + DAY
             + '<section class="sn"><div class="w sn-i"><b>78%</b><p>of people have taken their business elsewhere after a company didn&rsquo;t pick up.</p><span>CallRail survey of 1,000 consumers, 2025</span></div></section>'
             + dark_split('How it works', 'A call rings out. A reply goes out.', 'You see all of it in one place.',
                          [('A call rings out.', 'You&rsquo;re on a job site and can&rsquo;t pick up. A form comes in at 9 PM.'),
                           ('A reply goes out in seconds.', 'Sorry we missed you, with times to pick from. No callback list.'),
                           ('It all lands in your app.', 'The thread, the lead and what happens next, in one place.')], INBOX)
             + INCLUDED + TALK + CHAIN + CL)

CSS = r"""
/* ============ shared by the inner pages ============ */
.fq-t{border-top:1px solid var(--ln)}
.fl{width:100%;max-width:580px;background:#17181a;border-radius:12px;box-shadow:0 0 0 1px rgba(255,255,255,.09),0 40px 70px -36px rgba(0,0,0,.9)}
.fl-r{display:grid;grid-template-columns:44px minmax(0,1fr);column-gap:12px;row-gap:2px;padding:14px 18px 15px;border-bottom:1px solid var(--dl)}
.fl-r i{grid-row:1/3;font:500 11.5px/1.5 "Geist Mono",monospace;font-style:normal;color:#7f8187}
.fl-r b{font-size:14px;font-weight:540;letter-spacing:-.008em;color:#fff}.fl-r span{grid-column:2;font-size:12.5px;color:#8f9197}
@media(min-width:1700px){.fl{zoom:1.1}}

/* ============ /everything ============ */
.bo{position:relative;width:min(1180px,100%);margin:0 auto}
.bo-b{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));align-items:start;padding:8px 8px 14px}
.bo-c{padding:10px 6px 0;display:grid;gap:6px;align-content:start}
.bo-h{display:flex;align-items:center;gap:7px;height:32px;padding:0 4px 6px;margin-bottom:2px;border-bottom:1px solid var(--line);font-size:12.5px}
.bo-h svg{width:15px;height:15px;flex:none;fill:none;stroke:var(--t2);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.bo-h b{font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bo-h i{margin-left:auto;font:500 11px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3)}
.bo-c a{display:flex;align-items:center;min-height:34px;padding:6px 9px;border-radius:8px;background:#f6f7f9;font-size:12.5px;line-height:1.2;font-weight:520;letter-spacing:-.006em;color:var(--ink);text-align:left;transition:background .15s,box-shadow .15s,color .15s}
.bo-c a:hover{background:#fff;box-shadow:0 0 0 1.5px var(--blue);color:#1f4fbf}
.bo-c a.yours{background:none;box-shadow:inset 0 0 0 1.5px rgba(38,109,240,.45);color:#1f4fbf}
.ih-pi:has(.bo){padding-left:clamp(16px,2vw,36px);padding-right:clamp(16px,2vw,36px)}
/* one audit, four of thirty-two */
.pk{width:100%;max-width:540px}
.pk-b{padding:14px 18px 6px;display:grid;gap:9px}
.pk-r{display:grid;grid-template-columns:112px minmax(0,1fr);align-items:center;gap:12px}
.pk-r>span{font-size:12.5px;color:var(--t2);white-space:nowrap}
.pk-r div{display:flex;gap:5px;align-items:center}
.pk-r i{flex:none;width:22px;height:22px;border-radius:6px;background:#eceef2;font-style:normal}
.pk-r i.on{width:auto;padding:0 9px;display:inline-flex;align-items:center;background:var(--blue);color:#fff;font-size:12px;font-weight:560;letter-spacing:-.005em}
.pk-f{display:flex;align-items:baseline;gap:10px;margin-top:12px;padding:15px 18px 16px;border-radius:0 0 12px 12px;background:#101113;color:#8f9197;font-size:12.5px}
.pk-f b{color:#fff;font-size:20px;font-weight:600;letter-spacing:-.03em;white-space:nowrap}
@media(min-width:1700px){.pk{zoom:1.12}}
/* the eight parts, each drawn */
.bn{border-top:1px solid var(--ln)}
.bn>.w{border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.bn-h{margin:0;padding:clamp(88px,7vw,132px) var(--pad) clamp(40px,3.4vw,64px);max-width:25em;font-size:clamp(27px,1.95vw,37px);line-height:1.12;letter-spacing:-.028em;font-weight:500;text-wrap:pretty}.bn-h span{color:var(--g2)}
.bn-g{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));border-top:1px solid var(--ln)}
.bn-c{grid-column:span 4;display:flex;flex-direction:column;padding:clamp(22px,1.7vw,32px) clamp(20px,1.6vw,30px) clamp(20px,1.5vw,28px);border-left:1px solid var(--ln);border-top:1px solid var(--ln);margin:-1px 0 0 -1px;background:var(--g)}
.bn-desk{grid-column:span 7}.bn-cal{grid-column:span 5}.bn-seen{grid-column:span 5}.bn-custom{grid-column:span 3}
.bn-c header{display:flex;align-items:center;gap:8px;font-size:13.5px}
.bn-c header svg{width:17px;height:17px;fill:none;stroke:var(--ink);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.bn-c header b{font-weight:600;letter-spacing:-.01em}.bn-c header i{margin-left:auto;font:500 11px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3)}
.bn-c>p{margin:clamp(14px,1.1vw,20px) 0 clamp(18px,1.4vw,26px);max-width:19em;font-size:clamp(18px,1.2vw,23px);line-height:1.16;letter-spacing:-.02em;font-weight:500;text-wrap:pretty}
.bn-p{flex:1;display:flex;align-items:center;justify-content:center;min-height:clamp(190px,13.5vw,250px);padding:22px 18px;border-radius:12px;background:linear-gradient(180deg,#f4f6ff,#e4e9fd);overflow:hidden}
.bn-c nav{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:clamp(14px,1.1vw,20px);font-size:13px}
.bn-c nav a{color:var(--g2);transition:color .15s}.bn-c nav a:hover{color:var(--blue)}
.mi{width:100%;max-width:330px;padding:14px;border-radius:12px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.06),0 18px 34px -22px rgba(30,40,110,.45);font-size:12.5px;line-height:1.35}
.mi p{margin:0;width:fit-content;max-width:88%;padding:7px 11px;border-radius:12px 12px 12px 4px;background:#f1f2f5}
.mi p.me{margin-left:auto;border-radius:12px 12px 4px 12px;background:var(--blue);color:#fff}
.mi-th{display:grid;gap:8px;max-width:400px}.mi-th em{justify-self:end;font:500 11px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3)}
.mi-wk{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;max-width:360px}.mi-wk div{display:grid;gap:5px}
.mi-wk b{font-size:11px;font-weight:560;color:var(--t2);text-align:center}
.mi-wk i{display:grid;place-items:center;height:30px;border-radius:7px;font-style:normal;font-size:10.5px;font-weight:540;box-shadow:inset 0 0 0 1px rgba(23,24,26,.1);background:repeating-linear-gradient(135deg,transparent 0 4px,rgba(23,24,26,.04) 4px 5px)}
.mi-wk i.j{background:#eceef2;box-shadow:none;color:var(--t2)}.mi-wk i.e{background:var(--blue);box-shadow:none;color:#fff}
.mi-doc{display:grid;gap:8px;max-width:290px}.mi-doc b{font-size:13px;font-weight:600;letter-spacing:-.01em}
.mi-doc u{height:7px;border-radius:4px;background:#eceef2}.mi-doc u.s{width:58%}
.mi-doc div{display:flex;gap:5px;margin-top:6px;flex-wrap:wrap}.mi-doc span{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:540;color:var(--t3);box-shadow:inset 0 0 0 1px rgba(23,24,26,.12)}
.mi-doc span.on{background:#e9eeff;color:#2a4ea8;box-shadow:none}
.mi-inv{padding:4px 14px;max-width:300px}.mi-inv div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1px 10px;align-items:center;padding:11px 0}.mi-inv div+div{border-top:1px solid var(--line)}
.mi-inv b{font-size:13px;font-weight:560}.mi-inv span{grid-column:1;font-size:11.5px;color:var(--t3)}
.mi-inv em{grid-row:1/3;grid-column:2;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;font-style:normal;font-size:11px;font-weight:560}
.mi-inv em.g{background:#e7f6ec;color:#1c7a43}.mi-inv em.y{background:#fff4d6;color:#a86a00}
.mi-rv{display:grid;gap:12px;max-width:290px}.mi-rv div{display:flex;gap:3px}.mi-rv svg{width:22px;height:22px;fill:var(--amber)}.mi-rv p.me{max-width:100%}
.mi-se{padding:0;background:none;box-shadow:none;display:grid;gap:8px;max-width:340px}
.mi-se .q{display:flex;align-items:center;gap:8px;height:38px;padding:0 13px;border-radius:999px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.08);color:var(--t2)}
.mi-se .q svg{width:15px;height:15px;fill:none;stroke:var(--t3);stroke-width:1.6;stroke-linecap:round}
.mi-se .r{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;align-items:center;padding:13px 14px;border-radius:12px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.06),0 18px 34px -22px rgba(30,40,110,.45)}
.mi-se .r b{font-size:13.5px;font-weight:600;color:#1f4fbf}.mi-se .r span{grid-column:1;font-size:11.5px;color:var(--t3)}
.mi-se .r em{grid-row:1/3;grid-column:2;display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:8px;background:var(--ink);color:#fff;font-style:normal;font-size:11.5px;font-weight:560}
.mi-rp{display:grid;gap:10px;max-width:280px}.mi-rp b{font-size:13px;font-weight:600}.mi-rp span{font-size:11.5px;color:var(--t3)}
.mi-rp div{display:flex;align-items:flex-end;gap:6px;height:64px}.mi-rp i{flex:1;border-radius:4px 4px 2px 2px;background:#cfdcff}.mi-rp i:nth-child(6){background:var(--blue)}
.mi-cu{display:grid;place-items:center;gap:8px;max-width:220px;padding:26px 14px;background:none;box-shadow:none;border:1.5px dashed rgba(38,109,240,.5);color:#1f4fbf}
.mi-cu svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round}.mi-cu b{font-size:13px;font-weight:560}
@media(min-width:1700px){.bn-p .mi{zoom:1.12}}

/* ============ /websites ============ */
.hs-r .hs-p{border-left:0;border-right:1px solid var(--ln)}
.ph-p{position:relative;flex-direction:column}
.ph{position:relative;flex:none;width:292px;padding:9px;border-radius:40px;background:#17181a;box-shadow:0 40px 80px -36px rgba(30,40,110,.6),0 0 0 1px rgba(23,24,26,.5)}
.ph-s{border-radius:31px;background:#fff;overflow:hidden;padding-bottom:16px;min-height:520px}
.ph-n{display:flex;justify-content:space-between;align-items:center;height:48px;padding:6px 16px 0;font-size:12.5px;border-bottom:1px solid var(--line)}.ph-n b{font-weight:620;letter-spacing:-.01em}.ph-n span{color:var(--t3)}
.ph-h{padding:20px 16px 4px;font-size:23px;line-height:1.08;font-weight:620;letter-spacing:-.035em}
.ph-f{margin:14px 12px 0;padding:12px;border-radius:14px;background:#f6f7f9;display:grid;gap:8px}
.ph-f label{display:grid;gap:5px;font-size:11px;color:var(--t2)}.ph-f u{display:flex;align-items:center;height:36px;padding:0 11px;border-radius:9px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.1);text-decoration:none;font-size:13px;color:var(--ink);font-weight:520}
.ph-f em{display:grid;place-items:center;height:40px;margin-top:2px;border-radius:10px;background:var(--ink);color:#fff;font-style:normal;font-size:13.5px;font-weight:560}
.ph-t{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.ph-t span{display:grid;place-items:center;height:32px;border-radius:8px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.1);font-size:11.5px;font-weight:520}
.ph-t span.on{background:var(--blue);color:#fff;box-shadow:none}
.ph-w{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:12px 12px 0}.ph-w i{aspect-ratio:1;border-radius:9px;background:repeating-linear-gradient(135deg,#eceef2 0 2px,#f7f8fa 2px 6px)}
.ph-c{display:none;position:absolute;z-index:1;padding:12px 14px;border-radius:12px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.07),0 2px 4px rgba(23,24,26,.04),0 22px 40px -20px rgba(30,40,110,.4)}
.ph-c b{display:block;font-size:13.5px;font-weight:560;letter-spacing:-.01em}.ph-c span{display:block;margin-top:2px;font-size:12px;line-height:1.3;color:var(--t2)}
.ph-k{margin:18px 0 0;font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}
@media(min-width:1360px){.ph-p>.ph{margin-left:190px}.ph-k{margin-left:190px}
.ph-c{display:block;width:172px;left:calc(50% - 265px)}.ph-c::after{content:"";position:absolute;left:100%;top:50%;width:22px;border-top:1.5px dashed #b3bbcf}
.ph-c.c1{top:24%}.ph-c.c2{top:46%}.ph-c.c3{top:68%}}
@media(min-width:1700px){.ph-p>.ph{zoom:1.12}}
/* the site most contractors have */
.ph.bad{background:#b9bcc4;box-shadow:0 30px 60px -36px rgba(23,24,26,.4)}.ph.bad .ph-s{background:#fbfbfc;color:#8a8d93}
.ph.bad .ph-n b,.ph.bad .ph-h{color:#6f7279}.ph.bad .ph-h{font-weight:560;font-size:20px;padding-top:10px}
.sl-l{display:flex;align-items:center;gap:8px;margin:14px 16px 0;font:500 11px/1 "Geist Mono",monospace;color:#a5a8ae}
.sl-l i{width:13px;height:13px;border-radius:50%;border:2px solid #dcdee3;border-top-color:#a5a8ae}
.sl-x{display:grid;gap:7px;padding:12px 16px 0}.sl-x u{height:7px;border-radius:4px;background:#e6e8ec}.sl-x u.s{width:55%}
.ph.bad .ph-f{background:#f1f2f4}.ph.bad .ph-f label{color:#a5a8ae}.ph.bad .ph-f u{height:30px;box-shadow:0 0 0 1px rgba(23,24,26,.08)}.ph.bad .ph-f u.t{height:52px}
.ph.bad .ph-f em{height:34px;background:#c9cbd0;color:#fff}
.vs{border-top:1px solid var(--ln)}
.vs-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.vs-t{margin:0;padding:clamp(88px,7vw,132px) var(--pad) clamp(40px,3.4vw,64px);max-width:16em;font-size:clamp(27px,1.95vw,37px);line-height:1.12;letter-spacing:-.028em;font-weight:500}
.vs-g{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);border-top:1px solid var(--ln)}
.vs-c{display:flex;align-items:center;justify-content:flex-end;gap:clamp(20px,2.6vw,48px);padding:clamp(44px,4vw,76px) clamp(24px,2.8vw,52px) clamp(52px,4.4vw,84px);background:var(--pn)}
.vs-c.v{justify-content:flex-start;border-left:1px solid var(--ln);background:linear-gradient(180deg,#f6f8ff,#e6ebfd)}
.vs-c figure{margin:0;display:grid;justify-items:center;gap:16px;zoom:.84}
.vs-c figcaption{font:500 13px/1 "Geist Mono",monospace;color:var(--t3)}.vs-c.v figcaption{color:#2a4ea8}
.vs-c ul{list-style:none;margin:0;padding:0;display:grid;gap:clamp(14px,1.2vw,22px);max-width:15em}
.vs-c li{display:flex;gap:10px;align-items:flex-start;font-size:clamp(15.5px,.98vw,18.5px);line-height:1.3;font-weight:500;letter-spacing:-.012em}
.vs-c li svg{flex:none;width:17px;height:17px;margin-top:3px;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.vs-c.x li{color:var(--t3);text-decoration:line-through;text-decoration-color:rgba(138,141,147,.55)}.vs-c.x li svg{stroke:var(--red)}
.vs-c.x ul{text-align:right}.vs-c.x li{flex-direction:row-reverse}
.vs-c.v li svg{stroke:var(--blue)}
/* one visit, in four steps, on dark */
.jr{background:var(--dk);color:#fff}
.jr-i{border-left:1px solid var(--dl);border-right:1px solid var(--dl);border-bottom:1px solid var(--dl)}
.jr-h{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:16px 24px;padding:clamp(88px,7.4vw,140px) var(--pad) clamp(44px,3.6vw,68px)}
.jr-h .lb{grid-column:1/-1;justify-self:start;background:rgba(109,155,255,.16);color:#a9c4ff}
.jr-h .st-t{margin:0;max-width:14em;color:#fff}.jr-h .tag{margin:0 0 8px;color:#7f8187}
.jr ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--dl);counter-reset:j}
.jr li{position:relative;counter-increment:j;padding:clamp(22px,1.7vw,32px) clamp(20px,1.5vw,28px) clamp(40px,3.2vw,60px);border-left:1px solid var(--dl)}.jr li:first-child{border-left:0}
.jr li::before{content:counter(j);position:absolute;top:-11px;left:clamp(20px,1.5vw,28px);display:grid;place-items:center;width:21px;height:21px;border-radius:50%;background:#fff;color:#101010;font:600 11px/1 "Geist Mono",monospace}
.jr-p{display:flex;align-items:center;justify-content:center;height:clamp(150px,10.5vw,196px);margin:12px 0 clamp(20px,1.6vw,30px);border-radius:12px;background:#17181a;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07)}
.jr li b{display:block;font-size:clamp(16px,1vw,19px);font-weight:560;letter-spacing:-.014em}
.jr li>span{display:block;margin-top:6px;max-width:17em;font-size:clamp(14px,.86vw,16.5px);line-height:1.36;color:#8f9197}
.jm{font-size:12.5px}
.jm-q{display:flex;align-items:center;gap:8px;height:38px;padding:0 14px;border-radius:999px;background:#232428;color:#d6d7da;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.jm-q svg{width:15px;height:15px;fill:none;stroke:#8f9197;stroke-width:1.6;stroke-linecap:round}
.jm-p{display:grid;gap:7px;width:96px;padding:14px 12px;border-radius:14px;background:#fff}.jm-p u{height:7px;border-radius:4px;background:#17181a}.jm-p u.s{width:64%;background:#c9cbd0}.jm-p em{height:22px;margin-top:6px;border-radius:6px;background:var(--blue)}
.jm-t{display:flex;gap:6px}.jm-t span{display:grid;place-items:center;height:34px;padding:0 10px;border-radius:8px;background:#232428;color:#b9bbc0;font-weight:520;font-size:11.5px;white-space:nowrap}.jm-t span.on{background:var(--blue);color:#fff}
.jm-c{display:grid;gap:3px;padding:12px 14px;border-radius:10px;background:#232428;border-left:3px solid var(--blue)}.jm-c b{font-size:13px;font-weight:600;color:#fff}.jm-c span{font-size:11.5px;color:#a3a5aa}
/* a field that checks your site */
.uc{background:#fff}
.uc-i{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;gap:24px clamp(32px,4vw,76px);border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(72px,6vw,112px) var(--pad)}
.uc .st-t{margin:0;max-width:13em;font-size:clamp(27px,1.95vw,37px)}
.uc-f{display:flex;align-items:center;gap:10px;height:clamp(60px,4.2vw,76px);padding:0 clamp(8px,.6vw,11px) 0 clamp(18px,1.4vw,26px);border-radius:16px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.1),0 2px 4px rgba(23,24,26,.04),0 26px 50px -30px rgba(30,40,110,.5);transition:box-shadow .2s}
.uc-f:hover{box-shadow:0 0 0 1.5px var(--blue),0 26px 50px -30px rgba(30,40,110,.5)}
.uc-f span{flex:1;font-size:clamp(16px,1.1vw,21px);color:var(--g3);letter-spacing:-.012em}
.uc-f span::after{content:"";display:inline-block;width:1.5px;height:1.1em;margin-left:3px;vertical-align:-.18em;background:var(--blue)}
.uc-f em{display:inline-flex;align-items:center;height:clamp(44px,3vw,54px);padding:0 clamp(16px,1.2vw,22px);border-radius:11px;background:var(--ink);color:#fff;font-style:normal;font-size:clamp(14px,.9vw,16.5px);font-weight:560;white-space:nowrap}
.uc+.fa{border-top:1px solid var(--ln)}

/* ============ /answering ============ */
.tr{width:min(680px,100%)}
.tr-b{padding:22px 22px 8px;display:grid;gap:14px}
.tr-e{display:grid;grid-template-columns:92px minmax(0,1fr);gap:14px;align-items:start}
.tr-e time{padding-top:9px;font:500 11.5px/1 "Geist Mono",monospace;color:var(--t3);white-space:nowrap}
.tr-e p{justify-self:start;margin:0;max-width:26em;padding:9px 13px;border-radius:14px 14px 14px 5px;background:#f1f2f5;font-size:14px;line-height:1.38;text-align:left}
.tr-e.me p{justify-self:end;border-radius:14px 14px 5px 14px;background:var(--blue);color:#fff}
.tr-f{display:grid;grid-template-columns:1fr 1fr;margin-top:14px;border-radius:0 0 12px 12px;background:#101113;color:#8f9197;font-size:12px;text-align:left}
.tr-f div{padding:16px 22px 17px}.tr-f div+div{border-left:1px solid rgba(255,255,255,.1)}.tr-f b{display:block;margin-bottom:3px;color:#fff;font-size:21px;font-weight:600;letter-spacing:-.03em}
@media(min-width:1700px){.ih-pi .tr{zoom:1.12}}
/* one day, hour by hour */
.dy{border-top:1px solid var(--ln)}
.dy-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:0 var(--pad) clamp(72px,6vw,112px)}
.dy-t{margin:0;padding:clamp(56px,4.6vw,88px) 0 clamp(28px,2.4vw,44px);font-size:clamp(27px,1.95vw,37px);line-height:1.12;letter-spacing:-.028em;font-weight:500}
.dc{overflow:hidden}
.dc-r{display:grid;grid-template-columns:minmax(0,.42fr) minmax(0,1fr);align-items:center;border-top:1px solid var(--line)}
.dc-r>div:first-child{padding:clamp(16px,1.3vw,24px) clamp(18px,1.6vw,30px)}
.dc-r b{display:block;font-size:clamp(15px,.95vw,18px);font-weight:560;letter-spacing:-.012em}
.dc-r span{display:block;margin-top:4px;max-width:22em;font-size:clamp(13.5px,.82vw,15.5px);line-height:1.34;color:var(--g2)}
.dc-k{position:relative;align-self:stretch;border-left:1px solid var(--line);background:linear-gradient(90deg,var(--line) 1px,transparent 1px) 0 0/25% 100%}
.dc-k i{position:absolute;top:50%;height:14px;margin-top:-7px;border-radius:7px;background:var(--red)}
.dc-k i.d{width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%}.dc-k i.b{width:14px;height:14px;margin:-7px 0 0 -7px}
.dc-x{border-top:0}.dc-x>div:first-child{padding:0}
.dc-x>div:last-child{display:flex;justify-content:space-between;padding:12px 0 10px;border-left:1px solid var(--line);font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}
.dc-x i{font-style:normal;width:0;display:flex;justify-content:center;white-space:nowrap}.dc-x i:first-child{justify-content:flex-start;padding-left:10px}.dc-x i:last-child{justify-content:flex-end;padding-right:10px}
.dc-r.ok{background:#f7f9ff}.dc-r.ok .dc-k i{background:var(--blue)}.dc-r.ok b{color:#1f4fbf}
/* the figure */
.sn{background:var(--dk);color:#fff}
.sn-i{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:clamp(24px,3vw,56px);border-left:1px solid var(--dl);border-right:1px solid var(--dl);border-bottom:1px solid var(--dl);padding:clamp(56px,5vw,96px) var(--pad)}
.sn b{font-size:clamp(72px,8.4vw,160px);line-height:.9;font-weight:600;letter-spacing:-.06em}
.sn p{margin:0;max-width:17em;font-size:clamp(20px,1.6vw,30px);line-height:1.16;letter-spacing:-.022em;font-weight:500}
.sn span{font:500 clamp(11px,.66vw,12.5px)/1.4 "Geist Mono",monospace;color:#8f9197;text-align:right;max-width:14em}
/* what's included, beside the Monday report */
.ic-g{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.ic-t{padding:clamp(88px,7.4vw,140px) var(--pad) clamp(64px,5.4vw,104px)}.ic-t .st-t{max-width:11em}
.mr{margin-top:clamp(32px,2.8vw,52px);max-width:440px}.mr p{margin:0;padding:16px 18px 18px;font-size:14.5px;line-height:1.45;color:var(--ink)}
.ic ul{list-style:none;margin:0;padding:clamp(56px,4.8vw,92px) var(--pad);border-left:1px solid var(--ln);display:grid;align-content:center;background:#fff}
.ic li{display:flex;gap:12px;align-items:flex-start;padding:clamp(14px,1.1vw,20px) 0;border-top:1px solid var(--ln);font-size:clamp(15.5px,.98vw,18.5px);line-height:1.34;font-weight:500;letter-spacing:-.01em}.ic li:first-child{border-top:0}
.ic li svg{flex:none;width:17px;height:17px;margin-top:3px;fill:none;stroke:var(--blue);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
/* the questions, as a thread */
.cv{border-top:1px solid var(--ln)}
.cv-g{display:grid;grid-template-columns:24.9% minmax(0,1fr);border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.cv-t{padding:clamp(72px,6vw,112px) var(--pad);border-right:1px solid var(--ln)}.cv-t .st-t{margin:0;font-size:clamp(27px,1.95vw,37px)}
.cv dl{margin:0;padding:clamp(64px,5.2vw,100px) var(--pad);display:grid;gap:10px;max-width:780px;width:100%;justify-self:center;box-sizing:border-box}
.cv dt,.cv dd{margin:0;display:flex}.cv dd{justify-content:flex-end;margin-bottom:clamp(10px,1vw,18px)}
.cv dt span,.cv dd span{max-width:min(30em,84%);padding:11px 16px;font-size:clamp(15px,.95vw,17.5px);line-height:1.38}
.cv dt span{border-radius:18px 18px 18px 6px;background:#eceef2;font-weight:540;letter-spacing:-.01em}
.cv dd span{border-radius:18px 18px 6px 18px;background:var(--blue);color:#fff}
/* what the reply hands on to */
.nx{border-top:1px solid var(--ln);background:#fff}
.nx-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(64px,5.4vw,104px) var(--pad) clamp(72px,6vw,116px)}
.nx-t{margin:0 0 clamp(28px,2.4vw,44px);font-size:clamp(19px,1.265vw,24px);font-weight:500;letter-spacing:-.02em}
.nx-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:clamp(28px,2.6vw,48px)}
.nx-g>*{position:relative;display:block;padding:clamp(18px,1.4vw,26px) clamp(18px,1.4vw,26px) clamp(22px,1.7vw,32px);border-radius:14px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln);transition:box-shadow .2s,background .2s}
.nx-g a:hover{background:#fff;box-shadow:inset 0 0 0 1.5px var(--blue)}
.nx-g>.on{background:var(--ink);color:#fff;box-shadow:none}.nx-g>.on span{color:#a3a5aa}
.nx-g b{display:block;font-size:clamp(16px,1vw,19px);font-weight:560;letter-spacing:-.014em}
.nx-g span{display:block;margin-top:6px;font-size:clamp(14px,.86vw,16.5px);line-height:1.34;color:var(--g2)}
.nx-g>*+*::before{content:"";position:absolute;right:100%;top:50%;width:clamp(28px,2.6vw,48px);border-top:1.5px dashed #b3bbcf}

@media(max-width:1180px){
.bo-b{grid-template-columns:repeat(4,minmax(0,1fr));row-gap:12px}
.bn-c,.bn-desk,.bn-cal,.bn-seen,.bn-custom{grid-column:span 6}
.vs-c{flex-direction:column}.vs-c.x{flex-direction:column-reverse}.vs-c.x ul{text-align:left}.vs-c.x li{flex-direction:row}
.jr ol{grid-template-columns:repeat(2,minmax(0,1fr))}.jr li:nth-child(odd){border-left:0}.jr li:nth-child(n+3){border-top:1px solid var(--dl)}
.nx-g{grid-template-columns:repeat(2,minmax(0,1fr))}.nx-g>*:nth-child(3)::before{display:none}
}
@media(max-width:860px){
.fl-r{padding:13px 14px}
.bo-b{grid-template-columns:repeat(2,minmax(0,1fr))}.ih-pi:has(.bo){padding-left:14px;padding-right:14px}
.pk-r{grid-template-columns:minmax(0,1fr);gap:5px}.pk-r div{flex-wrap:wrap}
.bn-h{padding:64px var(--pad) 32px;font-size:25px}
.mi-wk{gap:4px}.mi-wk i{font-size:9.5px;letter-spacing:-.02em;overflow:hidden}
.bn-g{grid-template-columns:minmax(0,1fr)}.bn-c,.bn-desk,.bn-cal,.bn-seen,.bn-custom{grid-column:auto;padding:24px var(--pad) 22px}.bn-p{min-height:180px}
.hs-r .hs-p{border-right:0;order:2}.ph-p{padding-top:28px!important}
.vs-t{padding:64px var(--pad) 32px;font-size:25px}.vs-g{grid-template-columns:minmax(0,1fr)}.vs-c{padding:36px var(--pad) 44px;align-items:center}.vs-c.v{border-left:0;border-top:1px solid var(--ln)}
.vs-c ul{max-width:none;width:100%}
.jr-h{grid-template-columns:minmax(0,1fr);padding:72px var(--pad) 40px}.jr-h .tag{margin:0}
.jr ol{grid-template-columns:minmax(0,1fr)}.jr li{border-left:0;border-top:1px solid var(--dl);padding:22px var(--pad) 36px}.jr li::before{left:var(--pad)}.jr-p{height:150px}
.uc-i{grid-template-columns:minmax(0,1fr);padding:56px var(--pad)}.uc .st-t{font-size:25px}.uc-f{height:58px;padding-left:16px}.uc-f em{height:42px;padding:0 14px}
.tr-b{padding:16px 14px 6px}.tr-e{grid-template-columns:minmax(0,1fr);gap:4px}.tr-e time{padding-top:0}.tr-e.me time{text-align:right}.tr-f div{padding:14px}.tr-f b{font-size:18px}
.dy-i{padding:0 14px 48px}.dy-t{padding:56px 6px 24px;font-size:25px}
.dc-r{grid-template-columns:minmax(0,1fr)}.dc-r>div:first-child{padding:16px 16px 10px}.dc-k{height:34px;border-left:0;border-top:1px solid var(--line)}
.dc-x>div:first-child{display:none}.dc-x>div:last-child{border-left:0;padding:12px 10px 10px}
.sn-i{grid-template-columns:minmax(0,1fr);gap:16px;padding:56px var(--pad)}.sn span{text-align:left}
.ic-g{grid-template-columns:minmax(0,1fr)}.ic-t{padding:64px var(--pad) 36px}.ic-t .st-t{font-size:25px;max-width:none}.ic ul{border-left:0;border-top:1px solid var(--ln);padding:12px var(--pad) 40px}
.cv-g{grid-template-columns:minmax(0,1fr)}.cv-t{border-right:0;padding:56px var(--pad) 0}.cv-t .st-t{font-size:25px}.cv dl{padding:28px var(--pad) 56px}.cv dt span,.cv dd span{max-width:88%}
.nx-i{padding:48px var(--pad) 56px}.nx-g{grid-template-columns:minmax(0,1fr);gap:22px}
.nx-g>*+*::before{display:block!important;right:auto;left:28px;top:auto;bottom:100%;width:0;height:22px;border-top:0;border-left:1.5px dashed #b3bbcf}
}
"""
# =====================================================================================
# The rest of the front desk. Copy comes from design/build_services.py and design/pages2.py; every picture is drawn for its page.
# =====================================================================================
sys.path.insert(0, str(pathlib.Path(ROOT) / 'design'))
import pages2
X = pages2.X
SAMPLE = 'Example, sample data'
AUDITLINK = '<a class="btn q" href="/free-audit">How the audit works</a>'


def sx(title, rest, inner, cls=''):
    return ('<section class="sx %s"><div class="w sx-i"><p class="sx-t">%s%s</p>%s</div></section>' % (cls, title, (' <span>%s</span>' % rest) if rest else '', inner))


def swap(rows):
    return '<ul class="sw">%s</ul>' % ''.join('<li><s>%s</s>%s<b>%s</b></li>' % (ap(a), ARROW, ap(b)) for a, b in rows)


def qcards(qa):
    return ('<section class="qc"><div class="w qc-i"><p class="sx-t">Questions.</p><div class="qc-g">%s</div></div></section>' % ''.join('<div><h3>%s</h3><p>%s</p></div>' % (ap(q), ap(a)) for q, a in qa))


def qfold(qa, cls=''):
    return ('<section class="qf %s"><div class="w qf-g"><p class="sx-t">Questions.</p><div>%s</div></div></section>'
            % (cls, ''.join('<details%s><summary>%s<i></i></summary><p>%s</p></details>' % (' open' if i == 0 else '', ap(q), ap(a)) for i, (q, a) in enumerate(qa))))


def dark(label, lead, rest, extra, picture):
    return ('<section class="hw"><div class="w hw-g"><div class="hw-t"><span class="lb">%s</span><p class="st-t">%s <span>%s</span></p>%s</div><div class="hw-r">%s</div></div></section>' % (label, lead, rest, extra, picture))


def frows(rows):
    return ''.join('<div class="fl-r"><i>%s</i><b>%s</b><span>%s</span></div>' % x for x in rows)


def hero_split(pill, h1, sub, note, picture, cls='', second=AUDITLINK):
    return ('<section class="hs %s"><div class="w hs-g"><div class="hs-t"><span class="pill"><i></i>%s</span><h1>%s</h1><p class="sub">%s</p><div class="cta">%s%s</div>%s</div>'
            '<div class="hs-p">%s</div></div></section>' % (cls, pill, ap(h1), ap(sub), BOOK, second, ('<p class="hs-n">%s</p>' % ap(note)) if note else '', picture))


# ---- /phone-agent : a live call on a dark panel; the call drawn as a fork; the summary you read afterwards ----
p = BY['phone-agent']
bars = [22, 40, 64, 36, 80, 52, 30, 70, 92, 58, 34, 62, 84, 46, 26, 54, 76, 40, 66, 88, 50, 30, 60, 78, 44, 24, 56, 72, 38, 62, 46, 28]
CALL = ('<div class="fl ca"><div class="fd-h"><span class="dot"></span><b>Live call</b><span>Ridgeline Fence</span><span class="tag">%s</span></div>'
        '<div class="ca-w"><div>%s</div><time>0:48</time></div><div class="ca-t">%s</div>'
        '<div class="rn-f"><span>Estimate booked while you were on the roof.</span><em>Wed 2 PM</em></div></div>'
        % (SAMPLE, ''.join('<i style="height:%d%%"></i>' % b for b in bars),
           ''.join('<p class="%s"><i>%s</i>%s</p>' % x for x in [
               ('a', 'Assistant', 'Thanks for calling Ridgeline Fence. I&rsquo;m the assistant here. What can I help with?'),
               ('c', 'Caller', 'I need a quote on a privacy fence.'),
               ('a', 'Assistant', 'I can set that up. What&rsquo;s the address, and how soon do you need it?'),
               ('c', 'Caller', 'It&rsquo;s in Monument. Sometime this month.'),
               ('a', 'Assistant', 'I have Wednesday at 2 or Thursday at 11. Which works?')])))
MISSED = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3.5 20.5 8M20.5 3.5 16 8M6.6 3.5h3l1.5 4-2 1.3a11 11 0 0 0 5 5l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/></svg>'
RECENTS = ('<div class="cd rc"><div class="rep-h"><span class="dot"></span><b>Recents</b><span>While you were on the roof</span><span class="tag">%s</span></div>%s</div>'
           % (SAMPLE, ''.join('<div class="rc-r">%s<b>%s</b><time>%s</time></div>' % (MISSED, ap(t), tm) for t, tm in zip(X['phone-agent'][1], ('10:12 AM', '11:47 AM', '2:14 PM')))))
d = p['does']
FORK = ('<div class="fo2"><div class="fo2-n"><i>1</i><b>%s</b><span>%s</span></div><div class="fo2-n"><i>2</i><b>%s</b><span>%s</span></div>'
        '<div class="fo2-b"><u></u><div class="fo2-n y"><em>Wants an estimate</em><b>Books it</b><span>The estimate goes on your calendar.</span></div>'
        '<div class="fo2-n r"><em>Asks for a person, or it&rsquo;s urgent</em><b>Hands off</b><span>The call rings through to you.</span></div><u></u></div>'
        '<div class="fo2-n"><i>4</i><b>%s</b><span>%s</span></div></div>' % (ap(d[0][0]), ap(d[0][1]), ap(d[1][0]), ap(d[1][1]), ap(d[3][0]), ap(d[3][1])))
SUMMARY = ('<div class="fl"><div class="fd-h"><span class="dot"></span><b>Call summary</b><span>2:14 PM</span><span class="tag">%s</span></div>%s'
           '<div class="rn-f"><span>Recording attached.</span><em>1 min 32 sec</em></div></div>'
           % (SAMPLE, frows([('Who', 'New caller', 'Homeowner, first call'), ('Job', 'Privacy fence, about 180 ft', 'Wants cedar'),
                             ('Where', 'Monument', 'Inside your service area'), ('Next', 'Estimate booked', 'Wed 2 PM, on your calendar')])))
PHONE_AGENT = (hero_split('Front desk', p['h1'], 'A voice assistant answers when you can&rsquo;t, takes the details and books the estimate.',
                          'It says who it is, and it hands the call to you when someone asks for a person.', CALL, 'hs-d')
               + H.split('The problem', X['phone-agent'][0][0], X['phone-agent'][0][1], RECENTS)
               + sx(X['phone-agent'][2], '', FORK, 'wh')
               + dark('What changes', 'You stay on the job.', 'The call still turns into an estimate.', swap(p['cmp']), SUMMARY)
               + qcards(p['faq']) + CL)

# ---- /website-chat : a browser window with the chat open at 10 PM; every answer tagged with where it came from ----
p = BY['website-chat']
BROWSER = ('<div class="cd bw"><div class="bw-b"><i></i><i></i><i></i><span>Your website</span><time>10:04 PM</time></div><div class="bw-g"><div class="bw-s"><b>Fences built right.</b><u></u><u></u><u class="s"></u><div><i></i><i></i><i></i></div></div>'
           '<div class="bw-c"><div class="bw-h"><span class="dot"></span><b>Ask us anything</b><span class="tag">%s</span></div><div class="bw-m"><p>Do you build cedar fences in Monument?</p>'
           '<p class="me">Yes. Cedar privacy and picket, and Monument is in our service area. Want a time for a free estimate?</p><p>Sure</p>'
           '<div><span>Tue 9 AM</span><span class="on">Wed 2 PM</span><span>Thu 11 AM</span></div></div></div></div></div>' % SAMPLE)
KB = ('<div class="kb"><div class="kb-s"><h3>What you give it</h3>%s</div><div class="kb-a"><h3>What it says</h3>%s</div></div>'
      % (''.join('<div><b>%s</b><span>%s</span></div>' % x for x in [('Services', 'Cedar, vinyl, chain link, gates, repairs'), ('Service area', 'Monument, Colorado Springs, Castle Rock'),
                                                                   ('Hours', 'Monday to Saturday, 7 to 5'), ('How you price', 'Free estimates. Ranges only, never a final price.')]),
         ''.join('<div class="%s"><p>%s</p><p class="me">%s</p><em>%s</em></div>' % x for x in [
             ('', 'Do you do repairs?', 'Yes, fence and gate repairs.', 'From: Services'),
             ('', 'Are you open Saturday?', 'Yes, 7 to 5.', 'From: Hours'),
             ('h', 'Can you beat another quote?', 'That one is for the owner. I&rsquo;ve passed it on with this conversation.', 'Handed to you')])))
WEBSITE_CHAT = (inner_hero('Front desk', ap(p['h1']), ap(p['lede']), BOOK + AUDITLINK, BROWSER)
                + statement('The problem', X['website-chat'][0][0], ap(X['website-chat'][0][1]))
                + sx('It answers from your own information.', 'Anything it can&rsquo;t answer goes to you with the conversation attached.', KB, 'wh')
                + '<section class="bl"><div class="w bl-i"><p>%s</p></div></section>' % ap(p['line'])
                + H.split('What changes', 'The visitor leaves with a time,', 'not a number to call tomorrow.', swap(p['cmp']))
                + qfold(p['faq']) + CL)

# ---- /social-messages : three apps dropping into one inbox; three companies racing to reply ----
p = BY['social-messages']
FUNNEL = ('<div class="fn"><div class="fn-s">%s</div><div class="cd fn-i"><div class="rep-h"><span class="dot"></span><b>One inbox</b><span>In your app</span><span class="tag">%s</span></div>%s</div></div>'
          % (''.join('<div><i>%s</i><p>%s</p></div>' % x for x in [('Facebook', 'How much for a gate repair?'), ('Instagram', 'Do you do vinyl?'), ('Google', 'Are you taking new jobs?')]),
             SAMPLE, ''.join('<div class="fn-r"><i>%s</i><b>%s</b><span>%s</span></div>' % x for x in [
                 ('Facebook', 'How much for a gate repair?', 'Replied in 7 seconds. Asked for a photo.'),
                 ('Instagram', 'Do you do vinyl?', 'Replied in 9 seconds. Picking a time.'),
                 ('Google', 'Are you taking new jobs?', 'Replied in 6 seconds. Booked Thu 11 AM.')])))
RACE = ('<div class="cd ra"><div class="rep-h"><span class="dot"></span><b>One message, three companies</b><span class="tag">Example</span></div>%s</div>'
        % ''.join('<div class="ra-r %s"><b>%s</b><div><i style="width:%s"></i></div><span>%s</span></div>' % x for x in [
            ('', 'Company one', '100%', 'Saw the message two days later.'),
            ('', 'Company two', '34%', 'Replied &ldquo;call us&rdquo; that evening.'),
            ('y', 'You', '14px', 'Replied in 8 seconds, with times to pick from.')]))
WHO = ('<section class="pg pg-4"><div class="w pg-g">%s</div></section>'
       % ''.join('<div>%s<h3>%s</h3><p>%s</p></div>' % (svg(k), ap(t), ap(x)) for k, (t, x) in zip(('chat', 'time', 'quote', 'cal'), p['does'])))
SOCIAL = (hero_split('Front desk', p['h1'], p['lede'], '', FUNNEL)
          + statement('The problem', X['social-messages'][0][0], ap(X['social-messages'][0][1]))
          + sx('A lead messages three companies.', 'The first real reply usually gets the job.', RACE)
          + WHO
          + faq('Questions.', [(ap(q), ap(a)) for q, a in p['faq']]) + CL)

# ---- /lead-vetting : a left-set top over a sorting table; two lead cards, one booked and one turned away ----
p = BY['lead-vetting']
SORT = ('<div class="cd vt"><div class="rep-h"><span class="dot"></span><b>This week&rsquo;s leads</b><span>Ridgeline Fence</span><span class="tag">%s</span></div>'
        '<div class="vt-r vt-h"><span>Lead</span><span>What they said</span><span>Sorted</span></div>%s'
        '<div class="vt-f"><b>4 asked</b><span>2 booked. 2 got a polite no. Nobody drove out to find out.</span></div></div>'
        % (SAMPLE, ''.join('<div class="vt-r %s"><b>%s</b><span>%s</span><em>%s</em></div>' % x for x in [
            ('g', 'Privacy fence, 180 ft', 'Monument. This month. Budget in range.', 'Good fit. Booked Wed 2 PM'),
            ('g', 'Gate repair', 'Castle Rock. This week.', 'Good fit. Booked Thu 11 AM'),
            ('n', 'Ranch fencing', '90 miles out.', 'Out of area. Polite no'),
            ('n', 'One loose board', 'Below your minimum.', 'Not a fit. Polite no')])))
def lead(cls, verdict, rows, foot):
    return ('<div class="cd lc %s"><div class="rep-h"><span class="dot"></span><b>New lead</b><span class="tag">%s</span></div><dl>%s</dl><p>%s</p></div>'
            % (cls, verdict, ''.join('<div%s><dt>%s</dt><dd>%s</dd></div>' % ((' class="x"' if f else ''), q, a) for q, a, f in rows), foot))
LEADS = ('<div class="lc-g">%s%s</div>' % (
    lead('g', 'Good fit', [('Job type', 'Privacy fence', 0), ('Size', 'About 180 ft', 0), ('Address', 'Monument', 0), ('Timing', 'This month', 0), ('Budget range', 'In range', 0)], 'Booked for Wed 2 PM. You walk in knowing what they said.'),
    lead('n', 'Not a fit', [('Job type', 'Ranch fencing', 0), ('Size', 'About 2 miles', 0), ('Address', '90 miles out', 1), ('Timing', 'Next year', 0), ('Budget range', 'Not sure yet', 0)], 'A clear, polite no went out. Nobody is left waiting, and nobody drove out.')))
LEAD_VETTING = ('<section class="ih ih-l"><div class="w ih-i"><span class="lb">Front desk</span><h1>%s</h1><p class="sub">%s</p><div class="cta">%s%s</div></div><div class="ih-p"><div class="w ih-pi">%s</div></div></section>'
                % (ap(p['h1']), ap(p['lede']), BOOK, AUDITLINK, SORT)
                + statement('The problem', X['lead-vetting'][0][0], ap(X['lead-vetting'][0][1]))
                + sx(X['lead-vetting'][2], 'The answers travel with the lead.', LEADS, 'wh')
                + H.split('What changes', 'Not every lead is a job.', 'You shouldn&rsquo;t have to find that out in person.', swap(p['cmp']))
                + qcards(p['faq']) + CL)

# ---- /after-hours : a dark top with one night on a ruler; two calls at 2 AM going two ways; the rota; the morning summary ----
p = BY['after-hours']
NIGHT = ('<div class="ng"><div class="ng-h"><b>One night</b><span>Example plumber, sample data</span></div><div class="ng-x">%s%s</div><div class="ng-g">%s</div></div>'
         % (''.join('<span>%s</span>' % t for t in ('6 PM', '9 PM', 'Midnight', '3 AM', '6 AM', '8 AM')),
            ''.join('<i class="%s" style="left:%.1f%%"></i>' % x for x in [('', 23.1), ('', 40.5), ('u', 57.7), ('', 89.4)]),
            ''.join('<div class="%s"><time>%s</time><b>%s</b><span>%s</span></div>' % x for x in [
                ('', '9:14 PM', 'Quote request', 'Booked for Tue 9 AM.'), ('', '11:40 PM', 'Question about a water heater', 'Answered.'),
                ('u', '2:07 AM', 'Burst pipe', 'On-call phone rang.'), ('', '6:31 AM', 'Website form', 'Booked for Thu 11 AM.')])))
TWO = ('<div class="tw"><div class="tw-c u"><time>2:07 AM</time><p>&ldquo;There&rsquo;s water coming through the ceiling.&rdquo;</p><ol><li>Asks what is happening</li><li>Sorted as urgent</li><li>Rings your on-call number</li></ol><em>Someone is on the way</em></div>'
       '<div class="tw-c"><time>2:12 AM</time><p>&ldquo;Can I get a quote on a new water heater?&rdquo;</p><ol><li>Asks what is happening</li><li>Sorted as can wait</li><li>Booked for the next open slot, with a confirmation</li></ol><em>Nobody is woken</em></div></div>')
ROTA = ('<div class="cd ro"><div class="rep-h"><span class="dot"></span><b>On call this week</b><span class="tag">%s</span></div><div class="ro-g">%s</div></div>'
        % (SAMPLE, ''.join('<div class="%s"><b>%s</b><span>%s</span></div>' % x for x in [('', 'Mon', 'You'), ('', 'Tue', 'You'), ('o', 'Wed', 'Crew lead'), ('o', 'Thu', 'Crew lead'), ('', 'Fri', 'You'), ('o', 'Sat', 'Crew lead'), ('o', 'Sun', 'Crew lead')])))
MORNING = ('<div class="cd mr mo"><div class="rep-h"><span class="dot"></span><b>Morning summary</b><span>7:00 AM</span><span class="tag">%s</span></div>'
           '<p>Overnight: 4 came in. 1 emergency went to on-call at 2:07 AM. 2 were booked. 1 question was answered. Nothing is waiting on you.</p></div>' % SAMPLE)
AFTER_HOURS = ('<section class="dh"><div class="w dh-i"><span class="lb">Front desk</span><h1>%s</h1><p class="sub">%s</p><div class="cta">%s<a class="btn q" href="/free-audit">How the audit works</a></div>%s</div></section>'
               % (ap(p['h1']), ap(p['lede']), BOOK, NIGHT)
               + statement('The problem', X['after-hours'][0][0], ap(X['after-hours'][0][1]))
               + sx('The burst pipe at 2 AM and the quote request at 2 AM', 'are not the same call.', TWO, 'wh')
               + H.split('On call', 'The right person gets woken.', 'Emergencies ring your on-call number. Nothing else does. Whoever you set, on a rota you control.', ROTA)
               + '<section class="sp sp-r"><div class="w sp-g"><div class="sp-p">%s</div><div class="sp-t"><span class="lb">The morning after</span><p class="st-t">You read what was handled. <span>Not what you missed.</span></p></div></div></section>' % MORNING
               + qfold(p['faq'][:2] + [p['faq'][2]]) + CL)

CSS_DESK = r"""
/* ============ pieces the front-desk pages draw on ============ */
.sx{border-top:1px solid var(--ln)}.sx.wh{background:#fff}
.sx-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(88px,7vw,132px) var(--pad) clamp(80px,6.4vw,124px)}
.sx-t{margin:0 0 clamp(36px,3vw,56px);max-width:19em;font-size:clamp(27px,1.95vw,37px);line-height:1.12;letter-spacing:-.028em;font-weight:500;text-wrap:pretty}.sx-t span{color:var(--g2)}
.sw{list-style:none;margin:0;padding:0;display:grid;width:100%;max-width:560px}
.sw li{display:grid;grid-template-columns:minmax(0,1fr) 16px minmax(0,1fr);gap:14px;align-items:center;padding:clamp(14px,1.1vw,20px) 0;border-top:1px solid var(--ln);font-size:clamp(14.5px,.9vw,17px);line-height:1.32}
.sw li:first-child{border-top:0}.sw s{color:var(--t3);text-decoration-color:rgba(138,141,147,.55)}.sw b{font-weight:560;letter-spacing:-.01em}
.sw svg{width:16px;height:16px;fill:none;stroke:var(--blue);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.sp-p .sw{padding:8px 22px;border-radius:12px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.06),0 14px 34px -22px rgba(30,40,80,.28)}
.hw .sw{margin-top:clamp(32px,2.8vw,52px);max-width:34em}.hw .sw li{grid-template-columns:minmax(0,1fr) 16px minmax(0,1fr);border-color:var(--dl)}.hw .sw li::before{display:none}.hw .sw li b{font-size:inherit}.hw .sw s{color:#7f8187}.hw .sw svg{stroke:#6d9bff}
.qc{border-top:1px solid var(--ln)}.qc-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(80px,6.4vw,124px) var(--pad)}
.qc-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(12px,1.1vw,20px)}
.qc-g div{padding:clamp(20px,1.6vw,30px) clamp(20px,1.6vw,30px) clamp(26px,2vw,38px);border-radius:14px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.06),0 14px 34px -24px rgba(30,40,80,.25)}
.qc-g h3{margin:0;font-size:clamp(16px,1.02vw,19.5px);font-weight:560;letter-spacing:-.014em;line-height:1.25}.qc-g p{margin:10px 0 0;font-size:clamp(14.5px,.88vw,16.5px);line-height:1.42;color:var(--g2)}
.qf{border-top:1px solid var(--ln);background:#fff}.qf-g{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(80px,6.4vw,124px) var(--pad)}
.qf .sx-t{margin:0}.qf details{border-top:1px solid var(--ln)}.qf details:last-child{border-bottom:1px solid var(--ln)}
.qf summary{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:clamp(18px,1.4vw,26px) 0;cursor:pointer;list-style:none;font-size:clamp(16px,1.05vw,20px);font-weight:540;letter-spacing:-.014em}
.qf summary::-webkit-details-marker{display:none}
.qf summary i{position:relative;flex:none;width:14px;height:14px}.qf summary i::before,.qf summary i::after{content:"";position:absolute;left:0;right:0;top:6px;height:1.5px;background:var(--ink);transition:transform .2s}
.qf summary i::after{transform:rotate(90deg)}.qf details[open] summary i::after{transform:rotate(0)}
.qf details p{margin:0;padding:0 40px clamp(20px,1.6vw,30px) 0;max-width:34em;font-size:clamp(15px,.92vw,17.5px);line-height:1.45;color:var(--g2)}
.bl{border-top:1px solid var(--ln);background:#fff}
.bl-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(96px,8.6vw,164px) 24px;text-align:center}
.bl p{margin:0 auto;max-width:17em;font-size:clamp(30px,2.75vw,52px);line-height:1.08;font-weight:560;letter-spacing:-.038em;text-wrap:balance}
.sp-r .sp-p{border-left:0;border-right:1px solid var(--ln)}
.pg h3{margin-top:clamp(40px,3.4vw,64px)}

/* ============ /phone-agent ============ */
.hs-d .hs-p{background:#101010;border-left:0}
.ca{max-width:520px}
.ca-w{display:flex;align-items:center;gap:14px;padding:16px 18px;border-bottom:1px solid var(--dl)}
.ca-w div{flex:1;display:flex;align-items:center;gap:3px;height:44px}.ca-w i{flex:1;min-width:2px;border-radius:2px;background:#5d90fb}.ca-w i:nth-child(n+21){background:#3a3c42}
.ca-w time{font:500 12px/1 "Geist Mono",monospace;color:#a3a5aa}
.ca-t{display:grid;gap:12px;padding:16px 18px 18px;border-bottom:1px solid var(--dl)}
.ca-t p{margin:0;display:grid;grid-template-columns:76px minmax(0,1fr);gap:10px;font-size:13.5px;line-height:1.4;color:#e4e5e7}
.ca-t p i{font:500 11px/1.7 "Geist Mono",monospace;font-style:normal;color:#6d9bff}.ca-t p.c{color:#a3a5aa}.ca-t p.c i{color:#7f8187}
.rc{width:100%;max-width:500px}
.rc-r{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:12px;align-items:center;padding:15px 18px;border-top:1px solid var(--line);font-size:14px}.rc-r:first-of-type{border-top:0}
.rc-r svg{width:18px;height:18px;fill:none;stroke:var(--red);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.rc-r b{font-weight:520;letter-spacing:-.008em;line-height:1.3}
.rc-r time{font:500 11.5px/1 "Geist Mono",monospace;color:var(--red);white-space:nowrap}
.fo2{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:44px;align-items:center}
.fo2-n{position:relative;padding:clamp(18px,1.4vw,26px) clamp(18px,1.4vw,26px) clamp(22px,1.7vw,32px);border-radius:14px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln)}
.fo2-n i{display:grid;place-items:center;width:22px;height:22px;margin-bottom:14px;border-radius:50%;background:var(--ink);color:#fff;font:600 11px/1 "Geist Mono",monospace;font-style:normal}
.fo2-n em{display:inline-flex;align-items:center;height:22px;margin-bottom:12px;padding:0 8px;border-radius:6px;font-style:normal;font-size:11.5px;font-weight:560}
.fo2-n.y em{background:#e9eeff;color:#2a4ea8}.fo2-n.r em{background:#fff4d6;color:#a86a00}
.fo2-n b{display:block;font-size:clamp(16px,1vw,19px);font-weight:560;letter-spacing:-.014em}.fo2-n span{display:block;margin-top:6px;font-size:clamp(14px,.86vw,16px);line-height:1.36;color:var(--g2)}
.fo2>.fo2-n+.fo2-n::before{content:"";position:absolute;right:100%;top:50%;width:44px;border-top:1.5px dashed #b3bbcf}
.fo2-b{position:relative;display:grid;gap:16px}
.fo2-b u{position:absolute;top:25%;bottom:25%;left:-22px;border-left:1.5px dashed #b3bbcf}.fo2-b u:last-child{left:auto;right:-22px}
.fo2-b::before,.fo2-b::after{content:"";position:absolute;top:50%;width:22px;border-top:1.5px dashed #b3bbcf}.fo2-b::before{left:-44px}.fo2-b::after{right:-44px}
.fo2-b .fo2-n::before,.fo2-b .fo2-n::after{content:"";position:absolute;top:50%;width:22px;border-top:1.5px dashed #b3bbcf}.fo2-b .fo2-n::before{right:100%}.fo2-b .fo2-n::after{left:100%}
.fo2>.fo2-b+.fo2-n::before{display:none}

/* ============ /website-chat ============ */
.bw{width:min(1040px,100%);overflow:hidden}
.bw-b{display:flex;align-items:center;gap:7px;height:44px;padding:0 16px;border-bottom:1px solid var(--line)}
.bw-b i{width:10px;height:10px;border-radius:50%;background:#e2e4e8}
.bw-b span{flex:1;max-width:340px;margin:0 auto;display:grid;place-items:center;height:26px;border-radius:7px;background:#f1f2f5;font-size:12px;color:var(--t2)}
.bw-b time{font:500 11.5px/1 "Geist Mono",monospace;color:var(--t3)}
.bw-g{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 372px;gap:28px;padding:36px 28px 28px;text-align:left;min-height:420px;background:#fbfbfc}
.bw-s{display:grid;gap:10px;align-content:start;padding-top:12px}.bw-s b{margin-bottom:8px;font-size:clamp(28px,2.4vw,40px);font-weight:620;letter-spacing:-.04em;line-height:1.05}
.bw-s u{height:9px;border-radius:5px;background:#e9ebef;max-width:420px}.bw-s u.s{max-width:250px}
.bw-s div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:22px;max-width:480px}.bw-s div i{aspect-ratio:4/3;border-radius:10px;background:repeating-linear-gradient(135deg,#eceef2 0 2px,#f7f8fa 2px 6px)}
.bw-c{align-self:end;border-radius:14px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.08),0 30px 60px -28px rgba(30,40,110,.5)}
.bw-h{display:flex;align-items:center;gap:9px;height:44px;padding:0 14px;border-bottom:1px solid var(--line);font-size:13px}.bw-h b{font-weight:600}
.bw-m{display:grid;gap:8px;padding:14px;font-size:13.5px;line-height:1.38}
.bw-m p{margin:0;width:fit-content;max-width:88%;padding:8px 12px;border-radius:13px 13px 13px 4px;background:#f1f2f5}.bw-m p.me{margin-left:auto;border-radius:13px 13px 4px 13px;background:var(--blue);color:#fff}
.bw-m div{display:flex;gap:6px;justify-content:flex-end;margin-top:2px}.bw-m span{display:grid;place-items:center;height:32px;padding:0 10px;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(23,24,26,.12);font-size:12px;font-weight:520}.bw-m span.on{background:var(--blue);color:#fff;box-shadow:none}
@media(min-width:1700px){.bw{zoom:1.1}}
.kb{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(28px,3.4vw,64px);align-items:start}
.kb h3{margin:0 0 14px;font:500 12px/1 "Geist Mono",monospace;color:var(--t3)}
.kb-s{display:grid}.kb-s div{padding:clamp(14px,1.1vw,20px) 0;border-top:1px solid var(--ln)}.kb-s div:last-child{border-bottom:1px solid var(--ln)}
.kb-s b{display:block;font-size:clamp(15.5px,.98vw,18.5px);font-weight:560;letter-spacing:-.012em}.kb-s span{display:block;margin-top:3px;font-size:clamp(14px,.86vw,16px);color:var(--g2)}
.kb-a{display:grid;gap:12px}.kb-a>div{display:grid;gap:8px;padding:16px 18px 14px;border-radius:14px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln);font-size:clamp(14.5px,.9vw,16.5px);line-height:1.38}
.kb-a p{margin:0;width:fit-content;max-width:86%;padding:9px 13px;border-radius:14px 14px 14px 5px;background:#eceef2}.kb-a p.me{margin-left:auto;border-radius:14px 14px 5px 14px;background:var(--blue);color:#fff}
.kb-a em{justify-self:end;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;background:#e9eeff;color:#2a4ea8;font-style:normal;font-size:11.5px;font-weight:560}
.kb-a .h p.me{background:var(--ink)}.kb-a .h em{background:#fff4d6;color:#a86a00}

/* ============ /social-messages ============ */
.fn{width:100%;max-width:560px}
.fn-s{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.fn-s div{position:relative;padding:12px 13px 14px;border-radius:12px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.07),0 16px 30px -20px rgba(30,40,110,.4)}
.fn-s i{font:500 11px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3)}.fn-s p{margin:7px 0 0;font-size:13px;line-height:1.3;font-weight:520}
.fn-s div::after{content:"";position:absolute;left:50%;top:100%;height:34px;border-left:1.5px dashed #9fb0dd}
.fn-i{margin-top:34px}
.fn-r{display:grid;grid-template-columns:84px minmax(0,1fr);gap:2px 12px;padding:13px 18px 14px;border-top:1px solid var(--line)}.fn-r:first-of-type{border-top:0}
.fn-r i{grid-row:1/3;align-self:start;justify-self:start;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;background:#f1f2f5;font-style:normal;font-size:11.5px;font-weight:540;color:var(--t2)}
.fn-r b{font-size:14px;font-weight:560;letter-spacing:-.008em}.fn-r span{grid-column:2;font-size:12.5px;color:var(--t2)}
@media(min-width:1700px){.fn{zoom:1.12}}
.ra-r{display:grid;grid-template-columns:minmax(0,.22fr) minmax(0,1fr) minmax(0,.5fr);gap:clamp(14px,1.6vw,30px);align-items:center;padding:clamp(18px,1.5vw,28px) clamp(18px,1.6vw,30px);border-top:1px solid var(--line)}.ra-r:first-of-type{border-top:0}
.ra-r b{font-size:clamp(15px,.95vw,18px);font-weight:560;letter-spacing:-.012em;color:var(--t2)}
.ra-r div{height:14px;border-radius:7px;background:#f1f2f5}.ra-r div i{display:block;height:100%;border-radius:7px;background:#c9cbd0}
.ra-r span{font-size:clamp(14px,.86vw,16px);line-height:1.34;color:var(--g2)}
.ra-r.y{background:#f7f9ff}.ra-r.y b{color:#1f4fbf}.ra-r.y i{background:var(--blue)}.ra-r.y span{color:var(--ink);font-weight:520}

/* ============ /lead-vetting ============ */
.ih-l .ih-i{text-align:left;padding-left:var(--pad);padding-right:var(--pad)}.ih-l h1{margin-left:0;max-width:12em}.ih-l .sub{margin-left:0;text-align:left;text-wrap:pretty}.ih-l .cta{justify-content:flex-start}
.ih-l .ih-pi{padding-left:var(--pad);padding-right:var(--pad)}
.vt{width:100%;overflow:hidden;text-align:left}
.vt-r{display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1fr) minmax(0,.8fr);gap:16px;align-items:center;padding:clamp(14px,1.1vw,20px) clamp(18px,1.5vw,28px);border-top:1px solid var(--line);font-size:clamp(14px,.9vw,16.5px)}
.vt-h{padding-top:12px;padding-bottom:12px;border-top:0;font:500 11.5px/1 "Geist Mono",monospace;color:var(--t3)}
.vt-r b{font-weight:560;letter-spacing:-.01em}.vt-r>span{color:var(--g2)}.vt-h>span{color:var(--t3)}
.vt-r em{justify-self:start;display:inline-flex;align-items:center;min-height:26px;padding:3px 10px;border-radius:7px;font-style:normal;font-size:clamp(12px,.76vw,13.5px);font-weight:560}
.vt-r.g em{background:#e7f6ec;color:#1c7a43}.vt-r.n em{background:#f1f2f5;color:var(--t2)}.vt-r.n b{color:var(--t2)}
.vt-f{display:flex;align-items:baseline;gap:12px;padding:16px clamp(18px,1.5vw,28px) 17px;background:#101113;color:#8f9197;font-size:13px}.vt-f b{color:#fff;font-size:20px;font-weight:600;letter-spacing:-.03em;white-space:nowrap}
.lc-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(16px,1.8vw,32px)}
.lc dl{margin:0;padding:6px 18px}.lc dl div{display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1fr);gap:12px;padding:12px 0;border-top:1px solid var(--line);font-size:clamp(14px,.9vw,16.5px)}.lc dl div:first-child{border-top:0}
.lc dt{color:var(--t2)}.lc dd{margin:0;font-weight:540;letter-spacing:-.008em}.lc dl div.x dd{color:var(--red)}
.lc>p{margin:0;padding:16px 18px 18px;border-top:1px solid var(--line);font-size:clamp(14px,.88vw,16px);line-height:1.4}
.lc.g .tag{color:#1c7a43}.lc.g>p{background:#f3faf5;border-radius:0 0 12px 12px}.lc.n{box-shadow:0 0 0 1px rgba(23,24,26,.06)}.lc.n .dot{background:#c9cbd0}.lc.n dd{color:var(--t2);font-weight:500}.lc.n>p{color:var(--g2)}

/* ============ /after-hours ============ */
.dh{background:#0c0d10;color:#fff}
.dh-i{border-left:1px solid var(--dl);border-right:1px solid var(--dl);text-align:center;padding:clamp(80px,7vw,132px) var(--pad) clamp(64px,5.6vw,108px)}
.dh .lb{background:rgba(109,155,255,.16);color:#a9c4ff}
.dh h1{margin:clamp(18px,1.5vw,28px) auto 0;max-width:14em;font-size:clamp(38px,3.2vw,60px);line-height:1.05;letter-spacing:-.04em;font-weight:600;text-wrap:balance}
.dh .sub{color:#a3a5aa;margin:clamp(14px,1.2vw,22px) auto 0;max-width:33em}
.dh .btn{background:#fff;color:var(--ink)}.dh .btn.q{background:transparent;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.24)}
.ng{margin-top:clamp(56px,5vw,96px);text-align:left;border-radius:14px;background:#15161a;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.ng-h{display:flex;align-items:center;gap:10px;height:46px;padding:0 18px;border-bottom:1px solid var(--dl);font-size:13px;color:#8f9197}.ng-h b{color:#fff;font-weight:600}.ng-h span{margin-left:auto;font:500 11.5px/1 "Geist Mono",monospace}
.ng-x{position:relative;display:flex;justify-content:space-between;margin:0 clamp(18px,1.6vw,30px);padding:26px 0 30px;font:500 11px/1 "Geist Mono",monospace;color:#7f8187}
.ng-x::after{content:"";position:absolute;left:0;right:0;bottom:12px;height:2px;border-radius:1px;background:linear-gradient(90deg,#2b3350,#3a4a8a 45%,#3a4a8a 70%,#806a3a)}
.ng-x i{position:absolute;bottom:7px;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#6d9bff;box-shadow:0 0 0 4px #15161a}.ng-x i.u{background:var(--amber)}
.ng-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--dl)}
.ng-g div{padding:clamp(16px,1.3vw,24px) clamp(18px,1.6vw,30px) clamp(20px,1.6vw,30px);border-left:1px solid var(--dl)}.ng-g div:first-child{border-left:0}
.ng-g time{font:500 11.5px/1 "Geist Mono",monospace;color:#6d9bff}.ng-g .u time{color:var(--amber)}
.ng-g b{display:block;margin-top:10px;font-size:clamp(15px,.98vw,18.5px);font-weight:560;letter-spacing:-.012em}.ng-g span{display:block;margin-top:4px;font-size:clamp(13.5px,.84vw,15.5px);color:#a3a5aa}
.tw{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(16px,1.8vw,32px)}
.tw-c{padding:clamp(22px,1.8vw,34px);border-radius:16px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln)}
.tw-c time{font:500 12px/1 "Geist Mono",monospace;color:var(--t3)}
.tw-c p{margin:12px 0 clamp(20px,1.6vw,30px);font:400 clamp(21px,1.6vw,30px)/1.2 Georgia,"Times New Roman",serif;letter-spacing:-.014em}
.tw-c ol{list-style:none;margin:0;padding:0;counter-reset:t}.tw-c li{counter-increment:t;display:flex;gap:12px;padding:12px 0;border-top:1px solid var(--ln);font-size:clamp(14.5px,.92vw,17px)}
.tw-c li::before{content:counter(t);flex:none;font:500 11.5px/1.7 "Geist Mono",monospace;color:var(--t3)}
.tw-c em{display:inline-flex;align-items:center;height:30px;margin-top:14px;padding:0 12px;border-radius:8px;background:#e9eeff;color:#2a4ea8;font-style:normal;font-size:13.5px;font-weight:560}
.tw-c.u{background:#fffaf0;box-shadow:inset 0 0 0 1px #f3e2b8}.tw-c.u time{color:#a86a00}.tw-c.u li{border-color:#f0e4c6}.tw-c.u em{background:var(--amber);color:#3d2a00}
.ro{width:100%;max-width:560px}.ro-g{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;padding:16px}
.ro-g div{display:grid;gap:8px;justify-items:center;padding:12px 4px 14px;border-radius:10px;background:#f1f2f5;text-align:center}
.ro-g b{font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}.ro-g span{font-size:12.5px;font-weight:560;line-height:1.15}.ro-g .o{background:#e9eeff}.ro-g .o span{color:#2a4ea8}
.mo{margin:0;max-width:500px}.mo p{font-size:clamp(15px,.95vw,17px)}
.qf.dkq{background:var(--dk)}

@media(max-width:1180px){
.fo2{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.fo2 *::before,.fo2 *::after,.fo2-b u{display:none!important}
.qc-g{grid-template-columns:minmax(0,1fr)}
.bw-g{grid-template-columns:minmax(0,1fr) 320px}
.ng-g{grid-template-columns:repeat(2,minmax(0,1fr))}.ng-g div:nth-child(odd){border-left:0}.ng-g div:nth-child(n+3){border-top:1px solid var(--dl)}
}
@media(max-width:860px){
.sx-i{padding:64px var(--pad) 56px}.sx-t{font-size:25px;margin-bottom:28px}
.sw li,.hw .sw li{grid-template-columns:minmax(0,1fr);gap:4px;padding:14px 0}.sw svg{display:none}.sp-p .sw{padding:6px 16px}
.qc-i{padding:56px var(--pad)}.qf-g{grid-template-columns:minmax(0,1fr);gap:24px;padding:56px var(--pad)}.qf details p{padding-right:0}
.bl-i{padding:72px 20px}.bl p{font-size:28px}
.sp-r .sp-p{border-right:0;order:2}
.hs-d .hs-p{padding:28px 14px 36px}.ca-t p{grid-template-columns:minmax(0,1fr);gap:2px}
.fo2{grid-template-columns:minmax(0,1fr);gap:12px}
.bw-g{grid-template-columns:minmax(0,1fr);padding:22px 14px 14px;min-height:0}.bw-s div{display:none}.bw-b span{max-width:none}
.kb{grid-template-columns:minmax(0,1fr)}
.fn-s{gap:6px}.fn-s div{padding:10px 9px 12px}.fn-s p{font-size:12px}.fn-r{grid-template-columns:minmax(0,1fr)}.fn-r i{grid-row:auto;margin-bottom:6px}.fn-r span{grid-column:1}
.ra-r{grid-template-columns:minmax(0,1fr);gap:10px}
.vt-h{display:none}.vt-r{grid-template-columns:minmax(0,1fr);gap:6px}.vt-f{flex-direction:column;gap:4px}
.lc-g{grid-template-columns:minmax(0,1fr)}
.dh-i{padding:64px 14px 48px}.dh h1{font-size:36px}.ng-x span:nth-child(even){display:none}.ng-g{grid-template-columns:minmax(0,1fr)}.ng-g div{border-left:0;border-top:1px solid var(--dl)}.ng-g div:first-child{border-top:0}
.tw{grid-template-columns:minmax(0,1fr)}.tw-c p{font-size:21px}
.ro-g{grid-template-columns:repeat(4,minmax(0,1fr))}
}
"""

# =====================================================================================
# Calendar and quotes. Same rules: existing copy, one drawn picture and one diagram per page that no other page has.
# =====================================================================================
def hero_left(label, h1, sub, picture):
    return ('<section class="ih ih-l"><div class="w ih-i"><span class="lb">%s</span><h1>%s</h1><p class="sub">%s</p><div class="cta">%s%s</div></div><div class="ih-p"><div class="w ih-pi">%s</div></div></section>'
            % (label, ap(h1), ap(sub), BOOK, AUDITLINK, picture))


def hero_dark(label, h1, sub, picture):
    return ('<section class="dh"><div class="w dh-i"><span class="lb">%s</span><h1>%s</h1><p class="sub">%s</p><div class="cta">%s%s</div>%s</div></section>' % (label, ap(h1), ap(sub), BOOK, AUDITLINK, picture))


def ticks(label, title, items, extra=''):
    return ('<section class="ic"><div class="w ic-g"><div class="ic-t"><span class="lb">%s</span><p class="st-t">%s</p>%s</div><ul>%s</ul></div></section>'
            % (label, title, extra, ''.join('<li>%s<span>%s</span></li>' % (TICK, ap(t)) for t in items)))


def bigline(text):
    return '<section class="bl"><div class="w bl-i"><p>%s</p></div></section>' % ap(text)


def head(title, sub='Ridgeline Fence', tag=SAMPLE):
    return '<div class="rep-h"><span class="dot"></span><b>%s</b>%s<span class="tag">%s</span></div>' % (title, ('<span>%s</span>' % sub) if sub else '', tag)


def xfaq(p):
    return [(ap(q), ap(a)) for q, a in p['faq']]


# ---- /booking : a week with one estimate on it; one lead on a rail from the form to the driveway ----
WEEK = ('<div class="cd wk">%s<div class="wkc-g">%s</div></div>' % (head('This week', 'Estimates and jobs'), ''.join(
    '<div><b>%s</b>%s</div>' % (d, ''.join('<i class="%s">%s</i>' % x for x in sl)) for d, sl in [
        ('Mon', [('j', 'Job<u>8:00 AM</u>'), ('', ''), ('j', 'Job<u>1:00 PM</u>')]), ('Tue', [('e', 'Estimate<u>9:00 AM</u>'), ('j', 'Job<u>11:00 AM</u>'), ('', '')]),
        ('Wed', [('j', 'Job<u>8:00 AM</u>'), ('', ''), ('', '')]), ('Thu', [('j', 'Job<u>8:00 AM</u>'), ('', ''), ('e on', 'Estimate<u>2:00 PM</u>')]),
        ('Fri', [('', ''), ('j', 'Job<u>10:00 AM</u>'), ('', '')])])))
RAIL = ('<ol class="rl">%s</ol>' % ''.join('<li><time>%s</time><b>%s</b></li>' % x for x in [
    ('7:40 AM', 'A form comes in'), ('7:40 AM', 'A reply goes out with three times'), ('7:52 AM', 'They pick Thursday at 2 PM'), ('Wed 6 PM', 'A reminder goes out'), ('Thu 2 PM', 'You show up')]))
BOOKING = (hero_split('Calendar', 'Estimates on your calendar.', 'Serious leads pick a time themselves, get reminded, and show up.',
                      'The lead picks from times you are actually free. Reminders are set the moment it books.', WEEK, 'hs-v')
           + statement('The problem', 'A lead who says yes still has to get on your calendar.', 'That takes a call back, a few texts about times, and a reminder nobody sends. Every extra step is a chance for them to go quiet.')
           + sx('One lead, from the form to the driveway.', '', RAIL + '<p class="rl-k">Example. Sample data.</p>', 'wh')
           + ticks('What&rsquo;s included', 'A booked estimate is a job you can still win.', [
               'Leads pick from times you’re actually free.', 'Estimates booked on your calendar, with the address and what the job is.', 'The right person’s calendar, if you have a crew.',
               'A reminder text the night before.', 'No-shows get a rebooking text automatically.', 'Works with Google Calendar.'])
           + faq('Questions.', [('Can they book outside my hours?', 'No. They only see the open times you set.'), ('What if they don&rsquo;t show?', 'A rebooking text goes out with new times.'),
                                ('Does it work with my crew?', 'Each booking can land on the right person&rsquo;s calendar.')]) + CL)

# ---- /reminders : a lock screen of reminders; the four moments between booking and the knock on the door ----
p = BY['reminders']
LOCK = ('<div class="nt"><time>7:00</time><span>Thursday</span>%s<p>Example. Sample data.</p></div>' % ''.join(
    '<div><i>Ridgeline Fence</i><em>%s</em><b>%s</b></div>' % x for x in [
        ('now', 'See you today at 2 PM for your fence estimate. Reply C to confirm or R to pick a new time.'),
        ('Yesterday', 'Reminder: your estimate is tomorrow at 2 PM at your address on Split Rail Dr.'),
        ('Monday', 'You&rsquo;re booked for Thursday at 2 PM. Here is what to expect.')]))
d = p['does']
MOMENTS = ('<div class="mo4">%s</div>' % ''.join('<div class="%s"><em>%s</em><b>%s</b><span>%s</span></div>' % (c, big, ap(t), ap(x)) for (c, big), (t, x) in zip(
    [('', 'Booked'), ('', '1 day'), ('y', 'Any time'), ('g', 'Freed')], d)))
REMINDERS = (inner_hero('Calendar', ap(p['h1']), ap(p['lede']), BOOK + AUDITLINK, LOCK)
             + statement('The problem', X['reminders'][0][0], ap(X['reminders'][0][1]))
             + sx(X['reminders'][2], '', MOMENTS, 'wh')
             + H.split('What changes', 'The people on your calendar show up.', 'A reminder costs nothing.', swap(p['cmp']))
             + qcards(p['faq']) + CL)

# ---- /dispatch : three crews on a day board with a job running long; two maps of the same stops ----
p = BY['dispatch']
def blk(a, b, cls='', t=''):
    return '<i class="%s" style="left:%.1f%%;width:%.1f%%">%s</i>' % (cls, (a - 8) / 9 * 100, (b - a) / 9 * 100, t)
GANTT = ('<div class="cd gt">%s<div class="gt-x"><span></span><div>%s</div></div>%s<div class="gt-f"><b>One job ran 45 minutes long.</b><span>Two stops moved, both customers were told, nobody made a call.</span></div></div>'
         % (head('Today', 'Three crews'), ''.join('<i>%s</i>' % t for t in ('8 AM', '11 AM', '2 PM', '5 PM')), ''.join(
             '<div class="gt-r"><b>%s</b><div>%s</div></div>' % x for x in [
                 ('Crew one', blk(8, 10.5, '', 'Fence install') + blk(11, 13, '', 'Gate') + blk(13.5, 16.5, '', 'Fence install')),
                 ('Crew two', blk(8, 11, 'l', 'Repair') + blk(11, 11.75, 'o', '') + blk(12.25, 14.25, 'm', 'Gate') + blk(14.75, 16.75, 'm', 'Estimate')),
                 ('Crew three', blk(9, 12, '', 'Fence install') + blk(12.5, 15, '', 'Repair'))])))
def route(pts, cls):
    return ('<svg viewBox="0 0 300 180" class="%s" aria-hidden="true"><path d="M%s"/>%s</svg>' % (cls, ' L'.join('%d %d' % q for q in pts), ''.join('<circle cx="%d" cy="%d" r="6"/>' % q for q in pts)))
STOPS = [(40, 140), (250, 40), (80, 50), (260, 130), (150, 30), (160, 150)]
TIDY = [(40, 140), (80, 50), (150, 30), (250, 40), (260, 130), (160, 150)]
ROUTES = ('<div class="rt"><figure>%s<figcaption><s>Crews cross town twice a day.</s></figcaption></figure><figure>%s<figcaption><b>Stops are grouped.</b> The same six stops, fewer miles between them.</figcaption></figure></div>' % (route(STOPS, 'x'), route(TIDY, 'v')))
DISPATCH = (hero_left('Calendar', p['h1'], p['lede'], GANTT)
            + statement('The problem', X['dispatch'][0][0], ap(X['dispatch'][0][1]))
            + sx('Routes that make sense.', 'Jobs are matched to crews by skill, equipment and who is already nearby.', ROUTES, 'wh')
            + dark('What changes', 'The day adjusts', 'without you making the calls.', swap(p['cmp']),
                   '<div class="fl">%s%s<div class="rn-f"><span>Sent to crews and customers at 11:02 AM.</span><em>0 calls made</em></div></div>' % (
                       '<div class="fd-h"><span class="dot"></span><b>One update</b><span>11:02 AM</span><span class="tag">%s</span></div>' % SAMPLE,
                       frows([('Crew', 'Crew two, your 12:00 moved to 12:15', 'Route updated on your phone.'), ('Cust.', 'Your gate install now starts at 12:15', 'Sorry for the wait. We&rsquo;ll text when we&rsquo;re on the way.'), ('Cust.', 'Your estimate moved to 2:45 PM', 'Reply R if that no longer works.')])))
            + qfold(p['faq']) + CL)

# ---- /job-updates : the customer's phone; the job as a tracker with four stops ----
p = BY['job-updates']
MSGS = ('<div class="ph"><div class="ph-s ms"><div class="ph-n"><b>Ridgeline Fence</b><span>Today</span></div>%s</div></div><p class="ph-k">Example. Sample data.</p>' % ''.join(
    '<time>%s</time><p>%s</p>' % x for x in [('12:58 PM', 'Your crew is on the way. They should arrive around 1:40 PM.'), ('1:31 PM', 'Running about 15 minutes behind. New arrival 1:55 PM. Sorry for the wait.'),
                                              ('4:12 PM', 'Job finished. Here are the photos of your new gate.<span><i></i><i></i></span>')]))
TRACK = ('<div class="tk2"><div class="tk2-b"><i></i></div><ol>%s</ol></div>' % ''.join('<li class="%s"><b>%s</b><span>%s</span></li>' % x for x in [
    ('on', 'On our way', 'With a realistic arrival time.'), ('on', 'Running late', 'They hear it from you first.'), ('on', 'Job started', 'The crew taps once, or sends a text.'), ('', 'Job finished', 'With photos if you take them.')]))
JOB_UPDATES = (hero_split('Calendar', p['h1'], p['lede'], 'Nobody in your office sends a text.', MSGS, 'ph-h1')
               + statement('The problem', X['job-updates'][0][0], ap(X['job-updates'][0][1]))
               + sx(X['job-updates'][2], '', TRACK, 'wh')
               + bigline(p['line'])
               + H.split('What changes', 'They know before they have to ask.', 'Fewer &ldquo;where are you&rdquo; calls, because they already know.', swap(p['cmp']))
               + faq('Questions.', xfaq(p)) + CL)

# ---- /estimates : notes on the left, a draft estimate on the right; the pipeline with one gate that is you ----
p = BY['estimates']
DRAFT = ('<div class="es"><div class="cd es-n">%s<div class="es-p"><i></i><i></i><i></i></div><p>&ldquo;180 feet of cedar privacy, six foot. Two gates. Old chain link comes out.&rdquo;</p><span>Voice note, 0:14</span></div>'
         '<div class="es-a">%s</div><div class="cd es-d">%s%s<div class="es-t"><span>Total</span><b>$6,400</b></div><div class="es-b"><em>Approve and send</em><span>Nothing goes out until you say so.</span></div></div></div>'
         % (head('From the job', '10:20 AM', 'Example'), ARROW, head('Draft estimate', '10:24 AM'), ''.join('<div class="es-r"><b>%s</b><span>%s</span></div>' % x for x in [
             ('Cedar privacy fence, 6 ft', '180 ft'), ('Walk gates', '2'), ('Remove old chain link', '180 ft'), ('Labour', 'From your price book')])))
PIPE = ('<div class="pl">%s</div>' % ''.join('<div class="%s"><b>%s</b><span>%s</span></div>' % x for x in [
    ('', ap(p['does'][1][0]), ap(p['does'][1][1])), ('', ap(p['does'][0][0]), ap(p['does'][0][1])), ('me', ap(p['does'][2][0]), ap(p['does'][2][1])), ('', ap(p['does'][3][0]), ap(p['does'][3][1]))]))
ESTIMATES = (inner_hero('Quotes', ap(p['h1']), ap(p['lede']), BOOK + AUDITLINK, DRAFT)
             + statement('The problem', X['estimates'][0][0], ap(X['estimates'][0][1]))
             + sx(X['estimates'][2], '', PIPE, 'wh')
             + H.split('What changes', 'The first estimate in their inbox has an edge.', 'Make it yours.', swap(p['cmp']))
             + qfold(p['faq']) + CL)

# ---- /proposals : the proposal as a page; three options with one picked and a place to sign ----
p = BY['proposals']
PAPER = ('<div class="pp"><div class="pp-h"><b>Ridgeline Fence</b><span>Proposal</span></div><h3>New cedar privacy fence</h3><div class="pp-i"><i></i><i></i><i></i></div>'
         '<h4>What is included</h4><u></u><u></u><u class="s"></u><h4>What is not</h4><u class="s"></u><h4>When</h4><u class="m"></u><div class="pp-s"><span>Sign here</span><em>Accept</em></div></div><p class="ph-k">Example. Sample data.</p>')
OPTS = ('<div class="op">%s</div><div class="op-f"><span><i></i>Opened twice, last at 7:42 PM</span><span><i></i>Signed from a phone</span></div>' % ''.join(
    '<div class="%s"><em>%s</em><b>%s</b><ul>%s</ul>%s</div>' % (c, t, n, ''.join('<li>%s</li>' % q for q in li), '<span>Picked</span>' if c else '') for c, t, n, li in [
        ('', 'Good', 'Pine privacy fence', ['6 ft, dog-ear pickets', 'One walk gate', 'Old fence removed']),
        ('on', 'Better', 'Cedar privacy fence', ['6 ft, cedar pickets and rails', 'Two walk gates', 'Old fence removed']),
        ('', 'Best', 'Cedar with steel posts', ['6 ft, cedar on steel posts', 'Two walk gates, one drive gate', 'Old fence removed, stain included'])]))
PROPOSALS = (hero_split('Quotes', p['h1'], p['lede'], '', PAPER, 'hs-v')
             + statement('The problem', X['proposals'][0][0], ap(X['proposals'][0][1]))
             + sx(X['proposals'][2], 'They accept without printing anything, and you see when it is opened.', OPTS, 'wh')
             + bigline(p['line'])
             + H.split('What changes', 'The proposal does some of the selling for you.', '', swap(p['cmp']))
             + qcards(p['faq']) + CL)

# ---- /follow-up : one quote and its check-ins; the schedule on a real time scale, on dark; the list of what is still open ----
QUOTE = ('<div class="cd qt">%s<div class="qo-t"><span>New fence, 180 ft</span><b>$6,400</b></div>%s</div>' % (head('Quote', 'Sent Monday'), ''.join(
    '<div class="qo-r %s"><i></i><b>%s</b><span>%s</span></div>' % x for x in [('', 'Day 2 check-in sent', 'Wednesday'), ('', 'Day 5 check-in sent', 'Saturday'), ('y', 'Accepted', 'Saturday, 11:20 AM')])))
SCALE = ('<div class="fsc"><div class="fsc-l">%s</div><p>Stops the moment there is a yes, a no, or paid.</p></div>' % ''.join(
    '<div style="left:%s"><i></i><b>%s</b><span>%s</span></div>' % x for x in [('0%', 'Sent', 'Quote goes out'), ('14%', 'Day 2', 'First check-in'), ('30%', 'Day 5', 'Second check-in'), ('52%', 'Day 10', 'Third check-in'), ('100%', 'Monthly', 'Until they answer')]))
OPEN = ('<div class="cd oq">%s%s</div>' % (head('Open quotes', '4 open'), ''.join('<div class="oq-r"><b>%s</b><span>%s</span><em class="%s">%s</em></div>' % x for x in [
    ('Privacy fence, 180 ft', 'Sent 2 days ago', '', 'Day 2 went out'), ('Gate repair', 'Sent 6 days ago', '', 'Day 5 went out'),
    ('Vinyl fence, 120 ft', 'Sent 12 days ago', 'y', 'Asked about price. Sent to you'), ('Chain link, 300 ft', 'Sent 5 weeks ago', '', 'Monthly check-in')])))
FOLLOW_UP = (hero_split('Quotes', 'Every quote gets chased.', 'Quotes and invoices get followed up until the customer says yes, no, or paid.',
                        'Each quote is followed up on a schedule and stops the moment there is an answer.', QUOTE)
             + statement('The problem', 'A quote nobody chases is a job you gave away.', 'Most people don&rsquo;t say no. They get busy, mean to reply, and then book whoever checks in. Following up is easy to skip when you are on a job.')
             + '<section class="sx dk"><div class="w sx-i"><p class="sx-t">Every quote, followed up. <span>Days 2, 5 and 10, then monthly, until it&rsquo;s a yes or a no.</span></p>%s</div></section>' % SCALE
             + ticks('What&rsquo;s included', 'Nothing stays open without someone checking in.', [
                 'Send a quote with one text and the follow-up starts on its own.', '“Too expensive” gets your financing or a smaller option. Real price talk comes to you.',
                 'Invoices and payment reminders sent when the job’s done.', 'Customers pay through your own pay link. We never touch your money.',
                 'Past customers get a text when they’re due for their next job, with your open times.'], '<div class="ic-x">%s</div>' % OPEN)
             + ask('Open quotes, old leads, past customers.', 'One text at launch can bring them back. A one-time campaign when you go live, if your audit calls for it.', 'How the audit works', '/free-audit')
             + '<section class="cv"><div class="w cv-g"><div class="cv-t"><p class="st-t">Questions.</p></div><dl>%s</dl></div></section>' % ''.join('<dt><span>%s</span></dt><dd><span>%s</span></dd>' % x for x in [
                 ('Will it annoy my customers?', 'The check-ins are short and polite, and they stop the moment someone answers.'), ('What if they want to negotiate?', 'Real price talk comes straight to you.'),
                 ('Do you take payments?', 'No. Invoices go out with your own pay link.'), ('What counts as settled?', 'A yes, a no, or paid.')])
             + CL)

CSS_CAL = r"""
/* ============ shared by later pages ============ */
.sx.dk{background:var(--dk);color:#fff;border-top:0}.sx.dk .sx-i{border-color:var(--dl);border-bottom:1px solid var(--dl)}.sx.dk .sx-t span{color:#8f9197}
.hs-v .hs-t{order:2}.hs-v .hs-p{border-left:0;border-right:1px solid var(--ln)}
.ic-x{margin-top:clamp(32px,2.8vw,52px)}
.ph-s.ms{min-height:500px;background:#fff}
/* ============ /booking ============ */
.wkc{width:100%;max-width:600px}
.wkc-g{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:16px}.wkc-g div{display:grid;gap:7px;align-content:start}
.wkc-g b{padding-bottom:4px;font:500 11px/1 "Geist Mono",monospace;color:var(--t3);text-align:center}
.wkc-g i{display:grid;align-content:center;gap:3px;height:66px;padding:0 10px;border-radius:9px;font-style:normal;font-size:12.5px;font-weight:560;box-shadow:inset 0 0 0 1px rgba(23,24,26,.09);background:repeating-linear-gradient(135deg,transparent 0 5px,rgba(23,24,26,.035) 5px 6px)}
.wkc-g i u{text-decoration:none;font:500 10.5px/1 "Geist Mono",monospace;opacity:.7}
.wkc-g i.j{background:#eceef2;box-shadow:none;color:var(--t2)}.wkc-g i.e{background:#e9eeff;box-shadow:none;color:#2a4ea8}.wkc-g i.on{background:var(--blue);color:#fff;box-shadow:0 14px 26px -14px rgba(38,109,240,.9)}
@media(min-width:1700px){.wkc,.qo,.pp{zoom:1.12}}
.rl{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-top:2px solid var(--ink)}
.rl li{position:relative;padding:clamp(22px,1.8vw,34px) clamp(14px,1.2vw,22px) 0 0}
.rl li::before{content:"";position:absolute;left:0;top:-8px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 2px var(--ink)}.rl li:last-child::before{background:var(--blue);box-shadow:none}
.rl time{font:500 12px/1 "Geist Mono",monospace;color:var(--t3)}.rl b{display:block;margin-top:10px;max-width:11em;font-size:clamp(17px,1.2vw,23px);line-height:1.16;font-weight:540;letter-spacing:-.02em}
.rl-k{margin:clamp(28px,2.4vw,44px) 0 0;font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}
/* ============ /reminders ============ */
.nt{width:min(400px,100%);padding:34px 14px 18px;border-radius:38px 38px 0 0;background:linear-gradient(180deg,#1b2440,#31457e);color:#fff;text-align:center;margin-bottom:calc(-1*clamp(48px,4.4vw,84px));box-shadow:0 0 0 9px #17181a,0 40px 80px -30px rgba(30,40,110,.6)}
.nt time{display:block;font-size:64px;font-weight:300;letter-spacing:-.04em;line-height:1}.nt>span{display:block;margin:6px 0 22px;font-size:14px;opacity:.8}
.nt div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;margin-top:8px;padding:12px 14px 13px;border-radius:16px;background:rgba(255,255,255,.16);text-align:left;backdrop-filter:blur(6px)}
.nt i{font-style:normal;font-size:12px;font-weight:600}.nt em{font-style:normal;font-size:11.5px;opacity:.7}.nt b{grid-column:1/-1;font-size:13.5px;font-weight:450;line-height:1.36}
.nt div:nth-of-type(n+2){opacity:.82}.nt p{margin:16px 0 36px;font:500 10.5px/1 "Geist Mono",monospace;opacity:.6}
.mo4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid var(--ln);border-radius:16px;overflow:hidden}
.mo4 div{padding:clamp(22px,1.8vw,34px) clamp(18px,1.5vw,28px) clamp(26px,2.1vw,40px);border-left:1px solid var(--ln);background:var(--g)}.mo4 div:first-child{border-left:0}
.mo4 em{display:block;margin-bottom:clamp(28px,2.6vw,48px);font-style:normal;font-size:clamp(30px,2.6vw,50px);font-weight:560;letter-spacing:-.045em;line-height:1}
.mo4 .y em{color:var(--blue)}.mo4 .g em{color:#1c7a43}
.mo4 b{display:block;font-size:clamp(15.5px,1vw,19px);font-weight:560;letter-spacing:-.014em}.mo4 span{display:block;margin-top:6px;font-size:clamp(14px,.86vw,16px);line-height:1.36;color:var(--g2)}
/* ============ /dispatch ============ */
.gt{width:100%;overflow:hidden;text-align:left}
.gt-x,.gt-r{display:grid;grid-template-columns:clamp(96px,9vw,150px) minmax(0,1fr);align-items:center}
.gt-x div{display:flex;justify-content:space-between;padding:12px 0 10px;font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}.gt-x i{font-style:normal;width:0;display:flex;justify-content:center;white-space:nowrap}.gt-x i:first-child{justify-content:flex-start}.gt-x i:last-child{justify-content:flex-end;padding-right:14px}
.gt-r{border-top:1px solid var(--line)}.gt-r b{padding:0 clamp(16px,1.5vw,28px);font-size:clamp(14px,.92vw,17px);font-weight:560;letter-spacing:-.01em}
.gt-r div{position:relative;height:clamp(64px,5vw,88px);border-left:1px solid var(--line);background:linear-gradient(90deg,var(--line) 1px,transparent 1px) 0 0/33.333% 100%}
.gt-r i{position:absolute;top:22%;bottom:22%;display:flex;align-items:center;padding:0 10px;border-radius:8px;background:#eceef2;font-style:normal;font-size:12.5px;font-weight:540;color:var(--t2);white-space:nowrap;overflow:hidden}
.gt-r i.l{background:#fff4d6;color:#a86a00;border-radius:8px 0 0 8px}.gt-r i.o{background:repeating-linear-gradient(135deg,#f0a000 0 4px,#f6c14d 4px 8px);border-radius:0 8px 8px 0;padding:0}
.gt-r i.m{background:#e9eeff;color:#2a4ea8;box-shadow:inset 0 0 0 1.5px rgba(38,109,240,.5)}
.gt-f{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 12px;padding:16px clamp(16px,1.5vw,28px) 17px;background:#101113;color:#8f9197;font-size:13px}.gt-f b{color:#fff;font-size:15px;font-weight:560}
.rt{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(16px,1.8vw,32px)}
.rt figure{margin:0;padding:clamp(18px,1.6vw,30px);border-radius:16px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln)}
.rt svg{display:block;width:100%;height:auto;max-height:300px}.rt path{fill:none;stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}
.rt svg.x path{stroke:#c9cbd0;stroke-dasharray:1 7}.rt svg.x circle{fill:#8a8d93}.rt svg.v path{stroke:var(--blue)}.rt svg.v circle{fill:var(--blue)}
.rt figcaption{margin-top:14px;font-size:clamp(14.5px,.92vw,17px);line-height:1.36;color:var(--g2)}.rt figcaption s{color:var(--t3)}.rt figcaption b{color:var(--ink);font-weight:560}
.rt figure:last-child{background:#f7f9ff;box-shadow:inset 0 0 0 1px #dfe6fb}
/* ============ /job-updates ============ */
.ph-h1 .hs-p{flex-direction:column}
.ms time{display:block;margin:16px 0 6px;text-align:center;font:500 10.5px/1 "Geist Mono",monospace;color:var(--t3)}
.ms p{margin:0 34px 0 12px;padding:9px 12px;border-radius:15px 15px 15px 5px;background:#f1f2f5;font-size:13px;line-height:1.36}
.ms p span{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}.ms p i{aspect-ratio:1;border-radius:8px;background:repeating-linear-gradient(135deg,#dfe2e8 0 2px,#eef0f3 2px 6px)}
.tk2-b{height:6px;border-radius:3px;background:#eceef2}.tk2-b i{display:block;width:62.5%;height:100%;border-radius:3px;background:var(--blue)}
.tk2 ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.tk2 li{position:relative;padding:clamp(24px,2vw,38px) clamp(14px,1.2vw,22px) 0 0}
.tk2 li::before{content:"";position:absolute;left:0;top:-13px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 2px #c9cbd0}
.tk2 li.on::before{background:var(--blue) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='m5.8 10.4 2.8 2.8 5.6-6' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");box-shadow:none}
.tk2 b{display:block;font-size:clamp(17px,1.2vw,23px);font-weight:540;letter-spacing:-.02em}.tk2 span{display:block;margin-top:6px;max-width:15em;font-size:clamp(14px,.86vw,16px);line-height:1.36;color:var(--g2)}
.tk2 li:not(.on) b{color:var(--t3)}
/* ============ /estimates ============ */
.es{display:grid;grid-template-columns:minmax(0,.8fr) 40px minmax(0,1fr);align-items:center;gap:10px;width:min(980px,100%);text-align:left}
.es-p{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:14px 16px 0}.es-p i{aspect-ratio:1;border-radius:9px;background:repeating-linear-gradient(135deg,#eceef2 0 2px,#f7f8fa 2px 6px)}
.es-n p{margin:0;padding:14px 16px 6px;font:400 17px/1.3 Georgia,serif;letter-spacing:-.01em}.es-n>span{display:block;padding:0 16px 16px;font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}
.es-a{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.08)}.es-a svg{width:16px;height:16px;fill:none;stroke:var(--blue);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.es-r{display:flex;justify-content:space-between;gap:16px;padding:12px 18px;border-top:1px solid var(--line);font-size:14px}.es-r:first-of-type{border-top:0}.es-r b{font-weight:540}.es-r span{color:var(--t2);white-space:nowrap}
.es-t{display:flex;justify-content:space-between;align-items:baseline;padding:14px 18px;border-top:1px solid var(--line);font-size:13px;color:var(--t2)}.es-t b{color:var(--ink);font-size:22px;font-weight:600;letter-spacing:-.03em}
.es-b{display:flex;align-items:center;gap:14px;padding:14px 18px 16px;border-radius:0 0 12px 12px;background:#f7f9ff;font-size:12.5px;color:var(--t2)}
.es-b em{display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:9px;background:var(--blue);color:#fff;font-style:normal;font-size:13.5px;font-weight:560;white-space:nowrap}
@media(min-width:1700px){.es{zoom:1.1}}
.pl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0}
.pl div{position:relative;padding:clamp(22px,1.8vw,34px) clamp(18px,1.5vw,28px) clamp(26px,2.1vw,40px);background:var(--g);box-shadow:inset 0 0 0 1px var(--ln);margin-left:-1px;clip-path:polygon(0 0,calc(100% - 18px) 0,100% 50%,calc(100% - 18px) 100%,0 100%,18px 50%)}
.pl div:first-child{clip-path:polygon(0 0,calc(100% - 18px) 0,100% 50%,calc(100% - 18px) 100%,0 100%);border-radius:14px 0 0 14px}.pl div:last-child{clip-path:polygon(0 0,100% 0,100% 100%,0 100%,18px 50%);border-radius:0 14px 14px 0}
.pl div:not(:first-child){padding-left:clamp(34px,2.6vw,46px)}
.pl .me{background:var(--ink);color:#fff;box-shadow:none}.pl .me span{color:#a3a5aa}
.pl b{display:block;font-size:clamp(16px,1.05vw,20px);font-weight:560;letter-spacing:-.014em}.pl span{display:block;margin-top:6px;max-width:15em;font-size:clamp(14px,.86vw,16px);line-height:1.36;color:var(--g2)}
/* ============ /proposals ============ */
.hs-p:has(.pp){flex-direction:column}
.pp{width:340px;padding:26px 26px 22px;border-radius:6px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.06),0 2px 3px rgba(23,24,26,.05),0 40px 70px -34px rgba(30,40,110,.55);transform:rotate(-1.5deg);text-align:left}
.pp-h{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:1px solid var(--line);font-size:12.5px}.pp-h b{font-weight:620}.pp-h span{font:500 10.5px/1 "Geist Mono",monospace;color:var(--t3)}
.pp h3{margin:18px 0 12px;font-size:21px;font-weight:600;letter-spacing:-.03em;line-height:1.1}.pp h4{margin:16px 0 8px;font-size:11.5px;font-weight:600;color:var(--t2)}
.pp-i{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.pp-i i{aspect-ratio:4/3;border-radius:6px;background:repeating-linear-gradient(135deg,#eceef2 0 2px,#f7f8fa 2px 6px)}
.pp u{display:block;height:6px;margin-top:6px;border-radius:3px;background:#eceef2}.pp u.s{width:62%}.pp u.m{width:38%}
.pp-s{display:flex;justify-content:space-between;align-items:flex-end;margin-top:22px;padding-top:14px;border-top:1px dashed #c9cbd0}
.pp-s span{font:italic 400 17px/1 Georgia,serif;color:var(--g3)}.pp-s em{display:inline-flex;align-items:center;height:32px;padding:0 14px;border-radius:8px;background:var(--blue);color:#fff;font-style:normal;font-size:12.5px;font-weight:560}
.op{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(12px,1.2vw,22px);align-items:stretch}
.op>div{position:relative;padding:clamp(22px,1.8vw,34px);border-radius:16px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln)}
.op>div.on{background:#fff;box-shadow:inset 0 0 0 2px var(--blue),0 30px 60px -34px rgba(30,40,110,.5)}
.op em{font:500 12px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3)}.op .on em{color:var(--blue)}
.op b{display:block;margin:12px 0 clamp(16px,1.4vw,26px);font-size:clamp(19px,1.4vw,26px);font-weight:560;letter-spacing:-.024em;line-height:1.12}
.op ul{list-style:none;margin:0;padding:0}.op li{padding:11px 0;border-top:1px solid var(--ln);font-size:clamp(14px,.9vw,16.5px);color:var(--g2)}
.op>div>span{position:absolute;top:clamp(18px,1.5vw,28px);right:clamp(18px,1.5vw,28px);display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:999px;background:var(--blue);color:#fff;font-size:11.5px;font-weight:560}
.op-f{display:flex;flex-wrap:wrap;gap:10px 28px;margin-top:clamp(20px,1.8vw,32px);font-size:clamp(14px,.9vw,16.5px);color:var(--g2)}.op-f span{display:flex;align-items:center;gap:9px}.op-f i{width:8px;height:8px;border-radius:50%;background:var(--blue)}
/* ============ /follow-up ============ */
.qo{width:100%;max-width:460px}
.qo-t{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:18px 18px 16px;border-bottom:1px solid var(--line);font-size:14px;color:var(--t2)}.qo-t b{color:var(--ink);font-size:30px;font-weight:600;letter-spacing:-.035em}
.qo-r{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:10px;align-items:center;padding:13px 18px;border-top:1px solid var(--line);font-size:14px}.qo-r:first-of-type{border-top:0}
.qo-r i{width:8px;height:8px;margin-left:4px;border-radius:50%;background:#c9cbd0}.qo-r b{font-weight:540}.qo-r span{font:500 11.5px/1 "Geist Mono",monospace;color:var(--t3)}
.qo-r.y{background:#f3faf5;border-radius:0 0 12px 12px}.qo-r.y i{background:#1c7a43}.qo-r.y b{color:#1c7a43;font-weight:600}
.fsc{padding:8px 0 0}.fsc-l{position:relative;height:clamp(120px,9vw,150px);margin-right:clamp(90px,8vw,130px);border-top:2px solid rgba(255,255,255,.22)}
.fsc-l div{position:absolute;top:-7px;white-space:nowrap}.fsc-l i{display:block;width:12px;height:12px;border-radius:50%;background:#fff}.fsc-l div:last-child i{background:#6d9bff}
.fsc-l b{display:block;margin-top:18px;font-size:clamp(17px,1.25vw,24px);font-weight:560;letter-spacing:-.02em}.fsc-l span{display:block;margin-top:5px;font-size:clamp(13px,.84vw,15.5px);color:#8f9197}
.fsc p{margin:clamp(20px,1.8vw,32px) 0 0;font:500 12px/1.4 "Geist Mono",monospace;color:#a9c4ff}
.oq{max-width:500px}.oq-r{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;align-items:center;padding:12px 18px 13px;border-top:1px solid var(--line)}.oq-r:first-of-type{border-top:0}
.oq-r b{font-size:14px;font-weight:560}.oq-r span{grid-column:1;font-size:12px;color:var(--t3)}
.oq-r em{grid-row:1/3;grid-column:2;display:inline-flex;align-items:center;min-height:24px;padding:2px 9px;border-radius:6px;background:#f1f2f5;color:var(--t2);font-style:normal;font-size:11.5px;font-weight:540}.oq-r em.y{background:#fff4d6;color:#a86a00}

@media(max-width:1180px){.pl{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.pl div,.pl div:first-child,.pl div:last-child{clip-path:none;border-radius:14px;margin:0;padding-left:clamp(18px,1.5vw,28px)}
.mo4{grid-template-columns:repeat(2,minmax(0,1fr))}.mo4 div:nth-child(odd){border-left:0}.mo4 div:nth-child(n+3){border-top:1px solid var(--ln)}
.es{grid-template-columns:minmax(0,1fr)}.es-a{margin:0 auto;transform:rotate(90deg)}}
@media(max-width:860px){
.hs-v .hs-t{order:0}.hs-v .hs-p{border-right:0}
.wkc-g{gap:5px;padding:12px 10px}.wkc-g i{height:56px;padding:0 5px;font-size:10.5px}.wkc-g i u{font-size:9px}
.rl{grid-template-columns:minmax(0,1fr);border-top:0;border-left:2px solid var(--ink);margin-left:6px}.rl li{padding:0 0 26px 22px}.rl li::before{left:-8px;top:0}.rl b{max-width:none;margin-top:6px}
.nt{margin-bottom:-36px}
.mo4{grid-template-columns:minmax(0,1fr)}.mo4 div{border-left:0;border-top:1px solid var(--ln)}.mo4 div:first-child{border-top:0}.mo4 em{margin-bottom:18px}
.gt-x,.gt-r{grid-template-columns:minmax(0,1fr)}.gt-x span{display:none}.gt-x div{padding:12px 12px 10px}.gt-r b{padding:12px 12px 0}.gt-r div{border-left:0;margin-top:8px;height:56px}.gt-r i{font-size:0;padding:0}
.rt{grid-template-columns:minmax(0,1fr)}
.tk2-b{display:none}.tk2 ol{grid-template-columns:minmax(0,1fr);border-left:2px solid #eceef2;margin-left:9px}.tk2 li{padding:0 0 26px 26px}.tk2 li::before{left:-11px;top:0}
.pl{grid-template-columns:minmax(0,1fr)}
.pp{width:min(320px,100%);transform:none}
.op{grid-template-columns:minmax(0,1fr)}
.fsc-l{height:auto;margin:0 0 0 6px;border-top:0;border-left:2px solid rgba(255,255,255,.22);display:grid;gap:26px}.fsc-l div{position:relative;left:auto!important;top:auto;padding-left:22px;white-space:normal}.fsc-l i{position:absolute;left:-7px;top:4px}.fsc-l b{margin-top:0}
}
"""

out = pathlib.Path(ROOT) / 'site'
CSS = CSS + CSS_DESK + CSS_CAL
(out / 'assets/light-pages.css').write_text(CSS.strip() + '\n')
V = hashlib.sha1(CSS.encode()).hexdigest()[:8]
PCSS = 'light-pages.css?v=' + V
PAGES = [
    ('everything', 'Everything we build', 'Every build Cinder makes for service businesses, in eight parts of the business. Each one is made for the business it goes into, and your free audit decides which ones you need.', EVERYTHING),
    ('websites', 'Websites', 'A website built for your business that loads fast on a phone, says what you do, and books the estimate from the page.', WEBSITES),
    ('phone-agent', 'Phone agent', 'A voice assistant answers the calls you cannot, takes the details and books the estimate. It says who it is and hands the call to you when someone asks for a person.', PHONE_AGENT),
    ('website-chat', 'Website chat', 'A chat on your website answers questions from your own information and offers a time for an estimate, including at night.', WEBSITE_CHAT),
    ('social-messages', 'Messages and DMs', 'Messages from Facebook, Instagram and your Google profile land in one inbox and get a reply in seconds.', SOCIAL),
    ('lead-vetting', 'Lead vetting', 'Every new lead is asked your questions first, so good fits are booked and poor fits get a polite no before anyone drives out.', LEAD_VETTING),
    ('after-hours', 'After hours', 'Calls and messages that come in after you close get handled, and only real emergencies ring whoever is on call.', AFTER_HOURS),
    ('booking', 'Booking', 'Serious leads pick a time for their estimate themselves, from times you are actually free, get reminded, and show up.', BOOKING),
    ('reminders', 'Reminders', 'Every appointment gets a confirmation and reminders, and a customer who cannot make it can move it without calling you.', REMINDERS),
    ('dispatch', 'Scheduling and dispatch', 'Jobs are placed on the calendar by who can do them, where they are and how long they take, and the day is rebuilt when something changes.', DISPATCH),
    ('job-updates', 'Job updates', 'Customers are told when the crew is on the way, when the job starts and when it is done, without anyone in your office sending a text.', JOB_UPDATES),
    ('estimates', 'Estimates', 'Measurements, photos and your notes become a draft estimate using your own prices. You check it and send it the same day.', ESTIMATES),
    ('proposals', 'Proposals', 'An approved estimate becomes a clean proposal with scope, photos, options and a way to say yes from a phone.', PROPOSALS),
    ('follow-up', 'Follow-up', 'Quotes and invoices get followed up on a schedule until the customer says yes, no, or paid.', FOLLOW_UP),
    ('answering', 'Answering', 'Missed calls and new leads get a text back from your business in seconds, even after hours and while you are on a job.', ANSWERING),
]
if __name__ == '__main__':
    for slug, title, desc, body in PAGES:
        (out / (slug + '.html')).write_text(page(title, desc, '/' + slug, body, css=PCSS))
    print('pages', [p[0] for p in PAGES], V)
