#!/usr/bin/env python3
"""The inner pages of the light site. Every page shares the theme (nav, footer, type, colours) from mk_home.py
and gets its own picture, its own layout and one thing no other page has. Run after mk_home.py; it imports it."""
import hashlib, pathlib, re
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
out = pathlib.Path(ROOT) / 'site'
(out / 'assets/light-pages.css').write_text(CSS.strip() + '\n')
V = hashlib.sha1(CSS.encode()).hexdigest()[:8]
PCSS = 'light-pages.css?v=' + V
PAGES = [
    ('everything', 'Everything we build', 'Every build Cinder makes for service businesses, in eight parts of the business. Each one is made for the business it goes into, and your free audit decides which ones you need.', EVERYTHING),
    ('websites', 'Websites', 'A website built for your business that loads fast on a phone, says what you do, and books the estimate from the page.', WEBSITES),
    ('answering', 'Answering', 'Missed calls and new leads get a text back from your business in seconds, even after hours and while you are on a job.', ANSWERING),
]
if __name__ == '__main__':
    for slug, title, desc, body in PAGES:
        (out / (slug + '.html')).write_text(page(title, desc, '/' + slug, body, css=PCSS))
    print('pages', [p[0] for p in PAGES], V)
