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

# =====================================================================================
# Money and after the job.
# =====================================================================================
STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>'
def stars(n):
    return '<div class="sr5">%s%s</div>' % (STAR * n, ('<span>%s</span>' % (STAR * (5 - n))) if n < 5 else '')
def xs(slug, i):
    return ap(X[slug][i]) if isinstance(X[slug][i], str) else X[slug][i]
def problem(slug):
    return statement('The problem', ap(X[slug][0][0]), ap(X[slug][0][1]))
def numbered(items):
    return cells([(str(i + 1), ap(t), ap(x)) for i, (t, x) in enumerate(items)], 'pg-%d pg-n' % len(items))

# ---- /invoicing : the invoice and its reminders; the three reminders getting firmer; what is outstanding by age ----
p = BY['invoicing']
INVOICE = ('<div class="cd inv">%s<div class="qo-t"><span>Gate install</span><b>$1,850</b></div><div class="inv-p"><em>Pay now</em><span>Through the payment provider you already use.</span></div>%s</div>'
           % (head('Invoice', 'Sent the day the job ended'), ''.join('<div class="qo-r %s"><i></i><b>%s</b><span>%s</span></div>' % x for x in [
               ('', 'Friendly reminder sent', 'Day 3'), ('', 'Firmer reminder sent', 'Day 10'), ('y', 'Paid', 'Day 11')])))
LADDER = ('<div class="ld">%s</div>' % ''.join('<div><em>%s</em><p>%s</p></div>' % x for x in [
    ('Day 3', 'Hi, just a reminder that the invoice for your gate install is ready. You can pay from this message.'),
    ('Day 10', 'Your invoice for the gate install is now a week past due. Here is the link to settle it.'),
    ('Day 21', 'This invoice is three weeks past due. Please pay today or reply so we can sort it out.')]) + '<p class="ld-k">They stop the moment it is paid. You can stop them for one customer in one tap.</p>')
AGING = ('<div class="cd ag">%s<div class="ag-g">%s</div><div class="pk-f"><b>$14,600</b><span>waiting to be paid, in one list.</span></div></div>' % (head('Outstanding', 'By age'), ''.join(
    '<div><b>%s</b><em>%s</em>%s</div>' % (t, a, ''.join('<i style="width:%d%%"><u>%s</u></i>' % q for q in rows)) for t, a, rows in [
        ('This week', '$4,300', [(92, 'Fence install'), (54, 'Gate repair')]), ('8 to 30 days', '$6,200', [(100, 'Vinyl fence'), (62, 'Fence install'), (30, 'Repair')]), ('Over 30 days', '$4,100', [(80, 'Chain link'), (40, 'Gate')])])))
INVOICING = (hero_split('Money', p['h1'], p['lede'], '', INVOICE)
             + problem('invoicing')
             + sx('Friendly first, firmer later.', 'And never from you personally.', LADDER, 'wh')
             + H.split('What you see', 'You get paid without being the one who asks.', 'What is outstanding, by customer and by age.', AGING)
             + bigline(p['line'])
             + faq('Questions.', xfaq(p)) + CL)

# ---- /bookkeeping : a paper receipt becoming a filed cost; what each job actually made ----
p = BY['bookkeeping']
RECEIPT = ('<div class="bkp"><div class="bkp-r"><b>Lumber yard</b><span>Tue 2:14 PM</span>%s<div><span>Total</span><b>$412.60</b></div></div><div class="es-a">%s</div>'
           '<div class="cd bk-f">%s%s<div class="bkp-t"><em>Ready for your bookkeeper</em></div></div></div>'
           % (''.join('<p><span>%s</span><span>%s</span></p>' % x for x in [('Cedar pickets, 6 ft', '$268.00'), ('Rails, 2x4x8', '$96.40'), ('Screws, exterior', '$48.20')]), ARROW, head('Filed', '2:15 PM'),
              ''.join('<div class="es-r"><span>%s</span><b>%s</b></div>' % x for x in [('Job', 'Privacy fence, Split Rail Dr'), ('Type', 'Materials'), ('Supplier', 'Lumber yard'), ('Amount', '$412.60')])))
PROFIT = ('<div class="cd jp">%s<div class="jp-r jp-h"><span>Job</span><span>Charged against costs</span><span>Made</span></div>%s</div>' % (head('Costs by job', 'This month'), ''.join(
    '<div class="jp-r"><b>%s</b><div><i style="width:%d%%"></i><u style="width:%d%%"></u></div><em class="%s">%s</em></div>' % x for x in [
        ('Privacy fence, 180 ft', 100, 61, '', '$2,480'), ('Gate install', 30, 16, '', '$860'), ('Chain link, 300 ft', 78, 71, 'y', '$410'), ('Repair', 12, 5, '', '$420')])))
BOOKKEEPING = (inner_hero('Money', ap(p['h1']), ap(p['lede']), BOOK + AUDITLINK, RECEIPT)
               + problem('bookkeeping')
               + sx('Job profit is a number.', 'Not a feeling.', PROFIT, 'wh')
               + numbered(p['does'])
               + H.split('What changes', 'You should know what a job made', 'before you price the next one like it.', swap(p['cmp']))
               + qfold(p['faq']) + CL)

# ---- /reviews : the ask going out as the job is marked done; two names in a search, and which one gets the call ----
ASK = ('<div class="rvw"><time>Job marked done, 4:10 PM</time><p>Thanks for choosing us today. Mind leaving a quick review? It takes a minute.</p><em>Leave a review</em>%s<span>Example. Sample data.</span></div>' % stars(5))
SEARCH = ('<div class="srx"><div class="q">%sfence company near me</div>%s</div>' % (svg('find'), ''.join(
    '<div class="%s"><b>%s</b>%s<span>%s</span>%s</div>' % (c, n, stars(5), r, ('<em>%s</em>' % t) if t else '') for c, n, r, t in [
        ('on', 'The shop with the reviews', '212 reviews', 'Gets the call'), ('', 'Same work, nobody asked', '9 reviews', '')])))
REVIEWS = (hero_split('After the job', 'More five-star reviews.', 'Every finished job gets asked for a review, and your name keeps showing up where people look.',
                      'Most happy customers never leave a review because nobody asked.', ASK, 'hs-v')
           + statement('The problem', 'People pick the name with the reviews.', 'Your work is good and your customers are happy. But nobody asks them, so the shop down the road with more stars gets the call.')
           + sx('The shop with the reviews gets the call.', 'Asking in person feels awkward, so it doesn&rsquo;t happen.', SEARCH, 'wh')
           + numbered([('The job gets paid', 'The moment it’s marked done, the review ask is queued.'), ('They get asked at the right time', 'A short text with a direct link, while the job is fresh.'),
                       ('Your name gets around', 'Reviews and regular posts keep you in front of people searching nearby.')])
           + qcards([('When does the ask go out?', 'Right after the job is marked done.'), ('Does every customer get asked?', 'Every finished job gets a request.'),
                     ('Where do reviews go?', 'Straight to the place you want them, usually your Google profile.')]) + CL)

# ---- /review-replies : two reviews handled two ways; the same sentence forty times against a real reply ----
p = BY['review-replies']
def review(n, text, cls, tag, reply):
    return '<div class="cd rw %s"><div class="rw-h">%s<em>%s</em></div><p>%s</p><div class="rw-r"><b>Your reply</b><p>%s</p></div></div>' % (cls, stars(n), tag, text, reply)
TWOREV = ('<div class="rw-g">%s%s</div>' % (
    review(5, '&ldquo;Crew showed up on time and the fence looks great.&rdquo;', 'g', 'Posted in 4 minutes', 'Thank you. That cedar line along the back was a fun one to build. Enjoy the yard.'),
    review(2, '&ldquo;Gate started sagging after a month.&rdquo;', 'a', 'Sent to you first', 'Draft: I&rsquo;m sorry about the gate. That should not happen in a month. I&rsquo;ll call today to set a time to fix it.')))
SAME = ('<div class="rpl"><div><h3>The same sentence under every review</h3>%s</div><div><h3>A real reply each time</h3>%s</div></div>' % (
    '<p><s>Thanks for the review.</s></p>' * 4,
    ''.join('<p>%s</p>' % t for t in ['Glad the gate is swinging right again. Thanks for having us back.', 'Thank you. Matching the old stain took a few tries and it was worth it.', 'Appreciate it. Say hello to the dog for us.'])))
REVIEW_REPLIES = (inner_hero('After the job', ap(p['h1']), ap(p['lede']), BOOK + AUDITLINK, TWOREV)
                  + problem('review-replies')
                  + sx('Replies that sound like you.', 'People read the replies as closely as the reviews.', SAME, 'wh')
                  + numbered(p['does'][1:])
                  + '<section class="cv"><div class="w cv-g"><div class="cv-t"><p class="st-t">Questions.</p></div><dl>%s</dl></div></section>' % ''.join('<dt><span>%s</span></dt><dd><span>%s</span></dd>' % (ap(q), ap(a)) for q, a in p['faq'])
                  + CL)

# ---- /win-backs : a year with a reason to write in each season; scraps turned into one clean list ----
p = BY['win-backs']
YEAR = ('<div class="cd yr">%s<div class="yr-g">%s</div></div>' % (head('Past customers', 'A year of reasons to write'), ''.join(
    '<div class="%s"><b>%s</b>%s</div>' % (('on' if t else ''), m, ('<p>%s</p>' % t) if t else '') for m, t in [
        ('Jan', ''), ('Feb', ''), ('Mar', 'Two years since the install. Time to stain.'), ('Apr', ''), ('May', 'A quote from last May that never got an answer.'), ('Jun', ''),
        ('Jul', ''), ('Aug', 'One year since the gate went in.'), ('Sep', ''), ('Oct', 'Before the ground freezes.'), ('Nov', ''), ('Dec', '')])))
CLEAN = ('<div class="cln"><div class="cln-a"><p class="a">fence job - dave?? 2023, call back</p><p class="b">719 number, wanted gate, never replied</p><p class="c">Row 41: Split Rail Dr, cedar, paid</p></div><div class="es-a">%s</div><div class="cd cln-b">%s%s</div></div>'
         % (ARROW, head('Your list', 'Cleaned up'), ''.join('<div class="oq-r"><b>%s</b><span>%s</span><em>%s</em></div>' % x for x in [
             ('Cedar fence, 2023', 'Customer, paid', 'Stain due in spring'), ('Gate quote', 'Never answered', 'One check-in'), ('Cedar fence, Split Rail Dr', 'Customer, paid', 'Anniversary of the job')])))
WIN_BACKS = (hero_left('After the job', p['h1'], p['lede'], YEAR)
             + problem('win-backs')
             + sx('Your old list, cleaned up.', 'Customers and quotes from your books, texts and spreadsheets.', CLEAN, 'wh')
             + bigline(p['line'])
             + H.split('What changes', 'People who already trust you', 'hear from you again. It stops when asked: one reply and they are off the list.', swap(p['cmp']))
             + qfold(p['faq']) + CL)

# ---- /maintenance-reminders : a job that sets its own due date; a year where repeat work fills the slow months ----
p = BY['maintenance-reminders']
DUE = ('<div class="du"><div class="cd du-j">%s<div class="du-l"><div><span>Finished</span><b>June 2025</b></div><i></i><div><span>Stain due</span><b>June 2027</b></div></div></div>'
       '<div class="du-m"><p>Your cedar fence is two years old this month, which is when it should be stained. Want us to do it?</p><div><span>Tue 9 AM</span><span class="on">Wed 2 PM</span><span>Thu 11 AM</span></div></div></div>' % head('Cedar privacy fence', 'Split Rail Dr'))
SEASON = ('<div class="cd se">%s<div class="se-g">%s</div><div class="se-k"><span><i></i>New jobs</span><span><i class="b"></i>Repeat visits</span></div></div>' % (head('A year of work', '', 'Example'), ''.join(
    '<div><div><u style="height:%d%%"></u><i style="height:%d%%"></i></div><b>%s</b></div>' % (r, n, m) for m, n, r in [
        ('J', 14, 38), ('F', 16, 36), ('M', 34, 24), ('A', 56, 12), ('M', 74, 8), ('J', 88, 4), ('J', 92, 4), ('A', 84, 6), ('S', 62, 14), ('O', 40, 26), ('N', 22, 36), ('D', 12, 40)])))
MAINT = (hero_split('After the job', p['h1'], p['lede'], '', DUE)
         + problem('maintenance-reminders')
         + sx('A steady off-season.', 'Repeat work fills the weeks new jobs do not.', SEASON, 'wh')
         + numbered(p['does'][:3])
         + bigline(p['line'])
         + faq('Questions.', xfaq(p)) + CL)

# ---- /referrals : one customer becoming a street; the ask, the pass-on, the lead and the thank-you in a row ----
p = BY['referrals']
STREET = ('<div class="stt"><div>%s</div><p>One customer, asked once, becomes a street.</p></div>' % ''.join('<i class="%s"><u>%s</u></i>' % x for x in [
    ('', ''), ('n', 'Booked in May'), ('', ''), ('on', 'Your customer'), ('n', 'Booked in April'), ('', ''), ('n', 'Estimate next week')]))
CHAINR = ('<div class="rfc">%s</div>' % ''.join('<div><em>%s</em><b>%s</b><span>%s</span>%s</div>' % x for x in [
    ('Asked at the right moment', 'They leave five stars', 'The ask goes out right after they have told you they are happy.', stars(5)),
    ('Easy to pass on', 'They forward a link', 'A link or a card they can send to a neighbor.', '<p>&ldquo;These are the fence people we used.&rdquo;</p>'),
    ('Tracked', 'The neighbor books', 'You know who sent whom. It is on the lead.', '<p class="t">Referred by your customer on Split Rail Dr</p>'),
    ('A thank-you that goes out', 'They get thanked', 'Whatever you choose to offer, sent the same day.', '<p class="g">Thank-you sent</p>')]))
REFERRALS = (inner_hero('After the job', ap(p['h1']), ap(p['lede']), BOOK + AUDITLINK, STREET)
             + problem('referrals')
             + sx('Asking happens every time,', 'at the right moment.', CHAINR, 'wh')
             + H.split('What changes', 'Most happy customers would refer you.', 'Almost none are asked.', swap(p['cmp']))
             + qcards(p['faq']) + CL)

# ---- /campaigns : a message being written to the people it fits, on a dark panel; a slow week before and after ----
p = BY['campaigns']
COMPOSE = ('<div class="fl cmp"><div class="fd-h"><span class="dot"></span><b>New message</b><span class="tag">%s</span></div><div class="cmp-t"><span>To</span><i>Had a wood fence built</i><i>Within 10 miles</i><i>2 or more years ago</i><b>64 customers</b></div>'
           '<p>We have two openings for fence staining next week. If yours is due, reply with a day that works and we&rsquo;ll hold it for you.</p><div class="rn-f"><span>Text and email. One reply to stop.</span><em>Send</em></div></div>' % SAMPLE)
def week(title, cells_, cls=''):
    return '<div class="fw %s"><h3>%s</h3><div>%s</div></div>' % (cls, title, ''.join('<i class="%s">%s</i>' % x for x in cells_))
SLOW = ('<div class="fw-g">%s%s</div>' % (
    week('Next week, before', [('j', 'Mon'), ('', 'Tue'), ('j', 'Wed'), ('', 'Thu'), ('', 'Fri')]),
    week('Next week, after one message', [('j', 'Mon'), ('n', 'Tue<u>Stain</u>'), ('j', 'Wed'), ('n', 'Thu<u>Stain</u>'), ('n', 'Fri<u>Estimate</u>')], 'v')))
CAMPAIGNS = (hero_split('After the job', p['h1'], p['lede'], '', COMPOSE, 'hs-d')
             + problem('campaigns')
             + sx('A slow week gets an offer.', 'An opening next week goes to the people most likely to take it.', SLOW, 'wh')
             + numbered([p['does'][0], p['does'][1], p['does'][3]])
             + bigline(p['line'])
             + qfold(p['faq']) + CL)

