#!/usr/bin/env python3
"""Builds design/mock/home-light.html: approved hero + tools grid + problem statement + first leak block."""
import json, random, re, sys

ROOT = '/home/claude/personal-command-center'  # repo root
import os
HERE = os.path.dirname(os.path.abspath(__file__))
tools = json.load(open(HERE + '/tools.json'))
fav = open(ROOT + '/site/assets/favicon.svg').read()
mark = re.sub(r'<style>.*?</style>', '', fav, flags=re.S).replace('class="m"', 'fill="currentColor"').replace('<svg ', '<svg class="mk" aria-hidden="true" ')

hero = open(ROOT + '/design/mock/hero-light.html').read()
hero_css = re.search(r'<style>(.*?)</style>', hero, re.S).group(1)
hero_body = re.search(r'(<section class="hero">.*?)</body>', hero, re.S).group(1)

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

SUM = ('<div class="cd sm"><div class="sm-r"><span>New callers who got no answer</span><b>3</b></div>'
       '<div class="sm-r"><span><i>&times;</i>Leads that become jobs</span><b>1 in 3</b></div>'
       '<div class="sm-r"><span><i>&times;</i>Average job</span><b>$2,400</b></div>'
       '<div class="sm-r t"><span>Lost a month</span><b>$2,400</b></div></div>')

LEAKS = ['After-hours calls', 'Slow replies', 'Quotes that go quiet', 'Late invoices', 'No reviews']
LK = ('<section class="lk"><div class="w lk-g"><aside class="lk-n"><ul>%s</ul></aside><div class="lk-m">'
      '<article class="lk-b"><div class="lk-s"><p class="bs">The call you never knew about. <span>Saturday, 7:42 PM: a homeowner gets your voicemail and calls the next company on the list.</span></p></div>'
      '<div class="lk-p"><div class="lk-pi">%s%s</div></div>'
      '<div class="lk-f"><b>78%%</b><p>of people have taken their business elsewhere after a company didn&rsquo;t pick up.</p>'
      '<span>CallRail survey of 1,000 consumers, 2025</span></div>'
      '<div class="lk-2"><div><h3>How you&rsquo;d know.</h3><p>Open your call log and count the calls after five and on weekends. '
      'Then count how many got a call back within the hour.</p>%s</div>'
      '<div><h3>What it costs.</h3><p>New callers who got no answer, times how often you win the job, times what a job is worth. '
      'The audit runs it on your numbers.</p>%s</div></div></article></div></div></section>'
      % (''.join('<li%s>%s</li>' % (' class="on"' if i == 0 else '', n) for i, n in enumerate(LEAKS)), CHART, TALLY, LOG, SUM))

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
.lk-n li.on{color:var(--ink)}.lk-n li.on::before{content:"";position:absolute;left:-1px;top:3px;bottom:3px;width:2px;background:var(--blue)}
.lk-s{padding:clamp(84px,5.9vw,112px) var(--pad) clamp(70px,4.9vw,94px)}
.bs{margin:0;max-width:19em;font-size:clamp(19px,1.265vw,24px);line-height:1.16;letter-spacing:-.02em;font-weight:500;color:var(--ink);text-wrap:balance}
.bs span{color:var(--g2)}
.lk-p{background:var(--pn);border-top:1px solid var(--ln);border-bottom:1px solid var(--ln);padding:clamp(52px,3.9vw,74px) 0;display:flex;justify-content:center}
.lk-pi{position:relative;width:812px}
@media(min-width:1700px){.lk-pi,.lg,.sm{zoom:1.1}}
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
.sm-r i{font-style:normal;display:inline-block;width:18px;color:var(--t3)}.sm-r span{padding-left:0}.sm-r:first-child span{padding-left:18px}
.sm-r b{font-weight:560;color:var(--ink);font-variant-numeric:tabular-nums}
.sm-r.t{border-bottom:0;height:54px;color:var(--ink);font-weight:560}.sm-r.t span{padding-left:18px}.sm-r.t b{font-size:19px;letter-spacing:-.02em;color:var(--red);font-weight:600}

/* ---- narrower screens ---- */
html,body{overflow-x:clip}
@media(max-width:1300px){.lk-f{grid-template-columns:auto minmax(0,1fr)}.lk-f span{grid-column:2;text-align:left}.lg,.sm{zoom:.9}}
@media(max-width:1180px){.w,.nav{width:calc(100vw - 64px)}.nav ul{display:none}}
@media(max-width:860px){
.w,.nav{width:calc(100vw - 32px)}:root{--pad:20px}
.tl ul{grid-template-columns:1fr 1fr}.tl li{height:60px;font-size:14px;border-right:1px solid var(--ln)!important;border-bottom:1px solid var(--ln)!important}
.tl li:nth-child(2n){border-right:0!important}.tl li:nth-last-child(-n+2){border-bottom:0!important}
.st-i{padding:72px var(--pad) 48px}.st-t{font-size:26px;line-height:1.14}
.lk-g{grid-template-columns:minmax(0,1fr)}.lk-n{border-right:0;border-bottom:1px solid var(--ln);position:sticky;top:60px;z-index:5;background:rgba(250,250,250,.94);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.lk-n ul{position:static;margin:0;display:flex;gap:22px;overflow-x:auto;padding:0 var(--pad);scrollbar-width:none}.lk-n li{padding:0;height:46px;white-space:nowrap;flex:none}
.lk-n li.on::before{left:0;right:0;top:auto;bottom:-1px;width:auto;height:2px}
.lk-s{padding:52px var(--pad) 44px}.bs{font-size:20px}
.lk-p{padding:20px 16px}.lk-pi{width:100%;zoom:1}.ch{width:100%;padding:16px 14px 12px}.ch-h{display:block}.ch-h em{display:block;padding-top:8px}
.ch-p{grid-template-columns:32px 1fr}.ch-a{height:210px}.ch-a i{width:6px;height:6px;margin:-3px 0 0 -3px}.ch-k{gap:12px}
.ta{position:static;width:100%;margin-top:12px}.ch-t{transform:translate(-82%,13px)}.ch-t::after{left:82%}
.lk-f{grid-template-columns:auto 1fr;padding:22px var(--pad)}.lk-f span{grid-column:1/-1;text-align:left}
.lk-2{grid-template-columns:minmax(0,1fr)}.lk-2>div{padding:36px var(--pad) 44px}.lk-2>div+div{border-left:0;border-top:1px solid var(--ln)}.lg,.sm{zoom:1;margin-top:24px}
.lg-r{gap:9px;padding:0 12px}.lg-r em{font-size:11.5px;padding:0 7px}
}
'''

NAV = ('<header class="top"><div class="nav"><b>%s Cinder Revenue</b><ul><li>What we fix</li><li>The free audit</li><li>The app</li><li>Trades</li><li>Our story</li></ul>'
       '<a class="btn" href="#">Book your free audit</a></div></header>' % mark)
html = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Homepage mockup (light) | Cinder Revenue</title><style>%s%s</style></head><body>%s<div class="heroband">%s</div>%s%s%s</body></html>'
        % (hero_css, CSS, NAV, hero_body, TOOLS, PROB, LK))
for p in (ROOT + '/design/mock/home-light.html', ROOT + '/site/_home-light.html'):
    open(p, 'w').write(html)
print('ok', len(html))
