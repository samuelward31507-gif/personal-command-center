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


def related(title, slugs):
    return ('<section class="rl"><div class="w rl-g"><p class="rl-t">%s</p>%s</div></section>'
            % (title, ''.join('<a href="/%s"><b>%s</b><span>%s</span>%s</a>' % (s, BY[s]['name'], ap(BY[s]['short']), ARROW) for s in slugs)))


def line(text):
    return '<section class="bl"><div class="w bl-i"><p>%s</p></div></section>' % text


def compare(title, left, right, rows, strike=False):
    return ('<section class="cp%s"><div class="w cp-g"><div class="cp-t"><p class="st-t">%s</p></div><div class="cp-p"><div class="cd cp-c">'
            '<div class="cp-h"><span>%s</span><span>%s</span></div>%s</div></div></div></section>'
            % (' sk' if strike else '', title, left, right,
               ''.join('<div class="cp-r"><span>%s%s</span><b>%s%s</b></div>' % (CROSS, a, TICK, b) for a, b in rows)))


def dark_split(label, lead, rest, steps, picture):
    return ('<section class="hw"><div class="w hw-g"><div class="hw-t"><span class="lb">%s</span><p class="st-t">%s <span>%s</span></p><ol>%s</ol></div>'
            '<div class="hw-r">%s</div></div></section>' % (label, lead, rest, ''.join('<li><div><b>%s</b><span>%s</span></div></li>' % x for x in steps), picture))


# =====================================================================================
# /everything : the whole catalogue on one board, then an index that follows you down the page
# =====================================================================================
cols = ''
for g, gname in GROUPS:
    chips = ''.join('<a href="/%s">%s</a>' % (s, BY[s]['name']) for s in ORDER[g])
    if g == 'custom':
        chips += '<a class="yours" href="/custom-builds">Yours</a>'
    cols += '<div class="bo-c"><div class="bo-h"><svg viewBox="0 0 24 24" aria-hidden="true">%s</svg><b>%s</b><i>%d</i></div>%s</div>' % (IC[GICON[g]], gname, len(ORDER[g]), chips)
BOARD = '<div class="cd bo"><div class="rep-h"><span class="dot"></span><b>Everything we build</b><span>%d builds, eight parts</span><span class="tag">Every one made to fit</span></div><div class="bo-b">%s</div></div>' % (len(ALL), cols)
blocks = ''
for n, (g, gname) in enumerate(GROUPS):
    rows = ''.join('<a class="ix-r" href="/%s"><b>%s</b><span>%s</span>%s</a>' % (s, BY[s]['name'], ap(BY[s]['short']), ARROW) for s in ORDER[g])
    blocks += ('<article class="lk-b" id="part-%d"><div class="lk-s"><p class="bs">%s. <span>%s</span></p></div><div class="ix">%s</div></article>' % (n + 1, gname, GLINE[g], rows))
INDEX = ('<section class="lk"><div class="w lk-g"><aside class="lk-n"><ul>%s</ul></aside><div class="lk-m">%s</div></div></section>'
         % (''.join('<li%s><a href="#part-%d">%s</a></li>' % (' class="on"' if i == 0 else '', i + 1, gn) for i, (_, gn) in enumerate(GROUPS)), blocks))
EVERYTHING = (inner_hero('What we build', 'If AI can do it, we build it.',
                         '%d builds today, in eight parts of your business, and room for whatever yours needs next. Each one is made for the business it goes into. The one thing we don&rsquo;t do is run ads.' % len(ALL),
                         BOOK + '<a class="btn q" href="/free-audit">How the audit works</a>', BOARD)
              + statement('How to read this', 'You don&rsquo;t pick from this list. Your audit does.', 'It finds what is costing you, and we build only those. Most businesses need three or four of these, not thirty-two.')
              + INDEX
              + ask('Not on the list?', 'If it repeats in your business, it can probably run on its own.', 'Custom builds', '/custom-builds')
              + CL)