CSS_AFT = r"""
.sr5{display:flex;gap:2px}.sr5 svg{width:18px;height:18px;fill:var(--amber)}.sr5 span{display:flex;gap:2px}.sr5 span svg{fill:#dcdee3}
/* ============ /invoicing ============ */
.inv{width:100%;max-width:460px}
.inv-p{display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid var(--line);font-size:12.5px;color:var(--t2)}.inv-p em{flex:none;display:inline-flex;align-items:center;height:36px;padding:0 16px;border-radius:9px;background:var(--ink);color:#fff;font-style:normal;font-size:13.5px;font-weight:560}
.ld{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(12px,1.2vw,22px);align-items:end}
.ld div{padding:clamp(20px,1.6vw,30px);border-radius:16px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln)}.ld div:nth-child(2){padding-top:clamp(40px,3.6vw,70px);background:#fffaf0;box-shadow:inset 0 0 0 1px #f3e2b8}.ld div:nth-child(3){padding-top:clamp(60px,5.6vw,110px);background:#fff5f5;box-shadow:inset 0 0 0 1px #f6d5d6}
.ld em{font:500 12px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3)}.ld p{margin:12px 0 0;font-size:clamp(15px,1vw,19px);line-height:1.36;letter-spacing:-.01em}
.ld>.ld-k{grid-column:1/-1;margin:clamp(10px,1vw,18px) 0 0;font-size:clamp(14px,.9vw,16.5px);color:var(--g2)}
.ag{width:100%;max-width:540px}.ag-g{display:grid;gap:0}.ag-g div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;padding:14px 18px 16px;border-top:1px solid var(--line)}.ag-g div:first-child{border-top:0}
.ag-g b{font-size:13.5px;font-weight:560}.ag-g em{font-style:normal;font-size:13.5px;font-weight:600}
.ag-g i{grid-column:1/-1;display:flex;align-items:center;height:26px;padding:0 9px;border-radius:6px;background:#e9eeff;font-style:normal}.ag-g u{text-decoration:none;font-size:11.5px;font-weight:540;color:#2a4ea8;white-space:nowrap}
.ag-g div:nth-child(2) i{background:#fff4d6}.ag-g div:nth-child(2) u{color:#a86a00}.ag-g div:nth-child(3) i{background:#fdeaea}.ag-g div:nth-child(3) u{color:#c23b3f}
/* ============ /bookkeeping ============ */
.bkp{display:grid;grid-template-columns:auto 40px minmax(0,440px);align-items:center;gap:22px;text-align:left}
.bkp-r{width:250px;padding:22px 20px 26px;background:#fff;font:500 12px/1.5 "Geist Mono",monospace;color:var(--t2);transform:rotate(-3deg);box-shadow:0 30px 50px -30px rgba(30,40,110,.5);clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),95% 100%,90% calc(100% - 8px),85% 100%,80% calc(100% - 8px),75% 100%,70% calc(100% - 8px),65% 100%,60% calc(100% - 8px),55% 100%,50% calc(100% - 8px),45% 100%,40% calc(100% - 8px),35% 100%,30% calc(100% - 8px),25% 100%,20% calc(100% - 8px),15% 100%,10% calc(100% - 8px),5% 100%,0 calc(100% - 8px))}
.bkp-r>b{display:block;font:600 15px/1.2 Inter,sans-serif;color:var(--ink)}.bkp-r>span{display:block;margin-bottom:14px}.bkp-r p{display:flex;justify-content:space-between;gap:10px;margin:0;padding:5px 0;border-top:1px dashed #d6d8dd}
.bkp-r div{display:flex;justify-content:space-between;margin-top:8px;padding-top:10px;border-top:1.5px solid var(--ink);color:var(--ink)}.bkp-r div b{font-size:14px}
.bkp-f .es-r span{color:var(--t2)}.bkp-f .es-r b{white-space:normal;text-align:right}
.bkp-t{padding:14px 18px 16px;border-top:1px solid var(--line)}.bkp-t em{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:6px;background:#e7f6ec;color:#1c7a43;font-style:normal;font-size:11.5px;font-weight:560}
@media(min-width:1700px){.bkp,.rw-g,.stt{zoom:1.1}}
.jp-r{display:grid;grid-template-columns:minmax(0,.5fr) minmax(0,1fr) 84px;gap:clamp(14px,1.6vw,30px);align-items:center;padding:clamp(16px,1.3vw,24px) clamp(18px,1.6vw,30px);border-top:1px solid var(--line)}
.jp-h{padding-top:12px;padding-bottom:12px;border-top:0;font:500 11.5px/1 "Geist Mono",monospace;color:var(--t3)}
.jp-r b{font-size:clamp(15px,.95vw,18px);font-weight:560;letter-spacing:-.012em}.jp-r div{position:relative;height:16px}
.jp-r div i,.jp-r div u{position:absolute;left:0;top:0;bottom:0;border-radius:8px}.jp-r div i{background:#dfe6fb}.jp-r div u{background:var(--ink)}
.jp-r em{font-style:normal;font-size:clamp(16px,1.1vw,21px);font-weight:600;letter-spacing:-.02em;text-align:right;color:#1c7a43}.jp-r em.y{color:#a86a00;background:none;padding:0}
/* ============ /reviews ============ */
.rvw{display:grid;gap:12px;justify-items:start;width:100%;max-width:400px;padding:22px;border-radius:20px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.06),0 30px 60px -30px rgba(30,40,110,.5);text-align:left}
.rvw time,.rvw>span{font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}.rvw p{margin:0;padding:11px 14px;border-radius:16px 16px 16px 5px;background:var(--blue);color:#fff;font-size:15px;line-height:1.38}
.rvw em{display:inline-flex;align-items:center;height:38px;padding:0 16px;border-radius:10px;background:var(--ink);color:#fff;font-style:normal;font-size:13.5px;font-weight:560}.rvw .sr5 svg{width:26px;height:26px}
.srx{display:grid;gap:12px}.srx .q{display:flex;align-items:center;gap:10px;height:52px;padding:0 20px;border-radius:999px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.1);font-size:16px;color:var(--t2)}
.srx .q svg{width:18px;height:18px;fill:none;stroke:var(--t3);stroke-width:1.6;stroke-linecap:round}
.srx>div:not(.q){display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:14px;align-items:center;padding:clamp(18px,1.5vw,28px) clamp(20px,1.6vw,30px);border-radius:16px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln)}
.srx b{font-size:clamp(17px,1.2vw,22px);font-weight:560;letter-spacing:-.018em}.srx>div>span{font-size:14px;color:var(--t2);white-space:nowrap}
.srx em{display:inline-flex;align-items:center;height:28px;padding:0 11px;border-radius:999px;background:var(--blue);color:#fff;font-style:normal;font-size:12.5px;font-weight:560;white-space:nowrap}
.srx>div.on{background:#fff;box-shadow:inset 0 0 0 2px var(--blue),0 30px 60px -36px rgba(30,40,110,.5)}.srx>div:not(.on):not(.q){opacity:.7}.srx>div:not(.on) b{color:var(--t2)}
/* ============ /review-replies ============ */
.rw-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;width:min(940px,100%);text-align:left}
.rw{padding:20px}.rw-h{display:flex;justify-content:space-between;align-items:center;gap:10px}.rw-h em{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:6px;font-style:normal;font-size:11.5px;font-weight:560}
.rw.g .rw-h em{background:#e7f6ec;color:#1c7a43}.rw.a .rw-h em{background:#fff4d6;color:#a86a00}
.rw>p{margin:14px 0 16px;font:400 19px/1.3 Georgia,serif;letter-spacing:-.012em}
.rw-r{padding:14px 16px;border-radius:12px;background:#f6f7f9}.rw-r b{font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}.rw-r p{margin:8px 0 0;font-size:14px;line-height:1.42}
.rw.a .rw-r{background:#fffaf0;box-shadow:inset 0 0 0 1px #f3e2b8}
.rpl{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(20px,2.6vw,48px)}.rpl h3{margin:0 0 14px;font:500 12px/1 "Geist Mono",monospace;color:var(--t3)}
.rpl p{margin:0 0 10px;padding:14px 18px;border-radius:14px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln);font-size:clamp(15px,1vw,18.5px);line-height:1.36}.rpl s{color:var(--t3)}
.rpl div:last-child p{background:#f7f9ff;box-shadow:inset 0 0 0 1px #dfe6fb}
/* ============ /win-backs ============ */
.yr{width:100%;text-align:left;overflow:hidden}.yr-g{display:grid;grid-template-columns:repeat(12,minmax(0,1fr))}
.yr-g div{min-height:clamp(150px,12vw,210px);padding:14px 10px;border-left:1px solid var(--line)}.yr-g div:first-child{border-left:0}
.yr-g b{font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}.yr-g .on{background:#f7f9ff}.yr-g .on b{color:var(--blue)}
.yr-g p{margin:14px 0 0;padding-top:12px;border-top:2px solid var(--blue);font-size:clamp(11.5px,.8vw,14px);line-height:1.3;font-weight:520;letter-spacing:-.006em}
.cln{display:grid;grid-template-columns:minmax(0,.8fr) 40px minmax(0,1fr);gap:clamp(14px,1.6vw,28px);align-items:center}
.cln-a{display:grid;gap:12px;padding:10px}.cln-a p{margin:0;padding:14px 16px;font-size:15px;line-height:1.3;box-shadow:0 14px 28px -20px rgba(23,24,26,.5)}
.cln-a .a{background:#fff8c9;font:400 18px/1.25 Georgia,serif;font-style:italic;transform:rotate(-2deg)}.cln-a .b{background:#eceef2;border-radius:14px 14px 14px 4px;transform:rotate(1.2deg);max-width:86%}
.cln-a .c{background:#fff;font:500 12.5px/1.4 "Geist Mono",monospace;box-shadow:inset 0 0 0 1px #c9cbd0;transform:rotate(-.6deg)}
.cln-b .oq-r em{background:#e9eeff;color:#2a4ea8}
/* ============ /maintenance-reminders ============ */
.du{display:grid;gap:14px;width:100%;max-width:470px}
.du-l{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:14px;padding:22px 18px 24px}.du-l span{display:block;font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}.du-l b{display:block;margin-top:8px;font-size:21px;font-weight:600;letter-spacing:-.03em}
.du-l i{height:2px;background:repeating-linear-gradient(90deg,#9fb0dd 0 6px,transparent 6px 12px)}.du-l div:last-child b{color:var(--blue)}
.du-m{margin-left:auto;max-width:400px;padding:14px;border-radius:18px 18px 5px 18px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.06),0 24px 44px -26px rgba(30,40,110,.5)}
.du-m p{margin:0 0 12px;font-size:14px;line-height:1.4}.du-m div{display:flex;gap:6px}.du-m span{display:grid;place-items:center;height:32px;padding:0 10px;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(23,24,26,.12);font-size:12px;font-weight:520}.du-m span.on{background:var(--blue);color:#fff;box-shadow:none}
@media(min-width:1700px){.du,.inv,.rvw{zoom:1.12}}
.se-g{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:clamp(6px,.8vw,14px);padding:clamp(20px,2vw,36px) clamp(18px,1.6vw,30px) 10px}
.se-g>div>div{display:flex;flex-direction:column;justify-content:flex-end;gap:3px;height:clamp(180px,15vw,260px)}
.se-g i,.se-g u{display:block;border-radius:5px}.se-g i{background:#dcdee3}.se-g u{background:var(--blue)}
.se-g b{display:block;margin-top:10px;text-align:center;font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}
.se-k{display:flex;gap:22px;padding:10px clamp(18px,1.6vw,30px) 20px;font-size:13px;color:var(--t2)}.se-k span{display:flex;align-items:center;gap:8px}.se-k i{width:10px;height:10px;border-radius:3px;background:#dcdee3}.se-k i.b{background:var(--blue)}
/* ============ /referrals ============ */
.stt{width:min(980px,100%)}.stt div{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:clamp(8px,1.2vw,20px);align-items:end;padding:0 0 0;border-bottom:2px solid #c3cdea}
.stt i{position:relative;display:block;height:clamp(64px,7vw,104px);background:#fff;clip-path:polygon(0 38%,50% 0,100% 38%,100% 100%,0 100%);font-style:normal}
.stt i.n{background:#bcd0ff}.stt i.on{background:var(--blue);height:clamp(78px,8.4vw,124px)}
.stt u{position:absolute;left:0;right:0;bottom:10px;text-align:center;text-decoration:none;font-size:clamp(9.5px,.72vw,12px);font-weight:560;line-height:1.15;color:#1f3f8f;padding:0 4px}.stt i.on u{color:#fff}
.stt p{margin:16px 0 0;font:500 11.5px/1 "Geist Mono",monospace;color:var(--t3)}
.rfc{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:clamp(12px,1.2vw,22px)}
.rfc>div{display:flex;flex-direction:column;padding:clamp(20px,1.6vw,30px);border-radius:16px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln)}
.rfc em{font:500 11.5px/1.3 "Geist Mono",monospace;font-style:normal;color:var(--t3)}.rfc b{margin-top:12px;font-size:clamp(17px,1.2vw,23px);font-weight:560;letter-spacing:-.02em;line-height:1.14}
.rfc span{margin:8px 0 clamp(18px,1.6vw,30px);font-size:clamp(14px,.86vw,16px);line-height:1.36;color:var(--g2)}
.rfc .sr5,.rfc p{margin:auto 0 0}.rfc p{padding:10px 12px;border-radius:10px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.07);font-size:13px;line-height:1.3}
.rfc p.t{background:#e9eeff;color:#2a4ea8;box-shadow:none;font-weight:540}.rfc p.g{background:#e7f6ec;color:#1c7a43;box-shadow:none;font-weight:560}
/* ============ /campaigns ============ */
.cmp{max-width:500px}.cmp-t{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:14px 18px;border-bottom:1px solid var(--dl);font-size:12.5px;color:#8f9197}
.cmp-t i{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:999px;background:rgba(109,155,255,.16);color:#a9c4ff;font-style:normal;font-size:11.5px;font-weight:540}.cmp-t b{margin-left:auto;color:#fff;font-weight:600}
.cmp>p{margin:0;padding:18px 18px 22px;border-bottom:1px solid var(--dl);font-size:16px;line-height:1.45;color:#e4e5e7}.cmp .rn-f em{background:#fff;color:var(--ink)}
.fw-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(16px,1.8vw,32px)}
.fw{padding:clamp(20px,1.6vw,30px);border-radius:16px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln)}.fw.v{background:#f7f9ff;box-shadow:inset 0 0 0 1px #dfe6fb}
.fw h3{margin:0 0 16px;font:500 12px/1 "Geist Mono",monospace;color:var(--t3)}.fw div{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.fw i{display:grid;align-content:space-between;height:clamp(90px,8vw,130px);padding:10px;border-radius:10px;font-style:normal;font:500 11px/1 "Geist Mono",monospace;color:var(--t3);box-shadow:inset 0 0 0 1px rgba(23,24,26,.1);background:repeating-linear-gradient(135deg,transparent 0 5px,rgba(23,24,26,.035) 5px 6px)}
.fw i.j{background:#eceef2;box-shadow:none}.fw i.n{background:var(--blue);color:#cfdcff;box-shadow:none}.fw i u{text-decoration:none;font:560 13px/1.1 Inter,sans-serif;color:#fff}

@media(max-width:1180px){.rfc{grid-template-columns:repeat(2,minmax(0,1fr))}.yr-g{grid-template-columns:repeat(6,minmax(0,1fr))}.yr-g div:nth-child(7){border-left:0}.yr-g div:nth-child(n+7){border-top:1px solid var(--line)}
.bkp{grid-template-columns:minmax(0,1fr);justify-items:center}.bkp .es-a{transform:rotate(90deg)}.bkp-f{width:100%;max-width:440px}}
@media(max-width:860px){
.ld{grid-template-columns:minmax(0,1fr)}.ld div:nth-child(n){padding-top:20px}
.jp-r{grid-template-columns:minmax(0,1fr) 72px}.jp-r div{grid-column:1/-1;grid-row:2}.jp-h span:nth-child(2){display:none}
.srx>div:not(.q){grid-template-columns:minmax(0,1fr) auto}.srx .q{font-size:14px;height:46px}
.rw-g,.rpl,.fw-g{grid-template-columns:minmax(0,1fr)}
.yr-g{grid-template-columns:repeat(3,minmax(0,1fr))}.yr-g div{min-height:96px;border-top:1px solid var(--line)}.yr-g div:nth-child(3n+1){border-left:0}.yr-g div:nth-child(-n+3){border-top:0}
.cln{grid-template-columns:minmax(0,1fr)}.cln .es-a{margin:0 auto;transform:rotate(90deg)}
.se-g{gap:4px;padding:18px 12px 8px}.se-g>div>div{height:150px}
.stt u{display:none}.rfc{grid-template-columns:minmax(0,1fr)}
.fw div{gap:5px}.fw i{height:84px;padding:7px 5px}.fw i u{font-size:10.5px}
.du-l b{font-size:18px}
}
"""

# =====================================================================================
# Getting found, team and office, custom.
# =====================================================================================
# ---- /local-search : the profile as people see it; twelve weeks before and after ----
p = BY['local-search']
PROFILE = ('<div class="cd gpf"><div class="gpf-i"><i></i><i></i><i></i></div><div class="gpf-b"><b>Ridgeline Fence</b>%s<span>Fence contractor. Open now.</span>'
           '<div class="gpf-p"><em>New this week</em><p>Cedar privacy fence finished in Monument.</p></div><div class="gpf-q"><p>Do you do gate repairs?</p><p class="me">Yes. Fence and gate repairs across Monument and Colorado Springs.</p></div></div></div><p class="ph-k">Example. Sample data.</p>' % stars(5))
def weeks(marks):
    return ''.join('<i class="%s"></i>' % ('on' if m else '') for m in marks)
WEEKS = ('<div class="wst"><div><h3>A profile last updated two years ago</h3><div>%s</div></div><div class="v"><h3>A profile updated this week</h3><div>%s</div><p>Posts from real jobs, questions answered, hours and services kept right.</p></div></div>'
         % (weeks([1] + [0] * 11), weeks([1] * 12)))
LOCAL = (hero_split('Getting found', p['h1'], p['lede'], '', PROFILE, 'hs-v')
         + problem('local-search')
         + sx('A profile that is updated every week.', 'Twelve weeks, side by side.', WEEKS, 'wh')
         + numbered(p['does'])
         + bigline(p['line'])
         + faq('Questions.', xfaq(p)) + CL)

# ---- /job-photos : one photo fanning out into three posts; a gallery that is three years old against one from last week ----
p = BY['job-photos']
FAN = ('<div class="pfan"><div class="pfan-a"><i></i><span>From the crew, 4:12 PM</span></div><div class="es-a">%s</div><div class="pfan-b">%s</div></div>' % (ARROW, ''.join(
    '<div class="cd"><em>%s</em><i></i><p>%s</p></div>' % x for x in [('Google profile', 'New cedar privacy fence, finished today in Monument.'), ('Your site gallery', 'Cedar privacy fence, 180 ft. Monument.'), ('Facebook and Instagram', 'Another one done. Cedar privacy fence in Monument.')])))
GALLERY = ('<div class="gly"><div><h3>Your gallery is three years old</h3><div>%s</div></div><div class="v"><h3>Your gallery is last week</h3><div>%s</div></div></div>'
           % (''.join('<i><u>2023</u></i>' for _ in range(4)), ''.join('<i><u>%s</u></i>' % d for d in ('Mon', 'Wed', 'Thu', 'Fri'))))
JOB_PHOTOS = (inner_hero('Getting found', ap(p['h1']), ap(p['lede']), BOOK + AUDITLINK, FAN)
              + problem('job-photos')
              + sx('It posts when you finish a job.', 'Not when you remember.', GALLERY, 'wh')
              + H.split('How it runs', 'Your best marketing is work you have already done.', 'You can approve each post first, or let it run.', swap(p['cmp']))
              + qcards(p['faq']) + CL)

# ---- /hiring : seven applicants moving across a board; one applicant's answers ----
p = BY['hiring']
BOARDH = ('<div class="cd knb">%s<div class="knb-g">%s</div></div>' % (head('Applicants', 'Fence installer'), ''.join(
    '<div class="%s"><h3>%s<i>%d</i></h3>%s</div>' % (c, t, len(items), ''.join('<p>%s</p>' % q for q in items)) for c, t, items in [
        ('', 'Applied', ['Applicant 1', 'Applicant 2', 'Applicant 3', 'Applicant 4', 'Applicant 5', 'Applicant 6', 'Applicant 7']),
        ('', 'Asked your questions', ['All seven, within a minute of applying']),
        ('y', 'Fits, booked for a call', ['Applicant 2, Thu 4 PM', 'Applicant 5, Fri 7 AM']),
        ('n', 'Not a fit, told so', ['Five got a clear, polite answer'])])))
APPL = ('<div class="cd apl">%s<dl>%s</dl><p>Booked for a call Thursday at 4 PM. You talk to the ones who fit, first.</p></div>' % (head('Applicant 2', 'Applied 9:12 AM', 'A fit'), ''.join(
    '<div><dt>%s</dt><dd>%s</dd></div>' % x for x in [('Experience', '6 years, wood and vinyl'), ('Licence', 'Valid, clean record'), ('Tools', 'Own hand tools and truck'), ('Availability', 'Can start in two weeks'), ('Pay expectations', 'Inside your range')])))
HIRING = (hero_left('Team and office', p['h1'], p['lede'], BOARDH)
          + problem('hiring')
          + H.split('Your questions, asked for you', 'You call the two.', 'Not ten to find two. Everyone else hears back, including the ones who are not a fit.', APPL)
          + bigline(p['line'])
          + numbered(p['does'])
          + qfold(p['faq']) + CL)

# ---- /team-assistant : a question from the job site; your documents on a shelf, with the answer pulled from one ----
p = BY['team-assistant']
ASKS = ('<div class="tas">%s<span>Example. Sample data.</span></div>' % ''.join('<div class="%s"><p>%s</p><p class="me">%s</p><em>%s</em></div>' % x for x in [
    ('', 'What&rsquo;s the warranty on cedar posts?', 'Five years on posts and rails, two on gates.', 'From: Warranty terms, page 3'),
    ('h', 'Can we go 7 ft on a back fence in Monument?', 'I don&rsquo;t have that one. I&rsquo;ve sent it to the owner.', 'Sent to you')]))
SHELF = ('<div class="shf"><div class="shf-b">%s</div><div class="shf-a"><p>&ldquo;How do we price a double drive gate?&rdquo;</p><div><b>From your price book</b><span>Double drive gate: priced per opening, plus hardware. See the gate page for the current rates.</span></div></div></div>' % ''.join(
    '<i class="%s"><u>%s</u></i>' % x for x in [('on', 'Price book'), ('', 'Procedures'), ('', 'Warranty terms'), ('', 'Supplier list'), ('', 'Past jobs')]))
TEAM_ASSISTANT = (hero_split('Team and office', p['h1'], p['lede'], 'It says when it does not know, and sends the question to you.', ASKS)
                  + problem('team-assistant')
                  + sx('The procedures answer back.', 'Only from what you give it. It does not make up company policy.', SHELF, 'wh')
                  + bigline(p['line'])
                  + H.split('What changes', 'The crew gets answers', 'without waiting for you.', swap(p['cmp']))
                  + qfold(p['faq']) + CL)

# ---- /field-notes : a voice note becoming the job record; spoken in one language, written in another ----
p = BY['field-notes']
wave = [30, 52, 78, 44, 90, 60, 36, 72, 96, 54, 40, 66, 84, 48, 28, 58, 76, 42, 68, 88, 50, 34, 62, 80, 46, 30, 56, 70]
VOICE = ('<div class="vnt"><div class="vnt-a"><b></b><div>%s</div><time>0:58</time></div><div class="es-a">%s</div><div class="cd vnt-b">%s%s</div></div>' % (
    ''.join('<i style="height:%d%%"></i>' % h for h in wave), ARROW, head('Job record', 'Split Rail Dr'), ''.join('<div><h3>%s</h3><p>%s</p></div>' % x for x in [
        ('Notes', 'Fence line done on the north and east sides. Gate drags at the bottom and needs a rehang.'), ('Materials', 'Two posts short. One bag of concrete left over.'), ('Next steps', 'Order two posts. Come back Thursday for the gate.')])))
LANG = ('<div class="lng"><div><em>Spoken, in Spanish</em><p>&ldquo;Faltan dos postes y la puerta roza abajo. Volvemos el jueves.&rdquo;</p></div><div class="es-a">%s</div><div class="v"><em>Written, in English</em><p>Two posts short. Gate drags at the bottom. Back on Thursday.</p></div></div>' % ARROW)
FIELD_NOTES = (inner_hero('Team and office', ap(p['h1']), ap(p['lede']), BOOK + AUDITLINK, VOICE)
               + problem('field-notes')
               + sx('In English and Spanish.', 'Spoken in one, written in whichever you read.', LANG, 'wh')
               + numbered(p['does'][:3])
               + bigline(p['line'])
               + qcards(p['faq']) + CL)

# ---- /reports : the report on a phone; forty charts against the five numbers that matter ----
p = BY['reports']
REPORT_PH = ('<div class="ph"><div class="ph-s rpt"><div class="ph-n"><b>Monday report</b><span>7:00 AM</span></div>%s<p>Two things need you: a quote asking about price, and an invoice 30 days past due.</p></div></div><p class="ph-k">Example. Sample data.</p>' % ''.join(
    '<div><span>%s</span><b>%s</b></div>' % x for x in [('Leads in', '14'), ('Jobs booked', '9'), ('Quotes open', '6'), ('Money owed', '$14,600'), ('Needs you', '2')]))
FORTY = ('<div class="fty"><div>%s</div><div class="v">%s</div></div>' % (
    '<i></i>' * 40, ''.join('<p><b>%s</b>%s</p>' % x for x in [('14', 'leads in'), ('9', 'jobs booked'), ('6', 'quotes open'), ('$14,600', 'owed'), ('2', 'need you')])))
SOURCES = ('<div class="cd srcs">%s%s<div class="srcs-s"><b>What is stuck</b><p>3 quotes with no answer.</p><p>2 invoices past due.</p></div></div>' % (head('Where leads came from', 'Last week'), ''.join(
    '<div class="srcs-r"><b>%s</b><div><i style="width:%d%%"></i></div><em>%d</em></div>' % x for x in [('Google', 100, 6), ('Referrals', 67, 4), ('Facebook', 50, 3), ('Angi', 17, 1)])))
REPORTS = (hero_split('Team and office', p['h1'], p['lede'], 'Read it in two minutes.', REPORT_PH, 'ph-h1')
           + problem('reports')
           + sx('The handful that matter.', 'Not forty charts.', FORTY, 'wh')
           + H.split('What is in it', 'You see the week', 'before it becomes the month.', SOURCES)
           + bigline(p['line'])
           + faq('Questions.', xfaq(p)) + CL)

# ---- /call-review : a dark top with last week's calls, one flagged; the transcript with the moment it was lost ----
p = BY['call-review']
CALLS = ('<div class="ng crv"><div class="ng-h"><b>Last week&rsquo;s calls</b><span>%s</span></div>%s</div>' % (SAMPLE, ''.join(
    '<div class="crv-r %s"><time>%s</time><b>%s</b><span>%s</span><em>%s</em></div>' % x for x in [
        ('', 'Mon 9:14', 'New caller, privacy fence', 'Wanted a quote. Estimate booked for Wednesday.', 'Booked'),
        ('', 'Mon 2:40', 'Existing customer', 'Asked when the crew arrives. Told 1:40 PM.', 'Handled'),
        ('x', 'Tue 11:05', 'New caller, gate repair', 'Asked about financing. Was told to call back. Did not.', 'Job lost at 1:42'),
        ('', 'Wed 4:22', 'Supplier', 'Delivery moved to Friday.', 'Handled'),
        ('u', 'Thu 8:30', 'Existing customer', 'Unhappy about a late start on Tuesday.', 'Flagged for you')])))
