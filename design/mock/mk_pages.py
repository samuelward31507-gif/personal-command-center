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
# four leads through five questions: two run the whole way and are booked, two stop at the question they fail
_lvq = ['Job type', 'Size', 'Address', 'Timing', 'Budget range']
_lvl = [('Full install', 5, 'Booked Wed 2 PM', ''), ('Large project', 2, '90 miles out', 'Polite no'), ('Repair', 5, 'Booked Thu 11 AM', ''), ('A very small job', 1, 'Below your minimum', 'Polite no')]
LVGATE = ('<section class="lvg" data-in><div class="lvg-i"><div class="w lvg-f"><div class="lvg-t"><span class="lb">Asked before anyone drives out</span>'
          '<p class="st-t">%s <span>%s</span></p><p class="fa-k">[Four leads, five questions]<em>Example business, sample data</em></p></div>'
          '<div class="lvg-c" aria-hidden="true">%s%s</div></div></div></section>'
          % (ap(X['lead-vetting'][2]), ap(X['lead-vetting'][3]),
             ''.join('<span class="lvg-q" style="--x:%d%%">%s</span>' % (22 + k * 15, q) for k, q in enumerate(_lvq)),
             ''.join('<div class="lvg-l %s" style="--k:%d;--to:%d%%"><b>%s</b><i></i><em>%s</em>%s</div>'
                     % ('ok' if g == 5 else 'no', k, 92 if g == 5 else 22 + g * 15, n, tag, ('<u>%s</u>' % no) if no else '') for k, (n, g, tag, no) in enumerate(_lvl))))
# the five questions step through; the two lead cards beside them light the matching answer
def _lvcard(html):
    k = [0]
    def f(mm):
        k[0] += 1; return '<div data-sc="%d"%s><dt>' % (k[0] - 1, mm.group(1))
    return re.sub(r'<div( class="x")?><dt>', f, html)
LVACD = ('<section class="acd acd-w" data-live="2,2,2,2,2"><div class="w acd-g"><div class="acd-t"><span class="lb">The answers travel with the lead</span><p class="st-t">You walk in knowing what they said.</p>'
         '<div class="acd-l">%s</div></div><div class="acd-p"><div class="lc-g">%s%s</div><p class="sd-n">Example. Sample data.</p></div></div></section>'
         % (''.join('<div data-sc="%d"><b>%s.</b><span>%s</span><u data-at="0"></u></div>' % x for x in [
             (0, 'What is the job', 'Asked first, in your words.'), (1, 'How big', 'So a job below your minimum never reaches you.'), (2, 'Where', 'Out-of-area is caught before anyone drives.'),
             (3, 'When', 'This month and next year are not the same lead.'), (4, 'What budget', 'A range, not a negotiation.')]),
            _lvcard(lead('g', 'Good fit', [('Job type', 'Full install', 0), ('Size', 'A full job', 0), ('Address', 'Monument', 0), ('Timing', 'This month', 0), ('Budget range', 'In range', 0)], 'Booked for Wed 2 PM.')),
            _lvcard(lead('n', 'Not a fit', [('Job type', 'Large project', 0), ('Size', 'Very large', 0), ('Address', '90 miles out', 1), ('Timing', 'Next year', 0), ('Budget range', 'Not sure yet', 0)], 'A clear, polite no went out.'))))
LVCMP = ('<section class="lvc"><div class="w lvc-i"><p class="st-t">%s</p><div class="lvc-g">%s</div></div></section>'
         % (ap(p['line']), ''.join('<div><span>%s</span><b>%s</b></div>' % (ap(a), ap(b)) for a, b in p['cmp'])))