# =====================================================================================
# /websites : the site itself is the picture; the page argues by crossing out what most sites do
# =====================================================================================
PHONE = ('<div class="ph"><div class="ph-s"><div class="ph-n"><b>Ridgeline Fence</b><span>Menu</span></div>'
         '<div class="ph-h">Fences built right.<br>Get a price today.</div>'
         '<div class="ph-f"><label>What do you need?<u>New fence</u></label><label>Zip code<u>80920</u></label><em>See open times</em>'
         '<div class="ph-t"><span>Tue 9 AM</span><span class="on">Wed 2 PM</span><span>Thu 11 AM</span></div></div>'
         '<div class="ph-w"><i></i><i></i><i></i></div></div></div>'
         '<div class="ph-c c1"><b>Loads fast</b><span>Most visitors are on a phone.</span></div>'
         '<div class="ph-c c2"><b>One clear button</b><span>No hunting for a number.</span></div>'
         '<div class="ph-c c3"><b>The button books</b><span>A time on your calendar.</span></div>'
         '<p class="ph-k">Example. Sample data.</p>')
FLOW = ('<div class="fl"><div class="fd-h"><span class="dot"></span><b>One visit</b><span>Ridgeline Fence</span><span class="tag">Example, sample data</span></div>%s'
        '<div class="rn-f"><span>From search to booked, without a phone call.</span><em>4 steps</em></div></div>'
        % ''.join('<div class="fl-r"><i>%d</i><b>%s</b><span>%s</span></div>' % (i + 1, a, b) for i, (a, b) in enumerate([
            ('Searches &ldquo;fence company near me&rdquo;', 'Finds your listing and taps through'),
            ('The page loads', 'Before they have time to go back'),
            ('Picks a time', 'Wed 2 PM, from your open slots'),
            ('It&rsquo;s on your calendar', 'With the job, the address and the zip code')])))
WEBSITES = ('<section class="hs hs-r"><div class="w hs-g"><div class="hs-p ph-p">%s</div><div class="hs-t"><span class="pill"><i></i>Getting found</span>'
            '<h1>A site that books jobs.</h1><p class="sub">Fast on a phone, clear about what you do, and built to turn visitors into booked estimates. Written and built for your business, not from a theme.</p>'
            '<div class="cta">%s<a class="btn q" href="/audit">Check your site in 60 seconds</a></div>'
            '<p class="hs-n">Three things do most of the work: it loads fast, it has one clear button, and the button books.</p></div></div></section>' % (PHONE, BOOK)
            + statement('The problem', 'Most contractor sites lose the visitor on the first screen.', 'Slow on a phone, no clear next step, and a contact form that goes nowhere. The visitor wanted a price and a time. They leave with neither.')
            + cells([('Sign 1', 'It takes seconds to load on a phone.', 'Most of your visitors are on one, and they don&rsquo;t wait.'),
                     ('Sign 2', 'There is no way to book from the page.', 'A phone number and a form is a job for the visitor.'),
                     ('Sign 3', 'Photos and reviews are buried or missing.', 'The proof you do good work is three taps away.')], 'pg-3 pg-n')
            + compare('What most contractor sites get wrong.', 'Most sites', 'Yours',
                      [('Slow on a phone.', 'Loads before they give up.'), ('A contact form that goes to an inbox.', 'A reply in seconds and a time on your calendar.'),
                       ('Says &ldquo;quality service&rdquo;.', 'Says what you do, where, and how to book.'), ('Hard to find nearby.', 'Set up for local search.')], strike=True)
            + dark_split('What you get', 'A page that does one job.', 'It turns a search into a booked estimate.',
                         [('Fast on a phone.', 'Most of your visitors are on one. It loads before they give up.'),
                          ('Booking built in.', 'Visitors pick a time or get a reply in seconds, right from the page.'),
                          ('Set up for local search.', 'Built so the people near you can find you.')], FLOW)
            + cells([('quote', 'An instant quote form.', 'It books the estimate instead of asking them to call.'),
                     ('chat', 'A reply in seconds.', 'Every visitor who asks gets one.'),
                     ('star', 'Your reviews and your work.', 'Front and center, not three taps away.'),
                     ('plus', 'Built for you.', 'Written from what you tell us on the call.')], 'pg-4')
            + ask('Check your site first.', 'A free check of your site in 60 seconds.', 'Check your site', '/audit')
            + line('Your site should book jobs while you&rsquo;re on one.')
            + faq('Questions.', [('Do I need a new site?', 'Not always. The free audit tells you if yours is costing you jobs.'),
                                 ('Who writes it?', 'We do, from what you tell us on the call.'),
                                 ('Can it work with my current setup?', 'Yes. It plugs into your calendar and everything else we set up.'),
                                 ('Is this part of a package?', 'No. There are no packages. We build what your audit calls for and nothing else.')])
            + related('Works with the rest.', ['answering', 'booking', 'follow-up', 'reviews'])
            + CL)