TRANS = ('<div class="cd trx">%s%s</div>' % (head('Tue 11:05, gate repair', '3 min 10 sec'), ''.join('<p class="%s"><time>%s</time><i>%s</i><span>%s</span></p>' % x for x in [
    ('', '1:20', 'Caller', 'How much would it be to fix a sagging gate?'), ('', '1:28', 'Office', 'It depends, somebody would have to come look at it.'),
    ('x', '1:42', 'Caller', 'Do you do financing or payment plans?'), ('x', '1:47', 'Office', 'I&rsquo;m not sure, you&rsquo;d have to call back and ask the owner.'), ('', '1:55', 'Caller', 'Okay. I&rsquo;ll think about it.')])))
PATTERN = ('<div class="cd ptn">%s<p><b>&ldquo;Do you do financing?&rdquo;</b>Asked on 11 calls this month. 7 of those callers did not book.</p></div>' % head('A pattern', 'This month'))
CALL_REVIEW = (hero_dark('Team and office', p['h1'], p['lede'], CALLS)
               + problem('call-review')
               + sx(X['call-review'][2], '', TRANS, 'wh')
               + H.split('Across a month', 'You fix the pattern,', 'not just the call. The question that keeps costing you work.', PATTERN)
               + numbered([p['does'][0], p['does'][1], p['does'][3]])
               + qfold(p['faq']) + CL)

# ---- /custom-agents : an agent's log on a dark panel, stopped where it needs you; what it may do and what it asks first ----
p = BY['custom-agents']
LOG = ('<div class="fl">%s%s<div class="rn-f"><span>Stopped at the step you marked for approval.</span><em>Waiting for you</em></div></div>' % (
    '<div class="fd-h"><span class="dot"></span><b>Materials order</b><span>Split Rail Dr</span><span class="tag">%s</span></div>' % SAMPLE,
    frows([('7:02', 'Read the job record', '180 ft of cedar privacy, two gates.'), ('7:02', 'Checked the supplier price list', 'Three items changed price since last order.'),
           ('7:03', 'Wrote the order', 'Pickets, rails, posts, concrete, two gate kits.'), ('7:03', 'Asked before sending', 'Orders over your limit need a yes from you.')])))
LIMITS = ('<div class="lmt"><div><h3>Does on its own</h3>%s</div><div class="a"><h3>Asks you first</h3>%s</div></div>' % (
    ''.join('<p>%s</p>' % t for t in ['Reads and writes', 'Looks things up', 'Fills in forms', 'Uses the tools you connect']), ''.join('<p>%s</p>' % t for t in ['Spending money', 'Sending anything you have marked for approval'])))
CUSTOM_AGENTS = (hero_split('Custom', p['h1'], p['lede'], '', LOG, 'hs-d')
                 + problem('custom-agents')
                 + sx(X['custom-agents'][2], 'Every step is logged in your app.', LIMITS, 'wh')
                 + bigline(p['line'])
                 + H.split('What changes', 'It runs.', 'You check what it did.', swap(p['cmp']))
                 + qcards(p['faq']) + CL)

# ---- /integrations : the tools around one inbox; one lead passing through four of them ----
HUB = ('<div class="hub">%s</div>' % ''.join('<div class="%s">%s</div>' % x for x in [
    ('', 'Google Calendar'), ('', 'Jobber'), ('', 'QuickBooks Online'), ('', 'Your website form'), ('me', '<b>One inbox</b><span>One thread per customer</span>'), ('', 'Angi, Thumbtack, Google and Yelp'),
    ('', 'Missed calls'), ('', 'Your own pay link'), ('', 'Zapier and Make')]))
def group(title, sub, items):
    return ('<section class="itg"><div class="w itg-g"><div class="itg-t"><p class="st-t">%s <span>%s</span></p></div><dl>%s</dl></div></section>' % (title, sub, ''.join('<div><dt>%s</dt><dd>%s</dd></div>' % (ap(a), ap(b)) for a, b in items)))
PASS = ('<ol class="rl rl4">%s</ol>' % ''.join('<li><time>%s</time><b>%s</b></li>' % x for x in [
    ('A call, a text, your website form, Angi, Thumbtack or a Google ad', 'It comes in from anywhere'), ('Answered in seconds, one thread per customer', 'It lands in one inbox'),
    ('Google Calendar, and Jobber if you use it', 'The estimate goes on your calendar'), ('Invoices and payments land in QuickBooks, on the right customer', 'The money shows up in your books')]))
INTEGRATIONS = (inner_hero('Custom', 'Keep the tools you already use.', 'Cinder plugs into your calendar, your books and the places your leads come from, so nothing gets copied over by hand.', BOOK + AUDITLINK, HUB)
                + sx('One lead, start to finish.', 'Nothing gets copied over by hand.', PASS, 'wh')
                + group('Connected both ways.', 'You approve it once. After that, everything lands where it belongs.', [
                    ('Google Calendar', 'Leads only see times you’re actually free, and every booked estimate lands on your calendar with the address and the job.'),
                    ('Jobber', 'Every estimate we book shows up in Jobber as a request on that customer’s record. Nobody retypes a booking.'),
                    ('QuickBooks Online', 'Every invoice you send and every payment you record lands in your books, on the right customer.')])
                + group('Every lead source, one inbox.', 'Wherever a lead comes from, it gets a reply in seconds and shows up in the same place.', [
                    ('Your website form', 'WordPress, Wix, Squarespace, Webflow, Google Forms and the rest. Form fills come straight in.'),
                    ('Angi, Thumbtack, Google and Yelp', 'Forward the lead emails once. Each lead is read, saved and answered for you.'),
                    ('Google Ads lead forms', 'Ad leads go straight to the inbox instead of sitting in a spreadsheet.'),
                    ('Missed calls', 'A missed call on your business number gets a text back right away, from that same number.'),
                    ('Zapier and Make', 'Anything else you use can send leads in too.')])
                + group('Get paid your way.', 'We never hold your money.', [('Your own pay link', 'Square, Stripe, PayPal or your own site. Invoices and deposits go out with the link you already use.')])
                + group('Moving over is the easy part.', 'Bring your customers, jobs and history with you. Duplicates are merged, and every merge is shown so you can undo it.', [
                    ('Jobber and QuickBooks', 'Pulled in directly, photos included.'), ('Housecall Pro and ServiceTitan', 'From their standard exports.'),
                    ('Any spreadsheet', 'Customers, payments and service plans.'), ('Your phone’s contacts', 'Customers without an email still come in.')])
                + qcards([('Do I have to stop using Jobber?', 'No. Cinder can run beside it or replace it. The audit shows which makes sense for you.'), ('Who connects everything?', 'We do, during setup. You approve each connection once.'),
                          ('Don’t see a tool you use?', 'Ask on your audit call. If it can send an email or a form, it can almost always send leads in.')]) + CL)

# ---- /custom-builds : a blank scope sheet being filled in; the four steps from audit to running ----
p = BY['custom-builds']
SCOPE = ('<div class="scp"><div class="scp-a"><span>Tell us the job</span><p>&ldquo;Every Friday I spend three hours matching supplier bills to jobs.&rdquo;</p></div><div class="cd scp-b">%s%s</div></div>' % (head('Scope', 'Written with you', 'Example'), ''.join(
    '<div><h3>%s</h3><p>%s</p></div>' % x for x in [('What it does', 'Reads each supplier bill and files it against the right job.'), ('What it will not do', 'Pay anything. Anything unclear comes to you.'), ('What you get', 'A timeline and a cost, before anything is built.')])))
CUSTOM_BUILDS = (hero_left('Custom', p['h1'], p['lede'], SCOPE)
                 + problem('custom-builds')
                 + numbered(p['does'])
                 + fq('We&rsquo;re trying to take apart your business, find what needs to be fixed, and then implement systems that fix it.')
                 + H.split('What changes', 'The list on this site is where we started,', 'not where we stop.', swap(p['cmp']))
                 + qfold(p['faq']) + CL)

CSS_TEAM = r"""
/* ============ /local-search ============ */
.hs-p:has(.gpf){flex-direction:column}
.gpf{width:100%;max-width:420px;overflow:hidden;text-align:left}.gpf-i{display:grid;grid-template-columns:2fr 1fr 1fr;gap:3px;height:120px}.gpf-i i{background:repeating-linear-gradient(135deg,#e4e7ee 0 2px,#f1f3f7 2px 6px)}
.gpf-b{display:grid;gap:8px;padding:18px}.gpf-b>b{font-size:21px;font-weight:600;letter-spacing:-.03em}.gpf-b>span{font-size:13px;color:var(--t2)}
.gpf-p{margin-top:6px;padding:12px 14px;border-radius:12px;background:#f7f9ff;box-shadow:inset 0 0 0 1px #dfe6fb}.gpf-p em{font:500 11px/1 "Geist Mono",monospace;font-style:normal;color:var(--blue)}.gpf-p p{margin:6px 0 0;font-size:13.5px;font-weight:520}
.gpf-q{display:grid;gap:6px;font-size:13px;line-height:1.36}.gpf-q p{margin:0;width:fit-content;max-width:88%;padding:8px 12px;border-radius:13px 13px 13px 4px;background:#f1f2f5}.gpf-q p.me{margin-left:auto;border-radius:13px 13px 4px 13px;background:var(--blue);color:#fff}
@media(min-width:1700px){.gpf,.tas,.pfan,.vnt,.hub,.knb{zoom:1.1}}
.wst{display:grid;gap:clamp(12px,1.2vw,22px)}.wst>div{padding:clamp(20px,1.6vw,30px);border-radius:16px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln)}.wst>.v{background:#f7f9ff;box-shadow:inset 0 0 0 1px #dfe6fb}
.wst h3,.gly h3{margin:0 0 16px;font:500 12px/1 "Geist Mono",monospace;color:var(--t3)}.wst>div>div{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:clamp(4px,.6vw,10px)}
.wst i{height:clamp(40px,4.4vw,72px);border-radius:8px;box-shadow:inset 0 0 0 1px rgba(23,24,26,.1);background:repeating-linear-gradient(135deg,transparent 0 5px,rgba(23,24,26,.035) 5px 6px)}.wst i.on{background:#c9cbd0;box-shadow:none}.wst .v i.on{background:var(--blue)}
.wst p{margin:16px 0 0;font-size:clamp(14.5px,.92vw,17px);color:var(--g2)}
/* ============ /job-photos ============ */
.pfan{display:grid;grid-template-columns:auto 40px minmax(0,1fr);align-items:center;gap:20px;width:min(980px,100%);text-align:left}
.pfan-a{width:230px;padding:10px 10px 14px;background:#fff;box-shadow:0 30px 50px -28px rgba(30,40,110,.5);transform:rotate(-3deg)}.pfan-a i,.pfan-b i{display:block;aspect-ratio:4/3;background:repeating-linear-gradient(135deg,#dfe3ec 0 2px,#eef1f6 2px 7px)}
.pfan-a span{display:block;margin-top:10px;font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}
.pfan-b{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.pfan-b>div{padding:12px;overflow:hidden}.pfan-b em{display:block;margin-bottom:10px;font:500 11px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3)}
.pfan-b i{border-radius:8px}.pfan-b p{margin:10px 0 2px;font-size:13px;line-height:1.36;font-weight:500}
.gly{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(16px,1.8vw,32px)}.gly>div{padding:clamp(20px,1.6vw,30px);border-radius:16px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln)}
.gly>div>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.gly i{position:relative;aspect-ratio:1;border-radius:10px;background:repeating-linear-gradient(135deg,#e4e6ea 0 2px,#f1f2f4 2px 7px);filter:grayscale(1)}
.gly u{position:absolute;left:8px;bottom:8px;padding:3px 6px;border-radius:5px;background:rgba(255,255,255,.9);text-decoration:none;font:500 10.5px/1 "Geist Mono",monospace;color:var(--t2)}
.gly .v{background:#f7f9ff;box-shadow:inset 0 0 0 1px #dfe6fb}.gly .v i{filter:none;background:repeating-linear-gradient(135deg,#cfdcff 0 2px,#e6ecff 2px 7px)}.gly .v u{color:var(--blue)}
/* ============ /hiring ============ */
.knb{width:100%;text-align:left;overflow:hidden}.knb-g{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;padding:14px;align-items:start}
.knb-g>div{padding:12px;border-radius:12px;background:#f6f7f9;display:grid;gap:6px}.knb h3{display:flex;justify-content:space-between;margin:0 0 6px;font-size:12.5px;font-weight:600}.knb h3 i{font:500 11px/1.4 "Geist Mono",monospace;font-style:normal;color:var(--t3)}
.knb p{margin:0;padding:9px 11px;border-radius:8px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.06);font-size:12.5px;font-weight:520;line-height:1.3}
.knb .y{background:#eef3ff}.knb .y p{background:var(--blue);color:#fff;box-shadow:none}.knb .n p{color:var(--t2)}
.apl{width:100%;max-width:500px}.apl dl{margin:0;padding:6px 18px}.apl dl div{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1fr);gap:12px;padding:12px 0;border-top:1px solid var(--line);font-size:14px}.apl dl div:first-child{border-top:0}
.apl dt{color:var(--t2)}.apl dd{margin:0;font-weight:540}.apl>p{margin:0;padding:15px 18px 17px;border-radius:0 0 12px 12px;background:#f7f9ff;font-size:13.5px;line-height:1.4}.apl .tag{color:var(--blue)}
/* ============ /team-assistant ============ */
.tas{display:grid;gap:12px;width:100%;max-width:470px}.tas>span{font:500 11px/1 "Geist Mono",monospace;color:var(--t3);text-align:center;margin-top:6px}
.tas>div{display:grid;gap:8px;padding:16px 16px 14px;border-radius:16px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.06),0 24px 44px -28px rgba(30,40,110,.5);font-size:14.5px;line-height:1.38}
.tas p{margin:0;width:fit-content;max-width:86%;padding:9px 13px;border-radius:14px 14px 14px 5px;background:#eceef2}.tas p.me{margin-left:auto;border-radius:14px 14px 5px 14px;background:var(--blue);color:#fff}
.tas em{justify-self:end;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;background:#e9eeff;color:#2a4ea8;font-style:normal;font-size:11.5px;font-weight:560}.tas .h p.me{background:var(--ink)}.tas .h em{background:#fff4d6;color:#a86a00}
.shf{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(24px,3.4vw,64px);align-items:end}
.shf-b{display:flex;align-items:flex-end;gap:8px;height:clamp(220px,19vw,320px);padding:0 14px;border-bottom:6px solid #d9dce3}
.shf-b i{flex:1;display:flex;align-items:flex-end;justify-content:center;border-radius:6px 6px 0 0;background:#e4e6eb;height:82%}.shf-b i:nth-child(2){height:96%;background:#d6d9e0}.shf-b i:nth-child(3){height:70%}.shf-b i:nth-child(4){height:88%;background:#d6d9e0}.shf-b i:nth-child(5){height:76%}
.shf-b i.on{background:var(--blue);height:100%;transform:translateY(-14px)}.shf-b u{writing-mode:vertical-rl;transform:rotate(180deg);padding:16px 0;text-decoration:none;font-style:normal;font-size:clamp(12px,.9vw,15px);font-weight:560;color:var(--t2);white-space:nowrap}.shf-b i.on u{color:#fff}
.shf-a p{margin:0 0 14px;font:400 clamp(21px,1.7vw,32px)/1.2 Georgia,serif;letter-spacing:-.014em}.shf-a div{padding:clamp(16px,1.4vw,26px);border-radius:14px;background:#f7f9ff;box-shadow:inset 0 0 0 1px #dfe6fb}
.shf-a b{display:block;font:500 12px/1 "Geist Mono",monospace;color:var(--blue)}.shf-a span{display:block;margin-top:10px;font-size:clamp(15px,1vw,18.5px);line-height:1.4}
/* ============ /field-notes ============ */
.vnt{display:grid;grid-template-columns:minmax(0,.8fr) 40px minmax(0,1fr);gap:18px;align-items:center;width:min(980px,100%);text-align:left}
.vnt-a{display:flex;align-items:center;gap:12px;height:72px;padding:0 18px;border-radius:999px;background:#17181a}.vnt-a b{flex:none;width:36px;height:36px;border-radius:50%;background:var(--red);box-shadow:0 0 0 5px rgba(229,72,77,.25)}
.vnt-a div{flex:1;display:flex;align-items:center;gap:3px;height:40px}.vnt-a i{flex:1;border-radius:2px;background:#fff;opacity:.85}.vnt-a time{font:500 12px/1 "Geist Mono",monospace;color:#a3a5aa}
.vnt-b>div:not(.rep-h){padding:14px 18px;border-top:1px solid var(--line)}.vnt-b>div:nth-child(2){border-top:0}.vnt-b h3{margin:0 0 6px;font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}.vnt-b p{margin:0;font-size:14px;line-height:1.42}
.lng{display:grid;grid-template-columns:minmax(0,1fr) 40px minmax(0,1fr);gap:clamp(14px,1.6vw,28px);align-items:center}
.lng>div:not(.es-a){padding:clamp(22px,1.8vw,34px);border-radius:16px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln)}.lng>.v{background:#f7f9ff!important;box-shadow:inset 0 0 0 1px #dfe6fb!important}
.lng em{font:500 12px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3)}.lng p{margin:14px 0 0;font:400 clamp(21px,1.7vw,32px)/1.22 Georgia,serif;letter-spacing:-.014em}.lng .v p{font:500 clamp(19px,1.5vw,28px)/1.2 Inter,sans-serif;letter-spacing:-.024em}
/* ============ /reports ============ */
.rpt>div:not(.ph-n){display:flex;justify-content:space-between;align-items:baseline;margin:0 16px;padding:13px 0;border-bottom:1px solid var(--line);font-size:12.5px;color:var(--t2)}.rpt>div b{font-size:22px;font-weight:600;letter-spacing:-.035em;color:var(--ink)}
.rpt>p{margin:14px 16px 0;padding:11px 12px;border-radius:10px;background:#fff4d6;color:#7a4d00;font-size:12px;line-height:1.36}
.fty{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(20px,2.6vw,48px);align-items:center}
.fty>div:first-child{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px;opacity:.75}.fty i{aspect-ratio:4/3;border-radius:6px;background:linear-gradient(180deg,transparent 55%,#dcdee3 55%) ,#f1f2f5;box-shadow:inset 0 0 0 1px rgba(23,24,26,.06)}
.fty i:nth-child(3n){background:linear-gradient(180deg,transparent 30%,#dcdee3 30%),#f1f2f5}.fty i:nth-child(4n+1){background:linear-gradient(180deg,transparent 70%,#dcdee3 70%),#f1f2f5}
.fty .v{display:grid;gap:0}.fty p{display:flex;align-items:baseline;gap:14px;margin:0;padding:clamp(10px,.9vw,16px) 0;border-top:1px solid var(--ln);font-size:clamp(15px,1vw,19px);color:var(--g2)}.fty p:first-child{border-top:0}
.fty p b{min-width:3.4em;font-size:clamp(28px,2.5vw,48px);font-weight:560;letter-spacing:-.045em;line-height:1;color:var(--ink)}
.srcs{width:100%;max-width:520px}.srcs-r{display:grid;grid-template-columns:90px minmax(0,1fr) 24px;gap:12px;align-items:center;padding:12px 18px;border-top:1px solid var(--line);font-size:13.5px}.srcs-r:first-of-type{border-top:0}
.srcs-r b{font-weight:540}.srcs-r div{height:12px;border-radius:6px;background:#f1f2f5}.srcs-r i{display:block;height:100%;border-radius:6px;background:var(--blue)}.srcs-r em{font-style:normal;font-weight:600;text-align:right}
.srcs-s{padding:14px 18px 16px;border-top:1px solid var(--line);background:#fffaf0;border-radius:0 0 12px 12px}.srcs-s b{font:500 11px/1 "Geist Mono",monospace;color:#a86a00}.srcs-s p{margin:8px 0 0;font-size:13.5px}
/* ============ /call-review ============ */
.crv-r{display:grid;grid-template-columns:86px minmax(0,.7fr) minmax(0,1.3fr) auto;gap:14px;align-items:center;padding:clamp(13px,1.1vw,19px) 18px;border-top:1px solid var(--dl);font-size:14px}.crv-r:nth-child(2){border-top:0}
.crv-r time{font:500 11.5px/1 "Geist Mono",monospace;color:#7f8187}.crv-r b{font-weight:560;color:#fff}.crv-r span{color:#a3a5aa}
.crv-r em{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:6px;background:rgba(255,255,255,.08);color:#b9bbc0;font-style:normal;font-size:11.5px;font-weight:540;white-space:nowrap}
.crv-r.x{background:rgba(229,72,77,.1)}.crv-r.x em{background:var(--red);color:#fff}.crv-r.u em{background:var(--amber);color:#3d2a00}
.trx p{display:grid;grid-template-columns:44px 64px minmax(0,1fr);gap:12px;margin:0;padding:clamp(13px,1.1vw,19px) clamp(18px,1.6vw,30px);border-top:1px solid var(--line);font-size:clamp(15px,1vw,18.5px);line-height:1.38}.trx p:first-of-type{border-top:0}
.trx time,.trx i{font:500 11.5px/1.7 "Geist Mono",monospace;font-style:normal;color:var(--t3)}.trx p.x{background:#fff5f5;box-shadow:inset 3px 0 0 var(--red)}.trx p.x time{color:var(--red)}
.ptn{width:100%;max-width:480px}.ptn p{margin:0;padding:18px;font-size:14.5px;line-height:1.45;color:var(--g2)}.ptn p b{display:block;margin-bottom:10px;font:400 24px/1.2 Georgia,serif;color:var(--ink)}
/* ============ /custom-agents ============ */
.lmt{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,.7fr);gap:0;border-radius:18px;overflow:hidden;box-shadow:inset 0 0 0 1px var(--ln)}
.lmt>div{padding:clamp(24px,2.2vw,42px);background:#f7f9ff}.lmt>.a{background:#fffaf0;border-left:2px dashed #e7c877}
.lmt h3{margin:0 0 18px;font:500 12px/1 "Geist Mono",monospace;color:var(--t3)}.lmt p{display:inline-flex;margin:0 8px 8px 0;padding:10px 14px;border-radius:999px;background:#fff;box-shadow:0 0 0 1px rgba(38,109,240,.25);font-size:clamp(15px,1vw,18.5px);font-weight:520;letter-spacing:-.01em}
.lmt .a p{box-shadow:0 0 0 1px #e7c877;color:#7a4d00}
/* ============ /integrations ============ */
.hub{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;width:min(820px,100%)}
.hub div{display:grid;place-items:center;min-height:84px;padding:12px 14px;border-radius:14px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.06),0 18px 34px -24px rgba(30,40,110,.4);font-size:14.5px;font-weight:560;letter-spacing:-.01em;text-align:center;line-height:1.25}
.hub .me{background:var(--ink);color:#fff;box-shadow:0 0 0 6px rgba(38,109,240,.18),0 30px 50px -24px rgba(30,40,110,.6)}.hub .me b{font-size:18px;font-weight:600}.hub .me span{font-size:12px;color:#a3a5aa;font-weight:450}
.rl4{grid-template-columns:repeat(4,minmax(0,1fr))}.rl4 time{display:block;font:450 clamp(14px,.86vw,16px)/1.36 Inter,sans-serif;color:var(--g2);max-width:17em}.rl4 li{display:flex;flex-direction:column-reverse;justify-content:flex-end;gap:8px}.rl4 b{margin-top:0}
.itg{border-top:1px solid var(--ln)}.itg-g{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.itg-t{padding:clamp(64px,5.4vw,104px) var(--pad)}.itg-t .st-t{margin:0;max-width:13em;font-size:clamp(25px,1.8vw,34px)}
.itg dl{margin:0;padding:clamp(48px,4vw,76px) var(--pad);border-left:1px solid var(--ln);background:#fff}.itg dl div{padding:clamp(14px,1.2vw,22px) 0;border-top:1px solid var(--ln)}.itg dl div:first-child{border-top:0}
.itg dt{font-size:clamp(16px,1.05vw,20px);font-weight:560;letter-spacing:-.014em}.itg dd{margin:5px 0 0;max-width:36em;font-size:clamp(14.5px,.9vw,16.5px);line-height:1.42;color:var(--g2)}
/* ============ /custom-builds ============ */
.scp{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(16px,2vw,36px);align-items:center;width:100%;text-align:left}
.scp-a{padding:clamp(22px,2vw,38px);border-radius:16px;border:1.5px dashed rgba(38,109,240,.5);background:rgba(255,255,255,.5)}.scp-a span{font:500 12px/1 "Geist Mono",monospace;color:var(--blue)}
.scp-a p{margin:14px 0 0;font:400 clamp(21px,1.8vw,34px)/1.2 Georgia,serif;letter-spacing:-.014em}
.scp-b>div:not(.rep-h){padding:16px 18px;border-top:1px solid var(--line)}.scp-b>div:nth-child(2){border-top:0}.scp-b h3{margin:0 0 6px;font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}.scp-b p{margin:0;font-size:clamp(14.5px,.95vw,17px);line-height:1.4}

@media(max-width:1180px){.knb-g{grid-template-columns:1fr 1fr}.pfan{grid-template-columns:minmax(0,1fr);justify-items:center}.pfan .es-a,.vnt .es-a{transform:rotate(90deg);margin:0 auto}.vnt{grid-template-columns:minmax(0,1fr)}
.crv-r{grid-template-columns:86px minmax(0,1fr) auto}.crv-r span{grid-column:2/-1;grid-row:2}}
@media(max-width:860px){
.wst>div>div{grid-template-columns:repeat(6,minmax(0,1fr))}
.pfan-b{grid-template-columns:minmax(0,1fr);width:100%}.gly,.shf,.fty,.lng,.lmt,.scp{grid-template-columns:minmax(0,1fr)}.lng .es-a{transform:rotate(90deg);margin:0 auto}
.knb-g{grid-template-columns:minmax(0,1fr)}
.shf-b{height:200px}.lmt>.a{border-left:0;border-top:2px dashed #e7c877}
.fty>div:first-child{grid-template-columns:repeat(10,minmax(0,1fr));gap:4px}
.crv-r{grid-template-columns:minmax(0,1fr) auto;gap:6px 10px}.crv-r time{grid-column:1/-1}.crv-r span{grid-column:1/-1;grid-row:auto}
.trx p{grid-template-columns:40px minmax(0,1fr)}.trx i{display:none}
.hub{gap:8px}.hub div{min-height:70px;font-size:12px;padding:8px}.hub .me b{font-size:14px}
.rl4 li{flex-direction:column}
.itg-g{grid-template-columns:minmax(0,1fr)}.itg-t{padding:56px var(--pad) 8px}.itg dl{border-left:0;background:none;padding:16px var(--pad) 48px}
}
"""

