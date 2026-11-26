#!/usr/bin/env python3
"""The /story page: three chapters, text-led, with drawings that build as the page scrolls.
Run after build_services.py:  python3 design/build_story.py"""
import re, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_services as B
S = B.S
CSS = '''<style>
.st-hero h1{max-width:12ch}
.st{display:grid;grid-template-columns:180px minmax(0,1fr);gap:0 72px;max-width:1360px;margin:0 auto;padding:0 clamp(20px,4vw,56px)}
.st-nav{position:sticky;top:120px;align-self:start;padding-top:calc(var(--sec)*.6);display:grid;gap:14px}
.st-nav a{display:flex;gap:12px;align-items:baseline;font:500 13px/1 Inter,system-ui,sans-serif;color:var(--t3);transition:color .3s}
.st-nav a i{font:500 11px/1 "Geist Mono",ui-monospace,monospace;font-style:normal}
.st-nav a::after{content:"";flex:1;height:1px;background:var(--line2);transform-origin:left;transform:scaleX(.25);transition:transform .6s var(--e),background .3s}
.st-nav a.on{color:var(--t1)}.st-nav a.on::after{transform:none;background:#e0193a}
.st-ch{padding-top:calc(var(--sec)*.6)}
.st-ch+.st-ch{margin-top:calc(var(--sec)*.4);border-top:1px solid var(--line)}
.st-lab{font:500 12px/1 "Geist Mono",ui-monospace,monospace;color:var(--t3);margin-bottom:40px}.st-lab b{color:#e0193a;font-weight:500;margin-right:10px}
.st-h{font-size:clamp(34px,4.6vw,72px);font-weight:600;letter-spacing:-.045em;line-height:1.02;color:var(--t1);max-width:15ch;text-wrap:balance}
.st-h.s{font-size:clamp(28px,3.3vw,50px);max-width:19ch;margin-top:calc(var(--sec)*.5)}
.st-p{margin-top:26px;font-size:clamp(18px,1.5vw,21px);line-height:1.55;color:var(--t2);max-width:33em}
.st-two{display:grid;grid-template-columns:1fr 1fr;gap:1px;margin-top:64px;background:var(--line);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.st-two div{background:#000;padding:36px 34px 40px}.st-two h3{font-size:clamp(22px,2vw,28px);letter-spacing:-.03em;color:var(--t1)}.st-two p{margin-top:12px;font-size:17px;line-height:1.55;color:var(--t2)}
.st-two small{display:block;margin-bottom:22px;font:500 11px/1 "Geist Mono",ui-monospace,monospace;color:var(--t3)}
.st-pull{margin:calc(var(--sec)*.42) 0 0;font-size:clamp(30px,4vw,62px);font-weight:600;letter-spacing:-.045em;line-height:1.04;color:var(--t1);max-width:16ch;text-wrap:balance}
.st-pull em{font-style:normal;color:var(--t3)}
.plate{margin:64px 0 0;border:1px solid var(--line2);border-radius:18px;background:#050506;overflow:hidden}
.plate header,.plate figcaption{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:15px 22px;font:500 12px/1.4 "Geist Mono",ui-monospace,monospace;color:var(--t3)}
.plate header{border-bottom:1px solid var(--line)}.plate header b{font-weight:500;color:var(--t1)}.plate header span:first-child::before{content:"";display:inline-block;width:6px;height:6px;margin-right:10px;background:#e0193a;border-radius:1px;vertical-align:1px}
.plate figcaption{border-top:1px solid var(--line);font-weight:400}
.st-fig{position:relative;height:min(64vh,600px)}
.st-fig canvas,.st-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.st-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:72px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.st-stats li{padding:34px 32px 36px 0}.st-stats li+li{padding-left:32px;border-left:1px solid var(--line)}
.st-stats b{display:block;font-size:clamp(44px,5vw,76px);font-weight:600;letter-spacing:-.05em;line-height:1;color:var(--t1)}.st-stats b span{color:#e0193a}
.st-stats p{margin-top:12px;font-size:15px;line-height:1.5;color:var(--t2);max-width:20em}.st-stats a{display:inline-block;margin-top:10px;font:400 11px "Geist Mono",ui-monospace,monospace;color:var(--t3);border-bottom:1px solid var(--line2)}
.st-five{list-style:none;margin:56px 0 0;padding:0;counter-reset:f}
.st-five li{display:grid;grid-template-columns:64px 220px 1fr;align-items:baseline;gap:0 20px;padding:26px 0;border-top:1px solid var(--line);counter-increment:f}.st-five li:last-child{border-bottom:1px solid var(--line)}
.st-five li::before{content:"0" counter(f);font:500 12px/1 "Geist Mono",ui-monospace,monospace;color:#e0193a}
.st-five b{font-size:clamp(22px,2.1vw,30px);font-weight:600;letter-spacing:-.03em;color:var(--t1)}.st-five span{font-size:18px;line-height:1.5;color:var(--t2)}
.st-method{position:relative;height:340vh;margin-top:64px}
.st-stage{position:sticky;top:0;height:100svh;display:grid;grid-template-rows:minmax(0,min(54svh,500px)) auto;align-content:center;padding:84px 0 40px}
.st-stage .cvh{position:relative;border:1px solid var(--line2);border-radius:18px;background:#050506;overflow:hidden}
.st-steps{position:relative;height:170px;margin-top:30px}
.st-steps div{position:absolute;inset:0;opacity:0;transform:translate3d(0,14px,0);transition:opacity .5s var(--e),transform .7s var(--e)}
.st-method[data-step="0"] .st-steps div:nth-child(1),.st-method[data-step="1"] .st-steps div:nth-child(2),.st-method[data-step="2"] .st-steps div:nth-child(3){opacity:1;transform:none}
.st-steps h3{font-size:clamp(28px,3.2vw,48px);letter-spacing:-.04em;color:var(--t1)}.st-steps h3 i{font:500 12px/1 "Geist Mono",ui-monospace,monospace;font-style:normal;color:#e0193a;margin-right:16px;vertical-align:middle}
.st-steps p{margin-top:12px;font-size:19px;line-height:1.5;color:var(--t2);max-width:34em}
.st-rules{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin-top:calc(var(--sec)*.4);background:var(--line);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.st-rules div{background:#000;padding:30px 28px 34px}.st-rules b{display:block;font-size:20px;letter-spacing:-.02em;color:var(--t1)}.st-rules p{margin-top:8px;font-size:15.5px;line-height:1.5;color:var(--t2)}
.st .ix{margin-top:64px}.st-more{display:inline-block;margin-top:56px}
.st-end{height:calc(var(--sec)*.6)}
@media (max-width:1000px){.st{grid-template-columns:1fr}.st-nav{display:none}}
@media (max-width:760px){.st-two,.st-stats,.st-rules{grid-template-columns:1fr}.st-stats li,.st-stats li+li{padding:26px 0;border-left:0}.st-stats li+li{border-top:1px solid var(--line)}.st-five li{grid-template-columns:40px 1fr}.st-five span{grid-column:2;margin-top:6px;font-size:16px}.st-fig{height:56vh}.plate header,.plate figcaption{padding:12px 16px;font-size:11px}.plate header i{display:none}.st-steps{height:230px}.st-two div{padding:28px 22px}}
</style>'''
def main():
    shell = (S / 'answering.html').read_text(); head = shell[:shell.index('<header')]; hdr = re.search(r'<header class="gnav".*?</header>', shell, flags=re.S).group(0)
    tail = shell[shell.index('<section class="p-close"'):]
    tail = re.sub(r'<script src="/assets/cinder-plates.js"></script>\n<script src="/assets/scenes.js"></script>\n<script type="module" src="/assets/cinder-objects.js"></script>\n<script type="module" src="/assets/cinder-field.js"></script>\n', '<script src="/assets/cinder-story.js" defer></script>\n', tail)
    title, desc = 'Our story', 'Why service businesses lose work they already earned, and what we do about it.'
    head = head.replace('<title>Answering | Cinder Revenue Company</title>', f'<title>{title} | Cinder Revenue Company</title>').replace('https://cinderrevenue.com/answering', 'https://cinderrevenue.com/story').replace('content="Answering | Cinder Revenue Company"', f'content="{title} | Cinder Revenue Company"')
    head = re.sub(r'(name="description" content=")[^"]*', lambda m: m.group(1) + desc, head); head = re.sub(r'(property="og:description" content=")[^"]*', lambda m: m.group(1) + desc, head)
    head = head.replace('</head>', CSS + '\n</head>')
    n = len(B.ALL)
    body = f'''<section class="ov ov-hero svc st-hero" aria-labelledby="h1"><div class="backdrop" data-flow="wave" data-p="{B.ribbon(3)}"></div><div class="wrap">
  <p class="eb">Our story</p><h1 id="h1" class="rv">The phone was never the job.</h1><p class="rv d1">Why service businesses lose work they already earned, and what we do about it.</p>
</div></section>
<div class="st">
<nav class="st-nav" aria-label="Chapters"><a href="#story"><i>01</i>The story</a><a href="#approach"><i>02</i>The approach</a><a href="#builds"><i>03</i>The builds</a></nav>
<div>
<section class="st-ch" id="story" aria-labelledby="h-s1">
  <p class="st-lab"><b>01</b>The story</p>
  <h2 class="st-h rv" id="h-s1">A service business has always been two jobs.</h2>
  <div class="st-two"><div class="rv"><small>Job one</small><h3>The work</h3><p>Fences, roofs, wiring, drains. The thing you are good at, and the reason customers call.</p></div><div class="rv d1"><small>Job two</small><h3>The desk</h3><p>Answering, booking, quoting, chasing, invoicing, asking for the review. None of it is the trade. All of it decides whether you get paid for the trade.</p></div></div>
  <p class="st-pull rv">Most shops only have someone for <em>the first one.</em></p>
  <h2 class="st-h s rv">Then the desk got bigger.</h2>
  <p class="st-p rv">Leads used to come from one phone. Now they come from calls, texts, forms, Facebook, Google and lead sites, at any hour, and each one expects an answer in minutes.</p>
  <figure class="plate"><header><span>Fig. 1</span><b>Six ways in, one person to answer</b><i>Scroll to play</i></header><div class="st-fig" data-story="channels" role="img" aria-label="Six lead sources feed one person, who can answer two at a time. The other four divert into a tray of missed leads."></div><figcaption><span>Past two at a time, the rest go nowhere.</span><span>Illustration</span></figcaption></figure>
  <ul class="st-stats"><li class="rv"><b>78<span>%</span></b><p>of people have taken their business elsewhere after a company didn’t pick up.</p><a href="https://www.callrail.com/blog/missed-calls-cost-businesses-more-than-ever" target="_blank" rel="noopener">CallRail, 2025</a></li><li class="rv d1"><b>21<span>x</span></b><p>more likely to qualify a lead when you reach them within 5 minutes instead of 30.</p><a href="https://www.callrail.com/blog/want-to-successfully-capture-leads-youve-got-5-minutes" target="_blank" rel="noopener">MIT / InsideSales lead response study</a></li><li class="rv d2"><b>69<span>%</span></b><p>of missed business calls never get a callback within 48 hours.</p><a href="https://www.quo.com/blog/small-business-callback-statistics/" target="_blank" rel="noopener">Quo, 16M+ calls, 2026</a></li></ul>
  <h2 class="st-h s rv">And it all lands on someone who is on a roof.</h2>
  <p class="st-p rv">Leads don’t wait for a good time. They come while you are on a job, at dinner, and after you have gone to bed.</p>
  <figure class="plate"><header><span>Fig. 2</span><b>One working day</b><i>Scroll to play</i></header><div class="st-fig" data-story="day" role="img" aria-label="A day from 6 AM to 10 PM plays under a moving time marker. Leads arrive all day. The ones that arrive while the owner is on a job or after hours are marked as missed."></div><figcaption><span>A lead that lands on a busy hour is usually gone by the time you are free.</span><span>Illustration, not measured data</span></figcaption></figure>
  <h2 class="st-h s rv">Five things the desk needs that a busy owner can’t give it.</h2>
  <ol class="st-five"><li class="rv"><b>Speed</b><span>A reply while they still care, not tonight.</span></li><li class="rv"><b>Coverage</b><span>Nights, weekends, and every hour you are on a job.</span></li><li class="rv"><b>Memory</b><span>The quote from three weeks ago. The invoice from last month.</span></li><li class="rv"><b>Handoffs</b><span>Call to calendar to quote to invoice to review. Every step is a place to drop it.</span></li><li class="rv"><b>Time</b><span>Yours. There is only so much of it.</span></li></ol>
  <p class="st-pull rv">None of that is skilled work. <em>All of it costs jobs.</em></p>
</section>
<section class="st-ch" id="approach" aria-labelledby="h-s2">
  <p class="st-lab"><b>02</b>The approach</p>
  <h2 class="st-h rv" id="h-s2">The desk can run without a person now.</h2>
  <p class="st-p rv">AI can read a message, answer it, book the time, draft the estimate, chase the quote and ask for the review. It does not get tired and it does not forget. What it needs is someone to build it around how your business actually works. That is what we do.</p>
  <div class="st-method" data-step="0"><div class="st-stage"><div class="cvh" data-story="method" role="img" aria-label="Twelve steps in a business, from the first call to repeat work. First they are scanned and four weak ones are flagged. Then new parts drop in to replace those four. Then work flows through all twelve."></div>
    <div class="st-steps"><div><h3><i>01</i>Find it first</h3><p>We walk your business from the first call to the review and find where jobs and hours are going. It is free, and you keep the plan.</p></div><div><h3><i>02</i>Build only that</h3><p>We build what the audit calls for and nothing else. No packages. Some businesses need two things, some need twelve.</p></div><div><h3><i>03</i>Then it runs</h3><p>Everything runs in one app on your phone. We watch it, and you see what needs you today.</p></div></div></div></div>
  <div class="st-rules"><div class="rv"><b>No ads</b><p>Everything works on leads and customers you already have.</p></div><div class="rv d1"><b>No packages</b><p>You get what your audit calls for.</p></div><div class="rv d2"><b>Nothing hidden</b><p>Every reply, booking and follow-up is in your app.</p></div></div>
</section>
<section class="st-ch" id="builds" aria-labelledby="h-s3">
  <p class="st-lab"><b>03</b>The builds</p>
  <h2 class="st-h rv" id="h-s3">{n} builds, and room for yours.</h2>
  <p class="st-p rv">The list is where we start, not where we stop. If your business has a job that eats your week and doesn’t need a person, we can probably build it.</p>
  {B.index_block()}
  <a class="btn ghost st-more" href="/everything">See everything we build</a>
</section>
<div class="st-end"></div>
</div></div>
<script>(function(){{var L=[].slice.call(document.querySelectorAll('.st-nav a')),S=L.map(function(a){{return document.querySelector(a.getAttribute('href'))}});function f(){{var k=0;S.forEach(function(s,i){{if(s.getBoundingClientRect().top<innerHeight*.45)k=i}});L.forEach(function(a,i){{a.classList.toggle('on',i===k)}})}}addEventListener('scroll',f,{{passive:true}});f()}})();</script>'''
    (S / 'story.html').write_text(head + hdr + '\n<main id="main">\n' + body + '\n' + tail)
    print('story.html written')
if __name__ == '__main__': main()
