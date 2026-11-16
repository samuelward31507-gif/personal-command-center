# Builds the website pages in site/ from source.html (the single long page all sections live in).
# Run: python3 tools/site/gen.py   Edit a section in source.html, then run this to update every page that uses it.
import re, io
S="/home/claude/personal-command-center/site/"
T="/home/claude/personal-command-center/tools/site/"
import os
src=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"source.html")).read()
def sec(id_, tag="section"):
    m=re.search(r'<%s[^>]*id="%s"[\s\S]*?</%s>\n' % (tag,id_,tag), src); assert m, id_; return m.group(0)
head=src[:src.index('<body>')]
header=re.search(r'<header class="nav"[\s\S]*?</header>\n', src).group(0)
footer=re.search(r'<footer class="foot">[\s\S]*?</footer>\n', src).group(0)
tail=src[src.index('<a id="stickybook"'):]
hero=sec("top"); works=re.search(r'<div class="works"[\s\S]*?</div></div>\n</div>\n', src).group(0)
problem=sec("problem"); compare=sec("compare"); tryit=sec("try"); features=sec("features"); how=sec("how-start"); plans=sec("plans"); founder=sec("founder"); faq=sec("faq"); book=sec("book")
bento=re.search(r'<div class="bento">[\s\S]*?</div>\n    (?=<p class="try-line">)', features).group(0)
def ui(key):  # the mini product card for one feature
    m=re.search(r'<article class="bx" data-bx="%s">\s*<div class="bx-vis">(<div class="ui">[\s\S]*?</div>)</div>\s*<div class="bx-copy">' % key, bento); assert m, key; return m.group(1)
qa={m.group(1):m.group(0) for m in re.finditer(r'<details><summary>([^<]*)</summary>[\s\S]*?</details>', faq)}
def faqsec(title, keys, tint=False):
    return '''<section class="sec%s" id="faq">
  <div class="wrap faq">
    <div class="faq-side">
      <h2>%s</h2>
      <p>Something else on your mind? Ask it on the call, or write to <a href="mailto:sam.cinderrevenue@gmail.com">sam.cinderrevenue@gmail.com</a>.</p>
      <a class="btn btn-go btn-sm" href="#book">Book a free 15-minute call</a>
    </div>
    <div class="qa">
      %s
    </div>
  </div>
</section>
''' % (" sec-tint" if tint else "", title, "\n      ".join(qa[k] for k in keys))
def tint(s, on): 
    s=re.sub(r'class="sec sec-tint( book)?"', r'class="sec\1"', s, count=1)
    return re.sub(r'class="sec( book)?"', r'class="sec sec-tint\1"', s, count=1) if on else s

NAV=[("/product","Product"),("/how-it-works","How it works"),("/pricing","Pricing"),("/demo","Demo")]
def nav(active):
    links="".join('<a href="%s"%s>%s</a>' % (h,' aria-current="page"' if h==active else "",l) for h,l in NAV)
    h=re.sub(r'<nav class="nav-links" aria-label="Main">.*?</nav>', '<nav class="nav-links" aria-label="Main">'+links+'</nav>', header)
    h=h.replace('<div class="nav-r">','<div class="nav-r"><button type="button" class="nav-menu" aria-expanded="false" aria-controls="nav-sheet" aria-label="Menu"><i></i><i></i></button>')
    h=h.replace('</div></header>','</div><div class="nav-sheet" id="nav-sheet" hidden>'+links+'<a href="/book">Book a call</a></div></header>')
    return h
