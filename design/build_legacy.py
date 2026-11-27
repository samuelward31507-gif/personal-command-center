"""The audit tool, the two legal pages and the 404, on the same shell as the rest of the site.
Legal text is kept word for word in design/legacy/. Run after build_services.py."""
import re, pathlib
import build_services as B
S = pathlib.Path(__file__).resolve().parent.parent / 'site'; L = pathlib.Path(__file__).resolve().parent / 'legacy'

def main():
    shell = (S / 'answering.html').read_text(); head = shell[:shell.index('<header')]; hdr = re.search(r'<header class="gnav".*?</header>', shell, flags=re.S).group(0)
    tail = shell[shell.index('<section class="p-close"'):]
    tail = re.sub(r'<script src="/assets/cinder-plates.js"></script>\n<script src="/assets/scenes.js"></script>\n<script type="module" src="/assets/cinder-objects.js"></script>\n<script type="module" src="/assets/cinder-field.js"></script>\n', '', tail)
    foot = tail[tail.index('<footer'):] if '<footer' in tail else tail
    def page(slug, title, desc, body, tl, canon=None):
        h = head.replace('<title>Answering | Cinder Revenue Company</title>', f'<title>{title} | Cinder Revenue Company</title>').replace('https://cinderrevenue.com/answering', f'https://cinderrevenue.com/{canon if canon is not None else slug}').replace('content="Answering | Cinder Revenue Company"', f'content="{title} | Cinder Revenue Company"')
        h = re.sub(r'(name="description" content=")[^"]*', lambda m: m.group(1) + desc, h); h = re.sub(r'(property="og:description" content=")[^"]*', lambda m: m.group(1) + desc, h)
        (S / f'{slug}.html').write_text(h + hdr + '\n<main id="main">\n' + body + '\n' + tl)
    # ---- audit tool: same form and ids the script expects, new shell
    a = (L / 'audit.html').read_text()
    a = a.replace('<section class="sec ptry aud" id="audit">', '<section class="aud" id="audit"><div class="backdrop" data-flow="wave" data-p="' + B.ribbon(77) + '"></div>').replace('class="wrap aud-grid"', 'class="wrap aud-grid"')
    a = a.replace('<h1>', '<p class="eb">The free audit / Check your site</p><h1 class="rv">').replace('<p class="lede">', '<p class="lede rv d1">', 1)
    a = a.replace('class="btn btn-go" type="submit"', 'class="btn" type="submit"').replace('<a class="btn btn-go aud-cta" href="#book" id="aud-book">', '<a class="btn aud-cta" href="https://cal.com/audit-call/15min" target="_blank" rel="noopener" data-cta id="aud-book">')
    steps = '<section class="rows"><div class="wrap"><div><h2 class="rv">What happens next.</h2></div><ol><li class="rv"><b>You run the check</b><p>About 20 seconds. Nothing is texted or emailed to you.</p></li><li class="rv"><b>We go through it on a call</b><p>Fifteen minutes. We check the parts a website cannot show: missed calls, after-hours messages, quotes nobody chased.</p></li><li class="rv"><b>You keep the plan</b><p>What to fix first, in order, whether or not you work with us.</p></li></ol></div></section>'
    page('audit', 'Check your site', 'A free check of your website from a customer’s side, and what slow replies likely cost you each month, worked out from your own numbers.', a + '\n' + steps, tail.replace('</body>', '<script src="/audit.js" defer></script>\n</body>'))
    # ---- legal, word for word
    for slug, title, desc in (('privacy', 'Privacy policy', 'How Cinder Revenue Company collects, uses and protects the information you share with us, including text message consent.'), ('terms', 'Terms of use', 'The terms that apply when you use the Cinder Revenue Company website.')):
        page(slug, title, desc, '<section class="legal-sec"><article class="wrap legal">\n' + (L / f'{slug}.html').read_text() + '</article></section>', tail)
    # ---- 404
    links = ''.join(f'<a href="{h}"><b>{n}</b><span>{d}</span></a>' for h, n, d in (('/', 'Home', 'Start from the top.'), ('/everything', 'Everything we build', 'All thirty-two builds on one page.'), ('/free-audit', 'The free audit', 'What we check and what you keep.'), ('/questions', 'Questions', 'The answers owners ask for first.')))
    page('404', 'Page not found', 'This page does not exist.', '<section class="ov ov-hero svc nf"><div class="backdrop" data-flow="wave" data-p="' + B.ribbon(91) + '"></div><div class="wrap"><p class="eb">Error 404</p><h1 class="rv">This page doesn’t exist.</h1><p class="rv d1">The link may be old or mistyped. Everything else is one click away.</p><div class="rel-g nf-g">' + links + '</div></div></section>', foot if foot is not tail else tail, canon='')
    print('legacy pages written: audit, privacy, terms, 404')

if __name__ == '__main__': main()
