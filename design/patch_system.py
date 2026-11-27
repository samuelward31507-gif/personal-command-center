"""Adds a problem section, a chapter bar and some surface changes to the five hand-made system pages.
Safe to run again: it removes its own blocks first."""
import re, pathlib
from html import escape as e
S = pathlib.Path(__file__).resolve().parent.parent / 'site'
P = {
 'answering': ('a', 'l', 'cards', 'Most leads go to whoever answers first.', 'A missed call, a web form, a message on a lead site. Each one is a person ready to hire, and each one is also contacting someone else. The reply that arrives tonight is usually too late.', ['Missed calls you return after the job', 'Web forms answered the next day', 'Lead-site leads that had already booked']),
 'booking': ('c', 'c', 'rows', 'A lead who says yes still has to get on your calendar.', 'That takes a call back, a few texts about times, and a reminder nobody sends. Every extra step is a chance for them to go quiet.', ['Phone tag to find a time', 'Estimates nobody confirmed', 'Empty driveways']),
 'follow-up': ('b', 'g', 'rows', 'A quote nobody chases is a job you gave away.', 'Most people don’t say no. They get busy, mean to reply, and then book whoever checks in. Following up is easy to skip when you are on a job.', ['Quotes sent and never mentioned again', 'Customers who say they forgot', 'No list of what is still open']),
 'reviews': ('c', 'l', 'rows', 'People pick the name with the reviews.', 'Your work is good and your customers are happy. But nobody asks them, so the shop down the road with more stars gets the call.', ['Great jobs with no review to show for them', 'Asking only when you remember', 'A competitor with more stars and no better work']),
 'websites': ('a', 'c', 'cards', 'Most contractor sites lose the visitor on the first screen.', 'Slow on a phone, no clear next step, and a contact form that goes nowhere. The visitor wanted a price and a time. They leave with neither.', ['A site that takes seconds to load on a phone', 'No way to book from the page', 'Photos and reviews buried or missing']),
}
JS = '''<script>(function(){var c=document.getElementById('chap');if(!c)return;var a=[].slice.call(c.querySelectorAll('nav a')),s=a.map(function(x){return document.getElementById(x.getAttribute('href').slice(1))});function f(){var y=innerHeight*.4,k=-1;s.forEach(function(el,i){if(el&&el.getBoundingClientRect().top<y)k=i});a.forEach(function(x,i){x.classList.toggle('on',i===k)});c.classList.toggle('stuck',c.getBoundingClientRect().top<=65)}addEventListener('scroll',f,{passive:true});f()})();</script>'''
for slug, (hs, sf, var, h2, intro, signs) in P.items():
    f = S / f'{slug}.html'; s = f.read_text(); s = re.sub(r'<!--p2-->.*?<!--/p2-->\n?', '', s, flags=re.S)
    name = re.search(r'<p class="eb">(.*?)</p>', s).group(1)
    for cls, i in (('sx', 'how'), ('inc', 'included'), ('faq', 'questions')): s = re.sub(rf'<section class="{cls}(?=[ "])((?:(?!id=)[^>])*)>', lambda m: m.group(0)[:-1] + f' id="{i}">', s, count=1)
    links = [('problem', 'The problem'), ('how', 'How it works')] + ([('included', 'What’s included')] if 'id="included"' in s else []) + [('questions', 'Questions')]
    if hs == 'a': head = f'<div class="sh-a"><p class="lab"><span><i></i>The problem</span><span>1 of {len(links)}</span></p><h2 class="rv">{e(h2)}</h2><p class="intro">{e(intro)}</p></div>'
    elif hs == 'c': head = f'<div class="sh-c"><p class="c-tag"><b>01</b> The problem</p><h2 class="rv">{e(h2)}</h2><p class="intro">{e(intro)}</p></div>'
    else: head = f'<div class="sh-b"><span class="lab"><i></i>1.0 The problem</span><h2 class="rv">{e(h2)}</h2><p class="intro">{e(intro)}</p></div>'
    body = ('<div class="signs sg-cards">' + ''.join(f'<div><span>Sign {i + 1}</span><p>{e(x)}</p></div>' for i, x in enumerate(signs)) + '</div>') if var == 'cards' else ('<ol class="signs sg-rows">' + ''.join(f'<li><span>{i + 1}</span><p>{e(x)}</p></li>' for i, x in enumerate(signs)) + '</ol>')
    block = f'<!--p2--><div class="chap" id="chap"><div class="wrap"><b>{name}</b><nav aria-label="On this page">{"".join(f"<a href=\"#{i}\">{t}</a>" for i, t in links)}</nav></div></div>\n<section class="sec sf-{sf} hs-{hs} m-problem" id="problem"><div class="wrap">{head}<div class="sb"><p class="sk">How you know you have it</p>{body}</div></div></section>{JS}<!--/p2-->\n'
    k = s.index('<section class="sx'); s = s[:k] + block + s[k:]
    f.write_text(s); print(slug, [i for i, _ in links])