foot=re.sub(r'<nav aria-label="Footer">.*?</nav>', '<nav aria-label="Footer"><a href="/product">Product</a><a href="/how-it-works">How it works</a><a href="/pricing">Pricing</a><a href="/demo">Demo</a><a href="/book">Book a call</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>', footer)
def page(path, active, title, desc, body, canonical):
    h=re.sub(r'<title>.*?</title>', '<title>%s</title>' % title, head)
    h=re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % desc, h)
    h=re.sub(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="https://cinderrevenue.com%s">' % canonical, h)
    h=re.sub(r'<meta property="og:url" content="[^"]*">', '<meta property="og:url" content="https://cinderrevenue.com%s">' % canonical, h)
    out=h+'<body>\n<a class="skip" href="#main">Skip to content</a>\n\n'+nav(active)+'\n<main id="main">\n\n'+body+'\n</main>\n\n'+foot+'\n'+tail
    open(S+path,"w").write(out)

def phead(h1, lede, cta2=None, extra=""):
    return '''<section class="phero">
  <div class="wrap hero-in">
    <h1 class="split">%s</h1>
    <p class="lede">%s</p>
    <div class="hero-ctas"><a class="btn btn-go" href="#book">Book a free 15-minute call</a>%s</div>%s
  </div>
</section>
''' % (h1, lede, ('<a class="btn btn-ghost" href="%s">%s</a>' % cta2) if cta2 else "", extra)
def more(text, href, label): return '<p class="try-line">%s <a href="%s">%s</a></p>' % (text, href, label)

# ---------- Home: the pain, the product in motion, the proof points, then where to go next ----------
feat_home=features.replace(re.search(r'<p class="try-line">.*?</p>', features).group(0), more("Each of these is set up around your business.", "/product", "See the full product"))
how_home=how.replace('<div class="start-cta"><a class="btn btn-go" href="#book">Book a free 15-minute call</a><span>No pressure. If it’s not a fit, I’ll tell you.</span></div>', '<div class="start-cta"><a class="btn btn-go" href="#book">Book a free 15-minute call</a><span>No pressure. If it’s not a fit, I’ll tell you. <a href="/how-it-works">See how setup works</a></span></div>')
price_strip='''<section class="sec" id="pricing-strip">
  <div class="wrap">
    <div class="strip">
      <div><h2 class="split">Two plans. Nothing monthly until we book your first appointment.</h2></div>
      <div class="strip-r">
        <a class="strip-plan" href="/pricing"><span>Never Miss a Lead</span><b>$697<small>/month</small></b><em>Every lead answered and booked</em></a>
        <a class="strip-plan main" href="/pricing"><span>Book &amp; Close</span><b>$1,497<small>/month</small></b><em>Plus every quote chased to a yes or a no</em></a>
        <a class="btn btn-line btn-sm" href="/pricing">See pricing and guarantees</a>
      </div>
    </div>
  </div>
</section>
'''
home=hero+"\n"+works+"\n"+tint(problem,True)+"\n"+tint(compare,False)+"\n"+tint(tryit,True)+"\n"+tint(feat_home,False)+"\n"+tint(how_home,True)+"\n"+price_strip+"\n"+tint(founder,True)+"\n"+tint(book,False)
page("index.html","/","Cinder Revenue Company · Every missed call texted back in 10 seconds", "When you're on a job, every missed call, web form and Facebook lead gets a text back in about 10 seconds, gets your price range and books the estimate. Then every quote gets followed up until it's a yes or a no. No contract.", home, "/")

# ---------- Product ----------
def prow(n, key, k, h, p, bullets, vis, flip=False, tag=""):
    return '''    <div class="prow%s">
      <div class="prow-copy"><p class="prow-k"><span>%d</span>%s%s</p><h2>%s</h2><p class="lede">%s</p><ul class="ticks">%s</ul></div>
      <div class="prow-vis"%s>%s</div>
    </div>
''' % (" flip" if flip else "", n, k, (' <em>%s</em>' % tag) if tag else "", h, p, "".join("<li>%s</li>" % b for b in bullets), (' data-bx="%s"' % key) if key else "", vis)
react_ui='''<div class="ui"><div class="ui-h"><span>Old lead · quoted in March</span><em>Reactivation</em></div><div class="lang"><p class="b-out">Hi Carla, it’s Mike with Ridgeline Fence. Still thinking about that backyard fence? I’ve got openings next week if you want a fresh number.</p><p class="b-in">Actually yes. Can you come Thursday?</p></div></div>'''
ctrl='''<section class="sec sec-tint" id="control">
  <div class="wrap">
    <div class="head-c"><h2 class="split">It works for you. You stay in charge.</h2><p class="lede">Cinder handles the first five minutes of every lead. Anything that needs a person comes to you.</p></div>
    <ol class="start four">
      <li><h3>You approve the wording</h3><p>Every message is written with you before it goes live, in your voice.</p></li>
      <li><h3>Jump in any time</h3><p>Reply to any conversation and the automation steps back.</p></li>
      <li><h3>Hard questions come to you</h3><p>Price negotiation, complaints and anything unusual are handed straight over.</p></li>
      <li><h3>Keep what you use</h3><p>Same phone number. Works alongside Jobber, Housecall Pro and Google Calendar.</p></li>
    </ol>
  </div>
</section>
'''
product=phead("Everything between the call and the check.", "Six jobs your business needs done on every lead, done in seconds, in your wording. Here is each one, and exactly what it does.", ("/demo","Try it on your business"))+'''<section class="sec prows" id="product">
  <div class="wrap">
'''+prow(1,"timer","Answer","Every lead gets a text in about 10 seconds.","Most callers who hit voicemail call the next company. Cinder texts them back from your business before they do.",["Missed calls, web forms, Facebook, Angi and Thumbtack leads","Sent from your business number, in your words","Day, night and weekends","English and Spanish"],ui("timer"))+prow(2,"qual","Qualify","Your questions, asked before you drive out.","It asks what you’d ask on every job and sends your price range, so the people you meet are serious and in your area.",["The questions you choose for your trade","Your price range sent up front","Out-of-area and wrong-fit jobs filtered out","Real price talk comes straight to you"],ui("qual"),True)+prow(3,"cal","Book","The estimate lands on your calendar.","They pick from your real open times. You get one text with the job, and they get a reminder.",["Reads your Google Calendar so it never double-books","Reminder the day before","No-shows get a rebooking text","One text to you with the job details"],ui("cal"))+prow(4,"chase","Follow up","Every quote chased to a yes or a no.","Send a quote with one text and the follow-up starts on its own. It stops the moment they reply.",["Follow-ups on days 2, 5, 10 and 21","“Too expensive” gets your financing or a smaller option","Launch revival of your open quotes from the last 90 days","Review request after every finished job"],ui("chase"),True,"Book &amp; Close")+prow(5,"","Reactivate","Old leads and past customers, worked every month.","The people who already know you are the easiest jobs to win.",["Leads that never booked get three friendly texts, then another round each quarter","Past customers hear from you when they’re due","Every reply is answered and booked like a new lead"],react_ui,False,"Book &amp; Close")+prow(6,"stars","Reviews","Five-star reviews without asking in person.","The morning after a job is done and paid, the customer gets a text with your Google review link.",["Sent automatically after finished jobs","Your Google link, one tap","More reviews means more calls from Google"],ui("stars"),True)+'''  </div>
</section>
'''+ctrl+faqsec("Product questions.",["Will customers know it’s automated?","Can I jump into a conversation?","What about family and suppliers?","Do I have to change my software?","Does it answer calls by voice?","Does my number change?"])+tint(book,True)
page("product.html","/product","Product · Cinder Revenue Company","What Cinder does on every lead: answers in about 10 seconds, qualifies with your questions, books the estimate on your calendar, follows up every quote, and asks for the review.", product, "/product")

# ---------- How it works ----------
tl='''<section class="sec" id="timeline">
  <div class="wrap">
    <ol class="tline">
      <li><span class="tl-when">Today</span><div><h3>A 15-minute call</h3><p>We look at how leads reach you now, including after hours, run your numbers together, and tell you which plan fits and whether the guarantee applies. If it’s not a fit, I’ll say so.</p></div></li>
      <li><span class="tl-when">Day 1</span><div><h3>A 10-minute kickoff checklist</h3><p>Your trade, service area, the questions you ask on every job, your price ranges and when you do estimates. Your texting number is registered the same day.</p></div></li>
      <li><span class="tl-when">Days 2 to 14</span><div><h3>We build it around you</h3><p>Your wording, your prices and your calendar are connected to your existing number. Carrier approval for business texting takes 1 to 2 weeks and needs your IRS EIN letter (CP 575 or 147C).</p></div></li>
      <li><span class="tl-when">Go-live</span><div><h3>You approve every message</h3><p>You read each text before it can be sent to a customer. Then missed calls and forms start getting answered. Live within 21 business days of your checklist, or your setup fee comes back.</p></div></li>
      <li class="is-on"><span class="tl-when">After</span><div><h3>You show up to estimates</h3><p>You get a text when something books or someone asks for you, and a report every Monday. Monthly billing only starts the day your first booked appointment lands.</p></div></li>
    </ol>
  </div>
</section>
'''
need='''<section class="sec sec-tint" id="need">
  <div class="wrap twocol">
    <div><h2 class="split">What we need from you.</h2><ul class="ticks big"><li>About 30 minutes of your time in total</li><li>Access to the calendar you book estimates on</li><li>Your price ranges and the questions you ask</li><li>Your IRS EIN letter, for texting registration</li></ul></div>
    <div><h2 class="split">What you don’t have to do.</h2><ul class="ticks big"><li>Change your phone number</li><li>Switch software or learn a new one</li><li>Write any messages yourself</li><li>Sign a contract</li></ul></div>
  </div>
</section>
'''
howp=phead("We start with a call. We can’t help a business we don’t know.", "Every shop prices, qualifies and schedules differently. Here is exactly what happens from the first call to your first booked estimate.", ("/product","See the product"))+tl+need+tint(founder,False)+faqsec("Setup questions.",["How fast is setup?","What happens on the 15-minute call?","Does my number change?","Do I have to change my software?","What if I cancel?"],True)+tint(book,False)
page("how-it-works.html","/how-it-works","How it works · Cinder Revenue Company","From a 15-minute call to your first booked estimate: what happens each step, what we need from you, and how long it takes.", howp, "/how-it-works")

# ---------- Pricing ----------
plans_body=re.sub(r'<div class="head">[\s\S]*?</div>\n', '', plans, count=1)
pricing=phead("Two plans. Nothing monthly until we book your first appointment.", "Flat price, no lead caps, no per-minute fees and no contract. Quotes going quiet after you send them? Book &amp; Close. Quotes fine, but calls slip past you on the job? Never Miss a Lead.")+tint(plans_body,False)+faqsec("Pricing questions.",["Do I sign a contract?","When do I start paying monthly?","What if I cancel?","How fast is setup?","What happens on the 15-minute call?"],True)+tint(book,False)
page("pricing.html","/pricing","Pricing · Cinder Revenue Company","Never Miss a Lead is $697 a month and Book & Close is $1,497 a month. No contract, and monthly billing starts after your first booked appointment.", pricing, "/pricing")

# ---------- Try it ----------
ideas='''<section class="sec" id="ideas">
  <div class="wrap">
    <div class="head-c"><h2 class="split">Things worth trying.</h2><p class="lede">Text it the way your hardest customers do.</p></div>
    <ol class="start four">
      <li><h3>Ask for a price</h3><p>“How much for 200 ft of chain link?” It won’t invent a number; it qualifies first.</p></li>
      <li><h3>Be vague</h3><p>“Need some work done.” It asks the one question that moves things forward.</p></li>
      <li><h3>Ask for a person</h3><p>“Can I talk to the owner?” It hands off instead of arguing.</p></li>
      <li><h3>Pick a time</h3><p>Answer its questions and take a slot. You’ll see what the owner gets by text.</p></li>
    </ol>
  </div>
</section>
'''
tryp=re.sub(r'class="sec sec-tint" id="try"', 'class="sec ptry" id="try"', tryit).replace('<h2 class="split">Try it on your business. Text it like a customer would.</h2>','<h1 class="split">Try it on your business. Text it like a customer would.</h1>')
page("try.html","/demo","Try it · Cinder Revenue Company","Type what a homeowner would send your business and have the whole text conversation, through to a booked estimate. Nothing is texted or saved.", tryp+ideas+tint(book,True), "/demo")

# ---------- Book ----------
bookp=book.replace('<h2 class="split">','<h1 class="split">').replace("</h2>","</h1>",1).replace('class="sec book"','class="sec book pbook"')
page("book.html","/book","Book a call · Cinder Revenue Company","Pick a time for a free 15-minute call. We look at how leads reach you today and put a real number on what missed calls cost you.", bookp, "/book")

# ---------- Demo ----------
vid='''<section class="sec pvid" id="film">
  <div class="wrap">
    <div class="vid"><video src="/media/cinder-demo.mp4" poster="/media/cinder-demo-poster.jpg" controls autoplay muted playsinline preload="metadata" aria-label="A 66-second film: a missed call and an unanswered quote, then the same lead texted back, booked and the quote won with Cinder"></video></div>
    <p class="vid-note">66 seconds. The business, names and numbers are examples.</p>
  </div>
</section>
'''
tryd=tryp.replace('<h1 class="split">','<h2 class="split">').replace("</h1>","</h2>",1)
demop=phead("See it work. Then try it yourself.", "A one-minute film of a missed call and a quote nobody chased, then the same day with Cinder. Below it, text the live demo like a customer would and watch it book the estimate.", ("#try","Try it yourself"))+vid+tint(tryd,True)+ideas+tint(book,True)
page("demo/index.html","/demo","Demo · Cinder Revenue Company","Watch a missed call get texted back in seconds, qualified and booked, and a quote chased until it is won. Then text the live demo yourself. Nothing is texted or saved.", demop, "/demo")

# ---------- Legal and 404 ----------
for nm in ["privacy","terms"]:
    b=open(T+nm+".body.html").read()
    tt=re.search(r"<!--title:(.*?)-->",b).group(1); dd=re.search(r"<!--desc:(.*?)-->",b).group(1)
    b=re.sub(r"<!--(title|desc):.*?-->\n","",b)
    page(nm+".html","/"+nm,tt,dd,b+tint(book,True),"/"+nm)
nf='''<section class="phero pnf">
  <div class="wrap hero-in">
    <h1 class="split">This page doesn’t exist.</h1>
    <p class="lede">The link may be old or mistyped. Everything else is one click away.</p>
    <div class="hero-ctas"><a class="btn btn-go" href="/">Go to the homepage</a><a class="btn btn-ghost" href="/demo">Watch the demo</a></div>
  </div>
</section>
'''
page("404.html","/404","Page not found · Cinder Revenue Company","This page doesn’t exist.",nf,"/")
print("ok")