# =====================================================================================
# The rest of the site. Text for the legal pages, the questions and the site check is read from design/mock/legacy (the old pages, saved before they were replaced), so nothing is retyped.
# =====================================================================================
LEG = pathlib.Path(ROOT) / 'design/mock/legacy'
def legacy(name):
    t = (LEG / (name + '.html')).read_text()
    return t[t.index('<main'):t.index('</main>')]
def slug(t):
    return re.sub(r'[^a-z0-9]+', '-', re.sub(r'<[^>]+>|&[a-z]+;', '', t).lower()).strip('-')

# ---- /privacy and /terms : the text exactly as it was, with a contents list beside it ----
def legal(name):
    m = legacy(name); art = m[m.index('<article'):m.index('</article>')]; art = art[art.index('>') + 1:]
    title = re.search(r'<h1>(.*?)</h1>', art).group(1); date = re.search(r'<p class="legal-date">(.*?)</p>', art).group(1)
    body = re.sub(r'<h1>.*?</h1>|<p class="legal-date">.*?</p>', '', art)
    heads = re.findall(r'<h2>(.*?)</h2>', body)
    body = re.sub(r'<h2>(.*?)</h2>', lambda k: '<h2 id="%s">%s</h2>' % (slug(k.group(1)), k.group(1)), body)
    return ('<section class="lgl"><div class="w lgl-g"><aside><span class="lb">%s</span><h1>%s</h1><ol>%s</ol></aside><article>%s</article></div></section>'
            % (date, title, ''.join('<li><a href="#%s">%s</a></li>' % (slug(h), h) for h in heads), body)) + CL

# ---- /questions : every question, grouped, with the group list following you down the page ----
qm = legacy('questions')
QGROUPS = [(h, re.findall(r'<summary>(.*?)</summary><p>(.*?)</p>', blk, re.S)) for h, blk in re.findall(r'<section class="faq"><div class="wrap"><h2[^>]*>(.*?)</h2><div>(.*?)</div></div></section>', qm, re.S)]
assert sum(len(q) for _, q in QGROUPS) >= 50, [(h, len(q)) for h, q in QGROUPS]
QUESTIONS = ('<section class="ih ih-l qh"><div class="w ih-i"><span class="lb">Questions</span><h1>Straight answers.</h1><p class="sub">%d questions owners ask before they book, answered plainly. If yours is not here, ask it on the call.</p><div class="cta">%s</div></div></section>'
             % (sum(len(q) for _, q in QGROUPS), BOOK)
             + '<section class="lk qs"><div class="w lk-g"><aside class="lk-n"><ul>%s</ul></aside><div class="lk-m">%s</div></div></section>' % (
                 ''.join('<li%s><a href="#q-%d">%s</a></li>' % (' class="on"' if i == 0 else '', i + 1, h.rstrip('.')) for i, (h, _) in enumerate(QGROUPS)),
                 ''.join('<article class="lk-b" id="q-%d"><h2>%s</h2>%s</article>' % (i + 1, h, ''.join('<details><summary>%s<i></i></summary><p>%s</p></details>' % qa for qa in qs)) for i, (h, qs) in enumerate(QGROUPS)))
             + CL)

# ---- /404 ----
NOTFOUND = ('<section class="nf"><div class="w nf-i"><b>404</b><h1>This page doesn&rsquo;t exist.</h1><p class="sub">The link may be old or mistyped. Everything else is one click away.</p></div></section>'
            '<section class="rl2"><div class="w rl2-g">%s</div></section>' % ''.join('<a href="%s"><b>%s</b><span>%s</span>%s</a>' % (h, t, x, ARROW) for h, t, x in [
                ('/', 'Home', 'Start from the top.'), ('/everything', 'Everything we build', 'All thirty-two builds on one page.'), ('/free-audit', 'The free audit', 'What we check and what you keep.'), ('/questions', 'Questions', 'The answers owners ask for first.')])
            + CL)

# ---- /audit : the site check itself. The form and the result keep the ids and names audit.js uses ----
am = legacy('audit')
AFORM = am[am.index('<form'):am.index('</form>') + 7]
AOUT = am[am.index('<div class="aud-out"'):am.index('</section>', am.index('<div class="aud-out"'))]
AOUT = AOUT[:AOUT.rindex('</div>')]
assert 'id="aud-form"' in AFORM and 'id="aud-res"' in AOUT and AOUT.count('<div') == AOUT.count('</div>'), (AOUT.count('<div'), AOUT.count('</div>'))
CHECKPAGE = ('<section class="ac2"><div class="w ac2-g"><div class="ac2-t"><span class="lb">Check your site</span><h1>Where are you losing jobs?</h1>'
             '<p class="sub">We load your website the way a homeowner does, check what they run into, and work out what slow replies likely cost you each month from your own numbers. About 20 seconds.</p>%s</div><div class="ac2-p">%s</div></div></section>' % (AFORM, AOUT)
             + sx('What happens next.', '', numbered([('You run the check', 'About 20 seconds. Nothing is texted or emailed to you.'),
                                                       ('We go through it on a call', 'Fifteen minutes. We check the parts a website cannot show: missed calls, after-hours messages, quotes nobody chased.'),
                                                       ('You keep the plan', 'What to fix first, in order, whether or not you work with us.')]).replace('<section class="pg', '<div class="pg').replace('</section>', '</div>').replace('class="w pg-g"', 'class="pg-g"'), 'wh nx3')
             + CL)

# ---- /about : the founder's words as the picture ----
ABOUT = ('<section class="hs ab"><div class="w hs-g"><div class="hs-t"><span class="pill"><i></i>About</span><h1>One founder. A few clients at a time.</h1><p class="sub">Cinder Revenue Company audits service businesses, then fixes what&rsquo;s costing them jobs.</p><div class="cta">%s%s</div></div>'
         '<div class="hs-p"><blockquote>&ldquo;I build and watch every client&rsquo;s system myself, and I only take on a few businesses at a time. If it isn&rsquo;t a fit, I&rsquo;ll say so.&rdquo;<cite><b>Sam Ward</b>Founder, Colorado</cite></blockquote></div></div></section>' % (BOOK, AUDITLINK)
         + statement('Why we exist', 'Most service businesses already get enough leads.', 'The jobs are lost after the phone rings: calls that go unanswered, estimates that never get booked, quotes nobody chases.')
         + '<section class="ab2"><div class="w ab2-g"><p>We start every engagement with a free audit. We walk your business from the first call to the review, show you where jobs slip and what each leak is worth, and you keep the plan whether or not you work with us.</p><p>If you do, we build only the fixes your business needs, and they all run in one app you can check from your phone.</p></div></section>'
         + cells([('find', 'Audit first.', 'We find what&rsquo;s costing you jobs before we build anything.'), ('tool', 'Only what you need.', 'Every build is custom to your business.'),
                  ('chat', 'One app.', 'Everything we build runs in one place you can check from your phone.'), ('cal', 'No contract.', 'Month to month, cancel by text with 30 days&rsquo; notice.')], 'pg-4')
         + dark_split('How I work', 'The person you talk to builds it.', 'No account managers and no handoffs.', [
             ('The person you talk to builds it', 'I scope it, build it and set it up.'), ('I watch every system', 'I check each client&rsquo;s setup myself, so a problem gets caught before it costs you a job.'),
             ('A few businesses at a time', 'I cap how many I take on, so each one gets real attention.'), ('If it isn&rsquo;t a fit, I&rsquo;ll say so', 'The audit is free either way.')],
             '<div class="abm"><b>Colorado</b><span>Based in Colorado. Working with service businesses anywhere in the US.</span></div>')
         + ask('Rather write?', 'Email Sam directly.', 'sam.cinderrevenue@gmail.com', 'mailto:sam.cinderrevenue@gmail.com')
         + CL)

# ---- /story : a long read in three chapters ----
def chapter(n, name):
    return '<section class="chp"><div class="w chp-i"><b>%s</b><span>%s</span></div></section>' % (n, name)
STORY = ('<section class="ih sty"><div class="w ih-i"><span class="lb">Our story</span><h1>The phone was never the job.</h1><p class="sub">Why service businesses lose work they already earned, and what we do about it.</p></div></section>'
         + chapter('01', 'The story')
         + sx('A service business has always been two jobs.', 'Most shops only have someone for the first one.',
              '<div class="tj"><div><em>Job one</em><b>The work</b><p>Fences, roofs, wiring, drains. The thing you are good at, and the reason customers call.</p></div>'
              '<div class="v"><em>Job two</em><b>The desk</b><p>Answering, booking, quoting, chasing, invoicing, asking for the review. None of it is the trade. All of it decides whether you get paid for the trade.</p></div></div>', 'wh')
         + statement('', 'Then the desk got bigger.', 'Leads used to come from one phone. Now they come from calls, texts, forms, Facebook, Google and lead sites, at any hour, and each one expects an answer in minutes.', 'nolb')
         + '<section class="s3"><div class="w s3-g">%s</div></section>' % ''.join('<div><b>%s</b><p>%s</p><span>%s</span></div>' % x for x in [
             ('78%', 'of people have taken their business elsewhere after a company didn&rsquo;t pick up.', 'CallRail, 2025'),
             ('21x', 'more likely to qualify a lead when you reach them within 5 minutes instead of 30.', 'MIT / InsideSales lead response study'),
             ('69%', 'of missed business calls never get a callback within 48 hours.', 'Quo, 16M+ calls, 2026')])
         + statement('', 'And it all lands on someone who is on a roof.', 'Leads don&rsquo;t wait for a good time. They come while you are on a job, at dinner, and after you have gone to bed.', 'nolb')
         + sx('Five things the desk needs', 'that a busy owner can&rsquo;t give it.', '<ol class="fv">%s</ol><p class="fv-k">None of that is skilled work. All of it costs jobs.</p>' % ''.join('<li><b>%s</b><span>%s</span></li>' % x for x in [
             ('Speed', 'A reply while they still care, not tonight.'), ('Coverage', 'Nights, weekends, and every hour you are on a job.'), ('Memory', 'The quote from three weeks ago. The invoice from last month.'),
             ('Handoffs', 'Call to calendar to quote to invoice to review. Every step is a place to drop it.'), ('Time', 'Yours. There is only so much of it.')]), 'wh')
         + chapter('02', 'The approach')
         + statement('', 'The desk can run without a person now.', 'AI can read a message, answer it, book the time, draft the estimate, chase the quote and ask for the review. It does not get tired and it does not forget. What it needs is someone to build it around how your business actually works. That is what we do.', 'nolb')
         + numbered([('Find it first', 'We walk your business from the first call to the review and find where jobs and hours are going. It is free, and you keep the plan.'),
                     ('Build only that', 'We build what the audit calls for and nothing else. No packages. Some businesses need two things, some need twelve.'),
                     ('Then it runs', 'Everything runs in one app on your phone. We watch it, and you see what needs you today.')])
         + fq('If it can be automated, it should be automated. If it&rsquo;s a repetitive task, it should be automated.')
         + cells([('money', 'No ads', 'Everything works on leads and customers you already have.'), ('tool', 'No packages', 'You get what your audit calls for.'), ('find', 'Nothing hidden', 'Every reply, booking and follow-up is in your app.')], 'pg-3')
         + chapter('03', 'The builds')
         + '<section class="sx"><div class="w sx-i"><p class="sx-t">%d builds, and room for yours. <span>The list is where we start, not where we stop. If your business has a job that eats your week and doesn&rsquo;t need a person, we can probably build it.</span></p>%s<p class="sty-l"><a class="btn q" href="/everything">See everything we build</a></p></div></section>' % (len(ALL), BOARD)
         + CL)

# ---- /software : the app, drawn; what you see beside what the customer sees ----
APP = ('<div class="cd app"><div class="app-s"><b>Ridgeline Fence</b>%s</div><div class="app-m"><div class="app-h"><div><b>Good morning, Mike</b><span>6 things need you. Everything else is handled.</span></div><em>Example business, sample data</em></div>'
       '<div class="app-k">%s</div><div class="app-2"><div><h3>Needs you <span>most urgent first</span></h3>%s</div><div><h3>Handled for you <span>today</span></h3>%s</div></div></div></div>' % (
           ''.join('<span class="%s">%s%s</span>' % (c, t, ('<i>%s</i>' % n) if n else '') for c, t, n in [('on', 'Today', ''), ('', 'Inbox', '2'), ('', 'Calendar', ''), ('', 'Quotes', ''), ('', 'Money', '2')]),
           ''.join('<div><span>%s</span><b>%s</b><em>%s</em></div>' % x for x in [('Won, 30 days', '$37,500', '5 jobs, $18,500 collected'), ('First reply', '9s', '41 of 41 leads answered'), ('Owed to you', '$10,700', '$6,100 late')]),
           ''.join('<p><b>%s</b><span>%s</span><em>%s</em></p>' % x for x in [('Tom Becker', 'Asked about financing', 'Reply'), ('Lena Ortiz', 'Opened her quote 3 times', 'Nudge'), ('Priya Shah', 'Estimate done, quote not written', 'Write quote'), ('Henderson family', 'Invoice 3 days late', 'Call')]),
           ''.join('<p><b>%s</b><span>%s</span></p>' % x for x in [('Replied to Tom Becker', '6 seconds after he wrote in'), ('Booked Dana Ruiz', 'Estimate, Friday 8:00 AM'), ('Followed up with Kyle Brandt', 'Quote, day 5'), ('Asked Bill Turner for a review', 'Job paid in full')])))
DUO = ('<div class="duo">%s</div>' % ''.join('<div><div class="duo-t"><b>%s</b><span>%s</span></div><div class="duo-a"><em>What you see</em><p><b>%s</b>%s</p></div><div class="duo-b"><em>What the customer sees</em><p>%s</p></div></div>' % x for x in [
    ('Every lead gets an answer in seconds.', 'Calls, texts, forms and lead sites. Day or night, the reply goes out from your number.', 'Lead answered', 'Tom Becker, website form. Replied in 6 seconds. Nothing for you to do.', 'Hi Tom, this is Ridgeline Fence. What&rsquo;s the address so I can give you a price range?'),
    ('Estimates land on your calendar.', 'Leads pick from times you&rsquo;re actually free. You just show up.', 'Estimate booked', 'Tom Becker, Tue Dec 1 at 10:30 AM. 2210 Aspen Ct, Littleton.', 'You&rsquo;re booked for Tuesday at 10:30. See you then.'),
    ('Every quote gets chased.', 'Day 2, day 5, day 10, then monthly. It stops the moment they answer.', 'Lena opened her quote', 'Third time today. Good moment to call.', 'Hi Lena, any questions on the fence quote? Happy to walk you through the three options.'),
    ('Invoices chase themselves.', 'Reminders go out with your own pay link until it&rsquo;s settled.', 'Payment received', '$5,000 from Bill Turner, invoice #1041.', 'Hi, a quick reminder that invoice #1042 for $6,100 was due Nov 22. You can pay here.')]))
INSIDE = ('<section class="nx"><div class="w nx-i"><p class="nx-t">What runs inside it.</p><div class="nx-g nx5">%s</div></div></section>' % ''.join('<a href="/%s"><b>%s</b><span>%s</span></a>' % (s_, BY[s_]['name'], ap(BY[s_]['short'])) for s_ in ('answering', 'booking', 'follow-up', 'reviews', 'websites')))
SOFTWARE = (inner_hero('The app', 'Everything in one place.', 'Every lead, estimate, quote and invoice, with what needs you at the top. On your phone or your desk.', BOOK + AUDITLINK, APP)
            + statement('', 'It does the work. You do the jobs.', 'If it doesn&rsquo;t need a person, a person shouldn&rsquo;t be doing it.', 'nolb')
            + sx('You only see what needs you.', 'Everything else was handled before you opened it.', DUO + '<p class="rl-k">Example business, sample data.</p>', 'wh')
            + H.split('Built for the truck, not the office', 'The same app on your phone and your desk.', 'What needs you is on top, every lead shows where it came from, and whatever already went out is on the record.',
                      '<div class="cd own">%s<p>If you ever leave, you get every contact, conversation and booked appointment within 3 business days.</p></div>' % head('You own your data', '', ''))
            + INSIDE
            + bigline('It runs while you’re on the job.')
            + faq('Questions.', [('Do I have to switch from what I use now?', 'No. It can work alongside the tools you already use, or replace them. The audit shows which makes sense for you.'), ('Do you take payments?', 'No. Invoices go out with your own pay link.'), ('Who sets it up?', 'We do.')])
            + CL)

# ---- /trades : a tape measure turning into a quote; the fence tools; the other trades ----
TAPE = ('<div class="tpm"><div class="tpm-r"><i></i><b>180 ft</b></div><div class="es-a">%s</div><div class="cd tpm-q">%s%s<div class="tpm-s"><em>Sign and pay the deposit</em></div></div></div>' % (ARROW, head('Quote', 'From the measure'),
        ''.join('<div class="%s"><span>%s</span><b>%s</b></div>' % x for x in [('', 'Good', 'Pine privacy'), ('on', 'Better', 'Cedar privacy'), ('', 'Best', 'Cedar on steel posts')])))