LEAD_VETTING = ('<section class="ih ih-l"><div class="w ih-i"><span class="lb">Front desk</span><h1>%s</h1><p class="sub">%s</p><div class="cta">%s%s</div></div><div class="ih-p"><div class="w ih-pi">%s</div></div></section>'
                % (ap(p['h1']), ap(p['lede']), BOOK, AUDITLINK, SORT)
                + statement('The problem', X['lead-vetting'][0][0], ap(X['lead-vetting'][0][1]))
                + LVGATE + LVACD + LVCMP
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
_wo = lambda at, to, t: '<i class="of" data-at="%d" data-to="%d">Open<u>%s</u></i>' % (at, to, t)        # an open time being offered
_we = lambda cls='': '<i class="%s"></i>' % cls
WEEK = ('<div class="cd wk">%s<div class="wkc-g">%s</div></div>' % (head('This week', 'Estimates and jobs'), ''.join(
    '<div><b>%s</b>%s</div>' % (d, ''.join(sl)) for d, sl in [
        ('Mon', ['<i class="j">Job<u>8:00 AM</u></i>', _we(), '<i class="j">Job<u>1:00 PM</u></i>']),
        ('Tue', ['<i class="e">Estimate<u>9:00 AM</u></i>', '<i class="j">Job<u>11:00 AM</u></i>', _we()]),
        ('Wed', ['<i class="j">Job<u>8:00 AM</u></i>', _we(), '<i class="em" data-at="0" data-to="1"></i>' + _wo(1, 4, '1:00 PM') + '<i class="em" data-at="4"></i>']),
        ('Thu', ['<i class="j">Job<u>8:00 AM</u></i>', _we(),
                 '<i class="em" data-at="0" data-to="1"></i>' + _wo(1, 4, '2:00 PM') + '<i class="e on" data-at="4" data-to="6">Estimate<u>2:00 PM</u></i><i class="e on" data-at="6" data-to="7">Estimate<u>Reminder sent</u></i><i class="e on" data-at="7">Estimate<u>Confirmed</u></i>']),
        ('Fri', ['<i class="em" data-at="0" data-to="1"></i>' + _wo(1, 4, '8:00 AM') + '<i class="em" data-at="4"></i>', '<i class="j">Job<u>10:00 AM</u></i>', _we()])])))
_pb = lambda at, who, text: '<p class="hb %s" data-at="%d">%s</p>' % (who, at, text)
BKLIVE = ('<div class="lvh" data-live="9">%s<div class="ph2" aria-hidden="true"><p>Customer&rsquo;s phone</p>%s</div></div>'
          % (WEEK, _pb(0, 'c', '<b>Form sent</b>Fence estimate, 7:40 AM') + _pb(1, 'o', 'Thanks for reaching out to Ridgeline Fence. Three open times: Wed 1 PM, Thu 2 PM or Fri 8 AM.')
             + _pb(3, 'c', 'Thursday at 2 works') + _pb(4, 'o', 'Booked. Thursday at 2 PM.') + _pb(6, 'o', 'Reminder: your estimate is tomorrow at 2 PM. Reply C to confirm.') + _pb(7, 'c', 'C')))
BKCARD = ('<div class="bkw" data-in><div class="cd bkd">%s<div class="bkd-b"><p class="bkd-t">Estimate<b>Thursday, 2:00 PM</b></p>%s</div></div>'
          '<p class="bkd-r" aria-hidden="true"><time>Wed 6 PM</time><span>A reminder text the night before.</span><i></i></p></div><p class="sd-n">Example. Sample data.</p>'
          % (head('On your calendar', 'Booked 7:52 AM'), ''.join('<p><span>%s</span><b>%s</b></p>' % x for x in [
              ('Address', 'Split Rail Dr'), ('The job', 'Privacy fence, about 180 ft'), ('Picked by', 'The customer, from your open times'), ('Reminder', 'Set for Wed 6 PM')])))
RAIL = ('<ol class="rl">%s</ol>' % ''.join('<li><time>%s</time><b>%s</b></li>' % x for x in [
    ('7:40 AM', 'A form comes in'), ('7:40 AM', 'A reply goes out with three times'), ('7:52 AM', 'They pick Thursday at 2 PM'), ('Wed 6 PM', 'A reminder goes out'), ('Thu 2 PM', 'You show up')]))
# the week as the lead sees it: your jobs, the three times offered, the one they picked
_bk_busy = {0: [(8, 12), (13, 16)], 1: [(9, 10), (11, 15)], 2: [(8, 12)], 3: [(8, 12)], 4: [(10, 14)]}
_bk_open = {(2, 13), (3, 14), (4, 8)}; _bk_pick = (3, 14)
def _bk_cell(d, h):
    if (d, h) == _bk_pick: return '<i class="k" style="--k:%d">Booked</i>' % (d + h)
    if (d, h) in _bk_open: return '<i class="o" style="--k:%d">Open</i>' % (d + h)
    return '<i class="%s" style="--k:%d"></i>' % ('j' if any(a <= h < b for a, b in _bk_busy[d]) else '', d + h)
_bk_hr = lambda h: '%d %s' % (h if h <= 12 else h - 12, 'AM' if h < 12 else 'PM')
BKGRID = ('<section class="bkg"><div class="w bkg-i"><div class="bkg-t"><span class="lb">Your open times</span><p class="st-t">The week, as the lead sees it. <span>Only the times you are actually free.</span></p>'
          '<div class="bkg-s"><div><b>3</b><span>open times offered</span></div><div><b>1</b><span>picked by the customer</span></div><div><b>Thu 2 PM</b><span>on your calendar</span></div></div>'
          '<p class="bkg-k"><span><i class="j"></i>Your jobs</span><span><i class="o"></i>Offered</span><span><i class="k"></i>Booked</span><em>Example week. Sample data.</em></p></div>'
          '<div class="bkg-g" data-in aria-hidden="true"><b></b>%s%s</div></div></section>'
          % (''.join('<b>%s</b>' % d for d in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri')),
             ''.join('<u>%s</u>%s' % (_bk_hr(h), ''.join(_bk_cell(d, h) for d in range(5))) for h in range(8, 18))))
BOOKING = (inner_hero('Calendar', 'Estimates on your calendar.', 'Serious leads pick a time themselves, get reminded, and show up.', BOOK + AUDITLINK, BKLIVE)
           + statement('The problem', 'A lead who says yes still has to get on your calendar.', 'That takes a call back, a few texts about times, and a reminder nobody sends. Every extra step is a chance for them to go quiet.')
           + BKGRID
           + sx('One lead, from the form to the driveway.', '', '<div class="rlb" data-in><p class="rlb-s" aria-hidden="true"><span><b>12 minutes</b><em>from the form to a booked time</em></span></p>'
                + RAIL.replace('<ol class="rl">', '<ol class="rl rlx">') + '</div><p class="rl-k">Example. Sample data.</p>', 'wh')
           + H.split('What lands on your calendar', 'The time, the address and the job.', 'The lead picks from times you are actually free. Reminders are set the moment it books.', BKCARD)
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
_wv = [10, 22, 34, 16, 40, 26, 12, 30, 44, 20, 14, 28, 36, 18]
_ev1 = '<div class="ev ev1"><div><i></i><i></i><i></i></div><p>%s</p></div>' % ''.join('<u style="height:%dpx"></u>' % h for h in _wv)
_ev2 = '<div class="ev ev2">%s</div>' % ''.join('<p><b>%s</b><span>%s</span><i></i></p>' % x for x in [('Cedar, 6 ft', 'per ft'), ('Walk gate', 'each'), ('Labour', 'per hour')])
_ev3 = '<div class="ev ev3"><em>Approve and send</em><u>Nothing goes out until you say so</u></div>'
d = p['does']
ES3 = ('<section class="v3 v3c"><div class="w v3-i"><p class="st-t">%s <span>%s</span></p><div class="v3-g">%s</div></div></section>'
       % (ap(X['estimates'][2]), ap(X['estimates'][3]), ''.join('<div><div class="v3-p" aria-hidden="true">%s</div><b>%s.</b><span>%s</span></div>' % (pic, ap(a), ap(b))
                                                                 for pic, (a, b) in ((_ev1, d[1]), (_ev2, d[0]), (_ev3, d[2])))))
# a pinned week: the usual way crawls along while other quotes arrive; the draft is sent the same day
_days = ['Visit', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon']
ESWEEK = ('<section class="ewk" data-sp><div class="w ewk-g"><figure class="ewk-f" aria-hidden="true"><p class="fa-k">[After the site visit]<em>Example. Sample week.</em></p>'
          '<div class="ewk-x">%s</div>'
          '<div class="ewk-t a"><b>Written up later</b><div><i></i>%s<em>Sent</em></div></div>'
          '<div class="ewk-t b"><b>Drafted from the truck</b><div><i></i><em>Sent, same day</em></div></div>'
          '<p class="ewk-n">%s</p></figure>%s</div></section>'
          % (''.join('<span>%s</span>' % x for x in _days), ''.join('<u style="--x:%d%%;--k:%d">Another quote</u>' % (x, k) for k, x in enumerate((28, 52, 76))),
             ap(X['estimates'][0][1]),
             ''.join('<div class="ewk-c c%d"><span>%s</span><h3>%s</h3></div>' % (k, ap(a), ap(b)) for k, (a, b) in enumerate(p['cmp'], 1))))
# a list that steps through one estimate; the draft beside it follows
ESWIN = ('<div class="cd esw">%s<div class="esw-r" data-sc="0"><span>Voice note, 0:14</span><p>&ldquo;180 feet of cedar privacy, six foot. Two gates. Old chain link comes out.&rdquo;</p></div>'
         '<div class="esw-r" data-sc="1">%s</div><div class="esw-r" data-sc="2"><p><b>Labour</b><span>From your price book</span></p><p class="t"><b>Total</b><span>$6,400</span></p></div>'
         '<div class="esw-r" data-sc="3"><em>Approve and send</em><span>Sent 10:31 AM</span></div></div>'
         % (head('Draft estimate', '10:24 AM'), ''.join('<p><b>%s</b><span>%s</span></p>' % x for x in [('Cedar privacy fence, 6 ft', '180 ft'), ('Walk gates', '2'), ('Remove old chain link', '180 ft')])))
ESACD = ('<section class="acd acd-r" data-live="3,3,3,3"><div class="w acd-g"><div class="acd-t"><span class="lb">One estimate</span><p class="st-t">%s</p>'
         '<div class="acd-l">%s</div></div><div class="acd-p">%s<p class="sd-n">Example. Sample data.</p></div></div></section>'
         % (ap(p['line']), ''.join('<div data-sc="%d"><b>%s</b><span>%s</span><u data-at="0"></u></div>' % x for x in [
             (0, 'You talk through the job.', 'A voice note or photos from the site.'), (1, 'The lines write themselves.', 'What you measured, laid out as an estimate.'),
             (2, 'Your prices go on.', 'From your price book, with your margins.'), (3, 'You approve it.', 'Nothing goes to a customer until you say so.')]), ESWIN))
ESTIMATES = (inner_hero('Quotes', ap(p['h1']), ap(p['lede']), BOOK + AUDITLINK, DRAFT)
             + statement('The problem', X['estimates'][0][0], ap(X['estimates'][0][1]))
             + ES3 + ESWEEK + ESACD
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
QUOTE_L = QUOTE.replace('<div class="qo-r "><i></i><b>Day 2', '<div class="qo-r " data-hd="2"><i></i><b>Day 2').replace('<div class="qo-r "><i></i><b>Day 5', '<div class="qo-r " data-hd="4"><i></i><b>Day 5').replace('<div class="qo-r y">', '<div class="qo-r y" data-hd="6">')
FU_LIVE = ('<div class="lvh" data-live="9">%s<div class="ph2" aria-hidden="true"><p>Customer&rsquo;s phone</p>%s</div></div>'
           % (QUOTE_L, ''.join('<p class="hb %s" data-at="%d">%s</p>' % x for x in [('o', 0, 'Here is your quote from Ridgeline Fence.'), ('o', 2, 'Any questions on the quote?'), ('o', 4, 'Still happy to hold your date.'), ('c', 5, 'Let&rsquo;s do it')])))
# three small pictures, one per card, each made for this page
_fv1 = '<div class="fv fv1"><p class="hb o">Quote sent</p><div><i>Day 2</i><i>Day 5</i><i>Day 10</i><i>Monthly</i></div></div>'
_fv2 = '<div class="fv fv2"><p class="hb">Too expensive</p><div><span>A smaller option</span><span>Financing</span><span class="k">Real price talk: to you</span></div></div>'
_fv3 = '<div class="fv fv3"><p><span>Invoice</span><b>Your pay link</b></p><em>Pay now</em><u>Paid to you, not to us</u></div>'
FU3 = ('<section class="v3"><div class="w v3-i"><p class="st-t">Chased for you, on a schedule. <span>It stops the moment there is a yes, a no, or paid.</span></p><div class="v3-g">%s</div></div></section>'
       % ''.join('<div><div class="v3-p" aria-hidden="true">%s</div><b>%s</b><span>%s</span></div>' % x for x in [
           (_fv1, 'It starts on its own.', 'Send a quote with one text and the follow-up starts on its own.'),
           (_fv2, 'Price talk comes to you.', '&ldquo;Too expensive&rdquo; gets your financing or a smaller option. Real price talk comes to you.'),
           (_fv3, 'Your own pay link.', 'Customers pay through your own pay link. We never touch your money.')]))
_oq = [('Privacy fence, 180 ft', 'Sent 2 days ago', '', 'Day 2 went out'), ('Gate repair', 'Sent 6 days ago', '', 'Day 5 went out'),
       ('Vinyl fence, 120 ft', 'Sent 12 days ago', 'y', 'Asked about price. Sent to you'), ('Chain link, 300 ft', 'Sent 5 weeks ago', '', 'Monthly check-in')]
OPEN_L = ('<div class="cd oq">%s%s</div>' % (head('Open quotes', '4 open'), ''.join('<div class="oq-r" data-sc="%d"><b>%s</b><span>%s</span><em class="%s">%s</em></div>' % ((k,) + x) for k, x in enumerate(_oq))))
FUACD = ('<section class="acd" data-live="3,3,3,3"><div class="w acd-g"><div class="acd-t"><span class="lb">Every open quote</span><p class="st-t">Nothing stays open without someone checking in.</p>'
         '<div class="acd-l">%s</div></div><div class="acd-p">%s<p class="sd-n">Example. Sample data.</p></div></div></section>'
         % (''.join('<div data-sc="%d"><b>%s</b><span>%s</span><u data-at="0"></u></div>' % x for x in [
             (0, 'Two days in.', 'The first check-in goes out.'), (1, 'Five days in.', 'The second check-in goes out.'),
             (2, 'A real question.', 'They asked about price, so it comes to you.'), (3, 'Still open.', 'A check-in every month until they answer.')]), OPEN_L))
FOLLOW_UP = (inner_hero('Quotes', 'Every quote gets chased.', 'Quotes and invoices get followed up until the customer says yes, no, or paid.', BOOK + AUDITLINK, FU_LIVE)
             + statement('The problem', 'A quote nobody chases is a job you gave away.', 'Most people don&rsquo;t say no. They get busy, mean to reply, and then book whoever checks in. Following up is easy to skip when you are on a job.')
             + FU3
             + '<section class="sx dk"><div class="w sx-i"><p class="sx-t">Every quote, followed up. <span>Days 2, 5 and 10, then monthly, until it&rsquo;s a yes or a no.</span></p>%s</div></section>' % SCALE
             + FUACD
             + ticks('What&rsquo;s included', 'One text from you. The rest runs.', [
                 'Send a quote with one text and the follow-up starts on its own.', '“Too expensive” gets your financing or a smaller option. Real price talk comes to you.',
                 'Invoices and payment reminders sent when the job’s done.', 'Customers pay through your own pay link. We never touch your money.',
                 'Past customers get a text when they’re due for their next job, with your open times.'])
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
# the seven invoices behind the figure: every picture on this page is drawn from the same list
_IVX = [('Customer A', 'Full install', 2, 2450, 'b'), ('Customer B', 'Repair', 5, 1850, 'b'), ('Customer C', 'Replacement', 9, 2900, 'y'), ('Customer D', 'Full install', 16, 2100, 'y'),
        ('Customer E', 'Repair', 24, 1200, 'y'), ('Customer F', 'Large install', 34, 3300, 'r'), ('Customer G', 'Repair', 47, 800, 'r')]
_usd = lambda n: '$' + format(n, ',')
_ivrow = lambda cls: ''.join('<p style="--k:%d" class="%s"><span><i></i>%s</span><em>%s</em><u>%d days</u><b>%s</b></p>' % (k, c, who, job, dd, _usd(amt)) for k, (who, job, dd, amt, c) in enumerate(_IVX))
# a statement beside one large figure, then each invoice standing on the day it has reached
IVNUM = ('<section class="ivn"><div class="w ivn-g"><p class="st-t">%s</p><div class="ivn-n"><b data-count="14600" data-pre="$">$14,600</b><span>waiting to be paid</span><em>Example business, sample data</em></div>'
         '<div class="ivn-c" data-in aria-hidden="true"><div class="ivn-s">%s%s</div><div class="ivn-r"><i></i>%s</div></div></div></section>'
         % (ap(p['line']), ''.join('<span class="gy" style="--y:%.1f%%"><b>$%dk</b></span>' % (v / 3300 * 100, v // 1000) for v in (1000, 2000, 3000)),
            ''.join('<u class="%s" style="--x:%.2f%%;--h:%.1f%%;--k:%d"><b>%s</b><em>Day %d</em></u>' % (c, dd / 60 * 100, amt / 3300 * 100, k, _usd(amt), dd) for k, (who, job, dd, amt, c) in enumerate(_IVX)),
            ''.join('<span style="--l:%.1f%%;--w:%.1f%%;--k:%d"><b>%s</b><em>%s</em></span>' % x for x in [(0, 11.2, 0, 'This week', '$4,300'), (12.6, 37.2, 1, '8 to 30 days', '$6,200'), (50.8, 49.2, 2, 'Over 30 days', '$4,100')])))
# what is owed, by age, as three bars. They rise as you scroll, then the view goes into the oldest one and that becomes the next screen.
_ivb = [(t, a, h, [(job, amt) for who, job, dd, amt, c2 in _IVX if c2 == c], c) for t, a, h, c in (('This week', '$4,300', 69, 'b'), ('8 to 30 days', '$6,200', 100, 'y'), ('Over 30 days', '$4,100', 66, 'r'))]
IVBARS = ('<section class="ivb" data-in><div class="ivb-i"><div class="w ivb-f"><div class="ivb-t"><span class="lb">What you see</span>'
          '<p class="st-t">You get paid without being the one who asks. <span>What is outstanding, by customer and by age.</span></p>'
          '<p class="fa-k">[Outstanding, by age]<em>Example business, sample data</em></p>'
          '<div class="ivb-l" aria-hidden="true"><p class="h"><span>Customer</span><em>Job</em><u>Age</u><b>Owed</b></p>%s</div></div>'
          '<div class="ivb-c" aria-hidden="true"><span class="ivb-y" style="--y:25.2%%">$2k</span><span class="ivb-y" style="--y:50.3%%">$4k</span><span class="ivb-y" style="--y:75.5%%">$6k</span>'
          '<span class="ivb-tot">$14,600 in all</span>%s</div></div></div></section>'
          '<section class="ivc" data-in><div class="ivc-g" aria-hidden="true">%s</div><p class="ivc-s">Sent the day the job ends, <span>followed up until it is paid.</span></p></section>'
          % (_ivrow(''),
             ''.join('<div class="ivb-b %s" style="--i:%d;--h:%d%%"><em>%s</em><div>%s</div><b>%s</b></div>' % (c, k, h, a, ''.join('<i style="flex:%d">%s<u>%s</u></i>' % (amt, job, _usd(amt)) for job, amt in jobs), t)
                     for k, (t, a, h, jobs, c) in enumerate(_ivb)),
             ''.join('<span style="--x:%.2f%%"><b>%s</b>%s</span>' % ((dd + 1) / 24 * 100, w, lb) for dd, lb, w in ((0, 'Sent', 'Invoice'), (3, 'Day 3', 'Friendly reminder'), (10, 'Day 10', 'Firmer reminder'), (21, 'Day 21', 'Third reminder')))))
# the three reminders, each a little firmer, arriving in turn on a dark ground
IVLAD = ('<section class="ivl" data-live="8"><div class="w ivl-i"><div class="ivl-t"><p class="st-t">Friendly first, firmer later. <span>And never from you personally.</span></p>'
         '<p class="ivl-k">They stop the moment it is paid. You can stop them for one customer in one tap.</p>'
         '<div class="ivl-s" aria-hidden="true"><p class="h"><span>Reminders</span><em>Per customer</em></p><p><span>Customer C</span><em>On</em><i class="on"></i></p><p><span>Customer D</span><em>On</em><i class="on"></i></p>'
         '<p class="off"><span>Customer F</span><em>Stopped by you</em><i></i></p></div></div><div class="ivl-m" aria-hidden="true">'
         '<div class="ivl-d" data-in><svg viewBox="0 0 1000 150" preserveAspectRatio="none"><path class="m" pathLength="1" d="M20 36 H980"/><path class="rl" d="M20 122 H980"/>'
         + ''.join('<path class="dp" style="--k:%d" d="M%d 36 V122"/>' % (k, 20 + dd / 22 * 960) for k, dd in enumerate((3, 10, 21)))
         + '</svg>' + ''.join('<span class="n" style="--x:%.2f%%;--k:%d">%s</span>' % (2 + dd / 22 * 96, k, lb) for k, (dd, lb) in enumerate(((0, 'Sent'), (3, 'Day 3'), (10, 'Day 10'), (21, 'Day 21'))))
         + '<span class="p">Paid at any point: the reminders stop</span></div>%s<div class="ivl-p" data-hd="6"><span>Day 22</span><b>Paid</b></div></div></div></section>'
         % ''.join('<div class="ivl-r" data-hd="%d" style="--k:%d"><span>%s</span><p>%s</p></div>' % (at, k, d, t) for k, (at, d, t) in enumerate([
             (0, 'Day 3', 'Hi, just a reminder that the invoice for your job is ready. You can pay from this message.'),
             (2, 'Day 10', 'Your invoice for the job is now a week past due. Here is the link to settle it.'),
             (4, 'Day 21', 'This invoice is three weeks past due. Please pay today or reply so we can sort it out.')])))
_iv1 = '<div class="iv iv1">%s<p><b>Job finished</b><b class="k">Invoice sent</b></p></div>' % ''.join('<i class="%s">%s</i>' % ('on' if d == 'Fri' else '', d) for d in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri'))
_iv2 = '<div class="iv iv2"><p class="hb o">Your invoice is ready. You can pay from this message.</p><em>Pay now</em></div>'
_iv3 = '<div class="iv iv3">%s</div>' % ''.join('<p><span>%s</span><b>%s</b><i class="%s"></i></p>' % x for x in [('Customer A', '$2,450', 'b'), ('Customer D', '$2,100', 'y'), ('Customer F', '$3,300', 'r')])
d = p['does']
IV3 = ('<section class="v3"><div class="w v3-i"><p class="st-t">%s</p><div class="v3-g">%s</div></div></section>'
       % ('%s. <span>%s</span>' % (ap(d[1][0]), ap(d[1][1])), ''.join('<div><div class="v3-p" aria-hidden="true">%s</div><b>%s.</b><span>%s</span></div>' % (pic, ap(a), ap(b)) for pic, (a, b) in ((_iv1, d[0]), (_iv2, d[2]), (_iv3, d[3])))))
IVHERO = ('<div class="ivh"><div class="cd ivh-l" aria-hidden="true">%s%s</div>'
          '<div class="cd inv">%s<div class="qo-t"><span>Gate install</span><b>$1,850</b></div><div class="ivh-i"><p style="--k:0"><span>Labor</span><b>$1,100</b></p><p style="--k:1"><span>Materials</span><b>$750</b></p></div>'
          '<div class="inv-p"><em>Pay now</em><span>Through the payment provider you already use.</span></div>%s</div>'
          '<div class="ph2" aria-hidden="true"><p>Customer&rsquo;s phone</p>%s<p data-hd="5" class="ivh-k">Paid $1,850</p></div></div>'
          % (head('Outstanding', 'By age'), _ivrow(''), head('Invoice', 'Sent the day the job ended', ''),
             ''.join('<div data-hd="%d" class="qo-r %s"><i></i><b>%s</b><span>%s</span></div>' % x for x in [(3, '', 'Friendly reminder sent', 'Day 3'), (4, '', 'Firmer reminder sent', 'Day 10'), (5, 'y', 'Paid', 'Day 11')]),
             ''.join('<p data-hd="%d" class="hb">%s</p>' % x for x in [(1, 'Your invoice is ready. You can pay from this message.'), (3, 'Hi, just a reminder that the invoice for your job is ready.'), (4, 'Your invoice for the job is now a week past due. Here is the link to settle it.')])))
INVOICING = (hero_split('Money', p['h1'], p['lede'], '', IVHERO)
             + problem('invoicing')
             + IVNUM + IVBARS + IVLAD + IV3
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
SEARCH = ('<div class="srx"><div class="q">%sfence company near me</div>%s<p class="srx-k"><span>Bar: number of reviews</span></p></div>' % (svg('find'), ''.join(
    '<div class="%s"><b>%s</b>%s<span>%s</span>%s<u style="--w:%d%%"></u></div>' % (c, n, stars(5), r, ('<em>%s</em>' % t) if t else '', w) for c, n, r, t, w in [
        ('on', 'The shop with the reviews', '212 reviews', 'Gets the call', 100), ('', 'Another name nearby', '31 reviews', '', 15), ('', 'Same work, nobody asked', '9 reviews', '', 4)])))
# the first screen: the headline with four small cards arriving around it, in the order they happen
_jr = lambda job, who, chips: '<div style="--k:0" class="rjr"><p><b>%s</b><span>%s</span></p><p class="c">%s</p></div>' % (job, who, chips)
RVHERO = ('<section class="rh" data-live="9"><div class="w rh-i"><span class="lb">After the job</span><h1>More five-star reviews.</h1>'
          '<p class="sub">Every finished job gets asked for a review, and your name keeps showing up where people look.</p><div class="cta">%s%s</div>'
          '<div class="rh-s" aria-hidden="true"><div class="cd rh-j"><div class="rh-wb"><i></i><i></i><i></i><b>Jobs</b><em>34 finished this month</em></div>%s</div>'
          '<div class="ph2"><p>Customer&rsquo;s phone</p><p data-hd="1" class="hb">Thanks for choosing us today. Mind leaving a quick review? It takes a minute.</p><p data-hd="2" class="rh-b">Leave a review</p>'
          '<div data-hd="3" class="rh-r">%s<span>&ldquo;Great job, really happy.&rdquo;</span></div><p data-hd="4" class="rh-k">Review posted</p></div>'
          '<div class="cd rh-w"><div class="rh-wb"><i></i><i></i><i></i><b>Your Google profile</b><em>Example business, sample data</em></div>'
          '<div class="rh-wg"><div class="rh-wn"><b>20</b><span>reviews this month</span>%s<em>3 the month before</em></div><div class="rh-wl">%s</div></div></div></div>'
          '</div></section>'
          % (BOOK, AUDITLINK,
             _jr('Full install', 'Customer A', '<u data-hd="0">Marked done, 4:10 PM</u><u data-hd="1" class="k">Review asked</u>')
             + _jr('Repair', 'Customer B', '<u>Done, 2:40 PM</u><u class="k">Review asked</u>') + _jr('Replacement', 'Customer C', '<u>Done, 11:15 AM</u><u class="s">Review left</u>')
             + _jr('Large install', 'Customer D', '<u>Done, yesterday</u><u class="s">Review left</u>'),
             stars(5), stars(5),
             ''.join('<div %s class="rw">%s<i style="--w:%d%%"></i><time>%s</time></div>' % (('data-hd="%d"' % at) if at else 'style="--k:0"', stars(5), w, t) for at, w, t in [(5, 62, 'Just now'), (0, 44, 'Today'), (0, 70, 'Today'), (0, 52, 'Yesterday')])))
# a year of reviews as two staircases: twenty a month when every job is asked, three a month when someone remembers
_ry = lambda v: 100 - (9 + v / 240 * 66)
_stair = lambda per: 'M0 %.2f ' % _ry(0) + ' '.join('V%.2f H%.3f' % (_ry(per * m), m / 12 * 100) for m in range(1, 13))
RVCURVE = ('<section class="rvc"><div class="rvc-i"><div class="w rvc-f"><div class="rvc-g rvs" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none">'
           '<path class="fa" d="%s V%.2f H0Z"/><path class="fb" d="%s V%.2f H0Z"/>%s<path class="bs" d="M0 %.2f H100"/><path class="lo2" d="%s"/><path class="hi2" d="%s"/></svg>%s%s'
           '<p class="rvs-a"><b>About 240</b><span>reviews in a year when every finished job is asked</span></p><p class="rvs-b"><b>36</b><span>when someone remembers to ask</span></p></div>'
           '<div class="rvc-t"><span class="lb">Asked every time</span><p class="st-t">Every finished job gets asked. <span>Most happy customers never leave a review because nobody asked.</span></p>'
           '<p class="rvc-n">Example business. Sample data.</p></div></div></div></section>'
           '<section class="rvd"><div class="rvd-i"><p class="rvd-s">Asked every time. <span>Not when someone remembers.</span></p><p class="rvd-c"><b>34 finished jobs in a month</b><span>Every one asked. Sample data.</span></p></div></section>'
           % (_stair(20), _ry(0), _stair(3), _ry(0),
              ''.join('<path class="vt" d="M%.3f %.2f V%.2f"/>' % (m / 12 * 100, _ry(20 * m), _ry(0)) for m in range(1, 12)), _ry(0), _stair(3), _stair(20),
              ''.join('<span class="rvs-n" style="--x:%.3f%%;--y:%.2f%%">%d</span>' % (m / 12 * 100, 100 - _ry(20 * m), 20 * m) for m in range(1, 12)),
              ''.join('<span class="rvs-m" style="--x:%.3f%%">%s</span>' % ((m + .5) / 12 * 100, t) for m, t in enumerate('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split()))
              ))
# after the job, in one line: five moments on a hairline, lit one after another
_rn = lambda at, tag, title, body: '<div class="rvp-n" data-hd="%d"><span>%s</span><b>%s</b>%s</div>' % (at, tag, title, body)
_rq_a = {3, 9, 17, 22, 30}; _rq_s = {3, 17, 30}; _rq_all = {k for k in range(34) if (k + 1) * 20 // 34 > k * 20 // 34}
_rq = lambda cls, title, big, note, asked, got: ('<div class="rvq %s"><p><b>%s</b></p><div class="rvq-g">%s</div><div class="rvq-f"><b>%s</b><span>%s</span></div></div>'
                                                 % (cls, title, ''.join('<i style="--k:%d" class="%s"></i>' % (k, ('a s' if k in got else 'a') if k in asked else '') for k in range(34)), big, note))
# the month twice, side by side, on the dotted ground the hand-over lands on
RVMONTH = ('<section class="rvqs"><div class="w rvqs-i"><p class="rvqs-l">One month, 34 finished jobs<em>Example business, sample data</em></p>'
           '<div class="rvqs-s"><div><b>34</b><span>jobs finished</span></div><div><b>5</b><span>asked for a review</span></div><div><b>3</b><span>reviews received</span></div><div><b>About 17</b><span>reviews missed</span></div></div>'
           '<div class="rvqs-g" data-in aria-hidden="true">%s%s</div>'
           '<p class="rvp-k" aria-hidden="true"><span><i></i>Job finished</span><span><i class="a"></i>Asked</span><span><i class="a s"></i>Review left</span></p></div></section>'
           % (_rq('', 'Asked when someone remembers', '3', 'reviews, from 5 asks', _rq_a, _rq_s), _rq('on', 'Asked every time', 'About 20', 'reviews, from 34 asks', set(range(34)), _rq_all)))
# after the job, in one line: five moments on a hairline, lit one after another, then what each part does
_rt = [('4:10 PM', 'Job marked done', 'Full install'), ('4:10 PM', 'Ask queued', 'No one had to remember'), ('4:11 PM', 'Text sent', 'A short text with a direct link, while the job is fresh'),
       ('4:26 PM', 'Review left', 'While the job is fresh'), ('On your profile', 'Where people look', 'Next to your name in search')]
RVSTEPS = ('<section class="rvt" data-live="11"><div class="rvt-i"><div class="w rvt-g"><div class="rvt-t"><span class="lb">After the job</span>'
           '<p class="st-t">Asked at the right moment, every time. <span>Not when someone remembers.</span></p><ol>%s</ol></div>'
           '<div class="rvt-p" aria-hidden="true"><div data-hd="0" class="cd rvt-a"><span>Your app</span><b>Full install, Customer A</b><p><u>Marked done, 4:10 PM</u><u data-hd="2" class="k">Review ask queued</u></p></div>'
           '<div class="ph2"><p>Customer&rsquo;s phone</p><p data-hd="4" class="hb">Mind leaving a quick review? It takes a minute.</p><p data-hd="4" class="rh-b">Leave a review</p>'
           '<div data-hd="6" class="rh-r">%s<span>&ldquo;Great job, really happy.&rdquo;</span></div></div>'
           '<div data-hd="8" class="cd rvt-b"><span>Your Google profile</span><b>New review</b>%s<em>Next to your name in search</em></div></div></div></div></section>'
           % (''.join('<li data-hd="%d"%s><time>%s</time><b>%s</b><span>%s</span></li>' % (2 * k, (' data-to="%d"' % (2 * k + 2)) if k < 4 else '', a, b, c) for k, (a, b, c) in enumerate(_rt)), stars(5), stars(5)))
RVPIPE = (RVMONTH + RVSTEPS + '<section class="rvp"><div class="w rvp-i"><div class="rvp-t">%s</div></div></section>'
          % ''.join('<div><b>%s.</b><span>%s</span></div>' % x for x in [
              ('The job gets paid', 'The moment it&rsquo;s marked done, the review ask is queued.'), ('They get asked at the right time', 'A short text with a direct link, while the job is fresh.'),
              ('Your name gets around', 'Reviews and regular posts keep you in front of people searching nearby.')]))
SEARCH_L = SEARCH.replace('<div class="q">', '<div class="q" data-sc="0">').replace('<div class="on">', '<div class="on" data-sc="2">').replace('<div class="">', '<div class="" data-sc="1">')
RVACD = ('<section class="acd" data-live="3,3,3"><div class="w acd-g"><div class="acd-t"><span class="lb">Where people look</span><p class="st-t">The shop with the reviews gets the call.</p>'
         '<div class="acd-l">%s</div></div><div class="acd-p">%s<p class="sd-n">Example. Sample data.</p></div></div></section>'
         % (''.join('<div data-sc="%d"><b>%s</b><span>%s</span><u data-at="0"></u></div>' % x for x in [
             (0, 'Someone nearby searches.', 'They need the work done and don&rsquo;t know a name yet.'), (1, 'Two names come up.', 'Same work. One of them never asked for a review.'),
             (2, 'The one with the reviews gets the call.', 'Asking in person feels awkward, so it doesn&rsquo;t happen. This asks for you.')]), SEARCH_L))
RVSG = '<section class="sg sgp"><div class="w sg-i"><p class="sg-t">How you know you have it</p><ol><li><span aria-hidden="true"><svg viewBox="0 0 296 190"><rect x="8" y="8" width="280" height="150" rx="14"/><path d="M8 45.5 H288"/><path d="M8 83.0 H288"/><path d="M8 120.5 H288"/><rect class="k" x="24" y="21.0" width="11" height="11"/><path class="g" d="M48 27.0 H150"/><path class="o" transform="translate(196 18.0) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(213 18.0) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(230 18.0) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(247 18.0) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(264 18.0) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><rect class="k" x="24" y="58.5" width="11" height="11"/><path class="g" d="M48 64.5 H122"/><path class="o" transform="translate(196 55.5) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(213 55.5) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(230 55.5) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(247 55.5) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(264 55.5) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><rect class="k" x="24" y="96.0" width="11" height="11"/><path class="g" d="M48 102.0 H164"/><path class="o" transform="translate(196 93.0) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(213 93.0) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(230 93.0) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(247 93.0) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(264 93.0) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><rect class="k" x="24" y="133.5" width="11" height="11"/><path class="g" d="M48 139.5 H110"/><path class="o" transform="translate(196 130.5) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(213 130.5) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(230 130.5) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(247 130.5) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(264 130.5) scale(0.7)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><text x="8" y="178">JOBS DONE, NO REVIEWS</text></svg></span><b>Great jobs with no review to show for them</b></li><li><span aria-hidden="true"><svg viewBox="0 0 296 190"><path d="M8 118 H288"/><rect class="k" x="14" y="113" width="10" height="10"/><rect class="k" x="38" y="113" width="10" height="10"/><rect class="k" x="62" y="113" width="10" height="10"/><rect class="k" x="86" y="113" width="10" height="10"/><rect class="k" x="110" y="113" width="10" height="10"/><rect class="k" x="134" y="113" width="10" height="10"/><rect class="k" x="158" y="113" width="10" height="10"/><rect class="k" x="182" y="113" width="10" height="10"/><rect class="k" x="206" y="113" width="10" height="10"/><rect class="k" x="230" y="113" width="10" height="10"/><rect class="k" x="254" y="113" width="10" height="10"/><rect class="k" x="278" y="113" width="10" height="10"/><path class="d" d="M91 106 V78"/><rect class="r" x="59" y="44" width="64" height="32" rx="9"/><path class="d" d="M235 106 V78"/><rect class="r" x="203" y="44" width="64" height="32" rx="9"/><text x="8" y="178">12 JOBS, 2 ASKS</text></svg></span><b>Asking only when you remember</b></li><li><span aria-hidden="true"><svg viewBox="0 0 296 190"><rect x="8" y="8" width="280" height="68" rx="12"/><path class="g" d="M24 30 H120"/><path class="f" transform="translate(170 18) scale(0.8)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="f" transform="translate(190 18) scale(0.8)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="f" transform="translate(210 18) scale(0.8)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="f" transform="translate(230 18) scale(0.8)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="f" transform="translate(250 18) scale(0.8)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="t" d="M24 56 H272"/><path class="rb" d="M24 56 H272"/><rect x="8" y="90" width="280" height="68" rx="12"/><path class="g" d="M24 112 H96"/><path class="o" transform="translate(170 100) scale(0.8)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(190 100) scale(0.8)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(210 100) scale(0.8)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(230 100) scale(0.8)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="o" transform="translate(250 100) scale(0.8)" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/><path class="t" d="M24 138 H272"/><path class="kb" d="M24 138 H48"/><text x="8" y="178">SAME WORK, MORE STARS</text></svg></span><b>A competitor with more stars and no better work</b></li></ol></div></section>'
RVSGP = re.findall(r'<svg viewBox="0 0 296 190">.*?</svg>', RVSG)
_rq1 = '<div class="rq rq1"><p><time>4:10 PM</time><b>Job marked done</b></p><i></i><p class="k"><time>4:11 PM</time><b>Review ask sent</b></p></div>'
_rq2 = '<div class="rq rq2"><div>%s</div><p>34 of 34 finished jobs asked</p></div>' % ('<i></i>' * 34)
_rq3 = '<div class="rq rq3"><p class="hb o">Mind leaving a quick review? It takes a minute.</p><em>Leave a review</em><div><span>Your Google profile</span>%s</div></div>' % stars(5)
RV3 = ('<section class="v3"><div class="w v3-i"><p class="st-t">Every finished job gets asked for a review, <span>and your name keeps showing up where people look.</span></p><div class="v3-g">%s</div></div></section>'
       % ''.join('<div><div class="v3-p" aria-hidden="true">%s</div><b>%s</b><span>%s</span></div>' % (pic, ap(q), ap(t)) for pic, (q, t) in (
           (_rq1, ('When does the ask go out?', 'Right after the job is marked done.')), (_rq2, ('Does every customer get asked?', 'Every finished job gets a request.')),
           (_rq3, ('Where do reviews go?', 'Straight to the place you want them, usually your Google profile.')))))
REVIEWS = (RVHERO
           + statement('The problem', 'People pick the name with the reviews.', 'Your work is good and your customers are happy. But nobody asks them, so the shop down the road with more stars gets the call.')
           + RVCURVE + RVPIPE + RVACD + RV3 + CL)

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
    return '<section class="chp" data-k="%s" data-n="%s" data-t="%s"></section>' % ({'01': 'a', '02': 'c', '03': 'b'}[n], n, name)
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

# ---- /who-its-for : any business that quotes jobs. No trade is named anywhere (Sam, 27 Nov). ----
QOPT = ('<div class="tpm"><div class="cd wn">%s<p>&ldquo;Standard job, two add-ons. They want it done this month.&rdquo;</p><span>Your notes from the visit</span></div><div class="es-a">%s</div>'
        '<div class="cd tpm-q">%s%s<div class="tpm-s"><em>Sign and pay the deposit</em></div></div></div>'
        % (head('Site visit', '10:20 AM', 'Example'), ARROW, head('Quote', 'From your notes'),
           ''.join('<div class="%s"><span>%s</span><b>%s</b></div>' % x for x in [('', 'Good', 'Standard'), ('on', 'Better', 'Upgraded'), ('', 'Best', 'Premium')])))
WHOFOR = (inner_hero('Who it&rsquo;s for', 'Built for businesses that quote jobs.', 'For owner-run service businesses that sell estimates and quotes. The leaks look the same in every one: missed calls, slow replies, quotes nobody chases.', BOOK + AUDITLINK, QOPT)
          + sx('From the site visit to a signed quote.', '', '<ol class="rl rl4">%s</ol>' % ''.join('<li><time>%s</time><b>%s</b></li>' % x for x in [
              ('Look at the job and note what it needs.', 'Visit the job'), ('Good, Better and Best options, priced the way you price.', 'The quote builds itself'),
              ('The customer picks an option, signs, and pays the deposit to hold the date.', 'They sign on their phone'), ('The order list and the job documents fill in from the same numbers.', 'Materials and paperwork follow')]), 'wh')
          + statement('One system', 'It works for any business that quotes.', 'The same system answers, books, follows up and asks for reviews, whatever you install or fix.')
          + cells([('quote', 'Notes to quote', 'What you saw on site becomes a quote with Good, Better and Best options.'), ('cal', 'Booked and reminded', 'Serious leads pick a time and show up.'),
                   ('plus', 'Material orders', 'Order what each job needs, straight from the job.'), ('find', 'Job paperwork', 'The documents a job needs, filled in for you.')], 'pg-4')
          + sx('You&rsquo;ll recognise it if', 'None of this depends on what you install or fix.', '<div class="trd fit">%s</div>' % ''.join('<div><b>%s</b><span>%s</span></div>' % x for x in [
              ('You quote before you work.', 'An estimate or a proposal comes before the job.'), ('The phone rings while your hands are full.', 'Calls and messages arrive when you can&rsquo;t answer.'),
              ('Leads come from more than one place.', 'Calls, forms, messages and lead sites.'), ('Quotes go quiet.', 'Nobody has time to check in on them.'),
              ('Invoices go out after the job.', 'Sometimes days after.'), ('Some of it is still done by hand.', 'Usually at night.')]), 'wh')
          + ask('Not sure it fits?', 'If you quote jobs, it fits.', 'How the audit works', '/free-audit')
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
.trd svg{display:block;width:120px;height:64px;margin-bottom:22px;overflow:visible}.trd svg *{fill:none;stroke:var(--ink);stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}.trd svg .g{stroke:#b4b7bf}
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
KIND = {'bkg': 'bkg', 'rvqs': 'rvqs', 'rvt': 'rvt', 'rvd': 'rvd', 'ivc': 'ivc', 'v3': 'v3', 'acd': 'acd', 'ewk': 'ewk', 'rvc': 'rvc', 'rvp': 'rvp', 'rh': 'top', 'ivn': 'ivn', 'ivb': 'ivb', 'ivl': 'ivl', 'lvg': 'lvg', 'lvc': 'lvc', 'hs': 'top', 'ih': 'top', 'dh': 'top', 'st': 'st', 'sx': 'sx', 'sp': 'sp', 'hw': 'hw', 'bl': 'bl', 'pg': 'pg', 'ic': 'ic', 'as': 'as', 'fq': 'fq',
        'fa': 'faq', 'qc': 'faq', 'qf': 'faq', 'cv': 'faq', 'cl': 'cl', 'itg': 'itg'}
RHYTHM = {
    'phone-agent': ('sx sp hw', {'sx': 's-tn t-sheet v-c', 'sp': 'v-f', 'faq': 't-arc'}),
    'website-chat': ('st sx bl sp', {'st': 'v-xl', 'sx': 'v-pin', 'bl': 's-bl t-exp', 'sp': 's-dkp'}),
    'social-messages': ('sx st pg', {'sx': 't-sheet', 'st': 's-dk v-c t-angle', 'pg': 's-dk'}),
    'lead-vetting': ('st lvg acd lvc', {'st': 'v-2 t-rule'}),
    'after-hours': ('st sx sp', {'st': 'v-c t-arc', 'sp': 's-dkp'}),
    'booking': ('st bkg sx sp ic', {'st': 'v-xl', 'sx': 's-tn t-exp', 'sp': 'v-f'}),
    'reminders': ('sx st sp', {'sx': 't-sheet v-b', 'st': 's-dk t-angle', 'sp': 'v-f'}),
    'dispatch': ('st sx hw', {'st': 'v-2', 'sx': 't-rule v-c'}),
    'job-updates': ('bl sx st sp', {'bl': 'v-sf t-sheet', 'sx': 's-tn', 'st': 'v-c', 'sp': 'v-f'}),
    'estimates': ('st v3 ewk acd', {'st': 's-tn v-xl'}),
    'proposals': ('st bl sx sp', {'bl': 's-dk t-arc', 'sx': 't-sheet'}),
    'follow-up': ('st v3 sx acd ic as', {'st': 'v-2', 'sx': 't-exp'}),
    'invoicing': ('st ivn ivb ivc ivl v3', {'st': 's-tn v-c'}),
    'bookkeeping': ('st sx pg sp', {'st': 'v-xl t-rule', 'sx': 'v-pin', 'pg': 'v-l', 'sp': 's-dkp'}),
    'reviews': ('st rvc rvd rvqs rvt rvp acd v3', {'st': 'v-xl'}),
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


SIGN_PIC = {'invoicing': ['<svg viewBox="0 0 296 190"><rect x="8" y="8" width="34" height="24"/><rect x="48" y="8" width="34" height="24"/><rect x="88" y="8" width="34" height="24"/><rect x="128" y="8" width="34" height="24"/><rect x="168" y="8" width="34" height="24"/><rect x="208" y="8" width="34" height="24"/><rect x="248" y="8" width="34" height="24"/><rect x="8" y="38" width="34" height="24"/><rect x="48" y="38" width="34" height="24"/><rect x="88" y="38" width="34" height="24"/><rect x="128" y="38" width="34" height="24"/><rect x="168" y="38" width="34" height="24"/><rect x="208" y="38" width="34" height="24"/><rect x="248" y="38" width="34" height="24"/><rect x="8" y="68" width="34" height="24"/><rect x="48" y="68" width="34" height="24"/><rect x="88" y="68" width="34" height="24"/><rect x="128" y="68" width="34" height="24"/><rect x="168" y="68" width="34" height="24"/><rect x="208" y="68" width="34" height="24"/><rect x="248" y="68" width="34" height="24"/><rect x="8" y="98" width="34" height="24"/><rect x="48" y="98" width="34" height="24"/><rect x="88" y="98" width="34" height="24"/><rect x="128" y="98" width="34" height="24"/><rect x="168" y="98" width="34" height="24"/><rect x="208" y="98" width="34" height="24"/><rect x="248" y="98" width="34" height="24"/><rect x="8" y="128" width="34" height="24"/><rect x="48" y="128" width="34" height="24"/><rect class="k" x="140" y="15" width="10" height="10"/><rect class="k" x="180" y="45" width="10" height="10"/><rect class="k" x="180" y="75" width="10" height="10"/><rect class="r" x="48" y="128" width="34" height="24"/><rect class="k" x="8" y="170" width="8" height="8"/><text x="22" y="178">JOB DONE</text><rect class="r" x="112" y="170" width="8" height="8"/><text x="126" y="178">INVOICED</text></svg>', '<svg viewBox="0 0 296 190"><rect x="8" y="8" width="280" height="150" rx="14"/><path class="d" d="M60 34 H264 a10 10 0 0 1 10 10 V96 a10 10 0 0 1 -10 10 H60 a10 10 0 0 1 -10 -10 V44 a10 10 0 0 1 10 -10 Z"/><path class="g" d="M66 54 H240 M66 70 H214 M66 86 H128"/><path d="M134 79 V93"/><path d="M24 132 H210"/><rect class="d" x="222" y="120" width="52" height="24" rx="7"/><text x="8" y="178">DRAFT, NOT SENT</text></svg>', '<svg viewBox="0 0 296 190"><rect x="8" y="8" width="280" height="150" rx="14"/><path d="M8 45 H288"/><path class="g" d="M26 27 H150"/><text class="q" x="262" y="32">?</text><path d="M8 83 H288"/><path class="g" d="M26 64 H118"/><text class="q" x="262" y="69">?</text><path d="M8 120 H288"/><path class="g" d="M26 102 H168"/><text class="q" x="262" y="107">?</text><path class="g" d="M26 139 H104"/><text class="q" x="262" y="144">?</text><text x="8" y="178">WHO OWES WHAT</text></svg>']}

SIGN_PIC['reviews'] = RVSGP
SIGN_SPLIT = {}   # split signs with a changing line drawing: tried on Booking, Sam rejected it ("looks bad")
SIGN_PIC['estimates'] = ['<svg viewBox="0 0 296 190"><rect x="8" y="8" width="150" height="150" rx="12"/><path class="g" d="M26 36 H120 M26 58 H140 M26 80 H104 M26 102 H132 M26 124 H92"/><circle cx="228" cy="74" r="46"/><path d="M228 74 V42 M228 74 L250 86"/><circle class="k" cx="228" cy="74" r="3"/><text class="q" x="204" y="146">11:40 PM</text><text x="8" y="178">WRITTEN AFTER HOURS</text></svg>', '<svg viewBox="0 0 296 190"><rect class="wf" x="12" y="10" width="208" height="46" rx="9"/><path class="g" d="M28 33 H120"/><text class="q" x="196" y="39">?</text><rect class="wf" x="30" y="42" width="208" height="46" rx="9"/><path class="g" d="M46 65 H160"/><text class="q" x="214" y="71">?</text><rect class="wf" x="48" y="74" width="208" height="46" rx="9"/><path class="g" d="M64 97 H156"/><text class="q" x="232" y="103">?</text><rect class="wf" x="66" y="106" width="208" height="46" rx="9"/><path class="g" d="M82 129 H196"/><text class="q" x="250" y="135">?</text><text x="8" y="178">SITE VISITS, NO PRICE YET</text></svg>', '<svg viewBox="0 0 296 190"><rect x="8" y="8" width="280" height="68" rx="12"/><rect class="k" x="24" y="34" width="14" height="14"/><path class="g" d="M52 41 H170"/><text x="212" y="45">SENT MON</text><rect class="d" x="8" y="90" width="280" height="68" rx="12"/><rect x="24" y="116" width="14" height="14"/><path class="g" d="M52 123 H150"/><text class="q" x="192" y="128">SENT FRI</text><text x="8" y="178">THEY CHOSE BY WEDNESDAY</text></svg>']
SIGN_PIC['lead-vetting'] = ['<svg viewBox="0 0 296 190"><rect class="k" x="16" y="118" width="16" height="16"/><path class="d" d="M32 126 C96 126 110 52 176 52 S236 60 256 52"/><circle cx="262" cy="50" r="15"/><path class="rs" d="M254 42 L270 58 M270 42 L254 58"/><text x="112" y="44">90 MILES</text><path d="M8 150 H288"/><text x="8" y="178">DROVE OUT, NOT A FIT</text></svg>', '<svg viewBox="0 0 296 190"><rect class="wf" x="10" y="10" width="190" height="42" rx="12"/><path class="g" d="M28 31 H140"/><text class="q" x="176" y="37">?</text><rect class="wf" x="54" y="62" width="190" height="42" rx="12"/><path class="g" d="M72 83 H184"/><text class="q" x="220" y="89">?</text><rect class="wf" x="98" y="114" width="190" height="42" rx="12"/><path class="g" d="M116 135 H228"/><text class="q" x="264" y="141">?</text><text x="8" y="178">ASKED AGAIN, EVERY CALL</text></svg>', '<svg viewBox="0 0 296 190"><path d="M8 126 H288"/><rect class="o" x="14" y="88" width="28" height="28" rx="4"/><rect class="o" x="52" y="88" width="28" height="28" rx="4"/><rect class="o" x="90" y="88" width="28" height="28" rx="4"/><rect class="o" x="128" y="88" width="28" height="28" rx="4"/><rect class="o" x="166" y="88" width="28" height="28" rx="4"/><rect class="b" x="204" y="88" width="28" height="28" rx="4"/><rect class="o" x="242" y="88" width="28" height="28" rx="4"/><path class="d" d="M218 80 V52"/><text x="176" y="42">THE GOOD ONE</text><text x="14" y="76">FIRST IN LINE</text><text x="8" y="178">SIXTH IN THE QUEUE</text></svg>']


def signs_split(items, pics):   # three signs stacked on one side; on the other a line drawing that changes with them
    return ('<section class="sg sg3" data-live="3,3,3"><div class="w sg-i"><div class="sg3-l"><p class="sg-t">How you know you have it</p><ol>%s</ol></div>'
            '<div class="sg3-p" aria-hidden="true">%s</div></div></section>'
            % (''.join('<li data-sc="%d"><b>%s</b><u data-at="0"></u></li>' % (k, ap(t)) for k, t in enumerate(items)), ''.join(pics)))


def signs_pic(items, pics):   # the same three signs, each beside a small line drawing of it
    return ('<section class="sg sgp"><div class="w sg-i"><p class="sg-t">How you know you have it</p><ol>%s</ol></div></section>'
            % ''.join('<li><span aria-hidden="true">%s</span><b>%s</b></li>' % (pic, ap(t)) for pic, t in zip(pics, items)))


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


HAND = {'estimates', 'reviews', 'invoicing', 'lead-vetting'}
def full(name, body):
    if name not in CLEAN:
        return body
    i = CLEAN.index(name); body = restyle(name, body)
    secs = re.findall(r'<section\b.*?</section>', body, re.S)
    kind = lambda x: KIND.get(re.match(r'<section class="([a-z0-9]+)', x).group(1), 'other')
    top = [x for x in secs if kind(x) == 'top']; fa_ = [x for x in secs if kind(x) == 'faq']; mid = [x for x in secs if kind(x) not in ('top', 'faq', 'cl')]
    kinds = [kind(x) for x in mid]; p = BY[name]; mods = RHYTHM[name][1]
    sg = signs_sec(X[name][1] if name in X else SIGNS_OLD[name], i % 3)
    if name in SIGN_SPLIT:
        sg = signs_split(X[name][1] if name in X else SIGNS_OLD[name], SIGN_SPLIT[name])
    if name in SIGN_PIC:
        sg = signs_pic(X[name][1] if name in X else SIGNS_OLD[name], SIGN_PIC[name])
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
    if name in HAND:   # pages rebuilt by hand carry their own sections; nothing automatic is added to them
        extra = []
    return ''.join(top + mid + extra + [yw_sec(p['group'], (i + 1) % 3)] + fa_ + [next_sec(name), CL])


CSS_FULL = r"""
/* the three signs, three ways */
.sg{border-top:1px solid var(--ln)}.sg-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(64px,5.4vw,104px) var(--pad)}
.sg-t{margin:0 0 clamp(20px,1.8vw,32px);font:500 12px/1 "Geist Mono",monospace;color:var(--t3)}
.sg ol{list-style:none;margin:0;padding:0;counter-reset:g}.sg li{counter-increment:g}
.sgp .sg-i{padding-top:clamp(48px,4.4vw,84px);padding-bottom:0}.sgp ol{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--ln)}
.sgp li{display:grid;align-content:start;gap:clamp(22px,2.2vw,40px);padding:clamp(28px,3vw,56px) clamp(20px,2.4vw,44px) clamp(40px,4vw,72px);border-left:1px solid var(--ln)}.sgp li:first-child{border-left:0;padding-left:0}
.sgp li span{display:block}.sgp svg{display:block;width:100%;max-width:330px;height:auto;overflow:visible}.sgp svg rect,.sgp svg path{fill:none;stroke:#17181a;stroke-width:1;vector-effect:non-scaling-stroke}
.sgp svg .k{fill:#17181a}.sgp svg .r{fill:#e5484e;stroke:#e5484e}.sgp svg .d{stroke-dasharray:4 4}.sgp svg .g{stroke:#c9cbd0;stroke-width:6;stroke-linecap:round}
.sgp svg text{font:500 9.5px/1 "Geist Mono",monospace;letter-spacing:.05em;fill:#75777d}.sgp svg text.q{font-size:15px;fill:#e5484e}
.sgp li b{display:block;max-width:13em;font-size:clamp(20px,1.65vw,30px);line-height:1.12;font-weight:540;letter-spacing:-.03em}
.sgp li b::before{content:"0" counter(g);display:block;margin-bottom:12px;font:500 12px/1 "Geist Mono",monospace;color:var(--red);letter-spacing:0}
@media(max-width:860px){.sgp svg text{display:none}.sgp ol{grid-template-columns:minmax(0,1fr)}.sgp li{grid-template-columns:120px minmax(0,1fr);align-items:center;gap:18px;padding:22px 0;border-left:0;border-top:1px solid var(--ln)}.sgp li:first-child{border-top:0}.sgp .sg-i{padding-bottom:20px}}
.sgp svg circle{fill:none;stroke:#17181a;stroke-width:1;vector-effect:non-scaling-stroke}.sgp svg circle.k{fill:#17181a}.sgp svg .wf{fill:#fff}.sgp svg .b{fill:#266df1;stroke:#266df1}.sgp svg .rs{stroke:#e5484e;stroke-width:1.5}
.sgp li b{font:400 clamp(22px,1.9vw,32px)/1.12 Georgia,"Times New Roman",serif;letter-spacing:-.015em;max-width:12em}.sgp li b::before{font-family:"Geist Mono",monospace}
.sg3{background:var(--dk);color:#fff;border-top:0}.sg3 .sg-i{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(30px,5vw,100px);align-items:center;border-color:var(--dl);padding-top:clamp(40px,4vw,70px);padding-bottom:clamp(90px,9vw,160px)}
.sg3 .sg-t{color:#8f9197}.sg3 ol{border-top:1px solid var(--dl)}.sg3 li{position:relative;padding:clamp(22px,2.2vw,36px) 0 clamp(22px,2.2vw,36px) 0;border-bottom:1px solid var(--dl);transition:opacity .4s}
.sg3 li b{display:block;font:400 clamp(26px,2.5vw,42px)/1.1 Georgia,"Times New Roman",serif;letter-spacing:-.016em}.sg3 li b::before{content:"0" counter(g);display:block;margin-bottom:12px;font:500 11px/1 "Geist Mono",monospace;letter-spacing:.05em;color:#8f9197}
.sg3 li u{position:absolute;left:0;bottom:-1px;height:1px;width:0;background:#fff}.sg3.live li:not(.on){opacity:.36}.sg3.live li.on u{animation:sg3u 4.2s linear both}
.sg3.live li u[data-at]:not(.in){display:block}
.sg3-p{position:relative;aspect-ratio:4/3;border-radius:16px;box-shadow:inset 0 0 0 1px var(--dl);background:#131416}.sg3-p svg{position:absolute;inset:0;width:100%;height:100%}
.sg3-p svg+svg{display:none}.sg3.live .sg3-p svg{display:none}.sg3.live .sg3-p svg.on{display:block}
.sg3-p path,.sg3-p circle,.sg3-p rect{fill:none;stroke:#fff;stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}
.sg3-p text{fill:#8f9197;stroke:none;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.06em;text-anchor:middle}.sg3-p .qm{fill:#e5484e;font-size:20px}
.sg3-p .rx{stroke:#e5484e;stroke-width:1.5}.sg3-p .q{stroke:#e5484e;stroke-dasharray:5 5}.sg3-p .dm{stroke:#5c5e63}.sg3-p .fl{stroke-dasharray:3 7;stroke:#a9abb0}
.sg3.live svg.on path[pathLength],.sg3.live svg.on circle[pathLength]{stroke-dasharray:1;stroke-dashoffset:1;animation:sg3d 1.2s cubic-bezier(.3,.7,.2,1) forwards}
.sg3.live svg.on .fl{animation:sg3f 1.1s linear infinite}.sg3.live svg.on .fl.b{animation-direction:reverse}.sg3.live svg.on .q,.sg3.live svg.on .qm,.sg3.live svg.on .rx{animation:sg3q 1.4s ease-in-out .9s infinite both}
.sg3.live svg.on text:not(.qm){animation:sg3t .6s ease .7s both}
@keyframes sg3d{to{stroke-dashoffset:0}}@keyframes sg3f{to{stroke-dashoffset:-20}}@keyframes sg3q{0%,100%{opacity:1}50%{opacity:.25}}@keyframes sg3t{from{opacity:0}to{opacity:1}}@keyframes sg3u{from{width:0}to{width:100%}}
@media(max-width:860px){.sg3 .sg-i{grid-template-columns:minmax(0,1fr)}}
@media(prefers-reduced-motion:reduce){.sg3 *{animation:none!important}.sg3.live svg.on path[pathLength],.sg3.live svg.on circle[pathLength]{stroke-dashoffset:0}}
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
        return ''.join((portal('bubble', '7:42 PM', 'A call rings out.', 'One lead, start to finish.') + LEAD) if x.startswith('<section class="hw"') else x for x in secs)
    if name == 'everything':
        return ''.join((portal('grid', 'What we build', 'Thirty-two builds.', 'Eight parts of a business.') + x) if x.startswith('<section class="bn"') else x for x in secs)
    if name == 'story':
        return re.sub(r'<section class="chp" data-k="(.)" data-n="(..)" data-t="([^"]*)"></section>', lambda m: wash(m.group(1), 'Chapter ' + m.group(2), m.group(3)), body)
    if name == 'software':
        return ''.join((portal('app', 'The app', 'Every lead, estimate, quote and invoice in one place.', 'One day in the app.') + DAYAPP.replace('<section class="sc"', '<section class="sc k2"', 1) + x) if 'class="duo"' in x else x for x in secs).replace(AUDITLINK, '<a class="btn q" href="/day">See one day, start to finish</a>', 1)
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


OBJ = {   # kind: (what is drawn on the dark shape, counter format, counter end)
    'bubble': ('<i class="btl"></i><i class="d" style="--i:0"></i><i class="d" style="--i:1"></i><i class="d" style="--i:2"></i><i class="b b1"></i><i class="b b2"></i>', '0:0#', 9),
    'sheet': ('<i class="hd"></i>' + ''.join('<i class="srw" style="--i:%d;--y:%dpx;--l:%d%%"></i>' % (k, 110 + k * 40, w) for k, w in enumerate((52, 40, 46))) + '<i class="ru"></i><em>[Sent]</em>', '$#', 1850),
    'grid': (''.join('<i style="--i:%d"></i>' % k for k in range(32)), '# of 32', 32),
    'app': (H.mark + '<i class="rg"></i>', 'Cinder', 0),
    'bars': ('<i style="--i:0"></i><i style="--i:1"></i><i style="--i:2"></i>', '$# a month', 6400),
    'cols': (''.join('<i style="--i:%d"></i>' % k for k in range(5)), '# of 5', 5),
}


def portal(kind, label, line_, title, count=True):
    body, fmt, to = OBJ[kind]
    if not count:
        fmt, to = '', 0
    return ('<section class="pt pt-%s" data-sp><div class="pt-s"><div class="pt-a"><span>[%s]</span><p>%s</p></div><div class="pt-d"><h2>%s</h2></div><div class="pt-o" aria-hidden="true">%s</div>'
            '<b class="pt-n" aria-hidden="true" data-fmt="%s" data-to="%d">%s</b></div></section>' % (kind, label, line_, title, body, fmt, to, fmt.replace('#', '0')))


_SUNY = {'a': 0, 'b': 96, 'c': -210}
def _sun(kind):
    # a flat colour panel with a hairline sun on a horizon: rising, setting, or overhead
    cy = 470 + _SUNY[kind]; cx = 1040
    return ('<svg class="wb-d" viewBox="0 0 1440 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><clipPath id="wbc-%s"><rect width="1440" height="470"/></clipPath></defs><g clip-path="url(#wbc-%s)">'
            '<circle class="s" cx="%d" cy="%d" r="150"/>%s</g><path d="M0 470 H1440"/>%s<rect class="q" x="%d" y="%d" width="7" height="7"/></svg>'
            % (kind, kind, cx, cy, ''.join('<circle class="o" cx="%d" cy="%d" r="%d"/>' % (cx, cy, r) for r in (210, 270, 330, 390)),
               ''.join('<path d="M%d 470 v%d"/>' % (x, 12 if (x // 60) % 4 == 0 else 7) for x in range(60, 1440, 60)), cx - 3.5, cy - 150 - 3.5))


def wash(kind, tag, title, small=''):
    # a soft colour-wash band that opens a chapter, then the page goes back to white
    return '<section class="wb wb-%s"><div class="wb-i"><p class="wb-k">[%s]</p><h2>%s</h2>%s</div></section>' % (kind, tag, title, ('<p>%s</p>' % small) if small else '')


import math
_ticks = ''.join('<line x1="200" y1="%d" x2="200" y2="%d" transform="rotate(%d 200 200)" style="--i:%.1f"/>' % (4, 18 if t % 5 == 0 else 11, t * 6, t * .8) for t in range(60))
_HOPS = [(40, 96, 'Day 2'), (96, 176, 'Day 5'), (176, 300, 'Day 10'), (300, 520, 'Monthly')]
DRAW = {
    'dial': '<svg viewBox="0 0 400 400" aria-hidden="true"><circle class="r0" cx="200" cy="200" r="196"/>%s<circle class="rd" cx="200" cy="200" r="150"/><circle class="rd" cx="200" cy="200" r="104"/><circle class="rd" cx="200" cy="200" r="58"/>'
            '<circle class="r1" cx="200" cy="200" r="150" transform="rotate(-90 200 200)" pathLength="1"/><path class="hx" d="M200 96 A104 104 0 0 1 290 252"/>'
            '<g class="hd"><line x1="200" y1="200" x2="200" y2="50"/><rect x="196.5" y="46.5" width="7" height="7"/></g><rect class="c" x="196.5" y="196.5" width="7" height="7"/></svg>' % _ticks,
    'stack': '<svg class="hop" viewBox="0 0 560 300" aria-hidden="true"><line class="bl" x1="20" y1="240" x2="540" y2="240"/>%s<rect class="sq" x="36.5" y="236.5" width="7" height="7"/><text x="40" y="266">Sent</text></svg>' % ''.join(
        '<path class="hp" style="--i:%d" pathLength="1" d="M%d 240 A%d %d 0 0 1 %d 240"/><line class="dr2" style="--i:%d" x1="%d" y1="%d" x2="%d" y2="240"/><rect class="sq" style="--i:%d" x="%.1f" y="236.5" width="7" height="7"/><text style="--i:%d" x="%d" y="266">%s</text>'
        % (k, a, (b - a) // 2, (b - a) // 2, b, k, (a + b) // 2, 240 - (b - a) // 2, (a + b) // 2, k, b - 3.5, k, b, t) for k, (a, b, t) in enumerate(_HOPS)),
    'dots': '<div class="dts" aria-hidden="true">%s</div>' % ''.join('<i class="%s" style="--i:%d"></i>' % ('b' if ORD % 9 == 0 else '', ORD) for ORD in [92, 32, 57, 22, 0, 99, 67, 90, 42, 14, 59, 78, 89, 24, 38, 26, 107, 87, 47, 1, 25, 48, 86, 10, 101, 75, 16, 52, 2, 56, 102, 77, 21, 49, 33, 60, 84, 51, 88, 66, 106, 58, 44, 62, 29, 20, 95, 34, 43, 31, 63, 65, 3, 61, 94, 45, 35, 76, 96, 100, 40, 36, 69, 13, 23, 39, 104, 18, 91, 37, 17, 71, 5, 82, 103, 105, 79, 73, 85, 98, 81, 80, 28, 15, 72, 97, 54, 70, 93, 30, 8, 53, 55, 11, 4, 27, 64, 7, 74, 46, 12, 68, 9, 6, 83, 50, 19, 41]),
}
DRAW['dotsfs'] = '<div class="dts" aria-hidden="true">%s</div>' % ''.join('<i class="%s" style="--i:%d"></i>' % ('b' if q % 11 == 0 else '', q) for q in [168, 249, 55, 180, 41, 67, 242, 12, 52, 209, 196, 176, 93, 128, 256, 216, 99, 46, 123, 156, 43, 56, 90, 14, 259, 147, 116, 89, 68, 138, 164, 237, 226, 38, 262, 105, 110, 122, 203, 57, 239, 244, 133, 192, 44, 42, 204, 60, 51, 134, 205, 219, 252, 220, 146, 213, 125, 64, 208, 160, 28, 222, 109, 72, 198, 158, 191, 35, 126, 91, 103, 154, 8, 170, 217, 233, 62, 236, 88, 82, 174, 165, 32, 202, 187, 171, 182, 6, 140, 136, 142, 221, 108, 87, 250, 70, 111, 258, 20, 24, 92, 121, 78, 148, 39, 19, 201, 251, 49, 188, 197, 106, 248, 129, 232, 224, 211, 223, 139, 76, 234, 31, 81, 190, 26, 11, 230, 247, 149, 214, 84, 186, 66, 113, 145, 37, 245, 246, 100, 47, 183, 5, 253, 173, 185, 184, 150, 179, 29, 240, 178, 33, 155, 130, 254, 229, 143, 45, 124, 119, 261, 2, 25, 63, 34, 30, 206, 235, 85, 79, 22, 86, 69, 172, 218, 161, 200, 18, 107, 257, 96, 120, 13, 53, 54, 0, 175, 4, 195, 98, 74, 193, 102, 27, 144, 17, 228, 73, 131, 58, 194, 80, 65, 181, 210, 141, 104, 71, 241, 117, 21, 169, 1, 127, 75, 163, 59, 132, 50, 215, 151, 112, 83, 118, 199, 7, 153, 61, 225, 255, 9, 15, 16, 135, 212, 3, 159, 40, 166, 157, 189, 167, 115, 101, 152, 10, 162, 177, 227, 207, 137, 23, 36, 77, 114, 48, 95, 243, 94, 97, 260, 263, 238, 231])

# =====================================================================================
# Line graphs. Sam, on Attio's architecture page: "i really like the way the line graphs look, anywhere we can use some of those
# on our site?" These are ours, in that register: hairlines, dotted drops to the axis, small square nodes, hatching, bracketed
# mono tags. Nothing is traced from theirs. Every chart is sample data and says so. The plot box is 0..100 both ways; the lines are
# an SVG stretched to the box with non-scaling strokes, and every label, node and hatch is HTML placed by percentage, so text and
# nodes keep their size on a phone. The solid line is wiped in left to right by --d; nodes, drops and tags arrive as it passes.
# =====================================================================================
def _dense(pts, n=18):
    xs = [a for a, _ in pts]; ys = [b for _, b in pts]; k = len(pts)
    dl = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(k - 1)]
    m = [dl[0]] + [0 if dl[i - 1] * dl[i] <= 0 else (dl[i - 1] + dl[i]) / 2 for i in range(1, k - 1)] + [dl[-1]]
    for i in range(k - 1):
        if dl[i] == 0:
            m[i] = m[i + 1] = 0
        else:
            a, b = m[i] / dl[i], m[i + 1] / dl[i]; q = a * a + b * b
            if q > 9:
                t = 3 / q ** .5; m[i] = t * a * dl[i]; m[i + 1] = t * b * dl[i]
    out_ = []
    for i in range(k - 1):
        h = xs[i + 1] - xs[i]
        for j in range(n):
            t = j / n; t2 = t * t; t3 = t2 * t
            out_.append((xs[i] + h * t, (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]))
    return out_ + [pts[-1]]


def _yat(line_, x):
    for (a, b), (c, d) in zip(line_, line_[1:]):
        if a <= x <= c:
            return b if c == a else b + (d - b) * (x - a) / (c - a)
    return line_[-1][1]


_poly = lambda pts: 'M' + ' L'.join('%.2f %.2f' % q for q in pts)
_ln = lambda d, c='ln': '<path class="%s" d="%s"/>' % (c, d)
_nd = lambda x, y, c='': '<i class="nd %s" style="left:%.2f%%;top:%.2f%%;--t:%.3f"></i>' % (c, x, y, min(x / 100, .9))
_pl = lambda x, y, text, c='', t=None: '<b class="lgp %s" style="left:%.2f%%;top:%.2f%%;--t:%.3f">[%s]</b>' % (c, x, y, min(x / 100 if t is None else t, .88), text)
_tk = lambda x, text, c='': '<span class="tk %s" style="left:%.2f%%">%s</span>' % (c, x, text)
_dr = lambda x, y: '<line class="dr" x1="%.2f" y1="%.2f" x2="%.2f" y2="100" style="--t:%.3f"/>' % (x, y, x, x / 100)
_hz = lambda x0, y0, x1, y1, c='', clip='': '<i class="hz %s" style="left:%.2f%%;top:%.2f%%;width:%.2f%%;height:%.2f%%;--t:%.3f%s"></i>' % (c, x0, y0, x1 - x0, y1 - y0, x0 / 100, clip)
_AX = '<path class="ax" d="M0 0 V100 H100"/>'


def _ticks(xs, labels):
    return ''.join(_tk(x, t, 'a' if i == 0 else ('z' if i == len(xs) - 1 else '')) for i, (x, t) in enumerate(zip(xs, labels)))


def _lg(base, solid, html, cap, legend=''):
    return ('<div class="lgr" aria-hidden="true"><p class="cp">%s</p>%s<svg viewBox="0 0 100 100" preserveAspectRatio="none">%s</svg><div class="lgr-w"><svg viewBox="0 0 100 100" preserveAspectRatio="none">%s</svg></div>%s</div>'
            % (cap, ('<p class="lgr-k">%s</p>' % legend) if legend else '', base, solid, html))


def linefig(title, tag, text, chart, cls='', extra=''):
    return ('<section class="lf %s"><div class="w lf-i"><div class="lf-t"><h2>%s</h2><p class="lf-k">[%s]</p><p>%s</p>%s</div><div class="lf-d" data-in>%s<p class="lf-n">Sample data, example business</p></div></div></section>'
            % (cls, title, tag, text, extra, chart))


def _g_follow():   # quotes still open after the quote is sent: followed up on days 2, 5 and 10, against left alone
    T = [0, 25, 50, 75, 100]; yv = lambda v: 100 - v * 9
    fu = _dense([(0, yv(10)), (25, yv(10)), (33.3, yv(7.9)), (50, yv(7.6)), (57, yv(5.6)), (75, yv(5.2)), (79, yv(3.6)), (87.5, yv(2.6)), (100, yv(2))])
    la = _dense([(0, yv(10)), (25, yv(9.8)), (50, yv(9.5)), (75, yv(9.2)), (100, yv(8.7))])
    base = _AX + _ln(_poly(la), 'l2') + ''.join(_dr(x, _yat(fu, x)) for x in T[1:4])
    html = (''.join(_nd(x, _yat(fu, x)) for x in T[1:4]) + _nd(100, yv(2), 'r') + _pl(100, yv(2) - 9, 'Followed up', 'e') + _pl(100, yv(8.7) + 9, 'Left alone', 'g e', .2)
            + _ticks(T, ['Sent', 'Day 2', 'Day 5', 'Day 10', 'Day 30']))
    return _lg(base, _ln(_poly(fu)), html, 'Quotes still waiting on an answer')


def _g_reviews():   # reviews counted over a year: every finished job asked, against asking when you remember
    inc = [3, 2, 3, 4, 3, 3, 4, 2, 3, 3, 4, 3]; tot = float(sum(inc)); yv = lambda v: 96 - v / tot * 84
    pts = [(0, 96)]; v = 0; risers = []
    for i, k in enumerate(inc):
        x = (i + 1) * 100 / 12.0; pts.append((x, yv(v))); v += k; pts.append((x, yv(v))); risers.append((x, yv(v)))
    rem = [(0, 96), (33.3, 96), (33.3, yv(2)), (75, yv(2)), (75, yv(3)), (100, yv(3))]
    base = _AX + _ln(_poly(rem), 'l2') + ''.join(_dr(x, y) for x, y in risers[:-1])
    html = (''.join(_nd(x, y, 'o') for x, y in risers[:-1]) + _nd(100, yv(tot), 'r') + _pl(96, yv(tot) - 2, 'Every job asked', 'e') + _pl(100, yv(3) - 8, 'Asked when you remember', 'g e', .2)
            + _ticks([0, 25, 50, 75, 100], ['Jan', 'Apr', 'Jul', 'Oct', 'Jan']))
    return _lg(base, _ln(_poly(pts)), html, 'Reviews on your profile')


def _g_invoice():   # what one job is owed: reminders on days 3 and 7, paid on day 9, against paid on day 41 when nobody asks
    T = [0, 25, 50, 75, 100]; top = 24
    base = _AX + _ln('M75 %d H100 V100' % top, 'l2')
    html = (_hz(75, top, 100, 100) + _nd(25, top) + _nd(50, top) + _nd(75, top, 'r') + _pl(25, top - 10, 'Reminder', 'g') + _pl(50, top - 10, 'Reminder', 'g') + _pl(75, top - 10, 'Paid')
            + _pl(87.5, (top + 100) / 2.0, 'The wait', 'g', .8) + _pl(98.5, 91, 'If nobody asks', 'g e', .86) + _ticks(T, ['Sent', 'Day 3', 'Day 7', 'Day 9', 'Day 41']))
    return _lg(base, _ln('M0 %d H75 V100' % top), html, 'What you are owed on one job')


def _g_reports():   # eight weeks of the Monday report: leads in, jobs booked, quotes open
    xs = [i * 100 / 7.0 for i in range(8)]; yv = lambda v: 100 - v * 5.6
    leads = _dense([(x, yv(v)) for x, v in zip(xs, [9, 11, 8, 12, 13, 11, 15, 14])]); jobs = _dense([(x, yv(v)) for x, v in zip(xs, [3, 4, 4, 5, 6, 5, 7, 7])])
    quotes = _dense([(x, yv(v)) for x, v in zip(xs, [6.4, 7.2, 6.6, 6.2, 5.4, 4.6, 4, 3])])
    base = _AX + ''.join('<path class="gr" d="M0 %d H100"/>' % y for y in (16, 44, 72)) + _ln(_poly(quotes), 'l2') + ''.join(_dr(x, _yat(jobs, x)) for x in xs[1:-1])
    html = (''.join(_nd(x, _yat(jobs, x), 'o') for x in xs[1:-1]) + _nd(100, yv(14), 'r') + _nd(100, yv(7), 'r')
            + _ticks(xs, ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8']))
    return _lg(base, _ln(_poly(leads)) + _ln(_poly(jobs), 'ln n2'), html, 'The last eight weeks',
               '<b class="lgp"><i></i>Leads in</b><b class="lgp"><i class="o"></i>Jobs booked</b><b class="lgp g"><i class="d"></i>Quotes open</b>')


def _g_answer():   # when leads come in across a day, with the hours you are on a job and the hours you are closed
    hx = lambda h: (h - 6) * 100 / 18.0; yv = lambda v: 100 - v * 12.6
    cur = _dense([(hx(h), yv(v)) for h, v in [(6, .6), (7.5, 2.2), (9, 4.6), (10.5, 5.2), (12, 3.6), (13.5, 3.2), (15, 3.9), (17, 5.4), (18.5, 6.2), (20, 5), (21.5, 3), (23, 1.4), (24, .8)]])
    def under(a, b):   # the area under the curve between two hours, as a clip polygon inside its own box
        x0, x1 = hx(a), hx(b); seg = [(x, y) for x, y in cur if x0 <= x <= x1]; seg = [(x0, _yat(cur, x0))] + seg + [(x1, _yat(cur, x1))]; ty = min(y for _, y in seg)
        poly = ','.join('%.1f%% %.1f%%' % ((x - x0) / (x1 - x0) * 100, (y - ty) / (100 - ty) * 100) for x, y in seg)
        return x0, ty, x1, ';clip-path:polygon(%s,100%% 100%%,0 100%%)' % poly
    a0, at, a1, ac = under(8, 17); b0, bt, b1, bc = under(18, 24)
    hrs = [7.2, 8.6, 9.7, 11, 12.6, 14.2, 15.8, 17.3, 18.4, 19.2, 20.3, 21.8]
    base = _AX + ''.join(_dr(hx(h), _yat(cur, hx(h))) for h in hrs)
    html = (_hz(a0, at, a1, 100, '', ac) + _hz(b0, bt, b1, 100, 'h2', bc) + ''.join(_nd(hx(h), _yat(cur, hx(h))) for h in hrs)
            + _pl((a0 + a1) / 2, 88, 'On a job', 'g') + _pl((b0 + b1) / 2, 88, 'Closed', 'g')
            + _ticks([hx(h) for h in (6, 9, 12, 15, 18, 21, 24)], ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM', '12 AM']))
    return _lg(base, _ln(_poly(cur)), html, 'When leads come in', '<b class="lgp"><i class="q"></i>Reply sent</b>')


def _g_audit():   # one business from first lead to paid, with the two biggest drops marked
    v = [100, 84, 70, 64, 30, 27]; yv = lambda a: 100 - a * .84; mid = [10, 30, 50, 70, 90]
    d = 'M0 %.1f' % yv(v[0]) + ''.join(' H%d V%.1f' % (x, yv(v[i + 1])) for i, x in enumerate(mid)) + ' H100'
    base = _AX + '<path class="l2" style="--t:.1" d="M10 %.1f H30"/><path class="l2" style="--t:.7" d="M70 %.1f H90"/>' % (yv(v[0]), yv(v[3]))
    html = (_hz(70, yv(v[3]), 90, yv(v[4])) + _hz(10, yv(v[0]), 30, yv(v[1]), 'h2') + ''.join(_nd(x, yv(v[i]), 'fl' if i == 3 else '') for i, x in enumerate(mid))
            + _pl(80, (yv(v[3]) + yv(v[4])) / 2, 'Fix this first', '', .72) + _pl(20, (yv(v[0]) + yv(v[1])) / 2, 'Then this', 'g', .2)
            + _ticks([0, 20, 40, 60, 80, 100], ['Leads', 'Answered', 'Booked', 'Quoted', 'Won', 'Paid']))
    return _lg(base, _ln(d), html, 'One business, taken apart')


FIGS = {   # page: (section it goes after, the figure)
    'follow-up': ('sg', linefig('Chased until it is a yes or a no.', 'Days 2, 5 and 10, then monthly', 'Each quote is followed up on a schedule and stops the moment there is an answer.', _g_follow())),
    'reports': ('sg', linefig('Your numbers, every Monday.', 'One short report each week', 'Leads in, jobs booked, quotes open, money owed and what needs you.', _g_reports(), 'f')),
    'answering': ('st', linefig('Day or night, the reply goes out from your number.', 'Calls, texts, forms and lead sites', 'Missed calls and new leads get a text back from your business in seconds, even after hours and while you are on a job.', _g_answer())),
    'everything': ('fq', linefig('The audit finds what to fix first.', 'Free, and built around your business', 'Each build is made for the business it goes into. Your free audit decides which ones you need.', _g_audit(), 'f', '<div class="cta">%s</div>' % BOOK)),
}


# ---- /free-audit : rebuilt section by section (Nov 27) ----
_fa_cal = ('<div class="xc"><div class="xc-h">%s</div><div class="xc-g">%s</div><p class="fa-k">[Fifteen minutes]<em>Example week</em></p></div>'
           % (''.join('<span>%s</span>' % d for d in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri')),
              ''.join('<i class="%s"></i>' % ('on' if k == 8 else 'tk' if k in (1, 5, 6, 12, 14) else '') for k in range(15))))
_fa_talk = ('<div class="xt">%s<p class="fa-k">[One call]<em>How your business runs</em></p></div>'
            % ''.join('<div class="%s" style="--i:%d"><i style="width:%d%%"></i>%s</div>' % ('r' if k % 2 else 'l', k, w, '<i style="width:%d%%"></i>' % w2 if w2 else '')
                      for k, (w, w2) in enumerate(((62, 0), (80, 46), (54, 0), (88, 60), (70, 0), (76, 38)))))
_fa_rep = ('<div class="xr"><div class="xr-h"><b></b><span>[Yours]</span></div>%s<div class="xr-f"><i></i><i></i><i></i></div><p class="fa-k">[The plan]<em>You keep it</em></p></div>'
           % ''.join('<div class="xr-r" style="--i:%d"><i style="width:%d%%"></i><b></b></div>' % (k, w) for k, w in enumerate((58, 72, 44, 66, 52))))
FA3 = ('<section class="fa3" data-sp><div class="w fa3-g"><div class="fa3-h"><span class="lb">How it works</span>'
       '<p class="st-t">Fifteen minutes, then it&rsquo;s yours. <span>No slides and no pitch deck. One call about how your business runs, and a short report you keep whether or not you work with us.</span></p></div>%s</div></section>'
       % ''.join('<figure class="fa3-f xf%d" aria-hidden="true">%s</figure><div class="fa3-t t%d"><span>[Step 0%d]</span><h3>%s</h3><p>%s</p></div>' % (k, fig, k, k, h, t)
                 for k, (fig, h, t) in enumerate(((_fa_cal, 'Book a time.', 'Pick a slot. Bring rough numbers: leads a month, your average job, how many quotes you close.'),
                                                  (_fa_talk, 'We walk your business.', 'Calls, forms, texts, estimates, quotes, invoices, reviews and the work done by hand, including after hours.'),
                                                  (_fa_rep, 'You keep the plan.', 'What it&rsquo;s costing you, a number on each finding, and what to fix first.')), 1)))
FAREP = ('<section class="hw far"><div class="w hw-g"><div class="hw-t"><span class="lb">What you leave with</span>'
         '<p class="st-t">A short report with a number on everything. <span>Made from your business, not from a template.</span></p>'
         '<ol>%s</ol></div><div class="hw-r" data-in>%s</div></div></section>'
         % (''.join('<li><div><b>%s</b><span>%s</span></div></li>' % x for x in [
             ('Every finding, mapped.', 'Each place a job or an hour can slip, checked against how you run today.'),
             ('A figure on each.', 'Worked out from your own numbers: leads a month, average job, how many quotes you close.'),
             ('The order to fix them.', 'Ranked by what each one costs you, so the first fix is the one that pays most.'),
             ('A plan that&rsquo;s yours.', 'Take it to anyone, or build it yourself.')]), H.FD))
FAWALK = ('<section class="faw"><div class="w faw-i"><div class="faw-h"><span class="lb">What we look at</span>'
          '<p class="st-t">The whole business, part by part. <span>Not only how fast you answer the phone. Eight places where jobs, money or hours go missing.</span></p></div>'
          '<p class="faw-n">First call</p><div class="faw-g" data-in>%s</div><p class="faw-n b">Last invoice, and after</p></div></section>'
          % ''.join('<div class="faw-c" style="--i:%d"><span>[%02d]</span><b>%s</b><p>%s</p></div>' % (k, k + 1, h, t) for k, (h, t) in enumerate((
              ('Getting found.', 'What your website and your Google listing bring in, and what they lose.'),
              ('How leads come in.', 'Calls, forms, Facebook, Angi, Thumbtack. Where each one lands and who sees it.'),
              ('How they get answered.', 'How long a new lead waits to hear back, including after hours.'),
              ('How estimates get booked.', 'Whether serious leads end up on your calendar and show up.'),
              ('How quotes get followed up.', 'Quotes sent and never chased.'),
              ('How you get paid.', 'When invoices go out, how long they wait, and who reminds anyone.'),
              ('What happens after the job.', 'Finished jobs with no review request, no referral ask and no repeat work.'),
              ('What&rsquo;s done by hand.', 'Every task someone repeats each week that could run on its own.')))))
FAUDIT = (H.inner_hero('The free audit', 'A full audit of your business, free.',
                       'We walk your business from the first call to the last invoice and show you what it&rsquo;s costing you, in dollars a month and hours a week, and what to fix first.',
                       H.BOOK + '<a class="btn q" href="/audit">Check your site in 60 seconds</a>', H.MAP)
          + FA3 + FAREP + FAWALK
          + H.split('What to bring', 'Rough numbers are fine.', 'You don&rsquo;t need a spreadsheet. If you know roughly these four things, we can do the rest on the call.',
                    H.facts('Bring these', 'Rough is fine', [('Leads a month', 'About 100', ''), ('Your average job', 'About $2,400', ''), ('Quotes you close', 'About 1 in 3', ''), ('Where leads come from', 'Google, Facebook, referrals', '')])
                    + '<p class="sd-n">Sample answers</p>')
          + H.faq('Questions.', [('Is it really free?', 'Yes. You keep the plan whether or not you work with us.'),
                                 ('How long is the call?', 'Fifteen minutes.'),
                                 ('Do I need to prepare?', 'Just rough numbers. We do the rest.'),
                                 ('What happens after?', 'If you want the fixes, we build them for your business and price them to it. If not, you keep everything we found.'),
                                 ('Rather write?', 'Email <a href="mailto:sam.cinderrevenue@gmail.com">sam.cinderrevenue@gmail.com</a>.')])
          + H.ask('Start with your website.', 'A free check of your site in 60 seconds, before the call.', 'Check your site', '/audit')
          + ('<section class="bk2" id="book"><div class="w bk2-i"><p class="st-t">Pick a time. <span>Fifteen minutes, on the phone or on video.</span></p>'
             '<iframe src="https://cal.com/audit-call/15min?embed=true&amp;theme=light" title="Book your free audit" loading="lazy"></iframe></div></section>')
          + H.CL)
CSS_FA = r"""
/* ---- three cards, each with a small picture above its line ---- */
.v3-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(64px,6vw,116px) 0 0}.v3 .st-t{max-width:26em;margin:0;padding:0 clamp(22px,3.1vw,60px) clamp(40px,4vw,72px)}
.v3-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--ln);border-bottom:1px solid var(--ln)}
.v3-g>div{padding:clamp(22px,2.2vw,40px) clamp(22px,2.4vw,44px) clamp(30px,3vw,54px);border-right:1px solid var(--ln)}.v3-g>div:last-child{border-right:0}
.v3-p{height:clamp(190px,15vw,240px);margin-bottom:clamp(22px,2vw,36px);display:grid;place-items:center;border-radius:10px;background:var(--g);box-shadow:inset 0 0 0 1px var(--ln)}
.v3-g b{display:block;font-size:clamp(16px,1.1vw,19px);font-weight:560;letter-spacing:-.015em}.v3-g span{display:block;margin-top:8px;max-width:24em;font-size:clamp(14px,.95vw,16.5px);line-height:1.42;color:var(--g2)}
.fv{width:78%;font-size:13px}.fv .hb{margin:0}.fv span{display:inline;margin:0;max-width:none;font-size:inherit;color:inherit}
.fv1>div{display:flex;gap:6px;margin-top:18px;padding-top:14px;border-top:1px solid var(--ink);position:relative}.fv1 i{flex:1;padding:7px 0;border-radius:6px;background:#fff;box-shadow:inset 0 0 0 1px var(--ln);font:500 10.5px/1 "Geist Mono",monospace;font-style:normal;text-align:center}
.fv1 i:first-child{background:var(--ink);color:#fff;box-shadow:none}
.fv2>div{display:grid;gap:6px;margin:14px 0 0 18%}.fv2 span{display:block;padding:8px 10px;border-radius:8px;background:#fff;box-shadow:inset 0 0 0 1px var(--ln);font-weight:520}.fv2 span.k{background:var(--ink);color:#fff;box-shadow:none}
.fv3{display:grid;gap:10px;padding:16px;border-radius:10px;background:#fff;box-shadow:0 0 0 1px var(--ln);box-sizing:border-box}.fv3 p{margin:0;display:flex;justify-content:space-between;font-size:13px}.fv3 p b{font-size:13px;font-weight:560}
.fv3 em{font-style:normal;padding:9px 0;border-radius:7px;background:var(--ink);color:#fff;text-align:center;font-weight:560}.fv3 u{text-decoration:none;font:500 10.5px/1.3 "Geist Mono",monospace;color:var(--g2);text-align:center}
/* ---- a list on the left that steps through on its own; the window on the right follows it ---- */
.acd-g{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);border-left:1px solid var(--ln);border-right:1px solid var(--ln);border-bottom:1px solid var(--ln)}
.acd-t{padding:clamp(48px,5vw,96px) clamp(22px,3.1vw,60px)}.acd-t .st-t{margin:18px 0 clamp(28px,3vw,52px);max-width:14em}
.acd-l>div{position:relative;padding:15px 0 15px 18px;border-left:1px solid var(--ln);color:var(--g3);transition:color .3s}.acd-l b{display:block;font-size:clamp(15.5px,1.05vw,18.5px);font-weight:540;letter-spacing:-.012em}
.acd-l span{display:block;max-height:0;overflow:hidden;font-size:clamp(14px,.95vw,16.5px);line-height:1.42;color:var(--g2);transition:max-height .4s,margin .4s}
.acd-l>div.on{color:var(--ink)}.acd-l>div.on span{max-height:4em;margin-top:6px}.acd-l u{position:absolute;left:-1px;top:0;bottom:0;width:2px;background:var(--ink);transform-origin:top}
.live .acd-l u.in{animation:acdp 4.2s linear both}@keyframes acdp{from{transform:scaleY(0)}}
.acd:not(.live) .acd-l>div{color:var(--ink)}.acd:not(.live) .acd-l span{max-height:none;margin-top:6px}
.acd-p{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(40px,4vw,80px) clamp(22px,3vw,56px);border-left:1px solid var(--ln);background:linear-gradient(180deg,#f4f5f9,#ececef)}
.acd-p .oq{width:100%;max-width:520px}.acd .oq-r{transition:background .3s,box-shadow .3s,opacity .3s}.acd.live .oq-r:not(.on){opacity:.42}.acd.live .oq-r.on{background:#fff;box-shadow:inset 2px 0 0 var(--ink)}
/* ---- the eight parts as one numbered grid ---- */
.pl8-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(72px,7vw,130px) 0 0;text-align:center}
.pl8 h2{margin:0;font-size:clamp(30px,3vw,54px);line-height:1.04;letter-spacing:-.04em;font-weight:600}.pl8-i>p{margin:14px 0 clamp(48px,5vw,90px);font-size:clamp(15.5px,1.1vw,19px);color:var(--g2)}
.pl8-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--ln);text-align:left}
.pl8-g a{position:relative;display:grid;gap:10px;padding:clamp(18px,1.6vw,28px) clamp(18px,1.8vw,32px) clamp(26px,2.4vw,44px);border-right:1px solid var(--ln);border-bottom:1px solid var(--ln);color:var(--ink);transition:background .2s}
.pl8-g a:nth-child(4n){border-right:0}.pl8-g a:hover{background:#fff}.pl8-g a.on{background:var(--g)}
.pl8-g span{font:500 11px/1 "Geist Mono",monospace;letter-spacing:.05em;color:var(--t3)}.pl8-g b{margin-top:clamp(14px,1.6vw,30px);font-size:clamp(16px,1.15vw,20px);font-weight:560;letter-spacing:-.015em}
.pl8-g em{font-style:normal;font-size:13.5px;color:var(--g2)}
@media(max-width:860px){.v3-g,.acd-g{grid-template-columns:minmax(0,1fr)}.v3-g>div{border-right:0;border-bottom:1px solid var(--ln)}.v3-g>div:last-child{border-bottom:0}.acd-p{border-left:0;border-top:1px solid var(--ln)}
.pl8-g{grid-template-columns:repeat(2,minmax(0,1fr))}.pl8-g a:nth-child(2n){border-right:0}}
/* ---- /estimates ---- */
.v3c .st-t{margin:0 auto;text-align:center}.v3c .v3-i{padding-top:clamp(72px,7vw,130px)}
.ev{width:76%;font-size:13px}.ev1>div{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ev1 i{aspect-ratio:1.2;border-radius:6px;box-shadow:inset 0 0 0 1px var(--ln);background:repeating-linear-gradient(135deg,#fff 0 5px,rgba(23,24,26,.06) 5px 6px)}
.ev1 p{display:flex;align-items:center;justify-content:space-between;height:46px;margin:14px 0 0;padding:0 12px;border-radius:23px;background:var(--ink)}.ev1 u{width:2px;border-radius:1px;background:#fff;text-decoration:none}
.ev2{background:#fff;border-radius:10px;box-shadow:0 0 0 1px var(--ln)}.ev2 p{display:flex;align-items:center;gap:10px;margin:0;padding:11px 14px;border-top:1px solid var(--ln)}.ev2 p:first-child{border-top:0}
.ev2 b{flex:1;font-size:13px;font-weight:540}.ev2 p span{margin:0;font:500 10.5px/1 "Geist Mono",monospace;color:var(--t3)}.ev2 i{width:44px;height:8px;border-radius:2px;background:var(--ink)}
.ev3{display:grid;gap:12px;text-align:center}.ev3 em{font-style:normal;padding:12px 0;border-radius:8px;background:var(--ink);color:#fff;font-weight:560;font-size:14px}.ev3 u{text-decoration:none;font:500 10.5px/1.3 "Geist Mono",monospace;color:var(--g2)}
.ewk{--q:var(--p,1)}.ewk-g{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(56px,6vw,110px) clamp(22px,3.1vw,60px)}
.ewk-f{margin:0 0 30px}.ewk-f .fa-k{margin:0 0 22px}
.ewk-x{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));border-bottom:1px solid var(--ink);padding-bottom:10px}.ewk-x span{font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--t3)}
.ewk-t{margin-top:clamp(30px,3vw,52px)}.ewk-t>b{display:block;margin-bottom:18px;font:400 clamp(20px,1.7vw,28px)/1.1 Georgia,serif;letter-spacing:-.01em}
.ewk-t>div{position:relative;height:30px;margin-right:6.25%}.ewk-t i{position:absolute;left:0;top:14px;height:2px;width:100%;background:var(--ink);transform-origin:left}
.ewk-t.a i{transform:scaleX(clamp(0,calc(var(--q)*1.25),1))}.ewk-t.b i{width:7%;background:#266df1;transform:scaleX(clamp(0,calc(var(--q)*9),1))}
.ewk-t em{position:absolute;top:2px;font-style:normal;font-size:12px;font-weight:560;padding:6px 9px;border-radius:6px;white-space:nowrap}
.ewk-t.a em{left:100%;transform:translateX(-50%);background:var(--ink);color:#fff;opacity:clamp(0,calc(var(--q)*12 - 9.4),1)}
.ewk-t.b em{left:7%;margin-left:8px;background:#266df1;color:#fff;opacity:clamp(0,calc(var(--q)*9 - 1),1)}
.ewk-t u{position:absolute;left:var(--x);top:-12px;transform:translateX(-50%);text-decoration:none;font:500 10.5px/1 "Geist Mono",monospace;color:#e5484e;white-space:nowrap;opacity:clamp(0,calc(var(--q)*12 - 3 - var(--k)*2.9),1)}
.ewk-t u::after{content:"";position:absolute;left:50%;top:22px;width:9px;height:9px;margin-left:-4.5px;border-radius:50%;background:#e5484e;box-shadow:0 0 0 3px #fff}
.ewk-n{margin:30px 0 0;max-width:34em;font-size:14px;line-height:1.45;color:var(--g2)}
.ewk-c{margin-bottom:44px}.ewk-c span{display:block;font-size:clamp(15px,1.05vw,18px);color:var(--g2);text-decoration:line-through;text-decoration-color:#b4b7bf}
.ewk-c h3{margin:12px 0 0;max-width:13em;font:400 clamp(28px,3vw,54px)/1.06 Georgia,"Times New Roman",serif;letter-spacing:-.022em}
@media(min-width:861px){.ewk.sp-live{--q:var(--p,0)}
.ewk.sp-live .ewk-g{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);column-gap:clamp(40px,6vw,110px)}
.ewk.sp-live .ewk-f{grid-column:1;grid-row:1/4;position:sticky;top:calc(50vh - 170px);align-self:start;margin:0}
.ewk.sp-live .ewk-c{grid-column:2;min-height:70vh;margin:0;display:flex;flex-direction:column;justify-content:center}}
.acd-r .acd-t{order:2}.acd-r .acd-p{border-left:0;border-right:1px solid var(--ln)}
.esw{width:100%;max-width:520px}.esw-r{padding:14px 18px;border-top:1px solid var(--ln);transition:opacity .3s,background .3s,box-shadow .3s}.esw-r p{display:flex;justify-content:space-between;gap:14px;margin:0;padding:6px 0;font-size:14px}
.esw-r p b{font-weight:540}.esw-r p span,.esw-r>span{color:var(--g2);font-size:13px}.esw-r p.t b,.esw-r p.t span{font-size:17px;font-weight:600;color:var(--ink)}
.esw-r[data-sc="0"] p{display:block;font:400 17px/1.35 Georgia,serif}.esw-r[data-sc="0"]>span{font:500 10.5px/1 "Geist Mono",monospace;text-transform:uppercase;letter-spacing:.04em}
.esw-r[data-sc="3"]{display:flex;align-items:center;gap:14px}.esw-r em{font-style:normal;padding:9px 14px;border-radius:7px;background:var(--ink);color:#fff;font-weight:560;font-size:13.5px}
.acd.live .esw-r:not(.on){opacity:.4}.acd.live .esw-r.on{background:#fff;box-shadow:inset 2px 0 0 var(--ink)}.acd.live .esw-r[data-sc="3"]:not(.on)>span{visibility:hidden}
@media(max-width:860px){.acd-r .acd-t{order:0}.acd-r .acd-p{border-right:0}.ewk-x span{font-size:9px}}
.wn{padding-bottom:18px}.wn>p{margin:18px 18px 10px;font:400 clamp(18px,1.5vw,24px)/1.3 Georgia,"Times New Roman",serif;letter-spacing:-.01em}.wn>span{display:block;margin:0 18px;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--t3)}
.trd.fit div{padding-top:clamp(26px,2.2vw,40px)}.trd.fit b{position:relative;padding-top:22px}.trd.fit b::before{content:"";position:absolute;left:0;top:0;width:8px;height:8px;background:var(--ink)}
/* ---- /reviews ---- */
.rh{background:radial-gradient(120% 90% at 50% 0,#fff 30%,#eef1fb 78%,#e9e9ee)}.rh-i{position:relative;text-align:center;padding:clamp(120px,13vw,230px) var(--pad) clamp(150px,15vw,260px);border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.rh h1{margin:18px auto 0;max-width:11em;font-size:clamp(40px,5.2vw,96px);line-height:.98;letter-spacing:-.05em;font-weight:600}.rh .sub{margin:20px auto 0;max-width:30em}.rh .cta{justify-content:center}
.rh-c{position:absolute;width:clamp(190px,17vw,260px);padding:14px 16px;border-radius:12px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.08),0 24px 50px -30px rgba(38,38,60,.45);text-align:left;font-size:13.5px}
.rh-c span{display:block;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--t3)}.rh-c b{display:block;margin-top:8px;font-size:15.5px;font-weight:560}
.rh-c p{margin:8px 0 0;line-height:1.38}.rh-c .sr5,.rh-c .sr5 svg{color:#f0a001;fill:#f0a001}
.rh-c.c1{left:5%;top:17%}.rh-c.c2{right:4%;top:24%}.rh-c.c3{left:9%;bottom:15%}.rh-c.c4{right:8%;bottom:12%}
.rh{overflow:hidden}.rh-i{padding-top:clamp(96px,9.4vw,160px);padding-bottom:0}.rh-c{z-index:2;width:clamp(176px,15.4vw,224px)}.rh-c.c1{left:1.5%;top:12%}.rh-c.c2{right:1.5%;top:19%}.rh-c.c3{left:1.5%;top:44%;bottom:auto}.rh-c.c4{right:1.5%;top:50%;bottom:auto}.rh h1{max-width:9em}
.rh-w{position:relative;width:min(880px,88%);margin:clamp(52px,5vw,88px) auto 0;border-radius:14px 14px 0 0;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.1),0 -30px 70px -40px rgba(38,38,60,.4);text-align:left}
.rh-wb{display:flex;align-items:center;gap:7px;height:44px;padding:0 16px;border-bottom:1px solid var(--ln);font-size:13px}.rh-wb i{width:10px;height:10px;border-radius:50%;background:#e3e4e8}.rh-wb b{margin-left:10px;font-weight:560}
.rh-wb em{margin-left:auto;font:500 10.5px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3)}
.rh-wg{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.6fr)}.rh-wn{padding:26px 26px 30px;border-right:1px solid var(--ln)}
.rh-wn b{display:block;font-size:clamp(54px,5.4vw,92px);line-height:.9;font-weight:500;letter-spacing:-.05em}.rh-wn span{display:block;margin-top:12px;font-size:15px;color:var(--t2)}
.rh-wn .sr5{margin-top:16px}.rh-wn .sr5 svg,.rh-wl .sr5 svg{fill:#f0a001;color:#f0a001}.rh-wn em{display:block;margin-top:16px;font:500 10.5px/1 "Geist Mono",monospace;font-style:normal;letter-spacing:.04em;text-transform:uppercase;color:var(--t3)}
.rh-wl .rw{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:18px;padding:15px 22px;border-top:1px solid var(--ln)}.rh-wl .rw:first-child{border-top:0}
.rh-wl .rw i{height:7px;width:var(--w);border-radius:4px;background:#e3e4e8}.rh-wl time{font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--t3)}
.srx>div:not(.q) u{grid-column:1/-1;height:5px;border-radius:3px;background:var(--ln);text-decoration:none;position:relative}.srx>div:not(.q) u::after{content:"";position:absolute;left:0;top:0;bottom:0;width:var(--w);min-width:5px;border-radius:3px;background:#b4b7bf}
.srx>div.on u::after{background:#266df1}.srx-k{margin:2px 4px 0;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--t3)}
@media(max-width:1100px){.rh-w{width:100%;margin-top:36px}}@media(max-width:560px){.rh-wg{grid-template-columns:minmax(0,1fr)}.rh-wn{border-right:0;border-bottom:1px solid var(--ln);padding:20px}.rh-wb em{display:none}.rh-wl .rw{padding:13px 16px;gap:12px}}
.rh-n{position:absolute;left:0;right:0;bottom:22px;margin:0;font:500 10.5px/1 "Geist Mono",monospace;color:var(--t3)}
.rvc{--a:clamp(0,calc(var(--p,1)/.5),1);--r:0;background:#fff;border-top:1px solid var(--ln);border-bottom:1px solid var(--ln)}.rvc-i{position:relative;overflow:hidden}
.rvc-f{position:relative;height:min(88vh,860px);border-left:1px solid var(--ln);border-right:1px solid var(--ln);box-sizing:border-box}
.rvc-f::before{content:"";position:absolute;left:0;right:0;top:0;height:54px;border-bottom:1px solid var(--ln);background:radial-gradient(circle,#d7d9e0 1px,transparent 1.4px) 0 0/9px 9px}
.rvc-g{position:absolute;inset:55px 0 0 0}.rvc-g svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.rvc-g path{fill:none;vector-effect:non-scaling-stroke}.rvc-g .hi{stroke:#266df1;stroke-width:2;clip-path:inset(-10% calc((1 - var(--a))*100%) -10% 0)}
.rvc-g .dr{stroke:#266df1;stroke-width:1;opacity:calc((.08 + .34*var(--x))*clamp(0,calc((var(--a) - var(--x))*18),1))}
.rvc-t{position:absolute;left:clamp(22px,4.2vw,60px);top:50%;transform:translateY(-46%);max-width:min(30em,52%);z-index:2}
.rvc-t .lb{background:#e4ebfe;color:#1f4fbe}.rvc-t .st-t{margin:22px 0 0;max-width:15em;font-size:clamp(24px,2.2vw,38px);line-height:1.12}
.rvc-s{display:grid;grid-template-columns:repeat(2,auto);justify-content:start;gap:clamp(22px,2.2vw,36px) clamp(36px,5vw,90px);margin-top:clamp(30px,3.4vw,58px)}
.rvc-s div{padding-left:22px;border-left:2px solid #266df1}.rvc-s b{display:block;font-size:clamp(24px,2.1vw,36px);font-weight:500;letter-spacing:-.02em;line-height:1}.rvc-s span{display:block;margin-top:8px;font-size:clamp(14px,1vw,17px);color:var(--t2)}
.rvc-n{margin:26px 0 0;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;color:var(--t3)}
.rvc-k{display:none}.rvc-g .ar{fill:color-mix(in srgb,#266df1 calc((1 - var(--r)*var(--r))*100%),var(--dk));opacity:clamp(0,calc(var(--r)*2.6),1)}
/* the graph is the hand-over: the view dives in under the curve until the blue is the whole screen, then it darkens into the next section */
.rvc.sp-live .rvc-f{transform-origin:86% 74%;transform:scale(calc(1 + var(--r)*var(--r)*var(--r)*44));will-change:transform}
.rvc.sp-live .rvc-t{opacity:calc(1 - var(--r)*5)}.rvc.sp-live .rvc-f::before{opacity:calc(1 - var(--r)*5)}
.rvc.sp-live .rvc-g .dr{opacity:calc((.08 + .34*var(--x))*clamp(0,calc((var(--a) - var(--x))*18),1)*(1 - var(--r)))}
.rvc.sp-live .rvc-i{background:color-mix(in srgb,#fff calc((1 - clamp(0,calc(var(--r)*3 - 2),1))*100%),var(--dk))}
@media(min-width:861px){.rvc.sp-live{height:240vh;--a:clamp(0,calc(var(--p,0)/.46),1);--r:clamp(0,calc((var(--p,0) - .6)/.4),1)}.rvc.sp-live .rvc-i{position:sticky;top:0;height:100vh;display:flex;align-items:center;justify-content:center}.rvc.sp-live .rvc-f{flex:none;margin:0 auto}}
.rvc{--a:1}.rvc-g .hi{clip-path:none}.rvc-g .dr{opacity:calc(.08 + .34*var(--x))}.rvc-g .lo{stroke:#b4b7bf;stroke-width:1.5;stroke-dasharray:5 5}
.rvc-g .ar{display:none}.rvc-a{position:absolute;inset:0;background:#266df1;opacity:.08;clip-path:polygon(0.00% 91.00%,2.00% 90.99%,4.00% 90.95%,6.00% 90.88%,8.00% 90.76%,10.00% 90.59%,12.00% 90.38%,14.00% 90.10%,16.00% 89.77%,18.00% 89.38%,20.00% 88.93%,22.00% 88.41%,24.00% 87.82%,26.00% 87.16%,28.00% 86.43%,30.00% 85.63%,32.00% 84.75%,34.00% 83.79%,36.00% 82.75%,38.00% 81.63%,40.00% 80.43%,42.00% 79.15%,44.00% 77.78%,46.00% 76.33%,48.00% 74.78%,50.00% 73.15%,52.00% 71.43%,54.00% 69.61%,56.00% 67.70%,58.00% 65.70%,60.00% 63.60%,62.00% 61.41%,64.00% 59.12%,66.00% 56.73%,68.00% 54.23%,70.00% 51.64%,72.00% 48.95%,74.00% 46.15%,76.00% 43.25%,78.00% 40.25%,80.00% 37.14%,82.00% 33.92%,84.00% 30.59%,86.00% 27.16%,88.00% 23.61%,90.00% 19.96%,92.00% 16.19%,94.00% 12.32%,96.00% 8.32%,98.00% 4.22%,100.00% 0.00%,100% 100%,0% 100%)}.rvc-e b{margin-left:9px;padding-left:9px;border-left:1px solid currentColor;font-weight:500;opacity:.8}.rvc-x{position:absolute;left:var(--x);bottom:10px;padding:5px 7px;background:#fff;box-shadow:inset 0 0 0 1px var(--ln);border-radius:5px;font:500 10px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--t2);white-space:nowrap}.rvc-x.r{left:auto;right:1%}.rvc-k p,.rvc-m{display:none}
.rvc-h{position:absolute;left:0;right:0;top:0;height:54px;margin:0;padding:0 clamp(22px,4.2vw,60px);display:flex;align-items:center;justify-content:space-between;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--t2)}
.rvc-h span{padding:6px 8px;background:#fff}
.rvc-e{position:absolute;padding:7px 11px;border-radius:7px;font-size:13px;font-weight:560;white-space:nowrap;background:#fff;box-shadow:inset 0 0 0 1px var(--ln);color:var(--t2)}
.rvc-e.a{right:9%;top:3.5%;background:#266df1;color:#fff;box-shadow:none}.rvc-e.b{right:14px;top:calc(80% - 44px)}
@media(min-width:861px){.rvc.sp-live{height:280vh;--a:1;--r:clamp(0,calc((var(--p,0) - .2)/.5),1);--e:calc(var(--r)*var(--r)*(3 - 2*var(--r)));--g1:clamp(0,calc((var(--p,0) - .68)/.2),1)}
.rvc.sp-live .rvc-f{transform:none;will-change:auto}.rvc.sp-live .rvc-i{background:#fff}
.rvc.sp-live .rvc-k{display:block;position:absolute;left:0;right:0;top:0;height:200vh;z-index:3;pointer-events:none;will-change:transform;background:#fcfcfd radial-gradient(circle,#d3d6de .8px,transparent 1.2px) 0 0/10px 10px;clip-path:polygon(0% 46%,0.000% 42.17%,8.333% 42.17%,8.333% 38.33%,16.667% 38.33%,16.667% 34.50%,25.000% 34.50%,25.000% 30.67%,33.333% 30.67%,33.333% 26.83%,41.667% 26.83%,41.667% 23.00%,50.000% 23.00%,50.000% 19.17%,58.333% 19.17%,58.333% 15.33%,66.667% 15.33%,66.667% 11.50%,75.000% 11.50%,75.000% 7.67%,83.333% 7.67%,83.333% 3.83%,91.667% 3.83%,91.667% 0.00%,100.000% 0.00%,100% 100%,0% 100%);transform:translateY(calc(100vh - var(--e)*200vh))}
.rvc.sp-live .rvc-k p{display:block;position:absolute;left:0;right:0;top:calc(100vh + 46vh);margin:0 auto;padding:0 24px;max-width:13em;text-align:center;color:var(--ink);font-size:clamp(34px,4.4vw,84px);line-height:1.02;letter-spacing:-.045em;font-weight:600;transform:translateY(-50%)}
.rvc-k p span{color:#a3abbd}
.rvc.sp-live .rvc-m{position:absolute;left:0;right:0;top:calc(100vh + 46vh + clamp(120px,13vw,230px));display:block;text-align:center;opacity:var(--g1)}.rvc-m i{display:none}.rvc-m b{display:block;font-size:clamp(16px,1.2vw,20px);font-weight:560}
.rvc-m em{display:block;margin-top:8px;font-style:normal;font-size:clamp(15px,1.1vw,19px);color:var(--t2)}}
.rvc .rvc-g .hi{stroke:#266df1;stroke-width:1.75}.rvc .rvc-g .dr{stroke:#266df1;opacity:calc(.12 + .3*var(--x))}.rvc.sp-live .rvc-g .dr{opacity:calc(.12 + .3*var(--x))}.rvc .rvc-a{background:#266df1;opacity:.1;-webkit-mask:linear-gradient(90deg,transparent 15%,#000);mask:linear-gradient(90deg,transparent 15%,#000)}.rvc .rvc-e,.rvc .rvc-x,.rvc .rvc-h,.rvc .rvc-g .lo{display:none}.rvc .rvc-s div{border-left-width:1.5px}
.rvs svg path{fill:none;vector-effect:non-scaling-stroke}.rvs .hi2{stroke:#266df1;stroke-width:2}.rvs .lo2{stroke:#17181a;stroke-width:1.5}.rvs .bs{stroke:#17181a;stroke-width:1}
.rvs .vt{stroke:#266df1;stroke-width:1;opacity:.28}.rvs svg .fa{fill:#266df1;opacity:.06}.rvs svg .fb{fill:#17181a;opacity:.07}
.rvs-n{position:absolute;left:var(--x);bottom:var(--y);transform:translate(-100%,-6px);padding-right:7px;font:500 10.5px/1 "Geist Mono",monospace;color:#1f4fbe}
.rvs-m{position:absolute;left:var(--x);bottom:3.2%;transform:translateX(-50%);font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--t3)}
.rvs-a,.rvs-b{position:absolute;margin:0}.rvs-a{left:47%;top:6%;max-width:15em}.rvs-a b{display:block;font-size:clamp(52px,6vw,112px);line-height:.92;font-weight:500;letter-spacing:-.05em;color:#266df1}
.rvs-a span{display:block;margin-top:12px;font-size:clamp(15px,1.15vw,19px);line-height:1.3;color:var(--t2)}
.rvs-b{right:3%;bottom:22%;display:flex;align-items:baseline;gap:10px;padding:9px 13px;border-radius:9px;background:#fff;box-shadow:inset 0 0 0 1px var(--ln)}.rvs-b b{font-size:22px;font-weight:560;letter-spacing:-.02em}.rvs-b span{font-size:13.5px;color:var(--t2)}
.rvc .rvc-t{top:39%;max-width:min(24em,29%)}.rvc .rvc-t .st-t{font-size:clamp(22px,1.9vw,32px)}.rvc .rvc-s{gap:clamp(16px,1.6vw,24px) clamp(20px,2.2vw,36px);margin-top:clamp(22px,2.4vw,38px)}.rvc .rvc-s div{padding-left:14px}.rvc .rvc-s span{font-size:13.5px}.rvc .rvc-s b{font-size:clamp(22px,1.8vw,30px)}
.rvc .rvc-f::before{display:none}.rvc .rvc-g{inset:0}
@media(max-width:860px){.rvs-n,.rvs-b{display:none}.rvs-m:nth-of-type(even){display:none}.rvc .rvc-t{top:auto;max-width:none}.rvc .rvc-g{inset:auto 0 0 0;height:62vw}.rvs-a{left:var(--pad);top:auto;bottom:calc(100% + 18px)}.rvs-a b{font-size:46px}.rvs-a b br{display:none}.rvc .rvc-f{padding:44px 0 calc(62vw + 150px)}}
@media(max-width:860px){.rvc-x{display:none}.rvc-e b{display:none}.rvc-e.b{display:none}.rvc-e.a{right:14px;top:-6px}}
.sgp svg .o{fill:none}.sgp svg .f{fill:#17181a}.sgp svg .t{stroke:#e3e4e8;stroke-width:5;stroke-linecap:round}.sgp svg .rb{stroke:#17181a;stroke-width:5;stroke-linecap:round}.sgp svg .kb{stroke:#e5484e;stroke-width:5;stroke-linecap:round}
.sgp svg rect.r{fill:none;stroke:#e5484e}
.rvp .rvp-l .rvp-n b{font:560 clamp(18px,1.45vw,25px)/1.12 Inter,system-ui,sans-serif;letter-spacing:-.025em}
.rq{width:78%;font-size:13px}.rq1{display:grid;justify-items:start}.rq1 p{display:flex;align-items:center;gap:12px;margin:0;padding:11px 14px;border-radius:9px;background:#fff;box-shadow:inset 0 0 0 1px var(--ln);width:100%;box-sizing:border-box}
.rq1 time{font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;color:var(--t3)}.rq1 b{margin:0;font-size:13.5px}.rq1>i{width:1px;height:22px;margin-left:26px;background:var(--ink)}.rq1 p.k{background:#266df1;box-shadow:none}.rq1 p.k b,.rq1 p.k time{color:#fff}
.rq2>div{display:grid;grid-template-columns:repeat(17,minmax(0,1fr));gap:4px}.rq2 i{aspect-ratio:1;border-radius:2px;background:#266df1}.rq2 p{margin:14px 0 0;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--t2)}
.rq3{display:grid;gap:10px}.rq3 .hb{margin:0;max-width:none}.rq3 em{font-style:normal;justify-self:end;padding:9px 16px;border-radius:8px;background:#266df1;color:#fff;font-weight:560}
.rq3>div{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;border-radius:9px;background:#fff;box-shadow:inset 0 0 0 1px var(--ln)}.rq3>div span{margin:0;font-size:13px;font-weight:540;color:var(--ink)}.rq3 .sr5 svg{fill:#f0a001;width:15px;height:15px}
.rvp{background:var(--dk);color:#fff}.rvp-i{border-left:1px solid var(--dl);border-right:1px solid var(--dl);padding:clamp(72px,7vw,130px) clamp(22px,3.1vw,60px) clamp(64px,6vw,110px)}
.rvp .st-t{margin:0 0 clamp(48px,5vw,90px);max-width:22em;color:#fff}.rvp .st-t span{color:#8f9197}
.rvp-l{position:relative;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:clamp(12px,1.4vw,26px)}.rvp-l>i{position:absolute;left:0;right:0;top:5px;height:1px;background:#3a3b40}
.rvp-n{position:relative;padding-top:34px;transition:opacity .4s}.rvp-n::before{content:"";position:absolute;left:0;top:0;width:11px;height:11px;background:#266df1;box-shadow:0 0 0 5px var(--dk)}
.rvp.live .rvp-n[data-hd]:not(.in){opacity:.28}.rvp.live .rvp-n[data-hd]:not(.in)::before{background:#5c5e63}.rvp.live .rvp-n[data-hd].in{animation:none;opacity:1}
.rvp-n span{display:block;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:#8f9197}.rvp-n b{display:block;margin-top:12px;font:400 clamp(20px,1.7vw,30px)/1.1 Georgia,"Times New Roman",serif;letter-spacing:-.012em}
.rvp-n p{margin:12px 0 0;font-size:14px;line-height:1.4;color:#a9abb0}.rvp-n p.hb{max-width:none;background:#266df1;color:#fff;border-radius:12px 12px 12px 3px}.rvp-n .sr5{margin-top:14px}.rvp-n .sr5 svg{fill:#f0a001;width:20px;height:20px}
.rvp-t{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(20px,2.4vw,44px);margin-top:clamp(56px,6vw,100px);padding-top:clamp(24px,2.4vw,40px);border-top:1px solid var(--dl)}
.rvp-t b{display:block;font-size:clamp(16px,1.1vw,19px);font-weight:560}.rvp-t span{display:block;margin-top:8px;font-size:clamp(14px,.95vw,16.5px);line-height:1.42;color:#a9abb0}
.v3d{background:var(--dk);color:#fff}.v3d .st-t{color:#fff}.v3d .v3-i,.v3d .v3-g,.v3d .v3-g>div{border-color:var(--dl)}.v3d .st-t span{color:#8f9197}.v3d .v3-g span{color:#a9abb0}
.v3d .v3-p{background:#17181a;box-shadow:inset 0 0 0 1px var(--dl);color:var(--ink)}
.rv{width:76%;font-size:13px}.rv1{background:#fff;border-radius:10px;overflow:hidden}.rv1 p{display:flex;justify-content:space-between;margin:0;padding:12px 14px}.rv1 p span{margin:0;font-size:13px;color:var(--g2)}.rv1 p b{font-size:13px}
.rv1 p.k{background:#266df1;color:#fff}.rv1 p.k span{color:#fff}.rv2{display:grid;gap:10px}.rv2 .hb{margin:0;max-width:none;background:#2a2b30;color:#fff}.rv2 em{font-style:normal;justify-self:start;padding:8px 12px;border-radius:7px;background:#fff;font-weight:560}
.rv3{display:grid;gap:8px}.rv3>div{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border-radius:9px;background:#fff}.rv3>div b{font-size:14px}.rv3 .sr5,.rv3 .sr5 svg{color:#f0a001;fill:#f0a001}
.rv3>div.g{background:#232427;color:#8f9197}.rv3>div.g .sr5,.rv3>div.g .sr5 svg{color:#5c5e63;fill:#5c5e63}
.acd.live .srx>[data-sc]{transition:opacity .3s,box-shadow .3s}.acd.live .srx>[data-sc]:not(.on){opacity:.45}.acd .srx>div.on{background:#fff;box-shadow:inset 0 0 0 2px var(--ink),0 30px 60px -36px rgba(45,45,47,.5)}
.acd .acd-p .srx{width:100%;max-width:560px}
@media(max-width:1100px){.rh-i{padding-bottom:40px}.rh-c{position:static;width:auto;margin:10px auto 0;max-width:340px}.rh-c.c1{margin-top:36px}.rh-n{position:static;margin-top:16px}}
.rvp-h{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:clamp(30px,5vw,100px);align-items:start;margin-bottom:clamp(56px,6vw,104px)}
.rvp .rvp-h .st-t{margin:0 0 clamp(28px,3vw,48px)}.rvp-h .rvp-t{display:block;margin:0;padding:0;border-top:1px solid var(--dl)}.rvp-h .rvp-t>div{padding:16px 0;border-bottom:1px solid var(--dl)}
.rvq{padding:clamp(18px,1.8vw,28px);border-radius:14px;box-shadow:inset 0 0 0 1px var(--dl)}.rvq+.rvq{margin-top:14px}.rvq.on{box-shadow:inset 0 0 0 1px #266df1}
.rvq p{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:0 0 16px}.rvq p b{font-size:clamp(15px,1.1vw,18px);font-weight:560}
.rvq p span,.rvp-k{font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:#8f9197}
.rvq-g{display:grid;grid-template-columns:repeat(17,minmax(0,1fr));gap:clamp(4px,.45vw,7px)}
.rvq-g i,.rvp-k i{position:relative;aspect-ratio:1;border-radius:3px;box-shadow:inset 0 0 0 1px #3a3b40}.rvq-g i.a,.rvp-k i.a{background:#266df1;box-shadow:none}
.rvq-g i.s::after,.rvp-k i.s::after{content:"";position:absolute;inset:17%;background:#fff;clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)}
.rvp-k{display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px;margin:18px 0 0}.rvp-k span{display:flex;align-items:center;gap:8px}.rvp-k i{width:14px}.rvp-k em{font-style:normal;margin-left:auto}
.rvp{background:#fcfcfd radial-gradient(circle,#d3d6de .8px,transparent 1.2px) 0 0/10px 10px;color:var(--ink);border-bottom:1px solid var(--ln)}.rvp-i{border-color:var(--ln)}.rvp .st-t{color:var(--ink)}.rvp .st-t span{color:#9a9ca3}
.rvp-h .rvp-t,.rvp-h .rvp-t>div{border-color:var(--ln)}.rvp-t span{color:var(--t2)}.rvq{background:#fff;box-shadow:inset 0 0 0 1px var(--ln),0 20px 40px -32px rgba(30,40,80,.35)}.rvq.on{box-shadow:inset 0 0 0 1.5px #266df1,0 20px 40px -32px rgba(30,40,110,.45)}
.rvq p span,.rvp-k{color:var(--t2)}.rvq-g i,.rvp-k i{box-shadow:inset 0 0 0 1px #d5d8de;background:#fff}.rvq-g i.a,.rvp-k i.a{background:#266df1;box-shadow:none}
.rvp-l>i{background:var(--ink)}.rvp-n::before{box-shadow:0 0 0 5px #fff}.rvp.live .rvp-n[data-hd]:not(.in)::before{background:#c9cbd0}.rvp-n span{color:var(--t3)}.rvp-n p{color:var(--t2)}.rvp-n p.hb{color:#fff}
.rvqs{background:var(--dk);color:#fff}
.rvqs-i{border-left:1px solid var(--dl);border-right:1px solid var(--dl);padding:clamp(72px,7.4vw,140px) clamp(22px,3.1vw,60px)}
.rvqs-l{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin:0 0 clamp(22px,2.2vw,36px);font-size:clamp(20px,1.7vw,28px);font-weight:560;letter-spacing:-.025em}
.rvqs-l em{font:500 10.5px/1 "Geist Mono",monospace;font-style:normal;letter-spacing:.04em;text-transform:uppercase;color:var(--t3)}
.rvqs-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(14px,1.6vw,26px)}.rvqs .rvq{margin:0;padding:clamp(22px,2.4vw,40px)}.rvqs .rvq p{margin:0 0 clamp(18px,1.8vw,28px)}.rvqs .rvq p b{font-size:clamp(17px,1.3vw,22px)}
.rvq-f{display:flex;align-items:baseline;gap:12px;margin-top:clamp(22px,2.2vw,36px);padding-top:clamp(16px,1.6vw,24px);border-top:1px solid var(--ln)}.rvq-f b{white-space:nowrap;font-size:clamp(34px,3.4vw,60px);line-height:.95;font-weight:500;letter-spacing:-.04em}
.rvq.on .rvq-f b{color:#266df1}.rvq-f span{font-size:clamp(14px,1vw,17px);color:var(--t2)}.rvqs .rvp-k{margin-top:clamp(18px,1.8vw,28px)}
.rvp{background:#fff}.rvp-i{padding-top:clamp(80px,8vw,150px);padding-bottom:clamp(80px,8vw,150px)}.rvp .st-t{margin:20px 0 clamp(56px,6vw,104px);max-width:18em}.rvp .rvp-t{border-color:var(--ln);margin-top:clamp(64px,7vw,120px)}
.rvp .lb{background:#eeeff2}
main:has(>.rh) .st .st-i{padding-top:clamp(84px,8.5vw,160px);padding-bottom:clamp(84px,8.5vw,160px)}main:has(>.rh) .sgp .sg-i{padding-top:clamp(64px,6vw,110px)}
main:has(>.rh) .acd,main:has(>.rh) .v3{border-top:1px solid var(--ln)}
.rvqs .rvqs-l em,.rvqs .rvp-k,.rvqs .rvq-f span{color:#8f9197}.rvqs .rvq{background:#17181a;box-shadow:inset 0 0 0 1px var(--dl)}.rvqs .rvq.on{box-shadow:inset 0 0 0 1.5px #266df1}.rvqs .rvq-g i,.rvqs .rvp-k i{background:transparent;box-shadow:inset 0 0 0 1px #3a3b40}.rvqs .rvq-g i.a,.rvqs .rvp-k i.a{background:#266df1;box-shadow:none}.rvqs .rvq-f{border-color:var(--dl)}.rvqs .rvq.on .rvq-f b{color:#7fa8f7}
.rh-i{padding-top:clamp(84px,8vw,136px)}.rh-s{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1.08fr);gap:clamp(12px,1.4vw,22px);align-items:start;width:min(1200px,97%);margin:clamp(40px,4vw,68px) auto -54px;text-align:left}
.rh-s .rh-w,.rh-s .rh-j{width:auto;margin:38px 0 0;border-radius:14px;box-shadow:0 0 0 1px rgba(23,24,26,.1),0 30px 60px -36px rgba(38,38,60,.45)}.rh-s .ph2{min-height:430px}
.rjr{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:13px 16px;border-top:1px solid var(--ln)}.rh-j .rh-wb+.rjr{border-top:0}.rjr p{margin:0}.rjr b{display:block;font-size:14px;font-weight:560}.rjr span{display:block;margin-top:3px;font-size:12.5px;color:var(--t2)}
.rjr .c{display:flex;flex-direction:column;align-items:flex-end;gap:5px}.rjr u,.rvt-a u{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;background:#eeeff2;text-decoration:none;font-size:11.5px;font-weight:540;white-space:nowrap}
.rjr u.k,.rvt-a u.k{background:#266df1;color:#fff}.rjr u.s{background:#fff;box-shadow:inset 0 0 0 1px var(--ln)}.rjr u.s::before{content:"";width:10px;height:10px;margin-right:6px;background:#f0a001;clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)}
.ph2 .rh-b{width:fit-content;margin:8px 0 0;padding:8px 13px;border-radius:8px;background:#266df1;color:#fff;font-size:12.5px;font-weight:560}
.ph2 .rh-r{margin:14px 0 0 auto;width:fit-content;max-width:92%;padding:10px 12px;border-radius:12px 12px 3px 12px;background:var(--ink);color:#fff}.ph2 .rh-r .sr5 svg{fill:#f0a001;width:15px;height:15px}.ph2 .rh-r span{display:block;margin-top:6px;font-size:12.5px;line-height:1.35}
.ph2 .rh-k{margin:12px 0 0;text-align:center;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--t2)}
.rvc .rvc-t{top:50%;max-width:min(24em,30%)}
.rvqs-s{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:clamp(14px,1.6vw,26px);margin:0 0 clamp(26px,2.8vw,44px);padding:clamp(18px,2vw,30px) 0;border-top:1px solid var(--dl);border-bottom:1px solid var(--dl)}
.rvqs-s div{padding-left:16px;border-left:1.5px solid #3a3b40}.rvqs-s b{display:block;font-size:clamp(24px,2.3vw,40px);line-height:1;font-weight:500;letter-spacing:-.03em}.rvqs-s span{display:block;margin-top:9px;font-size:clamp(13.5px,1vw,16px);color:#a9abb0}
.rvt{--s:5;background:#fff;border-top:1px solid var(--ln)}.rvt-g{display:grid;grid-template-columns:minmax(0,.86fr) minmax(0,1.14fr);gap:clamp(30px,5vw,100px);align-items:center;box-sizing:border-box;border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(64px,6vw,110px) clamp(22px,3.1vw,60px)}
.rvt .lb{background:#eeeff2}.rvt .st-t{margin:20px 0 0;max-width:13em}.rvt ol{list-style:none;margin:clamp(28px,3vw,48px) 0 0;padding:0;border-top:1px solid var(--ln)}
.rvt li{--on:1;position:relative;display:grid;grid-template-columns:7.2em minmax(0,1fr);gap:4px 14px;align-items:baseline;padding:15px 0 15px 16px;border-bottom:1px solid var(--ln);opacity:calc(.3 + .7*var(--on))}
.rvt li::before{content:"";position:absolute;left:0;top:-1px;bottom:-1px;width:2px;background:#266df1;opacity:var(--on)}.rvt li time{font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--t3)}
.rvt li b{font-size:clamp(17px,1.35vw,23px);font-weight:560;letter-spacing:-.02em}.rvt li span{grid-column:2;font-size:14.5px;line-height:1.4;color:var(--t2)}
.rvt-p{position:relative;height:min(580px,66vh);border-radius:16px;background:linear-gradient(180deg,#f6f8ff,#e6ebfd)}
.rvt-p>*,.rvt-p .ph2>[style],.rvt-a u[style]{--v:clamp(0,calc((var(--s) - var(--i))*5 + 1),1);opacity:var(--v);transform:translateY(calc((1 - var(--v))*14px))}.rvt-p>.ph2{opacity:1;transform:none}
.rvt-a,.rvt-b{position:absolute;z-index:2;padding:16px 18px}.rvt-a{left:6%;top:11%;width:42%}.rvt-b{left:10%;bottom:11%;width:40%}
.rvt-a span,.rvt-b span{display:block;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--t3)}.rvt-a b,.rvt-b b{display:block;margin-top:10px;font-size:16px;font-weight:560}
.rvt-a p{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 0}.rvt-b .sr5{margin-top:10px}.rvt-b .sr5 svg{fill:#f0a001;width:18px;height:18px}.rvt-b em{display:block;margin-top:10px;font-style:normal;font-size:13.5px;color:var(--t2)}
.rvt .ph2{position:absolute;left:auto;right:7%;top:8%;min-height:0;height:84%}
@media(min-width:861px){.rvt.sp-live{height:360vh;--s:calc(var(--p,0)*5.3)}.rvt.sp-live .rvt-i{position:sticky;top:0;height:100vh;display:flex;align-items:center}.rvt.sp-live .rvt-g{flex:none;min-height:100vh}
.rvt.sp-live li{--on:clamp(0,min(calc((var(--s) - var(--i))*8 + 1),calc((var(--i) + 1 - var(--s))*8)),1)}.rvt.sp-live li:last-child{--on:clamp(0,calc((var(--s) - 4)*8 + 1),1)}}
.rvp .rvp-i{padding-top:clamp(48px,5vw,90px);padding-bottom:clamp(64px,6.4vw,120px)}.rvp .rvp-t{margin-top:0;padding-top:0;border-top:0}
main:has(>.rh) .srx>div:not(.on):not(.q){opacity:1}main:has(>.rh) .srx>div:not(.on) b{color:var(--ink)}
@media(max-width:980px){.rh-s{grid-template-columns:minmax(0,1fr);margin-bottom:40px}.rh-s .ph2{justify-self:center;min-height:0;order:-1}.rh-s .rh-w,.rh-s .rh-j{margin-top:0}}
@media(max-width:860px){.rvqs-s{grid-template-columns:repeat(2,minmax(0,1fr))}.rvc .rvc-t{top:auto;max-width:none}.rvq-f{flex-wrap:wrap}.rvt-g{grid-template-columns:minmax(0,1fr)}.rvt-p{height:520px}.rvt-p{height:auto;padding:16px;display:grid;gap:12px}.rvt-p>*,.rvt .ph2{position:relative;inset:auto;width:auto;height:auto}.rvt .ph2{justify-self:center;width:230px;min-height:300px}.rvt li{grid-template-columns:minmax(0,1fr)}.rvt li span{grid-column:1}}
.rvd{background:#fcfcfd radial-gradient(circle,#d3d6de .8px,transparent 1.2px) 0 0/10px 10px;border-top:1px solid var(--ln)}
.rvd-i{min-height:min(78vh,720px);display:grid;align-content:center;justify-items:center;gap:clamp(40px,5vw,84px);padding:clamp(90px,10vw,170px) 24px;text-align:center}
.rvd-s{margin:0;max-width:13em;font:400 clamp(38px,4.8vw,88px)/1.06 Georgia,"Times New Roman",serif;letter-spacing:-.022em;color:var(--ink)}.rvd-s span{color:#a3abbd}
.rvd-c{margin:0}.rvd-c b{display:block;font-size:clamp(16px,1.2vw,20px);font-weight:560}.rvd-c span{display:block;margin-top:8px;font-size:clamp(15px,1.1vw,19px);color:var(--t2)}
.rvqs-g .rvq.on .rvq-g i{opacity:clamp(.12,calc(var(--p,1)*3.2 - .5 - var(--k)*.045),1)}
.rvt.live li[data-hd]:not(.in){opacity:.34;animation:none}.rvt.live li[data-hd].in{animation:none;opacity:1}.rvt li{transition:opacity .35s}.rvt li::before{transition:opacity .35s}.rvt.live li:not(.in)::before{opacity:0}
.rvt li b{font:400 clamp(21px,1.7vw,29px)/1.1 Georgia,"Times New Roman",serif;letter-spacing:-.012em}.rvt-g{padding-top:clamp(84px,8vw,150px);padding-bottom:clamp(84px,8vw,150px)}
.ivc{position:relative;overflow:hidden;background:#1b4fc0;color:#fff;min-height:min(76vh,700px);display:grid;place-items:center;padding:clamp(90px,10vw,170px) 24px clamp(150px,15vw,230px);box-sizing:border-box}
.ivc-g{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(90deg,rgba(255,255,255,.2) 0 1px,transparent 1px calc(100%/24));clip-path:inset(0 calc((1 - clamp(0,calc(var(--p,1)*1.7),1))*100%) 0 0)}
.ivc-g::after{content:"";position:absolute;left:0;right:0;bottom:calc(64px + 30px);height:1px;background:rgba(255,255,255,.75)}
.ivc-g span{position:absolute;left:var(--x);bottom:64px;padding:20px 0 0;font:500 11px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:#fff;white-space:nowrap}
.ivc-g span::before{content:"";position:absolute;left:-4px;top:-4px;width:8px;height:8px;background:#fff}
.ivc-g span b{position:absolute;left:0;bottom:calc(100% + 16px);font:560 clamp(14px,1.15vw,18px)/1.15 Inter,system-ui,sans-serif;letter-spacing:-.01em;text-transform:none;white-space:nowrap}.ivc-g span:last-child b{left:auto;right:0}
.ivc-s{position:relative;margin:0;max-width:13em;text-align:center;font-size:clamp(34px,4.4vw,84px);line-height:1.02;letter-spacing:-.045em;font-weight:600}.ivc-s span{color:#b9cdfb}
@media(max-width:860px){.ivc-g span b{display:none}.ivc-g span:nth-child(2){display:none}}
main:has(>.rh) .st .st-i{text-align:center}main:has(>.rh) .st .lb,.rvc .rvc-t .lb,.rvt .lb,.rvqs-l em{padding:0;border-radius:0;background:none;font:500 11px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--t3)}
main:has(>.rh) .st .lb::before,.rvc .rvc-t .lb::before,.rvt .lb::before,.rvqs-l em::before{content:"["}main:has(>.rh) .st .lb::after,.rvc .rvc-t .lb::after,.rvt .lb::after,.rvqs-l em::after{content:"]"}
main:has(>.rh) .st .st-t{display:block;margin:24px auto 0;max-width:15em;font:400 clamp(34px,4.1vw,70px)/1.07 Georgia,"Times New Roman",serif;letter-spacing:-.022em}
main:has(>.rh) .st .st-t span{display:block;margin:clamp(22px,2.2vw,34px) auto 0;max-width:33em;font:400 clamp(16px,1.2vw,20px)/1.5 Inter,system-ui,sans-serif;letter-spacing:0;color:var(--t2)}
main:has(>.rh) .sgp li b{font:400 clamp(22px,1.9vw,32px)/1.12 Georgia,"Times New Roman",serif;letter-spacing:-.015em;max-width:12em}main:has(>.rh) .sgp li b::before{font-family:"Geist Mono",monospace}
.rvqs-l{display:flex;flex-direction:column-reverse;align-items:center;gap:22px;text-align:center;margin-bottom:clamp(40px,4.4vw,72px);font-size:clamp(34px,4.2vw,76px);line-height:1.02;font-weight:600;letter-spacing:-.045em}
.rvqs-s div:last-child b{color:#e5484e}.rvqs-s div:last-child{border-left-color:#e5484e}
.ivb .ivb-c .ivb-b.b i{background:#266df1;color:#fff}.ivb .ivb-c .ivb-b.y i{background:#f0a001;color:#fff}.ivb .ivb-c .ivb-b.r i{background:#e5484e;color:#fff}
.ivn .ivn-s u::before,.ivb .ivb-l p i,.ivh .ivh-l p i{background:#e5484e;box-shadow:none}.ivn .ivn-s u.b::before,.ivb .ivb-l p.b i,.ivh .ivh-l p.b i{background:#266df1}.ivn .ivn-s u.y::before,.ivb .ivb-l p.y i,.ivh .ivh-l p.y i{background:#f0a001}
.lvg .lb{padding:0;border-radius:0;background:none;font:500 11px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--t3)}.lvg .lb::before{content:"["}.lvg .lb::after{content:"]"}
.bkg{background:#fff;border-top:1px solid var(--ln)}.bkg-i{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(30px,5vw,100px);align-items:center;border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(80px,8vw,150px) clamp(22px,3.1vw,60px)}
.bkg .lb{padding:0;border-radius:0;background:none;font:500 11px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--t3)}.bkg .lb::before{content:"["}.bkg .lb::after{content:"]"}
.bkg .st-t{margin:22px 0 0;max-width:12em;font:400 clamp(30px,3.1vw,54px)/1.08 Georgia,"Times New Roman",serif;letter-spacing:-.02em}.bkg .st-t span{display:block;margin-top:.5em;font:400 clamp(16px,1.2vw,20px)/1.45 Inter,system-ui,sans-serif;letter-spacing:0;color:var(--t2)}
.bkg-s{display:grid;gap:0;margin-top:clamp(28px,3vw,48px);border-top:1px solid var(--ink)}.bkg-s div{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding:13px 0;border-bottom:1px solid var(--ln)}
.bkg-s b{font-size:clamp(20px,1.7vw,28px);font-weight:500;letter-spacing:-.025em}.bkg-s span{font-size:14.5px;color:var(--t2)}.bkg-s div:last-child b{color:#266df1}
.bkg-k{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;margin:22px 0 0;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--t2)}.bkg-k span{display:flex;align-items:center;gap:7px}.bkg-k em{font-style:normal;color:var(--t3);width:100%}
.bkg-k i{width:13px;height:13px;border-radius:3px}.bkg-g i.j,.bkg-k i.j{background:repeating-linear-gradient(135deg,#e3e4e8 0 1px,#f3f3f5 1px 5px);box-shadow:inset 0 0 0 1px #e3e4e8}.bkg-g i.o,.bkg-k i.o{background:#fff;box-shadow:inset 0 0 0 1.5px #266df1;color:#1f4fbe}.bkg-g i.k,.bkg-k i.k{background:#266df1;box-shadow:none;color:#fff}
.bkg-g{display:grid;grid-template-columns:4.2em repeat(5,minmax(0,1fr));gap:5px}.bkg-g b{padding:0 0 10px;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--t2);text-align:center}
.bkg-g u{align-self:center;text-decoration:none;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;color:var(--t3)}
.bkg-g i{display:grid;place-items:center;height:clamp(30px,4.4vh,42px);border-radius:6px;box-shadow:inset 0 0 0 1px var(--ln);font-style:normal;font-size:12px;font-weight:560;opacity:clamp(0,calc(var(--p,1)*4.4 - var(--k)*.14),1)}
@media(max-width:860px){.bkg-i{grid-template-columns:minmax(0,1fr)}.bkg-g{grid-template-columns:3.4em repeat(5,minmax(0,1fr));gap:3px}.bkg-g i{font-size:0;height:26px}}
.rlb{--q:clamp(0,calc(var(--p,1)*1.6 - .2),1)}.rlb-s{position:relative;height:64px;margin:clamp(10px,1.4vw,24px) 0 0}
.rlb-s span{position:absolute;left:7px;bottom:16px;width:calc(40% - 0px);height:9px;border:1px solid var(--ink);border-bottom:0;opacity:clamp(0,calc(var(--q)*5 - 2.2),1)}
.rlb-s b{position:absolute;left:0;bottom:20px;font-size:clamp(17px,1.3vw,22px);font-weight:560;letter-spacing:-.02em;white-space:nowrap}.rlb-s em{position:absolute;left:8.4em;bottom:23px;font-style:normal;font-size:14.5px;color:var(--t2);white-space:nowrap}
.rlx{position:relative;border-top-color:#dcdee3;counter-reset:r}.rlx::before{content:"";position:absolute;left:0;top:-2px;height:2px;width:calc(var(--q)*100%);background:var(--ink)}
.rlx li{counter-increment:r;--on:clamp(0,calc(var(--q)*5.2 - var(--i,0)),1)}.rlx li:nth-child(2){--i:1}.rlx li:nth-child(3){--i:2}.rlx li:nth-child(4){--i:3}.rlx li:nth-child(5){--i:4}
.rlx li::before{background:#fff;box-shadow:inset 0 0 0 2px #c9cbd0;border-radius:3px;z-index:1}.rlx li::after{content:"";position:absolute;left:0;top:-8px;width:14px;height:14px;border-radius:3px;background:var(--ink);opacity:var(--on);z-index:2}
.rlx li:last-child::before{background:#fff;box-shadow:inset 0 0 0 2px #c9cbd0}.rlx li:last-child::after{background:#266df1}
.rlx time,.rlx b{opacity:calc(.3 + .7*var(--on))}.rlx time::before{content:"0" counter(r) "  "}.rlx b{font:400 clamp(20px,1.6vw,28px)/1.14 Georgia,"Times New Roman",serif;letter-spacing:-.012em}
@media(max-width:860px){.rlb-s{display:none}.rlx::before{display:none}.rlx li{--on:1}.rlx li::after{left:-8px;top:0}}
.bkw{--q:clamp(0,calc(var(--p,1)*1.7 - .25),1);position:relative;width:100%;max-width:480px;padding-bottom:58px}.bkw .bkd{position:relative;z-index:2;max-width:none}
.bkw .bkd-t b{font-size:clamp(28px,2.6vw,42px)}.bkw .bkd-b p+p{opacity:clamp(0,calc(var(--q)*5.4 - var(--i,0)),1)}.bkw .bkd-b p:nth-child(3){--i:1}.bkw .bkd-b p:nth-child(4){--i:2}.bkw .bkd-b p:nth-child(5){--i:3}
.bkw .bkd-b p:nth-child(5) b{color:#1f4fbe}
.bkd-r{position:absolute;left:14px;right:14px;bottom:0;z-index:1;display:flex;align-items:center;gap:14px;margin:0;padding:26px 16px 14px;border-radius:0 0 12px 12px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.08),0 18px 34px -24px rgba(30,40,80,.4);font-size:13.5px;
transform:translateY(calc((1 - clamp(0,calc(var(--q)*5.4 - 4),1))*-46px));opacity:clamp(0,calc(var(--q)*5.4 - 4),1)}
.bkd-r time{font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--t3);white-space:nowrap}.bkd-r span{flex:1;font-weight:540}.bkd-r i{flex:none;width:9px;height:9px;border-radius:50%;background:#266df1}
main:has(.bkw) .sp .lb{padding:0;border-radius:0;background:none;font:500 11px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--t3)}main:has(.bkw) .sp .lb::before{content:"["}main:has(.bkw) .sp .lb::after{content:"]"}
main:has(.bkw) .fa-g{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
main:has(.bkw) .fa-t{display:grid;align-content:center;min-height:clamp(420px,46vw,640px);padding:clamp(56px,6vw,110px) clamp(22px,3.1vw,60px);background:#fcfcfd radial-gradient(circle,#d3d6de .8px,transparent 1.2px) 0 0/10px 10px}
main:has(.bkw) .fa-t .st-t{margin:0;font:400 clamp(52px,6.4vw,112px)/.98 Georgia,"Times New Roman",serif;letter-spacing:-.03em}
main:has(.bkw) .fa-t .st-t::before{content:"[Booking]";display:block;margin-bottom:26px;font:500 11px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--t3)}
main:has(.bkw) .fa dl{display:grid;align-content:center;padding:clamp(40px,4vw,72px) clamp(22px,3.1vw,60px);counter-reset:q;background:#fff}
main:has(.bkw) .fa dl div{display:grid;grid-template-columns:3.2em minmax(0,1fr);gap:8px 0;padding:clamp(22px,2.2vw,36px) 0;counter-increment:q}
main:has(.bkw) .fa dl div::before{content:"0" counter(q);grid-row:1/3;padding-top:.5em;font:500 11px/1 "Geist Mono",monospace;letter-spacing:.06em;color:var(--t3)}
main:has(.bkw) .fa dt{font-size:clamp(20px,1.7vw,29px);line-height:1.15;font-weight:560;letter-spacing:-.025em}main:has(.bkw) .fa dd{grid-column:2;font-size:clamp(15.5px,1.1vw,18.5px);line-height:1.45;color:var(--t2)}
@media(max-width:860px){main:has(.bkw) .fa-g{grid-template-columns:minmax(0,1fr)}main:has(.bkw) .fa-t{min-height:0;padding:56px var(--pad)}main:has(.bkw) .fa dl{padding:20px var(--pad) 48px}}
main:has(.bkw) .ic-g{grid-template-columns:minmax(0,1fr)}main:has(.bkw) .ic-t{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:end;gap:20px;padding:clamp(80px,8vw,150px) clamp(22px,3.1vw,60px) clamp(40px,4.4vw,76px)}
main:has(.bkw) .ic-t .lb{justify-self:start;align-self:start;padding:0;border-radius:0;background:none;font:500 11px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--t3)}main:has(.bkw) .ic-t .lb::before{content:"["}main:has(.bkw) .ic-t .lb::after{content:"]"}
main:has(.bkw) .ic-t .st-t{grid-column:1/-1;margin:0;max-width:13em;font-size:clamp(34px,4.2vw,76px);line-height:1.02;letter-spacing:-.045em;font-weight:600}
main:has(.bkw) .ic ul{grid-template-columns:repeat(3,minmax(0,1fr));align-content:stretch;padding:0;border-left:0;border-top:1px solid var(--ln);counter-reset:c}
main:has(.bkw) .ic li{display:block;counter-increment:c;padding:clamp(22px,2.2vw,36px) clamp(22px,2.4vw,44px) clamp(34px,3.4vw,60px);border-top:0;border-right:1px solid var(--ln);border-bottom:1px solid var(--ln);font-size:clamp(17px,1.25vw,22px);line-height:1.28;font-weight:540;letter-spacing:-.018em}
main:has(.bkw) .ic li:nth-child(3n){border-right:0}main:has(.bkw) .ic li:nth-child(n+4){border-bottom:0}
main:has(.bkw) .ic li svg{display:none}main:has(.bkw) .ic li::before{content:"0" counter(c);display:flex;align-items:center;gap:10px;margin-bottom:clamp(34px,3.8vw,68px);font:500 11px/1 "Geist Mono",monospace;letter-spacing:.06em;color:var(--t3)}
main:has(.bkw) .ic li span{display:block;max-width:15em}main:has(.bkw) .ic li:last-child{background:var(--ink);color:#fff}main:has(.bkw) .ic li:last-child::before{color:#a9abb0}
@media(max-width:860px){main:has(.bkw) .ic ul{grid-template-columns:minmax(0,1fr)}main:has(.bkw) .ic li{border-right:0;border-bottom:1px solid var(--ln)!important}main:has(.bkw) .ic li::before{margin-bottom:18px}main:has(.bkw) .ic-t{grid-template-columns:minmax(0,1fr);padding:56px var(--pad) 32px}}
.pt-fu .pt-d h2 u{position:relative;text-decoration:none;white-space:nowrap}.pt-fu .pt-d h2 u::after{content:"";position:absolute;left:0;right:0;bottom:-.06em;height:.07em;min-height:3px;background:#266df1;transform-origin:0 50%;transform:scaleX(clamp(0,calc(var(--p,1)*2.4 - .5),1))}
.ic-fu .ic-g{grid-template-columns:minmax(0,.82fr) clamp(90px,10vw,170px) minmax(0,1.18fr)}.ic-fu .ic-t{align-self:center}.ic-fu .ic-t .st-t{font-size:clamp(30px,3vw,52px);line-height:1.04;letter-spacing:-.04em;font-weight:600}
.ic-fu .ic-t .lb{padding:0;border-radius:0;background:none;font:500 11px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--t3)}.ic-fu .ic-t .lb::before{content:"["}.ic-fu .ic-t .lb::after{content:"]"}
.icf-l{align-self:center;width:100%;height:500px;overflow:visible;clip-path:inset(-6px calc((1 - clamp(0,calc(var(--p,1)*2.2 - .35),1))*100%) -6px -6px)}.icf-l path{fill:none;stroke:#17181a;stroke-width:1;vector-effect:non-scaling-stroke}.icf-l circle{fill:#17181a}
.ic-fu ul{align-content:center;padding:clamp(56px,5vw,96px) var(--pad);border-left:0;background:none}.ic-fu li{box-sizing:border-box;height:100px;align-items:center;padding:0 0 0 4px;border-top:1px solid var(--ln)}.ic-fu li:first-child{border-top:1px solid var(--ln)}.ic-fu li:last-child{border-bottom:1px solid var(--ln)}
.ic-fu ul{padding-top:calc((100% - 500px)/2)}.ic-fu .ic-g{align-items:center}.ic-fu ul{padding:0 var(--pad) 0 0;height:500px;align-content:stretch;margin:clamp(56px,5vw,96px) 0}
.ic-fu li svg{stroke:#266df1}
.as-fu .as-i{display:grid;justify-content:center;justify-items:center;gap:clamp(26px,2.6vw,40px);padding:clamp(84px,8vw,150px) var(--pad);text-align:center}.as.as-fu .as-i .bs{justify-self:center;margin:0 auto;max-width:18em;font-size:clamp(30px,3.4vw,58px);line-height:1.05;letter-spacing:-.04em;font-weight:600}
.as-fu .bs span{display:block;margin:20px auto 0;max-width:30em;font-size:clamp(16px,1.2vw,20px);line-height:1.45;letter-spacing:0;font-weight:400;color:var(--t2)}
@media(max-width:860px){.ic-fu .ic-g{grid-template-columns:minmax(0,1fr)}.icf-l{display:none}.ic-fu ul{height:auto;margin:0;padding:8px var(--pad) 40px}.ic-fu li{height:auto;padding:16px 0}.pt-fu .pt-d h2 u{white-space:normal}}
@media(max-width:860px){.rvqs-g{grid-template-columns:minmax(0,1fr)}.rvqs-l{display:block}.rvqs-l em{display:block;margin-top:10px}}
@media(max-width:860px){.rvp-h{grid-template-columns:minmax(0,1fr)}.rvq p{display:block}.rvq p span{display:block;margin-top:8px}.rvp-k em{margin-left:0}}
@media(max-width:860px){.rvc-f{height:auto;padding:84px 0 46vw}.rvc-t{position:relative;top:auto;transform:none;max-width:none;left:0;padding:0 var(--pad)}.rvc-g{top:auto;height:56vw}.rvp-l{grid-template-columns:minmax(0,1fr);gap:28px}.rvp-l>i{left:5px;right:auto;top:0;bottom:0;width:1px;height:auto}.rvp-n{padding:0 0 0 30px}.rvp-t{grid-template-columns:minmax(0,1fr)}}
/* ---- /invoicing ---- */
.ivn-g{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);align-items:center;gap:clamp(30px,5vw,100px);border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(72px,8vw,150px) clamp(22px,3.1vw,60px)}
.ivn .st-t{margin:0;max-width:15em}.ivn-n{padding-left:clamp(24px,3vw,56px);border-left:1px solid var(--ln)}
.ivn-n b{display:block;font-size:clamp(64px,8vw,150px);line-height:.9;letter-spacing:-.055em;font-weight:500}.ivn-n span{display:block;margin-top:16px;font-size:clamp(16px,1.2vw,21px);color:var(--g2)}
.ivn-n em{display:block;margin-top:18px;font:500 10.5px/1 "Geist Mono",monospace;font-style:normal;letter-spacing:.04em;color:var(--t3)}
.ivb{--a:clamp(0,calc(var(--p,1)/.45),1);--r:0;border-top:1px solid var(--ln)}.ivb-i{position:relative;overflow:hidden;background:#fff}
.ivb-f{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(30px,5vw,90px);align-items:end;height:min(86vh,820px);box-sizing:border-box;padding:clamp(56px,6vw,100px) clamp(22px,3.1vw,60px) 0;border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.ivb-t{align-self:center}.ivb-t .st-t{margin:20px 0 26px;max-width:14em}.ivb-t .fa-k{display:grid;gap:8px;margin:0}
.ivb-c{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(14px,2vw,36px);align-items:end;height:100%;border-bottom:1px solid var(--ink)}
.ivb-b{--v:clamp(0,calc(var(--a)*3.4 - var(--i)),1);position:relative;height:calc(var(--h)*.78);display:flex;flex-direction:column;justify-content:flex-end}
.ivb-b>div{flex:1;display:flex;flex-direction:column-reverse;gap:2px;transform-origin:bottom;transform:scaleY(var(--v))}
.ivb-b i{flex:1;display:flex;align-items:flex-end;padding:10px 12px;font-style:normal;font-size:12.5px;font-weight:540;color:#fff;background:#266df1;min-height:0;overflow:hidden;box-shadow:0 2px 0 #fff}
.ivb-b.b i{background:#cfdcfd;color:#1f4fbe}.ivb-b.y i{background:#7fa8f7;color:#fff}.ivb-b.r i{background:#266df1}.ivb-b i:last-child{border-radius:6px 6px 0 0}
.ivb-b em{display:block;margin-bottom:10px;font-style:normal;font-size:clamp(20px,1.9vw,32px);font-weight:500;letter-spacing:-.02em;opacity:var(--v)}
.ivb-b>b{position:absolute;left:0;top:calc(100% + 12px);font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--t2);white-space:nowrap}
.ivb-f{padding-bottom:46px}
.ivb-c{position:relative}.ivb-y{position:absolute;left:0;right:0;bottom:calc(var(--y)*1);height:0;border-top:1px dashed #d5d8de;font:500 10.5px/1 "Geist Mono",monospace;color:var(--t3);text-indent:-3.2em;opacity:clamp(0,calc(var(--a)*4),1)}
.ivb-y{line-height:0}.ivb-tot{position:absolute;right:0;top:0;padding:8px 12px;border-radius:8px;background:var(--ink);color:#fff;font-size:13.5px;font-weight:560;opacity:clamp(0,calc(var(--a)*6 - 5),1);transform:translateY(calc((1 - clamp(0,calc(var(--a)*6 - 5),1))*8px))}
.ivb-b i:last-child{border-radius:9px 9px 0 0}.ivb-c{margin-left:3.2em}
.ivb-n{display:none}
@media(min-width:861px){.ivb.sp-live{height:280vh;--a:clamp(0,calc(var(--p,0)/.36),1);--r:clamp(0,calc((var(--p,0) - .46)/.38),1);--e:calc(var(--r)*var(--r)*(3 - 2*var(--r)));--w:clamp(0,calc((var(--p,0) - .84)/.12),1)}
.ivb.sp-live .ivb-i{position:sticky;top:0;height:100vh;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,#fff calc((1 - clamp(0,calc(var(--r)*4 - 3),1))*100%),var(--dk))}
/* the hand-over, in three beats: everything but the oldest bar steps back, the view goes into that bar, and the next line arrives on it */
.ivb.sp-live .ivb-f{flex:none;margin:0 auto;transform-origin:88.5% 74%;transform:scale(calc(1 + var(--e)*var(--e)*var(--e)*52));will-change:transform}
.ivb.sp-live .ivb-t,.ivb.sp-live .ivb-b>b,.ivb.sp-live .ivb-y,.ivb.sp-live .ivb-tot,.ivb.sp-live .ivb-b:not(.r){opacity:calc(1 - var(--r)*4.5)}.ivb.sp-live .ivb-b em{opacity:calc(var(--v) - var(--r)*4.5)}
.ivb.sp-live .ivb-b.r i{color:rgba(255,255,255,calc(1 - var(--r)*4));box-shadow:0 2px 0 rgba(255,255,255,calc(1 - var(--r)*3));background:color-mix(in srgb,#266df1 calc((1 - var(--e)*var(--e))*100%),var(--dk))}
.ivb.sp-live .ivb-n{display:block;position:absolute;left:0;right:0;top:50%;margin:0 auto;padding:0 24px;max-width:13em;text-align:center;color:#fff;font-size:clamp(34px,4.4vw,84px);line-height:1.02;letter-spacing:-.045em;font-weight:600;
opacity:var(--w);transform:translateY(calc(-50% + (1 - var(--w))*40px))}}
.ivn-g{row-gap:clamp(44px,5vw,84px)}.ivn-r{grid-column:1/-1;position:relative;height:74px}
.ivn-r>i{position:absolute;left:0;right:0;top:0;height:14px;border-bottom:1px solid var(--ink);background:repeating-linear-gradient(90deg,var(--ink) 0 1px,transparent 1px calc(100%/60));clip-path:inset(0 calc((1 - var(--q,1))*100%) 0 0)}
.ivn-r span{--o:clamp(0,calc(var(--q,1)*4 - 1 - var(--k)*.8),1);position:absolute;left:var(--l);width:var(--w);top:22px;height:10px;border:1px solid var(--ink);border-top:0;opacity:var(--o)}
.ivn-r span b{position:absolute;left:0;top:20px;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--t2);white-space:nowrap}
.ivn-r span em{position:absolute;right:0;top:18px;font-style:normal;font-size:14px;font-weight:560}
.ivb-g{display:none}
@media(min-width:861px){.ivb.sp-live{--g1:clamp(0,calc((var(--p,0) - .74)/.14),1)}
.ivb.sp-live .ivb-g{display:block;position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(90deg,rgba(255,255,255,.2) 0 1px,transparent 1px calc(100%/22));clip-path:inset(0 calc((1 - var(--g1))*100%) 0 0)}
.ivb-g span{position:absolute;left:var(--x);bottom:11vh;padding-left:10px;font:500 11px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:#fff;white-space:nowrap;opacity:clamp(0,calc(var(--g1)*3 - 2),1)}
.ivb-g span::before{content:"";position:absolute;left:-4px;top:1px;width:8px;height:8px;background:#fff}
.ivb.sp-live .ivb-i{background:color-mix(in srgb,#fff calc((1 - clamp(0,calc(var(--r)*4 - 3),1))*100%),color-mix(in srgb,#1b4fc0 calc((1 - clamp(0,calc((var(--p,0) - .93)/.07),1))*100%),var(--dk)))}
.ivb.sp-live .ivb-b.r i{background:color-mix(in srgb,#266df1 calc((1 - var(--e)*var(--e))*100%),#1b4fc0)}}
.ivl-d{position:relative;height:150px;margin-bottom:26px}.ivl-d svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.ivl-d path{fill:none;vector-effect:non-scaling-stroke;stroke:#fff;stroke-width:1}
.ivl-d .m{stroke-dasharray:1;stroke-dashoffset:calc(1 - var(--p,1))}.ivl-d .rl{stroke:#5c5e63;stroke-dasharray:3 5}.ivl-d .dp{stroke:#5c5e63;stroke-dasharray:3 5;opacity:clamp(0,calc(var(--p,1)*5 - 1.5 - var(--k)),1)}
.ivl-d .n{position:absolute;left:var(--x);top:8px;transform:translateX(-50%);padding-top:38px;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:#e3e4e7;white-space:nowrap;opacity:clamp(0,calc(var(--p,1)*5 - .5 - var(--k)),1)}
.ivl-d .n::before{content:"";position:absolute;left:50%;top:24px;width:9px;height:9px;margin-left:-4.5px;background:#fff;box-shadow:0 0 0 5px var(--dk)}.ivl-d .n:first-of-type{transform:none}.ivl-d .n:first-of-type::before{left:0;margin-left:0}
.ivl-d .p{position:absolute;left:2%;bottom:-2px;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:#8f9197;background:var(--dk);padding-right:10px}
.ivl{background:var(--dk);color:#fff}.ivl-i{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(30px,5vw,100px);align-items:center;border-left:1px solid var(--dl);border-right:1px solid var(--dl);padding:clamp(72px,7vw,130px) clamp(22px,3.1vw,60px)}
.ivl .st-t{margin:0;color:#fff;max-width:12em}.ivl .st-t span{color:#8f9197}.ivl-k{margin:26px 0 0;max-width:24em;font-size:clamp(14.5px,1vw,17px);line-height:1.45;color:#a9abb0}
.ivl-m{display:grid;gap:14px}.ivl-r{display:grid;grid-template-columns:5.4em minmax(0,1fr);align-items:start;gap:16px;margin-left:calc(var(--k)*clamp(18px,4vw,70px))}
.ivl-r span,.ivl-p span{padding-top:14px;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:#8f9197}
.ivl-r p{margin:0;padding:14px 16px;border-radius:14px 14px 14px 4px;background:#232427;font-size:clamp(14.5px,1.05vw,17.5px);line-height:1.4}
.ivl-r[style*="--k:1"] p{background:#2f2a1c;box-shadow:inset 0 0 0 1px #f0a001}.ivl-r[style*="--k:2"] p{background:#33201f;box-shadow:inset 0 0 0 1px #e5484e}
.ivl-p{display:flex;align-items:center;gap:16px;margin:8px 0 0 calc(3*clamp(18px,4vw,70px))}.ivl-p span{padding:0;width:5.4em}.ivl-p b{padding:10px 18px;border-radius:999px;background:#266df1;font-size:15px;font-weight:560}
.iv{width:78%;font-size:13px}.iv1{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.iv1 i{padding:16px 0 12px;border-radius:7px;background:#fff;box-shadow:inset 0 0 0 1px var(--ln);font:500 10.5px/1 "Geist Mono",monospace;font-style:normal;text-align:center;color:var(--t3)}
.iv1 i.on{background:var(--ink);color:#fff;box-shadow:none}.iv1 p{grid-column:1/-1;display:flex;justify-content:flex-end;gap:6px;margin:8px 0 0}.iv1 p b{padding:6px 9px;border-radius:6px;background:#fff;box-shadow:inset 0 0 0 1px var(--ln);font-size:12px;font-weight:540}.iv1 p b.k{background:#266df1;color:#fff;box-shadow:none}
.iv2{display:grid;gap:10px}.iv2 .hb{margin:0;max-width:none}.iv2 em{font-style:normal;justify-self:end;padding:9px 16px;border-radius:8px;background:#266df1;color:#fff;font-weight:560}
.iv3{background:#fff;border-radius:10px;box-shadow:0 0 0 1px var(--ln)}.iv3 p{display:flex;align-items:center;gap:10px;margin:0;padding:11px 14px;border-top:1px solid var(--ln)}.iv3 p:first-child{border-top:0}
.iv3 p span{flex:1;margin:0;font-size:13px;color:var(--ink)}.iv3 p b{font-size:13px;font-weight:560}.iv3 i{width:9px;height:9px;border-radius:50%;background:#266df1}.iv3 i.y{background:#f0a001}.iv3 i.r{background:#e5484e}
@media(max-width:860px){.ivn-g,.ivb-f,.ivl-i{grid-template-columns:minmax(0,1fr)}.ivn-n{padding:26px 0 0;border-left:0;border-top:1px solid var(--ln)}.ivb-f{height:auto;padding-bottom:46px}.ivb-c{height:320px}
.ivl-r{margin-left:0;grid-template-columns:minmax(0,1fr);gap:6px}.ivl-r span{padding-top:0}.ivl-p{margin-left:0}}
.ivn-c{grid-column:1/-1;--q:clamp(0,calc(var(--p,1)*1.55),1)}.ivn-r{height:84px}.ivn-r span em{right:auto;left:0;top:38px}
.ivn-s{position:relative;height:clamp(170px,16vw,240px)}
.ivn-s .gy{position:absolute;left:0;right:0;bottom:var(--y);height:0;border-top:1px dashed #d5d8de;opacity:clamp(0,calc(var(--q)*4),1)}
.ivn-s .gy b{position:absolute;right:0;bottom:6px;font:500 10.5px/1 "Geist Mono",monospace;color:var(--t3)}
.ivn-s u{--g:clamp(0,calc(var(--q)*4 - .3 - var(--k)*.4),1);position:absolute;left:var(--x);bottom:0;width:1px;height:calc(var(--h)*var(--g));background:var(--ink);text-decoration:none}
.ivn-s u::before{content:"";position:absolute;left:-5px;top:-5px;width:11px;height:11px;background:#266df1}.ivn-s u.b::before{background:#cfdcfd;box-shadow:inset 0 0 0 1px #7fa8f7}.ivn-s u.y::before{background:#7fa8f7}
.ivn-s u b{position:absolute;left:14px;top:-10px;font-size:14.5px;line-height:1;font-weight:560;white-space:nowrap;opacity:calc(var(--g)*3 - 2)}
.ivn-s u em{position:absolute;left:14px;top:10px;font:500 10px/1 "Geist Mono",monospace;font-style:normal;letter-spacing:.04em;text-transform:uppercase;color:var(--t3);white-space:nowrap;opacity:calc(var(--g)*3 - 2)}
.ivb-l{margin-top:28px;max-width:460px;border-top:1px solid var(--ink)}
.ivb-l p{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr) 4.8em 4.4em;align-items:center;gap:10px;margin:0;padding:8px 0;border-bottom:1px solid var(--ln);font-size:13.5px;line-height:1.2;opacity:clamp(0,calc(var(--a)*9 - 1.5 - var(--k)),1)}
.ivb-l p.h{opacity:1;padding:9px 0}.ivb-l p.h span,.ivb-l p.h em,.ivb-l p.h b,.ivb-l u{font:500 10.5px/1 "Geist Mono",monospace;font-style:normal;letter-spacing:.04em;text-transform:uppercase;color:var(--t3);text-decoration:none}
.ivb-l span{display:flex;align-items:center;gap:9px;font-weight:540}.ivb-l i{flex:none;width:9px;height:9px;background:#266df1}.ivb-l .b i{background:#cfdcfd;box-shadow:inset 0 0 0 1px #7fa8f7}.ivb-l .y i{background:#7fa8f7}
.ivb-l em{font-style:normal;color:var(--t2)}.ivb-l b{text-align:right;font-weight:560}
.ivb-b i{justify-content:space-between;gap:8px}.ivb-b i u{text-decoration:none;font-weight:600}
@media(min-width:861px){.ivb.sp-live .ivb-g{background:repeating-linear-gradient(90deg,rgba(255,255,255,.2) 0 1px,transparent 1px calc(100%/24))}
.ivb.sp-live .ivb-g::after{content:"";position:absolute;left:0;right:0;bottom:calc(11vh + 30px);height:1px;background:rgba(255,255,255,.75)}
.ivb-g span{padding:20px 0 0}.ivb-g span::before{left:-4px;top:-4px}
.ivb-g span b{position:absolute;left:0;bottom:calc(100% + 16px);font:560 clamp(14px,1.15vw,18px)/1.15 Inter,system-ui,sans-serif;letter-spacing:-.01em;text-transform:none;white-space:nowrap}.ivb-g span:last-child b{left:auto;right:0}}
.ivl-s{margin-top:34px;max-width:340px;border-top:1px solid var(--dl)}.ivl-s p{display:flex;align-items:center;gap:12px;margin:0;padding:12px 0;border-bottom:1px solid var(--dl);font-size:14.5px}
.ivl-s p span{flex:1;font-weight:540;color:#fff}.ivl-s p em,.ivl-s p.h span{font:500 10.5px/1 "Geist Mono",monospace;font-style:normal;letter-spacing:.05em;text-transform:uppercase;color:#8f9197}
.ivl-s i{position:relative;flex:none;width:34px;height:20px;border-radius:999px;background:#3a3b40}.ivl-s i::after{content:"";position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff}
.ivl-s i.on{background:#266df1}.ivl-s i.on::after{left:17px}.ivl-s .off span{color:#8f9197}
.hs-p:has(.ivh){padding-left:clamp(18px,2vw,30px);padding-right:clamp(18px,2vw,30px)}
.ivh{position:relative;width:100%;max-width:620px;height:590px}.ivh-l{position:absolute;left:0;right:0;top:0}
.ivh-l p{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) 4.8em 4.6em;gap:10px;align-items:center;margin:0;padding:10px 18px;border-top:1px solid var(--line);font-size:13px;line-height:1.2}
.ivh-l p span{display:flex;align-items:center;gap:9px;font-weight:540}.ivh-l i{flex:none;width:9px;height:9px;background:#266df1}.ivh-l .b i{background:#cfdcfd;box-shadow:inset 0 0 0 1px #7fa8f7}.ivh-l .y i{background:#7fa8f7}
.ivh-l em{font-style:normal;color:var(--t2)}.ivh-l u{font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--t3);text-decoration:none}.ivh-l p b{text-align:right;font-weight:560}
.ivh .inv{position:absolute;left:0;top:172px;width:61%;max-width:none;box-shadow:0 0 0 1px rgba(23,24,26,.08),0 26px 54px -26px rgba(30,40,80,.5)}
.ivh-i p{display:flex;justify-content:space-between;margin:0;padding:9px 18px;border-bottom:1px solid var(--line);font-size:13px;color:var(--t2)}.ivh-i b{color:var(--ink);font-weight:540}
.ivh .ph2{position:absolute;right:0;top:150px;width:36%;min-height:390px}.ivh .ph2 .hb{max-width:100%;font-size:12.5px}
.ivh .ph2 .ivh-k{width:fit-content;margin:10px 0 0 auto;padding:8px 12px;border-radius:999px;background:#266df1;color:#fff;font-size:12.5px;font-weight:560}
@media(max-width:1080px){.ivh .ph2{display:none}.ivh .inv{width:84%}}
@media(min-width:861px) and (max-height:770px){.ivh{zoom:.86}.ivb-l{margin-top:18px}.ivb-l p{padding:6px 0}.ivb-t .st-t{margin:16px 0 18px}}
@media(max-width:860px){.ivn-s u b,.ivn-s u em{display:none}.ivn-s{height:150px}.ivn-r{height:118px}.ivn-r span[style*="--k:1"] b{top:58px;left:auto;right:0}.ivn-r span[style*="--k:1"] em{top:76px;left:auto;right:0}.ivl-d .n:first-of-type{font-size:0}.ivb-b i{padding:8px;font-size:11px}
.ivb-l p,.ivh-l p{grid-template-columns:minmax(0,1fr) 4.8em 4.6em}.ivb-l em,.ivh-l em{display:none}.ivb-b i u{display:none}
.ivh{height:auto;max-width:460px}.ivh-l{position:relative;height:126px;overflow:hidden}.ivh .inv{position:relative;top:auto;width:100%;margin-top:-26px}.ivl-s{max-width:none}}
/* ---- /lead-vetting ---- */
.lvg{--a:clamp(0,calc(var(--p,1)/.45),1);--r:0;border-top:1px solid var(--ln)}.lvg-i{position:relative;overflow:hidden;background:#fff}
.lvg-f{box-sizing:border-box;border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(56px,6vw,100px) clamp(22px,3.1vw,60px) clamp(56px,6vw,90px)}
.lvg-t{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:20px 40px}.lvg-t .lb{grid-column:1/-1;justify-self:start}.lvg-t .st-t{margin:0;max-width:22em}.lvg-t .fa-k{display:grid;gap:8px;margin:0;text-align:right}
.lvg-c{position:relative;margin-top:clamp(44px,5vw,84px);padding-top:52px;display:grid;gap:clamp(40px,6.4vh,76px);padding-bottom:34px}
.lvg-q{position:absolute;left:var(--x);top:0;bottom:0;width:0;border-left:1px dashed #c9ccd3;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--t3);white-space:nowrap}
.lvg-q{text-indent:8px}
.lvg-l{--v:clamp(0,calc(var(--a)*1.5 - var(--k)*.13),1);position:relative;height:26px}
.lvg-l b{position:absolute;left:0;top:50%;transform:translateY(-50%);max-width:19%;font:400 clamp(17px,1.5vw,25px)/1.1 Georgia,"Times New Roman",serif;letter-spacing:-.01em;line-height:1.15;background:#fff;padding-right:10px;z-index:1}
.lvg-l i{position:absolute;left:20%;top:12px;height:2px;width:calc((var(--to) - 20%)*var(--v));background:var(--ink)}
.lvg-l.ok i{background:#266df1}.lvg-l.no i{background:#b4b7bf}
.lvg-l em{position:absolute;left:var(--to);top:50%;transform:translate(0,-50%);font-style:normal;font-size:clamp(12.5px,.95vw,15px);font-weight:560;padding:6px 10px;border-radius:6px;white-space:nowrap;opacity:clamp(0,calc(var(--v)*8 - 7),1);z-index:1}
.lvg-l.ok em{transform:translate(-100%,-50%);background:#266df1;color:#fff}.lvg-l.no em{margin-left:12px;background:#fff;box-shadow:inset 0 0 0 1px #e5484e;color:#b3262b}
.lvg-l.no::after{content:"";position:absolute;left:var(--to);top:8px;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:#e5484e;opacity:clamp(0,calc(var(--v)*8 - 7),1)}
.lvg-l u{position:absolute;right:0;top:50%;transform:translateY(-50%);text-decoration:none;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--t3);opacity:clamp(0,calc(var(--v)*8 - 7),1)}
@media(min-width:861px){.lvg.sp-live{height:230vh;--a:clamp(0,calc(var(--p,0)/.44),1);--r:clamp(0,calc((var(--p,0) - .6)/.4),1)}
.lvg.sp-live .lvg-i{position:sticky;top:0;height:100vh;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,#fff calc((1 - clamp(0,calc(var(--r)*3.4 - 2.4),1))*100%),var(--dk))}
.lvg.sp-live .lvg-f{flex:none;margin:0 auto}
/* the hand-over: the two lines that made it through thicken until they are the whole screen */
.lvg.sp-live .lvg-l.ok i{z-index:5;transform:scale(calc(1 + var(--r)*3.2),calc(1 + var(--r)*var(--r)*900));background:color-mix(in srgb,#266df1 calc((1 - var(--r)*var(--r))*100%),var(--dk))}
.lvg.sp-live .lvg-l.ok em{z-index:6;opacity:calc(clamp(0,calc(var(--v)*8 - 7),1) - var(--r)*6)}}
.acd-w .acd-g{grid-template-columns:minmax(0,.62fr) minmax(0,1.38fr)}.acd-w .lc-g{width:100%}.acd-w .lc [data-sc]{transition:background .3s,box-shadow .3s,opacity .3s}
.acd-w.live .lc [data-sc]:not(.on){opacity:.4}.acd-w.live .lc [data-sc].on{background:#fff;box-shadow:inset 2px 0 0 var(--ink)}
.lvc{background:var(--dk);color:#fff}.lvc-i{border-left:1px solid var(--dl);border-right:1px solid var(--dl);padding:clamp(72px,7vw,130px) 0 0}
.lvc .st-t{margin:0;padding:0 clamp(22px,3.1vw,60px) clamp(48px,5vw,90px);max-width:20em;color:#fff}
.lvc-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--dl)}.lvc-g div{padding:clamp(26px,2.6vw,48px) clamp(22px,2.6vw,48px) clamp(40px,4vw,72px);border-right:1px solid var(--dl)}.lvc-g div:last-child{border-right:0}
.lvc-g span{display:block;font-size:clamp(14px,1vw,16.5px);color:#8f9197;text-decoration:line-through;text-decoration-color:#5c5e63}.lvc-g b{display:block;margin-top:16px;font:400 clamp(24px,2.3vw,40px)/1.08 Georgia,"Times New Roman",serif;letter-spacing:-.018em}
@media(max-width:860px){.lvg-t{grid-template-columns:minmax(0,1fr)}.lvg-t .fa-k{text-align:left}.lvg-q{font-size:8px;text-indent:3px}.lvg-l b{max-width:none;top:-8px;transform:none;font-size:12.5px;background:none}.lvg-l i{left:0;width:calc(var(--to)*var(--v))}.lvg-l u{display:none}
.lvg-l em{font-size:10.5px;padding:4px 6px}.lvg-c{gap:44px}.acd-w .acd-g,.lvc-g{grid-template-columns:minmax(0,1fr)}.lvc-g div{border-right:0;border-bottom:1px solid var(--dl)}}
/* ---- live windows on the inner pages ---- */
.lvh>*{min-width:0}.lvh>.cd,.lvh>div:first-child{flex:0 1 auto}
.sdw{flex:none;width:clamp(210px,17vw,250px);box-sizing:border-box;padding:14px 12px;border-radius:14px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.16),0 30px 60px -34px rgba(38,38,40,.4);font-size:13px;text-align:left;min-height:170px}
.sdw>p:first-child{margin:0 0 12px;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--g2)}
.sdw.log{background:#17181a;color:#e3e4e7;border-radius:10px;box-shadow:0 30px 60px -34px rgba(38,38,40,.5);min-height:200px}.sdw.log>p:first-child{color:#fff}
.lvs{display:grid;grid-template-columns:auto repeat(auto-fit,minmax(0,1fr));grid-auto-flow:column;align-items:stretch;border-top:1px solid var(--ln);border-left:1px solid var(--ln);border-right:1px solid var(--ln);box-sizing:border-box}
.lvs>p{margin:0;padding:18px clamp(16px,2vw,36px);display:flex;align-items:center;font:500 11px/1.3 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--g2);border-right:1px solid var(--ln)}
.lvs>div{padding:16px clamp(14px,1.6vw,28px);border-right:1px solid var(--ln);display:grid;gap:5px;align-content:center;min-width:0}.lvs>div:last-child{border-right:0}
.lvs span{font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--t3)}.lvs b{font-size:14px;font-weight:540;line-height:1.3}
@media(max-width:860px){.sdw{width:min(100%,300px);min-height:0}.lvs{grid-auto-flow:row;grid-template-columns:minmax(0,1fr)}.lvs>p,.lvs>div{border-right:0;border-bottom:1px solid var(--ln);padding:13px var(--pad)}}

.lvh{display:flex;align-items:flex-end;justify-content:center;gap:clamp(16px,2vw,32px);width:100%}
.lvh .wk{flex:0 1 640px;width:auto;min-width:0}.lvh .ph2{margin-bottom:-18px}
.wkc-g i.em{background:repeating-linear-gradient(135deg,transparent 0 5px,rgba(23,24,26,.035) 5px 6px)}
.wkc-g i.of{background:#fff;box-shadow:inset 0 0 0 1px var(--ink);color:var(--ink)}
.live .wkc-g i[data-at].in{animation:hmin .35s both}
.bkd{width:100%;max-width:440px}.bkd-b{padding:18px 18px 8px}.bkd-t{margin:0 0 12px;font:500 11px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--t3)}
.bkd-t b{display:block;margin-top:10px;font:400 clamp(24px,2vw,32px)/1.1 Georgia,"Times New Roman",serif;letter-spacing:-.015em;text-transform:none;color:var(--ink)}
.bkd-b p+p{display:flex;justify-content:space-between;gap:16px;margin:0;padding:12px 0;border-top:1px solid var(--ln);font-size:14px}.bkd-b p span{color:var(--g2)}.bkd-b p+p b{font-weight:540;text-align:right}
@media(max-width:860px){.lvh{flex-direction:column;align-items:center}.lvh .wk{flex:none;width:100%}.lvh .ph2{width:min(100%,300px);min-height:0;margin:0}}

/* ---- /free-audit ---- */
.fa-k{margin:18px 0 0;display:flex;justify-content:space-between;font:500 11.5px/1 "Geist Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--ink)}.fa-k em{font-style:normal;color:var(--t3)}
.fa3{--l1:clamp(0,calc(var(--p,1)*4.4),1);--l2:clamp(0,calc((var(--p,1) - .4)*3.4),1);--l3:clamp(0,calc((var(--p,1) - .76)*4.8),1)}
.fa3-g{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(56px,6vw,110px) clamp(22px,3.1vw,60px)}
.fa3-h{max-width:46em;margin-bottom:clamp(36px,4vw,72px)}.fa3-h .st-t{margin-top:18px}
.fa3-f{margin:0 0 22px;max-width:520px}
.fa3-t{margin-bottom:56px}.fa3-t span{font:500 11.5px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--t3)}
.fa3-t h3{margin:14px 0 0;font:400 clamp(30px,3.3vw,60px)/1.04 Georgia,"Times New Roman",serif;letter-spacing:-.025em}
.fa3-t p{margin:16px 0 0;max-width:24em;font-size:clamp(15.5px,1.1vw,20px);line-height:1.42;color:var(--g2)}
.xc-h,.xc-g{display:grid;grid-template-columns:repeat(5,minmax(0,1fr))}.xc-h span{padding:0 0 10px 2px;font:500 11px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--t3)}
.xc-g{border-top:1px solid var(--ink);border-left:1px solid var(--ln)}.xc-g i{position:relative;aspect-ratio:1.15;border-right:1px solid var(--ln);border-bottom:1px solid var(--ln)}
.xc-g i.tk::after{content:"";position:absolute;inset:7px;border:1px solid var(--ln);border-radius:5px;background:repeating-linear-gradient(135deg,transparent 0 5px,rgba(0,0,0,.05) 5px 6px)}
.xc-g i.on::after{content:"";position:absolute;inset:7px;border-radius:5px;background:var(--ink);opacity:clamp(0,calc(var(--l1)*4 - 1.6),1);transform:scale(calc(.82 + .18*clamp(0,calc(var(--l1)*4 - 1.6),1)))}
.xc-g i.on::before{content:"";position:absolute;inset:7px;border:1px solid var(--ink);border-radius:5px}
.xt{display:grid;gap:12px}.xt>div{--o:clamp(0,calc(var(--l2)*7 - var(--i)),1);width:62%;padding:15px 16px;border:1px solid var(--ink);border-radius:14px 14px 14px 3px;display:grid;gap:8px;opacity:var(--o);transform:translateY(calc((1 - var(--o))*14px))}
.xt>div.r{justify-self:end;border-color:var(--ln);border-radius:14px 14px 3px 14px;background:var(--g)}.xt>div i{display:block;height:1px;background:var(--ink)}.xt>div.r i{background:#b4b7bf}
.xr{border:1px solid var(--ink);border-radius:10px;padding:22px 22px 18px;background:#fff}.xr .fa-k{margin-top:16px}
.xr-h{display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:1px solid var(--ink)}.xr-h b{width:34%;height:9px;background:var(--ink);border-radius:2px}
.xr-h span{font:500 11px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;opacity:clamp(0,calc(var(--l3)*8 - 6.6),1)}
.xr-r{--o:clamp(0,calc(var(--l3)*7 - var(--i)),1);display:flex;justify-content:space-between;align-items:center;padding:15px 0;border-bottom:1px solid var(--ln)}
.xr-r i{height:1px;background:var(--ink);transform-origin:left;transform:scaleX(var(--o))}.xr-r b{width:13%;height:9px;border-radius:2px;background:var(--ink);opacity:var(--o)}
.xr-f{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding-top:16px;opacity:clamp(0,calc(var(--l3)*7 - 5),1)}.xr-f i{height:34px;border-radius:5px;background:var(--ink)}.xr-f i+i{background:none;border:1px solid var(--ink)}
@media(min-width:861px){
.fa3.sp-live .fa3-g{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);column-gap:clamp(40px,6vw,110px)}
.fa3.sp-live .fa3-h{grid-column:1/-1}
.fa3.sp-live .fa3-f{grid-column:1;grid-row:2/5;position:sticky;top:calc(50vh - 200px);align-self:start;width:100%;max-width:none;margin:0}
.fa3.sp-live .fa3-t{grid-column:2;min-height:76vh;margin:0;display:flex;flex-direction:column;justify-content:center}
.fa3.sp-live .t1{grid-row:2}.fa3.sp-live .t2{grid-row:3}.fa3.sp-live .t3{grid-row:4}
.fa3.sp-live .xf1{opacity:calc(1 - clamp(0,calc((var(--p,0) - .34)*14),1))}
.fa3.sp-live .xf2{opacity:calc(clamp(0,calc((var(--p,0) - .4)*14),1)*(1 - clamp(0,calc((var(--p,0) - .7)*14),1)))}
.fa3.sp-live .xf3{opacity:clamp(0,calc((var(--p,0) - .76)*14),1)}}
.far .fd-r,.far .fd-f{--o:clamp(0,calc(var(--p,1)*8 - var(--k,0)),1);opacity:var(--o);transform:translateY(calc((1 - var(--o))*10px))}
.far .fd-r:nth-child(3){--k:1}.far .fd-r:nth-child(4){--k:2}.far .fd-r:nth-child(5){--k:3}.far .fd-r:nth-child(6){--k:4}.far .fd-f{--k:5.4}
.faw-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(56px,6vw,110px) clamp(22px,3.1vw,60px)}
.faw-h{max-width:46em;margin-bottom:clamp(40px,4.4vw,80px)}.faw-h .st-t{margin-top:18px}
.faw-g{--gap:clamp(44px,4.2vw,76px);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));row-gap:var(--gap);margin-right:34px}
.faw-c{--o:clamp(0,calc(var(--p,1)*9 - var(--i)),1);position:relative;padding:26px 22px 0 0}
.faw-c::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--ink);transform-origin:left;transform:scaleX(var(--o))}
.faw-c::after{content:"";position:absolute;left:0;top:-3px;width:7px;height:7px;background:var(--ink);opacity:var(--o)}
.faw-c>*{opacity:var(--o)}
.faw-c span{font:500 11.5px/1 "Geist Mono",monospace;letter-spacing:.05em;color:var(--t3)}
.faw-c b{display:block;margin-top:14px;font:400 clamp(21px,1.75vw,31px)/1.1 Georgia,"Times New Roman",serif;letter-spacing:-.015em}
.faw-c p{margin:10px 0 0;font-size:clamp(14px,.95vw,16.5px);line-height:1.42;color:var(--g2)}
.faw-c:nth-child(5){grid-column:4}.faw-c:nth-child(6){grid-column:3}.faw-c:nth-child(7){grid-column:2}.faw-c:nth-child(8){grid-column:1}
.faw-c:nth-child(n+5){grid-row:2}.faw-c:nth-child(n+5)::before{transform-origin:right}.faw-c:nth-child(n+5)::after{left:auto;right:0}.faw-c:nth-child(n+5){padding:26px 0 0 22px;text-align:left}
.faw-g>.faw-c:nth-child(4)>i{display:none}
.faw-g{position:relative}.faw-g::after{content:"";position:absolute;right:-34px;top:0;width:34px;height:calc(50% + var(--gap)/2 + 1px);border:1px solid var(--ink);border-left:0;border-radius:0 34px 34px 0;opacity:clamp(0,calc(var(--p,1)*9 - 3.6),1);box-sizing:border-box}
.faw-n{margin:0 0 18px;font:500 11.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--t3)}.faw-n.b{margin:clamp(26px,2.6vw,46px) 0 0}
@media(max-width:860px){.faw-g{grid-template-columns:minmax(0,1fr);row-gap:0;margin:0;border-left:1px solid var(--ink)}.faw-g::after{display:none}
.faw-c,.faw-c:nth-child(n+5){grid-column:1;grid-row:auto;padding:0 0 30px 22px}.faw-c::before{display:none}.faw-c::after,.faw-c:nth-child(n+5)::after{left:-4px;right:auto;top:2px}
.fa3-f{max-width:none}}
"""

# ---- every build page's first screen plays: its own window fills in row by row, and a second window beside or under it runs in step ----
SIDE = {
    'phone-agent': ('log', '&gt; On the call', [(0, '2:14 PM', 'Call answered'), (1, '2:14 PM', 'Job type and address taken'), (3, '2:15 PM', 'Estimate time offered'), (4, '2:16 PM', 'Booked, summary sent to you')]),
    'website-chat': ('phone', 'Visitor, 10:04 PM', [(0, 'c', 'Do you do vinyl fencing?'), (1, 'o', 'Yes. Want a time for a free estimate?'), (3, 'c', 'Thursday morning?'), (4, 'o', 'Thursday 9 AM is yours.')]),
    'social-messages': ('log', '&gt; One inbox', [(0, 'Facebook', 'Message answered'), (1, 'Instagram', 'Message answered'), (2, 'Google', 'Message answered'), (4, 'All three', 'Same reply, same speed')]),
    'lead-vetting': ('phone', 'New lead', [(0, 'o', 'What kind of fence, and roughly how long?'), (1, 'c', 'Privacy fence, about 180 ft'), (2, 'o', 'When do you want it done?'), (4, 'c', 'This month'), (5, 'o', 'Good fit. Wed 2 PM for an estimate?')]),
    'after-hours': ('own', 'Your phone, 11:40 PM', [(1, 'Not urgent', 'Three calls answered and booked'), (4, 'Urgent', 'Gate stuck open, customer waiting')]),
    'reminders': ('log', '&gt; What ran', [(0, 'Mon', 'Booking confirmed'), (1, 'Wed', 'Reminder sent'), (3, 'Thu 7 AM', 'Reminder sent'), (4, 'Thu 7 AM', 'Customer confirmed')]),
    'dispatch': ('own', 'Your phone', [(1, 'Job running long', 'Crew 2, about 40 minutes'), (3, 'Next job moved', 'Customer told the new time'), (5, 'Day adjusted', 'No calls made')]),
    'job-updates': ('phone', 'Customer&rsquo;s phone', [(0, 'o', 'Your crew is booked for Thursday.'), (1, 'o', 'On the way. About 20 minutes out.'), (3, 'o', 'Job done. Photos attached.'), (4, 'c', 'Looks great, thank you')]),
    'estimates': ('log', '&gt; One draft', [(0, '10:20 AM', 'Voice note in'), (1, '10:21 AM', 'Line items priced your way'), (3, '10:24 AM', 'Draft ready for you'), (4, '10:31 AM', 'Approved and sent')]),
    'proposals': ('own', 'Your phone', [(1, 'Proposal opened', 'Twice, last at 8:12 PM'), (4, 'Option picked', 'Better, signed')]),
    'invoicing': ('log', '&gt; What ran', [(0, 'Fri', 'Job finished'), (1, 'Fri', 'Invoice sent'), (3, 'Day 3', 'Friendly reminder'), (4, 'Day 10', 'Firmer reminder'), (5, 'Day 11', 'Paid')]),
    'bookkeeping': ('log', '&gt; One receipt', [(0, 'Receipt', 'Read'), (1, 'Receipt', 'Labelled: materials'), (2, 'Receipt', 'Put against the job'), (4, 'Month end', 'Costs by job ready')]),
    'review-replies': ('own', 'Your phone', [(1, 'Five stars', 'Reply posted'), (4, 'One star', 'Draft waiting for you')]),
    'win-backs': ('phone', 'Past customer&rsquo;s phone', [(1, 'o', 'Hi, it&rsquo;s Ridgeline Fence. It&rsquo;s been a year since your fence went in. Anything need a look?'), (4, 'c', 'Actually the gate is sagging')]),
    'maintenance-reminders': ('log', '&gt; Due dates', [(0, 'Job done', 'Next service date set'), (2, 'When due', 'Reminder sent'), (4, 'Same week', 'Visit booked')]),
    'referrals': ('phone', 'Customer&rsquo;s phone', [(1, 'o', 'Glad you&rsquo;re happy with the fence. Know a neighbor who needs one?'), (3, 'c', 'My neighbor asked about it, actually'), (4, 'o', 'Send them this link and we&rsquo;ll take it from there.')]),
    'campaigns': ('log', '&gt; One send', [(0, 'List', 'People it fits picked'), (2, 'Message', 'Sent'), (4, 'Replies', 'Landing in your inbox')]),
    'websites': ('log', '&gt; One visitor', [(0, '10:02 PM', 'Lands on your site'), (1, '10:03 PM', 'Reads about the work'), (3, '10:04 PM', 'Books an estimate')]),
    'local-search': ('log', '&gt; This week', [(0, 'Mon', 'Photos added'), (1, 'Wed', 'Post published'), (3, 'Fri', 'Questions answered')]),
    'job-photos': ('log', '&gt; One photo', [(0, 'Photo', 'In from the job'), (1, 'Post', 'Google'), (2, 'Post', 'Facebook'), (3, 'Post', 'Instagram')]),
    'hiring': ('phone', 'Applicant&rsquo;s phone', [(0, 'o', 'Thanks for applying. A few quick questions.'), (1, 'o', 'How many years installing fence?'), (2, 'c', 'Six, wood and vinyl'), (4, 'o', 'Can you do a call Thursday at 4 PM?'), (5, 'c', 'Yes')]),
    'team-assistant': ('phone', 'Crew phone', [(0, 'c', 'What do we do when the customer adds a gate on site?'), (2, 'o', 'From your playbook: the answer, and the page it came from.')]),
    'field-notes': ('log', '&gt; One minute', [(0, 'Voice note', 'Recorded on site'), (1, 'Notes', 'Written up'), (3, 'Job', 'Record updated')]),
    'reports': ('own', 'Your phone, Monday', [(1, 'Your week', 'One page, ready to read')]),
    'call-review': ('log', '&gt; Last month', [(0, 'Calls', 'Read'), (2, 'Lost jobs', 'The moment flagged'), (4, 'Pattern', 'Sent to you')]),
    'custom-agents': ('log', '&gt; Your task', [(0, 'Run', 'Started'), (1, 'Limits', 'Inside the ones you set'), (3, 'Done', 'Summary sent')]),
    'custom-builds': ('log', '&gt; Your process', [(0, 'Described', 'Once'), (2, 'Built', 'Around how you work'), (4, 'Running', 'Adjusted with you')]),
}
def _side(kind, title, rows, strip=False):
    if strip:   # under a split hero: a ruled strip that fills in cell by cell
        return ('<div class="w lvs" aria-hidden="true"><p>%s</p>%s</div>'
                % (title.replace('&gt; ', ''), ''.join('<div data-hd="%d"><span>%s</span><b>%s</b></div>' % (at, {'o': 'Sent', 'c': 'Reply'}.get(a, a), b) for at, a, b in rows)))
    if kind == 'phone':
        return '<div class="ph2" aria-hidden="true"><p>%s</p>%s</div>' % (title, ''.join('<p class="hb %s" data-at="%d">%s</p>' % (a, at, b) for at, a, b in rows))
    if kind == 'own':
        return '<div class="sdw own" aria-hidden="true"><p>%s</p>%s</div>' % (title, ''.join('<p class="hn" data-at="%d"><b>%s</b>%s</p>' % (at, a, b) for at, a, b in rows))
    return '<div class="sdw log" aria-hidden="true"><p>%s</p>%s</div>' % (title, ''.join('<p class="hl" data-at="%d"><time>%s</time>%s</p>' % (at, a, b) for at, a, b in rows))


def liven(name, body):
    if name not in SIDE:
        return body
    m = re.match(r'<section class="(\w+)([^"]*)"(.*?)</section>', body, re.S)
    if not m or 'data-live' in m.group(0):
        return body
    kind, title, rows = SIDE[name]; hero = m.group(0); last = max(r[0] for r in rows)
    # rows of the page's own window arrive one after another
    cnt = {}
    for c in re.findall(r'<(?:div|li|p|tr|a) class="([\w-]+)', hero):
        cnt[c] = cnt.get(c, 0) + 1
    rep = [c for c, v in sorted(cnt.items(), key=lambda x: -x[1]) if 3 <= v <= 8 and c not in ('cta', 'on', 'cd', 'n')]
    if rep:
        k = [0]
        def tag(mm):
            k[0] += 1; return '%s data-hd="%d"' % (mm.group(0), min(k[0] - 1, 6))
        hero = re.sub(r'<(?:div|li|p|tr|a) class="%s[^"]*"' % re.escape(rep[0]), tag, hero); last = max(last, min(k[0] - 1, 6))
    if m.group(1) == 'ih' and '<div class="ih-p"><div class="w ih-pi">' in hero:
        a, b = hero.split('<div class="ih-p"><div class="w ih-pi">', 1); pic = b[:b.rindex('</div></div></section>')]
        hero = '%s<div class="ih-p"><div class="w ih-pi"><div class="lvh">%s%s</div></div></div></section>' % (a, pic, _side(kind, title, rows))
    else:
        hero = hero[:-len('</section>')] + _side(kind, title, rows, True) + '</section>'
    hero = hero.replace('<section class="%s%s"' % (m.group(1), m.group(2)), '<section class="%s%s" data-live="%d"' % (m.group(1), m.group(2), last + 3), 1)
    return hero + body[len(m.group(0)):]


def plug(name, body):
    if name not in BY:
        return body
    g0 = BY[name]['group']
    grid = ('<section class="pl8"><div class="w pl8-i"><h2>It works with the rest.</h2><p>Every build runs in the one app, alongside the others.</p><div class="pl8-g">%s</div></div></section>'
            % ''.join('<a href="/%s" class="%s"><span>[%02d]</span><b>%s</b><em>%d builds</em></a>' % (ORDER[g][0] if g != g0 else next((x for x in ORDER[g] if x != name), ORDER[g][0]), 'on' if g == g0 else '', k + 1, gn, len(ORDER[g]))
                      for k, (g, gn) in enumerate(GROUPS)))
    body, n = re.subn(r'<section class="nx">(?:(?!</section>).)*Works with the rest\.(?:(?!</section>).)*</section>', lambda m: grid, body, flags=re.S)
    if not n and 'class="pl8"' not in body:
        i = body.rfind('<section class="cl'); body = body[:i] + grid + body[i:]
    return body


import drawings as DW
DWX = {  # pages that are not builds: (label, line, title)
    'free-audit': ('The free audit', 'The business, taken apart.', 'Every part of it, checked.'),
    'who-its-for': ('Who it&rsquo;s for', 'Any business that quotes.', 'Built around how you quote.'),
    'about': ('About', 'Colorado.', 'Working with service businesses anywhere in the US.'),
    'whats-new': ('What&rsquo;s new', 'What shipped.', 'Every change, with its date.'),
    'questions': ('Questions', 'Asked before the call.', 'Straight answers.'),
    'integrations': ('Custom', 'Integrations.', 'It works with what you already use.'),
}
GNAME = dict(GROUPS)
TKINDS = ['rect', 'iris', 'doors', 'blinds', 'thru', 'rise', 'slash']
_TORDER = [x for g, _ in GROUPS for x in ORDER[g]] + ['free-audit', 'who-its-for', 'about', 'whats-new', 'questions']
def dportal(slug, label, line_, title):
    i = _TORDER.index(slug) if slug in _TORDER else len(slug)
    return ('<section class="pt pt-dw k-%s%s" style="%s"><div class="pt-s"><div class="pt-a"><span>[%s]</span><p>%s</p></div><div class="pt-d"><h2>%s</h2></div>'
            '<div class="pt-o" aria-hidden="true">%s</div></div></section>' % (TKINDS[i % 7], ' t-blue' if i % 5 == 2 else '', DW.focal(slug), label, line_, title, DW.svg(slug)))


def trans(name, body):
    # one transition per page, drawn for that page: the drawing builds as you scroll, then one part of it grows into the next screen
    if name not in DW.D or name in ('reviews', 'invoicing', 'lead-vetting'):   # these hand over through their own graph
        return body
    body = re.sub(r'<section class="pt pt-(?:bubble|sheet|grid|app|bars|cols)" data-sp>.*?</section>', '', body, flags=re.S) if name in BY and name != 'answering' else body
    if 'class="pt ' in body:
        return body
    secs = re.findall(r'<section\b.*?</section>', body, re.S)
    if ''.join(secs) != body or len(secs) < 2:
        return body
    hit = [i for i, x in enumerate(secs) if re.match(r'<section class="st\b', x)]
    at = (hit[0] + 1) if hit and name in BY else 1
    if name in DWX:
        label, line_, title = DWX[name]
    else:
        g = BY[name]['group']; plain = re.sub(r'<[^>]+>', '', body)
        short = ap(BY[name]['short']); x3 = ap(X[name][3]) if name in X and isinstance(X[name][3], str) else ''
        title = short if short and re.sub(r'<[^>]+>', '', short) not in plain else (x3 or short or GLINE[g])
        label, line_ = GNAME[g], BY[name]['name'] + '.'
    secs.insert(at, dportal(name, label, line_, title))
    return ''.join(secs)


def figs(name, body):
    if name not in FIGS:
        return body
    after, fig = FIGS[name]; secs = re.findall(r'<section\b.*?</section>', body, re.S); assert ''.join(secs) == body, name
    hit = [i for i, x in enumerate(secs) if re.match(r'<section class="%s\b' % after, x)]; assert hit, (name, after)
    secs.insert(hit[0] + 1, fig)
    return ''.join(secs)


CSS_LINE = r"""
.lf{background:#fff;border-top:1px solid var(--ln)}
.lf-i{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(36px,5.4vw,104px);align-items:center;border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(80px,7vw,136px) var(--pad)}
.lf-i::before,.lf-i::after{content:"";position:absolute;top:-3px;width:5px;height:5px;background:var(--ink)}.lf-i::before{left:-3px}.lf-i::after{right:-3px}
.lf h2{margin:0;max-width:11em;font:400 clamp(30px,2.9vw,54px)/1.08 Georgia,"Times New Roman",serif;letter-spacing:-.022em;text-wrap:balance}
.lf-k{margin:clamp(12px,1vw,18px) 0 0;font:500 11.5px/1.5 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--t3)}
.lf-t>p:not(.lf-k){margin:clamp(18px,1.6vw,30px) 0 0;max-width:25em;font-size:clamp(15.5px,1.05vw,19px);line-height:1.5;color:var(--t2)}
.lf .cta{margin-top:clamp(22px,2vw,36px);justify-content:flex-start}
.lf.f .lf-d{justify-self:start}.lf.f .lf-t{order:2}
.lf-d{--d:clamp(0,calc((var(--p,1) - .3)*1.75),1);width:100%;max-width:540px;justify-self:end}
.lf-n{margin:0;text-align:right;font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}
.lgr{--k:var(--ink);--bg:#fff;--soft:#eceef2;position:relative;aspect-ratio:16/10;margin:34px 0 46px}
.lgr svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.lgr svg *{vector-effect:non-scaling-stroke;fill:none}
.lgr-w{position:absolute;inset:0;clip-path:inset(-14px calc((1 - var(--d,1))*(100% + 14px) - 14px) -14px -14px)}
.lgr .ax{stroke:var(--k);stroke-width:1}.lgr .gr{stroke:#c4c7cd;stroke-width:1;stroke-dasharray:1.5 5}
.lgr .ln{stroke:var(--k);stroke-width:1.25;stroke-linejoin:round}.lgr .ln.n2{stroke-width:1.1}
.lgr .l2{stroke:#9a9da5;stroke-width:1.2;stroke-dasharray:5 4;opacity:clamp(0,calc(var(--p,1)*5 - 1),1)}
.lgr .l2[style]{opacity:clamp(0,calc((var(--d,1) - var(--t))*8),1)}
.lgr .dr{stroke:#a3a6ad;stroke-width:1;stroke-dasharray:1.5 3.5;opacity:clamp(0,calc((var(--d,1) - var(--t))*14),1)}
.lgr .nd{--q:clamp(0,calc((var(--d,1) - var(--t))*14 + .02),1);position:absolute;width:5px;height:5px;margin:-2.5px 0 0 -2.5px;background:var(--k);opacity:var(--q);transform:scale(calc(.4 + var(--q)*.6))}
.lgr .nd.o{width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%}
.lgr .nd.r,.lgr .nd.fl{width:13px;height:13px;margin:-6.5px 0 0 -6.5px;border-radius:50%;background:var(--bg);box-shadow:inset 0 0 0 1.5px var(--k)}
.lgr .nd.r::after,.lgr .nd.fl::after{content:"";position:absolute;inset:4.5px;border-radius:50%;background:var(--k)}
.lgr .nd.fl{box-shadow:inset 0 0 0 1.5px var(--k),0 0 0 3px var(--bg),0 0 0 4px var(--k)}
.lgr .lgp{position:absolute;padding:4px 6px 3px;border-radius:3px;background:var(--k);color:var(--bg);font:500 9.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;transform:translate(-50%,-50%);opacity:clamp(0,calc((var(--d,1) - var(--t))*10 + .02),1)}
.lgr .lgp.g{background:var(--soft);color:var(--k)}.lgr .lgp.e{transform:translate(-100%,-50%)}
.lgr .tk{position:absolute;top:calc(100% + 13px);transform:translateX(-50%);font:500 10.5px/1 "Geist Mono",monospace;color:var(--t3);white-space:nowrap}
.lgr .tk::before{content:"";position:absolute;left:50%;top:-13px;height:5px;border-left:1px solid var(--k)}
.lgr .tk.a{transform:none}.lgr .tk.a::before{left:0}.lgr .tk.z{transform:translateX(-100%)}.lgr .tk.z::before{left:auto;right:0}
.lgr .cp{position:absolute;left:0;bottom:calc(100% + 14px);margin:0;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--t3)}
.lgr .hz{position:absolute;background:repeating-linear-gradient(135deg,transparent 0 5px,rgba(23,24,26,.2) 5px 6px);opacity:clamp(0,calc((var(--d,1) - var(--t))*6),1)}
.lgr .hz.h2{background:repeating-linear-gradient(45deg,transparent 0 8px,rgba(23,24,26,.13) 8px 9px)}
.lgr-k{position:absolute;right:0;bottom:calc(100% + 8px);display:flex;gap:6px;margin:0}
.lgr-k .lgp{position:static;display:inline-flex;align-items:center;gap:7px;transform:none;opacity:1}
.lgr-k i{width:14px;border-top:1.6px solid currentColor}.lgr-k i.o{border-top-width:1.1px}.lgr-k i.d{border-top:1.2px dashed currentColor}.lgr-k i.q{width:6px;height:6px;border:0;background:currentColor}
.lf.dk{background:var(--dk);color:#fff;border-top:0}.lf.dk .lf-i{border-color:var(--dl)}.lf.dk .lf-i::before,.lf.dk .lf-i::after{background:#fff}
.lf.dk .lf-t>p:not(.lf-k){color:#a3a5aa}.lf.dk .lf-k,.lf.dk .lf-n,.lf.dk .lgr .cp,.lf.dk .lgr .tk{color:#7f8187}
.lf.dk .lgr{--k:#fff;--bg:var(--dk);--soft:#2b2c30}.lf.dk .lgr .lgp.g{color:#e3e4e7}.lf.dk .lgr .l2{stroke:#6f7279}.lf.dk .lgr .hz{background:repeating-linear-gradient(135deg,transparent 0 5px,rgba(255,255,255,.2) 5px 6px)}
@media(max-width:1100px){.lf-i{grid-template-columns:minmax(0,1fr)}.lf-d,.lf.f .lf-d{justify-self:start}.lf.f .lf-t{order:0}.lf h2{max-width:14em}}
@media(max-width:860px){.lf-i{padding:56px var(--pad) 52px;gap:30px}.lf h2{font-size:28px}.lgr{aspect-ratio:5/4}
.lgr .lgp,.lgr .tk,.lgr .cp{font-size:9.5px;letter-spacing:.02em}.lgr-k{left:0;right:auto;flex-wrap:wrap}.lgr:has(.lgr-k) .cp{display:none}}
"""


def spine(title, events):
    return ('<section class="spn" data-sp><div class="spn-s"><p class="spn-h">%s</p><div class="spn-b"><div class="spn-l"><i></i></div><ol>%s</ol></div></div></section>'
            % (title, ''.join('<li class="%s" style="--i:%d"><time>%s</time><b>%s</b></li>' % ('l' if n % 2 == 0 else 'r', n, t, x) for n, (t, x) in enumerate(events))))


def dayline(title, small, href, link, events):
    # the whole day as one stepped line: it climbs a step each time something is handled; the last moment is the one that rang a person
    hx = lambda h: (h - 6) * 100 / 21.0; lv = lambda k: 88 - k * 14; xs = [hx(h) for h, _, _ in events]; n = len(xs) - 1
    cur = _dense([(0, lv(0) - 7)] + [(x, lv(i + 1) + (0 if i < n - 1 else 0)) for i, x in enumerate(xs[:n])] + [(xs[n], lv(n) - 3), (100, lv(n) - 4)]); d = _poly(cur)
    base = _AX + ''.join('<path class="gr" d="M0 %d H100"/>' % lv(k) for k in range(1, n + 1)) + ''.join(_dr(x, lv(i + 1)) for i, x in enumerate(xs[:n])) + _dr(xs[n], lv(n) - 3)
    lab = ''.join('<div class="dln-l" style="left:%.2f%%;top:%d%%;--t:%.3f"><time>%s</time><b>%s</b></div>' % (x, lv(i + 1), x / 100, events[i][1], events[i][2]) for i, x in enumerate(xs[:n]))
    lab += '<div class="dln-l n" style="left:%.2f%%;top:%d%%;--t:.9"><time>%s</time><b>%s</b></div>' % (xs[n], lv(n) - 3, events[n][1], events[n][2])
    html = ''.join(_nd(x, lv(i + 1)) for i, x in enumerate(xs[:n])) + _nd(xs[n], lv(n) - 3, 'fl') + lab + _ticks([hx(h) for h in range(6, 28, 3)], ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM', '12 AM', '3 AM'])
    lst = '<ol class="dln-o">%s</ol>' % ''.join('<li><time>%s</time>%s</li>' % (t, x) for _, t, x in events)
    return ('<section class="dln" data-sp><div class="dln-s"><div class="w dln-i"><div class="dln-t"><h2>%s</h2><div><p>%s</p><a class="btn q" href="%s">%s</a></div></div>%s%s</div></div></section>'
            % (title, small, href, link, _lg(base, _ln(d), html, 'Handled without you, across one day'), lst))


def ch(n, html):
    return html.replace('<section ', '<section data-ch="%d" ' % n, 1)


_arc = lambda h: -21 + (h - 6) * 2.0
DHERO_ART = ('<div class="dh-g" aria-hidden="true"></div><div class="dh-a" aria-hidden="true"><i class="arc"></i>%s<i class="sun"></i></div>'
             % ''.join('<i class="hr" style="--a:%.1fdeg"><span>%s</span></i>' % (_arc(h), t) for h, t in zip(range(6, 28, 3), ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM', '12 AM', '3 AM'])))
CHB = '<nav class="chb" aria-label="Parts of the day">%s</nav>' % ''.join('<a href="#">%s <i>[0%d]</i></a>' % (t, i + 1) for i, t in enumerate(['The day', 'Morning', 'Afternoon', 'Evening', 'Night']))


DAYP = ('<div class="dayp2">'
        + '<section class="dhero">%s<div class="w dhero-i"><span class="lb">A day with it running</span><h1>One day, start to finish.</h1><p class="sub">Scroll through a day at an example business. The pictures are sample data.</p><div class="cta">%s</div></div></section>' % (DHERO_ART, BOOK)
        + ch(0, spine('One day at an example business', [('6:31 AM', 'A form came in. Answered and booked.'), ('9:12 AM', 'A missed call. A text back in 9 seconds.'), ('12:40 PM', 'One job ran long. Two stops moved.'),
                                                          ('4:12 PM', 'The job ended. The invoice went out.'), ('6:05 PM', 'Monday&rsquo;s quote got its check-in.'), ('2:07 AM', 'A burst pipe. The on-call phone rang.')]).replace('data-sp', 'data-sp data-cv', 1))
        + ch(1, wash('a', '9:12 AM', 'The phone rings while you&rsquo;re on a roof.', 'It still gets answered.'))
        + ch(1, words([('', 'A reply goes out in seconds.', 'Sorry we missed you, with times to pick from. No callback list.'),
                       ('', 'It all lands in your app.', 'The thread, the lead and what happens next, in one place.')], THREAD))
        + ch(2, design('dial', 'One job running long should not cost you the afternoon.', 'The day adjusts without you making the calls.', '/dispatch', 'Scheduling and dispatch'))
        + ch(2, portal('sheet', '4:12 PM', 'The job ended.', 'Invoices go out when the job is done.'))
        + ch(2, words([('', 'Friendly first, firmer later.', 'And never from you personally.'),
                       ('', 'They stop the moment it is paid.', 'You can stop them for one customer in one tap.'),
                       ('', 'You get paid without being the one who asks.', 'What is outstanding, by customer and by age.')], INVOICE, True))
        + ch(3, wash('b', '6:05 PM', 'A quote nobody chases is a job you gave away.'))
        + ch(3, design('stack', 'Days 2, 5 and 10, then monthly, until it&rsquo;s a yes or a no.', 'Each quote is followed up on a schedule and stops the moment there is an answer.', '/follow-up', 'Follow-up', False, 'f'))
        + ch(3, dayline('Five things handled without you. One worth waking up for.', 'The whole day on one line. Sample data from an example business.', '/reports', 'Reports',
                        [(6.52, '6:31 AM', 'Form answered and booked'), (9.2, '9:12 AM', 'Missed call texted back'), (12.67, '12:40 PM', 'Two stops moved'), (16.2, '4:12 PM', 'Invoice sent'),
                         (18.08, '6:05 PM', 'Quote check-in sent'), (26.12, '2:07 AM', 'On-call phone rang')]))
        + ch(4, design('dotsfs', 'Only the real emergencies wake you.', 'The burst pipe at 2 AM and the quote request at 2 AM are not the same call.', '/after-hours', 'After hours', True, 'fs'))
        + CHB + '</div>' + CL)

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
.dsn svg circle,.dsn svg line,.dsn svg path{fill:none;stroke:var(--ink);stroke-width:1}
.dsn svg line[style]{opacity:clamp(.16,calc(var(--p,1)*52 - var(--i)),1)}.dsn .rd{stroke:#a3a6ad;stroke-dasharray:1.5 5}
.dsn .r1{stroke-width:1.5;stroke-dasharray:1;stroke-dashoffset:calc(1 - var(--p,1))}
.dsn .hx{stroke-width:1.5;stroke-dasharray:3 4;opacity:clamp(0,calc(var(--p,1)*4 - 1.4),1)}
.dsn .hd{transform-origin:200px 200px;transform:rotate(calc(var(--p,1)*360deg))}.dsn .hd rect,.dsn .c{fill:var(--ink)}
.dsn .hop{flex:none;width:min(640px,100%);aspect-ratio:560/300}.hop .bl{stroke:var(--ink)}
.hop .hp{--q:clamp(0,calc(var(--p,1)*4.6 - var(--i) - .1),1);stroke-width:1.25;stroke-dasharray:1;stroke-dashoffset:calc(1 - var(--q))}
.hop .dr2{stroke:#a3a6ad;stroke-dasharray:1.5 4;opacity:clamp(0,calc(var(--p,1)*4.6 - var(--i) - .6),1)}
.hop .sq{fill:var(--ink);opacity:clamp(0,calc(var(--p,1)*4.6 - var(--i,-1) - .9),1)}
.hop text{font:500 10.5px "Geist Mono",monospace;fill:var(--t3);text-anchor:middle;opacity:clamp(0,calc(var(--p,1)*4.6 - var(--i,-1) - .9),1)}
.stk{display:flex;flex-direction:column-reverse;align-items:center;gap:10px;width:min(520px,100%)}
.stk i{--q:clamp(0,calc(var(--p,1)*11.5 - var(--i)),1);height:clamp(26px,3.6vh,40px);border-radius:10px;background:#eceef2;opacity:var(--q);transform:translateY(calc((1 - var(--q))*-90px)) rotate(calc((1 - var(--q))*-4deg))}
.stk i.k{background:var(--ink)}.stk i.b{background:#9a9da5}.stk i.o{background:none;box-shadow:inset 0 0 0 1.5px var(--ink)}
.dts{display:grid;grid-template-columns:repeat(12,1fr);gap:clamp(8px,1.1vw,18px);width:min(560px,100%)}
.dts i{position:relative;aspect-ratio:1;border-radius:50%;background:rgba(255,255,255,.1)}
.dts i::after{content:"";position:absolute;inset:0;border-radius:50%;background:#fff;opacity:clamp(0,calc(var(--p,1)*var(--n) - var(--i)),1);transform:scale(clamp(.2,calc(var(--p,1)*var(--n) - var(--i)),1))}
.dts i.b::after{background:none;box-shadow:inset 0 0 0 1.5px #fff}
/* the clock's recipe with other objects: a drawn thing does its job, then its dark body becomes the next screen */
.pt{background:var(--dk);color:#fff}.pt-s{display:grid;place-items:center;padding:clamp(96px,10vw,180px) 24px;text-align:center}.pt-a,.pt-o,.pt-n{display:none}
.pt h2{margin:0 auto;max-width:13em;font-size:clamp(34px,4.4vw,84px);line-height:1.02;letter-spacing:-.045em;font-weight:600;text-wrap:balance}
.pt.sp-live{height:300vh;background:#fff}
.pt.sp-live .pt-s{--cy:61%;--w:300px;--h:100px;--r:30px;position:sticky;top:0;height:100vh;height:100svh;padding:0;overflow:hidden;box-sizing:border-box}
.pt.sp-live .pt-a{display:block;position:absolute;left:0;right:0;top:clamp(92px,14vh,170px);padding:0 24px;color:var(--ink);opacity:var(--f,1);transform:translateY(calc((1 - var(--f,1))*-36px))}
.pt-a span{font:500 11.5px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--t3)}
.pt-a p{margin:16px auto 0;max-width:15em;font:400 clamp(28px,2.9vw,52px)/1.1 Georgia,"Times New Roman",serif;letter-spacing:-.02em;text-wrap:balance}
.pt.sp-live .pt-d{--gx:var(--g,0);--gy:var(--g,0);--x:calc((50% - var(--w)/2)*(1 - var(--gx)));position:absolute;inset:0;display:grid;place-items:center;padding:0 24px;background:var(--dk);
clip-path:inset(calc((var(--cy) - var(--h)/2)*(1 - var(--gy))) var(--x) calc((100% - var(--cy) - var(--h)/2)*(1 - var(--gy))) var(--x) round calc(var(--r)*(1 - var(--g,0))))}
.pt.sp-live .pt-d h2{opacity:var(--t,0);transform:translateY(calc((1 - var(--t,0))*40px))}
.pt.sp-live .pt-o{display:block;position:absolute;left:50%;top:var(--cy);width:var(--w);height:var(--h);transform:translate(-50%,-50%);opacity:var(--f,1)}
.pt.sp-live .pt-n{display:block;position:absolute;left:0;right:0;top:calc(var(--cy) + var(--h)/2 + 24px);font:500 13px/1 "Geist Mono",monospace;letter-spacing:.02em;color:var(--t2);opacity:var(--f,1)}
.pt-o i{position:absolute}
/* a reply being typed */
.pt-bubble.sp-live .pt-s{--w:min(420px,80vw);--h:128px;--r:38px}
.pt-bubble .btl{right:30px;bottom:-9px;width:26px;height:26px;border-radius:3px;background:var(--dk);transform:rotate(45deg)}
.pt-bubble .d{left:calc(42px + var(--i)*24px);top:50%;width:11px;height:11px;margin-top:-5.5px;border-radius:50%;background:#fff;opacity:calc(clamp(.22,calc(var(--a,0)*7 - var(--i) - .4),1)*clamp(0,calc((.6 - var(--a,0))*14),1))}
.pt-bubble .b{left:42px;height:2px;background:#fff}.pt-bubble .b1{top:50px;width:calc(clamp(0,calc((var(--a,0) - .58)*5),1)*66%)}.pt-bubble .b2{top:78px;width:calc(clamp(0,calc((var(--a,0) - .76)*5),1)*42%)}
/* an invoice writing itself, then unfolding sideways before it opens */
.pt-sheet.sp-live .pt-s{--w:min(290px,66vw);--h:372px;--r:12px;--cy:63%}
.pt-sheet.sp-live .pt-d{--gx:min(calc(var(--g,0)*3.2),1);--gy:clamp(0,calc(var(--g,0)*1.5 - .5),1)}
.pt-sheet .hd{left:24px;top:30px;width:34%;height:2px;background:#fff}
.pt-sheet .srw{left:24px;right:24px;top:var(--y);height:1px;opacity:clamp(0,calc(var(--a,0)*5 - var(--i) - .6),1)}
.pt-sheet .srw::before,.pt-sheet .srw::after{content:"";position:absolute;top:0;height:1px;background:rgba(255,255,255,.75)}.pt-sheet .srw::before{left:0;width:var(--l)}.pt-sheet .srw::after{right:0;width:16%}
.pt-sheet .ru{left:24px;right:24px;top:240px;border-top:1px dashed rgba(255,255,255,.4)}
.pt-sheet em{position:absolute;left:24px;bottom:28px;padding:5px 7px 4px;border:1px solid rgba(255,255,255,.55);border-radius:3px;font:500 10.5px/1 "Geist Mono",monospace;font-style:normal;letter-spacing:.05em;text-transform:uppercase;color:#fff;opacity:clamp(0,calc((var(--a,0) - .88)*12),1)}
.pt-sheet.sp-live .pt-n{left:50%;right:auto;width:var(--w);top:calc(var(--cy) + var(--h)/2 - 112px);transform:translateX(-50%);box-sizing:border-box;padding-right:24px;text-align:right;font-size:22px;letter-spacing:-.01em;color:#fff}
/* thirty-two tiles filling in, then closing up into one screen */
.pt-grid.sp-live .pt-s{--w:min(560px,84vw);--h:min(280px,42vw);--cy:62%}
.pt-grid.sp-live .pt-d{z-index:2;background:none;clip-path:none}
.pt-grid.sp-live .pt-o{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:calc((1 - var(--g,0))*8px);opacity:1;top:calc(var(--cy) + (50% - var(--cy))*var(--g,0));width:calc(var(--w) + (100% - var(--w))*var(--g,0));height:calc(var(--h) + (100% - var(--h))*var(--g,0))}
.pt-grid .pt-o i{position:static;background:var(--dk);border-radius:calc((1 - var(--g,0))*5px);box-shadow:0 0 0 calc(var(--g,0)*1px) var(--dk);opacity:clamp(.09,calc(var(--a,0)*36 - var(--i) + var(--g,0)*60),1)}
/* three bars filling, one per leak, then closing up into one screen */
.pt-bars.sp-live .pt-s{--w:min(520px,84vw);--h:min(210px,40vw);--cy:62%}
.pt-bars.sp-live .pt-d{z-index:2;background:none;clip-path:none}
.pt-bars.sp-live .pt-o{display:grid;grid-template-rows:repeat(3,minmax(0,1fr));gap:calc((1 - var(--g,0))*14px);opacity:1;top:calc(var(--cy) + (50% - var(--cy))*var(--g,0));width:calc(var(--w) + (100% - var(--w))*var(--g,0));height:calc(var(--h) + (100% - var(--h))*var(--g,0))}
.pt-bars .pt-o i{position:relative;box-shadow:inset 0 0 0 1px var(--ink),0 0 0 calc(var(--g,0)*1px) var(--dk);border-radius:calc((1 - var(--g,0))*3px);overflow:hidden}
.pt-bars .pt-o i::after{content:"";position:absolute;inset:0;background:var(--dk);transform-origin:left;transform:scaleX(clamp(0,calc(var(--a,0)*3.3 - var(--i) + var(--g,0)*6),1))}
/* a drawing made for the page: it draws itself, then one part of it fills and grows into the next screen */
.pt-dw.sp-live .pt-s{--W:min(860px,86vw,calc((100vh - 330px)*1.75));--H:calc(var(--W)*4/7);--cy:calc(50% + 70px)}
.pt-dw.sp-live .pt-o{width:var(--W);height:var(--H);z-index:2}
.pt-dw svg{display:block;width:100%;height:100%;overflow:visible}
.pt-dw svg *{fill:none;stroke:var(--ink);stroke-width:.85;stroke-linecap:round;stroke-linejoin:round}
.pt-dw svg .s{stroke-dasharray:1;stroke-dashoffset:clamp(0,calc(1 - (var(--a,0)*1.12*var(--n) - var(--i))),1)}
.pt-dw svg .g{stroke:#b4b7bf}
.pt-dw svg .da{stroke:#b4b7bf;stroke-dasharray:3 4;opacity:clamp(0,calc(var(--a,0)*1.12*var(--n) - var(--i)),1)}
.pt-dw svg .nd{fill:var(--ink);stroke:none;opacity:clamp(0,calc(var(--a,0)*1.12*var(--n) - var(--i)),1)}
.pt-dw.sp-live .pt-d{--L:calc(50% - var(--W)/2 + var(--fx)*var(--W));--T:calc(var(--cy) - var(--H)/2 + var(--fy)*var(--W));--k:calc(1 - var(--g,0));z-index:1;
opacity:clamp(0,calc(var(--a,0)*9 - 7.9 + var(--g,0)*20),1);
clip-path:inset(calc(var(--T)*var(--k)) calc((100% - var(--L) - var(--fw)*var(--W))*var(--k)) calc((100% - var(--T) - var(--fh)*var(--W))*var(--k)) calc(var(--L)*var(--k)) round calc(var(--fr)*var(--W)*var(--k)))}
@media(max-width:860px){.pt-dw.sp-live .pt-s{--W:min(86vw,calc((100vh - 300px)*1.75));--cy:58%}.pt-dw svg *{stroke-width:1.7}}
/* seven ways a drawing hands over to the next screen */
.pt-dw.t-blue .pt-d{background:none}
.pt-dw.k-iris.sp-live .pt-d{clip-path:circle(calc(var(--fh)*var(--W)*.5*var(--k) + 150vmax*var(--g,0)) at calc(var(--L) + var(--fw)*var(--W)/2) calc(var(--T) + var(--fh)*var(--W)/2))}
.pt-dw.k-rise.sp-live .pt-d{opacity:1;clip-path:inset(calc(var(--k)*100%) 0 0 0 round calc(var(--k)*56px) calc(var(--k)*56px) 0 0)}
.pt-dw.k-blinds.sp-live .pt-d{opacity:1;clip-path:none;-webkit-mask:repeating-linear-gradient(180deg,#000 0 calc(var(--g,0)*12.6vh),transparent 0 12.5vh);mask:repeating-linear-gradient(180deg,#000 0 calc(var(--g,0)*12.6vh),transparent 0 12.5vh)}
.pt-dw.k-slash.sp-live .pt-d{opacity:1;clip-path:polygon(calc(100% - var(--g,0)*170%) 0,100% 0,100% 100%,calc(150% - var(--g,0)*170%) 100%)}
.pt-dw.k-doors.sp-live .pt-d{opacity:1;clip-path:none;z-index:0}
.pt-dw.k-doors.sp-live .pt-s::before,.pt-dw.k-doors.sp-live .pt-s::after{content:"";position:absolute;top:0;bottom:0;width:50.2%;background:#fff;z-index:1}
.pt-dw.k-doors.sp-live .pt-s::before{left:0;transform:translateX(calc(var(--g,0)*-100%));box-shadow:1px 0 0 var(--ln)}.pt-dw.k-doors.sp-live .pt-s::after{right:0;transform:translateX(calc(var(--g,0)*100%))}
.pt-dw.k-doors.sp-live .pt-a{z-index:2}
.pt-dw.k-thru.sp-live .pt-d{clip-path:none;opacity:clamp(0,calc(var(--g,0)*1.7 - .25),1)}
.pt-dw.k-thru.sp-live .pt-o{opacity:calc(1 - var(--g,0)*.9);transform-origin:calc((var(--fx) + var(--fw)/2)*100%) calc((var(--fy) + var(--fh)/2)*175%);transform:translate(-50%,-50%) scale(calc(1 + var(--g,0)*var(--g,0)*22))}
/* five columns filling, then closing up into one screen */
.pt-cols.sp-live .pt-s{--w:min(420px,80vw);--h:min(150px,34vw);--cy:62%}
.pt-cols.sp-live .pt-d{z-index:2;background:none;clip-path:none}
.pt-cols.sp-live .pt-o{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:calc((1 - var(--g,0))*12px);opacity:1;top:calc(var(--cy) + (50% - var(--cy))*var(--g,0));width:calc(var(--w) + (100% - var(--w))*var(--g,0));height:calc(var(--h) + (100% - var(--h))*var(--g,0))}
.pt-cols .pt-o i{position:relative;box-shadow:inset 0 0 0 1px var(--ink),0 0 0 calc(var(--g,0)*1px) var(--dk);border-radius:calc((1 - var(--g,0))*3px);overflow:hidden}
.pt-cols .pt-o i::after{content:"";position:absolute;inset:0;background:var(--dk);transform-origin:bottom;transform:scaleY(clamp(0,calc(var(--a,0)*5.4 - var(--i) + var(--g,0)*8),1))}
/* fine vertical lines along the top and bottom of dark sections on the build pages */
.yw0,.sg2,.sx.dk,.lf.dk{background-image:linear-gradient(180deg,rgba(16,16,16,0) 0,var(--dk) 180px,var(--dk) calc(100% - 180px),rgba(16,16,16,0) 100%),repeating-linear-gradient(90deg,rgba(255,255,255,.075) 0 1px,transparent 1px 7px)}
/* an app icon being pressed, then opening */
.pt-app.sp-live .pt-s{--w:168px;--h:168px;--r:40px}
.pt-app .mk{position:absolute;left:27%;top:27%;width:46%;height:46%;color:#fff;transform:scale(calc(1 - var(--a,0)*.1))}
.pt-app .rg{inset:-24px;border:1px solid var(--ink);border-radius:58px;opacity:calc(1 - var(--a,0));transform:scale(calc(1.5 - var(--a,0)*.5))}
/* colour-wash bands that open a chapter */
.wb{position:relative;z-index:3;display:grid;place-items:center;min-height:clamp(400px,68vh,740px);padding:80px 24px;box-sizing:border-box;overflow:hidden;text-align:center;color:var(--ink)}
.wb-i{position:relative;z-index:1}
.wb-k{margin:0;font:500 11.5px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:rgba(23,24,26,.6)}
.wb h2{margin:18px auto 0;max-width:14em;font:400 clamp(34px,3.8vw,70px)/1.07 Georgia,"Times New Roman",serif;letter-spacing:-.024em;text-wrap:balance}
.wb-i>p:not(.wb-k){margin:20px auto 0;font-size:clamp(15.5px,1.1vw,19px);color:rgba(23,24,26,.66)}
.wb-a{background:radial-gradient(60% 90% at 18% 10%,#c3ccdb 0,rgba(195,204,219,0) 72%),radial-gradient(55% 90% at 88% 90%,#aab6cc 0,rgba(170,182,204,0) 72%),radial-gradient(50% 70% at 70% 0,#f4f5f7 0,rgba(244,245,247,0) 72%),#e2e5ea}
.wb-b{background:radial-gradient(60% 95% at 82% 14%,#8f9bb8 0,rgba(143,155,184,0) 72%),radial-gradient(60% 90% at 10% 92%,#a7a9c4 0,rgba(167,169,196,0) 72%),radial-gradient(50% 70% at 40% 0,#eceef2 0,rgba(236,238,242,0) 72%),#d5d8e0}
.wb-c{background:radial-gradient(60% 90% at 50% 110%,#b4c0d2 0,rgba(180,192,210,0) 72%),radial-gradient(55% 80% at 0 0,#d2d5dc 0,rgba(210,213,220,0) 72%),radial-gradient(55% 80% at 100% 0,#c9cedb 0,rgba(201,206,219,0) 72%),#eceef1}
.spn.sp-live[data-cv]{height:410vh}.sp-live[data-cv]+.wb{margin-top:-70vh}
/* whole-screen pieces: a line down the middle with the day branching off it; a field of dots behind centred words */
.spn{background:#fff;border-bottom:1px solid var(--ln)}
.spn-s{padding:clamp(64px,7vw,120px) 24px}.spn-h{margin:0 0 clamp(28px,4vh,56px);text-align:center;font:500 13px/1 "Geist Mono",monospace;color:var(--t3)}
.spn-b{position:relative;max-width:1100px;margin:0 auto}.spn-l{position:absolute;left:50%;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--ln)}
.spn-l i{display:block;height:100%;background:var(--ink);transform-origin:top;transform:scaleY(var(--p,1))}
.spn-l::after{content:"";position:absolute;left:50%;top:calc(var(--p,1)*100%);width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 5px #fff}
.spn ol{list-style:none;margin:0;padding:0;display:grid}
.spn li{--q:clamp(0,calc(var(--p,1)*6.4 - var(--i) - .1),1);position:relative;width:50%;box-sizing:border-box;padding:clamp(14px,2.4vh,30px) clamp(28px,3.4vw,60px);opacity:var(--q)}
.spn li.l{text-align:right;transform:translateX(calc((1 - var(--q))*-40px))}.spn li.r{margin-left:50%;transform:translateX(calc((1 - var(--q))*40px))}
.spn li::before{content:"";position:absolute;top:50%;width:clamp(16px,2vw,34px);border-top:1.5px solid var(--ink)}.spn li.l::before{right:0}.spn li.r::before{left:0}
.spn time{display:block;font:500 12.5px/1 "Geist Mono",monospace;color:var(--t3)}
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
/* the day as one line: a whole-screen stepped line graph that is wiped in by the scroll */
.dln{--d:clamp(0,calc(var(--p,1)*1.3 - .1),1);background:#fff;border-bottom:1px solid var(--ln)}
.dln-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(64px,6vw,112px) var(--pad);box-sizing:border-box}
.dln-t{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.5fr);gap:clamp(24px,4vw,80px);align-items:end}
.dln h2{margin:0;max-width:15em;font:400 clamp(30px,3.1vw,58px)/1.1 Georgia,"Times New Roman",serif;letter-spacing:-.022em;text-wrap:balance}
.dln-t p{margin:0;max-width:22em;font-size:clamp(15px,1.05vw,19px);line-height:1.45;color:var(--t2)}.dln .btn{margin-top:clamp(14px,1.4vw,22px)}
.dln .lgr{aspect-ratio:21/9;margin:clamp(56px,7vh,84px) 0 30px}
.dln-l{position:absolute;box-sizing:border-box;padding:14px 0 0 14px;white-space:nowrap;opacity:clamp(0,calc((var(--d,1) - var(--t))*12),1)}
.dln-l time{display:block;font:500 12px/1 "Geist Mono",monospace;color:var(--t3)}
.dln-l b{display:block;margin-top:7px;font:400 clamp(15px,1.3vw,22px)/1.14 Georgia,"Times New Roman",serif;letter-spacing:-.012em}
.dln-l.n{padding:0 16px 0 0;transform:translate(-100%,16px);text-align:right;white-space:nowrap}.dln-l.n time{color:var(--ink)}
.dln-o{display:none}
.dln.sp-live{height:300vh}.dln.sp-live .dln-s{position:sticky;top:0;height:100vh}
.dln.sp-live .dln-i{display:flex;flex-direction:column;height:100%;padding-top:clamp(92px,12vh,128px);padding-bottom:clamp(84px,11vh,104px)}
.dln.sp-live .lgr{flex:1;min-height:0;aspect-ratio:auto;margin-bottom:26px}
/* the top of /day: graph paper and the day's arc, with a marker that moves along it as the page starts to scroll */
.dhero{position:relative;overflow:hidden}.dhero-i{position:relative;padding-bottom:clamp(170px,26vh,280px)}
.dh-g{position:absolute;inset:0;background-image:linear-gradient(var(--ln) 1px,transparent 1px),linear-gradient(90deg,var(--ln) 1px,transparent 1px);background-size:56px 56px;background-position:50% 0;opacity:.7;-webkit-mask-image:radial-gradient(ellipse 58% 52% at 50% 40%,transparent 46%,#000 100%);mask-image:radial-gradient(ellipse 58% 52% at 50% 40%,transparent 46%,#000 100%)}
.dh-a{position:absolute;left:50%;top:calc(100% - clamp(150px,23vh,250px));width:240vw;height:240vw;margin-left:-120vw;pointer-events:none}
.dh-a .arc{position:absolute;inset:0;border-radius:50%;border:1px dashed #a9acb3}
.dh-a .hr,.dh-a .sun{position:absolute;left:50%;top:0;width:0;height:50%;transform-origin:50% 100%;transform:rotate(var(--a))}
.dh-a .hr::before{content:"";position:absolute;left:-.5px;top:-5px;height:11px;border-left:1px solid var(--ink)}
.dh-a .hr span{position:absolute;left:0;top:18px;transform:translateX(-50%);font:500 10.5px/1 "Geist Mono",monospace;color:var(--t3);white-space:nowrap}
.dh-a .sun{--a:calc(-20deg + var(--h,0)*40deg)}
.dh-a .sun::before{content:"";position:absolute;left:-8px;top:-8px;width:16px;height:16px;box-sizing:border-box;border-radius:50%;background:#fff;border:1.5px solid var(--ink)}
.dh-a .sun::after{content:"";position:absolute;left:-3px;top:-3px;width:6px;height:6px;border-radius:50%;background:var(--ink)}
/* where you are in the day, along the bottom */
.chb{position:fixed;left:50%;bottom:0;z-index:40;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));width:min(780px,calc(100vw - 460px));background:#fff;box-shadow:0 0 0 1px var(--ln);transform:translate(-50%,110%);transition:transform .35s cubic-bezier(.2,.7,.2,1),background .25s}
.chb.on{transform:translate(-50%,0)}
.chb a{display:flex;justify-content:center;gap:7px;padding:13px 6px 12px;font:500 10.5px/1 "Geist Mono",monospace;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;color:var(--t3);transition:background .25s,color .25s}
.chb a+a{border-left:1px solid var(--ln)}.chb i{font-style:normal;opacity:.6}.chb a.on{background:var(--ink);color:#fff}
.chb.dk{background:#1a1b1e;box-shadow:0 0 0 1px #2c2d31}.chb.dk a{color:#8f9197}.chb.dk a+a{border-color:#2c2d31}.chb.dk a.on{background:#fff;color:var(--ink)}
@media(max-width:1000px){.chb{display:none}}
@media(max-width:860px){.dln-i{padding:56px var(--pad)}.dln-t{grid-template-columns:minmax(0,1fr);gap:16px}.dln h2{font-size:28px}.dln .lgr{aspect-ratio:4/3;margin-top:44px}.dln-l{display:none}.dln-o{display:block;list-style:none;margin:34px 0 0;padding:0}.dln-o li{display:flex;gap:14px;align-items:baseline;padding:11px 0;border-top:1px solid var(--ln);font-size:15.5px;line-height:1.3}.dln-o time{flex:none;width:5.4em;font:500 11.5px/1 "Geist Mono",monospace;color:var(--t3)}.dln-o li:last-child time{color:var(--ink)}
.dln .tk:nth-of-type(even){display:none}.dh-a .hr:nth-of-type(odd) span{display:none}.dh-a .hr span{font-size:9.5px}.dh-g{background-size:40px 40px}}
@media(max-width:860px){.wb{min-height:56vh}.wb h2{font-size:32px}.pt-a p{font-size:27px}.wsc-g,.dsn-g{grid-template-columns:minmax(0,1fr)}.wsc-p{order:-1;border:0!important;border-bottom:1px solid var(--ln)!important}.wsc-s{position:static;height:auto;padding:28px 14px}.wsc-w>div{min-height:0;padding:44px var(--pad)}.wsc.f .wsc-w{order:0}
.spn li,.spn li.r{width:auto;margin:0;text-align:left;transform:none;opacity:1;padding:16px 0 16px 28px}.spn-l{left:0}.spn li::before{left:0!important;right:auto!important;width:16px}.dsn.f .dsn-t{order:0}.dsn.fs .dsn-t{min-height:70vh}.dsn.fs .dts{grid-template-columns:repeat(12,1fr)}
.dsn-g{min-height:0}.dsn-t{padding:56px var(--pad) 8px}.dsn-d{border-left:0;padding:28px var(--pad) 56px}.wsc h2,.dsn h2{font-size:28px}}
"""

out = pathlib.Path(ROOT) / 'site'
_home = H.HOME.replace(H.WHAT, portal('bars', 'One example business', 'Three leaks. It adds up.', 'That is what an audit finds.') + H.WHAT)
assert _home != H.HOME
CSS = H.mono(CSS + CSS_DESK + CSS_CAL + CSS_AFT + CSS_TEAM + CSS_REST + CSS_RHY + CSS_CLEAN + CSS_FULL + CSS_STAGE + CSS_DAY + CSS_LINE + CSS_FA)
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
    ('who-its-for', 'Who it is for', 'For owner-run service businesses that sell estimates and quotes. It works for any business that quotes jobs.', WHOFOR),
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
        _b = plug(slug, liven(slug, trans(slug, figs(slug, full(slug, flag(slug, body))))))
        _b = re.sub(r'(<section class="pt [^"]*") data-sp', r'\1', _b)
        if slug == 'follow-up':
            _b = _b.replace('<section class="pt ', '<section data-in class="pt pt-fu ', 1).replace('gets chased until it&rsquo;s settled.</h2>', 'gets chased <u>until it&rsquo;s settled.</u></h2>', 1)
            _b = _b.replace('<section class="ic">', '<section class="ic ic-fu" data-in>', 1)
            _b = re.sub(r'(<section class="ic ic-fu" data-in>.*?</div>)(<ul>)', lambda m: m.group(1) + '<svg class="icf-l" viewBox="0 0 200 500" preserveAspectRatio="none" aria-hidden="true"><path d="M0 250 C110 250 90 50 200 50"/><path d="M0 250 C110 250 90 150 200 150"/><path d="M0 250 C110 250 90 250 200 250"/><path d="M0 250 C110 250 90 350 200 350"/><path d="M0 250 C110 250 90 450 200 450"/><circle cx="2" cy="250" r="3"/></svg>' + m.group(2), _b, count=1, flags=re.S)
            _b = _b.replace('<section class="as">', '<section class="as as-fu">', 1)   # no stops: the transition band scrolls past like any other section
        doc = page(title, desc, '/' + slug, _b, css=PCSS, index=(slug not in ('404', 'day', 'terms')))
        if slug == 'audit':
            doc = doc.replace('</body>', '<script src="/audit.js" defer></script></body>')
        (out / (slug + '.html')).write_text(doc)
    (out / 'free-audit.html').write_text(page('The free audit', 'A free fifteen-minute audit of your service business. We walk it from the first call to the last invoice, put a number on what it is costing you, and tell you what to fix first. You keep the plan.', '/free-audit', trans('free-audit', FAUDIT), css=PCSS))
    (out / 'index.html').write_text(page('Find out what your business is losing', H.DESC, '/', _home, css=PCSS))
    print('pages', [p[0] for p in PAGES], V)
