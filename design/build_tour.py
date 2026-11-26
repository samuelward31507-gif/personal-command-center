# Builds the homepage tour: one source for the app screen (live DOM on the site, and a standalone page that is
# screenshotted for the 3D display's texture), the side windows, and the section's CSS.
import re,os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO=re.search(r'class="brand-mark" viewBox="[^"]*"><path d="([^"]*)"',open(ROOT+'/site/about.html').read()).group(1)
mark=lambda cls='':f'<svg class="{cls}" viewBox="151.04 168 791.63 703.15" aria-hidden="true"><path d="{LOGO}" fill="currentColor"/></svg>'
li=lambda av,b,s,amt='',pill='',k='':f'<div class="li">{f"<i class=av>{av}</i>" if av else ""}<div><b>{b}</b><small>{s}</small></div>{f"<span class=amt>{amt}</span>" if amt else ""}{f"<span class=\"pill {k}\">{pill}</span>" if pill else ""}</div>'
done=lambda b,s,t:f'<div class="li"><i class="ck p" style="--t:{t}s"></i><div><b>{b}</b><small>{s}</small></div></div>'
cells=''.join(f'<div class="tm">{(h-12 if h>12 else h)} {"AM" if h<12 else "PM"}</div>'+'<div class="c"></div>'*5 for h in range(8,16))
col=lambda i:f'left:calc(86px + (100% - 86px)*{i*.2} + 8px);width:calc((100% - 86px)*.2 - 16px)'
APP=f'''<div class="cs">
<aside><div class="biz">{mark()}Cinder Revenue</div><p class="co"><b>Ridgeline Fence</b><span>Example</span></p>
<a class="on">Today</a><a>Inbox<em>2</em></a><a>Calendar</a><a>Quotes</a><a>Money<em>2</em></a>
<p class="mono ft">Sample data</p></aside>
<main class="on"><p class="mono">Thu · Nov 26</p><h4>Good morning, Mike</h4><p class="sub">6 things need you. Everything else is handled.</p>
<div class="row" style="margin-top:30px">
 <div class="card" style="flex:1.25;position:relative"><p class="mono">Won · 30 days</p><p class="big" data-n="37500" data-pre="$">$37,500</p><p class="note">5 jobs, $18,500 collected</p>
  <svg viewBox="0 0 260 110" style="position:absolute;right:24px;bottom:24px;width:230px"><path d="M0 108 L20 80 H60 L75 62 H150 L165 40 H205 L220 14 H260 V110 H0Z" fill="#f0f0f1"/><path d="M0 108 L20 80 H60 L75 62 H150 L165 40 H205 L220 14 H260" fill="none" stroke="#0a0a0b" stroke-width="3" stroke-linejoin="round" pathLength="1" class="spark"/></svg></div>
 <div class="card" style="flex:1"><p class="mono">First reply</p><p class="big" data-n="9" data-suf="s">9s</p><p class="note">41 of 41 leads answered</p><div class="bar"></div></div>
 <div class="card" style="flex:1"><p class="mono">Owed to you</p><p class="big" data-n="10700" data-pre="$">$10,700</p><p class="note"><i class="dot"></i>$6,100 late</p><div class="bar" style="background:linear-gradient(90deg,#d6d6d9 43%,#fff 43%,#fff 44.5%,#0a0a0b 44.5%)"></div></div>
</div>
<div class="row" style="margin-top:22px;flex:1;min-height:0">
 <div class="card" style="flex:1.45;padding-bottom:0"><h5>Needs you<span>most urgent first</span></h5>
  {li('TB','Tom Becker','Asked about financing','$9,400','Reply','k')}{li('LO','Lena Ortiz','Opened her quote 3 times','$7,800','Nudge')}{li('PS','Priya Shah','Estimate done, quote not written','$6,200','Write quote')}{li('HF','Henderson family','Invoice 3 days late','$6,100','Call')}{li('JP','Jen Park','Quote written, not sent','$4,650','Send')}</div>
 <div class="card" style="flex:1;padding-bottom:0"><h5>Handled for you<span>today</span></h5>
  {done('Replied to Tom Becker','6 seconds after he wrote in',.5)}{done('Booked Dana Ruiz','Estimate, Friday 8:00 AM',1.0)}{done('Followed up with Kyle Brandt','Quote, day 5',1.5)}{done('Reminded the Hendersons','Invoice #1042',2.0)}{done('Asked Bill Turner for a review','Job paid in full',2.5)}</div>
</div></main>
<main><p class="mono">Thu · Nov 26</p><h4>Inbox</h4><p class="sub">Every call, text and form, one thread per customer.</p>
<div class="row" style="margin-top:30px;flex:1;min-height:0;margin-bottom:44px">
 <div class="card" style="width:330px;padding:8px 22px">
  <div class="li" style="border:0"><i class="av">TB</i><div><b>Tom Becker</b><small style="color:var(--red)">Your turn</small></div></div>
  {li('PG','Pat Green','Replying for you')}{li('DR','Dana Ruiz','Booked, Fri 8:00 AM')}{li('MH','Marcus Hill','Booked, Mon 3:00 PM')}{li('LO','Lena Ortiz','Quote sent')}</div>
 <div class="card" style="flex:1;display:flex;flex-direction:column;gap:12px"><h5 style="padding-bottom:16px;border-bottom:1px solid var(--line);margin-bottom:8px">Tom Becker<span>Website form</span></h5>
  <p class="bub me a" style="--t:.5s">Hi Tom, this is Ridgeline Fence. What’s the address so I can give you a price range?</p><p class="meta a" style="align-self:flex-end;--t:.7s">Sent for you · 12:40 AM · 6s</p>
  <p class="bub them a" style="--t:1.5s">2210 Aspen Ct, Littleton</p>
  <p class="bub me a" style="--t:2.3s">About 140 ft of cedar with a gate usually runs $5,900 to $7,300. I can measure Tuesday at 10:30 or Wednesday at 3.</p><p class="meta a" style="align-self:flex-end;--t:2.5s">Sent for you · 12:51 AM</p>
  <p class="bub them a" style="--t:3.3s">Tuesday works. Do you offer financing?</p>
  <p class="hand a" style="--t:4.1s"><i class="dot"></i><b>Handed to you.</b> <span>This one needs a person.</span></p></div>
 <div class="card" style="width:300px"><h5 style="margin-bottom:16px">Lead</h5>
  <div class="kv"><span>Stage</span>Estimate booked</div><div class="kv"><span>Source</span>Website form</div><div class="kv"><span>Job</span>140 ft cedar</div><div class="kv"><span>Estimate</span>Tue 10:30 AM</div><div class="kv"><span>Value</span>$9,400</div><div class="kv"><span>First reply</span>6s</div></div>
</div></main>
<main><p class="mono">Nov 30 – Dec 4</p><h4>Calendar</h4><p class="sub">2 estimates and 2 installs this week, booked for you.</p>
<div class="card cal"><div></div><div class="hd">Mon<b>30</b></div><div class="hd">Tue<b>1</b></div><div class="hd">Wed<b>2</b></div><div class="hd">Thu<b>3</b></div><div class="hd">Fri<b>4</b></div>{cells}
<div class="cev" style="{col(1)};top:72px;height:158px"><b>Omar Diaz</b>Install<br><small>230 Main St, Arvada</small></div>
<div class="cev k a cpop" style="{col(1)};top:272px;height:96px;--t:1.9s"><b>Tom Becker</b>Estimate · 10:30 AM</div>
<div class="cev" style="{col(0)};top:592px;height:92px"><b>Marcus Hill</b>Estimate · 3:00 PM</div>
<div class="cev" style="{col(2)};top:152px;height:238px"><b>Carla Mendez</b>Install<br><small>Crew: Luis</small></div>
<div class="cev k" style="{col(3)};top:432px;height:96px"><b>Jen Park</b>Estimate · 1:00 PM</div>
<div class="cev" style="{col(4)};top:72px;height:78px"><b>Material pickup</b><small>8:00 AM</small></div></div></main>
<main><p class="mono">Thu · Nov 26</p><h4>Quotes</h4><p class="sub">$20,200 waiting on 2 answers. Follow-ups go out on their own.</p>
<div class="row" style="margin-top:30px;flex:1;min-height:0;margin-bottom:44px">
 <div class="card" style="width:400px;padding:22px 26px"><p class="mono" style="margin-bottom:14px">Waiting on them</p>
  <div class="li sel"><div><b>Lena Ortiz</b><small>Opened 3 times</small></div><span class="amt">$7,800</span></div>
  <div class="li" style="border:0"><div><b>Kyle Brandt</b><small>Follow-up sent</small></div><span class="amt">$12,400</span></div>
  <p class="mono" style="margin:22px 0 14px">Approved</p>{li('','Carla Mendez','Nov 23','$6,900')}{li('','Omar Diaz','Nov 21','$6,500')}{li('','Grace Lee','Nov 18','$4,300')}</div>
 <div class="card" style="flex:1"><h5>Lena Ortiz<span>160 ft, 6 ft vinyl, 1 gate</span></h5>
  <div class="row" style="margin-top:22px;gap:16px">
   <div class="card" style="flex:1;border:2px solid var(--ink);padding:22px"><p class="mono">Good</p><p class="big" style="font-size:42px">$7,800</p><p class="note">White vinyl privacy</p></div>
   <div class="card" style="flex:1;padding:22px"><p class="mono">Better</p><p class="big" style="font-size:42px">$8,920</p><p class="note">With lattice top</p></div>
   <div class="card" style="flex:1;padding:22px"><p class="mono">Best</p><p class="big" style="font-size:42px">$10,032</p><p class="note">Heavy-duty posts</p></div></div>
  <div class="kv dep"><b>Deposit to hold the date</b><em>$1,500</em></div>
  <p class="mono" style="margin:26px 0 6px">Follow-ups · stop the moment she answers</p>
  <div class="li fu" style="border:0"><i class="ck"></i><b>Sent</b><small>Sun, Nov 22</small></div>
  <div class="li fu"><i class="ck ctk" style="--t:1.4s"></i><b>Day 2</b><small class="a" style="--t:1.6s">Sent Tue, Nov 24</small></div>
  <div class="li fu"><i class="ck o"></i><b>Day 5</b><small>Next, Fri 9:00 AM</small></div>
  <div class="li fu"><i class="ck o"></i><b>Day 10</b><small>Wed, Dec 2</small></div></div>
</div></main>
<main><p class="mono">Thu · Nov 26</p><h4>Money</h4><p class="sub">$10,700 owed to you. Reminders go out on their own.</p>
<div class="row" style="margin-top:30px">
 <div class="card" style="flex:1"><p class="mono">Owed to you</p><p class="big">$10,700</p><p class="note"><i class="dot"></i>$6,100 late</p></div>
 <div class="card" style="flex:1"><p class="mono">Collected · 30 days</p><p class="big">$18,500</p><p class="note">6 payments</p></div>
 <div class="card" style="flex:1"><p class="mono">Deposits held</p><p class="big">$2,500</p><p class="note">2 jobs on the calendar</p></div></div>
<div class="row" style="margin-top:22px;align-items:flex-start">
 <div class="card" style="flex:1.5;padding-bottom:0"><h5>Invoices</h5>
  <div class="li"><div><b>Henderson family</b><small>#1042 · due Nov 22</small></div><span class="pill a" style="margin-left:auto;--t:1.2s"><i class="dot"></i>Late, reminder sent</span><span class="amt w">$6,100</span></div>
  <div class="li"><div><b>Carla Mendez</b><small>#1043 · due Dec 2</small></div><span class="pill" style="margin-left:auto">Part paid</span><span class="amt w">$4,600</span></div>
  <div class="li"><div><b>Bill Turner</b><small>#1041 · paid Oct 29</small></div><span class="pill k" style="margin-left:auto">Paid</span><span class="amt w">$5,000</span></div></div>
 <div class="card" style="flex:1;padding-bottom:0"><h5>Latest payments</h5>
  <div class="li a" style="--t:2s"><i class="ck"></i><div><b>Bill Turner</b><small>Check</small></div><span class="amt">$5,000</span></div>
  <div class="li"><i class="ck"></i><div><b>Carla Mendez</b><small>Card</small></div><span class="amt">$2,300</span></div>
  <div class="li"><i class="ck"></i><div><b>Omar Diaz</b><small>Deposit</small></div><span class="amt">$1,500</span></div></div>
</div></main>
<i class="rip"></i><i class="cur"><svg viewBox="0 0 24 24"><path d="M5 3l14 8.5-6.2 1.3L9.6 19z" fill="#0a0a0b" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></i></div>'''
CS='''.cs{--ink:#0a0a0b;--g1:#4d4e52;--g2:#8a8b90;--g3:#b9babe;--line:#e8e8ea;--paper:#f5f5f6;--red:#c8102e;position:absolute;left:0;top:0;width:1600px;height:1000px;transform-origin:0 0;transform:scale(var(--s,1));background:#fff;color:var(--ink);font:500 21px/1.35 "Inter",system-ui,sans-serif;letter-spacing:-.012em;text-align:left;-webkit-font-smoothing:antialiased}
.cs *{box-sizing:border-box;margin:0;padding:0}
.cs p,.cs b,.cs small,.cs em,.cs span{color:inherit;max-width:none}
.cs em{font-style:normal}
.cs .mono{font:500 14px/1 "Geist Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--g2)}
.cs aside{position:absolute;left:0;top:0;bottom:0;width:252px;background:var(--paper);border-right:1px solid var(--line);padding:34px 18px;display:flex;flex-direction:column}
.cs .biz{display:flex;align-items:center;gap:11px;padding:0 8px 18px;font-weight:600;font-size:21px;letter-spacing:-.025em;white-space:nowrap}
.cs .biz svg{width:32px;height:28px;flex:none}
.cs .co{display:flex;justify-content:space-between;align-items:center;margin:0 0 22px;padding:11px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:16px}
.cs .co b{font-weight:500}.cs .co span{font:500 11px "Geist Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--g2)}
.cs aside a{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border-radius:10px;color:var(--g1);font-size:21px;margin-bottom:2px;transition:background .3s,color .3s}
.cs aside a.on{background:#e9e9eb;color:var(--ink);font-weight:600}
.cs aside a em{font:500 15px "Geist Mono",monospace;font-style:normal;color:var(--g2)}
.cs aside .ft{margin-top:auto;padding:0 12px;white-space:nowrap}
.cs main{position:absolute;left:252px;top:0;right:0;bottom:0;padding:44px 52px 0;display:flex;flex-direction:column;opacity:0;transform:translateY(22px);transition:opacity .3s,transform .3s}
.cs main.on{opacity:1;transform:none;transition:opacity .5s .05s,transform .7s cubic-bezier(.2,.8,.2,1) .05s}
.cs .spark{stroke-dasharray:1}
.cs .bar{transform-origin:0 50%}
.cs .cur,.cs .rip{position:absolute;left:0;top:0;z-index:5;opacity:0;pointer-events:none}
.cs .cur{width:40px;height:40px;transition:transform var(--cd,.5s) cubic-bezier(.3,.7,.2,1),opacity .3s;filter:drop-shadow(0 4px 6px rgba(0,0,0,.25))}
.cs .cur svg{width:100%;height:100%;display:block}
.cs .rip{width:56px;height:56px;margin:-24px 0 0 -22px;border-radius:50%;border:2px solid rgba(10,10,11,.5)}
.cs h4{font-size:50px;font-weight:600;letter-spacing:-.035em;line-height:1.1;margin-top:14px}
.cs .sub{font-size:23px;color:var(--g1);margin-top:8px;font-weight:400}
.cs .row{display:flex;gap:22px}
.cs .card{border:1px solid var(--line);border-radius:18px;background:#fff;padding:26px 28px}
.cs .big{font-size:58px;font-weight:600;letter-spacing:-.04em;line-height:1;margin-top:16px}
.cs .note{font-size:19px;color:var(--g1);margin-top:10px;font-weight:400}
.cs .dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--red);margin-right:9px;vertical-align:middle}
.cs .bar{height:8px;border-radius:4px;background:var(--ink);margin-top:18px}
.cs h5{font-size:23px;font-weight:600;letter-spacing:-.02em;margin-bottom:18px}
.cs h5 span{font-weight:400;color:var(--g2);font-size:19px;margin-left:10px}
.cs .li{display:flex;align-items:center;gap:16px;padding:17px 0;border-top:1px solid var(--line)}
.cs .li.sel{background:var(--paper);margin:0 -14px;padding:16px 14px;border-radius:12px;border:0}
.cs .li.fu{padding:12px 0}.cs .li.fu small{margin-left:auto}
.cs .av{width:42px;height:42px;border-radius:50%;background:var(--paper);border:1px solid var(--line);display:grid;place-items:center;font-size:14px;font-style:normal;color:var(--g1);flex:none}
.cs .li b{display:block;font-size:21px;font-weight:600}.cs .li small{display:block;font-size:18px;color:var(--g1);font-weight:400}
.cs .amt{margin-left:auto;font:500 19px "Geist Mono",monospace;letter-spacing:0}.cs .amt.w{margin-left:22px;width:90px;text-align:right}
.cs .pill{border:1px solid #d6d6d9;border-radius:99px;padding:8px 18px;font-size:17px;font-weight:500;white-space:nowrap}
.cs .pill.k{background:var(--ink);color:#fff;border-color:var(--ink)}
.cs .ck{width:26px;height:26px;border-radius:50%;background:var(--ink);flex:none;display:grid;place-items:center}
.cs .ck::after{content:"";width:9px;height:5px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg) translateY(-1px)}
.cs .ck.o{background:none;border:2px solid var(--g3)}.cs .ck.o::after{display:none}
.cs .bub{max-width:76%;padding:15px 20px;border-radius:20px;font-size:20px;line-height:1.4;font-weight:400}
.cs .bub.me{background:var(--ink);color:#fff;align-self:flex-end;border-bottom-right-radius:6px}
.cs .bub.them{background:var(--paper);border:1px solid var(--line);align-self:flex-start;border-bottom-left-radius:6px}
.cs .meta{font:500 13px "Geist Mono",monospace;color:var(--g2);letter-spacing:.04em;margin:-4px 4px 6px}
.cs .hand{margin-top:auto;border:1px solid var(--line);border-radius:14px;padding:15px 18px;font-size:19px}.cs .hand span{color:var(--g1);font-weight:400}
.cs .kv{display:flex;justify-content:space-between;padding:14px 0;border-top:1px solid var(--line);font-size:19px}
.cs .kv span{color:var(--g2);font:500 13px "Geist Mono",monospace;letter-spacing:.08em;text-transform:uppercase;align-self:center}
.cs .kv.dep{margin-top:22px;border-bottom:1px solid var(--line);font-size:21px;padding:18px 0}.cs .kv.dep b{font-weight:600}.cs .kv.dep em{font:500 19px "Geist Mono",monospace}
.cs .cal{margin:30px 0 44px;flex:1;padding:0;display:grid;grid-template-columns:86px repeat(5,1fr);grid-template-rows:64px repeat(8,1fr);position:relative;overflow:hidden}
.cs .c{border-left:1px solid var(--line);border-top:1px solid var(--line)}
.cs .hd{display:flex;align-items:center;padding:0 18px;font-size:19px;color:var(--g1);border-left:1px solid var(--line)}.cs .hd b{color:var(--ink);margin-left:8px}
.cs .tm{border-top:1px solid var(--line);font:500 13px "Geist Mono",monospace;color:var(--g2);padding:10px 12px;text-align:right}
.cs .cev{position:absolute;border-radius:12px;padding:12px 16px;font-size:18px;line-height:1.3;background:var(--paper);border:1px solid var(--line)}
.cs .cev b{display:block;font-size:19px}.cs .cev.k{background:var(--ink);color:#fff;border:0}.cs .cev small{font-size:16px;opacity:.7;font-weight:400}
'''
open(ROOT+'/design/cinder-screens.html','w').write(f'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:"Inter";src:url(/site/assets/fonts/InterVariable.woff2) format("woff2");font-weight:100 900}}
@font-face{{font-family:"Geist Mono";src:url(/site/assets/fonts/GeistMono-Variable.ttf);font-weight:100 900}}
body{{margin:0;width:1600px;height:1000px;overflow:hidden;position:relative}}
{CS}</style></head><body>{APP}</body></html>''')

# side windows: what the customer sees (a text thread) and what the owner sees (notifications)
def phone(who,name,rows):
    h=''
    for kind,txt,t in rows:
        if kind=='dots': h+=f'<p class="dots" style="--t:{t}s"><i></i><i></i><i></i></p>'
        else: h+=f'<p class="{kind} a" style="--t:{t}s">{txt}</p>'
    return f'<figure class="sat l"><figcaption>What {who} sees</figcaption><div class="ph"><p class="ph-h"><i>R</i><b>{name}</b><span>Text message</span></p>{h}</div></figure>'
def notes(items):
    h=''.join(f'<div class="nt a" style="--t:{t}s">{mark("nt-i")}<div><p class="nt-h">Cinder<span>{when}</span></p><b>{b}</b><p>{p}</p></div></div>' for b,p,when,t in items)
    return f'<figure class="sat r"><figcaption>What you see</figcaption><div class="nts">{h}</div></figure>'
RF='Ridgeline Fence'
SETS=[
 ('',notes([('Lead answered','Tom Becker, website form. Replied in 6 seconds.','12:40 AM',.5),('Estimate booked','Dana Ruiz, Friday 8:00 AM. It’s on your calendar.','8:02 AM',1.3),('Reminder sent','Henderson family, invoice #1042.','9:15 AM',2.1)])),
 (phone('Tom',RF,[('sys','Website form sent · 12:40 AM',.4),('dots','',.9),('in','Hi Tom, this is Ridgeline Fence. What’s the address so I can give you a price range?',1.9),('sys','6 seconds later',2.3)]),
  notes([('Lead answered','Tom Becker, website form. Replied in 6 seconds. Nothing for you to do.','now',2.8)])),
 (phone('Tom',RF,[('in','I can measure Tuesday at 10:30 or Wednesday at 3.',.4),('out','Tuesday works.',1.3),('dots','',1.8),('in','You’re booked for Tuesday at 10:30. See you then.',2.8)]),
  notes([('Estimate booked','Tom Becker, Tue Dec 1 at 10:30 AM. 2210 Aspen Ct, Littleton.','now',3.3)])),
 (phone('Lena',RF,[('sys','Day 2 · Tuesday',.4),('dots','',.8),('in','Hi Lena, any questions on the fence quote? Happy to walk you through the three options.',1.8),('sys','Day 5 goes out Friday at 9 AM',2.4)]),
  notes([('Lena opened her quote','Third time today. Good moment to call.','now',2.9)])),
 (phone('the customer',RF,[('sys','1 day past due',.4),('dots','',.8),('in','Hi, a quick reminder that invoice #1042 for $6,100 was due Nov 22. You can pay here.',1.8),('link','Pay invoice #1042',2.3)]),
  notes([('Payment received','$5,000 from Bill Turner, invoice #1041.','now',2.8),('Review asked for','Bill Turner got the link to leave one.','now',3.6)]))]
STEPS=[('Overview','You only see what needs you.','Six things today. Everything else was handled before you opened it.'),
 ('Answers','Every lead gets an answer in seconds.','Calls, texts, forms and lead sites. Day or night, the reply goes out from your number.'),
 ('Books','Estimates land on your calendar.','Leads pick from times you’re actually free. You just show up.'),
 ('Follows up','Every quote gets chased.','Day 2, day 5, day 10, then monthly. It stops the moment they answer.'),
 ('Gets paid','Invoices chase themselves.','Reminders go out with your own pay link until it’s settled.')]
SEC=f'''<section id="tour" class="tour" aria-label="What Cinder does on its own"><div class="tour-pin">
  <canvas class="tour-cv" aria-hidden="true"></canvas>
  <div class="tour-head"><h2>It does the work. You do the jobs.</h2><p>If it doesn’t need a person, a person shouldn’t be doing it.</p></div>
  <div class="tour-screen" data-tex="/assets/screens/scr-today-2400.webp" role="img" aria-label="The Cinder app for an example fence company, sample data">{APP}</div>
  <div class="tour-caps">{''.join(f'<article><h3>{t}</h3><p>{d}</p></article>' for l,t,d in STEPS)}</div>
  <div class="tour-sats">{''.join(f'<div class="sat-set">{l}{r}</div>' for l,r in SETS)}</div>
  <nav class="tour-nav" aria-label="What it does">{''.join(f'<button type="button">{l}</button>' for l,*_ in STEPS)}</nav>
  <p class="tour-note">Example business, sample data.</p>
  <div class="tour-prog"><i></i></div>
</div></section>
'''
CSS='''/* CRM tour */
.tour{position:relative;height:820vh;z-index:2;background:#000}
.tour-pin{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden}
.tour-cv{position:absolute;inset:0;width:100%;height:100%;display:block}
.tour-head,.tour-caps article{position:absolute;left:0;right:0;top:92px;text-align:center;padding:0 24px;pointer-events:none}
.tour-head h2,.tour-caps h3{font-size:clamp(28px,3.2vw,46px);line-height:1.08;letter-spacing:-.035em;font-weight:600;color:#f2f1ee}
.tour-head p,.tour-caps p{margin:12px auto 0;max-width:34em;font-size:clamp(15px,1.25vw,18px);line-height:1.5;color:rgba(242,241,238,.62)}
.tour-caps article{opacity:0;transform:translateY(14px);transition:opacity .16s,transform 0s .16s}
.touring .tour-caps article.on{opacity:1;transform:none;transition:opacity .5s .2s,transform .7s cubic-bezier(.2,.8,.2,1) .2s}
.tour-screen{position:absolute;left:0;top:0;opacity:0;overflow:hidden;border-radius:3px;background:#fff;will-change:transform,width,height;transition:border-radius .5s,box-shadow .5s}
.tour-screen.flat{border-radius:14px;box-shadow:0 0 0 1px rgba(255,255,255,.1),0 50px 140px -40px #000}
'''+CS+'''@keyframes csIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes csPop{0%{opacity:0;transform:scale(.86)}60%{opacity:1;transform:scale(1.03)}100%{opacity:1;transform:none}}
@keyframes csPulse{0%{box-shadow:0 0 0 0 rgba(10,10,11,.45)}100%{box-shadow:0 0 0 16px rgba(10,10,11,0)}}
@keyframes csTick{0%,99%{background:none;box-shadow:inset 0 0 0 2px #b9babe}100%{background:#0a0a0b;box-shadow:none}}
.touring .cs main.on .a{animation:csIn .5s cubic-bezier(.2,.8,.2,1) var(--t,0s) both}
.touring .cs main.on .a.cpop{animation:csPop .6s cubic-bezier(.2,.8,.2,1) var(--t,0s) both}
.touring .cs main.on .ck.p{animation:csPulse .9s ease-out var(--t,0s) 1}
.touring .cs main.on .spark{animation:csDraw 1.3s cubic-bezier(.4,0,.2,1) .25s both}
.touring .cs main.on .bar{animation:csBar 1s cubic-bezier(.2,.8,.2,1) .35s both}
@keyframes csDraw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes csBar{from{transform:scaleX(0)}to{transform:none}}
@keyframes csRip{from{opacity:.9;transform:var(--at) scale(.3)}to{opacity:0;transform:var(--at) scale(1.25)}}
.touring .cs .cur{opacity:1}
.cs .rip.go{animation:csRip .55s ease-out}
.touring .cs main.on .ck.ctk{animation:csTick var(--t,1s) linear both}
.sat{position:absolute;left:0;top:0;margin:0;pointer-events:none;opacity:0;transition:opacity .35s}
.touring .sat-set.on .sat{opacity:1}
.sat figcaption{font:500 11px/1 "Geist Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:rgba(242,241,238,.5);margin-bottom:12px}
.sat.r figcaption{text-align:right}
@keyframes satIn{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}
@keyframes satDots{0%{opacity:0;max-height:0;padding:0 14px;margin-top:0}12%,82%{opacity:1;max-height:40px;padding:12px 14px;margin-top:8px}100%{opacity:0;max-height:0;padding:0 14px;margin-top:0}}
@keyframes satBlink{0%,100%{opacity:.3}50%{opacity:1}}
.sat .a{opacity:0}
.touring .sat-set.on .a{animation:satIn .55s cubic-bezier(.2,.8,.2,1) var(--t,0s) both}
@keyframes satNote{0%{opacity:0;transform:translateX(46px) scale(.95)}60%{opacity:1;transform:translateX(-5px)}100%{opacity:1;transform:none}}
.touring .sat-set.on .nt.a{animation:satNote .7s cubic-bezier(.2,.8,.2,1) var(--t,0s) both}
@keyframes satBanner{0%{opacity:0;transform:translateY(-26px) scale(.96)}9%,80%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-18px) scale(.97)}}
@keyframes satFloat{from{transform:translateY(-5px)}to{transform:translateY(5px)}}
.touring .sat-set.on .ph{animation:satFloat 5.5s ease-in-out infinite alternate}
.touring .sat-set.on .nts{animation:satFloat 6.5s ease-in-out -2s infinite alternate}
@keyframes satPhone{from{opacity:0;transform:translateX(-30px) scale(.95)}to{opacity:1;transform:none}}
.touring .sat-set.on .sat.l{animation:satPhone .7s cubic-bezier(.2,.8,.2,1) both}
.tour-prog{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.06);opacity:0;transition:opacity .4s}
.touring .tour-prog{opacity:1}
.tour-prog i{display:block;height:100%;background:#c8102e;transform-origin:0 50%;transform:scaleX(var(--p,0))}
.ph{padding:14px 14px 18px;border-radius:24px;background:#fff;color:#0a0a0b;box-shadow:0 0 0 1px rgba(0,0,0,.08),0 34px 80px -24px rgba(0,0,0,.7),0 8px 24px -8px rgba(0,0,0,.35);display:flex;flex-direction:column}
.ph p,.ph b,.ph span{color:inherit;max-width:none;margin-bottom:0}
.ph-h{display:flex;align-items:center;gap:9px;padding:2px 4px 12px;margin-bottom:6px;border-bottom:1px solid #ececee;font-size:13px}
.ph-h i{width:26px;height:26px;border-radius:50%;background:#0a0a0b;color:#fff;display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:600}
.ph-h b{font-weight:600}.ph-h span{margin-left:auto;font-size:11px;color:#8a8b90}
.ph .sys{align-self:center;margin-top:10px;font-size:11px;color:#8a8b90}
.ph .in,.ph .out,.ph .dots,.ph .link{max-width:88%;margin-top:8px;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.4}
.ph .in{align-self:flex-start;background:#efeff1;border-bottom-left-radius:5px}
.ph .out{align-self:flex-end;background:#0a0a0b;color:#fff;border-bottom-right-radius:5px}
.ph .link{align-self:flex-start;border:1px solid #dcdce0;font-weight:600;font-size:13px}
.ph .link::after{content:"";display:inline-block;width:6px;height:6px;margin-left:8px;border-top:1.5px solid;border-right:1.5px solid;transform:rotate(45deg) translateY(-1px)}
.ph .dots{align-self:flex-start;display:flex;gap:4px;background:#efeff1;border-bottom-left-radius:5px;overflow:hidden;opacity:0;max-height:0;padding:0 14px;margin-top:0}
.ph .dots i{width:7px;height:7px;border-radius:50%;background:#8a8b90;animation:satBlink 1s infinite}.ph .dots i:nth-child(2){animation-delay:.15s}.ph .dots i:nth-child(3){animation-delay:.3s}
.touring .sat-set.on .dots{animation:satDots 1s linear var(--t,0s) both}
.nt{display:flex;gap:12px;align-items:flex-start;padding:13px 14px;margin-bottom:10px;border-radius:20px;background:rgba(30,30,33,.86);-webkit-backdrop-filter:blur(22px) saturate(1.4);backdrop-filter:blur(22px) saturate(1.4);box-shadow:0 0 0 1px rgba(255,255,255,.13),0 30px 70px -22px rgba(0,0,0,.9);text-align:left}
.nt-i{flex:none;width:38px;height:38px;padding:8px 7px;border-radius:10px;background:#f2f1ee;color:#0a0a0b}
.nt-h{display:flex;justify-content:space-between;font:500 10.5px/1 "Geist Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:rgba(242,241,238,.5);margin-bottom:6px}
.nt p{max-width:none}
.nt b{display:block;font-size:14.5px;font-weight:600;color:#f2f1ee;letter-spacing:-.01em}
.nt p:not(.nt-h){margin-top:2px;font-size:13.5px;line-height:1.4;color:rgba(242,241,238,.68)}
.nt>div{flex:1;min-width:0}
.tour-nav{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);display:flex;gap:2px;padding:4px;border-radius:999px;background:rgba(18,18,20,.92);box-shadow:0 0 0 1px rgba(255,255,255,.09);opacity:0;transition:opacity .4s}
.touring .tour-nav{opacity:1}
.tour-nav button{padding:8px 15px;border-radius:999px;font-size:13px;font-weight:500;white-space:nowrap;color:rgba(242,241,238,.55);transition:color .2s,background .2s}
.tour-nav button[aria-current=step]{background:#f2f1ee;color:#0a0a0b}
.tour-note{position:absolute;right:28px;bottom:32px;font-size:12px;color:rgba(242,241,238,.38);opacity:0;transition:opacity .4s}
.touring .tour-note{opacity:1}
@media (max-width:859px){
  .tour{height:720vh}
  .tour-head,.tour-caps article{top:78px;padding:0 16px}
  .tour-head h2,.tour-caps h3{font-size:25px}.tour-head p,.tour-caps p{font-size:14px;margin-top:8px}
  .sat.r figcaption,.cs .cur,.cs .rip{display:none}
  .sat.r .nt:nth-child(n+2){display:none}
  .sat.r .nt{margin:0;background:rgba(24,24,27,.94);box-shadow:0 0 0 1px rgba(255,255,255,.14),0 18px 40px -12px rgba(0,0,0,.6)}
  .touring .sat-set.on .nt.a{animation:satBanner 4.6s cubic-bezier(.2,.8,.2,1) var(--t,0s) both}
  .touring .sat-set.on .nts,.touring .sat-set.on .ph{animation:none}
  .tour-nav{bottom:14px;max-width:calc(100% - 20px);overflow-x:auto}.tour-nav button{padding:7px 11px;font-size:12px}
  .tour-note{display:none}
}
@media (prefers-reduced-motion:reduce){.touring .cs *,.touring .sat,.touring .sat *{animation:none!important}.cs .cur{display:none}.sat .a{opacity:1}.ph .dots{display:none}}
'''
open(ROOT+'/site/assets/tour.css','w').write(CSS.replace('/* CRM tour */\n',''))
p=ROOT+'/site/software.html';h=open(p).read()
if 'id="tour"' in h: h=re.sub(r'<section id="tour".*?</div></section>\n',lambda m:SEC,h,count=1,flags=re.S)
else: h=re.sub(r'<section class="sx wait" data-scene="CinderApp".*?</section>',lambda m:SEC,h,count=1,flags=re.S)
if 'tour.css' not in h: h=h.replace('<link rel="stylesheet" href="/assets/nav.css">','<link rel="stylesheet" href="/assets/nav.css"><link rel="stylesheet" href="/assets/tour.css">',1)
if 'cinder-tour.js' not in h: h=h.replace('</body>','<script type="module" src="/assets/cinder-tour.js"></script>\n</body>',1)
open(p,'w').write(h);print('ok',h.count('id="tour"'),'tour.css' in h)