TRADES = (inner_hero('Trades', 'Built for the trades.', 'For owner-run service businesses that sell estimates and quotes. The leaks look the same in every trade: missed calls, slow replies, quotes nobody chases.', BOOK + AUDITLINK, TAPE)
          + sx('From a tape measure to a signed quote.', '', '<ol class="rl rl4">%s</ol>' % ''.join('<li><time>%s</time><b>%s</b></li>' % x for x in [
              ('Walk the line on site and enter the footage, the gates and the fence type.', 'Measure the run'), ('Good, Better and Best options, priced the way you price.', 'The quote builds itself'),
              ('The customer picks an option, signs, and pays the deposit to hold the date.', 'They sign on their phone'), ('The order list and the job documents fill in from the same numbers.', 'Materials and paperwork follow')]), 'wh')
          + statement('Built first for fence', 'Fence companies get tools made for how they actually sell.', '')
          + cells([('quote', 'Measure to quote', 'Measure the run on site and the quote builds itself, with Good, Better and Best options.'), ('tool', 'Seven fence types', 'Wood, vinyl, chain link, aluminum and more, each priced its own way.'),
                   ('plus', 'Material orders', 'Order what each job needs, straight from the job.'), ('find', 'Job paperwork', 'The documents a fence job needs, filled in for you.')], 'pg-4')
          + sx('Works for any trade that quotes.', 'The same system answers, books, follows up and asks for reviews, whatever you install or fix.', '<div class="trd">%s</div>' % ''.join('<div><b>%s</b><span>%s</span></div>' % x for x in [
              ('Roofing', 'Storm-season call spikes answered in seconds, inspections booked.'), ('HVAC', 'After-hours calls answered, tune-ups and installs booked.'), ('Plumbing', 'Urgent calls answered first, estimates booked the same day.'),
              ('Landscaping and hardscaping', 'Quotes chased until they&rsquo;re settled, spring rush included.'), ('Concrete', 'Bids followed up on, deposits collected to hold the date.'), ('Painting', 'Estimates booked, quotes followed up, reviews asked for.')]), 'wh')
          + ask('Don&rsquo;t see your trade?', 'If you quote jobs, it fits.', 'How the audit works', '/free-audit')
          + CL)

# ---- /whats-new : a dated list of what shipped ----
wm = legacy('whats-new')
LOG_ = [('Nov 24, 2026', [('Today, rebuilt', 'Money won and owed, how fast leads got a reply, and the people who need you, most urgent first.'), ('Numbers', 'Where every job came from, with booking and close rates for each source. One button exports it for your bookkeeper.'),
                          ('Quotes', 'Good, Better and Best options, the deposit to hold the date, and every follow-up sent and still to come.'), ('Inbox', 'Every conversation in one place, with a clear note when it’s your turn to step in.'),
                          ('Money', 'What you’re owed, what came in this month, deposits held and expenses by category, on one screen.')]),
        ('Nov 20, 2026', [('Photos on quotes', 'Each option carries a picture: a past install, this job, or one you upload.')]),
        ('Nov 19, 2026', [('Signed quotes', 'Customers sign on their phone to approve, and the deposit step follows.'), ('Quotes in Spanish', 'The customer’s quote page follows their phone’s language, with a one-tap switch.'), ('Help inside the app', 'Short answers to common questions, each with a button to the screen that does it.')]),
        ('Nov 17, 2026', [('Measure to quote', 'For fence: measure the run on site and the quote builds itself.'), ('Job paperwork', 'The documents a fence job needs, filled in from the job.'), ('Switching over', 'Moving from another system now takes minutes, with every merge shown.')]),
        ('Nov 16, 2026', [('Customers can reschedule', 'They can ask to move or cancel a visit from their own page.'), ('Quotes that expire', 'Expired quotes stop following up on their own.'), ('Billing like the big systems', 'Progress invoices, batch invoicing, statements, late fees and refunds.'),
                          ('Payment reminders by email', 'On top of the texts.'), ('Job costing', 'Expenses, receipts and mileage counted against each job.'), ('Crew tools', 'Dispatch by crew member, timesheets, commissions, and an app that works without signal.')])]
assert all(ap(t).replace('&rsquo;', '’') in wm.replace('&rsquo;', '’') for _, items in LOG_ for t, _ in items)
WHATSNEW = (hero_left('What&rsquo;s new', 'Better every week.', 'What we’ve shipped to the app lately. Every client gets every update, at no extra cost.', '').replace('<div class="ih-p"><div class="w ih-pi"></div></div>', '')
            + '<section class="cg"><div class="w cg-i">%s</div></section>' % ''.join('<div class="cg-d"><time>%s</time><div>%s</div></div>' % (d, ''.join('<p><b>%s</b>%s</p>' % (ap(t), ap(x)) for t, x in items)) for d, items in LOG_)
            + bigline('Every client gets every update.')
            + sx('How updates reach you.', '', numbered([('We build it once', 'A fix one contractor asks for usually helps the rest.'), ('Everyone gets it', 'No versions and no upgrade fee. It’s there the next time you open the app.'),
                                                           ('Nothing to relearn', 'New things show up where you’d expect them, and Help explains each one in a line.')]).replace('<section class="pg', '<div class="pg').replace('</section>', '</div>').replace('class="w pg-g"', 'class="pg-g"'), 'wh nx3')
            + CL)

CSS_REST = r"""
/* ============ legal ============ */
.lgl{background:#fff;border-bottom:1px solid var(--ln)}.lgl-g{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.lgl aside{padding:clamp(72px,6.4vw,122px) var(--pad);border-right:1px solid var(--ln)}.lgl aside>*{position:sticky}.lgl h1{top:96px;margin:18px 0 0;font-size:clamp(38px,3.2vw,60px);line-height:1.05;letter-spacing:-.04em;font-weight:600}
.lgl ol{list-style:none;margin:clamp(28px,2.6vw,48px) 0 0;padding:0;top:200px}.lgl ol a{display:block;padding:9px 0;border-top:1px solid var(--ln);font-size:14.5px;color:var(--g2)}.lgl ol a:hover{color:var(--ink)}
.lgl article{padding:clamp(72px,6.4vw,122px) var(--pad);max-width:46em;font-size:clamp(15.5px,1vw,18px);line-height:1.6;color:#3d3f44}
.lgl article h2{margin:clamp(36px,3vw,56px) 0 12px;font-size:clamp(20px,1.4vw,26px);font-weight:560;letter-spacing:-.02em;color:var(--ink);scroll-margin-top:90px}.lgl article h2:first-of-type{margin-top:28px}
.lgl article p{margin:0 0 14px}.lgl article ul{margin:0 0 14px;padding-left:20px}.lgl article li{margin-bottom:10px}.lgl article strong{color:var(--ink);font-weight:560}.lgl article a{color:var(--blue);text-decoration:underline;text-underline-offset:3px}
/* ============ questions ============ */
.qh{border-bottom:0}.qs .lk-b{padding:0 var(--pad) clamp(48px,4vw,76px)}.qs h2{margin:0;padding:clamp(48px,4vw,76px) 0 clamp(18px,1.6vw,30px);font-size:clamp(25px,1.8vw,34px);font-weight:500;letter-spacing:-.028em;scroll-margin-top:80px}
.qs details{border-top:1px solid var(--ln)}.qs details:last-child{border-bottom:1px solid var(--ln)}
.qs summary{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:clamp(16px,1.3vw,24px) 0;cursor:pointer;list-style:none;font-size:clamp(16px,1.05vw,20px);font-weight:540;letter-spacing:-.014em}.qs summary::-webkit-details-marker{display:none}
.qs summary i{position:relative;flex:none;width:14px;height:14px}.qs summary i::before,.qs summary i::after{content:"";position:absolute;left:0;right:0;top:6px;height:1.5px;background:var(--ink);transition:transform .2s}.qs summary i::after{transform:rotate(90deg)}.qs details[open] summary i::after{transform:rotate(0)}
.qs details p{margin:0;padding:0 40px clamp(18px,1.5vw,28px) 0;max-width:38em;font-size:clamp(15px,.95vw,17.5px);line-height:1.5;color:var(--g2)}
/* ============ 404 ============ */
.nf{background:#fff}.nf-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);text-align:center;padding:clamp(72px,7vw,132px) 24px clamp(64px,6vw,112px)}
.nf-i>b{display:block;font-size:clamp(120px,17vw,320px);line-height:.86;font-weight:600;letter-spacing:-.07em;color:transparent;-webkit-text-stroke:1.5px #c9cbd0}
.nf h1{margin:clamp(20px,2vw,36px) 0 0;font-size:clamp(30px,2.6vw,48px);letter-spacing:-.036em;font-weight:600}
.rl2{border-top:1px solid var(--ln)}.rl2-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.rl2 a{position:relative;display:block;padding:clamp(22px,1.7vw,32px) clamp(20px,1.5vw,28px) clamp(30px,2.4vw,44px);border-left:1px solid var(--ln);transition:background .2s}.rl2 a:first-child{border-left:0}.rl2 a:hover{background:#fff}
.rl2 b{display:block;font-size:clamp(16px,1.05vw,20px);font-weight:560;letter-spacing:-.014em}.rl2 span{display:block;margin-top:6px;font-size:clamp(14px,.86vw,16px);color:var(--g2)}
.rl2 svg{position:absolute;right:clamp(18px,1.4vw,26px);top:clamp(24px,1.8vw,34px);width:16px;height:16px;fill:none;stroke:var(--g3);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s,stroke .2s}.rl2 a:hover svg{stroke:var(--ink);transform:translateX(3px)}
/* ============ the site check ============ */
.ac2{background:#fff;border-bottom:1px solid var(--ln)}.ac2-g{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.ac2-t{padding:clamp(64px,5.6vw,108px) var(--pad)}.ac2-t h1{margin:18px 0 0;text-align:left;font-size:clamp(38px,3.2vw,60px);line-height:1.05;letter-spacing:-.04em;white-space:normal}.ac2-t .sub{margin:16px 0 0;text-align:left;max-width:34em}
.ac2-p{border-left:1px solid var(--ln);background:linear-gradient(180deg,#f6f8ff,#e6ebfd);padding:clamp(40px,4vw,76px) clamp(24px,3vw,56px)}
.tf{margin-top:clamp(28px,2.6vw,48px);display:grid;gap:14px}.tf-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tf label{display:grid;gap:7px;font-size:13px;font-weight:520;color:var(--t2)}
.tf input,.tf select{width:100%;height:44px;padding:0 13px;border:0;border-radius:10px;background:#fff;box-shadow:inset 0 0 0 1px rgba(23,24,26,.16);font:450 15px/1 Inter,sans-serif;color:var(--ink);appearance:none;-webkit-appearance:none;transition:box-shadow .15s}
.tf select{background-image:linear-gradient(45deg,transparent 50%,#8a8d93 50%),linear-gradient(135deg,#8a8d93 50%,transparent 50%);background-position:calc(100% - 18px) 19px,calc(100% - 13px) 19px;background-size:5px 5px;background-repeat:no-repeat;padding-right:34px}
.tf input:focus,.tf select:focus{outline:0;box-shadow:inset 0 0 0 2px var(--blue)}.tf input::placeholder{color:#b3b5ba}
.tf-hp{position:absolute!important;left:-9999px}.tf-go{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:6px}.tf-go span{font-size:13px;color:var(--t3)}
.tf .btn{height:44px;padding:0 18px;border:0;cursor:pointer;font:560 14.5px/1 Inter,sans-serif}.tf .btn:disabled{opacity:.6;cursor:default}.aud-err{margin:0;font-size:14px;color:#c23b3f}
.aud-out{position:sticky;top:92px}.aud-card{padding:clamp(22px,2vw,34px);border-radius:16px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.06),0 30px 60px -34px rgba(30,40,110,.5)}
.aud-k{margin:0;font:500 12px/1 "Geist Mono",monospace;color:var(--t3)}.aud-list{list-style:none;margin:20px 0 0;padding:0;display:grid;gap:16px}.aud-list li{display:flex;gap:12px;font-size:15px;line-height:1.5;color:var(--g2)}.aud-list b{color:var(--ink);font-weight:560}
.aud-dot{flex:none;width:7px;height:7px;margin-top:8px;border-radius:2px;background:var(--blue)}
.aud-money{margin-top:16px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.aud-v{font-size:clamp(44px,4.6vw,68px);line-height:1;font-weight:600;letter-spacing:-.045em;font-variant-numeric:tabular-nums}.aud-u{font-size:15px;color:var(--t3)}
.aud-sub{margin:12px 0 0;font-size:15px;line-height:1.45;color:var(--g2)}.aud-checks{list-style:none;margin:22px 0 0;padding:18px 0 0;border-top:1px solid var(--line);display:grid;gap:12px}
.aud-chk{display:flex;gap:12px;font-size:14.5px;line-height:1.45;color:var(--g2)}.aud-chk b{color:var(--ink);font-weight:560;margin-right:2px}
.aud-mark{flex:none;width:18px;height:18px;margin-top:1px;border-radius:5px;box-shadow:inset 0 0 0 1.5px #c9cbd0}.aud-chk.is-ok .aud-mark{background:var(--blue);box-shadow:none}.aud-chk.is-bad .aud-mark{box-shadow:inset 0 0 0 1.5px var(--red);background:#fdeaea}
.aud-fix{margin-top:22px;padding:18px;border-radius:12px;background:#f7f9ff;box-shadow:inset 0 0 0 1px #dfe6fb}.aud-fix ol{margin:12px 0 0;padding-left:20px;display:grid;gap:8px;font-size:14.5px}
.aud-cta{margin-top:22px;width:100%;height:44px;justify-content:center}.aud-fine{margin:14px 0 0;font-size:12.5px;line-height:1.5;color:var(--t3)}
.nx3 .pg{border:1px solid var(--ln);border-radius:16px;overflow:hidden}.nx3 .pg-g{border:0;margin:0 0 -1px -1px}
/* ============ about ============ */
.ab .hs-p blockquote{margin:0;max-width:19em;font:400 clamp(24px,2.1vw,40px)/1.2 Georgia,"Times New Roman",serif;letter-spacing:-.018em;text-wrap:balance}
.ab cite{display:block;margin-top:clamp(22px,2vw,36px);font:450 clamp(13.5px,.82vw,15.5px)/1.4 Inter,sans-serif;font-style:normal;color:var(--t3)}.ab cite b{display:block;color:var(--ink);font-weight:560}
.ab2-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(24px,3.4vw,64px);border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:0 var(--pad) clamp(72px,6vw,112px)}
.ab2 p{margin:0;font-size:clamp(17px,1.2vw,22px);line-height:1.45;letter-spacing:-.012em;color:#3d3f44}
.abm{width:100%;max-width:440px;padding:clamp(28px,2.6vw,48px);border-radius:16px;background:#17181a;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09)}.abm b{display:block;font-size:clamp(34px,3vw,56px);font-weight:600;letter-spacing:-.04em}.abm span{display:block;margin-top:12px;color:#a3a5aa;font-size:15px;line-height:1.45}
/* ============ story ============ */
.sty{border-bottom:0}.sty .ih-i{padding-bottom:clamp(72px,6.4vw,122px)}.sty h1{font-size:clamp(44px,4.4vw,84px);max-width:11em}
.chp{background:var(--dk);color:#fff}.chp-i{display:flex;align-items:baseline;gap:clamp(18px,2vw,36px);border-left:1px solid var(--dl);border-right:1px solid var(--dl);padding:clamp(36px,3.4vw,64px) var(--pad)}
.chp b{font-size:clamp(56px,6.4vw,120px);line-height:.9;font-weight:600;letter-spacing:-.06em}.chp span{font-size:clamp(19px,1.5vw,28px);font-weight:500;letter-spacing:-.022em;color:#a3a5aa}
.st.nolb .lb{display:none}.st.nolb .st-t{margin-top:0}
.tj{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(16px,1.8vw,32px)}.tj>div{padding:clamp(24px,2.2vw,42px);border-radius:16px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln)}.tj>.v{background:var(--ink);color:#fff;box-shadow:none}
.tj em{font:500 12px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3)}.tj b{display:block;margin:14px 0 12px;font-size:clamp(28px,2.5vw,48px);font-weight:560;letter-spacing:-.04em}.tj p{margin:0;max-width:26em;font-size:clamp(15px,1vw,18.5px);line-height:1.45;color:var(--g2)}.tj .v p{color:#a3a5aa}
.s3{background:var(--dk);color:#fff}.s3-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-left:1px solid var(--dl);border-right:1px solid var(--dl)}
.s3-g div{padding:clamp(40px,3.6vw,68px) var(--pad);border-left:1px solid var(--dl)}.s3-g div:first-child{border-left:0}.s3 b{display:block;font-size:clamp(56px,5.6vw,108px);line-height:.9;font-weight:600;letter-spacing:-.06em}
.s3 p{margin:clamp(18px,1.6vw,30px) 0 0;max-width:17em;font-size:clamp(16px,1.1vw,21px);line-height:1.3;letter-spacing:-.014em}.s3 span{display:block;margin-top:14px;font:500 11.5px/1.4 "Geist Mono",monospace;color:#8f9197}
.fv{list-style:none;margin:0;padding:0;counter-reset:f}.fv li{counter-increment:f;display:grid;grid-template-columns:clamp(40px,3.4vw,64px) minmax(0,.4fr) minmax(0,1fr);gap:12px;align-items:baseline;padding:clamp(16px,1.4vw,26px) 0;border-top:1px solid var(--ln)}
.fv li::before{content:"0" counter(f);font:500 12px/1 "Geist Mono",monospace;color:var(--t3)}.fv b{font-size:clamp(22px,1.9vw,36px);font-weight:560;letter-spacing:-.03em}.fv span{font-size:clamp(15px,1vw,19px);color:var(--g2)}
.fv-k{margin:clamp(24px,2.2vw,40px) 0 0;font-size:clamp(19px,1.4vw,26px);font-weight:500;letter-spacing:-.02em}.sty-l{margin:clamp(24px,2.2vw,40px) 0 0}
/* ============ the app ============ */
.app{display:grid;grid-template-columns:172px minmax(0,1fr);width:min(1120px,100%);overflow:hidden;text-align:left}
.app-s{display:grid;align-content:start;gap:3px;padding:16px 10px;border-right:1px solid var(--line);background:#fafafa}.app-s b{padding:4px 10px 14px;font-size:13.5px;font-weight:620}
.app-s span{display:flex;justify-content:space-between;align-items:center;height:32px;padding:0 10px;border-radius:8px;font-size:13px;font-weight:520;color:var(--t2)}.app-s span.on{background:#fff;color:var(--ink);box-shadow:0 0 0 1px rgba(23,24,26,.07)}
.app-s i{display:grid;place-items:center;min-width:18px;height:18px;border-radius:9px;background:var(--blue);color:#fff;font:600 10.5px/1 Inter,sans-serif;font-style:normal}
.app-m{padding:20px 22px 22px}.app-h{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.app-h b{display:block;font-size:21px;font-weight:600;letter-spacing:-.03em}.app-h span{display:block;margin-top:4px;font-size:13.5px;color:var(--t2)}.app-h em{font:500 11px/1.6 "Geist Mono",monospace;font-style:normal;color:var(--t3);white-space:nowrap}
.app-k{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0}.app-k div{padding:14px 16px;border-radius:12px;background:#f6f7f9}.app-k span{font-size:12px;color:var(--t2)}.app-k b{display:block;margin:6px 0 4px;font-size:28px;font-weight:600;letter-spacing:-.04em}.app-k em{font-style:normal;font-size:12px;color:var(--t3)}
.app-2{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:10px}.app-2>div{padding:14px 16px 6px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--line)}.app-2 h3{margin:0 0 6px;font-size:13px;font-weight:600}.app-2 h3 span{font-weight:450;color:var(--t3);margin-left:6px}
.app-2 p{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1px 10px;align-items:center;margin:0;padding:10px 0;border-top:1px solid var(--line);font-size:13px}.app-2 p b{font-weight:560}.app-2 p span{grid-column:1;font-size:12px;color:var(--t2)}
.app-2 p em{grid-row:1/3;grid-column:2;display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:7px;background:var(--ink);color:#fff;font-style:normal;font-size:11.5px;font-weight:560}
@media(min-width:1700px){.app,.tpm{zoom:1.1}}
.duo{display:grid}.duo>div{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1fr) minmax(0,1fr);gap:clamp(14px,1.6vw,28px);align-items:center;padding:clamp(20px,1.8vw,34px) 0;border-top:1px solid var(--ln)}
.duo-t b{display:block;font-size:clamp(18px,1.3vw,25px);font-weight:540;letter-spacing:-.022em;line-height:1.14}.duo-t span{display:block;margin-top:8px;max-width:22em;font-size:clamp(14px,.88vw,16.5px);line-height:1.4;color:var(--g2)}
.duo em{display:block;margin-bottom:10px;font:500 11px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3)}.duo p{margin:0;font-size:14px;line-height:1.4}
.duo-a p{padding:14px 16px;border-radius:14px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln);color:var(--g2)}.duo-a p b{display:block;margin-bottom:3px;color:var(--ink);font-weight:560}
.duo-b p{width:fit-content;max-width:92%;padding:11px 14px;border-radius:16px 16px 16px 5px;background:var(--blue);color:#fff}
.own{max-width:460px}.own p{margin:0;padding:18px;font-size:clamp(15px,1vw,18px);line-height:1.45}.nx5{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:12px!important}.nx5>*::before{display:none!important}
/* ============ trades ============ */
.tpm{display:grid;grid-template-columns:minmax(0,1fr) 40px minmax(0,.8fr);gap:20px;align-items:center;width:min(980px,100%);text-align:left}
.tpm-r{position:relative;height:74px;border-radius:8px;background:#f5c518;box-shadow:0 24px 40px -24px rgba(120,90,0,.6)}
.tpm-r i{position:absolute;inset:0 0 50% 0;background:repeating-linear-gradient(90deg,#17181a 0 1.5px,transparent 1.5px 12px),repeating-linear-gradient(90deg,#17181a 0 2px,transparent 2px 60px);background-size:auto 45%,auto 100%;background-repeat:repeat-x;opacity:.8}
.tpm-r b{position:absolute;right:14px;bottom:10px;font:600 20px/1 "Geist Mono",monospace;color:#17181a}
.tpm-q>div:not(.rep-h){display:flex;justify-content:space-between;gap:12px;padding:12px 18px;border-top:1px solid var(--line);font-size:14px}.tpm-q>div:nth-child(2){border-top:0}.tpm-q span{color:var(--t3);font:500 11.5px/1.6 "Geist Mono",monospace}.tpm-q b{font-weight:540}
.tpm-q .on{background:#f7f9ff;box-shadow:inset 3px 0 0 var(--blue)}.tpm-q .on span{color:var(--blue)}.tpm-s em{display:inline-flex;align-items:center;height:34px;padding:0 14px;border-radius:9px;background:var(--blue);color:#fff;font-style:normal;font-size:13px;font-weight:560}
.trd{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--ln);border-radius:16px;overflow:hidden}.trd div{padding:clamp(22px,1.8vw,34px);border-left:1px solid var(--ln);border-top:1px solid var(--ln);margin:-1px 0 0 -1px;background:var(--g)}
.trd b{display:block;font-size:clamp(19px,1.4vw,26px);font-weight:560;letter-spacing:-.024em}.trd span{display:block;margin-top:8px;max-width:20em;font-size:clamp(14px,.9vw,16.5px);line-height:1.4;color:var(--g2)}
/* ============ what's new ============ */
.ih-l:not(:has(.ih-p)) .ih-i{padding-bottom:clamp(56px,5vw,96px)}
.cg{background:#fff;border-bottom:1px solid var(--ln)}.cg-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.cg-d{display:grid;grid-template-columns:minmax(0,.3fr) minmax(0,1fr);border-top:1px solid var(--ln)}.cg-d:first-child{border-top:0}
.cg-d time{padding:clamp(24px,2.2vw,40px) var(--pad);font:500 13px/1.4 "Geist Mono",monospace;color:var(--t2)}.cg-d>div{border-left:1px solid var(--ln);padding:clamp(12px,1.2vw,22px) var(--pad)}
.cg-d p{display:grid;grid-template-columns:minmax(0,.5fr) minmax(0,1fr);gap:8px 24px;margin:0;padding:clamp(12px,1vw,18px) 0;border-top:1px solid var(--ln);font-size:clamp(14.5px,.92vw,17px);line-height:1.42;color:var(--g2)}.cg-d p:first-child{border-top:0}
.cg-d p b{font-size:clamp(16px,1.05vw,20px);font-weight:560;letter-spacing:-.014em;color:var(--ink)}.cg-d:first-child time{color:var(--blue)}

@media(max-width:1180px){.app{grid-template-columns:minmax(0,1fr)}.app-s{display:flex;overflow:auto;border-right:0;border-bottom:1px solid var(--line);padding:10px}.app-s b{display:none}.app-s span{gap:8px;white-space:nowrap}
.duo>div{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.duo-t{grid-column:1/-1}.nx5{grid-template-columns:repeat(2,minmax(0,1fr))!important}.rl2-g{grid-template-columns:repeat(2,minmax(0,1fr))}.rl2 a:nth-child(odd){border-left:0}.rl2 a:nth-child(n+3){border-top:1px solid var(--ln)}}
@media(max-width:860px){
.lgl-g,.ac2-g,.ab2-g,.tj,.s3-g,.trd,.tpm{grid-template-columns:minmax(0,1fr)}.lgl aside{border-right:0;padding:48px var(--pad) 0}.lgl aside>*{position:static}.lgl ol{display:none}.lgl article{padding:24px var(--pad) 56px}
.ac2-t{padding:48px var(--pad) 36px}.ac2-p{border-left:0;border-top:1px solid var(--ln);padding:28px 14px 40px}.aud-out{position:static}.tf-row{grid-template-columns:minmax(0,1fr)}
.ab .hs-p{padding:40px var(--pad)}.s3-g div{border-left:0;border-top:1px solid var(--dl)}.s3-g div:first-child{border-top:0}
.fv li{grid-template-columns:36px minmax(0,1fr)}.fv span{grid-column:2}
.app-m{padding:14px}.app-k{grid-template-columns:minmax(0,1fr)}.app-2{grid-template-columns:minmax(0,1fr)}.app-h em{display:none}
.duo>div{grid-template-columns:minmax(0,1fr)}.nx5{grid-template-columns:minmax(0,1fr)!important}
.tpm .es-a{transform:rotate(90deg);margin:0 auto}.rl2-g{grid-template-columns:minmax(0,1fr)}.rl2 a{border-left:0;border-top:1px solid var(--ln)}.rl2 a:first-child{border-top:0}
.cg-d{grid-template-columns:minmax(0,1fr)}.cg-d time{padding:24px var(--pad) 0}.cg-d>div{border-left:0;padding-top:6px}.cg-d p{grid-template-columns:minmax(0,1fr);gap:4px}
.qs details p{padding-right:0}.chp b{font-size:56px}
.rl.rl4{grid-template-columns:minmax(0,1fr)}.rl4 li{padding:0 0 26px 22px}
}
"""