# =====================================================================================
# /answering : one missed call, timed to the second; then where calls get missed, on a day
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
DAY = ''.join('<div class="dy-c"><div class="dy-b"><i style="left:%d%%;width:%d%%"></i></div><h3>%s</h3><p>%s</p></div>' % x for x in [
    (33, 30, 'On a job site.', 'Your hands are full and the phone rings out.'),
    (71, 29, 'After hours and weekends.', 'The form comes in at 9 PM. By morning they&rsquo;ve called someone else.'),
    (46, 6, 'On another call.', 'The second caller hangs up and tries the next name on the list.'),
    (0, 100, 'Lead sites.', 'Facebook, Angi and Thumbtack leads go to whoever answers first.')])
ANSWERING = (inner_hero('Front desk', 'Every call gets an answer.',
                        'Missed calls and new leads get a text back in seconds, even after hours and while you&rsquo;re on a job.',
                        BOOK + '<a class="btn q" href="/free-audit">How the audit works</a>', THREAD)
             + statement('The problem', 'Most leads go to whoever answers first.', 'A missed call, a web form, a message on a lead site. Each one is a person ready to hire, and each one is also contacting someone else. The reply that arrives tonight is usually too late.')
             + '<section class="dy"><div class="w dy-i"><p class="dy-t">Where jobs get missed, across one day.</p><div class="dy-x"><span>6 AM</span><span>Noon</span><span>6 PM</span><span>Midnight</span></div><div class="dy-g">%s</div></div></section>' % DAY
             + '<section class="sn"><div class="w sn-i"><b>78%</b><p>of people have taken their business elsewhere after a company didn&rsquo;t pick up.</p><span>CallRail survey of 1,000 consumers, 2025</span></div></section>'
             + dark_split('How it works', 'A call rings out. A reply goes out.', 'You see all of it in one place.',
                          [('A call rings out.', 'You&rsquo;re on a job site and can&rsquo;t pick up. A form comes in at 9 PM.'),
                           ('A reply goes out in seconds.', 'Sorry we missed you, with times to pick from. No callback list.'),
                           ('It all lands in your app.', 'The thread, the lead and what happens next, in one place.')], INBOX)
             + '<section class="ic"><div class="w ic-g"><div class="ic-t"><span class="lb">What&rsquo;s included</span><p class="st-t">Set up around the number you already use.</p></div><ul>%s</ul></div></section>'
             % ''.join('<li>%s<span>%s</span></li>' % (TICK, t) for t in [
                 'Missed calls get a text back from your business.', 'Web forms, Facebook, Angi and Thumbtack leads answered by text.',
                 'Your questions and your price range before anything books.', 'No reply? Up to 3 friendly follow-ups so the lead doesn&rsquo;t go cold.',
                 'English and Spanish.', 'A Monday text report of every lead and reply.'])
             + compare('Before and after.', 'Without it', 'With it',
                       [('The lead waits for a callback.', 'The lead hears back in seconds.'), ('You find out tonight.', 'You see it in your app now.'),
                        ('Tire kickers take your time.', 'Your questions come first.'), ('No answer means they move on.', 'Follow-ups keep it alive.')])
             + faq('Questions.', [('Which leads does it cover?', 'Missed calls, texts, website forms, and requests from Facebook, Angi and Thumbtack.'),
                                  ('What if the lead isn&rsquo;t a fit?', 'Your questions and your price range come before anything books, so you only see the serious ones.'),
                                  ('What if they don&rsquo;t reply?', 'Up to 3 friendly follow-ups go out, then it stops.'),
                                  ('Do I have to change how I work?', 'No. You answer the calls you can. Everything you miss gets handled.'),
                                  ('Where do I see it?', 'Every thread lands in your app, and a text report comes every Monday.')])
             + related('Works with the rest.', ['booking', 'follow-up', 'reviews', 'websites'])
             + CL)