# =====================================================================================
# Rhythm. Sam: the pages all followed one pattern below the top. Each build page now gets its own running order,
# its own surfaces (dark, tint, blue) and its own way of moving from one section to the next (sheet, arc, angle, rule, expand).
# The top of each page is left alone. One row per page; nothing here is shared between two pages on purpose.
# =====================================================================================
KIND = {'hs': 'top', 'ih': 'top', 'dh': 'top', 'st': 'st', 'sx': 'sx', 'sp': 'sp', 'hw': 'hw', 'bl': 'bl', 'pg': 'pg', 'ic': 'ic', 'as': 'as', 'fq': 'fq',
        'fa': 'faq', 'qc': 'faq', 'qf': 'faq', 'cv': 'faq', 'cl': 'cl', 'itg': 'itg'}
RHYTHM = {
    'phone-agent': ('sx sp hw', {'sx': 's-tn t-sheet v-c', 'sp': 'v-f', 'faq': 't-arc'}),
    'website-chat': ('st sx bl sp', {'st': 'v-xl', 'sx': 'v-pin', 'bl': 's-bl t-exp', 'sp': 's-dkp'}),
    'social-messages': ('sx st pg', {'sx': 't-sheet', 'st': 's-dk v-c t-angle', 'pg': 's-dk'}),
    'lead-vetting': ('st sx sp', {'st': 'v-2 t-rule', 'sx': 's-tn', 'sp': 'v-f t-sheet'}),
    'after-hours': ('st sx sp', {'st': 'v-c t-arc', 'sp': 's-dkp'}),
    'booking': ('st sx ic', {'st': 'v-xl', 'sx': 's-tn t-exp'}),
    'reminders': ('sx st sp', {'sx': 't-sheet v-b', 'st': 's-dk t-angle', 'sp': 'v-f'}),
    'dispatch': ('st sx hw', {'st': 'v-2', 'sx': 't-rule v-c'}),
    'job-updates': ('bl sx st sp', {'bl': 'v-sf t-sheet', 'sx': 's-tn', 'st': 'v-c', 'sp': 'v-f'}),
    'estimates': ('st sx sp', {'st': 's-tn v-xl', 'sx': 't-exp', 'sp': 's-dkp v-f'}),
    'proposals': ('st bl sx sp', {'bl': 's-dk t-arc', 'sx': 't-sheet'}),
    'follow-up': ('st sx ic as', {'st': 'v-2', 'sx': 't-exp'}),
    'invoicing': ('sx st sp bl', {'sx': 't-sheet', 'st': 's-tn v-c', 'sp': 'v-f', 'bl': 's-dk v-sf t-angle'}),
    'bookkeeping': ('st sx pg sp', {'st': 'v-xl t-rule', 'sx': 'v-pin', 'pg': 'v-l', 'sp': 's-dkp'}),
    'reviews': ('sx st pg', {'sx': 's-tn t-arc v-c', 'st': 'v-2', 'pg': 's-dk t-sheet'}),
    'review-replies': ('st sx pg', {'st': 'v-c', 'sx': 'v-pin t-rule', 'pg': 'v-l'}),
    'win-backs': ('bl st sx sp', {'bl': 's-bl', 'st': 't-sheet', 'sx': 's-tn', 'sp': 'v-f'}),
    'maintenance-reminders': ('st sx pg bl', {'st': 'v-2', 'sx': 's-tn t-exp', 'pg': 's-dk', 'bl': 'v-xl'}),
    'referrals': ('sx st sp', {'sx': 't-sheet v-c', 'st': 's-dk t-arc v-xl', 'sp': 't-sheet'}),
    'campaigns': ('st sx pg bl', {'st': 'v-c', 'sx': 's-tn t-angle', 'pg': 'v-l', 'bl': 's-bl t-exp'}),
    'local-search': ('st pg sx bl', {'st': 'v-xl', 'pg': 't-rule', 'sx': 's-tn t-sheet', 'bl': 'v-sf'}),
    'job-photos': ('sx st sp', {'sx': 't-arc', 'st': 's-tn v-2', 'sp': 's-dkp v-f'}),
    'hiring': ('st sp bl pg', {'st': 'v-c t-sheet', 'sp': 'v-f', 'bl': 's-dk t-exp', 'pg': 'v-l'}),
    'team-assistant': ('st bl sx sp', {'st': 'v-2', 'bl': 'v-sf s-tn', 'sx': 't-sheet', 'sp': 'v-f'}),
    'field-notes': ('sx st pg bl', {'sx': 's-tn t-sheet v-c', 'st': 's-dk t-angle', 'pg': 's-dk', 'bl': 'v-l v-xl'}),
    'reports': ('st sx sp bl', {'st': 'v-xl', 'sx': 'v-pin t-rule', 'sp': 's-dkp', 'bl': 's-bl t-arc'}),
    'call-review': ('st sx sp pg', {'st': 'v-c t-arc', 'sx': 'v-pin', 'sp': 'v-f', 'pg': 'v-l t-rule'}),
    'custom-agents': ('st bl sx sp', {'st': 'v-2', 'bl': 's-dk v-sf t-exp', 'sx': 't-sheet', 'sp': 's-dkp'}),
    'integrations': ('sx itg', {'sx': 't-sheet'}),
    'custom-builds': ('st pg fq sp', {'st': 'v-xl', 'pg': 't-rule', 'sp': 'v-f t-sheet'}),
}
assert len({(o, tuple(sorted(m.items()))) for o, m in RHYTHM.values()}) == len(RHYTHM)


def restyle(name, body):
    if name not in RHYTHM:
        return body
    secs = re.findall(r'<section\b.*?</section>', body, re.S)
    assert ''.join(secs) == body, name
    order, mods = RHYTHM[name]; order = order.split()
    kind = lambda x: KIND.get(re.match(r'<section class="([a-z0-9]+)', x).group(1), 'other')
    top = [x for x in secs if kind(x) == 'top']; end = [x for x in secs if kind(x) in ('faq', 'cl')]
    mid = [x for x in secs if x not in top and x not in end]
    assert len(top) == 1 and all(kind(x) in order for x in mid), (name, [kind(x) for x in mid])
    mid.sort(key=lambda x: order.index(kind(x)))
    out_ = []
    for x in top + mid + end:
        k = kind(x)
        if k in mods:
            x = re.sub(r'^<section class="([^"]*)"', lambda m: '<section class="%s %s"' % (m.group(1).strip(), mods[k]), x, count=1)
        out_.append(x)
    return ''.join(out_)


CSS_RHY = r"""
/* ============ surfaces ============ */
.st.s-tn,.sx.s-tn,.bl.s-tn{background:linear-gradient(180deg,#f6f8ff,#e6ebfd)}
.st.s-dk,.bl.s-dk,.pg.s-dk{background:var(--dk);color:#fff;border-color:var(--dl)}
.st.s-dk .st-i,.bl.s-dk .bl-i,.pg.s-dk .pg-g,.pg.s-dk .pg-g>div{border-color:var(--dl)}.st.s-dk .st-t{color:#fff}.st.s-dk .st-t span{color:#8f9197}.st.s-dk .lb{background:rgba(109,155,255,.16);color:#a9c4ff}
.pg.s-dk h3{color:#fff}.pg.s-dk p{color:#8f9197}.pg.s-dk svg{stroke:#fff}.pg.s-dk i{color:#7f8187}
.bl.s-bl{background:var(--blue);color:#fff;border-color:transparent}.bl.s-bl .bl-i{border-color:rgba(255,255,255,.2)}
.sp.s-dkp .sp-p{background:#101010}
/* ============ shapes of the same pieces ============ */
.st.v-c .st-i{text-align:center;padding-bottom:clamp(112px,8.4vw,160px)}.st.v-c .st-t{margin-left:auto;margin-right:auto;text-wrap:balance}
.st.v-2 .st-t{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(24px,4vw,76px);max-width:none}.st.v-2 .st-t span{font-size:.62em;line-height:1.36;letter-spacing:-.014em;align-self:end}
.st.v-xl .st-t{max-width:15em;font-size:clamp(36px,3.5vw,68px);line-height:1.04;letter-spacing:-.04em}.st.v-xl .st-t span{display:block;margin-top:.7em;max-width:31em;font-size:.4em;line-height:1.36;letter-spacing:-.012em}
.bl.v-sf p{max-width:19em;font:400 clamp(30px,3vw,58px)/1.14 Georgia,"Times New Roman",serif;letter-spacing:-.022em}
.bl.v-xl p{max-width:13em;font-size:clamp(40px,4.8vw,92px);line-height:1;letter-spacing:-.05em}
.bl.v-l .bl-i{text-align:left;padding-left:var(--pad);padding-right:var(--pad)}.bl.v-l p{margin-left:0}
.sx.v-c .sx-t{margin-left:auto;margin-right:auto;text-align:center;text-wrap:balance}
.sx.v-b .sx-i{display:flex;flex-direction:column-reverse}.sx.v-b .sx-t{margin:clamp(36px,3vw,56px) 0 0}
.pg.v-l .pg-g{grid-template-columns:minmax(0,1fr)}.pg.v-l .pg-g>div{display:grid;grid-template-columns:clamp(48px,5vw,90px) minmax(0,.6fr) minmax(0,1fr);gap:16px;align-items:baseline;min-height:0;padding-top:clamp(22px,1.8vw,34px);padding-bottom:clamp(22px,1.8vw,34px)}
.pg.v-l h3{margin:0;font-size:clamp(19px,1.4vw,26px);letter-spacing:-.022em}.pg.v-l p{margin:0;max-width:34em}.pg.v-l svg{align-self:center}
@media(min-width:1181px){
.sx.v-pin .sx-i{display:grid;grid-template-columns:minmax(0,.4fr) minmax(0,1fr);gap:clamp(28px,3.4vw,64px);align-items:start}.sx.v-pin .sx-t{position:sticky;top:110px;margin:0}
}
@media(min-width:861px){.sp.v-f .sp-t{order:2}.sp.v-f .sp-p{border-left:0;border-right:1px solid var(--ln)}}
/* ============ how one section hands over to the next ============ */
.t-sheet,.t-arc,.t-angle{position:relative;z-index:1;border-top:0!important;background-color:var(--g)}
.sx.wh.t-sheet,.sx.wh.t-arc,.sx.wh.t-angle,.bl.t-sheet,.bl.t-arc,.bl.t-angle,.qf.t-arc,.qc.t-arc{background-color:#fff}
.st.s-dk.t-sheet,.st.s-dk.t-arc,.st.s-dk.t-angle,.bl.s-dk.t-sheet,.bl.s-dk.t-arc,.bl.s-dk.t-angle,.pg.s-dk.t-sheet{background-color:var(--dk)}.bl.s-bl.t-arc,.bl.s-bl.t-sheet{background-color:var(--blue)}
.t-sheet{margin-top:-40px;border-radius:40px 40px 0 0;box-shadow:0 -30px 60px -34px rgba(16,16,16,.3)}
.t-arc{margin-top:-72px;border-radius:50% 50% 0 0/72px 72px 0 0}
.t-angle{margin-top:-5vw;padding-top:5vw;clip-path:polygon(0 5vw,100% 0,100% 100%,0 100%)}
.t-sheet>.w,.t-arc>.w{border-color:transparent!important}
.t-rule{border-top:8px solid var(--ink)!important}
section:has(+ .t-sheet)::after{content:"";display:block;height:40px}section:has(+ .t-arc)::after{content:"";display:block;height:72px}section:has(+ .t-angle)::after{content:"";display:block;height:5vw}
.t-exp{clip-path:inset(0 calc((1 - var(--p,1))*8%) 0 calc((1 - var(--p,1))*8%) round calc((1 - var(--p,1))*48px))}
@media(max-width:860px){
.st.v-2 .st-t{grid-template-columns:minmax(0,1fr);gap:14px}.st.v-2 .st-t span{font-size:.72em}.st.v-xl .st-t{font-size:32px}.st.v-xl .st-t span{font-size:.56em}
.bl.v-xl p{font-size:36px}.bl.v-sf p{font-size:28px}
.pg.v-l .pg-g>div{grid-template-columns:36px minmax(0,1fr);gap:6px 12px}.pg.v-l p{grid-column:2}
.t-sheet{margin-top:-28px;border-radius:28px 28px 0 0}.t-arc{margin-top:-40px;border-radius:50% 50% 0 0/40px 40px 0 0}
}
"""

# =====================================================================================
# Clean pass. Sam: not different designs. He wants what the founder quote on the homepage has: clean, calm, a small amount of
# information. So each build page is now five things and nothing else: its top, the problem set like that quote, its one diagram,
# its one line set the same way, and the questions folded shut. The rhythm rows above are no longer applied.
# =====================================================================================
def calm(big, small=''):
    return ('<section class="fq cq"><div class="w fq-i"><p class="cq-t">%s</p>%s</div></section>' % (big, ('<p class="cq-s">%s</p>' % small) if small else ''))


def pairs(sec):
    for pat in (r'<summary>(.*?)<i></i></summary><p>(.*?)</p>', r'<dt><span>(.*?)</span></dt><dd><span>(.*?)</span></dd>', r'<dt>(.*?)</dt><dd>(.*?)</dd>', r'<h3>(.*?)</h3><p>(.*?)</p>'):
        got = re.findall(pat, sec, re.S)
        if got:
            return got
    return []


OLDLINE = {'booking': ('The lead said yes. Then nobody picked a time.', 'A booked estimate is a job you can still win.'),
           'follow-up': ('A quote nobody chases is a job you gave away.', 'Each quote is followed up on a schedule and stops the moment there is an answer.'),
           'reviews': ('The shop with the reviews gets the call.', 'Most happy customers never leave a review because nobody asked.')}
CLEAN = [k for k in RHYTHM if k != 'integrations']


def clean(name, body):
    if name not in CLEAN:
        return body
    secs = re.findall(r'<section\b.*?</section>', body, re.S)
    kind = lambda x: KIND.get(re.match(r'<section class="([a-z0-9]+)', x).group(1), 'other')
    top = [x for x in secs if kind(x) == 'top'][0]; dia = [x for x in secs if kind(x) == 'sx'][:1]; fa_ = [x for x in secs if kind(x) == 'faq'][0]
    if name in X:
        prob = calm(ap(X[name][0][0]), ap(X[name][0][1]))
        wa, wb = (set(re.findall(r'[a-z]{4,}', t.lower())) for t in (X[name][0][0], BY[name]['line']))
        line_ = calm(ap(X[name][3])) if len(wa & wb) >= .5 * min(len(wa), len(wb)) else calm(ap(BY[name]['line']), ap(X[name][3]))
    else:
        st_ = [x for x in secs if kind(x) == 'st'][0]; m = re.search(r'<p class="st-t">(.*?) <span>(.*?)</span></p>', st_, re.S)
        prob = calm(m.group(1), m.group(2)); line_ = calm(*OLDLINE[name])
    if not dia:
        dia = [x for x in secs if kind(x) == 'sp'][:1]
    dia = [re.sub(r'^<section class="[^"]*"', '<section class="sx wh"', d, count=1) if d.startswith('<section class="sx') else d for d in dia]
    qa = pairs(fa_)[:3]; assert qa, name
    return top + prob + ''.join(dia) + line_ + qfold(qa).replace('<details open>', '<details>') + CL


CSS_CLEAN = r"""
.cq{border-top:1px solid var(--ln)}
.fq .cq-t{margin:0 auto;max-width:19em;font:400 clamp(27px,2.35vw,45px)/1.2 Georgia,"Times New Roman",serif;letter-spacing:-.018em;color:var(--ink);text-wrap:balance}
.fq .cq-t.fill span{color:#c9cbd0;transition:color .25s}.fq .cq-t.fill span.on{color:var(--ink)}
.fq .cq-s{margin:clamp(24px,2vw,38px) auto 0;max-width:34em;font-size:clamp(14.5px,.92vw,17px);line-height:1.5;color:var(--t2);text-wrap:balance}
.cq+.sx{border-top:0}.sx+.cq{border-top:1px solid var(--ln)}
@media(max-width:860px){.fq .cq-t{font-size:25px}}
"""

# =====================================================================================
# Full pass. Sam, after the clean pass: the pages need to be longer, carry more information, have their own designs, and some
# should have stronger transitions. So: every section a page had is back, the per-page rhythm rows are applied again, and each
# page gains what the old copy already had but the new pages never showed: the three signs, what we need from you and what we
# take care of, the points or the before/after if it was missing, its line in the homepage quote setting, and where it leads next.
# =====================================================================================
SIGNS_OLD = {'booking': ['Phone tag to find a time', 'Estimates nobody confirmed', 'Empty driveways'],
             'follow-up': ['Quotes sent and never mentioned again', 'Customers who say they forgot', 'No list of what is still open'],
             'reviews': ['Great jobs with no review to show for them', 'Asking only when you remember', 'A competitor with more stars and no better work']}
SHOWN = {'phone-agent', 'reminders', 'estimates', 'job-updates', 'referrals'}   # pages whose diagram already walks through the four points
YWT = {0: 't-wipe', 2: 't-door'}


def signs_sec(items, v):
    return ('<section class="sg sg%d"><div class="w sg-i"><p class="sg-t">How you know you have it</p><ol>%s</ol></div></section>' % (v, ''.join('<li>%s</li>' % ap(t) for t in items)))


def yw_sec(group, v):
    need, take = pages2.YW[group]
    col = lambda t, items: '<div><h3>%s</h3><ul>%s</ul></div>' % (t, ''.join('<li>%s</li>' % ap(x) for x in items))
    return '<section class="yw yw%d %s"><div class="w yw-g">%s%s</div></section>' % (v, YWT.get(v, ''), col('What we need from you', need), col('What we take care of', take))


def next_sec(name):
    sib = ORDER[BY[name]['group']]; i = sib.index(name); others = [sib[(i + k) % len(sib)] for k in range(1, len(sib))][:3]
    if len(others) < 3:
        others += [x for x in ('answering', 'booking', 'follow-up', 'reviews') if x != name and x not in others][:3 - len(others)]
    return ('<section class="nx"><div class="w nx-i"><p class="nx-t">Works with the rest.</p><div class="nx-g"><div class="on"><b>%s</b><span>%s</span></div>%s</div></div></section>'
            % (BY[name]['name'], ap(BY[name]['short']), ''.join('<a href="/%s"><b>%s</b><span>%s</span></a>' % (o, BY[o]['name'], ap(BY[o]['short'])) for o in others)))


def full(name, body):
    if name not in CLEAN:
        return body
    i = CLEAN.index(name); body = restyle(name, body)
    secs = re.findall(r'<section\b.*?</section>', body, re.S)
    kind = lambda x: KIND.get(re.match(r'<section class="([a-z0-9]+)', x).group(1), 'other')
    top = [x for x in secs if kind(x) == 'top']; fa_ = [x for x in secs if kind(x) == 'faq']; mid = [x for x in secs if kind(x) not in ('top', 'faq', 'cl')]
    kinds = [kind(x) for x in mid]; p = BY[name]; mods = RHYTHM[name][1]
    sg = signs_sec(X[name][1] if name in X else SIGNS_OLD[name], i % 3)
    wa = set()
    if name in X:   # a page should not say the same sentence twice
        wa = set(re.findall(r'[a-z]{4,}', X[name][0][0].lower()))
        same = lambda x: len(wa & set(re.findall(r'[a-z]{4,}', re.sub(r'<[^>]+>', ' ', x).lower()))) >= .5 * len(wa)
        mid = [x for x in mid if not (kind(x) == 'bl' and same(x))]
    if name != 'phone-agent':   # its Recents card already shows the three signs
        mid.insert(([kind(x) for x in mid].index('st') + 1) if 'st' in kinds else 1, sg)
    extra = []
    if 'does' in p and 'pg' not in kinds and name not in SHOWN:
        extra.append(numbered(p['does']).replace('<section class="pg ', '<section class="pg %s ' % ('v-l' if i % 2 else ''), 1))
    if 'cmp' in p and not any('class="sw"' in x for x in mid):
        extra.append(H.split('What changes', 'Before and after.' if ap(X[name][3]) in body else ap(X[name][3]), '', swap(p['cmp'])).replace('<section class="sp"', '<section class="sp %s"' % ('v-f' if i % 2 else 's-dkp'), 1))
    if 'bl' not in kinds and 'line' in p:
        lw = set(re.findall(r'[a-z]{4,}', p['line'].lower())); first = ap(p['line']).split('.')[0]
        if not (len(lw & wa) >= .5 * len(lw) or first in body):
            extra.append(calm(ap(p['line'])))
    return ''.join(top + mid + extra + [yw_sec(p['group'], (i + 1) % 3)] + fa_ + [next_sec(name), CL])


CSS_FULL = r"""
/* the three signs, three ways */
.sg{border-top:1px solid var(--ln)}.sg-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(64px,5.4vw,104px) var(--pad)}
.sg-t{margin:0 0 clamp(20px,1.8vw,32px);font:500 12px/1 "Geist Mono",monospace;color:var(--t3)}
.sg ol{list-style:none;margin:0;padding:0;counter-reset:g}.sg li{counter-increment:g}
.sg0 li{display:flex;gap:clamp(18px,2vw,36px);align-items:baseline;padding:clamp(16px,1.5vw,28px) 0;border-top:1px solid var(--ln);font-size:clamp(22px,2vw,38px);line-height:1.12;font-weight:540;letter-spacing:-.03em}
.sg0 li::before{content:"0" counter(g);font:500 12px/1 "Geist Mono",monospace;color:var(--red);letter-spacing:0}
.sg1{background:linear-gradient(180deg,#f6f8ff,#e6ebfd)}.sg1 ol{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(12px,1.2vw,22px)}
.sg1 li{padding:clamp(20px,1.8vw,34px);border-radius:16px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.06),0 20px 40px -28px rgba(30,40,110,.4);font-size:clamp(17px,1.25vw,24px);line-height:1.2;font-weight:540;letter-spacing:-.02em}
.sg1 li::before{content:"";display:block;width:10px;height:10px;margin-bottom:clamp(28px,3vw,56px);border-radius:3px;background:var(--red)}
.sg2{background:var(--dk);color:#fff;border-top:0}.sg2 .sg-i{border-color:var(--dl)}.sg2 .sg-t{color:#8f9197}.sg2 ol{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.sg2 li{padding:0 clamp(18px,2vw,36px) 0 0;font:400 clamp(21px,1.7vw,32px)/1.2 Georgia,serif;letter-spacing:-.014em}.sg2 li::before{content:counter(g);display:block;margin-bottom:14px;font:500 12px/1 "Geist Mono",monospace;color:#e5484d;letter-spacing:0}
/* what we need, what we take care of, three ways */
.yw{border-top:1px solid var(--ln)}.yw-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.yw-g>div{padding:clamp(64px,5.4vw,104px) var(--pad)}.yw-g>div+div{border-left:1px solid var(--ln)}
.yw h3{margin:0 0 clamp(20px,1.8vw,32px);font-size:clamp(25px,1.8vw,34px);font-weight:500;letter-spacing:-.028em}
.yw ul{list-style:none;margin:0;padding:0}.yw li{padding:clamp(13px,1.1vw,20px) 0;border-top:1px solid var(--ln);font-size:clamp(15.5px,1vw,19px);line-height:1.36;letter-spacing:-.01em}
.yw0{background:var(--dk);color:#fff;border-top:0}.yw0 .yw-g,.yw0 .yw-g>div,.yw0 li{border-color:var(--dl)}.yw0 li{color:#d6d7da}.yw0 .yw-g>div:first-child h3{color:#8f9197}
.yw1 .yw-g{gap:clamp(12px,1.2vw,22px);padding:clamp(64px,5.4vw,104px) var(--pad)}.yw1 .yw-g>div{padding:clamp(22px,2vw,38px);border:0;border-radius:18px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.06),0 20px 40px -28px rgba(30,40,80,.3)}
.yw1 .yw-g>div+div{background:var(--ink);color:#fff}.yw1 .yw-g>div+div li{border-color:rgba(255,255,255,.12)}
.yw2{background:linear-gradient(180deg,#f6f8ff,#e6ebfd)}.yw2 .yw-g>div+div h3{color:var(--blue)}.yw2 li{border-color:rgba(38,109,240,.16)}
/* two more ways in, both driven by the scroll */
.t-wipe{clip-path:circle(calc(6vmax + var(--p,1)*150vmax) at 50% 0)}
.t-door{clip-path:inset(0 calc((1 - var(--p,1))*36%) round calc((1 - var(--p,1))*40px))}
.cq+.yw,.sp+.yw{border-top:1px solid var(--ln)}
@media(max-width:860px){.sg1 ol,.sg2 ol,.yw-g{grid-template-columns:minmax(0,1fr)}.sg2 li{padding:0 0 22px}.sg0 li{font-size:22px}.yw-g>div{padding:44px var(--pad)}.yw-g>div+div{border-left:0;border-top:1px solid var(--ln)}.yw0 .yw-g>div+div{border-color:var(--dl)}.yw1 .yw-g{padding:44px var(--pad)}.yw1 .yw-g>div{padding:22px}}
"""

# =====================================================================================
# Pinned scenes. Sam: the most used pages should be much longer and more intricate, with other pages appearing inside them as
# pictures that build, move and change as you scroll. A stage pins to the screen; each scene is another page's picture, and its
# rows arrive one by one as the scroll moves through it. Without motion, or on a phone, the scenes are simply stacked.
# =====================================================================================
def stage(label, title, scenes):
    caps = ''.join('<li class="sc-c%s"><b>%s</b><span>%s</span>%s</li>' % (' on' if i == 0 else '', t, x, ('<a href="%s">%s %s</a>' % (href, link, ARROW)) if href else '') for i, (t, x, href, link, _) in enumerate(scenes))
    pics = ''.join('<div class="sc-s%s"><p class="sc-k"><b>%s</b> %s</p>%s</div>' % (' on' if i == 0 else '', t, x, g) for i, (t, x, _, _, g) in enumerate(scenes))
    return ('<section class="sc" style="--n:%d"><div class="sc-p"><div class="w sc-g"><div class="sc-l"><span class="lb">%s</span><p class="st-t">%s</p><div class="sc-x"><div class="sc-b"><i></i></div><ol>%s</ol></div></div><div class="sc-r">%s</div></div></div></section>'
            % (len(scenes), label, title, caps, pics))


LEAD = stage('One lead, start to finish', 'Follow one lead through the business.', [
    ('A call rings out. A reply goes out.', 'A missed call at 7:42 PM gets a text back in seconds, with times to pick from.', '', '', THREAD),
    ('It lands on your calendar.', 'The lead picks from times you are actually free. Reminders are set the moment it books.', '/booking', 'Booking', WEEK),
    ('The quote gets chased.', 'Days 2, 5 and 10, then monthly, until it is a yes or a no.', '/follow-up', 'Follow-up', QUOTE),
    ('The invoice goes out and gets paid.', 'Sent the day the job ends, with polite reminders until it is settled.', '/invoicing', 'Invoices', INVOICE),
    ('They get asked for a review.', 'A short text with a direct link, while the job is fresh.', '/reviews', 'Reviews', ASK)])
DAYAPP = stage('One day in the app', 'What it did while you were on the job.', [
    ('Every lead gets an answer in seconds.', 'Calls, texts, forms and lead sites. Day or night, the reply goes out from your number.', '/answering', 'Answering', INBOX),
    ('Estimates land on your calendar.', 'Leads pick from times you&rsquo;re actually free. You just show up.', '/booking', 'Booking', WEEK),
    ('Every quote gets chased.', 'Day 2, day 5, day 10, then monthly. It stops the moment they answer.', '/follow-up', 'Follow-up', OPEN),
    ('Invoices chase themselves.', 'Reminders go out with your own pay link until it&rsquo;s settled.', '/invoicing', 'Invoices', AGING),
    ('Your numbers, every Monday.', 'Leads in, jobs booked, quotes open, money owed and what needs you.', '/reports', 'Reports', REPORT_PH)])


def flag(name, body):
    secs = re.findall(r'<section\b.*?</section>', body, re.S)
    if ''.join(secs) != body:
        return body
    if name == 'answering':
        return ''.join((portal('blinds', 'After the reply', 'One lead, start to finish.') + LEAD) if x.startswith('<section class="hw"') else x for x in secs)
    if name == 'everything':
        return ''.join((portal('diamond', '32 builds', 'Eight parts of a business.') + x) if x.startswith('<section class="bn"') else x for x in secs)
    if name == 'story':
        seen = [0]
        def sw(x):
            if x.startswith('<section class="chp"'):
                seen[0] += 1
                if seen[0] == 2:
                    return portal('bands', '02', 'The approach')
            return x
        return ''.join(sw(x) for x in secs)
    if name == 'software':
        return ''.join((portal('iris', 'The app', 'One day in the app.') + DAYAPP.replace('<section class="sc"', '<section class="sc k2"', 1) + x) if 'class="duo"' in x else x for x in secs).replace(AUDITLINK, '<a class="btn q" href="/day">See one day, start to finish</a>', 1)
    return body


CSS_STAGE = r"""
.sc{background:var(--dk);color:#fff}
.sc-g{border-left:1px solid var(--dl);border-right:1px solid var(--dl);padding:clamp(72px,6vw,112px) var(--pad)}
.sc .lb{background:rgba(109,155,255,.16);color:#a9c4ff}.sc .st-t{color:#fff;max-width:12em;font-size:clamp(27px,1.95vw,37px)}
.sc-l ol,.sc-b{display:none}
.sc-r{display:grid;gap:clamp(40px,4vw,72px);margin-top:clamp(36px,3vw,56px)}
.sc-s{display:grid;gap:18px;justify-items:center}.sc-s>*{max-width:100%}
.sc-k{justify-self:start;margin:0;max-width:30em;font-size:clamp(15px,1vw,18px);line-height:1.4;color:#a3a5aa}.sc-k b{display:block;margin-bottom:4px;color:#fff;font-size:clamp(18px,1.3vw,24px);font-weight:540;letter-spacing:-.02em}
.sc .ph-k{display:none}
.sc .cd,.sc .rvw,.sc .ph-s{color:var(--ink)}
.sc.live{height:calc(var(--n)*82vh + 100vh)}
.sc.live .sc-p{position:sticky;top:0;height:100vh;display:flex;align-items:center}
.sc.live .sc-g{display:grid;grid-template-columns:minmax(0,.44fr) minmax(0,1fr);gap:clamp(28px,4vw,76px);align-items:center;width:min(1390px,calc(100vw - 200px));height:100%;padding-top:clamp(84px,7vh,110px);padding-bottom:clamp(28px,4vh,56px);box-sizing:border-box}
.sc.live .sc-k{display:none}
.sc.live .sc-x{position:relative;margin-top:clamp(28px,4vh,52px);padding-left:22px}
.sc.live .sc-b{display:block;position:absolute;left:0;top:6px;bottom:6px;width:2px;border-radius:1px;background:rgba(255,255,255,.14)}.sc-b i{display:block;width:100%;height:100%;background:#6d9bff;transform-origin:top;transform:scaleY(0)}
.sc.live ol{display:block;list-style:none;margin:0;padding:0}
.sc.live .sc-c{padding:clamp(9px,1.3vh,14px) 0;cursor:pointer;opacity:.38;transition:opacity .3s}.sc.live .sc-c.on{opacity:1;cursor:default}
.sc-c b{display:block;font-size:clamp(17px,1.25vw,23px);font-weight:540;letter-spacing:-.02em;line-height:1.16}
.sc-c span,.sc-c a{display:block;max-height:0;overflow:hidden;opacity:0;transition:max-height .45s,opacity .35s,margin .45s}
.sc-c span{max-width:24em;font-size:clamp(14px,.9vw,16.5px);line-height:1.4;color:#a3a5aa}
.sc-c a{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:540;color:#a9c4ff}.sc-c a svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.sc-c.on span{max-height:6em;opacity:1;margin-top:8px}.sc-c.on a{max-height:2em;opacity:1;margin-top:10px}
.sc.live .sc-r{position:relative;display:block;margin:0;height:min(660px,74vh)}
.sc.live .sc-s{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transform:translateY(56px) scale(.94);transition:opacity .4s,transform .7s cubic-bezier(.2,.7,.2,1);pointer-events:none}
.sc.live .sc-s.on{opacity:1;transform:none;pointer-events:auto}.sc.live .sc-s.past{transform:translateY(-56px) scale(.94)}
.sc.live .bi{opacity:0;transform:translateY(10px);transition:opacity .35s,transform .45s cubic-bezier(.2,.7,.2,1)}.sc.live .bi.in{opacity:1;transform:none}
.sc.live .wkc-g i.bi{transform:scale(.8)}.sc.live .wkc-g i.bi.in{transform:none}
@media(min-width:1700px){.sc.live .sc-s>*{zoom:1.12}}
@media(max-height:760px){.sc.live .sc-s>*{zoom:.86}}
"""

# =====================================================================================
# /day : a whole page that is only pictures and scroll. The sky behind it runs from dawn to night as you scroll, with a sun,
# clouds and stars; each chapter pins, its picture builds, then it clears and the sky changes before the next one arrives.
# Every line is existing copy from the build pages; the pictures are theirs too.
# =====================================================================================
# One side moves, the other stays. Two kinds of section, never both sides changing at once:
#   words()  the words scroll past on one side while one picture stays put on the other;
#   design() the words stay put while an abstract drawing (not a product picture) builds on the other side as you scroll.
# portal() is the homepage clock idea in other shapes: a pinned screen where the next dark section opens out of the light one.
def words(blocks, pic, flip=False):
    return ('<section class="wsc%s"><div class="w wsc-g"><div class="wsc-w">%s</div><div class="wsc-p"><div class="wsc-s">%s</div></div></div></section>'
            % (' f' if flip else '', ''.join('<div>%s<h2>%s</h2><p>%s</p></div>' % (('<time>%s</time>' % t) if t else '', a, b) for t, a, b in blocks), pic))


def design(kind, line_, small, href, link, dark_=False, cls=''):
    return ('<section class="dsn dsn-%s%s __CLS__" data-sp><div class="w dsn-g"><div class="dsn-t"><h2>%s</h2><p>%s</p><a class="btn q" href="%s">%s</a></div><div class="dsn-d">%s</div></div></section>'
            % (kind, ' dk' if dark_ else '', line_, small, href, link, DRAW[kind])).replace('__CLS__', cls)


def portal(kind, label, title):
    return '<section class="pt pt-%s" data-sp><div class="pt-s"><div class="pt-a"><span>%s</span></div><div class="pt-d"><h2>%s</h2></div></div></section>' % (kind, label, title)


import math
_ticks = ''.join('<line x1="200" y1="%d" x2="200" y2="%d" transform="rotate(%.1f 200 200)" style="--i:%d"/>' % (22, 40 if t % 4 else 52, t * 7.5, t) for t in range(48))
DRAW = {
    'dial': '<svg viewBox="0 0 400 400" aria-hidden="true"><circle class="r0" cx="200" cy="200" r="196"/>%s<circle class="r1" cx="200" cy="200" r="150" transform="rotate(-90 200 200)"/><circle class="r2" cx="200" cy="200" r="112" transform="rotate(30 200 200)"/>'
            '<circle class="r3" cx="200" cy="200" r="74" transform="rotate(150 200 200)"/><line class="hd" x1="200" y1="200" x2="200" y2="64"/><circle class="c" cx="200" cy="200" r="7"/></svg>' % _ticks,
    'stack': '<div class="stk" aria-hidden="true">%s</div>' % ''.join('<i class="%s" style="--i:%d;width:%d%%"></i>' % (c, n, w) for n, (c, w) in enumerate(
        [('k', 96), ('', 82), ('b', 90), ('', 66), ('k', 78), ('o', 58), ('b', 70), ('', 48), ('k', 60), ('b', 36)])),
    'dots': '<div class="dts" aria-hidden="true">%s</div>' % ''.join('<i class="%s" style="--i:%d"></i>' % ('b' if ORD % 9 == 0 else '', ORD) for ORD in [92, 32, 57, 22, 0, 99, 67, 90, 42, 14, 59, 78, 89, 24, 38, 26, 107, 87, 47, 1, 25, 48, 86, 10, 101, 75, 16, 52, 2, 56, 102, 77, 21, 49, 33, 60, 84, 51, 88, 66, 106, 58, 44, 62, 29, 20, 95, 34, 43, 31, 63, 65, 3, 61, 94, 45, 35, 76, 96, 100, 40, 36, 69, 13, 23, 39, 104, 18, 91, 37, 17, 71, 5, 82, 103, 105, 79, 73, 85, 98, 81, 80, 28, 15, 72, 97, 54, 70, 93, 30, 8, 53, 55, 11, 4, 27, 64, 7, 74, 46, 12, 68, 9, 6, 83, 50, 19, 41]),
}
DRAW['dotsfs'] = '<div class="dts" aria-hidden="true">%s</div>' % ''.join('<i class="%s" style="--i:%d"></i>' % ('b' if q % 11 == 0 else '', q) for q in [168, 249, 55, 180, 41, 67, 242, 12, 52, 209, 196, 176, 93, 128, 256, 216, 99, 46, 123, 156, 43, 56, 90, 14, 259, 147, 116, 89, 68, 138, 164, 237, 226, 38, 262, 105, 110, 122, 203, 57, 239, 244, 133, 192, 44, 42, 204, 60, 51, 134, 205, 219, 252, 220, 146, 213, 125, 64, 208, 160, 28, 222, 109, 72, 198, 158, 191, 35, 126, 91, 103, 154, 8, 170, 217, 233, 62, 236, 88, 82, 174, 165, 32, 202, 187, 171, 182, 6, 140, 136, 142, 221, 108, 87, 250, 70, 111, 258, 20, 24, 92, 121, 78, 148, 39, 19, 201, 251, 49, 188, 197, 106, 248, 129, 232, 224, 211, 223, 139, 76, 234, 31, 81, 190, 26, 11, 230, 247, 149, 214, 84, 186, 66, 113, 145, 37, 245, 246, 100, 47, 183, 5, 253, 173, 185, 184, 150, 179, 29, 240, 178, 33, 155, 130, 254, 229, 143, 45, 124, 119, 261, 2, 25, 63, 34, 30, 206, 235, 85, 79, 22, 86, 69, 172, 218, 161, 200, 18, 107, 257, 96, 120, 13, 53, 54, 0, 175, 4, 195, 98, 74, 193, 102, 27, 144, 17, 228, 73, 131, 58, 194, 80, 65, 181, 210, 141, 104, 71, 241, 117, 21, 169, 1, 127, 75, 163, 59, 132, 50, 215, 151, 112, 83, 118, 199, 7, 153, 61, 225, 255, 9, 15, 16, 135, 212, 3, 159, 40, 166, 157, 189, 167, 115, 101, 152, 10, 162, 177, 227, 207, 137, 23, 36, 77, 114, 48, 95, 243, 94, 97, 260, 263, 238, 231])