CSS = r'''
/* ============ pieces shared by the inner pages ============ */
.rl{border-top:1px solid var(--ln)}
.rl-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.rl-t{grid-column:1/-1;margin:0;padding:clamp(40px,3.4vw,64px) var(--pad) clamp(20px,1.6vw,30px);font-size:clamp(19px,1.265vw,24px);font-weight:500;letter-spacing:-.02em;border-bottom:1px solid var(--ln)}
.rl a{position:relative;display:block;padding:clamp(20px,1.5vw,28px) clamp(20px,1.42vw,27px) clamp(26px,2vw,38px);border-left:1px solid var(--ln);transition:background .2s}.rl a:first-of-type{border-left:0}
.rl a:hover{background:#fff}.rl a b{display:block;font-size:clamp(15px,.92vw,17.5px);font-weight:560;letter-spacing:-.012em}
.rl a span{display:block;margin-top:5px;max-width:17em;font-size:clamp(14px,.84vw,16px);line-height:1.34;color:var(--g2)}
.rl a svg,.ix-r svg{width:16px;height:16px;fill:none;stroke:var(--g3);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s,stroke .2s}
.rl a svg{position:absolute;right:clamp(18px,1.3vw,24px);top:clamp(22px,1.6vw,30px)}.rl a:hover svg,.ix-r:hover svg{stroke:var(--ink);transform:translateX(3px)}
.bl{border-top:1px solid var(--ln);background:#fff}
.bl-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln);padding:clamp(96px,8.6vw,164px) 24px;text-align:center}
.bl p{margin:0 auto;max-width:17em;font-size:clamp(30px,2.75vw,52px);line-height:1.08;font-weight:560;letter-spacing:-.038em;text-wrap:balance}
.cp{border-top:1px solid var(--ln)}
.cp-g{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.cp-t{padding:clamp(72px,6vw,112px) var(--pad);align-self:center}.cp-t .st-t{margin:0;max-width:11em;font-size:clamp(27px,1.95vw,37px)}
.cp-p{border-left:1px solid var(--ln);background:var(--pn);padding:clamp(44px,3.8vw,72px) clamp(24px,3vw,56px);display:flex;align-items:center;justify-content:center}
.cp-c{width:100%;max-width:640px;overflow:hidden}
.cp-h,.cp-r{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.cp-h{height:44px;align-items:center;border-bottom:1px solid var(--line);font:500 11.5px/1 "Geist Mono",monospace;color:var(--t3)}.cp-h span{padding:0 18px}
.cp-r{border-bottom:1px solid var(--line);font-size:clamp(14px,.86vw,16px);line-height:1.34}.cp-r:last-child{border-bottom:0}
.cp-r>*{display:flex;gap:10px;align-items:flex-start;padding:15px 18px}.cp-r span{color:var(--t3)}.cp-r b{font-weight:540;color:var(--ink);border-left:1px solid var(--line);background:#fbfcff}
.cp-r svg{flex:none;width:16px;height:16px;margin-top:2px;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.cp-r span svg{stroke:var(--g3)}.cp-r b svg{stroke:var(--blue)}
.cp.sk .cp-r span{text-decoration:line-through;text-decoration-color:rgba(138,141,147,.6)}
/* a dark list card for the right side of a dark split */
.fl{width:100%;max-width:580px;background:#17181a;border-radius:12px;box-shadow:0 0 0 1px rgba(255,255,255,.09),0 40px 70px -36px rgba(0,0,0,.9)}
.fl-r{display:grid;grid-template-columns:44px minmax(0,1fr);column-gap:12px;row-gap:2px;padding:14px 18px 15px;border-bottom:1px solid var(--dl)}
.fl-r i{grid-row:1/3;font:500 11.5px/1.5 "Geist Mono",monospace;font-style:normal;color:#7f8187}
.fl-r b{font-size:14px;font-weight:540;letter-spacing:-.008em;color:#fff}.fl-r span{grid-column:2;font-size:12.5px;color:#8f9197}
@media(min-width:1700px){.fl,.cp-c{zoom:1.1}}

/* ============ /everything : the board and the index ============ */
.bo{position:relative;width:min(1180px,100%);margin:0 auto}
.bo-b{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));align-items:start;padding:8px 8px 14px}
.bo-c{padding:10px 6px 0;display:grid;gap:6px;align-content:start}
.bo-h{display:flex;align-items:center;gap:7px;height:32px;padding:0 4px 6px;margin-bottom:2px;border-bottom:1px solid var(--line);font-size:12.5px}
.bo-h svg{width:15px;height:15px;flex:none;fill:none;stroke:var(--t2);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.bo-h b{font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bo-h i{margin-left:auto;font:500 11px/1 "Geist Mono",monospace;font-style:normal;color:var(--t3)}
.bo-c a{display:flex;align-items:center;min-height:34px;padding:6px 9px;border-radius:8px;background:#f6f7f9;font-size:12.5px;line-height:1.2;font-weight:520;letter-spacing:-.006em;color:var(--ink);text-align:left;transition:background .15s,box-shadow .15s,color .15s}
.bo-c a:hover{background:#fff;box-shadow:0 0 0 1.5px var(--blue);color:#1f4fbf}
.bo-c a.yours{background:none;box-shadow:inset 0 0 0 1.5px rgba(38,109,240,.45);color:#1f4fbf;border-radius:8px;background-image:none}
.ih-pi:has(.bo){padding-left:clamp(16px,2vw,36px);padding-right:clamp(16px,2vw,36px)}
.ix{border-top:1px solid var(--ln)}
.ix-r{display:grid;grid-template-columns:minmax(0,.5fr) minmax(0,1fr) 16px;gap:20px;align-items:center;min-height:clamp(56px,3.9vw,72px);padding:10px var(--pad);border-bottom:1px solid var(--ln);transition:background .2s}
.lk-b:last-child .ix-r:last-child{border-bottom:0}.ix-r:hover{background:#fff}
.ix-r b{font-size:clamp(15.5px,.95vw,18px);font-weight:540;letter-spacing:-.012em}.ix-r span{font-size:clamp(15px,.9vw,17px);line-height:1.34;color:var(--g2)}

/* ============ /websites : the phone, the callouts ============ */
.hs-r .hs-p{border-left:0;border-right:1px solid var(--ln)}
.ph-p{position:relative;flex-direction:column}
.ph{position:relative;width:292px;padding:9px;border-radius:40px;background:#17181a;box-shadow:0 40px 80px -36px rgba(30,40,110,.6),0 0 0 1px rgba(23,24,26,.5)}
.ph-s{border-radius:31px;background:#fff;overflow:hidden;padding-bottom:16px}
.ph-n{display:flex;justify-content:space-between;align-items:center;height:48px;padding:6px 16px 0;font-size:12.5px;border-bottom:1px solid var(--line)}.ph-n b{font-weight:620;letter-spacing:-.01em}.ph-n span{color:var(--t3)}
.ph-h{padding:20px 16px 4px;font-size:23px;line-height:1.08;font-weight:620;letter-spacing:-.035em}
.ph-f{margin:14px 12px 0;padding:12px;border-radius:14px;background:#f6f7f9;display:grid;gap:8px}
.ph-f label{display:grid;gap:5px;font-size:11px;color:var(--t2)}.ph-f u{display:flex;align-items:center;height:36px;padding:0 11px;border-radius:9px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.1);text-decoration:none;font-size:13px;color:var(--ink);font-weight:520}
.ph-f em{display:grid;place-items:center;height:40px;margin-top:2px;border-radius:10px;background:var(--ink);color:#fff;font-style:normal;font-size:13.5px;font-weight:560}
.ph-t{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.ph-t span{display:grid;place-items:center;height:32px;border-radius:8px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.1);font-size:11.5px;font-weight:520}
.ph-t span.on{background:var(--blue);color:#fff;box-shadow:none}
.ph-w{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:12px 12px 0}.ph-w i{aspect-ratio:1;border-radius:9px;background:repeating-linear-gradient(135deg,#eceef2 0 2px,#f7f8fa 2px 6px)}
.ph-c{position:absolute;z-index:1;width:190px;padding:12px 14px;border-radius:12px;background:#fff;box-shadow:0 0 0 1px rgba(23,24,26,.07),0 2px 4px rgba(23,24,26,.04),0 22px 40px -20px rgba(30,40,110,.4)}
.ph-c b{display:block;font-size:13.5px;font-weight:560;letter-spacing:-.01em}.ph-c span{display:block;margin-top:2px;font-size:12px;line-height:1.3;color:var(--t2)}
.ph-c{display:none}
@media(min-width:1360px){.ph-p>.ph{margin-left:190px}.ph-k{margin-left:190px}
.ph-c{display:block;width:172px;left:calc(50% - 265px)}.ph-c::after{content:"";position:absolute;left:100%;top:50%;width:22px;border-top:1.5px dashed #b3bbcf}
.ph-c.c1{top:24%}.ph-c.c2{top:46%}.ph-c.c3{top:68%}}
.ph-k{margin:18px 0 0;font:500 11px/1 "Geist Mono",monospace;color:var(--t3)}
@media(min-width:1700px){.ph-p>.ph{zoom:1.12}}


/* ============ /answering : the timed thread, the day, the stat ============ */
.tr{width:min(680px,100%)}
.tr-b{padding:22px 22px 8px;display:grid;gap:14px}
.tr-e{display:grid;grid-template-columns:92px minmax(0,1fr);gap:14px;align-items:start}
.tr-e time{padding-top:9px;font:500 11.5px/1 "Geist Mono",monospace;color:var(--t3);white-space:nowrap}
.tr-e p{justify-self:start;margin:0;max-width:26em;padding:9px 13px;border-radius:14px 14px 14px 5px;background:#f1f2f5;font-size:14px;line-height:1.38;text-align:left}
.tr-e.me p{justify-self:end;border-radius:14px 14px 5px 14px;background:var(--blue);color:#fff}
.tr-f{display:grid;grid-template-columns:1fr 1fr;margin-top:14px;border-radius:0 0 12px 12px;background:#101113;color:#8f9197;font-size:12px;text-align:left}
.tr-f div{padding:16px 22px 17px}.tr-f div+div{border-left:1px solid rgba(255,255,255,.1)}.tr-f b{display:block;margin-bottom:3px;color:#fff;font-size:21px;font-weight:600;letter-spacing:-.03em}
@media(min-width:1700px){.ih-pi .tr{zoom:1.12}}
.dy{border-top:1px solid var(--ln)}
.dy-i{border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.dy-t{margin:0;padding:clamp(40px,3.4vw,64px) var(--pad) clamp(18px,1.5vw,28px);font-size:clamp(19px,1.265vw,24px);font-weight:500;letter-spacing:-.02em}
.dy-x{display:flex;justify-content:space-between;padding:0 var(--pad) 10px;font:500 11px/1 "Geist Mono",monospace;color:var(--t3);border-bottom:1px solid var(--ln)}
.dy-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.dy-c{padding:clamp(22px,1.6vw,30px) clamp(20px,1.42vw,27px) clamp(30px,2.3vw,44px);border-left:1px solid var(--ln)}.dy-c:first-child{border-left:0}
.dy-b{position:relative;height:10px;border-radius:5px;background:#eceef2}.dy-b i{position:absolute;top:0;bottom:0;border-radius:5px;background:var(--red)}
.dy-c h3{margin:clamp(22px,1.8vw,34px) 0 0;font-size:clamp(15px,.92vw,17.5px);font-weight:560;letter-spacing:-.012em}
.dy-c p{margin:6px 0 0;font-size:clamp(14px,.84vw,16px);line-height:1.34;color:var(--g2);max-width:18em}
.sn{background:var(--dk);color:#fff}
.sn-i{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:clamp(24px,3vw,56px);border-left:1px solid var(--dl);border-right:1px solid var(--dl);border-bottom:1px solid var(--dl);padding:clamp(56px,5vw,96px) var(--pad)}
.sn b{font-size:clamp(72px,8.4vw,160px);line-height:.9;font-weight:600;letter-spacing:-.06em}
.sn p{margin:0;max-width:17em;font-size:clamp(20px,1.6vw,30px);line-height:1.16;letter-spacing:-.022em;font-weight:500}
.sn span{font:500 clamp(11px,.66vw,12.5px)/1.4 "Geist Mono",monospace;color:#8f9197;text-align:right;max-width:14em}
.ic{border-top:1px solid var(--ln)}
.ic-g{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);border-left:1px solid var(--ln);border-right:1px solid var(--ln)}
.ic-t{padding:clamp(72px,6vw,112px) var(--pad)}.ic-t .st-t{max-width:11em;font-size:clamp(27px,1.95vw,37px)}
.ic ul{list-style:none;margin:0;padding:clamp(56px,4.8vw,92px) var(--pad);border-left:1px solid var(--ln);display:grid;align-content:center}
.ic li{display:flex;gap:12px;align-items:flex-start;padding:clamp(13px,1vw,18px) 0;border-top:1px solid var(--ln);font-size:clamp(15.5px,.95vw,18px);line-height:1.34;font-weight:500;letter-spacing:-.01em}.ic li:first-child{border-top:0}
.ic li svg{flex:none;width:17px;height:17px;margin-top:3px;fill:none;stroke:var(--blue);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}

@media(max-width:1180px){.bo-b{grid-template-columns:repeat(4,minmax(0,1fr));row-gap:12px}.rl-g{grid-template-columns:repeat(2,minmax(0,1fr))}.rl a:nth-of-type(odd){border-left:0}.rl a{border-bottom:1px solid var(--ln)}.dy-g{grid-template-columns:repeat(2,minmax(0,1fr))}.dy-c:nth-child(odd){border-left:0}.dy-c{border-bottom:1px solid var(--ln)}}
@media(max-width:860px){
.rl-g{grid-template-columns:minmax(0,1fr)}.rl a{border-left:0}.rl-t{padding:36px var(--pad) 18px}
.bl-i{padding:72px 20px}.bl p{font-size:28px}
.cp-g,.ic-g{grid-template-columns:minmax(0,1fr)}.cp-t,.ic-t{padding:56px var(--pad) 24px}.cp-t .st-t,.ic-t .st-t{font-size:25px;max-width:none}
.cp-p{border-left:0;border-top:1px solid var(--ln);padding:20px 14px 28px}.cp-r>*{padding:13px 12px;gap:8px}.cp-h span{padding:0 12px}
.ic ul{border-left:0;padding:8px var(--pad) 48px}
.fl-r{padding:13px 14px}
.bo-b{grid-template-columns:repeat(2,minmax(0,1fr))}.ih-pi:has(.bo){padding-left:14px;padding-right:14px}
.ix-r{grid-template-columns:minmax(0,1fr) 16px;gap:2px 12px;padding:14px var(--pad)}.ix-r span{grid-column:1;grid-row:2}.ix-r svg{grid-row:1/3}
.hs-r .hs-p{border-right:0;order:2}.ph-p{padding-top:28px!important}.ph-c{display:none}
.tr-b{padding:16px 14px 6px}.tr-e{grid-template-columns:minmax(0,1fr);gap:4px}.tr-e time{padding-top:0}.tr-e.me time{text-align:right}.tr-f div{padding:14px}.tr-f b{font-size:18px}
.dy-g{grid-template-columns:minmax(0,1fr)}.dy-c{border-left:0}
.sn-i{grid-template-columns:minmax(0,1fr);gap:16px;padding:56px var(--pad)}.sn span{text-align:left}
}
'''
out = pathlib.Path(ROOT) / 'site'
(out / 'assets/light-pages.css').write_text(CSS.strip() + '\n')
V = hashlib.sha1(CSS.encode()).hexdigest()[:8]
PCSS = 'light-pages.css?v=' + V
PAGES = [
    ('everything', 'Everything we build', 'Every build Cinder makes for service businesses, in eight parts of the business. Each one is made for the business it goes into, and your free audit decides which ones you need.', EVERYTHING),
    ('websites', 'Websites', 'A website built for your business that loads fast on a phone, says what you do, and books the estimate from the page.', WEBSITES),
    ('answering', 'Answering', 'Missed calls and new leads get a text back from your business in seconds, even after hours and while you are on a job.', ANSWERING),
]
for slug, title, desc, body in PAGES:
    (out / (slug + '.html')).write_text(page(title, desc, '/' + slug, body, css=PCSS))
print('pages', [p[0] for p in PAGES], V)