def spine(title, events):
    return ('<section class="spn" data-sp><div class="spn-s"><p class="spn-h">%s</p><div class="spn-b"><div class="spn-l"><i></i></div><ol>%s</ol></div></div></section>'
            % (title, ''.join('<li class="%s" style="--i:%d"><time>%s</time><b>%s</b></li>' % ('l' if n % 2 == 0 else 'r', n, t, x) for n, (t, x) in enumerate(events))))


DAYP = ('<div class="dayp2">'
        + '<section class="dhero"><div class="w dhero-i"><span class="lb">A day with it running</span><h1>One day, start to finish.</h1><p class="sub">Scroll through a day at an example business. The pictures are sample data.</p><div class="cta">%s</div><em>Scroll</em></div></section>' % BOOK
        + spine('One day at an example business', [('6:31 AM', 'A form came in. Answered and booked.'), ('9:12 AM', 'A missed call. A text back in 9 seconds.'), ('12:40 PM', 'One job ran long. Two stops moved.'),
                                                   ('4:12 PM', 'The job ended. The invoice went out.'), ('6:05 PM', 'Monday&rsquo;s quote got its check-in.'), ('2:07 AM', 'A burst pipe. The on-call phone rang.')])
        + words([('9:12 AM', 'The phone rings while you&rsquo;re on a roof.', 'It still gets answered.'),
                 ('', 'A reply goes out in seconds.', 'Sorry we missed you, with times to pick from. No callback list.'),
                 ('', 'It all lands in your app.', 'The thread, the lead and what happens next, in one place.')], THREAD)
        + design('dial', 'One job running long should not cost you the afternoon.', 'The day adjusts without you making the calls.', '/dispatch', 'Scheduling and dispatch')
        + portal('line', '4:12 PM', 'Invoices go out when the job is done.')
        + words([('', 'Friendly first, firmer later.', 'And never from you personally.'),
                 ('', 'They stop the moment it is paid.', 'You can stop them for one customer in one tap.'),
                 ('', 'You get paid without being the one who asks.', 'What is outstanding, by customer and by age.')], INVOICE, True)
        + design('stack', 'A quote nobody chases is a job you gave away.', 'Days 2, 5 and 10, then monthly, until it&rsquo;s a yes or a no.', '/follow-up', 'Follow-up', False, 'f')
        + design('dotsfs', 'Only the real emergencies wake you.', 'The burst pipe at 2 AM and the quote request at 2 AM are not the same call.', '/after-hours', 'After hours', True, 'fs')
        + '</div>' + CL)

CSS_DAY = r"""
.dayp2{background:#fff}
.dhero{background:#fff;border-bottom:1px solid var(--ln)}.dhero-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);text-align:center;padding:clamp(96px,12vh,180px) 24px clamp(88px,11vh,160px);min-height:calc(100vh - 61px);box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center}
.dhero h1{margin:20px auto 0;max-width:10em;font-size:clamp(44px,5.4vw,104px);line-height:.98;letter-spacing:-.05em;font-weight:600;white-space:normal}
.dhero .sub{margin:20px auto 0}.dhero em{margin-top:clamp(40px,6vh,80px);font:500 12px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3)}
/* words scroll, the picture stays */
.wsc{background:#fff;border-bottom:1px solid var(--ln)}
.wsc-g{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.wsc-w>div{display:flex;flex-direction:column;justify-content:center;min-height:88vh;padding:0 var(--pad)}
.wsc time{margin-bottom:22px;font:500 13px/1 "Geist Mono",monospace;color:var(--t3)}
.wsc h2,.dsn h2{margin:0;max-width:12em;font:400 clamp(30px,3.1vw,58px)/1.12 Georgia,"Times New Roman",serif;letter-spacing:-.022em;text-wrap:balance}
.wsc p,.dsn p{margin:clamp(16px,1.4vw,26px) 0 0;max-width:23em;font-size:clamp(16px,1.15vw,21px);line-height:1.45;color:var(--t2)}
.wsc-p{border-left:1px solid var(--ln);background:var(--pn)}
.wsc-s{position:sticky;top:60px;height:calc(100vh - 60px);display:flex;align-items:center;justify-content:center;padding:0 clamp(20px,3vw,56px);box-sizing:border-box}.wsc-s>*{max-width:100%}
.wsc.f .wsc-w{order:2}.wsc.f .wsc-p{border-left:0;border-right:1px solid var(--ln)}
/* the words stay, a drawing builds */
.dsn{background:#fff;border-bottom:1px solid var(--ln)}.dsn.dk{background:var(--dk);color:#fff;border-bottom:0}
.dsn-g{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);align-items:center;border-left:1px solid var(--ln);border-right:1px solid var(--ln);min-height:88vh;box-sizing:border-box}.dsn.dk .dsn-g{border-color:var(--dl)}
.dsn-t{padding:0 var(--pad)}.dsn .btn{margin-top:clamp(22px,2vw,36px)}.dsn.dk p{color:#a3a5aa}
.dsn-d{display:flex;align-items:center;justify-content:center;height:100%;padding:clamp(28px,4vw,72px);box-sizing:border-box;border-left:1px solid var(--ln)}.dsn.dk .dsn-d{border-color:var(--dl)}
.dsn.sp-live{height:300vh}.dsn.sp-live .dsn-g{position:sticky;top:0;height:100vh;padding-top:60px}
.dsn svg{width:min(560px,100%);height:auto;overflow:visible}
.dsn svg circle,.dsn svg line{fill:none;stroke:var(--ink);stroke-width:1.5;stroke-linecap:round}
.dsn .r0{stroke:var(--ln)}.dsn svg line[style]{opacity:clamp(.14,calc(var(--p,1)*52 - var(--i)),1)}
.dsn .r1{stroke-width:10;stroke:var(--blue);stroke-dasharray:942;stroke-dashoffset:calc((1 - var(--p,1))*942)}
.dsn .r2{stroke-width:22;stroke:var(--ink);stroke-dasharray:704;stroke-dashoffset:calc((1 - min(var(--p,1)*1.5,1))*704)}
.dsn .r3{stroke-width:34;stroke:#dfe6fb;stroke-dasharray:465;stroke-dashoffset:calc((1 - min(var(--p,1)*2.2,1))*465)}
.dsn .hd{stroke-width:3;transform-origin:200px 200px;transform:rotate(calc(var(--p,1)*360deg))}.dsn .c{fill:var(--ink)}
.stk{display:flex;flex-direction:column-reverse;align-items:center;gap:10px;width:min(520px,100%)}
.stk i{--q:clamp(0,calc(var(--p,1)*11.5 - var(--i)),1);height:clamp(26px,3.6vh,40px);border-radius:10px;background:#eceef2;opacity:var(--q);transform:translateY(calc((1 - var(--q))*-90px)) rotate(calc((1 - var(--q))*-4deg))}
.stk i.k{background:var(--ink)}.stk i.b{background:var(--blue)}.stk i.o{background:none;box-shadow:inset 0 0 0 1.5px var(--ink)}
.dts{display:grid;grid-template-columns:repeat(12,1fr);gap:clamp(8px,1.1vw,18px);width:min(560px,100%)}
.dts i{position:relative;aspect-ratio:1;border-radius:50%;background:rgba(255,255,255,.1)}
.dts i::after{content:"";position:absolute;inset:0;border-radius:50%;background:#fff;opacity:clamp(0,calc(var(--p,1)*var(--n) - var(--i)),1);transform:scale(clamp(.2,calc(var(--p,1)*var(--n) - var(--i)),1))}
.dts i.b::after{background:#6d9bff}
/* the clock idea, in other shapes */
.pt{background:var(--dk);color:#fff}.pt-s{display:grid;place-items:center;padding:clamp(96px,10vw,180px) 24px;text-align:center}.pt-a{display:none}
.pt h2{margin:0 auto;max-width:13em;font-size:clamp(34px,4.4vw,84px);line-height:1.02;letter-spacing:-.045em;font-weight:600;text-wrap:balance}
.pt.sp-live{height:260vh;background:#fff}
.pt.sp-live .pt-s{position:sticky;top:0;height:100vh;padding:0;overflow:hidden;box-sizing:border-box}
.pt.sp-live .pt-a{display:grid;place-items:center;position:absolute;inset:0;color:var(--ink)}
.pt-a span{font:500 clamp(14px,1.1vw,18px)/1 "Geist Mono",monospace;color:var(--t2);opacity:calc(1 - var(--p,0)*3)}
.pt.sp-live .pt-d{position:absolute;inset:0;display:grid;place-items:center;padding:0 24px;background:var(--dk)}
.pt.sp-live .pt-d h2{opacity:clamp(0,calc(var(--p,0)*4 - 2.2),1);transform:translateY(calc((1 - clamp(0,calc(var(--p,0)*4 - 2.2),1))*40px))}
.pt-line.sp-live .pt-d{--a:min(calc(var(--p,0)*3),1);--b:clamp(0,calc(var(--p,0)*2.6 - .95),1);clip-path:inset(0 calc((1 - var(--b))*50% - 1.5px) calc((1 - var(--a))*100%) calc((1 - var(--b))*50% - 1.5px))}
.pt-line.sp-live .pt-s::after{content:"";position:absolute;left:50%;top:0;width:11px;height:11px;margin:-5px 0 0 -5.5px;border-radius:50%;background:var(--blue);transform:translateY(calc(min(var(--p,0)*3,1)*100vh));opacity:calc(1 - clamp(0,calc(var(--p,0)*2.6 - .95),1)*4)}
.pt-bands.sp-live .pt-d{--m:linear-gradient(#000 0 0);-webkit-mask:var(--m) 0 0/calc(clamp(0,calc(var(--p,0)*2.4),1)*100%) 17% no-repeat,var(--m) 100% 20%/calc(clamp(0,calc(var(--p,0)*2.4 - .18),1)*100%) 17% no-repeat,var(--m) 0 40%/calc(clamp(0,calc(var(--p,0)*2.4 - .36),1)*100%) 17% no-repeat,var(--m) 100% 60%/calc(clamp(0,calc(var(--p,0)*2.4 - .54),1)*100%) 17% no-repeat,var(--m) 0 80%/calc(clamp(0,calc(var(--p,0)*2.4 - .72),1)*100%) 17% no-repeat,var(--m) 100% 100%/calc(clamp(0,calc(var(--p,0)*2.4 - .9),1)*100%) 17% no-repeat;mask:var(--m) 0 0/calc(clamp(0,calc(var(--p,0)*2.4),1)*100%) 17% no-repeat,var(--m) 100% 20%/calc(clamp(0,calc(var(--p,0)*2.4 - .18),1)*100%) 17% no-repeat,var(--m) 0 40%/calc(clamp(0,calc(var(--p,0)*2.4 - .36),1)*100%) 17% no-repeat,var(--m) 100% 60%/calc(clamp(0,calc(var(--p,0)*2.4 - .54),1)*100%) 17% no-repeat,var(--m) 0 80%/calc(clamp(0,calc(var(--p,0)*2.4 - .72),1)*100%) 17% no-repeat,var(--m) 100% 100%/calc(clamp(0,calc(var(--p,0)*2.4 - .9),1)*100%) 17% no-repeat}
/* whole-screen pieces: a line down the middle with the day branching off it; a field of dots behind centred words */
.spn{background:#fff;border-bottom:1px solid var(--ln)}
.spn-s{padding:clamp(64px,7vw,120px) 24px}.spn-h{margin:0 0 clamp(28px,4vh,56px);text-align:center;font:500 13px/1 "Geist Mono",monospace;color:var(--t3)}
.spn-b{position:relative;max-width:1100px;margin:0 auto}.spn-l{position:absolute;left:50%;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--ln)}
.spn-l i{display:block;height:100%;background:var(--ink);transform-origin:top;transform:scaleY(var(--p,1))}
.spn-l::after{content:"";position:absolute;left:50%;top:calc(var(--p,1)*100%);width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:var(--blue);box-shadow:0 0 0 5px #fff}
.spn ol{list-style:none;margin:0;padding:0;display:grid}
.spn li{--q:clamp(0,calc(var(--p,1)*6.4 - var(--i) - .1),1);position:relative;width:50%;box-sizing:border-box;padding:clamp(14px,2.4vh,30px) clamp(28px,3.4vw,60px);opacity:var(--q)}
.spn li.l{text-align:right;transform:translateX(calc((1 - var(--q))*-40px))}.spn li.r{margin-left:50%;transform:translateX(calc((1 - var(--q))*40px))}
.spn li::before{content:"";position:absolute;top:50%;width:clamp(16px,2vw,34px);border-top:1.5px solid var(--ink)}.spn li.l::before{right:0}.spn li.r::before{left:0}
.spn time{display:block;font:500 12.5px/1 "Geist Mono",monospace;color:var(--blue)}
.spn b{display:block;margin-top:10px;font:400 clamp(21px,2.1vw,38px)/1.14 Georgia,"Times New Roman",serif;letter-spacing:-.018em}
.spn.sp-live{height:340vh}.spn.sp-live .spn-s{position:sticky;top:0;height:100vh;box-sizing:border-box;padding-top:clamp(84px,11vh,120px);padding-bottom:4vh;display:flex;flex-direction:column}
.spn.sp-live .spn-b{flex:1;width:100%}.spn.sp-live ol{height:100%;grid-template-rows:repeat(6,1fr)}.spn.sp-live li{display:flex;flex-direction:column;justify-content:center;padding-top:0;padding-bottom:0}
.dsn.f .dsn-t{order:2}.dsn.f .dsn-d{border-left:0;border-right:1px solid var(--ln)}
.dts{--n:118}.dsn.fs .dts{--n:290;grid-template-columns:repeat(24,1fr);width:100%;gap:clamp(6px,1vw,16px)}
.dsn.fs .dsn-g{display:block;position:relative;overflow:hidden}.dsn.fs .dsn-d{position:absolute;inset:60px 0 0;border:0;padding:clamp(20px,3vw,48px);align-items:center}
.dsn.fs .dsn-t{position:relative;z-index:1;display:grid;align-content:center;justify-items:center;min-height:88vh;height:100%;box-sizing:border-box;text-align:center;padding:60px 24px 0}
.dsn.fs .dsn-t::before{content:"";position:absolute;left:50%;top:50%;width:min(820px,86vw);height:min(460px,64vh);transform:translate(-50%,-46%);background:radial-gradient(closest-side,var(--dk) 58%,transparent);z-index:-1}
.dsn.fs.sp-live .dsn-g{position:sticky;top:0;height:100vh}.dsn.fs.sp-live .dsn-t{min-height:0}
.dsn.fs h2{max-width:14em}.dsn.fs p{margin-left:auto;margin-right:auto}
.pt-blinds.sp-live .pt-d{-webkit-mask:repeating-linear-gradient(90deg,#000 0 calc(min(var(--p,0)*1.5,1)*12.6vw),transparent 0 12.5vw);mask:repeating-linear-gradient(90deg,#000 0 calc(min(var(--p,0)*1.5,1)*12.6vw),transparent 0 12.5vw)}
.pt-diamond.sp-live .pt-d{--r:calc(min(var(--p,0)*1.5,1)*125vmax);clip-path:polygon(50% calc(50% - var(--r)),calc(50% + var(--r)) 50%,50% calc(50% + var(--r)),calc(50% - var(--r)) 50%)}
.pt-iris.sp-live .pt-d{--o:calc((1 - min(var(--p,0)*1.5,1))*50%);clip-path:inset(var(--o) var(--o) round calc((1 - min(var(--p,0)*1.5,1))*120px))}
@media(max-width:860px){.wsc-g,.dsn-g{grid-template-columns:minmax(0,1fr)}.wsc-p{order:-1;border:0!important;border-bottom:1px solid var(--ln)!important}.wsc-s{position:static;height:auto;padding:28px 14px}.wsc-w>div{min-height:0;padding:44px var(--pad)}.wsc.f .wsc-w{order:0}
.spn li,.spn li.r{width:auto;margin:0;text-align:left;transform:none;opacity:1;padding:16px 0 16px 28px}.spn-l{left:0}.spn li::before{left:0!important;right:auto!important;width:16px}.dsn.f .dsn-t{order:0}.dsn.fs .dsn-t{min-height:70vh}.dsn.fs .dts{grid-template-columns:repeat(12,1fr)}
.dsn-g{min-height:0}.dsn-t{padding:56px var(--pad) 8px}.dsn-d{border-left:0;padding:28px var(--pad) 56px}.wsc h2,.dsn h2{font-size:28px}}
"""

out = pathlib.Path(ROOT) / 'site'
CSS = CSS + CSS_DESK + CSS_CAL + CSS_AFT + CSS_TEAM + CSS_REST + CSS_RHY + CSS_CLEAN + CSS_FULL + CSS_STAGE + CSS_DAY
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
    ('invoicing', 'Invoices', 'The invoice is sent when the job is marked done, and polite reminders go out until it is settled.', INVOICING),
    ('bookkeeping', 'Bookkeeping prep', 'Receipts, supplier bills and job costs are read, labelled and filed against the right job, ready for your bookkeeper.', BOOKKEEPING),
    ('reviews', 'Reviews', 'Every finished job gets asked for a review, and your name keeps showing up where people look.', REVIEWS),
    ('review-replies', 'Review replies', 'New reviews get a reply drafted in your voice. Good ones are answered quickly, and a bad one comes to you first.', REVIEW_REPLIES),
    ('win-backs', 'Win-backs', 'Past customers and quotes that went quiet get a message from you at the right moment, written for them.', WIN_BACKS),
    ('maintenance-reminders', 'Service reminders', 'Work that comes around again, such as servicing, sealing, staining or inspections, gets a reminder when it is due.', MAINT),
    ('referrals', 'Referrals', 'After a good job and a good review, the customer is asked if they know someone who needs the same thing.', REFERRALS),
    ('campaigns', 'Email and text campaigns', 'Seasonal offers, openings in the schedule and news go to your own customers by email and text. No ad platform involved.', CAMPAIGNS),
    ('local-search', 'Local search', 'Your Google Business Profile gets regular posts, fresh photos, answered questions and correct details, without you logging in.', LOCAL),
    ('job-photos', 'Job photos to posts', 'The crew takes a photo when the job is done. It becomes a post for your profile, your site and your social pages.', JOB_PHOTOS),
    ('hiring', 'Hiring', 'Applicants are asked your questions, the ones who fit are booked for a call, and everyone gets an answer.', HIRING),
    ('team-assistant', 'Team assistant', 'Your price book, procedures and past jobs become something the crew can ask by text, and get your answer back.', TEAM_ASSISTANT),
    ('field-notes', 'Field notes', 'The crew records a voice note at the job. It comes back as clean notes, a materials list and next steps on the job record.', FIELD_NOTES),
    ('reports', 'Reports', 'One short report each week: leads in, jobs booked, quotes open, money owed and what needs you.', REPORTS),
    ('call-review', 'Call review', 'Calls are transcribed and summarised. The ones where a job was lost, or a customer was unhappy, are flagged for you.', CALL_REVIEW),
    ('custom-agents', 'Custom agents', 'An AI agent built to do one job in your business the way you do it, with your rules and your tools.', CUSTOM_AGENTS),
    ('integrations', 'Integrations', 'Cinder plugs into your calendar, your books and the places your leads come from, so nothing gets copied over by hand.', INTEGRATIONS),
    ('custom-builds', 'Custom builds', 'If your business has a job that eats your week and is not on the list, tell us. If it does not need a person, we can build it.', CUSTOM_BUILDS),
    ('software', 'The app', 'Every lead, estimate, quote and invoice in one place, with what needs you at the top. On your phone or your desk.', SOFTWARE),
    ('trades', 'Trades', 'For owner-run service businesses that sell estimates and quotes. Built first for fence, and it works for any trade that quotes.', TRADES),
    ('story', 'Our story', 'Why service businesses lose work they already earned, and what we do about it.', STORY),
    ('about', 'About', 'Cinder Revenue Company audits service businesses, then fixes what is costing them jobs. One founder, a few clients at a time.', ABOUT),
    ('questions', 'Questions', 'The questions owners ask before they book a free audit, answered plainly.', QUESTIONS),
    ('whats-new', 'What is new', 'What we have shipped to the app lately. Every client gets every update.', WHATSNEW),
    ('audit', 'Check your site', 'A free check of your website: what a homeowner runs into, what slow replies likely cost you each month, and what to fix first.', CHECKPAGE),
    ('privacy', 'Privacy policy', 'How Cinder Revenue Company collects and uses information through this website.', legal('privacy')),
    ('terms', 'Terms of use', 'The terms that apply to your use of the Cinder Revenue Company website.', legal('terms')),
    ('404', 'Page not found', 'This page does not exist.', NOTFOUND),
    ('day', 'One day, start to finish', 'A scroll through one day at an example business: what gets answered, booked, chased and paid while the owner is on the job.', DAYP),
    ('answering', 'Answering', 'Missed calls and new leads get a text back from your business in seconds, even after hours and while you are on a job.', ANSWERING),
]
if __name__ == '__main__':
    for slug, title, desc, body in PAGES:
        doc = page(title, desc, '/' + slug, full(slug, flag(slug, body)), css=PCSS, index=(slug not in ('404', 'day')))
        if slug == 'audit':
            doc = doc.replace('</body>', '<script src="/audit.js" defer></script></body>')
        (out / (slug + '.html')).write_text(doc)
    print('pages', [p[0] for p in PAGES], V)
